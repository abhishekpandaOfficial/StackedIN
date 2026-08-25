begin;

-- Phase 2 depends on every table created by the Phase 1 professional graph
-- migration. Fail early with an actionable error if the migrations are run
-- manually in the wrong order or Phase 1 was rolled back.
do $$
begin
  if to_regclass('public.ranking_configs') is null then
    raise exception using
      errcode = '42P01',
      message = 'Phase 1 is not installed: public.ranking_configs does not exist.',
      hint = 'Run 202608250002_professional_graph_foundation.sql successfully before this migration.';
  end if;
end
$$;

create or replace function public.get_people_recommendations(
  requested_tenant_id uuid,
  result_limit integer default 8
)
returns table (
  candidate_profile_id uuid,
  slug text,
  display_name text,
  headline text,
  avatar_url text,
  location text,
  current_company text,
  relevance_label text,
  rank_score numeric,
  reasons jsonb,
  shared_skill_count integer,
  shared_topic_count integer,
  mutual_connection_count integer
)
language sql
stable
security definer
set search_path = public
as $$
with
authorized as (
  select auth.uid() as viewer_id
  where auth.uid() is not null
    and public.is_tenant_member(requested_tenant_id)
),
weights as (
  select coalesce(
    (select rc.weights from public.ranking_configs rc where rc.engine = 'PEOPLE' and rc.active and rc.tenant_id = requested_tenant_id order by rc.version desc limit 1),
    (select rc.weights from public.ranking_configs rc where rc.engine = 'PEOPLE' and rc.active and rc.tenant_id is null order by rc.version desc limit 1),
    '{}'::jsonb
  ) as value
),
viewer as (
  select p.* from public.profiles p join authorized a on a.viewer_id = p.id
),
viewer_skills as (
  select distinct ps.skill_id
  from public.profile_skills ps join authorized a on a.viewer_id = ps.profile_id
  where ps.tenant_id = requested_tenant_id and ps.confidence_score >= 0.35
),
viewer_topics as (
  select distinct pi.topic_id
  from public.profile_interests pi join authorized a on a.viewer_id = pi.profile_id
  where pi.tenant_id = requested_tenant_id
    and greatest(pi.explicit_weight, pi.implicit_weight) - pi.negative_weight > 0.10
),
viewer_connections as (
  select case when c.requester_profile_id = a.viewer_id then c.addressee_profile_id else c.requester_profile_id end as connected_profile_id
  from public.connections c cross join authorized a
  where c.tenant_id = requested_tenant_id
    and c.status = 'ACCEPTED'
    and a.viewer_id in (c.requester_profile_id, c.addressee_profile_id)
),
eligible as (
  select candidate.*
  from public.profiles candidate cross join authorized a
  where candidate.id <> a.viewer_id
    and candidate.account_status = 'active'
    and candidate.profile_visibility = 'public'
    and candidate.searchable
    and candidate.recommendable
    and not exists (
      select 1 from public.blocks b
      where b.tenant_id = requested_tenant_id
        and ((b.blocker_profile_id = a.viewer_id and b.blocked_profile_id = candidate.id)
          or (b.blocker_profile_id = candidate.id and b.blocked_profile_id = a.viewer_id))
    )
    and not exists (
      select 1 from public.mutes m
      where m.tenant_id = requested_tenant_id
        and m.muter_profile_id = a.viewer_id
        and m.muted_profile_id = candidate.id
        and (m.expires_at is null or m.expires_at > now())
    )
    and not exists (
      select 1 from public.connections c
      where c.tenant_id = requested_tenant_id
        and least(c.requester_profile_id, c.addressee_profile_id) = least(a.viewer_id, candidate.id)
        and greatest(c.requester_profile_id, c.addressee_profile_id) = greatest(a.viewer_id, candidate.id)
        and (c.status in ('PENDING','ACCEPTED') or c.cooldown_until > now())
    )
    and not exists (
      select 1 from public.recommendation_events re
      where re.tenant_id = requested_tenant_id
        and re.viewer_profile_id = a.viewer_id
        and re.candidate_type = 'PROFILE'
        and re.candidate_id = candidate.id::text
        and re.event_type in ('DISMISS','NOT_RELEVANT','BLOCK')
        and re.created_at > now() - interval '30 days'
    )
    and (
      select count(*) from public.recommendation_events re
      where re.tenant_id = requested_tenant_id
        and re.viewer_profile_id = a.viewer_id
        and re.candidate_type = 'PROFILE'
        and re.candidate_id = candidate.id::text
        and re.event_type = 'IMPRESSION'
        and re.created_at > now() - interval '30 days'
    ) < 8
),
features as (
  select
    candidate.*,
    greatest(
      similarity(lower(coalesce(v.current_job_title, '')), lower(coalesce(candidate.current_job_title, ''))),
      similarity(lower(coalesce(v.headline, '')), lower(coalesce(candidate.headline, '')))
    )::numeric as professional_similarity,
    least(skill_stats.shared_count / 5.0, 1)::numeric as shared_skills,
    least(topic_stats.shared_count / 5.0, 1)::numeric as shared_topics,
    least(mutual_stats.shared_count / 5.0, 1)::numeric as mutual_connections,
    case when v.embedding is not null and candidate.embedding is not null then greatest(0, 1 - (v.embedding <=> candidate.embedding)) else 0 end::numeric as content_similarity,
    case when v.years_experience is null or candidate.years_experience is null then 0.35 else greatest(0, 1 - abs(v.years_experience - candidate.years_experience) / 15.0) end::numeric as career_relevance,
    case when nullif(lower(v.current_company), '') = nullif(lower(candidate.current_company), '') then 1 else 0 end::numeric as company_overlap,
    0::numeric as community_overlap,
    case
      when nullif(lower(v.country), '') = nullif(lower(candidate.country), '') then 1
      when nullif(lower(v.location), '') = nullif(lower(candidate.location), '') then 1
      else greatest(similarity(lower(coalesce(v.location, '')), lower(coalesce(candidate.location, ''))), 0)
    end::numeric as location_relevance,
    candidate.quality_score::numeric as network_quality,
    greatest(0, exp(-0.00385 * extract(epoch from (now() - candidate.updated_at)) / 86400))::numeric as freshness,
    (mod(abs(hashtext(candidate.id::text || a.viewer_id::text)), 100) / 100.0)::numeric as exploration_bonus,
    impression_stats.impression_count,
    skill_stats.shared_count as shared_skill_count,
    topic_stats.shared_count as shared_topic_count,
    mutual_stats.shared_count as mutual_connection_count
  from eligible candidate
  cross join authorized a
  cross join viewer v
  left join lateral (
    select count(distinct ps.skill_id)::integer as shared_count
    from public.profile_skills ps
    where ps.profile_id = candidate.id and ps.confidence_score >= 0.35
      and ps.skill_id in (select skill_id from viewer_skills)
  ) skill_stats on true
  left join lateral (
    select count(distinct pi.topic_id)::integer as shared_count
    from public.profile_interests pi
    where pi.profile_id = candidate.id
      and greatest(pi.explicit_weight, pi.implicit_weight) - pi.negative_weight > 0.10
      and pi.topic_id in (select topic_id from viewer_topics)
  ) topic_stats on true
  left join lateral (
    select count(*)::integer as shared_count
    from viewer_connections vc
    where exists (
      select 1 from public.connections cc
      where cc.tenant_id = requested_tenant_id and cc.status = 'ACCEPTED'
        and candidate.id in (cc.requester_profile_id, cc.addressee_profile_id)
        and vc.connected_profile_id in (cc.requester_profile_id, cc.addressee_profile_id)
    )
  ) mutual_stats on true
  left join lateral (
    select count(*)::integer as impression_count
    from public.recommendation_events re
    where re.tenant_id = requested_tenant_id and re.viewer_profile_id = a.viewer_id
      and re.candidate_type = 'PROFILE' and re.candidate_id = candidate.id::text
      and re.event_type = 'IMPRESSION' and re.created_at > now() - interval '30 days'
  ) impression_stats on true
),
scored as (
  select f.*,
    greatest(0, least(1,
      f.professional_similarity * coalesce((w.value->>'professional_similarity')::numeric, 0.20) +
      f.shared_skills * coalesce((w.value->>'shared_skills')::numeric, 0.15) +
      f.shared_topics * coalesce((w.value->>'shared_topics')::numeric, 0.14) +
      f.mutual_connections * coalesce((w.value->>'mutual_connections')::numeric, 0.12) +
      f.content_similarity * coalesce((w.value->>'content_similarity')::numeric, 0.10) +
      f.career_relevance * coalesce((w.value->>'career_relevance')::numeric, 0.08) +
      f.company_overlap * coalesce((w.value->>'company_overlap')::numeric, 0.06) +
      f.community_overlap * coalesce((w.value->>'community_overlap')::numeric, 0.04) +
      f.location_relevance * coalesce((w.value->>'location_relevance')::numeric, 0.03) +
      f.network_quality * coalesce((w.value->>'network_quality')::numeric, 0.03) +
      f.freshness * coalesce((w.value->>'freshness')::numeric, 0.03) +
      f.exploration_bonus * coalesce((w.value->>'exploration_bonus')::numeric, 0.02) -
      least(coalesce(f.impression_count, 0) * 0.08, 0.60)
    ))::numeric as final_score
  from features f cross join weights w
)
select
  s.id,
  s.slug,
  s.display_name,
  s.headline,
  s.avatar_url,
  s.location,
  s.current_company,
  case when s.final_score >= 0.65 then 'Strong match' when s.final_score >= 0.42 then 'Relevant' else 'Suggested' end,
  round(s.final_score, 5),
  to_jsonb(array_remove(array[
    case when s.shared_skill_count > 0 then s.shared_skill_count || ' shared skill' || case when s.shared_skill_count = 1 then '' else 's' end end,
    case when s.shared_topic_count > 0 then s.shared_topic_count || ' shared professional topic' || case when s.shared_topic_count = 1 then '' else 's' end end,
    case when s.mutual_connection_count > 0 then s.mutual_connection_count || ' mutual professional connection' || case when s.mutual_connection_count = 1 then '' else 's' end end,
    case when s.professional_similarity >= 0.55 then 'Related professional focus' end,
    case when s.location_relevance = 1 then 'Relevant location' end,
    case when s.content_similarity >= 0.65 then 'Similar knowledge and content interests' end,
    case when s.career_relevance >= 0.75 then 'Relevant career stage' end
  ], null)),
  s.shared_skill_count,
  s.shared_topic_count,
  s.mutual_connection_count
from scored s
order by s.final_score desc, s.quality_score desc, s.id
limit greatest(1, least(coalesce(result_limit, 8), 20));
$$;

create or replace function public.record_people_recommendation_impressions(
  requested_tenant_id uuid,
  candidate_profile_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare inserted_count integer;
begin
  if auth.uid() is null or not public.is_tenant_member(requested_tenant_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.recommendation_events(
    tenant_id, viewer_profile_id, candidate_type, candidate_id, event_type,
    ranking_score, ranking_position, candidate_sources, ranking_features, model_version
  )
  select
    requested_tenant_id, auth.uid(), 'PROFILE', r.candidate_profile_id::text, 'IMPRESSION',
    r.rank_score, row_number() over (order by r.rank_score desc),
    array['weighted_people_v1'], jsonb_build_object('reasons', r.reasons), 'people-v1'
  from public.get_people_recommendations(requested_tenant_id, 20) r
  where r.candidate_profile_id = any(candidate_profile_ids);

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.record_people_recommendation_outcome(
  requested_tenant_id uuid,
  candidate_profile_id uuid,
  outcome text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare event_id uuid;
begin
  if auth.uid() is null or not public.is_tenant_member(requested_tenant_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if candidate_profile_id = auth.uid() then raise exception 'invalid candidate' using errcode = '22023'; end if;
  if outcome not in ('CLICK','PROFILE_VIEW','FOLLOW','CONNECTION_REQUEST','DISMISS','NOT_RELEVANT','BLOCK') then
    raise exception 'invalid outcome' using errcode = '22023';
  end if;

  insert into public.recommendation_events(
    tenant_id, viewer_profile_id, candidate_type, candidate_id, event_type,
    candidate_sources, model_version
  ) values (
    requested_tenant_id, auth.uid(), 'PROFILE', candidate_profile_id::text, outcome,
    array['weighted_people_v1'], 'people-v1'
  ) returning id into event_id;
  return event_id;
end;
$$;

revoke all on function public.get_people_recommendations(uuid, integer) from public;
revoke all on function public.record_people_recommendation_impressions(uuid, uuid[]) from public;
revoke all on function public.record_people_recommendation_outcome(uuid, uuid, text) from public;
grant execute on function public.get_people_recommendations(uuid, integer) to authenticated;
grant execute on function public.record_people_recommendation_impressions(uuid, uuid[]) to authenticated;
grant execute on function public.record_people_recommendation_outcome(uuid, uuid, text) to authenticated;

update public.feature_flags
set enabled = true, rollout_percentage = 100, updated_at = now()
where key = 'people_recommendations' and tenant_id is null;

commit;

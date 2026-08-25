begin;

-- Phase 3: deterministic professional profile search. Semantic retrieval is
-- deliberately deferred to Phase 4; this release remains useful without AI.
do $$
begin
  if to_regclass('public.profile_skills') is null
     or to_regclass('public.ranking_configs') is null then
    raise exception using
      errcode = '42P01',
      message = 'Phase 1 is not installed: professional graph tables are missing.',
      hint = 'Apply 202608250002_professional_graph_foundation.sql before Phase 3.';
  end if;
end
$$;

create index if not exists profiles_current_job_title_trgm_idx
  on public.profiles using gin(current_job_title gin_trgm_ops);
create index if not exists profiles_location_trgm_idx
  on public.profiles using gin(location gin_trgm_ops);
create index if not exists profile_skills_search_idx
  on public.profile_skills(tenant_id, skill_id, profile_id)
  where confidence_score >= 0.35;
create index if not exists profile_interests_search_idx
  on public.profile_interests(tenant_id, topic_id, profile_id)
  where negative_weight < 0.50;
create index if not exists articles_author_search_idx
  on public.articles(tenant_id, author_id, status, published_at desc);

-- Phase 3 weights sum to one without a semantic component. Phase 4 will add
-- vector relevance and publish the next version instead of silently changing
-- this ranker's behavior.
update public.ranking_configs
set active = false
where tenant_id is null and engine = 'PROFILE_SEARCH' and active;

insert into public.ranking_configs(tenant_id, engine, version, weights, active)
values (
  null,
  'PROFILE_SEARCH',
  2,
  '{"lexical_relevance":0.35,"skill_match":0.20,"role_match":0.14,"topic_authority":0.09,"profile_quality":0.07,"reputation":0.05,"freshness":0.05,"connection_proximity":0.03,"activity_quality":0.02}'::jsonb,
  true
)
on conflict do nothing;

update public.ranking_configs
set weights = '{"lexical_relevance":0.35,"skill_match":0.20,"role_match":0.14,"topic_authority":0.09,"profile_quality":0.07,"reputation":0.05,"freshness":0.05,"connection_proximity":0.03,"activity_quality":0.02}'::jsonb,
    active = true
where tenant_id is null and engine = 'PROFILE_SEARCH' and version = 2;

insert into public.feature_flags(key, tenant_id, enabled, rollout_percentage)
select 'profile_search', null, true, 100
where not exists (
  select 1 from public.feature_flags where key = 'profile_search' and tenant_id is null
);

update public.feature_flags
set enabled = true, rollout_percentage = 100, updated_at = now()
where key = 'profile_search' and tenant_id is null;

create or replace function public.search_profiles(
  requested_tenant_id uuid,
  search_query text,
  location_filter text default null,
  role_filter text default null,
  skill_filters text[] default '{}'::text[],
  topic_filters text[] default '{}'::text[],
  content_author_required boolean default false,
  minimum_experience numeric default null,
  result_limit integer default 12,
  after_score numeric default null,
  after_profile_id uuid default null
)
returns table (
  profile_id uuid,
  slug text,
  display_name text,
  headline text,
  avatar_url text,
  location text,
  country text,
  current_company text,
  current_job_title text,
  years_experience numeric,
  key_skills text[],
  matched_terms text[],
  match_label text,
  rank_score numeric,
  reasons jsonb,
  is_connected boolean
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
params as (
  select
    left(trim(regexp_replace(coalesce(search_query, ''), '\s+', ' ', 'g')), 200) as normalized_query,
    nullif(left(trim(location_filter), 120), '') as requested_location,
    nullif(left(trim(role_filter), 120), '') as requested_role,
    coalesce(array(
      select distinct left(trim(value), 120)
      from unnest(coalesce(skill_filters, '{}'::text[])) value
      where trim(value) <> ''
    ), '{}'::text[]) as requested_skills,
    coalesce(array(
      select distinct left(trim(value), 160)
      from unnest(coalesce(topic_filters, '{}'::text[])) value
      where trim(value) <> ''
    ), '{}'::text[]) as requested_topics,
    case when minimum_experience is null then null else greatest(0, least(minimum_experience, 80)) end as requested_experience,
    greatest(1, least(coalesce(result_limit, 12), 51)) as page_size
),
query_state as (
  select p.*,
    case when p.normalized_query = '' then null
      else websearch_to_tsquery('simple'::regconfig, p.normalized_query)
    end as ts_query
  from params p
),
weights as (
  select coalesce(
    (select rc.weights from public.ranking_configs rc
      where rc.engine = 'PROFILE_SEARCH' and rc.active and rc.tenant_id = requested_tenant_id
      order by rc.version desc limit 1),
    (select rc.weights from public.ranking_configs rc
      where rc.engine = 'PROFILE_SEARCH' and rc.active and rc.tenant_id is null
      order by rc.version desc limit 1),
    '{"lexical_relevance":0.35,"skill_match":0.20,"role_match":0.14,"topic_authority":0.09,"profile_quality":0.07,"reputation":0.05,"freshness":0.05,"connection_proximity":0.03,"activity_quality":0.02}'::jsonb
  ) as value
),
eligible as (
  select candidate.*, a.viewer_id, q.*
  from public.profiles candidate
  cross join authorized a
  cross join query_state q
  where candidate.id <> a.viewer_id
    and candidate.account_status = 'active'
    and candidate.profile_visibility = 'public'
    and candidate.searchable
    and (q.requested_experience is null or candidate.years_experience >= q.requested_experience)
    and (
      q.requested_location is null
      or position(lower(q.requested_location) in lower(coalesce(candidate.location, '') || ' ' || coalesce(candidate.country, ''))) > 0
      or similarity(lower(q.requested_location), lower(coalesce(candidate.location, ''))) >= 0.30
    )
    and (
      q.requested_role is null
      or position(lower(q.requested_role) in lower(coalesce(candidate.current_job_title, '') || ' ' || coalesce(candidate.headline, ''))) > 0
      or greatest(
        similarity(lower(q.requested_role), lower(coalesce(candidate.current_job_title, ''))),
        similarity(lower(q.requested_role), lower(coalesce(candidate.headline, '')))
      ) >= 0.25
    )
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
),
features as (
  select
    candidate.*,
    greatest(
      case when candidate.ts_query is null then 0 else ts_rank_cd(candidate.search_document, candidate.ts_query, 32) end,
      similarity(lower(candidate.normalized_query), lower(coalesce(candidate.display_name, ''))),
      similarity(lower(candidate.normalized_query), lower(coalesce(candidate.headline, ''))) * 0.95,
      similarity(lower(candidate.normalized_query), lower(coalesce(candidate.current_job_title, ''))) * 0.95
    )::numeric as lexical_relevance,
    case
      when cardinality(candidate.requested_skills) > 0
        then least(skill_stats.matched_count::numeric / cardinality(candidate.requested_skills), 1)
      else least(skill_stats.matched_count / 3.0, 1)
    end::numeric as skill_match,
    greatest(
      case when candidate.requested_role is null then 0 else
        greatest(
          similarity(lower(candidate.requested_role), lower(coalesce(candidate.current_job_title, ''))),
          similarity(lower(candidate.requested_role), lower(coalesce(candidate.headline, '')))
        )
      end,
      similarity(lower(candidate.normalized_query), lower(coalesce(candidate.current_job_title, '')))
    )::numeric as role_match,
    greatest(
      case when cardinality(candidate.requested_topics) > 0
        then least(topic_stats.matched_count::numeric / cardinality(candidate.requested_topics), 1)
        else least(topic_stats.matched_count / 3.0, 1)
      end,
      least(article_stats.matched_count / 3.0, 1)
    )::numeric as topic_authority,
    candidate.quality_score::numeric as profile_quality,
    candidate.reputation_score::numeric as reputation,
    greatest(0, exp(-0.00230 * extract(epoch from (now() - candidate.updated_at)) / 86400))::numeric as freshness,
    case when graph_stats.direct_connection then 1 when graph_stats.mutual_count > 0 then least(graph_stats.mutual_count / 4.0, 0.75) else 0 end::numeric as connection_proximity,
    least(article_stats.total_count / 10.0, 1)::numeric as activity_quality,
    skill_stats.key_skills,
    skill_stats.matched_skills,
    skill_stats.matched_count as matched_skill_count,
    topic_stats.matched_topics,
    topic_stats.matched_count as matched_topic_count,
    article_stats.matched_count as matched_article_count,
    graph_stats.direct_connection,
    graph_stats.mutual_count
  from eligible candidate
  left join lateral (
    select
      (coalesce(array_agg(skill_name order by confidence desc), '{}'::text[]))[1:5] as key_skills,
      coalesce(array_agg(skill_name order by confidence desc) filter (where is_match), '{}'::text[]) as matched_skills,
      count(*) filter (where is_match)::integer as matched_count
    from (
      select s.canonical_name as skill_name, max(ps.confidence_score) as confidence,
        (
          lower(s.canonical_name) = any(select lower(value) from unnest(candidate.requested_skills) value)
          or exists (select 1 from unnest(s.aliases) alias where lower(alias) = any(select lower(value) from unnest(candidate.requested_skills) value))
          or (candidate.normalized_query <> '' and (
            position(lower(s.canonical_name) in lower(candidate.normalized_query)) > 0
            or exists (select 1 from unnest(s.aliases) alias where position(lower(alias) in lower(candidate.normalized_query)) > 0)
          ))
        ) as is_match
      from public.profile_skills ps
      join public.skills s on s.id = ps.skill_id
      where ps.tenant_id = requested_tenant_id
        and ps.profile_id = candidate.id
        and ps.confidence_score >= 0.35
      group by s.id, s.canonical_name, s.aliases
    ) candidate_skills
  ) skill_stats on true
  left join lateral (
    select
      coalesce(array_agg(topic_name order by relevance desc) filter (where is_match), '{}'::text[]) as matched_topics,
      count(*) filter (where is_match)::integer as matched_count
    from (
      select t.canonical_name as topic_name,
        greatest(pi.explicit_weight, pi.implicit_weight) - pi.negative_weight as relevance,
        (
          lower(t.canonical_name) = any(select lower(value) from unnest(candidate.requested_topics) value)
          or exists (select 1 from unnest(t.aliases) alias where lower(alias) = any(select lower(value) from unnest(candidate.requested_topics) value))
          or (candidate.normalized_query <> '' and (
            position(lower(t.canonical_name) in lower(candidate.normalized_query)) > 0
            or exists (select 1 from unnest(t.aliases) alias where position(lower(alias) in lower(candidate.normalized_query)) > 0)
          ))
        ) as is_match
      from public.profile_interests pi
      join public.topics t on t.id = pi.topic_id
      where pi.tenant_id = requested_tenant_id
        and pi.profile_id = candidate.id
        and greatest(pi.explicit_weight, pi.implicit_weight) - pi.negative_weight > 0.10
    ) candidate_topics
  ) topic_stats on true
  left join lateral (
    select
      count(*)::integer as total_count,
      count(*) filter (
        where (candidate.ts_query is not null and article.search_document @@ candidate.ts_query)
          or exists (
            select 1 from unnest(candidate.requested_topics) requested_topic
            where lower(requested_topic) = any(select lower(tag) from unnest(article.tags) tag)
              or position(lower(requested_topic) in lower(coalesce(article.pillar, ''))) > 0
          )
      )::integer as matched_count
    from public.articles article
    where article.tenant_id = requested_tenant_id
      and article.author_id = candidate.id
      and article.status = 'published'
  ) article_stats on true
  left join lateral (
    select
      exists (
        select 1 from public.connections direct
        where direct.tenant_id = requested_tenant_id and direct.status = 'ACCEPTED'
          and candidate.viewer_id in (direct.requester_profile_id, direct.addressee_profile_id)
          and candidate.id in (direct.requester_profile_id, direct.addressee_profile_id)
      ) as direct_connection,
      (
        select count(*)::integer
        from (
          select case when vc.requester_profile_id = candidate.viewer_id then vc.addressee_profile_id else vc.requester_profile_id end as mutual_id
          from public.connections vc
          where vc.tenant_id = requested_tenant_id and vc.status = 'ACCEPTED'
            and candidate.viewer_id in (vc.requester_profile_id, vc.addressee_profile_id)
        ) viewer_network
        where exists (
          select 1 from public.connections cc
          where cc.tenant_id = requested_tenant_id and cc.status = 'ACCEPTED'
            and candidate.id in (cc.requester_profile_id, cc.addressee_profile_id)
            and viewer_network.mutual_id in (cc.requester_profile_id, cc.addressee_profile_id)
        )
      ) as mutual_count
  ) graph_stats on true
),
matched as (
  select f.*
  from features f
  where (
      f.normalized_query = ''
      or f.lexical_relevance > 0.025
      or f.skill_match > 0
      or f.role_match >= 0.20
      or f.topic_authority > 0
    )
    and (cardinality(f.requested_skills) = 0 or f.matched_skill_count = cardinality(f.requested_skills))
    and (cardinality(f.requested_topics) = 0 or f.matched_topic_count > 0 or f.matched_article_count > 0)
    and (not content_author_required or f.matched_article_count > 0)
),
scored as (
  select m.*,
    round(greatest(0, least(1,
      m.lexical_relevance * coalesce((w.value->>'lexical_relevance')::numeric, 0.35) +
      m.skill_match * coalesce((w.value->>'skill_match')::numeric, 0.20) +
      m.role_match * coalesce((w.value->>'role_match')::numeric, 0.14) +
      m.topic_authority * coalesce((w.value->>'topic_authority')::numeric, 0.09) +
      m.profile_quality * coalesce((w.value->>'profile_quality')::numeric, 0.07) +
      m.reputation * coalesce((w.value->>'reputation')::numeric, 0.05) +
      m.freshness * coalesce((w.value->>'freshness')::numeric, 0.05) +
      m.connection_proximity * coalesce((w.value->>'connection_proximity')::numeric, 0.03) +
      m.activity_quality * coalesce((w.value->>'activity_quality')::numeric, 0.02)
    ))::numeric, 8) as computed_score
  from matched m cross join weights w
)
select
  s.id as profile_id,
  s.slug,
  coalesce(s.display_name, s.username, 'StackedIN member') as display_name,
  s.headline,
  s.avatar_url,
  s.location,
  s.country,
  s.current_company,
  s.current_job_title,
  s.years_experience,
  s.key_skills,
  ((coalesce(s.matched_skills, '{}'::text[]) || coalesce(s.matched_topics, '{}'::text[])))[1:8] as matched_terms,
  case when s.computed_score >= 0.62 then 'Strong match' when s.computed_score >= 0.38 then 'Relevant' else 'Suggested' end as match_label,
  s.computed_score as rank_score,
  to_jsonb(array_remove(array[
    case when s.matched_skill_count > 0 then s.matched_skill_count || case when s.matched_skill_count = 1 then ' matching skill' else ' matching skills' end end,
    case when s.requested_role is not null and s.role_match >= 0.35 then 'Role matches ' || s.requested_role end,
    case when s.requested_location is not null then 'Based in ' || coalesce(s.location, s.country, s.requested_location) end,
    case when s.matched_topic_count > 0 then 'Relevant topic expertise' end,
    case when s.matched_article_count > 0 then 'Publishes about this query' end,
    case when s.direct_connection then 'Already in your professional network' end,
    case when s.mutual_count > 0 then s.mutual_count || case when s.mutual_count = 1 then ' mutual connection' else ' mutual connections' end end
  ]::text[], null)) as reasons,
  s.direct_connection as is_connected
from scored s cross join params p
where after_score is null
   or s.computed_score < after_score
   or (s.computed_score = after_score and (after_profile_id is null or s.id > after_profile_id))
order by s.computed_score desc, s.id asc
limit (select page_size from params);
$$;

create or replace function public.record_profile_search_impressions(
  requested_tenant_id uuid,
  search_query text,
  result_profile_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  if auth.uid() is null or not public.is_tenant_member(requested_tenant_id) then
    raise exception using errcode = '42501', message = 'Not authorized for this tenant.';
  end if;
  if coalesce(cardinality(result_profile_ids), 0) > 50 then
    raise exception using errcode = '22023', message = 'At most 50 search impressions may be recorded per batch.';
  end if;

  insert into public.user_interactions(
    tenant_id, actor_profile_id, entity_type, entity_id,
    target_profile_id, event_type, metadata
  )
  select
    requested_tenant_id,
    auth.uid(),
    'SEARCH_RESULT',
    candidate.id::text,
    candidate.id,
    'SEARCH_RESULT_IMPRESSION',
    jsonb_build_object(
      'query_hash', encode(digest(lower(trim(coalesce(search_query, ''))), 'sha256'), 'hex'),
      'ranking_position', requested.ordinality
    )
  from unnest(coalesce(result_profile_ids, '{}'::uuid[])) with ordinality requested(profile_id, ordinality)
  join public.profiles candidate on candidate.id = requested.profile_id
  where candidate.account_status = 'active'
    and candidate.profile_visibility = 'public'
    and candidate.searchable
    and candidate.id <> auth.uid();

  get diagnostics inserted_count = row_count;
  return inserted_count;
end
$$;

revoke all on function public.search_profiles(uuid, text, text, text, text[], text[], boolean, numeric, integer, numeric, uuid) from public;
revoke all on function public.record_profile_search_impressions(uuid, text, uuid[]) from public;
grant execute on function public.search_profiles(uuid, text, text, text, text[], text[], boolean, numeric, integer, numeric, uuid) to authenticated;
grant execute on function public.record_profile_search_impressions(uuid, text, uuid[]) to authenticated;

commit;

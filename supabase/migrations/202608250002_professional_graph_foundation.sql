begin;

create extension if not exists vector;
create extension if not exists pg_trgm;

-- Profiles are global professional identities. Tenant membership remains in
-- tenant_memberships; private actions below always carry tenant_id.
alter table public.profiles
  add column if not exists slug text,
  add column if not exists headline text,
  add column if not exists about text,
  add column if not exists location text,
  add column if not exists country text,
  add column if not exists industry text,
  add column if not exists current_company text,
  add column if not exists current_role text,
  add column if not exists years_experience numeric(5,2),
  add column if not exists profile_visibility text not null default 'public',
  add column if not exists searchable boolean not null default true,
  add column if not exists recommendable boolean not null default true,
  add column if not exists banner_url text,
  add column if not exists profile_completeness numeric(5,4) not null default 0,
  add column if not exists reputation_score numeric(8,5) not null default 0,
  add column if not exists authority_score numeric(8,5) not null default 0,
  add column if not exists quality_score numeric(8,5) not null default 0,
  add column if not exists account_status text not null default 'active',
  add column if not exists embedding vector(1536),
  add column if not exists embedding_model text,
  add column if not exists embedding_version integer,
  add column if not exists embedding_updated_at timestamptz,
  add column if not exists search_document tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(display_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(headline, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(current_role, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(current_company, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(industry, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(about, bio, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(location, '') || ' ' || coalesce(country, '')), 'B')
  ) stored;

update public.profiles
set slug = coalesce(
  nullif(slug, ''),
  nullif(trim(both '-' from regexp_replace(lower(coalesce(username, display_name, 'member')), '[^a-z0-9]+', '-', 'g')), ''),
  'member-' || left(replace(id::text, '-', ''), 8)
)
where slug is null or slug = '';

alter table public.profiles
  drop constraint if exists profiles_visibility_check,
  add constraint profiles_visibility_check check (profile_visibility in ('public', 'tenant', 'private')),
  drop constraint if exists profiles_account_status_check,
  add constraint profiles_account_status_check check (account_status in ('active', 'suspended', 'deleted')),
  drop constraint if exists profiles_years_experience_check,
  add constraint profiles_years_experience_check check (years_experience is null or years_experience between 0 and 80),
  drop constraint if exists profiles_score_bounds_check,
  add constraint profiles_score_bounds_check check (
    profile_completeness between 0 and 1 and
    reputation_score between 0 and 1 and
    authority_score between 0 and 1 and
    quality_score between 0 and 1
  );

create unique index if not exists profiles_slug_unique_idx on public.profiles(lower(slug)) where slug is not null;
create index if not exists profiles_search_document_idx on public.profiles using gin(search_document);
create index if not exists profiles_name_trgm_idx on public.profiles using gin(display_name gin_trgm_ops);
create index if not exists profiles_headline_trgm_idx on public.profiles using gin(headline gin_trgm_ops);
create index if not exists profiles_discovery_idx on public.profiles(account_status, searchable, recommendable, profile_visibility);
create index if not exists profiles_embedding_hnsw_idx on public.profiles using hnsw (embedding vector_cosine_ops) where embedding is not null;

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null check (char_length(canonical_name) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category text,
  description text not null default '',
  parent_skill_id uuid references public.skills(id) on delete set null,
  aliases text[] not null default '{}',
  embedding vector(1536),
  embedding_model text,
  embedding_version integer,
  embedding_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug),
  check (parent_skill_id is null or parent_skill_id <> id)
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null check (char_length(canonical_name) between 1 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null default '',
  parent_topic_id uuid references public.topics(id) on delete set null,
  aliases text[] not null default '{}',
  embedding vector(1536),
  embedding_model text,
  embedding_version integer,
  embedding_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug),
  check (parent_topic_id is null or parent_topic_id <> id)
);

create index if not exists skills_name_trgm_idx on public.skills using gin(canonical_name gin_trgm_ops);
create index if not exists skills_embedding_hnsw_idx on public.skills using hnsw (embedding vector_cosine_ops) where embedding is not null;
create index if not exists topics_name_trgm_idx on public.topics using gin(canonical_name gin_trgm_ops);
create index if not exists topics_embedding_hnsw_idx on public.topics using hnsw (embedding vector_cosine_ops) where embedding is not null;

create table if not exists public.profile_skills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  proficiency smallint check (proficiency is null or proficiency between 1 and 5),
  years_experience numeric(5,2) check (years_experience is null or years_experience between 0 and 80),
  confidence_score numeric(5,4) not null default 1 check (confidence_score between 0 and 1),
  source text not null default 'MANUAL' check (source in ('MANUAL','PROFILE_IMPORT','ARTICLE_ANALYSIS','PROJECT_ANALYSIS','GITHUB','RESUME','ADMIN','AI_INFERRED')),
  verified boolean not null default false,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, profile_id, skill_id, source)
);

create table if not exists public.profile_interests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete restrict,
  explicit_weight numeric(8,5) not null default 0 check (explicit_weight between 0 and 1),
  implicit_weight numeric(8,5) not null default 0 check (implicit_weight between 0 and 1),
  negative_weight numeric(8,5) not null default 0 check (negative_weight between 0 and 1),
  confidence numeric(5,4) not null default 0 check (confidence between 0 and 1),
  last_interaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, profile_id, topic_id)
);

create index if not exists profile_skills_profile_idx on public.profile_skills(tenant_id, profile_id);
create index if not exists profile_skills_skill_idx on public.profile_skills(skill_id, confidence_score desc);
create index if not exists profile_interests_profile_idx on public.profile_interests(tenant_id, profile_id);
create index if not exists profile_interests_topic_idx on public.profile_interests(topic_id, explicit_weight desc, implicit_weight desc);

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  requester_profile_id uuid not null references public.profiles(id) on delete cascade,
  addressee_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','DECLINED','CANCELLED','REMOVED')),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  cooldown_until timestamptz,
  updated_at timestamptz not null default now(),
  check (requester_profile_id <> addressee_profile_id)
);

create unique index if not exists connections_canonical_pair_idx
  on public.connections(tenant_id, least(requester_profile_id, addressee_profile_id), greatest(requester_profile_id, addressee_profile_id))
  where status in ('PENDING','ACCEPTED');
create index if not exists connections_requester_idx on public.connections(tenant_id, requester_profile_id, status, updated_at desc);
create index if not exists connections_addressee_idx on public.connections(tenant_id, addressee_profile_id, status, updated_at desc);

create table if not exists public.follows (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  follower_profile_id uuid not null references public.profiles(id) on delete cascade,
  followed_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tenant_id, follower_profile_id, followed_profile_id),
  check (follower_profile_id <> followed_profile_id)
);

create table if not exists public.blocks (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  blocker_profile_id uuid not null references public.profiles(id) on delete cascade,
  blocked_profile_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (tenant_id, blocker_profile_id, blocked_profile_id),
  check (blocker_profile_id <> blocked_profile_id)
);

create table if not exists public.mutes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  muter_profile_id uuid not null references public.profiles(id) on delete cascade,
  muted_profile_id uuid references public.profiles(id) on delete cascade,
  muted_topic_id uuid references public.topics(id) on delete cascade,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (num_nonnulls(muted_profile_id, muted_topic_id) = 1),
  check (muted_profile_id is null or muter_profile_id <> muted_profile_id)
);

create unique index if not exists mutes_profile_unique_idx on public.mutes(tenant_id, muter_profile_id, muted_profile_id) where muted_profile_id is not null;
create unique index if not exists mutes_topic_unique_idx on public.mutes(tenant_id, muter_profile_id, muted_topic_id) where muted_topic_id is not null;
create index if not exists follows_followed_idx on public.follows(tenant_id, followed_profile_id);
create index if not exists blocks_blocked_idx on public.blocks(tenant_id, blocked_profile_id);

create table if not exists public.user_interactions (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('PROFILE','POST','ARTICLE','TOPIC','COMMUNITY','PROJECT','RECOMMENDATION','SEARCH_RESULT')),
  entity_id text not null,
  target_profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in (
    'PROFILE_IMPRESSION','PROFILE_VIEW','SEARCH_RESULT_IMPRESSION','SEARCH_RESULT_CLICK',
    'POST_IMPRESSION','POST_OPEN','POST_READ','POST_LIKE','POST_SAVE','POST_SHARE','POST_COMMENT',
    'FOLLOW','UNFOLLOW','CONNECTION_IMPRESSION','CONNECTION_REQUEST','CONNECTION_ACCEPTED','CONNECTION_DISMISSED',
    'NOT_INTERESTED','HIDE_POST','HIDE_AUTHOR','MUTE_AUTHOR','MUTE_TOPIC','BLOCK_USER'
  )),
  weight numeric(8,5) not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists interactions_actor_time_idx on public.user_interactions(tenant_id, actor_profile_id, occurred_at desc);
create index if not exists interactions_entity_idx on public.user_interactions(tenant_id, entity_type, entity_id, occurred_at desc);
create index if not exists interactions_target_idx on public.user_interactions(tenant_id, target_profile_id, event_type, occurred_at desc) where target_profile_id is not null;
create index if not exists interactions_negative_idx on public.user_interactions(tenant_id, actor_profile_id, occurred_at desc)
  where event_type in ('NOT_INTERESTED','HIDE_POST','HIDE_AUTHOR','MUTE_AUTHOR','MUTE_TOPIC','BLOCK_USER','CONNECTION_DISMISSED');

create table if not exists public.recommendation_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  viewer_profile_id uuid not null references public.profiles(id) on delete cascade,
  candidate_type text not null check (candidate_type in ('PROFILE','POST','ARTICLE','TOPIC','COMMUNITY')),
  candidate_id text not null,
  event_type text not null default 'IMPRESSION' check (event_type in ('IMPRESSION','CLICK','PROFILE_VIEW','FOLLOW','CONNECTION_REQUEST','CONNECTION_ACCEPTED','POST_OPEN','POST_SAVE','POST_LIKE','POST_SHARE','DISMISS','NOT_RELEVANT','BLOCK')),
  ranking_score numeric(12,8),
  ranking_position integer check (ranking_position is null or ranking_position > 0),
  candidate_sources text[] not null default '{}',
  ranking_features jsonb not null default '{}'::jsonb,
  model_version text not null,
  experiment_id text,
  variant text,
  recommendation_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists recommendation_viewer_time_idx on public.recommendation_events(tenant_id, viewer_profile_id, created_at desc);
create index if not exists recommendation_candidate_idx on public.recommendation_events(tenant_id, candidate_type, candidate_id, created_at desc);
create index if not exists recommendation_impressions_idx on public.recommendation_events(tenant_id, viewer_profile_id, candidate_type, created_at desc) where event_type = 'IMPRESSION';

create table if not exists public.profile_intelligence (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  intelligence jsonb not null default '{}'::jsonb,
  model text not null,
  model_version text not null,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  generated_at timestamptz not null default now(),
  primary key (tenant_id, profile_id)
);

create table if not exists public.embedding_jobs (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null check (entity_type in ('PROFILE','ARTICLE','SKILL','TOPIC','PROJECT','POST','COMMUNITY')),
  entity_id text not null,
  status text not null default 'PENDING' check (status in ('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED')),
  target_model text not null,
  target_version integer not null check (target_version > 0),
  attempts smallint not null default 0 check (attempts between 0 and 20),
  last_error text,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, entity_type, entity_id, target_model, target_version)
);

create index if not exists embedding_jobs_queue_idx on public.embedding_jobs(status, available_at, created_at) where status in ('PENDING','FAILED');

create table if not exists public.ranking_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  engine text not null check (engine in ('PEOPLE','PROFILE_SEARCH','FEED','RELEVANT_RECOMMENDATION_RATE')),
  version integer not null check (version > 0),
  weights jsonb not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique nulls not distinct (tenant_id, engine, version)
);

create unique index if not exists ranking_configs_one_active_idx on public.ranking_configs(coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), engine) where active;

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null check (key ~ '^[a-z0-9_]+$'),
  tenant_id uuid references public.tenants(id) on delete cascade,
  enabled boolean not null default false,
  rollout_percentage smallint not null default 0 check (rollout_percentage between 0 and 100),
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index if not exists feature_flags_scope_idx on public.feature_flags(key, coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.articles
  add column if not exists canonical_url text,
  add column if not exists content_fingerprint text,
  add column if not exists source_type text not null default 'USER',
  add column if not exists source_provider text,
  add column if not exists source_external_id text,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb,
  add column if not exists import_permission text not null default 'REFERENCE',
  add column if not exists ownership_verified boolean not null default false,
  add column if not exists embedding vector(1536),
  add column if not exists embedding_model text,
  add column if not exists embedding_version integer,
  add column if not exists embedding_updated_at timestamptz,
  add column if not exists search_document tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(body, '')), 'C') ||
    setweight(to_tsvector('simple', array_to_string(tags, ' ')), 'A')
  ) stored;

alter table public.articles
  drop constraint if exists articles_import_permission_check,
  add constraint articles_import_permission_check check (import_permission in ('REFERENCE','MIRROR')),
  drop constraint if exists articles_source_type_check,
  add constraint articles_source_type_check check (source_type in ('USER','LINKEDIN','GITHUB','SUBSTACK','MEDIUM','DEVTO','HASHNODE','RSS','RESUME','AI_INFERRED'));

create unique index if not exists articles_canonical_url_idx on public.articles(tenant_id, canonical_url) where canonical_url is not null;
create unique index if not exists articles_source_external_idx on public.articles(tenant_id, source_provider, source_external_id) where source_provider is not null and source_external_id is not null;
create index if not exists articles_fingerprint_idx on public.articles(tenant_id, content_fingerprint) where content_fingerprint is not null;
create index if not exists articles_search_document_idx on public.articles using gin(search_document);
create index if not exists articles_embedding_hnsw_idx on public.articles using hnsw (embedding vector_cosine_ops) where embedding is not null;

-- Update timestamps using the existing migration's trigger function.
do $$
declare table_name text;
begin
  foreach table_name in array array['skills','topics','profile_skills','profile_interests','connections','embedding_jobs','feature_flags']
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end;
$$;

create or replace function public.is_profile_owner(check_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select check_profile_id = auth.uid();
$$;

create or replace function public.can_use_profile_in_tenant(check_tenant_id uuid, check_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select check_profile_id = auth.uid() and public.is_tenant_member(check_tenant_id);
$$;

revoke all on function public.is_profile_owner(uuid) from public;
revoke all on function public.can_use_profile_in_tenant(uuid, uuid) from public;
grant execute on function public.is_profile_owner(uuid) to authenticated;
grant execute on function public.can_use_profile_in_tenant(uuid, uuid) to authenticated;

-- Keep the auth trigger compatible with the extended profile schema.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_tenant_id uuid;
  base_name text;
  base_slug text;
  unique_slug text;
begin
  base_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1), 'StackedIN Member');
  base_slug := trim(both '-' from regexp_replace(lower(base_name), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'member'; end if;
  unique_slug := base_slug || '-' || left(replace(new.id::text, '-', ''), 8);

  insert into public.profiles (id, username, slug, display_name, avatar_url)
  values (new.id, unique_slug, unique_slug, base_name, coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'))
  on conflict (id) do nothing;

  insert into public.tenants (name, slug, owner_id)
  values (base_name || '''s Workspace', unique_slug, new.id)
  returning id into new_tenant_id;

  insert into public.tenant_memberships (tenant_id, user_id, role)
  values (new_tenant_id, new.id, 'owner');
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

-- Atomic relationship RPCs prevent actor spoofing and illegal state transitions.
create or replace function public.send_connection_request(target_profile_id uuid, requested_tenant_id uuid)
returns public.connections
language plpgsql security definer set search_path = public as $$
declare created_connection public.connections;
begin
  if auth.uid() is null or not public.is_tenant_member(requested_tenant_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  if target_profile_id = auth.uid() then raise exception 'cannot connect to self' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles p where p.id = target_profile_id and p.account_status = 'active' and p.recommendable) then raise exception 'profile unavailable' using errcode = 'P0002'; end if;
  if exists (select 1 from public.blocks b where b.tenant_id = requested_tenant_id and ((b.blocker_profile_id = auth.uid() and b.blocked_profile_id = target_profile_id) or (b.blocker_profile_id = target_profile_id and b.blocked_profile_id = auth.uid()))) then raise exception 'connection unavailable' using errcode = '42501'; end if;
  if exists (select 1 from public.connections c where c.tenant_id = requested_tenant_id and least(c.requester_profile_id,c.addressee_profile_id) = least(auth.uid(),target_profile_id) and greatest(c.requester_profile_id,c.addressee_profile_id) = greatest(auth.uid(),target_profile_id) and (c.status in ('PENDING','ACCEPTED') or c.cooldown_until > now())) then raise exception 'connection already exists or is cooling down' using errcode = '23505'; end if;
  insert into public.connections(tenant_id, requester_profile_id, addressee_profile_id)
  values (requested_tenant_id, auth.uid(), target_profile_id)
  returning * into created_connection;
  return created_connection;
end;
$$;

create or replace function public.respond_to_connection(connection_id uuid, decision text)
returns public.connections
language plpgsql security definer set search_path = public as $$
declare updated_connection public.connections;
begin
  if decision not in ('ACCEPTED','DECLINED') then raise exception 'invalid decision' using errcode = '22023'; end if;
  update public.connections c set status = decision, responded_at = now(), cooldown_until = case when decision = 'DECLINED' then now() + interval '30 days' else null end
  where c.id = connection_id and c.addressee_profile_id = auth.uid() and c.status = 'PENDING'
  returning * into updated_connection;
  if updated_connection.id is null then raise exception 'connection not found' using errcode = 'P0002'; end if;
  return updated_connection;
end;
$$;

create or replace function public.cancel_connection_request(connection_id uuid)
returns public.connections
language plpgsql security definer set search_path = public as $$
declare updated_connection public.connections;
begin
  update public.connections c set status = 'CANCELLED', responded_at = now()
  where c.id = connection_id and c.requester_profile_id = auth.uid() and c.status = 'PENDING'
  returning * into updated_connection;
  if updated_connection.id is null then raise exception 'connection not found' using errcode = 'P0002'; end if;
  return updated_connection;
end;
$$;

create or replace function public.remove_connection(connection_id uuid)
returns public.connections
language plpgsql security definer set search_path = public as $$
declare updated_connection public.connections;
begin
  update public.connections c set status = 'REMOVED', responded_at = now()
  where c.id = connection_id and auth.uid() in (c.requester_profile_id,c.addressee_profile_id) and c.status = 'ACCEPTED'
  returning * into updated_connection;
  if updated_connection.id is null then raise exception 'connection not found' using errcode = 'P0002'; end if;
  return updated_connection;
end;
$$;

revoke all on function public.send_connection_request(uuid, uuid) from public;
revoke all on function public.respond_to_connection(uuid, text) from public;
revoke all on function public.cancel_connection_request(uuid) from public;
revoke all on function public.remove_connection(uuid) from public;
grant execute on function public.send_connection_request(uuid, uuid) to authenticated;
grant execute on function public.respond_to_connection(uuid, text) to authenticated;
grant execute on function public.cancel_connection_request(uuid) to authenticated;
grant execute on function public.remove_connection(uuid) to authenticated;

-- Replace the overly broad legacy public profile policy.
drop policy if exists "Profiles are readable" on public.profiles;
drop policy if exists "Discoverable profiles are readable" on public.profiles;
create policy "Discoverable profiles are readable" on public.profiles for select
using ((profile_visibility = 'public' and searchable and account_status = 'active') or id = auth.uid());

-- Taxonomy is public read-only; writes are reserved for trusted backend roles.
alter table public.skills enable row level security;
alter table public.topics enable row level security;
create policy "Skills are readable" on public.skills for select using (true);
create policy "Topics are readable" on public.topics for select using (true);

alter table public.profile_skills enable row level security;
alter table public.profile_interests enable row level security;
create policy "Visible profile skills are readable" on public.profile_skills for select using (
  public.is_tenant_member(tenant_id) or exists (select 1 from public.profiles p where p.id = profile_id and p.profile_visibility = 'public' and p.searchable and p.account_status = 'active')
);
create policy "Users manage own skills" on public.profile_skills for all to authenticated
using (public.can_use_profile_in_tenant(tenant_id, profile_id)) with check (public.can_use_profile_in_tenant(tenant_id, profile_id));
create policy "Visible profile interests are readable" on public.profile_interests for select using (
  public.is_tenant_member(tenant_id) or exists (select 1 from public.profiles p where p.id = profile_id and p.profile_visibility = 'public' and p.searchable and p.account_status = 'active')
);
create policy "Users manage own interests" on public.profile_interests for all to authenticated
using (public.can_use_profile_in_tenant(tenant_id, profile_id)) with check (public.can_use_profile_in_tenant(tenant_id, profile_id));

alter table public.connections enable row level security;
create policy "Connection participants read" on public.connections for select to authenticated using (auth.uid() in (requester_profile_id, addressee_profile_id));
revoke insert, update, delete on public.connections from anon, authenticated;

alter table public.follows enable row level security;
create policy "Follow participants read" on public.follows for select to authenticated using (auth.uid() in (follower_profile_id, followed_profile_id));
create policy "Users manage own follows" on public.follows for all to authenticated
using (public.can_use_profile_in_tenant(tenant_id, follower_profile_id)) with check (public.can_use_profile_in_tenant(tenant_id, follower_profile_id));

alter table public.blocks enable row level security;
create policy "Block owners read" on public.blocks for select to authenticated using (blocker_profile_id = auth.uid());
create policy "Users manage own blocks" on public.blocks for all to authenticated
using (public.can_use_profile_in_tenant(tenant_id, blocker_profile_id)) with check (public.can_use_profile_in_tenant(tenant_id, blocker_profile_id));

alter table public.mutes enable row level security;
create policy "Mute owners read" on public.mutes for select to authenticated using (muter_profile_id = auth.uid());
create policy "Users manage own mutes" on public.mutes for all to authenticated
using (public.can_use_profile_in_tenant(tenant_id, muter_profile_id)) with check (public.can_use_profile_in_tenant(tenant_id, muter_profile_id));

alter table public.user_interactions enable row level security;
create policy "Users read own interactions" on public.user_interactions for select to authenticated using (actor_profile_id = auth.uid());
create policy "Users record own interactions" on public.user_interactions for insert to authenticated with check (public.can_use_profile_in_tenant(tenant_id, actor_profile_id));

alter table public.recommendation_events enable row level security;
create policy "Users read own recommendation history" on public.recommendation_events for select to authenticated using (viewer_profile_id = auth.uid());
revoke insert, update, delete on public.recommendation_events from anon, authenticated;

alter table public.profile_intelligence enable row level security;
create policy "Users read own profile intelligence" on public.profile_intelligence for select to authenticated using (profile_id = auth.uid() and public.is_tenant_member(tenant_id));
revoke insert, update, delete on public.profile_intelligence from anon, authenticated;

alter table public.embedding_jobs enable row level security;
revoke all on public.embedding_jobs from anon, authenticated;

alter table public.ranking_configs enable row level security;
create policy "Members read active ranking configuration" on public.ranking_configs for select to authenticated
using (active and (tenant_id is null or public.is_tenant_member(tenant_id)));
revoke insert, update, delete on public.ranking_configs from anon, authenticated;

alter table public.feature_flags enable row level security;
create policy "Members read feature flags" on public.feature_flags for select to authenticated
using (tenant_id is null or public.is_tenant_member(tenant_id));
revoke insert, update, delete on public.feature_flags from anon, authenticated;

insert into public.ranking_configs(engine, version, weights, active)
values
('PEOPLE', 1, '{"professional_similarity":0.20,"shared_skills":0.15,"shared_topics":0.14,"mutual_connections":0.12,"content_similarity":0.10,"career_relevance":0.08,"company_overlap":0.06,"community_overlap":0.04,"location_relevance":0.03,"network_quality":0.03,"freshness":0.03,"exploration_bonus":0.02,"negative_feedback":1.0,"repetition_penalty":1.0,"spam_penalty":1.0}'::jsonb, true),
('PROFILE_SEARCH', 1, '{"lexical_relevance":0.27,"semantic_relevance":0.22,"skill_match":0.15,"role_match":0.10,"topic_authority":0.07,"profile_quality":0.05,"reputation":0.04,"freshness":0.04,"connection_proximity":0.03,"activity_quality":0.03}'::jsonb, true),
('FEED', 1, '{"personal_relevance":0.25,"topic_relevance":0.18,"semantic_similarity":0.14,"relationship_strength":0.10,"content_quality":0.08,"author_authority":0.07,"freshness":0.05,"professional_utility":0.05,"engagement_probability":0.04,"discovery_score":0.04,"negative_feedback":1.0,"repetition_penalty":1.0,"clickbait_penalty":1.0,"spam_penalty":1.0}'::jsonb, true),
('RELEVANT_RECOMMENDATION_RATE', 1, '{"view":1,"follow":3,"save":4,"connection_request":5,"connection_accepted":8,"dismiss":-2,"not_relevant":-6,"block":-10}'::jsonb, true)
on conflict do nothing;

insert into public.feature_flags(key, tenant_id, enabled, rollout_percentage)
values
('professional_graph', null, true, 100),
('people_recommendations', null, false, 0),
('semantic_search', null, false, 0),
('feed_recommendations', null, false, 0),
('natural_language_search', null, false, 0),
('linkedin_import', null, false, 0),
('content_import', null, false, 0),
('ai_profile_enrichment', null, false, 0),
('experimental_ranker', null, false, 0)
on conflict do nothing;

commit;

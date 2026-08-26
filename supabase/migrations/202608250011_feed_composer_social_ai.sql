begin;

do $$
begin
  if to_regclass('public.articles') is null
     or to_regclass('public.distribution_jobs') is null
     or to_regclass('public.notifications') is null
     or to_regprocedure('public.has_tenant_role(uuid,text[])') is null then
    raise exception using errcode = '42P01', message = 'Unified composer dependencies are missing.', hint = 'Apply migrations 001 through 010 before migration 011.';
  end if;
end
$$;

alter table public.articles
  drop constraint if exists articles_distribution_targets_check,
  add constraint articles_distribution_targets_check check (
    distribution_targets <@ array['STACKEDIN','SUBSTACK','MEDIUM','HASHNODE','LINKEDIN','INSTAGRAM','X','THREADS']::text[]
    and 'STACKEDIN' = any(distribution_targets)
  );

alter table public.distribution_jobs
  drop constraint if exists distribution_jobs_platform_check,
  add constraint distribution_jobs_platform_check check (
    platform in ('STACKEDIN','SUBSTACK','MEDIUM','HASHNODE','LINKEDIN','INSTAGRAM','X','THREADS')
  );

alter table public.article_shares
  drop constraint if exists article_shares_destination_check,
  add constraint article_shares_destination_check check (
    destination in ('COPY_LINK','NATIVE_SHARE','LINKEDIN','MEDIUM','HASHNODE','SUBSTACK','INSTAGRAM','X','THREADS','EMAIL','OTHER')
  );

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('SUBSTACK','MEDIUM','HASHNODE','LINKEDIN','INSTAGRAM','X','THREADS')),
  status text not null default 'DISCONNECTED' check (status in ('DISCONNECTED','HANDOFF_READY','CONNECTING','CONNECTED','REAUTH_REQUIRED','ERROR')),
  connection_method text not null default 'HANDOFF' check (connection_method in ('HANDOFF','OAUTH','TOKEN')),
  external_account_id text,
  handle text,
  display_name text,
  profile_url text,
  scopes text[] not null default '{}',
  capabilities jsonb not null default '{"share":true,"direct_publish":false}'::jsonb check (jsonb_typeof(capabilities) = 'object'),
  token_expires_at timestamptz,
  last_verified_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, owner_profile_id, provider)
);

create table if not exists public.social_account_credentials (
  social_account_id uuid primary key references public.social_accounts(id) on delete cascade,
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  encryption_version smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.article_writing_scores (
  article_id uuid primary key references public.articles(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  evaluated_by uuid references public.profiles(id) on delete set null,
  human_score smallint not null check (human_score between 0 and 100),
  ai_score smallint not null check (ai_score between 0 and 100),
  confidence text not null check (confidence in ('very low','low','medium','high')),
  confidence_percent smallint not null check (confidence_percent between 0 and 100),
  method text not null,
  signals jsonb not null default '[]'::jsonb check (jsonb_typeof(signals) = 'array'),
  disclaimer text not null,
  evaluated_at timestamptz not null default now(),
  check (human_score + ai_score = 100)
);

create table if not exists public.ai_writing_usage (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('openai','anthropic')),
  created_at timestamptz not null default now()
);

create table if not exists public.article_polls (
  article_id uuid primary key references public.articles(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  question text not null check (char_length(trim(question)) between 1 and 280),
  ends_at timestamptz not null,
  total_votes integer not null default 0 check (total_votes >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.article_poll_options (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.article_polls(article_id) on delete cascade,
  option_index smallint not null check (option_index between 0 and 3),
  label text not null check (char_length(trim(label)) between 1 and 140),
  vote_count integer not null default 0 check (vote_count >= 0),
  unique (article_id, option_index),
  unique (article_id, id)
);

create table if not exists public.article_poll_votes (
  article_id uuid not null,
  option_id uuid not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (article_id, profile_id),
  foreign key (article_id, option_id) references public.article_poll_options(article_id, id) on delete cascade
);

create index if not exists social_accounts_owner_idx on public.social_accounts(owner_profile_id, provider);
create index if not exists writing_scores_tenant_idx on public.article_writing_scores(tenant_id, evaluated_at desc);
create index if not exists ai_writing_usage_limit_idx on public.ai_writing_usage(profile_id, created_at desc);
create index if not exists article_poll_votes_option_idx on public.article_poll_votes(option_id);

drop trigger if exists social_accounts_set_updated_at on public.social_accounts;
create trigger social_accounts_set_updated_at before update on public.social_accounts
for each row execute function public.set_updated_at();

alter table public.social_accounts enable row level security;
alter table public.social_account_credentials enable row level security;
alter table public.article_writing_scores enable row level security;
alter table public.ai_writing_usage enable row level security;
alter table public.article_polls enable row level security;
alter table public.article_poll_options enable row level security;
alter table public.article_poll_votes enable row level security;

drop policy if exists "Owners read social accounts" on public.social_accounts;
create policy "Owners read social accounts" on public.social_accounts for select to authenticated
using (owner_profile_id = auth.uid() or public.has_tenant_role(tenant_id, array['owner','admin']));

drop policy if exists "Published writing scores are readable" on public.article_writing_scores;
create policy "Published writing scores are readable" on public.article_writing_scores for select to authenticated
using (exists (select 1 from public.articles article where article.id = article_writing_scores.article_id and (article.status = 'published' or public.is_tenant_member(article.tenant_id))));

drop policy if exists "Published polls are readable" on public.article_polls;
create policy "Published polls are readable" on public.article_polls for select to authenticated
using (exists (select 1 from public.articles article where article.id = article_polls.article_id and article.status = 'published'));
drop policy if exists "Published poll options are readable" on public.article_poll_options;
create policy "Published poll options are readable" on public.article_poll_options for select to authenticated
using (exists (select 1 from public.articles article where article.id = article_poll_options.article_id and article.status = 'published'));
drop policy if exists "Users read own poll votes" on public.article_poll_votes;
create policy "Users read own poll votes" on public.article_poll_votes for select to authenticated using (profile_id = auth.uid());

revoke all on public.social_account_credentials from public, anon, authenticated;
revoke all on public.ai_writing_usage from public, anon, authenticated;
grant select on public.social_accounts, public.article_writing_scores, public.article_polls, public.article_poll_options, public.article_poll_votes to authenticated;
revoke insert, update, delete on public.social_accounts, public.article_writing_scores, public.article_polls, public.article_poll_options, public.article_poll_votes from anon, authenticated;

create or replace function public.configure_social_handoff(
  requested_tenant_id uuid,
  requested_provider text,
  requested_handle text,
  requested_profile_url text
)
returns public.social_accounts
language plpgsql security definer set search_path = public
as $$
declare account_row public.social_accounts;
begin
  if auth.uid() is null or not public.has_tenant_role(requested_tenant_id, array['owner','admin','editor']) then raise exception 'not authorized' using errcode = '42501'; end if;
  if requested_provider not in ('SUBSTACK','MEDIUM','HASHNODE','LINKEDIN','INSTAGRAM','X','THREADS') then raise exception 'unsupported provider' using errcode = '22023'; end if;
  if requested_profile_url !~ '^https://' then raise exception 'Profile URL must use HTTPS.' using errcode = '22023'; end if;
  insert into public.social_accounts(tenant_id,owner_profile_id,provider,status,connection_method,handle,profile_url,capabilities,last_verified_at,last_error)
  values(requested_tenant_id,auth.uid(),requested_provider,'HANDOFF_READY','HANDOFF',nullif(trim(requested_handle),''),requested_profile_url,'{"share":true,"direct_publish":false}'::jsonb,now(),null)
  on conflict(tenant_id,owner_profile_id,provider) do update set status='HANDOFF_READY',connection_method='HANDOFF',handle=excluded.handle,profile_url=excluded.profile_url,capabilities=excluded.capabilities,last_verified_at=now(),last_error=null
  returning * into account_row;
  return account_row;
end $$;

create or replace function public.reserve_ai_writing_generation(requested_provider text)
returns integer language plpgsql security definer set search_path=public
as $$
declare used_count integer;
begin
  if auth.uid() is null or requested_provider not in ('openai','anthropic') then raise exception 'not authorized' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
  select count(*) into used_count from public.ai_writing_usage where profile_id=auth.uid() and created_at>now()-interval '24 hours';
  if used_count>=20 then raise exception 'Daily AI writing limit reached. Try again after the oldest request expires.' using errcode='P0001'; end if;
  insert into public.ai_writing_usage(profile_id,provider) values(auth.uid(),requested_provider);
  return 19-used_count;
end $$;

create or replace function public.disconnect_social_account(requested_account_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  delete from public.social_accounts where id=requested_account_id and (owner_profile_id=auth.uid() or public.has_tenant_role(tenant_id,array['owner','admin']));
  if not found then raise exception 'account not found or not authorized' using errcode = '42501'; end if;
end $$;

create or replace function public.publish_feed_post(
  requested_tenant_id uuid,
  requested_body text,
  requested_blocks jsonb,
  requested_hashtags text[],
  requested_mentions uuid[],
  requested_distribution text[],
  requested_writing_score jsonb
)
returns public.articles
language plpgsql security definer set search_path = public
as $$
declare
  saved_article public.articles;
  saved_id uuid := gen_random_uuid();
  normalized_title text;
  destination text;
  normalized_destinations text[];
  mentioned_profile uuid;
  score_human integer := coalesce((requested_writing_score->>'humanScore')::integer, 50);
  score_ai integer := coalesce((requested_writing_score->>'aiScore')::integer, 50);
begin
  if auth.uid() is null or not public.has_tenant_role(requested_tenant_id,array['owner','admin','editor']) then raise exception 'not authorized' using errcode='42501'; end if;
  if char_length(trim(coalesce(requested_body,''))) not between 1 and 5000 then raise exception 'Post text must contain between 1 and 5,000 characters.' using errcode='22023'; end if;
  if requested_blocks is null or jsonb_typeof(requested_blocks)<>'array' or jsonb_array_length(requested_blocks) not between 1 and 20 then raise exception 'Posts need between 1 and 20 content blocks.' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(requested_blocks) block where block->>'type' not in ('paragraph','image','video','button')) then raise exception 'Posts contain an unsupported attachment type.' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(requested_blocks) block where block->>'type' in ('image','video','button') and coalesce(block->>'url','') !~ '^https://') then raise exception 'Attachments require secure HTTPS URLs.' using errcode='22023'; end if;
  if requested_distribution is null or array_length(requested_distribution,1) is null or not ('STACKEDIN'=any(requested_distribution)) or not requested_distribution <@ array['STACKEDIN','SUBSTACK','MEDIUM','HASHNODE','LINKEDIN','INSTAGRAM','X','THREADS']::text[] then raise exception 'Choose valid publishing destinations including StackedIN.' using errcode='22023'; end if;
  if score_human+score_ai<>100 or score_human not between 0 and 100 then raise exception 'Writing scores are invalid.' using errcode='22023'; end if;
  select array_agg(distinct item) into normalized_destinations from unnest(requested_distribution) item;
  normalized_title := left(coalesce(nullif(trim(split_part(requested_body,E'\n',1)),''),'Professional post'),180);

  insert into public.articles(id,tenant_id,author_id,title,description,body,platform,tags,hashtags,status,published_at,content_type,content_format,content_blocks,visibility,reading_minutes,source_type,slug,first_published_at,editor_metadata,distribution_targets)
  values(saved_id,requested_tenant_id,auth.uid(),normalized_title,'',trim(requested_body),'StackedIN',(coalesce(requested_hashtags,'{}'::text[]))[1:20],(coalesce(requested_hashtags,'{}'::text[]))[1:20],'published',now(),'POST','BLOCKS_V2',requested_blocks,'public',greatest(1,ceil(array_length(regexp_split_to_array(trim(requested_body),'\s+'),1)/220.0)::integer),'USER','post-'||left(replace(saved_id::text,'-',''),16),now(),jsonb_build_object('mentions',coalesce(requested_mentions,'{}'::uuid[]),'writingSignal',requested_writing_score),normalized_destinations)
  returning * into saved_article;

  foreach destination in array normalized_destinations loop
    insert into public.distribution_jobs(article_id,tenant_id,requested_by,platform,status,delivery_mode,platform_title,platform_excerpt,platform_tags,payload,published_at)
    values(saved_id,requested_tenant_id,auth.uid(),destination,
      case when destination='STACKEDIN' then 'PUBLISHED' when exists(select 1 from public.social_accounts account where account.tenant_id=requested_tenant_id and account.owner_profile_id=auth.uid() and account.provider=destination and account.status='CONNECTED' and coalesce((account.capabilities->>'direct_publish')::boolean,false)) then 'PENDING' else 'HANDOFF_READY' end,
      case when destination='STACKEDIN' then 'NATIVE' when exists(select 1 from public.social_accounts account where account.tenant_id=requested_tenant_id and account.owner_profile_id=auth.uid() and account.provider=destination and account.status='CONNECTED' and coalesce((account.capabilities->>'direct_publish')::boolean,false)) then 'API' else 'HANDOFF' end,
      normalized_title,left(trim(requested_body),1000),(coalesce(requested_hashtags,'{}'::text[]))[1:20],jsonb_build_object('content_type','POST','prepared_at',now()),case when destination='STACKEDIN' then now() else null end);
  end loop;

  insert into public.article_writing_scores(article_id,tenant_id,evaluated_by,human_score,ai_score,confidence,confidence_percent,method,signals,disclaimer)
  values(saved_id,requested_tenant_id,auth.uid(),score_human,score_ai,coalesce(requested_writing_score->>'confidence','very low'),coalesce((requested_writing_score->>'confidencePercent')::integer,0),coalesce(requested_writing_score->>'method','StackedIN linguistic signals v1'),coalesce(requested_writing_score->'signals','[]'::jsonb),coalesce(requested_writing_score->>'disclaimer','A writing signal is not proof of authorship.'));

  foreach mentioned_profile in array coalesce(requested_mentions,'{}'::uuid[]) loop
    if mentioned_profile<>auth.uid() and exists(select 1 from public.profiles where id=mentioned_profile) then
      insert into public.notifications(tenant_id,recipient_profile_id,actor_profile_id,notification_type,entity_type,entity_id,title,body)
      values(requested_tenant_id,mentioned_profile,auth.uid(),'SYSTEM','ARTICLE',saved_id::text,'You were mentioned in a post',left(trim(requested_body),240));
    end if;
  end loop;
  return saved_article;
end $$;

create or replace function public.create_article_poll(requested_article_id uuid, requested_question text, requested_options text[], requested_duration_hours integer)
returns public.article_polls language plpgsql security definer set search_path=public
as $$
declare poll_row public.article_polls; option_label text; option_position integer:=0; article_row public.articles;
begin
  select * into article_row from public.articles where id=requested_article_id;
  if auth.uid() is null or article_row.author_id<>auth.uid() then raise exception 'not authorized' using errcode='42501'; end if;
  if array_length(requested_options,1) not between 2 and 4 or requested_duration_hours not between 1 and 168 then raise exception 'Polls require 2–4 options and a duration from 1–168 hours.' using errcode='22023'; end if;
  insert into public.article_polls(article_id,tenant_id,question,ends_at) values(article_row.id,article_row.tenant_id,trim(requested_question),now()+make_interval(hours=>requested_duration_hours)) returning * into poll_row;
  foreach option_label in array requested_options loop
    insert into public.article_poll_options(article_id,option_index,label) values(article_row.id,option_position,trim(option_label));
    option_position:=option_position+1;
  end loop;
  return poll_row;
end $$;

create or replace function public.vote_article_poll(requested_article_id uuid, requested_option_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare poll_row public.article_polls;
begin
  select * into poll_row from public.article_polls where article_id=requested_article_id;
  if auth.uid() is null or poll_row.article_id is null or poll_row.ends_at<=now() then raise exception 'This poll is unavailable or closed.' using errcode='22023'; end if;
  if not exists(select 1 from public.article_poll_options where article_id=requested_article_id and id=requested_option_id) then raise exception 'Invalid poll option.' using errcode='22023'; end if;
  insert into public.article_poll_votes(article_id,option_id,tenant_id,profile_id) values(requested_article_id,requested_option_id,poll_row.tenant_id,auth.uid())
  on conflict(article_id,profile_id) do update set option_id=excluded.option_id,created_at=now();
  update public.article_poll_options option set vote_count=(select count(*) from public.article_poll_votes vote where vote.option_id=option.id) where option.article_id=requested_article_id;
  update public.article_polls set total_votes=(select count(*) from public.article_poll_votes where article_id=requested_article_id) where article_id=requested_article_id;
end $$;

revoke all on function public.configure_social_handoff(uuid,text,text,text) from public;
revoke all on function public.reserve_ai_writing_generation(text) from public;
revoke all on function public.disconnect_social_account(uuid) from public;
revoke all on function public.publish_feed_post(uuid,text,jsonb,text[],uuid[],text[],jsonb) from public;
revoke all on function public.create_article_poll(uuid,text,text[],integer) from public;
revoke all on function public.vote_article_poll(uuid,uuid) from public;
grant execute on function public.configure_social_handoff(uuid,text,text,text), public.reserve_ai_writing_generation(text), public.disconnect_social_account(uuid), public.publish_feed_post(uuid,text,jsonb,text[],uuid[],text[],jsonb), public.create_article_poll(uuid,text,text[],integer), public.vote_article_poll(uuid,uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('article-media','article-media',true,52428800,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

do $$ begin
  begin alter publication supabase_realtime add table public.social_accounts; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.article_writing_scores; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.article_polls; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.article_poll_options; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.article_poll_votes; exception when duplicate_object then null; end;
end $$;

commit;

begin;

do $$
begin
  if to_regclass('public.article_reactions') is null
     or to_regclass('public.connections') is null
     or to_regclass('public.follows') is null then
    raise exception using
      errcode = '42P01',
      message = 'Native publishing or professional graph tables are missing.',
      hint = 'Apply migrations 002 through 005 before migration 006.';
  end if;
end
$$;

alter table public.articles
  add column if not exists restack_count integer not null default 0;

alter table public.articles
  drop constraint if exists articles_restack_count_check,
  add constraint articles_restack_count_check check (restack_count >= 0);

create table if not exists public.article_saves (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (article_id, profile_id)
);

create table if not exists public.article_restacks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  thoughts text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (article_id, profile_id),
  check (thoughts is null or char_length(trim(thoughts)) between 1 and 1200)
);

create table if not exists public.article_preferences (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  preference text not null check (preference in ('HIDDEN','NOT_INTERESTED')),
  created_at timestamptz not null default now(),
  primary key (article_id, profile_id)
);

create table if not exists public.article_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  reporter_profile_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('SPAM','HARASSMENT','MISINFORMATION','COPYRIGHT','OTHER')),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'OPEN' check (status in ('OPEN','REVIEWING','RESOLVED','DISMISSED')),
  created_at timestamptz not null default now(),
  unique (article_id, reporter_profile_id)
);

create table if not exists public.profile_subscriptions (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  subscriber_profile_id uuid not null references public.profiles(id) on delete cascade,
  creator_profile_id uuid not null references public.profiles(id) on delete cascade,
  delivery_mode text not null default 'IN_APP' check (delivery_mode in ('IN_APP','EMAIL','BOTH')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, subscriber_profile_id, creator_profile_id),
  check (subscriber_profile_id <> creator_profile_id)
);

create index if not exists article_saves_profile_time_idx on public.article_saves(profile_id, created_at desc);
create index if not exists article_restacks_article_time_idx on public.article_restacks(article_id, created_at desc);
create index if not exists article_restacks_profile_time_idx on public.article_restacks(profile_id, created_at desc);
create index if not exists article_preferences_profile_idx on public.article_preferences(profile_id, preference, created_at desc);
create index if not exists article_reports_status_idx on public.article_reports(status, created_at asc);
create index if not exists profile_subscriptions_creator_idx on public.profile_subscriptions(tenant_id, creator_profile_id);

create or replace function public.set_social_feed_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists article_restacks_set_updated_at on public.article_restacks;
create trigger article_restacks_set_updated_at before update on public.article_restacks
for each row execute function public.set_social_feed_updated_at();
drop trigger if exists profile_subscriptions_set_updated_at on public.profile_subscriptions;
create trigger profile_subscriptions_set_updated_at before update on public.profile_subscriptions
for each row execute function public.set_social_feed_updated_at();

create or replace function public.refresh_article_engagement_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare affected_article_id uuid := coalesce(new.article_id, old.article_id);
begin
  update public.articles article
  set reaction_count = (select count(*) from public.article_reactions reaction where reaction.article_id = affected_article_id),
      comment_count = (select count(*) from public.article_comments comment where comment.article_id = affected_article_id and comment.status in ('ACTIVE','EDITED')),
      share_count = (select count(*) from public.article_shares share_event where share_event.article_id = affected_article_id),
      restack_count = (select count(*) from public.article_restacks restack where restack.article_id = affected_article_id)
  where article.id = affected_article_id;
  return coalesce(new, old);
end
$$;

drop trigger if exists article_restacks_refresh_counts on public.article_restacks;
create trigger article_restacks_refresh_counts after insert or update or delete on public.article_restacks
for each row execute function public.refresh_article_engagement_counts();

alter table public.article_saves enable row level security;
alter table public.article_restacks enable row level security;
alter table public.article_preferences enable row level security;
alter table public.article_reports enable row level security;
alter table public.profile_subscriptions enable row level security;

drop policy if exists "Users manage own article saves" on public.article_saves;
create policy "Users manage own article saves" on public.article_saves for all to authenticated
using (profile_id = auth.uid()) with check (profile_id = auth.uid() and public.is_tenant_member(tenant_id));

drop policy if exists "Published restacks are readable" on public.article_restacks;
create policy "Published restacks are readable" on public.article_restacks for select to authenticated
using (exists (select 1 from public.articles article where article.id = article_restacks.article_id and ((article.status = 'published' and article.visibility = 'public') or public.is_tenant_member(article.tenant_id))));
drop policy if exists "Users manage own restacks" on public.article_restacks;
create policy "Users manage own restacks" on public.article_restacks for all to authenticated
using (profile_id = auth.uid()) with check (profile_id = auth.uid() and public.is_tenant_member(tenant_id));

drop policy if exists "Users manage own feed preferences" on public.article_preferences;
create policy "Users manage own feed preferences" on public.article_preferences for all to authenticated
using (profile_id = auth.uid()) with check (profile_id = auth.uid() and public.is_tenant_member(tenant_id));

drop policy if exists "Users create and read own reports" on public.article_reports;
create policy "Users create and read own reports" on public.article_reports for select to authenticated
using (reporter_profile_id = auth.uid() or public.has_tenant_role(tenant_id, array['owner','admin']));
drop policy if exists "Users submit own reports" on public.article_reports;
create policy "Users submit own reports" on public.article_reports for insert to authenticated
with check (reporter_profile_id = auth.uid() and public.is_tenant_member(tenant_id));

drop policy if exists "Subscription participants read" on public.profile_subscriptions;
create policy "Subscription participants read" on public.profile_subscriptions for select to authenticated
using (auth.uid() in (subscriber_profile_id, creator_profile_id));
drop policy if exists "Users manage own subscriptions" on public.profile_subscriptions;
create policy "Users manage own subscriptions" on public.profile_subscriptions for all to authenticated
using (subscriber_profile_id = auth.uid())
with check (subscriber_profile_id = auth.uid() and public.is_tenant_member(tenant_id));

do $$
begin
  begin alter publication supabase_realtime add table public.article_saves; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.article_restacks; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.article_preferences; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profile_subscriptions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.follows; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.connections; exception when duplicate_object then null; end;
end
$$;

commit;

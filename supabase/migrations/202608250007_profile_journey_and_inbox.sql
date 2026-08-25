begin;

do $$
begin
  if to_regclass('public.connections') is null or to_regclass('public.profiles') is null then
    raise exception using errcode = '42P01', message = 'Professional graph tables are missing.', hint = 'Apply migrations 001 through 006 before migration 007.';
  end if;
end
$$;

alter table public.profiles
  add column if not exists website_url text,
  add column if not exists github_url text,
  add column if not exists gitlab_url text,
  add column if not exists linkedin_url text,
  add column if not exists medium_url text,
  add column if not exists hashnode_url text,
  add column if not exists featured_skills text[] not null default '{}',
  add column if not exists featured_badges text[] not null default '{}';

create table if not exists public.profile_experiences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company text not null check (char_length(trim(company)) between 1 and 160),
  title text not null check (char_length(trim(title)) between 1 and 160),
  employment_type text not null default 'FULL_TIME' check (employment_type in ('FULL_TIME','PART_TIME','CONTRACT','FREELANCE','INTERNSHIP','SELF_EMPLOYED','OTHER')),
  location text not null default '',
  start_date date not null,
  end_date date,
  currently_working boolean not null default false,
  description text not null default '' check (char_length(description) <= 5000),
  skills text[] not null default '{}',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((currently_working and end_date is null) or (not currently_working and (end_date is null or end_date >= start_date)))
);

create table if not exists public.profile_education (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  institution text not null check (char_length(trim(institution)) between 1 and 200),
  degree text not null default '',
  field_of_study text not null default '',
  start_date date,
  end_date date,
  description text not null default '' check (char_length(description) <= 3000),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.profile_projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  project_url text,
  repository_url text,
  image_url text,
  skills text[] not null default '{}',
  started_on date,
  completed_on date,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_on is null or started_on is null or completed_on >= started_on)
);

create table if not exists public.profile_achievements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  issuer text not null default '',
  issued_on date,
  credential_url text,
  description text not null default '' check (char_length(description) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 80),
  url text not null check (url ~ '^https://'),
  link_type text not null default 'OTHER' check (link_type in ('WEBSITE','GITHUB','GITLAB','LINKEDIN','MEDIUM','HASHNODE','PORTFOLIO','OTHER')),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  notification_type text not null check (notification_type in ('CONNECTION_REQUEST','CONNECTION_ACCEPTED','MESSAGE','REACTION','COMMENT','RESTACK','FOLLOW','SUBSCRIPTION','SYSTEM')),
  entity_type text not null default '',
  entity_id text not null default '',
  title text not null check (char_length(title) between 1 and 240),
  body text not null default '' check (char_length(body) <= 1200),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_type text not null default 'DIRECT' check (conversation_type in ('DIRECT','GROUP')),
  title text not null default '',
  direct_profile_low uuid references public.profiles(id) on delete cascade,
  direct_profile_high uuid references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((conversation_type = 'DIRECT' and direct_profile_low is not null and direct_profile_high is not null and direct_profile_low < direct_profile_high) or conversation_type = 'GROUP')
);

create unique index if not exists conversations_direct_pair_idx on public.conversations(tenant_id, direct_profile_low, direct_profile_high) where conversation_type = 'DIRECT';

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'MEMBER' check (role in ('OWNER','MEMBER')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  muted_until timestamptz,
  primary key (conversation_id, profile_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 8000),
  reply_to_message_id uuid references public.messages(id) on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists profile_experiences_profile_idx on public.profile_experiences(profile_id, start_date desc);
create index if not exists profile_education_profile_idx on public.profile_education(profile_id, start_date desc);
create index if not exists profile_projects_profile_idx on public.profile_projects(profile_id, display_order, created_at desc);
create index if not exists profile_achievements_profile_idx on public.profile_achievements(profile_id, issued_on desc);
create index if not exists profile_links_profile_idx on public.profile_links(profile_id, display_order);
create index if not exists notifications_recipient_time_idx on public.notifications(recipient_profile_id, read_at, created_at desc);
create index if not exists conversation_members_profile_idx on public.conversation_members(profile_id, conversation_id);
create index if not exists messages_conversation_time_idx on public.messages(conversation_id, created_at asc) where deleted_at is null;

create or replace function public.profile_is_public(requested_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = requested_profile_id and p.account_status = 'active' and p.profile_visibility = 'public' and p.searchable);
$$;

create or replace function public.is_conversation_member(requested_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members member where member.conversation_id = requested_conversation_id and member.profile_id = auth.uid());
$$;

create or replace function public.get_profile_counts(requested_profile_id uuid)
returns table(follower_count bigint, connection_count bigint, publication_count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or (requested_profile_id <> auth.uid() and not public.profile_is_public(requested_profile_id)) then
    raise exception 'profile is not available' using errcode = '42501';
  end if;
  return query select
    (select count(*) from public.follows where followed_profile_id = requested_profile_id),
    (select count(*) from public.connections where status = 'ACCEPTED' and requested_profile_id in (requester_profile_id,addressee_profile_id)),
    (select count(*) from public.articles where author_id = requested_profile_id and status = 'published');
end $$;

revoke all on function public.profile_is_public(uuid) from public;
revoke all on function public.is_conversation_member(uuid) from public;
revoke all on function public.get_profile_counts(uuid) from public;
grant execute on function public.profile_is_public(uuid) to authenticated, anon;
grant execute on function public.is_conversation_member(uuid) to authenticated;
grant execute on function public.get_profile_counts(uuid) to authenticated;

do $$ declare table_name text;
begin
  foreach table_name in array array['profile_experiences','profile_education','profile_projects','profile_achievements','profile_links']
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "Visible profile records are readable" on public.%I', table_name);
    execute format('drop policy if exists "Users manage own profile records" on public.%I', table_name);
    execute format('create policy "Visible profile records are readable" on public.%I for select using (profile_id = auth.uid() or public.profile_is_public(profile_id))', table_name);
    execute format('create policy "Users manage own profile records" on public.%I for all to authenticated using (profile_id = auth.uid() and public.is_tenant_member(tenant_id)) with check (profile_id = auth.uid() and public.is_tenant_member(tenant_id))', table_name);
  end loop;
end $$;

alter table public.notifications enable row level security;
drop policy if exists "Recipients read notifications" on public.notifications;
drop policy if exists "Recipients update notifications" on public.notifications;
create policy "Recipients read notifications" on public.notifications for select to authenticated using (recipient_profile_id = auth.uid());
revoke insert, update, delete on public.notifications from anon, authenticated;

alter table public.conversations enable row level security;
drop policy if exists "Members read conversations" on public.conversations;
create policy "Members read conversations" on public.conversations for select to authenticated using (public.is_conversation_member(id));
revoke insert, update, delete on public.conversations from anon, authenticated;

alter table public.conversation_members enable row level security;
drop policy if exists "Members read conversation membership" on public.conversation_members;
drop policy if exists "Members update own read state" on public.conversation_members;
create policy "Members read conversation membership" on public.conversation_members for select to authenticated using (public.is_conversation_member(conversation_id));
revoke insert, update, delete on public.conversation_members from anon, authenticated;

alter table public.messages enable row level security;
drop policy if exists "Members read messages" on public.messages;
drop policy if exists "Members send messages" on public.messages;
drop policy if exists "Senders edit own messages" on public.messages;
create policy "Members read messages" on public.messages for select to authenticated using (public.is_conversation_member(conversation_id));
create policy "Members send messages" on public.messages for insert to authenticated with check (sender_profile_id = auth.uid() and public.is_conversation_member(conversation_id));
revoke update, delete on public.messages from anon, authenticated;

create or replace function public.mark_notifications_read(requested_notification_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.notifications set read_at = coalesce(read_at, now())
  where recipient_profile_id = auth.uid() and (requested_notification_id is null or id = requested_notification_id);
end $$;

create or replace function public.mark_conversation_read(requested_conversation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_conversation_member(requested_conversation_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.conversation_members set last_read_at = now()
  where conversation_id = requested_conversation_id and profile_id = auth.uid();
end $$;

revoke all on function public.mark_notifications_read(uuid) from public;
revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_notifications_read(uuid) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

create or replace function public.start_direct_conversation(requested_tenant_id uuid, target_profile_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare low_profile uuid; high_profile uuid; conversation_id uuid;
begin
  if auth.uid() is null or target_profile_id = auth.uid() or not public.is_tenant_member(requested_tenant_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.connections c where c.tenant_id = requested_tenant_id and c.status = 'ACCEPTED' and auth.uid() in (c.requester_profile_id,c.addressee_profile_id) and target_profile_id in (c.requester_profile_id,c.addressee_profile_id)) then raise exception 'messaging requires an accepted connection' using errcode = '42501'; end if;
  low_profile := least(auth.uid(), target_profile_id); high_profile := greatest(auth.uid(), target_profile_id);
  insert into public.conversations(tenant_id, conversation_type, direct_profile_low, direct_profile_high, created_by)
  values (requested_tenant_id, 'DIRECT', low_profile, high_profile, auth.uid())
  on conflict (tenant_id, direct_profile_low, direct_profile_high) where conversation_type = 'DIRECT'
  do update set updated_at = now() returning id into conversation_id;
  insert into public.conversation_members(conversation_id, profile_id, role) values (conversation_id, auth.uid(), 'OWNER'), (conversation_id, target_profile_id, 'MEMBER') on conflict do nothing;
  return conversation_id;
end $$;

revoke all on function public.start_direct_conversation(uuid, uuid) from public;
grant execute on function public.start_direct_conversation(uuid, uuid) to authenticated;

create or replace function public.notify_connection_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications(tenant_id,recipient_profile_id,actor_profile_id,notification_type,entity_type,entity_id,title,body)
    values(new.tenant_id,new.addressee_profile_id,new.requester_profile_id,'CONNECTION_REQUEST','CONNECTION',new.id::text,'New connection request','A professional wants to connect with you.');
  elsif new.status = 'ACCEPTED' and old.status = 'PENDING' then
    insert into public.notifications(tenant_id,recipient_profile_id,actor_profile_id,notification_type,entity_type,entity_id,title,body)
    values(new.tenant_id,new.requester_profile_id,new.addressee_profile_id,'CONNECTION_ACCEPTED','CONNECTION',new.id::text,'Connection accepted','Your professional connection request was accepted.');
  end if;
  return new;
end $$;

drop trigger if exists connections_create_notifications on public.connections;
create trigger connections_create_notifications after insert or update of status on public.connections for each row execute function public.notify_connection_change();

create or replace function public.notify_new_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  insert into public.notifications(tenant_id,recipient_profile_id,actor_profile_id,notification_type,entity_type,entity_id,title,body)
  select conversation.tenant_id, member.profile_id, new.sender_profile_id, 'MESSAGE', 'CONVERSATION', new.conversation_id::text, 'New message', left(new.body, 240)
  from public.conversations conversation join public.conversation_members member on member.conversation_id = conversation.id
  where conversation.id = new.conversation_id and member.profile_id <> new.sender_profile_id;
  return new;
end $$;

drop trigger if exists messages_create_notifications on public.messages;
create trigger messages_create_notifications after insert on public.messages for each row execute function public.notify_new_message();

create or replace function public.notify_social_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare recipient_id uuid; actor_id uuid; activity_type text; activity_title text; activity_body text; activity_entity text; activity_entity_id text;
begin
  if tg_table_name = 'follows' then
    recipient_id := new.followed_profile_id; actor_id := new.follower_profile_id; activity_type := 'FOLLOW'; activity_title := 'New follower'; activity_body := 'A professional started following your journey.'; activity_entity := 'PROFILE'; activity_entity_id := actor_id::text;
  elsif tg_table_name = 'profile_subscriptions' then
    recipient_id := new.creator_profile_id; actor_id := new.subscriber_profile_id; activity_type := 'SUBSCRIPTION'; activity_title := 'New subscriber'; activity_body := 'A professional subscribed to your publications.'; activity_entity := 'PROFILE'; activity_entity_id := actor_id::text;
  elsif tg_table_name = 'article_reactions' then
    select author_id into recipient_id from public.articles where id = new.article_id; actor_id := new.profile_id; activity_type := 'REACTION'; activity_title := 'New reaction'; activity_body := 'Someone reacted to your publication.'; activity_entity := 'ARTICLE'; activity_entity_id := new.article_id::text;
  elsif tg_table_name = 'article_comments' then
    select author_id into recipient_id from public.articles where id = new.article_id; actor_id := new.author_profile_id; activity_type := 'COMMENT'; activity_title := 'New discussion'; activity_body := left(new.body, 240); activity_entity := 'ARTICLE'; activity_entity_id := new.article_id::text;
  elsif tg_table_name = 'article_restacks' then
    select author_id into recipient_id from public.articles where id = new.article_id; actor_id := new.profile_id; activity_type := 'RESTACK'; activity_title := 'Publication restacked'; activity_body := coalesce(left(new.thoughts, 240), 'Someone shared your publication with their network.'); activity_entity := 'ARTICLE'; activity_entity_id := new.article_id::text;
  end if;
  if recipient_id is not null and actor_id is not null and recipient_id <> actor_id then
    insert into public.notifications(tenant_id,recipient_profile_id,actor_profile_id,notification_type,entity_type,entity_id,title,body)
    values(new.tenant_id,recipient_id,actor_id,activity_type,activity_entity,activity_entity_id,activity_title,activity_body);
  end if;
  return new;
end $$;

drop trigger if exists follows_create_notifications on public.follows;
create trigger follows_create_notifications after insert on public.follows for each row execute function public.notify_social_activity();
drop trigger if exists profile_subscriptions_create_notifications on public.profile_subscriptions;
create trigger profile_subscriptions_create_notifications after insert on public.profile_subscriptions for each row execute function public.notify_social_activity();
drop trigger if exists article_reactions_create_notifications on public.article_reactions;
create trigger article_reactions_create_notifications after insert on public.article_reactions for each row execute function public.notify_social_activity();
drop trigger if exists article_comments_create_notifications on public.article_comments;
create trigger article_comments_create_notifications after insert on public.article_comments for each row execute function public.notify_social_activity();
drop trigger if exists article_restacks_create_notifications on public.article_restacks;
create trigger article_restacks_create_notifications after insert on public.article_restacks for each row execute function public.notify_social_activity();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('profile-media','profile-media',true,10485760,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Profile media is public" on storage.objects;
drop policy if exists "Users upload own profile media" on storage.objects;
drop policy if exists "Users update own profile media" on storage.objects;
drop policy if exists "Users delete own profile media" on storage.objects;
create policy "Profile media is public" on storage.objects for select using (bucket_id = 'profile-media');
create policy "Users upload own profile media" on storage.objects for insert to authenticated with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users update own profile media" on storage.objects for update to authenticated using (bucket_id = 'profile-media' and owner_id = auth.uid()::text) with check (bucket_id = 'profile-media' and owner_id = auth.uid()::text);
create policy "Users delete own profile media" on storage.objects for delete to authenticated using (bucket_id = 'profile-media' and owner_id = auth.uid()::text);

do $$ begin
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.conversation_members; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profile_experiences; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profile_projects; exception when duplicate_object then null; end;
end $$;

commit;

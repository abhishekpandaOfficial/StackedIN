begin;

-- A username is the public identity for a StackedIN account. Email remains an
-- authentication detail and is never exposed through the public profiles row.
create or replace function public.normalize_username(raw_username text)
returns text
language sql
immutable
set search_path = public
as $$
  select left(
    trim(both '._' from regexp_replace(
      regexp_replace(lower(trim(coalesce(raw_username, ''))), '[^a-z0-9._]+', '.', 'g'),
      '[._]{2,}', '.', 'g'
    )),
    30
  );
$$;

create or replace function public.username_is_valid(candidate text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select candidate ~ '^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])?$'
    and char_length(candidate) between 3 and 30
    and candidate not in (
      'admin','administrator','api','auth','billing','dashboard','explore','feed',
      'help','home','inbox','login','logout','messages','network','notifications',
      'profile','root','search','security','settings','stackedin','studio','support',
      'system','terms','username','vercel','write','xstudio'
    );
$$;

revoke all on function public.normalize_username(text) from public;
revoke all on function public.username_is_valid(text) from public;

-- Give existing accounts a readable canonical handle based on their profile.
-- The temporary value prevents collisions while the set is rebuilt.
update public.profiles
set username = 'migrating.' || replace(id::text, '-', '');

do $$
declare
  item record;
  base text;
  candidate text;
  suffix integer;
begin
  for item in select id, display_name from public.profiles order by created_at, id loop
    base := public.normalize_username(coalesce(nullif(item.display_name, ''), 'member'));
    if not public.username_is_valid(base) then base := 'member'; end if;
    candidate := base;
    suffix := 1;
    while exists (select 1 from public.profiles p where lower(p.username) = lower(candidate) and p.id <> item.id) loop
      suffix := suffix + 1;
      candidate := left(base, greatest(3, 30 - char_length(suffix::text) - 1)) || '.' || suffix::text;
    end loop;
    update public.profiles set username = candidate where id = item.id;
  end loop;
end
$$;

alter table public.profiles
  alter column username set not null,
  drop constraint if exists profiles_username_format_check,
  add constraint profiles_username_format_check check (public.username_is_valid(username));

create unique index if not exists profiles_username_lower_unique_idx
  on public.profiles(lower(username));

-- Private login directory. It is readable only with the server-side service
-- role and allows the Vercel function to exchange a username for an email.
create table if not exists public.account_usernames (
  profile_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  email text not null,
  updated_at timestamptz not null default now()
);

create unique index if not exists account_usernames_lower_unique_idx
  on public.account_usernames(lower(username));
create index if not exists account_usernames_email_lower_idx
  on public.account_usernames(lower(email));

alter table public.account_usernames enable row level security;
revoke all on public.account_usernames from anon, authenticated;

insert into public.account_usernames(profile_id, username, email)
select p.id, p.username, u.email
from public.profiles p
join auth.users u on u.id = p.id
where u.email is not null
on conflict (profile_id) do update
set username = excluded.username, email = excluded.email, updated_at = now();

create or replace function public.next_available_username(raw_base text, owner_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base text := public.normalize_username(raw_base);
  candidate text;
  suffix integer := 1;
begin
  if not public.username_is_valid(base) then base := 'member'; end if;
  candidate := base;
  while exists (
    select 1 from public.profiles p
    where lower(p.username) = lower(candidate) and (owner_id is null or p.id <> owner_id)
  ) loop
    suffix := suffix + 1;
    candidate := left(base, greatest(3, 30 - char_length(suffix::text) - 1)) || '.' || suffix::text;
  end loop;
  return candidate;
end;
$$;

revoke all on function public.next_available_username(text, uuid) from public;

create or replace function public.check_username_availability(requested_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized text := public.normalize_username(requested_username);
  is_available boolean;
  suggestions text[] := '{}';
  candidate text;
  suffix integer := 1;
begin
  if not public.username_is_valid(normalized) then
    return jsonb_build_object(
      'normalizedUsername', normalized,
      'available', false,
      'reason', 'Use 3–30 lowercase letters, numbers, periods, or underscores. Start and end with a letter or number.',
      'suggestions', suggestions
    );
  end if;

  is_available := not exists (select 1 from public.profiles p where lower(p.username) = lower(normalized));
  if not is_available then
    while coalesce(array_length(suggestions, 1), 0) < 3 loop
      suffix := suffix + 1;
      candidate := left(normalized, greatest(3, 30 - char_length(suffix::text) - 1)) || '.' || suffix::text;
      if not exists (select 1 from public.profiles p where lower(p.username) = lower(candidate)) then
        suggestions := array_append(suggestions, candidate);
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'normalizedUsername', normalized,
    'available', is_available,
    'reason', case when is_available then null else 'That username is already taken.' end,
    'suggestions', suggestions
  );
end;
$$;

revoke all on function public.check_username_availability(text) from public;
grant execute on function public.check_username_availability(text) to anon, authenticated;

create or replace function public.guard_profile_username_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.username is distinct from old.username
    and current_user not in ('postgres', 'service_role')
    and coalesce(current_setting('stackedin.username_claim', true), '') <> '1' then
    raise exception 'Use claim_username to update a username.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_username_change on public.profiles;
create trigger profiles_guard_username_change
before update of username on public.profiles
for each row execute function public.guard_profile_username_change();

create or replace function public.claim_username(requested_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  normalized text := public.normalize_username(requested_username);
begin
  if actor_id is null then raise exception 'Sign in to choose a username.' using errcode = '42501'; end if;
  if not public.username_is_valid(normalized) then
    raise exception 'Use 3–30 lowercase letters, numbers, periods, or underscores. Start and end with a letter or number.' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles p where lower(p.username) = lower(normalized) and p.id <> actor_id) then
    raise exception 'That username is already taken.' using errcode = '23505';
  end if;

  perform set_config('stackedin.username_claim', '1', true);
  update public.profiles set username = normalized where id = actor_id;
  insert into public.account_usernames(profile_id, username, email)
  select actor_id, normalized, u.email from auth.users u where u.id = actor_id and u.email is not null
  on conflict (profile_id) do update set username = excluded.username, email = excluded.email, updated_at = now();
  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('preferred_username', normalized)
  where id = actor_id;
  return normalized;
end;
$$;

revoke all on function public.claim_username(text) from public;
grant execute on function public.claim_username(text) to authenticated;

create or replace function public.sync_account_login_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null then
    insert into public.account_usernames(profile_id, username, email)
    select new.id, p.username, new.email from public.profiles p where p.id = new.id
    on conflict (profile_id) do update set email = excluded.email, username = excluded.username, updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists auth_user_sync_login_identity on auth.users;
create trigger auth_user_sync_login_identity
after update of email on auth.users
for each row execute function public.sync_account_login_identity();

-- Signup supports a manual preferred username, GitHub's login, Google's name,
-- and email-prefix fallback, in that order. A suffix is added only on collision.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_tenant_id uuid;
  base_name text;
  requested_username text;
  assigned_username text;
  tenant_slug text;
begin
  base_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1),
    'StackedIN Member'
  );
  requested_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'preferred_username'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'user_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'login'), ''),
    base_name
  );
  assigned_username := public.next_available_username(requested_username, new.id);
  tenant_slug := trim(both '-' from regexp_replace(assigned_username, '[^a-z0-9]+', '-', 'g')) || '-' || left(replace(new.id::text, '-', ''), 8);

  insert into public.profiles (id, username, slug, display_name, avatar_url)
  values (new.id, assigned_username, tenant_slug, base_name, coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'))
  on conflict (id) do update set
    display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);

  insert into public.account_usernames(profile_id, username, email)
  values (new.id, assigned_username, new.email)
  on conflict (profile_id) do update set username = excluded.username, email = excluded.email, updated_at = now();

  insert into public.tenants (name, slug, owner_id)
  values (base_name || '''s Workspace', tenant_slug, new.id)
  returning id into new_tenant_id;

  insert into public.tenant_memberships (tenant_id, user_id, role)
  values (new_tenant_id, new.id, 'owner');
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

commit;

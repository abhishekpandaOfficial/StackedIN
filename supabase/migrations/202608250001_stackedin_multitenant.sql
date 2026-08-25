begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_memberships (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'editor', 'member')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 240),
  description text not null default '',
  body text not null default '',
  platform text not null default 'StackedIN',
  external_url text,
  tags text[] not null default '{}',
  pillar text,
  series text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists memberships_user_idx on public.tenant_memberships(user_id);
create index if not exists articles_tenant_status_idx on public.articles(tenant_id, status, published_at desc);
create index if not exists articles_author_idx on public.articles(author_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists tenants_set_updated_at on public.tenants;
create trigger tenants_set_updated_at before update on public.tenants
for each row execute function public.set_updated_at();
drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at before update on public.articles
for each row execute function public.set_updated_at();

create or replace function public.is_tenant_member(check_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tenant_memberships
    where tenant_id = check_tenant_id and user_id = auth.uid()
  );
$$;

create or replace function public.has_tenant_role(check_tenant_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tenant_memberships
    where tenant_id = check_tenant_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

revoke all on function public.is_tenant_member(uuid) from public;
revoke all on function public.has_tenant_role(uuid, text[]) from public;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.has_tenant_role(uuid, text[]) to authenticated;
grant execute on function public.is_tenant_member(uuid) to anon;
grant execute on function public.has_tenant_role(uuid, text[]) to anon;

alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.articles enable row level security;

drop policy if exists "Profiles are readable" on public.profiles;
create policy "Profiles are readable" on public.profiles for select using (true);
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Members read tenants" on public.tenants;
create policy "Members read tenants" on public.tenants for select to authenticated
using (public.is_tenant_member(id));
drop policy if exists "Owners and admins update tenants" on public.tenants;
create policy "Owners and admins update tenants" on public.tenants for update to authenticated
using (public.has_tenant_role(id, array['owner','admin']))
with check (public.has_tenant_role(id, array['owner','admin']));

drop policy if exists "Members read memberships" on public.tenant_memberships;
create policy "Members read memberships" on public.tenant_memberships for select to authenticated
using (user_id = auth.uid() or public.has_tenant_role(tenant_id, array['owner','admin']));
drop policy if exists "Owners and admins add memberships" on public.tenant_memberships;
create policy "Owners and admins add memberships" on public.tenant_memberships for insert to authenticated
with check (public.has_tenant_role(tenant_id, array['owner','admin']));
drop policy if exists "Owners and admins update memberships" on public.tenant_memberships;
create policy "Owners and admins update memberships" on public.tenant_memberships for update to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin']))
with check (public.has_tenant_role(tenant_id, array['owner','admin']));
drop policy if exists "Owners and admins remove memberships" on public.tenant_memberships;
create policy "Owners and admins remove memberships" on public.tenant_memberships for delete to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin']) and role <> 'owner');

drop policy if exists "Published articles are public" on public.articles;
create policy "Published articles are public" on public.articles for select
using (status = 'published' or public.is_tenant_member(tenant_id));
drop policy if exists "Editors create tenant articles" on public.articles;
create policy "Editors create tenant articles" on public.articles for insert to authenticated
with check (
  author_id = auth.uid()
  and public.has_tenant_role(tenant_id, array['owner','admin','editor'])
);
drop policy if exists "Authors and editors update articles" on public.articles;
create policy "Authors and editors update articles" on public.articles for update to authenticated
using (
  author_id = auth.uid()
  or public.has_tenant_role(tenant_id, array['owner','admin','editor'])
)
with check (
  public.has_tenant_role(tenant_id, array['owner','admin','editor'])
);
drop policy if exists "Authors and admins delete articles" on public.articles;
create policy "Authors and admins delete articles" on public.articles for delete to authenticated
using (author_id = auth.uid() or public.has_tenant_role(tenant_id, array['owner','admin']));

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
begin
  base_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1), 'StackedIN Member');
  base_slug := trim(both '-' from regexp_replace(lower(base_name), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'member'; end if;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    base_slug || '-' || left(replace(new.id::text, '-', ''), 8),
    base_name,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;

  insert into public.tenants (name, slug, owner_id)
  values (base_name || '''s Workspace', base_slug || '-' || left(replace(new.id::text, '-', ''), 8), new.id)
  returning id into new_tenant_id;

  insert into public.tenant_memberships (tenant_id, user_id, role)
  values (new_tenant_id, new.id, 'owner');
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill profiles and personal workspaces for users who registered before this migration.
insert into public.profiles (id, username, display_name, avatar_url)
select
  u.id,
  coalesce(nullif(trim(both '-' from regexp_replace(lower(coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1), 'member')), '[^a-z0-9]+', '-', 'g')), ''), 'member') || '-' || left(replace(u.id::text, '-', ''), 8),
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1), 'StackedIN Member'),
  coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
from auth.users u
on conflict (id) do nothing;

do $$
declare
  user_row record;
  created_tenant_id uuid;
  tenant_slug text;
begin
  for user_row in
    select u.id, coalesce(p.display_name, split_part(u.email, '@', 1), 'StackedIN Member') as display_name
    from auth.users u
    join public.profiles p on p.id = u.id
    where not exists (select 1 from public.tenant_memberships m where m.user_id = u.id)
  loop
    tenant_slug := coalesce(nullif(trim(both '-' from regexp_replace(lower(user_row.display_name), '[^a-z0-9]+', '-', 'g')), ''), 'member') || '-' || left(replace(user_row.id::text, '-', ''), 8);
    insert into public.tenants (name, slug, owner_id)
    values (user_row.display_name || '''s Workspace', tenant_slug, user_row.id)
    returning id into created_tenant_id;
    insert into public.tenant_memberships (tenant_id, user_id, role)
    values (created_tenant_id, user_row.id, 'owner');
  end loop;
end;
$$;

commit;

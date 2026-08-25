begin;

alter table public.articles
  add column if not exists content_type text not null default 'ARTICLE',
  add column if not exists content_format text not null default 'BLOCKS_V1',
  add column if not exists content_blocks jsonb not null default '[]'::jsonb,
  add column if not exists hashtags text[] not null default '{}',
  add column if not exists cover_image_url text,
  add column if not exists visibility text not null default 'public',
  add column if not exists reading_minutes integer not null default 1,
  add column if not exists reaction_count integer not null default 0,
  add column if not exists comment_count integer not null default 0,
  add column if not exists share_count integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'articles_author_profile_fk') then
    alter table public.articles
      add constraint articles_author_profile_fk foreign key (author_id) references public.profiles(id) on delete restrict;
  end if;
end
$$;

drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at
before update of title, description, body, platform, external_url, tags, pillar, series, status,
  canonical_url, source_type, source_provider, source_metadata, content_type, content_format,
  content_blocks, hashtags, cover_image_url, visibility
on public.articles for each row execute function public.set_updated_at();

alter table public.articles
  drop constraint if exists articles_content_type_check,
  add constraint articles_content_type_check check (content_type in ('POST','ARTICLE')),
  drop constraint if exists articles_content_format_check,
  add constraint articles_content_format_check check (content_format in ('BLOCKS_V1','REFERENCE')),
  drop constraint if exists articles_visibility_check,
  add constraint articles_visibility_check check (visibility in ('public','tenant')),
  drop constraint if exists articles_content_blocks_check,
  add constraint articles_content_blocks_check check (jsonb_typeof(content_blocks) = 'array' and jsonb_array_length(content_blocks) <= 250),
  drop constraint if exists articles_engagement_counts_check,
  add constraint articles_engagement_counts_check check (reaction_count >= 0 and comment_count >= 0 and share_count >= 0),
  drop constraint if exists articles_reading_minutes_check,
  add constraint articles_reading_minutes_check check (reading_minutes between 1 and 240);

create index if not exists articles_native_feed_idx
  on public.articles(status, visibility, published_at desc, id desc)
  where status = 'published';
create index if not exists articles_hashtags_idx on public.articles using gin(hashtags);

create table if not exists public.article_reactions (
  article_id uuid not null references public.articles(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('LIKE','LOVE','CELEBRATE','INSIGHTFUL','SUPPORT','CURIOUS')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (article_id, profile_id)
);

create table if not exists public.article_comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  author_profile_id uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','EDITED','DELETED','MODERATED')),
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (article_id, id),
  foreign key (article_id, parent_comment_id)
    references public.article_comments(article_id, id) on delete cascade
);

create table if not exists public.article_shares (
  id bigint generated always as identity primary key,
  article_id uuid not null references public.articles(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  destination text not null check (destination in ('COPY_LINK','NATIVE_SHARE','LINKEDIN','MEDIUM','HASHNODE','SUBSTACK','OTHER')),
  created_at timestamptz not null default now()
);

create table if not exists public.publication_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('SUBSTACK','MEDIUM','HASHNODE','LINKEDIN','RSS')),
  profile_url text not null,
  feed_url text,
  handle text,
  status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','PAUSED','ERROR','REAUTH_REQUIRED')),
  import_mode text not null default 'REFERENCE' check (import_mode in ('REFERENCE','MIRROR')),
  capabilities jsonb not null default '{"import":true,"direct_publish":false,"share":true}'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, owner_profile_id, provider, profile_url)
);

create index if not exists article_reactions_tenant_article_idx on public.article_reactions(tenant_id, article_id, reaction_type);
create index if not exists article_comments_article_time_idx on public.article_comments(article_id, created_at asc) where status <> 'DELETED';
create index if not exists article_comments_parent_idx on public.article_comments(parent_comment_id, created_at asc) where parent_comment_id is not null;
create index if not exists article_shares_article_idx on public.article_shares(article_id, created_at desc);
create index if not exists publication_sources_sync_idx on public.publication_sources(status, last_synced_at) where status = 'ACTIVE';

do $$
declare table_name text;
begin
  foreach table_name in array array['article_reactions','article_comments','publication_sources']
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end
$$;

create or replace function public.refresh_article_engagement_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare affected_article_id uuid;
begin
  affected_article_id := coalesce(new.article_id, old.article_id);
  update public.articles article
  set reaction_count = (select count(*) from public.article_reactions reaction where reaction.article_id = affected_article_id),
      comment_count = (select count(*) from public.article_comments comment where comment.article_id = affected_article_id and comment.status in ('ACTIVE','EDITED')),
      share_count = (select count(*) from public.article_shares share_event where share_event.article_id = affected_article_id)
  where article.id = affected_article_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

drop trigger if exists article_reactions_refresh_counts on public.article_reactions;
create trigger article_reactions_refresh_counts after insert or update or delete on public.article_reactions
for each row execute function public.refresh_article_engagement_counts();
drop trigger if exists article_comments_refresh_counts on public.article_comments;
create trigger article_comments_refresh_counts after insert or update or delete on public.article_comments
for each row execute function public.refresh_article_engagement_counts();
drop trigger if exists article_shares_refresh_counts on public.article_shares;
create trigger article_shares_refresh_counts after insert or delete on public.article_shares
for each row execute function public.refresh_article_engagement_counts();

alter table public.article_reactions enable row level security;
alter table public.article_comments enable row level security;
alter table public.article_shares enable row level security;
alter table public.publication_sources enable row level security;

drop policy if exists "Published articles are public" on public.articles;
create policy "Published articles are public" on public.articles for select
using ((status = 'published' and visibility = 'public') or public.is_tenant_member(tenant_id));

drop policy if exists "Published reaction summaries are readable" on public.article_reactions;
create policy "Published reaction summaries are readable" on public.article_reactions for select to authenticated
using (exists (select 1 from public.articles article where article.id = article_reactions.article_id and ((article.status = 'published' and article.visibility = 'public') or public.is_tenant_member(article.tenant_id))));
drop policy if exists "Users manage own article reaction" on public.article_reactions;
create policy "Users manage own article reaction" on public.article_reactions for all to authenticated
using (profile_id = auth.uid() and public.is_tenant_member(tenant_id))
with check (profile_id = auth.uid() and public.is_tenant_member(tenant_id));

drop policy if exists "Published discussions are readable" on public.article_comments;
create policy "Published discussions are readable" on public.article_comments for select
using (exists (select 1 from public.articles article where article.id = article_comments.article_id and ((article.status = 'published' and article.visibility = 'public') or public.is_tenant_member(article.tenant_id))));
drop policy if exists "Users create own comments" on public.article_comments;
create policy "Users create own comments" on public.article_comments for insert to authenticated
with check (author_profile_id = auth.uid() and public.is_tenant_member(tenant_id));
drop policy if exists "Users update own comments" on public.article_comments;
create policy "Users update own comments" on public.article_comments for update to authenticated
using (author_profile_id = auth.uid()) with check (author_profile_id = auth.uid());

drop policy if exists "Users read own share history" on public.article_shares;
create policy "Users read own share history" on public.article_shares for select to authenticated
using (profile_id = auth.uid());
drop policy if exists "Users record own shares" on public.article_shares;
create policy "Users record own shares" on public.article_shares for insert to authenticated
with check (profile_id = auth.uid() and public.is_tenant_member(tenant_id));

drop policy if exists "Owners read publication sources" on public.publication_sources;
create policy "Owners read publication sources" on public.publication_sources for select to authenticated
using (owner_profile_id = auth.uid() and public.is_tenant_member(tenant_id));
drop policy if exists "Owners manage publication sources" on public.publication_sources;
create policy "Owners manage publication sources" on public.publication_sources for all to authenticated
using (owner_profile_id = auth.uid() and public.is_tenant_member(tenant_id))
with check (owner_profile_id = auth.uid() and public.is_tenant_member(tenant_id));

create or replace function public.save_native_article(
  requested_tenant_id uuid,
  requested_article_id uuid,
  requested_title text,
  requested_description text,
  requested_content_type text,
  requested_blocks jsonb,
  requested_tags text[],
  requested_hashtags text[],
  requested_cover_image_url text,
  requested_status text
)
returns public.articles
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_article public.articles;
  plain_body text;
  word_count integer;
begin
  if auth.uid() is null or not public.has_tenant_role(requested_tenant_id, array['owner','admin','editor']) then
    raise exception using errcode = '42501', message = 'Not authorized to publish in this workspace.';
  end if;
  if requested_title is null or char_length(trim(requested_title)) not between 1 and 240 then
    raise exception using errcode = '22023', message = 'Title must contain between 1 and 240 characters.';
  end if;
  if requested_content_type not in ('POST','ARTICLE') or requested_status not in ('draft','published') then
    raise exception using errcode = '22023', message = 'Invalid content type or publication status.';
  end if;
  if requested_blocks is null or jsonb_typeof(requested_blocks) <> 'array' or jsonb_array_length(requested_blocks) > 250 then
    raise exception using errcode = '22023', message = 'Content must be a JSON block array with at most 250 blocks.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(requested_blocks) block
    where block->>'type' not in ('paragraph','heading','subheading','quote','code','image','divider')
  ) then
    raise exception using errcode = '22023', message = 'Content contains an unsupported block type.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(requested_blocks) block
    where block->>'type' = 'image' and coalesce(block->>'url', '') !~ '^https://'
  ) then
    raise exception using errcode = '22023', message = 'Image blocks require secure HTTPS URLs.';
  end if;
  if requested_status = 'published' and exists (
    select 1 from jsonb_array_elements(requested_blocks) block
    where (block->>'type' in ('paragraph','heading','subheading','quote') and trim(coalesce(block->>'text', '')) = '')
       or (block->>'type' = 'code' and trim(coalesce(block->>'code', '')) = '')
  ) then
    raise exception using errcode = '22023', message = 'Published content cannot contain empty text or code blocks.';
  end if;

  select coalesce(string_agg(coalesce(block->>'text', block->>'code', block->>'caption', ''), E'\n'), '')
  into plain_body from jsonb_array_elements(requested_blocks) block;
  word_count := coalesce(array_length(regexp_split_to_array(trim(plain_body), '\s+'), 1), 0);

  if requested_article_id is null then
    insert into public.articles(
      tenant_id, author_id, title, description, body, platform, tags, hashtags,
      status, published_at, content_type, content_format, content_blocks,
      cover_image_url, visibility, reading_minutes, source_type
    ) values (
      requested_tenant_id, auth.uid(), trim(requested_title), left(trim(coalesce(requested_description, '')), 1000), plain_body,
      'StackedIN', coalesce(requested_tags, '{}'::text[])[1:20], coalesce(requested_hashtags, '{}'::text[])[1:20],
      requested_status, case when requested_status = 'published' then now() else null end,
      requested_content_type, 'BLOCKS_V1', requested_blocks, nullif(trim(requested_cover_image_url), ''),
      'public', greatest(1, ceil(word_count / 220.0)::integer), 'USER'
    ) returning * into saved_article;
  else
    update public.articles article
    set title = trim(requested_title),
        description = left(trim(coalesce(requested_description, '')), 1000),
        body = plain_body,
        tags = coalesce(requested_tags, '{}'::text[])[1:20],
        hashtags = coalesce(requested_hashtags, '{}'::text[])[1:20],
        status = requested_status,
        published_at = case when requested_status = 'published' then coalesce(article.published_at, now()) else article.published_at end,
        content_type = requested_content_type,
        content_format = 'BLOCKS_V1',
        content_blocks = requested_blocks,
        cover_image_url = nullif(trim(requested_cover_image_url), ''),
        reading_minutes = greatest(1, ceil(word_count / 220.0)::integer)
    where article.id = requested_article_id
      and article.tenant_id = requested_tenant_id
      and (article.author_id = auth.uid() or public.has_tenant_role(requested_tenant_id, array['owner','admin']))
    returning * into saved_article;
    if saved_article.id is null then
      raise exception using errcode = '42501', message = 'Article was not found or cannot be edited.';
    end if;
  end if;
  return saved_article;
end
$$;

create or replace function public.react_to_article(requested_article_id uuid, requested_reaction text)
returns public.article_reactions
language plpgsql
security definer
set search_path = public
as $$
declare article_row public.articles; reaction_row public.article_reactions;
begin
  select * into article_row from public.articles
  where id = requested_article_id and status = 'published'
    and (visibility = 'public' or public.is_tenant_member(tenant_id));
  if article_row.id is null or auth.uid() is null then raise exception using errcode = '42501', message = 'Published article access is required.'; end if;
  if requested_reaction is null then
    delete from public.article_reactions where article_id = requested_article_id and profile_id = auth.uid() returning * into reaction_row;
    return reaction_row;
  end if;
  if requested_reaction not in ('LIKE','LOVE','CELEBRATE','INSIGHTFUL','SUPPORT','CURIOUS') then
    raise exception using errcode = '22023', message = 'Unsupported reaction.';
  end if;
  insert into public.article_reactions(article_id, tenant_id, profile_id, reaction_type)
  values (article_row.id, article_row.tenant_id, auth.uid(), requested_reaction)
  on conflict (article_id, profile_id) do update set reaction_type = excluded.reaction_type, updated_at = now()
  returning * into reaction_row;
  return reaction_row;
end
$$;

create or replace function public.add_article_comment(requested_article_id uuid, requested_parent_id uuid, requested_body text)
returns public.article_comments
language plpgsql
security definer
set search_path = public
as $$
declare article_row public.articles; comment_row public.article_comments;
begin
  select * into article_row from public.articles
  where id = requested_article_id and status = 'published'
    and (visibility = 'public' or public.is_tenant_member(tenant_id));
  if article_row.id is null or auth.uid() is null then raise exception using errcode = '42501', message = 'Published article access is required.'; end if;
  if char_length(trim(coalesce(requested_body, ''))) not between 1 and 4000 then raise exception using errcode = '22023', message = 'Discussion text must contain between 1 and 4000 characters.'; end if;
  if requested_parent_id is not null and not exists (select 1 from public.article_comments where id = requested_parent_id and article_id = requested_article_id and status <> 'DELETED') then
    raise exception using errcode = '22023', message = 'Parent comment is invalid.';
  end if;
  insert into public.article_comments(article_id, tenant_id, author_profile_id, parent_comment_id, body)
  values (article_row.id, article_row.tenant_id, auth.uid(), requested_parent_id, trim(requested_body))
  returning * into comment_row;
  return comment_row;
end
$$;

revoke insert, update, delete on public.article_reactions, public.article_comments, public.article_shares from anon;
revoke all on function public.save_native_article(uuid, uuid, text, text, text, jsonb, text[], text[], text, text) from public;
revoke all on function public.react_to_article(uuid, text) from public;
revoke all on function public.add_article_comment(uuid, uuid, text) from public;
grant execute on function public.save_native_article(uuid, uuid, text, text, text, jsonb, text[], text[], text, text) to authenticated;
grant execute on function public.react_to_article(uuid, text) to authenticated;
grant execute on function public.add_article_comment(uuid, uuid, text) to authenticated;

-- Public article media. Objects must be namespaced by the authenticated user ID.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('article-media', 'article-media', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Article media is public" on storage.objects;
create policy "Article media is public" on storage.objects for select using (bucket_id = 'article-media');
drop policy if exists "Users upload own article media" on storage.objects;
create policy "Users upload own article media" on storage.objects for insert to authenticated
with check (bucket_id = 'article-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users update own article media" on storage.objects;
create policy "Users update own article media" on storage.objects for update to authenticated
using (bucket_id = 'article-media' and owner_id = auth.uid()::text)
with check (bucket_id = 'article-media' and owner_id = auth.uid()::text);
drop policy if exists "Users delete own article media" on storage.objects;
create policy "Users delete own article media" on storage.objects for delete to authenticated
using (bucket_id = 'article-media' and owner_id = auth.uid()::text);

-- Realtime publication changes are idempotent across manual reruns.
do $$
begin
  begin alter publication supabase_realtime add table public.articles; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.article_reactions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.article_comments; exception when duplicate_object then null; end;
end
$$;

commit;

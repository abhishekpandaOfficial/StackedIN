begin;

do $$
begin
  if to_regclass('public.articles') is null
     or to_regclass('public.publication_sources') is null
     or to_regprocedure('public.import_publication_batch(uuid,jsonb,text)') is null then
    raise exception using errcode = '42P01', message = 'XStudio CMS dependencies are missing.', hint = 'Apply migrations 001 through 008 before migration 009.';
  end if;
end
$$;

alter table public.articles drop constraint if exists articles_status_check;
alter table public.articles
  add constraint articles_status_check check (status in ('draft','scheduled','published','archived')),
  add column if not exists slug text,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists social_image_url text,
  add column if not exists scheduled_for timestamptz,
  add column if not exists first_published_at timestamptz,
  add column if not exists editor_metadata jsonb not null default '{}'::jsonb,
  add column if not exists distribution_targets text[] not null default '{STACKEDIN}'::text[],
  add column if not exists last_autosaved_at timestamptz;

alter table public.articles
  drop constraint if exists articles_content_format_check,
  add constraint articles_content_format_check check (content_format in ('BLOCKS_V1','BLOCKS_V2','REFERENCE')),
  drop constraint if exists articles_slug_check,
  add constraint articles_slug_check check (slug is null or slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  drop constraint if exists articles_seo_title_check,
  add constraint articles_seo_title_check check (seo_title is null or char_length(seo_title) <= 70),
  drop constraint if exists articles_seo_description_check,
  add constraint articles_seo_description_check check (seo_description is null or char_length(seo_description) <= 160),
  drop constraint if exists articles_editor_metadata_check,
  add constraint articles_editor_metadata_check check (jsonb_typeof(editor_metadata) = 'object'),
  drop constraint if exists articles_distribution_targets_check,
  add constraint articles_distribution_targets_check check (
    distribution_targets <@ array['STACKEDIN','SUBSTACK','MEDIUM','HASHNODE','LINKEDIN']::text[]
    and 'STACKEDIN' = any(distribution_targets)
  ),
  drop constraint if exists articles_schedule_check,
  add constraint articles_schedule_check check (
    (status = 'scheduled' and scheduled_for is not null)
    or status <> 'scheduled'
  );

create unique index if not exists articles_tenant_slug_unique_idx
  on public.articles(tenant_id, slug) where slug is not null;
create index if not exists articles_schedule_due_idx
  on public.articles(scheduled_for, tenant_id) where status = 'scheduled';

drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at before update on public.articles
for each row execute function public.set_updated_at();

create table if not exists public.article_revisions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  revision_no integer not null check (revision_no > 0),
  title text not null,
  description text not null default '',
  content_blocks jsonb not null default '[]'::jsonb check (jsonb_typeof(content_blocks) = 'array'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (article_id, revision_no)
);

create table if not exists public.distribution_jobs (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  platform text not null check (platform in ('STACKEDIN','SUBSTACK','MEDIUM','HASHNODE','LINKEDIN')),
  status text not null default 'PENDING' check (status in ('PENDING','PROCESSING','PUBLISHED','HANDOFF_READY','REQUIRES_CONNECTION','FAILED','CANCELLED')),
  delivery_mode text not null check (delivery_mode in ('NATIVE','API','HANDOFF')),
  scheduled_for timestamptz,
  platform_title text,
  platform_excerpt text,
  platform_tags text[] not null default '{}',
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  external_post_url text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (article_id, platform)
);

create index if not exists article_revisions_article_idx on public.article_revisions(article_id, revision_no desc);
create index if not exists distribution_jobs_queue_idx on public.distribution_jobs(status, scheduled_for, tenant_id);

drop trigger if exists distribution_jobs_set_updated_at on public.distribution_jobs;
create trigger distribution_jobs_set_updated_at before update on public.distribution_jobs
for each row execute function public.set_updated_at();

alter table public.article_revisions enable row level security;
alter table public.distribution_jobs enable row level security;

drop policy if exists "Tenant editors read article revisions" on public.article_revisions;
create policy "Tenant editors read article revisions" on public.article_revisions for select to authenticated
using (
  author_id = auth.uid()
  or public.has_tenant_role(tenant_id, array['owner','admin','editor'])
);

drop policy if exists "Tenant editors read distribution jobs" on public.distribution_jobs;
create policy "Tenant editors read distribution jobs" on public.distribution_jobs for select to authenticated
using (
  requested_by = auth.uid()
  or public.has_tenant_role(tenant_id, array['owner','admin','editor'])
);

revoke insert, update, delete on public.article_revisions from anon, authenticated;
revoke insert, update, delete on public.distribution_jobs from anon, authenticated;
grant select on public.article_revisions to authenticated;
grant select on public.distribution_jobs to authenticated;

create or replace function public.save_cms_article(
  requested_tenant_id uuid,
  requested_article_id uuid,
  requested_title text,
  requested_description text,
  requested_content_type text,
  requested_blocks jsonb,
  requested_tags text[],
  requested_hashtags text[],
  requested_cover_image_url text,
  requested_pillar text,
  requested_series text,
  requested_slug text,
  requested_seo jsonb,
  requested_status text,
  requested_scheduled_for timestamptz,
  requested_distribution jsonb,
  requested_editor_metadata jsonb
)
returns public.articles
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_article public.articles;
  saved_id uuid := coalesce(requested_article_id, gen_random_uuid());
  normalized_slug text;
  plain_body text;
  word_count integer;
  revision_number integer;
  target jsonb;
  target_platform text;
  target_platforms text[];
  is_autosave boolean := coalesce(requested_editor_metadata->>'autosave', 'false') = 'true';
begin
  if auth.uid() is null or not public.has_tenant_role(requested_tenant_id, array['owner','admin','editor']) then
    raise exception using errcode = '42501', message = 'Not authorized to publish in this workspace.';
  end if;
  if requested_article_id is not null and not exists (
    select 1 from public.articles article
    where article.id = requested_article_id and article.tenant_id = requested_tenant_id
      and (article.author_id = auth.uid() or public.has_tenant_role(requested_tenant_id, array['owner','admin']))
  ) then
    raise exception using errcode = '42501', message = 'Article was not found or cannot be edited.';
  end if;
  if char_length(trim(coalesce(requested_title, ''))) not between 1 and 240 then
    raise exception using errcode = '22023', message = 'Title must contain between 1 and 240 characters.';
  end if;
  if requested_content_type not in ('POST','ARTICLE') or requested_status not in ('draft','scheduled','published') then
    raise exception using errcode = '22023', message = 'Invalid content type or publication status.';
  end if;
  if requested_status = 'scheduled' and (requested_scheduled_for is null or requested_scheduled_for <= now()) then
    raise exception using errcode = '22023', message = 'Scheduled publication time must be in the future.';
  end if;
  if requested_blocks is null or jsonb_typeof(requested_blocks) <> 'array' or jsonb_array_length(requested_blocks) > 250 then
    raise exception using errcode = '22023', message = 'Content must be a JSON block array with at most 250 blocks.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(requested_blocks) block
    where block->>'type' not in ('paragraph','heading','subheading','bullet_list','numbered_list','checklist','quote','callout','code','image','video','table','button','divider')
  ) then
    raise exception using errcode = '22023', message = 'Content contains an unsupported block type.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(requested_blocks) block
    where block->>'type' in ('image','video','button')
      and coalesce(block->>'url', '') !~ '^https://'
  ) then
    raise exception using errcode = '22023', message = 'Media and button blocks require secure HTTPS URLs.';
  end if;
  if requested_status <> 'draft' and jsonb_array_length(requested_blocks) = 0 then
    raise exception using errcode = '22023', message = 'Published and scheduled content needs at least one block.';
  end if;
  if requested_seo is null or jsonb_typeof(requested_seo) <> 'object'
     or requested_editor_metadata is null or jsonb_typeof(requested_editor_metadata) <> 'object' then
    raise exception using errcode = '22023', message = 'SEO and editor metadata must be JSON objects.';
  end if;
  if nullif(trim(coalesce(requested_seo->>'canonicalUrl', '')), '') is not null and requested_seo->>'canonicalUrl' !~ '^https://'
     or nullif(trim(coalesce(requested_seo->>'socialImageUrl', '')), '') is not null and requested_seo->>'socialImageUrl' !~ '^https://' then
    raise exception using errcode = '22023', message = 'Canonical and social image URLs must use HTTPS.';
  end if;
  if requested_distribution is null or jsonb_typeof(requested_distribution) <> 'array' or jsonb_array_length(requested_distribution) not between 1 and 5 then
    raise exception using errcode = '22023', message = 'Choose between one and five distribution destinations.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(requested_distribution) item
    where item->>'platform' not in ('STACKEDIN','SUBSTACK','MEDIUM','HASHNODE','LINKEDIN')
  ) or not exists (
    select 1 from jsonb_array_elements(requested_distribution) item where item->>'platform' = 'STACKEDIN'
  ) then
    raise exception using errcode = '22023', message = 'Distribution destinations are invalid or missing StackedIN.';
  end if;

  normalized_slug := trim(both '-' from regexp_replace(lower(coalesce(nullif(trim(requested_slug), ''), requested_title)), '[^a-z0-9]+', '-', 'g'));
  if normalized_slug = '' then normalized_slug := 'article-' || left(replace(saved_id::text, '-', ''), 12); end if;
  normalized_slug := left(normalized_slug, 100);
  if exists (select 1 from public.articles where tenant_id = requested_tenant_id and slug = normalized_slug and id <> saved_id) then
    raise exception using errcode = '23505', message = 'This URL slug is already used in the workspace.';
  end if;

  select coalesce(string_agg(
    case
      when block->>'type' = 'code' then coalesce(block->>'code', '')
      when block->>'type' in ('bullet_list','numbered_list','checklist') then coalesce((select string_agg(item->>'text', ' ') from jsonb_array_elements(coalesce(block->'items', '[]'::jsonb)) item), '')
      when block->>'type' = 'table' then coalesce((
        select string_agg(cells.cell, ' ')
        from jsonb_array_elements(coalesce(block->'rows', '[]'::jsonb)) as rows(row_value)
        cross join lateral jsonb_array_elements_text(rows.row_value) as cells(cell)
      ), '')
      else coalesce(block->>'text', block->>'caption', block->>'label', '')
    end,
    E'\n'
  ), '') into plain_body
  from jsonb_array_elements(requested_blocks) block;
  word_count := case when trim(plain_body) = '' then 0 else coalesce(array_length(regexp_split_to_array(trim(plain_body), '\s+'), 1), 0) end;

  select array_agg(distinct item->>'platform') into target_platforms
  from jsonb_array_elements(requested_distribution) item;

  if requested_article_id is null then
    insert into public.articles(
      id, tenant_id, author_id, title, description, body, platform, tags, hashtags, pillar, series,
      status, published_at, content_type, content_format, content_blocks, cover_image_url, visibility,
      reading_minutes, source_type, slug, seo_title, seo_description, canonical_url, social_image_url,
      scheduled_for, first_published_at, editor_metadata, distribution_targets, last_autosaved_at
    ) values (
      saved_id, requested_tenant_id, auth.uid(), trim(requested_title), left(trim(coalesce(requested_description, '')), 1000), plain_body,
      'StackedIN', (coalesce(requested_tags, '{}'::text[]))[1:20], (coalesce(requested_hashtags, '{}'::text[]))[1:20],
      nullif(trim(requested_pillar), ''), nullif(trim(requested_series), ''), requested_status,
      case when requested_status = 'published' then now() else null end, requested_content_type, 'BLOCKS_V2', requested_blocks,
      nullif(trim(requested_cover_image_url), ''), 'public', greatest(1, ceil(greatest(word_count, 1) / 220.0)::integer), 'USER',
      normalized_slug, nullif(left(trim(coalesce(requested_seo->>'title', '')), 70), ''),
      nullif(left(trim(coalesce(requested_seo->>'description', '')), 160), ''),
      nullif(trim(requested_seo->>'canonicalUrl'), ''), nullif(trim(requested_seo->>'socialImageUrl'), ''),
      case when requested_status = 'scheduled' then requested_scheduled_for else null end,
      case when requested_status = 'published' then now() else null end,
      requested_editor_metadata, target_platforms,
      case when is_autosave then now() else null end
    ) returning * into saved_article;
  else
    update public.articles article set
      title = trim(requested_title), description = left(trim(coalesce(requested_description, '')), 1000), body = plain_body,
      tags = (coalesce(requested_tags, '{}'::text[]))[1:20], hashtags = (coalesce(requested_hashtags, '{}'::text[]))[1:20],
      pillar = nullif(trim(requested_pillar), ''), series = nullif(trim(requested_series), ''), status = requested_status,
      published_at = case when requested_status = 'published' then coalesce(article.published_at, now()) else article.published_at end,
      content_type = requested_content_type, content_format = 'BLOCKS_V2', content_blocks = requested_blocks,
      cover_image_url = nullif(trim(requested_cover_image_url), ''), reading_minutes = greatest(1, ceil(greatest(word_count, 1) / 220.0)::integer),
      slug = normalized_slug, seo_title = nullif(left(trim(coalesce(requested_seo->>'title', '')), 70), ''),
      seo_description = nullif(left(trim(coalesce(requested_seo->>'description', '')), 160), ''),
      canonical_url = nullif(trim(requested_seo->>'canonicalUrl'), ''), social_image_url = nullif(trim(requested_seo->>'socialImageUrl'), ''),
      scheduled_for = case when requested_status = 'scheduled' then requested_scheduled_for else null end,
      first_published_at = case when requested_status = 'published' then coalesce(article.first_published_at, now()) else article.first_published_at end,
      editor_metadata = requested_editor_metadata, distribution_targets = target_platforms,
      last_autosaved_at = case when is_autosave then now() else article.last_autosaved_at end
    where article.id = saved_id
    returning * into saved_article;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(saved_id::text, 0));
  if not is_autosave or not exists (select 1 from public.article_revisions where article_id = saved_id) then
    select coalesce(max(revision_no), 0) + 1 into revision_number from public.article_revisions where article_id = saved_id;
    insert into public.article_revisions(article_id, tenant_id, author_id, revision_no, title, description, content_blocks, metadata)
    values (saved_id, requested_tenant_id, auth.uid(), revision_number, saved_article.title, saved_article.description, saved_article.content_blocks,
      jsonb_build_object('status', requested_status, 'seo', requested_seo, 'pillar', requested_pillar, 'series', requested_series, 'distribution', requested_distribution));
  end if;

  delete from public.distribution_jobs where article_id = saved_id and not (platform = any(target_platforms));
  for target in select value from jsonb_array_elements(requested_distribution)
  loop
    target_platform := target->>'platform';
    insert into public.distribution_jobs(
      article_id, tenant_id, requested_by, platform, status, delivery_mode, scheduled_for,
      platform_title, platform_excerpt, platform_tags, payload, published_at
    ) values (
      saved_id, requested_tenant_id, auth.uid(), target_platform,
      case
        when target_platform = 'STACKEDIN' and requested_status = 'published' then 'PUBLISHED'
        when target_platform = 'STACKEDIN' then 'PENDING'
        else 'HANDOFF_READY'
      end,
      case when target_platform = 'STACKEDIN' then 'NATIVE' else 'HANDOFF' end,
      case when requested_status = 'scheduled' then requested_scheduled_for else null end,
      nullif(left(trim(coalesce(target->>'title', '')), 240), ''),
      nullif(left(trim(coalesce(target->>'excerpt', '')), 1000), ''),
      (select (coalesce(array_agg(left(tags.tag, 80)), '{}'::text[]))[1:20]
       from jsonb_array_elements_text(case when jsonb_typeof(target->'tags') = 'array' then target->'tags' else '[]'::jsonb end) as tags(tag)),
      jsonb_build_object('article_slug', normalized_slug, 'prepared_at', now()),
      case when target_platform = 'STACKEDIN' and requested_status = 'published' then now() else null end
    )
    on conflict (article_id, platform) do update set
      requested_by = excluded.requested_by,
      status = excluded.status,
      delivery_mode = excluded.delivery_mode,
      scheduled_for = excluded.scheduled_for,
      platform_title = excluded.platform_title,
      platform_excerpt = excluded.platform_excerpt,
      platform_tags = excluded.platform_tags,
      payload = public.distribution_jobs.payload || excluded.payload,
      published_at = excluded.published_at,
      last_error = null;
  end loop;

  return saved_article;
end
$$;

create or replace function public.restore_article_revision(requested_revision_id uuid)
returns public.articles
language plpgsql
security definer
set search_path = public
as $$
declare
  revision_row public.article_revisions;
  article_row public.articles;
  next_revision integer;
begin
  select * into revision_row from public.article_revisions where id = requested_revision_id;
  if auth.uid() is null or revision_row.id is null or not (
    revision_row.author_id = auth.uid() or public.has_tenant_role(revision_row.tenant_id, array['owner','admin','editor'])
  ) then
    raise exception using errcode = '42501', message = 'Revision cannot be restored.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(revision_row.article_id::text, 0));
  select * into article_row from public.articles where id = revision_row.article_id;
  select coalesce(max(revision_no), 0) + 1 into next_revision from public.article_revisions where article_id = revision_row.article_id;
  insert into public.article_revisions(article_id, tenant_id, author_id, revision_no, title, description, content_blocks, metadata)
  values (article_row.id, article_row.tenant_id, auth.uid(), next_revision, article_row.title, article_row.description, article_row.content_blocks,
    jsonb_build_object('status', article_row.status, 'reason', 'pre_restore_snapshot'));
  update public.articles set
    title = revision_row.title,
    description = revision_row.description,
    content_blocks = revision_row.content_blocks,
    status = 'draft',
    scheduled_for = null,
    editor_metadata = editor_metadata || jsonb_build_object('restored_from_revision', revision_row.revision_no, 'restored_at', now())
  where id = revision_row.article_id
  returning * into article_row;
  return article_row;
end
$$;

create or replace function public.publish_due_articles()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare published_count integer;
begin
  with due as (
    update public.articles set
      status = 'published',
      published_at = coalesce(published_at, now()),
      first_published_at = coalesce(first_published_at, now()),
      scheduled_for = null
    where status = 'scheduled' and scheduled_for <= now()
    returning id
  ), native_jobs as (
    update public.distribution_jobs job set
      status = 'PUBLISHED', published_at = now(), scheduled_for = null, last_error = null
    from due where job.article_id = due.id and job.platform = 'STACKEDIN'
    returning job.id
  )
  select count(*) into published_count from due;
  return published_count;
end
$$;

revoke all on function public.save_cms_article(uuid,uuid,text,text,text,jsonb,text[],text[],text,text,text,text,jsonb,text,timestamptz,jsonb,jsonb) from public;
revoke all on function public.restore_article_revision(uuid) from public;
revoke all on function public.publish_due_articles() from public, anon, authenticated;
grant execute on function public.save_cms_article(uuid,uuid,text,text,text,jsonb,text[],text[],text,text,text,text,jsonb,text,timestamptz,jsonb,jsonb) to authenticated;
grant execute on function public.restore_article_revision(uuid) to authenticated;
grant execute on function public.publish_due_articles() to service_role;

do $$ begin
  begin alter publication supabase_realtime add table public.article_revisions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.distribution_jobs; exception when duplicate_object then null; end;
end $$;

commit;

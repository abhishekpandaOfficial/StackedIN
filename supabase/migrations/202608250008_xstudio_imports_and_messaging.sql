begin;

do $$
begin
  if to_regclass('public.publication_sources') is null or to_regclass('public.messages') is null then
    raise exception using errcode = '42P01', message = 'XStudio dependencies are missing.', hint = 'Apply migrations 001 through 007 before migration 008.';
  end if;
end
$$;

alter table public.publication_sources
  add column if not exists last_post_count integer not null default 0,
  add column if not exists last_sync_source text;

create or replace function public.import_publication_batch(requested_source_id uuid, requested_posts jsonb, requested_sync_source text default 'PUBLIC_FEED')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  source_row public.publication_sources;
  post jsonb;
  imported_count integer := 0;
  post_url text;
  post_title text;
  post_description text;
  post_cover text;
  post_tags text[];
  post_published_at timestamptz;
begin
  select * into source_row from public.publication_sources where id = requested_source_id;
  if auth.uid() is null or source_row.id is null or source_row.owner_profile_id <> auth.uid() or not public.is_tenant_member(source_row.tenant_id) then
    raise exception 'not authorized to synchronize this source' using errcode = '42501';
  end if;
  if source_row.provider = 'LINKEDIN' then
    raise exception 'LinkedIn import requires approved OAuth API access' using errcode = '0A000';
  end if;
  if requested_posts is null or jsonb_typeof(requested_posts) <> 'array' or jsonb_array_length(requested_posts) > 100 then
    raise exception 'A synchronization batch must contain at most 100 posts' using errcode = '22023';
  end if;

  for post in select value from jsonb_array_elements(requested_posts)
  loop
    post_url := trim(coalesce(post->>'url', ''));
    post_title := left(trim(coalesce(post->>'title', '')), 240);
    post_description := left(trim(coalesce(post->>'description', '')), 1000);
    post_cover := nullif(trim(coalesce(post->>'coverImage', '')), '');
    if post_url !~ '^https://' or post_title = '' or (post_cover is not null and post_cover !~ '^https://') then
      continue;
    end if;
    begin post_published_at := nullif(post->>'publishedAt', '')::timestamptz; exception when others then post_published_at := now(); end;
    post_published_at := coalesce(post_published_at, now());
    select coalesce(array_agg(left(value, 80)), '{}'::text[]) into post_tags
    from jsonb_array_elements_text(case when jsonb_typeof(post->'tags') = 'array' then post->'tags' else '[]'::jsonb end);

    insert into public.articles(
      tenant_id, author_id, title, description, body, platform, external_url, canonical_url,
      tags, hashtags, pillar, series, status, published_at, content_type, content_format,
      content_blocks, cover_image_url, visibility, reading_minutes, source_type, source_provider,
      source_external_id, source_metadata
    ) values (
      source_row.tenant_id, source_row.owner_profile_id, post_title, post_description, post_description,
      initcap(lower(source_row.provider)), post_url, post_url, post_tags, post_tags,
      nullif(post->>'pillar', ''), nullif(post->>'series', ''), 'published', post_published_at,
      'ARTICLE', 'REFERENCE', '[]'::jsonb, post_cover, 'public', greatest(1, ceil(greatest(1, array_length(regexp_split_to_array(post_description, '\s+'), 1)) / 220.0)::integer),
      source_row.provider, source_row.provider, coalesce(nullif(post->>'externalId', ''), encode(digest(post_url, 'sha256'), 'hex')),
      jsonb_build_object('publication_source_id', source_row.id, 'imported_at', now(), 'sync_source', left(coalesce(requested_sync_source, 'PUBLIC_FEED'), 120))
    )
    on conflict (tenant_id, canonical_url) where canonical_url is not null
    do update set
      title = excluded.title, description = excluded.description, body = excluded.body,
      tags = excluded.tags, hashtags = excluded.hashtags, pillar = coalesce(excluded.pillar, public.articles.pillar),
      series = coalesce(excluded.series, public.articles.series), published_at = excluded.published_at,
      cover_image_url = coalesce(excluded.cover_image_url, public.articles.cover_image_url),
      source_metadata = public.articles.source_metadata || excluded.source_metadata,
      updated_at = now();
    imported_count := imported_count + 1;
  end loop;

  update public.publication_sources set
    status = 'ACTIVE', last_synced_at = now(), last_error = null,
    last_post_count = imported_count, last_sync_source = left(coalesce(requested_sync_source, 'PUBLIC_FEED'), 120)
  where id = source_row.id;
  return imported_count;
end
$$;

create or replace function public.edit_own_message(requested_message_id uuid, requested_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or char_length(trim(coalesce(requested_body, ''))) not between 1 and 8000 then
    raise exception 'A valid message is required' using errcode = '22023';
  end if;
  update public.messages set body = trim(requested_body), edited_at = now()
  where id = requested_message_id and sender_profile_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'Message cannot be edited' using errcode = '42501'; end if;
end $$;

create or replace function public.delete_own_message(requested_message_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.messages set body = 'Message removed', deleted_at = now()
  where id = requested_message_id and sender_profile_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'Message cannot be deleted' using errcode = '42501'; end if;
end $$;

revoke all on function public.import_publication_batch(uuid, jsonb, text) from public;
revoke all on function public.edit_own_message(uuid, text) from public;
revoke all on function public.delete_own_message(uuid) from public;
grant execute on function public.import_publication_batch(uuid, jsonb, text) to authenticated;
grant execute on function public.edit_own_message(uuid, text) to authenticated;
grant execute on function public.delete_own_message(uuid) to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.publication_sources; exception when duplicate_object then null; end;
end $$;

commit;

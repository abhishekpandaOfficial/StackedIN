begin;

do $$
begin
  if to_regclass('public.articles') is null
     or to_regclass('public.article_revisions') is null
     or to_regclass('public.distribution_jobs') is null
     or to_regprocedure('public.save_cms_article(uuid,uuid,text,text,text,jsonb,text[],text[],text,text,text,text,jsonb,text,timestamptz,jsonb,jsonb)') is null then
    raise exception using errcode = '42P01', message = 'XStudio Trash dependencies are missing.', hint = 'Apply migrations 001 through 009 before migration 010.';
  end if;
end
$$;

alter table public.articles
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists deleted_from_status text;

alter table public.articles
  drop constraint if exists articles_deleted_from_status_check,
  add constraint articles_deleted_from_status_check check (
    deleted_from_status is null or deleted_from_status in ('draft','scheduled','published','archived')
  );

create index if not exists articles_tenant_trash_idx
  on public.articles(tenant_id, deleted_at desc)
  where deleted_at is not null;

create or replace function public.guard_trashed_article_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.deleted_at is not null and new.deleted_at is not null then
    raise exception using errcode = '55000', message = 'Restore this article from Trash before editing it.';
  end if;
  return new;
end
$$;

drop trigger if exists articles_guard_trashed_update on public.articles;
create trigger articles_guard_trashed_update
before update on public.articles
for each row execute function public.guard_trashed_article_update();

create or replace function public.trash_cms_article(requested_article_id uuid)
returns public.articles
language plpgsql
security definer
set search_path = public
as $$
declare
  article_row public.articles;
  next_revision integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Sign in to manage this article.';
  end if;

  select * into article_row
  from public.articles
  where id = requested_article_id and source_type = 'USER'
  for update;

  if article_row.id is null then
    raise exception using errcode = 'P0002', message = 'Article was not found.';
  end if;
  if not (
    article_row.author_id = auth.uid()
    or public.has_tenant_role(article_row.tenant_id, array['owner','admin'])
  ) then
    raise exception using errcode = '42501', message = 'You cannot move this article to Trash.';
  end if;
  if article_row.deleted_at is not null then
    return article_row;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(article_row.id::text, 0));
  select coalesce(max(revision_no), 0) + 1 into next_revision
  from public.article_revisions where article_id = article_row.id;
  insert into public.article_revisions(
    article_id, tenant_id, author_id, revision_no, title, description, content_blocks, metadata
  ) values (
    article_row.id, article_row.tenant_id, auth.uid(), next_revision, article_row.title,
    article_row.description, article_row.content_blocks,
    jsonb_build_object('status', article_row.status, 'reason', 'soft_delete')
  );

  update public.distribution_jobs
  set status = 'CANCELLED', scheduled_for = null, last_error = null
  where article_id = article_row.id and status <> 'PUBLISHED';

  update public.articles
  set deleted_at = now(),
      deleted_by = auth.uid(),
      deleted_from_status = status,
      status = 'archived',
      scheduled_for = null,
      editor_metadata = editor_metadata || jsonb_build_object('trashed_at', now(), 'trashed_by', auth.uid())
  where id = article_row.id
  returning * into article_row;

  return article_row;
end
$$;

create or replace function public.restore_cms_article(requested_article_id uuid)
returns public.articles
language plpgsql
security definer
set search_path = public
as $$
declare
  article_row public.articles;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Sign in to manage this article.';
  end if;

  select * into article_row
  from public.articles
  where id = requested_article_id and source_type = 'USER'
  for update;

  if article_row.id is null then
    raise exception using errcode = 'P0002', message = 'Article was not found.';
  end if;
  if not (
    article_row.author_id = auth.uid()
    or public.has_tenant_role(article_row.tenant_id, array['owner','admin'])
  ) then
    raise exception using errcode = '42501', message = 'You cannot restore this article.';
  end if;
  if article_row.deleted_at is null then
    return article_row;
  end if;

  update public.articles
  set deleted_at = null,
      deleted_by = null,
      deleted_from_status = null,
      status = 'draft',
      scheduled_for = null,
      editor_metadata = (editor_metadata - 'trashed_at' - 'trashed_by')
        || jsonb_build_object('restored_from_trash_at', now(), 'restored_by', auth.uid())
  where id = article_row.id
  returning * into article_row;

  return article_row;
end
$$;

revoke all on function public.trash_cms_article(uuid) from public;
revoke all on function public.restore_cms_article(uuid) from public;
grant execute on function public.trash_cms_article(uuid) to authenticated;
grant execute on function public.restore_cms_article(uuid) to authenticated;

commit;

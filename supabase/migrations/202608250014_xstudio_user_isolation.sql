begin;

do $$
begin
  if to_regclass('public.articles') is null
     or to_regclass('public.article_revisions') is null
     or to_regclass('public.distribution_jobs') is null then
    raise exception 'Apply StackedIN migrations 001 through 010 before migration 014.';
  end if;
end
$$;

-- Published public work powers the shared feed. Drafts, scheduled work, Trash,
-- revisions, and delivery operations belong only to their author.
drop policy if exists "Published articles are public" on public.articles;
create policy "Published articles are public" on public.articles for select
using (
  (status = 'published' and visibility = 'public')
  or author_id = auth.uid()
);

drop policy if exists "Authors and editors update articles" on public.articles;
drop policy if exists "Authors update own articles" on public.articles;
create policy "Authors update own articles" on public.articles for update to authenticated
using (
  author_id = auth.uid()
  and public.is_tenant_member(tenant_id)
)
with check (
  author_id = auth.uid()
  and public.is_tenant_member(tenant_id)
);

drop policy if exists "Authors and admins delete articles" on public.articles;
drop policy if exists "Authors delete own articles" on public.articles;
create policy "Authors delete own articles" on public.articles for delete to authenticated
using (
  author_id = auth.uid()
  and public.is_tenant_member(tenant_id)
);

drop policy if exists "Tenant editors read article revisions" on public.article_revisions;
drop policy if exists "Authors read own article revisions" on public.article_revisions;
create policy "Authors read own article revisions" on public.article_revisions for select to authenticated
using (
  author_id = auth.uid()
  and public.is_tenant_member(tenant_id)
);

drop policy if exists "Tenant editors read distribution jobs" on public.distribution_jobs;
drop policy if exists "Authors read own distribution jobs" on public.distribution_jobs;
create policy "Authors read own distribution jobs" on public.distribution_jobs for select to authenticated
using (
  requested_by = auth.uid()
  and public.is_tenant_member(tenant_id)
);

-- Security-definer CMS functions still pass through triggers. This guard stops
-- an authenticated workspace administrator from mutating another author's CMS item.
create or replace function public.enforce_xstudio_article_owner()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.source_type = 'USER' and old.author_id <> actor_id then
      raise exception 'XStudio content can only be deleted by its author.';
    end if;
    return old;
  end if;

  if old.source_type = 'USER' and old.author_id <> actor_id then
    raise exception 'XStudio content can only be changed by its author.';
  end if;
  if new.source_type = 'USER' and new.author_id <> actor_id then
    raise exception 'XStudio content ownership cannot be reassigned.';
  end if;
  return new;
end
$$;

drop trigger if exists articles_enforce_xstudio_owner on public.articles;
create trigger articles_enforce_xstudio_owner
before update or delete on public.articles
for each row execute function public.enforce_xstudio_article_owner();

create index if not exists articles_xstudio_author_idx
  on public.articles(author_id, tenant_id, updated_at desc)
  where source_type = 'USER';
create index if not exists distribution_jobs_requester_idx
  on public.distribution_jobs(requested_by, tenant_id, updated_at desc);

comment on function public.enforce_xstudio_article_owner() is
  'Enforces author-level isolation for XStudio CMS content, including security-definer RPC writes.';

commit;

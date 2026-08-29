begin;

-- CareerOS distinguishes privacy (who may see a row) from integrity (who may
-- author trusted agent output). Candidate-controlled preferences remain mutable,
-- but match scores, AEON scorecards, ingestion state, and extracted provenance
-- are written only by the trusted execution plane/service role.

drop policy if exists "Career owner manages career_job_matches" on public.career_job_matches;
drop policy if exists "Career owner reads job matches" on public.career_job_matches;
create policy "Career owner reads job matches" on public.career_job_matches
for select to authenticated
using (user_id = auth.uid() and public.is_tenant_member(tenant_id));

drop policy if exists "Career owner manages aeon_sessions" on public.aeon_sessions;
drop policy if exists "Career owner reads AEON sessions" on public.aeon_sessions;
create policy "Career owner reads AEON sessions" on public.aeon_sessions
for select to authenticated
using (user_id = auth.uid() and public.is_tenant_member(tenant_id));

-- Remove broad mutation grants from trusted-output tables. The service_role
-- bypasses RLS and retains server-side authority; authenticated users can read.
revoke insert, update, delete on table public.career_job_matches from authenticated;
revoke insert, update, delete on table public.aeon_sessions from authenticated;
revoke update, delete on table public.career_ingestion_jobs from authenticated;
revoke insert, update, delete on table public.career_evidence_links from authenticated;

-- Evidence provenance must be immutable from the browser. Users may confirm or
-- reject extracted facts, but they cannot relabel CV/agent evidence as their own,
-- rewrite source locators, or inflate model confidence.
revoke update on table public.career_evidence_items from authenticated;
grant update (verification_status) on table public.career_evidence_items to authenticated;

-- Explicit least-privilege grants for tables introduced by migration 016.
grant select on table public.career_evidence_items to authenticated;
grant insert, delete on table public.career_evidence_items to authenticated;
grant select on table public.career_evidence_links to authenticated;
grant select, insert on table public.career_ingestion_jobs to authenticated;

comment on policy "Career owner reads job matches" on public.career_job_matches is
  'Candidates may inspect their private match results; only trusted workers author scores and explanations.';
comment on policy "Career owner reads AEON sessions" on public.aeon_sessions is
  'Candidates may inspect their private AEON results; readiness scorecards are trusted-engine output.';

commit;

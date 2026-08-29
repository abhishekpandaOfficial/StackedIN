begin;

create table if not exists public.career_evidence_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  career_profile_id uuid not null references public.career_profiles(id) on delete cascade,
  evidence_type text not null check (evidence_type in ('EXPERIENCE','OUTCOME','SKILL','PROJECT','EDUCATION','CERTIFICATION','DOMAIN','ACHIEVEMENT','RESPONSIBILITY','OTHER')),
  normalized_key text,
  claim_text text not null check (char_length(trim(claim_text)) between 2 and 2000),
  source_type text not null check (source_type in ('USER','CV','STACKEDIN_PROFILE','AGENT')),
  source_document_id uuid references public.career_documents(id) on delete set null,
  source_locator jsonb not null default '{}'::jsonb,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  verification_status text not null default 'UNVERIFIED' check (verification_status in ('UNVERIFIED','USER_CONFIRMED','SYSTEM_VERIFIED','REJECTED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_evidence_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  career_profile_id uuid not null references public.career_profiles(id) on delete cascade,
  from_evidence_id uuid not null references public.career_evidence_items(id) on delete cascade,
  to_evidence_id uuid not null references public.career_evidence_items(id) on delete cascade,
  relation_type text not null check (relation_type in ('SUPPORTS','DERIVED_FROM','USED_AT','RESULTED_IN','PART_OF','RELATED_TO')),
  created_at timestamptz not null default now(),
  unique (from_evidence_id, to_evidence_id, relation_type),
  check (from_evidence_id <> to_evidence_id)
);

create table if not exists public.career_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  career_profile_id uuid not null references public.career_profiles(id) on delete cascade,
  document_id uuid not null references public.career_documents(id) on delete cascade,
  status text not null default 'QUEUED' check (status in ('QUEUED','RUNNING','NEEDS_REVIEW','COMPLETED','FAILED','CANCELLED')),
  extraction_version text not null default 'evidence-v1',
  execution_provider text,
  external_execution_id text,
  extracted_count integer not null default 0 check (extracted_count >= 0),
  verified_count integer not null default 0 check (verified_count >= 0),
  summary jsonb not null default '{}'::jsonb,
  error_summary text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  unique (document_id, extraction_version)
);

create index if not exists career_evidence_profile_status_idx
  on public.career_evidence_items(user_id, career_profile_id, verification_status, evidence_type);
create index if not exists career_evidence_normalized_key_idx
  on public.career_evidence_items(user_id, career_profile_id, normalized_key)
  where normalized_key is not null;
create index if not exists career_ingestion_user_status_idx
  on public.career_ingestion_jobs(user_id, tenant_id, status, created_at desc);

create trigger career_evidence_items_set_updated_at
before update on public.career_evidence_items
for each row execute function public.set_updated_at();

alter table public.career_evidence_items enable row level security;
alter table public.career_evidence_links enable row level security;
alter table public.career_ingestion_jobs enable row level security;

drop policy if exists "Career owner reads evidence" on public.career_evidence_items;
create policy "Career owner reads evidence" on public.career_evidence_items
for select to authenticated
using (user_id = auth.uid() and public.is_tenant_member(tenant_id));

drop policy if exists "Career owner adds manual evidence" on public.career_evidence_items;
create policy "Career owner adds manual evidence" on public.career_evidence_items
for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_tenant_member(tenant_id)
  and source_type = 'USER'
  and verification_status in ('UNVERIFIED','USER_CONFIRMED')
);

drop policy if exists "Career owner reviews evidence" on public.career_evidence_items;
create policy "Career owner reviews evidence" on public.career_evidence_items
for update to authenticated
using (user_id = auth.uid() and public.is_tenant_member(tenant_id))
with check (
  user_id = auth.uid()
  and public.is_tenant_member(tenant_id)
  and verification_status in ('UNVERIFIED','USER_CONFIRMED','REJECTED')
);

drop policy if exists "Career owner deletes manual evidence" on public.career_evidence_items;
create policy "Career owner deletes manual evidence" on public.career_evidence_items
for delete to authenticated
using (
  user_id = auth.uid()
  and public.is_tenant_member(tenant_id)
  and source_type = 'USER'
);

drop policy if exists "Career owner reads evidence links" on public.career_evidence_links;
create policy "Career owner reads evidence links" on public.career_evidence_links
for select to authenticated
using (user_id = auth.uid() and public.is_tenant_member(tenant_id));

drop policy if exists "Career owner reads ingestion jobs" on public.career_ingestion_jobs;
create policy "Career owner reads ingestion jobs" on public.career_ingestion_jobs
for select to authenticated
using (user_id = auth.uid() and public.is_tenant_member(tenant_id));

drop policy if exists "Career owner queues CV ingestion" on public.career_ingestion_jobs;
create policy "Career owner queues CV ingestion" on public.career_ingestion_jobs
for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_tenant_member(tenant_id)
  and status = 'QUEUED'
  and execution_provider is null
  and external_execution_id is null
  and extracted_count = 0
  and verified_count = 0
);

comment on table public.career_evidence_items is 'Evidence-backed candidate facts used by CareerOS matching, CV tailoring, and AEON. Agent/CV-derived claims require user/system verification before trusted use.';
comment on table public.career_ingestion_jobs is 'Private queue record for asynchronous CV-to-evidence extraction. Browser users can only enqueue; trusted workers update execution state.';

commit;

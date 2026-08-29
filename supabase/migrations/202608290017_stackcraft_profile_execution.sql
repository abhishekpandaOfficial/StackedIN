begin;

create table if not exists public.career_cv_identity (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, career_profile_id uuid not null references public.career_profiles(id) on delete cascade,
  full_name text, email text, phone_e164 text, location_text text, linkedin_url text, naukri_url text, professional_summary text,
  extraction_status text not null default 'EMPTY' check (extraction_status in ('EMPTY','PROCESSING','PARSED','REVIEWED','FAILED')),
  extraction_confidence numeric(5,4) check (extraction_confidence is null or extraction_confidence between 0 and 1),
  source_document_id uuid references public.career_documents(id) on delete set null, parsed_at timestamptz, reviewed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (tenant_id,user_id)
);

create table if not exists public.career_experiences (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, career_profile_id uuid not null references public.career_profiles(id) on delete cascade,
  source_document_id uuid references public.career_documents(id) on delete set null, company_name text not null, role_title text, location_text text,
  started_on date, ended_on date, is_current boolean not null default false, description text, achievements text[] not null default '{}', technologies text[] not null default '{}',
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1), verification_status text not null default 'UNVERIFIED' check (verification_status in ('UNVERIFIED','USER_CONFIRMED','SYSTEM_VERIFIED','REJECTED')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.career_educations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, career_profile_id uuid not null references public.career_profiles(id) on delete cascade,
  source_document_id uuid references public.career_documents(id) on delete set null, institution text not null, degree text, field_of_study text,
  started_on date, ended_on date, confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  verification_status text not null default 'UNVERIFIED' check (verification_status in ('UNVERIFIED','USER_CONFIRMED','SYSTEM_VERIFIED','REJECTED')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.career_source_connections (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, source_type text not null check (source_type in ('LINKEDIN_EXPORT','NAUKRI_EXPORT','ATS_FEED','COMPANY_CAREERS','MANUAL_IMPORT')),
  source_label text, status text not null default 'DISCONNECTED' check (status in ('DISCONNECTED','CONNECTED','ERROR','PAUSED')), config jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (tenant_id,user_id,source_type,source_label)
);

create table if not exists public.career_workflow_run_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, workflow_run_id uuid not null references public.career_workflow_runs(id) on delete cascade,
  node_id text, node_type text, status text not null check (status in ('QUEUED','RUNNING','SUCCEEDED','SKIPPED','FAILED','WAITING_APPROVAL')),
  message text, payload jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now()
);

create index if not exists career_experiences_user_idx on public.career_experiences(user_id,tenant_id,started_on desc);
create index if not exists career_educations_user_idx on public.career_educations(user_id,tenant_id,ended_on desc);
create index if not exists career_source_connections_user_idx on public.career_source_connections(user_id,tenant_id,status);
create index if not exists career_workflow_run_events_run_idx on public.career_workflow_run_events(workflow_run_id,occurred_at);

do $$ declare t text; begin foreach t in array array['career_cv_identity','career_experiences','career_educations','career_source_connections','career_workflow_run_events'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;
do $$ declare t text; begin foreach t in array array['career_cv_identity','career_experiences','career_educations','career_source_connections'] loop execute format('drop policy if exists "StackCraft owner manages %s" on public.%I',t,t); execute format('create policy "StackCraft owner manages %s" on public.%I for all to authenticated using (user_id=auth.uid() and public.is_tenant_member(tenant_id)) with check (user_id=auth.uid() and public.is_tenant_member(tenant_id))',t,t); end loop; end $$;

drop policy if exists "StackCraft owner reads workflow run events" on public.career_workflow_run_events;
create policy "StackCraft owner reads workflow run events" on public.career_workflow_run_events for select to authenticated using (user_id=auth.uid() and public.is_tenant_member(tenant_id));

create or replace function public.stackcraft_sync_profile_from_cv_identity() returns trigger language plpgsql security definer set search_path=public as $$
begin update public.profiles p set display_name=coalesce(new.full_name,p.display_name), location=coalesce(new.location_text,p.location), linkedin_url=coalesce(new.linkedin_url,p.linkedin_url), updated_at=now() where p.id=new.user_id; return new; end $$;
drop trigger if exists stackcraft_sync_profile_identity on public.career_cv_identity;
create trigger stackcraft_sync_profile_identity after insert or update of full_name,location_text,linkedin_url on public.career_cv_identity for each row execute function public.stackcraft_sync_profile_from_cv_identity();

commit;

begin;

do $$
begin
  if to_regclass('public.tenants') is null
     or to_regclass('public.tenant_memberships') is null
     or to_regclass('public.profiles') is null then
    raise exception 'Apply StackedIN migration 001 before CareerOS migration 015.';
  end if;
end
$$;

create table if not exists public.career_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  current_title text,
  current_company text,
  current_country_code text check (current_country_code is null or current_country_code ~ '^[A-Z]{2}$'),
  current_salary numeric(14,2) check (current_salary is null or current_salary >= 0),
  current_currency text check (current_currency is null or current_currency ~ '^[A-Z]{3}$'),
  years_experience numeric(5,2) check (years_experience is null or years_experience between 0 and 80),
  notice_period_days integer check (notice_period_days is null or notice_period_days between 0 and 730),
  relocation_open boolean not null default true,
  sponsorship_required boolean not null default false,
  remote_preference text not null default 'HYBRID_OK' check (remote_preference in ('ONSITE','HYBRID_OK','REMOTE_ONLY','ANY')),
  agent_mode text not null default 'HITL' check (agent_mode in ('MANUAL','HITL','AUTONOMOUS')),
  match_threshold smallint not null default 82 check (match_threshold between 0 and 100),
  auto_prepare_threshold smallint not null default 90 check (auto_prepare_threshold between 0 and 100),
  whatsapp_enabled boolean not null default false,
  whatsapp_number_e164 text,
  profile_status text not null default 'DRAFT' check (profile_status in ('DRAFT','VERIFIED','PAUSED')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists public.career_target_countries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  career_profile_id uuid not null references public.career_profiles(id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  priority smallint not null default 50 check (priority between 0 and 100),
  minimum_salary numeric(14,2) check (minimum_salary is null or minimum_salary >= 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  visa_required boolean not null default true,
  relocation_required boolean not null default true,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (career_profile_id, country_code)
);

create table if not exists public.career_target_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  career_profile_id uuid not null references public.career_profiles(id) on delete cascade,
  role_name text not null check (char_length(trim(role_name)) between 2 and 160),
  priority smallint not null default 50 check (priority between 0 and 100),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (career_profile_id, role_name)
);

create table if not exists public.career_skills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  career_profile_id uuid not null references public.career_profiles(id) on delete cascade,
  skill_name text not null check (char_length(trim(skill_name)) between 1 and 120),
  category text,
  proficiency text check (proficiency is null or proficiency in ('FOUNDATIONAL','WORKING','ADVANCED','EXPERT')),
  years_experience numeric(5,2) check (years_experience is null or years_experience between 0 and 80),
  source text not null default 'USER' check (source in ('USER','CV','PROFILE','AGENT')),
  verified boolean not null default false,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (career_profile_id, skill_name)
);

create table if not exists public.career_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  career_profile_id uuid not null references public.career_profiles(id) on delete cascade,
  document_type text not null check (document_type in ('MASTER_CV','TAILORED_CV','COVER_LETTER','PORTFOLIO','CERTIFICATE','OTHER')),
  file_name text not null,
  storage_path text not null,
  mime_type text,
  sha256 text,
  source_document_id uuid references public.career_documents(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.career_workflows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  career_profile_id uuid not null references public.career_profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','PAUSED','ARCHIVED')),
  trigger_type text not null default 'SCHEDULE' check (trigger_type in ('SCHEDULE','EVENT','MANUAL')),
  schedule_expression text,
  definition jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workflow_id uuid not null references public.career_workflows(id) on delete cascade,
  status text not null default 'QUEUED' check (status in ('QUEUED','RUNNING','WAITING_APPROVAL','SUCCEEDED','FAILED','CANCELLED')),
  execution_provider text,
  external_execution_id text,
  started_at timestamptz,
  finished_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  error_summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.career_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  source_job_id text,
  source_url text not null,
  company_name text not null,
  role_title text not null,
  location_text text,
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  employment_type text,
  remote_type text,
  salary_min numeric(14,2),
  salary_max numeric(14,2),
  salary_currency text,
  sponsorship_signal text not null default 'UNKNOWN' check (sponsorship_signal in ('YES','LIKELY','UNKNOWN','UNLIKELY','NO')),
  relocation_signal text not null default 'UNKNOWN' check (relocation_signal in ('YES','LIKELY','UNKNOWN','UNLIKELY','NO')),
  published_at timestamptz,
  discovered_at timestamptz not null default now(),
  expires_at timestamptz,
  normalized_payload jsonb not null default '{}'::jsonb,
  fingerprint text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id, fingerprint)
);

create table if not exists public.career_job_matches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  career_profile_id uuid not null references public.career_profiles(id) on delete cascade,
  job_id uuid not null references public.career_jobs(id) on delete cascade,
  overall_score smallint not null check (overall_score between 0 and 100),
  technical_score smallint check (technical_score between 0 and 100),
  architecture_score smallint check (architecture_score between 0 and 100),
  seniority_score smallint check (seniority_score between 0 and 100),
  industry_score smallint check (industry_score between 0 and 100),
  visa_score smallint check (visa_score between 0 and 100),
  compensation_score smallint check (compensation_score between 0 and 100),
  relocation_score smallint check (relocation_score between 0 and 100),
  freshness_score smallint check (freshness_score between 0 and 100),
  decision text not null check (decision in ('REJECT','WATCH','TAILOR','PRIORITY')),
  blocker_codes text[] not null default '{}',
  strengths text[] not null default '{}',
  gaps text[] not null default '{}',
  explanation text,
  scoring_version text not null default 'v1',
  created_at timestamptz not null default now(),
  unique (career_profile_id, job_id, scoring_version)
);

create table if not exists public.career_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  career_profile_id uuid not null references public.career_profiles(id) on delete cascade,
  job_id uuid not null references public.career_jobs(id) on delete restrict,
  job_match_id uuid references public.career_job_matches(id) on delete set null,
  workflow_run_id uuid references public.career_workflow_runs(id) on delete set null,
  application_mode text not null check (application_mode in ('MANUAL','HITL','AUTONOMOUS')),
  status text not null default 'PREPARING' check (status in ('PREPARING','AWAITING_APPROVAL','APPROVED','SUBMITTED','VIEWED','RECRUITER_CONTACT','INTERVIEW','OFFER','REJECTED','WITHDRAWN','FAILED')),
  submitted_at timestamptz,
  last_status_at timestamptz not null default now(),
  resume_document_id uuid references public.career_documents(id) on delete set null,
  cover_letter_document_id uuid references public.career_documents(id) on delete set null,
  external_application_id text,
  external_status_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (career_profile_id, job_id)
);

create table if not exists public.career_application_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.career_applications(id) on delete cascade,
  event_type text not null,
  actor_type text not null default 'SYSTEM' check (actor_type in ('USER','AGENT','SYSTEM','EXTERNAL')),
  actor_reference text,
  event_time timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.career_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (consent_type in ('PROFILE_ACCURACY','DOCUMENT_GENERATION','AUTONOMOUS_APPLICATION','WHATSAPP','TERMS','PRIVACY')),
  consent_version text not null,
  granted boolean not null,
  granted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.career_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'TRIAL' check (plan in ('TRIAL','MONTHLY','ANNUAL')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','EXPIRED','CANCELLED','PAST_DUE')),
  price_minor integer not null default 0 check (price_minor >= 0),
  currency text not null default 'INR',
  trial_started_at timestamptz not null default now(),
  trial_expires_at timestamptz not null default (now() + interval '24 hours'),
  period_started_at timestamptz,
  period_expires_at timestamptz,
  payment_provider text,
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists public.career_usage_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null,
  quantity numeric(14,4) not null default 1 check (quantity >= 0),
  model_provider text,
  model_name text,
  input_tokens integer,
  output_tokens integer,
  estimated_cost_minor integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.aeon_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  career_profile_id uuid not null references public.career_profiles(id) on delete cascade,
  application_id uuid references public.career_applications(id) on delete set null,
  session_type text not null check (session_type in ('READINESS','MOCK','TECHNICAL','SYSTEM_DESIGN','BEHAVIORAL','COMPANY')),
  status text not null default 'PLANNED' check (status in ('PLANNED','ACTIVE','COMPLETED','CANCELLED')),
  readiness_score smallint check (readiness_score between 0 and 100),
  scorecard jsonb not null default '{}'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists career_profiles_user_idx on public.career_profiles(user_id, tenant_id);
create index if not exists career_targets_user_idx on public.career_target_countries(user_id, tenant_id, priority desc);
create index if not exists career_jobs_user_discovered_idx on public.career_jobs(user_id, tenant_id, discovered_at desc);
create index if not exists career_matches_user_score_idx on public.career_job_matches(user_id, tenant_id, overall_score desc, created_at desc);
create index if not exists career_applications_user_status_idx on public.career_applications(user_id, tenant_id, status, last_status_at desc);
create index if not exists career_application_events_timeline_idx on public.career_application_events(user_id, application_id, event_time desc);
create index if not exists career_usage_user_created_idx on public.career_usage_events(user_id, tenant_id, created_at desc);
create index if not exists aeon_sessions_user_created_idx on public.aeon_sessions(user_id, tenant_id, created_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'career_profiles','career_target_countries','career_skills','career_workflows',
    'career_applications','career_subscriptions','aeon_sessions'
  ]
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'career_profiles','career_target_countries','career_target_roles','career_skills','career_documents',
    'career_workflows','career_workflow_runs','career_jobs','career_job_matches','career_applications',
    'career_application_events','career_consents','career_subscriptions','career_usage_events','aeon_sessions'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'career_profiles','career_target_countries','career_target_roles','career_skills','career_documents',
    'career_workflows','career_jobs','career_job_matches','career_applications','aeon_sessions'
  ]
  loop
    execute format('drop policy if exists "Career owner manages %s" on public.%I', table_name, table_name);
    execute format(
      'create policy "Career owner manages %s" on public.%I for all to authenticated using (user_id = auth.uid() and public.is_tenant_member(tenant_id)) with check (user_id = auth.uid() and public.is_tenant_member(tenant_id))',
      table_name, table_name
    );
  end loop;
end
$$;

drop policy if exists "Career owner reads workflow runs" on public.career_workflow_runs;
create policy "Career owner reads workflow runs" on public.career_workflow_runs for select to authenticated
using (user_id = auth.uid() and public.is_tenant_member(tenant_id));

drop policy if exists "Career owner reads application events" on public.career_application_events;
create policy "Career owner reads application events" on public.career_application_events for select to authenticated
using (user_id = auth.uid() and public.is_tenant_member(tenant_id));
drop policy if exists "Career owner adds application events" on public.career_application_events;
create policy "Career owner adds application events" on public.career_application_events for insert to authenticated
with check (user_id = auth.uid() and public.is_tenant_member(tenant_id));

drop policy if exists "Career owner reads consents" on public.career_consents;
create policy "Career owner reads consents" on public.career_consents for select to authenticated
using (user_id = auth.uid() and public.is_tenant_member(tenant_id));
drop policy if exists "Career owner records consents" on public.career_consents;
create policy "Career owner records consents" on public.career_consents for insert to authenticated
with check (user_id = auth.uid() and public.is_tenant_member(tenant_id));

drop policy if exists "Career owner reads subscription" on public.career_subscriptions;
create policy "Career owner reads subscription" on public.career_subscriptions for select to authenticated
using (user_id = auth.uid() and public.is_tenant_member(tenant_id));
drop policy if exists "Career owner starts trial" on public.career_subscriptions;
create policy "Career owner starts trial" on public.career_subscriptions for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_tenant_member(tenant_id)
  and plan = 'TRIAL'
  and price_minor = 0
);

drop policy if exists "Career owner reads usage" on public.career_usage_events;
create policy "Career owner reads usage" on public.career_usage_events for select to authenticated
using (user_id = auth.uid() and public.is_tenant_member(tenant_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'career-documents',
  'career-documents',
  false,
  15728640,
  array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Career owners read own documents" on storage.objects;
create policy "Career owners read own documents" on storage.objects for select to authenticated
using (bucket_id = 'career-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Career owners upload own documents" on storage.objects;
create policy "Career owners upload own documents" on storage.objects for insert to authenticated
with check (bucket_id = 'career-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Career owners delete own documents" on storage.objects;
create policy "Career owners delete own documents" on storage.objects for delete to authenticated
using (bucket_id = 'career-documents' and (storage.foldername(name))[1] = auth.uid()::text);

comment on table public.career_profiles is 'Private CareerOS candidate configuration. RLS always requires both tenant membership and exact authenticated user ownership.';
comment on table public.career_application_events is 'Append-only CareerOS application timeline used for daily, weekly, monthly, and all-time history.';
comment on table public.career_subscriptions is 'CareerOS entitlement source for 24-hour trial, INR 500 monthly, and INR 5000 annual plans. Paid transitions are server-side.';
comment on table public.aeon_sessions is 'Private AEON interview readiness and mock interview history sharing the CareerOS candidate identity.';

commit;

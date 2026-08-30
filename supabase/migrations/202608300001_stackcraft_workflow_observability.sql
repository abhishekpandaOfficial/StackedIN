-- StackCraft workflow execution observability
create table if not exists public.career_workflow_run_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  workflow_run_id uuid not null references public.career_workflow_runs(id) on delete cascade,
  node_id text not null,
  node_type text not null,
  status text not null check (status in ('PENDING','RUNNING','SUCCEEDED','FAILED','WAITING_APPROVAL','SKIPPED')),
  message text,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists career_workflow_run_events_run_time_idx on public.career_workflow_run_events(workflow_run_id, occurred_at);
create index if not exists career_workflow_run_events_user_idx on public.career_workflow_run_events(tenant_id, user_id, occurred_at desc);
alter table public.career_workflow_run_events enable row level security;

drop policy if exists "career workflow events select own" on public.career_workflow_run_events;
create policy "career workflow events select own" on public.career_workflow_run_events for select to authenticated
using (auth.uid() = user_id);

-- Runtime writes are service-role only. Browser clients can observe their own execution events.
revoke insert, update, delete on public.career_workflow_run_events from authenticated;
grant select on public.career_workflow_run_events to authenticated;

-- Add the table to Supabase Realtime when it is not already present.
do $$ begin
  alter publication supabase_realtime add table public.career_workflow_run_events;
exception when duplicate_object then null;
end $$;

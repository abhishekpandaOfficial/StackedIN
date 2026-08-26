-- Phase 12: make Sarvam the platform-default writing provider while retaining
-- user-owned OpenAI and Anthropic routes. Provider keys are never stored here.

alter table public.ai_writing_usage
  drop constraint if exists ai_writing_usage_provider_check;

alter table public.ai_writing_usage
  add constraint ai_writing_usage_provider_check
  check (provider in ('sarvam','openai','anthropic'));

create or replace function public.reserve_ai_writing_generation(requested_provider text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  used_count integer;
begin
  if auth.uid() is null or requested_provider not in ('sarvam','openai','anthropic') then
    raise exception 'not authorized' using errcode='42501';
  end if;
  select count(*) into used_count
  from public.ai_writing_usage
  where profile_id=auth.uid() and created_at > now()-interval '24 hours';
  if used_count>=20 then
    raise exception 'Daily AI writing limit reached. Try again after the oldest request expires.' using errcode='P0001';
  end if;
  insert into public.ai_writing_usage(profile_id,provider) values(auth.uid(),requested_provider);
  return 19-used_count;
end;
$$;

revoke all on function public.reserve_ai_writing_generation(text) from public;
grant execute on function public.reserve_ai_writing_generation(text) to authenticated;


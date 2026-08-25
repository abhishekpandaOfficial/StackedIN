begin;

select plan(10);

select has_function(
  'public', 'search_profiles',
  array['uuid','text','text','text','text[]','text[]','boolean','numeric','integer','numeric','uuid'],
  'profile search RPC exists'
);
select has_function('public', 'record_profile_search_impressions', array['uuid','text','uuid[]'], 'search impression RPC exists');
select function_privs_are(
  'public', 'search_profiles',
  array['uuid','text','text','text','text[]','text[]','boolean','numeric','integer','numeric','uuid'],
  'authenticated', array['EXECUTE'], 'authenticated users can search'
);
select function_privs_are(
  'public', 'search_profiles',
  array['uuid','text','text','text','text[]','text[]','boolean','numeric','integer','numeric','uuid'],
  'anon', array[]::text[], 'anonymous users cannot search'
);
select function_privs_are(
  'public', 'record_profile_search_impressions', array['uuid','text','uuid[]'],
  'authenticated', array['EXECUTE'], 'authenticated users can record guarded impressions'
);
select function_privs_are(
  'public', 'record_profile_search_impressions', array['uuid','text','uuid[]'],
  'anon', array[]::text[], 'anonymous users cannot record search impressions'
);
select has_index('public', 'profiles', 'profiles_current_job_title_trgm_idx', 'role trigram index exists');
select has_index('public', 'profiles', 'profiles_location_trgm_idx', 'location trigram index exists');
select isnt_empty($$ select 1 from public.ranking_configs where engine = 'PROFILE_SEARCH' and version = 2 and active $$, 'Phase 3 ranking config is active');
select results_eq($$ select count(*)::bigint from public.feature_flags where key = 'profile_search' and enabled $$, array[1::bigint], 'profile search flag is enabled');

select * from finish();
rollback;

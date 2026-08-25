begin;

select plan(9);

select has_function('public', 'get_people_recommendations', array['uuid', 'integer'], 'people retrieval RPC exists');
select has_function('public', 'record_people_recommendation_impressions', array['uuid', 'uuid[]'], 'impression RPC exists');
select has_function('public', 'record_people_recommendation_outcome', array['uuid', 'uuid', 'text'], 'outcome RPC exists');

select function_privs_are('public', 'get_people_recommendations', array['uuid', 'integer'], 'authenticated', array['EXECUTE'], 'authenticated users can retrieve recommendations');
select function_privs_are('public', 'get_people_recommendations', array['uuid', 'integer'], 'anon', array[]::text[], 'anonymous users cannot retrieve recommendations');
select function_privs_are('public', 'record_people_recommendation_outcome', array['uuid', 'uuid', 'text'], 'authenticated', array['EXECUTE'], 'authenticated users can record their own outcome');
select function_privs_are('public', 'record_people_recommendation_outcome', array['uuid', 'uuid', 'text'], 'anon', array[]::text[], 'anonymous users cannot record outcomes');

select results_eq(
  $$ select count(*)::bigint from public.feature_flags where key = 'people_recommendations' and enabled $$,
  array[1::bigint],
  'people recommendations flag is enabled after Phase 2'
);

select isnt_empty(
  $$ select 1 from public.ranking_configs where engine = 'PEOPLE' and active $$,
  'people ranking configuration is active'
);

select * from finish();
rollback;

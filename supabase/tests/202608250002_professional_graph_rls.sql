begin;

select plan(16);

select has_extension('vector', 'pgvector is enabled');
select has_extension('pg_trgm', 'trigram search is enabled');

select has_table('public', 'skills', 'skills table exists');
select has_table('public', 'topics', 'topics table exists');
select has_table('public', 'connections', 'connections table exists');
select has_table('public', 'user_interactions', 'interaction ledger exists');
select has_table('public', 'recommendation_events', 'recommendation event log exists');
select has_table('public', 'ranking_configs', 'ranking configuration exists');

select has_index('public', 'profiles', 'profiles_search_document_idx', 'profile FTS index exists');
select has_index('public', 'profiles', 'profiles_embedding_hnsw_idx', 'profile vector index exists');
select has_index('public', 'connections', 'connections_canonical_pair_idx', 'connection pair uniqueness exists');

select policies_are(
  'public',
  'connections',
  array['Connection participants read'],
  'connections expose only participant-readable rows'
);

select policies_are(
  'public',
  'blocks',
  array['Block owners read', 'Users manage own blocks'],
  'blocks remain private to the blocker'
);

select function_privs_are(
  'public',
  'send_connection_request',
  array['uuid', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated users can invoke the guarded connection RPC'
);

select function_privs_are(
  'public',
  'send_connection_request',
  array['uuid', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous users cannot invoke the connection RPC'
);

select results_eq(
  $$ select count(*)::bigint from public.ranking_configs where active $$,
  array[4::bigint],
  'four V1 ranking configurations are active'
);

select * from finish();
rollback;

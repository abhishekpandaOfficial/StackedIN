begin;

select plan(10);

select has_column('public', 'publication_sources', 'last_post_count', 'source tracks imported post count');
select has_column('public', 'publication_sources', 'last_sync_source', 'source tracks synchronization mechanism');
select has_function('public', 'import_publication_batch', array['uuid','jsonb','text'], 'XStudio batch import RPC exists');
select has_function('public', 'edit_own_message', array['uuid','text'], 'message edit RPC exists');
select has_function('public', 'delete_own_message', array['uuid'], 'message delete RPC exists');
select function_lang_is('public', 'import_publication_batch', array['uuid','jsonb','text'], 'plpgsql', 'batch import is implemented in PostgreSQL');
select function_returns('public', 'import_publication_batch', array['uuid','jsonb','text'], 'integer', 'batch import reports imported rows');
select function_privs_are('public', 'import_publication_batch', array['uuid','jsonb','text'], 'authenticated', array['EXECUTE'], 'authenticated users may synchronize their sources');
select function_privs_are('public', 'edit_own_message', array['uuid','text'], 'authenticated', array['EXECUTE'], 'authenticated senders may edit their messages');
select function_privs_are('public', 'delete_own_message', array['uuid'], 'authenticated', array['EXECUTE'], 'authenticated senders may delete their messages');

select * from finish();
rollback;

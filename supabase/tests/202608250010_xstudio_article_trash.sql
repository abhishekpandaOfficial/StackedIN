begin;
select plan(10);

select has_column('public', 'articles', 'deleted_at', 'articles support soft deletion');
select has_column('public', 'articles', 'deleted_by', 'article deletion records the actor');
select has_column('public', 'articles', 'deleted_from_status', 'article deletion remembers its previous state');
select has_function('public', 'trash_cms_article', array['uuid'], 'Trash RPC exists');
select has_function('public', 'restore_cms_article', array['uuid'], 'restore RPC exists');
select function_privs_are('public', 'trash_cms_article', array['uuid'], 'authenticated', array['EXECUTE'], 'authenticated users can call guarded Trash');
select function_privs_are('public', 'restore_cms_article', array['uuid'], 'authenticated', array['EXECUTE'], 'authenticated users can call guarded restore');
select function_privs_are('public', 'trash_cms_article', array['uuid'], 'anon', array[]::text[], 'anonymous users cannot trash articles');
select function_privs_are('public', 'restore_cms_article', array['uuid'], 'anon', array[]::text[], 'anonymous users cannot restore articles');
select has_trigger('public', 'articles', 'articles_guard_trashed_update', 'trashed articles cannot be edited before restore');

select * from finish();
rollback;

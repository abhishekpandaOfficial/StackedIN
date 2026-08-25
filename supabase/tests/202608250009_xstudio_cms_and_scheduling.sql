begin;
select plan(15);

select has_column('public', 'articles', 'slug', 'articles has a CMS slug');
select has_column('public', 'articles', 'scheduled_for', 'articles can be scheduled');
select has_column('public', 'articles', 'editor_metadata', 'articles keep editor metadata');
select has_column('public', 'articles', 'distribution_targets', 'articles keep distribution destinations');
select has_table('public', 'article_revisions', 'revision history exists');
select has_table('public', 'distribution_jobs', 'distribution queue exists');
select row_security_active('public', 'article_revisions', 'revision history uses RLS');
select row_security_active('public', 'distribution_jobs', 'distribution jobs use RLS');
select has_function('public', 'save_cms_article', array['uuid','uuid','text','text','text','jsonb','text[]','text[]','text','text','text','text','jsonb','text','timestamptz','jsonb','jsonb'], 'CMS save RPC exists');
select has_function('public', 'restore_article_revision', array['uuid'], 'revision restore RPC exists');
select has_function('public', 'publish_due_articles', array[]::text[], 'scheduled publishing RPC exists');
select function_privs_are('public', 'publish_due_articles', array[]::text[], 'authenticated', array[]::text[], 'authenticated cannot execute the scheduler');
select function_privs_are('public', 'publish_due_articles', array[]::text[], 'anon', array[]::text[], 'anonymous users cannot execute the scheduler');
select function_privs_are('public', 'publish_due_articles', array[]::text[], 'service_role', array['EXECUTE'], 'service role executes the scheduler');
select col_is_unique('public', 'article_revisions', array['article_id','revision_no'], 'revision numbers are unique per article');

select * from finish();
rollback;

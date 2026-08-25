begin;

select plan(14);

select has_table('public', 'article_reactions', 'reaction ledger exists');
select has_table('public', 'article_comments', 'discussion ledger exists');
select has_table('public', 'article_shares', 'share ledger exists');
select has_table('public', 'publication_sources', 'external source registry exists');
select has_column('public', 'articles', 'content_blocks', 'articles contain safe content blocks');
select has_column('public', 'articles', 'hashtags', 'articles contain native hashtags');
select has_function('public', 'save_native_article', array['uuid','uuid','text','text','text','jsonb','text[]','text[]','text','text'], 'guarded article save RPC exists');
select has_function('public', 'react_to_article', array['uuid','text'], 'reaction RPC exists');
select has_function('public', 'add_article_comment', array['uuid','uuid','text'], 'discussion RPC exists');
select function_privs_are('public', 'save_native_article', array['uuid','uuid','text','text','text','jsonb','text[]','text[]','text','text'], 'authenticated', array['EXECUTE'], 'authenticated editors can invoke guarded publishing');
select function_privs_are('public', 'save_native_article', array['uuid','uuid','text','text','text','jsonb','text[]','text[]','text','text'], 'anon', array[]::text[], 'anonymous users cannot publish');
select policies_are('public', 'article_reactions', array['Published reaction summaries are readable','Users manage own article reaction'], 'reaction policies are explicit');
select policies_are('public', 'article_comments', array['Published discussions are readable','Users create own comments','Users update own comments'], 'discussion policies are explicit');
select has_index('public', 'articles', 'articles_native_feed_idx', 'native feed index exists');

select * from finish();
rollback;


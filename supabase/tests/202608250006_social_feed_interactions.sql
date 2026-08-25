begin;

select plan(13);

select has_table('public', 'article_saves', 'persistent saves exist');
select has_table('public', 'article_restacks', 'restacks exist');
select has_table('public', 'article_preferences', 'feed preferences exist');
select has_table('public', 'article_reports', 'moderation reports exist');
select has_table('public', 'profile_subscriptions', 'creator subscriptions exist');
select has_column('public', 'articles', 'restack_count', 'articles expose restack totals');
select has_index('public', 'article_saves', 'article_saves_profile_time_idx', 'saved feed lookup is indexed');
select has_index('public', 'article_restacks', 'article_restacks_article_time_idx', 'restack totals are indexed');
select policies_are('public', 'article_saves', array['Users manage own article saves'], 'save policy is explicit');
select policies_are('public', 'article_preferences', array['Users manage own feed preferences'], 'preference policy is explicit');
select policies_are('public', 'article_reports', array['Users create and read own reports','Users submit own reports'], 'report policies are explicit');
select policies_are('public', 'profile_subscriptions', array['Subscription participants read','Users manage own subscriptions'], 'subscription policies are explicit');
select trigger_is('public', 'article_restacks', 'article_restacks_refresh_counts', 'public', 'refresh_article_engagement_counts', 'restacks refresh article totals');

select * from finish();
rollback;

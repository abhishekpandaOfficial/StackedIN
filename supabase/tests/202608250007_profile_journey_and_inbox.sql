begin;

select plan(20);

select has_table('public', 'profile_experiences', 'professional experience exists');
select has_table('public', 'profile_education', 'education history exists');
select has_table('public', 'profile_projects', 'portfolio projects exist');
select has_table('public', 'profile_achievements', 'achievements exist');
select has_table('public', 'profile_links', 'professional links exist');
select has_table('public', 'notifications', 'notifications exist');
select has_table('public', 'conversations', 'conversations exist');
select has_table('public', 'conversation_members', 'conversation membership exists');
select has_table('public', 'messages', 'messages exist');
select has_column('public', 'profiles', 'banner_url', 'profile banner is available');
select has_column('public', 'profiles', 'github_url', 'GitHub profile is available');
select has_column('public', 'profiles', 'featured_skills', 'featured skills are available');
select has_index('public', 'notifications', 'notifications_recipient_time_idx', 'inbox lookup is indexed');
select has_index('public', 'messages', 'messages_conversation_time_idx', 'message history is indexed');
select policies_are('public', 'notifications', array['Recipients read notifications'], 'notifications are recipient scoped');
select policies_are('public', 'conversations', array['Members read conversations'], 'conversations are member scoped');
select policies_are('public', 'conversation_members', array['Members read conversation membership'], 'membership access is explicit');
select policies_are('public', 'messages', array['Members read messages','Members send messages'], 'message access is membership scoped');
select has_function('public', 'start_direct_conversation', array['uuid','uuid'], 'direct conversation RPC exists');
select trigger_is('public', 'messages', 'messages_create_notifications', 'public', 'notify_new_message', 'new messages create notifications');

select * from finish();
rollback;

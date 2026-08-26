# StackedIN social publishing setup

StackedIN always publishes natively first. External destinations use an
official-editor handoff until the provider has approved the application and a
server-side OAuth/API adapter is active. Passwords are never collected.

| Platform | Safe mode available now | Direct publishing requirement | Official setup |
|---|---|---|---|
| Substack | Editor handoff | No generally available public post-publishing API | https://support.substack.com/hc/en-us/sections/360004398252-Publishing |
| Medium | Editor handoff | Provider-supported integration access | https://help.medium.com/hc/en-us/sections/360001768028-Writing-and-publishing |
| Hashnode | Editor handoff | Personal access token and GraphQL publishing adapter | https://apidocs.hashnode.com/ |
| LinkedIn | Share/editor handoff | Approved LinkedIn app, OAuth, and Community Management access | https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api |
| Instagram | Editor handoff | Meta app, professional Instagram account, OAuth, and Content Publishing permissions | https://developers.facebook.com/docs/instagram-platform/content-publishing/ |
| X | Share/editor handoff | X developer project, OAuth 2.0 user authorization, and post-write access | https://docs.x.com/x-api/posts/create-manage-posts |
| Threads | Editor handoff | Meta app, Threads OAuth, and Threads publishing permissions | https://developers.facebook.com/docs/threads/posts/ |

Use **Feed → Create a post → Manage accounts** to save official profile URLs,
see connection status, disconnect accounts, and open the correct provider
documentation. `HANDOFF_READY` is intentionally different from `CONNECTED`:
only a verified server-side connector may claim direct publishing.

Provider tokens belong in encrypted server storage. Never put OAuth client
secrets, access tokens, OpenAI keys, or Anthropic keys in `VITE_` variables,
source files, browser storage, or Supabase client-readable tables.

# StackedIN + XStudio

A living multi-platform publishing dashboard for Abhishek Panda's writing on
[Substack](https://pandaabhishek.substack.com/),
[Medium](https://medium.com/@official.abhishekpanda),
[Hashnode](https://hashnode.com/@abhishekpanda), and
[LinkedIn](https://www.linkedin.com/in/iamabhishekpanda/).

## What the site does

- Tracks public Substack, Medium, and Hashnode posts in one searchable library.
- Opens the official editor for Substack, Medium, Hashnode, or LinkedIn.
- Uses provider-managed sign-in and never asks for or stores platform passwords.
- Labels every article with its official publishing-platform icon.
- Organises articles into content pillars, modules, tags, and structured series.
- Shows portfolio counts, coverage, recent additions, and learning-path views.
- Checks supported public feeds automatically every six hours through GitHub Actions.
- Classifies newly discovered posts with deterministic topic rules.
- Supports private platform analytics CSV imports for article views and shares.
- Stores imported analytics only in the current browser.
- Publishes native posts and rich-block articles directly to the StackedIN feed.
- Provides realtime reactions, comments, restacks, notifications, connection requests, and direct messages.
- Lets XStudio owners connect a public feed and import it into their native StackedIN library on demand.

## Automatic multi-platform sync

The sync workflow runs every six hours and can also be run manually from the
GitHub Actions tab. It calls the sync script, which:

1. Reads the Substack archive API with RSS fallback.
2. Reads Medium's official profile RSS feed.
3. Reads the Hashnode publication through its public GraphQL API.
4. Merges discovered posts with `data/posts.seed.json`.
5. Preserves curated taxonomy and platform labels for known posts.
6. Writes and deploys the refreshed `public/posts.json` catalogue.

The refresh button reloads the most recently deployed snapshot. The scheduled
workflow discovers brand-new public posts on supported platforms.

LinkedIn does not expose a general public author feed suitable for this static
dashboard. XStudio therefore links to the official LinkedIn profile
and publishing editor; the signed-in LinkedIn experience remains the source of
truth for LinkedIn posts and analytics.

Signed-in XStudio source synchronization is separate from the public catalogue
snapshot. It imports up to 100 recent public entries from Substack, Medium,
Hashnode, or a generic RSS feed through the authenticated Vercel function at
`/api/xstudio-sync`. LinkedIn import remains disabled until an approved OAuth
API integration is configured.

## Local development

Run `npm ci`, then `npm run sync:offline`, followed by `npm run dev`.
Use `npm run sync:substack` when the machine has unrestricted internet access.

## Production build

Run `npm run build`. GitHub Pages is deployed by the existing deployment
workflow from the `master` branch. The included `vercel.json` also makes the
same repository import-ready for Vercel, including the XStudio API function and
production security headers. Client navigation uses hash routes, so no catch-all
rewrite can intercept `/api` requests.

## Authentication and multitenancy

StackedIN uses Supabase Auth for email/password, Google, and GitHub sign-in.
The SQL migration in `supabase/migrations` adds profiles, workspaces, roles,
tenant-scoped articles, automatic personal-workspace creation, and Row Level
Security. Apply migrations in filename order. Profile journeys, inbox data,
and realtime notifications are introduced by migration `007`; XStudio imports
plus message edit/delete controls are introduced by migration `008`.

See [VERCEL_SUPABASE_SETUP.md](VERCEL_SUPABASE_SETUP.md) for the exact Vercel
environment variables, Supabase URL allow list, Google Client ID, GitHub OAuth
App, callback URL, and production verification steps.

## Professional graph roadmap

Phase 1 of the StackedIN Professional Knowledge Graph is defined in
`supabase/migrations/202608250002_professional_graph_foundation.sql`. It adds
professional profile intelligence, canonical skills/topics, tenant-scoped graph
relationships, first-class negative signals, recommendation logging, versioned
embeddings, ranking configuration, feature flags, search indexes, and hardened
RLS. See `docs/architecture/phase-1-professional-graph.md` for the design and
security boundaries.

Phase 2 adds explainable, negative-feedback-aware people recommendations and the
protected `#network` experience. Its migration is
`supabase/migrations/202608250003_people_recommendations_v1.sql`; implementation
details and the ranking formula are documented in
`docs/architecture/phase-2-people-recommendations.md`.

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` before
promoting a migration or application change.

## Private analytics import

View and share counts are not public feed data. Export a CSV from the relevant
platform and import it from **Analytics**. Recommended columns are `title`,
`views`, `shares`, and `url`. Imported values stay in browser storage and are
never committed.

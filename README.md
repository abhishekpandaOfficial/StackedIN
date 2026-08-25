# StackCraft Studio

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
dashboard. StackCraft Studio therefore links to the official LinkedIn profile
and publishing editor; the signed-in LinkedIn experience remains the source of
truth for LinkedIn posts and analytics.

## Local development

Run `npm ci`, then `npm run sync:offline`, followed by `npm run dev`.
Use `npm run sync:substack` when the machine has unrestricted internet access.

## Production build

Run `npm run build`. GitHub Pages is deployed by the existing deployment
workflow from the `master` branch. The included `vercel.json` also makes the
same repository import-ready for Vercel, including SPA fallback routing and
production security headers.

## Authentication and multitenancy

StackedIN uses Supabase Auth for email/password, Google, and GitHub sign-in.
The SQL migration in `supabase/migrations` adds profiles, workspaces, roles,
tenant-scoped articles, automatic personal-workspace creation, and Row Level
Security. Apply it before treating the product as multitenant in production.

See [VERCEL_SUPABASE_SETUP.md](VERCEL_SUPABASE_SETUP.md) for the exact Vercel
environment variables, Supabase URL allow list, Google Client ID, GitHub OAuth
App, callback URL, and production verification steps.

## Private analytics import

View and share counts are not public feed data. Export a CSV from the relevant
platform and import it from **Analytics**. Recommended columns are `title`,
`views`, `shares`, and `url`. Imported values stay in browser storage and are
never committed.

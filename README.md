# StackedIN + XStudio + CareerOS

StackedIN is evolving into an AI-native professional knowledge and career network. The existing publishing, professional graph, XStudio, feed, network, profile, and messaging features remain in place; CareerOS and AEON are being introduced as StackedIN Premium products.

## CareerOS V1

The `careeros-v1` branch adds the first CareerOS product slice:

- ThreeUI Kage-powered CareerOS landing experience;
- `/careeros` public landing and `/careeros/app` authenticated workspace routes;
- strict user-owned CareerOS records on top of the existing StackedIN tenant model;
- private career baseline: current role, compensation, experience, relocation, sponsorship, notice period, and work preference;
- private CV document vault;
- target-country priorities, salary floors, visa/sponsorship requirements, and target roles;
- Manual, Human-in-the-Loop, and Autonomous policy vocabulary with explicit autonomous consent;
- job, multidimensional match, workflow, application, append-only timeline, subscription, usage, and AEON data models;
- a 24-hour Career Audit trial model, with paid plan transitions reserved for a trusted payment backend;
- application history views and CareerOS/AEON foundation UI;
- CI validation for typecheck, tests, production Vite build, and ThreeUI Kage runtime assets.

Autonomous job discovery/application, Temporal, LangGraph, Azure workers, WhatsApp, payment webhooks, and the AEON interview runtime are intentionally not faked in the browser foundation. They will be connected through the trusted execution plane in subsequent CareerOS phases.

See `docs/architecture/careeros-v1.md` for privacy, consent, workflow, execution, and promotion boundaries.

## Existing StackedIN capabilities

- Tracks public Substack, Medium, and Hashnode posts in one searchable library.
- Opens official external publishing editors instead of collecting external platform passwords.
- Organises articles into content pillars, modules, tags, and structured series.
- Publishes native posts and rich-block articles directly to the StackedIN feed.
- Provides realtime reactions, comments, restacks, notifications, connection requests, and direct messages.
- Provides XStudio CMS, revisions, scheduling, recoverable Trash, content calendar, distribution queue, imports, and social publishing handoffs.
- Provides professional profile intelligence, search, recommendations, profile journeys, projects, education, achievements, and private inbox functionality.

## Local development

Run:

```bash
npm install
npm run sync:offline
npm run dev
```

For CareerOS validation:

```bash
npm run typecheck
npm test
npm run build
```

The CareerOS build copies the installed ThreeUI landing-page runtime assets into `public/landing-pages` before Vite builds the application.

Because ThreeUI changes the dependency graph, the feature branch CI regenerates a complete `package-lock.json`. That generated lock must be committed before merging so production installs can return to deterministic `npm ci` usage; do not hand-edit a partial npm lockfile.

## Authentication and multitenancy

StackedIN uses Supabase Auth for email/password, Google, and GitHub sign-in. Migration `001` creates personal tenants and memberships. Existing professional/network/XStudio migrations remain ordered in `supabase/migrations`.

CareerOS migration `202608290015_careeros_foundation.sql` is intentionally stricter than ordinary tenant collaboration: sensitive CareerOS rows require both tenant membership and exact `user_id = auth.uid()` ownership. Tenant administrators do not automatically gain access to another member's CV, salary, applications, workflows, usage, or AEON history.

The `career-documents` Supabase Storage bucket is private and user-path isolated.

## Production hosting direction

- **Vercel:** StackedIN/CareerOS web experience.
- **Supabase:** Auth, PostgreSQL, RLS, pgvector, private storage.
- **Azure execution plane (next phases):** FastAPI/worker services, Azure Container Apps, Service Bus, Key Vault.
- **Temporal:** durable long-running CareerOS workflows and approval waits.
- **LangGraph:** bounded agent reasoning inside workflow activities.
- **LiteLLM:** provider/model routing and cost control.
- **Langfuse + OpenTelemetry:** AI and platform observability.
- **WhatsApp Business Platform:** notifications and human approval interactions once connected server-side.

## Subscription direction

Initial India launch model:

- 24-hour Career Audit trial;
- ₹500/month StackedIN Premium;
- ₹5,000/year StackedIN Premium.

The database models these plans, but the browser cannot activate paid subscriptions. Paid transitions must be verified through a trusted payment webhook. Autonomous application remains unavailable during trial.

## Deployment

The repository is Vercel-ready through `vercel.json`, including clean SPA routes and security headers. Apply Supabase migrations in filename order before enabling the corresponding UI in production.

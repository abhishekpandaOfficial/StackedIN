# StackedIN: Vercel, Supabase and OAuth setup

The application is ready for both Vercel and GitHub Pages. Vercel builds at `/`; GitHub Actions builds at `/StackedIN/`. Authentication redirects are calculated from the current deployment, so the same source works on both hosts.

## 1. Create the Vercel deployment

1. In Vercel, choose **Add New → Project** and import `abhishekpandaOfficial/StackedIN`.
2. Keep **Framework Preset: Vite**, **Build Command: `npm run build`**, and **Output Directory: `dist`**.
3. In **Settings → Environment Variables**, add these for Production, Preview, and Development:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://salivpvqzbzuzbxzploo.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | The public anon/publishable key from Supabase **Project Settings → API Keys** |
| `VITE_PUBLIC_SITE_URL` | Your final production URL, for example `https://stackedin.vercel.app` |

4. Deploy. If you later add a custom domain, update `VITE_PUBLIC_SITE_URL`, redeploy, and add that exact domain to Supabase as described below.

Never add a Supabase `service_role` or secret key to a `VITE_` variable. Vite variables are public browser configuration. Tenant security is enforced by database Row Level Security (RLS), not by hiding the anon key.

For XStudio scheduled publishing, add these as **server-only Production variables**:

| Variable | Value |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key; never expose it to the browser |
| `CRON_SECRET` | A long random secret used by Vercel Cron as its bearer token |

After adding the variables, create a Vercel Cron for
`/api/publish-scheduled` at the frequency supported by your Vercel plan. The
endpoint rejects requests without `Authorization: Bearer $CRON_SECRET` and
calls only the service-role-protected `publish_due_articles()` database
function. The repository configures one daily Hobby-compatible execution at
`03:30 UTC` (`09:00 Asia/Kolkata`) in `vercel.json`.

## 2. Create the multitenant database

In Supabase, open **SQL Editor → New query**, paste the complete contents of:

every SQL file in `supabase/migrations` in filename order, from `001` through
`014`. Do not skip an earlier file. Migration `009` creates the XStudio CMS,
revision history, content schedule, and distribution queue. Migration `010`
adds recoverable article Trash and guarded restore operations. Migration `011`
adds the unified feed composer, mentions, social account metadata, polls, and
writing-signal scores.
Migration `013` adds canonical usernames, instant availability checks,
name-derived Google/GitHub handles, username profile URLs, and secure
email-or-username sign-in.
Migration `014` makes published public work globally readable while enforcing
author-only access to XStudio drafts, Trash, revisions, delivery jobs, and
security-definer CMS mutations.

Then choose **Run** once. It creates:

- professional profiles;
- personal and team workspaces (tenants);
- owner, admin, editor, and member roles;
- tenant-scoped articles;
- RLS policies that prevent cross-tenant draft access;
- a signup trigger that creates a personal workspace for every new account;
- a safe backfill for accounts that already exist.
- tenant-scoped XStudio drafts, SEO metadata, revisions, and delivery jobs;
- a backend-only scheduled-publishing function.
- soft-deleted articles that can be reviewed and restored safely as drafts.
- globally unique public usernames with private email-to-username login mapping.
- author-isolated XStudio content with a shared public publishing feed.

The public 45-post catalogue remains a global read-only discovery feed. New workspace-owned content belongs in `articles` with a `tenant_id`.

## AI writing assistance

Add this single server-only Vercel variable for the default StackedIN provider:

```text
SARVAM_API_KEY=YOUR_SARVAM_API_KEY
```

Do not prefix it with `VITE_`. The browser never receives it. XStudio uses
`sarvam-105b` by default. Members can optionally choose OpenAI or Anthropic,
paste their own key, test it, and select from the live models available to that
key. Personal keys are sent only to the authenticated server endpoint for model
testing and generation, retained in application memory for the current browser
session, and forgotten on page reload. They are never written to Supabase,
browser storage, source control, or Vercel.

The deterministic AI/human writing signal works without either provider key;
it is a probabilistic stylistic indicator, not proof of authorship.
Authenticated AI drafting is limited to 20 generations per member in a rolling
24-hour window before a paid quota system is introduced.

After migration `011`, also run
`supabase/migrations/202608250012_sarvam_default_ai.sql` once so the quota ledger
accepts the Sarvam provider.

See `SOCIAL_PUBLISHING_SETUP.md` for provider connection modes and official
setup links.

## 3. Configure Supabase URLs

Open **Supabase → Authentication → URL Configuration**.

- **Site URL:** your final Vercel production URL with a trailing slash, e.g. `https://stackedin.vercel.app/`
- **Redirect URLs:** add each exact production destination:
  - `https://YOUR-VERCEL-DOMAIN.vercel.app/`
  - `https://abhishekpandaofficial.github.io/StackedIN/`
  - your custom domain, if any, e.g. `https://stackedin.example.com/`
- For Vercel preview deployments, optionally add:
  - `https://*-YOUR-VERCEL-TEAM-OR-ACCOUNT.vercel.app/**`
- For local development, optionally add the exact local URL printed by the dev server, followed by `/**`.

Use exact production URLs. Reserve wildcards for preview and local environments.

## 4. Configure Google sign-in

1. Open the **Google Auth Platform** in Google Cloud and create or select a project.
2. Configure **Branding** with app name `StackedIN`, your support email, homepage, privacy URL, terms URL, and authorized domain.
3. Set **Audience** to **External** so anyone can register. While the app is in Testing, add test users; publish the app when ready for public sign-in.
4. Under **Data Access**, include only:
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
5. Open **Clients → Create client → Web application**.
6. Add **Authorized JavaScript origins** (origins have no trailing path):
   - `https://YOUR-VERCEL-DOMAIN.vercel.app`
   - `https://abhishekpandaofficial.github.io`
   - your custom-domain origin, if any
7. Add this one **Authorized redirect URI**:

   `https://salivpvqzbzuzbxzploo.supabase.co/auth/v1/callback`

8. Copy the Google Client ID and Client Secret.
9. Open **Supabase → Authentication → Sign In / Providers → Google**, enable it, paste both values, and save.

The Google callback is the Supabase callback, not the Vercel URL. Supabase completes provider authentication and then returns the user to an allowed StackedIN redirect URL.

## 5. Configure GitHub sign-in

1. Open **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Use:
   - **Application name:** `StackedIN`
   - **Homepage URL:** your final Vercel production URL
   - **Authorization callback URL:** `https://salivpvqzbzuzbxzploo.supabase.co/auth/v1/callback`
   - **Enable Device Flow:** off
3. Register the app, copy the Client ID, and generate a Client Secret.
4. Open **Supabase → Authentication → Sign In / Providers → GitHub**, enable it, paste both values, and save.

GitHub OAuth Apps accept a single callback URL, which is sufficient because Supabase uses the same callback for every allowed StackedIN deployment.

## 6. Production checks

1. Open the Vercel deployment in a private/incognito window.
2. Create an email/password account and confirm the email.
3. Sign out, then test Google and GitHub separately.
4. After sign-in, confirm the URL returns to the same Vercel deployment and opens `#feed`.
5. In Supabase **Table Editor**, confirm one `profiles` row, one `tenants` row, and one owner `tenant_memberships` row were created.
6. Create two test accounts. Confirm account A cannot select account B's draft articles. This verifies tenant isolation rather than only verifying the UI.
7. In XStudio, save a draft, restore a revision, schedule it a few minutes ahead,
   and confirm the Vercel Cron run changes it to `published` and creates a live
   StackedIN feed entry.
8. Confirm signup checks username availability before submission, then sign out
   and sign in using the username instead of the email address.
9. Open `/profile/YOUR_USERNAME`, edit the username, and confirm both the old
   handle and another account cannot claim the new one.

Username login uses the existing server-only `SUPABASE_SERVICE_ROLE_KEY` to
resolve a handle inside the RLS-protected `account_usernames` directory. The
browser receives only the normal Supabase session tokens after a successful
password exchange. Do not expose the service-role key through a `VITE_`
variable.

## 7. Custom domain later

When a custom domain is attached to Vercel:

1. Set it as `VITE_PUBLIC_SITE_URL` in Vercel and redeploy.
2. Make it the Supabase Site URL.
3. Add its exact trailing-slash URL to Supabase Redirect URLs.
4. Add its origin to Google Authorized JavaScript origins.
5. Update the GitHub OAuth App homepage. The GitHub callback remains unchanged.

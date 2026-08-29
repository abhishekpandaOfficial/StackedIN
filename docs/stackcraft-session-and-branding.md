# StackCraft session and branding contract

StackCraft is a premium product surface inside the existing StackedIN origin. It does not create a second authentication system.

## Authentication

- StackedIN and StackCraft import the same `supabase` singleton from `supabase.js`.
- Supabase browser auth uses `persistSession: true` and `autoRefreshToken: true`.
- `/Craft/app` therefore consumes the same persisted StackedIN session on `stackedin.vercel.app`.
- StackCraft must never instantiate a second Supabase client with a different storage namespace.

## Canonical routes

- `/Craft` — public StackCraft landing experience.
- `/Craft/app` — authenticated StackCraft dashboard.
- Legacy CareerOS URLs remain compatibility aliases.

## Branding

- `public/stackcraft-mark.svg` — primary square product mark.
- `public/stackcraft-wordmark.svg` — long-form StackCraft wordmark.
- `public/stackcraft-favicon.svg` — simplified route favicon.
- StackCraft routes switch the browser title and favicon without changing the StackedIN root favicon.

## Landing navigation

The StackedIN marketing header exposes both a `Craft` menu link and a prominent `Open StackCraft` product CTA. Because the marketing landing may render after asynchronous authentication initialization, the integration observes the React root and installs the controls when `.marketing-nav` becomes available rather than assuming it exists on first mount.

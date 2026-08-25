# Phase 1 — Professional Graph Foundation

## Architecture assessment

The existing product already provides Supabase Auth, one personal workspace per user, tenant memberships, tenant-scoped articles, and a protected React feed. Phase 1 extends those contracts rather than replacing them.

`profiles` remains the global professional identity keyed by `auth.users.id`. A user can belong to multiple workspaces through `tenant_memberships`. Every private graph edge, signal, configuration override, and enrichment job carries a `tenant_id`; public discovery is allowed only for active profiles that explicitly remain public, searchable, and recommendable.

The database—not the browser—decides whether an actor can use a profile in a tenant. Connection state transitions are exposed only through guarded PostgreSQL functions that resolve the actor from `auth.uid()`.

## Added in Phase 1

- Professional profile fields, privacy controls, quality signals, FTS document, and versioned embedding columns.
- Canonical hierarchical `skills` and `topics`, including aliases and vector-ready fields.
- Provenance-aware `profile_skills` and time-aware `profile_interests`.
- Connections, follows, blocks, and profile/topic mutes.
- Separate impression/action interaction ledger.
- Recommendation impression/outcome audit log with model and experiment versions.
- Profile intelligence and asynchronous embedding job foundations.
- Central database-backed ranking configurations and rollout feature flags.
- Article provenance, deterministic deduplication keys, FTS, and vector-ready fields.
- GIN, trigram, partial, composite, and HNSW indexes aligned to intended retrieval paths.
- RLS policies for profile privacy, tenant writes, participant-only relationships, private negative signals, and backend-only ranking/enrichment data.

## Security boundaries

- The frontend cannot insert or update connection rows directly.
- Connection RPCs derive the requester/addressee actor from the authenticated session.
- Self-connections, blocked relationships, duplicate active pairs, invalid profiles, and declined cooldowns are rejected in the database.
- Only the blocker can read a block row; only the muter can read a mute row.
- Users can record and read only their own behavioral interactions.
- Ranking features, embedding queues, and AI intelligence cannot be written by browser clients.
- Public profile reads exclude private, suspended, deleted, and non-searchable profiles.

## Migration

Apply migrations in filename order. The new migration is:

`supabase/migrations/202608250002_professional_graph_foundation.sql`

Apply it first to a Supabase branch or local environment. Run the pgTAP file in `supabase/tests` before production promotion.

## Deliberately pending

Phase 1 does not expose people recommendations or hybrid search yet. Their flags remain disabled until the corresponding database retrieval functions, APIs, UI, and calibration tests are delivered in Phases 2–4.

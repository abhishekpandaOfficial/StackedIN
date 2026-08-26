# Native Publishing & Realtime Professional Conversation

StackedIN is the canonical home for native professional posts and articles. XStudio is the external-source and distribution control plane inside StackedIN.

XStudio CMS stores portable `BLOCKS_V2` JSON rather than arbitrary HTML. It
supports text, headings, lists, checklists, callouts, quotations, code, images,
secure media links, tables, buttons, and dividers. Drafts remain tenant-private;
only published content enters the public feed. Manual saves create immutable
article revisions, while autosaves update the recovery state without flooding
revision history.

XStudio article deletion is recoverable. The Trash RPC archives the article,
cancels unpublished distribution jobs, records the actor and previous status,
and preserves its revisions. Restore always returns the article as a draft so
content never becomes public again without an explicit publication action.

Scheduled StackedIN publication runs through a service-role-only RPC. External
destinations remain `HANDOFF_READY` until a provider-approved OAuth/API
connector is configured; XStudio never collects external platform passwords or
pretends a handoff is an API publication.

## Content model

Native content is stored as `BLOCKS_V1` JSON, never arbitrary executable HTML. Supported blocks are paragraph, heading, subheading, quote, code, image, and divider. Rendering occurs through trusted React components, while the database validates block types and limits.

## Engagement model

- One active reaction per profile and article
- Six reactions: Like, Love, Celebrate, Insightful, Support, Curious
- Thread-ready comments with article-bound parent references
- Server-maintained reaction, comment, and share totals
- Realtime subscriptions for article, reaction, and discussion changes

## Security

- Article author identity is always resolved from `auth.uid()` by the publishing RPC.
- Workspace permissions are verified server-side.
- Public articles can receive cross-tenant professional discussion through guarded RPCs.
- Drafts remain workspace-scoped.
- Image uploads are restricted to the uploader's user-ID folder and safe image MIME types.
- External source metadata contains capabilities and sync state only—never provider passwords or OAuth tokens.

## External platforms

`publication_sources` models Substack, Medium, Hashnode, LinkedIn, and RSS connections. Public-feed import can run without credentials. Direct external publishing remains disabled until a provider offers an approved API/OAuth capability and its token is held in a server-side secret store such as Supabase Vault.

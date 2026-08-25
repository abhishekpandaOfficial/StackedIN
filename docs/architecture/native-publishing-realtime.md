# Native Publishing & Realtime Professional Conversation

StackedIN is the canonical home for native professional posts and articles. XStudio is the external-source and distribution control plane inside StackedIN.

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

# CareerOS V1 Architecture

CareerOS is a premium product inside StackedIN. It reuses the existing StackedIN identity and tenant model, but career data is more private than ordinary tenant content: salary, CVs, country targets, applications, workflow runs, usage, and AEON interview history are readable only by the exact authenticated user that owns each row.

## Product boundary

V1 establishes the secure data plane and user experience for:

- candidate career profile and verified career policy;
- private master CV and generated document metadata;
- target countries, salary floors, sponsorship and relocation requirements;
- target roles and evidence-backed skills;
- Manual, Human-in-the-Loop, and Autonomous agent policy modes;
- job normalization and multidimensional job-match records;
- application records plus append-only dated application events;
- 24-hour Career Audit, monthly and annual subscription vocabulary;
- usage/cost metering records;
- versioned visual workflow definitions and durable execution references;
- AEON private interview/readiness sessions.

Job discovery, Temporal execution, LangGraph reasoning, WhatsApp delivery, paid billing transitions, and external application submission are execution-plane capabilities and are intentionally not simulated by the browser client in this foundation slice.

## Privacy model

All sensitive CareerOS rows carry both `tenant_id` and `user_id`. RLS requires:

```sql
user_id = auth.uid() and public.is_tenant_member(tenant_id)
```

This is deliberately stricter than a normal team workspace. A future university, recruiter, or enterprise tenant administrator does not automatically receive access to an individual member's private career records.

The `career-documents` Supabase Storage bucket is private. Object paths begin with the authenticated user's UUID and storage RLS checks that first path segment before read/upload/delete.

Secrets and job-site credentials do not belong in CareerOS browser tables. OAuth refresh tokens, application-site credentials, WhatsApp secrets, LLM keys, payment secrets, and execution credentials must live in the trusted server execution plane / secret store.

## Consent model

CareerOS records versioned consent events for profile accuracy, document generation, autonomous application, WhatsApp, terms, and privacy.

Autonomous application is never inferred from a generic terms acceptance. It requires a dedicated explicit authorization. During the 24-hour trial, Autonomous mode is disabled in the UI and no automatic application submission capability is exposed.

## Application history

`career_applications` stores current application state. `career_application_events` is the append-only timeline for discovery/preparation/approval/submission/recruiter/interview/offer/rejection events. Daily, weekly, monthly, and all-time analytics should be derived from this event ledger rather than rewriting historical rows.

## Workflow architecture

The browser stores a versioned domain workflow DAG in `career_workflows.definition`.

Planned production flow:

```text
CareerOS visual DAG
        ↓
Workflow validation/compiler
        ↓
Temporal durable workflow
        ↓
Activities / queues
        ↓
LangGraph reasoning subgraphs
        ↓
LLM gateway + tools
        ↓
Policy/consent gate
        ↓
Manual / HITL / supported autonomous action
```

Temporal owns retries, timers, waiting for approvals, long-running state, and resumability. LangGraph owns agent reasoning inside bounded activities. The LLM is never the authority for deterministic authorization, subscription entitlement, tenant access, hard visa rules, or consent.

## Execution plane target

The planned always-on production execution plane is Azure-hosted:

- FastAPI API / worker services;
- Azure Container Apps and scheduled/event-driven jobs;
- Temporal workers;
- LangGraph agents;
- Azure Service Bus for asynchronous integration where useful;
- Redis for bounded cache/locks/rate limiting;
- LiteLLM for provider routing;
- Langfuse for LLM/agent traces;
- OpenTelemetry for service telemetry;
- Azure Key Vault for server secrets.

The existing Vercel deployment remains the StackedIN/CareerOS web experience. Supabase remains Auth + PostgreSQL + RLS + pgvector + private document storage.

## Subscription boundary

The database recognizes `TRIAL`, `MONTHLY`, and `ANNUAL`. The initial India price book discussed for launch is ₹500/month and ₹5,000/year. The browser can create only a zero-price `TRIAL`; paid plan activation must come from a verified server-side payment webhook.

Usage events are server-generated and support feature quota and model-cost accounting. This is required so a low-cost subscription cannot trigger unbounded premium-model, browser, or messaging spend.

## AEON

AEON is an Interview Agent OS inside the same private candidate identity. `aeon_sessions` stores readiness and interview-session state. AEON will later consume the exact application, job description, submitted CV version, candidate evidence, interview stage, and prior performance. It should feed outcome/skill-confidence signals back into CareerOS without changing verified CV evidence.

## Promotion checklist

Before merging to production:

1. Apply migration 015 to a non-production Supabase project and run RLS isolation tests with two independent users.
2. Run typecheck, unit tests, and production Vite build.
3. Verify ThreeUI Kage runtime assets and interactions.
4. Verify direct `/careeros` and `/careeros/app` Vercel routes.
5. Verify unauthenticated workspace access redirects to StackedIN sign-in.
6. Verify one user cannot select another user's CareerOS rows or objects.
7. Verify trial cannot enable Autonomous mode or paid entitlements.
8. Verify CV objects are private and signed/public URLs are not persisted accidentally.

# Phase 2 — People Recommendations V1

## Delivered vertical slice

Signed-in users can open `#network` and request up to 8 focused professional recommendations. PostgreSQL performs candidate eligibility, feature calculation, configurable weighted ranking, fatigue penalties, qualitative labeling, and structured explanation generation.

## Candidate filters

Candidates are excluded before ranking when they are:

- the signed-in user;
- blocked in either direction;
- muted by the viewer;
- already connected or part of a pending request;
- in a declined-request cooldown;
- dismissed or marked not relevant during the cooldown window;
- private, non-searchable, non-recommendable, suspended, or deleted;
- shown eight ignored times inside the fatigue window.

## V1 ranking

Positive features use the active `PEOPLE` row in `ranking_configs`:

- professional role/headline similarity — 20%;
- shared skills — 15%;
- shared topics — 14%;
- mutual connections — 12%;
- embedding/content similarity — 10%;
- career-stage relevance — 8%;
- company overlap — 6%;
- community overlap — 4% (reserved, currently zero);
- location relevance — 3%;
- profile/network quality — 3%;
- freshness — 3%;
- controlled exploration — 2%.

Ignored impressions apply an increasing repetition penalty. Explicit dismissals and “not relevant” outcomes temporarily remove the candidate instead of merely nudging the score.

The UI displays `Strong match`, `Relevant`, or `Suggested`, not a misleading pseudo-precise percentage.

## Explainability

Reasons are generated only from computed features. Examples include shared skill count, shared professional topics, mutual connections, related professional focus, career stage, location, and embedding similarity. No LLM runs during page load, so explanations cannot hallucinate.

## Security

- Retrieval requires an authenticated user who belongs to the requested tenant.
- The viewer identity always comes from `auth.uid()`.
- Browser clients cannot insert recommendation audit rows directly.
- Impression and outcome RPCs write only for the authenticated viewer.
- Connection requests continue through the Phase 1 guarded state-transition RPC.

## Application behavior before migration

The React route ships safely before database promotion. If the Phase 2 migration has not been applied, `/network` shows a clear migration-pending state instead of crashing or inventing recommendations.

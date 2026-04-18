# Phase 56: Jobber read-side integration (customer context) — Context

**Gathered:** 2026-04-18
**Status:** Ready for UI-SPEC delta (Jobber card gains real Connect/Disconnect + error states, same shape as Xero), then planning.

<domain>
## Phase Boundary

Apply the Phase 55 Xero integration pattern to Jobber, plus the Jobber-specific merge semantics that REQ JOBBER-04 / JOBBER-05 require. Deliver in one phase:

1. **Real `fetchCustomerByPhone(tenantId, phone)`** in `src/lib/integrations/jobber.js` — returns `{ client, recentJobs, outstandingInvoices, lastVisitDate }` from Jobber GraphQL via `graphql-request`, behind `'use cache'` + two-tier `cacheTag` with 5-min `cacheLife`. Phone match against `Client.phones[].number` with E.164 normalization on our side (Jobber stores phones free-form).
2. **Live OAuth end-to-end** at `/api/integrations/jobber/{auth,callback}` — Phase 54 scaffolded `getAuthUrl`; P56 wires real `exchangeCode`, `refreshToken`, and `revoke` per Jobber OAuth (scopes configured in Jobber Developer Center UI, NOT passed as `scope=` param). Disconnect revokes at Jobber + deletes row + invalidates tenant-wide cache tag.
3. **`/api/webhooks/jobber` endpoint** — HMAC verification via Jobber's per-app signing key, handles Jobber's webhook subscription verification handshake, subscribes to **CLIENT_UPDATE + JOB_UPDATE + INVOICE_UPDATE + VISIT_COMPLETE + VISIT_UPDATE**, resolves event → phone → `revalidateTag('jobber-context-${tenantId}-${phoneE164}')`; falls back to broad tenant tag when phone resolution fails. Silent-ignore for unknown tenants to prevent retry storms.
4. **Business Integrations frontend wiring** — Phase 54's `BusinessIntegrationsClient.jsx` Jobber card gets the same error-state treatment as Xero (P55 D-14/D-15): Reconnect-needed banner on token refresh failure, subtle `last_context_fetch_at` timestamp when connected, Resend email to owner on refresh failure. Existing Connect/Disconnect scaffolding + invoicing-flag confirm-connect dialog stays.
5. **`connect_jobber` setup checklist item** — `/api/setup-checklist` response gains `connect_jobber`, completion auto-detected by `accounting_credentials` row with `provider='jobber'`. Same pattern as P55 D-12.
6. **Python agent Jobber hookup** (agent lives in **separate repo** at `C:/Users/leheh/.Projects/livekit-agent/` / GitHub `lerboi/livekit_agent` — NOT in this monorepo) —
   - New `src/integrations/jobber.py` — service-role Supabase reads `accounting_credentials` row, direct Jobber GraphQL fetch with refresh-aware token handling, returns same shape as Next.js adapter.
   - `_run_db_queries` in `agent.py:316` gains a **fifth** parallel task `jobber_context_task` (P55 added `xero_context_task` as the fourth) with **800ms timeout**, same silent-skip-on-timeout semantics.
   - **Unified `customer_context` via field-level merge** — new helper merges Jobber + Xero results field-by-field: Jobber wins on `client` / `recentJobs` / `lastVisitDate`; Xero wins on `outstandingBalance` / `lastPaymentDate`. Single merged STATE block injected into the prompt pre-session.
   - **Extended `check_customer_account()` tool** — re-serves the merged STATE + DIRECTIVE on demand. Tool registered in P55; P56 extends its internal data source, not its registration.
7. **Token-refresh failure surfacing** — identical to P55 D-14: persist `error_state` on `accounting_credentials`, send Resend email to tenant owner, render Reconnect-needed banner on next card visit with Reconnect as primary action and Disconnect kept as secondary text-link.
8. **Telemetry seed** — every successful fetch updates `accounting_credentials.last_context_fetch_at` for the Jobber row. Deeper telemetry lands in P58.

Explicitly **out of scope** (hard boundaries):

- **No Jobber schedule mirror.** P57 owns writing Jobber visits into `calendar_events`. P56 subscribes to VISIT webhooks ONLY for customer-context cache invalidation; the `calendar_events` write path stays 501-stubbed until P57.
- **No multi-Jobber-account picker.** Jobber OAuth authorizes against a single account per token; if an owner has multiple Jobber accounts, the first authorized wins. Multi-account support is a deferred idea.
- **No Jobber rate-limit back-off layer.** Jobber's GraphQL allows 2500 requests per 5 minutes per app; cache absorbs the bulk. Revisit in P58 if real throttling surfaces.
- **No deep telemetry UI.** Match rate, duration histograms, cache-hit rate land in P58 (CTX-01).
- **No LiveKit agent framework changes.** One new parallel task + one merge helper + extension of an existing tool — no changes to `AgentSession`, `VocoAgent`, SIP handling, post-call pipeline, or SDK pins.
- **No Jobber-side data writes.** P35's invoice push remains gated behind the invoicing flag (P53). P56 is strictly read-side.
- **No contact-creation-on-caller-match.** If a caller's phone matches no Jobber client, `customer_context` is merged with whatever Xero returns (may still produce a non-empty block) or omitted if neither matches.
- **No changes to `accounting_credentials` schema.** Migration 052 (P54) shipped the `provider='jobber'` CHECK extension, `scopes TEXT[]`, `last_context_fetch_at TIMESTAMPTZ`. Any P56 migration starts at **054** (053 is P55's `error_state`).
- **No cross-provider client deduplication UI.** When Jobber and Xero both match the same caller phone, field-level merge produces one STATE block — that's the only deduplication. No owner-facing "these are the same person" reconciliation tool.
- **No restructure of Phase 55 code.** P56 extends `customer_context` assembly from "Xero-only" to "Jobber + Xero merged," but the prompt block shape, CRITICAL RULE framing, tool return shape, and DIRECTIVE all carry forward unchanged.

</domain>

<decisions>
## Implementation Decisions

### Carried forward from Phase 55 (locked — not re-decided)

These Phase 55 decisions apply to Phase 56 verbatim; downstream agents must treat them as locked:

- **P55 D-01 (E.164 exact match, no normalization fallback)** — applies to both providers; P56 adds server-side normalization of Jobber's free-form phone strings before the match.
- **P55 D-04 (800ms fetch timeout, silent skip on failure, Sentry capture)** — applies to the new `jobber_context_task`.
- **P55 D-05 (two-tier cacheTag)** — P56 uses `jobber-context-${tenantId}` broad + `jobber-context-${tenantId}-${phoneE164}` specific. Exact same shape as Xero's tags.
- **P55 D-07 (single app-level webhook secret, HMAC-SHA256 verify raw body, 200 on good signature even for unknown tenants)** — P56 uses `JOBBER_WEBHOOK_SECRET` env var.
- **P55 D-08 (pre-session prompt block + tool re-serve — not post-greeting injection)** — the merged `customer_context` block is awaited before `session.start()`.
- **P55 D-09 (tool returns STATE + DIRECTIVE, not speakable English)** — `check_customer_account()` tool return keeps this shape; P56 only extends the data source.
- **P55 D-10 (silent awareness privacy rule — never volunteer, answer factually ONLY when caller explicitly asks)** — applies to all Jobber fields identically. Reuse verbatim phrasing from `check_caller_history.py:107-117`.
- **P55 D-11 (omit `customer_context` on no-match; uniform behavior for disconnected provider)** — when BOTH providers miss, block is omitted entirely. When one matches and the other misses, the matched provider's fields populate; missed provider's fields are omitted from STATE (not shown as null).
- **P55 D-12 (checklist item auto-detected by `accounting_credentials` row presence)** — `connect_jobber` uses identical detection logic with `provider='jobber'` filter.
- **P55 D-13 (Disconnect = revoke + delete row + `revalidateTag`)** — identical for Jobber; reuse the existing `BusinessIntegrationsClient.jsx` AlertDialog copy (`PROVIDER_META.jobber.dialogTitle` + `dialogBody`).
- **P55 D-14 (Token-refresh failure → BOTH banner + Resend email; Reconnect primary, Disconnect kept as secondary text-link)** — identical surface for Jobber.
- **P55 D-15 (Card content states: connected / error / disconnected)** — identical treatment for the Jobber card.

### Area A — Caller-context fetch shape (Jobber-specific)

- **D-01 (Phone matching + E.164 normalization):** Match caller `from_number` (already E.164) against `Client.phones[].number` after normalizing Jobber's free-form phone strings to E.164 via `libphonenumber` server-side during the GraphQL result filter. Jobber does NOT store phones in E.164 — `"(555) 123-4567"`, `"555-1234"`, `"+1 555 123 4567"` are all valid in the `number` field. Strategy: use Jobber's `clients(filter: {phoneNumber: ...})` server-side filter if available (broad match), then apply client-side E.164 normalization + exact comparison for the final match. Miss rate acceptable because fallback is empty Jobber half of `customer_context` (Xero half may still populate; if both miss, block is omitted per P55 D-11).

- **D-02 (`recentJobs` shape — no pre-bucketing):** Return up to **4 jobs**, each with fields:
  ```
  {
    jobNumber: "JBN-204",
    title: "AC install",
    status: "upcoming" | "today" | "action_required" | "late" | "on_hold" | "unscheduled" | "requires_invoicing" | "archived",
    startAt: ISO date | null,
    endAt: ISO date | null,
    nextVisitDate: ISO date | null
  }
  ```
  Sort: `[nextVisitDate ASC where nextVisitDate >= now(), then updatedAt DESC]`. Upcoming visits surface first; within "no future visit" jobs, most recently updated wins. **Do NOT pre-bucket into "active"/"completed" categories in our code** — emit the `status` field verbatim and let the prompt + model interpret. This avoids hardcoding Jobber's status taxonomy in our adapter and lets the agent see everything.

- **D-03 (`outstandingInvoices` shape):** Return the **sum across invoices with `invoiceStatus` in `{AWAITING_PAYMENT, BAD_DEBT, PARTIAL, PAST_DUE}`** as `outstandingBalance` (single number), plus an array of up to 3 invoices with `{invoiceNumber, issuedAt, amount, amountOutstanding, status}` for reference. `DRAFT`, `PAID`, `VOIDED` excluded. Kept parallel to P55 D-02/D-03 so the merge helper reads from equivalent shapes.

- **D-04 (`lastVisitDate` source):** Derive from the most recent `Visit.endAt` across all visits for the matched client where `Visit.completedAt IS NOT NULL`. If Jobber's schema exposes `Client.visits(last: 1, filter: {completed: true})`, use that directly; otherwise pull from `Job.visits` edges in the same query that fetches `recentJobs`. Planner confirms exact GraphQL path during research.

- **D-05 (GraphQL client choice):** Use `graphql-request` on the Next.js side (already specified in ROADMAP P56 scope). Lightweight, no bundle bloat, works inside `'use cache'` function. Python side uses `httpx` + hand-rolled GraphQL POST (avoid adding `gql`/`graphql-core` dep to livekit-agent).

- **D-06 (Fetch timeout — Python side):** `jobber_context_task` runs in parallel with `xero_context_task` via `asyncio.gather(..., return_exceptions=True)`. Both race against an 800ms individual timeout; the **overall `_run_db_queries` budget stays at 2.5s** (P55 XERO-04) — the two integration fetches run concurrently, not serially, so adding Jobber does NOT extend the budget.

### Area B — Unified `customer_context` via field-level merge

- **D-07 (Field-level merge strategy — Jobber preferred for operations, Xero preferred for payments):**
  The single `customer_context` STATE block is assembled by merging Jobber and Xero fetch results field by field, with source annotations:

  | Field | Winner when both present | Fallback when winner missing |
  |-------|-------------------------|------------------------------|
  | `client` (name, email) | Jobber | Xero |
  | `recentJobs[]` | Jobber | (Xero has no jobs concept — omit) |
  | `lastVisitDate` | Jobber | (Xero has no visits — omit) |
  | `outstandingBalance` | Xero | Jobber |
  | `lastPaymentDate` | Xero | Jobber |
  | `lastInvoices[]` (reference detail) | Xero | Jobber |

  **Rationale:** Jobber is the source of truth for home-service *operations* (clients, jobs, visits). Xero is the source of truth for *payment reconciliation* (bank feeds clear payments in Xero that may not yet have propagated back through Jobber's nightly sync). Field-level merge produces a single authoritative value per field — no reconciliation ambiguity in the prompt, which is the only anti-hallucination defense the LiveKit philosophy permits.

  **Rejected alternatives:**
  - *Jobber-only-in-prompt + tool-merges Xero on-demand:* creates a mid-call "discovery" surface where the agent learns facts not in its initial prompt — unpredictable, invites fabricated reconciliation.
  - *Dual provider blocks in prompt ("Jobber:" then "Xero:"):* two overlapping STATE surfaces with potentially divergent figures (Jobber $500 outstanding, Xero $0 after reconciliation) — Gemini will speak one of them fluently and wrongly. Cannot prompt your way out of a data-layer ambiguity.

- **D-08 (Source annotations in STATE):** Every merged field carries a `(source)` suffix (`(Jobber)`, `(Xero)`, or `(Jobber + Xero)` when the fallback collapsed). This is **not speakable English** — it's a provenance marker for the model's STATE awareness. Per the LiveKit philosophy, this gives Gemini source-aware context without inviting recitation.

- **D-09 (Unified `customer_context` prompt block — locked shape):**
  ```
  CRITICAL RULE — CUSTOMER CONTEXT:
  The fields below come from the tenant's CRM/accounting systems. Do not speak
  specific figures, invoice numbers, job numbers, visit dates, or amounts
  unless the caller explicitly asks about their account, bill, or recent work.
  Never volunteer. Never say "confirmed," "on file," or "verified" tied to
  these fields. If asked "do you have my info?" acknowledge presence without
  specifics.

  STATE:
  client=<name> (<source>)
  recent_jobs=
    - <jobNumber> "<title>" status=<status> next_visit=<date?> completed=<date?>
    - ...
  last_visit=<date> (<source>)
  outstanding_balance=<amount> across <N> invoices (<source>)
  last_payment=<date> (<source>)

  DIRECTIVE: Treat as a returning customer. Use the name only if the caller
  self-identifies. Do not reference specific figures unless explicitly asked.
  If asked about balance, bill, or recent work, answer factually from STATE only
  then.
  ```
  Inserted near the top of the system prompt with the same positioning as P55's anti-hallucination block. Framed as CRITICAL RULE per the LiveKit philosophy (long-context audio attention drops rules buried deeper in the prompt).

- **D-10 (`check_customer_account()` tool return — STATE + DIRECTIVE, not speakable):**
  Tool re-serves the same merged data on demand — no re-fetch, no extra GraphQL/Xero round-trip. Return shape matches the prompt block's STATE + DIRECTIVE format:
  ```
  STATE: client=John Smith (Jobber); recent_jobs=[JBN-204 "AC install" status=upcoming next_visit=2026-04-20, JBN-198 "Water heater repair" status=archived completed=2026-04-15]; last_visit=2026-04-15 (Jobber); outstanding_balance=$847.25 across 2 invoices (Xero); last_payment=2026-03-15 (Xero).
  DIRECTIVE: Answer factually only if the caller explicitly asks about their balance, bill, or recent work. Do not read invoice numbers unless asked. Do not volunteer figures.
  ```
  No speakable sentences. Forces the model to translate rather than recite.

- **D-11 (No-match behavior — unified across providers):**
  - Both providers miss → entire `customer_context` block omitted (P55 D-11 behavior).
  - Jobber matches, Xero misses → block populates Jobber fields; Xero fields omitted from STATE (not rendered as null).
  - Jobber misses, Xero matches → block populates Xero fields; Jobber fields omitted from STATE.
  - Tool-side no-match: if `check_customer_account()` is invoked when neither provider matched, returns:
    ```
    STATE: no_customer_match_for_phone.
    DIRECTIVE: Treat as new or walk-in customer. Do not claim to have any records on file.
    ```

### Area C — Webhook invalidation (Jobber-specific)

- **D-12 (Webhook subscription scope — 5 event types):** Subscribe to `CLIENT_UPDATE`, `JOB_UPDATE`, `INVOICE_UPDATE`, `VISIT_COMPLETE`, `VISIT_UPDATE` at webhook registration time (during OAuth callback or via a separate Jobber API call — planner decides).

  Rationale:
  - `CLIENT_UPDATE`: phone/name changes → must invalidate the specific-phone tag (or broad tag if phone changed).
  - `JOB_UPDATE`: status transitions + visit mutations (Jobber typically bumps `Job.updatedAt` when child Visit changes, but not guaranteed for every visit field).
  - `INVOICE_UPDATE`: drives `outstandingInvoices` freshness.
  - `VISIT_COMPLETE` + `VISIT_UPDATE`: closes the staleness window on `lastVisitDate` at the source. The prompt cannot self-correct a stale date — Gemini will speak whatever's in STATE. Subscribing at P56 level (rather than deferring to P57) means `lastVisitDate` is fresh within seconds of a visit completing, not 5 minutes. P57 extends the **same handler** to also write visits into `calendar_events` — no second endpoint, no second HMAC key.

- **D-13 (Webhook → cache invalidation path):** Parse event → extract `clientId` → GET client via Jobber GraphQL → extract `client.phones[].number` → normalize to E.164 → for each phone, `revalidateTag('jobber-context-${tenantId}-${phoneE164}')`. If client has no phones or lookup fails, fall back to `revalidateTag('jobber-context-${tenantId}')`. The extra Jobber round-trip lives on the webhook path, NOT the call hot path.

- **D-14 (Webhook auth + unknown-tenant handling):** Single app-level `JOBBER_WEBHOOK_SECRET` env var (Jobber assigns at app level, not per-tenant). Verify HMAC-SHA256 on raw body against Jobber's signature header; return 401 on bad signature; return 200 on good signature even when the payload's Jobber account ID doesn't map to any connected `accounting_credentials` row (silent-ignore to prevent Jobber retry storms). Handles Jobber's subscription-verification handshake on initial registration.

- **D-15 (Webhook idempotency):** Planner's discretion whether to dedup via a small `jobber_webhook_events` table (pattern from P55's potential `xero_webhook_events`) or trust Jobber delivery semantics + rely on `revalidateTag` idempotency. Low-stakes decision since `revalidateTag` is idempotent; add the dedup table only if duplicate webhook processing causes observable latency.

### Area D — Scope handling across P56 / P57 boundary

- **D-16 (VISIT subscription lives in P56's webhook handler; P57 extends same handler):** The `/api/webhooks/jobber` endpoint is authored in P56 with all 5 subscriptions active. P57 modifies the VISIT event branch to additionally write to `calendar_events` — the signature verification, HMAC key, tenant resolution, and cache invalidation logic are already in place. P57 does NOT create a second webhook endpoint.

### Claude's Discretion

- **Exact GraphQL query shape** — fields, edge counts, pagination. Planner designs the query during research against Jobber's GraphQL schema docs. Budget: single query per fetch (batch client + recentJobs + outstandingInvoices + lastVisitDate in one round-trip).
- **`libphonenumber` package choice on Next.js side** — `libphonenumber-js` (smaller, no dep on Google's full metadata) vs `google-libphonenumber` (canonical). Planner picks based on bundle impact.
- **Python-side phone normalization** — `phonenumbers` package (Python port) or hand-rolled normalization using `src/lib/phone.py`'s existing `_normalize_phone`. Reuse preferred if it handles the formats Jobber emits.
- **Webhook subscription registration mechanism** — Jobber exposes webhook registration via a separate GraphQL mutation or dashboard UI. Planner decides whether to register programmatically on OAuth callback (auto) or require owner to register via Jobber's UI (manual). Auto-registration preferred if Jobber's API supports it with our OAuth scopes.
- **Refresh-token write-back path (Python side)** — service-role UPDATE on `accounting_credentials` with `eq('tenant_id', tenantId).eq('provider', 'jobber')`. Identical pattern to P55.
- **`error_state` column reuse** — if P55 added a dedicated `error_state` column in migration 053, P56 reuses it with no schema change. If P55 used a JSONB flag, P56 extends the same JSONB. Planner confirms by reading the actual P55 migration.
- **Ordering of `recentInvoices` in the reference array** — newest-first by `issuedAt` vs `updatedAt`. Planner picks.
- **Source annotation format in STATE** — `(Jobber)`, `(Xero)`, `(Jobber+Xero)` as locked; exact punctuation (`(J)` vs `(Jobber)`) is planner's call for prompt-token economy.
- **Where the merge helper lives on the Python side** — `src/lib/customer_context.py` (new) vs inline in `agent.py`'s `_run_db_queries`. Prefer a named helper for testability; planner confirms path.
- **Jobber rate-limit degradation** — on 429 from Jobber during webhook re-fetch, fall back to broad-tag invalidation (P55 pattern). Tuning of retry/back-off deferred.

### Folded Todos

None. STATE.md's only Jobber-adjacent pending item is the external "register Jobber dev app" user action (blocks execution, not planning/context).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + Scope
- `.planning/REQUIREMENTS.md` lines 38-42 — JOBBER-01 through JOBBER-05 (authoritative requirement text)
- `.planning/ROADMAP.md` line 198 — Phase 56 checklist entry
- `.planning/ROADMAP.md` lines 267-272 — Phase 56 detailed section (Goal, Depends on, Requirements, Pre-req user actions)
- `.planning/ROADMAP.md` lines 204-212 — v6.0 Key Decisions

### Prior Phase Context (LOCKED decisions to carry forward)
- `.planning/phases/55-xero-read-side-integration-caller-context/55-CONTEXT.md` — **primary source of carried-forward decisions**. D-01, D-04, D-05, D-07, D-08, D-09, D-10, D-11, D-12, D-13, D-14, D-15 all apply to P56 verbatim. Read BEFORE making any Jobber-side implementation choice; only deviate when Jobber's data model or API forces it.
- `.planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-CONTEXT.md` — P54 locks: unified OAuth scope bundle (Jobber's are configured in Developer Center UI, not passed as `scope=`), `/api/integrations/**` canonical routes, `src/lib/integrations/jobber.js` location, cache/revalidate loop shape, Migration 052 schema.
- `.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-CONTEXT.md` — invoicing flag context. P56's `/api/integrations/**` routes + `/api/webhooks/jobber` are NOT gated by the invoicing flag (customer-context is valuable regardless).

### User Preferences & Critical Rules (MUST read before Area B implementation)
- `memory/feedback_livekit_prompt_philosophy.md` — **REQUIRED reading before touching `prompt.py`, the merge helper, or `check_customer_account()` tool returns.** Codifies: outcome-based conversational guidance, directive framing for truth claims, anti-hallucination CRITICAL RULE positioning near prompt top, STATE + DIRECTIVE tool-return shape (not speakable English), SDK pin (`livekit-agents==1.5.1` + `livekit-plugins-google@43d3734`), persona preservation. D-07/D-08/D-09/D-10 are direct applications of this philosophy — field-level merge is the only option compatible with the anti-hallucination constraint.

### Architectural Skills (read before implementing, update after)
- `voice-call-architecture` — Python agent entry flow, `_run_db_queries` parallelization pattern, 4-task shape (P55 added the 4th task as `xero_context_task`; P56 adds the 5th as `jobber_context_task`), existing `check_customer_account` tool (P56 extends its data source). **Must update** after P56 lands (Jobber integration module, merge helper, updated tool behavior).
- `auth-database-multitenancy` — service-role Supabase reads from Python, RLS on `accounting_credentials`, `getTenantId()` on Next.js side, Migration 052 schema (`provider='jobber'` CHECK already extended in P54).
- `dashboard-crm-system` — `/dashboard/more/*` page conventions, BusinessIntegrationsClient card patterns, AlertDialog usage, banner treatments. **Must update** after P56 lands if Jobber card gains new states (should match Xero card exactly).
- `payment-architecture` — reference for webhook handler shape (signature verification, raw-body handling, idempotency pattern, 200-OK-on-ignore).
- `nextjs-16-complete-guide` — `'use cache'` directive placement, `cacheTag` + `revalidateTag` patterns, `cacheLife` for the 5-min TTL.
- `onboarding-flow` — `/api/setup-checklist` response shape + completion-detection conventions (for the `connect_jobber` item).

### External Docs (research phase)
- Jobber Developer Center — OAuth 2.0 flow, scopes UI (`developer.getjobber.com`), token refresh, app registration.
- Jobber GraphQL API — schema for `Client`, `Job`, `Visit`, `Invoice` types; `clients` query with phone filter; status enum values; field availability.
- Jobber Webhooks docs — subscription verification handshake, HMAC signature spec, event type catalogue (`CLIENT_UPDATE`, `JOB_UPDATE`, `INVOICE_UPDATE`, `VISIT_COMPLETE`, `VISIT_UPDATE`), delivery retry semantics, programmatic registration mutation (if available).
- Jobber API rate limits reference — 2500 requests per 5 minutes per app (shapes webhook handler's re-fetch strategy under D-13).

### Existing Code Worth Reading
- **Next.js side:**
  - `src/lib/integrations/jobber.js` — P54 stub with `getAuthUrl` scaffold; P56 wires real `exchangeCode`, `refreshToken`, `revoke`, `fetchCustomerByPhone` (GraphQL).
  - `src/lib/integrations/xero.js` — **P55 reference implementation.** Treat as the canonical template; Jobber adapter should mirror its shape, method signatures, and caching pattern modulo the SDK (graphql-request vs xero-node).
  - `src/lib/integrations/status.js` — P54 cache-tag pattern.
  - `src/lib/integrations/types.js` — shared `IntegrationAdapter` interface.
  - `src/app/api/integrations/[provider]/auth/route.js` — P54 scaffold; P56 wires for Jobber.
  - `src/app/api/integrations/[provider]/callback/route.js` — P54 scaffold; P56 wires for Jobber + upsert on `accounting_credentials`.
  - `src/app/api/integrations/disconnect/route.js` — P55 added Xero revoke; P56 adds Jobber revoke branch.
  - `src/app/api/webhooks/xero/route.js` — **P55 reference handler.** P56's `/api/webhooks/jobber/route.js` mirrors its shape.
  - `src/app/api/setup-checklist/route.js` — pattern for adding `connect_jobber` row.
  - `src/components/dashboard/BusinessIntegrationsClient.jsx` — already renders BOTH Xero + Jobber cards inline via `PROVIDER_META` map (P54 shipped). P56 extends the Jobber half's error-state handling to match Xero's (shipped in P55).
  - `src/lib/notifications.js` — `getResendClient()` for token-refresh-failure email.
- **Python side — SEPARATE REPO** (`lerboi/livekit_agent` at `C:/Users/leheh/.Projects/livekit-agent/`, NOT in this monorepo):
  - `src/agent.py:316-401` — `_run_db_queries`; P55 added `xero_context_task`; P56 adds `jobber_context_task` as the 5th task + awaits both before passing the merged result to `build_system_prompt`.
  - `src/integrations/xero.py` — **P55 reference.** `src/integrations/jobber.py` mirrors its shape (service-role Supabase read + direct API fetch + refresh + write-back).
  - `src/prompt.py` — `build_system_prompt`; P55 inserted Xero-only `customer_context` block; P56 updates the block to accept the merged dict and render source annotations per D-08/D-09.
  - `src/tools/check_customer_account.py` — P55 created this; P56 extends its internal data source to the merged dict (registration + factory unchanged).
  - `src/tools/__init__.py` — P55 registered `check_customer_account`; P56 no change here.
  - `src/lib/phone.py` — `_normalize_phone` for E.164 normalization of `from_number` and Jobber's free-form phone strings.
  - `src/supabase_client.py` — `get_supabase_admin()` for service-role Jobber credential reads.

### New Files to Create (planner confirms exact paths)
- **Next.js side:**
  - `src/app/api/webhooks/jobber/route.js` — HMAC verification + subscription-verification handshake + 5-event-type routing + client→phone resolution + `revalidateTag`.
  - Possibly `supabase/migrations/054_jobber_webhook_events.sql` — only if webhook handler uses an idempotency table (Claude's discretion). 053 is reserved for P55's `xero_error_state` if it landed.
- **Python side (separate repo):**
  - `src/integrations/jobber.py` — service-role `accounting_credentials` read + Jobber GraphQL fetch + refresh handling + write-back.
  - `src/lib/customer_context.py` (or inline in `agent.py`) — field-level merge helper per D-07.

### Files Modified in Phase 56
- **Next.js side:**
  - `src/lib/integrations/jobber.js` — replace all `NotImplementedError` stubs with real implementations.
  - `src/app/api/integrations/jobber/auth/route.js` — wire real OAuth.
  - `src/app/api/integrations/jobber/callback/route.js` — wire callback + upsert + (optionally) programmatic webhook registration.
  - `src/app/api/integrations/disconnect/route.js` — add Jobber revoke branch + `revalidateTag`.
  - `src/app/api/setup-checklist/route.js` — add `connect_jobber` item.
  - `src/components/dashboard/BusinessIntegrationsClient.jsx` — add error-state handling for Jobber card (mirror Xero shape from P55).
  - `src/app/dashboard/more/integrations/page.js` — pass `last_context_fetch_at` + `error_state` for Jobber row down via `initialStatus`.
  - `.env.example` — add `JOBBER_WEBHOOK_SECRET`; `JOBBER_CLIENT_ID` + `JOBBER_CLIENT_SECRET` already shipped in P54.
- **Python side (separate repo):**
  - `src/agent.py` — add `jobber_context_task` to `_run_db_queries`, 800ms race, pass merged result to `build_system_prompt`.
  - `src/prompt.py` — update `customer_context` block to accept the merged dict + emit source annotations per D-08/D-09.
  - `src/tools/check_customer_account.py` — extend internal data source to the merged dict.
  - `.env.example` — add Jobber-related vars if any Python-specific (reuses `JOBBER_CLIENT_ID` etc. from Next.js .env).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/lib/integrations/xero.js`** — the P55 reference implementation. Copy-paste the `fetchCustomerByPhone` structure (use-cache directive placement, cacheTag + cacheLife pattern, refresh-aware token getter) into `jobber.js`, swapping the Xero SDK for `graphql-request`.
- **`src/app/api/webhooks/xero/route.js`** — P55's webhook handler is the shape to mirror for `/api/webhooks/jobber/route.js`: raw-body HMAC verify, intent-verification handshake, event-to-phone resolution, `revalidateTag` emission.
- **`src/components/dashboard/BusinessIntegrationsClient.jsx`** — already renders BOTH cards via `PROVIDER_META` map. The Xero half shipped with P55's error states; Jobber half needs the same treatment (no new component, just filling out the Jobber branch).
- **`src/tools/check_customer_account.py` (livekit-agent)** — already returns STATE + DIRECTIVE format per P55. P56 extends its data source from Xero-only to the merged dict — no change to the STATE serialization or DIRECTIVE phrasing.
- **`src/integrations/xero.py` (livekit-agent)** — structural template for `src/integrations/jobber.py`. Same service-role Supabase read, same refresh-aware token pattern, same write-back on token refresh.
- **`src/lib/phone.py` (livekit-agent)** — `_normalize_phone` is reused for the Jobber-side E.164 normalization. Same primitive used by `check_caller_history`.

### Established Patterns
- **GraphQL-request adapter pattern** — `graphql-request`'s `GraphQLClient` with `setHeader('Authorization', 'Bearer <token>')` is the canonical wrap style. Wrap creation in a private `_createJobberClient(tokenSet)` helper; refresh-aware token logic lives outside the client (fetch → if 401, refresh → retry once).
- **Cache tag naming** — P54's convention `${domain}-${scope}-${id}` carries forward: `jobber-context-${tenantId}` + `jobber-context-${tenantId}-${phoneE164}`.
- **Webhook endpoint structure** — `/api/webhooks/<provider>` is canonical (matches Stripe, Google Calendar, Outlook, Xero). Matches REQ JOBBER-03.
- **Setup checklist row** — `/api/setup-checklist` returns `{id, label, completed, target_url}`; `connect_jobber` follows Xero's P55 shape.
- **Python agent tool factory** — `create_<tool_name>_tool(deps)` pattern. P56 doesn't create a new tool; it extends the P55-created `check_customer_account` factory's `deps` to include the Jobber fetch.
- **Service-role Supabase in Python** — `get_supabase_admin()` bypasses RLS for system reads. Same entry point as P55.

### Integration Points
- **`_run_db_queries` in `agent.py:316`** — 5th parallel task slot. Function already uses `asyncio.gather` + `return_exceptions=True`. Adding `jobber_context_task` + the merge step is mechanical.
- **`build_system_prompt` in `prompt.py`** — already accepts `customer_context` param from P55. P56 changes the caller to pass the merged dict; the prompt.py rendering updates source annotations.
- **Business Integrations card (Jobber half)** — P54 shipped Connect/Disconnect scaffolding; P55 shipped the error-state shape on the Xero half. P56 fills in the Jobber half's error-state branch.
- **Setup checklist response** — append one item.
- **`.env.example`** — add `JOBBER_WEBHOOK_SECRET`.

### Blast Radius
- **Next.js side:** ~7-9 source files — 3-4 route handlers (jobber auth/callback wire, disconnect extend, new webhook route, setup-checklist append), 1-2 component files (BusinessIntegrationsClient.jsx Jobber branch), 1 lib file (integrations/jobber.js full implementation), 0-1 migration files (054 only if webhook idempotency table is added), 1 .env.example.
- **Python side:** 4-5 source files — 1 new `integrations/jobber.py`, 1 new or modified `lib/customer_context.py` (merge helper), 1 `agent.py` (5th task + merge call), 1 `prompt.py` (source annotations), 1 `tools/check_customer_account.py` (extended data source).
- **Plan shape:** likely 6-8 plans. Candidate partition (planner confirms):
  1. Next.js Jobber adapter — real `exchangeCode`/`refreshToken`/`revoke` + `fetchCustomerByPhone` GraphQL
  2. Real OAuth wire-up (jobber auth/callback/disconnect routes)
  3. Webhook endpoint (signature + verification handshake + 5-event routing + client→phone invalidation)
  4. BusinessIntegrationsClient Jobber card states + setup checklist item + Resend email on refresh failure
  5. Python `integrations/jobber.py` + agent `_run_db_queries` 5th task
  6. Python merge helper + prompt.py source annotations + `check_customer_account` extension
  7. Skill + ROADMAP + STATE updates
- **UI-SPEC needed:** Yes, but thin — the Jobber card states mirror Xero's exactly (just different provider icon/label). Invoke `/gsd:ui-phase 56` after CONTEXT as a delta-spec, before `/gsd:plan-phase 56`.

### Known Pitfalls
- **Jobber stores phones free-form** — biggest divergence from Xero. Normalization must happen on our side before comparison. Planner must specify exact normalization library and the Jobber GraphQL filter strategy (server-side broad filter if possible, client-side exact match always).
- **Jobber OAuth scopes are configured in the Developer Center UI** — not passed as `scope=` query param. This is already documented in the P54 stub's comment. Planner verifies that the registered Developer Center scopes cover client, job, visit, invoice, and webhook access.
- **`'use cache'` directive placement** — must be the VERY FIRST line inside the function (P54 pitfall from Xero). Easy to miss when authoring `jobber.js`.
- **Jobber webhook subscription verification handshake** — Jobber probes a newly-registered webhook with a special payload expecting a specific response. Research phase must confirm exact handshake shape.
- **Python-side refresh-token write-back** — when Python refreshes a Jobber token, it must persist the new token set back to `accounting_credentials` via service-role UPDATE. Without write-back, Next.js sees stale tokens. Identical pitfall to P55's Xero write-back.
- **Webhook re-fetch amplifying Jobber rate limits** — D-13 adds a Jobber GraphQL GET per webhook event. Bursts of job/invoice state changes could rate-limit the handler. Handler should degrade to broad-tag invalidation on 429s.
- **Merge helper hiding data-layer discrepancies** — field-level merge intentionally suppresses Jobber-vs-Xero disagreement in the prompt (e.g., Jobber says $500 owed, Xero says $0 paid). This is correct for call UX but means the OWNER has no signal that their Jobber→Xero sync is lagging. Flag as a deferred telemetry concern — surface discrepancy counts in P58's owner telemetry.
- **`lastVisitDate` derivation path** — if Jobber's schema doesn't expose `Client.visits()` directly, deriving from `Job.visits` edges means the query needs to traverse nested pages. Planner must confirm the flattest GraphQL path during research.
- **Source annotation token economy** — `(Jobber)` / `(Xero)` markers add ~5 tokens per field to the prompt. Across ~5 fields and both providers, that's ~25 tokens. Acceptable overhead; shorter markers (`(J)`, `(X)`) are a planner-discretion optimization if prompt budget tightens.
- **VISIT webhook events arriving before P57 lands** — P56 subscribes to VISIT_COMPLETE and VISIT_UPDATE purely for cache invalidation. Between P56 and P57 shipping, VISIT events will fire without being written to `calendar_events`. That's fine — P56's handler doesn't try to write to `calendar_events`; P57 extends the handler to add that write path.

</code_context>

<specifics>
## Specific Ideas

- **Field-level merge is the only anti-hallucination-compliant merge strategy.** Under the LiveKit prompt philosophy, any approach that exposes Gemini to two conflicting figures for the same fact (dual blocks, Jobber-only-prompt-with-tool-discovery) invites fluent fabrication. Field-level merge collapses every field to a single authoritative value with a provenance marker. This is not a preference — it is the only shape compatible with the philosophy's anti-hallucination rule.
- **Jobber is operations truth, Xero is payments truth.** This isn't arbitrary — it reflects how home-service tenants actually use both tools. Jobber owns the schedule, the client record, the job lifecycle. Xero owns the bank-feed-reconciled invoice state. Real-world scenario: Jobber pushes an invoice to Xero nightly; the customer pays it; the accountant reconciles it in Xero the next morning. Jobber doesn't learn about the payment until its next sync. If the customer calls at 10 AM asking about their balance, Xero has the truth; Jobber has a stale figure. Field-level merge lets us deliver "you're paid up" correctly.
- **"Return 4 jobs with status field, no pre-bucketing"** is cleaner than "2 active + 2 completed." Jobber's status taxonomy has 8 distinct values; picking which ones count as "active" in our adapter code creates an arbitrary taxonomy decision. Emitting status verbatim lets the prompt + model interpret, and insulates our code from future Jobber status additions.
- **Subscribing to VISIT events in P56 (not deferring to P57)** closes a real UX failure mode: plumber finishes a job at 2:00 PM, customer calls back at 2:03 PM saying "there's still a leak," agent says "I see your last visit was 3 days ago" because cache hasn't invalidated. That's the exact class of UX failure this phase is designed to prevent. Cost of subscribing early: one webhook event-type branch. Benefit: fresh `lastVisitDate` at every call.
- **Unified webhook endpoint across P56/P57** matches the "single source of truth" principle at the infrastructure level. One endpoint, one HMAC key, one tenant resolution, one signature verification. P57 extends; P57 doesn't create a parallel endpoint.
- **E.164 normalization on our side, not Jobber's.** Jobber stores phones as entered. We control our caller's phone format (LiveKit delivers E.164). The comparison must happen in a space we control — normalizing Jobber's string to match ours, not the other way around.
- **`client.phones[]` only — commercial edge cases are out of scope, intentionally.** Property managers with many per-site phones are a real minority, but handling them correctly requires a UX decision ("which property is this caller associated with?") that exceeds this phase's scope. Simple match logic + `customer_context` omission on miss is the safe default.
- **Source annotations (`(Jobber)` / `(Xero)`) are provenance markers, not speakable English.** They live in STATE so the model has source awareness, but the DIRECTIVE prohibits reciting them. The philosophy permits this because the marker is data, not a sentence.

</specifics>

<deferred>
## Deferred Ideas

- **Jobber multi-account picker** — currently auto-selects the account authorized during OAuth. If owners have multiple Jobber accounts, only the first is queried. Add a picker if real owner demand emerges (post-GA).
- **Jobber rate-limit back-off layer** — rely on 5-min cache + Jobber's 2500/5-min headroom + broad-tag fallback on 429s. Add explicit back-off only if telemetry shows real throttling in P58.
- **Jobber client-creation on caller match-fail** — when a caller isn't in Jobber, we omit the Jobber half of `customer_context`. Could proactively create a Jobber client for walk-in callers, but that's a push-side feature conflating with the invoicing flag. Defer.
- **Cross-provider client deduplication UI** — when Jobber and Xero both match on phone, field-level merge produces one block; no owner-facing "these are the same person, confirm linkage?" flow. If data-layer discrepancies become a support-ticket pattern, add in P58+.
- **Telemetry on Jobber/Xero discrepancy rate** — field-level merge silently suppresses Jobber-vs-Xero disagreement in the prompt. Surfacing discrepancy counts to the owner is a P58 telemetry candidate (CTX-01).
- **Python SDK choice for Jobber GraphQL** — chose `httpx` + hand-rolled POST to avoid a new dep. If planner finds that awkward, `gql` is an option. Contained to `src/integrations/jobber.py`.
- **Jobber schedule mirror into `calendar_events`** — **Phase 57 owns this.** P56's VISIT webhook subscription exists only for `customer_context` cache invalidation; P57 extends the same handler to also write to `calendar_events`.
- **Webhook subscription to additional Jobber event types** (QUOTE_*, REQUEST_*) — not relevant to customer_context; skip unless a new use case emerges.
- **Webhook signature key rotation** — single app-level `JOBBER_WEBHOOK_SECRET`; if Jobber supports key rotation, add support when needed. Not a P56 concern.
- **Shared `customer_context.py` between Python and Node** — out of scope; Python and Node sides intentionally duplicate the merge logic (different runtimes, different SDKs).
- **Agent awareness of Jobber connection state during conversation** — currently silent. If disconnected, fields omitted. No explicit "Jobber connected but fetch failed" signal in the prompt; philosophy prefers omission over signaling non-facts.
- **Multi-tenant phone collision** — if two different businesses share a phone number across Jobber and Xero for the same tenant, field-level merge would inadvertently combine them. Document as known limitation; add match-key beyond phone if real tenant data shows this.
- **Support for non-E.164 Jobber phone formats that `libphonenumber` can't parse** — e.g., extensions, vanity numbers. Fall back to normalized-if-parseable-else-skip; don't block the entire match.

</deferred>

---

*Phase: 56-jobber-read-side-integration-customer-context-clients-jobs-invoices*
*Context gathered: 2026-04-18*

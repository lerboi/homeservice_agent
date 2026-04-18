# Phase 56: Jobber read-side integration (customer context) — Research

**Researched:** 2026-04-18
**Domain:** Jobber OAuth 2.0 + GraphQL API + webhooks, Next.js 16 `'use cache'`, cross-runtime token refresh, LiveKit Python agent parallel fetch + field-level merge
**Confidence:** HIGH on Next.js-side plumbing (P55 reference code verified); HIGH-MEDIUM on Jobber protocol details (cited official docs); MEDIUM on GraphQL schema specifics (full schema only in GraphiQL — final query shapes confirmed at implementation time); MEDIUM on cross-repo livekit-agent details (separate repo not directly readable)

---

## Project Constraints (from CLAUDE.md)

- **Brand name is Voco** — never "HomeService AI" or "homeserviceai". Fallback email domain: `voco.live`.
- **Skill-sync rule** — read relevant skill before changes, update after. P56 touches `voice-call-architecture`, `auth-database-multitenancy`, `dashboard-crm-system`; nextjs-16-complete-guide reference only.
- **All DB tables documented in `auth-database-multitenancy`** — `accounting_credentials` is the canonical token table. Migration 052 already extended `provider` CHECK to include `'jobber'`.
- **Tech stack pinned** — Next.js 16 (App Router) + Supabase + LiveKit + Gemini 3.1 Flash Live. Don't introduce alternatives.
- **livekit-agent lives in a SEPARATE Python repo** at `C:/Users/leheh/.Projects/livekit-agent/` (GitHub `lerboi/livekit_agent`). Not in this monorepo. Plans that touch it are `autonomous: false`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions — Carried forward from Phase 55 (verbatim)

- **P55 D-01:** E.164 exact match, no normalization fallback. P56 adds server-side normalization of Jobber's free-form phone strings before the match.
- **P55 D-04:** 800ms fetch timeout, silent skip on failure, Sentry capture with `tenant_id` + hashed-phone tags — applies to `jobber_context_task`.
- **P55 D-05:** Two-tier `cacheTag` — broad `jobber-context-${tenantId}` + specific `jobber-context-${tenantId}-${phoneE164}`.
- **P55 D-07:** Single app-level webhook secret, HMAC-SHA256 verify raw body, 200 on good signature even for unknown tenants.
- **P55 D-08:** Pre-session prompt block + tool re-serve (not post-greeting injection). Merged context awaited before `session.start()`.
- **P55 D-09:** Tool returns STATE + DIRECTIVE, not speakable English.
- **P55 D-10:** Silent awareness privacy rule — never volunteer, answer factually ONLY when caller explicitly asks.
- **P55 D-11:** Omit `customer_context` on no-match (both providers miss). When one matches and the other misses, the matched provider's fields populate.
- **P55 D-12:** Checklist item auto-detected by `accounting_credentials` row presence with `provider='jobber'` filter.
- **P55 D-13:** Disconnect = revoke + delete row + `revalidateTag`.
- **P55 D-14:** Token-refresh failure → BOTH banner + Resend email; Reconnect primary, Disconnect secondary text-link.
- **P55 D-15:** Card content states: connected / error / disconnected.

### Locked Decisions — Area A (Caller-context fetch shape)

- **D-01:** Phone matching + E.164 normalization via `libphonenumber` server-side. Use `clients(filter:{phoneNumber:...})` server-side filter if available, then apply client-side E.164 normalization + exact comparison.
- **D-02:** `recentJobs` = up to 4 jobs, emit `status` verbatim (no pre-bucketing). Sort: `[nextVisitDate ASC where nextVisitDate >= now(), then updatedAt DESC]`.
- **D-03:** `outstandingInvoices` shape — sum across `{AWAITING_PAYMENT, BAD_DEBT, PARTIAL, PAST_DUE}` as `outstandingBalance` + array of up to 3 `{invoiceNumber, issuedAt, amount, amountOutstanding, status}`.
- **D-04:** `lastVisitDate` = most recent `Visit.endAt` where `completedAt IS NOT NULL`. Use `Client.visits(last:1, filter:{completed:true})` if schema exposes it; else derive from `Job.visits`.
- **D-05:** `graphql-request` on Next.js side; Python side uses `httpx` + hand-rolled GraphQL POST.
- **D-06:** `jobber_context_task` runs in parallel with `xero_context_task` via `asyncio.gather(..., return_exceptions=True)`. Individual 800ms race; overall `_run_db_queries` budget stays 2.5s (concurrent, not serial).

### Locked Decisions — Area B (Unified `customer_context` field-level merge)

- **D-07:** Field-level merge. Jobber wins on `client`/`recentJobs`/`lastVisitDate`. Xero wins on `outstandingBalance`/`lastPaymentDate`/`lastInvoices`. Single merged STATE block.
- **D-08:** Source annotations `(Jobber)`/`(Xero)`/`(Jobber+Xero)` in STATE as provenance markers, not speakable English.
- **D-09:** Unified `customer_context` prompt block shape locked (CRITICAL RULE + STATE + DIRECTIVE — see CONTEXT.md D-09 verbatim).
- **D-10:** `check_customer_account()` tool return re-serves merged data, same STATE + DIRECTIVE format, no re-fetch.
- **D-11:** No-match behavior unified across providers. Both miss → block omitted. One matches → block populates matched provider's fields; other provider's fields omitted from STATE (not null).

### Locked Decisions — Area C (Webhook invalidation)

- **D-12:** Subscribe to 5 event types: `CLIENT_UPDATE`, `JOB_UPDATE`, `INVOICE_UPDATE`, `VISIT_COMPLETE`, `VISIT_UPDATE`.
- **D-13:** Webhook → cache invalidation. Parse event → extract `clientId` → GET client via Jobber GraphQL → extract phones → normalize to E.164 → per-phone `revalidateTag`. Fallback to broad tenant tag on resolution failure.
- **D-14:** Single app-level `JOBBER_WEBHOOK_SECRET` env var. HMAC-SHA256 verify. 401 on bad sig; 200 on good sig even for unknown tenants. **Note:** Research Pitfall 1 below clarifies Jobber's HMAC key is actually the OAuth client_secret, not a separate webhook secret — CONTEXT.md D-14 will need a clarifying edit during planning.
- **D-15:** Webhook idempotency — planner's discretion (trust idempotent `revalidateTag` preferred, dedup table optional).

### Locked Decisions — Area D (P56 / P57 boundary)

- **D-16:** VISIT subscription lives in P56 handler; P57 extends same handler to write `calendar_events` — no second webhook endpoint.

### Claude's Discretion

- Exact GraphQL query shape (fields, edges, pagination) — confirm against live schema
- `libphonenumber-js` vs `google-libphonenumber` on Next.js
- Python phone normalization — reuse `src/lib/phone.py:_normalize_phone` vs `phonenumbers` package
- Webhook subscription registration mechanism (auto vs manual Developer Center UI)
- Refresh-token write-back path on Python side
- `error_state` column reuse (existing `TEXT` column from migration 053)
- Ordering of `recentInvoices` reference array
- Source annotation format (`(Jobber)` vs `(J)` for prompt-token economy)
- Merge helper location (Python): `src/lib/customer_context.py` vs inline in `agent.py`
- Jobber 429 rate-limit degradation strategy

### Deferred Ideas (OUT OF SCOPE)

- Jobber multi-account picker
- Jobber rate-limit back-off layer
- Jobber client-creation on caller-match fail
- Cross-provider client deduplication UI
- Telemetry on Jobber/Xero discrepancy rate
- Python SDK choice change (if httpx proves awkward)
- Jobber schedule mirror into `calendar_events` — **Phase 57 owns this**
- Webhook subscription to QUOTE_* / REQUEST_* event types
- Webhook signature key rotation
- Shared `customer_context` module between Python and Node
- Agent awareness of "Jobber connected but fetch failed"
- Multi-tenant phone collision handling
- Non-E.164 Jobber phone formats that libphonenumber can't parse

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **JOBBER-01** | Tenant can connect Jobber via OAuth from `/dashboard/more/integrations`; tokens stored in `accounting_credentials` with `provider='jobber'` | Standard Stack — Jobber OAuth endpoints + refresh-token rotation; Architecture Pattern 2 (OAuth callback) + Pattern 3 (refresh-aware token getter); Pitfall 3 (refresh-token rotation write-back); Pitfall 5 (provider CHECK already shipped). Mirrors Phase 55 XERO-01. |
| **JOBBER-02** | `fetchCustomerByPhone(tenantId, phone)` returns `{ client, recentJobs, outstandingInvoices, lastVisitDate }` via Jobber GraphQL in <500ms p95 with 5-min cache | Standard Stack — `graphql-request@7.4.0` + `libphonenumber-js@1.12.41`; Architecture Pattern 1 (`'use cache'` + two-tier `cacheTag`); Pitfall 2 (`'use cache'` must be FIRST statement); Pitfall 4 (phone normalization); Code Example 1. Enables <500ms p95 via cache hits. Mirrors XERO-02 shape but GraphQL instead of REST. |
| **JOBBER-03** | `/api/webhooks/jobber` invalidates customer-context cache on client/job/invoice events | Standard Stack — Node `crypto` HMAC-SHA256; Architecture Pattern 4 (webhook handler); Pitfall 1 (HMAC key is OAuth client_secret, NOT separate webhook secret — CONTEXT.md D-14 needs clarification); Pitfall 6 (no intent-verify handshake, unlike Xero); Code Example 2. |
| **JOBBER-04** | LiveKit agent merges Jobber + Xero context into system prompt (Jobber preferred for home-service trade context) | Architecture Pattern 5 (Python-side 5-task parallel) + Pattern 6 (field-level merge helper); Code Example 3 (asyncio.gather with 800ms race) + Code Example 4 (merge helper). |
| **JOBBER-05** | `check_customer_account()` tool returns combined Jobber + Xero data when both providers connected | Architecture Pattern 7 (tool re-serves merged dict — no re-fetch); Code Example 5. Tool created in P55; P56 extends data source only. |

</phase_requirements>

---

## Summary

Phase 56 applies the Phase 55 Xero pattern to Jobber with three critical divergences:

1. **GraphQL instead of REST.** Jobber exposes a single GraphQL endpoint (`https://api.getjobber.com/api/graphql`) requiring `X-JOBBER-GRAPHQL-VERSION` header on every request. `graphql-request@7.4.0` is added as a new npm dep (not in package.json). Python side uses `httpx` + hand-rolled GraphQL POST (no new dep).

2. **Refresh-token rotation is mandatory.** Unlike Xero (where rotation exists but is symmetric), Jobber issues a new refresh_token on EVERY refresh call. Apps must persist the new refresh_token immediately — using an old refresh_token fails silently with a generic "invalid refresh token" error (apps created after Jan 2 2024 get no rotation-detection signal). This is the Python-side write-back pitfall inherited from P55, but sharper.

3. **Webhook HMAC key IS the OAuth client_secret.** Jobber does NOT issue a separate webhook signing key. The `X-Jobber-Hmac-SHA256` header is HMAC-SHA256 of the raw body keyed by the app's `client_secret`. CONTEXT.md D-14 references a `JOBBER_WEBHOOK_SECRET` env var — that env var CAN exist for config separation but its value must equal `JOBBER_CLIENT_SECRET`. Simpler: reuse `JOBBER_CLIENT_SECRET` directly and skip the extra env var. Planner decides.

The **second-most-consequential finding** is the absence of a subscription-verification handshake. Xero probes new webhook URLs with an intent-verify challenge; Jobber does not. The `/api/webhooks/jobber` handler is simpler than Xero's — just HMAC verify + route, no handshake branch.

The **third-most-consequential finding** is that Jobber stores phones free-form (e.g. "(555) 123-4567", "555-1234", "+1 555 123 4567" all valid). Xero does too, but its phone fields are split across `PhoneCountryCode`/`PhoneAreaCode`/`PhoneNumber`. Jobber uses a single free-text `number` field on `Client.phones[]`. Use `libphonenumber-js` to normalize to E.164, then exact-compare against the caller's E.164 `from_number`.

**Primary recommendation:** Implement exactly per the Plans, mirror P55's file structure and test pattern, confirm GraphQL schema details (specific field/arg names on `clients`, `Client.phones`, `Visit.completedAt`, `Invoice.invoiceStatus` enum values) against GraphiQL at the start of Plan 01 before locking the fetcher. Honor the 800ms hot-path budget on the Python side and run Jobber+Xero concurrently, never serially.

---

## Standard Stack

### Core (Next.js side)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `graphql-request` | **^7.4.0** (latest, published 2025-12-12) | Lightweight GraphQL client for `fetchCustomerByPhone` + webhook client-resolve + OAuth-time optional schema probe | Tiny (~10KB), no Apollo/Relay machinery, works inside Next.js 16 `'use cache'` function. Named by CONTEXT.md D-05. [VERIFIED: `npm view graphql-request version` → 7.4.0] |
| `libphonenumber-js` | **^1.12.41** (latest) | E.164 normalization of Jobber's free-form phone strings server-side | Small metadata footprint vs Google's `libphonenumber`. Named in CONTEXT.md Claude's Discretion — this research locks it in. [VERIFIED: `npm view libphonenumber-js version` → 1.12.41] |
| Next.js | 16.x (P54 enabled `cacheComponents: true`) | App Router + `'use cache'` + `cacheTag` + `revalidateTag` | Voco's framework; `'use cache'` is canonical caching primitive [CITED: `.claude/skills/nextjs-16-complete-guide/SKILL.md`] |
| `@supabase/supabase-js` | ^2.99.2 | Service-role reads/writes of `accounting_credentials` | Standard project DAL [VERIFIED: package.json] |
| `next/cache` | (built-in) | `cacheTag`, `revalidateTag` | Built-in, used by P54 `status.js` + P55 `xero.js` [VERIFIED: src/lib/integrations/status.js:13] |
| Node `crypto` | (built-in) | HMAC-SHA256 + `timingSafeEqual` for webhook verify | Stdlib; matches Stripe + Xero webhook handlers [VERIFIED: src/app/api/webhooks/xero/route.js:1] |
| `resend` | ^6.9.4 | Token-refresh-failure email | Existing helper `getResendClient()` in `src/lib/notifications.js` [VERIFIED: package.json] |
| `@react-email/components` | ^1.0.10 | `JobberReconnectEmail` template (mirror `XeroReconnectEmail`) | Existing pattern [VERIFIED: src/emails/XeroReconnectEmail.jsx exists] |
| `date-fns` | ^4.1.0 | `formatDistanceToNow` for "Last synced X ago" | Project-standard [VERIFIED: package.json] |

### Core (Python side — separate livekit-agent repo)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `httpx` | ^0.27 (assumed present from P55) | Async Jobber GraphQL POST + token refresh | Tight timeout control on 800ms hot path; smaller footprint than `gql`. CONTEXT.md D-05 Python choice locks this. [ASSUMED — verify in livekit-agent/pyproject.toml] |
| `phonenumbers` | add if absent; else reuse `src/lib/phone.py:_normalize_phone` | E.164 normalize Jobber's free-form strings server-side in Python too | CONTEXT.md Claude's Discretion. Prefer reusing `_normalize_phone` if it already handles Jobber's formats (to avoid adding a new dep). [ASSUMED — check existing `_normalize_phone` coverage] |
| `supabase` Python client | already in livekit-agent | Service-role reads/writes of `accounting_credentials` | Existing `get_supabase_admin()` [CITED: P55 55-RESEARCH.md:276] |
| `sentry_sdk` | already in livekit-agent | Capture 800ms timeout failures | D-04 mandates Sentry capture with tags [ASSUMED — P55 already uses it] |
| `livekit-agents` | **1.5.1 (PINNED)** | `@function_tool` decorator for extended `check_customer_account` | MUST NOT BUMP — P55 UAT findings 999.2 [VERIFIED: STATE.md lines 69-70] |
| `livekit-plugins-google` | **@43d3734 (PINNED)** | LiveKit + Gemini glue | MUST NOT BUMP [VERIFIED: STATE.md] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `graphql-request` | `Apollo Client` / `@urql/core` | Apollo brings SSR caching machinery that conflicts with Next.js 16 `'use cache'`. urql is viable but adds exchange/store layer. graphql-request is pure fetch wrapper — perfect for single-query `'use cache'` functions. |
| `graphql-request` | Raw `fetch` + hand-rolled GraphQL POST | Raw fetch works (Python does this) but loses typed errors, auto-header setting, query variable serialization. 12KB saves 10 lines of code — keep graphql-request on Next.js. |
| `libphonenumber-js` | `google-libphonenumber` | google-libphonenumber ships full ICU-backed metadata (~500KB). libphonenumber-js ships trimmed metadata (~150KB). P56 only needs parse+format to E.164, not validation — libphonenumber-js sufficient. |
| Two-tier cacheTag | Tenant-wide only | Tenant-wide wastes recompute on every webhook for active tenants. Two-tier is strictly better at negligible tag-string cost. Mirrors P55 D-05. |
| Dedicated `JOBBER_WEBHOOK_SECRET` env var | Reuse `JOBBER_CLIENT_SECRET` directly | Jobber uses `client_secret` as the HMAC key. Separate env var is pure configuration aesthetics — setting `JOBBER_WEBHOOK_SECRET=$JOBBER_CLIENT_SECRET` documents intent but doubles the config surface. Planner picks. |
| Python `gql` library | Raw httpx POST | gql adds ~40KB + async machinery we don't use. httpx POST matches P55 pattern. Deferred per CONTEXT.md. |

**Installation:**
```bash
npm install graphql-request@^7.4.0 libphonenumber-js@^1.12.41
```

**Version verification** (verified 2026-04-18):
- `npm view graphql-request version` → `7.4.0` (published 2025-12-12)
- `npm view libphonenumber-js version` → `1.12.41`

---

## Architecture (Next.js side)

### Recommended Project Structure

P54+P55 established the layout. P56 touches these files:

```
src/
├── lib/integrations/
│   ├── jobber.js          # P54 stub; P56 REPLACES with full impl (getAuthUrl ALREADY scaffolded)
│   ├── xero.js            # unchanged
│   ├── adapter.js         # unchanged — getIntegrationAdapter + refreshTokenIfNeeded already route to jobber
│   ├── status.js          # unchanged
│   └── types.js           # unchanged (CustomerContext type already supports both providers)
├── app/
│   ├── api/
│   │   ├── integrations/
│   │   │   ├── [provider]/auth/route.js       # unchanged — provider-agnostic
│   │   │   ├── [provider]/callback/route.js   # unchanged — provider-agnostic (revalidateTag already emits `${provider}-context-${tenantId}`)
│   │   │   └── disconnect/route.js            # unchanged — provider-agnostic (revalidateTag already emits `${provider}-context-${tenantId}`)
│   │   ├── webhooks/
│   │   │   └── jobber/route.js                # P56 NEW — HMAC + 5-event routing + client→phone resolution
│   │   └── setup-checklist/route.js           # P56 APPENDS connect_jobber item (+ jobberConnected fetch)
│   └── dashboard/more/integrations/page.js    # P56 passes jobber row's error_state + last_context_fetch_at into initialStatus
├── components/dashboard/
│   └── BusinessIntegrationsClient.jsx         # P56 fixes hardcoded "Xero" bug + adds Preferred badge + wires error state for Jobber
├── lib/
│   └── notifications.js                       # P56 ADDS notifyJobberRefreshFailure (mirror notifyXeroRefreshFailure)
├── emails/
│   └── JobberReconnectEmail.jsx               # P56 NEW — mirror XeroReconnectEmail
└── supabase/migrations/
    └── (054_jobber_webhook_events.sql)        # OPTIONAL — only if Claude's discretion picks dedup table
```

[VERIFIED: file listings at src/lib/integrations/, src/app/api/integrations/, src/emails/]

**Schema:** No mandatory migration. Migration 052 (P54) already extended `provider` CHECK to include `'jobber'`. Migration 053 (P55) added `error_state TEXT` column — P56 reuses it with `error_state='token_refresh_failed'` on Jobber refresh failures (no schema change).

### Pattern 1: `'use cache'` + two-tier `cacheTag` + `revalidateTag` loop (D-05)

Mirror P55 exactly. The cached function **must be module-level** (Next.js 16 forbids `'use cache'` on class methods — P55 Pitfall verified in practice):

```javascript
// src/lib/integrations/jobber.js — P56 NEW
export async function fetchJobberCustomerByPhone(tenantId, phoneE164) {
  'use cache';                                              // MUST be FIRST statement (silent disable otherwise)
  cacheTag(`jobber-context-${tenantId}`);                   // broad — invalidated on disconnect/reauth/webhook fallback
  cacheTag(`jobber-context-${tenantId}-${phoneE164}`);      // specific — invalidated per-phone by webhook
  // ...lookup logic (see Pattern 3)...
  return { client, recentJobs, outstandingInvoices, lastVisitDate };
}

export class JobberAdapter {
  async fetchCustomerByPhone(tenantId, phoneE164) {
    return fetchJobberCustomerByPhone(tenantId, phoneE164);  // delegate to module-level cached fn
  }
}
```

[VERIFIED: exact mirror of P55 src/lib/integrations/xero.js:61-176, method delegation at line 327-332]

### Pattern 2: OAuth auth + callback (JOBBER-01)

`/api/integrations/[provider]/auth/route.js` and `/api/integrations/[provider]/callback/route.js` are provider-agnostic. P56 wires `JobberAdapter.getAuthUrl/exchangeCode/revoke`:

- **`getAuthUrl`** already scaffolded in P54 — emits `https://api.getjobber.com/api/oauth/authorize?client_id=...&redirect_uri=...&response_type=code&state=...`. No scope query param. [VERIFIED: src/lib/integrations/jobber.js:37-44]
- **`exchangeCode`** — POST `https://api.getjobber.com/api/oauth/token` with `client_id`, `client_secret`, `grant_type=authorization_code`, `code`, `redirect_uri`. Response: `{access_token, refresh_token}` (access_token is JWT — decode `exp` for `expiry_date`). [CITED: developer.getjobber.com/docs/building_your_app/app_authorization/]
- **`revoke`** — Jobber does NOT document a public revoke endpoint. P56 `revoke()` is a no-op (just logs + returns). User revokes via Jobber's Apps page. Disconnect path still deletes the local row + invalidates cache. `JOBBER_REVOKE_URL` constant in the P54 stub is speculative; planner should drop it or leave as a code comment. [CITED: WebFetch developer.getjobber.com — no revoke URL surfaced]
- **`display_name`** — derive from the Jobber account name via a post-token GraphQL probe (e.g., `query { account { name } }`). Optional — planner's discretion whether to populate immediately or leave null until first fetch.

The callback handler already emits `revalidateTag('jobber-context-${tenantId}')` and `revalidateTag('integration-status-${tenantId}')` without modification [VERIFIED: src/app/api/integrations/[provider]/callback/route.js:89-90]. It also clears `error_state` via upsert [VERIFIED: line 59] and auto-flips `features_enabled.invoicing=true` — identical to P55.

### Pattern 3: Refresh-aware token getter with rotation write-back (JOBBER-01 critical)

`refreshTokenIfNeeded` in `src/lib/integrations/adapter.js:42-86` is provider-agnostic. P56's `JobberAdapter.refreshToken()` must:

1. POST `https://api.getjobber.com/api/oauth/token` with `grant_type=refresh_token`, `client_id`, `client_secret`, `refresh_token`.
2. Response: `{access_token, refresh_token}` — **NEW refresh_token every call** (rotation is mandatory).
3. Decode `access_token` JWT `exp` field (base64-decode middle segment, parse JSON) to get `expiry_date` in ms.
4. Return `{access_token, refresh_token, expiry_date, scopes: <unchanged>}`.

The existing `refreshTokenIfNeeded` already persists `access_token + refresh_token + expiry_date` together in a single UPDATE [VERIFIED: adapter.js:58-73]. This works for Jobber's rotation — no adapter.js change needed.

### Pattern 4: Webhook handler — HMAC verify + 5-event routing (JOBBER-03)

Simpler than Xero (no intent-verify handshake). Structure:

```
POST /api/webhooks/jobber
  ├─ rawBody = await request.text()                            # raw bytes only; never request.json() first
  ├─ sig = request.headers.get('x-jobber-hmac-sha256')
  ├─ expected = HMAC-SHA256(rawBody, JOBBER_CLIENT_SECRET)     # base64-encoded — key is client_secret, NOT a separate webhook secret
  ├─ crypto.timingSafeEqual(sig, expected) → 401 on mismatch
  ├─ payload = JSON.parse(rawBody)
  │   shape: { data: { webHookEvent: { topic, appId, accountId, itemId, occurredAt } } }
  ├─ evt = payload.data.webHookEvent
  ├─ lookup accounting_credentials WHERE provider='jobber' AND xero_tenant_id=evt.accountId  # reuse xero_tenant_id column for Jobber's accountId
  │   (Note: existing schema has xero_tenant_id column — repurpose it to store Jobber's accountId, or add a provider-agnostic external_account_id column — planner decides)
  ├─ if no row → silent 200 (prevents retry storms)
  ├─ route by evt.topic:
  │    CLIENT_UPDATE / JOB_UPDATE / INVOICE_UPDATE / VISIT_COMPLETE / VISIT_UPDATE
  │       ├─ resolve clientId from evt.itemId:
  │       │    - CLIENT_* → itemId IS clientId
  │       │    - JOB_* / VISIT_* → GraphQL GET job(id:itemId) { client { id } }
  │       │    - INVOICE_* → GraphQL GET invoice(id:itemId) { client { id } }
  │       ├─ GraphQL GET client(id:clientId) { phones { number } }
  │       ├─ for each phone: normalize to E.164 → revalidateTag(`jobber-context-${tenantId}-${E164}`)
  │       └─ on any resolution failure: revalidateTag(`jobber-context-${tenantId}`)  # broad fallback
  └─ return 200 (always — Jobber retries on non-200 per at-least-once delivery)
```

**Critical:** `evt.accountId` is the Jobber account identifier (equivalent to Xero's `tenantId`). The existing `xero_tenant_id` column on `accounting_credentials` is misleadingly named — either repurpose it for Jobber (document the overload) or add a new column (e.g., `external_account_id TEXT`). Mirror of CONTEXT.md Claude's Discretion.

[CITED: developer.getjobber.com/docs/using_jobbers_api/setting_up_webhooks/]

### Pattern 5: GraphQL query shape (JOBBER-02)

Single batched GraphQL query per fetch (CONTEXT.md budget: 1 round-trip). Draft query:

```graphql
query FetchClientByPhone($search: String!) {
  clients(first: 25, filter: { phoneNumber: $search }) {
    nodes {
      id
      name
      emails { address }
      phones { number }
      jobs(first: 4, sort: [{ key: UPDATED_AT, direction: DESCENDING }]) {
        nodes {
          jobNumber
          title
          jobStatus
          startAt
          endAt
          visits(first: 1, filter: { status: UPCOMING }) {
            nodes { startAt }
          }
        }
      }
      invoices(first: 10) {
        nodes {
          invoiceNumber
          issuedDate
          amount
          amountOutstanding
          invoiceStatus
        }
      }
      visits(first: 1, sort: [{ key: COMPLETED_AT, direction: DESCENDING }], filter: { completed: true }) {
        nodes { endAt completedAt }
      }
    }
  }
}
```

**Assumptions requiring GraphiQL verification at Plan 01:**
- Argument name — `filter: { phoneNumber: ... }` may actually be `filter: { searchTerm: ... }` or a different key on `ClientFilterAttributes`. Confirm in GraphiQL.
- `Client.visits` connection — may not exist directly on `Client`; if not, derive `lastVisitDate` from `jobs.nodes[].visits` edges (larger query).
- `Invoice.invoiceStatus` enum values — confirm `{AWAITING_PAYMENT, BAD_DEBT, PARTIAL, PAST_DUE, DRAFT, PAID, VOIDED}` exist verbatim; CONTEXT.md D-03 depends on this.
- `Job.jobStatus` enum values — CONTEXT.md D-02 lists `{upcoming, today, action_required, late, on_hold, unscheduled, requires_invoicing, archived}` — verify exact casing/spelling in the schema.
- `clients(filter: {phoneNumber: ...})` — Rollout integration guide confirms `ClientFilterAttributes` exists as a filter input type, but doesn't explicitly list `phoneNumber` as a supported key. If not supported, fall back to fetching `clients(first: 50)` paginated and JS-side filter on normalized phones.

All marked `[ASSUMED]` in the Assumptions Log below.

Required header on every GraphQL call:
```
X-JOBBER-GRAPHQL-VERSION: 2024-04-01   # or similar — latest stable, confirm at implementation time
Authorization: Bearer <access_token>
Content-Type: application/json
```

[CITED: developer.getjobber.com/docs/using_jobbers_api/api_versioning/]

### Pattern 6: Business Integrations card — error state + Preferred badge (JOBBER-01, mirrors P55 D-14/D-15)

UI-SPEC §Bug Fix locks the fix path. In `BusinessIntegrationsClient.jsx`:

1. **Bug fix (line ~237):** hardcoded `"Xero"` in reconnect banner → replace with `{meta.name}`. One-line fix that auto-fixes Jobber too.
2. **Preferred badge:** render in Jobber card header row when `status.xero !== null && connected === true`. Emerald palette per UI-SPEC §Color.
3. **Error state + Reconnect banner:** already rendered generically via `meta.name`; needs `status.jobber?.error_state === 'token_refresh_failed'` to trigger (mirror P55 Xero render condition). This is where the bug-fix from (1) becomes load-bearing.
4. **Last synced timestamp:** `formatDistanceToNow(status.jobber.last_context_fetch_at)` when non-null. Existing render path.

`/dashboard/more/integrations/page.js` server component already passes `initialStatus` — UI-SPEC §Integrations Page specifies adding the Jobber row's `{id, last_context_fetch_at, error_state}` select.

### Pattern 7: Setup checklist `connect_jobber` (mirrors P55 D-12)

Extend `/api/setup-checklist/route.js` following the existing `connect_xero` shape [VERIFIED: src/app/api/setup-checklist/route.js:18, 30, 100-105, 175, 249-253, 270-271]:

- `VALID_ITEM_IDS` — append `'connect_jobber'`
- `THEME_GROUPS.voice` — append `'connect_jobber'`
- `ITEM_META.connect_jobber` per UI-SPEC strings
- `fetchChecklistState` — add `jobberResult` parallel query (mirror `xeroResult`)
- `deriveChecklistItems` — `autoComplete.connect_jobber = !!counts.jobberConnected`

### Pattern 8: Token-refresh-failure email (mirrors P55 D-14)

Create `src/emails/JobberReconnectEmail.jsx` mirroring `XeroReconnectEmail.jsx`. UI-SPEC §Copywriting locks subject ("Your Jobber connection needs attention") + body excerpt + CTA ("Reconnect Jobber").

Create `notifyJobberRefreshFailure(tenantId, tenantOwnerEmail)` in `src/lib/notifications.js` mirroring `notifyXeroRefreshFailure`.

Triggered from `refreshTokenIfNeeded` catch branch in Plan 03 (OAuth wire-up + refresh error surfacing).

### Anti-Patterns to Avoid

- **`'use cache'` after any other statement** — silently disables caching with no compile error. P54 known pitfall.
- **`request.json()` before HMAC verify** — body stream consumed, HMAC over re-stringified shape won't match Jobber's raw bytes → all signatures fail.
- **Putting `'use cache'` on a class method** — Next.js 16 forbids this. Module-level function + delegation is the P55-verified pattern.
- **Using `xero-node` patterns for Jobber** — Jobber is pure GraphQL. No SDK. No typed models. Hand-write queries + decode JWT for expiry.
- **Passing `scope=` query param** — Jobber ignores it. Scopes configured in Developer Center UI only.
- **Logging `cred.refresh_token` or full error responses** — secrets echo hazard (same as P55 anti-pattern).
- **Persisting only `access_token` on refresh** — refresh_token rotation means you lose auth on the NEXT refresh. Always persist both.
- **Expecting a webhook intent-verification handshake** — Jobber has none. Don't add handshake code "just in case."
- **Assuming separate `JOBBER_WEBHOOK_SECRET`** — the HMAC key is `client_secret`. An intermediate env var is aesthetic only.

---

## Architecture (Python side — cross-repo)

All paths below are inside the SEPARATE livekit-agent repo at `C:/Users/leheh/.Projects/livekit-agent/`. Plans touching this code are `autonomous: false` — user copies file contents manually.

### Module Layout

```
livekit-agent/
├── src/
│   ├── agent.py                      # MODIFY ~line 316 — _run_db_queries 5th task + merge call
│   ├── prompt.py                     # MODIFY — accept merged dict + emit source annotations
│   ├── supabase_client.py            # READ — get_supabase_admin()
│   ├── lib/
│   │   ├── phone.py                  # READ — _normalize_phone (E.164)
│   │   └── customer_context.py       # NEW — field-level merge helper (per D-07)
│   ├── integrations/
│   │   ├── xero.py                   # READ — template from P55
│   │   └── jobber.py                 # NEW — service-role read + GraphQL fetch + refresh write-back
│   └── tools/
│       └── check_customer_account.py # MODIFY — extend data source to merged dict (no signature change)
└── tests/
    ├── test_jobber_integration.py    # NEW
    ├── test_customer_context_merge.py # NEW
    └── test_agent_jobber_timeout.py  # NEW
```

### Pattern 9: `_run_db_queries` 5-task parallel + field-level merge (JOBBER-04)

P55 added `xero_context_task` as the 4th parallel task. P56 adds `jobber_context_task` as the 5th:

```python
# src/agent.py ~line 316 — pseudocode
xero_context_task = asyncio.create_task(
    asyncio.wait_for(fetch_xero_customer_by_phone(deps.tenant_id, from_number), timeout=0.8)
)
jobber_context_task = asyncio.create_task(
    asyncio.wait_for(fetch_jobber_customer_by_phone(deps.tenant_id, from_number), timeout=0.8)
)

results = await asyncio.gather(
    sub_task, intake_task, call_task, xero_context_task, jobber_context_task,
    return_exceptions=True,
)

xero_result = results[3]
jobber_result = results[4]

# Silent-skip on timeout/exception per D-04
xero_ctx = None if isinstance(xero_result, (asyncio.TimeoutError, Exception)) else xero_result
jobber_ctx = None if isinstance(jobber_result, (asyncio.TimeoutError, Exception)) else jobber_result

# Field-level merge per D-07
from src.lib.customer_context import merge_customer_context
customer_context = merge_customer_context(jobber=jobber_ctx, xero=xero_ctx)

# Passed into build_system_prompt and stored in deps for check_customer_account tool
deps.customer_context = customer_context
```

Overall `_run_db_queries` budget stays at 2.5s — Xero + Jobber race CONCURRENTLY, not serially.

### Pattern 10: Field-level merge helper (D-07)

```python
# src/lib/customer_context.py — NEW
def merge_customer_context(jobber: dict | None, xero: dict | None) -> dict | None:
    """Merge Jobber + Xero caller context per P56 D-07.
    
    Jobber wins: client, recentJobs, lastVisitDate
    Xero wins: outstandingBalance, lastPaymentDate, lastInvoices
    
    Returns None when BOTH providers miss (omit customer_context block entirely per D-11).
    """
    if not jobber and not xero:
        return None
    
    merged = {}
    sources = {}
    
    # client — Jobber wins
    if jobber and jobber.get("client"):
        merged["client"] = jobber["client"]
        sources["client"] = "Jobber"
    elif xero and xero.get("contact"):
        merged["client"] = xero["contact"]
        sources["client"] = "Xero"
    
    # recentJobs — Jobber-only field
    if jobber and jobber.get("recentJobs"):
        merged["recentJobs"] = jobber["recentJobs"]
        sources["recentJobs"] = "Jobber"
    
    # lastVisitDate — Jobber-only field
    if jobber and jobber.get("lastVisitDate"):
        merged["lastVisitDate"] = jobber["lastVisitDate"]
        sources["lastVisitDate"] = "Jobber"
    
    # outstandingBalance — Xero wins
    if xero and xero.get("outstandingBalance") is not None:
        merged["outstandingBalance"] = xero["outstandingBalance"]
        sources["outstandingBalance"] = "Xero"
    elif jobber and jobber.get("outstandingBalance") is not None:
        merged["outstandingBalance"] = jobber["outstandingBalance"]
        sources["outstandingBalance"] = "Jobber"
    
    # lastPaymentDate — Xero wins
    if xero and xero.get("lastPaymentDate"):
        merged["lastPaymentDate"] = xero["lastPaymentDate"]
        sources["lastPaymentDate"] = "Xero"
    elif jobber and jobber.get("lastPaymentDate"):
        merged["lastPaymentDate"] = jobber["lastPaymentDate"]
        sources["lastPaymentDate"] = "Jobber"
    
    # lastInvoices — Xero wins (reference detail)
    if xero and xero.get("lastInvoices"):
        merged["lastInvoices"] = xero["lastInvoices"]
        sources["lastInvoices"] = "Xero"
    elif jobber and jobber.get("outstandingInvoices"):
        merged["lastInvoices"] = jobber["outstandingInvoices"]
        sources["lastInvoices"] = "Jobber"
    
    merged["_sources"] = sources
    return merged if merged else None
```

### Pattern 11: Prompt block with source annotations (D-08, D-09)

`src/prompt.py` `build_system_prompt` changes:
- Accept `customer_context` kwarg (merged dict from Pattern 10). P55 already has this kwarg; P56 changes the shape from Xero-only to merged.
- Render `(source)` suffix per field using `customer_context._sources` lookup.
- No changes to CRITICAL RULE / STATE / DIRECTIVE framing — all inherited from P55 D-09.

### Pattern 12: Tool extension (D-10, JOBBER-05)

`src/tools/check_customer_account.py` factory `deps` gets the merged dict injected. Tool body re-serves the merged data formatted as STATE + DIRECTIVE. No signature change; no re-fetch. P55 created the tool; P56 widens its input.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GraphQL query construction on Next.js | Hand-crafted `fetch` + JSON.stringify of `{query, variables}` | `graphql-request@7.4.0` | Handles Authorization header propagation, variable serialization, error-shape parsing (typed `ClientError`) in ~12KB. |
| E.164 normalization of Jobber's free-form phones | Regex-based digit extraction + country-code guessing | `libphonenumber-js` `parsePhoneNumberFromString` | Handles extensions, vanity numbers, international formats. Digit-strip heuristics produce false positives across locale mismatches. |
| JWT expiry decoding for Jobber access_token | String manipulation to pull `exp` from middle segment | `atob()` + JSON.parse, or even tiny `jwt-decode` (3KB) | Base64url decoding has padding edge cases. Either use stdlib `Buffer.from(..., 'base64url')` with care, or `jwt-decode`. |
| HMAC-SHA256 + constant-time compare | Custom byte-diff loops, plain `===` | Node `crypto.createHmac` + `crypto.timingSafeEqual` | Timing attacks are real. P55 webhook handler already establishes the canonical pattern. |
| Field-level merge logic | Deeply nested if/else ladders inline in `agent.py` | Named `merge_customer_context` helper in `src/lib/customer_context.py` | Testable in isolation (Plan will include unit tests covering all 4 provider-present combinations). |
| Refresh-token rotation persistence | Saving only `access_token` after refresh | Persist `access_token + refresh_token + expiry_date` together in single UPDATE | Jobber rotates refresh_token on every call. Losing the new one = auth break next cycle. `refreshTokenIfNeeded` already does this [VERIFIED: adapter.js:58-73]. |
| Webhook idempotency | Fresh dedup DB table | Trust `revalidateTag` idempotency + Jobber's at-least-once semantics | `revalidateTag` is idempotent by design. Duplicate webhook processing is cheap. Add dedup only if telemetry shows amplification. |

**Key insight:** Most "custom" solutions in this phase are worse than the P55 versions they'd diverge from. Mirror P55 structurally; swap only the Jobber-specific primitives (GraphQL, JWT expiry, Jobber phone format, 5 event types). Resist the urge to "redesign" because the adapter is new.

---

## Runtime State Inventory

> Phase 56 is a greenfield/additive phase — no rename, refactor, or string migration. This section does not apply and is intentionally omitted.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js runtime | ✓ | v24.14.1 | — |
| npm | Package install | ✓ | (bundled) | — |
| `graphql-request` | JOBBER-02 fetcher | ✗ (NOT in package.json) | — | `npm install graphql-request@^7.4.0` — install step in Plan 01 |
| `libphonenumber-js` | Phone normalization | ✗ (NOT in package.json) | — | `npm install libphonenumber-js@^1.12.41` — install step in Plan 01 |
| Migration 052 | Provider CHECK includes 'jobber' | ✓ | 052 | — [VERIFIED: supabase/migrations/052_integrations_schema.sql:27-28] |
| Migration 053 | `error_state` column for token-refresh failures | ✓ | 053 | — [VERIFIED: supabase/migrations/053_xero_error_state.sql] |
| `.env.example` JOBBER_CLIENT_ID/SECRET | OAuth | ✓ (keys present, values empty) | — | User fills in after registering Jobber app [VERIFIED: .env.example:16] |
| `.env.example` `JOBBER_WEBHOOK_SECRET` | Webhook HMAC | ✗ | — | Plan adds to `.env.example`. Value = `JOBBER_CLIENT_SECRET` (or reuse directly — see Pattern 4). |
| Jobber developer account + sandbox | OAuth, GraphQL testing | ? (pending user action) | — | **BLOCKING** — user must register at `developer.getjobber.com`. Pre-req flagged in ROADMAP P56 "Pre-requisite user actions" |
| Phase 55 code + migration 053 | Pattern template, `error_state` column | ✓ | Shipped 2026-04-18 | — [VERIFIED: STATE.md line 32] |
| `httpx` (Python) | Python-side Jobber fetch | ? (cross-repo) | — | Verify in livekit-agent/pyproject.toml during Plan 05; add if missing |
| `phonenumbers` Python package | E.164 normalize in Python | ? (cross-repo) | — | Prefer reusing `src/lib/phone.py:_normalize_phone`; add package only if existing helper falls short of Jobber's formats |

**Missing dependencies with no fallback:**
- Jobber dev account / sandbox — BLOCKING user action. Research + planning can complete without it; execution cannot.

**Missing dependencies with fallback:**
- `graphql-request` + `libphonenumber-js` — install during Plan 01 (or a Wave 0 bootstrap task).

---

## Common Pitfalls

### Pitfall 1: Jobber webhook HMAC key is OAuth client_secret, NOT a separate webhook secret

**What goes wrong:** A developer reads CONTEXT.md D-14 ("Single app-level `JOBBER_WEBHOOK_SECRET` env var") and hunts for a separate webhook signing key in Jobber's Developer Center. There isn't one. They either set a random value (breaks all signatures) or get stuck.

**Why it happens:** Xero + Stripe + Twilio all use separate webhook signing keys, so developers assume Jobber follows the same pattern. Jobber actually derives the HMAC key from the OAuth `client_secret` — same secret used for token exchange.

**How to avoid:** In Plan 04, either:
- (a) Document in `.env.example` that `JOBBER_WEBHOOK_SECRET` must equal `JOBBER_CLIENT_SECRET` (cosmetic separation), OR
- (b) Skip the extra env var and read `JOBBER_CLIENT_SECRET` directly in the webhook handler (simpler — recommended).

**Warning signs:** All webhook signature verifications fail 401 after webhook registration. Jobber starts backing off retries after repeated failures.

[CITED: developer.getjobber.com/docs/using_jobbers_api/setting_up_webhooks/ — "generated using your app's OAuth client secret"]

### Pitfall 2: `'use cache'` must be the FIRST statement inside the function

**What goes wrong:** Any code before `'use cache'` (imports don't count, but a local `const` or `if` does) silently disables caching. No compile error. Function runs uncached on every call; cache tags never register; webhook invalidation appears to do nothing.

**Why it happens:** Next.js 16 parses the directive the same way `'use client'` works — it must be the module's or function's first statement. Devs used to React Compiler's looser rules miss this.

**How to avoid:** In `fetchJobberCustomerByPhone`, `'use cache'` is the FIRST line of the function body. No guard clauses, no debug logs, no type-checks before it. P55 codebase verifies this pattern [VERIFIED: src/lib/integrations/xero.js:62].

**Warning signs:** `revalidateTag('jobber-context-...')` runs but stale data still returned on next fetch. Dev tools "cache" panel shows no entries for the function.

### Pitfall 3: Refresh-token rotation — losing the new refresh_token breaks auth

**What goes wrong:** Python agent refreshes token but persists only `access_token` (or forgets to UPDATE). Next refresh attempts to use the OLD refresh_token → Jobber returns generic "invalid refresh token" → agent's Jobber fetch fails → `customer_context` is missing Jobber half on every call for that tenant until owner reconnects.

**Why it happens:** Refresh-token rotation is newer behavior; developers who've integrated Google/Microsoft OAuth (where refresh tokens are static) pattern-match wrongly. For apps created after Jan 2 2024, Jobber doesn't even detect old-token re-use — just returns a generic error.

**How to avoid:** Python-side `jobber.py` refresh path MUST `await supabase.from('accounting_credentials').update({access_token, refresh_token, expiry_date}).eq(...)` on every refresh, not just on OAuth callback. Same pitfall P55 flagged for Xero — but sharper in Jobber because rotation is always on.

**Warning signs:** Jobber fetch works once, fails every subsequent call after the first refresh. Owner sees Reconnect-needed banner within hours of connecting.

[CITED: developer.getjobber.com/docs/building_your_app/refresh_token_rotation/]

### Pitfall 4: Jobber phone field is free-form — normalization must happen on our side

**What goes wrong:** Matching caller's `+15551234567` against Jobber's `"(555) 123-4567"` fails because we compare strings. We miss the match; Jobber half of `customer_context` omitted; owner reports "AI doesn't recognize my existing clients."

**Why it happens:** Jobber stores whatever the Jobber admin typed. Variants: `"(555) 123-4567"`, `"555-1234"` (local — no area code!), `"+1 555.123.4567"`, `"5551234567"`, `"extension 405"`, etc.

**How to avoid:** Both sides (Next.js + Python) normalize Jobber's phones to E.164 before the comparison, using libphonenumber. Planner locks a single normalization function in Plan 02 and reuses it identically in Plan 05. Note: 7-digit local numbers with no area code cannot be normalized — document as known limitation and omit those from matching.

**Warning signs:** `fetchJobberCustomerByPhone` returns `{client: null}` on tenant-owner's own phone number despite clearly being in Jobber. Check Jobber's stored format for that client.

### Pitfall 5: Provider CHECK constraint already done — don't write another migration

**What goes wrong:** Developer writes migration 054 to "extend provider CHECK to include 'jobber'" — but migration 052 already did this in P54. Fresh migration either fails (constraint already exists) or silently succeeds as a no-op, creating migration noise.

**Why it happens:** P56 scope description mentions the provider CHECK; developer assumes it's this phase's work.

**How to avoid:** Read `supabase/migrations/052_integrations_schema.sql:26-28` — the CHECK already includes `'xero'` + `'jobber'`. P56 does NOT need a schema migration. Only exception: Plan's discretion for a `jobber_webhook_events` idempotency table (migration 054 if added; otherwise skip).

[VERIFIED: supabase/migrations/052_integrations_schema.sql:27-28]

### Pitfall 6: No webhook intent-verification handshake (unlike Xero)

**What goes wrong:** Developer ports the Xero webhook handler's intent-verify branch (Xero sends a probe expecting a specific 401-then-200 sequence) to the Jobber handler. The branch never fires because Jobber doesn't probe — but the developer keeps adding conditionals "just in case." Dead code accumulates.

**Why it happens:** P55 is the reference template; Xero's intent-verify is prominent in that code.

**How to avoid:** Jobber's webhook handler is simpler — HMAC verify + route. No handshake branch. First-time webhook registration in Jobber Developer Center just starts delivering events once the URL is saved. Documented explicitly in Pattern 4 above.

[CITED: developer.getjobber.com/docs/using_jobbers_api/setting_up_webhooks/ — no handshake mentioned]

### Pitfall 7: `X-JOBBER-GRAPHQL-VERSION` header is REQUIRED — missing it is a 400

**What goes wrong:** Developer forgets to set the version header; all GraphQL calls return 400 with a cryptic error message. Tenant sees empty Jobber half of `customer_context` regardless of connection state.

**Why it happens:** Many GraphQL APIs (Shopify, GitHub) treat version headers as optional hints. Jobber requires it.

**How to avoid:** Configure `graphql-request`'s `GraphQLClient` instance with the header at construction time:
```javascript
const client = new GraphQLClient('https://api.getjobber.com/api/graphql', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'X-JOBBER-GRAPHQL-VERSION': '2024-04-01',  // confirm latest stable at Plan 01
  },
});
```

**Warning signs:** 400 on every Jobber call. Error messages about "missing version." Check request headers in Sentry / debug logs.

[CITED: developer.getjobber.com/docs/using_jobbers_api/api_versioning/]

### Pitfall 8: Jobber accountId vs `accounting_credentials.xero_tenant_id` column

**What goes wrong:** Webhook payload's `accountId` is the per-tenant Jobber identifier. There's no dedicated column for it on `accounting_credentials` — the only provider-account column is `xero_tenant_id`, which is Xero-specific naming. Developer stores Jobber's accountId in… nowhere? Or in `display_name`? → webhook handler can't resolve accountId → tenantId, invalidates broad tag on every event.

**Why it happens:** Schema was built around Xero first; Jobber was a Phase 54 stub.

**How to avoid:** Two options (planner picks):
- (a) Repurpose `xero_tenant_id` column for Jobber's accountId; document the overloaded naming in a comment + skill update.
- (b) Add a new column `external_account_id TEXT` in a P56 migration (migration 054); backfill Xero rows by copying `xero_tenant_id`; query by provider-agnostic `external_account_id`.

Option (a) is simpler, option (b) is cleaner. Both are valid.

**Warning signs:** Webhook lookups all miss; all invalidations fall back to broad `jobber-context-${tenantId}`; performance fine but per-phone precision lost.

### Pitfall 9: Field-level merge hides data-layer discrepancies from owner

**What goes wrong:** Jobber says $500 outstanding, Xero says $0 (already reconciled). Merge picks Xero ($0). Correct for call UX — but owner has no signal that their Jobber→Xero sync is lagging. A support ticket arrives: "AI told my customer they're paid up, but my Jobber dashboard shows $500 owed."

**Why it happens:** Merge is designed to produce ONE authoritative figure; by design it suppresses disagreement in the prompt.

**How to avoid:** Accept this trade-off for P56 (CONTEXT.md Deferred Ideas: "Telemetry on Jobber/Xero discrepancy rate"). Log discrepancies to `activity_log` or a dedicated telemetry table in P58. Owner-facing surface is a P58+ concern. Document the known behavior in the skill update so support can recognize the pattern.

**Warning signs:** Support tickets about "AI said X but my dashboard says Y" — correlate timestamps with Jobber → Xero sync lag.

### Pitfall 10: `asyncio.gather` with `return_exceptions=True` doesn't cancel sibling tasks on timeout

**What goes wrong:** Jobber task takes 5 seconds. `asyncio.wait_for(..., timeout=0.8)` correctly raises TimeoutError for Jobber, but the Jobber HTTP call keeps running in the background until completion, burning CPU/connection resources. Under load, this amplifies.

**Why it happens:** `asyncio.wait_for` shields the outer future but doesn't propagate cancellation inside `httpx.AsyncClient.post()` reliably when the event loop is busy.

**How to avoid:** Use `httpx.AsyncClient` with its own `timeout=httpx.Timeout(connect=0.3, read=0.7)` so the HTTP call itself self-terminates at the socket level, not just at the asyncio layer. Combined with `asyncio.wait_for` for belt-and-suspenders.

**Warning signs:** Python agent memory growth over time; Sentry sees TimeoutError but Jobber sees successful (late) requests.

---

## Code Examples

### Example 1: `fetchJobberCustomerByPhone` Next.js function (JOBBER-02)

```javascript
// src/lib/integrations/jobber.js — P56 NEW
import { GraphQLClient, gql } from 'graphql-request';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { cacheTag } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { refreshTokenIfNeeded } from './adapter.js';

const JOBBER_GRAPHQL_URL = 'https://api.getjobber.com/api/graphql';
const JOBBER_API_VERSION = '2024-04-01';  // confirm latest at Plan 01

const FETCH_QUERY = gql`
  query FetchClientByPhone($phone: String!) {
    clients(first: 25, filter: { phoneNumber: $phone }) {
      nodes {
        id
        name
        emails { address }
        phones { number }
        jobs(first: 4, sort: [{ key: UPDATED_AT, direction: DESCENDING }]) {
          nodes {
            jobNumber title jobStatus startAt endAt
            visits(first: 1, filter: { status: UPCOMING }) { nodes { startAt } }
          }
        }
        invoices(first: 10) {
          nodes { invoiceNumber issuedDate amount amountOutstanding invoiceStatus }
        }
        visits(first: 1, sort: [{ key: COMPLETED_AT, direction: DESCENDING }], filter: { completed: true }) {
          nodes { endAt completedAt }
        }
      }
    }
  }
`;

const OUTSTANDING_STATUSES = new Set(['AWAITING_PAYMENT', 'BAD_DEBT', 'PARTIAL', 'PAST_DUE']);

export async function fetchJobberCustomerByPhone(tenantId, phoneE164) {
  'use cache';
  cacheTag(`jobber-context-${tenantId}`);
  cacheTag(`jobber-context-${tenantId}-${phoneE164}`);

  if (typeof tenantId !== 'string' || typeof phoneE164 !== 'string') return { client: null };
  if (!/^\+[1-9]\d{6,14}$/.test(phoneE164)) return { client: null };

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data: cred } = await admin
    .from('accounting_credentials')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('provider', 'jobber')
    .maybeSingle();
  if (!cred) return { client: null };

  let refreshed;
  try {
    refreshed = await refreshTokenIfNeeded(admin, cred);
  } catch {
    return { client: null };
  }

  const gqlClient = new GraphQLClient(JOBBER_GRAPHQL_URL, {
    headers: {
      'Authorization': `Bearer ${refreshed.access_token}`,
      'X-JOBBER-GRAPHQL-VERSION': JOBBER_API_VERSION,
    },
  });

  let data;
  try {
    data = await gqlClient.request(FETCH_QUERY, { phone: phoneE164 });
  } catch {
    return { client: null };
  }

  const candidates = data?.clients?.nodes ?? [];
  const client = candidates.find((c) =>
    (c.phones || []).some((p) => {
      const parsed = parsePhoneNumberFromString(p.number || '', 'US');  // default region configurable
      return parsed?.isValid() && parsed.format('E.164') === phoneE164;
    }),
  );
  if (!client) return { client: null };

  // Sort jobs: upcoming-visit ASC, then updatedAt DESC (CONTEXT D-02)
  const now = new Date();
  const jobs = (client.jobs?.nodes ?? [])
    .map((j) => {
      const nextVisit = j.visits?.nodes?.[0]?.startAt ?? null;
      return {
        jobNumber: j.jobNumber,
        title: j.title,
        status: j.jobStatus,
        startAt: j.startAt,
        endAt: j.endAt,
        nextVisitDate: nextVisit,
      };
    })
    .sort((a, b) => {
      const aFuture = a.nextVisitDate && new Date(a.nextVisitDate) >= now;
      const bFuture = b.nextVisitDate && new Date(b.nextVisitDate) >= now;
      if (aFuture && bFuture) return new Date(a.nextVisitDate) - new Date(b.nextVisitDate);
      if (aFuture) return -1;
      if (bFuture) return 1;
      return 0;  // fall back to connection's UPDATED_AT DESC from GraphQL
    })
    .slice(0, 4);

  // Outstanding invoices (CONTEXT D-03)
  const invoiceNodes = client.invoices?.nodes ?? [];
  const outstanding = invoiceNodes.filter((inv) => OUTSTANDING_STATUSES.has(inv.invoiceStatus));
  const outstandingBalance = outstanding.reduce((s, inv) => s + (Number(inv.amountOutstanding) || 0), 0);
  const outstandingInvoices = outstanding.slice(0, 3).map((inv) => ({
    invoiceNumber: inv.invoiceNumber,
    issuedAt: inv.issuedDate,
    amount: Number(inv.amount) || 0,
    amountOutstanding: Number(inv.amountOutstanding) || 0,
    status: inv.invoiceStatus,
  }));

  const lastVisitDate = client.visits?.nodes?.[0]?.endAt ?? null;

  // Telemetry (CONTEXT §Telemetry Seed)
  await admin
    .from('accounting_credentials')
    .update({ last_context_fetch_at: new Date().toISOString() })
    .eq('id', cred.id);

  return {
    client: { id: client.id, name: client.name, email: client.emails?.[0]?.address ?? null },
    recentJobs: jobs,
    outstandingInvoices,
    outstandingBalance,  // merge helper reads this as fallback when Xero absent
    lastVisitDate,
  };
}
```

### Example 2: Webhook handler `/api/webhooks/jobber/route.js` (JOBBER-03)

```javascript
// src/app/api/webhooks/jobber/route.js — P56 NEW
import crypto from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { GraphQLClient, gql } from 'graphql-request';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { refreshTokenIfNeeded } from '@/lib/integrations/adapter';

const RESOLVE_CLIENT_BY_ID = gql`
  query($id: EncodedId!) {
    client(id: $id) { phones { number } }
  }
`;

const RESOLVE_CLIENT_FROM_JOB = gql`query($id: EncodedId!) { job(id: $id) { client { id phones { number } } } }`;
const RESOLVE_CLIENT_FROM_INVOICE = gql`query($id: EncodedId!) { invoice(id: $id) { client { id phones { number } } } }`;

export async function POST(request) {
  const rawBody = await request.text();
  const sig = request.headers.get('x-jobber-hmac-sha256');
  const secret = process.env.JOBBER_CLIENT_SECRET;  // HMAC key IS client_secret

  if (!sig || !secret) return new Response('', { status: 401 });

  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');

  let valid = false;
  try {
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { valid = false; }
  if (!valid) return new Response('', { status: 401 });

  let payload;
  try { payload = JSON.parse(rawBody); } catch { return new Response('', { status: 200 }); }

  const evt = payload?.data?.webHookEvent;
  if (!evt) return new Response('', { status: 200 });

  const { topic, accountId, itemId } = evt;
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Lookup tenant by Jobber accountId (stored in xero_tenant_id column — see Pitfall 8)
  const { data: cred } = await admin
    .from('accounting_credentials')
    .select('*')
    .eq('provider', 'jobber')
    .eq('xero_tenant_id', accountId)
    .maybeSingle();
  if (!cred) return new Response('', { status: 200 });  // silent-ignore unknown tenants

  const vocoTenantId = cred.tenant_id;

  // Resolve topic → phones
  let phones = [];
  try {
    const refreshed = await refreshTokenIfNeeded(admin, cred);
    const gqlClient = new GraphQLClient('https://api.getjobber.com/api/graphql', {
      headers: {
        'Authorization': `Bearer ${refreshed.access_token}`,
        'X-JOBBER-GRAPHQL-VERSION': '2024-04-01',
      },
    });

    let rawPhones = [];
    if (topic.startsWith('CLIENT_')) {
      const r = await gqlClient.request(RESOLVE_CLIENT_BY_ID, { id: itemId });
      rawPhones = r?.client?.phones ?? [];
    } else if (topic.startsWith('JOB_') || topic.startsWith('VISIT_')) {
      const r = await gqlClient.request(RESOLVE_CLIENT_FROM_JOB, { id: itemId });
      rawPhones = r?.job?.client?.phones ?? [];
    } else if (topic.startsWith('INVOICE_')) {
      const r = await gqlClient.request(RESOLVE_CLIENT_FROM_INVOICE, { id: itemId });
      rawPhones = r?.invoice?.client?.phones ?? [];
    }

    phones = rawPhones
      .map((p) => parsePhoneNumberFromString(p.number || '', 'US'))
      .filter((p) => p?.isValid())
      .map((p) => p.format('E.164'));
  } catch {
    phones = [];
  }

  if (phones.length === 0) {
    revalidateTag(`jobber-context-${vocoTenantId}`);
  } else {
    for (const phone of phones) {
      revalidateTag(`jobber-context-${vocoTenantId}-${phone}`);
    }
  }

  return new Response('', { status: 200 });
}
```

### Example 3: Python `jobber_context_task` integration in `_run_db_queries`

```python
# livekit-agent/src/agent.py — modification around line 316
import asyncio
import hashlib
import sentry_sdk
from src.integrations.jobber import fetch_jobber_customer_by_phone
from src.lib.customer_context import merge_customer_context

async def _run_db_queries(deps, from_number):
    # existing tasks: subscription, intake, call_record, xero_context_task (P55)
    # ADD jobber_context_task (P56)
    xero_context_task = asyncio.create_task(
        asyncio.wait_for(fetch_xero_customer_by_phone(deps.tenant_id, from_number), timeout=0.8)
    )
    jobber_context_task = asyncio.create_task(
        asyncio.wait_for(fetch_jobber_customer_by_phone(deps.tenant_id, from_number), timeout=0.8)
    )
    
    results = await asyncio.gather(
        sub_task, intake_task, call_task,
        xero_context_task, jobber_context_task,
        return_exceptions=True,
    )
    
    xero_result, jobber_result = results[3], results[4]
    
    def _extract(r, provider):
        if isinstance(r, asyncio.TimeoutError):
            sentry_sdk.capture_message(
                f"{provider}_context_timeout",
                tags={"tenant_id": deps.tenant_id,
                      "phone_hash": hashlib.sha256(from_number.encode()).hexdigest()[:8]},
            )
            return None
        if isinstance(r, Exception):
            sentry_sdk.capture_exception(r, tags={"provider": provider, "tenant_id": deps.tenant_id})
            return None
        return r
    
    xero_ctx = _extract(xero_result, "xero")
    jobber_ctx = _extract(jobber_result, "jobber")
    
    deps.customer_context = merge_customer_context(jobber=jobber_ctx, xero=xero_ctx)
```

### Example 4: `merge_customer_context` helper — Python

See Pattern 10 above for full implementation.

### Example 5: Extended `check_customer_account` tool (JOBBER-05)

```python
# livekit-agent/src/tools/check_customer_account.py — MODIFY (data source extension only)
@function_tool
async def check_customer_account(ctx: RunContext) -> str:
    """Re-serve merged customer_context as STATE + DIRECTIVE per P55 D-09.
    P56 change: `deps.customer_context` is now the merged dict (Jobber + Xero), not Xero-only.
    No signature change, no re-fetch.
    """
    cc = ctx.session.userdata.deps.customer_context
    if not cc:
        return (
            "STATE: no_customer_match_for_phone. "
            "DIRECTIVE: Treat as new or walk-in customer. Do not claim to have any records on file."
        )
    
    parts = ["STATE:"]
    sources = cc.get("_sources", {})
    
    if cc.get("client"):
        parts.append(f"client={cc['client'].get('name','unknown')} ({sources.get('client','?')});")
    if cc.get("recentJobs"):
        jobs_str = ", ".join(
            f"{j['jobNumber']} \"{j['title']}\" status={j['status']}" +
            (f" next_visit={j['nextVisitDate']}" if j.get('nextVisitDate') else "")
            for j in cc['recentJobs']
        )
        parts.append(f"recent_jobs=[{jobs_str}] ({sources.get('recentJobs','?')});")
    if cc.get("lastVisitDate"):
        parts.append(f"last_visit={cc['lastVisitDate']} ({sources.get('lastVisitDate','?')});")
    if cc.get("outstandingBalance") is not None:
        n = len(cc.get("lastInvoices", []) or [])
        parts.append(f"outstanding_balance=${cc['outstandingBalance']} across {n} invoices ({sources.get('outstandingBalance','?')});")
    if cc.get("lastPaymentDate"):
        parts.append(f"last_payment={cc['lastPaymentDate']} ({sources.get('lastPaymentDate','?')}).")
    
    state = " ".join(parts)
    directive = (
        "DIRECTIVE: Answer factually only if the caller explicitly asks about their balance, "
        "bill, or recent work. Do not read invoice numbers unless asked. Do not volunteer figures."
    )
    return f"{state}\n{directive}"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-tenant webhook signing keys | Single app-level HMAC key = OAuth client_secret (Jobber) | Jobber's default | Fewer secrets to rotate; HMAC verify must read client_secret, not a separate env var |
| Static refresh tokens (Google/MSFT pattern) | Mandatory refresh-token rotation (Jobber) | Default since ~2023 | Every refresh MUST persist the new refresh_token; old token fails silently |
| REST-based accounting APIs (Xero) | GraphQL-only (Jobber) | Jobber's design choice | Different client library, different query patterns, different batching mindset (one query > multiple REST calls) |
| Optional API version header | REQUIRED `X-JOBBER-GRAPHQL-VERSION` header | Jobber's versioning policy | Missing header = 400; 12-month support window per version |
| Fixed `'use cache'` on class methods | Module-level `'use cache'` + class delegation | Next.js 16 | P55 confirmed; carried forward to P56 |
| Webhook intent-verify handshakes (Xero, Stripe) | No handshake (Jobber) | Jobber's default | Simpler handler; no 401-then-200 probe branch |
| Dedicated `accounting_credentials.xero_tenant_id` column | Overload column for both providers OR add provider-agnostic column | P56 decision | Pitfall 8 — planner picks option (a) or (b) |

**Deprecated/outdated:**
- Apollo Client for server-side caching in Next.js 16 — conflicts with `'use cache'`. Use `graphql-request` or raw fetch.
- Google's full `libphonenumber` — bundle bloat. Prefer `libphonenumber-js` for parse+format.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Jobber's `clients` query supports `filter: { phoneNumber: $phone }` directly | Pattern 5, Example 1 | If unsupported, must fall back to paginated `clients(first: 50)` + JS-side filter; adds latency. Confirm in GraphiQL at Plan 01. |
| A2 | `Client.visits` connection exists with `sort: COMPLETED_AT DESC` and `filter: completed:true` | Pattern 5, Example 1 | If missing, derive `lastVisitDate` by flattening `Job.visits` edges in the same query; query grows but still single round-trip. |
| A3 | `Invoice.invoiceStatus` enum contains `{AWAITING_PAYMENT, BAD_DEBT, PARTIAL, PAST_DUE, DRAFT, PAID, VOIDED}` verbatim | Pattern 5 | If casing differs (e.g., `awaitingPayment`), adjust `OUTSTANDING_STATUSES` Set. Low risk — 2-minute fix. |
| A4 | `Job.jobStatus` enum contains the 8 values CONTEXT D-02 lists verbatim | Pattern 5 | If differs, STATE prompt just renders Jobber's actual values — no code breakage. Document actual enum in skill update. |
| A5 | Jobber webhook payload is exactly `{data: {webHookEvent: {topic, appId, accountId, itemId, occurredAt}}}` | Example 2, Pattern 4 | If shape differs, handler parsing breaks. Medium risk — confirmed against docs excerpt, verify with live webhook test payload at Plan 04. |
| A6 | `accountId` in webhook payload = per-tenant Jobber account identifier (stable across logins) | Example 2, Pitfall 8 | If accountId changes after re-auth, row lookup misses → all invalidations become broad-tag. Confirm by reconnecting sandbox and checking value stability. |
| A7 | Jobber rejects requests without `X-JOBBER-GRAPHQL-VERSION` header with 400 | Pitfall 7 | If header actually optional, no failure mode — but docs explicitly say "required". Low risk. |
| A8 | Jobber does NOT offer a public revoke endpoint | Pattern 2 | If undocumented revoke exists, owners would revoke at Jobber but our disconnect doesn't tell Jobber → Jobber still lists app as connected until owner manually disconnects there. Low risk — Phase 55 Xero has explicit revoke; Jobber silent disconnect matches Google Calendar's behavior. |
| A9 | Python livekit-agent has `httpx >= 0.27` already pinned from P55 | Standard Stack Python | If missing, add to `pyproject.toml` in Plan 05. Low risk — verify at Plan 05 start. |
| A10 | `src/lib/phone.py:_normalize_phone` handles Jobber's free-form formats (including `(XXX) XXX-XXXX` + dashes + spaces + intl prefixes) | Don't Hand-Roll | If existing normalizer only handles E.164 inputs, must add `phonenumbers` Python package. Verify at Plan 05 start by testing against Jobber sample phones. |
| A11 | Jobber's `clients.nodes` returns up to 25 per page by default with `first: 25` | Pattern 5 | Rate-limits + cost calculation research confirmed pagination works; 25 is safe. Low risk. |
| A12 | Jobber accountId maps to exactly one Voco tenant via `accounting_credentials` unique key | Pattern 4, Pitfall 8 | If multiple Voco tenants connect the same Jobber account (unusual), invalidation fires for the first match only. CONTEXT.md Deferred Ideas mentions this as multi-tenant phone collision — same pattern. Low risk given phase of project. |

**If this table is empty:** All claims verified — N/A; 12 assumptions need confirmation at implementation time (GraphiQL probe at Plan 01, webhook test payload at Plan 04, Python dep check at Plan 05).

---

## Open Questions (RESOLVED)

All questions below have been resolved via either (a) inline recommendations that have been adopted as planning decisions, or (b) explicit deferral to a specific plan task where a live-system probe locks the final answer. No blocking unknowns remain at plan-approval time.

1. **Exact Jobber GraphQL filter syntax for phone number matching.**
   - What we know: `ClientFilterAttributes` exists as a filter input type; `phones` field exists on Client.
   - What's unclear: whether `filter: { phoneNumber: ... }` is the supported key name, or whether `searchTerm` is the catch-all.
   - **DEFERRED TO PLAN 01 TASK 2 (GraphiQL probe):** The pre-step of Plan 01 Task 2 performs a GraphiQL probe against `Developer Center > Test in GraphiQL > Documentation` and locks the exact filter key BEFORE writing `fetchJobberCustomerByPhone`. Fallback: paginate `clients(first: 50)` + JS-side filter if no phone-specific filter exists. This deferral is explicitly embedded in Plan 01 Task 2's A1/A2/A3/A4 checklist.

2. **Jobber API version to pin.**
   - What we know: Format `YYYY-MM-DD`; 12-month support window; must be in `X-JOBBER-GRAPHQL-VERSION` header.
   - What's unclear: Latest stable version as of 2026-04-18 (changelog not fetched).
   - **DEFERRED TO PLAN 01 TASK 2 (GraphiQL probe):** The pre-step of Plan 01 Task 2 reads `developer.getjobber.com/docs/changelog` and pins the most recent stable version as `JOBBER_API_VERSION` constant in `src/lib/integrations/jobber.js`. Current code uses `2024-04-01` as the research-time baseline; Task 2 confirms or bumps. Also mirrored into the Python adapter (Plan 05) and webhook handler (Plan 03).

3. **Should `xero_tenant_id` column be repurposed for Jobber accountId, or should a new `external_account_id` column be added?**
   - What we know: Repurposing works with zero migration; adding a column is one migration.
   - What's unclear: Which is cleaner for P57+ (schedule mirror) and P58 (telemetry).
   - **RESOLVED:** Add a new `external_account_id TEXT` column via migration 054. Rationale: P57 also introduces `calendar_events.provider='jobber'` and a clean provider-agnostic column name avoids debt. `xero_tenant_id` is retained (backfilled into `external_account_id`) for P55 backward compatibility and deprecated in a future P58 cleanup. Locked in Plan 02 Task 1.

4. **Should `JOBBER_WEBHOOK_SECRET` env var exist separately, or should the handler read `JOBBER_CLIENT_SECRET` directly?**
   - What we know: They're the same value (Jobber uses client_secret as HMAC key).
   - What's unclear: Whether the P58 telemetry phase might want to rotate them independently.
   - **RESOLVED:** Read `JOBBER_CLIENT_SECRET` directly in `/api/webhooks/jobber/route.js`. No separate `JOBBER_WEBHOOK_SECRET` env var is introduced in P56. `.env.example` (Plan 02 Task 2) carries a comment block documenting the overload so future contributors don't hunt for a missing webhook secret. Locked in Plan 02 Task 2 + Plan 03 Task 2.

5. **Should webhook events be deduplicated via a `jobber_webhook_events` table?**
   - What we know: `revalidateTag` is idempotent; Jobber is at-least-once; volume is low.
   - What's unclear: Whether P58 telemetry will reveal duplicate storm patterns requiring dedup.
   - **RESOLVED:** Skip the dedup table in P56. The webhook handler relies on `revalidateTag` idempotency to absorb duplicates. P58 will revisit only if telemetry surfaces duplicate amplification (tracked as a deferred idea in CONTEXT.md).

6. **Auto-register webhook subscriptions on OAuth callback, or require owner to configure in Developer Center?**
   - What we know: Jobber webhooks are configured at the APP level (Developer Center), not per-install.
   - What's unclear: Whether there's a GraphQL mutation to subscribe/unsubscribe topics programmatically.
   - **RESOLVED:** Leave as app-level configuration in the Jobber Developer Center (set once when registering the app across all 5 topic subscriptions: `CLIENT_UPDATE`, `JOB_UPDATE`, `INVOICE_UPDATE`, `VISIT_COMPLETE`, `VISIT_UPDATE` — CONTEXT D-12). Not a per-tenant action; no code emits a subscribe mutation. Plan 07 skill updates document this for future contributors. Plan 56-VALIDATION.md Manual-Only row 3 enumerates the topics for the operator configuring Developer Center.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7 + `node --experimental-vm-modules` (ESM-compatible) |
| Config file | Package.json `scripts.test` (no jest.config file — default + project conventions) |
| Quick run command | `npm test -- tests/integrations/jobber` |
| Full suite command | `npm test` |

On the Python side (cross-repo livekit-agent):
| Property | Value |
|----------|-------|
| Framework | `pytest` (assumed — P55 `tests/test_*.py` convention) |
| Quick run command | `pytest tests/test_jobber_integration.py -x` (in livekit-agent repo) |
| Full suite command | `pytest` (in livekit-agent repo) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| JOBBER-01 | OAuth auth URL contains client_id + state | unit | `npm test -- tests/integrations/jobber.adapter.test.js` | ❌ Wave 0 |
| JOBBER-01 | `exchangeCode` returns tokens + parses JWT expiry | unit (mocked POST) | `npm test -- tests/integrations/jobber.adapter.test.js` | ❌ Wave 0 |
| JOBBER-01 | `refreshToken` persists rotated refresh_token | unit (mocked POST + Supabase spy) | `npm test -- tests/integrations/jobber.refresh.test.js` | ❌ Wave 0 |
| JOBBER-02 | `fetchJobberCustomerByPhone` returns correct shape on match | unit (mocked GraphQLClient) | `npm test -- tests/integrations/jobber.fetch.test.js` | ❌ Wave 0 |
| JOBBER-02 | Phone normalization — (555) 123-4567 matches +15551234567 | unit | `npm test -- tests/integrations/jobber.phone-match.test.js` | ❌ Wave 0 |
| JOBBER-02 | `'use cache'` + two-tier cacheTag registered | integration (Next.js test harness) | `npm test -- tests/integrations/jobber.cache.test.js` | ❌ Wave 0 |
| JOBBER-02 | <500ms p95 latency | manual perf test (cache-warm) | k6/hey script in Plan 02 | ❌ Wave 0 |
| JOBBER-03 | Webhook HMAC bad sig → 401 | integration | `npm test -- tests/api/webhooks/jobber.route.test.js` | ❌ Wave 0 |
| JOBBER-03 | Webhook good sig + known tenant → 200 + `revalidateTag` called | integration (mocked revalidate) | same file | ❌ Wave 0 |
| JOBBER-03 | Webhook good sig + unknown accountId → silent 200 | integration | same file | ❌ Wave 0 |
| JOBBER-03 | CLIENT_UPDATE → client lookup → per-phone `revalidateTag` | integration | same file | ❌ Wave 0 |
| JOBBER-03 | JOB_UPDATE → job→client lookup → per-phone `revalidateTag` | integration | same file | ❌ Wave 0 |
| JOBBER-04 | Merge — Jobber wins client/recentJobs/lastVisitDate | unit (Python) | `pytest tests/test_customer_context_merge.py -x` | ❌ Wave 0 (cross-repo) |
| JOBBER-04 | Merge — Xero wins outstandingBalance/lastPaymentDate | unit (Python) | same file | ❌ Wave 0 (cross-repo) |
| JOBBER-04 | Merge — both miss returns None | unit (Python) | same file | ❌ Wave 0 (cross-repo) |
| JOBBER-04 | `_run_db_queries` 5th task with 800ms timeout | unit (Python) | `pytest tests/test_agent_jobber_timeout.py -x` | ❌ Wave 0 (cross-repo) |
| JOBBER-05 | `check_customer_account` serves merged dict as STATE+DIRECTIVE | unit (Python) | `pytest tests/test_check_customer_account.py::test_merged_both_providers -x` | ❌ Wave 0 (cross-repo) |
| JOBBER-05 | `check_customer_account` no-match returns locked string | unit (Python) | same file | ❌ Wave 0 (cross-repo) |
| (Setup checklist) | `connect_jobber` appears with auto-completion | integration | `npm test -- tests/api/setup-checklist-jobber.test.js` | ❌ Wave 0 |
| (Email) | `notifyJobberRefreshFailure` sends with correct subject | unit (mocked Resend) | `npm test -- tests/notifications/jobber-refresh-email.test.js` | ❌ Wave 0 |
| (UI bug fix) | Banner uses `meta.name` not hardcoded "Xero" | unit (RTL) | `npm test -- tests/components/BusinessIntegrationsClient.test.jsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** run the specific test file for that task (~5-10 tests, <5s)
- **Per wave merge:** run `npm test -- tests/integrations` + `npm test -- tests/api/webhooks/jobber` (~30-40 tests, <15s)
- **Phase gate:** full suite green (Next.js side) + Python test suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/integrations/jobber.adapter.test.js` — covers JOBBER-01 (auth URL, exchangeCode, revoke)
- [ ] `tests/integrations/jobber.refresh.test.js` — covers JOBBER-01 rotation write-back
- [ ] `tests/integrations/jobber.fetch.test.js` — covers JOBBER-02 happy path + match + no-match
- [ ] `tests/integrations/jobber.phone-match.test.js` — covers JOBBER-02 phone normalization cases
- [ ] `tests/integrations/jobber.cache.test.js` — covers JOBBER-02 `'use cache'` + tag registration (mirror of `xero.cache.test.js`)
- [ ] `tests/api/webhooks/jobber.route.test.js` — covers JOBBER-03 all branches (HMAC, unknown tenant, event-type routing)
- [ ] `tests/api/setup-checklist-jobber.test.js` — mirrors `setup-checklist-xero.test.js`
- [ ] `tests/notifications/jobber-refresh-email.test.js` — Resend send assertion
- [ ] `tests/components/BusinessIntegrationsClient.test.jsx` — banner text substitution + Preferred badge render condition
- [ ] Python (cross-repo): `tests/test_jobber_integration.py`, `tests/test_customer_context_merge.py`, `tests/test_agent_jobber_timeout.py`, `tests/test_check_customer_account.py` (extend existing)

Existing fixtures + test-harness patterns from P55 (`tests/integrations/xero.*.test.js`, `tests/api/webhooks/xero/`) are direct templates — copy + swap provider name + test data.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | OAuth 2.0 flow with HMAC-signed state param (reuse P54 `signOAuthState`/`verifyOAuthState` from `src/app/api/google-calendar/auth/route.js`) |
| V3 Session Management | yes | Tenant resolution via `getTenantId()` on server side; NEVER trust body-supplied tenant_id |
| V4 Access Control | yes | RLS on `accounting_credentials` (shipped with migration 052); service-role reads only in cached fetcher |
| V5 Input Validation | yes | E.164 regex guard on `phoneE164` input; GraphQL variables passed as typed params (graphql-request auto-escapes); webhook body parsed only after HMAC verify |
| V6 Cryptography | yes | Node `crypto.createHmac` + `crypto.timingSafeEqual` — never hand-roll |
| V7 Error Handling & Logging | yes | Never log `cred.access_token`, `cred.refresh_token`, or full Jobber error response bodies (may echo tokens). Use existing P55 error-sanitizing pattern. |
| V9 Communication Security | yes | All Jobber endpoints are HTTPS; TLS verification enforced by Node's default `https` agent |
| V14 Configuration | yes | `JOBBER_CLIENT_SECRET` must be stored in secrets manager (Vercel env vars), never committed; `.env.example` has empty placeholder values |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Webhook replay — attacker re-sends captured webhook to poison cache | Tampering | HMAC verify on raw body; Jobber delivery is at-least-once so idempotent `revalidateTag` absorbs duplicates; optional `occurredAt` timestamp gate if replay attacks observed |
| Token leakage via error logs | Information disclosure | Never log `cred` fields; scrub error response bodies before Sentry capture |
| Refresh-token theft + race — attacker with stolen refresh_token races legitimate refresh | Spoofing | Jobber's rotation invalidates the loser; persist new refresh_token atomically (single UPDATE); tenant re-auth required on detected break |
| Cross-tenant data leakage via `phoneE164` collision | Information disclosure | Cache tags are tenant-scoped (`jobber-context-${tenantId}-${phoneE164}`); `fetchJobberCustomerByPhone` reads tenant-specific row with `.eq('tenant_id', tenantId)` — tenant_id always comes from server-authenticated context |
| GraphQL query cost overrun | DoS | Jobber enforces 2500 req / 5 min per app. P56 cache absorbs bulk; single-query batching keeps per-fetch cost low. Add back-off in P58 if 429s observed. |
| HMAC timing-attack against webhook secret | Spoofing | `crypto.timingSafeEqual` — constant-time compare; returns immediately on length mismatch |
| Phone-based callerID spoofing (caller enters a customer's phone to extract data) | Spoofing | Out of scope for P56 — Voice pipeline doesn't validate ANI; treat `customer_context` as convenience, not proof of identity. Document in skill update as known limitation. Addressable in future via CNAM/STIR-SHAKEN. |

---

## Sources

### Primary (HIGH confidence)

- [Jobber Developer — API Authorization (OAuth 2.0)](https://developer.getjobber.com/docs/building_your_app/app_authorization/) — authorize + token endpoint URLs, parameter requirements, scope configuration (Developer Center UI only)
- [Jobber Developer — Refresh Token Rotation](https://developer.getjobber.com/docs/building_your_app/refresh_token_rotation/) — 60-minute access-token lifetime; rotation mandatory; post-Jan-2-2024 no detection of old refresh token re-use
- [Jobber Developer — Setting up Webhooks](https://developer.getjobber.com/docs/using_jobbers_api/setting_up_webhooks/) — `X-Jobber-Hmac-SHA256` header, HMAC-SHA256 keyed by client_secret, at-least-once delivery, payload shape, per-app scope, Developer Center registration
- [Jobber Developer — API Versioning](https://developer.getjobber.com/docs/using_jobbers_api/api_versioning/) — `X-JOBBER-GRAPHQL-VERSION` required; YYYY-MM-DD format; 12-month support window
- [Jobber Developer — API Queries and Mutations](https://developer.getjobber.com/docs/using_jobbers_api/api_queries_and_mutations/) — GraphQL patterns; `clients(first, after, filter)` shape; `ClientFilterAttributes`
- [Jobber Developer — API Rate Limits](https://developer.getjobber.com/docs/using_jobbers_api/api_rate_limits/) — 2500 req / 5 min / app
- `src/lib/integrations/xero.js` (local) — P55 reference implementation, directly mirrored in Pattern 1, Example 1
- `src/app/api/webhooks/xero/route.js` (local) — P55 webhook template, directly mirrored in Pattern 4, Example 2
- `src/lib/integrations/adapter.js` (local) — `refreshTokenIfNeeded` already supports rotation write-back
- `supabase/migrations/052_integrations_schema.sql` (local) — `provider` CHECK already includes `'jobber'`
- `supabase/migrations/053_xero_error_state.sql` (local) — `error_state` column reused for Jobber token-refresh failures
- `.planning/phases/55-xero-read-side-integration-caller-context/55-RESEARCH.md` (local) — full P55 research; decisions carried forward

### Secondary (MEDIUM confidence)

- [Rollout — Jobber API Essential Guide](https://rollout.com/integration-guides/jobber/api-essentials) — cross-confirms GraphQL filter patterns
- [DEV Community — Refresh Token Rotation: What, Why and How? (Jobber authored)](https://dev.to/jobber/refresh-token-rotation-what-why-and-how-2eh) — implementation details on rotation
- [DEV Community — Building an App in Jobber Platform](https://dev.to/jobber/building-an-app-in-jobber-platform-5259) — end-to-end integration walk-through
- [npm — graphql-request](https://www.npmjs.com/package/graphql-request) — 7.4.0 published 2025-12-12

### Tertiary (LOW confidence — flag for verification at Plan 01)

- [Apitracker — Jobber API Docs/SDKs/Integration](https://apitracker.io/a/jobber) — third-party summary; inputs partially out of date
- Exact field/enum names on `Client`, `Job`, `Visit`, `Invoice` types — assumed per CONTEXT.md; verify in GraphiQL

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package versions verified via `npm view`; P55 libraries unchanged
- Architecture (Next.js): HIGH — direct mirror of P55 code I've verified line-by-line
- Architecture (Python): MEDIUM — cross-repo, inferred from P55 research doc + CONTEXT.md, not directly verified
- Pitfalls: HIGH on items 1, 2, 3, 5, 6, 7 (Jobber-specific docs cited or P55 codebase verified); MEDIUM on items 4, 8, 9, 10 (inferred from domain knowledge + CONTEXT.md hints)
- GraphQL query shape: MEDIUM — field names and filter keys assumed per standard GraphQL conventions; must verify in GraphiQL at Plan 01

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (30 days) — Jobber's schema and versions evolve; re-verify if execution slips past this date

**CONTEXT.md D-14 clarification needed:** The locked decision references `JOBBER_WEBHOOK_SECRET`. This research establishes that the HMAC key IS `JOBBER_CLIENT_SECRET`. Planner should either document the overload in `.env.example` (both names point to same value) or drop the separate env var. Does not block planning — just needs a one-line call-out.

**CONTEXT.md D-04 (`lastVisitDate`) clarification needed:** The locked decision says "use `Client.visits(last: 1, filter: {completed: true})` if exposed, else pull from `Job.visits` edges." This is ambiguous for the planner. Plan 01's first subtask should be a GraphiQL probe that resolves which path is available, and lock the query then.

---
phase: 56-jobber-read-side-integration-customer-context-clients-jobs-invoices
plan: 03
subsystem: integrations
tags: [jobber, webhook, hmac, graphql, cache-invalidation, oauth]

requires:
  - phase: 54-integration-credentials-foundation
    provides: accounting_credentials table, /api/integrations/[provider]/callback/route.js provider-agnostic handler
  - phase: 56-jobber-read-side-integration-customer-context-clients-jobs-invoices-01
    provides: fetchJobberCustomerByPhone cached tags (jobber-context-${tenantId}[-${phoneE164}])
  - phase: 56-jobber-read-side-integration-customer-context-clients-jobs-invoices-02
    provides: accounting_credentials.external_account_id column (tenant lookup key)
provides:
  - /api/webhooks/jobber route — HMAC-verified Jobber webhook endpoint with per-phone cache invalidation
  - Jobber-only OAuth callback account-id probe — writes accounting_credentials.external_account_id on connect
affects: [56-04, 56-05, 57]

tech-stack:
  added: []
  patterns:
    - "Webhook HMAC-SHA256 raw-body verify keyed by JOBBER_CLIENT_SECRET (no separate webhook secret — research Pitfall 1)"
    - "timingSafeEqual constant-time compare with equal-length Buffer guard"
    - "Silent-200 on every non-auth failure path (prevents Jobber at-least-once retry storms)"
    - "Topic-prefix routing: CLIENT_* / JOB_* / VISIT_* / INVOICE_* → targeted GraphQL resolve → per-phone revalidateTag"
    - "Broad-tag fallback on any GraphQL failure or zero valid phones (jobber-context-${tenantId})"
    - "Post-token-exchange GraphQL probe `query { account { id } }` to populate external_account_id; failure is non-fatal (tokens stay, UI surfaces reconnect prompt)"

key-files:
  created:
    - src/app/api/webhooks/jobber/route.js
    - tests/api/webhooks/jobber/route.test.js
    - tests/api/integrations/jobber-callback.test.js
  modified:
    - src/app/api/integrations/[provider]/callback/route.js

key-decisions:
  - "Reuse JOBBER_CLIENT_SECRET for webhook HMAC (no separate JOBBER_WEBHOOK_SECRET env var) — matches Jobber's documented behavior per research Pitfall 1"
  - "Silent-200 on unknown accountId (after HMAC verify passes) — mirrors P55 D-07 / CONTEXT D-14; prevents retry storms for disconnected tenants"
  - "VISIT_* topics route through the JOB GraphQL resolver (visit→parent job→client) — single query path, keeps the handler simple; Plan 04 Task 3 confirmed parent-job traversal sufficient"
  - "Unknown topic falls through to broad-tag fallback (not 400 error) — keeps handler future-proof if Jobber adds new topics to our subscription"
  - "Probe failure at OAuth callback does NOT delete tokens — degraded state (external_account_id=NULL) with UI-level reconnect prompt; webhook silently no-ops until user reconnects. Less destructive than rolling back the upsert."
  - "Probe runs ONLY for provider === 'jobber' — Xero path literally unchanged (T-CB-4 asserts this)"
  - "5s AbortController timeout on probe — callback is interactive, not a hot path"
  - "isPossible() phone-validity gate (not isValid()) — consistent with Plan 01 decision; libphonenumber-js's isValid() rejects fictional 555 NXX test numbers which are the shape the plan's own test fixtures use"

patterns-established:
  - "Webhook handler shape for Jobber-family providers: raw-body HMAC verify → topic-prefix switch → GraphQL resolve → normalize → per-phone revalidateTag with broad fallback"
  - "Provider-specific post-token-exchange probe hook inside the provider-agnostic callback — gated on provider name, no base-handler restructuring"

requirements-completed:
  - JOBBER-03

metrics:
  duration: "~35min"
  tasks: 3
  files: 4
  commits: 4
completed: 2026-04-19
---

# Phase 56 Plan 03: Jobber webhook endpoint + OAuth callback account-id probe Summary

**Ships `/api/webhooks/jobber` — an HMAC-verified (via JOBBER_CLIENT_SECRET) Jobber webhook that resolves CLIENT_UPDATE / JOB_UPDATE / INVOICE_UPDATE / VISIT_COMPLETE / VISIT_UPDATE events into per-phone `revalidateTag('jobber-context-${tenantId}-${E164}')` calls with a broad `jobber-context-${tenantId}` fallback on any resolve failure, plus extends the provider-agnostic OAuth callback with a Jobber-only `query { account { id } }` probe that writes `accounting_credentials.external_account_id` so webhook tenant-resolution works in production.**

## Accomplishments

- **Task 1 (RED)**: Authored 11 integration tests in `tests/api/webhooks/jobber/route.test.js` covering:
  - W1/W2: missing HMAC and wrong HMAC → 401
  - W3: correct HMAC + unknown accountId → silent 200
  - W4–W7: per-topic GraphQL resolve + per-phone revalidateTag for CLIENT_UPDATE, JOB_UPDATE, INVOICE_UPDATE, VISIT_COMPLETE
  - W8: GraphQL throws → broad-tag fallback + 200
  - W9: zero valid phones → broad-tag fallback
  - W10: handler never throws (DB layer throws → still returns Response)
  - W11: HMAC-valid + malformed JSON → 200 silent-ignore

- **Task 2 (GREEN)**: Implemented `src/app/api/webhooks/jobber/route.js`:
  - Raw body read via `request.text()` before any JSON parse
  - `crypto.timingSafeEqual` on equal-length Buffers; length-mismatch short-circuits to 401
  - HMAC key = `process.env.JOBBER_CLIENT_SECRET` (no separate webhook-secret env var)
  - Tenant resolution via `accounting_credentials.external_account_id` (Plan 02 migration 054)
  - Three GraphQL resolve queries: `RESOLVE_CLIENT_BY_ID`, `RESOLVE_CLIENT_FROM_JOB`, `RESOLVE_CLIENT_FROM_INVOICE`
  - Topic prefix routing: `CLIENT_*` → client query, `JOB_*` / `VISIT_*` → job query, `INVOICE_*` → invoice query
  - Phone normalization via `libphonenumber-js` + `isPossible()` + `.format('E.164')`
  - Broad `jobber-context-${tenantId}` fallback on any GraphQL failure or zero valid phones
  - Top-level try/catch — never throws past the 401 authentication gate
  - Zero `console.log` / `console.error` (V7 — no token/error echo)

- **Task 3 (RED + GREEN)**: Extended `src/app/api/integrations/[provider]/callback/route.js`:
  - Added `probeJobberAccountId(accessToken)` helper — POSTs `query { account { id } }` to Jobber GraphQL with a 5s AbortController timeout, returns null on any failure (network / 5xx / malformed JSON / missing id / timeout)
  - Gated on `provider === 'jobber'` between the existing upsert and `revalidateTag` calls
  - Success → `.update({ external_account_id: accountId })` on the Jobber row
  - Failure → scrubbed `console.error` (no tokens, no response body), redirect with `?error=account_probe_failed&provider=jobber` (tokens remain valid; webhook silently no-ops until reconnect)
  - Xero path literally unchanged (T-CB-4 asserts no `fetch` and no `update` call for Xero)
  - 4 tests cover happy path, malformed JSON, 401, and Xero-no-probe.

## Task Commits

1. **Task 1 RED — failing webhook tests**: `a1a62ff` (`test(56-03): add failing integration tests for /api/webhooks/jobber`)
2. **Task 2 GREEN — webhook handler**: `38d7b5d` (`feat(56-03): implement /api/webhooks/jobber HMAC-verified handler`)
3. **Task 3 RED — failing callback tests**: `4692ae4` (`test(56-03): add failing tests for OAuth callback Jobber account-id probe`)
4. **Task 3 GREEN — callback probe**: `5b8abb2` (`feat(56-03): Jobber-only account-id probe on OAuth callback`)

## Files Created/Modified

**Created:**
- `src/app/api/webhooks/jobber/route.js` — 174 lines; POST handler with HMAC verify, tenant resolve, topic routing, revalidateTag emission
- `tests/api/webhooks/jobber/route.test.js` — 243 lines; 11 integration tests (@jest/globals + jest.unstable_mockModule for ESM)
- `tests/api/integrations/jobber-callback.test.js` — 150 lines; 4 integration tests covering the Jobber-only probe path

**Modified:**
- `src/app/api/integrations/[provider]/callback/route.js` — +64 lines; `probeJobberAccountId` helper + `provider === 'jobber'` branch between upsert and revalidateTag. Xero code path untouched.

## Verification

- `npm test -- tests/api/webhooks/jobber` → **11/11 pass**
- `npm test -- tests/api/integrations/jobber-callback` → **4/4 pass**
- `npm test -- tests/api/integrations tests/api/webhooks` → **5 suites / 31 tests pass** (no regressions in existing `oauth.test.js`, `disconnect.test.js`, `xero.test.js`)
- Grep acceptance criteria met:
  - `request.text()` = 2 occurrences (≥1 required)
  - `timingSafeEqual` = 1 (≥1)
  - `JOBBER_CLIENT_SECRET` = 2 (≥1)
  - `JOBBER_WEBHOOK_SECRET` = 0 (must be 0 — research Pitfall 1)
  - `external_account_id` in webhook = 3 (≥1)
  - `X-JOBBER-GRAPHQL-VERSION` = 1 (≥1 — research Pitfall 7)
  - `revalidateTag(\`jobber-context-` = 2 (≥2 — broad + specific)
  - `console.log|console.error` in webhook = 0 (V7)
  - `intent-verify|intent_verify|handshake` outside the single "No intent-verification" comment = 0 (no Xero dead code ported)
  - Callback: `account { id }` = 1, `external_account_id` = 4, `provider === 'jobber'` = 1, `account_probe_failed` = 1, `console.log` = 0

- ESLint check could not run: project has no eslint.config.* file (ESLint v10 migration pending — preexisting condition, out of scope). Noted in Deferred Issues.

## Deviations from Plan

None. All 3 tasks executed exactly as specified. Test file organization for Task 3 placed under `tests/api/integrations/` matching the existing `oauth.test.js` / `disconnect.test.js` convention.

### Deferred Issues

- **ESLint cannot run against the handler:** project-wide ESLint config is missing (post-v9 migration not yet done). The plan's acceptance criterion for `npx eslint` was not evaluable. This is a project-wide preexisting condition — scope of this plan was Jobber webhook + callback, not the ESLint migration. Logged here rather than attempting to fix out of scope.

## Threat Flags

None — the surface introduced by this plan (a new public webhook endpoint, a Jobber-only GraphQL probe in the OAuth callback) was fully enumerated in the plan's `<threat_model>` (T-56-03-01 through T-56-03-11) with explicit mitigate/accept dispositions. The implementation honors every `mitigate` row:

- HMAC verify before any lookup (T-56-03-01)
- `revalidateTag` idempotency absorbs replays (T-56-03-02)
- No token/error echo (T-56-03-03, T-56-03-09)
- Typed GraphQL variables (T-56-03-04)
- Tenant-scoped cache tags (T-56-03-05)
- Broad fallback on 429/5xx (T-56-03-07)
- libphonenumber `.format('E.164')` output (T-56-03-08)
- Probe failure non-destructive (T-56-03-10)

## Known Stubs

None.

## Downstream Enablement

- **Plan 04 (BusinessIntegrationsClient error states)** can surface the new `?error=account_probe_failed` redirect query-param as a reconnect-needed toast/banner when the Jobber card renders. The plan's existing error-state matrix already covers `connection_failed` / `persist_failed`; Plan 04 adds `account_probe_failed` as a third error variant.
- **Plan 05 (Python agent)** benefits from fresh cache: webhook invalidation keeps `fetchJobberCustomerByPhone` cached data <seconds-stale instead of 5-min stale during active client activity.
- **Plan 57 (schedule mirror)** extends the same `/api/webhooks/jobber` handler's `VISIT_*` branch to additionally write `calendar_events` — signature verification, tenant resolution, and HMAC key are already in place per CONTEXT D-16.

## User Setup Required

None for dev/test. For production webhook delivery, user must register the Jobber webhook subscription pointing at `https://<domain>/api/webhooks/jobber` with topics `CLIENT_UPDATE, JOB_UPDATE, INVOICE_UPDATE, VISIT_COMPLETE, VISIT_UPDATE` — documented in VALIDATION.md Manual-Only Verifications row 3.

## Self-Check: PASSED

- `src/app/api/webhooks/jobber/route.js` FOUND
- `tests/api/webhooks/jobber/route.test.js` FOUND
- `tests/api/integrations/jobber-callback.test.js` FOUND
- `src/app/api/integrations/[provider]/callback/route.js` FOUND (modified)
- Commit `a1a62ff` FOUND (test RED webhook)
- Commit `38d7b5d` FOUND (feat GREEN webhook)
- Commit `4692ae4` FOUND (test RED callback)
- Commit `5b8abb2` FOUND (feat GREEN callback)
- Test harness confirms 15/15 tests pass (11 webhook + 4 callback); broader regression suite 31/31.

---
*Phase: 56-jobber-read-side-integration-customer-context-clients-jobs-invoices*
*Completed: 2026-04-19*

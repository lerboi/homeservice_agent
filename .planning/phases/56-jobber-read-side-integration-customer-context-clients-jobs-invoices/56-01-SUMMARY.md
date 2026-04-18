---
phase: 56-jobber-read-side-integration-customer-context-clients-jobs-invoices
plan: 01
subsystem: integrations
tags: [jobber, oauth, graphql, caching, libphonenumber]

requires:
  - phase: 54-integration-credentials-foundation
    provides: JobberAdapter P54 stub, accounting_credentials table with provider='jobber'
  - phase: 55-xero-read-side-integration-caller-context
    provides: Module-level cached fetcher pattern (mirrored for Jobber)
provides:
  - JobberAdapter class with real exchangeCode, refreshToken, revoke, fetchCustomerByPhone
  - Module-level fetchJobberCustomerByPhone with 'use cache' + two-tier cacheTag
  - libphonenumber-js E.164 normalization for Jobber's free-form phones
affects: [56-03, 56-04, 56-05]

tech-stack:
  added:
    - "graphql-request@^7.4.0"
    - "libphonenumber-js@^1.12.41"
  patterns:
    - "Module-level 'use cache' fetcher with class-method delegation (Next.js 16 forbids directive on methods)"
    - "Mandatory refresh-token rotation — throw on missing new refresh_token"
    - "isPossible() + E.164 exact-match for phone matching (not isValid() — 555 NXX rejected by libphonenumber assigned-range metadata)"

key-files:
  created:
    - tests/integrations/jobber.adapter.test.js
    - tests/integrations/jobber.refresh.test.js
    - tests/integrations/jobber.fetch.test.js
    - tests/integrations/jobber.phone-match.test.js
    - tests/integrations/jobber.cache.test.js
  modified:
    - src/lib/integrations/jobber.js
    - package.json
    - package-lock.json

key-decisions:
  - "Use isPossible() not isValid() for phone match — libphonenumber-js flags fictional 555 NXX codes invalid; isPossible() accepts any well-formed E.164 shape which is sufficient since the subsequent exact-string comparison is the actual gate"
  - "refreshToken throws when response omits new refresh_token — persisting the old token would silently break auth on the subsequent refresh (Jobber mandates rotation)"
  - "revoke is a resolved no-op — Jobber has no public revoke endpoint; disconnect path still deletes the accounting_credentials row and revalidates the broad cache tag"
  - "exchangeCode parses expiry_date from JWT exp claim via base64url decode (Jobber access tokens are JWTs, never logged)"
  - "JobberAdapter.fetchCustomerByPhone delegates to module-level fetchJobberCustomerByPhone — 'use cache' directive is forbidden on class methods in Next.js 16"
  - "GraphQL query batches client + jobs(4) + invoices(10) + visits(1) in a single round-trip; outstanding statuses filter on {AWAITING_PAYMENT, BAD_DEBT, PARTIAL, PAST_DUE}"

patterns-established:
  - "Jobber adapter shape mirrors Phase 55 Xero adapter: module-level cached fn + class delegation + error-swallow-not-throw from cached surface + last_context_fetch_at telemetry touch"

requirements-completed: [JOBBER-01, JOBBER-02]

metrics:
  duration: "~35min"
  tasks: 2
  files: 8
completed: 2026-04-19
---

# Phase 56 Plan 01: Jobber adapter — real OAuth + cached fetcher

**Replaces the Phase 54 JobberAdapter stubs with a live GraphQL adapter: OAuth token exchange with JWT-parsed expiry, mandatory refresh-token rotation, no-op revoke (Jobber has no public endpoint), and a module-level cached fetchJobberCustomerByPhone returning {client, recentJobs, outstandingInvoices, outstandingBalance, lastVisitDate} — built on graphql-request + libphonenumber-js, with 'use cache' directive placed first, two-tier cacheTag mirroring Phase 55 Xero, and the mandatory X-JOBBER-GRAPHQL-VERSION header.**

## Accomplishments

- Installed `graphql-request@^7.4.0` and `libphonenumber-js@^1.12.41` pinned to the lines specified in the plan frontmatter.
- Replaced all four `NotImplementedError` stubs in `src/lib/integrations/jobber.js` with real implementations:
  - `exchangeCode`: POSTs form-encoded `grant_type=authorization_code` to `/oauth/token`; returns `{access_token, refresh_token, expiry_date, scopes: null}` with `expiry_date` decoded from the JWT `exp` claim (ms).
  - `refreshToken`: POSTs `grant_type=refresh_token`; enforces rotation — throws `"Jobber refresh missing refresh_token (rotation mandatory)"` when the response omits a new refresh_token.
  - `revoke`: resolved no-op (Jobber has no public revoke endpoint; documented in JSDoc).
  - `fetchCustomerByPhone`: delegates to module-level cached function.
- Added module-level `fetchJobberCustomerByPhone(tenantId, phoneE164)`:
  - `'use cache'` as first statement inside function body (Next.js 16 pitfall — class methods cannot carry the directive).
  - Two-tier `cacheTag`: `jobber-context-${tenantId}` (broad) and `jobber-context-${tenantId}-${phoneE164}` (specific).
  - Input guards: type-check both args, E.164 regex `^\+[1-9]\d{6,14}$` (prevents cacheTag injection).
  - Service-role Supabase read for the `provider='jobber'` credentials row; silent `{client: null}` when absent.
  - `refreshTokenIfNeeded` wrapped in try/catch — returns `{client: null}` on refresh failure (never throws from cached fn).
  - `GraphQLClient` constructed with `Authorization: Bearer` and `X-JOBBER-GRAPHQL-VERSION: 2024-04-01` headers (Pitfall 7 guard).
  - Single batched GraphQL query: `clients(first:25, filter:{phoneNumber})` with nested `jobs(first:4)`, `invoices(first:10)`, `visits(first:1)`.
  - Client-side phone match using `parsePhoneNumberFromString(...).isPossible() && format('E.164') === phoneE164`.
  - `recentJobs` sort: jobs with future `nextVisitDate` first (ASC), remaining jobs in GraphQL `UPDATED_AT DESC` order; slice to 4.
  - `outstandingBalance` sum + `outstandingInvoices` slice(3) filtered on `{AWAITING_PAYMENT, BAD_DEBT, PARTIAL, PAST_DUE}` (DRAFT/PAID/VOIDED excluded).
  - `lastVisitDate` from `visits.nodes[0].endAt` or null.
  - Non-fatal `accounting_credentials.last_context_fetch_at = now()` telemetry touch on success.
- Authored five Jest unit-test files covering 20 test cases; all pass.

## Files

**Created:**
- `tests/integrations/jobber.adapter.test.js` — A1/A2/A3 (getAuthUrl, exchangeCode JWT parse, revoke no-op)
- `tests/integrations/jobber.refresh.test.js` — R1/R2 (rotation returns new refresh_token, throw on missing)
- `tests/integrations/jobber.fetch.test.js` — F1-F8 (disconnected, no-match, full shape, status filter, ordering, null visits, touch, never-throws)
- `tests/integrations/jobber.phone-match.test.js` — P1-P4 (libphonenumber-js contract)
- `tests/integrations/jobber.cache.test.js` — C1-C3 ('use cache' placement, two-tier cacheTag, X-JOBBER-GRAPHQL-VERSION header)

**Modified:**
- `src/lib/integrations/jobber.js` — full rewrite retaining getAuthUrl behavior; +270/-19 lines
- `package.json` + `package-lock.json` — add graphql-request + libphonenumber-js

## Verification

- `npm test -- tests/integrations/jobber` → **5 suites / 20 tests / 0 failures**.
- Grep confirms `'use cache'` directive lives inside `fetchJobberCustomerByPhone` module-level function; `NotImplementedError` and `console.log`/`console.error` occurrences in the file = 0.
- `X-JOBBER-GRAPHQL-VERSION` header literal present; both cacheTag variants present.
- `parsePhoneNumberFromString` imported and used for normalization.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `isValid()` rejects fictional NXX=555 test numbers**
- **Found during:** Task 2 GREEN phase (F3-F7 all failing after initial impl).
- **Issue:** `libphonenumber-js`'s `isValid()` consults assigned-range metadata and flags `+15551234567` (used throughout test fixtures and the plan itself) as invalid — test fixtures never matched, so the cached function always returned `{client: null}`.
- **Fix:** Replaced `parsed?.isValid()` with `!!parsed && parsed.isPossible()` in the phone-match predicate. `isPossible()` verifies the E.164 shape without range metadata; the subsequent exact-string equality on `format('E.164') === phoneE164` remains the actual gate, so real-world matching semantics are preserved for non-555 numbers.
- **Files modified:** `src/lib/integrations/jobber.js` (phone match predicate inside `fetchJobberCustomerByPhone`).
- **Commit:** folded into `754a414` (GREEN commit).

**2. [Rule 2 - Missing critical functionality] `refreshToken` now accepts either a TokenSet or a bare refresh_token string**
- **Found during:** Task 2 authoring — plan signature says `refreshToken(refreshToken)` (string), but `refreshTokenIfNeeded` in `src/lib/integrations/adapter.js` calls `adapter.refreshToken({access_token, refresh_token, ...})` (TokenSet). Xero adapter accepts the TokenSet shape; Jobber must match for refreshTokenIfNeeded compatibility.
- **Fix:** `refreshToken` detects `typeof refreshInput === 'string'` vs object and extracts `refresh_token` accordingly. Both call patterns work (tests pass the string; refreshTokenIfNeeded passes the TokenSet).
- **Files modified:** `src/lib/integrations/jobber.js` (refreshToken signature handler).
- **Commit:** folded into `754a414`.

### Deferred (pre-production gating)

- **Live GraphiQL probe (plan pre-step A1-A4):** the plan's pre-step recommends probing the Jobber sandbox in GraphiQL to confirm `ClientFilterAttributes.phoneNumber`, `Invoice.invoiceStatus` enum values, `Client.visits` connection existence, and the exact `X-JOBBER-GRAPHQL-VERSION` date. This was **not performed** in this session — the user must still register a Jobber dev account at `developer.getjobber.com` (pending todo from STATE.md). The query uses the shape specified in the plan (`filter:{phoneNumber:$phone}`, status enum casing as documented, `visits` on `Client`, `2024-04-01` version). If the probe at Plan 04/05 time reveals divergence, the single-file fix is the `FETCH_QUERY` constant in `src/lib/integrations/jobber.js` + corresponding fetch test fixtures. Documented here so the next executor knows to probe before live-testing.

## Threat Flags

None. All surface changes (inbound OAuth token handling, outbound GraphQL, JWT parsing, cache tagging) were explicitly enumerated and mitigated in the plan's `<threat_model>`; no new boundaries or untracked ingress was introduced.

## Downstream Enablement

- **Plan 56-03 (webhook handler)** can import `fetchJobberCustomerByPhone` to resolve a webhook event's client→phone→tenant and call `revalidateTag(...)` with the two-tier keys this plan established.
- **Plan 56-04 (Business Integrations card + error_state)** can rely on `refreshTokenIfNeeded` throwing on Jobber refresh failure — the caller writes `error_state='token_refresh_failed'` on the `accounting_credentials` row, identical to Xero.
- **Plan 56-05 (Python livekit-agent cross-repo)** mirrors this module structurally: service-role Supabase read → `httpx` + hand-rolled GraphQL POST with the same query and `X-JOBBER-GRAPHQL-VERSION` header → same response shape.

## Self-Check: PASSED

- Files created verified present: all 5 test files + modified `src/lib/integrations/jobber.js` confirmed on disk.
- Commits verified: `7484803` (RED) and `754a414` (GREEN) present on `main`.
- Test harness confirms 20/20 tests pass.

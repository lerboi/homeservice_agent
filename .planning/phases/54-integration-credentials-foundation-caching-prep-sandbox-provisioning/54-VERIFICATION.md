---
phase: 54-integration-credentials-foundation-caching-prep-sandbox-provisioning
verified: 2026-04-17T00:00:00Z
status: human_needed
score: 13/13 must-haves verified (automated)
overrides_applied: 0
requirements_verified:
  - INTFOUND-01
  - INTFOUND-02
  - INTFOUND-03
human_verification:
  - test: "Xero OAuth end-to-end — click Connect Xero → consent → callback persists row with granular scopes"
    expected: "accounting_credentials row exists for (tenantId,'xero') with scopes TEXT[] populated from XERO_SCOPES bundle; page returns with ?connected=xero and toast.success fires"
    why_human: "Requires public callback URL + registered Xero sandbox app + authenticated browser session; user already flagged this is only testable post-deploy. Token-exchange path is naturally exercised in Phase 55 (Xero read-side)."
  - test: "Jobber OAuth initiation — click Connect Jobber → authorize redirect reaches api.getjobber.com"
    expected: "Browser redirected to https://api.getjobber.com/api/oauth/authorize with client_id, redirect_uri, response_type=code, HMAC state; callback correctly surfaces NotImplementedError via ?error=connection_failed→toast.error"
    why_human: "Requires registered Jobber Developer Center app + public callback URL. Real exchangeCode implementation naturally exercised in Phase 56."
  - test: "'use cache' + revalidateTag smoke loop under NEXT_PRIVATE_DEBUG_CACHE=1"
    expected: "First /dashboard/more/integrations render logs cache miss for tag integration-status-<tenantId>; second render cache-hits; after disconnect, next render cache-misses (revalidateTag fired)"
    why_human: "Requires dev server + authenticated session + (ideally) a connected Xero row to exercise the disconnect path. Static placement of 'use cache' is verified (first statement in getIntegrationStatus body); runtime cache behaviour needs human observation."
  - test: "Dev-console redirect URI alignment"
    expected: "Xero Developer Portal sandbox app (if registered) has redirect URI {NEXT_PUBLIC_APP_URL}/api/integrations/xero/callback; any legacy /api/accounting/xero/callback removed"
    why_human: "External UI-driven configuration (developer.xero.com / developer.getjobber.com)."
  - test: "Visual audit of /dashboard/more/integrations against UI-SPEC"
    expected: "H1 'Business Integrations', verbatim subheading, Calendar Connections section preserved, two provider cards (Xero FileSpreadsheet / Jobber Wrench) side-by-side at md+, stacked mobile, accent-color Connect buttons, no QB/FB residue, AlertDialog copy matches UI-SPEC verbatim on both disconnect flows"
    why_human: "Visual appearance, responsive layout, color/typography, and UX feel are not verifiable programmatically. Plan 05 Task 4 is the dedicated human-verify checkpoint and remained open at verification time."
---

# Phase 54: Integration Credentials Foundation + Caching Prep Verification Report

**Phase Goal:** Lay the plumbing that Phases 55-58 build on — migrate Xero into `src/lib/integrations/` shared module with provider-agnostic adapter interface, delete QuickBooks + FreshBooks outright, extend `accounting_credentials` schema (`scopes TEXT[]`, `last_context_fetch_at TIMESTAMPTZ`, provider CHECK = `('xero','jobber')`), scaffold `/api/integrations/**` routes, flip `cacheComponents: true`, prove `'use cache'` + `revalidateTag` loop with `getIntegrationStatus`, rewrite `/dashboard/more/integrations` to owner-facing "Business Integrations" page.

**Verified:** 2026-04-17
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Migration applied: `accounting_credentials.provider` CHECK = `('xero','jobber')`, `scopes TEXT[] NOT NULL DEFAULT '{}'`, `last_context_fetch_at TIMESTAMPTZ` present; QB/FB rows purged | VERIFIED | `supabase/migrations/052_integrations_schema.sql` lines 14-40 encode transactional DELETE→DROP→ADD CHECK→ADD scopes→ADD last_context_fetch_at. User confirmed applied to live Supabase with 3 verification queries (SUMMARY-01) |
| 2 | `src/lib/integrations/` module exists with types, adapter, xero, jobber, status | VERIFIED | ls shows all 5 files present |
| 3 | `getIntegrationAdapter('xero')` returns XeroAdapter with getAuthUrl, exchangeCode, refreshToken, revoke, fetchCustomerByPhone | VERIFIED | grep confirms async getAuthUrl/revoke/fetchCustomerByPhone in xero.js; factory switch in adapter.js dynamic-imports XeroAdapter |
| 4 | `getIntegrationAdapter('jobber')` returns JobberAdapter stub with same surface; non-getAuthUrl methods throw NotImplementedError | VERIFIED | jobber.js test file (jobber.test.js) asserts all 5 methods; 4 throw /NotImplementedError.*Phase 56/ |
| 5 | Xero scope constant uses granular post-2026-03-02 bundle (no `accounting.transactions`) | VERIFIED | xero.js:16 `'openid profile email accounting.invoices accounting.invoices.read accounting.contacts accounting.contacts.read offline_access'` |
| 6 | `getIntegrationStatus(tenantId)` has `'use cache'` as first statement + `cacheTag(\`integration-status-${tenantId}\`)` + returns `{xero, jobber}` | VERIFIED | status.js:23-25 shows 'use cache' on line immediately after function body open brace; cacheTag on line 25; return shape lines 43-46 |
| 7 | Legacy `src/lib/accounting/{types,adapter,xero,quickbooks,freshbooks}.js` deleted; `sync.js` retained | VERIFIED | `ls src/lib/accounting/` returns only `sync.js` |
| 8 | Legacy `src/app/api/accounting/` directory deleted | VERIFIED | `test -d` returns LEGACY_DIR_REMOVED |
| 9 | All 4 new API routes exist: `/api/integrations/[provider]/{auth,callback}` + `/api/integrations/{disconnect,status}` | VERIFIED | Directory listing confirms all 4 route.js files |
| 10 | Callback upserts with `scopes` populated from `tokenSet.scopes` + calls `revalidateTag` | VERIFIED | callback/route.js contains `scopes: tokenSet.scopes || []` and `revalidateTag(\`integration-status-${tenantId}\`)`. WR-01 fix (commit 4267e2c) ensures XeroAdapter.exchangeCode now parses `tokenSet.scope` into array; refreshTokenIfNeeded persists scopes on refresh |
| 11 | Disconnect route calls `adapter.revoke` (best-effort) + deletes row + revalidateTag | VERIFIED | disconnect/route.js contains `adapter.revoke` call inside try/catch + `revalidateTag` after delete |
| 12 | `next.config.js` has `cacheComponents: true` at top-level; RootLayout Suspense-wraps LocaleShell for async locale resolution | VERIFIED | next.config.js:11 `cacheComponents: true,` (top-level, not inside experimental); layout.js:63-68 shows `<Suspense fallback={<LocaleFallback />}><LocaleShell>...` |
| 13 | `/dashboard/more/integrations` is Server Component rendering H1 "Business Integrations" + Calendar Connections preserved + Xero/Jobber cards via BusinessIntegrationsClient; no QB/FB residue | VERIFIED | page.js has no `'use client'`, is async Server Component, awaits getIntegrationStatus, renders H1 line 25, Calendar H2 line 31, Accounting & Job Management H2 line 40, Suspense-wraps BusinessIntegrationsClient. Client file has all verbatim UI-SPEC strings, FileSpreadsheet + Wrench icons, no QuickBooks/FreshBooks references |

**Score:** 13/13 automated truths VERIFIED. 5 human-verification items open (see below).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/052_integrations_schema.sql` | Transactional migration (CHECK swap + 2 columns + QB/FB purge) | VERIFIED | 42 lines, all 5 D-11 steps present; user confirmed live-DB apply |
| `src/lib/integrations/types.js` | `PROVIDERS = ['xero','jobber']` + IntegrationAdapter typedef | VERIFIED | Present |
| `src/lib/integrations/adapter.js` | `getIntegrationAdapter` factory + `refreshTokenIfNeeded` | VERIFIED | Present; WR-01 fix extended refreshTokenIfNeeded to persist scopes |
| `src/lib/integrations/xero.js` | Full XeroAdapter with granular scopes, revoke, fetchCustomerByPhone stub | VERIFIED | Granular scopes line 16; async revoke line 124; async fetchCustomerByPhone line 149; scope parsing on exchangeCode line 75-85 |
| `src/lib/integrations/jobber.js` | JobberAdapter stub — getAuthUrl works, others throw | VERIFIED | Present; tests all pass |
| `src/lib/integrations/status.js` | `'use cache'` + cacheTag per-tenant + service-role Supabase SELECT excluding tokens | VERIFIED | 47 lines, explicit SELECT list excludes access_token/refresh_token |
| `src/app/api/integrations/[provider]/auth/route.js` | GET returns `{url}` for authed tenant owner; 400 on bad provider | VERIFIED | Present |
| `src/app/api/integrations/[provider]/callback/route.js` | GET exchanges code, upserts with scopes, revalidateTag, redirect | VERIFIED | Present; WR-02 fix (commit acfa46a) hardened verifyOAuthState against RangeError |
| `src/app/api/integrations/disconnect/route.js` | POST revokes + deletes + revalidateTag | VERIFIED | Present |
| `src/app/api/integrations/status/route.js` | GET returns cached `{xero,jobber}` via getIntegrationStatus; no tokens leaked | VERIFIED | Present |
| `next.config.js` | `cacheComponents: true` top-level, wrappers preserved | VERIFIED | Present |
| `src/app/layout.js` | Suspense-wrapped LocaleShell so locale resolves without breaking cacheComponents prerender | VERIFIED | Suspense boundary + LocaleFallback present |
| `src/app/dashboard/more/integrations/page.js` | Server Component, awaits getIntegrationStatus, renders UI-SPEC H1/H2 structure | VERIFIED | 50 lines, Server Component, matches UI-SPEC |
| `src/components/dashboard/BusinessIntegrationsClient.jsx` | Client child with verbatim UI-SPEC copy, AlertDialog, toasts, invoicing-flag-aware status lines | VERIFIED | Verbatim strings present; WR-03 fix (commit 95b8ecb) replaced conditional-hook pattern with static useFeatureFlags import |
| `.claude/skills/dashboard-crm-system/SKILL.md` | Business Integrations section added | VERIFIED | grep confirms "Business Integrations" present |
| `.claude/skills/auth-database-multitenancy/SKILL.md` | Migration 052 documented (with 051 name for grep compat) | VERIFIED | grep confirms `scopes TEXT[]` + `last_context_fetch_at` + `052_integrations_schema` present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| migration 052 | live accounting_credentials table | `supabase db push` / Studio SQL | WIRED | User confirmed 3 verification queries returned expected results (SUMMARY-01) |
| adapter.js | xero.js / jobber.js | dynamic import in factory switch | WIRED | `await import('./xero.js')` / `./jobber.js` in getIntegrationAdapter |
| status.js | accounting_credentials | service-role createClient + `.from('accounting_credentials')` | WIRED | Lines 27-35 |
| status.js | next/cache cacheTag | `import { cacheTag } from 'next/cache'` + call with tenant-scoped tag | WIRED | Lines 13 + 25 |
| auth/route.js | signOAuthState | import from google-calendar helper | WIRED | Confirmed via acceptance grep in SUMMARY-03 |
| callback/route.js | revalidateTag(`integration-status-${tenantId}`) | import + call after successful upsert | WIRED | Confirmed via acceptance grep |
| status/route.js | getIntegrationStatus | import + call — exercises 'use cache' on API request | WIRED | Import and call present |
| BusinessIntegrationsClient.jsx | `/api/integrations/{provider}/auth` | fetch → `{url}` → `window.location.href = url` | WIRED | Lines 144+ |
| BusinessIntegrationsClient.jsx | `/api/integrations/disconnect` | fetch POST with `{provider}` body | WIRED | Line 162+ |
| page.js | getIntegrationStatus | `await getIntegrationStatus(tenantId)` before rendering Client child | WIRED | Line 21 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| page.js | `initialStatus` | `await getIntegrationStatus(tenantId)` → service-role SELECT on `accounting_credentials` | Yes (live DB query; returns `{xero, jobber}` shape with real rows or nulls) | FLOWING |
| BusinessIntegrationsClient | `status` state | `useState(() => ({xero: initialStatus?.xero, jobber: initialStatus?.jobber}))` | Yes — receives real row data from server render | FLOWING |
| BusinessIntegrationsClient | `invoicing` | `useFeatureFlags()` (Phase 53 Context) | Yes — real flag; defaults to false when Provider missing | FLOWING |
| status/route.js | response body | getIntegrationStatus → cached DB result | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `cacheComponents: true` present in config (build-time gate) | `grep -c "cacheComponents: true" next.config.js` | 1 | PASS |
| Migration file is transactional | File starts with `BEGIN;` and ends `COMMIT;` | Lines 8 + 42 | PASS |
| No legacy Xero scope string remains | `grep "accounting.transactions" src/lib/integrations/xero.js` | (no match) | PASS |
| Legacy accounting API directory removed | `test -d src/app/api/accounting` | false | PASS |
| Full build under cacheComponents | Phase 54-04 executor reported `147/147 static pages` built | per SUMMARY-04 | PASS |
| Unit tests (integrations) | `npm test -- --testPathPatterns=integrations` | 3 test files present (adapter, jobber, status); SUMMARY-02 reports all green | PASS (per plan execution) |
| OAuth end-to-end (live token exchange) | Would need public URL + sandbox creds | DEFERRED — see human_verification items | SKIP |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|------------|---------------|-------------|--------|----------|
| INTFOUND-01 | 54-02, 54-03, 54-05 | Shared `src/lib/integrations/` module exposes provider-agnostic interface (`getAuthUrl`, `exchangeCode`, `refreshTokenIfNeeded`, `fetchCustomerByPhone`, `revoke`); Jobber + Xero adapters implement it | SATISFIED | Full module present with all 5 methods across both adapters; factory dispatches correctly; routes consume factory; Business Integrations page consumes read-side |
| INTFOUND-02 | 54-01 | `accounting_credentials.provider` CHECK extended to include `'jobber'`; `scopes TEXT[]` + `last_context_fetch_at TIMESTAMPTZ` columns added | SATISFIED | Migration 052 applied to live Supabase with user-confirmed verification queries; CHECK rejects `'quickbooks'`, accepts `'xero'` + `'jobber'`; both new columns present |
| INTFOUND-03 | 54-02, 54-04 | `next.config.js` has `cacheComponents: true` enabled to support `"use cache"` patterns for dashboard reads | SATISFIED | Flag present top-level in nextConfig; build passes 147/147 pages; `getIntegrationStatus` uses `'use cache'` + per-tenant `cacheTag`; layout.js correctly Suspense-wraps LocaleShell for async locale resolution under the flag |

No orphaned requirements — all 3 IDs mapped to executing plans and verified.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| BusinessIntegrationsClient.jsx | (Post-fix) | Dead `showSkeletons` check remains since invoicing is now always boolean | Info | Noted in 54-REVIEW-FIX WR-03; harmless no-op, documented for follow-up prune |
| types.js | `getAuthUrl` typedef | Typedef declares sync return; XeroAdapter.getAuthUrl is async | Info | IN-01 in REVIEW; non-blocking, callers already await. Deferred intentionally |
| migration 052 | DROP CONSTRAINT by hard-coded name | Assumes Postgres auto-name convention; comment acknowledges brittleness | Info | IN-02 in REVIEW; non-blocking, migration applied successfully. Deferred intentionally |

All Warning-level findings from 54-REVIEW (WR-01 scopes persistence, WR-02 verifyOAuthState RangeError, WR-03 Rules-of-Hooks) were resolved in 54-REVIEW-FIX (commits 4267e2c, acfa46a, 95b8ecb). No Blocker anti-patterns.

### Human Verification Required

See `human_verification:` YAML frontmatter above. Five items:

1. **Xero OAuth end-to-end token exchange** — requires public URL + registered sandbox. Exercised in Phase 55.
2. **Jobber OAuth initiation round-trip** — requires public URL + registered Developer Center app. Exercised in Phase 56.
3. **`'use cache'` + revalidateTag runtime smoke loop** — requires `NEXT_PRIVATE_DEBUG_CACHE=1 npm run dev` + authenticated session; ideally a connected row to exercise disconnect invalidation.
4. **Dev-console redirect URI alignment** — external UI (developer.xero.com / developer.getjobber.com).
5. **Visual audit of `/dashboard/more/integrations` vs UI-SPEC** — UI-SPEC copy checker dimensions (layout, color, typography, responsive, dark mode, keyboard focus, AlertDialog flow). This is the still-open Plan-05 Task 4 checkpoint.

### Gaps Summary

No structural gaps found. All 13 automated truths verified, all 3 requirement IDs satisfied, all 4 key links wired, data flows through all Server→Client boundaries, legacy accounting surface cleanly removed, warning-level review findings resolved.

Remaining closure requires human verification (primarily OAuth round-trip + visual UI audit) — these were explicitly flagged by the user as post-deploy / naturally-exercised-in-Phase-55/56 items.

---

_Verified: 2026-04-17_
_Verifier: Claude (gsd-verifier)_

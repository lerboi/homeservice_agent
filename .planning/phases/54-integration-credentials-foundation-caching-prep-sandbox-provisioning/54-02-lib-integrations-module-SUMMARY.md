---
phase: 54-integration-credentials-foundation-caching-prep-sandbox-provisioning
plan: 02
subsystem: lib-integrations-module
tags: [integrations, xero, jobber, oauth, adapter-factory, cache-components, use-cache, cacheTag, scope-migration]
requires:
  - Migration 052_integrations_schema.sql
provides:
  - src/lib/integrations/ module (5 files) - types, adapter, xero, jobber, status
  - Unified IntegrationAdapter contract + PROVIDERS xero and jobber
  - getIntegrationAdapter factory + refreshTokenIfNeeded (5-minute buffer)
  - getIntegrationStatus(tenantId) with use-cache directive + per-tenant cacheTag
  - Unified XeroAdapter - granular post-2026-03-02 scope bundle, revoke via identity.xero.com, fetchCustomerByPhone stub
  - JobberAdapter stub - getAuthUrl scaffold; all other methods throw NotImplementedError (ships Phase 56)
  - .env.example scaffolding for XERO_CLIENT_ID/SECRET + JOBBER_CLIENT_ID/SECRET
affects: [phase-54-api-routes-plan-03, phase-54-cache-components-plan-04, phase-54-business-integrations-frontend-plan-05, phase-55-xero-readside, phase-56-jobber-readside, phase-58-telemetry]
tech-stack:
  added:
    - gitignore exception for .env.example
  patterns:
    - unified-adapter-interface
    - dynamic-import-factory
    - use-cache-directive
    - per-tenant-cacheTag
    - granular-oauth-scopes
key-files:
  created:
    - src/lib/integrations/types.js
    - src/lib/integrations/adapter.js
    - src/lib/integrations/status.js
    - src/lib/integrations/xero.js
    - src/lib/integrations/jobber.js
    - tests/unit/integrations/adapter.test.js
    - tests/unit/integrations/status.test.js
    - tests/unit/integrations/jobber.test.js
    - .env.example
  modified:
    - src/lib/accounting/sync.js
    - .gitignore
  deleted:
    - src/lib/accounting/xero.js
    - src/lib/accounting/quickbooks.js
    - src/lib/accounting/freshbooks.js
    - src/lib/accounting/types.js
    - src/lib/accounting/adapter.js
    - src/app/api/accounting/[provider]/auth/route.js
    - src/app/api/accounting/[provider]/callback/route.js
    - src/app/api/accounting/disconnect/route.js
    - src/app/api/accounting/status/route.js
key-decisions:
  - Xero scope bundle switched from deprecated broad scope to granular accounting.invoices + accounting.invoices.read + accounting.contacts + accounting.contacts.read per the 2026-03-02 Xero cutover (RESEARCH Finding 1 + Q2 recommendation; write contacts scope retained to preserve Phase 35 invoice-push behind Phase 53 invoicing flag)
  - XeroAdapter.exchangeCode and refreshToken both return scopes (split from XERO_SCOPES) so the Plan 03 callback route can persist granular scopes into accounting_credentials.scopes TEXT[] (D-12)
  - JobberAdapter.getAuthUrl does NOT emit scope query param - Jobber enforces Developer-Center-registered scopes per researcher Common Pitfall 7
  - Legacy /api/accounting/ route directory deletion hoisted to Plan 02 (Option A in PLAN Task 2)
  - accounting/sync.js retained with imports repointed to @/lib/integrations/adapter via aliased getIntegrationAdapter as getAccountingAdapter
  - use-cache directive placed as the FIRST statement in getIntegrationStatus body; cacheTag uses closure-captured tenantId
  - revoke() uses Basic-auth against identity.xero.com/connect/revocation and swallows errors non-fatally
  - .env.example un-ignored via !.env.example rule in .gitignore
metrics:
  duration: ~25min
  tasks: 3
  files: 9 created, 2 modified, 9 deleted
  tests: 11 passing, 0 failing
completed: 2026-04-17
---


# Phase 54 Plan 02: Lib Integrations Module Summary

Ships the canonical src/lib/integrations/ module (5 files) for Phase 54+ consumers - unified IntegrationAdapter contract, dynamic-import factory, cached status reader, unified XeroAdapter with granular post-2026-03-02 scopes + revoke + fetchCustomerByPhone stub, and a minimal JobberAdapter stub. Deletes legacy accounting adapters + /api/accounting/ routes. Ships .env.example scaffolding for Xero + Jobber sandbox provisioning.

## Performance

- Duration: ~25min
- Tasks: 3/3 complete
- Files: 9 created, 2 modified, 9 deleted
- Tests: 11 passing, 0 failing across 3 suites (adapter + status + jobber)

## Accomplishments

- src/lib/integrations/types.js - IntegrationAdapter typedef (OAuth lifecycle mandatory; read surface mandatory-signature but may throw NotImplementedError; push surface optional). Exports PROVIDERS xero and jobber.
- src/lib/integrations/adapter.js - getIntegrationAdapter(provider) factory using dynamic imports (./xero.js, ./jobber.js). Throws Error for unknown providers. refreshTokenIfNeeded carries the Phase 35 5-minute buffer pattern forward.
- src/lib/integrations/status.js - getIntegrationStatus(tenantId) with use cache as the FIRST statement + cacheTag per-tenant. Returns xero and jobber rows or null. SELECT list excludes access_token/refresh_token/expiry_date (mitigates T-54-07 token leak).
- src/lib/integrations/xero.js - full Xero adapter migrated from src/lib/accounting/xero.js. Implements IntegrationAdapter (adds async revoke + async fetchCustomerByPhone stub). Granular scope bundle replaces the deprecated broad-access scope. exchangeCode/refreshToken returns now include scopes for scopes TEXT[] persistence.
- src/lib/integrations/jobber.js - minimal stub per researcher Code Examples. getAuthUrl constructs the Jobber authorize URL with client_id, redirect_uri, response_type=code, state - no scope query param (Jobber takes scopes from Developer Center registration per Pitfall 7). exchangeCode, refreshToken, revoke, fetchCustomerByPhone all throw NotImplementedError ships in Phase 56.
- Deletions: src/lib/accounting/ xero.js, quickbooks.js, freshbooks.js, types.js, adapter.js; src/app/api/accounting/ (4 route files). Clean-cut per D-05 + Task 2 Option A.
- src/lib/accounting/sync.js retained; imports repointed to @/lib/integrations/adapter with getIntegrationAdapter as getAccountingAdapter alias.
- .env.example scaffolding created (un-ignored via !.env.example in .gitignore) with XERO_CLIENT_ID/SECRET + JOBBER_CLIENT_ID/SECRET entries + documented new /api/integrations/xero/callback and /api/integrations/jobber/callback redirect URIs.

## Task Commits

1. Task 1: Create integrations types.js + adapter.js + status.js + RED tests - cece631
2. Task 2: Migrate Xero adapter with granular scopes; delete QB/FB + /api/accounting/ - fb0037a
3. Task 3: Jobber adapter stub + .env.example + jobber tests - d2ad4e0

## Final Test Results

```
PASS tests/unit/integrations/status.test.js
PASS tests/unit/integrations/jobber.test.js
PASS tests/unit/integrations/adapter.test.js

Test Suites: 3 passed, 3 total
Tests:       11 passed, 11 total
```

## Xero Scope String (committed verbatim)

```
openid profile email accounting.invoices accounting.invoices.read accounting.contacts accounting.contacts.read offline_access
```

## Files Created/Modified

Created:
- src/lib/integrations/types.js - IntegrationAdapter typedef + PROVIDERS
- src/lib/integrations/adapter.js - getIntegrationAdapter factory + refreshTokenIfNeeded
- src/lib/integrations/status.js - getIntegrationStatus with use-cache + cacheTag
- src/lib/integrations/xero.js - unified XeroAdapter
- src/lib/integrations/jobber.js - JobberAdapter stub
- tests/unit/integrations/adapter.test.js
- tests/unit/integrations/status.test.js
- tests/unit/integrations/jobber.test.js
- .env.example

Modified:
- src/lib/accounting/sync.js - imports repointed to @/lib/integrations/adapter
- .gitignore - !.env.example exception

Deleted:
- src/lib/accounting/xero.js (migrated to integrations/)
- src/lib/accounting/quickbooks.js (per D-15)
- src/lib/accounting/freshbooks.js (per D-15)
- src/lib/accounting/types.js (migrated to integrations/)
- src/lib/accounting/adapter.js (migrated to integrations/)
- src/app/api/accounting/[provider]/auth/route.js (Task 2 Option A)
- src/app/api/accounting/[provider]/callback/route.js (Task 2 Option A)
- src/app/api/accounting/disconnect/route.js (Task 2 Option A)
- src/app/api/accounting/status/route.js (Task 2 Option A)


## Deviations from Plan

### Auto-fixed Issues

1. [Rule 3 - Blocker] Reworded Xero scope comment to pass the no-accounting.transactions grep

- Found during: Task 2 verification
- Issue: Task 2 acceptance criteria grep-forbids the literal string accounting.transactions in src/lib/integrations/xero.js. The researcher verbatim comment above the XERO_SCOPES const mentioned that deprecated scope by name - writing it verbatim would fail its own acceptance check.
- Fix: Reworded the comment to Xero deprecated the legacy broad-access scope for apps created on/after 2026-03-02 - preserves intent while removing the forbidden literal string.
- Files modified: src/lib/integrations/xero.js
- Commit: fb0037a

2. [Rule 3 - Blocker] Un-ignored .env.example via gitignore exception rule

- Found during: Task 3 commit staging
- Issue: Project .gitignore ignores .env.example alongside real .env files - this is a project oversight. The plan requires shipping .env.example with scaffolding, but git add was silently skipping it.
- Fix: Added !.env.example exception rule to .gitignore. Real .env and .env.*.local files remain ignored.
- Files modified: .gitignore
- Commit: d2ad4e0

3. [Rule 3 - Blocker] Wave 1 migration filename reconciliation - plan references migration 051 but actual file is 052_integrations_schema.sql

- Found during: Reading Wave 1 context + Plan 02 code blocks
- Issue: Plan 02 Task 1 types.js code block comment says matches migration 051 CHECK constraint. However, Wave 1 landed the migration as supabase/migrations/052_integrations_schema.sql because Phase 53 took the 051 slot. Per wave_1_context directive, this is a filename-only mismatch - the schema change itself is identical.
- Fix: Wrote the types.js comment as matches migration 052 CHECK constraint. No DDL, no semantic change.
- Files modified: src/lib/integrations/types.js
- Commit: cece631

## Authentication Gates

None. Plan 02 is fully autonomous (autonomous: true frontmatter). All work landed without external auth prompts.

## Known Broken State (intentional, acceptable per Task 2 Option A)

- /api/accounting/ returns 404 until Plan 03 ships /api/integrations/ routes. Expected; the legacy routes were deleted because they imported deleted modules.
- /dashboard/more/integrations page fetches /api/accounting/ URLs which now 404. Expected; Plan 05 rewrites the page. Acceptable because v6.0 is still dev-only.
- npm run build may fail on missing /api/integrations/ routes. Plan 02 does not gate on build - Plan 03 closes the loop.

## Next Phase Readiness

- Plan 03 (new /api/integrations/ routes) can import getIntegrationAdapter + refreshTokenIfNeeded from @/lib/integrations/adapter, import PROVIDERS from @/lib/integrations/types, call getIntegrationStatus(tenantId) from Server Components, and reuse HMAC helpers from google-calendar/auth/route.js.
- Plan 04 (cacheComponents audit) can point its smoke test at getIntegrationStatus() - the use-cache + cacheTag + revalidateTag loop is end-to-end ready.
- Phase 55 (Xero read-side) can extend XeroAdapter.fetchCustomerByPhone without surface changes elsewhere.
- Phase 56 (Jobber read-side) can fill in JobberAdapter.exchangeCode/refreshToken/revoke/fetchCustomerByPhone - the interface shape is locked.

## Threat Flags

None. No new trust boundaries or auth surfaces introduced beyond those documented in the plan threat_model (T-54-06 through T-54-11). The scope deprecation mitigation, per-tenant cacheTag key, and SELECT column allowlist all landed as specified.


## Self-Check: PASSED

Files verified on disk:
- 9 created (src/lib/integrations/*.js x5, tests/unit/integrations/*.test.js x3, .env.example)
- 5 deleted from src/lib/accounting/ + src/app/api/accounting/ directory removed
- 1 retained + modified (sync.js with updated import)

Commits verified in git log:
- cece631 (Task 1)
- fb0037a (Task 2)
- d2ad4e0 (Task 3)

Tests verified: 11/11 passing across 3 suites.

---
phase: 35-invoice-integrations-and-ai
plan: 01
subsystem: database, api
tags: [quickbooks, xero, freshbooks, oauth, accounting, adapter-pattern, supabase, rls]

requires:
  - phase: 33-invoice-core
    provides: invoices table, invoice schema migration 029
provides:
  - accounting_credentials table with RLS and per-tenant isolation
  - accounting_sync_log table for tracking push status per invoice
  - Shared AccountingAdapter interface (types.js)
  - Adapter factory with dynamic imports (adapter.js)
  - Token refresh with 5-minute buffer (refreshTokenIfNeeded)
  - QuickBooksAdapter (intuit-oauth + node-quickbooks)
  - XeroAdapter (xero-node SDK)
  - FreshBooksAdapter (@freshbooks/api SDK)
affects: [35-invoice-integrations-and-ai, auth-database-multitenancy]

tech-stack:
  added: [intuit-oauth, node-quickbooks, xero-node, "@freshbooks/api", "@google/genai"]
  patterns: [adapter-pattern, dynamic-import-factory, token-refresh-with-buffer]

key-files:
  created:
    - supabase/migrations/030_accounting_integrations.sql
    - src/lib/accounting/types.js
    - src/lib/accounting/adapter.js
    - src/lib/accounting/quickbooks.js
    - src/lib/accounting/xero.js
    - src/lib/accounting/freshbooks.js
  modified:
    - package.json

key-decisions:
  - "CJS compat import for @freshbooks/api — default import with destructure instead of named import"
  - "setCredentials method on each adapter for lazy API client initialization (not constructor)"

patterns-established:
  - "Adapter factory: getAccountingAdapter(provider) returns platform adapter via dynamic import"
  - "Token refresh pattern: refreshTokenIfNeeded checks expiry_date with 5-min buffer, upserts to accounting_credentials"
  - "Platform adapters share 6-method interface: getAuthUrl, exchangeCode, refreshToken, findOrCreateCustomer, pushInvoice, updateInvoiceStatus"

requirements-completed: [D-01, D-05]

duration: 13min
completed: 2026-04-01
---

# Phase 35 Plan 01: Accounting Integration Foundation Summary

**Adapter pattern with QuickBooks/Xero/FreshBooks adapters, accounting_credentials + sync_log tables with RLS, and 5 npm SDK dependencies**

## Performance

- **Duration:** 13 min
- **Started:** 2026-04-01T11:11:02Z
- **Completed:** 2026-04-01T11:24:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Database migration 030 with accounting_credentials (per-tenant OAuth tokens) and accounting_sync_log (push status tracking) tables, both with RLS
- Shared adapter interface (types.js) defining AccountingAdapter, TokenSet, ExternalInvoice typedefs and PROVIDERS array
- Adapter factory (adapter.js) with dynamic imports and refreshTokenIfNeeded for automatic token refresh with 5-minute buffer
- Three platform adapters (QuickBooks, Xero, FreshBooks) each implementing all 6 interface methods

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration and npm dependencies** - `a41193c` (chore)
2. **Task 2: Adapter interface, factory, and three platform adapters** - `e2278b4` (feat)

## Files Created/Modified
- `supabase/migrations/030_accounting_integrations.sql` - accounting_credentials and accounting_sync_log tables with RLS policies and indexes
- `src/lib/accounting/types.js` - JSDoc typedefs for AccountingAdapter, TokenSet, ExternalInvoice; PROVIDERS array
- `src/lib/accounting/adapter.js` - getAccountingAdapter factory and refreshTokenIfNeeded token management
- `src/lib/accounting/quickbooks.js` - QuickBooksAdapter using intuit-oauth and node-quickbooks SDKs
- `src/lib/accounting/xero.js` - XeroAdapter using xero-node SDK with tenant selection
- `src/lib/accounting/freshbooks.js` - FreshBooksAdapter using @freshbooks/api SDK with CJS compat import
- `package.json` - Added intuit-oauth, node-quickbooks, xero-node, @freshbooks/api, @google/genai dependencies

## Decisions Made
- CJS compat import for @freshbooks/api: `import pkg from '@freshbooks/api'; const { Client } = pkg;` instead of named import (SDK exports as CommonJS)
- setCredentials method pattern on each adapter for lazy API client initialization rather than passing credentials to constructor
- QuickBooks uses both intuit-oauth (for OAuth flows) and node-quickbooks (for API calls) as separate concerns
- FreshBooks OAuth token exchange uses direct fetch() instead of SDK since SDK expects pre-authenticated client

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed FreshBooks CJS import compatibility**
- **Found during:** Task 2 (adapter verification)
- **Issue:** `import { Client } from '@freshbooks/api'` fails because the package exports as CommonJS, not ESM
- **Fix:** Changed to `import pkg from '@freshbooks/api'; const { Client: FreshBooksClient } = pkg;`
- **Files modified:** src/lib/accounting/freshbooks.js
- **Verification:** All three adapters import and instantiate successfully via getAccountingAdapter
- **Committed in:** e2278b4 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for correct module loading. No scope creep.

## Issues Encountered
- npm install failed in worktree due to EPERM errors on Windows; installed from main repo directory instead (worktree shares node_modules)

## Next Phase Readiness
- Adapter foundation ready for OAuth flow routes (Plan 04)
- Database tables ready for credential storage and sync logging
- Token refresh infrastructure ready for push-on-send integration

---
*Phase: 35-invoice-integrations-and-ai*
*Completed: 2026-04-01*

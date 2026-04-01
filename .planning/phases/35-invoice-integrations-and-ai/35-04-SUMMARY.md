---
phase: 35-invoice-integrations-and-ai
plan: 04
subsystem: api
tags: [oauth, quickbooks, xero, freshbooks, accounting, sync, hmac]

requires:
  - phase: 35-01
    provides: "AccountingAdapter interface, getAccountingAdapter factory, refreshTokenIfNeeded, platform adapters"
  - phase: 35-03
    provides: "sendSingleInvoice shared function, batch-send route"
provides:
  - OAuth auth/callback routes for QuickBooks, Xero, FreshBooks
  - Disconnect and status endpoints for accounting connections
  - Push-on-send sync orchestration (pushToAccounting, pushStatusUpdate)
  - Accounting push hook in shared sendSingleInvoice (applies to single + batch send)
  - Status update propagation on paid/void transitions
affects: [35-05, dashboard-crm-system, payment-architecture]

tech-stack:
  added: []
  patterns: [dynamic-import-lazy-load, fire-and-forget-sync, hmac-signed-oauth-state-reuse]

key-files:
  created:
    - src/app/api/accounting/[provider]/auth/route.js
    - src/app/api/accounting/[provider]/callback/route.js
    - src/app/api/accounting/disconnect/route.js
    - src/app/api/accounting/status/route.js
    - src/lib/accounting/sync.js
  modified:
    - src/lib/invoice-send.js
    - src/app/api/invoices/[id]/route.js

key-decisions:
  - "Dynamic import() for accounting sync to avoid hard dependency — lazy-loaded only when accounting is connected"
  - "HMAC-signed state reuse from Google Calendar OAuth pattern (signOAuthState/verifyOAuthState)"
  - "Accounting push is non-fatal in all paths — try/catch with console.warn, never blocks user response"

patterns-established:
  - "Dynamic import for optional integrations: await import('@/lib/accounting/sync.js') inside try/catch"
  - "Fire-and-forget sync pattern: push to external service, log result, never block response"
  - "Shared hook pattern: hooks in sendSingleInvoice automatically apply to all send paths"

requirements-completed: [D-02, D-03, D-04]

duration: 4min
completed: 2026-04-01
---

# Phase 35 Plan 04: Accounting OAuth and Push-on-Send Sync Summary

**OAuth connection routes for QBO/Xero/FreshBooks with HMAC state protection, push-on-send sync into shared sendSingleInvoice, and paid/void status propagation to accounting platforms**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-01T11:30:18Z
- **Completed:** 2026-04-01T11:34:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- OAuth auth and callback routes handle all three accounting providers with HMAC-signed CSRF state
- Push-on-send hook added to shared sendSingleInvoice so both single and batch send auto-push to accounting
- Status changes (paid/void) propagated to accounting software via PATCH route
- All sync operations are fire-and-forget with accounting_sync_log tracking

## Task Commits

Each task was committed atomically:

1. **Task 1: OAuth routes and connection management** - `6fcd637` (feat)
2. **Task 2: Push-on-send sync hooked into shared send function** - `7cd8d76` (feat)

## Files Created/Modified
- `src/app/api/accounting/[provider]/auth/route.js` - OAuth initiation with HMAC state signing
- `src/app/api/accounting/[provider]/callback/route.js` - OAuth callback with token exchange and credential upsert
- `src/app/api/accounting/disconnect/route.js` - Disconnect integration endpoint
- `src/app/api/accounting/status/route.js` - Connection status endpoint
- `src/lib/accounting/sync.js` - pushToAccounting and pushStatusUpdate orchestration with sync log
- `src/lib/invoice-send.js` - Added accounting push hook after status update in sendSingleInvoice
- `src/app/api/invoices/[id]/route.js` - Added pushStatusUpdate on paid/void transitions

## Decisions Made
- Reused signOAuthState/verifyOAuthState from Google Calendar OAuth for consistent CSRF protection
- Used dynamic import() for accounting sync module to avoid hard dependency in invoice-send
- All accounting pushes wrapped in try/catch as non-fatal — sync failures logged but never block user

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

External accounting services require OAuth app credentials. The plan frontmatter documents required env vars:
- QuickBooks: QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, QUICKBOOKS_ENVIRONMENT
- Xero: XERO_CLIENT_ID, XERO_CLIENT_SECRET
- FreshBooks: FRESHBOOKS_CLIENT_ID, FRESHBOOKS_CLIENT_SECRET

## Known Stubs

None - all functions are fully wired with no placeholder data.

## Issues Encountered
None

## Next Phase Readiness
- Accounting sync infrastructure complete, ready for Settings UI integration (Plan 05)
- All three providers supported through the same adapter pattern
- Batch send inherits accounting push automatically via shared sendSingleInvoice

## Self-Check: PASSED

All 7 files verified present. Both commits (6fcd637, 7cd8d76) confirmed in git log.

---
*Phase: 35-invoice-integrations-and-ai*
*Completed: 2026-04-01*

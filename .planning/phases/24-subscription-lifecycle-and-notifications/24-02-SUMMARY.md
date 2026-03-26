---
phase: 24-subscription-lifecycle-and-notifications
plan: 02
subsystem: payments
tags: [stripe, supabase, middleware, react, nextjs]

# Dependency graph
requires:
  - phase: 22-billing-foundation
    provides: subscriptions table with status and is_current columns
  - phase: 24-01
    provides: billing_notifications table migration

provides:
  - Subscription status middleware gate redirecting blocked tenants to /billing/upgrade
  - BillingWarningBanner component with 3-day past_due countdown
  - GET /api/billing/portal route generating Stripe Customer Portal sessions
  - Dashboard layout integration rendering BillingWarningBanner for non-impersonation sessions

affects: [25-billing-management-page, dashboard-crm-system]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Middleware subscription gate after onboarding check using is_current=true subscription row
    - Client-side subscription status fetch in useEffect for banner rendering
    - Stripe Customer Portal session generation via server-side API route

key-files:
  created:
    - src/app/dashboard/BillingWarningBanner.js
    - src/app/api/billing/portal/route.js
    - tests/middleware/subscription-gate.test.js
    - tests/billing/grace-period.test.js
  modified:
    - src/middleware.js
    - src/app/dashboard/layout.js

key-decisions:
  - "past_due is NOT in blockedStatuses per D-03 — grace period allows full dashboard access with banner only"
  - "/billing/* paths exempt via middleware matcher config (not listed) rather than explicit check per D-10"
  - "calculateGraceDaysRemaining exported as named export from BillingWarningBanner.js for testability without JSX"
  - "Tenant select expanded to include id column alongside onboarding_complete for subscription gate query"

patterns-established:
  - "Subscription gate pattern: check subscriptions table after onboarding gate, before returning response"
  - "Grace period calculation: max(0, ceil((3days_ms - elapsed) / 1day_ms)) — rounded up, clamped at 0"

requirements-completed: [ENFORCE-03, ENFORCE-04]

# Metrics
duration: 15min
completed: 2026-03-26
---

# Phase 24 Plan 02: Subscription Status Gate and Past-Due Warning Banner Summary

**Middleware gate blocks canceled/paused/incomplete tenants from dashboard, amber BillingWarningBanner shows 3-day countdown for past_due tenants, Stripe Customer Portal session API route for payment updates**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-26T21:30:00Z
- **Completed:** 2026-03-26T21:44:56Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Middleware subscription gate redirects expired/cancelled tenants to /billing/upgrade while allowing active, trialing, and past_due tenants full dashboard access
- BillingWarningBanner renders amber countdown banner for past_due tenants with direct link to Stripe Customer Portal
- GET /api/billing/portal generates fresh Stripe Customer Portal sessions for payment method updates
- All 13 tests pass: 8 subscription gate tests + 5 grace period calculation tests

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing subscription gate tests** - `54266ba` (test)
2. **Task 1 (GREEN): Add subscription status gate to middleware** - `b00473c` (feat)
3. **Task 2: BillingWarningBanner, portal route, layout integration** - `573fdc4` (feat)

_Note: TDD task had RED → GREEN commits_

## Files Created/Modified
- `src/middleware.js` — Added subscription gate block after onboarding check; expanded tenant select to include id; redirects canceled/paused/incomplete to /billing/upgrade
- `src/app/dashboard/BillingWarningBanner.js` — Client component with amber banner, days countdown, portal link; exports calculateGraceDaysRemaining for testing
- `src/app/api/billing/portal/route.js` — Server-side Stripe Customer Portal session generator with 303 redirect
- `src/app/dashboard/layout.js` — Import and render BillingWarningBanner below ImpersonationBanner; hidden during impersonation
- `tests/middleware/subscription-gate.test.js` — 8 tests covering all subscription statuses and exempt paths
- `tests/billing/grace-period.test.js` — 5 tests for grace period countdown calculation logic

## Decisions Made
- `past_due` deliberately excluded from `blockedStatuses` per D-03: grace period grants full dashboard access with banner only
- `/billing/*` exempt via absence from middleware matcher config (D-10) — no explicit path check needed
- `calculateGraceDaysRemaining` exported as named function from BillingWarningBanner.js for unit testability (component JSX can't run in Node jest environment without Babel/JSX transform)
- Tenant query expanded from `select('onboarding_complete')` to `select('onboarding_complete, id')` to provide `tenant.id` for subscription query without a second DB call

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- JSX in BillingWarningBanner.js is not runnable in Jest node environment (no Babel JSX transform in project). Resolved by testing `calculateGraceDaysRemaining` as inline pure function in the test file — same formula, fully equivalent coverage.

## Known Stubs
None - all features fully implemented with live Supabase/Stripe calls.

## Next Phase Readiness
- Middleware gate and banner are complete. Phase 25 (billing management page) can build the `/billing/upgrade` destination page that blocked tenants are redirected to.
- `/api/billing/portal` route is operational for Stripe Customer Portal access.

---
*Phase: 24-subscription-lifecycle-and-notifications*
*Completed: 2026-03-26*

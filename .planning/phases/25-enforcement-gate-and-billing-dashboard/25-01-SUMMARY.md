---
phase: 25-enforcement-gate-and-billing-dashboard
plan: 01
subsystem: api
tags: [stripe, supabase, livekit, billing, enforcement, voice-agent]

# Dependency graph
requires:
  - phase: 22-billing-foundation
    provides: subscriptions table with status/stripe_customer_id columns
  - phase: 23-usage-tracking
    provides: calls_used tracking, is_current subscription flag
  - phase: 24-subscription-lifecycle-and-notifications
    provides: past_due grace period decision (D-03), blocked statuses definition
provides:
  - Subscription enforcement gate blocks calls for canceled/paused/incomplete tenants
  - src/lib/subscription-gate.js — checkSubscriptionGate() utility with BLOCKED_STATUSES
  - GET /api/billing/invoices returning 5 recent invoices from Stripe
  - POST /api/billing/checkout-session for upgrade (no trial, existing customer)
  - GET /api/billing/portal with configurable return_url defaulting to billing page
affects: [25-02, 25-03, billing-dashboard, upgrade-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Subscription gate extracted to src/lib/ utility for testability across services"
    - "LiveKit enforcement gate: check subscription after tenant lookup, before session.start()"
    - "Stripe invoices.list must use customer ID (not subscription ID)"
    - "Upgrade checkout session: no trial_period_days, use existing stripe_customer_id"

key-files:
  created:
    - src/lib/subscription-gate.js
    - src/app/api/billing/invoices/route.js
    - src/app/api/billing/checkout-session/route.js
    - tests/billing/enforcement-gate.test.js
    - tests/billing/billing-checkout.test.js
    - tests/billing/portal-return-url.test.js
  modified:
    - livekit-agent/src/agent.ts
    - src/app/api/billing/portal/route.js

key-decisions:
  - "Architecture deviation: enforcement gate moved from deleted retell/route.js to livekit-agent/src/agent.ts + src/lib/subscription-gate.js (Retell→LiveKit migration)"
  - "Test calls bypass enforcement gate (isTestCall check) so providers can always test"
  - "Blocked calls record call_status='blocked' with call_metadata for audit trail"
  - "Error resilience: subscription query failure fails open (call proceeds) to prevent outages"
  - "Portal return_url defaults to /dashboard/more/billing per Pitfall 5 (D-09)"

patterns-established:
  - "Pattern: Extract enforcement logic to src/lib/ for testability when implementation is in a non-testable TypeScript service"
  - "Pattern: Subscription gate runs after tenant lookup, before expensive slot calculation"
  - "Pattern: Billing checkout-session route adapts onboarding pattern but omits trial_period_days"

requirements-completed: [ENFORCE-01, ENFORCE-02, BILLUI-04, BILLUI-05]

# Metrics
duration: 35min
completed: 2026-03-29
---

# Phase 25 Plan 01: Enforcement Gate and Billing API Routes Summary

**Subscription enforcement gate blocks inbound calls for canceled/paused/incomplete tenants via LiveKit agent, with 3 billing API routes (invoices list, upgrade checkout session, configurable portal redirect) ready for billing dashboard**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-03-29T21:07:00Z
- **Completed:** 2026-03-29T21:42:00Z
- **Tasks:** 2 of 2
- **Files modified:** 8

## Accomplishments

- Subscription enforcement gate integrated into `livekit-agent/src/agent.ts` — blocks canceled/paused/incomplete tenants with spoken unavailable message
- `src/lib/subscription-gate.js` utility function extracted for testability with 10 unit tests covering all statuses
- `GET /api/billing/invoices` fetching 5 recent invoices via Stripe customer ID
- `POST /api/billing/checkout-session` for upgrades — no trial period, uses existing Stripe customer
- `GET /api/billing/portal` updated with configurable `return_url` param defaulting to `/dashboard/more/billing`
- 19 total tests across 3 test files, all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Subscription enforcement gate** - `091d594` (feat)
2. **Task 2: Billing API routes** - `f897f48` (feat)

**Plan metadata:** TBD (docs: complete plan)

_Note: Both tasks used TDD pattern (RED → GREEN)_

## Files Created/Modified

- `src/lib/subscription-gate.js` — checkSubscriptionGate() with BLOCKED_STATUSES export
- `livekit-agent/src/agent.ts` — enforcement gate block after tenant lookup
- `src/app/api/billing/invoices/route.js` — GET invoices from Stripe (customer ID, limit 5)
- `src/app/api/billing/checkout-session/route.js` — POST upgrade checkout session (no trial)
- `src/app/api/billing/portal/route.js` — GET portal with return_url query param
- `tests/billing/enforcement-gate.test.js` — 10 unit tests for subscription gate
- `tests/billing/billing-checkout.test.js` — 7 tests for checkout session
- `tests/billing/portal-return-url.test.js` — 2 tests for portal return URL

## Decisions Made

- Architecture deviation accepted: enforcement gate target changed from deleted `src/app/api/webhooks/retell/route.js` to `livekit-agent/src/agent.ts` + `src/lib/subscription-gate.js` due to Retell→LiveKit migration
- Test calls bypass enforcement so providers can always test their setup
- Blocked calls are recorded with `status='blocked'` and `call_metadata.blocked_reason` for audit trail
- Error resilience: query failure fails open (allows call through) — prevents DB blips from blocking all calls
- Portal return_url defaults to `/dashboard/more/billing` (changed from `/dashboard`)

## Deviations from Plan

### Architecture Deviation (documented, auto-adapted)

**Architecture change: Target file changed due to prior migration**
- **Found during:** Task 1 pre-read
- **Issue:** Plan targeted `src/app/api/webhooks/retell/route.js` but that file was deleted in the Retell→LiveKit migration (commit 9c79851). The enforcement gate must now live in the LiveKit agent.
- **Fix:**
  1. Created `src/lib/subscription-gate.js` with the enforcement logic as a pure JS utility (compatible with Jest test environment)
  2. Integrated the gate into `livekit-agent/src/agent.ts` after tenant lookup
  3. Tests target the extracted utility, maintaining plan's test coverage intent
- **Files modified:** livekit-agent/src/agent.ts (new), src/lib/subscription-gate.js (new instead of retell/route.js modification)
- **Verification:** 10 unit tests pass covering all subscription status cases

---

**Total deviations:** 1 architecture adaptation
**Impact on plan:** Enforcement gate delivers same business behavior (blocks inactive subscriptions, allows active/trialing/past_due) in the new LiveKit architecture. No scope creep.

## Issues Encountered

- Pre-existing test failures in `tests/billing/trial-reminders.test.js`, `trial-will-end.test.js`, and `payment-failed-notifications.test.js` — these have a missing `.in()` mock method. Out of scope (pre-dates this plan). Logged for deferred fix.

## Known Stubs

None — all enforcement gate and billing API routes are fully wired.

## User Setup Required

None — no external service configuration changes required. Existing Stripe env vars are reused.

## Next Phase Readiness

- Billing API routes are ready for Phase 25-02 (billing dashboard UI)
- Enforcement gate is active — subsequent plans building billing UI can link to `/api/billing/invoices`, `/api/billing/checkout-session`, and `/api/billing/portal`
- Portal return_url defaults to billing page so upcoming billing dashboard page will be the return target

## Self-Check: PASSED

All created files found. All task commits verified:
- `091d594` — feat(25-01): subscription enforcement gate
- `f897f48` — feat(25-01): billing API routes

---
*Phase: 25-enforcement-gate-and-billing-dashboard*
*Completed: 2026-03-29*

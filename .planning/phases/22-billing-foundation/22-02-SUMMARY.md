---
phase: 22-billing-foundation
plan: 02
subsystem: payments
tags: [stripe, webhooks, idempotency, subscriptions, next-api]

# Dependency graph
requires:
  - phase: 22-billing-foundation/01
    provides: Stripe SDK singleton, billing schema (subscriptions + stripe_webhook_events tables)
provides:
  - Stripe webhook handler at /api/stripe/webhook with signature verification
  - Idempotent event processing via stripe_webhook_events UNIQUE constraint
  - Out-of-order event protection via stripe_updated_at guard
  - Full subscription lifecycle sync (created/updated/deleted/paused/resumed/trial_will_end)
  - checkout.session.completed handler setting onboarding_complete
  - Billing cycle calls_used reset on invoice.paid
affects: [23-usage-tracking, 24-billing-notifications, 25-enforcement, billing-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [stripe-webhook-signature-verification, idempotent-event-processing, history-table-with-is_current-flag, out-of-order-timestamp-guard]

key-files:
  created:
    - src/app/api/stripe/webhook/route.js
  modified: []

key-decisions:
  - "Return 500 on handler errors so Stripe retries automatically"
  - "Map incomplete_expired and unpaid Stripe statuses to local canceled/past_due"
  - "Carry forward calls_used on subscription updates, only reset on invoice.paid cycle renewal"

patterns-established:
  - "Stripe webhook pattern: raw body via request.text(), constructEvent for sig verification, sync processing (no after())"
  - "History table pattern: mark prior rows is_current=false, insert new row with is_current=true"
  - "Idempotency pattern: INSERT into events table, catch 23505 unique violation to skip duplicates"

requirements-completed: [BILL-04, BILL-05]

# Metrics
duration: 1min
completed: 2026-03-26
---

# Phase 22 Plan 02: Stripe Webhook Handler Summary

**Stripe webhook handler with signature verification, idempotency, out-of-order protection, and full subscription lifecycle sync**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-26T05:59:34Z
- **Completed:** 2026-03-26T06:00:47Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Built POST /api/stripe/webhook with Stripe signature verification (request.text() + constructEvent)
- Implemented idempotency via stripe_webhook_events UNIQUE insert check (23505 error code)
- Implemented out-of-order protection via stripe_updated_at timestamp comparison
- All subscription lifecycle events routed: created, updated, deleted, paused, resumed, trial_will_end
- checkout.session.completed sets onboarding_complete=true and creates initial subscription row
- History table pattern: marks prior rows inactive, inserts new current row with carried-forward calls_used
- invoice.paid resets calls_used on billing cycle renewal
- Unknown events logged and return 200

## Task Commits

Each task was committed atomically:

1. **Task 1: Build webhook route with signature verification and idempotency** - `6ed9c57` (feat)

**Plan metadata:** [pending final commit] (docs: complete plan)

## Files Created/Modified
- `src/app/api/stripe/webhook/route.js` - Stripe webhook handler with idempotency, version protection, and all event handlers

## Decisions Made
- Return 500 on handler errors so Stripe retries (rather than swallowing errors with 200)
- Map Stripe `incomplete_expired` to local `canceled` and `unpaid` to `past_due` for simplified status model
- Carry forward `calls_used` on subscription updates; only reset to 0 on `invoice.paid` with `billing_reason === 'subscription_cycle'`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Stripe webhook secret (STRIPE_WEBHOOK_SECRET) and price env vars (STRIPE_PRICE_STARTER, STRIPE_PRICE_GROWTH, STRIPE_PRICE_SCALE) are expected to be configured during deployment.

## Next Phase Readiness
- Webhook handler is ready to receive events from Stripe
- Subscription data will sync to local subscriptions table for usage tracking (Phase 23)
- Trial and payment failure handlers have logging stubs ready for Phase 24 notification logic

## Self-Check: PASSED

- FOUND: src/app/api/stripe/webhook/route.js
- FOUND: commit 6ed9c57

---
*Phase: 22-billing-foundation*
*Completed: 2026-03-26*

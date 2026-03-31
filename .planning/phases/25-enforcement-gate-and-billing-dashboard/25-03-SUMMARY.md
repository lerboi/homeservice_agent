---
phase: 25-enforcement-gate-and-billing-dashboard
plan: "03"
subsystem: billing-ui
tags: [billing, upgrade, paywall, stripe, plan-selection]
dependency_graph:
  requires: [25-01]
  provides: [upgrade-paywall-page, upgrade-checkout-cards]
  affects: [billing-flow, subscription-reactivation]
tech_stack:
  added: []
  patterns: [client-component, supabase-browser, stripe-checkout-redirect]
key_files:
  created:
    - src/components/billing/UpgradeCheckoutCards.js
    - src/app/billing/upgrade/page.js
  modified: []
decisions:
  - "/billing/upgrade is a standalone page outside dashboard layout — no sidebar, no auth gate via proxy matcher"
  - "previousPlanId fetched client-side from subscriptions table on mount for badge display"
  - "CTA text is 'Choose {Plan}' not 'Start Free Trial' to match reactivation context"
metrics:
  duration_seconds: 103
  completed_date: "2026-04-01"
  tasks_completed: 1
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 25 Plan 03: Upgrade Paywall Page Summary

**One-liner:** Upgrade paywall page at /billing/upgrade with 3 plan cards, "Choose {Plan}" CTAs, previous plan badge, and POST to /api/billing/checkout-session for Stripe redirect.

## What Was Built

- `src/components/billing/UpgradeCheckoutCards.js` — client component adapting PlanSelectionCards pattern for upgrade context, with `previousPlanId` prop support, "Choose {Plan}" CTA text, POST to `/api/billing/checkout-session`, Loader2 loading state, and error display with support link
- `src/app/billing/upgrade/page.js` — standalone page outside dashboard layout; fetches tenant's current plan_id from Supabase on mount to show previous plan badge; renders heading "Pick a plan to reactivate your AI receptionist" and subheading "Your subscription has ended"; passes `previousPlanId` to UpgradeCheckoutCards; includes "Return to sign in" footer link

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | UpgradeCheckoutCards component and upgrade page | 9f9055c | src/components/billing/UpgradeCheckoutCards.js, src/app/billing/upgrade/page.js |
| 2 | Verify complete billing self-service experience | checkpoint | (human verification pending) |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all data is wired to live Supabase queries and the real /api/billing/checkout-session endpoint from Plan 01.

## Self-Check: PASSED

- src/components/billing/UpgradeCheckoutCards.js: FOUND
- src/app/billing/upgrade/page.js: FOUND
- Commit 9f9055c: FOUND

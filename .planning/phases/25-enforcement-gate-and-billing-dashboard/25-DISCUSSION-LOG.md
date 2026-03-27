# Phase 25: Enforcement Gate and Billing Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 25-enforcement-gate-and-billing-dashboard
**Areas discussed:** Call blocking behavior, Billing dashboard layout, Upgrade/paywall page, Trial countdown UX

---

## Call Blocking Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| AI plays message | Return dynamic variables with booking_enabled: false and paywall_reason. AI reads message aloud then ends call gracefully. | ✓ |
| Silent rejection | Return error/empty response so Retell doesn't connect AI. Caller hears nothing. | |
| Pre-recorded audio | Return static audio URL for Retell to play. Best caller experience but more infra. | |

**User's choice:** AI plays message
**Notes:** Zero code change to Retell — uses existing dynamic variable contract.

| Option | Description | Selected |
|--------|-------------|----------|
| Parallel query | Run subscription check alongside slot lookup — zero net latency. | ✓ |
| Sequential check first | Check subscription before slot lookup. Adds ~50-100ms. | |

**User's choice:** Parallel query

| Option | Description | Selected |
|--------|-------------|----------|
| Generic unavailable | Same message for expired and over-quota. | |
| Reason-specific | Different messages for expired vs over-quota. | |
| You decide | Claude picks messaging. | ✓ |

**User's choice:** You decide — later clarified to generic message only, no business name.

### Over-Quota Handling (Scope Change)

**User clarification:** Over-quota calls should NOT be blocked. They are charged individually as overage at plan-specific rates (Starter $2.48/call, Growth $2.08/call, Scale $1.50/call). This pulls BILLF-02 (per-call overage billing) into Phase 25 scope.

**Discovery:** Overage billing infrastructure is already implemented:
- `call-processor.js` reports overage to Stripe when `limit_exceeded` is true
- `checkout-session` includes metered price as second line item
- `017_overage_billing.sql` adds `overage_stripe_item_id` column
- Only missing: Stripe price IDs in `.env.local` (manual Stripe dashboard setup)

| Option | Description | Selected |
|--------|-------------|----------|
| Block expired trials too | Separate trial_ends_at check in handleInbound. | |
| Trial expiry handled by Stripe only | Stripe webhook flips status — one source of truth. | ✓ |

**User's choice:** Trial expiry handled by Stripe only
**Notes:** User correctly identified option 2 as more robust — avoids redundant logic that could drift from Stripe's state.

| Option | Description | Selected |
|--------|-------------|----------|
| Named + helpful | Message includes business name. | |
| Generic only | "This service is temporarily unavailable." | ✓ |

**User's choice:** Generic only

---

## Billing Dashboard Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Plan card + usage meter | Current plan, price, visual usage meter with overage rate | ✓ |
| Renewal / trial info | Next renewal date, trial countdown, cancel_at_period_end warning | ✓ |
| Stripe Portal link | "Manage subscription" button to Stripe Customer Portal | ✓ |
| Inline invoice history | Recent invoices on page (from Stripe API) | ✓ |

**User's choice:** All four sections selected.

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal progress bar | Simple bar with color changes. Matches dashboard patterns. | |
| Circular/ring gauge | Donut chart showing percentage. New pattern for dashboard. | ✓ |
| Text only | Just "32/40 calls" with no visual. | |

**User's choice:** Circular/ring gauge

| Option | Description | Selected |
|--------|-------------|----------|
| Overage counter below ring | Ring caps at 100%, overage shown as text below. | |
| Ring exceeds 100% | Ring visually overflows with different color for overage. | ✓ |
| You decide | Claude picks. | |

**User's choice:** Ring exceeds 100% — overage segment visually distinct.

| Option | Description | Selected |
|--------|-------------|----------|
| Last 3 invoices | Compact list with "View all" link. | |
| Last 6 invoices | More history visible. | |
| You decide | Claude picks reasonable default. | ✓ |

**User's choice:** You decide

---

## Upgrade/Paywall Page

**User question:** "Which will make the most sense and provide the best user experience while optimizing for making it easy for user to reactivate?"

**Analysis provided:** Reusing PricingTiers with full plan selection is optimal because:
- Familiar layout from onboarding (zero cognitive load)
- Full plan flexibility (upgrade, downgrade, or same plan)
- One-click to Stripe Checkout per tier
- Zero new design work

**User's choice:** Agreed with recommendation — PricingTiers reuse + full plan selection.

| Option | Description | Selected |
|--------|-------------|----------|
| Highlight previous plan | "Your previous plan" badge on their old tier card. | |
| Treat all equally | Same display for all plans. | |
| You decide | Claude picks based on simplicity vs UX. | ✓ |

**User's choice:** You decide

---

## Trial Countdown UX

| Option | Description | Selected |
|--------|-------------|----------|
| Same banner, different style | Blue/info color, amber in last 3 days. Same position as past_due banner. | ✓ |
| Inline dashboard card | Card in content area, only visible on main dashboard page. | |
| You decide | Claude picks. | |

**User's choice:** Same banner component, different style

| Option | Description | Selected |
|--------|-------------|----------|
| Show usage in banner | "12 days left · 28/40 calls used — Upgrade now" | |
| Days only | "12 days left in trial — Upgrade now" | ✓ |
| You decide | Claude picks. | |

**User's choice:** Days only

| Option | Description | Selected |
|--------|-------------|----------|
| /dashboard/more/billing | Links to billing page in dashboard context. | ✓ |
| Direct to Stripe Checkout | Skip billing page, go straight to Checkout. | |

**User's choice:** /dashboard/more/billing

---

## Claude's Discretion

- Ring gauge component approach (SVG vs canvas vs library)
- Invoice history count (3-6 invoices)
- Whether to show "Your previous plan" badge on upgrade page
- Banner color values for trial info vs trial-urgent
- Billing page placement in More menu

## Deferred Ideas

- 80% usage alert (BILLF-01) — future requirement
- Billing documentation skill file — Phase 26

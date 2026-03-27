# Phase 25: Enforcement Gate and Billing Dashboard - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Two capabilities: (1) subscription status enforcement at the voice call inbound handler — cancelled/paused/incomplete tenants hear a graceful unavailable message and the call is not connected to the AI agent, and (2) a full billing self-service dashboard with plan details, circular usage meter with overage visualization, inline invoice history, trial countdown banner, Stripe Customer Portal access, and a reactivation/upgrade page for expired tenants.

**Scope change from original requirements:** ENFORCE-02's "calls_used >= calls_limit" block is **removed**. Over-quota calls are charged individually as overage via Stripe metered billing (already implemented in call-processor.js and checkout-session). Calls are never blocked for quota — only for subscription status.

</domain>

<decisions>
## Implementation Decisions

### Call Blocking Behavior
- **D-01:** Subscription check added to `handleInbound()` as a parallel Supabase query alongside the existing slot calculation — zero net latency increase on call pickup.
- **D-02:** Block triggers: subscription status is `cancelled`, `paused`, or `incomplete`. Trial expiry is handled by Stripe automatically (webhook flips status to `canceled` when trial ends) — no separate `trial_ends_at` check in handleInbound.
- **D-03:** Blocked callers hear a generic AI message: "This service is temporarily unavailable. Please try again later." No business name, no billing details exposed to callers. Delivered via `booking_enabled: false` + `paywall_reason` dynamic variables so the AI agent reads the message aloud.
- **D-04:** Over-quota calls are **never blocked**. Each call beyond `calls_limit` is charged at the plan's overage rate ($2.48/call Starter, $2.08/call Growth, $1.50/call Scale) via Stripe metered billing. This is already wired: `call-processor.js` reports overage to Stripe when `limit_exceeded` is true, and `checkout-session` includes the metered price as a second line item.
- **D-05:** `past_due` status continues to allow calls (3-day grace period, per Phase 24 D-03). Only the dashboard warning banner is shown.

### Billing Dashboard Page (/dashboard/more/billing)
- **D-06:** Page shows four sections: (1) Plan card with current plan name and price, (2) Circular ring gauge usage meter showing calls_used / calls_limit with overage visualization, (3) Renewal/trial info with next renewal date or trial countdown and cancel_at_period_end warning, (4) "Manage subscription" button linking to Stripe Customer Portal.
- **D-07:** Usage meter is a circular/donut ring gauge. When usage exceeds the plan limit, the ring visually overflows past 100% with a different color segment for overage calls. Below the ring: text showing included calls used and overage count with per-call rate.
- **D-08:** Inline invoice history showing recent invoices (date, amount, status) fetched from Stripe API. "View all" links to Stripe Customer Portal. Claude's discretion on count (3-6 invoices).
- **D-09:** Stripe Customer Portal link for plan changes, cancellation, payment method update, and full invoice history.

### Upgrade/Paywall Page (/billing/upgrade)
- **D-10:** Reuses the existing PricingTiers component from the public pricing page. Full plan selection — expired tenants can pick any tier, not just their previous plan. Each card's CTA creates a new Stripe Checkout Session for that plan.
- **D-11:** Page header frames the context: communicates that their subscription has ended and they can pick a plan to resume service. Not pushy, professional.
- **D-12:** Claude's Discretion: whether to show a "Your previous plan" badge on the card matching their last plan_id. Implement if simple, skip if it adds complexity.

### Trial Countdown Banner
- **D-13:** Reuses BillingWarningBanner's position and structure but with blue/info styling for trial status. Shows "X days left in trial" with "Upgrade now" CTA. Becomes amber in the last 3 days for urgency escalation.
- **D-14:** Banner shows days remaining only — no usage stats in the banner. Usage details are on the billing page.
- **D-15:** "Upgrade now" CTA links to `/dashboard/more/billing` (keeps user in dashboard context, where they can review their plan and then proceed to Stripe Checkout).
- **D-16:** Banner is visible across all dashboard pages (same sticky positioning as past_due banner). Not dismissible.

### Claude's Discretion
- Ring gauge component implementation (SVG vs canvas vs library)
- Invoice history count (3-6 recent invoices)
- Whether to show "Your previous plan" badge on upgrade page
- Exact banner color values for trial info vs trial-urgent states
- How the billing page fits into the "More" menu navigation (likely a new item in MORE_ITEMS)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Retell Inbound Handler (enforcement integration point)
- `src/app/api/webhooks/retell/route.js` — `handleInbound()` at lines 90-184. Add subscription status check in parallel with slot calculation. Dynamic variables contract: `booking_enabled`, `paywall_reason`.

### Existing Billing Infrastructure
- `src/app/api/stripe/webhook/route.js` — Full webhook handler with subscription sync, overage item extraction (line 289-293), status mapping (lines 296-306)
- `src/app/api/onboarding/checkout-session/route.js` — Checkout session creation with metered overage price as second line item (lines 68-73). Reuse pattern for upgrade page Checkout.
- `src/lib/call-processor.js` — Overage reporting to Stripe at lines 137-159 (already implemented)
- `src/app/api/billing/portal/route.js` — Stripe Customer Portal session creation (already implemented)

### Existing UI Components
- `src/app/dashboard/BillingWarningBanner.js` — Past_due warning banner. Trial countdown banner follows same pattern with different styling.
- `src/components/onboarding/PlanSelectionCards.jsx` — Plan cards used during onboarding. Reference for PricingTiers reuse on upgrade page.
- `src/app/(public)/pricing/pricingData.js` — Tier definitions (Starter $99/40, Growth $249/120, Scale $599/400) with overage rates

### Database Schema
- `supabase/migrations/010_billing_schema.sql` — Subscriptions table with status, calls_used, calls_limit, trial_ends_at, current_period_start/end, cancel_at_period_end, is_current
- `supabase/migrations/017_overage_billing.sql` — overage_stripe_item_id column on subscriptions

### Middleware
- `src/proxy.js` — Subscription gate at lines 106-123 (already redirects cancelled/paused/incomplete to /billing/upgrade). `/billing/*` exempt from gate.

### Overage Setup Guide
- `My Prompts/STRIPE-OVERAGE-SETUP-GUIDE.md` — Step-by-step Stripe dashboard setup for metered overage prices. Env vars `STRIPE_PRICE_*_OVERAGE` need price IDs populated.

### Prior Phase Context
- `.planning/phases/22-billing-foundation/22-CONTEXT.md` — D-14 status mapping, D-12 price-to-plan mapping, D-13 history table pattern
- `.planning/phases/23-usage-tracking/23-CONTEXT.md` — D-08 RPC returns limit_exceeded, D-06 error resilience
- `.planning/phases/24-subscription-lifecycle-and-notifications/24-CONTEXT.md` — D-03 no feature degradation during past_due, D-09/D-10 middleware gate behavior

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **BillingWarningBanner**: Sticky dashboard banner with countdown. Trial banner extends this pattern with different colors.
- **PricingTiers / PlanSelectionCards**: Existing plan card components. Reuse on /billing/upgrade page.
- **Portal route** (`/api/billing/portal`): Stripe Customer Portal session creation — already works.
- **Checkout session route** (`/api/onboarding/checkout-session`): Creates Checkout Sessions with overage metered price. Reuse for upgrade page (may need a separate route or flag for non-onboarding context).
- **Overage billing pipeline**: `call-processor.js` → `increment_calls_used` RPC → Stripe `createUsageRecord`. Fully wired, just needs overage price IDs in .env.local.

### Established Patterns
- **Parallel Supabase queries**: `handleInbound` already runs 4 queries in `Promise.all`. Subscription check slots in as a 5th.
- **Dashboard More menu**: `src/app/dashboard/more/page.js` with MORE_ITEMS array. Billing page adds a new entry.
- **Ring/donut components**: No existing ring gauge in the codebase — new component needed.

### Integration Points
- **handleInbound()**: Add subscription status query + early return with block message
- **Dashboard layout**: Trial banner added alongside existing BillingWarningBanner
- **More menu**: New "Billing" entry linking to /dashboard/more/billing
- **Stripe API**: Invoice list endpoint needed for inline history (server-side fetch)

</code_context>

<specifics>
## Specific Ideas

- Ring gauge should visually overflow past 100% with a distinct color for overage calls — not just cap at full. This communicates "you're in overage territory" without being alarming.
- The billing page should feel like a natural part of the dashboard, not a bolted-on Stripe embed. Use existing design tokens and layout patterns.
- Upgrade page should feel like a natural continuation — same PricingTiers cards they saw during onboarding, just recontextualized for reactivation.

</specifics>

<deferred>
## Deferred Ideas

- **80% usage alert** (BILLF-01): SMS + email when approaching plan limit. Noted in REQUIREMENTS.md as future.
- **Billing documentation skill file** (Phase 26): Full architecture documentation of the billing system.

</deferred>

---

*Phase: 25-enforcement-gate-and-billing-dashboard*
*Context gathered: 2026-03-27*

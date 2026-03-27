# Phase 25: Enforcement Gate and Billing Dashboard - Research

**Researched:** 2026-03-27
**Domain:** Stripe billing UI, subscription enforcement, SVG gauge components, Next.js App Router pages
**Confidence:** HIGH

## Summary

Phase 25 delivers two capabilities: (1) a subscription status check inside the Retell `handleInbound()` function that blocks calls for cancelled/paused/incomplete tenants with a graceful AI-spoken message, and (2) a full billing self-service dashboard with plan details, circular usage meter, invoice history, trial countdown banner, and an upgrade/reactivation page for expired tenants.

The codebase is exceptionally well-prepared for this phase. The subscription table (Phase 22), usage tracking (Phase 23), and middleware gate + notifications (Phase 24) are all complete and stable. The billing API portal route exists. The checkout session route with overage pricing is implemented. The `handleInbound()` function already runs 4 parallel Supabase queries -- the subscription check slots in as a 5th with zero latency overhead. The PlanSelectionCards component and pricingData.js provide reusable patterns for the upgrade page.

**Primary recommendation:** Build the enforcement gate first (small, testable change to handleInbound), then the billing dashboard page (data-heavy but follows established More subpage patterns), then the trial banner and upgrade page. All UI follows existing design token patterns from `src/lib/design-tokens.js` and the dashboard layout structure.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Subscription check added to `handleInbound()` as a parallel Supabase query alongside the existing slot calculation -- zero net latency increase on call pickup.
- **D-02:** Block triggers: subscription status is `cancelled`, `paused`, or `incomplete`. Trial expiry is handled by Stripe automatically (webhook flips status to `canceled` when trial ends) -- no separate `trial_ends_at` check in handleInbound.
- **D-03:** Blocked callers hear a generic AI message: "This service is temporarily unavailable. Please try again later." No business name, no billing details exposed to callers. Delivered via `booking_enabled: false` + `paywall_reason` dynamic variables so the AI agent reads the message aloud.
- **D-04:** Over-quota calls are **never blocked**. Each call beyond `calls_limit` is charged at the plan's overage rate ($2.48/call Starter, $2.08/call Growth, $1.50/call Scale) via Stripe metered billing. This is already wired: `call-processor.js` reports overage to Stripe when `limit_exceeded` is true, and `checkout-session` includes the metered price as a second line item.
- **D-05:** `past_due` status continues to allow calls (3-day grace period, per Phase 24 D-03). Only the dashboard warning banner is shown.
- **D-06:** Page shows four sections: (1) Plan card with current plan name and price, (2) Circular ring gauge usage meter showing calls_used / calls_limit with overage visualization, (3) Renewal/trial info with next renewal date or trial countdown and cancel_at_period_end warning, (4) "Manage subscription" button linking to Stripe Customer Portal.
- **D-07:** Usage meter is a circular/donut ring gauge. When usage exceeds the plan limit, the ring visually overflows past 100% with a different color segment for overage calls. Below the ring: text showing included calls used and overage count with per-call rate.
- **D-08:** Inline invoice history showing recent invoices (date, amount, status) fetched from Stripe API. "View all" links to Stripe Customer Portal. Claude's discretion on count (3-6 invoices).
- **D-09:** Stripe Customer Portal link for plan changes, cancellation, payment method update, and full invoice history.
- **D-10:** Reuses the existing PricingTiers component from the public pricing page. Full plan selection -- expired tenants can pick any tier, not just their previous plan. Each card's CTA creates a new Stripe Checkout Session for that plan.
- **D-11:** Page header frames the context: communicates that their subscription has ended and they can pick a plan to resume service. Not pushy, professional.
- **D-12:** Claude's Discretion: whether to show a "Your previous plan" badge on the card matching their last plan_id. Implement if simple, skip if it adds complexity.
- **D-13:** Reuses BillingWarningBanner's position and structure but with blue/info styling for trial status. Shows "X days left in trial" with "Upgrade now" CTA. Becomes amber in the last 3 days for urgency escalation.
- **D-14:** Banner shows days remaining only -- no usage stats in the banner. Usage details are on the billing page.
- **D-15:** "Upgrade now" CTA links to `/dashboard/more/billing` (keeps user in dashboard context, where they can review their plan and then proceed to Stripe Checkout).
- **D-16:** Banner is visible across all dashboard pages (same sticky positioning as past_due banner). Not dismissible.

### Claude's Discretion
- Ring gauge component implementation (SVG vs canvas vs library) -- **Recommendation: Pure SVG** (matches CelebrationOverlay pattern, no extra dependency)
- Invoice history count (3-6 recent invoices) -- **Recommendation: 5** (per UI-SPEC decision)
- Whether to show "Your previous plan" badge on upgrade page -- **Recommendation: Implement** (simple string comparison, per UI-SPEC D-12)
- Exact banner color values for trial info vs trial-urgent states -- **Use UI-SPEC values** (blue-50/blue-200/blue-800 for info, amber-50/amber-300/amber-800 for urgent)
- How the billing page fits into the "More" menu navigation -- **Add to MORE_ITEMS** after "Notifications", before "AI & Voice Settings", with CreditCard icon

### Deferred Ideas (OUT OF SCOPE)
- **80% usage alert** (BILLF-01): SMS + email when approaching plan limit. Noted in REQUIREMENTS.md as future.
- **Billing documentation skill file** (Phase 26): Full architecture documentation of the billing system.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENFORCE-01 | Subscription check added to handleInbound() as parallel Supabase query -- zero net latency increase on call pickup | handleInbound at line 126 already uses Promise.all with 4 queries; subscription check adds as 5th parallel query to subscriptions table (tenant_id + is_current filter). Returns status column only. |
| ENFORCE-02 | Block call if subscription status is cancelled/paused/incomplete -- play graceful caller message via AI prompt dynamic variable | **SCOPE CHANGE:** Over-quota calls NOT blocked (overage billing handles them). Block only on status. Dynamic variables `booking_enabled: 'false'` and `paywall_reason: 'subscription_inactive'` injected on blocked status. AI agent reads the unavailable message. |
| BILLUI-01 | Billing dashboard page at /dashboard/more/billing -- current plan card, usage meter, renewal/trial-end date, Stripe Customer Portal link | New page at `src/app/dashboard/more/billing/page.js`. Server component fetches subscription data. Client component renders 4 sections per UI-SPEC. Stripe invoices.list API for invoice history. Portal link via existing `/api/billing/portal` route. |
| BILLUI-02 | Trial countdown banner in dashboard layout -- shows "X days left in trial" with upgrade CTA, visible across all dashboard pages | New `TrialCountdownBanner` component in `src/app/dashboard/`. Added to layout.js alongside BillingWarningBanner. Reads trial_ends_at from subscriptions table. Mutually exclusive with past_due banner. |
| BILLUI-03 | Post-trial paywall page at /billing/upgrade -- plan comparison, Stripe Checkout links for each tier | New page at `src/app/billing/upgrade/page.js` (outside dashboard layout). Reuses PRICING_TIERS data from pricingData.js. New UpgradeCheckoutCards component adapts PlanSelectionCards pattern. |
| BILLUI-04 | Stripe Checkout flow -- plan selection, Checkout Session creation, success redirect to dashboard | New API route `/api/billing/checkout-session` (adapted from onboarding checkout-session). Key differences: no trial_period_days, success_url points to /dashboard, cancel_url points to /billing/upgrade. |
| BILLUI-05 | Stripe Customer Portal integration -- plan changes, cancellation, invoice history, payment method update | Already implemented at `/api/billing/portal/route.js`. Billing page links to it via "Manage Subscription" button. return_url should point to `/dashboard/more/billing`. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| stripe | ^21.0.0 (installed: 21.0.1) | Stripe API for invoices.list, billingPortal, checkout sessions | Already in use. invoices.list for billing page, portal for self-service management |
| next | ^16.1.7 | App Router pages, server components, route handlers | Project framework, App Router for new pages |
| react | ^19.0.0 | Client components for interactive billing UI | Project framework |
| tailwindcss | ^4.2.2 | Styling per design token system | Project convention |
| lucide-react | ^0.577.0 | Icons (CreditCard, Clock, AlertCircle, Loader2) | Project icon library |
| date-fns | ^4.1.0 | Date formatting for invoices, renewal dates | Already used throughout codebase |
| @supabase/ssr | (installed) | Server + browser Supabase clients for subscription data | Existing pattern for all data access |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| framer-motion | (installed) | Animation for More page items, page transitions | Used in existing More page pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure SVG ring gauge | chart.js / recharts | Overkill for a single ring gauge. Pure SVG matches CelebrationOverlay pattern, zero additional bundle size |
| Custom checkout-session route | Reusing onboarding route with flag | Onboarding route has trial_period_days=14 hardcoded; cleaner to create separate upgrade route that omits trial |

**Installation:**
No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/app/
  dashboard/
    layout.js                    # MODIFY: add TrialCountdownBanner
    BillingWarningBanner.js      # EXISTING: no changes
    TrialCountdownBanner.js      # NEW: trial countdown banner
    more/
      page.js                    # MODIFY: add Billing to MORE_ITEMS
      billing/
        page.js                  # NEW: billing dashboard page
  billing/
    upgrade/
      page.js                    # NEW: upgrade/paywall page
  api/
    billing/
      portal/route.js            # MODIFY: update return_url
      checkout-session/route.js  # NEW: upgrade checkout session
      invoices/route.js          # NEW: fetch recent invoices from Stripe
    webhooks/
      retell/route.js            # MODIFY: add subscription check in handleInbound
src/components/
  dashboard/
    UsageRingGauge.js            # NEW: SVG donut ring gauge
  billing/
    UpgradeCheckoutCards.js      # NEW: plan cards for upgrade page
tests/
  billing/
    enforcement-gate.test.js     # NEW: handleInbound subscription check tests
    trial-countdown.test.js      # NEW: trial days remaining calculation
    billing-checkout.test.js     # NEW: upgrade checkout session tests
```

### Pattern 1: Parallel Supabase Query in handleInbound
**What:** Add subscription status query as 5th parallel query in the existing Promise.all block
**When to use:** When handleInbound needs new data without adding latency
**Example:**
```javascript
// Current: 4 parallel queries
const [appointmentsResult, eventsResult, zonesResult, buffersResult] = await Promise.all([...]);

// Updated: 5 parallel queries (subscription check added)
const [appointmentsResult, eventsResult, zonesResult, buffersResult, subscriptionResult] = await Promise.all([
  // ... existing 4 queries ...
  supabase
    .from('subscriptions')
    .select('status')
    .eq('tenant_id', tenant.id)
    .eq('is_current', true)
    .maybeSingle(),
]);

// Early return if subscription is blocked
const blockedStatuses = ['canceled', 'paused', 'incomplete'];
if (subscriptionResult.data && blockedStatuses.includes(subscriptionResult.data.status)) {
  return Response.json({
    dynamic_variables: {
      business_name: 'Voco',
      booking_enabled: 'false',
      paywall_reason: 'subscription_inactive',
      // ... minimal dynamic variables
    },
  });
}
```

### Pattern 2: Billing Page Data Fetching
**What:** Server-side data fetch via API route + client-side rendering
**When to use:** Billing page needs both Supabase (subscription) and Stripe (invoices) data
**Example:**
```javascript
// src/app/api/billing/invoices/route.js
// Server-side: fetch invoices using stripe_customer_id from subscription
const invoices = await stripe.invoices.list({
  customer: sub.stripe_customer_id,
  limit: 5,
});
```

### Pattern 3: Checkout Session for Upgrade (No Trial)
**What:** Create Stripe Checkout Session without trial_period_days for reactivation
**When to use:** Expired tenant selecting a new plan
**Example:**
```javascript
// Key difference from onboarding checkout-session:
// 1. No trial_period_days (immediate billing)
// 2. success_url -> /dashboard (not /onboarding/checkout)
// 3. cancel_url -> /billing/upgrade (not /pricing)
const sessionConfig = {
  mode: 'subscription',
  payment_method_collection: 'always',
  line_items: lineItems, // flat-rate + metered overage
  subscription_data: {
    metadata: { tenant_id: tenant.id },
    // NO trial_period_days
  },
  success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
  cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/upgrade`,
};
```

### Pattern 4: SVG Ring Gauge with stroke-dasharray
**What:** Animated SVG donut using stroke-dasharray/stroke-dashoffset technique
**When to use:** UsageRingGauge component
**Example:**
```javascript
// Circumference = 2 * PI * radius = 2 * PI * 50 = ~314.16
const circumference = 2 * Math.PI * 50;
const fillPercentage = Math.min(calls_used / calls_limit, 1);
const fillOffset = circumference * (1 - fillPercentage);

// For overage: additional arc beyond 100%
const overagePercentage = Math.min((calls_used - calls_limit) / calls_limit, 0.5);
// Overage arc starts where base fill ends (100%) and extends proportionally

<circle
  cx="60" cy="60" r="50"
  stroke="#C2410C"
  strokeWidth="10"
  fill="none"
  strokeDasharray={circumference}
  strokeDashoffset={fillOffset}
  transform="rotate(-90 60 60)"
  strokeLinecap="round"
/>
```

### Anti-Patterns to Avoid
- **Calling Stripe API during handleInbound:** The enforcement check reads from the local subscriptions table ONLY. Never call Stripe API in the call path (latency constraint from D-01).
- **Checking trial_ends_at in handleInbound:** Trial expiry is handled by Stripe webhooks that set status to 'canceled'. The handleInbound check only looks at status column per D-02.
- **Blocking over-quota calls:** Per CONTEXT.md scope change, over-quota calls are charged as overage, NEVER blocked. The `limit_exceeded` flag in call-processor.js triggers Stripe metered billing, not call rejection.
- **Re-implementing portal route:** The `/api/billing/portal` route already exists and works. The billing page should link to it, not create a new one.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Plan change UI | Custom plan switcher with proration | Stripe Customer Portal | Stripe handles proration, payment method update, cancellation, invoice display |
| Invoice PDF generation | Custom PDF renderer | Stripe Customer Portal | Portal has full invoice history with downloadable PDFs |
| Payment method management | Custom card form | Stripe Customer Portal | PCI compliance scope eliminated by using Portal |
| SVG chart library | External chart library | Pure SVG circles + stroke-dasharray | Single gauge does not justify a 30KB+ chart library dependency |
| Subscription state management | Local status tracking | Stripe webhook -> subscriptions table | Webhook handler already syncs all subscription state changes to local DB |

**Key insight:** Stripe Customer Portal handles ALL complex self-service billing operations (plan changes, cancellation, payment method update, invoice history). Our billing page is a read-only summary + portal link, not a portal replacement.

## Common Pitfalls

### Pitfall 1: Stripe Invoices API Requires Customer ID, Not Subscription ID
**What goes wrong:** Calling `stripe.invoices.list({ subscription: sub_id })` when `subscription` is not a primary filter in the Stripe Invoices API v2024.
**Why it happens:** Developer assumes subscription-scoped invoice listing.
**How to avoid:** Use `stripe.invoices.list({ customer: stripe_customer_id, limit: 5 })`. The customer ID is already stored in the subscriptions table as `stripe_customer_id`.
**Warning signs:** Empty invoice list despite active subscription.

### Pitfall 2: handleInbound Dynamic Variables Must Include All Required Fields
**What goes wrong:** The enforcement early return omits dynamic variables that the Retell AI agent expects, causing the agent to fail or behave unpredictably.
**Why it happens:** Developer only returns `booking_enabled: false` without the other required variables.
**How to avoid:** The blocked response must include ALL dynamic variables the agent references, with safe defaults. At minimum: `business_name`, `default_locale`, `booking_enabled: 'false'`, `paywall_reason`, `caller_number`, `available_slots: ''`, `trade_type: ''`, `intake_questions: ''`.
**Warning signs:** Retell agent errors or silent behavior on blocked calls.

### Pitfall 3: Trial Banner and BillingWarningBanner Mutual Exclusivity
**What goes wrong:** Both banners show simultaneously, pushing content down and confusing users.
**Why it happens:** Both components independently query subscription status without awareness of each other.
**How to avoid:** They are inherently mutually exclusive by status: TrialCountdownBanner renders only when `status = 'trialing'`, BillingWarningBanner renders only when `status = 'past_due'`. No explicit coordination needed -- just enforce the status conditions strictly.
**Warning signs:** Both banners visible simultaneously (would indicate a data bug).

### Pitfall 4: Checkout Session for Upgrade Must NOT Include Trial Period
**What goes wrong:** Reactivating tenant gets another 14-day trial instead of immediate billing.
**Why it happens:** Copy-pasting from onboarding checkout-session which includes `trial_period_days: 14`.
**How to avoid:** Create a separate checkout-session route for upgrades that explicitly omits `trial_period_days`. Or add a `context` parameter to the existing route.
**Warning signs:** Upgraded tenant has `trialing` status instead of `active`.

### Pitfall 5: Portal Return URL Must Point to Billing Page
**What goes wrong:** User returns from Stripe Customer Portal to the dashboard home instead of the billing page they came from.
**Why it happens:** Existing portal route hardcodes `return_url: /dashboard`.
**How to avoid:** Either update the portal route to accept a `return_url` query param, or change the default to `/dashboard/more/billing`. The billing page should pass the return URL.
**Warning signs:** User loses context after portal interaction.

### Pitfall 6: SVG Ring Gauge Animation Must Respect prefers-reduced-motion
**What goes wrong:** Users with motion sensitivity see a distracting animation.
**Why it happens:** Developer forgets to check media query.
**How to avoid:** Use a CSS media query `@media (prefers-reduced-motion: reduce)` or the `useReducedMotion` pattern from framer-motion. UI-SPEC explicitly requires this.
**Warning signs:** Accessibility audit failure.

### Pitfall 7: Billing Page Accessible to ALL Dashboard Statuses
**What goes wrong:** A trialing user can't see the billing page, or a past_due user gets redirected away from it.
**Why it happens:** Overly aggressive subscription gate in middleware.
**How to avoid:** The billing page is at `/dashboard/more/billing` which is inside the dashboard layout. The middleware subscription gate only blocks `canceled`, `paused`, `incomplete` -- it allows `trialing`, `active`, and `past_due` through. This is correct behavior. All three allowed statuses need the billing page. For blocked statuses, users are on `/billing/upgrade` instead.
**Warning signs:** Users who need the billing page can't access it.

### Pitfall 8: Overage Ring Gauge Visual Overflow Cap
**What goes wrong:** If a tenant uses 4x their call limit, the overage arc wraps around multiple times, looking broken.
**Why it happens:** No cap on overage arc length.
**How to avoid:** Per UI-SPEC, cap the overage visual at 50% additional arc. The formula: `overagePercentage = min((calls_used - calls_limit) / calls_limit, 0.5)`.
**Warning signs:** Ring gauge arc exceeds 360 degrees.

## Code Examples

### Subscription Check in handleInbound
```javascript
// Source: handleInbound pattern at src/app/api/webhooks/retell/route.js line 126
// Add subscription query as 5th parallel query:
const [appointmentsResult, eventsResult, zonesResult, buffersResult, subscriptionResult] = await Promise.all([
  // ... existing 4 queries unchanged ...
  supabase
    .from('subscriptions')
    .select('status')
    .eq('tenant_id', tenant.id)
    .eq('is_current', true)
    .maybeSingle(),
]);

// Check subscription status BEFORE slot calculation
const blockedStatuses = ['canceled', 'paused', 'incomplete'];
const subStatus = subscriptionResult.data?.status;

if (subStatus && blockedStatuses.includes(subStatus)) {
  return Response.json({
    dynamic_variables: {
      business_name: tenant.business_name || 'Voco',
      default_locale: tenant.default_locale || 'en',
      onboarding_complete: String(tenant.onboarding_complete ?? false),
      caller_number: from_number || '',
      tenant_id: tenant.id,
      owner_phone: tenant.owner_phone || '',
      tone_preset: tenant.tone_preset || 'professional',
      available_slots: '',
      booking_enabled: 'false',
      paywall_reason: 'subscription_inactive',
      trade_type: tenant.trade_type || '',
      intake_questions: '',
    },
  });
}
```

### Invoice Fetching API Route
```javascript
// Source: Stripe API docs (stripe ^21.0.0)
// Route: /api/billing/invoices
import { stripe } from '@/lib/stripe';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).maybeSingle();
  if (!tenant) return Response.json({ error: 'No tenant' }, { status: 404 });

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('tenant_id', tenant.id)
    .eq('is_current', true)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return Response.json({ invoices: [] });
  }

  const invoices = await stripe.invoices.list({
    customer: sub.stripe_customer_id,
    limit: 5,
  });

  const formatted = invoices.data.map(inv => ({
    id: inv.id,
    date: inv.created, // Unix timestamp
    amount: inv.amount_paid || inv.total, // in cents
    currency: inv.currency,
    status: inv.status, // 'paid', 'open', 'uncollectible', 'void'
    hosted_invoice_url: inv.hosted_invoice_url,
  }));

  return Response.json({ invoices: formatted });
}
```

### SVG Ring Gauge Core Pattern
```javascript
// Source: CelebrationOverlay SVG pattern + globals.css animate-draw-circle
'use client';
import { useEffect, useState } from 'react';

export default function UsageRingGauge({ callsUsed, callsLimit, overageRate }) {
  const [animated, setAnimated] = useState(false);
  const radius = 50;
  const circumference = 2 * Math.PI * radius; // ~314.16

  useEffect(() => {
    // Trigger animation on mount
    const timer = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  const fillPercentage = callsLimit > 0 ? Math.min(callsUsed / callsLimit, 1) : 0;
  const isOverage = callsUsed > callsLimit;
  const overageCount = isOverage ? callsUsed - callsLimit : 0;
  const overagePercentage = isOverage
    ? Math.min(overageCount / callsLimit, 0.5) // capped at 50% additional
    : 0;

  const fillOffset = animated ? circumference * (1 - fillPercentage) : circumference;
  const overageArcLength = circumference * overagePercentage;
  const overageOffset = animated ? circumference - overageArcLength : circumference;

  return (
    <svg viewBox="0 0 120 120" width="120" height="120" role="img"
      aria-label={`Usage: ${callsUsed} of ${callsLimit} calls used${isOverage ? `, plus ${overageCount} overage calls` : ''}`}
    >
      {/* Background track */}
      <circle cx="60" cy="60" r={radius} stroke="#E7E5E4" strokeWidth="10" fill="none" />
      {/* Base fill arc */}
      <circle cx="60" cy="60" r={radius} stroke="#C2410C" strokeWidth="10" fill="none"
        strokeDasharray={circumference} strokeDashoffset={fillOffset}
        transform="rotate(-90 60 60)" strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
      />
      {/* Overage arc (if applicable) */}
      {isOverage && (
        <circle cx="60" cy="60" r={radius} stroke="#F59E0B" strokeWidth="10" fill="none"
          strokeDasharray={`${overageArcLength} ${circumference - overageArcLength}`}
          strokeDashoffset={animated ? 0 : overageArcLength}
          transform="rotate(-90 60 60)" strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 600ms ease-out 300ms' }}
        />
      )}
      {/* Center text */}
      <text x="60" y="56" textAnchor="middle" className="fill-[#0F172A] text-[28px] font-semibold">
        {callsUsed}
      </text>
      <text x="60" y="72" textAnchor="middle" className="fill-[#475569] text-[12px]">
        of {callsLimit}
      </text>
    </svg>
  );
}
```

### Upgrade Checkout Session (No Trial)
```javascript
// Source: adapted from /api/onboarding/checkout-session/route.js
// Key differences: no trial, different success/cancel URLs, handles existing customer
const sessionConfig = {
  mode: 'subscription',
  payment_method_collection: 'always',
  line_items: lineItems, // flat-rate + metered overage
  customer: existingStripeCustomerId, // Use existing customer (not customer_email)
  subscription_data: {
    metadata: { tenant_id: tenant.id },
    // NO trial_period_days -- immediate billing for reactivation
  },
  success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
  cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/upgrade`,
};
```

### Trial Days Remaining Calculation
```javascript
// Source: same pattern as BillingWarningBanner.calculateGraceDaysRemaining
export function calculateTrialDaysRemaining(trialEndsAt) {
  if (!trialEndsAt) return 0;
  const remaining = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stripe Checkout with client_secret (embedded) | Hosted Checkout with redirect | Both supported | Project uses hosted (redirect URL pattern) per onboarding checkout |
| stripe.subscriptionItems.createUsageRecord (metered) | Same API -- still current | Stable | Overage billing pipeline already uses this correctly |
| stripe.billingPortal.sessions.create | Same API -- still current | Stable | Portal route already implemented |
| stripe.invoices.list | Same API -- still current | Stable | New usage for billing page invoice history |

**Deprecated/outdated:**
- None relevant. Stripe v21 API used in this project is current.

## Open Questions

1. **Retell AI Agent Prompt for Blocked Calls**
   - What we know: Dynamic variable `booking_enabled: false` already exists in the Retell agent contract. `paywall_reason` is a new dynamic variable.
   - What's unclear: Does the Retell AI agent prompt already handle `paywall_reason` to speak the unavailable message, or does the prompt need to be updated?
   - Recommendation: Check the Retell agent prompt configuration. If `paywall_reason` is not already handled, the prompt must be updated to include: "If paywall_reason is 'subscription_inactive', tell the caller: 'This service is temporarily unavailable. Please try again later.' and end the call."
   - **Noted as STATE.md blocker:** "Retell enforcement response format (booking_enabled: false + paywall_reason) needs validation against current Retell API contract before Phase 25 builds enforcement"

2. **Existing Customer vs New Customer in Upgrade Checkout**
   - What we know: The onboarding checkout uses `customer_email` to let Stripe create a new customer. For reactivation, the tenant already has a `stripe_customer_id`.
   - What's unclear: Whether using the existing `customer` ID in Checkout Session will properly link the new subscription.
   - Recommendation: Use `customer: existingStripeCustomerId` instead of `customer_email`. This links the new subscription to the existing customer record, preserving payment history. Stripe docs confirm this is the correct pattern for resubscription.

3. **Portal Route Return URL**
   - What we know: Current portal route hardcodes `return_url: /dashboard`. Billing page wants return to `/dashboard/more/billing`.
   - What's unclear: Whether to modify the existing route or create flexibility.
   - Recommendation: Add optional `return_url` query parameter to the portal route, defaulting to `/dashboard/more/billing`. The billing page passes this parameter.

## Project Constraints (from CLAUDE.md)

- **Brand name is Voco** -- not HomeService AI. All UI copy must use "Voco" branding.
- **Keep skills in sync** -- After making changes to billing/dashboard systems, update relevant skill files (`dashboard-crm-system` and eventually `billing-payment` when Phase 26 creates it).
- **Tech stack compliance** -- Next.js App Router, Supabase (Auth + Postgres + RLS), Stripe, Tailwind CSS, shadcn/ui, lucide-react.
- **Design tokens** -- Use `card.base`, `btn.primary`, `colors.brandOrange` from `src/lib/design-tokens.js`.
- **Three Supabase client types** -- Browser client for client components, server client for server components/API routes, service role client for webhook handlers.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (via `jest.config.js`) |
| Config file | `jest.config.js` |
| Quick run command | `npx jest tests/billing/ --verbose` |
| Full suite command | `npx jest --verbose` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENFORCE-01 | Subscription check runs in parallel, no latency increase | unit | `npx jest tests/billing/enforcement-gate.test.js -x` | Wave 0 |
| ENFORCE-02 | Blocked statuses return booking_enabled=false with paywall_reason | unit | `npx jest tests/billing/enforcement-gate.test.js -x` | Wave 0 |
| BILLUI-01 | Billing page renders plan card, usage, invoices, portal link | manual-only | Manual browser verification | N/A (React component, Node test env) |
| BILLUI-02 | Trial banner shows correct days, color changes at <=3 days | unit | `npx jest tests/billing/trial-countdown.test.js -x` | Wave 0 |
| BILLUI-03 | Upgrade page renders plan cards with checkout CTAs | manual-only | Manual browser verification | N/A (React component, Node test env) |
| BILLUI-04 | Checkout session creates without trial period | unit | `npx jest tests/billing/billing-checkout.test.js -x` | Wave 0 |
| BILLUI-05 | Portal returns redirect with correct return_url | unit | `npx jest tests/billing/portal-return-url.test.js -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest tests/billing/ --verbose`
- **Per wave merge:** `npx jest --verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/billing/enforcement-gate.test.js` -- covers ENFORCE-01, ENFORCE-02 (handleInbound subscription check logic)
- [ ] `tests/billing/trial-countdown.test.js` -- covers BILLUI-02 (days remaining calculation, color state thresholds)
- [ ] `tests/billing/billing-checkout.test.js` -- covers BILLUI-04 (upgrade checkout session without trial)
- [ ] `tests/billing/portal-return-url.test.js` -- covers BILLUI-05 (portal route return_url parameter)

## Sources

### Primary (HIGH confidence)
- `src/app/api/webhooks/retell/route.js` -- handleInbound implementation, Promise.all pattern, dynamic variables contract
- `src/app/api/onboarding/checkout-session/route.js` -- Checkout Session creation with PRICE_MAP and overage pricing
- `src/app/api/billing/portal/route.js` -- Portal session creation pattern
- `src/app/api/stripe/webhook/route.js` -- Subscription sync, status mapping, PLAN_MAP, overage item extraction
- `src/lib/call-processor.js` -- Usage tracking, overage reporting to Stripe (lines 137-159)
- `src/proxy.js` -- Subscription gate middleware (lines 106-123), blocked statuses
- `src/app/dashboard/BillingWarningBanner.js` -- Banner pattern, grace period calculation
- `src/app/dashboard/layout.js` -- Dashboard layout, banner positioning, breadcrumb labels
- `src/app/dashboard/more/page.js` -- MORE_ITEMS array pattern
- `src/components/onboarding/PlanSelectionCards.jsx` -- Plan card component pattern
- `src/app/(public)/pricing/pricingData.js` -- PRICING_TIERS with overage rates
- `src/lib/design-tokens.js` -- card.base, btn.primary, colors
- `supabase/migrations/010_billing_schema.sql` -- Subscriptions table schema
- `supabase/migrations/017_overage_billing.sql` -- overage_stripe_item_id column
- `25-CONTEXT.md` -- All locked decisions and scope change
- `25-UI-SPEC.md` -- Complete visual and interaction specification

### Secondary (MEDIUM confidence)
- Stripe Node.js SDK v21 API patterns for invoices.list, billingPortal, checkout sessions -- based on installed version and existing usage patterns in codebase
- SVG stroke-dasharray animation technique -- based on existing CelebrationOverlay and globals.css patterns

### Tertiary (LOW confidence)
- Retell AI agent prompt handling of `paywall_reason` dynamic variable -- needs validation against current agent prompt configuration (flagged in Open Questions)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and in active use
- Architecture: HIGH -- follows established codebase patterns with clear integration points
- Pitfalls: HIGH -- derived from direct code reading and prior phase decisions
- Enforcement gate: HIGH -- handleInbound code is clear, parallel query pattern well-established
- Billing UI: HIGH -- UI-SPEC provides exact specifications, existing components provide patterns
- Retell agent prompt: LOW -- paywall_reason handling unverified

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable -- no fast-moving dependencies)

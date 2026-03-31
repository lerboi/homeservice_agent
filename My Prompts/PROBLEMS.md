# Payment Architecture — Issues to Fix

Found during a deep audit of the entire payment/billing system (2026-03-31).

---

## 1. CRITICAL: Annual plan `calls_limit` is wrong

**File**: `src/app/api/stripe/webhook/route.js` (lines 112-119)

**Problem**: The `PLAN_MAP` sets the same `calls_limit` for annual plans as monthly plans:

```js
const PLAN_MAP = {
  [process.env.STRIPE_PRICE_STARTER]:        { plan_id: 'starter', calls_limit: 40 },
  [process.env.STRIPE_PRICE_STARTER_ANNUAL]: { plan_id: 'starter', calls_limit: 40 },  // BUG
  [process.env.STRIPE_PRICE_GROWTH]:         { plan_id: 'growth',  calls_limit: 120 },
  [process.env.STRIPE_PRICE_GROWTH_ANNUAL]:  { plan_id: 'growth',  calls_limit: 120 }, // BUG
  [process.env.STRIPE_PRICE_SCALE]:          { plan_id: 'scale',   calls_limit: 400 },
  [process.env.STRIPE_PRICE_SCALE_ANNUAL]:   { plan_id: 'scale',   calls_limit: 400 }, // BUG
};
```

**Why this is critical**: `calls_used` only resets when `handleInvoicePaid` receives an `invoice.paid` event with `billing_reason: 'subscription_cycle'`. For annual subscriptions, Stripe fires this event **once per year**. So an annual Starter subscriber gets 40 calls per YEAR, not 40/month (480/year) as intended.

After call #41, the Python agent's `increment_calls_used` RPC returns `limit_exceeded: true`, and it starts reporting Stripe Billing Meter events at $2.48/call — charging the subscriber overage for calls they're entitled to.

**Evidence from `pricingData.js`** (the intended behavior):
```js
{ name: 'Annual calls', starter: '480', growth: '1,440', scale: '4,800' }
```

480 = 40 x 12 months. The annual subscriber should get 480 total calls before overage kicks in.

**Fix**: Change the annual plan limits to the full annual allocation:
```js
[process.env.STRIPE_PRICE_STARTER_ANNUAL]: { plan_id: 'starter', calls_limit: 480 },
[process.env.STRIPE_PRICE_GROWTH_ANNUAL]:  { plan_id: 'growth',  calls_limit: 1440 },
[process.env.STRIPE_PRICE_SCALE_ANNUAL]:   { plan_id: 'scale',   calls_limit: 4800 },
```

---

## 2. IMPORTANT: "No credit card required" contradicts checkout behavior

**File**: `src/app/(public)/pricing/PricingTiers.jsx` (line 143)

**Problem**: Below every plan CTA button, the pricing page shows:
```jsx
<p className="text-[11px] text-white/25 mt-1.5 text-center">
  14-day free trial &middot; No credit card required
</p>
```

But the checkout session at `src/app/api/onboarding/checkout-session/route.js` (line 78) creates sessions with:
```js
payment_method_collection: 'always', // CC required
```

Users are told "No credit card required" and then immediately asked for a credit card at Step 5 (checkout). This is misleading and can hurt conversion/trust.

**Fix**: Change the copy in `PricingTiers.jsx` to something accurate like:
```
14-day free trial · Cancel anytime
```

---

## 3. MINOR: `billing_notifications` UNIQUE constraint prevents re-trial notifications

**Files**:
- `supabase/migrations/020_billing_notifications_unique.sql` — adds `UNIQUE (tenant_id, notification_type)`
- `src/app/api/stripe/webhook/route.js` — `handleTrialWillEnd` function

**Problem**: The UNIQUE constraint on `billing_notifications(tenant_id, notification_type)` means each tenant can only ever have ONE row per notification type. If a tenant cancels their subscription and later re-subscribes with a new trial, the `handleTrialWillEnd` handler checks for an existing `trial_will_end` row:

```js
const { data: existing } = await supabase
  .from('billing_notifications')
  .select('id')
  .eq('tenant_id', tenantId)
  .eq('notification_type', 'trial_will_end')
  .maybeSingle();

if (existing) {
  console.log('[stripe/webhook] Trial-will-end already sent for tenant:', tenantId);
  return; // <-- Silently skips — tenant never gets notified
}
```

The old row from the first trial still exists, so the notification is silently skipped for the second trial.

Currently this isn't a real problem because the upgrade checkout route (`/api/billing/checkout-session`) has NO `trial_period_days` — re-subscribers don't get trials. But if the business model ever changes to offer trials on reactivation, this would silently fail.

**Fix**: Either:
- (a) Delete the tenant's `billing_notifications` rows when their subscription is canceled (in `handleSubscriptionEvent` when status becomes `canceled`), OR
- (b) Change the UNIQUE constraint to include a `subscription_id` or `period` column so each subscription cycle gets its own notification tracking

Option (a) is simpler and works for the current architecture.

---

## Prompt — Fix These Issues

Read the `payment-architecture` skill first for full architectural context. Then fix these 3 issues:

### Issue 1: Annual `calls_limit` fix
In `src/app/api/stripe/webhook/route.js`, update the `PLAN_MAP` so annual price IDs map to the correct annual call limits (480, 1440, 4800 instead of 40, 120, 400). The monthly entries stay the same. After fixing, update the `payment-architecture` skill's "Price-to-Plan Mapping" section to reflect the new values.

### Issue 2: Pricing page copy fix
In `src/app/(public)/pricing/PricingTiers.jsx`, change the "No credit card required" text to "Cancel anytime" (or similar accurate copy). The 14-day free trial part stays.

### Issue 3: `billing_notifications` re-trial fix
In `src/app/api/stripe/webhook/route.js`, inside the `handleSubscriptionEvent` function, when the local status is `canceled`, delete any `billing_notifications` rows for that tenant. This clears the idempotency guard so future trials get fresh notifications. The delete should be a fire-and-forget (don't throw on error — log only), placed after the subscription row sync completes.

After all fixes, update the `payment-architecture` skill (`.claude/skills/payment-architecture/SKILL.md`) to reflect any changes to the documented behavior.

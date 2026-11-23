---
type: system
system: Billing
status: legacy-app
description: "Two routes create Stripe Checkout Sessions — one for onboarding (new users) and one for upgrade/reactivation (existing users). Covers: Onboarding Checkout (`POST /api/onboarding/checkout-session`); Upgrade Checkout (`POST /api/billing/checkout-session`); Embedded Checkout Flow (Onboarding Step 5)"
source: .claude/skills/payment-architecture/SKILL.md § 2. Checkout Session Creation
migrated: 2026-11-23
verified:
tags: [voco/system/billing]
---

# Checkout Session Creation

Part of [[Billing]]. Migrated verbatim from the `payment-architecture` skill; check `verified` before trusting details.

Two routes create Stripe Checkout Sessions — one for onboarding (new users) and one for upgrade/reactivation (existing users).

### Onboarding Checkout (`POST /api/onboarding/checkout-session`)

**File**: `src/app/api/onboarding/checkout-session/route.js`

- Request: `{ plan, interval?, embedded? }`
- Authenticates via `createSupabaseServer()`, looks up tenant via service role
- **Double-subscription guard (409)**: if the tenant already has an `is_current` subscription with status `active`/`trialing`/`past_due`, returns 409 ("An active subscription already exists for this account.") — a replayed/duplicated checkout step would double-bill
- Maps plan + interval to price ID via PRICE_MAP (monthly/annual/overage per plan)
- **One line item**: flat-rate plan price (quantity: 1). The metered overage item is NOT in the session — it's attached post-checkout by the webhook (Checkout can't mix billing intervals)
- `payment_method_collection: 'always'` (CC required)
- `trial_period_days: 14`
- `metadata.tenant_id` set on BOTH session AND `subscription_data`
- **Annual interval → flexible billing mode**: `subscription_data.billing_mode = { type: 'flexible' }` is set when `interval === 'annual'` (requires the `2025-06-30.basil` pin). Without it the webhook's monthly metered overage attach is rejected with "All prices on a subscription must have the same recurring.interval" (verified test-mode 2026-06-12). Monthly subscriptions stay in classic mode.
- Supports embedded mode (`ui_mode: 'embedded'`, `return_url`) and hosted mode (`success_url`/`cancel_url`). `'embedded'` is the valid Basil enum — the route briefly used `'embedded_page'`, which exists only on `2026-03-25.dahlia` and was REJECTED under the Basil pin, breaking signup checkout entirely (fixed + verified test-mode 2026-06-12)
- Returns `{ clientSecret }` (embedded) or `{ url }` (hosted)

### Upgrade Checkout (`POST /api/billing/checkout-session`)

**File**: `src/app/api/billing/checkout-session/route.js`

- Same PRICE_MAP structure, same single flat-rate line item (overage item added by the webhook)
- Same **annual → flexible billing mode** rule: `subscription_data.billing_mode = { type: 'flexible' }` for annual intervals only (see onboarding checkout above)
- **Double-subscription guard (409)**: if the tenant's `is_current` subscription has status `active`/`trialing`/`past_due`, returns 409 with a message directing the user to "Manage Subscription" (Stripe Billing Portal) — plan changes go through the portal, never a second Checkout
- **No trial_period_days** (immediate billing for upgrade/reactivation)
- Uses existing `stripe_customer_id` from subscriptions table when available
- Falls back to `customer_email` if no prior subscription
- `success_url: /dashboard?upgraded=true`, `cancel_url: /billing/upgrade`
- Hosted mode only (no embedded support)

### Embedded Checkout Flow (Onboarding Step 5)

**File**: `src/app/onboarding/checkout/page.js`

Three phases:
1. **Checkout**: Renders `EmbeddedCheckoutProvider` + `EmbeddedCheckout` with client secret
2. **Verifying**: Polls `GET /api/onboarding/verify-checkout` up to 30 times (2s interval) waiting for webhook to create subscription
3. **Success**: `CelebrationOverlay` + auto-redirect to `/dashboard` after 5 seconds

---

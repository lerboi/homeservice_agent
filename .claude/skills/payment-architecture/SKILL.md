---
name: payment-architecture
description: Complete architectural reference for the payment, billing, and subscription system — Stripe Checkout Sessions (onboarding + upgrade), webhook handler (9 event types, history table pattern, idempotency), Billing Meters overage system, subscription lifecycle (trialing/active/past_due/canceled/paused), usage tracking (increment_calls_used RPC), subscription enforcement gate, billing notifications (trial_will_end, payment_failed), billing dashboard (plan card, UsageRingGauge, invoices, Stripe Customer Portal), pricing page (3 plans with monthly/annual/overage), all 4 billing DB tables with RLS policies. Phase 59: invoices.job_id attribution (lead_id removed — customer derivable via job.customer_id; ad-hoc invoices without a job remain possible per D-11). Use this skill whenever making changes to Stripe integration, checkout sessions, subscription handling, usage tracking, overage billing, billing notifications, billing dashboard, pricing page, or any payment-related API route. Also use when the user asks about how billing works, wants to modify subscription logic, or needs to debug payment/webhook issues.
---

# Payment Architecture — Complete Reference

This document is the single source of truth for the entire payment, billing, and subscription system. Read this before making any changes to Stripe integration, checkout flows, subscription handling, usage tracking, overage billing, or the billing dashboard.

**Last updated**: 2026-04-21 (Phase 59 — invoices.job_id attribution: lead_id column dropped by migration 061; job_id added by 059; NOT NULL conditional per D-11 — ad-hoc invoices without a job remain NULLABLE; customer derivable via job.customer_id. Customer detail Invoices tab added. increment_calls_used RPC unchanged.)

---

## Architecture Overview

| Layer | Files | Purpose |
|-------|-------|---------|
| **Pricing Page** | `src/app/(public)/pricing/pricingData.js`, `PricingTiers.jsx` | Plan selection, pricing display, annual toggle |
| **Onboarding Checkout** | `src/app/api/onboarding/checkout-session/route.js`, `src/app/onboarding/checkout/page.js` | Embedded Stripe Checkout with 14-day trial |
| **Upgrade Checkout** | `src/app/api/billing/checkout-session/route.js` | Hosted Stripe Checkout, no trial, reuses Stripe customer |
| **Webhook Handler** | `src/app/api/stripe/webhook/route.js` | 9 event types, idempotency, history table pattern |
| **Usage Tracking** | `supabase/migrations/013_usage_events.sql` (RPC) + Python agent `src/post_call.py` | Per-call counting + Stripe Billing Meter overage reporting |
| **Subscription Gate** | `src/lib/subscription-gate.js` | Blocks calls for canceled/paused/incomplete tenants |
| **Billing Dashboard** | `src/app/dashboard/more/billing/page.js`, `UsageRingGauge.js` | Plan info, usage meter, invoices, portal link |
| **Billing API** | `src/app/api/billing/data/route.js`, `invoices/route.js`, `portal/route.js` | Subscription data (with billing_interval), invoice list, Stripe Customer Portal redirect |
| **Banners** | `BillingWarningBanner.js`, `TrialCountdownBanner.js` | Dashboard warnings for past_due and trial countdown |
| **Notifications** | `src/emails/PaymentFailedEmail.jsx`, `TrialReminderEmail.jsx` | Email templates for billing events |
| **Stripe SDK** | `src/lib/stripe.js` | Lazy-init Stripe singleton via Proxy |
| **DB Schema** | Migrations 010, 013, 016, 017, 020, 021, 037 | 4 billing tables + RPC + RLS |

```
Pricing Page (/pricing)
  → User selects plan + interval (monthly/annual)
  → CTA links to /onboarding?plan={id}&interval={billing}
       ↓
  Auth → Onboarding Wizard (plan stored in sessionStorage)
       ↓
  Step 5: Embedded Stripe Checkout
  → POST /api/onboarding/checkout-session
  → Creates session with 1 line item: flat-rate plan price
  → 14-day trial, CC required
  → Metered overage item added post-checkout by webhook (idempotency key protected)
       ↓
  Stripe fires checkout.session.completed webhook
  → Sets onboarding_complete = true
  → Provisions phone number (country-aware)
  → Creates subscription row via handleSubscriptionEvent()
       ↓
  Dashboard — billing cycle begins
  → Each call: Python agent calls increment_calls_used RPC
  → If limit_exceeded: reports to Stripe Billing Meter (voco_calls)
  → Overage charged automatically on next invoice
       ↓
  Lifecycle events:
  → invoice.paid (subscription_cycle) → resets calls_used to 0
  → customer.subscription.trial_will_end → email + SMS notification
  → invoice.payment_failed → email + SMS with portal URL
  → customer.subscription.updated/deleted/paused/resumed → sync subscription row
```

---

## File Map

| File | Role |
|------|------|
| `src/app/(public)/pricing/pricingData.js` | PRICING_TIERS data, COMPARISON_FEATURES, getAnnualPrice() |
| `src/app/(public)/pricing/PricingTiers.jsx` | Plan cards with monthly/annual toggle, CTA to onboarding |
| `src/app/(public)/pricing/FAQSection.jsx` | FAQ accordion on pricing page |
| `src/app/api/onboarding/checkout-session/route.js` | POST: create Stripe Checkout Session (onboarding, 14-day trial, embedded) |
| `src/app/api/onboarding/verify-checkout/route.js` | GET: polls subscription status after checkout for verification |
| `src/app/onboarding/checkout/page.js` | Step 5: Embedded Stripe Checkout, webhook verification, success celebration |
| `src/app/api/billing/checkout-session/route.js` | POST: create Stripe Checkout Session (upgrade, no trial, reuses customer) |
| `src/app/api/billing/data/route.js` | GET: subscription data with computed billing_interval for billing dashboard |
| `src/app/api/billing/invoices/route.js` | GET: 5 most recent invoices via Stripe API |
| `src/app/api/billing/portal/route.js` | GET: generates Stripe Customer Portal session, 303 redirect |
| `src/app/api/stripe/webhook/route.js` | POST: Stripe webhook handler — 9 event types |
| `src/lib/stripe.js` | Stripe SDK lazy singleton via Proxy pattern |
| `src/lib/subscription-gate.js` | checkSubscriptionGate() — blocks calls for inactive subscriptions |
| `src/app/dashboard/more/billing/page.js` | Billing page: plan card, usage ring, details, invoices |
| `src/components/dashboard/UsageRingGauge.js` | SVG donut ring gauge for call usage visualization |
| `src/app/dashboard/BillingWarningBanner.js` | Amber banner for past_due with 3-day grace countdown |
| `src/app/dashboard/TrialCountdownBanner.js` | Trial countdown banner (blue >3d, amber <=3d) |
| `src/emails/PaymentFailedEmail.jsx` | React Email template for payment failure |
| `src/emails/TrialReminderEmail.jsx` | React Email template for trial reminders |
| `supabase/migrations/010_billing_schema.sql` | subscriptions + stripe_webhook_events tables |
| `supabase/migrations/013_usage_events.sql` | usage_events table + increment_calls_used RPC |
| `supabase/migrations/016_billing_notifications.sql` | billing_notifications table |
| `supabase/migrations/017_overage_billing.sql` | overage_stripe_item_id column on subscriptions |
| `supabase/migrations/020_billing_notifications_unique.sql` | UNIQUE constraint on billing_notifications |
| `supabase/migrations/021_fix_subscriptions_rls.sql` | Fix subscriptions RLS policy role restriction |
| `supabase/migrations/037_fix_overage_off_by_one.sql` | Fix `>=` to `>` in increment_calls_used RPC (off-by-one overage bug) |

---

## 1. Pricing Plans

**File**: `src/app/(public)/pricing/pricingData.js`

| Plan | Monthly | Annual (20% off) | Call Limit | Overage Rate |
|------|---------|-------------------|------------|-------------|
| Starter | $99/mo | $79/mo | 40/mo | $2.48/call |
| Growth | $249/mo | $199/mo | 120/mo | $2.08/call |
| Scale | $599/mo | $479/mo | 400/mo | $1.50/call |
| Enterprise | Custom | Custom | Unlimited | Custom |

Annual pricing: `getAnnualPrice(monthlyPrice) = Math.round(monthlyPrice * 0.8)`.

All plans share the same features (AI call answering, triage, booking, CRM, calendar sync, multi-language). Higher tiers differ in call volume and support level.

### Stripe Price IDs (12 total)

| Env Var | Purpose |
|---------|---------|
| `STRIPE_PRICE_STARTER` | Starter monthly flat-rate |
| `STRIPE_PRICE_STARTER_ANNUAL` | Starter annual flat-rate |
| `STRIPE_PRICE_STARTER_OVERAGE` | Starter metered overage ($2.48/call) |
| `STRIPE_PRICE_GROWTH` | Growth monthly flat-rate |
| `STRIPE_PRICE_GROWTH_ANNUAL` | Growth annual flat-rate |
| `STRIPE_PRICE_GROWTH_OVERAGE` | Growth metered overage ($2.08/call) |
| `STRIPE_PRICE_SCALE` | Scale monthly flat-rate |
| `STRIPE_PRICE_SCALE_ANNUAL` | Scale annual flat-rate |
| `STRIPE_PRICE_SCALE_OVERAGE` | Scale metered overage ($1.50/call) |

All 3 overage prices link to the same Stripe Billing Meter (`voco_calls`, aggregation: Sum).

---

## 2. Checkout Session Creation

Two routes create Stripe Checkout Sessions — one for onboarding (new users) and one for upgrade/reactivation (existing users).

### Onboarding Checkout (`POST /api/onboarding/checkout-session`)

**File**: `src/app/api/onboarding/checkout-session/route.js`

- Request: `{ plan, interval?, embedded? }`
- Authenticates via `createSupabaseServer()`, looks up tenant via service role
- Maps plan + interval to price ID via PRICE_MAP (monthly/annual/overage per plan)
- **Two line items**: flat-rate plan price (quantity: 1) + metered overage price (no quantity)
- `payment_method_collection: 'always'` (CC required)
- `trial_period_days: 14`
- `metadata.tenant_id` set on BOTH session AND `subscription_data`
- Supports embedded mode (`ui_mode: 'embedded'`, `return_url`) and hosted mode (`success_url`/`cancel_url`)
- Returns `{ clientSecret }` (embedded) or `{ url }` (hosted)

### Upgrade Checkout (`POST /api/billing/checkout-session`)

**File**: `src/app/api/billing/checkout-session/route.js`

- Same PRICE_MAP structure, same 2 line items
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

## 3. Stripe Webhook Handler

**File**: `src/app/api/stripe/webhook/route.js`

### Event Types Handled

| Event | Handler | Purpose |
|-------|---------|---------|
| `checkout.session.completed` | `handleCheckoutCompleted` | Set onboarding_complete, provision phone, create initial subscription |
| `customer.subscription.created` | `handleSubscriptionEvent` | Sync subscription row |
| `customer.subscription.updated` | `handleSubscriptionEvent` | Sync subscription row |
| `customer.subscription.deleted` | `handleSubscriptionEvent` | Sync subscription row (status → canceled) |
| `customer.subscription.paused` | `handleSubscriptionEvent` | Sync subscription row (status → paused) |
| `customer.subscription.resumed` | `handleSubscriptionEvent` | Sync subscription row |
| `customer.subscription.trial_will_end` | `handleTrialWillEnd` | Email + SMS notification (3 days before trial end) |
| `invoice.paid` | `handleInvoicePaid` | Reset calls_used on billing cycle renewal |
| `invoice.payment_failed` | `handleInvoicePaymentFailed` | SMS + email with Stripe portal URL |

### Idempotency (D-09)

Global idempotency via `stripe_webhook_events` table:
```js
const { error } = await supabase.from('stripe_webhook_events')
  .insert({ event_id: event.id, event_type: event.type });
if (error?.code === '23505') return Response.json({ received: true }); // duplicate
```

### Out-of-Order Protection (D-10)

`handleSubscriptionEvent` compares `stripe_updated_at` timestamps — skips stale events.

### History Table Pattern (D-13)

1. INSERT new row with `is_current: true`
2. Mark all OTHER rows for same subscription as `is_current: false`
3. Carries forward `calls_used` from prior row

### Price-to-Plan Mapping

```js
const PLAN_MAP = {
  [STRIPE_PRICE_STARTER]:        { plan_id: 'starter', calls_limit: 40 },
  [STRIPE_PRICE_STARTER_ANNUAL]: { plan_id: 'starter', calls_limit: 480 },
  [STRIPE_PRICE_GROWTH]:         { plan_id: 'growth',  calls_limit: 120 },
  [STRIPE_PRICE_GROWTH_ANNUAL]:  { plan_id: 'growth',  calls_limit: 1440 },
  [STRIPE_PRICE_SCALE]:          { plan_id: 'scale',   calls_limit: 400 },
  [STRIPE_PRICE_SCALE_ANNUAL]:   { plan_id: 'scale',   calls_limit: 4800 },
};
```

Annual plans get the full yearly allocation (monthly limit × 12) since `calls_used` only resets on `invoice.paid` with `billing_reason: 'subscription_cycle'`, which fires once per year for annual subscriptions.

Overage items identified via `OVERAGE_PRICE_IDS` Set. The `overage_stripe_item_id` is saved on the subscription row.

### Status Mapping

```js
const statusMap = {
  trialing: 'trialing', active: 'active', past_due: 'past_due',
  canceled: 'canceled', paused: 'paused', incomplete: 'incomplete',
  incomplete_expired: 'canceled', unpaid: 'past_due',
};
```

---

## 4. Overage Billing (Stripe Billing Meters)

### How It Works

One Stripe Billing Meter (`voco_calls`, aggregation: Sum) shared across all 3 plans. Each plan has its own usage-based price linked to this meter.

```
Call completes → Python agent post-call pipeline
  → increment_calls_used RPC (Supabase)
  → Returns { success, calls_used, calls_limit, limit_exceeded }
  → If limit_exceeded:
      → stripe.billing.meterEvents.create({
          event_name: 'voco_calls',
          payload: { value: '1', stripe_customer_id: cus_xxx }
        })
  → Stripe tallies against metered subscription item
  → Charged automatically on next invoice
```

### Key Properties

- **New Billing Meters API**: Uses `stripe.billing.meterEvents.create()` (NOT the deprecated `usage_records` endpoint)
- **Customer-based routing**: Meter events use `stripe_customer_id` + `event_name` — no subscription item ID needed
- **Fire-and-forget**: Meter events processed within ~30s, don't block call pipeline
- **Calls never blocked**: Over-quota calls add charges to next invoice, never rejected
- **Trial handling**: Stripe accepts meter events during trial but bills at $0 until trial ends
- **Stripe SDK version**: Requires `stripe@^17.0.0` or later (API version `2025-03-31.basil`)

---

## 5. Usage Tracking

### `increment_calls_used` RPC (Migration 013, fixed in 037)

```sql
CREATE FUNCTION increment_calls_used(p_tenant_id uuid, p_call_id text)
RETURNS TABLE(success boolean, calls_used int, calls_limit int, limit_exceeded boolean)
```

- **Idempotency**: INSERT into `usage_events` (call_id PK) with ON CONFLICT DO NOTHING
- **Atomic increment**: UPDATE subscriptions SET calls_used = calls_used + 1
- **Duplicate call**: Returns current state without incrementing (FOUND = false)
- **No subscription**: Returns (false, 0, 0, false)
- **`limit_exceeded` uses `>` (strictly greater than)**: Returns true only when `calls_used > calls_limit`. Migration 037 fixed an off-by-one where `>=` caused the last included call to be reported as overage.

### `handleInvoicePaid` — Usage Reset

Resets `calls_used = 0` on `invoice.paid` with `billing_reason: 'subscription_cycle'`. Only fires on billing cycle renewal (not first invoice).

---

## 6. Subscription Enforcement Gate

**File**: `src/lib/subscription-gate.js`

```js
export const BLOCKED_STATUSES = ['canceled', 'paused', 'incomplete'];
export async function checkSubscriptionGate(supabase, tenantId)
  → { blocked: boolean, reason?: string }
```

- **Blocks**: canceled, paused, incomplete
- **Allows**: trialing, active, past_due (3-day grace period)
- **Over-quota**: NEVER blocked (overage billing handles it)
- **Error resilience**: Query error or unexpected error → fail open (allow call)
- **No subscription row**: Allow (pre-subscription state)

### Middleware Subscription Check

**File**: `src/proxy.js` (lines 107-148)

Dashboard routes check subscription status via service role client. Currently **logs but does not block** — `BillingWarningBanner` handles user-facing warnings. Past_due tenants with expired 3-day grace period are logged.

---

## 7. Billing Dashboard

### Billing Page (`/dashboard/more/billing`)

**File**: `src/app/dashboard/more/billing/page.js`

4 sections:
1. **Plan card**: Plan name (from PRICING_TIERS), price, status badge, cancel-at-period-end warning
2. **Usage meter**: `UsageRingGauge` SVG donut — orange arc for normal usage, amber arc for overage
3. **Billing details**: Renewal date (or trial end date), "Manage Subscription" button (→ Stripe portal)
4. **Recent invoices**: Table of 5 invoices with date, amount, status badge, external link

### UsageRingGauge Component

**File**: `src/components/dashboard/UsageRingGauge.js`

Props: `callsUsed`, `callsLimit`, `overageRate`. Normal fill: brand orange arc. Overage: amber arc (capped at 50% additional visual). Animated with CSS transition (respects `prefers-reduced-motion`).

### Billing API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/billing/invoices` | GET | 5 most recent invoices via `stripe.invoices.list({ customer })` |
| `/api/billing/portal` | GET | Creates Stripe Customer Portal session, 303 redirect. Allowed return URLs: `/dashboard`, `/dashboard/more/billing` |

### Dashboard Banners

**BillingWarningBanner** (`src/app/dashboard/BillingWarningBanner.js`): Amber banner for `past_due` subscriptions. Shows 3-day grace period countdown. Links to `/api/billing/portal`. Dismissible.

**TrialCountdownBanner** (`src/app/dashboard/TrialCountdownBanner.js`): Blue (>3 days) or amber (<=3 days) trial countdown. Dismissible.

---

## 8. Billing Notifications

### `handleTrialWillEnd` (Webhook)

- Fires on `customer.subscription.trial_will_end` (3 days before trial end)
- **Idempotency**: Checks `billing_notifications` table before sending, upserts after
- Sends email (`TrialReminderEmail`) + SMS via `Promise.allSettled`
- Notification failures are logged but NEVER thrown (prevents Stripe retry)

### `handleInvoicePaymentFailed` (Webhook)

- Fires on `invoice.payment_failed`
- Generates Stripe Customer Portal URL for direct payment method update
- Sends SMS + email (`PaymentFailedEmail`) via `Promise.allSettled`
- Notification failures logged, never thrown

### Email Templates

| Template | File | Purpose |
|----------|------|---------|
| `TrialReminderEmail` | `src/emails/TrialReminderEmail.jsx` | Dynamic heading/body based on trial stage, usage stats, upgrade CTA |
| `PaymentFailedEmail` | `src/emails/PaymentFailedEmail.jsx` | Amber-700 header (urgency), portal URL for payment update |

Both use React Email components with inline styles matching design tokens.

---

## 9. Database Tables

### `subscriptions` (Migration 010 + 017)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | gen_random_uuid() |
| `tenant_id` | uuid FK | → tenants CASCADE |
| `stripe_customer_id` | text | NOT NULL |
| `stripe_subscription_id` | text | NOT NULL |
| `stripe_price_id` | text | nullable |
| `plan_id` | text | CHECK starter/growth/scale |
| `status` | text | CHECK trialing/active/past_due/canceled/paused/incomplete |
| `calls_limit` | int | NOT NULL |
| `calls_used` | int | NOT NULL DEFAULT 0 |
| `trial_ends_at` | timestamptz | nullable |
| `current_period_start` | timestamptz | nullable |
| `current_period_end` | timestamptz | nullable |
| `cancel_at_period_end` | boolean | NOT NULL DEFAULT false |
| `stripe_updated_at` | timestamptz | For out-of-order webhook protection |
| `is_current` | boolean | NOT NULL DEFAULT true |
| `overage_stripe_item_id` | text | nullable — Stripe metered subscription item ID |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

**Indexes**: `(tenant_id, is_current)`, `(stripe_subscription_id)`

**RLS**: SELECT-own for all roles (via tenants.owner_id — fixed in migration 021 to remove TO authenticated restriction), service_role ALL

### `stripe_webhook_events` (Migration 010)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `event_id` | text UNIQUE | Idempotency key |
| `event_type` | text | NOT NULL |
| `processed_at` | timestamptz | DEFAULT now() |

**RLS**: Service role only (no authenticated access)

### `usage_events` (Migration 013)

| Column | Type | Notes |
|--------|------|-------|
| `call_id` | text PK | Idempotency key — prevents double-counting |
| `tenant_id` | uuid FK | → tenants CASCADE |
| `created_at` | timestamptz | DEFAULT now() |

**RLS**: Service role only

### `billing_notifications` (Migration 016 + 020)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid FK | → tenants CASCADE |
| `notification_type` | text | NOT NULL |
| `sent_at` | timestamptz | DEFAULT now() |
| `metadata` | jsonb | nullable |
| `created_at` | timestamptz | DEFAULT now() |

**Constraint**: UNIQUE (tenant_id, notification_type) — added in migration 020

**RLS**: Service role only

---

## 10. Environment Variables

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe SDK initialization (server-side only) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client-side Stripe.js (EmbeddedCheckout) |
| `STRIPE_PRICE_STARTER` | Starter monthly price ID |
| `STRIPE_PRICE_GROWTH` | Growth monthly price ID |
| `STRIPE_PRICE_SCALE` | Scale monthly price ID |
| `STRIPE_PRICE_STARTER_ANNUAL` | Starter annual price ID |
| `STRIPE_PRICE_GROWTH_ANNUAL` | Growth annual price ID |
| `STRIPE_PRICE_SCALE_ANNUAL` | Scale annual price ID |
| `STRIPE_PRICE_STARTER_OVERAGE` | Starter metered overage price ID |
| `STRIPE_PRICE_GROWTH_OVERAGE` | Growth metered overage price ID |
| `STRIPE_PRICE_SCALE_OVERAGE` | Scale metered overage price ID |
| `NEXT_PUBLIC_APP_URL` | Base URL for checkout success/cancel redirects |
| `RESEND_API_KEY` | Resend email service for billing notifications |
| `TWILIO_FROM_NUMBER` | SMS sender for billing notifications |

---

## 11. Key Design Decisions

- **Two line items per subscription**: Every subscription has a flat-rate price + metered overage price. The Checkout Session only includes the flat-rate item — the metered overage item is added post-checkout by the webhook handler (and verify-checkout fallback) using a Stripe idempotency key (`add_overage_{subscription_id}`) to prevent duplicate items from concurrent processing.

- **Billing Meters (not legacy usage_records)**: The old `POST /v1/subscription_items/{id}/usage_records` endpoint was removed in Stripe API version `2025-03-31.basil`. The new `stripe.billing.meterEvents.create()` uses customer_id + event_name, not subscription item ID.

- **One meter, three prices**: All three plans share the `voco_calls` Billing Meter. Stripe resolves the per-unit rate from whichever overage price is on the customer's subscription.

- **`overage_stripe_item_id` stored but not required for reporting**: The column exists for reference/auditing. The Billing Meters API routes via customer_id, not subscription item ID.

- **History table pattern for subscriptions**: New row inserted first (is_current=true), then old rows marked is_current=false. Brief window with 2 current rows is safer than 0 — queries use `order + limit 1` to pick latest.

- **Out-of-order protection via stripe_updated_at**: Webhook events can arrive out of order. Each event's timestamp is compared against the current row — stale events are skipped.

- **`calls_used` carried forward on subscription sync**: When a new subscription row is inserted (e.g., plan change), `calls_used` is copied from the prior row to prevent losing mid-cycle usage count.

- **`calls_used` resets on `invoice.paid` with `billing_reason: 'subscription_cycle'`**: Only fires on billing cycle renewal (not first invoice or metered invoices).

- **Subscription gate fails open**: If the subscription query fails, calls are allowed through. Revenue > correctness for edge cases.

- **Over-quota calls never blocked**: The subscription gate does NOT check usage — overage billing handles over-quota calls automatically.

- **past_due gets 3-day grace period**: Calls continue, BillingWarningBanner shows countdown (anchored to `current_period_end + 3 days`, not `stripe_updated_at`), SMS + email sent with portal URL. Uses `current_period_end` because it's stable during `past_due` — `stripe_updated_at` advances on every subscription update event, which would incorrectly extend the grace window.

- **Notification failures never crash webhook handlers**: `Promise.allSettled` for email + SMS, errors logged but not thrown. Prevents Stripe retry loops caused by notification service outages.

- **`billing_notifications` UNIQUE constraint (tenant_id, notification_type)**: Prevents duplicate notifications even under concurrent webhook deliveries. Application code uses upsert with `ignoreDuplicates` as belt-and-suspenders.

- **`billing_notifications` cleared on subscription cancellation**: When `handleSubscriptionEvent` processes a `canceled` status, it fire-and-forget deletes all `billing_notifications` rows for that tenant. This ensures future re-subscriptions get fresh notification tracking (e.g., a new trial_will_end notification if the business model ever offers trials on reactivation).

- **Authenticated users can only READ subscriptions**: No INSERT/UPDATE policies for authenticated role. All writes via service_role (webhook handlers). Intentional write-protection.

- **Onboarding checkout has trial; upgrade checkout does not**: New users get 14-day trial with CC required. Reactivating/upgrading users pay immediately.

- **Upgrade checkout reuses existing Stripe customer**: Looks up `stripe_customer_id` from existing subscription to maintain invoice/payment history.

- **Billing portal return URL is allowlisted**: Only `/dashboard` and `/dashboard/more/billing` are accepted. Prevents open redirect via query param.

---

## Cross-Domain References

- **Onboarding wizard checkout flow**: See `onboarding-flow` skill for how the checkout step fits into the 5-step wizard, plan param capture from pricing page, and `useWizardSession` session management.
- **Phone provisioning post-checkout**: See `onboarding-flow` skill for country-aware provisioning in the `handleCheckoutCompleted` webhook handler.
- **Auth + Supabase clients**: See `auth-database-multitenancy` skill for `createSupabaseServer()` vs service role patterns, and why the webhook handler uses service role for all writes.
- **Voice call post-call pipeline**: See `voice-call-architecture` skill for how the Python agent calls `increment_calls_used` and reports Stripe meter events.
- **Dashboard billing page**: See `dashboard-crm-system` skill for how the billing page fits into the More menu structure and the BillingWarningBanner/TrialCountdownBanner in the dashboard layout.
- **Phase 59 invoice attribution (Voco internal invoices — NOT Stripe invoices)**: The Voco `invoices` table (migrations 029 + Phase 59) had `lead_id` replaced by `job_id` (NULLABLE). Customer is now derivable via `invoices.job_id → jobs.customer_id`. Ad-hoc invoices without a job remain valid (D-11 — NOT NULL enforcement deferred). The Customer detail page's Invoices tab (Phase 59 Plan 07) queries `invoices JOIN jobs ON jobs.id = invoices.job_id WHERE jobs.customer_id = :id`, gated by `features_enabled.invoicing`. Full schema in `auth-database-multitenancy` skill.

---

## Important: Keeping This Document Updated

When making changes to any file listed in the File Map above, update the relevant sections of this skill document to reflect the new behavior. Key areas to keep current:

- Pricing Plans — if plans, prices, or limits change
- Checkout Session Creation — if checkout flow or params change
- Webhook Handler — if new event types are added or handling logic changes
- Database Tables — if schema changes or new billing-related migrations are added
- Environment Variables — if new Stripe-related env vars are added

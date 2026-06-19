---
name: payment-architecture
description: Complete architectural reference for the payment, billing, and subscription system — Stripe Checkout Sessions (onboarding + upgrade, both with a 409 double-subscription guard and flexible billing mode for annual intervals), webhook handler (9 event types, history table pattern with unmark-by-tenant-before-insert, atomic processing-claim idempotency via stripe_webhook_events.processed + processing_started_at / migrations 064+068, processed-state check on failed claims, partial unique index idx_subscriptions_one_current), Basil API version pin (2025-06-30.basil) with subscription-item period reads + invoice.parent.subscription_details, Billing Meters overage system (Python agent is sole reporter via stripe.billing.meter_events.create, with stripe_meter_failures outbox + retry-meter-events cron / migration 071), subscription lifecycle (trialing/active/past_due/canceled/paused), usage tracking (increment_calls_used RPC), subscription enforcement gate (past_due blocked after 3-day grace via the Python agent's shared subscription_gate.py), churned-number release cron, billing notifications (trial_will_end, payment_failed), billing dashboard (plan card, UsageRingGauge, invoices, Stripe Customer Portal), pricing page (3 plans with monthly/annual/overage), all 5 billing DB tables with RLS policies. Phase 59: invoices.job_id attribution (lead_id removed — customer derivable via job.customer_id; ad-hoc invoices without a job remain possible per D-11). Use this skill whenever making changes to Stripe integration, checkout sessions, subscription handling, usage tracking, overage billing, billing notifications, billing dashboard, pricing page, or any payment-related API route. Also use when the user asks about how billing works, wants to modify subscription logic, or needs to debug payment/webhook issues.
---

# Payment Architecture — Complete Reference

This document is the single source of truth for the entire payment, billing, and subscription system. Read this before making any changes to Stripe integration, checkout flows, subscription handling, usage tracking, overage billing, or the billing dashboard.

**Last updated**: 2026-06-12 (audit wave 1 — (1) Basil pin bumped `2025-03-31.basil` → `2025-06-30.basil` (`src/lib/stripe.js`) to enable **flexible billing mode**; both checkout routes set `subscription_data.billing_mode = { type: 'flexible' }` for ANNUAL intervals only — required so the webhook can attach the monthly metered overage price to annual subscriptions (classic mode rejects mixed intervals; verified test-mode). (2) Onboarding checkout `ui_mode` is `'embedded'` — the prior `'embedded_page'` value is a dahlia-only enum REJECTED under the Basil pin, which had broken signup checkout (verified test-mode). (3) Webhook idempotency: a duplicate delivery that fails to claim no longer acks 200 unconditionally — it checks `processed` (true → 200, false → 500 so Stripe retries; stale claims >10min get stolen); the old unconditional ack permanently lost events whose first delivery died un-gracefully. (4) Overage attach failures in webhook + verify-checkout now `Sentry.captureMessage` (no longer silent). (5) `handleInvoicePaid` throws when the `calls_used` reset matches 0 rows (racing the unmark→insert window) so Stripe retries — previously the reset was silently lost (spurious overage next cycle). (6) NEW crons: `/api/cron/release-churned-numbers` (daily 04:00) and `/api/cron/retry-meter-events` (every 6h, drains the `stripe_meter_failures` outbox, migration 071). (7) Subscription gate: past_due is now BLOCKED after the 3-day grace via the shared livekit-agent `src/lib/subscription_gate.py` (agent.py gate + twilio_routes); `proxy.js` no longer runs the dead status query; `BillingWarningBanner` shows a RED "AI receptionist is paused" variant post-grace and is no longer dismissible; `TrialCountdownBanner` no longer dismissible.)

**Previous update**: 2026-06-10 (Billing hardening, migration 068 — (1) Webhook idempotency upgraded from "processed flag" to an **atomic processing claim**: `stripe_webhook_events.processing_started_at` (068); duplicates may only re-run after claiming the row with a conditional UPDATE (`processed=false` AND claim NULL/stale >10min), closing the concurrent-delivery double-processing hole; handler failure resets the claim for immediate retry. (2) `handleSubscriptionEvent` now unmarks `is_current` by TENANT (not stripe_subscription_id), unmark-BEFORE-insert; `calls_used` carry-forward only within the same `stripe_subscription_id`; out-of-order protection now uses the event envelope's `event.created` (the old `subscription.updated` read was dead code — that field doesn't exist). Same unmark-by-tenant reorder in verify-checkout's `syncSubscription`. (3) Both checkout-session routes 409 when the tenant already has a live `is_current` subscription (active/trialing/past_due) — fixes double-subscription/double-billing. (4) `handleCheckoutCompleted` now THROWS on tenant-update failure so Stripe retries. (5) Migration 068 adds partial unique index `idx_subscriptions_one_current` (+ dedupe of pre-existing duplicate current rows). Earlier prod-readiness 2026-06 items (Basil pin, Billing Meters Python path, migration 064 `processed` flag) still apply.)

---

## Architecture Overview

| Layer | Files | Purpose |
|-------|-------|---------|
| **Pricing Page** | `src/app/(public)/pricing/pricingData.js`, `PricingTiers.jsx` | Plan selection, pricing display, annual toggle |
| **Onboarding Checkout** | `src/app/api/onboarding/checkout-session/route.js`, `src/app/onboarding/checkout/page.js` | Embedded Stripe Checkout with 14-day trial |
| **Upgrade Checkout** | `src/app/api/billing/checkout-session/route.js` | Hosted Stripe Checkout, no trial, reuses Stripe customer |
| **Webhook Handler** | `src/app/api/stripe/webhook/route.js` | 9 event types, idempotency, history table pattern |
| **Usage Tracking** | `supabase/migrations/013_usage_events.sql` (RPC) + Python agent `src/post_call.py` | Per-call counting + Stripe Billing Meter overage reporting |
| **Subscription Gate** | `src/lib/subscription-gate.js` (JS reference) + livekit-agent `src/lib/subscription_gate.py` (live enforcement) | Blocks calls for canceled/paused/incomplete tenants; Python gate also blocks past_due after the 3-day grace |
| **Billing Crons** | `src/app/api/cron/retry-meter-events/route.js`, `src/app/api/cron/release-churned-numbers/route.js` | Drain stripe_meter_failures outbox (every 6h); release churned tenants' numbers after 30 days (daily 04:00) |
| **Billing Dashboard** | `src/app/dashboard/more/billing/page.js`, `UsageRingGauge.js` | Plan info, usage meter, invoices, portal link |
| **Billing API** | `src/app/api/billing/data/route.js`, `invoices/route.js`, `portal/route.js` | Subscription data (with billing_interval), invoice list, Stripe Customer Portal redirect |
| **Banners** | `BillingWarningBanner.js`, `TrialCountdownBanner.js` | Dashboard warnings for past_due and trial countdown |
| **Notifications** | `src/emails/PaymentFailedEmail.jsx`, `TrialReminderEmail.jsx` | Email templates for billing events |
| **Stripe SDK** | `src/lib/stripe.js` | Lazy-init Stripe singleton via Proxy |
| **DB Schema** | Migrations 010, 013, 016, 017, 020, 021, 037, 064, 068, 071 | 5 billing tables + RPC + RLS (064 adds `stripe_webhook_events.processed`; 068 adds `processing_started_at` + `idx_subscriptions_one_current`; 071 adds the `stripe_meter_failures` outbox) |
| **Stripe SDK config** | `src/lib/stripe.js` | `apiVersion` pinned to `2025-06-30.basil` (Basil — required for Billing Meters + period-field moves; this release adds flexible billing mode, needed for the annual+monthly-overage mix) |

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
  → If meter post fails: outbox row in stripe_meter_failures (migration 071)
      → /api/cron/retry-meter-events re-posts every 6h (same identifier — dedupe)
  → Overage charged automatically on next invoice
       ↓
  Lifecycle events:
  → invoice.paid (subscription_cycle) → resets calls_used to 0
  → customer.subscription.trial_will_end → email + SMS notification
  → invoice.payment_failed → email + SMS with portal URL
  → customer.subscription.updated/deleted/paused/resumed → sync subscription row
  → canceled >30 days → /api/cron/release-churned-numbers frees the phone number
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
| `src/lib/stripe.js` | Stripe SDK lazy singleton via Proxy pattern; pins `apiVersion: '2025-06-30.basil'` (enables flexible billing mode) |
| `src/lib/subscription-gate.js` | checkSubscriptionGate() — JS reference gate (canceled/paused/incomplete); live call enforcement is the Python agent's shared `subscription_gate.py` (livekit-agent repo), which also blocks past_due post-grace |
| `src/app/api/cron/retry-meter-events/route.js` | Cron (every 6h): drains `stripe_meter_failures` outbox — re-posts meter events with `identifier=overage_{call_id}`, deletes on success, Sentry alert at 10 attempts |
| `src/app/api/cron/release-churned-numbers/route.js` | Cron (daily 04:00): releases phone numbers of tenants whose current subscription is canceled >30 days (SG → phone_inventory, US/CA → Twilio release) |
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
| `supabase/migrations/064_webhook_event_status.sql` | Adds `processed boolean NOT NULL DEFAULT false` to `stripe_webhook_events` — gates atomic-idempotency re-run (prod-readiness 2026-06) |
| `supabase/migrations/068_billing_and_security_hardening.sql` | Billing sections: dedupe duplicate `is_current` rows per tenant + partial unique index `idx_subscriptions_one_current ON subscriptions(tenant_id) WHERE is_current`; adds `stripe_webhook_events.processing_started_at` (atomic processing claim) |
| `supabase/migrations/071_meter_event_outbox.sql` | `stripe_meter_failures` outbox table (service-role only) + extends `activity_event_type` enum with `integration_fetch`/`integration_fetch_fanout` |

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

### Idempotency (D-09) — atomic "processing claim" pattern (migrations 064 + 068)

Global idempotency via `stripe_webhook_events` table: `processed` boolean (064) + `processing_started_at` claim timestamp (068). The pre-handler INSERT wins the concurrency race (UNIQUE on `event_id`) and **doubles as the claim** (`processing_started_at = now()`). Acking is gated on `processed=true`, set only AFTER the handler block succeeds.

**The bug 068 closes**: the 064 pattern fell through and **re-ran the handler** on any duplicate with `processed=false` — including duplicates delivered while the FIRST attempt was still mid-flight, allowing concurrent handler runs (double Twilio number purchase, subscription-row races). Duplicates now must atomically *claim* the row before re-running.

**The bug the 2026-06-12 wave closes**: a duplicate that FAILED to claim was acked 200 unconditionally. If the first delivery died un-gracefully (function timeout, OOM) without releasing its claim, Stripe's retry landed inside the 10-minute claim window, got the 200, and Stripe stopped retrying forever while the row sat `processed=false` — the event was permanently lost. The handler now reads `processed` on a failed claim: `true` → 200 (genuinely done), `false` → 500 so Stripe keeps retrying (a dead holder's claim goes stale after 10 minutes and the next retry steals it).

**The flow** (`POST` in `route.js`):
```js
// 1. INSERT event_id with processing_started_at = now() (fresh insert = claim)
const { error: idempotencyError } = await supabase
  .from('stripe_webhook_events')
  .insert({ event_id: event.id, event_type: event.type,
            processing_started_at: new Date().toISOString() });

if (idempotencyError?.code === '23505') {
  // Duplicate — try to CLAIM it. Only matches a dead/failed prior attempt:
  // processed=false AND (claim NULL OR claim older than 10 minutes — stale
  // claims from crashed workers are stolen).
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from('stripe_webhook_events')
    .update({ processing_started_at: new Date().toISOString() })
    .eq('event_id', event.id)
    .eq('processed', false)
    .or(`processing_started_at.is.null,processing_started_at.lt.${tenMinAgo}`)
    .select('id');
  if (claimError) return 500;                      // can't determine state → Stripe retries
  if (!claimed || claimed.length === 0) {
    // No claim won — check WHY before acking (unconditional 200 here used to
    // permanently lose events whose first delivery died holding the claim).
    const { processed } = /* select processed from stripe_webhook_events */;
    if (processed) return 200; // fully done → ack
    return 500;                // live claim, unprocessed → Stripe retries
                               // (stale claims >10min get stolen by a later retry)
  }
  // Claimed a stale/failed attempt → FALL THROUGH and re-run the (idempotent) handler
} else if (idempotencyError) {
  return 500; // DB error (not duplicate) → Stripe retries
}

// 2. Run the (idempotent) handler in try/catch
try { /* route event.type → handler */ }
catch (err) {
  // Release the claim (processing_started_at = null, best effort) so Stripe's
  // retry can re-claim IMMEDIATELY instead of waiting out the 10-min window.
  return 500;
}

// 3. Handler succeeded → flip processed=true
// If the flag write fails: release the claim (best effort) + return 500 so the
// retry re-claims and replays the idempotent handler.
return 200;
```

**Why re-run is safe**: handlers are idempotent — `handleSubscriptionEvent` has the `event.created` out-of-order guard plus the `idx_subscriptions_one_current` unique index, and `handleInvoicePaid` is a deterministic `calls_used = 0` reset. Replaying them produces no extra side effects.

**No backfill** (per migration 064 header): existing rows default `processed=false`, but Stripe's delivery windows for them have closed, so they're never retried — the flag only governs in-flight/future deliveries.

### Out-of-Order Protection (D-10)

`handleSubscriptionEvent` uses the **event envelope's `event.created`** (epoch seconds), threaded into the handler from `POST`. The previous code read `subscription.updated || subscription.created` — **dead code**: the Stripe Subscription object has no `updated` field, so every event compared against the subscription's creation time. `event.created` is stamped per event, giving a real ordering across created/updated/deleted deliveries — including across cancel→re-subscribe where the subscription id changes.

The current row is now looked up **by tenant** (`tenant_id` + `is_current=true`, any subscription id) so late events from a replaced subscription are compared against the row that superseded them. Comparison is via `Date.parse` (the old string comparison broke on PostgREST `+00:00` vs `toISOString()` `Z` formats). Incoming `event.created` older than the stored `stripe_updated_at` → skip.

### Basil Field Moves (introduced in `2025-03-31.basil`, still apply under the current `2025-06-30.basil` pin)

The API version is pinned in `src/lib/stripe.js` (`STRIPE_API_VERSION = '2025-06-30.basil'` — bumped from `2025-03-31.basil` on 2026-06-12 to enable flexible billing mode for annual subscriptions). Under Basil, two fields the webhook + `verify-checkout` depend on moved location, so both files read them defensively with a fallback to the pre-Basil position:

- **Period fields moved to the subscription ITEM**: `current_period_start` / `current_period_end` are now on each subscription item, not the Subscription object. Both `handleSubscriptionEvent` and `verify-checkout`'s `syncSubscription` read them from the `flatRateItem`:
  ```js
  const periodStart = flatRateItem?.current_period_start ?? subscription.current_period_start;
  const periodEnd   = flatRateItem?.current_period_end   ?? subscription.current_period_end;
  ```
- **`invoice.subscription` moved under `invoice.parent`**: `handleInvoicePaid` and `handleInvoicePaymentFailed` resolve the subscription id as:
  ```js
  const subscriptionId = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
  ```

These read from the flat-rate item specifically (the item matched against `PLAN_MAP`), not the metered overage item.

### History Table Pattern (D-13, reordered by migration 068)

1. UPDATE all of the **tenant's** `is_current=true` rows to `false` FIRST (by `tenant_id`, NOT `stripe_subscription_id` — unmarking by subscription id left two current rows after cancel→re-subscribe, since the new subscription has a new id)
2. INSERT new row with `is_current: true`
3. `calls_used` carries forward **only when the prior current row has the SAME `stripe_subscription_id`** (plan changes keep the id); a replacement subscription starts at 0

Unmark-before-insert is required by the partial unique index `idx_subscriptions_one_current` (068) — insert-first would violate it. The brief zero-current window is safe: the subscription gate fails open and readers use order+limit to pick the latest row. A 23505 on insert (concurrent writer) is thrown so Stripe retries and the sync converges. The same unmark-by-tenant reorder applies to `verify-checkout`'s `syncSubscription` (there, insert failure just logs — the webhook's row stands and the client re-polls).

### handleCheckoutCompleted Failure Semantics

The tenant update (`onboarding_complete = true`) now **throws on failure** so the route returns 500 and Stripe retries. Previously the error was swallowed and the event marked processed — leaving tenants who PAID stuck with `onboarding_complete=false` (dashboard redirect loop) with no retry.

**Overage attach failures alert (2026-06-12)**: when the metered overage item attach (`stripe.subscriptionItems.create`) fails — in `handleCheckoutCompleted` or in verify-checkout's fallback — the failure is now reported via `Sentry.captureMessage` (error level). Previously it was only console-logged, leaving the subscription silently unbillable for overage (every over-quota call recorded to the meter but never rated).

**Onboarding-audit fix wave (2026-06-13)** — `handleCheckoutCompleted` additionally:
- **Seeds activation defaults** before provisioning: `working_hours` (trade-typical, shape mirrors WorkingHoursEditor) when NULL, and a `tenant_timezone` backstop (SG → Asia/Singapore when still on the DB default). Seed failure is non-fatal but Sentry-alerted — an unseeded tenant has zero bookable slots.
- **Idempotent provisioning**: SG reuses a `phone_inventory` row already assigned to the tenant before calling the non-idempotent `assign_sg_number` RPC; US/CA purchases tag `friendlyName: voco-tenant-{tenantId}` and list-by-friendlyName to reuse a prior purchase on retry. The phone_number tenant write now THROWS on failure (Stripe retries; the pre-checks make the retry reuse the same number) and clears `provisioning_failed`.
- **Number routing — `configureNumberRouting` (R2 fix)**: after provisioning, both SG and US/CA numbers are routed to the AI receptionist. When `RAILWAY_WEBHOOK_URL` is set the helper sets the number's `voiceUrl`/`voiceFallbackUrl`/`smsUrl` to the livekit FastAPI webhook **and removes the number from the Elastic SIP trunk** (a trunk-associated number ignores its `voiceUrl` — trunk wins — so disassociation is mandatory for owner-pickup/VIP/schedule/cap routing to run). Fail-safe: with `RAILWAY_WEBHOOK_URL` unset it falls back to legacy trunk-only association (AI-direct), never a broken `voiceUrl`. Idempotent on retries (re-sets URLs, 404-tolerates the trunk removal). Pre-fix numbers are migrated by `scripts/cutover-existing-numbers.js` (now also disassociates the trunk). **`RAILWAY_WEBHOOK_URL` must be set in Vercel prod** for new tenants to get the routing layer.
- **Welcome email** (`src/emails/WelcomeEmail.jsx`): sent after provisioning success with the formatted number, test-call/forwarding guidance, and trial end date (event.created + 14d). Idempotent via `billing_notifications` type `'welcome'`.
- **Provisioning-failure email is deduped** via `billing_notifications` type `'provisioning_failed'` (Stripe retries used to re-send it), and the failure path now Sentry-alerts. `notification_type` is free text with UNIQUE(tenant_id, notification_type) — no CHECK constraint to migrate.
- Relatedly, `src/proxy.js` rescues paid-but-unflagged tenants hitting `/dashboard` (service-role `is_current` subscription check → repair `onboarding_complete`), and the checkout page's verify polling is two-stage (~3 min) with a retry button on the error phase.

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
- **Fire-and-forget with durable fallback**: Meter events processed within ~30s, don't block call pipeline; the post itself is capped at 3s in the Python agent and failures land in the `stripe_meter_failures` outbox (see below) instead of being dropped
- **Calls never blocked**: Over-quota calls add charges to next invoice, never rejected
- **Trial handling**: Stripe accepts meter events during trial but bills at $0 until trial ends
- **Stripe SDK version**: Requires `stripe@^17.0.0` or later (API version `2025-06-30.basil`)

### Who Reports Overage: the Python Agent is the Sole Path

Overage reporting happens **only** in the Python LiveKit agent's post-call pipeline (`livekit-agent/src/post_call.py`, a separate Railway-deployed repo — see `voice-call-architecture` skill). The Next.js side never reports meter events; it only *creates the overage subscription item* once, at onboarding (`handleCheckoutCompleted` / `verify-checkout` `fulfillSubscription`, via `stripe.subscriptionItems.create` with idempotency key `add_overage_{subscription_id}`).

**Prod-readiness 2026-06 fix (Python side)**: the agent previously reported overage via `stripe.billing.subscription_items.create_usage_record(...)` — an endpoint **removed in Basil** (`2025-03-31.basil`). On Basil it silently failed, so overage was never billed. It now reports through the Billing Meters API:
```python
stripe.billing.meter_events.create(
    event_name="voco_calls",
    payload={"value": "1", "stripe_customer_id": <cus_id>},
    identifier=f"overage_{call_id}",   # idempotency — dedupes retries
)
```
Routing is by `stripe_customer_id` (no subscription-item id needed), and the per-event `identifier=overage_{call_id}` makes Stripe-side reporting idempotent on top of the DB-side `usage_events` PK dedup.

### Meter-Failure Outbox + Retry Cron (migration 071, 2026-06-12)

A failed meter post used to be permanently unbilled revenue: `increment_calls_used` had already consumed the `call_id` (usage_events PK), so re-running the pipeline skipped the meter branch — there was no retry path. Now:

- **Agent side**: on meter-post failure (capped at 3s via `asyncio.wait_for`), the Python agent upserts a row into `stripe_meter_failures` (upsert on `call_id` — see table in §9).
- **Cron side**: `/api/cron/retry-meter-events` (every 6h, `vercel.json`) drains up to 25 rows per run, re-posting with the SAME `identifier=overage_{call_id}` — Stripe dedupes meter events by identifier, so a retry can never double-bill even if the original post landed before its response was lost. Rows are **deleted on success**; on failure `attempts`/`last_attempt_at`/`failure_reason` are updated, and crossing 10 attempts fires a one-time `Sentry.captureMessage` (the row is kept for manual review and skipped thereafter).

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

**Throws when the reset matches 0 rows (2026-06-12)**: renewals fire `invoice.paid` and `customer.subscription.updated` near-simultaneously, so the reset can race the history pattern's unmark→insert window when there is momentarily no `is_current` row. A 0-row UPDATE is not a PostgREST error — previously the event was marked processed and the reset silently lost, carrying a full prior cycle's usage into the new cycle (spurious overage). Throwing returns 500 so Stripe retries after the subscription event lands.

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

### Live Enforcement: Python `subscription_gate.py` (2026-06-12)

The JS module above is a reference implementation — the **live call-blocking path** is the shared livekit-agent module `src/lib/subscription_gate.py` (separate Railway repo): `is_subscription_blocked(status, current_period_end)`. It blocks canceled/paused/incomplete always, and **past_due once the 3-day grace (anchored to `current_period_end`) expires** — previously past-grace past_due tenants kept receiving answered calls forever. Used by both `agent.py` (whose subscription select now includes `current_period_end`) and `twilio_routes.py` (whose tenants query now filters the subscriptions embed with `.eq("subscriptions.is_current", True)` — it previously read an arbitrary history row). See `voice-call-architecture` skill.

### Middleware Subscription Check

**File**: `src/proxy.js`

Dashboard access is deliberately **not** gated on subscription status — the dead status query that used to run on every dashboard request (logging but never blocking) was removed in 2026-06-12; `proxy.js` now just documents the decision in a comment. User-facing warning is `BillingWarningBanner`; call-side enforcement is the Python gate above.

### Churned Number Release (`/api/cron/release-churned-numbers`, 2026-06-12)

Daily at 04:00 (`vercel.json`). Tenants whose **current** subscription row is `canceled` for more than 30 days and who still hold a phone number get the number released (batch of 10/run). The 30-day retention window means a tenant who reactivates keeps their number — re-subscribing replaces the `is_current` row with an active one, dropping them out of the query. Per country:

- **SG**: number returned to `phone_inventory` (status `available`, `assigned_tenant_id` cleared) — platform-owned, never released at Twilio
- **US/CA (other)**: looked up at Twilio by E.164 and released (releasing also detaches it from the Elastic SIP trunk)

Either way `tenants.phone_number` is cleared so the LiveKit webhook stops resolving calls to the churned tenant. Before this cron, numbers were never released on churn — canceled US/CA tenants cost Twilio rent forever and canceled SG tenants permanently consumed finite `phone_inventory` rows.

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

**BillingWarningBanner** (`src/app/dashboard/BillingWarningBanner.js`): Amber banner for `past_due` subscriptions during the 3-day grace countdown. Once grace expires it switches to a **RED suspended variant** — "Payment failed — **your AI receptionist is paused** and is no longer answering calls" (the Python gate has stopped answering this tenant's calls). Links to `/api/billing/portal`. **Not dismissible** (2026-06-12 — it also used to hide entirely post-grace, expecting a middleware redirect that never existed, leaving past-grace tenants with NO warning).

**TrialCountdownBanner** (`src/app/dashboard/TrialCountdownBanner.js`): Blue (>3 days) or amber (<=3 days) trial countdown. **Not dismissible** (2026-06-12).

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

### `subscriptions` (Migration 010 + 017 + 068)

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

**Indexes**: `(tenant_id, is_current)`, `(stripe_subscription_id)`, **`idx_subscriptions_one_current` — partial UNIQUE on `(tenant_id) WHERE is_current` (migration 068)**: at most ONE current row per tenant, enforcing what migration 038's header (DB-2) promised but never shipped. 068 first dedupes pre-existing duplicate current rows (keeps the most recently created, tiebreak on id).

**RLS**: SELECT-own for all roles (via tenants.owner_id — fixed in migration 021 to remove TO authenticated restriction), service_role ALL

### `stripe_webhook_events` (Migration 010 + 064 + 068)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `event_id` | text UNIQUE | Idempotency key |
| `event_type` | text | NOT NULL |
| `processed_at` | timestamptz | DEFAULT now() |
| `processed` | boolean | NOT NULL DEFAULT false — added by migration 064. Gates atomic idempotency: set to `true` only AFTER the handler succeeds. No backfill — existing rows stay `false` but are never retried. |
| `processing_started_at` | timestamptz | nullable — added by migration 068. Atomic processing claim: set on fresh insert; a duplicate delivery may only re-run after claiming via conditional UPDATE (`processed=false` AND claim NULL/stale >10min); reset to NULL on handler failure so the retry can re-claim immediately (see Idempotency D-09). |

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

### `stripe_meter_failures` (Migration 071, 2026-06-12)

Durable outbox for failed Stripe Billing Meter overage posts (written by the Python agent, drained by `/api/cron/retry-meter-events`).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | gen_random_uuid() |
| `tenant_id` | uuid FK | → tenants CASCADE |
| `call_id` | text | NOT NULL UNIQUE — outbox idempotency; agent upserts on it |
| `stripe_customer_id` | text | NOT NULL — routing for the meter re-post |
| `failure_reason` | text | nullable — last error message (truncated to 500 chars) |
| `attempts` | int | NOT NULL DEFAULT 0 — Sentry alert when it crosses 10 |
| `last_attempt_at` | timestamptz | nullable |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

**Index**: `idx_meter_failures_created` on `(created_at)`

**RLS**: Enabled with no policies + REVOKE ALL from anon/authenticated — service role only

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

- **Two line items per subscription**: Every subscription has a flat-rate price + metered overage price. The Checkout Session only includes the flat-rate item — the metered overage item is added post-checkout by the webhook handler (and verify-checkout fallback) using a Stripe idempotency key (`add_overage_{subscription_id}`) to prevent duplicate items from concurrent processing. Annual subscriptions must be created in **flexible billing mode** (`subscription_data.billing_mode = { type: 'flexible' }`, both checkout routes) or the monthly-interval overage attach is rejected. Attach failures are now reported via `Sentry.captureMessage` (no longer silent).

- **Billing Meters (not legacy usage_records)**: The old `POST /v1/subscription_items/{id}/usage_records` endpoint (`subscription_items.create_usage_record` in the SDK) was removed in Stripe API version `2025-03-31.basil`. The new `stripe.billing.meterEvents.create()` (JS) / `stripe.billing.meter_events.create()` (Python) uses customer_id + event_name, not subscription item ID. Prod-readiness 2026-06 caught that the Python agent was still calling the removed endpoint — it failed silently on Basil, so overage went unbilled until the Python path was migrated to the Meters API.

- **Atomic webhook idempotency via processing claim (migrations 064 + 068, hardened 2026-06-12)**: The webhook treats neither "row inserted" nor "row exists" as "event handled." A fresh insert claims the event (`processing_started_at`); duplicates must win a conditional claim UPDATE (`processed=false` AND claim NULL/stale >10min) before re-running, so a mid-flight first delivery can never be run concurrently (the 064-era fall-through allowed double Twilio number purchases). A duplicate that FAILS to claim checks `processed`: true → 200, false → 500 so Stripe keeps retrying (the old unconditional 200 permanently lost events whose first delivery died un-gracefully). Handler failure releases the claim so the retry re-claims immediately; `processed=true` is flipped only on success. See Idempotency (D-09).

- **API version pinned to Basil**: `src/lib/stripe.js` pins `apiVersion: '2025-06-30.basil'` (bumped from `2025-03-31.basil` in 2026-06-12 to enable flexible billing mode) so SDK upgrades can't silently shift field shapes. Basil moved `current_period_start/_end` onto the subscription item and `invoice.subscription` under `invoice.parent.subscription_details` — the webhook + verify-checkout read both with `?? <pre-Basil location>` fallbacks. Note: `ui_mode: 'embedded'` is the valid embedded-checkout enum on every Basil release; `'embedded_page'` is dahlia-only and rejected under this pin.

- **One meter, three prices**: All three plans share the `voco_calls` Billing Meter. Stripe resolves the per-unit rate from whichever overage price is on the customer's subscription.

- **`overage_stripe_item_id` stored but not required for reporting**: The column exists for reference/auditing. The Billing Meters API routes via customer_id, not subscription item ID.

- **History table pattern for subscriptions (068 reorder)**: All of the tenant's current rows are unmarked FIRST (by tenant_id), then the new row is inserted with `is_current=true` — the order and the unmark scope are both dictated by the `idx_subscriptions_one_current` partial unique index and the cancel→re-subscribe duplicate-current bug. The brief zero-current window is safe: the gate fails open and readers use `order + limit 1`.

- **One `is_current` row per tenant, DB-enforced (migration 068)**: `idx_subscriptions_one_current` (partial UNIQUE on `tenant_id WHERE is_current`) makes duplicate current rows impossible; the webhook throws on a 23505 so Stripe retries and the sync converges.

- **Double-subscription guard on both checkout routes (409)**: Neither checkout-session route will create a session while the tenant has a live (`active`/`trialing`/`past_due`) current subscription — the billing route's 409 directs users to the Stripe Billing Portal for plan changes.

- **Out-of-order protection via `event.created`**: Webhook events can arrive out of order. The event envelope's `event.created` is compared (`Date.parse`) against the tenant's current row's `stripe_updated_at` — older events are skipped. (The old `subscription.updated`-based read was dead code; that field doesn't exist on the Subscription object.)

- **`calls_used` carried forward only within the same subscription**: On sync, `calls_used` is copied from the prior row only when its `stripe_subscription_id` matches (plan changes keep the id). A replacement subscription (new id after cancel→re-subscribe) starts a fresh cycle at 0.

- **`calls_used` resets on `invoice.paid` with `billing_reason: 'subscription_cycle'`**: Only fires on billing cycle renewal (not first invoice or metered invoices). The handler throws when the reset matches 0 rows (racing the unmark→insert window) so Stripe retries instead of silently losing the reset.

- **Subscription gate fails open**: If the subscription query fails, calls are allowed through. Revenue > correctness for edge cases.

- **Over-quota calls never blocked**: The subscription gate does NOT check usage — overage billing handles over-quota calls automatically.

- **past_due gets 3-day grace period, then calls are BLOCKED (2026-06-12)**: During the grace, calls continue and BillingWarningBanner shows a countdown (anchored to `current_period_end + 3 days`, not `stripe_updated_at`), with SMS + email sent with portal URL. After the grace expires, the Python agent's shared `subscription_gate.py` stops answering the tenant's calls and the banner switches to the red non-dismissible "AI receptionist is paused" variant. Uses `current_period_end` because it's stable during `past_due` — `stripe_updated_at` advances on every subscription update event, which would incorrectly extend the grace window.

- **Meter failures go to a durable outbox (migration 071)**: A failed Stripe meter post writes `stripe_meter_failures` (upsert on `call_id`) instead of being dropped; `/api/cron/retry-meter-events` re-posts with the idempotent `overage_{call_id}` identifier every 6h, deletes on success, and Sentry-alerts after 10 attempts.

- **Churned tenants' numbers are released after 30 days**: `/api/cron/release-churned-numbers` (daily 04:00) frees numbers of tenants whose current subscription has been `canceled` >30 days — SG back to `phone_inventory`, US/CA released at Twilio; `tenants.phone_number` cleared. Reactivating within 30 days keeps the number.

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
- **Voice call post-call pipeline (sole overage-reporting path)**: See `voice-call-architecture` skill for how the Python agent (`livekit-agent/src/post_call.py`, separate Railway repo) calls `increment_calls_used` and reports Stripe meter events via `stripe.billing.meter_events.create` (`event_name='voco_calls'`, `identifier=overage_{call_id}`). The Next.js side only creates the overage subscription item at onboarding; it never reports usage.
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

---
type: system
system: Billing
status: legacy-app
description: "Stripe Webhook Handler. Covers: Event Types Handled; Idempotency (D-09) — atomic 'processing claim' pattern (migrations 064 + 068); Out-of-Order Protection (D-10); Basil Field Moves (introduced in `2025-03-31.basil`, still apply under the current `2025-06-30.basil` pin); History Table Pattern (D-13,"
source: .claude/skills/payment-architecture/SKILL.md § 3. Stripe Webhook Handler
migrated: 2026-11-23
verified:
tags: [voco/system/billing]
---

# Stripe Webhook Handler

Part of [[Billing]]. Migrated verbatim from the `payment-architecture` skill; check `verified` before trusting details.

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

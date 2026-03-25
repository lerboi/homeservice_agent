# Architecture: Stripe Billing Integration

**Domain:** Subscription billing, usage metering, and plan enforcement in existing Next.js 15 + Supabase + Retell platform
**Researched:** 2026-03-26
**Confidence:** HIGH (direct codebase audit + verified against Stripe official docs)

---

## Integration Philosophy: Additive Wiring, Not Structural Change

The existing platform has a stable, proven architecture. Stripe billing plugs into it at four defined seams:

1. **Lifecycle management** — Stripe webhooks sync subscription state into Supabase
2. **Usage metering** — Retell `call_ended` / `call_analyzed` events increment a call counter in Postgres (not Stripe Billing Meters — see rationale below)
3. **Enforcement gate** — `handleInbound` checks subscription status before returning `dynamic_variables`; if blocked, returns `booking_enabled: 'false'` and a paywall message
4. **Billing UI** — A new `/dashboard/more/billing` page under the existing More hub

No new infrastructure services. No Redis. No job queues. No separate billing microservice. All billing logic runs in Next.js API routes + Supabase.

---

## System Overview

```
EXISTING ARCHITECTURE (unchanged components shown with ✓)
=========================================================

Stripe Dashboard
    |
    | Products / Prices / Customer Portal config
    |
    v
[/api/stripe/webhook] ─────────────── NEW ENDPOINT
    |
    | Subscription lifecycle events
    | (created, updated, deleted, invoice.paid, trial_will_end, payment_failed)
    v
[subscriptions table] ────────────── NEW TABLE (Supabase)
    |
    | stripe_customer_id, stripe_subscription_id,
    | status, plan_id, calls_limit, calls_used,
    | trial_ends_at, current_period_end
    |
    +── FK → tenants.id (one-to-one)
    |
    v
[ENFORCEMENT GATE] ─────────────── MODIFY handleInbound()
    |
    | Check: subscriptions.status IN ('active', 'trialing')
    | Check: subscriptions.calls_used < subscriptions.calls_limit
    |
    | PASS → existing slot calculation, return dynamic_variables with booking_enabled: 'true'
    | BLOCK → return dynamic_variables with booking_enabled: 'false', paywall_reason: '...'
    v
[Retell call_inbound webhook] ────────── ✓ EXISTING (gate added here)
    |
    v
[WebSocket LLM Server] ─────────────── ✓ EXISTING (unchanged)
    |
    v
[call_ended webhook] ───────────────── ✓ EXISTING
    |
    +── INCREMENT calls_used ─────── MODIFY processCallEnded()
    v
[call_analyzed webhook] ────────────── ✓ EXISTING
    |
    v
[triage + lead creation + notifications] ── ✓ EXISTING (unchanged)

BILLING UI
==========

/dashboard/more/billing ──────────── NEW PAGE
    |
    | Reads: subscriptions table (current plan, usage, trial status)
    | Reads: usage_events table (per-billing-period call history)
    |
    | Server Action: createCheckoutSession() → Stripe Checkout URL
    | Server Action: createPortalSession() → Stripe Customer Portal URL
    |
    v
/api/stripe/checkout ─────────────── NEW ENDPOINT
/api/stripe/portal ───────────────── NEW ENDPOINT

TRIAL AUTO-START
================

/api/onboarding/complete (existing) ─── MODIFY
    |
    | After marking onboarding_complete = true:
    | → Create Stripe customer
    | → Create 14-day trial subscription (no payment method)
    | → Insert subscriptions row (status='trialing')
    |
    v
[subscriptions table] ← trial_ends_at = now() + 14 days
```

---

## Component-by-Component Integration Plan

### 1. Stripe Webhook Handler (`/api/stripe/webhook`) — NEW ENDPOINT

**Location:** `src/app/api/stripe/webhook/route.js`

**Purpose:** Receive Stripe lifecycle events and keep `subscriptions` table in sync. This is the single source of truth update path — all subscription state changes flow through here.

**Events handled:**

| Stripe Event | Action |
|---|---|
| `checkout.session.completed` | Extract `tenant_id` from session metadata; upsert `subscriptions` row with `stripe_subscription_id`, `stripe_customer_id`, plan details, `status: 'active'` |
| `customer.subscription.created` | Upsert subscription with status, `current_period_end`, `trial_end` |
| `customer.subscription.updated` | Update status, plan_id, `current_period_end`, `cancel_at_period_end`; handle plan upgrade/downgrade (update `calls_limit` from plan config) |
| `customer.subscription.deleted` | Set `status: 'canceled'`; set `canceled_at` timestamp |
| `invoice.paid` | Set `status: 'active'`, reset `calls_used = 0`, update `current_period_end` from invoice period |
| `invoice.payment_failed` | Set `status: 'past_due'`; trigger email to owner via Resend (reuse existing email client) |
| `customer.subscription.trial_will_end` | Send "trial ending in 3 days" email to owner with upgrade CTA |

**Critical pattern — webhook verification:**

```javascript
// MUST use raw body, not parsed JSON, for signature verification
const rawBody = await request.text();
const signature = request.headers.get('stripe-signature');
const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
```

This is the same pattern already used for Retell webhooks in the existing codebase — consistent approach.

**Idempotency:** Upsert on `stripe_subscription_id` as the conflict key. Stripe may deliver the same event multiple times; upsert is safe for all subscription state updates. For `calls_used` reset (on `invoice.paid`), only reset if `current_period_start` from the event is newer than the stored value — prevents double-reset on retry.

**RLS bypass:** Use `supabase` (service role) client, same as all other webhook handlers. Service role bypasses RLS, which is correct — webhooks act on behalf of Stripe, not an authenticated user.

---

### 2. Subscriptions Table — NEW DATABASE TABLE

**Location:** `supabase/migrations/010_billing.sql`

**Schema:**

```sql
CREATE TABLE subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id      text UNIQUE NOT NULL,
  stripe_subscription_id  text UNIQUE,
  status                  text NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'paused', 'incomplete')),
  plan_id                 text,
  calls_limit             int NOT NULL DEFAULT 300,
  calls_used              int NOT NULL DEFAULT 0,
  trial_ends_at           timestamptz,
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean NOT NULL DEFAULT false,
  canceled_at             timestamptz,
  stripe_price_id         text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- RLS: owner reads own subscription
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_read_own" ON subscriptions
  FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "subscriptions_update_own" ON subscriptions
  FOR UPDATE
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_subscriptions" ON subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- Index for enforcement gate (called on every inbound call)
CREATE INDEX idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
```

**`calls_limit` by plan:**

| Plan | `calls_limit` | Monthly Price |
|---|---|---|
| Starter | 100 | $49 |
| Growth | 300 | $99 |
| Pro | 1000 | $199 |
| Enterprise | -1 (unlimited) | Custom |

These are set by the webhook handler when a plan is created/updated based on the `stripe_price_id` lookup in a plan config map.

**`calls_used` reset cycle:** Reset to 0 on `invoice.paid` event (every billing period). Combined with `current_period_start` to avoid double-reset.

**Usage events table** (separate from `subscriptions` for detailed per-period audit trail):

```sql
CREATE TABLE usage_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_id     uuid REFERENCES calls(id) ON DELETE SET NULL,
  event_type  text NOT NULL DEFAULT 'call_answered',
  period_start timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_events_read_own" ON usage_events
  FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));
CREATE POLICY "service_role_all_usage" ON usage_events
  FOR ALL USING (auth.role() = 'service_role');
CREATE INDEX idx_usage_tenant_period ON usage_events(tenant_id, period_start DESC);
```

The `usage_events` table powers the billing dashboard's call history display and allows usage reconciliation without querying Stripe's API on every page load.

---

### 3. Enforcement Gate — MODIFY `handleInbound()`

**Location:** `src/app/api/webhooks/retell/route.js` (existing file, `handleInbound` function)

**Current state:** `handleInbound` queries tenants + scheduling data in parallel, returns `dynamic_variables`. No subscription check.

**What changes:**

Add a subscription check to the parallel Supabase queries already running in `handleInbound`. This is the correct injection point because `handleInbound` already does tenant resolution and already has the gate that returns `booking_enabled: 'false'` for no-tenant or no-slot scenarios.

```javascript
// Add to the parallel queries in handleInbound:
const [appointmentsResult, eventsResult, zonesResult, buffersResult, subscriptionResult] = await Promise.all([
  // ... existing queries unchanged ...
  supabase
    .from('subscriptions')
    .select('status, calls_limit, calls_used, trial_ends_at, cancel_at_period_end')
    .eq('tenant_id', tenant.id)
    .single(),
]);
```

**Gate logic (after tenant lookup, before slot calculation):**

```javascript
const sub = subscriptionResult.data;
const now = new Date();

// ALLOW: active subscription within limits
const isActive = sub?.status === 'active' || sub?.status === 'trialing';
const withinTrial = sub?.status === 'trialing' && sub?.trial_ends_at && new Date(sub.trial_ends_at) > now;
const withinLimit = sub?.calls_limit === -1 || (sub?.calls_used ?? 0) < (sub?.calls_limit ?? 0);
const subscriptionAllowed = (isActive || withinTrial) && withinLimit;

// BLOCK: return paywall response
if (!subscriptionAllowed) {
  const reason = !isActive && !withinTrial
    ? 'subscription_expired'
    : 'call_limit_reached';
  return Response.json({
    dynamic_variables: {
      business_name: tenant.business_name || 'Voco',
      default_locale: tenant.default_locale || 'en',
      onboarding_complete: String(tenant.onboarding_complete ?? false),
      caller_number: from_number || '',
      booking_enabled: 'false',
      paywall_reason: reason,
      // Provide a graceful message the AI can speak to the caller
      available_slots: 'No slots available at this time',
    },
  });
}
```

**Grace period for `past_due`:** Allow calls for 3 days after `past_due` transitions (Stripe retries payment automatically; most recover). Set a `past_due_grace_end` computed from `updated_at` in the subscriptions table. This prevents blocking legitimate customers during transient payment failures.

**Performance consideration:** The subscription check is a single indexed query (`tenant_id` is the PK on subscriptions, unique). It runs in parallel with the 4 existing queries. Net additional latency: ~0ms (parallel). No caching needed at current scale.

---

### 4. Usage Metering — MODIFY `processCallEnded()`

**Location:** `src/lib/call-processor.js` (existing file, `processCallEnded` function)

**Why `call_ended` (not `call_analyzed`):** `call_ended` fires immediately when the call disconnects, before recording processing. Metering at `call_ended` means a call is counted as soon as it is answered, preventing circumvention by hanging up before analysis. `call_analyzed` fires later and is not guaranteed (analysis can fail/timeout).

**Why Postgres counter (not Stripe Billing Meters):** The PROJECT.md specifies "per-call usage tracking" and "plan limit enforcement." Stripe Billing Meters are designed for pay-as-you-go overage invoicing (billing customers per-call beyond a limit). The plan here is flat-rate subscriptions with per-call caps, not per-call overage billing. Storing `calls_used` in Postgres keeps the enforcement gate simple (one indexed query) and avoids Stripe API calls on every inbound call.

**What changes:**

```javascript
// In processCallEnded, after the call upsert succeeds:
// Increment calls_used for the tenant
if (tenantId) {
  await supabase.rpc('increment_calls_used', { p_tenant_id: tenantId });

  // Also log to usage_events for audit trail
  await supabase.from('usage_events').insert({
    tenant_id: tenantId,
    call_id: callRecord?.id || null,
    event_type: 'call_answered',
    period_start: periodStart, // from subscriptions.current_period_start
  });
}
```

**Postgres RPC for atomic increment:**

```sql
-- In migration 010_billing.sql
CREATE OR REPLACE FUNCTION increment_calls_used(p_tenant_id uuid)
RETURNS void AS $$
  UPDATE subscriptions
  SET calls_used = calls_used + 1,
      updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND status IN ('active', 'trialing', 'past_due');
$$ LANGUAGE sql;
```

Using `supabase.rpc()` for the increment ensures the counter is updated atomically — concurrent calls from the same tenant cannot corrupt the counter.

**Test calls excluded:** The existing test call check (`isTestCall` from metadata) should also gate the increment. Test calls during onboarding must not consume the usage counter.

---

### 5. Trial Auto-Start — MODIFY `/api/onboarding/complete`

**Location:** `src/app/api/onboarding/complete/route.js`

**Current state:** Marks `onboarding_complete = true` on the tenant. Does nothing else.

**What changes:** After marking onboarding complete, create the Stripe customer and trial subscription:

```javascript
// After tenants.update({ onboarding_complete: true }):
const stripe = getStripeClient();

// Create or retrieve Stripe customer
const customer = await stripe.customers.create({
  email: tenant.owner_email,
  name: tenant.business_name,
  metadata: { tenant_id: tenantId },
});

// Create 14-day trial subscription (no payment method required)
const subscription = await stripe.subscriptions.create({
  customer: customer.id,
  items: [{ price: process.env.STRIPE_GROWTH_PRICE_ID }],
  trial_period_days: 14,
  trial_settings: {
    end_behavior: {
      missing_payment_method: 'cancel', // subscription cancels if no card added before trial ends
    },
  },
  payment_settings: {
    save_default_payment_method: 'on_subscription',
  },
  expand: ['latest_invoice.payment_intent'],
  metadata: { tenant_id: tenantId },
});

// Write to subscriptions table (webhook will also arrive, upsert is idempotent)
await supabase.from('subscriptions').upsert({
  tenant_id: tenantId,
  stripe_customer_id: customer.id,
  stripe_subscription_id: subscription.id,
  stripe_price_id: subscription.items.data[0].price.id,
  status: 'trialing',
  plan_id: 'growth',
  calls_limit: 300,
  calls_used: 0,
  trial_ends_at: new Date(subscription.trial_end * 1000).toISOString(),
  current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
  current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
}, { onConflict: 'tenant_id' });
```

**Why write to DB here AND rely on webhook:** The webhook arrives async (seconds later). Writing immediately ensures the enforcement gate has subscription data as soon as the user finishes onboarding — no race condition where a call comes in before the webhook arrives.

---

### 6. Checkout Session Endpoint — NEW ENDPOINT

**Location:** `src/app/api/stripe/checkout/route.js`

**Purpose:** Create a Stripe Checkout Session when a user wants to subscribe (trial-to-paid conversion) or upgrade their plan.

**Flow:**

```
POST /api/stripe/checkout
  Body: { priceId, successUrl, cancelUrl }
  Auth: getTenantId() (uses existing auth pattern)

1. getTenantId() → tenantId
2. Look up subscriptions.stripe_customer_id for this tenant
3. stripe.checkout.sessions.create({
     customer: stripe_customer_id,
     line_items: [{ price: priceId, quantity: 1 }],
     mode: 'subscription',
     success_url: successUrl + '?session_id={CHECKOUT_SESSION_ID}',
     cancel_url: cancelUrl,
     metadata: { tenant_id: tenantId },
   })
4. Return { url: session.url }
```

The client redirects to `session.url`. Stripe handles payment. On success, Stripe fires `checkout.session.completed` → webhook updates subscriptions table → billing page reflects new plan.

---

### 7. Customer Portal Endpoint — NEW ENDPOINT

**Location:** `src/app/api/stripe/portal/route.js`

**Purpose:** Redirect user to Stripe-hosted portal for plan management (upgrade, downgrade, cancel, update payment method, view invoices).

```
POST /api/stripe/portal
  Body: { returnUrl }

1. getTenantId() → tenantId
2. Look up subscriptions.stripe_customer_id
3. stripe.billingPortal.sessions.create({
     customer: stripe_customer_id,
     return_url: returnUrl,
   })
4. Return { url: session.url }
```

This is the only endpoint needed for all self-service billing actions. Stripe's portal handles the UI.

---

### 8. Billing Dashboard Page — NEW DASHBOARD PAGE

**Location:** `src/app/dashboard/more/billing/page.js`

**Integration point:** Placed under the existing More hub at `/dashboard/more/billing`. Requires adding a "Billing" entry to `MORE_ITEMS` in `src/app/dashboard/more/page.js` with the CreditCard icon from lucide-react.

**Page structure:**

```
/dashboard/more/billing
├── PlanStatusCard
│   ├── Current plan name (Starter / Growth / Pro)
│   ├── Status badge (Active | Trialing | Past Due | Canceled)
│   ├── Trial countdown if status='trialing' ("8 days remaining")
│   └── Billing period (resets on [date])
│
├── UsageMeterCard
│   ├── Progress bar: calls_used / calls_limit
│   ├── "X of Y calls used this period"
│   └── Warning at 80%+ usage
│
├── InvoiceHistorySection (optional v1 — can defer to portal)
│   └── "Manage invoices in the billing portal →"
│
├── UpgradeSection (shown if trialing or on lower plan)
│   └── Plan comparison cards with "Upgrade" CTA
│
└── ManageBillingButton
    └── Calls /api/stripe/portal → redirects to Customer Portal
```

**Data fetching:** The billing page reads from the `subscriptions` table directly via Supabase client (same RLS pattern as every other dashboard page). The `usage_events` table provides the per-period breakdown if needed.

**Trial banner (dashboard-wide, not just billing page):** A dismissible banner in `DashboardLayout` that shows "X days left in your free trial" when `status = 'trialing'` and `trial_ends_at` is within 7 days. Disappears when subscription is active. This requires reading subscription status in the layout component.

---

## Data Flow: Stripe Billing Lifecycle

```
1. ONBOARDING COMPLETE
   /api/onboarding/complete
   → stripe.customers.create({ metadata: { tenant_id } })
   → stripe.subscriptions.create({ trial_period_days: 14, missing_payment_method: 'cancel' })
   → INSERT INTO subscriptions (status: 'trialing', trial_ends_at: +14d)
   → Stripe fires customer.subscription.created → webhook upserts (idempotent)

2. TRIAL ACTIVE (days 1-14)
   Every inbound call:
   → handleInbound queries subscriptions
   → Gate: status='trialing' AND trial_ends_at > now() → ALLOW
   → processCallEnded increments calls_used

   Day 11 (3 days before trial end):
   → Stripe fires customer.subscription.trial_will_end
   → Webhook sends upgrade email to owner via Resend

3. TRIAL-TO-PAID CONVERSION
   Owner clicks "Start Subscription" in billing page:
   → POST /api/stripe/checkout → session URL
   → Owner enters card in Stripe Checkout
   → Stripe fires checkout.session.completed, customer.subscription.updated
   → Webhook updates status: 'active', trial_ends_at: null

4. TRIAL EXPIRES (no card added)
   → Stripe fires customer.subscription.deleted (end_behavior: 'cancel')
   → Webhook sets status: 'canceled'
   → Next inbound call: gate blocks, returns booking_enabled: 'false', paywall_reason: 'subscription_expired'
   → AI says: "Sorry, I'm unable to take bookings right now. Please contact [business] directly."

5. BILLING CYCLE (monthly)
   Stripe charges card:
   → Payment succeeds → invoice.paid → webhook resets calls_used = 0, updates current_period_end
   → Payment fails → invoice.payment_failed → webhook sets status: 'past_due', sends payment failure email

   3-day grace on past_due:
   → Gate allows calls for 3 days (Stripe retries automatically)
   → If payment never recovers → customer.subscription.deleted → gate blocks

6. PLAN MANAGEMENT (self-service)
   Owner clicks "Manage Billing" in billing page:
   → POST /api/stripe/portal → Customer Portal URL
   → Owner upgrades/downgrades/cancels in Stripe's UI
   → Stripe fires customer.subscription.updated (plan change or cancel_at_period_end)
   → Webhook updates plan_id, calls_limit, cancel_at_period_end

7. OVERAGE HANDLING
   calls_used reaches calls_limit mid-period:
   → Gate blocks new calls with paywall_reason: 'call_limit_reached'
   → AI: "I'm unable to take new bookings right now. Please call back or visit [link]."
   → Billing page shows "Upgrade your plan to continue receiving calls"
   → Owner upgrades → webhook updates calls_limit → gate unblocks immediately
```

---

## Component Boundaries

| Component | Responsibility | Reads From | Writes To |
|---|---|---|---|
| `/api/stripe/webhook` | Sync Stripe events to DB | Stripe events | `subscriptions` table |
| `handleInbound` (modified) | Enforce subscription gate per call | `subscriptions` table | — |
| `processCallEnded` (modified) | Increment usage counter | `subscriptions` table | `subscriptions.calls_used`, `usage_events` |
| `/api/onboarding/complete` (modified) | Create Stripe customer + trial | Stripe API | `subscriptions` table |
| `/api/stripe/checkout` | Create checkout session | `subscriptions` table | Stripe API |
| `/api/stripe/portal` | Create portal session | `subscriptions` table | Stripe API |
| `/dashboard/more/billing` | Display plan, usage, invoke actions | `subscriptions` table, `usage_events` | — (read-only page) |
| `DashboardLayout` (modified) | Show trial countdown banner | `subscriptions` table | — |

---

## New vs. Modified Components

### New Files

| File | Type | Purpose |
|---|---|---|
| `src/app/api/stripe/webhook/route.js` | NEW | Stripe lifecycle event handler |
| `src/app/api/stripe/checkout/route.js` | NEW | Create Stripe Checkout Session |
| `src/app/api/stripe/portal/route.js` | NEW | Create Stripe Customer Portal session |
| `src/app/dashboard/more/billing/page.js` | NEW | Billing dashboard UI |
| `src/lib/stripe.js` | NEW | Lazy-instantiated Stripe client (mirrors pattern in notifications.js for Twilio/Resend) |
| `src/lib/billing.js` | NEW | Business logic: plan config map, gate check helper, trial helpers |
| `supabase/migrations/010_billing.sql` | NEW | `subscriptions` table, `usage_events` table, `increment_calls_used` RPC |

### Modified Files

| File | Change Scope | What Changes |
|---|---|---|
| `src/app/api/webhooks/retell/route.js` | MINOR | Add subscription gate query + block logic to `handleInbound` |
| `src/lib/call-processor.js` | MINOR | Add `increment_calls_used` RPC call in `processCallEnded`; skip for test calls |
| `src/app/api/onboarding/complete/route.js` | MODERATE | Create Stripe customer + trial subscription after marking onboarding complete |
| `src/app/dashboard/more/page.js` | MINOR | Add "Billing" item to `MORE_ITEMS` list |
| `src/app/dashboard/layout.js` | MODERATE | Add trial countdown banner component (reads subscription status server-side) |

### Unchanged Files (explicitly confirmed)

| File | Why Unchanged |
|---|---|
| `src/server/retell-llm-ws.js` | WebSocket server handles live call conversation; billing enforcement is pre-call (at `call_inbound`), not mid-call |
| `src/lib/triage/classifier.js` | Billing doesn't affect call classification |
| `src/lib/notifications.js` | No notification changes (billing emails handled in webhook handler inline) |
| `src/lib/scheduling/booking.js` | `atomicBookSlot` is unaffected; enforcement happens before the AI reaches booking |
| All other dashboard pages | Read-only views; no billing data flows through them |

---

## Architectural Patterns

### Pattern 1: Sync-to-Postgres (not Stripe API on hot paths)

**What:** Stripe webhook events update the `subscriptions` table. All enforcement and UI reads from Postgres, never from Stripe's API.

**Why:** The Retell `call_inbound` webhook fires on every incoming call. Reading from Stripe's API here would add 200-400ms latency and create a Stripe API rate limit dependency on the critical call pickup path. Postgres reads are sub-5ms.

**Trade-off:** There is a brief window (seconds) between a Stripe event and the webhook being processed where the local state could be stale. Acceptable — subscription state changes happen on human timescales (minutes to hours), not call timescales (milliseconds).

### Pattern 2: Enforcement at the First Gate (call_inbound)

**What:** Block calls at `handleInbound` before any processing, slot calculation, or AI conversation starts.

**Why:** If enforcement runs at `call_analyzed` (post-call), the AI has already had a full conversation and potentially booked a slot. Blocking at `call_inbound` returns `booking_enabled: 'false'` to Retell, which the AI prompt already handles gracefully ("I'm unable to take bookings right now").

**Implementation note:** The existing `dynamic_variables` schema already has a `booking_enabled` field used by the AI. The gate just changes its value from `'true'` to `'false'` and adds a `paywall_reason` variable. No AI prompt changes needed if the prompt already handles `booking_enabled: 'false'`.

### Pattern 3: Trial Without Credit Card (end_behavior: cancel)

**What:** 14-day trial created at onboarding with `payment_method_collection: 'if_required'` and `trial_settings.end_behavior.missing_payment_method: 'cancel'`.

**Why:** No-friction onboarding maximizes trial starts. When the trial expires without a card, Stripe fires `customer.subscription.deleted`, the gate blocks calls, and the owner sees a clear upgrade prompt in the dashboard. Stripe's "pause" alternative is overly lenient and can confuse owners about whether they're actually subscribed.

**Source:** Confirmed in official Stripe docs: https://docs.stripe.com/payments/checkout/free-trials

### Pattern 4: Atomic Usage Counter (Postgres RPC)

**What:** `calls_used` is incremented via a Postgres `UPDATE` with `calls_used = calls_used + 1` wrapped in a named RPC function.

**Why:** Multiple concurrent calls from the same tenant's number are possible (call forwarding, parallel lines). A naive `SELECT ... INSERT` pattern would lose increments. The Postgres UPDATE is atomic — concurrent increments do not corrupt the counter.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Blocking Mid-Call (at call_analyzed)

**What people do:** Check subscription at `call_analyzed` and refuse to process the lead if subscription is expired.

**Why it's wrong:** The AI has already spoken to the caller, potentially booked a slot, and the caller has hung up. Refusing to create the lead record at this point produces a ghost booking (slot is taken in DB but no lead record). The caller has been promised confirmation that will never arrive.

**Do this instead:** Block at `call_inbound`. The AI gets `booking_enabled: 'false'` before the conversation starts and can tell the caller gracefully.

### Anti-Pattern 2: Calling Stripe API in the Hot Path

**What people do:** In `handleInbound`, call `stripe.subscriptions.retrieve(subscriptionId)` to check subscription status.

**Why it's wrong:** Adds 200-400ms to every inbound call webhook. Stripe API calls can fail or be rate-limited. The `call_inbound` response must be fast — Retell uses it to configure the call before pickup.

**Do this instead:** Read `subscriptions` table in Postgres. Keep it current via webhook sync.

### Anti-Pattern 3: Using Stripe Billing Meters for Call Enforcement

**What people do:** Report a `billing_meter_event` to Stripe on every call and rely on Stripe to enforce limits.

**Why it's wrong:** Stripe Billing Meters are designed for pay-per-use invoicing (charge per API call beyond a base fee). The enforcement model here is "flat rate + hard cap at N calls." Stripe does not provide real-time hard-blocking via meters — it bills after the fact. The enforcement gate must be in the application layer.

**Do this instead:** Store `calls_used` counter in Postgres. Reset it on `invoice.paid`. Check it in `handleInbound`.

### Anti-Pattern 4: Separate Billing Microservice

**What people do:** Create a dedicated "billing service" with its own API and database for subscription management.

**Why it's wrong:** Adds a new service to maintain, deploy, and monitor. The billing data model is three tables (`subscriptions`, `usage_events`, and the Stripe webhook handler). This fits cleanly into the existing Next.js + Supabase architecture.

**Do this instead:** Keep billing logic in the monolith. Create `src/lib/billing.js` for business logic helpers. API routes at `/api/stripe/*` follow the same pattern as existing `/api/leads`, `/api/appointments` routes.

### Anti-Pattern 5: Writing Duplicate Billing Emails Outside the Webhook

**What people do:** Add billing-specific email sends in `notifications.js` or in separate cron jobs.

**Why it's wrong:** The Stripe webhook is the authoritative source of truth for billing events. Billing emails (trial ending, payment failed, subscription canceled) belong in the webhook handler where the events are processed. Duplicating them elsewhere creates double-sends when Stripe retries events.

**Do this instead:** Send billing emails inline in the `/api/stripe/webhook` handler for each relevant event. Reuse the existing `getResendClient()` from `notifications.js`.

---

## Schema Impact Assessment

### New Tables

| Table | Rows at 50 tenants | Growth |
|---|---|---|
| `subscriptions` | 50 (one per tenant) | Linear with tenant count |
| `usage_events` | ~1,500/month (50 tenants × 30 calls/month avg) | Linear with call volume |

### Modified Tables

None. All billing changes are additive new tables.

### New Database Objects

| Object | Type | Purpose |
|---|---|---|
| `increment_calls_used` | Postgres RPC function | Atomic counter increment for concurrent safety |

---

## Build Order (Dependency-Driven)

```
Step 1: Database Migration (no dependencies)
  File: supabase/migrations/010_billing.sql
  Contents: subscriptions table, usage_events table, increment_calls_used RPC, RLS policies
  Why first: Everything else depends on this schema existing

Step 2: Stripe Client + Billing Helpers (no dependencies)
  Files: src/lib/stripe.js, src/lib/billing.js
  Contents: Lazy Stripe client, plan config map (plan_id → calls_limit), gate check helper
  Why second: All API routes and enforcement depend on this

Step 3: Stripe Webhook Handler (depends on Step 1 + 2)
  File: src/app/api/stripe/webhook/route.js
  Test with: Stripe CLI (stripe listen --forward-to localhost:3000/api/stripe/webhook)
  Why third: Must exist before any Stripe events can be processed

Step 4: Onboarding Complete Modification (depends on Step 1 + 2 + 3)
  File: src/app/api/onboarding/complete/route.js
  Changes: Create Stripe customer + trial subscription on onboarding complete
  Why fourth: Webhook (Step 3) must be running to process the subscription.created event this triggers

Step 5: Enforcement Gate (depends on Step 1)
  File: src/app/api/webhooks/retell/route.js (handleInbound)
  Changes: Add subscription query + block logic
  Why fifth: Gate reads from subscriptions table (Step 1); does not depend on Stripe API working
  Risk: LOW — if subscriptions table is empty (no row for tenant), gate defaults to ALLOW
        This prevents blocking existing users during deployment

Step 6: Usage Metering (depends on Step 1 + 2)
  File: src/lib/call-processor.js (processCallEnded)
  Changes: Add increment_calls_used RPC call, skip test calls
  Why sixth: Needs subscriptions table and RPC function from Step 1

Step 7: Checkout + Portal Endpoints (depends on Step 1 + 2)
  Files: src/app/api/stripe/checkout/route.js, src/app/api/stripe/portal/route.js
  Why seventh: Needed by billing UI; can be tested independently with Stripe test mode

Step 8: Billing Dashboard Page (depends on Steps 1, 7)
  Files: src/app/dashboard/more/billing/page.js
  Changes: Add Billing to MORE_ITEMS in more/page.js
  Why eighth: All data sources and endpoints must exist first

Step 9: Trial Countdown Banner (depends on Step 8)
  File: src/app/dashboard/layout.js
  Changes: Add server-side subscription status read + banner component
  Why ninth: Lowest priority — cosmetic; does not block any other feature
```

**Parallelizable steps:** Steps 2 and migration setup (Step 1) can run simultaneously. Steps 5 and 6 can be developed in parallel after Step 1 is done. Steps 7 and 8 can be developed in parallel after Step 2.

**Safe deployment order:** Steps 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Each step is independently deployable and does not break existing functionality if the next step hasn't been deployed yet.

---

## Scaling Considerations

| Scale | Billing Architecture |
|---|---|
| 1-100 tenants | Current architecture is correct. One `subscriptions` row per tenant. Postgres counter is fast. Webhook handler processes events synchronously. |
| 100-1,000 tenants | `usage_events` table grows to ~1M rows/year. Add index on `(tenant_id, created_at)`. Webhook handler may need to handle event bursts (Stripe retries) — add a `processed_event_ids` deduplication table. |
| 1,000+ tenants | Postgres `calls_used` counter under concurrent writes from heavy tenants. Switch to Postgres advisory locks or use Stripe Billing Meters for usage tracking (report events to Stripe, query Stripe for enforcement). Webhook processing may need a separate worker (pg-boss). |

---

## Integration Points with Existing Architecture

### External Services

| Service | New Integration | Impact on Existing |
|---|---|---|
| Stripe | New: Checkout, Customer Portal, Webhook, Subscriptions API | None — net new |
| Retell Webhook | Modified: `handleInbound` adds subscription gate | Adds one parallel Supabase query; no latency impact |
| Supabase | New tables: `subscriptions`, `usage_events`. New RPC: `increment_calls_used` | Additive; no existing table changes |
| Resend | Reuse existing `getResendClient()` in webhook handler for billing emails | No change to existing email flow |
| Twilio | No change | Unchanged |

### Internal Boundaries

| Boundary | Change |
|---|---|
| `handleInbound` → `subscriptions` | NEW: parallel query, gate check |
| `processCallEnded` → `subscriptions` | NEW: increment RPC call |
| `/api/onboarding/complete` → Stripe API | NEW: customer + subscription creation |
| `/dashboard/more/billing` → `subscriptions` | NEW: read-only data fetch |
| `DashboardLayout` → `subscriptions` | NEW: server-side status read for banner |

---

## Sources

- Stripe Billing Subscriptions docs: https://docs.stripe.com/billing/subscriptions/build-subscriptions — HIGH confidence
- Stripe Free Trials (no credit card): https://docs.stripe.com/payments/checkout/free-trials — HIGH confidence
- Stripe Billing Meters: https://docs.stripe.com/billing/subscriptions/usage-based/implementation-guide — HIGH confidence
- Stripe Customer Portal: https://docs.stripe.com/customer-management/integrate-customer-portal — HIGH confidence
- Supabase Stripe Integration guide: https://dev.to/flnzba/33-stripe-integration-guide-for-nextjs-15-with-supabase-13b5 — MEDIUM confidence
- Next.js Stripe Subscription Lifecycle (2026): https://dev.to/thekarlesi/stripe-subscription-lifecycle-in-nextjs-the-complete-developer-guide-2026-4l9d — MEDIUM confidence
- Direct codebase audit: `handleInbound`, `processCallEnded`, `getTenantId`, dashboard layout, migrations 001-009 — HIGH confidence

---

*Architecture research for: v3.0 Stripe Billing Integration*
*Researched: 2026-03-26*

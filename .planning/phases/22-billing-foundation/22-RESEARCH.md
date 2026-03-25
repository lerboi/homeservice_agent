# Phase 22: Billing Foundation - Research

**Researched:** 2026-03-26
**Domain:** Stripe subscription billing — products/prices, subscriptions table, webhook handler, trial auto-start
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Stripe Checkout happens AFTER the test call but BEFORE onboarding completes. Flow: Auth -> Profile -> Services -> Test Call (aha moment) -> Plan Selection -> Stripe Checkout (CC + trial) -> Celebration -> Dashboard. The test call is the conversion hook — user experiences the AI before entering payment.
- **D-02:** User selects their plan (Starter/Growth/Scale) on a plan selection screen shown after the test call, before being redirected to Stripe Checkout for that specific plan with 14-day trial.
- **D-03:** CC is required for the 14-day trial — `payment_method_collection: 'always'` on the Checkout Session.
- **D-04:** After Checkout success, user returns to a celebration/confirmation screen ("You're all set!") with trial countdown info, then auto-redirects to the dashboard. Onboarding completion is triggered server-side by the Checkout success flow.
- **D-05:** The existing CelebrationOverlay pattern from the test call step can be adapted for the post-Checkout celebration.
- **D-06:** Stripe webhook at `/api/stripe/webhook` follows the existing Retell webhook pattern: `request.text()` for raw body, `stripe.webhooks.constructEvent()` for signature verification, event routing via if/switch.
- **D-07:** Unknown/unhandled Stripe events are logged and return 200 (not rejected). Standard Stripe best practice — prevents unnecessary retries.
- **D-08:** Webhook processing is SYNCHRONOUS (inline before returning 200). Stripe has a 20-second timeout which is generous. Simpler error handling and idempotency than async. Does NOT use `after()` pattern.
- **D-09:** Idempotency enforced via `stripe_webhook_events` table with UNIQUE on `event_id`. Check before processing, insert after processing.
- **D-10:** Out-of-order protection via `stripe_updated_at` timestamp column — only apply event if its timestamp is newer than stored value.
- **D-11:** No legacy user handling needed — all existing users are manual test accounts that won't exist at deployment. No backfill migration required.
- **D-12:** Subscriptions table stores BOTH `stripe_price_id` (for Stripe reconciliation/debugging) AND a local `plan_id` enum (starter/growth/scale) for fast local queries and enforcement. Webhook handler maps price ID to local plan_id.
- **D-13:** Subscription history table design — every subscription event creates a new row (not upsert). A `status` column and `is_current` flag (or a view) identifies the active subscription. Enables plan change history and audit trail.
- **D-14:** Stripe statuses map to local enforcement: `trialing` = allow, `active` = allow, `past_due` = allow (3-day grace), `canceled` = block, `paused` = block, `incomplete` = block.

### Claude's Discretion

- Exact column naming and index design for the subscriptions/history tables
- Whether to use a view or `is_current` boolean for active subscription lookup
- Stripe Checkout Session configuration details beyond what's specified (success/cancel URLs, metadata)
- Migration file naming (010_billing_schema.sql following existing convention)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BILL-01 | Stripe products and prices created for Starter ($99/mo, 40 calls), Growth ($249/mo, 120 calls), Scale ($599/mo, 400 calls) with Price IDs stored in env vars | Pricing confirmed against live pricingData.js. Products/prices are Stripe Dashboard setup. Price IDs go into env vars. |
| BILL-02 | Subscriptions database table with tenant_id, stripe_customer_id, stripe_subscription_id, status, plan_id, calls_limit, calls_used, trial_ends_at, current_period_start/end, cancel_at_period_end — RLS: SELECT for authenticated, INSERT/UPDATE only via service_role | History-table pattern (D-13) — one row per event + is_current flag, active view. RLS write-protection pattern identified. |
| BILL-03 | Usage events table with call_id idempotency key (ON CONFLICT DO NOTHING) and stripe_webhook_events table with UNIQUE on event_id | Both table schemas designed. usage_events belongs to Phase 23 scope; stripe_webhook_events is Phase 22 (needed by webhook handler). |
| BILL-04 | Stripe webhook handler at /api/stripe/webhook with request.text() signature verification, idempotency check, and stripe_updated_at version protection for out-of-order events | Exact code pattern documented. Follows Retell webhook pattern already in codebase. Synchronous processing (no after()). |
| BILL-05 | All subscription lifecycle events synced to local DB (created, updated, deleted, paused, resumed, trial_will_end) | Full event map documented with action per event type. |
| BILL-06 | Trial auto-start at onboarding completion — creates Stripe customer + 14-day trial subscription with CC required, writes local subscriptions row synchronously | Onboarding flow requires new steps inserted between test-call and dashboard. Checkout Session config fully specified. |
</phase_requirements>

---

## Summary

Phase 22 builds the Stripe integration backbone that every subsequent billing phase depends on. It is an additive phase — no existing components are restructured, only new files and new steps added. The two hardest decisions are already locked by CONTEXT.md: synchronous webhook processing (no `after()`) and the history-table subscription model (one row per event, not upsert).

The most significant implementation complexity is in the onboarding flow modification (BILL-06). The existing flow goes: Test Call -> `/onboarding/complete` page -> dashboard. Phase 22 intercepts this at the test-call completion point and inserts two new wizard steps: a plan selection screen (`/onboarding/plan`) and a post-Checkout celebration screen (`/onboarding/checkout-success`). The `TestCallPanel`'s `onGoToDashboard` callback currently fires on test call completion and immediately goes to the dashboard. This must instead route to the plan selection screen. Onboarding completion (`onboarding_complete = true`) is no longer set by the test call webhook — it is set server-side after Checkout Session completion.

The database schema work is straightforward and directly analogous to the 9 existing migrations. The only unusual design choice is the write-protection RLS: the `subscriptions` table allows authenticated users to SELECT their own row but blocks INSERT/UPDATE for the authenticated role — only service_role can write. This prevents tenants from manipulating their own billing state.

**Primary recommendation:** Build in this order: (1) migration + table schema, (2) Stripe products/prices + env vars, (3) webhook handler with idempotency, (4) onboarding flow modifications + Checkout Session, (5) plan selection UI. The webhook handler must be built and deployed before the onboarding trial-start flow, because the webhook will fire when the Checkout Session completes.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `stripe` | 20.4.1 (latest) | Server-side Stripe API calls — subscription creation, Checkout Session, webhook verification | Official Node.js Stripe SDK. Server-only — never in client bundles. |
| `@stripe/stripe-js` | 8.11.0 (latest) | Client-side redirect to Stripe Checkout | Required for `redirectToCheckout`. Import via `@stripe/stripe-js/pure` to defer CDN load. |

**Version verification:** Confirmed against npm registry 2026-03-26.
- `stripe` npm: 20.4.1 published recently (training data referenced 17.x — current is 20.x)
- `@stripe/stripe-js` npm: 8.11.0

**Note on stripe package version:** The v3.0 milestone research (SUMMARY.md) referenced `stripe ^17.7.0`. The actual current npm version is 20.4.1. The API surface for subscriptions, Checkout Sessions, and webhooks is stable across these versions, but the planner must install the current version, not pin to 17.x.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` | existing | Service role client for webhook DB writes | Reuse existing `supabase` export from `src/lib/supabase.js` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| History table (one row per event) | Single-row upsert | History table is locked decision (D-13). Upsert is simpler but loses audit trail. |
| `is_current` boolean flag | View over history table | Both work; `is_current` is simpler for queries, view is cleaner schema. Claude's discretion per CONTEXT.md. |
| Synchronous webhook processing | `after()` async | Synchronous is locked decision (D-08). Simpler idempotency and error handling. |

**Installation (if stripe not yet in project):**
```bash
npm install stripe @stripe/stripe-js
```

---

## Architecture Patterns

### New Files Required

```
src/
├── app/
│   ├── api/
│   │   └── stripe/
│   │       ├── webhook/route.js         # BILL-04 — Stripe lifecycle webhook
│   │       └── checkout/route.js        # BILL-06 — Create Checkout Session
│   ├── onboarding/
│   │   ├── plan/page.js                 # BILL-06 — Plan selection (new wizard step)
│   │   └── checkout-success/page.js     # BILL-06 — Post-Checkout celebration
│   └── api/
│       └── onboarding/
│           └── checkout-session/route.js # BILL-06 — Server-side Checkout Session creation
└── lib/
    └── stripe.js                        # Stripe SDK singleton
supabase/
└── migrations/
    └── 010_billing_schema.sql           # BILL-02, BILL-03 (stripe_webhook_events)
```

### Files Modified

```
src/app/onboarding/test-call/page.js    # BILL-06 — onGoToDashboard → /onboarding/plan
src/middleware.js                        # BILL-06 — allow /onboarding/plan + /onboarding/checkout-success
```

---

### Pattern 1: Stripe Webhook Handler Structure

**What:** Follows the existing Retell webhook pattern in `src/app/api/webhooks/retell/route.js` exactly. `request.text()` for raw body (required for signature verification), `stripe.webhooks.constructEvent()` for verification, if/switch for event routing, synchronous processing, log+200 for unknown events.

**When to use:** All Stripe event processing. No `after()`.

```javascript
// Source: Stripe official docs + existing retell/route.js pattern
// src/app/api/stripe/webhook/route.js
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';  // service role client

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  const rawBody = await request.text();
  const sig = request.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed:', err.message);
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Idempotency check — D-09
  const { error: insertError } = await supabase
    .from('stripe_webhook_events')
    .insert({ event_id: event.id, event_type: event.type });

  if (insertError?.code === '23505') {
    // Already processed — return 200 without processing
    return Response.json({ received: true });
  }

  // Route events synchronously — D-08
  if (event.type === 'checkout.session.completed') {
    await handleCheckoutCompleted(event.data.object);
  } else if (event.type === 'customer.subscription.created') {
    await handleSubscriptionCreated(event.data.object);
  } else if (event.type === 'customer.subscription.updated') {
    await handleSubscriptionUpdated(event.data.object);
  } else if (event.type === 'customer.subscription.deleted') {
    await handleSubscriptionDeleted(event.data.object);
  } else if (event.type === 'invoice.paid') {
    await handleInvoicePaid(event.data.object);
  } else if (event.type === 'invoice.payment_failed') {
    await handleInvoicePaymentFailed(event.data.object);
  } else if (event.type === 'customer.subscription.trial_will_end') {
    await handleTrialWillEnd(event.data.object);
  } else {
    // D-07: Unknown events — log and return 200
    console.log('[stripe/webhook] Unhandled event type:', event.type);
  }

  return Response.json({ received: true });
}
```

### Pattern 2: Subscriptions History Table Schema

**What:** History table design (D-13). One row per subscription lifecycle event. `is_current` boolean flag marks the active row. Indexed on `(tenant_id, is_current)` for enforcement queries. Write-protection RLS: authenticated role can SELECT, only service_role can INSERT/UPDATE.

**Why history table over upsert:** Enables plan change audit trail. Enforcement reads the `is_current = true` row. When a subscription event arrives, the handler sets `is_current = false` on the prior row, then inserts a new row with `is_current = true`.

```sql
-- supabase/migrations/010_billing_schema.sql

-- Subscriptions history table (BILL-02)
CREATE TABLE subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id    text NOT NULL,
  stripe_subscription_id text NOT NULL,
  stripe_price_id       text,                          -- D-12: for reconciliation
  plan_id               text NOT NULL CHECK (plan_id IN ('starter', 'growth', 'scale')),
  status                text NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'paused', 'incomplete')),
  calls_limit           int NOT NULL,
  calls_used            int NOT NULL DEFAULT 0,
  trial_ends_at         timestamptz,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  cancel_at_period_end  boolean NOT NULL DEFAULT false,
  stripe_updated_at     timestamptz,                   -- D-10: out-of-order protection
  is_current            boolean NOT NULL DEFAULT true, -- D-13: active row marker
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Idempotency table for Stripe webhook events (BILL-03 / BILL-04)
CREATE TABLE stripe_webhook_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    text UNIQUE NOT NULL,                    -- D-09: UNIQUE enforces idempotency
  event_type  text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_subscriptions_tenant_current ON subscriptions(tenant_id, is_current);
CREATE INDEX idx_subscriptions_stripe_sub_id ON subscriptions(stripe_subscription_id);

-- RLS: enable
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can SELECT own subscription rows only
CREATE POLICY "subscriptions_select_own" ON subscriptions
  FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

-- RLS: service_role bypass for webhook writes (INSERT/UPDATE blocked for authenticated role by omission)
CREATE POLICY "service_role_all_subscriptions" ON subscriptions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all_stripe_events" ON stripe_webhook_events
  FOR ALL USING (auth.role() = 'service_role');
```

### Pattern 3: Stripe Checkout Session Creation

**What:** Server-side route creates a Checkout Session with `payment_method_collection: 'always'` (CC required, D-03), subscription mode with 14-day trial. Metadata carries `tenant_id` for webhook lookup. Success URL points to `/onboarding/checkout-success?session_id={CHECKOUT_SESSION_ID}`. Cancel URL returns to plan selection.

```javascript
// src/app/api/onboarding/checkout-session/route.js
import Stripe from 'stripe';
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase as adminSupabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_MAP = {
  starter: process.env.STRIPE_PRICE_STARTER,
  growth:  process.env.STRIPE_PRICE_GROWTH,
  scale:   process.env.STRIPE_PRICE_SCALE,
};

export async function POST(request) {
  const supabaseServer = await createSupabaseServer();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { plan } = await request.json();
  const priceId = PRICE_MAP[plan];
  if (!priceId) return Response.json({ error: 'Invalid plan' }, { status: 400 });

  // Look up tenant for metadata
  const { data: tenant } = await adminSupabase
    .from('tenants')
    .select('id, owner_email, business_name')
    .eq('owner_id', user.id)
    .single();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_collection: 'always',   // D-03: CC required
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { tenant_id: tenant.id },
    },
    customer_email: tenant.owner_email,
    metadata: { tenant_id: tenant.id },    // on session AND subscription for webhook lookup
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/plan`,
  });

  return Response.json({ url: session.url });
}
```

### Pattern 4: Webhook Subscription Sync (History Table)

**What:** When a subscription event arrives, the handler: (1) looks up tenant_id from subscription metadata, (2) sets `is_current = false` on prior rows for that subscription, (3) inserts a new row with `is_current = true`, (4) applies `stripe_updated_at` guard (D-10) to skip stale events.

```javascript
// Inside handleSubscriptionUpdated(subscription)
const tenantId = subscription.metadata?.tenant_id;
if (!tenantId) {
  console.warn('[stripe/webhook] No tenant_id in subscription metadata:', subscription.id);
  return;
}

// D-10: Out-of-order protection — skip if we have a newer event
const stripeUpdatedAt = new Date(subscription.updated * 1000).toISOString();
const { data: currentRow } = await supabase
  .from('subscriptions')
  .select('stripe_updated_at')
  .eq('stripe_subscription_id', subscription.id)
  .eq('is_current', true)
  .maybeSingle();

if (currentRow?.stripe_updated_at && currentRow.stripe_updated_at >= stripeUpdatedAt) {
  console.log('[stripe/webhook] Skipping stale event for subscription:', subscription.id);
  return;
}

// Map Stripe status to local status
const statusMap = {
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  canceled: 'canceled',
  paused: 'paused',
  incomplete: 'incomplete',
  incomplete_expired: 'canceled',
};
const localStatus = statusMap[subscription.status] || 'canceled';

// D-12: Map price_id to plan_id
const planMap = {
  [process.env.STRIPE_PRICE_STARTER]: 'starter',
  [process.env.STRIPE_PRICE_GROWTH]:  'growth',
  [process.env.STRIPE_PRICE_SCALE]:   'scale',
};
const priceId = subscription.items.data[0]?.price?.id;
const planId = planMap[priceId];
const callsLimitMap = { starter: 40, growth: 120, scale: 400 };

// D-13: History table — mark prior rows inactive, insert new current row
await supabase
  .from('subscriptions')
  .update({ is_current: false })
  .eq('stripe_subscription_id', subscription.id)
  .eq('is_current', true);

await supabase
  .from('subscriptions')
  .insert({
    tenant_id: tenantId,
    stripe_customer_id: subscription.customer,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    plan_id: planId,
    status: localStatus,
    calls_limit: callsLimitMap[planId] || 40,
    calls_used: 0,
    trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    stripe_updated_at: stripeUpdatedAt,
    is_current: true,
  });
```

### Pattern 5: Onboarding Flow Modification

**What:** The `TestCallPanel`'s `onGoToDashboard` callback in `test-call/page.js` currently calls `clearWizardSession()` and pushes to `/dashboard`. This must change to route to `/onboarding/plan` instead. The `handleComplete()` callback (fires when `TestCallPanel` reaches the 'complete' celebration state) must also route to `/onboarding/plan`.

**Critical:** `onboarding_complete` must NOT be set by the test call webhook any more. It must be set server-side from the `checkout.session.completed` webhook handler after verifying the Checkout Session belongs to this tenant. The test call webhook continues to record `test_call_completed = true` only.

**New wizard step order:**
```
Step 5: Test Call (/onboarding/test-call)
    ↓ on completion
Step 6: Plan Selection (/onboarding/plan)      [NEW]
    ↓ on plan selected → POST /api/onboarding/checkout-session → redirect to Stripe Checkout
Stripe Checkout (external)
    ↓ on success redirect to /onboarding/checkout-success?session_id=...
Step 7: Celebration (/onboarding/checkout-success)  [NEW]
    ↓ auto-redirect after 3 seconds
/dashboard
```

**Layout step counter update:** `onboarding/layout.js` currently shows "Step N of 4" for 4 tracked steps. Phase 22 adds 2 new steps, so the counter becomes "Step N of 6" and `getStep(pathname)` needs cases for `/onboarding/plan` (step 5) and `/onboarding/checkout-success` (step 6).

**Middleware:** `/onboarding/plan` and `/onboarding/checkout-success` are onboarding sub-routes. The middleware's `AUTH_REQUIRED_PATHS` already includes `/onboarding` which matches all sub-paths via `pathname.startsWith(p + '/')`, so no middleware changes are needed.

However, the middleware redirect `on /onboarding* + onboarding_complete === true → redirect to /dashboard` will fire if a user somehow lands on `/onboarding/plan` after completing onboarding. This is desirable — they shouldn't be able to re-enter the plan selection flow post-completion.

### Anti-Patterns to Avoid

- **Calling `/api/onboarding/complete` from the checkout success page:** The existing `/api/onboarding/complete` route only sets `onboarding_complete = true`. Don't call it from the client. Set `onboarding_complete = true` server-side inside the `checkout.session.completed` webhook handler with the service role client, AFTER verifying the session metadata.
- **Using `after()` in the webhook handler:** D-08 explicitly forbids this. Process synchronously so idempotency and error handling are straightforward.
- **Upsert on the subscriptions table:** D-13 requires the history table pattern. INSERT new rows, never UPDATE existing rows (only UPDATE `is_current = false` to mark prior rows inactive).
- **Storing stripe_subscription_id as the only key:** Phase 25 needs `stripe_customer_id` for Customer Portal sessions. Store both from the first event.
- **Assuming checkout.session.completed fires before customer.subscription.created:** Event order is not guaranteed. The webhook handler must be idempotent for both orderings. The `is_current` update pattern handles this — whichever event arrives first creates the row, the second event sees a newer timestamp (if applicable) or inserts its own row.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Signature verification | Custom HMAC comparison | `stripe.webhooks.constructEvent()` | Stripe's implementation handles timing attacks and encoding edge cases |
| Checkout payment form | Custom card input | Stripe Checkout (hosted) | PCI compliance — scope explodes with custom forms |
| Trial period management | Custom trial expiry cron | Stripe native trial with `trial_period_days` | Stripe fires `trial_will_end` at day 11 and handles expiry automatically |
| Plan management UI | Custom plan change screens | Stripe Customer Portal (Phase 25) | Portal handles proration, downgrades, invoice history |
| Usage counter race conditions | Manual mutex or lock | Postgres `UPDATE ... SET calls_used = calls_used + 1` (Phase 23) | Atomic SQL update prevents double-counting |

**Key insight:** Stripe handles all the hard billing math. The local subscriptions table is an enforcement cache, not a billing system. Never replicate what Stripe already does.

---

## Common Pitfalls

### Pitfall 1: `request.json()` Breaks Stripe Signature Verification

**What goes wrong:** Using `request.json()` instead of `request.text()` to parse the webhook body. The parsed JSON is serialized differently from the raw bytes Stripe used to compute the signature — signature verification silently fails or throws, causing all webhook events to be rejected with 401.

**Why it happens:** Next.js App Router routes normally use `request.json()`. Stripe webhooks are the one case where raw bytes must be preserved.

**How to avoid:** The webhook route MUST use `const rawBody = await request.text()` — exactly as the existing Retell webhook does. The raw string is passed to `stripe.webhooks.constructEvent(rawBody, sig, secret)`.

**Warning signs:** Webhook verification throwing `"No signatures found matching the expected signature for payload"`.

---

### Pitfall 2: tenant_id Not in Stripe Subscription Metadata

**What goes wrong:** Stripe fires `customer.subscription.created` with a subscription object. If `tenant_id` is not stored in subscription metadata at creation time, the webhook handler cannot determine which tenant to update. The handler must either call the Stripe API again to get the parent Checkout Session (adds latency), or skip the event (creates an unfilled subscriptions row).

**Why it happens:** Metadata can be set on the Checkout Session OR on the subscription. Setting it only on the session means it won't appear on subscription events.

**How to avoid:** Set `subscription_data.metadata: { tenant_id }` at Checkout Session creation time. Stripe propagates this metadata to the subscription object automatically — it will appear on all subscription events.

**Warning signs:** `subscription.metadata.tenant_id` is undefined in webhook events.

---

### Pitfall 3: Onboarding Completion Set at Test Call Completion Instead of Checkout

**What goes wrong:** The current onboarding flow sets `onboarding_complete = true` via the `call_analyzed` Retell webhook when the test call completes. After Phase 22, if this is left unchanged, users who complete the test call but abandon Stripe Checkout will be marked as onboarding-complete and skip directly to the dashboard with no subscription row — allowing free access indefinitely.

**Why it happens:** The Retell webhook is the existing completion trigger. It's easy to miss that the billing phase changes what "onboarding complete" means.

**How to avoid:** The `processCallAnalyzed` function in `call-processor.js` sets `onboarding_complete` via the Retell webhook. This must be changed — for users who reach the test call step during onboarding, `onboarding_complete` must only be set by the `checkout.session.completed` Stripe webhook handler. The Retell test call webhook should continue to set only `test_call_completed = true`, not `onboarding_complete`.

**Warning signs:** Users appearing in the dashboard without a corresponding row in the `subscriptions` table.

---

### Pitfall 4: Checkout Session URL Redirect vs. Window Location

**What goes wrong:** The plan selection page creates a Checkout Session and gets back a session URL. If the redirect uses `router.push(url)` (Next.js client-side navigation), it may fail for external URLs (Stripe is a different domain). The browser will attempt client-side routing to `https://checkout.stripe.com/...` and fail or navigate incorrectly.

**Why it happens:** Next.js router is for internal navigation. External redirects need `window.location.href`.

**How to avoid:** Use `window.location.href = session.url` after receiving the Checkout Session URL. Or use `router.push` for relative URLs only and `window.location.assign` for absolute external URLs.

---

### Pitfall 5: Missing `cancel_at_period_end` Sync Causes Plan Confusion

**What goes wrong:** When a tenant cancels their subscription in Stripe Customer Portal (Phase 25), Stripe does not immediately cancel — it sets `cancel_at_period_end = true` and continues the subscription until period end. If `cancel_at_period_end` is not synced to the local subscriptions table, the dashboard will show no indicator that the subscription is scheduled to end, and enforcement won't know to block at period end.

**Why it happens:** `cancel_at_period_end` arrives on `customer.subscription.updated` events, not on a separate cancel event. It's easy to only handle the `status` field.

**How to avoid:** Always sync `cancel_at_period_end` from the subscription object in every event handler. Treat it as a first-class column. Phase 25 UI will read it to show "cancels on [date]" indicators.

---

### Pitfall 6: History Table `calls_used` Reset Confusion

**What goes wrong:** The history table inserts a new row on every subscription event. Each new row starts with `calls_used = 0`. This means `invoice.paid` (which resets the billing cycle) should insert a new row with `calls_used = 0`. But `customer.subscription.updated` (e.g., plan change) should NOT reset `calls_used` — it should carry the current count forward.

**Why it happens:** The uniform "insert new row" pattern seems to mean `calls_used` always starts at 0. But usage tracking (Phase 23) will UPDATE `calls_used` on the `is_current = true` row. The new row for a plan change event should copy the current `calls_used` from the row it replaces.

**How to avoid:** In the webhook handler, before inserting the new `is_current = true` row, read the current row's `calls_used` value. Carry it forward for `subscription.updated` events. Reset to 0 only for `invoice.paid` events.

---

## Code Examples

### Stripe SDK Singleton

```javascript
// src/lib/stripe.js
// Source: Stripe official Next.js guide
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-03-31.basil', // latest stable API version
  typescript: false,
});
```

### Creating Stripe Products and Prices (One-Time Setup, Stripe Dashboard)

Three Stripe Products to create manually in Stripe Dashboard:
- **Starter** — $99/month, 40 calls
- **Growth** — $249/month, 120 calls
- **Scale** — $599/month, 400 calls

After creation, copy the Price IDs (not Product IDs) into env vars:
```bash
STRIPE_PRICE_STARTER=price_xxxxx
STRIPE_PRICE_GROWTH=price_xxxxx
STRIPE_PRICE_SCALE=price_xxxxx
```

Product names in Stripe must match exactly: "Starter", "Growth", "Scale". This is what appears on Stripe-hosted invoices.

### Checking Checkout Session for Existing Customer

If a tenant somehow ends up at plan selection with an existing Stripe customer (e.g., re-onboarding test), passing `customer_email` ensures Stripe reuses the existing customer rather than creating a duplicate. The webhook handler should also deduplicate on `stripe_customer_id` if needed — though D-11 confirms no legacy user handling is required.

### Environment Variables for Phase 22

```bash
# Stripe keys
STRIPE_SECRET_KEY=sk_live_...        # or sk_test_... for development
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...       # from Stripe Dashboard webhook endpoint config

# Plan price IDs (set after creating prices in Stripe Dashboard)
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_GROWTH=price_...
STRIPE_PRICE_SCALE=price_...

# App URL for success/cancel redirect construction
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Legacy Usage Records API | Stripe Billing Meters v2 | Stripe API 2025-03-31.basil | Overage billing requires Meters v2 — but overage is deferred to Phase BILLF-02, not Phase 22 |
| Stripe SDK v17 (from research docs) | Stripe SDK v20.4.1 | Late 2025 | API surface unchanged for subscriptions/Checkout — install current version |
| No-CC free trial | CC-required trial (`payment_method_collection: 'always'`) | Decision D-03 | Higher trial-to-paid conversion; reduces involuntary churn at trial end |

**Deprecated/outdated:**
- `stripe.webhooks.constructEventAsync()` is available but not required — `constructEvent()` (sync) works fine for this use case
- Legacy `payment_intent_succeeded` approach: subscriptions use `invoice.paid`, not payment intents directly

---

## Open Questions

1. **`processCallAnalyzed` in `call-processor.js` sets `onboarding_complete`**
   - What we know: The existing `call_analyzed` Retell webhook calls `processCallAnalyzed()`, which likely sets `onboarding_complete = true` for test calls.
   - What's unclear: The exact code in `call-processor.js` was not read. It may set `onboarding_complete = true` for ALL call_analyzed events or only for test calls.
   - Recommendation: During plan implementation, read `src/lib/call-processor.js` to find exactly where/how `onboarding_complete` is set, and change that logic to only set `test_call_completed = true`. The `onboarding_complete` flag must only be set by the `checkout.session.completed` webhook handler.

2. **Plan selection UI — reuse PricingTiers.jsx or build inline**
   - What we know: CONTEXT.md (Specific Ideas) says "should reuse the existing pricing tier card design from PricingTiers.jsx (or a simplified version)."
   - What's unclear: Whether PricingTiers.jsx is structured as a reusable component or is tightly coupled to the public pricing page layout.
   - Recommendation: During plan implementation, read `src/components/` or `src/app/(public)/pricing/` to find PricingTiers.jsx. If it requires significant refactoring, build a simplified inline version that reads from `PRICING_TIERS` in `pricingData.js`.

3. **Stripe CLI local webhook testing setup**
   - What we know: The webhook endpoint must be registered in the Stripe Dashboard for production. Local development requires the Stripe CLI to forward events to localhost.
   - What's unclear: Whether the Stripe CLI is already installed in this dev environment.
   - Recommendation: The planner should include a Wave 0 task to verify `stripe` CLI availability and add Stripe CLI webhook forwarding to the dev workflow. Command: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `stripe` npm package | BILL-04, BILL-06 | Not yet installed | Latest: 20.4.1 | Install during Wave 0 |
| `@stripe/stripe-js` npm package | BILL-06 (client-side redirect) | Not yet installed | Latest: 8.11.0 | Install during Wave 0 |
| Stripe account + API keys | BILL-01, BILL-04, BILL-06 | Unknown — env vars not confirmed | — | Block until keys set |
| Stripe CLI (local testing) | Dev/test webhook forwarding | Unknown | — | Manual event testing via Stripe Dashboard |
| Supabase service role client | BILL-02, BILL-04 | Available | Existing `src/lib/supabase.js` | — |

**Missing dependencies with no fallback:**
- Stripe API keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`) must be provisioned before the webhook handler or Checkout Session creation can be tested. Wave 0 must verify these are in `.env.local`.

**Missing dependencies with fallback:**
- `stripe` and `@stripe/stripe-js` packages — install in Wave 0 before implementation tasks.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected in project (no jest.config, no vitest.config, no pytest.ini) |
| Config file | None — see Wave 0 |
| Quick run command | Manual: `stripe trigger checkout.session.completed` via Stripe CLI |
| Full suite command | Manual E2E: Complete onboarding wizard through Checkout in test mode |

**Note:** This project has no automated test infrastructure. Nyquist validation for this phase is manual verification via Stripe Test Mode and Stripe Test Clocks.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BILL-01 | Stripe products/prices exist with correct amounts and limits | Manual | Stripe Dashboard verification | N/A — manual |
| BILL-02 | Subscriptions table has correct schema and RLS | Smoke | Supabase Studio — insert attempt as authenticated role fails | N/A — manual |
| BILL-03 | stripe_webhook_events UNIQUE on event_id prevents duplicate processing | Smoke | Send same event twice via `stripe trigger`, verify single row | N/A — manual |
| BILL-04 | Webhook handler returns 401 on bad sig, 200 on good sig | Smoke | `stripe trigger customer.subscription.created` via Stripe CLI | ❌ Wave 0 |
| BILL-05 | All lifecycle events sync correct status to subscriptions table | Manual | Use Stripe Test Clock to advance through trial/expiry states | N/A — manual |
| BILL-06 | Completing onboarding wizard creates Stripe customer + subscription + local row | E2E | Complete wizard with test card in Stripe Test Mode | N/A — manual |

### Sampling Rate

- **Per task commit:** Manual smoke test of the specific component changed (e.g., webhook handler — `stripe trigger` via CLI)
- **Per wave merge:** Full onboarding E2E in Stripe Test Mode with a test card
- **Phase gate:** Stripe Test Clock advances to trial end, local subscription status shows `canceled` before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] Install packages: `npm install stripe @stripe/stripe-js`
- [ ] Verify Stripe API keys in `.env.local`
- [ ] Install Stripe CLI and run `stripe listen --forward-to localhost:3000/api/stripe/webhook`
- [ ] Create Stripe products/prices in Dashboard (or Stripe CLI: `stripe products create`, `stripe prices create`)
- [ ] Copy Price IDs to `.env.local` as `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_SCALE`

---

## Project Constraints (from CLAUDE.md)

The CLAUDE.md requires keeping skill files in sync when architecture changes are made. Phase 22 touches the onboarding flow (adding two new wizard steps) and introduces a new billing system.

| Directive | Impact on Phase 22 |
|-----------|-------------------|
| Update `onboarding-flow` skill file after changes | Phase 22 modifies `test-call/page.js` and adds `plan/page.js`, `checkout-success/page.js`. The onboarding-flow skill's Step table, File Map, and Architecture Overview must be updated after implementation. |
| Update `auth-database-multitenancy` skill file after new migrations | Migration `010_billing_schema.sql` adds 2 new tables. The Migration Trail and Complete Table Reference sections must be updated. |
| No existing billing-payment skill file yet | BILLDOC-01 (Phase 26) creates it. Phase 22 implementors do NOT need to create a skill file — that is explicitly Phase 26's deliverable. |

---

## Sources

### Primary (HIGH confidence)

- Codebase direct audit — `src/app/api/webhooks/retell/route.js`, `src/app/api/onboarding/complete/route.js`, `src/app/onboarding/test-call/page.js`, `pricingData.js`, `supabase/migrations/001_initial_schema.sql`
- `.planning/research/SUMMARY.md` — synthesized v3.0 billing research with architecture decisions
- `.planning/research/ARCHITECTURE.md` — integration philosophy and component plan
- `.planning/research/PITFALLS.md` — critical pitfalls with prevention strategies
- `.planning/phases/22-billing-foundation/22-CONTEXT.md` — locked decisions D-01 through D-14
- Pricing confirmed: `pricingData.js` — Starter $99/40, Growth $249/120, Scale $599/400 (resolves the SUMMARY.md conflict note)
- npm registry — `stripe` v20.4.1, `@stripe/stripe-js` v8.11.0 (verified 2026-03-26)
- `onboarding-flow` skill — Step architecture, CelebrationOverlay, TestCallPanel state machine
- `auth-database-multitenancy` skill — RLS patterns, migration conventions, Supabase client selection

### Secondary (MEDIUM confidence)

- `.planning/research/SUMMARY.md` sources: Stripe official docs for Checkout free trials, webhook subscription events, Customer Portal — aggregated and verified at research time (2026-03-26)

### Tertiary (LOW confidence)

- None applicable — all findings verified against codebase or official sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against npm registry
- Architecture: HIGH — integration points verified against live codebase files
- Pitfalls: HIGH — derived from existing PITFALLS.md (verified against Stripe official docs) plus codebase-specific observations
- Schema: HIGH — follows identical RLS patterns as all 9 existing migrations

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (Stripe SDK versioning is stable; webhook API is stable)

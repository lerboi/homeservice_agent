# Stripe Overage Billing Setup — Step-by-Step Guide

> **Updated March 2026** — Stripe's legacy "Metered" billing API (`POST /v1/subscription_items/{id}/usage_records`)
> was **completely removed** in API version `2025-03-31.basil`. This guide uses the current
> **Billing Meters** system. Do not follow the old guide.

---

## How It Works (New Architecture)

```
Meter (voco_calls)
   └── tracks inbound calls per customer
   └── linked to 3 prices (one per plan)

Starter Price ──────────── $2.48 / call  ─┐
Growth Price  ──────────── $2.08 / call  ──┤── all linked to the same meter
Scale Price   ──────────── $1.50 / call  ─┘

Subscription:
   ├── Item 1: Flat rate (e.g. Starter $99/mo)
   └── Item 2: Usage-based (e.g. Starter Overage $2.48/call)

When a call comes in beyond the plan limit:
   → POST /v1/billing/meter_events
   → { event_name: "voco_calls", customer_id: cus_xxx, value: 1 }
   → Stripe tallies it against the customer's metered subscription item
   → Charged automatically at next invoice
```

---

## Step 1: Create the Billing Meter (Done)

You only need **one meter** for all three plans.

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Make sure you're in **Test mode** (toggle in the top-left corner of the sidebar — it says **"Test mode"**)
3. In the left sidebar, click **Billing**
4. Under Billing, click **Meters**
   - Direct URL: `https://dashboard.stripe.com/test/billing/meters`
5. Click **"Create meter"** (top right)
6. Fill in the form:
   - **Meter name**: `Voco Calls` (this is just a display label)
   - **Event name**: `voco_calls`
     > ⚠️ **This is the string your code sends when reporting usage. Copy it exactly — it must match in your code.**
   - **Aggregation method**: Select **Sum**
     > Sum adds up all reported values. Since you'll always report `value: 1` per call, Sum = total calls.
7. Leave **Dimensions** empty (not needed)
8. Click **"Create meter"**

After creating, you'll see the meter page. Copy the **Meter ID** — it starts with `mtr_`:

```
Meter ID: mtr_XXXXXXXXXXXXXXXX
```

> You don't need to put this ID in your `.env` — it's only needed when creating prices (next steps).

---

## Step 2: Add Overage Price to Starter Product (Done)

1. In the left sidebar, click **Product catalogue**
   - Direct URL: `https://dashboard.stripe.com/test/products`
2. Click on your **Starter** product
3. Scroll down to the **Pricing** section and click **"Add price"**
4. On the **"Add price"** page:
   - Under **"Choose your pricing model"**, select **"Usage-based"**
   - Under **"Usage structure"**, select **"Per unit"**
   - **Price**: Enter `2.48`
   - **Currency**: USD
   - **Meter**: Click the dropdown → select **"Voco Calls"** (the meter you just created)
   - **Billing period**: Monthly
   - **Description** (optional): `Overage — $2.48 per call beyond 40/mo`
5. Click **"Next"** → then **"Add price"**
6. The new price appears in the Pricing table. Click the **copy icon** next to its ID.

```
STRIPE_PRICE_STARTER_OVERAGE=price_XXXXXXXXXX  ← paste this
```

---

## Step 3: Add Overage Price to Growth Product (Done)

1. Go to **Product catalogue** → click your **Growth** product
2. Scroll to Pricing → click **"Add price"**
3. Fill in:
   - **Pricing model**: Usage-based
   - **Usage structure**: Per unit
   - **Price**: `2.08`
   - **Currency**: USD
   - **Meter**: Voco Calls ← same meter as Starter
   - **Billing period**: Monthly
   - **Description** (optional): `Overage — $2.08 per call beyond 120/mo`
4. Click **Next** → **Add price**
5. Copy the Price ID

```
STRIPE_PRICE_GROWTH_OVERAGE=price_XXXXXXXXXX  ← paste this
```

---

## Step 4: Add Overage Price to Scale Product (Done)

1. Go to **Product catalogue** → click your **Scale** product
2. Scroll to Pricing → click **"Add price"**
3. Fill in:
   - **Pricing model**: Usage-based
   - **Usage structure**: Per unit
   - **Price**: `1.50`
   - **Currency**: USD
   - **Meter**: Voco Calls ← same meter as Starter and Growth
   - **Billing period**: Monthly
   - **Description** (optional): `Overage — $1.50 per call beyond 400/mo`
4. Click **Next** → **Add price**
5. Copy the Price ID

```
STRIPE_PRICE_SCALE_OVERAGE=price_XXXXXXXXXX  ← paste this
```

---

## Step 5: Add Price IDs to .env.local (Done)

Open `.env.local` and add the 3 overage price IDs:

```bash
# Overage usage-based prices (per-call charge when plan limit exceeded)
STRIPE_PRICE_STARTER_OVERAGE=price_PASTE_STARTER_ID_HERE
STRIPE_PRICE_GROWTH_OVERAGE=price_PASTE_GROWTH_ID_HERE
STRIPE_PRICE_SCALE_OVERAGE=price_PASTE_SCALE_ID_HERE
```

---

## Step 6: Run Database Migration (Done)

The subscription row needs to store the Stripe subscription item ID for the overage line item.
Run this in the **Supabase SQL Editor**:

```sql
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS overage_stripe_item_id text;
```

Or via Supabase CLI:
```bash
supabase db push
```

---

## Step 7: Update Checkout Session Code

When creating a Stripe Checkout Session, pass **both** the flat-rate price and the overage price as line items.

```js
const session = await stripe.checkout.sessions.create({
  customer: stripeCustomerId,
  mode: 'subscription',
  line_items: [
    {
      // Flat-rate plan price (e.g. Starter $99/mo)
      price: STRIPE_PRICE_STARTER_MONTHLY,
      quantity: 1,
    },
    {
      // Usage-based overage price (no quantity needed for metered)
      price: process.env.STRIPE_PRICE_STARTER_OVERAGE,
    },
  ],
  // ... rest of your session config
});
```

> **No `quantity` field on the usage-based item** — Stripe infers this from meter events.

---

## Step 8: Save the Overage Subscription Item ID

When Stripe fires `checkout.session.completed`, the subscription will have two items.
You need to save the **subscription item ID** (`si_xxx`) for the overage line item.

In your webhook handler for `checkout.session.completed`:

```js
const subscription = await stripe.subscriptions.retrieve(session.subscription, {
  expand: ['items'],
});

// Find the metered item — it has usage_type: 'metered'
const overageItem = subscription.items.data.find(
  (item) => item.price.recurring?.usage_type === 'metered'
);

// Save to your subscriptions table
await supabase
  .from('subscriptions')
  .update({ overage_stripe_item_id: overageItem?.id })
  .eq('stripe_subscription_id', subscription.id);
```

---

## Step 9: Reporting Usage (When Overage Occurs)

When a call completes and exceeds the plan limit, report it using the **new Billing Meter Events API**:

```js
// NEW API — use this (not the old usage_records endpoint)
await stripe.billing.meterEvents.create({
  event_name: 'voco_calls',          // must match meter event name exactly
  payload: {
    value: '1',                       // number of calls to report (as string)
    stripe_customer_id: customerId,   // the Stripe customer ID
  },
});
```

> **What changed**: The old endpoint was `POST /v1/subscription_items/{id}/usage_records`
> and required the subscription item ID. The new endpoint uses the **customer ID + event name** —
> no subscription item ID needed. Stripe resolves the correct meter and price automatically.

### Locating the customer's Stripe ID

Your `subscriptions` table should have `stripe_customer_id`. Use that directly.

---

## Step 10: Verify the Setup Works

### 10a — Check the subscription has two line items

After a test checkout, go to:
**Stripe Dashboard → Billing → Subscriptions → click the subscription**

You should see two line items:
```
✅  Starter Plan                    $99.00 / month
✅  Voco Calls (Starter Overage)    $0.00  / month  ← starts at $0, charges on usage
```

### 10b — Manually send a test meter event

Go to **Billing → Meters → Voco Calls** → click **"Add usage"** → **"Manually input usage"**

Fill in:
- **Customer**: select your test customer
- **Value**: `5`
- **Timestamp**: leave as now

Click **"Add usage"**. The meter page will show the 5 units tallied for that customer.

### 10c — Send a test event via API

```bash
curl https://api.stripe.com/v1/billing/meter_events \
  -u "sk_test_...:" \
  -d "event_name=voco_calls" \
  -d "payload[value]=1" \
  -d "payload[stripe_customer_id]=cus_XXXXXXXXXX"
```

### 10d — Verify in the Dashboard

**Billing → Meters → Voco Calls** → you'll see the customer's usage chart update within ~30 seconds.

---

## Step 11: Repeat for Production (when going live)

1. **Switch to Live mode**: Click the **"Live mode"** toggle in the top-left sidebar
2. **Create the meter again** in live mode (meters are environment-specific):
   - Same name: `Voco Calls`
   - Same event name: `voco_calls` ← **must be identical**
   - Same aggregation: Sum
3. **Create the 3 overage prices** in live mode (Steps 2–4 above, in Live mode)
4. Update your **production environment variables** with the live price IDs:
   ```bash
   STRIPE_PRICE_STARTER_OVERAGE=price_live_XXXXXXXXXX
   STRIPE_PRICE_GROWTH_OVERAGE=price_live_XXXXXXXXXX
   STRIPE_PRICE_SCALE_OVERAGE=price_live_XXXXXXXXXX
   ```
5. Run the migration on your production Supabase instance
6. Deploy

> The meter event_name `voco_calls` will automatically route to the correct environment's
> meter as long as you're using the correct API key (test key → test meter, live key → live meter).

---

## Quick Reference

| Plan | Included calls | Overage rate | Env var |
|------|---------------|-------------|---------|
| Starter | 40/mo | $2.48/call | `STRIPE_PRICE_STARTER_OVERAGE` |
| Growth | 120/mo | $2.08/call | `STRIPE_PRICE_GROWTH_OVERAGE` |
| Scale | 400/mo | $1.50/call | `STRIPE_PRICE_SCALE_OVERAGE` |

---

## Important Notes

- **One meter, three prices**: All three plans share the same `voco_calls` meter. Stripe resolves
  the per-unit rate from whichever overage price is on the customer's subscription.

- **Usage is reported async**: Meter events are processed within ~30 seconds. They don't block
  your call pipeline — fire-and-forget is fine.

- **Calls are never blocked**: Overages add charges to the next invoice. The AI answers every call.

- **During trial**: Stripe accepts meter events but bills them at $0 until the trial ends.
  After trial, overages are charged normally from the first billing cycle.

- **Existing subscribers** created before adding the overage price won't have the metered item.
  To add it, call the API to add a new subscription item:
  ```js
  await stripe.subscriptionItems.create({
    subscription: 'sub_XXXXXXXXXX',
    price: process.env.STRIPE_PRICE_STARTER_OVERAGE,
  });
  ```

- **API version**: Make sure your Stripe SDK or API calls use version `2025-03-31.basil` or later.
  The old `usage_records` endpoint does not exist in this version. Your Node.js SDK should be
  `stripe@^17.0.0` or later to have `stripe.billing.meterEvents` available.

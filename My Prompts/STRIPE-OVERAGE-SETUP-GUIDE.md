# Stripe Overage Billing Setup — Step-by-Step Guide

Follow these steps in order to enable per-call overage charging in Stripe.

---

## Step 1: Open Stripe Dashboard

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Make sure you're in **Test mode** (toggle in top-right) if setting up for dev first
3. Navigate to **Product Catalog**

---

## Step 2: Add Overage Price to Starter Product

1. Click on the **Starter** product
2. Click **Add a price**
3. Fill in:
   - **Pricing model**: Choose **Usage-based** (sometimes labeled "Metered")
   - **Usage type**: Metered
   - **Aggregation mode**: Sum of usage values during period
   - **Price**: `$2.48` per unit
   - **Billing period**: Monthly
   - **Price description** (optional): `Overage — $2.48 per call beyond 40/mo`
4. Click **Save**
5. Copy the new Price ID (starts with `price_`) — you'll need this

---

## Step 3: Add Overage Price to Growth Product

1. Click on the **Growth** product
2. Click **Add a price**
3. Fill in:
   - **Pricing model**: Usage-based
   - **Usage type**: Metered
   - **Aggregation mode**: Sum of usage values during period
   - **Price**: `$2.08` per unit
   - **Billing period**: Monthly
   - **Price description** (optional): `Overage — $2.08 per call beyond 120/mo`
4. Click **Save**
5. Copy the Price ID

---

## Step 4: Add Overage Price to Scale Product

1. Click on the **Scale** product
2. Click **Add a price**
3. Fill in:
   - **Pricing model**: Usage-based
   - **Usage type**: Metered
   - **Aggregation mode**: Sum of usage values during period
   - **Price**: `$1.50` per unit
   - **Billing period**: Monthly
   - **Price description** (optional): `Overage — $1.50 per call beyond 400/mo`
4. Click **Save**
5. Copy the Price ID

---

## Step 5: Add Price IDs to .env.local

Open `.env.local` and add the 3 new price IDs you copied:

```bash
# Overage metered prices (per-call charge when plan limit exceeded)
STRIPE_PRICE_STARTER_OVERAGE=price_PASTE_STARTER_ID_HERE
STRIPE_PRICE_GROWTH_OVERAGE=price_PASTE_GROWTH_ID_HERE
STRIPE_PRICE_SCALE_OVERAGE=price_PASTE_SCALE_ID_HERE
```

---

## Step 6: Run Database Migration

Run migration 017 against your Supabase instance:

```sql
-- In Supabase SQL Editor, run:
ALTER TABLE subscriptions ADD COLUMN overage_stripe_item_id text;
```

Or apply via Supabase CLI:
```bash
supabase db push
```

---

## Step 7: Verify Webhook Events

Make sure your Stripe webhook endpoint (`/api/stripe/webhook`) is listening for these events (it already should be):

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `invoice.paid`

No new event types are needed — overage usage records are tallied automatically by Stripe and included in the regular `invoice.paid` cycle.

---

## Step 8: Test the Flow

1. **Create a test subscription** through the onboarding flow
2. **Verify in Stripe Dashboard** that the subscription has 2 line items:
   - The flat-rate plan price (e.g., Starter $99/mo)
   - The metered overage price (e.g., $2.48/unit — should show $0.00 initially)
3. **Check your database**: the `subscriptions` row should have `overage_stripe_item_id` populated
4. **Simulate overage**: Manually trigger calls that exceed the plan limit and check:
   - Console logs show `[usage] Overage reported to Stripe`
   - Stripe Dashboard > Subscription > Usage tab shows the reported units

---

## Step 9: Repeat for Production

When ready to go live:

1. Switch Stripe Dashboard out of Test mode
2. Create the same 3 metered prices on your **live** products
3. Update `.env` (production) with the live price IDs
4. Run the migration on your production Supabase instance
5. Deploy

---

## Quick Reference

| Plan | Included calls | Overage rate | Env var |
|------|---------------|-------------|---------|
| Starter | 40/mo | $2.48/call | `STRIPE_PRICE_STARTER_OVERAGE` |
| Growth | 120/mo | $2.08/call | `STRIPE_PRICE_GROWTH_OVERAGE` |
| Scale | 400/mo | $1.50/call | `STRIPE_PRICE_SCALE_OVERAGE` |

---

## Important Notes

- **Existing subscribers** created before this change won't have the metered component. Only new subscriptions include it automatically. To add overage billing to existing subscribers, you'd need to add the metered price as a new subscription item via the Stripe API.
- **During trial period**: Stripe accepts usage records but bills them at $0. After trial ends, overages are charged normally.
- **Calls are never blocked** — overages just add charges to the next invoice.

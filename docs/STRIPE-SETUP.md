# Stripe Product & Price Setup

## Prerequisites

1. Create a free Stripe account at [dashboard.stripe.com](https://dashboard.stripe.com)
2. Toggle **Test mode** (top-right of dashboard)
3. Install [Stripe CLI](https://docs.stripe.com/stripe-cli) for local webhook testing

---

## Products to Create

Go to **Product Catalog > + Add product** in the Stripe Dashboard.

You need **3 products**, each with **2 prices** (monthly + annual).

### Product 1: Starter

| Field | Value |
|-------|-------|
| Name | `Starter` |
| Description | `For solo operators — 40 calls/month` |

**Price 1 (Monthly):**
| Field | Value |
|-------|-------|
| Pricing model | Standard |
| Amount | `$99.00` |
| Billing period | Monthly |

**Price 2 (Annual):**
| Field | Value |
|-------|-------|
| Pricing model | Standard |
| Amount | `$79.00` (20% discount = $99 x 0.8, rounded) |
| Billing period | Yearly |

---

### Product 2: Growth

| Field | Value |
|-------|-------|
| Name | `Growth` |
| Description | `For growing crews — 120 calls/month` |

**Price 1 (Monthly):**
| Field | Value |
|-------|-------|
| Amount | `$249.00` |
| Billing period | Monthly |

**Price 2 (Annual):**
| Field | Value |
|-------|-------|
| Amount | `$199.00` (20% discount = $249 x 0.8, rounded) |
| Billing period | Yearly |

---

### Product 3: Scale

| Field | Value |
|-------|-------|
| Name | `Scale` |
| Description | `For multi-crew operations — 400 calls/month` |

**Price 1 (Monthly):**
| Field | Value |
|-------|-------|
| Amount | `$599.00` |
| Billing period | Monthly |

**Price 2 (Annual):**
| Field | Value |
|-------|-------|
| Amount | `$479.00` (20% discount = $599 x 0.8, rounded) |
| Billing period | Yearly |

---

## After Creating Products

Each price gets a unique Price ID (starts with `price_`). Copy all 6 into `.env.local`:

```bash
# Monthly prices (used in Phase 22 onboarding checkout)
STRIPE_PRICE_STARTER=price_xxxxxxxxxxxxxxxx
STRIPE_PRICE_GROWTH=price_xxxxxxxxxxxxxxxx
STRIPE_PRICE_SCALE=price_xxxxxxxxxxxxxxxx

# Annual prices (for future annual billing toggle)
STRIPE_PRICE_STARTER_ANNUAL=price_xxxxxxxxxxxxxxxx
STRIPE_PRICE_GROWTH_ANNUAL=price_xxxxxxxxxxxxxxxx
STRIPE_PRICE_SCALE_ANNUAL=price_xxxxxxxxxxxxxxxx
```

> **Note:** Phase 22 only uses the monthly prices. Annual prices are set up now for future use but aren't wired into checkout yet.

---

## Other Required Env Vars

```bash
# Stripe API keys (Developers > API keys)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxx

# Webhook secret (from Stripe CLI output)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx

# App URL (for Checkout success/cancel redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Local Webhook Testing

```bash
# In a separate terminal:
stripe listen --forward-to localhost:3000/api/stripe/webhook

# The CLI prints: whsec_... — copy that into STRIPE_WEBHOOK_SECRET
```

---

## Summary

| What | Count |
|------|-------|
| Products | 3 (Starter, Growth, Scale) |
| Prices per product | 2 (monthly + annual) |
| Total prices | 6 |
| Env vars (keys) | 3 (secret, publishable, webhook secret) |
| Env vars (prices) | 6 (3 monthly + 3 annual) |
| **Total env vars** | **10** |

Enterprise is handled via contact form — no Stripe product needed.

---

## Plan Change & Proration Policy

**Decision: Immediate proration** — when a customer upgrades or downgrades, the change takes effect immediately and Stripe calculates the credit/charge automatically.

### How it works

| Scenario | What Stripe does |
|----------|-----------------|
| **Upgrade** (e.g., Starter → Growth) | Credits unused time on old plan, charges prorated amount for new plan, generates invoice immediately |
| **Downgrade** (e.g., Scale → Growth) | Credits unused time on old plan, applies credit to next invoice, new lower price starts immediately |
| **Billing interval change** (monthly → annual) | Same as upgrade/downgrade — prorates based on remaining time |
| **Mid-cycle cancel** | Access continues until period end (`cancel_at_period_end: true`), no refund for unused time |

### API configuration

All plan change API calls must use `always_invoice` to charge/credit immediately:

```javascript
await stripe.subscriptions.update(subscriptionId, {
  items: [{ id: subscriptionItemId, price: newPriceId }],
  proration_behavior: 'always_invoice',  // charge/credit immediately
});
```

### Example: Starter Annual → Growth Annual at month 6

```
Starter Annual paid:     $79/mo × 12 = $948
Used (6 months):         $474
Unused credit:           $474

Growth Annual remaining: $199/mo × 6 = $1,194
Prorated charge:         $1,194 - $474 = $720 (invoiced immediately)
```

### Example: Growth Monthly → Scale Monthly at day 15 of 30

```
Growth Monthly paid:     $249
Used (15/30 days):       $124.50
Unused credit:           $124.50

Scale Monthly remaining: $599 × (15/30) = $299.50
Prorated charge:         $299.50 - $124.50 = $175 (invoiced immediately)
```

### Webhook events generated on plan change

When `subscriptions.update()` is called with proration, Stripe fires these events (all handled by our webhook at `/api/stripe/webhook`):

1. `customer.subscription.updated` — new price/plan reflected
2. `invoice.created` — proration invoice generated
3. `invoice.paid` — proration invoice charged successfully (or `invoice.payment_failed` if card declines)

Our webhook handler already processes all of these. The `customer.subscription.updated` handler syncs the new `plan_id`, `stripe_price_id`, and `calls_limit` to the local subscriptions table via the history-table pattern.

### Downgrade call limit handling

When downgrading mid-cycle, `calls_used` is carried forward (not reset). If the customer has already used more calls than the new plan allows (e.g., used 80 calls on Growth, downgrades to Starter with 40-call limit), enforcement should:

- Allow the downgrade to proceed
- Block new calls immediately (usage already exceeds new limit)
- Reset `calls_used` to 0 at next billing cycle as normal

This enforcement logic is built in Phase 24 (Usage Enforcement).

### Price ID mapping for plan changes

The plan change API needs access to all 6 price IDs to handle any combination:

```javascript
const PRICE_MAP = {
  starter:        { monthly: process.env.STRIPE_PRICE_STARTER,        annual: process.env.STRIPE_PRICE_STARTER_ANNUAL },
  growth:         { monthly: process.env.STRIPE_PRICE_GROWTH,         annual: process.env.STRIPE_PRICE_GROWTH_ANNUAL },
  scale:          { monthly: process.env.STRIPE_PRICE_SCALE,          annual: process.env.STRIPE_PRICE_SCALE_ANNUAL },
};
```

This enables any upgrade/downgrade path including billing interval changes (monthly ↔ annual).

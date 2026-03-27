# Stripe Product & Price Setup

## Prerequisites

1. Create a free Stripe account at [dashboard.stripe.com](https://dashboard.stripe.com)
2. Toggle **Test mode** (top-right of dashboard)
3. Install [Stripe CLI](https://docs.stripe.com/stripe-cli) for local webhook testing

---

## Products to Create

Go to **Product Catalog > + Add product** in the Stripe Dashboard.

You need **3 products**, each with **3 prices** (monthly + annual + overage metered).

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

**Price 3 (Overage — Metered):**
| Field | Value |
|-------|-------|
| Pricing model | Usage-based (metered) |
| Usage type | Metered |
| Aggregation mode | Sum of usage during period |
| Amount | `$2.48` per unit |
| Billing period | Monthly |

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

**Price 3 (Overage — Metered):**
| Field | Value |
|-------|-------|
| Pricing model | Usage-based (metered) |
| Usage type | Metered |
| Aggregation mode | Sum of usage during period |
| Amount | `$2.08` per unit |
| Billing period | Monthly |

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

**Price 3 (Overage — Metered):**
| Field | Value |
|-------|-------|
| Pricing model | Usage-based (metered) |
| Usage type | Metered |
| Aggregation mode | Sum of usage during period |
| Amount | `$1.50` per unit |
| Billing period | Monthly |

---

## After Creating Products

Each price gets a unique Price ID (starts with `price_`). Copy all 9 into `.env.local`:

```bash
# Monthly prices
STRIPE_PRICE_STARTER=price_xxxxxxxxxxxxxxxx
STRIPE_PRICE_GROWTH=price_xxxxxxxxxxxxxxxx
STRIPE_PRICE_SCALE=price_xxxxxxxxxxxxxxxx

# Annual prices
STRIPE_PRICE_STARTER_ANNUAL=price_xxxxxxxxxxxxxxxx
STRIPE_PRICE_GROWTH_ANNUAL=price_xxxxxxxxxxxxxxxx
STRIPE_PRICE_SCALE_ANNUAL=price_xxxxxxxxxxxxxxxx

# Overage metered prices (per-call charge when plan limit exceeded)
STRIPE_PRICE_STARTER_OVERAGE=price_xxxxxxxxxxxxxxxx
STRIPE_PRICE_GROWTH_OVERAGE=price_xxxxxxxxxxxxxxxx
STRIPE_PRICE_SCALE_OVERAGE=price_xxxxxxxxxxxxxxxx
```

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
| Prices per product | 3 (monthly + annual + overage metered) |
| Total prices | 9 |
| Env vars (keys) | 3 (secret, publishable, webhook secret) |
| Env vars (prices) | 9 (3 monthly + 3 annual + 3 overage) |
| **Total env vars** | **13** |

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

When downgrading mid-cycle, `calls_used` is carried forward (not reset). If the customer has already used more calls than the new plan allows (e.g., used 80 calls on Growth, downgrades to Starter with 40-call limit):

- The downgrade proceeds immediately
- Subsequent calls are charged at the new plan's overage rate (calls are never blocked)
- `calls_used` resets to 0 at next billing cycle as normal

### Price ID mapping for plan changes

The plan change API needs access to all 9 price IDs to handle any combination:

```javascript
const PRICE_MAP = {
  starter:        { monthly: process.env.STRIPE_PRICE_STARTER,        annual: process.env.STRIPE_PRICE_STARTER_ANNUAL,  overage: process.env.STRIPE_PRICE_STARTER_OVERAGE },
  growth:         { monthly: process.env.STRIPE_PRICE_GROWTH,         annual: process.env.STRIPE_PRICE_GROWTH_ANNUAL,   overage: process.env.STRIPE_PRICE_GROWTH_OVERAGE },
  scale:          { monthly: process.env.STRIPE_PRICE_SCALE,          annual: process.env.STRIPE_PRICE_SCALE_ANNUAL,    overage: process.env.STRIPE_PRICE_SCALE_OVERAGE },
};
```

This enables any upgrade/downgrade path including billing interval changes (monthly ↔ annual). On plan change, the overage metered item is automatically updated by Stripe when the subscription items change.

---

## Overage Billing

When a tenant exceeds their plan's `calls_limit`, each additional call is charged at the plan's overage rate via Stripe metered billing.

### How it works

1. Each subscription has two line items: flat-rate plan price + metered overage price
2. `calls_used` is incremented via `increment_calls_used` RPC on every qualifying call
3. When `calls_used > calls_limit` (limit_exceeded), the call processor reports 1 usage unit to Stripe via `subscriptionItems.createUsageRecord()`
4. At the end of the billing cycle, Stripe tallies all usage records and adds them to the invoice

### Overage rates

| Plan | Overage rate |
|------|-------------|
| Starter | $2.48/call |
| Growth | $2.08/call |
| Scale | $1.50/call |

### Key behaviors

- **Calls are never blocked** — overages just cost money
- **During trial**: Usage records are accepted but invoiced at $0. After trial ends, overages are billed normally
- **Cycle reset**: `calls_used` resets to 0 on `invoice.paid` (billing_reason = subscription_cycle). Stripe metered usage also resets per billing period automatically
- **Idempotency**: Only reports to Stripe when `increment_calls_used` returns `success=true` (not on duplicate call_id)
- **Non-fatal**: Stripe reporting failure is logged but never blocks call processing

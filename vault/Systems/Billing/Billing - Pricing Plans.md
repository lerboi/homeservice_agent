---
type: system
system: Billing
status: legacy-app
description: "Pricing Plans. Covers: Stripe Price IDs (12 total)"
source: .claude/skills/payment-architecture/SKILL.md § 1. Pricing Plans
migrated: 2026-11-23
verified:
tags: [voco/system/billing]
---

# Pricing Plans

Part of [[Billing]]. Migrated verbatim from the `payment-architecture` skill; check `verified` before trusting details.

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

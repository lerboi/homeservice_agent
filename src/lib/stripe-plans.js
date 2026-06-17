// Shared Stripe plan constants — single source of truth for both
// the webhook handler and the verify-checkout fallback route.

// calls_limit is a PER-CYCLE quota measured against a counter that resets on every
// `subscription_cycle` invoice (see handleInvoicePaid in stripe/webhook/route.js).
// The metered overage price is MONTHLY for every plan — including annual plans, where
// it rides on the yearly flat price as a mixed-interval item (flexible billing mode).
// Stripe therefore emits a `subscription_cycle` invoice for the overage item EVERY
// MONTH, which resets calls_used monthly. So the annual limit MUST equal the monthly
// allotment, not the annual total. Setting annual to 480/1440/4800 (the ×12 figure)
// was a bug: usage reset monthly but was capped against the yearly number, so annual
// customers effectively got ~12× their calls before any overage metered — unbillable.
// The "480 / 1,440 / 4,800 calls per year" on the pricing page is just 40/120/400 × 12.
export const PLAN_MAP = {
  [process.env.STRIPE_PRICE_STARTER]:        { plan_id: 'starter', calls_limit: 40 },
  [process.env.STRIPE_PRICE_STARTER_ANNUAL]: { plan_id: 'starter', calls_limit: 40 },
  [process.env.STRIPE_PRICE_GROWTH]:         { plan_id: 'growth',  calls_limit: 120 },
  [process.env.STRIPE_PRICE_GROWTH_ANNUAL]:  { plan_id: 'growth',  calls_limit: 120 },
  [process.env.STRIPE_PRICE_SCALE]:          { plan_id: 'scale',   calls_limit: 400 },
  [process.env.STRIPE_PRICE_SCALE_ANNUAL]:   { plan_id: 'scale',   calls_limit: 400 },
};

export const OVERAGE_PRICE_IDS = new Set([
  process.env.STRIPE_PRICE_STARTER_OVERAGE,
  process.env.STRIPE_PRICE_GROWTH_OVERAGE,
  process.env.STRIPE_PRICE_SCALE_OVERAGE,
].filter(Boolean));

export const OVERAGE_MAP = {
  starter: process.env.STRIPE_PRICE_STARTER_OVERAGE,
  growth: process.env.STRIPE_PRICE_GROWTH_OVERAGE,
  scale: process.env.STRIPE_PRICE_SCALE_OVERAGE,
};

export const PLAN_NAMES = { starter: 'Starter', growth: 'Growth', scale: 'Scale' };

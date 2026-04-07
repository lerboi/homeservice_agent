// Shared Stripe plan constants — single source of truth for both
// the webhook handler and the verify-checkout fallback route.

export const PLAN_MAP = {
  [process.env.STRIPE_PRICE_STARTER]:        { plan_id: 'starter', calls_limit: 40 },
  [process.env.STRIPE_PRICE_STARTER_ANNUAL]: { plan_id: 'starter', calls_limit: 480 },
  [process.env.STRIPE_PRICE_GROWTH]:         { plan_id: 'growth',  calls_limit: 120 },
  [process.env.STRIPE_PRICE_GROWTH_ANNUAL]:  { plan_id: 'growth',  calls_limit: 1440 },
  [process.env.STRIPE_PRICE_SCALE]:          { plan_id: 'scale',   calls_limit: 400 },
  [process.env.STRIPE_PRICE_SCALE_ANNUAL]:   { plan_id: 'scale',   calls_limit: 4800 },
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

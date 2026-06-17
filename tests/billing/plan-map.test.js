/**
 * Regression guard for the annual-plan overage bug.
 *
 * calls_limit is a PER-BILLING-CYCLE quota. The metered overage price is MONTHLY for
 * every plan — including annual plans (mixed-interval, flexible billing) — so Stripe
 * emits a `subscription_cycle` invoice for the overage item every month, which resets
 * calls_used monthly (handleInvoicePaid). Therefore an annual plan's calls_limit MUST
 * equal its monthly counterpart's limit. Setting it to the ×12 annual figure
 * (480/1440/4800) reset usage monthly but capped against the yearly number, so annual
 * customers got ~12× their calls before overage metered — unbillable revenue.
 *
 * This test fails loudly if anyone "restores" the annual figures.
 */
import { describe, it, expect } from '@jest/globals';

// Env must be set before importing the module — PLAN_MAP is built from process.env at import time.
process.env.STRIPE_PRICE_STARTER = 'price_starter_monthly';
process.env.STRIPE_PRICE_GROWTH = 'price_growth_monthly';
process.env.STRIPE_PRICE_SCALE = 'price_scale_monthly';
process.env.STRIPE_PRICE_STARTER_ANNUAL = 'price_starter_annual';
process.env.STRIPE_PRICE_GROWTH_ANNUAL = 'price_growth_annual';
process.env.STRIPE_PRICE_SCALE_ANNUAL = 'price_scale_annual';
process.env.STRIPE_PRICE_STARTER_OVERAGE = 'price_starter_overage';
process.env.STRIPE_PRICE_GROWTH_OVERAGE = 'price_growth_overage';
process.env.STRIPE_PRICE_SCALE_OVERAGE = 'price_scale_overage';

const { PLAN_MAP, OVERAGE_MAP, OVERAGE_PRICE_IDS } = await import('@/lib/stripe-plans.js');

const PAIRS = [
  { plan: 'starter', monthly: 'price_starter_monthly', annual: 'price_starter_annual', limit: 40 },
  { plan: 'growth', monthly: 'price_growth_monthly', annual: 'price_growth_annual', limit: 120 },
  { plan: 'scale', monthly: 'price_scale_monthly', annual: 'price_scale_annual', limit: 400 },
];

describe('PLAN_MAP — annual quota matches monthly (per-cycle reset)', () => {
  it.each(PAIRS)('$plan: monthly limit is the expected per-cycle quota', ({ monthly, plan, limit }) => {
    expect(PLAN_MAP[monthly]).toEqual({ plan_id: plan, calls_limit: limit });
  });

  it.each(PAIRS)('$plan: annual limit EQUALS the monthly limit (not ×12)', ({ monthly, annual }) => {
    expect(PLAN_MAP[annual].calls_limit).toBe(PLAN_MAP[monthly].calls_limit);
  });

  it.each(PAIRS)('$plan: annual plan_id matches the monthly plan_id', ({ monthly, annual }) => {
    expect(PLAN_MAP[annual].plan_id).toBe(PLAN_MAP[monthly].plan_id);
  });

  it('no annual entry uses the legacy ×12 figures (480/1440/4800)', () => {
    const annualLimits = PAIRS.map((p) => PLAN_MAP[p.annual].calls_limit);
    expect(annualLimits).not.toContain(480);
    expect(annualLimits).not.toContain(1440);
    expect(annualLimits).not.toContain(4800);
  });
});

describe('OVERAGE_MAP / OVERAGE_PRICE_IDS', () => {
  it('maps each plan to its overage price', () => {
    expect(OVERAGE_MAP).toEqual({
      starter: 'price_starter_overage',
      growth: 'price_growth_overage',
      scale: 'price_scale_overage',
    });
  });

  it('recognizes overage price IDs', () => {
    expect(OVERAGE_PRICE_IDS.has('price_growth_overage')).toBe(true);
    expect(OVERAGE_PRICE_IDS.has('price_growth_monthly')).toBe(false);
  });
});

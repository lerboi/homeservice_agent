import Stripe from 'stripe';

let _stripe;

// Pin the Basil API version. Under Basil, current_period_start/_end moved from
// the Subscription to the subscription ITEM, and invoice.subscription moved to
// invoice.parent.subscription_details.subscription. Billing Meters (overage)
// require Basil. 2025-06-30.basil (same Basil family, additive monthly release)
// additionally enables flexible billing mode, which annual checkouts need so the
// MONTHLY metered overage price can attach to a YEARLY flat-rate subscription —
// verified in test mode 2026-06-12: classic-mode attach is rejected with
// "All prices on a subscription must have the same recurring.interval", flexible
// attach succeeds. ui_mode 'embedded' (NOT the dahlia-only 'embedded_page') is
// the valid embedded-checkout enum on every Basil release.
const STRIPE_API_VERSION = '2025-06-30.basil';

export function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
  }
  return _stripe;
}

// Named export for backward compat — lazy getter
export const stripe = new Proxy({}, {
  get(_, prop) {
    return getStripe()[prop];
  },
});

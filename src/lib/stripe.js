import Stripe from 'stripe';

let _stripe;

// Pin the Basil API version. Under 2025-03-31.basil, current_period_start/_end
// moved from the Subscription to the subscription ITEM, and invoice.subscription
// moved to invoice.parent.subscription_details.subscription. Billing Meters
// (overage) require Basil. Keep both constructors below in sync.
const STRIPE_API_VERSION = '2025-03-31.basil';

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

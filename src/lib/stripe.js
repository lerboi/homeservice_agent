import Stripe from 'stripe';

let _stripe;

export function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

// Named export for backward compat — lazy getter
export const stripe = new Proxy({}, {
  get(_, prop) {
    return getStripe()[prop];
  },
});

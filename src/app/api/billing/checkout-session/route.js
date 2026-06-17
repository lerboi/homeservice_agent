import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase as adminSupabase } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';

/**
 * POST /api/billing/checkout-session
 *
 * Creates a Stripe Checkout Session for plan upgrade/reactivation.
 * Used by the /billing/upgrade page when an expired tenant selects a new plan.
 *
 * Key differences from /api/onboarding/checkout-session:
 * - No trial_period_days (immediate billing — per Pitfall 4, BILLUI-04)
 * - success_url → /dashboard?upgraded=true
 * - cancel_url → /billing/upgrade
 * - Uses existing stripe_customer_id when available (per Pitfall 1)
 *
 * Body: { plan: 'starter' | 'growth' | 'scale', interval?: 'monthly' | 'annual' }
 * Returns: { url: string }
 */

const PRICE_MAP = {
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER,
    annual: process.env.STRIPE_PRICE_STARTER_ANNUAL,
    overage: process.env.STRIPE_PRICE_STARTER_OVERAGE,
  },
  growth: {
    monthly: process.env.STRIPE_PRICE_GROWTH,
    annual: process.env.STRIPE_PRICE_GROWTH_ANNUAL,
    overage: process.env.STRIPE_PRICE_GROWTH_OVERAGE,
  },
  scale: {
    monthly: process.env.STRIPE_PRICE_SCALE,
    annual: process.env.STRIPE_PRICE_SCALE_ANNUAL,
    overage: process.env.STRIPE_PRICE_SCALE_OVERAGE,
  },
};

export async function POST(request) {
  try {
    // 1. Authenticate user
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request body
    const { plan, interval = 'monthly' } = await request.json();

    // 3. Validate plan
    const planPrices = PRICE_MAP[plan];
    if (!planPrices) {
      return Response.json(
        { error: 'Invalid plan. Must be one of: starter, growth, scale' },
        { status: 400 },
      );
    }

    const priceId = interval === 'annual' ? planPrices.annual : planPrices.monthly;
    if (!priceId) {
      return Response.json(
        { error: `No ${interval} price configured for ${plan} plan` },
        { status: 400 },
      );
    }

    // 4. Look up tenant using service role client
    const { data: tenant, error: tenantError } = await adminSupabase
      .from('tenants')
      .select('id, owner_email, business_name')
      .eq('owner_id', user.id)
      .single();

    if (tenantError || !tenant) {
      return Response.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // 5. Look up existing Stripe customer ID + status from subscription
    const { data: existingSub } = await adminSupabase
      .from('subscriptions')
      .select('stripe_customer_id, status')
      .eq('tenant_id', tenant.id)
      .eq('is_current', true)
      .maybeSingle();

    // 5b. Guard: never create a second subscription while one is live.
    // Checkout would double-bill — plan changes go through the Billing Portal.
    if (existingSub && ['active', 'trialing', 'past_due'].includes(existingSub.status)) {
      return Response.json(
        {
          error:
            'You already have an active subscription. To change plans, use "Manage Subscription" on the billing page (Stripe Billing Portal).',
        },
        { status: 409 },
      );
    }

    // 6. Build line items — flat-rate plan only.
    // Metered overage price is added post-checkout in the webhook handler
    // because Checkout doesn't support mixing different billing intervals in
    // its line_items. Annual subscriptions must be created in flexible billing
    // mode (2025-06-30.basil+) or the webhook's monthly-overage attach is
    // rejected — verified in test mode 2026-06-12.
    const lineItems = [{ price: priceId, quantity: 1 }];

    // 7. Create Stripe Checkout Session — no trial period (upgrade/reactivation context)
    const sessionConfig = {
      mode: 'subscription',
      payment_method_collection: 'always',
      line_items: lineItems,
      subscription_data: {
        metadata: { tenant_id: tenant.id },
        // NO trial_period_days — immediate billing per Pitfall 4
        ...(interval === 'annual' ? { billing_mode: { type: 'flexible' } } : {}),
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/upgrade`,
      metadata: { tenant_id: tenant.id },
    };

    // Use existing Stripe customer if available; fall back to customer_email
    if (existingSub?.stripe_customer_id) {
      sessionConfig.customer = existingSub.stripe_customer_id;
    } else {
      sessionConfig.customer_email = tenant.owner_email;
    }

    // Idempotency guard (2026-06-12 audit M6): collapse duplicate parallel-tab
    // upgrade checkouts to a single Stripe session.
    const session = await stripe.checkout.sessions.create(sessionConfig, {
      idempotencyKey: `upgrade_checkout_${tenant.id}_${plan}_${interval}`,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('[billing/checkout-session] Failed to create session:', error);
    return Response.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}

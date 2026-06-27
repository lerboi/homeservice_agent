import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase as adminSupabase } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';

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
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request body
    const { plan, interval = 'monthly', embedded = false } = await request.json();

    // 3. Look up price ID from env var map
    const planPrices = PRICE_MAP[plan];
    if (!planPrices) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be one of: starter, growth, scale' },
        { status: 400 }
      );
    }
    const priceId = interval === 'annual' ? planPrices.annual : planPrices.monthly;
    if (!priceId) {
      return NextResponse.json(
        { error: `No ${interval} price configured for ${plan} plan` },
        { status: 400 }
      );
    }

    // 4. Look up tenant using service role client
    const { data: tenant, error: tenantError } = await adminSupabase
      .from('tenants')
      .select('id, owner_email, business_name')
      .eq('owner_id', user.id)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: 'Tenant not found. Please complete onboarding first.' },
        { status: 404 }
      );
    }

    // 4b. Guard: never create a second subscription while one is live.
    // A replayed/duplicated checkout step would double-bill the tenant.
    const { data: existingSub } = await adminSupabase
      .from('subscriptions')
      .select('status, stripe_customer_id')
      .eq('tenant_id', tenant.id)
      .eq('is_current', true)
      .maybeSingle();

    if (existingSub && ['active', 'trialing', 'past_due'].includes(existingSub.status)) {
      return NextResponse.json(
        { error: 'An active subscription already exists for this account.' },
        { status: 409 }
      );
    }

    // Trial-abuse guard (2026-06-12 audit M1): a tenant that has EVER had a
    // subscription (incl. canceled) gets no second free 14-day trial, and we
    // reuse its Stripe customer so Stripe's own repeat-trial detection applies —
    // a fresh customer each time previously defeated it. First-timers still trial.
    const hasPriorSubscription = Boolean(existingSub);
    const reuseCustomerId = existingSub?.stripe_customer_id || null;

    // 5. Build line items — flat-rate plan only.
    // Metered overage price is added post-checkout in the webhook handler
    // because Checkout doesn't support mixing different billing intervals in
    // its line_items. Annual subscriptions must be created in flexible billing
    // mode (2025-06-30.basil+) or the webhook's monthly-overage attach is
    // rejected ("All prices on a subscription must have the same
    // recurring.interval") — verified in test mode 2026-06-12.
    const lineItems = [{ price: priceId, quantity: 1 }];

    // 6. Create Stripe Checkout Session
    const sessionConfig = {
      mode: 'subscription',
      payment_method_collection: 'always', // D-03: CC required
      line_items: lineItems,
      subscription_data: {
        ...(hasPriorSubscription ? {} : { trial_period_days: 14 }),
        metadata: { tenant_id: tenant.id }, // Critical: webhook uses this to find tenant
        ...(interval === 'annual' ? { billing_mode: { type: 'flexible' } } : {}),
      },
      // customer and customer_email are mutually exclusive — reuse the existing
      // Stripe customer when re-subscribing (M1), else create one from email.
      // Fall back to the auth email: owner_email is only written at the contact
      // step, so a user who reaches checkout without it would otherwise create a
      // Stripe customer with no email (broken receipts).
      ...(reuseCustomerId ? { customer: reuseCustomerId } : { customer_email: tenant.owner_email || user.email }),
      metadata: { tenant_id: tenant.id }, // On session too for checkout.session.completed
    };

    if (embedded) {
      // Embedded checkout — returns client_secret, uses return_url.
      // 'embedded' is the Basil enum; 'embedded_page' exists only on
      // 2026-03-25.dahlia and is rejected under our Basil pin (verified in
      // test mode 2026-06-12 — the prior value broke session creation).
      sessionConfig.ui_mode = 'embedded';
      sessionConfig.return_url = `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/checkout?session_id={CHECKOUT_SESSION_ID}`;
    } else {
      // Hosted checkout — returns url, uses success_url/cancel_url
      sessionConfig.success_url = `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/checkout?session_id={CHECKOUT_SESSION_ID}`;
      sessionConfig.cancel_url = `${process.env.NEXT_PUBLIC_APP_URL}/pricing`;
    }

    // Idempotency guard (2026-06-12 audit M6): two parallel tabs with the same
    // plan/interval collapse to ONE Stripe session instead of two subscriptions
    // double-billing the tenant.
    const session = await stripe.checkout.sessions.create(sessionConfig, {
      idempotencyKey: `onboarding_checkout_${tenant.id}_${plan}_${interval}_${embedded ? 'emb' : 'hosted'}`,
    });

    // 6. Return appropriate response
    if (embedded) {
      return NextResponse.json({ clientSecret: session.client_secret, sessionId: session.id });
    }
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Failed to create checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

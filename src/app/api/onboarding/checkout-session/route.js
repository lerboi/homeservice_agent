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

    // 5. Build line items — flat-rate plan + metered overage component
    const lineItems = [{ price: priceId, quantity: 1 }];
    const overagePriceId = planPrices.overage;
    if (overagePriceId) {
      // Metered prices don't take a quantity — Stripe bills based on usage records
      lineItems.push({ price: overagePriceId });
    }

    // 6. Create Stripe Checkout Session
    const sessionConfig = {
      mode: 'subscription',
      payment_method_collection: 'always', // D-03: CC required
      line_items: lineItems,
      subscription_data: {
        trial_period_days: 14,
        metadata: { tenant_id: tenant.id }, // Critical: webhook uses this to find tenant
      },
      customer_email: tenant.owner_email,
      metadata: { tenant_id: tenant.id }, // On session too for checkout.session.completed
    };

    if (embedded) {
      // Embedded checkout — returns client_secret, uses return_url
      sessionConfig.ui_mode = 'embedded_page';
      sessionConfig.return_url = `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/checkout?session_id={CHECKOUT_SESSION_ID}`;
    } else {
      // Hosted checkout — returns url, uses success_url/cancel_url
      sessionConfig.success_url = `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/checkout?session_id={CHECKOUT_SESSION_ID}`;
      sessionConfig.cancel_url = `${process.env.NEXT_PUBLIC_APP_URL}/pricing`;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    // 6. Return appropriate response
    if (embedded) {
      return NextResponse.json({ clientSecret: session.client_secret });
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

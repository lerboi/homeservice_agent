import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase as adminSupabase } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';

const PRICE_MAP = {
  starter: process.env.STRIPE_PRICE_STARTER,
  growth: process.env.STRIPE_PRICE_GROWTH,
  scale: process.env.STRIPE_PRICE_SCALE,
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
    const { plan } = await request.json();

    // 3. Look up price ID from env var map
    const priceId = PRICE_MAP[plan];
    if (!priceId) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be one of: starter, growth, scale' },
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

    // 5. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_collection: 'always', // D-03: CC required
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { tenant_id: tenant.id }, // Critical: webhook uses this to find tenant
      },
      customer_email: tenant.owner_email,
      metadata: { tenant_id: tenant.id }, // On session too for checkout.session.completed
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/plan`,
    });

    // 6. Return Checkout URL
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Failed to create checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

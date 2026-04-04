import { createSupabaseServer } from '@/lib/supabase-server';

/**
 * GET /api/billing/data
 *
 * Returns the current subscription and plan details for the authenticated tenant.
 * Consolidates the billing page's direct Supabase queries into a server-side route.
 *
 * Response: { subscription: {...} | null }
 */
export async function GET() {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!tenant) {
    return Response.json({ error: 'No tenant found' }, { status: 404 });
  }

  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select(
      'status, plan_id, calls_used, calls_limit, trial_ends_at, current_period_end, cancel_at_period_end, stripe_price_id'
    )
    .eq('tenant_id', tenant.id)
    .eq('is_current', true)
    .maybeSingle();

  if (subError) {
    return Response.json({ error: subError.message }, { status: 500 });
  }

  // Determine billing interval from the Stripe price ID
  let billing_interval = 'monthly';
  if (subscription?.stripe_price_id) {
    const annualPriceIds = [
      process.env.STRIPE_PRICE_STARTER_ANNUAL,
      process.env.STRIPE_PRICE_GROWTH_ANNUAL,
      process.env.STRIPE_PRICE_SCALE_ANNUAL,
    ].filter(Boolean);
    if (annualPriceIds.includes(subscription.stripe_price_id)) {
      billing_interval = 'annual';
    }
  }

  return Response.json({
    subscription: subscription ? { ...subscription, billing_interval } : null,
  });
}

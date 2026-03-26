import { stripe } from '@/lib/stripe';
import { createSupabaseServer } from '@/lib/supabase-server';

/**
 * GET /api/billing/portal
 *
 * Generates a Stripe Customer Portal session and redirects the user to it.
 * Used by BillingWarningBanner "Update Payment Method" link.
 *
 * Returns 303 redirect to Stripe portal URL on success.
 * Returns JSON error on auth failure or missing subscription.
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

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('tenant_id', tenant.id)
    .eq('is_current', true)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return Response.json({ error: 'No active subscription found' }, { status: 404 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  });

  return Response.redirect(session.url, 303);
}

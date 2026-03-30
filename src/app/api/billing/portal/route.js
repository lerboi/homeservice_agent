import { stripe } from '@/lib/stripe';
import { createSupabaseServer } from '@/lib/supabase-server';

/**
 * GET /api/billing/portal
 *
 * Generates a Stripe Customer Portal session and redirects the user to it.
 * Used by BillingWarningBanner "Update Payment Method" link and billing dashboard.
 *
 * Accepts optional ?return_url= query parameter to control where Stripe redirects
 * the user after portal interaction. Defaults to /dashboard/more/billing.
 *
 * Returns 303 redirect to Stripe portal URL on success.
 * Returns JSON error on auth failure or missing subscription.
 */
export async function GET(request) {
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

  // Parse optional return_url query param; default to billing page per Pitfall 5
  const { searchParams } = new URL(request.url);
  const ALLOWED_RETURNS = ['/dashboard', '/dashboard/more/billing'];
  const returnPath = ALLOWED_RETURNS.includes(searchParams.get('return_url'))
    ? searchParams.get('return_url')
    : '/dashboard/more/billing';

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}${returnPath}`,
  });

  return Response.redirect(session.url, 303);
}

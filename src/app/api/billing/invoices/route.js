import { stripe } from '@/lib/stripe';
import { createSupabaseServer } from '@/lib/supabase-server';

/**
 * GET /api/billing/invoices
 *
 * Returns the 5 most recent invoices for the authenticated tenant.
 * Used by the billing dashboard page to show inline invoice history.
 *
 * CRITICAL per Pitfall 1: Uses customer ID (not subscription ID) for invoice lookup.
 * The stripe_customer_id is stored in the subscriptions table.
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
    // No subscription yet — return empty list (not an error)
    return Response.json({ invoices: [] });
  }

  const invoicesResult = await stripe.invoices.list({
    customer: sub.stripe_customer_id,
    limit: 5,
  });

  const formatted = invoicesResult.data.map((inv) => ({
    id: inv.id,
    date: inv.created, // Unix timestamp
    amount: inv.amount_paid || inv.total, // in cents
    currency: inv.currency,
    status: inv.status, // 'paid', 'open', 'uncollectible', 'void'
    hosted_invoice_url: inv.hosted_invoice_url,
  }));

  return Response.json({ invoices: formatted });
}

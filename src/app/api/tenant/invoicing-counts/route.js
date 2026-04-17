import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/tenant/invoicing-counts
 *
 * Returns the count of invoices + estimates for the authenticated tenant.
 * Used by the Features panel flip-off dialog to decide whether to prompt
 * the user before disabling invoicing.
 *
 * Intentionally NOT gated by the invoicing flag — the Features panel needs
 * counts to render the dialog at the moment of flip-off (when invoicing is
 * still currently true, but about to be flipped). Counts of 0 are valid
 * answers; the panel uses 0 to skip the dialog and flip silently.
 *
 * Cross-tenant guard: getTenantId() scopes the query to the authenticated
 * tenant. The .eq('tenant_id', tenantId) filters rows server-side.
 */
export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch both counts in parallel — head:true returns count without rows.
  const [invoicesResult, estimatesResult] = await Promise.all([
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    supabase
      .from('estimates')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
  ]);

  if (invoicesResult.error || estimatesResult.error) {
    const err = invoicesResult.error || estimatesResult.error;
    return Response.json({ error: err.message }, { status: 500 });
  }

  return Response.json({
    invoices: invoicesResult.count ?? 0,
    estimates: estimatesResult.count ?? 0,
  });
}

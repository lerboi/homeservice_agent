import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';
import { INVOICING_ENABLED } from '@/lib/invoicing-enabled';

/**
 * PATCH /api/tenant/features
 *
 * Updates tenants.features_enabled for the authenticated owner's tenant.
 * Body shape: { features: { invoicing: boolean } }
 *
 * Validation (T-53-06): invoicing MUST be a boolean. Any other type returns 400.
 * Write shape (T-53-06): only the controlled `{ invoicing: features.invoicing }`
 * is written — the route does NOT spread the body into the column, so an attacker
 * cannot inject arbitrary keys.
 *
 * Cross-tenant guard (T-53-01): getTenantId() resolves the authenticated user's
 * tenant ONLY. The UPDATE clause uses that resolved tenantId, so writes cannot
 * affect another tenant.
 *
 * NOT gated by invoicing flag — this endpoint is the ONLY way to flip the flag
 * back on after disabling, so it must remain accessible regardless of state.
 */
export async function PATCH(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const features = body?.features;
  if (!features || typeof features !== 'object') {
    return Response.json(
      { error: 'Invalid: body.features must be an object' },
      { status: 400 }
    );
  }
  if (typeof features.invoicing !== 'boolean') {
    return Response.json(
      { error: 'Invalid: features.invoicing must be a boolean' },
      { status: 400 }
    );
  }

  // v1 freeze: enabling invoicing is gated behind the global master flag so
  // the two invoicing crons could be unscheduled from vercel.json without
  // leaving a trap (a tenant enabling a feature whose background half —
  // reminders, late fees, overdue flips, recurring generation — never runs).
  // Disabling (`false`) is always allowed so any already-enabled tenant can
  // still turn it off. See src/lib/invoicing-enabled.js for the re-enable
  // checklist.
  if (features.invoicing === true && !INVOICING_ENABLED) {
    return Response.json(
      { error: 'Invoicing is not available yet' },
      { status: 403 }
    );
  }

  // Controlled write — only the invoicing key is persisted. Future flags
  // are added in future phases by extending this object literal.
  const { data, error } = await supabase
    .from('tenants')
    .update({ features_enabled: { invoicing: features.invoicing } })
    .eq('id', tenantId)
    .select('features_enabled')
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ features_enabled: data.features_enabled });
}

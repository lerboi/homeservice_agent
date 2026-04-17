import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

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

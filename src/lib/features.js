import { supabase } from '@/lib/supabase';

/**
 * Returns the per-tenant feature flags from `tenants.features_enabled`.
 *
 * Uses the service-role client so this helper is safe in cron contexts (no session)
 * AND in API routes (caller already validated session via `getTenantId()`).
 *
 * Defaults to `{ invoicing: false }` if the row is missing, the read errors, or the
 * column is null — fail-closed so a DB outage cannot accidentally enable a flag.
 *
 * @param {string} tenantId
 * @returns {Promise<{invoicing: boolean}>}
 */
export async function getTenantFeatures(tenantId) {
  if (!tenantId) return { invoicing: false };

  const { data, error } = await supabase
    .from('tenants')
    .select('features_enabled')
    .eq('id', tenantId)
    .single();

  if (error || !data) return { invoicing: false };

  return {
    invoicing: data.features_enabled?.invoicing === true,
    // Future flags extend here, e.g.:
    //   xero: data.features_enabled?.xero === true,
    //   jobber: data.features_enabled?.jobber === true,
  };
}

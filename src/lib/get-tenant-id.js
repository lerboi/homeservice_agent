import { createSupabaseServer } from '@/lib/supabase-server';

/**
 * Authenticate the current user and resolve their tenant_id.
 *
 * Uses the session-scoped (anon) client for both auth and tenant lookup
 * so that RLS enforces tenant isolation as defence-in-depth.
 *
 * @returns {Promise<string|null>} tenant_id or null if unauthenticated / no tenant
 */
export async function getTenantId() {
  const serverSupabase = await createSupabaseServer();
  const { data: { user } } = await serverSupabase.auth.getUser();
  if (!user) return null;

  const { data: tenant } = await serverSupabase
    .from('tenants')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  return tenant?.id || null;
}

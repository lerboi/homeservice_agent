import { supabase } from '@/lib/supabase';
import { createSupabaseServer } from '@/lib/supabase-server';

/**
 * Authenticate the current user and resolve their tenant_id.
 *
 * Looks up tenants table by owner_id (not user_metadata) because
 * tenant_id is never stored in Supabase auth user_metadata.
 *
 * @returns {Promise<string|null>} tenant_id or null if unauthenticated / no tenant
 */
export async function getTenantId() {
  const serverSupabase = await createSupabaseServer();
  const { data: { user } } = await serverSupabase.auth.getUser();
  if (!user) return null;

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  return tenant?.id || null;
}

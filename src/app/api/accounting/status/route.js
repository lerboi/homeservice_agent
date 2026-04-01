import { createSupabaseServer } from '@/lib/supabase-server';
import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/accounting/status
 * Returns the connection status of all accounting integrations for the tenant.
 */
export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: connections, error } = await supabase
    .from('accounting_credentials')
    .select('provider, display_name, connected_at, last_synced_at')
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[accounting-status] Fetch failed:', error.message);
    return Response.json({ error: 'Failed to fetch status' }, { status: 500 });
  }

  return Response.json({ connections: connections || [] });
}

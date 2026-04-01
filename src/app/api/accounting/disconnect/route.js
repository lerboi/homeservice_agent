import { createSupabaseServer } from '@/lib/supabase-server';
import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';
import { PROVIDERS } from '@/lib/accounting/types';

/**
 * POST /api/accounting/disconnect
 * Disconnects an accounting integration by deleting stored credentials.
 * Body: { provider: 'quickbooks' | 'xero' | 'freshbooks' }
 */
export async function POST(request) {
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

  const { provider } = body;

  if (!provider || !PROVIDERS.includes(provider)) {
    return Response.json(
      { error: `Invalid provider. Must be one of: ${PROVIDERS.join(', ')}` },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('accounting_credentials')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('provider', provider);

  if (error) {
    console.error('[accounting-disconnect] Delete failed:', error.message);
    return Response.json({ error: 'Failed to disconnect' }, { status: 500 });
  }

  return Response.json({ success: true });
}

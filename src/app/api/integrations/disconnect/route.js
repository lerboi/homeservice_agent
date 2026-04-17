/**
 * POST /api/integrations/disconnect
 *
 * Revokes the upstream OAuth token (best-effort) and deletes the credential row.
 * Calls revalidateTag so the cached getIntegrationStatus reader invalidates.
 *
 * Body: { provider: 'xero' | 'jobber' }
 *
 * Upstream revoke is best-effort — if the provider's revoke endpoint fails,
 * the local row is still deleted (owner's intent was "disconnect locally
 * regardless of upstream state"). Failure is logged, not propagated.
 */

import { revalidateTag } from 'next/cache';
import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';
import { getIntegrationAdapter } from '@/lib/integrations/adapter';
import { PROVIDERS } from '@/lib/integrations/types';

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

  const { provider } = body || {};
  if (!provider || !PROVIDERS.includes(provider)) {
    return Response.json(
      { error: `Invalid provider. Must be one of: ${PROVIDERS.join(', ')}` },
      { status: 400 },
    );
  }

  // Load existing credential row so the adapter can revoke upstream before we delete.
  const { data: credential } = await supabase
    .from('accounting_credentials')
    .select('access_token, refresh_token, expiry_date, xero_tenant_id')
    .eq('tenant_id', tenantId)
    .eq('provider', provider)
    .maybeSingle();

  // Best-effort upstream revoke. Jobber throws NotImplementedError — log + continue.
  if (credential) {
    try {
      const adapter = await getIntegrationAdapter(provider);
      await adapter.revoke({
        access_token: credential.access_token,
        refresh_token: credential.refresh_token,
        expiry_date: credential.expiry_date,
        xero_tenant_id: credential.xero_tenant_id,
      });
    } catch (err) {
      console.error(`[integrations-disconnect] ${provider} revoke failed (non-fatal):`, err?.message || err);
    }
  }

  const { error: deleteError } = await supabase
    .from('accounting_credentials')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('provider', provider);

  if (deleteError) {
    console.error(`[integrations-disconnect] ${provider} delete failed:`, deleteError.message);
    return Response.json({ error: 'Failed to disconnect' }, { status: 500 });
  }

  revalidateTag(`integration-status-${tenantId}`);
  revalidateTag(`${provider}-context-${tenantId}`);

  return Response.json({ success: true });
}

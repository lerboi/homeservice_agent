import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { provider } = await request.json();
    if (!provider || !['google', 'outlook'].includes(provider)) {
      return Response.json({ error: 'Invalid provider' }, { status: 400 });
    }

    // Verify the provider is actually connected
    const { data: cred } = await supabase
      .from('calendar_credentials')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('provider', provider)
      .single();

    if (!cred) {
      return Response.json({ error: 'Provider not connected' }, { status: 400 });
    }

    // Set all to false, then set chosen to true
    await supabase.from('calendar_credentials')
      .update({ is_primary: false })
      .eq('tenant_id', tenantId);

    await supabase.from('calendar_credentials')
      .update({ is_primary: true })
      .eq('tenant_id', tenantId)
      .eq('provider', provider);

    return Response.json({ primary: provider });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      console.log('401: Unauthorized');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { provider } = await request.json();
    if (!provider || !['google', 'outlook'].includes(provider)) {
      console.log('400: Invalid provider');
      return Response.json({ error: 'Invalid provider' }, { status: 400 });
    }

    // Check if disconnecting provider is primary
    const { data: cred } = await supabase
      .from('calendar_credentials')
      .select('is_primary')
      .eq('tenant_id', tenantId)
      .eq('provider', provider)
      .single();

    const wasPrimary = cred?.is_primary;

    // Disconnect the specified provider
    if (provider === 'google') {
      try {
        const { revokeAndDisconnect } = await import('@/lib/scheduling/google-calendar.js');
        await revokeAndDisconnect(tenantId);
      } catch {
        await supabase.from('calendar_credentials').delete()
          .eq('tenant_id', tenantId).eq('provider', 'google');
        await supabase.from('calendar_events').delete()
          .eq('tenant_id', tenantId).eq('provider', 'google');
      }
    } else {
      try {
        const { revokeAndDisconnectOutlook } = await import('@/lib/scheduling/outlook-calendar.js');
        await revokeAndDisconnectOutlook(tenantId);
      } catch {
        await supabase.from('calendar_credentials').delete()
          .eq('tenant_id', tenantId).eq('provider', 'outlook');
        await supabase.from('calendar_events').delete()
          .eq('tenant_id', tenantId).eq('provider', 'outlook');
      }
    }

    // Auto-promote remaining provider if disconnected was primary (D-04)
    if (wasPrimary) {
      const otherProvider = provider === 'google' ? 'outlook' : 'google';
      await supabase.from('calendar_credentials')
        .update({ is_primary: true })
        .eq('tenant_id', tenantId)
        .eq('provider', otherProvider);
    }

    return Response.json({ disconnected: true });
  } catch (err) {
    console.log('500:', err.message, err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

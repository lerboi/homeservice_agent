import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

// revokeAndDisconnect is imported from google-calendar.js when it exists.
// We do a dynamic import so that this route can be called even before the
// google-calendar lib is fully wired up (e.g., missing env vars won't crash the module).
async function revokeAndDisconnect(tenantId) {
  try {
    const { revokeAndDisconnect: revoke } = await import('@/lib/google-calendar');
    await revoke(tenantId, supabase);
    return;
  } catch {
    // Fallback: delete the credentials row directly if lib not available
    await supabase
      .from('calendar_credentials')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('provider', 'google');
  }
}

export async function POST() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    await revokeAndDisconnect(tenantId);

    return Response.json({ disconnected: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

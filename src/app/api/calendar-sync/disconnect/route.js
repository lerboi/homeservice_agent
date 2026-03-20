import { createSupabaseServer } from '@/lib/supabase-server';

async function getAuthContext() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, tenantId: null, supabase };
  const tenantId = user.user_metadata?.tenant_id || null;
  return { user, tenantId, supabase };
}

// revokeAndDisconnect is imported from google-calendar.js when it exists.
// We do a dynamic import so that this route can be called even before the
// google-calendar lib is fully wired up (e.g., missing env vars won't crash the module).
async function revokeAndDisconnect(tenantId, supabase) {
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
    const { tenantId, supabase } = await getAuthContext();
    if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    await revokeAndDisconnect(tenantId, supabase);

    return Response.json({ disconnected: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

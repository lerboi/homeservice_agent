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

export async function GET() {
  try {
    const { tenantId, supabase } = await getAuthContext();
    if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('calendar_credentials')
      .select('calendar_name, last_synced_at, created_at')
      .eq('tenant_id', tenantId)
      .eq('provider', 'google')
      .maybeSingle();

    if (error) return Response.json({ error: error.message }, { status: 500 });

    if (!data) {
      return Response.json({ connected: false });
    }

    return Response.json({
      connected: true,
      calendar_name: data.calendar_name,
      last_synced_at: data.last_synced_at,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

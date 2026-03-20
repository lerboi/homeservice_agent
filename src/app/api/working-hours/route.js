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
      .from('tenants')
      .select('working_hours, slot_duration_mins, tenant_timezone')
      .eq('id', tenantId)
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({
      working_hours: data.working_hours,
      slot_duration_mins: data.slot_duration_mins,
      tenant_timezone: data.tenant_timezone,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { tenantId, supabase } = await getAuthContext();
    if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { working_hours, slot_duration_mins, tenant_timezone } = await request.json();

    const updates = {};
    if (working_hours !== undefined) updates.working_hours = working_hours;
    if (slot_duration_mins !== undefined) updates.slot_duration_mins = slot_duration_mins;
    if (tenant_timezone !== undefined) updates.tenant_timezone = tenant_timezone;

    const { data, error } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', tenantId)
      .select('working_hours, slot_duration_mins, tenant_timezone')
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({
      working_hours: data.working_hours,
      slot_duration_mins: data.slot_duration_mins,
      tenant_timezone: data.tenant_timezone,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

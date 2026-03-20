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

export async function PUT(request, { params }) {
  try {
    const { tenantId, supabase } = await getAuthContext();
    if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { name, postal_codes } = await request.json();

    if (!name?.trim()) {
      return Response.json({ error: 'Zone name is required' }, { status: 400 });
    }

    const updates = {
      name: name.trim(),
    };
    if (postal_codes !== undefined) updates.postal_codes = postal_codes;

    const { data, error } = await supabase
      .from('service_zones')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('id, name, postal_codes, created_at')
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!data) return Response.json({ error: 'Zone not found' }, { status: 404 });

    return Response.json({ zone: data });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { tenantId, supabase } = await getAuthContext();
    if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const { error } = await supabase
      .from('service_zones')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ deleted: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

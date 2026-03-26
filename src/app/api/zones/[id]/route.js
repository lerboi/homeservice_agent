import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

export async function PUT(request, { params }) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      console.log('401: Unauthorized');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { name, postal_codes } = await request.json();

    if (!name?.trim()) {
      console.log('400: Zone name is required');
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

    if (error) {
      console.log('500:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      console.log('404: Zone not found');
      return Response.json({ error: 'Zone not found' }, { status: 404 });
    }

    return Response.json({ zone: data });
  } catch (err) {
    console.log('500:', err.message, err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      console.log('401: Unauthorized');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { error } = await supabase
      .from('service_zones')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      console.log('500:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ deleted: true });
  } catch (err) {
    console.log('500:', err.message, err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

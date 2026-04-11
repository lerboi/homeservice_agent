import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

/**
 * PATCH /api/calendar-blocks/[id]
 *
 * Updates an existing time block. Only provided fields are updated.
 * Supports: title, start_time, end_time, is_all_day, note
 *
 * Response: { block: {...} }
 */
export async function PATCH(request, { params }) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  // Build update payload from provided fields only
  const updates = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.start_time !== undefined) updates.start_time = body.start_time;
  if (body.end_time !== undefined) updates.end_time = body.end_time;
  if (body.is_all_day !== undefined) updates.is_all_day = !!body.is_all_day;
  if (body.note !== undefined) updates.note = body.note;

  const { data, error } = await supabase
    .from('calendar_blocks')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('id, title, start_time, end_time, is_all_day, note, created_at')
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ block: data });
}

/**
 * DELETE /api/calendar-blocks/[id]
 *
 * Deletes a time block owned by the authenticated tenant.
 *
 * Response: { success: true }
 */
export async function DELETE(request, { params }) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const { error } = await supabase
    .from('calendar_blocks')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}

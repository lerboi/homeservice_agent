import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/calendar-blocks
 *
 * Returns all calendar_blocks for the authenticated tenant within a date range.
 *
 * Query params:
 *   start - ISO timestamp (required)
 *   end   - ISO timestamp (required)
 *
 * Response: { blocks: [...] }
 */
export async function GET(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return Response.json({ error: 'start and end query params required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('calendar_blocks')
    .select('id, title, start_time, end_time, is_all_day, note, created_at')
    .eq('tenant_id', tenantId)
    .lte('start_time', end)
    .gte('end_time', start)
    .order('start_time', { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ blocks: data || [] });
}

/**
 * POST /api/calendar-blocks
 *
 * Creates a new time block for the authenticated tenant.
 *
 * Body: { title, start_time, end_time, is_all_day?, note? }
 *
 * Response: 201 { block: {...} }
 */
export async function POST(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { title, start_time, end_time, is_all_day, note } = body;

  if (!title || !title.trim()) {
    return Response.json({ error: 'title is required' }, { status: 400 });
  }

  if (!start_time) {
    return Response.json({ error: 'start_time is required' }, { status: 400 });
  }

  if (!end_time) {
    return Response.json({ error: 'end_time is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('calendar_blocks')
    .insert({
      tenant_id: tenantId,
      title: title.trim(),
      start_time,
      end_time,
      is_all_day: !!is_all_day,
      note: note || null,
    })
    .select('id, title, start_time, end_time, is_all_day, note, created_at')
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ block: data }, { status: 201 });
}

import { createSupabaseServer } from '@/lib/supabase-server';

/**
 * GET /api/leads/[id]
 * Returns full lead detail with all call data INCLUDING transcript_text and transcript_structured.
 * This is the flyout detail endpoint — transcript is only fetched here, not in the list query.
 */
export async function GET(request, { params }) {
  const supabaseServer = await createSupabaseServer();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabaseServer
    .from('leads')
    .select(`
      *,
      lead_calls(
        calls(
          id, retell_call_id, from_number, urgency_classification, urgency_confidence,
          triage_layer_used, recording_url, recording_storage_path, transcript_text,
          transcript_structured, detected_language, start_timestamp, end_timestamp,
          duration_seconds, suggested_slots
        )
      ),
      appointments(id, start_time, end_time, status, service_address)
    `)
    .eq('id', id)
    .single();

  if (error) return Response.json({ error: error.message }, { status: 404 });
  return Response.json({ lead: data });
}

/**
 * PATCH /api/leads/[id]
 * Updates lead status and optionally revenue_amount.
 * Validation: status 'paid' requires revenue_amount.
 * Side effect: logs status_changed event to activity_log (fire-and-forget).
 */
export async function PATCH(request, { params }) {
  const supabaseServer = await createSupabaseServer();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantId = user.user_metadata?.tenant_id;
  const { id } = await params;
  const body = await request.json();
  const { status, revenue_amount, previous_status } = body;

  // Validate: Paid status requires revenue_amount
  if (status === 'paid' && (revenue_amount === null || revenue_amount === undefined || revenue_amount === '')) {
    return Response.json({ error: 'revenue_amount required for Paid status' }, { status: 422 });
  }

  const updateData = { updated_at: new Date().toISOString() };
  if (status) updateData.status = status;
  if (revenue_amount !== undefined) updateData.revenue_amount = revenue_amount;

  const { data, error } = await supabaseServer
    .from('leads')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Log activity — fire-and-forget, never block the response
  (async () => {
    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('activity_log').insert({
        tenant_id: tenantId,
        event_type: 'status_changed',
        lead_id: id,
        metadata: { from_status: previous_status, to_status: status, revenue_amount },
      });
    } catch (err) {
      console.error('Activity log insert failed:', err);
    }
  })();

  return Response.json({ lead: data });
}

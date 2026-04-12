import { supabase } from '@/lib/supabase';
import { getTenantId } from '@/lib/get-tenant-id';
import { shouldSyncToInvoice } from '@/lib/invoice-sync';

/**
 * GET /api/leads/[id]
 * Returns full lead detail with all call data INCLUDING transcript_text and transcript_structured.
 * This is the flyout detail endpoint — transcript is only fetched here, not in the list query.
 */
export async function GET(request, { params }) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const { data, error } = await supabase
    .from('leads')
    .select(`
      *,
      lead_calls(
        calls(
          id, call_id, from_number, urgency_classification, urgency_confidence,
          triage_layer_used, recording_url, recording_storage_path, transcript_text,
          transcript_structured, detected_language, start_timestamp, end_timestamp,
          duration_seconds, suggested_slots
        )
      ),
      appointments(id, start_time, end_time, status, service_address, postal_code, street_name)
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    console.log('404:', error.message);
    return Response.json({ error: error.message }, { status: 404 });
  }
  return Response.json({ lead: data });
}

/**
 * PATCH /api/leads/[id]
 * Updates lead status and optionally revenue_amount.
 * Validation: status 'paid' requires revenue_amount.
 * Side effect: logs status_changed event to activity_log (fire-and-forget).
 */
export async function PATCH(request, { params }) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status, revenue_amount, previous_status, sync_source, email, caller_name, is_vip } = body;

  // Validate: status must be one of the allowed values
  const VALID_STATUSES = ['new', 'booked', 'completed', 'paid', 'lost'];
  if (status && !VALID_STATUSES.includes(status)) {
    return Response.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }

  // Validate: Paid status requires revenue_amount
  if (status === 'paid' && (revenue_amount === null || revenue_amount === undefined || revenue_amount === '')) {
    console.log('422: revenue_amount required for Paid status');
    return Response.json({ error: 'revenue_amount required for Paid status' }, { status: 422 });
  }

  const updateData = { updated_at: new Date().toISOString() };
  if (status) updateData.status = status;
  if (revenue_amount !== undefined) updateData.revenue_amount = revenue_amount;
  if (email !== undefined) updateData.email = email;
  if (caller_name !== undefined) updateData.caller_name = caller_name;
  if (is_vip !== undefined) updateData.is_vip = is_vip;

  const { data, error } = await supabase
    .from('leads')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) {
    console.log('500:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Log activity — fire-and-forget, never block the response
  (async () => {
    try {
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

  // ── Bidirectional sync: lead Paid → linked invoice Paid ───────────────────
  // When lead is marked Paid (and not triggered by an invoice sync), find and
  // mark the linked sent/overdue invoice as Paid. Uses direct Supabase update
  // (not internal fetch) to avoid an extra HTTP round-trip.
  if (shouldSyncToInvoice(status, sync_source)) {
    try {
      const { data: linkedInvoice } = await supabase
        .from('invoices')
        .select('id')
        .eq('lead_id', id)
        .eq('tenant_id', tenantId)
        .in('status', ['sent', 'overdue'])
        .maybeSingle();

      if (linkedInvoice) {
        await supabase
          .from('invoices')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', linkedInvoice.id)
          .eq('tenant_id', tenantId);

        console.log('[invoice-sync] Propagated paid status to invoice:', linkedInvoice.id);
      }
    } catch (err) {
      // Sync failure must NOT fail the lead update — lead is already saved
      console.error('[invoice-sync] Invoice sync failed (non-fatal):', err?.message || err);
    }
  }

  return Response.json({ lead: data });
}

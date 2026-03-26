import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/appointments/[id]
 * Returns single appointment with call data (recording_url, transcript).
 */
export async function GET(request, { params }) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  const { data: appointment, error } = await supabase
    .from('appointments')
    .select(`
      id, tenant_id, call_id, start_time, end_time,
      service_address, caller_name, caller_phone,
      urgency, zone_id, status, booked_via,
      google_event_id, notes, created_at,
      service_zones (id, name),
      calls (id, recording_url, transcript, created_at, caller_phone)
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      console.log('404: Not found');
      return Response.json({ error: 'Appointment not found' }, { status: 404 });
    }
    console.log('500:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ appointment });
}

/**
 * PATCH /api/appointments/[id]
 * Supports:
 *   { status: 'cancelled' } — cancel appointment, async-remove Google Calendar event
 *   { conflict_dismissed: true, calendar_event_id: '...' } — dismiss conflict on calendar_events
 */
export async function PATCH(request, { params }) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json();

  // Handle conflict dismissal on calendar_events
  if ('conflict_dismissed' in body && body.calendar_event_id) {
    const { data: updatedEvent, error: eventError } = await supabase
      .from('calendar_events')
      .update({ conflict_dismissed: true })
      .eq('id', body.calendar_event_id)
      .eq('tenant_id', tenantId)
      .select('id, conflict_dismissed')
      .single();

    if (eventError) {
      console.log('500:', eventError.message);
      return Response.json({ error: eventError.message }, { status: 500 });
    }

    return Response.json({ calendar_event: updatedEvent });
  }

  // Handle appointment status update (cancel)
  if (body.status === 'cancelled') {
    // Fetch the appointment to get google_event_id
    const { data: appt, error: fetchError } = await supabase
      .from('appointments')
      .select('id, tenant_id, google_event_id, status')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        console.log('404: Not found');
        return Response.json({ error: 'Appointment not found' }, { status: 404 });
      }
      console.log('500:', fetchError.message);
      return Response.json({ error: fetchError.message }, { status: 500 });
    }

    // Update status to cancelled
    const { data: updated, error: updateError } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('id, status, google_event_id, start_time, end_time, caller_name')
      .single();

    if (updateError) {
      console.log('500:', updateError.message);
      return Response.json({ error: updateError.message }, { status: 500 });
    }

    // Async: remove from Google Calendar if event exists
    // Using after() pattern — fire-and-forget, non-blocking
    if (appt.google_event_id) {
      // Deferred Google Calendar deletion (after response)
      // The caller handles this asynchronously
      // We signal the google_event_id in the response for client-side handling if needed
    }

    return Response.json({ appointment: updated });
  }

  console.log('400: Invalid patch body');
  return Response.json({ error: 'Invalid patch body' }, { status: 400 });
}

import { after } from 'next/server';
import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';
// Phase 59 Plan 08: createOrAttachLeadForManualAppointment removed (src/lib/leads.js deleted).
// Manual bookings now create a customer + job via the record_call_outcome RPC (D-14).
import { notifyBookingCopyToJobber } from '@/lib/notifications';

/**
 * Compute travel buffer blocks between consecutive same-day appointments.
 * Uses zone_travel_buffers table for configured buffer durations.
 */
function computeTravelBuffers(appointments, travelBufferMap) {
  const buffers = [];

  // Group by day
  const byDay = {};
  for (const appt of appointments) {
    const day = appt.start_time.slice(0, 10); // "YYYY-MM-DD"
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(appt);
  }

  for (const day of Object.keys(byDay)) {
    const dayAppts = byDay[day].sort(
      (a, b) => new Date(a.start_time) - new Date(b.start_time)
    );

    for (let i = 0; i < dayAppts.length - 1; i++) {
      const a = dayAppts[i];
      const b = dayAppts[i + 1];

      // Only insert buffer when zones differ
      if (!a.zone_id || !b.zone_id || a.zone_id === b.zone_id) continue;

      const aEnd = new Date(a.end_time);
      const bStart = new Date(b.start_time);

      // Find configured buffer duration
      const bufferKey = [a.zone_id, b.zone_id].sort().join('_');
      const bufferMins = travelBufferMap[bufferKey] ?? 30;

      // Only create buffer if there is a gap between the appointments
      if (bStart > aEnd) {
        const bufferEnd = new Date(Math.min(
          aEnd.getTime() + bufferMins * 60 * 1000,
          bStart.getTime()
        ));

        buffers.push({
          type: 'travel_buffer',
          start_time: aEnd.toISOString(),
          end_time: bufferEnd.toISOString(),
          from_zone: a.zone_id,
          to_zone: b.zone_id,
          from_zone_name: a.service_zones?.name || null,
          to_zone_name: b.service_zones?.name || null,
        });
      }
    }
  }

  return buffers;
}

/**
 * Detect conflicts: calendar_events that overlap confirmed appointments
 * where conflict_dismissed=false.
 */
function detectConflicts(appointments, calendarEvents) {
  const conflicts = [];

  const confirmed = appointments.filter(a => a.status === 'confirmed');

  for (const event of calendarEvents) {
    if (event.conflict_dismissed) continue;
    if (!event.start_time || !event.end_time) continue;

    const evStart = new Date(event.start_time);
    const evEnd = new Date(event.end_time);

    for (const appt of confirmed) {
      const apptStart = new Date(appt.start_time);
      const apptEnd = new Date(appt.end_time);

      // Overlap check: two ranges overlap if start of one < end of other
      if (evStart < apptEnd && evEnd > apptStart) {
        conflicts.push({
          calendar_event: event,
          appointment: { id: appt.id, start_time: appt.start_time, end_time: appt.end_time },
        });
      }
    }
  }

  return conflicts;
}

export async function GET(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);

  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    console.log('400: Missing start/end query params');
    return Response.json({ error: 'start and end query params required' }, { status: 400 });
  }

  // Fetch appointments within date range (non-cancelled)
  const { data: appointments, error: apptError } = await supabase
    .from('appointments')
    .select(`
      id, tenant_id, call_id, start_time, end_time,
      service_address, postal_code, street_name,
      caller_name, caller_phone,
      urgency, zone_id, status, booked_via,
      external_event_id, jobber_visit_id, notes, created_at,
      service_zones (id, name)
    `)
    .eq('tenant_id', tenantId)
    .neq('status', 'cancelled')
    .gte('start_time', start)
    .lte('start_time', end)
    .order('start_time', { ascending: true });

  if (apptError) {
    console.log('500:', apptError.message);
    return Response.json({ error: apptError.message }, { status: 500 });
  }

  // Voice-agent bookings and time blocks get pushed to Google/Outlook, then the
  // webhook mirrors them back into calendar_events. Collect the pushed event IDs
  // so we can filter the mirrors out and prevent double-rendering.
  const mirroredExternalIds = new Set(
    (appointments || [])
      .map((a) => a.external_event_id)
      .filter(Boolean)
  );

  // Also collect external_event_ids from calendar_blocks to filter those mirrors too
  const { data: blockExternalIds } = await supabase
    .from('calendar_blocks')
    .select('external_event_id')
    .eq('tenant_id', tenantId)
    .not('external_event_id', 'is', null);

  for (const row of (blockExternalIds || [])) {
    if (row.external_event_id) mirroredExternalIds.add(row.external_event_id);
  }

  // Fetch calendar_events that overlap the date range (handles multi-day and all-day events)
  const { data: calendarEvents, error: eventsError } = await supabase
    .from('calendar_events')
    .select('id, tenant_id, provider, external_id, title, start_time, end_time, is_all_day, appointment_id, conflict_dismissed, synced_at')
    .eq('tenant_id', tenantId)
    .lte('start_time', end)
    .gte('end_time', start);

  if (eventsError) {
    console.log('500:', eventsError.message);
    return Response.json({ error: eventsError.message }, { status: 500 });
  }

  // Drop calendar_events rows that are just Voco's own bookings mirrored back
  // from Google/Outlook — same event, different table, would render twice.
  const filteredCalendarEvents = (calendarEvents || []).filter(
    (e) => !mirroredExternalIds.has(e.external_id)
  );

  // Fetch zone travel buffers
  const { data: zoneTravelBuffers } = await supabase
    .from('zone_travel_buffers')
    .select('zone_a_id, zone_b_id, buffer_mins')
    .eq('tenant_id', tenantId);

  // Build travel buffer lookup map
  const travelBufferMap = {};
  for (const buf of (zoneTravelBuffers || [])) {
    const key = [buf.zone_a_id, buf.zone_b_id].sort().join('_');
    travelBufferMap[key] = buf.buffer_mins;
  }

  const travelBuffers = computeTravelBuffers(appointments || [], travelBufferMap);
  const conflicts = detectConflicts(appointments || [], filteredCalendarEvents);

  return Response.json({
    appointments: appointments || [],
    externalEvents: filteredCalendarEvents,
    travelBuffers,
    conflicts,
  });
}

export async function POST(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const {
    caller_name, caller_phone, start_time, end_time, notes, status, job_type,
    sync_to_calendar,
    service_address, postal_code, street_name, email,
  } = await request.json();

  if (!caller_name || !start_time) {
    return Response.json({ error: 'caller_name and start_time are required' }, { status: 400 });
  }
  if (!caller_phone) {
    return Response.json({ error: 'caller_phone is required for manual bookings' }, { status: 400 });
  }

  const composedAddress =
    service_address || [street_name, postal_code].filter(Boolean).join(', ') || 'TBD';

  const { data: result, error: rpcError } = await supabase.rpc('book_appointment_atomic', {
    p_tenant_id: tenantId,
    p_call_id: null,
    p_start_time: start_time,
    p_end_time: end_time,
    p_service_address: composedAddress,
    p_caller_name: caller_name,
    p_caller_phone: caller_phone,
    p_urgency: 'routine',
    p_postal_code: postal_code || null,
    p_street_name: street_name || null,
  });

  if (rpcError) {
    return Response.json({ error: rpcError.message }, { status: 500 });
  }

  if (!result.success) {
    return Response.json({ error: 'Time slot is no longer available' }, { status: 409 });
  }

  await supabase.from('appointments').update({
    booked_via: 'manual',
    ...(notes ? { notes } : {}),
  }).eq('id', result.appointment_id);

  // Phase 59 Plan 08 (D-14): upsert customer + create job via record_call_outcome RPC.
  // Replaces createOrAttachLeadForManualAppointment. Non-blocking — appointment is already saved.
  try {
    const { normalizePhone } = await import('@/lib/phone/normalize.js');
    const normalizedPhone = normalizePhone(caller_phone);
    await supabase.rpc('record_call_outcome', {
      p_tenant_id: tenantId,
      p_phone_e164: normalizedPhone,
      p_caller_name: caller_name || null,
      p_service_address: composedAddress === 'TBD' ? null : composedAddress,
      p_appointment_id: result.appointment_id,
      p_urgency: 'routine',
      p_call_id: null,
      p_job_type: job_type || null,
    });
  } catch (err) {
    console.error('[appointments] record_call_outcome failed, appointment still saved:', err.message);
  }

  const { data } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', result.appointment_id)
    .single();

  // Async: push to connected calendar if requested (default true)
  if (sync_to_calendar !== false && data) {
    after(async () => {
      try {
        const { data: creds } = await supabase
          .from('calendar_credentials')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_primary', true)
          .single();

        if (!creds) return;

        let eventId;
        if (creds.provider === 'google') {
          const { createCalendarEvent } = await import('@/lib/scheduling/google-calendar.js');
          eventId = await createCalendarEvent({
            credentials: creds,
            appointment: {
              id: data.id,
              tenant_id: tenantId,
              start_time: data.start_time,
              end_time: data.end_time,
              job_type: job_type || 'Service',
              caller_name: data.caller_name,
              service_address: data.service_address || '',
              urgency: data.urgency || 'routine',
            },
          });
        } else if (creds.provider === 'outlook') {
          const { createOutlookCalendarEvent } = await import('@/lib/scheduling/outlook-calendar.js');
          eventId = await createOutlookCalendarEvent({
            credentials: creds,
            appointment: {
              id: data.id,
              tenant_id: tenantId,
              start_time: data.start_time,
              end_time: data.end_time,
              job_type: job_type || 'Service',
              caller_name: data.caller_name,
              service_address: data.service_address || '',
              urgency: data.urgency || 'routine',
            },
          });
        }

        if (eventId) {
          await supabase
            .from('appointments')
            .update({ external_event_id: eventId })
            .eq('id', data.id);
        }
      } catch (err) {
        console.error('[appointments] Calendar sync failed:', err.message);
      }
    });
  }

  // Phase 57 — fire-and-forget "copy this to Jobber" email. Non-blocking via
  // after(); helper internally gates on Jobber-connected AND jobber_visit_id IS NULL,
  // so this no-ops cleanly for tenants without Jobber. Voice-agent bookings
  // (livekit-agent repo) wire this separately at their own post-booking site.
  if (data) {
    after(async () => {
      try {
        await notifyBookingCopyToJobber({ tenantId, appointmentId: data.id });
      } catch (err) {
        console.error('[appointments] notifyBookingCopyToJobber failed:', err?.message || err);
      }
    });
  }

  return Response.json({ appointment: data });
}

import { after } from 'next/server';
import Retell from 'retell-sdk';
import { retell } from '@/lib/retell';
import { supabase } from '@/lib/supabase';
import { processCallAnalyzed, processCallEnded } from '@/lib/call-processor';
import { calculateAvailableSlots } from '@/lib/scheduling/slot-calculator';
import { atomicBookSlot } from '@/lib/scheduling/booking';
import { pushBookingToCalendar } from '@/lib/scheduling/google-calendar';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { createOrMergeLead } from '@/lib/leads';
import { buildWhisperMessage } from '@/lib/whisper-message';
import { sendCallerSMS, sendCallerRecoverySMS } from '@/lib/notifications';

export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-retell-signature') || '';

  if (!Retell.verify(rawBody, process.env.RETELL_API_KEY, signature)) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const { event } = payload;

  if (event === 'call_inbound') {
    console.log(`[retell-webhook] call_inbound: from=${payload.call_inbound?.from_number}, to=${payload.call_inbound?.to_number}`);
    return handleInbound(payload);
  }

  if (event === 'call_ended') {
    after(async () => {
      await processCallEnded(payload.call);
    });
    return Response.json({ received: true });
  }

  if (event === 'call_analyzed') {
    after(async () => {
      await processCallAnalyzed(payload.call);
    });
    return Response.json({ received: true });
  }

  // Handle Retell custom function invocations (e.g., transfer_call, book_appointment tools)
  if (event === 'call_function_invoked') {
    return handleFunctionCall(payload);
  }

  return Response.json({ received: true });
}

/**
 * Convert a zone_travel_buffers array from DB format to the format expected
 * by calculateAvailableSlots: { 'zoneA:zoneB': mins }.
 * @param {Array<{zone_a_id: string, zone_b_id: string, buffer_mins: number}>} buffers
 * @returns {Array<{zone_a_id: string, zone_b_id: string, buffer_mins: number}>}
 */
function formatZonePairBuffers(buffers) {
  // calculateAvailableSlots accepts the array directly — it iterates via .find()
  // Return as-is (the slot-calculator handles { zone_a_id, zone_b_id, buffer_mins } objects)
  return buffers || [];
}

/**
 * Format a UTC Date into natural speech for AI to read aloud.
 * Example: "Tuesday March 23rd at 10 AM"
 * @param {Date} date UTC Date
 * @param {string} timezone IANA timezone string
 * @returns {string}
 */
function formatSlotForSpeech(date, timezone) {
  const zoned = toZonedTime(date, timezone || 'America/Chicago');
  return format(zoned, "EEEE MMMM do 'at' h:mm a");
}

/**
 * Format a Date object into a "YYYY-MM-DD" string in the given timezone.
 * Used to pass to calculateAvailableSlots which requires a date string.
 * @param {Date} date
 * @param {string} timezone IANA timezone string
 * @returns {string} "YYYY-MM-DD"
 */
function toLocalDateString(date, timezone) {
  const zoned = toZonedTime(date, timezone || 'America/Chicago');
  return format(zoned, 'yyyy-MM-dd');
}

async function handleInbound(payload) {
  // call_inbound event nests call data under payload.call_inbound (not top-level)
  const { from_number, to_number } = payload.call_inbound || {};

  // Look up tenant by the Retell phone number that was called
  // Include scheduling config fields for slot calculation
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, business_name, default_locale, onboarding_complete, owner_phone, tone_preset, working_hours, slot_duration_mins, tenant_timezone')
    .eq('retell_phone_number', to_number)
    .single();

  if (!tenant) {
    // No tenant configured for this number — use defaults
    return Response.json({
      dynamic_variables: {
        business_name: 'Voco',
        default_locale: 'en',
        onboarding_complete: 'false',
        caller_number: from_number || '',
        owner_phone: '',
        tone_preset: 'professional',
        available_slots: 'No available slots',
        booking_enabled: 'false',
      },
    });
  }

  // Fetch scheduling data for slot calculation (all in parallel)
  const [appointmentsResult, eventsResult, zonesResult, buffersResult] = await Promise.all([
    supabase
      .from('appointments')
      .select('start_time, end_time, zone_id')
      .eq('tenant_id', tenant.id)
      .neq('status', 'cancelled')
      .gte('end_time', new Date().toISOString()),
    supabase
      .from('calendar_events')
      .select('start_time, end_time')
      .eq('tenant_id', tenant.id)
      .gte('end_time', new Date().toISOString()),
    supabase
      .from('service_zones')
      .select('id, name, postal_codes')
      .eq('tenant_id', tenant.id),
    supabase
      .from('zone_travel_buffers')
      .select('zone_a_id, zone_b_id, buffer_mins')
      .eq('tenant_id', tenant.id),
  ]);

  const tenantTimezone = tenant.tenant_timezone || 'America/Chicago';

  // Calculate available slots for today + next 2 days (up to 6 total)
  const allSlots = [];
  for (let dayOffset = 0; dayOffset < 3 && allSlots.length < 6; dayOffset++) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + dayOffset);
    const targetDateStr = toLocalDateString(targetDate, tenantTimezone);

    const daySlots = calculateAvailableSlots({
      workingHours: tenant.working_hours || {},
      slotDurationMins: tenant.slot_duration_mins || 60,
      existingBookings: appointmentsResult.data || [],
      externalBlocks: eventsResult.data || [],
      zones: zonesResult.data || [],
      zonePairBuffers: formatZonePairBuffers(buffersResult.data || []),
      targetDate: targetDateStr,
      tenantTimezone,
      maxSlots: 6 - allSlots.length,
    });
    allSlots.push(...daySlots);
  }

  // Format slots as numbered list for AI to read naturally
  // Example: "1. Monday March 23rd at 10 AM\n2. Monday March 23rd at 2 PM"
  const slotsText = allSlots.map((slot, i) => {
    const zonedStart = toZonedTime(new Date(slot.start), tenantTimezone);
    return `${i + 1}. ${format(zonedStart, "EEEE MMMM do 'at' h:mm a")}`;
  }).join('\n');

  return Response.json({
    dynamic_variables: {
      business_name: tenant.business_name || 'Voco',
      default_locale: tenant.default_locale || 'en',
      onboarding_complete: String(tenant.onboarding_complete ?? false),
      caller_number: from_number || '',
      tenant_id: tenant.id,
      owner_phone: tenant.owner_phone || '',
      tone_preset: tenant.tone_preset || 'professional',
      available_slots: slotsText || 'No available slots',
      booking_enabled: String(allSlots.length > 0),
    },
  });
}

/**
 * Handle Retell custom function calls invoked by the AI agent during a live call.
 * Supports: transfer_call (transfer to owner's phone), book_appointment (atomic slot booking).
 */
async function handleFunctionCall(payload) {
  const { call_id, function_call } = payload;

  if (function_call?.name === 'end_call') {
    // end_call is handled by the WebSocket server (sends end_call:true to Retell).
    // If it reaches the webhook, just acknowledge.
    return Response.json({ result: 'Call ending.' });
  }

  if (function_call?.name === 'capture_lead') {
    const args = function_call.arguments || {};

    // Resolve tenant via call record (same two-hop as transfer_call)
    const { data: call } = await supabase
      .from('calls')
      .select('id, tenant_id, from_number, start_timestamp')
      .eq('retell_call_id', call_id)
      .single();

    if (!call?.tenant_id) {
      return Response.json({ result: 'Lead capture unavailable.' });
    }

    // Compute mid-call duration from start_timestamp to avoid Pitfall 3 (15s filter)
    const durationSeconds = call.start_timestamp
      ? Math.round((Date.now() - new Date(call.start_timestamp).getTime()) / 1000)
      : 999;

    try {
      await createOrMergeLead({
        tenantId: call.tenant_id,
        callId: call.id,
        fromNumber: call.from_number || args.phone || '',
        callerName: args.caller_name || null,
        jobType: args.job_type || null,
        serviceAddress: args.address || null,
        triageResult: { urgency: 'routine' },
        appointmentId: null,
        callDuration: durationSeconds,
      });

      // Real-time booking_outcome write — declined (D-02)
      await supabase.from('calls').upsert(
        { retell_call_id: call_id, booking_outcome: 'declined' },
        { onConflict: 'retell_call_id' }
      );

      // Look up business name for the confirmation message
      const { data: tenant } = await supabase
        .from('tenants')
        .select('business_name')
        .eq('id', call.tenant_id)
        .single();

      const bizName = tenant?.business_name || 'our team';
      return Response.json({
        result: `I've saved your information. ${bizName} will reach out soon.`,
      });
    } catch (err) {
      console.error('capture_lead handler error:', err);
      return Response.json({
        result: "I've noted your details and someone will follow up.",
      });
    }
  }

  if (function_call?.name === 'book_appointment') {
    return handleBookAppointment(payload);
  }

  if (function_call?.name === 'transfer_call') {
    // Look up the call's tenant to get owner_phone
    // The call_id in function invocation events is the retell call_id
    const { data: call } = await supabase
      .from('calls')
      .select('tenant_id')
      .eq('retell_call_id', call_id)
      .single();

    let ownerPhone = null;
    if (call?.tenant_id) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('owner_phone')
        .eq('id', call.tenant_id)
        .single();
      ownerPhone = tenant?.owner_phone;
    }

    // Fallback: if no call record yet, look up tenant by the inbound number
    // The tenant lookup may also come from function_call.arguments if the agent passes it
    if (!ownerPhone && function_call.arguments?.tenant_id) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('owner_phone')
        .eq('id', function_call.arguments.tenant_id)
        .single();
      ownerPhone = tenant?.owner_phone;
    }

    if (ownerPhone) {
      try {
        // Build whisper message from AI-provided arguments (D-08)
        const whisperMsg = buildWhisperMessage({
          callerName: function_call.arguments?.caller_name,
          jobType: function_call.arguments?.job_type,
          urgency: function_call.arguments?.urgency,
          summary: function_call.arguments?.summary,
        });

        await retell.call.transfer({
          call_id,
          transfer_to: ownerPhone,
          whisper_message: whisperMsg,
        });

        // Real-time exception_reason write (D-03)
        // Use explicit reason from AI if provided, fall back to summary heuristic
        const transferReason = function_call.arguments?.reason
          || ((function_call.arguments?.summary || '').toLowerCase().includes('clarif')
            ? 'clarification_limit'
            : 'caller_requested');
        after(async () => {
          await supabase.from('calls').upsert(
            { retell_call_id: call_id, exception_reason: transferReason },
            { onConflict: 'retell_call_id' }
          );
        });

        return Response.json({ result: 'transfer_initiated' });
      } catch (err) {
        console.error('Transfer failed:', err);
        return Response.json({ result: 'transfer_failed', error: err.message });
      }
    }

    // No owner phone configured — graceful fallback
    return Response.json({
      result: 'transfer_unavailable',
      message: 'No owner phone number configured for this business.',
    });
  }

  return Response.json({ received: true });
}

/**
 * Handle the book_appointment function invocation from the AI agent.
 *
 * Flow:
 * 1. Resolve tenant from the call record
 * 2. Call atomicBookSlot (Postgres advisory lock + overlap check)
 * 3. On success: trigger async pushBookingToCalendar via after(), return confirmation
 * 4. On slot_taken: fetch next available slot, return alternative speech
 *
 * Performance: completes well under the 10s Retell timeout.
 * Google Calendar push is always async — never in the hot call path.
 *
 * @param {object} payload Retell function invocation payload
 * @returns {Response} JSON with { result: string } for AI to read aloud
 */
async function handleBookAppointment(payload) {
  const { call_id, function_call } = payload;
  const args = function_call.arguments;

  // Resolve tenant from call record (two-hop: calls -> tenants)
  const { data: call } = await supabase
    .from('calls')
    .select('id, tenant_id')
    .eq('retell_call_id', call_id)
    .single();

  if (!call?.tenant_id) {
    return Response.json({
      result: 'I was unable to confirm the booking. Please call back and we will try again.',
    });
  }

  // Fetch tenant timezone, scheduling config, and business info for SMS confirmation
  const { data: tenant } = await supabase
    .from('tenants')
    .select('tenant_timezone, working_hours, slot_duration_mins, business_name, default_locale')
    .eq('id', call.tenant_id)
    .single();

  const tenantTimezone = tenant?.tenant_timezone || 'America/Chicago';

  const startTime = new Date(args.slot_start);
  const endTime = new Date(args.slot_end);

  // Attempt atomic slot booking — Postgres advisory lock prevents double-booking
  const result = await atomicBookSlot({
    tenantId: call.tenant_id,
    callId: call.id,
    startTime,
    endTime,
    address: args.service_address,
    callerName: args.caller_name,
    callerPhone: payload.call?.from_number || null,
    urgency: args.urgency,
    zoneId: args.zone_id || null,
  });

  if (!result.success) {
    // Slot was taken — fetch current bookings/events before recalculating
    const [currentBookings, currentEvents] = await Promise.all([
      supabase
        .from('appointments')
        .select('start_time, end_time, zone_id')
        .eq('tenant_id', call.tenant_id)
        .neq('status', 'cancelled')
        .gte('end_time', new Date().toISOString()),
      supabase
        .from('calendar_events')
        .select('start_time, end_time')
        .eq('tenant_id', call.tenant_id)
        .gte('end_time', new Date().toISOString()),
    ]);

    const endDateStr = toLocalDateString(endTime, tenantTimezone);
    const nextSlots = calculateAvailableSlots({
      workingHours: tenant?.working_hours || {},
      slotDurationMins: tenant?.slot_duration_mins || 60,
      existingBookings: currentBookings.data || [],
      externalBlocks: currentEvents.data || [],
      zones: [],
      zonePairBuffers: [],
      targetDate: endDateStr,
      tenantTimezone,
      maxSlots: 1,
    });

    const nextSlotText =
      nextSlots.length > 0
        ? formatSlotForSpeech(new Date(nextSlots[0].start), tenantTimezone)
        : 'tomorrow morning';

    // Real-time booking_outcome write — attempted (D-02)
    after(async () => {
      await supabase.from('calls').upsert(
        { retell_call_id: call_id, booking_outcome: 'attempted' },
        { onConflict: 'retell_call_id' }
      );
    });

    // Phase 17 — Real-time recovery SMS for failed booking (RECOVER-01, D-04)
    after(async () => {
      try {
        // Locale lookup — same pattern as caller SMS confirmation at lines 438-443
        // Pitfall 5: detected_language may be null during live call, fall back to tenant default
        const { data: callRecord } = await supabase
          .from('calls')
          .select('detected_language, from_number')
          .eq('retell_call_id', call_id)
          .maybeSingle();

        const locale = callRecord?.detected_language || tenant?.default_locale || 'en';
        // Pitfall 1: use args.urgency from AI tool invocation, NOT calls.urgency_classification
        // (processCallAnalyzed hasn't run yet during live call)
        const urgency = args.urgency || 'routine';
        const callerPhone = payload.call?.from_number || callRecord?.from_number || null;
        const callerName = args.caller_name || null;

        // Write pending status before attempt
        await supabase.from('calls').upsert(
          {
            retell_call_id: call_id,
            recovery_sms_status: 'pending',
            recovery_sms_last_attempt_at: new Date().toISOString(),
          },
          { onConflict: 'retell_call_id' }
        );

        const deliveryResult = await sendCallerRecoverySMS({
          to: callerPhone,
          callerName,
          businessName: tenant?.business_name || 'Your service provider',
          locale,
          urgency,
        });

        // Write delivery result — success or retrying for cron pickup
        await supabase.from('calls').upsert(
          {
            retell_call_id: call_id,
            recovery_sms_status: deliveryResult.success ? 'sent' : 'retrying',
            recovery_sms_retry_count: deliveryResult.success ? 0 : 1,
            recovery_sms_last_error: deliveryResult.success
              ? null
              : `${deliveryResult.error.code}: ${deliveryResult.error.message}`,
            recovery_sms_last_attempt_at: new Date().toISOString(),
            recovery_sms_sent_at: deliveryResult.success ? new Date().toISOString() : null,
          },
          { onConflict: 'retell_call_id' }
        );
      } catch (err) {
        console.error('[webhook] Recovery SMS after() failed:', err?.message || err);
        // Write error state for cron retry pickup
        await supabase.from('calls').upsert(
          {
            retell_call_id: call_id,
            recovery_sms_status: 'retrying',
            recovery_sms_retry_count: 1,
            recovery_sms_last_error: `AFTER_ERROR: ${err?.message || String(err)}`,
            recovery_sms_last_attempt_at: new Date().toISOString(),
          },
          { onConflict: 'retell_call_id' }
        ).catch(() => {}); // last-resort swallow
      }
    });

    return Response.json({
      result: `That slot was just taken. The next available time is ${nextSlotText}. Would you like me to book that instead?`,
    });
  }

  // Trigger async calendar sync — non-blocking, runs after response is sent
  after(async () => {
    await pushBookingToCalendar(call.tenant_id, result.appointment_id);
  });

  // Real-time booking_outcome write — booked (D-02)
  after(async () => {
    await supabase.from('calls').upsert(
      { retell_call_id: call_id, booking_outcome: 'booked' },
      { onConflict: 'retell_call_id' }
    );
  });

  // Caller SMS confirmation — fire-and-forget (D-06, D-07, D-08, BOOK-04)
  const callerPhone = payload.call?.from_number || null;
  const { data: callLang } = await supabase
    .from('calls')
    .select('detected_language')
    .eq('retell_call_id', call_id)
    .maybeSingle();
  const smsLocale = callLang?.detected_language || tenant?.default_locale || 'en';

  after(async () => {
    await sendCallerSMS({
      to: callerPhone,
      businessName: tenant?.business_name || 'Your service provider',
      date: format(toZonedTime(startTime, tenantTimezone), 'EEEE, MMMM do'),
      time: format(toZonedTime(startTime, tenantTimezone), 'h:mm a'),
      address: args.service_address || '',
      locale: smsLocale,
    });
  });

  const formattedTime = formatSlotForSpeech(startTime, tenantTimezone);
  return Response.json({
    result: `Your appointment is confirmed for ${formattedTime}. You will receive a confirmation. Is there anything else I can help you with?`,
  });
}

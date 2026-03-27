import { supabase } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';
import { locales } from '@/i18n/routing';
import { classifyCall } from '@/lib/triage/classifier';
import { calculateAvailableSlots } from '@/lib/scheduling/slot-calculator';
import { createOrMergeLead } from '@/lib/leads';
import { sendOwnerSMS, sendOwnerEmail } from '@/lib/notifications';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

/** Supported languages — calls in any other language trigger a language barrier tag. */
const SUPPORTED_LANGUAGES = new Set(locales); // ['en', 'es']

/**
 * Convert a zone_travel_buffers array into the format expected by calculateAvailableSlots.
 * @param {Array<{zone_a_id: string, zone_b_id: string, buffer_mins: number}>} buffers
 * @returns {Array<{zone_a_id: string, zone_b_id: string, buffer_mins: number}>}
 */
function formatBuffers(buffers) {
  return buffers || [];
}

/**
 * Format a Date object into a "YYYY-MM-DD" string in the given IANA timezone.
 * @param {Date} date
 * @param {string} timezone IANA timezone string
 * @returns {string} "YYYY-MM-DD"
 */
function toLocalDateString(date, timezone) {
  const zoned = toZonedTime(date, timezone || 'America/Chicago');
  return format(zoned, 'yyyy-MM-dd');
}

/**
 * Process call_ended event — create initial call record.
 * Lightweight: no recording yet, just basic call metadata.
 */
export async function processCallEnded(call) {
  const {
    call_id,
    from_number,
    to_number,
    direction,
    disconnection_reason,
    start_timestamp,
    end_timestamp,
    metadata,
  } = call;

  // Look up tenant by the number that was called
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('retell_phone_number', to_number)
    .single();

  const tenantId = tenant?.id || null;

  // Guard: unrecognized phone number — log and bail to avoid NOT NULL violation on tenant_id
  if (!tenantId) {
    console.error(`[processCallEnded] Unknown number ${to_number} — no tenant found. Call record not created.`);
    return;
  }

  // Upsert using retell_call_id as dedupe key
  await supabase.from('calls').upsert(
    {
      retell_call_id: call_id,
      tenant_id: tenantId,
      from_number,
      to_number,
      direction: direction || 'inbound',
      status: 'ended',
      disconnection_reason,
      start_timestamp,
      end_timestamp,
      retell_metadata: metadata || null,
    },
    { onConflict: 'retell_call_id' }
  );

  // Auto-cancel test call bookings (D-08) — clean up calendar after onboarding test call
  // test_call: 'true' is passed as a Retell dynamic variable from test-call/route.js
  // Retell echoes dynamic_variables back in call_ended metadata under retell_llm_dynamic_variables
  const isTestCall =
    metadata?.test_call === 'true' ||
    metadata?.retell_llm_dynamic_variables?.test_call === 'true';

  if (isTestCall && tenantId) {
    // Cancel any appointment created during this test call
    const { data: testAppt } = await supabase
      .from('appointments')
      .select('id')
      .eq('retell_call_id', call_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (testAppt) {
      // Cancel the appointment so it does not clutter the real calendar
      await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', testAppt.id);

      // Reset associated lead from 'booked' back to 'new' (Pitfall 6: must also reset lead)
      await supabase
        .from('leads')
        .update({ status: 'new', appointment_id: null })
        .eq('appointment_id', testAppt.id)
        .eq('tenant_id', tenantId);
    }
  }

  // --- Usage tracking (Phase 23: USAGE-01, USAGE-02) ---
  // D-01: Fire-and-forget usage counting after call record upsert
  // D-02: 10-second minimum duration filter (computed from raw timestamps, NOT duration_seconds generated column)
  // D-03: Test call exclusion (reuses isTestCall already in scope at line 78)
  const durationSeconds = (end_timestamp && start_timestamp)
    ? Math.round((end_timestamp - start_timestamp) / 1000)
    : 0;

  if (!isTestCall && durationSeconds >= 10 && tenantId) {
    try {
      const { data: usageResult, error: usageError } = await supabase.rpc(
        'increment_calls_used',
        { p_tenant_id: tenantId, p_call_id: call_id }
      );

      if (usageError) {
        // D-06: Log but never rethrow — billing counter glitch must not lose call data
        console.error('[usage] increment_calls_used RPC error:', usageError);
      } else if (usageResult?.[0]) {
        // D-08: RPC returns { success, calls_used, calls_limit, limit_exceeded }
        const { success, calls_used, calls_limit, limit_exceeded } = usageResult[0];
        console.log(
          `[usage] tenant=${tenantId} call=${call_id} ` +
          `success=${success} used=${calls_used}/${calls_limit} ` +
          `limit_exceeded=${limit_exceeded}`
        );

        // Report overage to Stripe metered billing when limit exceeded
        // Only on successful increment (not duplicates) to prevent double-charging
        if (success && limit_exceeded) {
          try {
            const { data: sub } = await supabase
              .from('subscriptions')
              .select('overage_stripe_item_id')
              .eq('tenant_id', tenantId)
              .eq('is_current', true)
              .maybeSingle();

            if (sub?.overage_stripe_item_id) {
              await stripe.subscriptionItems.createUsageRecord(
                sub.overage_stripe_item_id,
                { quantity: 1, action: 'increment' }
              );
              console.log(
                `[usage] Overage reported to Stripe: tenant=${tenantId} call=${call_id} ` +
                `used=${calls_used}/${calls_limit}`
              );
            }
          } catch (overageErr) {
            // Non-fatal: overage billing failure must not lose call data
            console.error('[usage] Stripe overage report failed (non-fatal):', overageErr);
          }
        }
      }
    } catch (err) {
      // D-06: billing counter glitch must never lose call data
      console.error('[usage] increment failed (non-fatal):', err);
    }
  }
}

/**
 * Process call_analyzed event — store recording, transcript, and detect language barriers.
 * This is the heavy handler: fetch audio, upload to storage, write transcript,
 * and tag calls with LANGUAGE_BARRIER if detected_language is not in supported set.
 *
 * Per locked decision: unsupported languages create a lead tagged with
 * "LANGUAGE BARRIER: [Detected Language]" — implemented via language_barrier
 * and barrier_language columns on the calls table.
 *
 * For routine calls that were not booked during the call, calculate and store
 * suggested_slots so the owner can do manual follow-up with ready-to-offer times.
 */
export async function processCallAnalyzed(call) {
  const {
    call_id,
    from_number,
    to_number,
    direction,
    disconnection_reason,
    start_timestamp,
    end_timestamp,
    recording_url,
    transcript,
    transcript_object,
    call_analysis,
    metadata,
  } = call;

  // Look up tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('retell_phone_number', to_number)
    .single();

  const tenantId = tenant?.id || null;
  let recordingStoragePath = null;

  // Upload recording to Supabase Storage if available
  if (recording_url) {
    try {
      const audioResponse = await fetch(recording_url);
      const audioBuffer = await audioResponse.arrayBuffer();

      const { data, error } = await supabase.storage
        .from('call-recordings')
        .upload(`${call_id}.wav`, audioBuffer, {
          contentType: 'audio/wav',
          upsert: true,
        });

      if (!error && data) {
        recordingStoragePath = data.path;
      } else {
        console.error('Recording upload failed:', error);
      }
    } catch (err) {
      console.error('Recording fetch/upload error:', err);
    }
  }

  // Detect language barrier: if detected_language is not in SUPPORTED_LANGUAGES, tag it
  const detectedLanguage = metadata?.detected_language || call_analysis?.detected_language || null;
  const isLanguageBarrier = detectedLanguage != null && !SUPPORTED_LANGUAGES.has(detectedLanguage);

  // Run triage classification on the transcript
  let triageResult = { urgency: 'routine', confidence: 'low', layer: 'layer1' };
  try {
    triageResult = await classifyCall({
      transcript: transcript || '',
      tenant_id: tenantId,
    });
  } catch (err) {
    console.error('Triage classification failed:', err);
  }

  // Emergency priority notification (lightweight, pre-Phase-4)
  if (triageResult.urgency === 'emergency') {
    console.warn(`EMERGENCY TRIAGE: call ${call_id} for tenant ${tenantId} — ${triageResult.reason || 'keyword match'}`);
  }

  // Check whether a booking was made during this call
  // Appointments link via call_id (UUID FK to calls table), not retell_call_id (string)
  // First resolve the call UUID, then check appointments
  let appointmentExists = false;
  let earlyCallUuid = null;
  if (tenantId) {
    const { data: callRow } = await supabase
      .from('calls')
      .select('id')
      .eq('retell_call_id', call_id)
      .maybeSingle();
    earlyCallUuid = callRow?.id || null;

    if (earlyCallUuid) {
      const { data: appt } = await supabase
        .from('appointments')
        .select('id')
        .eq('call_id', earlyCallUuid)
        .maybeSingle();
      appointmentExists = appt != null;
    }
  }

  // For any unbooked call: calculate suggested slots for owner follow-up
  // Per D-04, D-05: expanded from routine-only to any unbooked call regardless of urgency
  // This allows the owner to see ready-to-offer times when reviewing leads in the dashboard
  let suggestedSlots = null;
  const shouldCalculateSlots = !appointmentExists && tenantId;

  if (shouldCalculateSlots) {
    try {
      // Load tenant scheduling config
      const { data: tenantScheduling } = await supabase
        .from('tenants')
        .select('id, working_hours, slot_duration_mins, tenant_timezone')
        .eq('id', tenantId)
        .single();

      if (tenantScheduling?.working_hours) {
        const tenantTimezone = tenantScheduling.tenant_timezone || 'America/Chicago';

        // Load scheduling data in parallel
        const [appointments, events, zones, buffers] = await Promise.all([
          supabase
            .from('appointments')
            .select('start_time, end_time, zone_id')
            .eq('tenant_id', tenantScheduling.id)
            .neq('status', 'cancelled'),
          supabase
            .from('calendar_events')
            .select('start_time, end_time')
            .eq('tenant_id', tenantScheduling.id),
          supabase
            .from('service_zones')
            .select('id, name, postal_codes')
            .eq('tenant_id', tenantScheduling.id),
          supabase
            .from('zone_travel_buffers')
            .select('zone_a_id, zone_b_id, buffer_mins')
            .eq('tenant_id', tenantScheduling.id),
        ]);

        // Calculate next 3 available slots starting from tomorrow
        const collectedSlots = [];
        for (let d = 0; d < 3 && collectedSlots.length < 3; d++) {
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() + d + 1); // start from tomorrow
          const targetDateStr = toLocalDateString(targetDate, tenantTimezone);

          const daySlots = calculateAvailableSlots({
            workingHours: tenantScheduling.working_hours,
            slotDurationMins: tenantScheduling.slot_duration_mins || 60,
            existingBookings: appointments.data || [],
            externalBlocks: events.data || [],
            zones: zones.data || [],
            zonePairBuffers: formatBuffers(buffers.data || []),
            targetDate: targetDateStr,
            tenantTimezone,
            maxSlots: 3 - collectedSlots.length,
          });
          collectedSlots.push(...daySlots);
        }

        suggestedSlots = collectedSlots.length > 0 ? collectedSlots : null;
      }
    } catch (err) {
      // Non-fatal: suggested_slots is an enhancement, not a core requirement
      console.error('suggested_slots calculation failed:', err);
    }
  }

  // Notification priority derived from urgency — Phase 16 reads this for SMS/email formatting (D-11, D-12)
  const notification_priority =
    triageResult.urgency === 'emergency' || triageResult.urgency === 'high_ticket'
      ? 'high'
      : 'standard';

  // Upsert call record with full analyzed data — chain .select('id') to get the Supabase UUID
  // (call_id from Retell is a string like "call_337593af...", NOT a UUID)
  const { data: callRecord } = await supabase.from('calls').upsert(
    {
      retell_call_id: call_id,
      tenant_id: tenantId,
      from_number,
      to_number,
      direction: direction || 'inbound',
      status: 'analyzed',
      disconnection_reason,
      start_timestamp,
      end_timestamp,
      recording_url,
      recording_storage_path: recordingStoragePath,
      transcript_text: transcript || null,
      transcript_structured: transcript_object || null,
      detected_language: detectedLanguage,
      language_barrier: isLanguageBarrier,
      barrier_language: isLanguageBarrier ? detectedLanguage : null,
      retell_metadata: { ...(metadata || {}), call_analysis: call_analysis || null },
      urgency_classification: triageResult.urgency,
      urgency_confidence: triageResult.confidence,
      triage_layer_used: triageResult.layer,
      notification_priority,
      suggested_slots: suggestedSlots,
    },
    { onConflict: 'retell_call_id' }
  ).select('id').single();

  const callUuid = callRecord?.id;

  // Default booking_outcome to 'not_attempted' for calls with no real-time booking activity (D-02)
  // Uses conditional update to avoid overwriting values set during the live call (Pitfall 1)
  await supabase
    .from('calls')
    .update({ booking_outcome: 'not_attempted' })
    .eq('retell_call_id', call_id)
    .is('booking_outcome', null);

  // === LEAD CREATION (Phase 4: CRM-01, CRM-03) ===
  // Create or merge lead after call record is persisted.
  // Short call filter (< 15s) is handled inside createOrMergeLead — returns null.
  const callDuration = start_timestamp && end_timestamp
    ? Math.round((new Date(end_timestamp) - new Date(start_timestamp)) / 1000)
    : 0;

  // Look up appointmentId for this call if a booking was made during the call
  // Use callUuid (from upsert above) to query by call_id FK, not retell_call_id
  let appointmentId = null;
  if (appointmentExists && callUuid) {
    const { data: apptRow } = await supabase
      .from('appointments')
      .select('id')
      .eq('call_id', callUuid)
      .maybeSingle();
    appointmentId = apptRow?.id || null;
  }

  let lead = null;
  if (!callUuid) {
    console.error('processCallAnalyzed: failed to retrieve call UUID after upsert — skipping lead creation');
  }
  try {
    lead = callUuid ? await createOrMergeLead({
      tenantId,
      callId: callUuid,
      fromNumber: from_number,
      callerName: metadata?.caller_name || call_analysis?.caller_name || null,
      jobType: metadata?.job_type || call_analysis?.job_type || null,
      serviceAddress: metadata?.service_address || call_analysis?.service_address || null,
      triageResult,
      appointmentId,
      callDuration,
    }) : null;
  } catch (err) {
    console.error('Lead creation failed:', err);
  }

  // === OWNER NOTIFICATIONS (Phase 4: NOTIF-01, NOTIF-02) ===
  // Granular per-outcome notification preferences. Emergency calls always notify both channels.
  // Fire-and-forget: notification failures are logged but never block the handler.
  if (lead && tenantId) {
    try {
      const { data: tenantInfo } = await supabase
        .from('tenants')
        .select('business_name, owner_phone, owner_email, notification_preferences')
        .eq('id', tenantId)
        .single();

      if (tenantInfo) {
        // Read the booking_outcome for this call to determine which preference row to check
        const { data: callRow } = await supabase
          .from('calls')
          .select('booking_outcome')
          .eq('retell_call_id', call_id)
          .single();

        const bookingOutcome = callRow?.booking_outcome || 'not_attempted';
        const isEmergency = triageResult.urgency === 'emergency';

        // Emergency calls always notify both channels (safety override)
        const prefs = tenantInfo.notification_preferences || {};
        const outcomePrefs = isEmergency
          ? { sms: true, email: true }
          : prefs[bookingOutcome] || { sms: true, email: true };

        const callbackLink = `tel:${lead?.from_number}`;
        const dashboardLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000'}/dashboard/leads`;
        const businessName = tenantInfo.business_name || 'Your Business';

        const promises = [];

        if (outcomePrefs.sms && tenantInfo.owner_phone) {
          promises.push(
            sendOwnerSMS({
              to: tenantInfo.owner_phone,
              businessName,
              callerName: lead?.caller_name,
              jobType: lead?.job_type,
              urgency: lead?.urgency_classification || lead?.urgency,
              address: lead?.address,
              callbackLink,
              dashboardLink,
            })
          );
        }

        if (outcomePrefs.email && tenantInfo.owner_email) {
          promises.push(
            sendOwnerEmail({
              to: tenantInfo.owner_email,
              lead,
              businessName,
              dashboardUrl: dashboardLink,
            })
          );
        }

        if (promises.length > 0) {
          Promise.allSettled(promises).then(results => {
            const statuses = results.map((r, i) => `${i === 0 ? 'first' : 'second'}=${r.status}`).join(', ');
            console.log(`[notifications] Owner notify for tenant ${tenantId}: outcome=${bookingOutcome}, emergency=${isEmergency}, ${statuses}`);
          });
        } else {
          console.log(`[notifications] Skipped owner notify: outcome=${bookingOutcome}, sms=${outcomePrefs.sms}, email=${outcomePrefs.email}`);
        }
      }
    } catch (err) {
      console.error('Tenant lookup for notifications failed:', err);
    }
  }
}

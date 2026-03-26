/**
 * Vercel Cron — Recovery SMS (NOTIF-03 + RECOVER-01/02/03)
 *
 * Schedule: every minute (* * * * *)
 *
 * Branch A: First-send for not_attempted / legacy calls
 *   Finds analyzed calls with no booking, no prior recovery SMS,
 *   booking_outcome = 'not_attempted' OR NULL (legacy pre-Phase-15).
 *   Sends urgency-aware recovery SMS and writes delivery status.
 *
 * Branch B: Retry for failed deliveries
 *   Finds calls with recovery_sms_status = 'retrying' and retry_count < 3.
 *   Respects exponential backoff (30s, 120s windows).
 *   Marks as 'failed' after 3 total attempts (D-14).
 */

import { supabase } from '@/lib/supabase';
import { sendCallerRecoverySMS } from '@/lib/notifications';

const BACKOFF_SECONDS = [30, 120]; // 30s before 2nd attempt, 2min before 3rd
const MAX_ATTEMPTS = 3; // D-14: 3 total attempts then permanent failure

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let sentA = 0;
  let sentB = 0;
  let processedA = 0;
  let processedB = 0;

  // ═══ Branch A: First-send for not_attempted / legacy calls ═══════════════

  const cutoff = new Date(Date.now() - 60_000).toISOString();

  const { data: firstSendCalls, error: errA } = await supabase
    .from('calls')
    .select('id, retell_call_id, from_number, to_number, tenant_id, start_timestamp, end_timestamp, retell_metadata, urgency_classification, detected_language')
    .eq('status', 'analyzed')
    .is('recovery_sms_sent_at', null)
    .is('recovery_sms_status', null)         // Not already being tracked by Phase 17
    .lt('end_timestamp', cutoff)
    .not('tenant_id', 'is', null)
    .not('from_number', 'is', null)
    .in('booking_outcome', ['not_attempted']) // Pitfall 4: only not_attempted, NOT attempted
    .limit(10);

  for (const call of firstSendCalls || []) {
    processedA++;

    // Skip short calls (voicemails, mis-dials)
    const duration = call.start_timestamp && call.end_timestamp
      ? Math.round((new Date(call.end_timestamp) - new Date(call.start_timestamp)) / 1000)
      : 0;

    if (duration < 15) {
      await supabase.from('calls')
        .update({ recovery_sms_sent_at: new Date().toISOString(), recovery_sms_status: 'sent' })
        .eq('id', call.id);
      continue;
    }

    // Check if a booking was made (booked callers don't need recovery)
    const { data: appt } = await supabase
      .from('appointments')
      .select('id')
      .eq('retell_call_id', call.retell_call_id)
      .maybeSingle();

    if (appt) {
      await supabase.from('calls')
        .update({ recovery_sms_sent_at: new Date().toISOString(), recovery_sms_status: 'sent' })
        .eq('id', call.id);
      continue;
    }

    // Tenant lookup for business name and locale
    const { data: tenant } = await supabase
      .from('tenants')
      .select('business_name, owner_phone, retell_phone_number, default_locale')
      .eq('id', call.tenant_id)
      .single();

    if (!tenant) continue;

    const callerName =
      call.retell_metadata?.caller_name ||
      call.retell_metadata?.call_analysis?.caller_name ||
      null;

    // Pitfall 2: urgency_classification and detected_language now in select
    const locale = call.detected_language || tenant.default_locale || 'en';
    const urgency = call.urgency_classification || 'routine';

    // Write pending status
    await supabase.from('calls')
      .update({
        recovery_sms_status: 'pending',
        recovery_sms_last_attempt_at: new Date().toISOString(),
      })
      .eq('id', call.id);

    const deliveryResult = await sendCallerRecoverySMS({
      to: call.from_number,
      callerName,
      businessName: tenant.business_name || 'Your service provider',
      locale,
      urgency,
    });

    if (deliveryResult.success) {
      await supabase.from('calls')
        .update({
          recovery_sms_sent_at: new Date().toISOString(),
          recovery_sms_status: 'sent',
          recovery_sms_retry_count: 0,
          recovery_sms_last_error: null,
          recovery_sms_last_attempt_at: new Date().toISOString(),
        })
        .eq('id', call.id);
      sentA++;
    } else {
      await supabase.from('calls')
        .update({
          recovery_sms_status: 'retrying',
          recovery_sms_retry_count: 1,
          recovery_sms_last_error: `${deliveryResult.error.code}: ${deliveryResult.error.message}`,
          recovery_sms_last_attempt_at: new Date().toISOString(),
        })
        .eq('id', call.id);
    }
  }

  // ═══ Branch B: Retry for failed deliveries ═══════════════════════════════

  const { data: retryCalls, error: errB } = await supabase
    .from('calls')
    .select('id, retell_call_id, from_number, tenant_id, detected_language, urgency_classification, recovery_sms_retry_count, recovery_sms_last_attempt_at, retell_metadata')
    .eq('recovery_sms_status', 'retrying')
    .lt('recovery_sms_retry_count', MAX_ATTEMPTS)
    .not('from_number', 'is', null)
    .limit(10);

  for (const call of retryCalls || []) {
    processedB++;

    const retryCount = call.recovery_sms_retry_count || 1;
    const backoffSecs = BACKOFF_SECONDS[retryCount - 1] || 120;
    const lastAttempt = new Date(call.recovery_sms_last_attempt_at).getTime();
    const elapsedSecs = (Date.now() - lastAttempt) / 1000;

    if (elapsedSecs < backoffSecs) continue; // Not yet due

    const { data: tenant } = await supabase
      .from('tenants')
      .select('business_name, default_locale')
      .eq('id', call.tenant_id)
      .single();

    if (!tenant) continue;

    const callerName =
      call.retell_metadata?.caller_name ||
      call.retell_metadata?.call_analysis?.caller_name ||
      null;
    const locale = call.detected_language || tenant.default_locale || 'en';
    const urgency = call.urgency_classification || 'routine';

    // Mark attempt timestamp before sending
    await supabase.from('calls')
      .update({ recovery_sms_last_attempt_at: new Date().toISOString() })
      .eq('id', call.id);

    const deliveryResult = await sendCallerRecoverySMS({
      to: call.from_number,
      callerName,
      businessName: tenant.business_name || 'Your service provider',
      locale,
      urgency,
    });

    const nextRetryCount = retryCount + 1;

    if (deliveryResult.success) {
      await supabase.from('calls').update({
        recovery_sms_status: 'sent',
        recovery_sms_sent_at: new Date().toISOString(),
        recovery_sms_last_error: null,
        recovery_sms_last_attempt_at: new Date().toISOString(),
      }).eq('id', call.id);
      sentB++;
    } else if (nextRetryCount >= MAX_ATTEMPTS) {
      // D-14: exhausted all 3 attempts — permanent failure
      await supabase.from('calls').update({
        recovery_sms_status: 'failed',
        recovery_sms_retry_count: nextRetryCount,
        recovery_sms_last_error: `${deliveryResult.error.code}: ${deliveryResult.error.message}`,
        recovery_sms_last_attempt_at: new Date().toISOString(),
      }).eq('id', call.id);
    } else {
      await supabase.from('calls').update({
        recovery_sms_status: 'retrying',
        recovery_sms_retry_count: nextRetryCount,
        recovery_sms_last_error: `${deliveryResult.error.code}: ${deliveryResult.error.message}`,
        recovery_sms_last_attempt_at: new Date().toISOString(),
      }).eq('id', call.id);
    }
  }

  return Response.json({
    branch_a: { processed: processedA, sent: sentA },
    branch_b: { processed: processedB, sent: sentB },
  });
}

/**
 * Vercel Cron endpoint — Caller Recovery SMS (NOTIF-03)
 *
 * Schedule: every minute (* * * * *)
 *
 * Finds calls that:
 *  1. Status = 'analyzed' (fully processed)
 *  2. ended more than 60 seconds ago (caller had time to book manually)
 *  3. Have no recovery_sms_sent_at (not already processed)
 *  4. Have tenant_id and from_number
 *
 * Then for each call:
 *  - Skips calls < 15 seconds (voicemails / mis-dials)
 *  - Skips calls where a booking was made during the call (no recovery needed)
 *  - Sends warm recovery SMS to caller's from_number
 *  - Marks call with recovery_sms_sent_at to prevent re-sending
 */

import { supabase } from '@/lib/supabase';
import { sendCallerRecoverySMS } from '@/lib/notifications';

export async function GET(request) {
  // Verify cron authorization — Vercel sets Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find calls that ended more than 60 seconds ago and haven't had recovery SMS sent
  const cutoff = new Date(Date.now() - 60_000).toISOString();

  const { data: calls, error } = await supabase
    .from('calls')
    .select('id, retell_call_id, from_number, to_number, tenant_id, start_timestamp, end_timestamp, retell_metadata')
    .eq('status', 'analyzed')
    .is('recovery_sms_sent_at', null)
    .lt('end_timestamp', cutoff)
    .not('tenant_id', 'is', null)
    .not('from_number', 'is', null)
    .limit(10); // Process max 10 per minute to avoid rate limits

  if (error || !calls?.length) {
    return Response.json({ processed: 0, sent: 0 });
  }

  let sent = 0;

  for (const call of calls) {
    // Calculate call duration — skip short calls (voicemails, mis-dials)
    const duration = call.start_timestamp && call.end_timestamp
      ? Math.round((new Date(call.end_timestamp) - new Date(call.start_timestamp)) / 1000)
      : 0;

    if (duration < 15) {
      // Mark as processed so we don't re-check on next invocation
      await supabase
        .from('calls')
        .update({ recovery_sms_sent_at: new Date().toISOString() })
        .eq('id', call.id);
      continue;
    }

    // Check if a booking was made during this call — booked callers don't need recovery
    const { data: appt } = await supabase
      .from('appointments')
      .select('id')
      .eq('retell_call_id', call.retell_call_id)
      .maybeSingle();

    if (appt) {
      // Caller booked — mark processed, no SMS needed
      await supabase
        .from('calls')
        .update({ recovery_sms_sent_at: new Date().toISOString() })
        .eq('id', call.id);
      continue;
    }

    // Look up tenant for business name and callback phone
    const { data: tenant } = await supabase
      .from('tenants')
      .select('business_name, owner_phone, retell_phone_number')
      .eq('id', call.tenant_id)
      .single();

    if (!tenant) continue;

    try {
      const callerName =
        call.retell_metadata?.caller_name ||
        call.retell_metadata?.call_analysis?.caller_name ||
        null;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000';

      await sendCallerRecoverySMS({
        to: call.from_number,
        callerName,
        businessName: tenant.business_name || 'us',
        bookingLink: `${appUrl}/book/${call.tenant_id}`,
        ownerPhone: tenant.owner_phone || tenant.retell_phone_number,
      });

      await supabase
        .from('calls')
        .update({ recovery_sms_sent_at: new Date().toISOString() })
        .eq('id', call.id);

      sent++;
    } catch (err) {
      console.error(`Recovery SMS failed for call ${call.id}:`, err);
    }
  }

  return Response.json({ processed: calls.length, sent });
}

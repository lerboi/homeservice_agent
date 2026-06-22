import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import { getTwilioClient, getResendClient } from '@/lib/notifications';

/**
 * Retry failed owner missed-job ALERTS (LK-B2).
 *
 * The voice agent's post-call pipeline (livekit-agent src/post_call.py §7) sends
 * the owner an SMS (Twilio) and/or email (Resend) for every call. Each send is
 * hard-capped (~3s) in the agent; on timeout/failure it writes an outbox row to
 * owner_notification_failures (migration 076) instead of silently dropping the
 * alert. This cron re-sends the STORED payload verbatim and deletes the row on
 * success — mirroring the stripe_meter_failures / retry-meter-events pattern.
 *
 * Delivery is at-least-once (Twilio/Resend have no server-side dedupe like
 * Stripe's meter identifier), so a rare duplicate alert is possible on retry —
 * acceptable, and far better than a missed job.
 *
 * Rows are deleted on success. After MAX_ATTEMPTS the row is kept for manual
 * review and alerted once via Sentry (attempts keeps incrementing so the alert
 * fires exactly when the threshold is crossed).
 */

const BATCH_LIMIT = 25;
const MAX_ATTEMPTS = 10;

async function resend(row) {
  if (row.channel === 'sms') {
    const payload = row.payload || {};
    await getTwilioClient().messages.create({
      body: payload.body,
      from: payload.from_number || process.env.TWILIO_FROM_NUMBER,
      to: row.recipient,
    });
    return;
  }
  if (row.channel === 'email') {
    const payload = row.payload || {};
    const result = await getResendClient().emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'alerts@voco.live',
      to: row.recipient,
      subject: payload.subject,
      html: payload.html,
    });
    // Resend returns { data, error } rather than throwing on API errors.
    if (result?.error) {
      throw new Error(result.error.message || String(result.error));
    }
    return;
  }
  throw new Error(`Unknown notification channel: ${row.channel}`);
}

export async function GET(request) {
  // Auth guard — same pattern as other crons
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: failures, error: queryError } = await supabase
    .from('owner_notification_failures')
    .select('id, tenant_id, notification_key, channel, recipient, payload, attempts')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(BATCH_LIMIT);

  if (queryError) {
    console.error('[retry-owner-notify] Query error:', queryError.message);
    return Response.json({ error: queryError.message }, { status: 500 });
  }

  const results = { retried: 0, succeeded: 0, failed: 0 };

  for (const row of failures || []) {
    results.retried += 1;
    try {
      await resend(row);

      const { error: delError } = await supabase
        .from('owner_notification_failures')
        .delete()
        .eq('id', row.id);
      if (delError) {
        // Row sticks around; it will be re-sent next run (at-least-once) — log and move on.
        console.error(`[retry-owner-notify] Sent but failed to delete outbox row ${row.id}:`, delError.message);
      }
      results.succeeded += 1;
      console.log(`[retry-owner-notify] Recovered ${row.channel} alert for ${row.notification_key} (tenant ${row.tenant_id})`);
    } catch (err) {
      results.failed += 1;
      const attempts = (row.attempts || 0) + 1;
      await supabase
        .from('owner_notification_failures')
        .update({
          attempts,
          last_attempt_at: new Date().toISOString(),
          failure_reason: String(err?.message || err).slice(0, 500),
        })
        .eq('id', row.id);

      if (attempts === MAX_ATTEMPTS) {
        Sentry.captureMessage(
          `Owner-notification retry exhausted for ${row.notification_key} (tenant ${row.tenant_id}): ${err.message} — owner alert undelivered, needs manual review`,
          'error',
        );
      }
      console.error(`[retry-owner-notify] Retry failed for ${row.notification_key} (attempt ${attempts}):`, err.message);
    }
  }

  return Response.json({ ok: true, ...results });
}

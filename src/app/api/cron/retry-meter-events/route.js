import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';

/**
 * Retry failed Stripe Billing Meter overage posts (2026-06-12 audit H4).
 *
 * The voice agent's post-call pipeline posts one meter event per over-quota
 * call; on failure it now writes an outbox row to stripe_meter_failures
 * (migration 071) instead of dropping the charge. This cron re-posts those
 * events with the SAME identifier (`overage_{call_id}`) — Stripe dedupes
 * meter events by identifier, so a retry can never double-bill even if the
 * original post actually landed before its response was lost.
 *
 * Rows are deleted on success. After MAX_ATTEMPTS the row is kept for manual
 * review and alerted once via Sentry (attempts keeps incrementing so the
 * alert fires exactly when the threshold is crossed).
 */

const BATCH_LIMIT = 25;
const MAX_ATTEMPTS = 10;

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
    .from('stripe_meter_failures')
    .select('id, tenant_id, call_id, stripe_customer_id, attempts')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(BATCH_LIMIT);

  if (queryError) {
    console.error('[retry-meter] Query error:', queryError.message);
    return Response.json({ error: queryError.message }, { status: 500 });
  }

  const results = { retried: 0, succeeded: 0, failed: 0 };

  for (const row of failures || []) {
    results.retried += 1;
    try {
      await stripe.billing.meterEvents.create({
        event_name: 'voco_calls',
        payload: { value: '1', stripe_customer_id: row.stripe_customer_id },
        identifier: `overage_${row.call_id}`,
      });

      const { error: delError } = await supabase
        .from('stripe_meter_failures')
        .delete()
        .eq('id', row.id);
      if (delError) {
        // Row sticks around but the identifier makes the next retry a no-op
        // on Stripe's side — log and move on.
        console.error(`[retry-meter] Posted but failed to delete outbox row ${row.id}:`, delError.message);
      }
      results.succeeded += 1;
      console.log(`[retry-meter] Recovered overage for call ${row.call_id} (tenant ${row.tenant_id})`);
    } catch (err) {
      results.failed += 1;
      const attempts = (row.attempts || 0) + 1;
      await supabase
        .from('stripe_meter_failures')
        .update({
          attempts,
          last_attempt_at: new Date().toISOString(),
          failure_reason: String(err?.message || err).slice(0, 500),
        })
        .eq('id', row.id);

      if (attempts === MAX_ATTEMPTS) {
        Sentry.captureMessage(
          `Stripe meter retry exhausted for call ${row.call_id} (tenant ${row.tenant_id}): ${err.message} — overage unbilled, needs manual review`,
          'error',
        );
      }
      console.error(`[retry-meter] Retry failed for call ${row.call_id} (attempt ${attempts}):`, err.message);
    }
  }

  return Response.json({ ok: true, ...results });
}

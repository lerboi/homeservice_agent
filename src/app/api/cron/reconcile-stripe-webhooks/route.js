import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';
import {
  handleCheckoutCompleted,
  handleSubscriptionEvent,
  handleInvoicePaid,
  handleTrialWillEnd,
  handleInvoicePaymentFailed,
} from '@/app/api/stripe/webhook/route';

/**
 * Reconcile stuck Stripe webhook events (2026-06-12 audit H2).
 *
 * The in-request webhook handler (src/app/api/stripe/webhook/route.js) only
 * acks 200 once processed=true and returns 500 otherwise, so Stripe keeps
 * retrying — but only for its ~3-day retry budget. If an event fails for that
 * entire window (a sustained bug, a long Twilio/DB outage), the row sits
 * processed=false forever with no recovery path. This cron is that backstop:
 * it re-fetches still-unprocessed events from Stripe and replays them through
 * the SAME handlers.
 *
 * Bounds:
 * - Stripe's Events API retains events ~30 days. Anything older can never be
 *   re-fetched, so we age-out at 25 days without burning an API call (and the
 *   resource_missing catch handles the boundary).
 * - Each row is claimed (processing_started_at) before replay using the same
 *   stale-claim rule as the live handler, so we never race an in-flight webhook
 *   on the same event_id.
 * - Replays are safe to repeat: the handlers are idempotent (billing_notifications
 *   dedup, provisionPhoneNumber reuse, the stripe_updated_at out-of-order guard).
 * - A row reaching this cron means the live path already failed for it, so we
 *   Sentry-alert even on a successful recovery to surface recurring failures.
 * - Unrecoverable rows (aged out) are marked processed=true (terminal) so they
 *   drain out of the query and can't sit at the head of the oldest-first batch
 *   and starve genuinely-recoverable rows behind them.
 *
 * Known bound: replaying an invoice.paid (subscription_cycle) resets calls_used
 * to 0. If such an event were stuck past a full billing cycle, a late replay
 * could zero the current cycle's usage. This is a narrow tail (requires the
 * in-request handler to fail an invoice.paid for days AND a cycle boundary to
 * pass before this cron runs); left as-is rather than adding period-comparison
 * logic to the shared, renewal-race-sensitive handleInvoicePaid handler.
 *
 * NOTE: the 56 legacy processed=false rows are pre-fix test-mode QA events
 * (migration 064 deliberately did not backfill them) and are >30 days old, so
 * they age out here. They were one-time marked processed to keep this query
 * draining only genuine future backlog.
 */

const BATCH_LIMIT = 50;
const STRIPE_EVENT_RETENTION_DAYS = 25; // Stay safely under Stripe's ~30-day window.
const STALE_CLAIM_MS = 10 * 60 * 1000;

export async function GET(request) {
  // Auth guard — same pattern as the other crons.
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: rows, error: queryError } = await supabase
    .from('stripe_webhook_events')
    .select('id, event_id, event_type, processed_at, processing_started_at')
    .eq('processed', false)
    .order('processed_at', { ascending: true }) // oldest first — closest to aging out
    .limit(BATCH_LIMIT);

  if (queryError) {
    console.error('[reconcile-webhooks] Query error:', queryError.message);
    return Response.json({ error: queryError.message }, { status: 500 });
  }

  const results = { scanned: 0, reprocessed: 0, unrecoverable: 0, skippedLive: 0, failed: 0 };
  const ageCutoff = Date.now() - STRIPE_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const staleClaimCutoff = new Date(Date.now() - STALE_CLAIM_MS).toISOString();

  for (const row of rows || []) {
    results.scanned += 1;

    // Age out: events older than Stripe's retention can never be re-fetched.
    // Don't waste an API call — flag once and move on (left processed=false; it
    // is equally un-retryable by Stripe so the row is inert).
    const ageRef = row.processing_started_at || row.processed_at;
    if (ageRef && new Date(ageRef).getTime() < ageCutoff) {
      results.unrecoverable += 1;
      // Terminal: Stripe can no longer return it, so it can never be replayed.
      // Mark processed=true so it drains and can't starve the oldest-first batch.
      await supabase
        .from('stripe_webhook_events')
        .update({ processed: true })
        .eq('id', row.id);
      console.warn(
        `[reconcile-webhooks] Event ${row.event_id} (${row.event_type}) older than ${STRIPE_EVENT_RETENTION_DAYS}d — unrecoverable from Stripe, marking terminal.`,
      );
      continue;
    }

    // Claim the row so we never race a live webhook delivery on the same event.
    // Only matches rows still unprocessed with no live claim (NULL or stale).
    const { data: claimed, error: claimError } = await supabase
      .from('stripe_webhook_events')
      .update({ processing_started_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('processed', false)
      .or(`processing_started_at.is.null,processing_started_at.lt.${staleClaimCutoff}`)
      .select('id');

    if (claimError) {
      results.failed += 1;
      console.error(`[reconcile-webhooks] Claim error for ${row.event_id}:`, claimError.message);
      continue;
    }
    if (!claimed || claimed.length === 0) {
      // A live webhook owns it (or it just completed) — leave it alone.
      results.skippedLive += 1;
      continue;
    }

    try {
      const event = await stripe.events.retrieve(row.event_id);
      const object = event.data?.object;

      // Same routing as the live webhook handler.
      if (event.type === 'checkout.session.completed') {
        await handleCheckoutCompleted(object, event.created);
      } else if (
        event.type === 'customer.subscription.created' ||
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.deleted' ||
        event.type === 'customer.subscription.paused' ||
        event.type === 'customer.subscription.resumed'
      ) {
        await handleSubscriptionEvent(object, event.created);
      } else if (event.type === 'customer.subscription.trial_will_end') {
        await handleTrialWillEnd(object);
      } else if (event.type === 'invoice.paid') {
        await handleInvoicePaid(object);
      } else if (event.type === 'invoice.payment_failed') {
        await handleInvoicePaymentFailed(object);
      } else {
        // Unhandled type — the live handler would no-op too. Nothing to replay;
        // mark processed so it stops resurfacing.
        console.log(`[reconcile-webhooks] Unhandled event type ${event.type} (${row.event_id}) — marking processed (no-op).`);
      }

      const { error: markError } = await supabase
        .from('stripe_webhook_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('id', row.id);

      if (markError) {
        // Side effects ran; only the flag write failed. Release the claim so the
        // next run re-claims and re-attempts the (idempotent) replay + flag.
        console.error(`[reconcile-webhooks] Recovered ${row.event_id} but failed to mark processed:`, markError.message);
        await supabase.from('stripe_webhook_events').update({ processing_started_at: null }).eq('id', row.id);
        results.failed += 1;
        continue;
      }

      results.reprocessed += 1;
      Sentry.captureMessage(
        `Stripe webhook event ${row.event_id} (${event.type}) recovered by the reconciliation cron — the in-request handler had failed for it.`,
        'warning',
      );
      console.log(`[reconcile-webhooks] Recovered event ${row.event_id} (${event.type}).`);
    } catch (err) {
      // Aged-out events return resource_missing — unrecoverable, not a failure.
      if (err?.code === 'resource_missing' || err?.statusCode === 404) {
        results.unrecoverable += 1;
        console.warn(`[reconcile-webhooks] Event ${row.event_id} no longer retrievable from Stripe (aged out) — marking terminal.`);
        // Terminal: it can never be re-fetched. Mark processed=true so it drains
        // instead of resurfacing every run.
        await supabase
          .from('stripe_webhook_events')
          .update({ processed: true, processing_started_at: null })
          .eq('id', row.id);
        continue;
      }
      results.failed += 1;
      // Release the claim so a later run can retry within the retention window.
      await supabase.from('stripe_webhook_events').update({ processing_started_at: null }).eq('id', row.id);
      Sentry.captureMessage(
        `Stripe webhook reconciliation failed for event ${row.event_id} (${row.event_type}): ${err?.message || err}`,
        'error',
      );
      console.error(`[reconcile-webhooks] Reprocess failed for ${row.event_id}:`, err?.message || err);
    }
  }

  return Response.json({ ok: true, ...results });
}

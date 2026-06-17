import { supabase } from '@/lib/supabase.js';
import { registerWatch, syncCalendarEvents } from '@/lib/scheduling/google-calendar.js';
import { renewOutlookSubscription, syncOutlookCalendarEvents } from '@/lib/scheduling/outlook-calendar.js';
import * as Sentry from '@sentry/nextjs';

/**
 * GET /api/cron/renew-calendar-channels
 *
 * Daily calendar-mirror keep-alive (2026-06-12 audit H6). Three jobs:
 *  1. Renew Google watch channels / Outlook subscriptions expiring within 24h.
 *  2. Pull-sync sweep: reconcile EVERY connected calendar so a dropped webhook
 *     is repaired within a day instead of silently freezing the mirror until
 *     the next change (which may never come) — the gap that previously left
 *     two tenants' calendars frozen for ~2 months.
 *  3. Staleness re-anchor + alerting: any calendar not synced within
 *     STALE_THRESHOLD_MS is treated as frozen — re-anchored AND surfaced to
 *     Sentry, so the failure is never silent again.
 *
 * Protected by CRON_SECRET bearer token. NOTE: if CRON_SECRET is not set in the
 * deployment environment this route returns 500 and NOTHING runs — that absence
 * is what let the channels expire unnoticed. Keep CRON_SECRET configured on Vercel.
 */

const RENEWAL_WINDOW_MS = 24 * 60 * 60 * 1000; // renew channels expiring within 24h
// A calendar the sweep keeps healthy advances last_synced_at every run, so a
// value older than ~26h means the sweep itself has been failing → frozen.
const STALE_THRESHOLD_MS = 26 * 60 * 60 * 1000;
const SWEEP_LIMIT = 500;

function alertSentry(message, level) {
  console.error(`[cron-renew] ${message}`);
  try {
    Sentry.captureMessage(`[calendar-sync] ${message}`, level || 'error');
  } catch {
    /* Sentry optional — never let alerting break the cron */
  }
}

function runSync(cred) {
  return cred.provider === 'google'
    ? syncCalendarEvents(cred.tenant_id)
    : syncOutlookCalendarEvents(cred.tenant_id);
}

/**
 * Blank-mirror-safe re-anchor: drop the sync token and run a FULL sync (which
 * re-extends the time window to "now" and upserts current events with a fresh
 * synced_at), THEN delete only the rows this run did not refresh. Crucially the
 * old rows are never wiped BEFORE the refetch, so a transient API failure leaves
 * the existing mirror intact rather than emptying it (a double-booking vector).
 * @returns {Promise<number>} count of stale rows purged
 */
async function reanchor(cred) {
  const runStartISO = new Date().toISOString();

  await supabase
    .from('calendar_credentials')
    .update({ last_sync_token: null })
    .eq('tenant_id', cred.tenant_id)
    .eq('provider', cred.provider);

  // Throws on failure → caller alerts; the not-yet-purged old rows survive (safe).
  await runSync(cred);

  const { data: staleRows } = await supabase
    .from('calendar_events')
    .select('external_id')
    .eq('tenant_id', cred.tenant_id)
    .eq('provider', cred.provider)
    .lt('synced_at', runStartISO);

  const staleIds = (staleRows || []).map((r) => r.external_id);
  if (staleIds.length > 0) {
    await supabase
      .from('calendar_blocks')
      .update({ external_event_id: null })
      .eq('tenant_id', cred.tenant_id)
      .in('external_event_id', staleIds);
    await supabase
      .from('appointments')
      .update({ external_event_id: null })
      .eq('tenant_id', cred.tenant_id)
      .in('external_event_id', staleIds);
    await supabase
      .from('calendar_events')
      .delete()
      .eq('tenant_id', cred.tenant_id)
      .eq('provider', cred.provider)
      .in('external_id', staleIds);
  }
  return staleIds.length;
}

export async function GET(request) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const nowMs = Date.now();
  const isFirstOfMonth = new Date().getDate() === 1;

  // ── 1) Renew watch channels expiring within 24h (or already expired) ──────
  const { data: expiring, error: expErr } = await supabase
    .from('calendar_credentials')
    .select('*')
    .not('watch_channel_id', 'is', null)
    .lt('watch_expiration', nowMs + RENEWAL_WINDOW_MS);

  if (expErr) {
    alertSentry(`channel-renewal query failed: ${expErr.message}`);
    return Response.json({ error: 'DB query failed' }, { status: 500 });
  }

  let renewed = 0;
  let renewFailed = 0;
  for (const cred of expiring || []) {
    try {
      if (cred.provider === 'google') {
        await registerWatch(
          cred.tenant_id,
          {
            access_token: cred.access_token,
            refresh_token: cred.refresh_token,
            expiry_date: cred.expiry_date,
          },
          cred.watch_channel_id,
          cred.watch_resource_id
        );
      } else if (cred.provider === 'outlook') {
        await renewOutlookSubscription(cred);
      }
      renewed += 1;
    } catch (err) {
      renewFailed += 1;
      alertSentry(`watch renewal failed for ${cred.provider} tenant ${cred.tenant_id}: ${err.message}`);
    }
  }

  // ── 2/3) Daily pull-sync sweep + staleness re-anchor + alerting ───────────
  const { data: allCreds, error: allErr } = await supabase
    .from('calendar_credentials')
    .select('*')
    .in('provider', ['google', 'outlook'])
    .limit(SWEEP_LIMIT);

  if (allErr) {
    alertSentry(`sweep query failed: ${allErr.message}`);
    return Response.json({ renewed, renewFailed, error: 'sweep query failed' }, { status: 500 });
  }

  let swept = 0;
  let reanchored = 0;
  let frozenDetected = 0;
  let sweepFailed = 0;

  for (const cred of allCreds || []) {
    const lastMs = cred.last_synced_at ? new Date(cred.last_synced_at).getTime() : 0;
    const isStale = !lastMs || nowMs - lastMs > STALE_THRESHOLD_MS;

    try {
      if (isStale) {
        // Surface BEFORE attempting recovery, so even a re-anchor that later
        // throws still produced a visible "this calendar was frozen" signal.
        frozenDetected += 1;
        alertSentry(
          `frozen calendar detected (${cred.provider} tenant ${cred.tenant_id}, last synced ${cred.last_synced_at || 'never'}) — re-anchoring`,
          'warning'
        );
        await reanchor(cred);
        reanchored += 1;
      } else if (isFirstOfMonth) {
        // Monthly proactive re-anchor re-extends the time window (incremental
        // sync tokens only report changes inside the ORIGINAL window).
        await reanchor(cred);
        reanchored += 1;
      } else {
        // Healthy: cheap incremental sync (advances the token + last_synced_at,
        // and self-recovers via the lib's 410 handler if the token expired).
        await runSync(cred);
        swept += 1;
      }
    } catch (err) {
      sweepFailed += 1;
      alertSentry(`pull-sync sweep failed for ${cred.provider} tenant ${cred.tenant_id}: ${err.message}`);
    }
  }

  return Response.json({
    ok: true,
    renewed,
    renewFailed,
    swept,
    reanchored,
    frozenDetected,
    sweepFailed,
    isFirstOfMonth,
  });
}

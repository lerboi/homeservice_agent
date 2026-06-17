import { supabase } from '@/lib/supabase.js';
import { registerWatch, syncCalendarEvents } from '@/lib/scheduling/google-calendar.js';
import { renewOutlookSubscription, syncOutlookCalendarEvents } from '@/lib/scheduling/outlook-calendar.js';

/**
 * POST /api/cron/renew-calendar-channels
 * Renews expiring Google Calendar watch channels and Outlook subscriptions
 * before their TTL expires.
 *
 * Protected by CRON_SECRET bearer token — called by Supabase pg_cron or external scheduler.
 * Renews channels expiring within the next 24 hours.
 */
export async function GET(request) {
  // Verify cron secret (Vercel Cron uses GET)
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expectedToken) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const renewalWindowMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const cutoffTimestamp = Date.now() + renewalWindowMs;

  // Find credentials with channels expiring within the next 24 hours
  // Skip credentials without active subscriptions (no watch_channel_id)
  const { data: expiring, error } = await supabase
    .from('calendar_credentials')
    .select('*')
    .not('watch_channel_id', 'is', null)
    .lt('watch_expiration', cutoffTimestamp);

  if (error) {
    console.error('[cron-renew] DB query error:', error);
    return Response.json({ error: 'DB query failed' }, { status: 500 });
  }

  if (!expiring || expiring.length === 0) {
    return Response.json({ ok: true, renewed: 0, message: 'No channels expiring soon' });
  }

  const results = [];

  for (const cred of expiring) {
    try {
      if (cred.provider === 'google') {
        await registerWatch(cred.tenant_id, {
          access_token: cred.access_token,
          refresh_token: cred.refresh_token,
          expiry_date: cred.expiry_date,
        }, cred.watch_channel_id, cred.watch_resource_id);
      } else if (cred.provider === 'outlook') {
        await renewOutlookSubscription(cred);
      }
      results.push({ tenant_id: cred.tenant_id, provider: cred.provider, status: 'renewed' });
      console.log(`[cron-renew] Renewed ${cred.provider} subscription for tenant ${cred.tenant_id}`);
    } catch (err) {
      console.error(`[cron-renew] Failed ${cred.provider} for tenant ${cred.tenant_id}:`, err.message);
      results.push({ tenant_id: cred.tenant_id, provider: cred.provider, status: 'error', error: err.message });
    }
  }

  const renewed = results.filter((r) => r.status === 'renewed').length;
  const failed = results.filter((r) => r.status === 'error').length;

  // ── Monthly window re-anchor (2026-06-12 audit H6) ───────────────────────
  // Both providers' sync windows (now−30d → now+180d) are otherwise fixed at
  // whatever moment the LAST full sync ran: sync tokens only report changes
  // inside the original window, so ~6 months after connect the mirror would
  // stop seeing new events entirely unless a fortuitous 410 forced a resync.
  // On the 1st of each month, drop every credential's sync token, wipe its
  // mirror rows, and run a fresh full sync — re-anchoring the window to now.
  let reanchored = 0;
  if (new Date().getDate() === 1) {
    const { data: allCreds } = await supabase
      .from('calendar_credentials')
      .select('tenant_id, provider')
      .in('provider', ['google', 'outlook'])
      .limit(100);

    for (const cred of allCreds || []) {
      try {
        await supabase
          .from('calendar_credentials')
          .update({ last_sync_token: null })
          .eq('tenant_id', cred.tenant_id)
          .eq('provider', cred.provider);
        await supabase
          .from('calendar_events')
          .delete()
          .eq('tenant_id', cred.tenant_id)
          .eq('provider', cred.provider);
        if (cred.provider === 'google') {
          await syncCalendarEvents(cred.tenant_id);
        } else {
          await syncOutlookCalendarEvents(cred.tenant_id);
        }
        reanchored += 1;
      } catch (err) {
        console.error(`[cron-renew] Re-anchor failed for ${cred.provider} tenant ${cred.tenant_id}:`, err.message);
      }
    }
  }

  return Response.json({
    ok: true,
    renewed,
    failed,
    reanchored,
    results,
  });
}

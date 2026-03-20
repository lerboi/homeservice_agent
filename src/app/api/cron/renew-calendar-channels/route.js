import { supabase } from '@/lib/supabase.js';
import { registerWatch } from '@/lib/scheduling/google-calendar.js';

/**
 * POST /api/cron/renew-calendar-channels
 * Renews expiring Google Calendar watch channels before their 7-day TTL expires.
 *
 * Protected by CRON_SECRET bearer token — called by Supabase pg_cron or external scheduler.
 * Renews channels expiring within the next 24 hours.
 */
export async function POST(request) {
  // Verify cron secret
  const authHeader = request.headers.get('Authorization');
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expectedToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const renewalWindowMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const cutoffTimestamp = Date.now() + renewalWindowMs;

  // Find credentials with channels expiring within the next 24 hours
  const { data: expiring, error } = await supabase
    .from('calendar_credentials')
    .select('*')
    .lt('watch_expiration', cutoffTimestamp.toString());

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
      await registerWatch(cred.tenant_id, {
        access_token: cred.access_token,
        refresh_token: cred.refresh_token,
        expiry_date: cred.expiry_date,
      });
      results.push({ tenant_id: cred.tenant_id, status: 'renewed' });
      console.log(`[cron-renew] Renewed watch for tenant ${cred.tenant_id}`);
    } catch (err) {
      console.error(`[cron-renew] Failed for tenant ${cred.tenant_id}:`, err.message);
      results.push({ tenant_id: cred.tenant_id, status: 'error', error: err.message });
    }
  }

  const renewed = results.filter((r) => r.status === 'renewed').length;
  const failed = results.filter((r) => r.status === 'error').length;

  return Response.json({
    ok: true,
    renewed,
    failed,
    results,
  });
}

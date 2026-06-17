// Keep-fresh cron for Jobber/Xero OAuth tokens (prod-readiness 2026-06).
//
// WHY THIS EXISTS: Xero access tokens live ~30 min and Jobber ~60 min. Before
// this cron, the only refresh paths were demand-driven (webhooks, dashboard
// reads, the 15-min Jobber visits poll) and — worst of all — the LiveKit
// agent's pre-session context fetch, which runs under a 0.8s budget. An
// in-call refresh racing that budget could lose a single-use rotated refresh
// token mid-flight and permanently brick the connection ("reconnect Jobber/
// Xero" recurring even though the owner did nothing wrong).
//
// Running every 10 minutes with a 15-minute lookahead guarantees a healthy
// row always has ≥ ~10 minutes of validity when a call arrives, so the agent
// virtually never refreshes in-call. refreshTokenIfNeeded provides the
// per-(tenant, provider) lease lock, fatal-vs-transient classification, and
// one-shot owner notification.
//
// Rows already flagged error_state='token_refresh_failed' are skipped — their
// refresh token is dead and only an owner reconnect heals them; retrying
// would just burn provider rate limits.

import { createClient } from '@supabase/supabase-js';
import { refreshTokenIfNeeded } from '@/lib/integrations/adapter';

// Must exceed the cron cadence (10 min) so a token can never expire between
// two runs: worst case a row is refreshed when ~15 min remain and checked
// again 10 min later with ~5 min spare.
const LOOKAHEAD_MS = 15 * 60 * 1000;

export async function GET(request) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data: creds, error } = await admin
    .from('accounting_credentials')
    .select('*')
    .is('error_state', null)
    .lt('expiry_date', Date.now() + LOOKAHEAD_MS);

  if (error) {
    console.error('[cron-refresh-integration-tokens] credential query failed:', error.message);
    return Response.json({ error: 'query failed' }, { status: 500 });
  }

  const results = [];
  for (const cred of creds ?? []) {
    try {
      await refreshTokenIfNeeded(admin, cred, { bufferMs: LOOKAHEAD_MS });
      results.push({ tenant_id: cred.tenant_id, provider: cred.provider, status: 'refreshed' });
    } catch (err) {
      // Per-row isolation — fatal failures already flagged error_state +
      // notified inside refreshTokenIfNeeded; transient ones retry next run.
      console.error(JSON.stringify({
        scope: 'cron-refresh-integration-tokens',
        tenant_id: cred.tenant_id,
        provider: cred.provider,
        status: 'error',
        message: err?.message,
      }));
      results.push({ tenant_id: cred.tenant_id, provider: cred.provider, status: 'error' });
    }
  }

  return Response.json({ checked: creds?.length ?? 0, results });
}

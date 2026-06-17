/**
 * One-off: re-register Google Calendar push watch channels for frozen tenants
 * (2026-06-12 audit H6). The deployed renew cron cannot do this right now because
 * CRON_SECRET is not set in Vercel (every cron 500s), so we register the watch
 * here — but pointed at the PRODUCTION webhook host so Google can reach it.
 *
 * The notification address MUST be the canonical prod host (www.voco.live), NOT
 * local NEXT_PUBLIC_APP_URL (localhost). Override via WATCH_WEBHOOK_BASE.
 *
 * Run: WATCH_WEBHOOK_BASE=https://www.voco.live node --env-file=.env.local scripts/reregister-google-watches.mjs
 *
 * Mirrors src/lib/scheduling/google-calendar.js :: registerWatch.
 */
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WATCH_BASE = process.env.WATCH_WEBHOOK_BASE || 'https://www.voco.live';

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${WATCH_BASE}/api/google-calendar/callback`
  );
}

async function reregister(creds) {
  const tenantId = creds.tenant_id;
  const oauth2Client = createOAuth2Client();

  // Refresh + persist token first (the deployed registerWatch relies on
  // googleapis auto-refresh, but doing it explicitly catches dead grants early).
  oauth2Client.setCredentials({ refresh_token: creds.refresh_token });
  let refreshed;
  try {
    ({ credentials: refreshed } = await oauth2Client.refreshAccessToken());
  } catch (err) {
    return { tenantId, ok: false, stage: 'token_refresh', error: err?.response?.data?.error || err?.message };
  }
  oauth2Client.setCredentials({
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token || creds.refresh_token,
    expiry_date: refreshed.expiry_date,
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Stop the old (expired) channel — non-fatal.
  if (creds.watch_channel_id && creds.watch_resource_id) {
    try {
      await calendar.channels.stop({
        requestBody: { id: creds.watch_channel_id, resourceId: creds.watch_resource_id },
      });
    } catch (err) {
      console.log(`[reregister] old channel stop (non-fatal) for ${tenantId}: ${err.message}`);
    }
  }

  let watchData;
  try {
    const response = await calendar.events.watch({
      calendarId: 'primary',
      requestBody: {
        id: crypto.randomUUID(),
        type: 'web_hook',
        address: `${WATCH_BASE}/api/webhooks/google-calendar`,
        token: tenantId,
        params: { ttl: '604800' }, // 7 days
      },
    });
    watchData = response.data;
  } catch (err) {
    return { tenantId, ok: false, stage: 'events.watch', error: err?.response?.data?.error?.message || err?.message };
  }

  await supabase
    .from('calendar_credentials')
    .update({
      watch_channel_id: watchData.id,
      watch_resource_id: watchData.resourceId,
      watch_expiration: watchData.expiration,
    })
    .eq('tenant_id', tenantId)
    .eq('provider', 'google');

  return {
    tenantId,
    ok: true,
    address: `${WATCH_BASE}/api/webhooks/google-calendar`,
    new_channel_id: watchData.id,
    expiration: new Date(Number(watchData.expiration)).toISOString(),
  };
}

async function main() {
  const { data: creds, error } = await supabase
    .from('calendar_credentials')
    .select('*')
    .eq('provider', 'google');
  if (error) {
    console.error('load failed:', error.message);
    process.exit(1);
  }
  console.log(`Re-registering ${creds.length} Google watch channel(s) -> ${WATCH_BASE}\n`);
  for (const c of creds) {
    console.log(JSON.stringify(await reregister(c)));
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error('FATAL:', e); process.exit(1); });

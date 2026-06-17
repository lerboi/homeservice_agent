/**
 * One-off operational revival for frozen Google Calendar mirrors (2026-06-12 audit H6).
 *
 * Forces a fresh FULL sync for every connected Google calendar_credentials row:
 *   refresh token -> events.list (now-30d .. now+180d) -> upsert calendar_events
 *   -> reconcile stale mirror rows -> persist new sync token + last_synced_at.
 *
 * This is the URL-INDEPENDENT half of the fix (events.list needs no webhook URL),
 * so it is safe to run locally even though local NEXT_PUBLIC_APP_URL=localhost.
 * Watch-channel RE-REGISTRATION is intentionally NOT done here — that needs the
 * production webhook address and is driven through the deployed renew cron.
 *
 * Run:  node --env-file=.env.local scripts/revive-google-calendars.mjs
 *
 * Faithful to src/lib/scheduling/google-calendar.js :: syncCalendarEvents
 * (full-sync branch) + the safe stale-reconciliation the audit recommended
 * (delete rows not refreshed this run AFTER a successful upsert, never before).
 */
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAX_SYNC_PAGES = 20;

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/google-calendar/callback`
  );
}

async function reviveTenant(creds, runStartISO) {
  const tenantId = creds.tenant_id;
  const oauth2Client = createOAuth2Client();

  // 1) Ensure a valid access token. Both frozen creds are expired, so force a
  //    refresh from the refresh_token and persist it (mirrors getValidGoogleAccessToken).
  oauth2Client.setCredentials({ refresh_token: creds.refresh_token });
  let refreshed;
  try {
    ({ credentials: refreshed } = await oauth2Client.refreshAccessToken());
  } catch (err) {
    return {
      tenantId,
      ok: false,
      stage: 'token_refresh',
      error: err?.response?.data?.error || err?.message || String(err),
    };
  }
  oauth2Client.setCredentials({
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token || creds.refresh_token,
    expiry_date: refreshed.expiry_date,
  });
  await supabase
    .from('calendar_credentials')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token || creds.refresh_token,
      expiry_date: refreshed.expiry_date,
    })
    .eq('tenant_id', tenantId)
    .eq('provider', 'google');

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // 2) Full sync window (re-anchored to NOW) — identical to syncCalendarEvents full path.
  const items = [];
  let nextSyncToken = null;
  let pageToken = null;
  let pages = 0;
  const timeMin = new Date(Date.now() - 30 * 86400000).toISOString();
  const timeMax = new Date(Date.now() + 180 * 86400000).toISOString();
  do {
    const response = await calendar.events.list({
      calendarId: creds.calendar_id || 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      maxResults: 2500,
      ...(pageToken ? { pageToken } : {}),
    });
    items.push(...(response.data.items || []));
    pageToken = response.data.nextPageToken || null;
    nextSyncToken = response.data.nextSyncToken || nextSyncToken;
    pages++;
    if (pages >= MAX_SYNC_PAGES && pageToken) break;
  } while (pageToken);

  // 3) Upsert current (non-cancelled) events with a fresh synced_at (>= runStart).
  const syncedAt = new Date().toISOString();
  const toUpsert = items
    .filter((evt) => evt.status !== 'cancelled')
    .map((evt) => ({
      tenant_id: tenantId,
      provider: 'google',
      external_id: evt.id,
      title: evt.summary || '',
      start_time: evt.start?.dateTime || evt.start?.date,
      end_time: evt.end?.dateTime || evt.end?.date,
      is_all_day: !evt.start?.dateTime,
      synced_at: syncedAt,
    }));

  if (toUpsert.length > 0) {
    const { error: upErr } = await supabase
      .from('calendar_events')
      .upsert(toUpsert, { onConflict: 'tenant_id,provider,external_id' });
    if (upErr) {
      return { tenantId, ok: false, stage: 'upsert', error: upErr.message };
    }
  }

  // 4) Reconcile stale rows ONLY after a successful upsert (no blank-mirror window):
  //    any mirror row not refreshed this run (synced_at < runStart) is gone from
  //    the live calendar — unlink references, then delete.
  const { data: staleRows } = await supabase
    .from('calendar_events')
    .select('external_id')
    .eq('tenant_id', tenantId)
    .eq('provider', 'google')
    .lt('synced_at', runStartISO);
  const staleIds = (staleRows || []).map((r) => r.external_id);
  let purged = 0;
  if (staleIds.length > 0) {
    await supabase
      .from('calendar_blocks')
      .update({ external_event_id: null })
      .eq('tenant_id', tenantId)
      .in('external_event_id', staleIds);
    await supabase
      .from('appointments')
      .update({ external_event_id: null })
      .eq('tenant_id', tenantId)
      .in('external_event_id', staleIds);
    const { error: delErr } = await supabase
      .from('calendar_events')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('provider', 'google')
      .in('external_id', staleIds);
    if (!delErr) purged = staleIds.length;
  }

  // 5) Persist new sync token + last_synced_at.
  if (nextSyncToken) {
    await supabase
      .from('calendar_credentials')
      .update({ last_sync_token: nextSyncToken, last_synced_at: syncedAt })
      .eq('tenant_id', tenantId)
      .eq('provider', 'google');
  }

  return {
    tenantId,
    ok: true,
    fetched: items.length,
    upserted: toUpsert.length,
    purgedStale: purged,
    gotSyncToken: Boolean(nextSyncToken),
  };
}

async function main() {
  const runStartISO = new Date().toISOString();
  const { data: creds, error } = await supabase
    .from('calendar_credentials')
    .select('*')
    .eq('provider', 'google');
  if (error) {
    console.error('Failed to load credentials:', error.message);
    process.exit(1);
  }
  console.log(`Reviving ${creds.length} Google calendar(s) (runStart=${runStartISO})\n`);
  for (const c of creds) {
    const r = await reviveTenant(c, runStartISO);
    console.log(JSON.stringify(r));
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});

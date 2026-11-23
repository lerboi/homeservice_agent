// Verify a tenant's Google Calendar connection: force a real token refresh,
// create a test event, read it back, delete it. Prints no secrets.
//
// Usage (from the homeservice_agent repo root):
//   node --env-file=.env.local vault/_meta/tools/verify_google_calendar.mjs <tenant_id>
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const tenantId = process.argv[2];
if (!tenantId) {
  console.error('usage: verify_google_calendar.mjs <tenant_id>');
  process.exit(2);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: creds, error } = await supabase
  .from('calendar_credentials')
  .select('refresh_token, calendar_id, calendar_name, is_primary')
  .eq('tenant_id', tenantId)
  .eq('provider', 'google')
  .maybeSingle();

if (error || !creds) {
  console.error('FAIL no google calendar_credentials row', error?.message || '');
  process.exit(1);
}
console.log(`row: calendar_name=${creds.calendar_name} is_primary=${creds.is_primary}`);

const oauth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
oauth.setCredentials({ refresh_token: creds.refresh_token });

try {
  const { credentials } = await oauth.refreshAccessToken();
  console.log(`refresh: OK (expires in ${Math.round((credentials.expiry_date - Date.now()) / 60000)} min)`);
  await supabase
    .from('calendar_credentials')
    .update({
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token || creds.refresh_token,
      expiry_date: credentials.expiry_date,
    })
    .eq('tenant_id', tenantId)
    .eq('provider', 'google');

  const calendar = google.calendar({ version: 'v3', auth: oauth });
  const calendarId = creds.calendar_id || 'primary';
  const start = new Date(Date.now() + 24 * 3600 * 1000);
  const end = new Date(start.getTime() + 15 * 60 * 1000);
  const created = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: 'Voco connection test (safe to delete)',
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    },
  });
  console.log(`create: OK id=${created.data.id} hasLink=${Boolean(created.data.htmlLink)}`);
  const read = await calendar.events.get({ calendarId, eventId: created.data.id });
  console.log(`read: OK status=${read.data.status}`);
  await calendar.events.delete({ calendarId, eventId: created.data.id });
  console.log('delete: OK');
  console.log('PASS');
} catch (err) {
  console.error('FAIL', err?.response?.data?.error || err?.message || err);
  process.exit(1);
}

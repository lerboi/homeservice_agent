// Read back the calendar event a demo call created, and optionally clean up.
// Prints no secrets.
//
// Usage (from the homeservice_agent repo root):
//   node --env-file=.env.local vault/_meta/tools/demo_event_check.mjs <tenant_id> [room_name] [--cleanup]
// Without a room name it uses the tenant's most recent test call.
// --cleanup deletes the Google event and cancels the appointment.
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const cleanup = process.argv.includes('--cleanup');
const [tenantId, roomName] = args;
if (!tenantId) {
  console.error('usage: demo_event_check.mjs <tenant_id> [room_name] [--cleanup]');
  process.exit(2);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let callQuery = supabase
  .from('calls')
  .select('id, call_id, booking_outcome, is_test_call, created_at')
  .eq('tenant_id', tenantId)
  .eq('is_test_call', true)
  .order('created_at', { ascending: false })
  .limit(1);
if (roomName) callQuery = callQuery.eq('call_id', roomName);
const { data: calls } = await callQuery;
const call = calls?.[0];
if (!call) {
  console.error('FAIL no test call found');
  process.exit(1);
}
console.log(`call: ${call.call_id} booking_outcome=${call.booking_outcome}`);

const { data: appts } = await supabase
  .from('appointments')
  .select('id, status, start_time, end_time, caller_name, notes, external_event_id, external_event_provider')
  .eq('tenant_id', tenantId)
  .eq('call_id', call.id);
if (!appts?.length) {
  console.error('FAIL the call has no appointment');
  process.exit(1);
}

const { data: creds } = await supabase
  .from('calendar_credentials')
  .select('refresh_token, calendar_id')
  .eq('tenant_id', tenantId)
  .eq('provider', 'google')
  .maybeSingle();
const oauth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
oauth.setCredentials({ refresh_token: creds?.refresh_token });
const calendar = google.calendar({ version: 'v3', auth: oauth });
const calendarId = creds?.calendar_id || 'primary';

let failed = false;
for (const appt of appts) {
  console.log(
    `appointment: ${appt.id} status=${appt.status} start=${appt.start_time} ` +
      `caller=${appt.caller_name} notes=${appt.notes} ` +
      `event=${appt.external_event_provider || '-'}:${appt.external_event_id || '-'}`
  );
  if (appt.external_event_id && appt.external_event_provider === 'google') {
    try {
      const ev = await calendar.events.get({ calendarId, eventId: appt.external_event_id });
      console.log(
        `  google event: status=${ev.data.status} summary=${JSON.stringify(ev.data.summary)} ` +
          `description=${JSON.stringify(ev.data.description)} ` +
          `start=${ev.data.start?.dateTime} tz=${ev.data.start?.timeZone} hasLink=${Boolean(ev.data.htmlLink)}`
      );
      if (cleanup) {
        await calendar.events.delete({ calendarId, eventId: appt.external_event_id });
        console.log('  google event: deleted');
      }
    } catch (err) {
      failed = true;
      console.log(`  google event: FAIL ${err?.response?.data?.error?.message || err?.message}`);
    }
  } else {
    console.log('  google event: none recorded on the appointment');
  }
  if (cleanup && appt.status !== 'cancelled') {
    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appt.id);
    console.log('  appointment: cancelled');
  }
}
process.exit(failed ? 1 : 0);

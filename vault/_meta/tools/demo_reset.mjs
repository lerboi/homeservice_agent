// Reset the demo tenant between takes: remove every booking that test or demo
// calls left on the calendar. Prints no secrets.
//
// Usage (from the homeservice_agent repo root):
//   node --env-file=.env.local vault/_meta/tools/demo_reset.mjs <tenant_id> [--dry-run]
//
// For each confirmed, not-yet-ended appointment that belongs to a TEST call of
// the tenant: delete its Google Calendar event, delete the synced copy in
// calendar_events, and cancel the appointment. An appointment that belongs to
// a real call is never touched. Exit code 1 if anything could not be removed.
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dryRun = process.argv.includes('--dry-run');
const [tenantId] = args;
if (!tenantId) {
  console.error('usage: demo_reset.mjs <tenant_id> [--dry-run]');
  process.exit(2);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: appts, error: apptError } = await supabase
  .from('appointments')
  .select('id, call_id, status, start_time, caller_name, notes, external_event_id, external_event_provider')
  .eq('tenant_id', tenantId)
  .eq('status', 'confirmed')
  .gte('end_time', new Date().toISOString())
  .order('start_time', { ascending: true });
if (apptError) {
  console.error(`FAIL could not read appointments: ${apptError.message}`);
  process.exit(1);
}

const callIds = [...new Set((appts || []).map((a) => a.call_id).filter(Boolean))];
let testCallIds = new Set();
if (callIds.length) {
  const { data: calls, error: callError } = await supabase
    .from('calls')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_test_call', true)
    .in('id', callIds);
  if (callError) {
    console.error(`FAIL could not read calls: ${callError.message}`);
    process.exit(1);
  }
  testCallIds = new Set((calls || []).map((c) => c.id));
}

const mine = (appts || []).filter((a) => testCallIds.has(a.call_id));
const skipped = (appts || []).length - mine.length;
if (skipped) console.log(`left alone: ${skipped} upcoming appointment(s) that do not belong to a test call`);
if (!mine.length) {
  console.log('clean: no demo bookings on the calendar');
  process.exit(0);
}

let calendar = null;
let calendarId = 'primary';
if (mine.some((a) => a.external_event_id && a.external_event_provider === 'google')) {
  const { data: creds } = await supabase
    .from('calendar_credentials')
    .select('refresh_token, calendar_id')
    .eq('tenant_id', tenantId)
    .eq('provider', 'google')
    .maybeSingle();
  if (creds?.refresh_token) {
    const oauth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    oauth.setCredentials({ refresh_token: creds.refresh_token });
    calendar = google.calendar({ version: 'v3', auth: oauth });
    calendarId = creds.calendar_id || 'primary';
  }
}

let failed = false;
for (const appt of mine) {
  const label = `${appt.caller_name || 'Caller'}${appt.notes ? `: ${appt.notes}` : ''} at ${appt.start_time}`;
  if (dryRun) {
    console.log(`would remove: ${label} (event ${appt.external_event_provider || '-'})`);
    continue;
  }
  let eventGone = true;
  if (appt.external_event_id) {
    if (appt.external_event_provider === 'google' && calendar) {
      try {
        await calendar.events.delete({ calendarId, eventId: appt.external_event_id });
      } catch (err) {
        const status = err?.code || err?.response?.status;
        // Already deleted by hand in the calendar counts as removed.
        if (status !== 404 && status !== 410) {
          eventGone = false;
          console.log(`  FAIL calendar event not deleted: ${err?.response?.data?.error?.message || err?.message}`);
        }
      }
    } else {
      eventGone = false;
      console.log(`  FAIL no ${appt.external_event_provider || 'calendar'} connection to delete the event with`);
    }
    if (eventGone) {
      await supabase
        .from('calendar_events')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('external_id', appt.external_event_id);
    }
  }
  const { error: cancelError } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', appt.id)
    .eq('tenant_id', tenantId);
  if (cancelError) {
    failed = true;
    console.log(`  FAIL appointment not cancelled: ${cancelError.message}`);
  }
  if (!eventGone) failed = true;
  console.log(`removed: ${label}${eventGone ? '' : ' (calendar event still there: delete it by hand)'}`);
}
process.exit(failed ? 1 : 0);

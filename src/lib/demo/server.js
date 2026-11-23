/**
 * Demo Studio server helpers (service-role Supabase, Google/Microsoft APIs).
 * Import only from route handlers.
 */

import { google } from 'googleapis';
import { supabase } from '@/lib/supabase';
import { createOAuth2Client } from '@/lib/scheduling/google-calendar.js';
import { refreshOutlookAccessToken } from '@/lib/scheduling/outlook-calendar.js';
import { DESTINATIONS } from './destinations.js';

/**
 * The tenant demo calls run as: DEMO_TENANT_ID when set, otherwise the tenant
 * the signed-in admin owns. Returns null when there is none or it cannot take
 * calls (the agent resolves the tenant from its phone number).
 */
export async function resolveDemoTenant(adminUser) {
  let query = supabase
    .from('tenants')
    .select('id, business_name, phone_number, tenant_timezone, onboarding_complete');
  query = process.env.DEMO_TENANT_ID
    ? query.eq('id', process.env.DEMO_TENANT_ID)
    : query.eq('owner_id', adminUser.id);
  const { data: tenant } = await query.maybeSingle();
  return tenant || null;
}

function shortError(err) {
  const data = err?.response?.data;
  const code = data?.error_description || data?.error?.message || data?.error || err?.message;
  return String(code || 'unknown error').slice(0, 160);
}

/** Refresh the Google token for real and read the calendar it writes to. */
async function checkGoogle(creds) {
  try {
    const oauth = createOAuth2Client();
    oauth.setCredentials({ refresh_token: creds.refresh_token });
    const { credentials } = await oauth.refreshAccessToken();
    await supabase
      .from('calendar_credentials')
      .update({
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || creds.refresh_token,
        expiry_date: credentials.expiry_date,
      })
      .eq('tenant_id', creds.tenant_id)
      .eq('provider', 'google');

    // The primary calendar's title is the account's address: it tells the
    // owner which Google account the demo will write to. Also proves the
    // token can reach the calendar, not just refresh.
    let account = creds.calendar_name || null;
    try {
      const calendar = google.calendar({ version: 'v3', auth: oauth });
      const list = await calendar.events.list({
        calendarId: creds.calendar_id || 'primary',
        maxResults: 1,
        timeMin: new Date().toISOString(),
      });
      account = list.data.summary || account;
    } catch (err) {
      return { healthy: false, account, detail: `Token refreshed but the calendar is unreachable: ${shortError(err)}` };
    }
    return { healthy: true, account, detail: null };
  } catch (err) {
    return { healthy: false, account: creds.calendar_name || null, detail: shortError(err) };
  }
}

async function checkOutlook(creds) {
  try {
    const tokens = await refreshOutlookAccessToken(creds.refresh_token);
    if (!tokens?.access_token) throw new Error('no access token returned');
    return { healthy: true, account: creds.calendar_name || null, detail: null };
  } catch (err) {
    return { healthy: false, account: creds.calendar_name || null, detail: shortError(err) };
  }
}

/**
 * Status of every destination for the tenant. External destinations get a
 * real token refresh, so a dead connection is caught before recording rather
 * than mid-take.
 */
export async function getDestinationStatuses(tenantId) {
  const { data: rows } = await supabase
    .from('calendar_credentials')
    .select('tenant_id, provider, refresh_token, calendar_id, calendar_name, is_primary, created_at')
    .eq('tenant_id', tenantId);
  const byProvider = new Map((rows || []).map((r) => [r.provider, r]));

  return Promise.all(
    DESTINATIONS.map(async (destination) => {
      const base = { id: destination.id, label: destination.label, kind: destination.kind };
      if (destination.kind === 'internal') {
        return { ...base, connected: true, healthy: true, account: null, detail: null };
      }
      const creds = byProvider.get(destination.provider);
      if (!creds) {
        return { ...base, connected: false, healthy: false, account: null, detail: null };
      }
      const check = destination.provider === 'google' ? await checkGoogle(creds) : await checkOutlook(creds);
      return {
        ...base,
        connected: true,
        connected_at: creds.created_at,
        is_primary: creds.is_primary,
        ...check,
      };
    })
  );
}

/** Demo bookings still on the calendar: appointments kept by test calls. */
export async function listKeptBookings(tenantId) {
  const { data: calls } = await supabase
    .from('calls')
    .select('id, call_id')
    .eq('tenant_id', tenantId)
    .eq('is_test_call', true)
    .order('created_at', { ascending: false })
    .limit(50);
  if (!calls?.length) return [];
  const roomByCall = new Map(calls.map((c) => [c.id, c.call_id]));

  const { data: appts } = await supabase
    .from('appointments')
    .select('id, call_id, start_time, end_time, caller_name, notes, status, external_event_id, external_event_provider')
    .eq('tenant_id', tenantId)
    .neq('status', 'cancelled')
    .in('call_id', calls.map((c) => c.id))
    .order('start_time', { ascending: true });

  return (appts || []).map((a) => ({
    appointment_id: a.id,
    room_name: roomByCall.get(a.call_id) || null,
    start_time: a.start_time,
    end_time: a.end_time,
    caller_name: a.caller_name,
    reason: a.notes,
    provider: a.external_event_provider,
    has_event: Boolean(a.external_event_id),
  }));
}

async function deleteExternalEvent(tenantId, appt) {
  if (!appt.external_event_id) return { deleted: false, reason: 'no_event' };
  const provider = appt.external_event_provider || 'google';
  const { data: creds } = await supabase
    .from('calendar_credentials')
    .select('refresh_token, calendar_id')
    .eq('tenant_id', tenantId)
    .eq('provider', provider)
    .maybeSingle();
  if (!creds) return { deleted: false, reason: 'not_connected' };

  try {
    if (provider === 'google') {
      const oauth = createOAuth2Client();
      oauth.setCredentials({ refresh_token: creds.refresh_token });
      const calendar = google.calendar({ version: 'v3', auth: oauth });
      await calendar.events.delete({
        calendarId: creds.calendar_id || 'primary',
        eventId: appt.external_event_id,
      });
    } else {
      const tokens = await refreshOutlookAccessToken(creds.refresh_token);
      const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${appt.external_event_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (!res.ok && res.status !== 404) throw new Error(`Graph ${res.status}`);
    }
    return { deleted: true };
  } catch (err) {
    const status = err?.code || err?.response?.status;
    // Already gone (deleted by hand in the calendar) counts as removed.
    if (status === 404 || status === 410) return { deleted: true, reason: 'already_gone' };
    return { deleted: false, reason: shortError(err) };
  }
}

/**
 * Remove everything a demo call left behind: the external calendar event, its
 * mirrored calendar_events row, and the appointment (cancelled, not deleted).
 * Only appointments that belong to a TEST call of this tenant are touched, so
 * the route can never cancel a real booking.
 */
export async function removeDemoBooking(tenantId, roomName) {
  const { data: call } = await supabase
    .from('calls')
    .select('id, is_test_call')
    .eq('tenant_id', tenantId)
    .eq('call_id', roomName)
    .maybeSingle();
  if (!call) return { found: false, removed: [] };
  if (!call.is_test_call) return { found: false, removed: [], error: 'Not a test call' };

  const { data: appts } = await supabase
    .from('appointments')
    .select('id, status, external_event_id, external_event_provider')
    .eq('tenant_id', tenantId)
    .eq('call_id', call.id);

  const removed = [];
  for (const appt of appts || []) {
    const event = await deleteExternalEvent(tenantId, appt);
    if (appt.external_event_id) {
      await supabase
        .from('calendar_events')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('external_id', appt.external_event_id);
    }
    if (appt.status !== 'cancelled') {
      await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appt.id)
        .eq('tenant_id', tenantId);
    }
    removed.push({
      appointment_id: appt.id,
      event_deleted: event.deleted,
      event_note: event.reason || null,
    });
  }
  return { found: true, removed };
}

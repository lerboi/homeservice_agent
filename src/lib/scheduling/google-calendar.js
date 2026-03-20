import { google } from 'googleapis';
import { supabase } from '@/lib/supabase.js';

/**
 * Create a Google OAuth2 client using environment variables.
 * @returns {import('googleapis').Auth.OAuth2Client}
 */
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/google-calendar/callback`
  );
}

/**
 * Generate the Google OAuth consent URL.
 * @param {import('googleapis').Auth.OAuth2Client} oauth2Client
 * @returns {string} Authorization URL
 */
export function getAuthUrl(oauth2Client) {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
  });
}

/**
 * Create a Google Calendar event for a platform appointment.
 * @param {{ credentials: object, appointment: object }} params
 * @returns {Promise<string>} Created event ID
 */
export async function createCalendarEvent({ credentials, appointment }) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token,
    expiry_date: credentials.expiry_date,
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const urgencyPrefix =
    appointment.urgency === 'emergency' ? '[URGENT] ' : '';

  const summary = `${urgencyPrefix}${appointment.job_type || 'Service'} — ${appointment.caller_name || 'Customer'}`;

  const event = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary,
      location: appointment.service_address,
      start: {
        dateTime: appointment.start_time,
        timeZone: appointment.timezone || 'UTC',
      },
      end: {
        dateTime: appointment.end_time,
        timeZone: appointment.timezone || 'UTC',
      },
      extendedProperties: {
        private: {
          platform_appointment_id: appointment.id,
          tenant_id: appointment.tenant_id,
        },
      },
    },
  });

  return event.data.id;
}

/**
 * Register a Google Calendar push notification watch channel for a tenant.
 * @param {string} tenantId
 * @param {{ access_token: string, refresh_token: string, expiry_date: number }} credentials
 * @returns {Promise<object>} Watch response data
 */
export async function registerWatch(tenantId, credentials) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token,
    expiry_date: credentials.expiry_date,
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const response = await calendar.events.watch({
    calendarId: 'primary',
    requestBody: {
      id: crypto.randomUUID(),
      type: 'web_hook',
      address: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/google-calendar`,
      token: tenantId,
      params: {
        ttl: '604800', // 7 days in seconds
      },
    },
  });

  const watchData = response.data;

  // Persist watch channel info to DB
  await supabase
    .from('calendar_credentials')
    .update({
      watch_channel_id: watchData.id,
      watch_resource_id: watchData.resourceId,
      watch_expiration: watchData.expiration,
    })
    .eq('tenant_id', tenantId);

  return watchData;
}

/**
 * Perform incremental sync of Google Calendar events to the local mirror.
 * Handles 410 Gone by falling back to a full re-sync.
 * @param {string} tenantId
 * @returns {Promise<void>}
 */
export async function syncCalendarEvents(tenantId) {
  // Load stored credentials
  const { data: creds, error: credError } = await supabase
    .from('calendar_credentials')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (credError || !creds) {
    console.error(`[calendar-sync] No credentials for tenant ${tenantId}`);
    return;
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: creds.access_token,
    refresh_token: creds.refresh_token,
    expiry_date: creds.expiry_date,
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  let items = [];
  let nextSyncToken = null;

  try {
    // Incremental sync using stored sync token
    const response = await calendar.events.list({
      calendarId: creds.calendar_id || 'primary',
      syncToken: creds.last_sync_token,
    });
    items = response.data.items || [];
    nextSyncToken = response.data.nextSyncToken;
  } catch (err) {
    // 410 Gone: sync token is invalid, perform full re-sync
    if (err.code === 410) {
      console.log(`[calendar-sync] 410 Gone for tenant ${tenantId} — performing full re-sync`);
      const response = await calendar.events.list({
        calendarId: creds.calendar_id || 'primary',
        timeMin: new Date().toISOString(),
        singleEvents: true,
      });
      items = response.data.items || [];
      nextSyncToken = response.data.nextSyncToken;
    } else {
      throw err;
    }
  }

  // Upsert synced events into local mirror
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
      synced_at: new Date().toISOString(),
    }));

  if (toUpsert.length > 0) {
    await supabase
      .from('calendar_events')
      .upsert(toUpsert, { onConflict: 'tenant_id,provider,external_id' });
  }

  // Delete cancelled events from mirror
  const toDelete = items.filter((evt) => evt.status === 'cancelled').map((evt) => evt.id);
  for (const externalId of toDelete) {
    await supabase
      .from('calendar_events')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('external_id', externalId);
  }

  // Persist new sync token and update last_synced_at
  if (nextSyncToken) {
    await supabase
      .from('calendar_credentials')
      .update({
        last_sync_token: nextSyncToken,
        last_synced_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId);
  }
}

/**
 * Push a platform booking to the owner's Google Calendar.
 * Silently returns if no calendar credentials are configured.
 * @param {string} tenantId
 * @param {string} appointmentId
 * @returns {Promise<void>}
 */
export async function pushBookingToCalendar(tenantId, appointmentId) {
  // Load appointment
  const { data: appointment, error: apptError } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', appointmentId)
    .single();

  if (apptError || !appointment) {
    console.error(`[calendar-push] Appointment ${appointmentId} not found`);
    return;
  }

  // Load credentials
  const { data: creds, error: credError } = await supabase
    .from('calendar_credentials')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  // Silently return if no calendar connected
  if (credError || !creds) {
    return;
  }

  // Create calendar event
  const eventId = await createCalendarEvent({
    credentials: creds,
    appointment,
  });

  // Store google_event_id on appointment
  await supabase
    .from('appointments')
    .update({ google_event_id: eventId })
    .eq('id', appointmentId);
}

/**
 * Revoke Google OAuth token and disconnect calendar for a tenant.
 * @param {string} tenantId
 * @returns {Promise<void>}
 */
export async function revokeAndDisconnect(tenantId) {
  const { data: creds } = await supabase
    .from('calendar_credentials')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (!creds) return;

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: creds.access_token,
    refresh_token: creds.refresh_token,
  });

  // Revoke the token
  try {
    await oauth2Client.revokeToken(creds.refresh_token);
  } catch (err) {
    console.error(`[calendar-revoke] Token revoke failed for tenant ${tenantId}:`, err.message);
  }

  // Stop watch channel if active
  if (creds.watch_channel_id) {
    try {
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      await calendar.channels.stop({
        requestBody: {
          id: creds.watch_channel_id,
          resourceId: creds.watch_resource_id,
        },
      });
    } catch (err) {
      console.error(`[calendar-revoke] Channel stop failed:`, err.message);
    }
  }

  // Delete credentials row
  await supabase
    .from('calendar_credentials')
    .delete()
    .eq('tenant_id', tenantId);

  // Delete all mirrored calendar events
  await supabase
    .from('calendar_events')
    .delete()
    .eq('tenant_id', tenantId);
}

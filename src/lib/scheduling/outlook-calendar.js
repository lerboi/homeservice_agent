import { ConfidentialClientApplication } from '@azure/msal-node';
import { supabase } from '@/lib/supabase.js';

// ============================================================
// Constants
// ============================================================
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SCOPES = ['https://graph.microsoft.com/Calendars.ReadWrite', 'offline_access'];

// ============================================================
// MSAL Client (lazy singleton, same pattern as OpenAI in layer2-llm.js)
// ============================================================
let _msalClient = null;

function getMsalClient() {
  if (!_msalClient) {
    _msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        authority: 'https://login.microsoftonline.com/common',
      },
    });
  }
  return _msalClient;
}

// ============================================================
// Graph API REST wrapper
// ============================================================

/**
 * Centralized fetch wrapper for Microsoft Graph API.
 * Handles full URLs (deltaLink) and relative paths.
 * @param {string} urlOrPath - Full URL or path like '/me/events'
 * @param {string} accessToken
 * @param {object} options - fetch options (method, body, headers)
 * @returns {Promise<object|null>} Parsed JSON or null for 204 responses
 */
async function graphFetch(urlOrPath, accessToken, options = {}) {
  const url = urlOrPath.startsWith('https://') ? urlOrPath : `${GRAPH_BASE}${urlOrPath}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 204) {
    return null;
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(`Graph API ${res.status}: ${error.error?.message || res.statusText}`);
  }

  return res.json();
}

// ============================================================
// OAuth Functions
// ============================================================

/**
 * Generate Microsoft OAuth consent URL.
 * @param {string} state - HMAC-signed state parameter for CSRF protection
 * @returns {Promise<string>} Authorization URL
 */
export async function getOutlookAuthUrl(state) {
  const msalClient = getMsalClient();
  return msalClient.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/outlook-calendar/callback`,
    state,
  });
}

/**
 * Exchange authorization code for tokens via MSAL.
 * @param {string} code - Authorization code from OAuth callback
 * @returns {Promise<{ accessToken: string, account: object }>}
 */
export async function exchangeCodeForTokens(code) {
  const msalClient = getMsalClient();
  const tokenResponse = await msalClient.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/outlook-calendar/callback`,
  });

  return {
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken,
    account: tokenResponse.account,
  };
}

/**
 * Refresh access token via direct HTTP POST (serverless-safe, per Pitfall 3).
 * Does not rely on MSAL in-memory cache.
 * @param {string} refreshToken
 * @returns {Promise<{ access_token: string, refresh_token: string, expires_in: number }>}
 */
export async function refreshOutlookAccessToken(refreshToken) {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: 'https://graph.microsoft.com/Calendars.ReadWrite offline_access',
  });

  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
  }

  return res.json();
}

// ============================================================
// Token Helper
// ============================================================

/**
 * Get a valid access token, refreshing if needed (5-min buffer).
 * @param {object} creds - calendar_credentials row
 * @returns {Promise<string>} Valid access token
 */
async function getValidAccessToken(creds) {
  if (creds.expiry_date > Date.now() + 300000) {
    return creds.access_token;
  }

  const tokenData = await refreshOutlookAccessToken(creds.refresh_token);

  await supabase
    .from('calendar_credentials')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expiry_date: Date.now() + tokenData.expires_in * 1000,
    })
    .eq('tenant_id', creds.tenant_id)
    .eq('provider', 'outlook');

  return tokenData.access_token;
}

// ============================================================
// Calendar Event CRUD
// ============================================================

/**
 * Create a calendar event in the user's Outlook calendar.
 * @param {{ credentials: object, appointment: object }} params
 * @returns {Promise<string>} Created event ID
 */
export async function createOutlookCalendarEvent({ credentials, appointment }) {
  const accessToken = await getValidAccessToken(credentials);

  const urgencyPrefix = appointment.urgency === 'emergency' ? '[URGENT] ' : '';
  const subject = `${urgencyPrefix}${appointment.job_type || 'Service'} — ${appointment.caller_name || 'Customer'}`;

  const eventBody = {
    subject,
    start: {
      dateTime: appointment.start_time,
      timeZone: appointment.timezone || 'UTC',
    },
    end: {
      dateTime: appointment.end_time,
      timeZone: appointment.timezone || 'UTC',
    },
    location: {
      displayName: appointment.service_address,
    },
    singleValueExtendedProperties: [
      {
        id: 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name platform_appointment_id',
        value: appointment.id,
      },
    ],
  };

  const event = await graphFetch('/me/events', accessToken, {
    method: 'POST',
    body: JSON.stringify(eventBody),
  });

  return event.id;
}

// ============================================================
// Webhook Subscription
// ============================================================

/**
 * Create a Graph API subscription for calendar event changes.
 * @param {string} tenantId
 * @param {string} accessToken
 * @returns {Promise<object>} Subscription data
 */
export async function createOutlookSubscription(tenantId, accessToken) {
  const expirationDateTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const subscription = await graphFetch('/subscriptions', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      changeType: 'created,updated,deleted',
      notificationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/outlook-calendar`,
      resource: '/me/events',
      expirationDateTime: expirationDateTime.toISOString(),
      clientState: process.env.OUTLOOK_WEBHOOK_SECRET,
    }),
  });

  // Persist subscription ID and expiration to DB
  await supabase
    .from('calendar_credentials')
    .update({
      watch_channel_id: subscription.id,
      watch_expiration: expirationDateTime.getTime(),
    })
    .eq('tenant_id', tenantId)
    .eq('provider', 'outlook');

  return subscription;
}

// ============================================================
// Delta Query Sync
// ============================================================

/**
 * Perform incremental sync of Outlook calendar events to local mirror.
 * Uses delta queries for efficient sync.
 * @param {string} tenantId
 * @returns {Promise<void>}
 */
export async function syncOutlookCalendarEvents(tenantId) {
  // Load stored credentials
  const { data: creds, error: credError } = await supabase
    .from('calendar_credentials')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('provider', 'outlook')
    .single();

  if (credError || !creds) {
    console.error(`[outlook-sync] No Outlook credentials for tenant ${tenantId}`);
    return;
  }

  const accessToken = await getValidAccessToken(creds);

  // Determine sync URL
  let url;
  if (creds.last_sync_token) {
    // Incremental sync using stored deltaLink (store FULL URL per anti-pattern warning)
    url = creds.last_sync_token;
  } else {
    // Initial full sync — use calendarView/delta with date range (Pitfall 2)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const sixMonths = new Date(Date.now() + 180 * 86400000).toISOString();
    url = `${GRAPH_BASE}/me/calendarView/delta?startDateTime=${thirtyDaysAgo}&endDateTime=${sixMonths}`;
  }

  let allEvents = [];
  let deltaLink = null;

  // Page through results
  while (url) {
    const data = await graphFetch(url, accessToken);
    allEvents.push(...(data.value || []));
    url = data['@odata.nextLink'] || null;
    if (data['@odata.deltaLink']) {
      deltaLink = data['@odata.deltaLink'];
    }
  }

  // Upsert non-removed events to calendar_events mirror
  const toUpsert = allEvents
    .filter((evt) => !evt['@removed'])
    .map((evt) => ({
      tenant_id: tenantId,
      provider: 'outlook',
      external_id: evt.id,
      title: evt.subject || '',
      start_time: evt.start?.dateTime,
      end_time: evt.end?.dateTime,
      is_all_day: evt.isAllDay || false,
      synced_at: new Date().toISOString(),
    }));

  if (toUpsert.length > 0) {
    await supabase
      .from('calendar_events')
      .upsert(toUpsert, { onConflict: 'tenant_id,provider,external_id' });
  }

  // Delete events with @removed annotation
  const toDelete = allEvents.filter((evt) => evt['@removed']).map((evt) => evt.id);
  if (toDelete.length > 0) {
    await supabase
      .from('calendar_events')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('provider', 'outlook')
      .in('external_id', toDelete);
  }

  // Persist deltaLink and update last_synced_at
  if (deltaLink) {
    await supabase
      .from('calendar_credentials')
      .update({
        last_sync_token: deltaLink,
        last_synced_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('provider', 'outlook');
  }
}

// ============================================================
// Subscription Renewal
// ============================================================

/**
 * Renew an Outlook subscription before expiry.
 * @param {object} cred - calendar_credentials row
 * @returns {Promise<void>}
 */
export async function renewOutlookSubscription(cred) {
  const accessToken = await getValidAccessToken(cred);
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await graphFetch(`/subscriptions/${cred.watch_channel_id}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify({
      expirationDateTime: newExpiry.toISOString(),
    }),
  });

  await supabase
    .from('calendar_credentials')
    .update({ watch_expiration: newExpiry.getTime() })
    .eq('tenant_id', cred.tenant_id)
    .eq('provider', 'outlook');
}

// ============================================================
// Disconnect
// ============================================================

/**
 * Revoke Outlook calendar access and clean up all related data.
 * @param {string} tenantId
 * @returns {Promise<void>}
 */
export async function revokeAndDisconnectOutlook(tenantId) {
  const { data: creds } = await supabase
    .from('calendar_credentials')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('provider', 'outlook')
    .single();

  if (!creds) return;

  // Delete subscription via Graph API (try/catch — don't fail on 404)
  if (creds.watch_channel_id) {
    try {
      const accessToken = await getValidAccessToken(creds);
      await graphFetch(`/subscriptions/${creds.watch_channel_id}`, accessToken, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error(`[outlook-revoke] Subscription delete failed for tenant ${tenantId}:`, err.message);
    }
  }

  // Delete credentials row
  await supabase
    .from('calendar_credentials')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('provider', 'outlook');

  // Delete mirrored Outlook events
  await supabase
    .from('calendar_events')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('provider', 'outlook');
}

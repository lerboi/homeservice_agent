# Phase 8: Outlook Calendar Sync - Research

**Researched:** 2026-03-24
**Domain:** Microsoft Graph API calendar integration, OAuth 2.0, webhooks, delta query
**Confidence:** HIGH

## Summary

Phase 8 adds Outlook Calendar as a second calendar provider alongside the existing Google Calendar integration. The existing codebase already has provider-aware schema (`calendar_credentials.provider IN ('google','outlook')`, `calendar_events.provider` column with unique constraint on `tenant_id,provider,external_id`), making this primarily an implementation phase rather than a schema redesign.

Microsoft Graph API provides calendar event subscriptions (webhooks) with a **maximum expiry of 10,080 minutes (~7 days)** for Outlook event resources -- not the "3 days" mentioned in the phase description. The CONTEXT.md references "3-day expiry" which appears to come from other Graph resource types (Teams chat, call records). The cron renewal logic should target renewal within 24 hours of expiry regardless. Delta queries via `/me/calendarView/delta` provide incremental sync capability analogous to Google's `syncToken` approach.

The code migration is well-scoped: fix 5-6 `.single()` calls in google-calendar.js that lack provider filters, generalize `appointments.google_event_id` to provider-agnostic columns, add `is_primary` support, and build the Outlook sync module mirroring the Google module structure. The UI changes are contained to CalendarSyncCard.js, which becomes a dual-provider card.

**Primary recommendation:** Use `@azure/msal-node` for OAuth token management and direct `fetch()` calls to Microsoft Graph REST API (no SDK). Mirror the existing google-calendar.js module structure for outlook-calendar.js. Use MSAL's `ConfidentialClientApplication` for token acquisition and refresh, and raw Graph REST endpoints for calendar operations (event CRUD, subscriptions, delta queries).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Both Google and Outlook can be connected simultaneously. Both calendar providers feed blocked slots into the local `calendar_events` mirror, and the availability calculator (which already queries without a provider filter) merges them automatically.
- **D-02:** Bookings push to one "primary" calendar only -- not both. This avoids duplicate events when the owner has external cross-sync (e.g., Google-Outlook sync enabled by their IT admin).
- **D-03:** First connected calendar becomes the primary automatically. A "Make Primary" button appears on the non-primary provider row.
- **D-04:** When the primary calendar is disconnected while the other is still connected, the remaining calendar is auto-promoted to primary. No user prompt needed.
- **D-05:** Single combined "Calendar Sync" card in dashboard settings. Both providers appear as rows inside one card -- Google row and Outlook row -- each with its own connect/disconnect button, sync status dot, and last-synced timestamp.
- **D-06:** The primary calendar row shows a `[PRIMARY]` badge. The non-primary row shows a `[Make Primary]` button.
- **D-07:** When neither provider is connected, show the current empty-state pattern (dashed border, icon, description) but with two connect buttons (one for Google, one for Outlook) instead of one.
- **D-08:** Fix 5-6 `.single()` calls in `google-calendar.js` that query `calendar_credentials` without a `.eq('provider', 'google')` filter -- these will throw errors when a second provider row exists.
- **D-09:** Generalize `appointments.google_event_id` column to support provider-agnostic external event references (e.g., `external_event_id` + `external_event_provider`, or a jsonb column).
- **D-10:** Add `is_primary boolean DEFAULT false` column to `calendar_credentials` table (or a `primary_calendar_provider` column on `tenants`).

### Claude's Discretion
- Microsoft Graph API integration details (delta queries vs. full sync, subscription creation)
- Outlook OAuth callback route design and token refresh strategy
- Outlook webhook endpoint and notification validation (client state token approach)
- Cron schedule for Outlook subscription renewal (3-day expiry vs Google's 7-day)
- How to handle Microsoft 365 admin consent errors in UX (STATE.md blocker noted -- verify against live Azure AD response)
- `onboarding_complete` backfill safety approach (STATE.md blocker)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OUTLOOK-01 | Owner can connect Outlook Calendar via Microsoft OAuth from dashboard settings | MSAL ConfidentialClientApplication + authorization code flow; popup OAuth pattern reused from Google; Azure AD app registration required with `Calendars.ReadWrite` scope |
| OUTLOOK-02 | Outlook calendar events sync bidirectionally with local availability database | Microsoft Graph delta query (`/me/calendarView/delta`) for inbound sync; `POST /me/events` for outbound push; webhook subscription for real-time notifications |
| OUTLOOK-03 | Outlook webhook subscriptions auto-renew before 3-day expiry via cron job | Graph subscription max expiry is actually 10,080 min (~7 days) for calendar events; renew via `PATCH /subscriptions/{id}`; extend existing cron route to handle both providers |
| OUTLOOK-04 | Owner can disconnect Outlook Calendar and revert to manual availability | Delete subscription via `DELETE /subscriptions/{id}`, clear credentials row, delete mirrored events; auto-promote remaining calendar per D-04 |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @azure/msal-node | 5.1.1 | Microsoft OAuth 2.0 token acquisition and refresh | Official Microsoft auth library; handles token caching, refresh, and PKCE; ConfidentialClientApplication for server-side auth code flow |
| next (existing) | 16.1.7 | API routes, `after()` for async webhook processing | Already in project; webhook handler pattern established |
| @supabase/supabase-js (existing) | 2.99.2 | Database operations for credentials and events | Already in project; service-role client for webhook operations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns (existing) | 4.1.0 | Timestamp formatting in UI | Already in project; reuse for "last synced" display |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @azure/msal-node | Manual OAuth2 fetch calls | MSAL handles token refresh, caching, error handling automatically; worth the dependency |
| Direct fetch() to Graph API | @microsoft/microsoft-graph-client (3.0.7) | Graph client SDK adds bulk that is unnecessary for 4-5 endpoints; direct fetch is lighter, matches project pattern of minimal dependencies, and gives full control over error handling |

**Installation:**
```bash
npm install @azure/msal-node
```

**Version verification:** `@azure/msal-node@5.1.1` confirmed via npm registry 2026-03-24. `@microsoft/microsoft-graph-client@3.0.7` verified but not recommended (last published ~2 years ago, heavy for this use case).

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    scheduling/
      google-calendar.js        # Existing -- add .eq('provider','google') filters
      outlook-calendar.js       # NEW -- mirror of google-calendar.js for Graph API
  app/
    api/
      outlook-calendar/
        auth/route.js           # NEW -- initiates Microsoft OAuth
        callback/route.js       # NEW -- handles OAuth redirect, exchanges code
      webhooks/
        google-calendar/route.js  # Existing
        outlook-calendar/route.js # NEW -- Graph subscription notifications
      cron/
        renew-calendar-channels/route.js  # MODIFY -- handle both providers
      calendar-sync/
        status/route.js         # MODIFY -- return both providers
        disconnect/route.js     # MODIFY -- accept provider param
        set-primary/route.js    # NEW -- switch primary calendar
  components/
    dashboard/
      CalendarSyncCard.js       # REWRITE -- dual-provider card
  lib/
    webhooks/
      google-calendar-push.js   # Existing
      outlook-calendar-push.js  # NEW -- mirror of google push handler
```

### Pattern 1: MSAL ConfidentialClientApplication for OAuth
**What:** Use MSAL to manage the OAuth authorization code flow instead of raw HTTP requests
**When to use:** All Microsoft Graph authenticated operations
**Example:**
```javascript
// Source: https://learn.microsoft.com/en-us/javascript/api/@azure/msal-node/confidentialclientapplication
import { ConfidentialClientApplication } from '@azure/msal-node';

const msalConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    authority: 'https://login.microsoftonline.com/common',
  },
};

const msalClient = new ConfidentialClientApplication(msalConfig);

// Generate auth URL
const authUrl = await msalClient.getAuthCodeUrl({
  scopes: ['Calendars.ReadWrite'],
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/outlook-calendar/callback`,
  state: tenantId, // CSRF protection, same pattern as Google
});

// Exchange code for tokens
const tokenResponse = await msalClient.acquireTokenByCode({
  code: authorizationCode,
  scopes: ['Calendars.ReadWrite'],
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/outlook-calendar/callback`,
});
// tokenResponse.accessToken, tokenResponse.account
```

### Pattern 2: Direct Graph REST Calls with fetch()
**What:** Call Microsoft Graph API directly using fetch() with Bearer token
**When to use:** All calendar operations (event CRUD, subscriptions, delta queries)
**Example:**
```javascript
// Source: https://learn.microsoft.com/en-us/graph/api/calendar-post-events
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

async function graphFetch(path, accessToken, options = {}) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(`Graph API ${res.status}: ${error.error?.message || res.statusText}`);
  }
  return res.json();
}

// Create event
await graphFetch('/me/events', accessToken, {
  method: 'POST',
  body: JSON.stringify({
    subject: `${urgencyPrefix}${appointment.job_type} - ${appointment.caller_name}`,
    start: { dateTime: appointment.start_time, timeZone: appointment.timezone || 'UTC' },
    end: { dateTime: appointment.end_time, timeZone: appointment.timezone || 'UTC' },
    location: { displayName: appointment.service_address },
    singleValueExtendedProperties: [{
      id: 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name platform_appointment_id',
      value: appointment.id,
    }],
  }),
});
```

### Pattern 3: Graph Subscription with Validation Handshake
**What:** Microsoft Graph requires a validation handshake when creating subscriptions -- the webhook endpoint must respond to a POST with `?validationToken=...` by returning the token as plain text
**When to use:** Webhook endpoint for Outlook calendar notifications
**Example:**
```javascript
// Source: https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks
export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const validationToken = searchParams.get('validationToken');

  // Validation handshake -- return token as plain text
  if (validationToken) {
    return new Response(decodeURIComponent(validationToken), {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // Actual notification -- process async, return 202
  const body = await request.json();
  after(async () => {
    for (const notification of body.value) {
      if (notification.clientState !== process.env.OUTLOOK_WEBHOOK_SECRET) continue;
      await syncOutlookCalendarEvents(notification.subscriptionId);
    }
  });

  return new Response(null, { status: 202 });
}
```

### Pattern 4: Delta Query for Incremental Sync
**What:** Microsoft Graph delta queries track changes incrementally, similar to Google's syncToken
**When to use:** Syncing Outlook calendar events to local mirror
**Example:**
```javascript
// Source: https://learn.microsoft.com/en-us/graph/api/event-delta
async function syncOutlookEvents(tenantId) {
  const creds = await loadCredentials(tenantId, 'outlook');
  const accessToken = await getValidAccessToken(creds);

  let url;
  if (creds.last_sync_token) {
    // Incremental sync using stored deltaLink
    url = creds.last_sync_token; // This is the full deltaLink URL
  } else {
    // Initial full sync
    const now = new Date().toISOString();
    const sixMonths = new Date(Date.now() + 180 * 86400000).toISOString();
    url = `${GRAPH_BASE}/me/calendarView/delta?startDateTime=${now}&endDateTime=${sixMonths}`;
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

  // Upsert and delete, then persist deltaLink
  // ... (same upsert/delete pattern as Google sync)
}
```

### Anti-Patterns to Avoid
- **Storing full deltaLink URLs without the domain:** The `@odata.deltaLink` is a full URL including query parameters -- store the complete URL, not just the token portion.
- **Using `.single()` without provider filter:** Already flagged in D-08. Every query to `calendar_credentials` must include `.eq('provider', 'google')` or `.eq('provider', 'outlook')`.
- **Creating subscriptions with delegated tokens from expired sessions:** Store the refresh token and use MSAL's `acquireTokenSilent` or `acquireTokenByRefreshToken` for token renewal before Graph API calls.
- **Returning JSON from validation endpoint:** Graph expects plain text/plain response with the raw validationToken -- returning JSON causes 415 error and subscription creation failure.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth token refresh | Manual refresh_token HTTP calls with retry | @azure/msal-node ConfidentialClientApplication | MSAL handles token caching, automatic refresh, retry on transient errors, and PKCE |
| Graph API error parsing | Custom error parsing for each endpoint | Centralized `graphFetch()` wrapper | Graph API returns consistent `{ error: { code, message } }` shape; one wrapper handles all |
| Subscription expiry tracking | Custom timer/scheduler | Extend existing cron route (`renew-calendar-channels`) | Already have the pattern; just add provider-aware query |
| Calendar event deduplication | Custom merge logic | Supabase `UPSERT` on `(tenant_id, provider, external_id)` unique constraint | DB-level deduplication is already in place for Google events |

**Key insight:** The existing Google Calendar integration provides a battle-tested blueprint. Every Outlook operation has a direct analog: OAuth flow, event creation, webhook registration, incremental sync, disconnect/revoke. The work is translation, not invention.

## Common Pitfalls

### Pitfall 1: Graph Subscription Validation Handshake is POST, Not GET
**What goes wrong:** Developers expect the validation token to come as a GET request (like some webhook platforms), but Microsoft Graph sends a POST with `?validationToken=` as a query parameter. The response MUST be plain text, not JSON.
**Why it happens:** Confusion with other webhook implementations; Next.js route handlers default to JSON responses.
**How to avoid:** Check for `validationToken` query param at the top of the POST handler. Return `new Response(decodedToken, { headers: { 'Content-Type': 'text/plain' } })`.
**Warning signs:** Subscription creation returns 400/415 errors; "Subscription validation request failed" in Graph API error response.

### Pitfall 2: Delta Query Requires CalendarView with Date Range
**What goes wrong:** Using `/me/events/delta` (which does not exist in v1.0) instead of `/me/calendarView/delta?startDateTime=...&endDateTime=...`.
**Why it happens:** Google Calendar uses `/events` with a syncToken; developers assume the same pattern.
**How to avoid:** Always use `/me/calendarView/delta` with `startDateTime` and `endDateTime` query parameters for the initial request. Subsequent requests use the stored `@odata.deltaLink` URL which contains the encoded parameters.
**Warning signs:** 400 Bad Request on delta endpoint; "Resource not found" errors.

### Pitfall 3: MSAL Token Refresh in Serverless Context
**What goes wrong:** MSAL's in-memory token cache is lost between serverless function invocations. `acquireTokenSilent` fails because the cache is empty.
**Why it happens:** Next.js API routes are stateless/serverless; MSAL's default cache is in-memory.
**How to avoid:** Store `refresh_token` in the database (already done via `calendar_credentials.refresh_token`). On each API call, use MSAL's `acquireTokenByRefreshToken` (available in ConfidentialClientApplication) or make a direct token refresh HTTP call to `https://login.microsoftonline.com/common/oauth2/v2.0/token`.
**Warning signs:** "No account found" errors from MSAL; intermittent auth failures in production.

### Pitfall 4: Microsoft 365 Admin Consent for Personal vs Work Accounts
**What goes wrong:** Personal Microsoft accounts (outlook.com, hotmail.com) work immediately, but work/school accounts may require admin consent if the Azure AD tenant restricts user consent.
**Why it happens:** Enterprise Azure AD tenants often disable user consent for third-party apps. The owner gets an "AADSTS65001: admin approval is required" error.
**How to avoid:** Use the `/common` authority endpoint (supports both personal and work accounts). Show a clear error message when consent is denied: "Your organization requires admin approval. Contact your IT administrator." This maps to the STATE.md blocker about verifying the exact error shape.
**Warning signs:** OAuth flow works for personal accounts but fails for enterprise users; error code AADSTS65001 or AADSTS90094 in the redirect.

### Pitfall 5: Subscription Expiry is 7 Days, Not 3 Days
**What goes wrong:** Cron job renews too aggressively or documentation/comments reference wrong expiry.
**Why it happens:** The CONTEXT.md and phase description reference "3-day expiry" but Microsoft Graph documentation states Outlook event subscriptions have a maximum expiry of **10,080 minutes (under 7 days)**.
**How to avoid:** Set subscription expiry to 7 days (matching Google). Use the same 24-hour renewal window in the cron job. Update comments to reflect the actual 7-day maximum.
**Warning signs:** None -- this is a documentation accuracy issue, not a runtime failure.

### Pitfall 6: Existing `.single()` Calls Break with Two Providers
**What goes wrong:** The 5-6 `.single()` calls in google-calendar.js that query `calendar_credentials` without `.eq('provider', 'google')` will throw "multiple rows returned" errors when both Google and Outlook are connected.
**Why it happens:** Original code assumed only one calendar provider per tenant.
**How to avoid:** Fix ALL `.single()` calls in google-calendar.js BEFORE adding Outlook credentials. Add `.eq('provider', 'google')` filter to every query. This is D-08 and must be the first migration task.
**Warning signs:** "PGRST116: The result contains 0 rows" or "multiple rows returned" errors after connecting second provider.

## Code Examples

### Microsoft Graph Subscription Creation
```javascript
// Source: https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks
async function createOutlookSubscription(tenantId, accessToken) {
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

  // Persist subscription ID and expiration
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
```

### Subscription Renewal (extend existing cron)
```javascript
// Source: https://learn.microsoft.com/en-us/graph/api/subscription-update
async function renewOutlookSubscription(cred) {
  const accessToken = await getValidAccessToken(cred);
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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
```

### Token Refresh via Direct HTTP (serverless-safe)
```javascript
// For serverless contexts where MSAL cache is unavailable
async function refreshOutlookAccessToken(refreshToken) {
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
    const error = await res.json();
    throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
  }

  return res.json(); // { access_token, refresh_token, expires_in }
}
```

## Database Migration Required

### New Migration File: `008_outlook_calendar.sql`
```sql
-- Add is_primary column to calendar_credentials
ALTER TABLE calendar_credentials
  ADD COLUMN is_primary boolean NOT NULL DEFAULT false;

-- Backfill: set existing Google credentials as primary
UPDATE calendar_credentials SET is_primary = true
  WHERE provider = 'google';

-- Rename appointments.google_event_id to external_event_id
ALTER TABLE appointments
  RENAME COLUMN google_event_id TO external_event_id;

-- Add external_event_provider column
ALTER TABLE appointments
  ADD COLUMN external_event_provider text
    CHECK (external_event_provider IN ('google', 'outlook'));

-- Backfill existing Google event IDs
UPDATE appointments
  SET external_event_provider = 'google'
  WHERE external_event_id IS NOT NULL;
```

## Environment Variables Required

| Variable | Purpose | Example |
|----------|---------|---------|
| MICROSOFT_CLIENT_ID | Azure AD app registration client ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| MICROSOFT_CLIENT_SECRET | Azure AD app registration client secret | `~xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| OUTLOOK_WEBHOOK_SECRET | clientState for Graph subscription validation | Random 128-char string |

**Azure AD App Registration Requirements:**
- Redirect URI: `{NEXT_PUBLIC_APP_URL}/api/outlook-calendar/callback`
- API Permissions: `Calendars.ReadWrite` (delegated)
- Supported account types: "Accounts in any organizational directory and personal Microsoft accounts" (for /common authority)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Microsoft Graph beta delta for calendar | v1.0 `/me/calendarView/delta` | GA since 2020 | Use v1.0 stable endpoints only |
| ADAL (Azure AD Authentication Library) | MSAL (Microsoft Authentication Library) | ADAL deprecated June 2023 | Must use MSAL; ADAL no longer receives security patches |
| Graph subscription max 3 days (calendar) | 10,080 min (~7 days) for calendar events | Current v1.0 docs | Correct the 3-day assumption in phase description |

## Open Questions

1. **Microsoft 365 Admin Consent Error Shape**
   - What we know: Enterprise Azure AD tenants may require admin consent for third-party apps. Error code is likely AADSTS65001 or AADSTS90094.
   - What's unclear: Exact error payload shape in the OAuth redirect (is it a query param `error=consent_required` or `error=interaction_required`?)
   - Recommendation: Handle both `consent_required` and `admin_consent_required` error codes in the callback route. Show a user-friendly message. This can be validated during testing with a Microsoft 365 Business account.

2. **onboarding_complete Backfill Safety**
   - What we know: STATE.md flags this as a blocker. Need to verify count of tenants with partial onboarding before running backfill migration.
   - What's unclear: Whether this is truly needed for Phase 8 or is a general concern.
   - Recommendation: This appears to be a pre-existing concern from earlier phases, not specific to calendar sync. If the migration only touches `calendar_credentials` and `appointments`, no backfill is needed. Defer unless the planner identifies a direct dependency.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 (ESM mode via --experimental-vm-modules) |
| Config file | `jest.config.js` |
| Quick run command | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests tests/scheduling/` |
| Full suite command | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OUTLOOK-01 | OAuth flow initiates and callback stores credentials | unit | `npm test -- tests/scheduling/outlook-calendar.test.js -t "OAuth"` | Wave 0 |
| OUTLOOK-02 | Delta sync upserts/deletes events in local mirror; push creates Graph event | unit | `npm test -- tests/scheduling/outlook-calendar.test.js -t "sync"` | Wave 0 |
| OUTLOOK-03 | Cron renews expiring Outlook subscriptions | unit | `npm test -- tests/scheduling/outlook-subscription-renewal.test.js` | Wave 0 |
| OUTLOOK-04 | Disconnect deletes subscription, credentials, and mirrored events | unit | `npm test -- tests/scheduling/outlook-calendar.test.js -t "disconnect"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- tests/scheduling/`
- **Per wave merge:** `npm run test:all`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/scheduling/outlook-calendar.test.js` -- covers OUTLOOK-01, OUTLOOK-02, OUTLOOK-04
- [ ] `tests/scheduling/outlook-calendar-push.test.js` -- covers webhook notification handling
- [ ] `tests/scheduling/outlook-subscription-renewal.test.js` -- covers OUTLOOK-03
- [ ] `tests/scheduling/google-calendar-provider-filter.test.js` -- validates D-08 fix (provider filter on .single() calls)

## Sources

### Primary (HIGH confidence)
- [Microsoft Graph subscription resource type](https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0) -- subscription lifetime table confirms 10,080 min max for calendar events
- [Microsoft Graph event delta API](https://learn.microsoft.com/en-us/graph/api/event-delta?view=graph-rest-1.0) -- delta query pattern, permissions, response format
- [Microsoft Graph webhook delivery](https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks) -- validation handshake, notification payload, retry logic
- [Microsoft Graph create event](https://learn.microsoft.com/en-us/graph/api/calendar-post-events?view=graph-rest-1.0) -- POST /me/events request/response shape
- [@azure/msal-node npm](https://www.npmjs.com/package/@azure/msal-node) -- v5.1.1 confirmed current
- [MSAL ConfidentialClientApplication docs](https://learn.microsoft.com/en-us/javascript/api/@azure/msal-node/confidentialclientapplication) -- acquireTokenByCode, getAuthCodeUrl

### Secondary (MEDIUM confidence)
- [Microsoft identity platform OAuth 2.0 auth code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow) -- flow details verified with official docs
- [REST vs SDK tradeoffs](https://blog.mastykarz.nl/rest-or-sdk/) -- community analysis confirming direct REST is viable for limited endpoint usage

### Tertiary (LOW confidence)
- Admin consent error shape (AADSTS65001) -- needs live Azure AD verification per STATE.md blocker

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- MSAL is the only official Microsoft auth library; direct fetch is established pattern in this project
- Architecture: HIGH -- direct mirror of existing Google Calendar module; schema already supports dual providers
- Pitfalls: HIGH -- all pitfalls sourced from official Microsoft documentation and verified against existing codebase patterns
- Admin consent error handling: LOW -- exact error payload needs live verification

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (Graph API v1.0 is stable; MSAL release cadence is monthly)

## Project Constraints (from CLAUDE.md)

- When making architecture changes, read the relevant skill file first, make changes, then update the skill file to reflect the new code state
- Skill files are living documents that must always reflect current state of the code

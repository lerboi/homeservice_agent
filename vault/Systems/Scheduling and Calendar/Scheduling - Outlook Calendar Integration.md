---
type: system
system: Scheduling and Calendar
status: current
description: "Outlook Calendar Integration. Covers: Key Patterns; Exported Functions; OAuth Routes"
source: .claude/skills/scheduling-calendar-system/SKILL.md § 4. Outlook Calendar Integration
migrated: 2026-11-23
verified:
tags: [voco/system/scheduling-and-calendar]
---

# Outlook Calendar Integration

Part of [[Scheduling and Calendar]]. Migrated verbatim from the `scheduling-calendar-system` skill; check `verified` before trusting details.

**File**: `src/lib/scheduling/outlook-calendar.js`

### Key Patterns

**MSAL lazy singleton** (`getMsalClient()`): `ConfidentialClientApplication` instantiated once and cached in module-level `_msalClient`. Matches the `getClient()` pattern used in `layer2-llm.js`. Authority: `https://login.microsoftonline.com/common`. **MSAL is now used only for `getAuthCodeUrl`** — both the code exchange and token refresh hit the token endpoint directly (see below).

**Code exchange via direct fetch** (`exchangeCodeForTokens(code)`): POSTs `grant_type=authorization_code` directly to `https://login.microsoftonline.com/common/oauth2/v2.0/token` (scope `https://graph.microsoft.com/Calendars.ReadWrite offline_access`) and returns the raw snake_case payload `{ access_token, refresh_token, expires_in }`. **Why**: MSAL's `acquireTokenByCode` never exposes the refresh token on its `AuthenticationResult` — the old code read `tokenResponse.refreshToken` which was always `undefined`, so Outlook credentials were stored without a refresh token and the connection silently died when the access token expired (~1h).

**`graphFetch(urlOrPath, accessToken, options)`**: Central fetch wrapper for Graph API.
- Handles full URLs (e.g., deltaLink starting with `https://`) and relative paths (e.g., `'/me/events'`)
- Sets `Authorization: Bearer {accessToken}` and `Content-Type: application/json` on every request
- Returns `null` for 204 responses
- Throws formatted error on non-OK responses; the error carries **structured `err.status` (HTTP status) and `err.graphErrorCode`** (2026-06-12) so callers can branch on 410 (expired delta token → full resync) and 404 (dead subscription → recreate) without parsing the message string

**Token refresh via direct fetch** (`refreshOutlookAccessToken(refreshToken)`): Posts directly to `https://login.microsoftonline.com/common/oauth2/v2.0/token` — does NOT use MSAL in-memory cache. This is intentional for serverless environments where memory is not persistent between requests (Pitfall 3 from RESEARCH.md).

**`getValidAccessToken(creds)`**: Checks `creds.expiry_date > Date.now() + 300000` (5-min buffer). If expired, calls `refreshOutlookAccessToken`, persists refreshed tokens to DB, returns fresh `access_token`.

### Exported Functions

#### `pushBookingToCalendar` (via `createOutlookCalendarEvent`)

Called by the same `pushBookingToCalendar` in `google-calendar.js` — but the routing is done at call-site: `pushBookingToCalendar` in google-calendar queries `is_primary=true`, gets the provider, and calls the appropriate event creator. Outlook event creation uses `graphFetch('/me/events', accessToken, { method: 'POST', body: JSON.stringify(eventBody) })`. Stores appointment ID in `singleValueExtendedProperties`.

#### `syncOutlookCalendarEvents(tenantId)` (delta sync)

1. Load `calendar_credentials` for `provider: 'outlook'`
2. If `creds.last_sync_token` exists: use it directly as the URL (it is the full deltaLink URL)
3. If no `last_sync_token`: full sync via `buildFullSyncUrl()` — `/me/calendarView/delta?startDateTime={now−30d}&endDateTime={now+180d}`, built **lazily** so a 410 recovery re-anchors the window to "now" (same window shape as Google's 410 fallback)
4. **410 Gone recovery (2026-06-12)**: if the delta fetch throws `err.status === 410` (Graph delta tokens expire/invalidate), clear `last_sync_token`, **wipe the tenant's outlook rows from `calendar_events`** (the delta baseline is lost — deletions that happened while the token was dead would otherwise leave phantom busy rows), and restart the loop as a full sync with a freshly-anchored window. Before this recovery existed, one expired deltaLink froze the Outlook mirror FOREVER — every subsequent webhook/manual sync re-threw on the same dead token
5. Page through results following `@odata.nextLink`
6. Capture `@odata.deltaLink` at end of page chain
7. Upsert events where `!evt['@removed']` to `calendar_events`
8. Delete events where `evt['@removed']` is present
9. Persist `deltaLink` as `last_sync_token` (stores full URL — see Key Design Decisions)

#### `renewOutlookSubscription(cred)`

PATCH to `/subscriptions/{cred.watch_channel_id}` with new `expirationDateTime` (7 days from now). Updates `watch_expiration` in DB.

**404 recovery (2026-06-12)**: Graph deletes subscriptions the moment they expire, so PATCHing a dead one 404s. On `err.status === 404` the function now creates a brand-new subscription via `createOutlookSubscription(cred.tenant_id, accessToken)` (which persists the new id + expiration itself) instead of throwing — the renewal cron used to retry the same dead PATCH daily forever, permanently killing push for that tenant. This mirrors Google's renewal, which is resilient because it re-registers a fresh channel.

#### `revokeAndDisconnectOutlook(tenantId)`

1. DELETE to `/subscriptions/{watch_channel_id}` via graphFetch (non-fatal on 404)
2. Delete `calendar_credentials` row for `provider: 'outlook'`
3. Delete all `calendar_events` for `provider: 'outlook'`

### OAuth Routes

**`GET /api/outlook-calendar/auth`** — Requires authenticated user. Calls `getOutlookAuthUrl(tenant.id)` which uses MSAL `getAuthCodeUrl` with `state: tenantId`. Returns `{ url }`.

**`GET /api/outlook-calendar/callback`** — Accepts `?code=&state=tenantId`. Admin consent error detection: checks for `consent_required`, `interaction_required`, AADSTS65001, AADSTS90094 — redirects to `?calendar=admin_consent`. On success: exchanges code via `exchangeCodeForTokens(code)` (direct token-endpoint POST returning snake_case `access_token`/`refresh_token`/`expires_in`), fetches display name via direct fetch to `https://graph.microsoft.com/v1.0/me` (NOT via `graphFetch` — simpler), determines `is_primary` (first connected calendar = true), upserts credentials with `refresh_token: tokenData.refresh_token` and `expiry_date: Date.now() + tokenData.expires_in * 1000` (the refresh token is now actually captured — see Key Patterns), calls `createOutlookSubscription`, calls `syncOutlookCalendarEvents`, redirects to `?calendar=outlook_connected`.

**`is_primary` determination**: Counts existing `calendar_credentials` rows for the tenant before upsert. If `count === 0`, new calendar gets `is_primary: true`.

**Atomic primary swap — `set_primary_calendar(p_tenant_id uuid, p_provider text)` RPC** (migration 038, SECURITY DEFINER, service_role only):

```sql
UPDATE calendar_credentials
SET is_primary = (provider = p_provider)
WHERE tenant_id = p_tenant_id;
```

Single-statement swap that flips `is_primary` across all of a tenant's `calendar_credentials` rows in one transaction. Use whenever the user (re)elects which connected calendar is primary — eliminates the race window where two providers could both be marked primary if you wrote two separate `UPDATE`s. Invoke from server routes via the service-role Supabase client: `await supabase.rpc('set_primary_calendar', { p_tenant_id, p_provider })`. Browser/SSR clients cannot call this (REVOKE EXECUTE FROM PUBLIC).

---

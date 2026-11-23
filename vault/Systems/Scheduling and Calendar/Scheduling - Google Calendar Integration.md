---
type: system
system: Scheduling and Calendar
status: current
description: "Google Calendar Integration. Covers: Exported Functions; OAuth Routes"
source: .claude/skills/scheduling-calendar-system/SKILL.md § 3. Google Calendar Integration
migrated: 2026-11-23
verified:
tags: [voco/system/scheduling-and-calendar]
---

# Google Calendar Integration

Part of [[Scheduling and Calendar]]. Migrated verbatim from the `scheduling-calendar-system` skill; check `verified` before trusting details.

> **Read first (2026-11-23):** voice-agent bookings no longer go through the JavaScript functions described here. The current agent path is in [[Scheduling - Booking to calendar on agent calls (verified path)]]. This note remains accurate for the Next app side (dashboard, API routes, OAuth, sync).

**File**: `src/lib/scheduling/google-calendar.js`

### Exported Functions

#### `pushBookingToCalendar(tenantId, appointmentId)`

1. Load appointment from DB
2. Query `calendar_credentials` where `tenant_id = tenantId AND is_primary = true`
3. If no primary calendar: silently return (no error thrown)
4. Create event via `createCalendarEvent({ credentials, appointment })`:
   - `urgency === 'emergency'` → prepends `[URGENT]` to event summary
   - Summary format: `"${urgencyPrefix}${job_type || 'Service'} — ${caller_name || 'Customer'}"`
   - Stores `platform_appointment_id` and `tenant_id` in `extendedProperties.private`
5. Write `external_event_id` and `external_event_provider: 'google'` back to the appointment row

#### `syncCalendarEvents(tenantId)`

1. Load `calendar_credentials` for tenant + provider `google`
2. Attempt incremental sync using stored `last_sync_token`
3. On 410 Gone (invalid sync token): perform full re-sync (`timeMin: now − 30d`, `timeMax: now + 180d`, `singleEvents: true`, `maxResults: 2500`)
4. **Pagination (both branches)**: a shared `listAllPages` helper follows `nextPageToken` to the end of the result set (cap: `MAX_SYNC_PAGES = 20`, ~20 × 250 events). Google only returns `nextSyncToken` on the LAST page — the pre-fix code read only the first page, so the sync token never advanced on multi-page results and initial syncs silently truncated.
5. Upsert non-cancelled events to `calendar_events` (conflict: `tenant_id,provider,external_id`)
6. Delete events with `status === 'cancelled'` from local mirror
7. Persist new `nextSyncToken` as `last_sync_token` — captured from the last page, **including on initial/full sync**. If the 20-page cap is hit with pages remaining, a warning logs and the sync token does not advance that run.

#### `registerWatch(tenantId, credentials)`

- Creates a push notification watch channel on the primary calendar
- Channel TTL: 7 days (`ttl: '604800'`)
- Notification URL: `${NEXT_PUBLIC_APP_URL}/api/webhooks/google-calendar`
- Token field: `tenantId` (used to identify tenant in webhook handler)
- Persists `watch_channel_id`, `watch_resource_id`, `watch_expiration` to `calendar_credentials`

#### `revokeAndDisconnect(tenantId)`

1. Revoke token via `oauth2Client.revokeToken(creds.refresh_token)`
2. Stop watch channel via `calendar.channels.stop({ id, resourceId })` (if active)
3. Delete `calendar_credentials` row for `provider: 'google'`
4. Delete all `calendar_events` rows for `provider: 'google'`

### OAuth Routes

**`GET /api/google-calendar/auth`** — Requires authenticated user. Retrieves `tenant.id`, generates OAuth consent URL with `state: signOAuthState(tenant.id)` (HMAC-signed `tenantId:hmac` string for CSRF protection), returns `{ url }`.

**`GET /api/google-calendar/callback`** — Accepts `?code=&state=tenantId:hmac`. Verifies HMAC signature via `verifyOAuthState()`, exchanges code for tokens, fetches calendar display name (`calendarList.get({ calendarId: 'primary' })`), upserts credentials to DB (conflict: `tenant_id,provider`), calls `registerWatch`, calls `syncCalendarEvents`, redirects to `/dashboard/services?calendar=connected`.

---

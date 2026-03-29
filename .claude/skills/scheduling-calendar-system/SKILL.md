---
name: scheduling-calendar-system
description: "Complete architectural reference for the scheduling and calendar system — slot calculation, atomic booking, Google Calendar OAuth/sync/webhooks, Outlook Calendar OAuth/sync/webhooks, travel buffers, geographic zones, cron jobs, and appointment management. Use this skill whenever making changes to booking logic, calendar sync, OAuth flows, working hours, appointment APIs, travel buffer calculation, or cron job scheduling. Also use when the user asks about how availability works, wants to modify booking behavior, or needs to debug calendar sync issues."
---

# Scheduling & Calendar System — Complete Reference

This document is the single source of truth for the entire scheduling and calendar system. Read this before making any changes to slot calculation, booking, calendar sync, OAuth flows, working hours, zones, or appointment management.

**Last updated**: 2026-03-25 (Phase 8 — Outlook Calendar Sync; dual-provider support)

---

## Architecture Overview

The scheduling system spans slot generation, atomic booking, and bidirectional calendar sync for both Google and Outlook.

| Component | File(s) | Purpose |
|-----------|---------|---------|
| **Slot Calculator** | `slot-calculator.js` | Pure function — computes available slots from working hours, bookings, calendar blocks, and travel buffers |
| **Atomic Booking Engine** | `booking.js` + Postgres RPC | Non-blocking advisory lock + tsrange overlap check for race-free slot reservation |
| **Google Calendar** | `google-calendar.js` | OAuth, event push, incremental sync, watch registration, disconnect |
| **Outlook Calendar** | `outlook-calendar.js` | MSAL OAuth, event push, delta sync, subscription management, disconnect |
| **Google Webhook Handler** | `webhooks/google-calendar-push.js` | Receives push notifications from Google, triggers incremental sync |
| **Outlook Webhook Handler** | `webhooks/outlook-calendar-push.js` | Receives Microsoft Graph notifications, validates clientState, triggers delta sync |
| **Cron: renew-calendar-channels** | `cron/renew-calendar-channels/route.js` | Dual-provider renewal of Google watch channels + Outlook subscriptions before TTL expiry |
| **Appointments API** | `api/appointments/route.js`, `api/appointments/[id]/route.js` | Calendar view fetch, travel buffer + conflict detection, cancel, dismiss conflict |
| **Working Hours API** | `api/working-hours/route.js` | GET/PUT tenant working hours, slot duration, timezone |
| **Zones API** | `api/zones/route.js` | GET/POST zones, PUT travel buffers between zones |
| **Google OAuth Routes** | `api/google-calendar/auth/route.js`, `api/google-calendar/callback/route.js` | Initiate Google OAuth, handle callback, store credentials, register watch, initial sync |
| **Outlook OAuth Routes** | `api/outlook-calendar/auth/route.js`, `api/outlook-calendar/callback/route.js` | Initiate Microsoft OAuth, handle callback, store credentials, create Graph subscription, initial sync |

```
Tenant configures working hours (PUT /api/working-hours)
       ↓
Google/Outlook calendars sync via push webhooks + incremental pull
       ↓
LiveKit agent joins room → fetches appointments + calendar_events + zones + buffers in parallel
       ↓
calculateAvailableSlots() → pure computation → returns ISO slot pairs
       ↓
AI offers slots to caller → caller picks one
       ↓
book_appointment tool (in-process) → atomicBookSlot() → book_appointment_atomic RPC
       ↓  (Postgres advisory lock + tsrange overlap check)
       ↓
On success → pushBookingToCalendar(tenantId, appointmentId) (async, non-blocking)
       ↓                 (queries is_primary=true credential, creates calendar event)
       ↓
pushBookingToCalendar writes external_event_id + external_event_provider on appointment
       ↓
Google/Outlook push webhooks → handleGoogleCalendarPush / handleOutlookCalendarPush
       ↓                          trigger syncCalendarEvents / syncOutlookCalendarEvents
       ↓
calendar_events local mirror kept in sync (slot calculator reads from this, never live-queries)
```

---

## File Map

| File | Role |
|------|------|
| `src/lib/scheduling/slot-calculator.js` | Pure slot calculation — no DB, fully testable |
| `src/lib/scheduling/booking.js` | Calls `book_appointment_atomic` Supabase RPC |
| `src/lib/scheduling/google-calendar.js` | Google Calendar: OAuth, push, sync, watch, revoke |
| `src/lib/scheduling/outlook-calendar.js` | Outlook Calendar: MSAL, Graph, delta sync, subscription, revoke |
| `src/lib/webhooks/google-calendar-push.js` | Google push notification handler (triggers sync) |
| `src/lib/webhooks/outlook-calendar-push.js` | Outlook Graph notification handler (validates + triggers sync) |
| `src/app/api/google-calendar/auth/route.js` | GET — returns Google OAuth consent URL |
| `src/app/api/google-calendar/callback/route.js` | GET — handles Google OAuth callback, stores creds, registers watch, initial sync |
| `src/app/api/outlook-calendar/auth/route.js` | GET — returns Microsoft OAuth consent URL |
| `src/app/api/outlook-calendar/callback/route.js` | GET — handles Microsoft OAuth callback, stores creds, creates Graph subscription, initial sync |
| `src/app/api/appointments/route.js` | GET — returns appointments + external events + travel buffers + conflicts for a date range |
| `src/app/api/appointments/[id]/route.js` | GET — single appointment with call data; PATCH — cancel or dismiss conflict |
| `src/app/api/cron/renew-calendar-channels/route.js` | POST — dual-provider channel/subscription renewal (run daily) |
| `src/app/api/working-hours/route.js` | GET/PUT — tenant working_hours JSONB, slot_duration_mins, tenant_timezone |
| `src/app/api/zones/route.js` | GET/POST/PUT — service zones and zone pair travel buffers |
| `supabase/migrations/003_scheduling.sql` | Appointments, zones, credentials, events tables + `book_appointment_atomic` function |
| `supabase/migrations/007_outlook_calendar.sql` | Adds is_primary to calendar_credentials; renames google_event_id → external_event_id on appointments |

---

## 1. Slot Calculator

**File**: `src/lib/scheduling/slot-calculator.js`

Pure function — no database access. Fully testable in isolation. All DB fetching happens in the calling layer (webhook handler, `processCallAnalyzed`, etc.) before `calculateAvailableSlots` is called.

### Signature

```js
export function calculateAvailableSlots({
  workingHours,        // object  — day-keyed config e.g. { monday: { enabled, open, close, lunchStart, lunchEnd } }
  slotDurationMins,    // number  — slot length in minutes (e.g. 60)
  existingBookings,    // Array   — [{ start_time, end_time, zone_id? }] ISO strings
  externalBlocks,      // Array   — [{ start_time, end_time }] ISO strings (from calendar_events)
  zones,               // Array   — [{ id, name }] configured service zones
  zonePairBuffers,     // Array   — [{ zone_a_id, zone_b_id, buffer_mins }]
  targetDate,          // string  — "YYYY-MM-DD"
  tenantTimezone,      // string  — IANA timezone e.g. "America/Chicago"
  maxSlots,            // number  — max slots to return (default 10)
  candidateZoneId,     // string|null — zone ID for the candidate booking (for travel buffer calc)
})
// Returns: Array<{ start: string, end: string }> — ISO strings
```

### Algorithm

1. Derive day-of-week in tenant timezone from `targetDate`
2. Look up `workingHours[dayKey]` — if day is disabled or missing, return `[]`
3. Convert `open`/`close` times (HH:MM) to UTC Date objects via `fromZonedTime`
4. Convert `lunchStart`/`lunchEnd` similarly (if configured)
5. Walk forward from `windowStart` in `slotDurationMins` steps until `windowEnd` or `maxSlots` reached
6. For each candidate slot, skip if:
   - Slot end exceeds `windowEnd`
   - Overlaps with lunch break
   - Overlaps any `existingBookings` interval
   - Overlaps any `externalBlocks` interval (Google/Outlook calendar events)
   - Violates travel buffer from the most recent prior booking (see travel buffer rules)
7. Accepted slots are returned as `{ start, end }` ISO strings

### Travel Buffer Rules

Implemented in `getTravelBufferMins(lastBookingZoneId, candidateZoneId, zones, zonePairBuffers)`:

| Condition | Buffer |
|-----------|--------|
| No zones configured (`zones` is empty) | 30 min (flat) |
| One or both sides missing a zone ID | 30 min (cross-zone default) |
| Same zone (`lastBookingZoneId === candidateZoneId`) | 0 min |
| Different zones — matching pair in `zonePairBuffers` | `pair.buffer_mins` |
| Different zones — no pair entry found | 30 min (default) |

The "last booking before this slot" is computed by filtering `parsedBookings` to those ending at or before `slotStart`, then picking the one with the latest end time.

---

## 2. Atomic Booking

**File**: `src/lib/scheduling/booking.js`

### `atomicBookSlot` Signature

```js
export async function atomicBookSlot({
  tenantId,     // string — UUID of the tenant
  callId,       // string|null — UUID of the originating call
  startTime,    // Date — slot start (UTC Date object)
  endTime,      // Date — slot end (UTC Date object)
  address,      // string — service address (verbally confirmed by caller)
  callerName,   // string — caller's full name
  callerPhone,  // string — caller's phone number
  urgency,      // string — 'emergency' | 'routine' | 'high_ticket'
  zoneId,       // string|null — service zone UUID
})
// Returns: Promise<{ success: boolean, appointment_id?: string, reason?: string }>
// Throws on Supabase transport/query error
```

`atomicBookSlot` is a thin JS wrapper — all conflict logic lives inside the `book_appointment_atomic` Postgres function.

### `book_appointment_atomic` RPC Flow (`supabase/migrations/003_scheduling.sql`)

```sql
-- Parameters: p_tenant_id, p_call_id, p_start_time, p_end_time,
--             p_service_address, p_caller_name, p_caller_phone, p_urgency, p_zone_id

-- Step 1: Derive advisory lock key
v_lock_key := abs(hashtext(p_tenant_id::text || extract(epoch FROM p_start_time)::text));

-- Step 2: Non-blocking try-lock
v_lock_ok := pg_try_advisory_xact_lock(v_lock_key);
IF NOT v_lock_ok THEN
  RETURN { success: false, reason: 'slot_taken' };
END IF;

-- Step 3: tsrange overlap check on non-cancelled appointments
SELECT COUNT(*) INTO v_overlap_cnt
FROM appointments
WHERE tenant_id = p_tenant_id
  AND status <> 'cancelled'
  AND tsrange(start_time, end_time, '[)') && tsrange(p_start_time, p_end_time, '[)');

IF v_overlap_cnt > 0 THEN
  RETURN { success: false, reason: 'slot_taken' };
END IF;

-- Step 4: Insert and return new appointment ID
INSERT INTO appointments (...) VALUES (...) RETURNING id INTO v_new_id;
RETURN { success: true, appointment_id: v_new_id };
```

### Return Shapes

```js
// Success
{ success: true, appointment_id: "uuid-string" }

// Conflict (lock contention OR overlap)
{ success: false, reason: "slot_taken" }
```

### Secondary Defense

`UNIQUE (tenant_id, start_time)` constraint on the `appointments` table acts as a final guard — even if two concurrent transactions somehow pass both the advisory lock and the tsrange check, the DB insert will fail for the second one, keeping data clean.

---

## 3. Google Calendar Integration

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
3. On 410 Gone (invalid sync token): perform full re-sync with `timeMin: now`, `singleEvents: true`
4. Upsert non-cancelled events to `calendar_events` (conflict: `tenant_id,provider,external_id`)
5. Delete events with `status === 'cancelled'` from local mirror
6. Persist new `nextSyncToken` as `last_sync_token` (Note: Google uses a bare token string, not a URL)

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

## 4. Outlook Calendar Integration

**File**: `src/lib/scheduling/outlook-calendar.js`

### Key Patterns

**MSAL lazy singleton** (`getMsalClient()`): `ConfidentialClientApplication` instantiated once and cached in module-level `_msalClient`. Matches the `getClient()` pattern used in `layer2-llm.js`. Authority: `https://login.microsoftonline.com/common`.

**`graphFetch(urlOrPath, accessToken, options)`**: Central fetch wrapper for Graph API.
- Handles full URLs (e.g., deltaLink starting with `https://`) and relative paths (e.g., `'/me/events'`)
- Sets `Authorization: Bearer {accessToken}` and `Content-Type: application/json` on every request
- Returns `null` for 204 responses
- Throws formatted error on non-OK responses

**Token refresh via direct fetch** (`refreshOutlookAccessToken(refreshToken)`): Posts directly to `https://login.microsoftonline.com/common/oauth2/v2.0/token` — does NOT use MSAL in-memory cache. This is intentional for serverless environments where memory is not persistent between requests (Pitfall 3 from RESEARCH.md).

**`getValidAccessToken(creds)`**: Checks `creds.expiry_date > Date.now() + 300000` (5-min buffer). If expired, calls `refreshOutlookAccessToken`, persists refreshed tokens to DB, returns fresh `access_token`.

### Exported Functions

#### `pushBookingToCalendar` (via `createOutlookCalendarEvent`)

Called by the same `pushBookingToCalendar` in `google-calendar.js` — but the routing is done at call-site: `pushBookingToCalendar` in google-calendar queries `is_primary=true`, gets the provider, and calls the appropriate event creator. Outlook event creation uses `graphFetch('/me/events', accessToken, { method: 'POST', body: JSON.stringify(eventBody) })`. Stores appointment ID in `singleValueExtendedProperties`.

#### `syncOutlookCalendarEvents(tenantId)` (delta sync)

1. Load `calendar_credentials` for `provider: 'outlook'`
2. If `creds.last_sync_token` exists: use it directly as the URL (it is the full deltaLink URL)
3. If no `last_sync_token`: initial full sync using `/me/calendarView/delta?startDateTime=now&endDateTime=now+180days`
4. Page through results following `@odata.nextLink`
5. Capture `@odata.deltaLink` at end of page chain
6. Upsert events where `!evt['@removed']` to `calendar_events`
7. Delete events where `evt['@removed']` is present
8. Persist `deltaLink` as `last_sync_token` (stores full URL — see Key Design Decisions)

#### `renewOutlookSubscription(cred)`

PATCH to `/subscriptions/{cred.watch_channel_id}` with new `expirationDateTime` (7 days from now). Updates `watch_expiration` in DB.

#### `revokeAndDisconnectOutlook(tenantId)`

1. DELETE to `/subscriptions/{watch_channel_id}` via graphFetch (non-fatal on 404)
2. Delete `calendar_credentials` row for `provider: 'outlook'`
3. Delete all `calendar_events` for `provider: 'outlook'`

### OAuth Routes

**`GET /api/outlook-calendar/auth`** — Requires authenticated user. Calls `getOutlookAuthUrl(tenant.id)` which uses MSAL `getAuthCodeUrl` with `state: tenantId`. Returns `{ url }`.

**`GET /api/outlook-calendar/callback`** — Accepts `?code=&state=tenantId`. Admin consent error detection: checks for `consent_required`, `interaction_required`, AADSTS65001, AADSTS90094 — redirects to `?calendar=admin_consent`. On success: exchanges code via `exchangeCodeForTokens(code)`, fetches display name via direct fetch to `https://graph.microsoft.com/v1.0/me` (NOT via `graphFetch` — simpler), determines `is_primary` (first connected calendar = true), upserts credentials, calls `createOutlookSubscription`, calls `syncOutlookCalendarEvents`, redirects to `?calendar=outlook_connected`.

**`is_primary` determination**: Counts existing `calendar_credentials` rows for the tenant before upsert. If `count === 0`, new calendar gets `is_primary: true`.

---

## 5. Webhook Handlers

### Google Push Handler

**File**: `src/lib/webhooks/google-calendar-push.js`

```js
export async function handleGoogleCalendarPush(request)
```

Google sends POST to `/api/webhooks/google-calendar` after any calendar state change.

- `X-Goog-Resource-State: sync` — handshake confirmation, return immediately
- `X-Goog-Resource-State: exists` — calendar changed, extract `X-Goog-Channel-Token` (= tenantId), call `syncCalendarEvents(tenantId)`

The route handler wraps this in `after()` so Google receives a fast 200 response while sync runs post-response.

### Outlook Change Handler

**File**: `src/lib/webhooks/outlook-calendar-push.js`

```js
export async function handleOutlookCalendarPush(body)
```

Microsoft Graph sends POST to `/api/webhooks/outlook-calendar` with `body.value[]` array.

For each notification:
1. Validate `notification.clientState === process.env.OUTLOOK_WEBHOOK_SECRET` — skip if invalid
2. Look up tenant via `calendar_credentials.watch_channel_id === notification.subscriptionId AND provider = 'outlook'`
3. Call `syncOutlookCalendarEvents(cred.tenant_id)`

**Validation token flow** (Graph subscription creation requirement): When Graph first creates a subscription, it sends a GET request with `?validationToken=` to the webhook URL. This must be handled by the route returning the token as `text/plain`. The route handler in `src/app/api/webhooks/outlook-calendar/route.js` handles this before delegating to `handleOutlookCalendarPush`.

---

## 6. Cron Jobs

### `renew-calendar-channels`

**File**: `src/app/api/cron/renew-calendar-channels/route.js`

**Endpoint**: `GET /api/cron/renew-calendar-channels` (Vercel Cron uses GET)

**Auth**: `Authorization: Bearer {CRON_SECRET}` header required (returns 401 otherwise)

**Logic**:
1. Query `calendar_credentials` where `watch_channel_id IS NOT NULL AND watch_expiration < now() + 24h`
2. For each expiring credential:
   - `provider = 'google'` → call `registerWatch(tenant_id, { access_token, refresh_token, expiry_date })` — creates a new 7-day watch channel
   - `provider = 'outlook'` → call `renewOutlookSubscription(cred)` — PATCHes existing subscription for +7 days
3. Returns `{ ok: true, renewed: N, failed: M, results: [...] }`

**Why run daily**: Both Google watch channels and Outlook subscriptions have 7-day TTLs. Running daily with a 24h lookahead ensures channels are renewed before they expire even if a cron execution is missed.

---

## 7. API Routes

### `GET /api/appointments`

**Query params**: `start` (ISO), `end` (ISO) — both required.

**Response shape**:
```js
{
  appointments: [...],    // non-cancelled appointments in range, with service_zones join
  externalEvents: [...],  // calendar_events in range (Google + Outlook)
  travelBuffers: [...],   // computed travel gap blocks between consecutive appointments in different zones
  conflicts: [...]        // calendar_events that overlap confirmed appointments where conflict_dismissed=false
}
```

Travel buffers are computed in-memory via `computeTravelBuffers()` (groups appointments by day, checks adjacent pairs for zone differences, creates buffer blocks). Conflicts are detected by `detectConflicts()` (iterates all confirmed appointments × all calendar events, applies interval overlap test).

### `GET /api/appointments/[id]`

Returns single appointment with associated call data (`recording_url`, `transcript`).

### `PATCH /api/appointments/[id]`

Two modes:
- `{ status: 'cancelled' }` — sets appointment status to cancelled; includes `google_event_id` (renamed `external_event_id`) in response for client-side handling
- `{ conflict_dismissed: true, calendar_event_id: '...' }` — sets `conflict_dismissed: true` on the specified `calendar_events` row

### `GET /api/working-hours`

Returns `{ working_hours, slot_duration_mins, tenant_timezone }` from `tenants` table.

### `PUT /api/working-hours`

Updates any combination of `working_hours` (JSONB), `slot_duration_mins` (int), `tenant_timezone` (IANA string). Only fields present in request body are updated.

### `GET /api/zones`

Returns `{ zones: [...], travelBuffers: [...] }`. Travel buffers only fetched when `zones.length >= 2`.

### `POST /api/zones`

Creates a new service zone. Enforces 5-zone maximum per tenant (`count >= 5` → 400). Body: `{ name, postal_codes }`.

### `PUT /api/zones`

Upserts travel buffer pairs. Body: `{ buffers: [{ zone_a_id, zone_b_id, buffer_mins }] }`. Conflict: `zone_a_id,zone_b_id`.

---

## 8. Database Tables

### `appointments` (from 003_scheduling.sql + 007_outlook_calendar.sql)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid | FK → tenants(id) ON DELETE CASCADE |
| `call_id` | uuid | FK → calls(id) ON DELETE SET NULL (nullable) |
| `start_time` | timestamptz | |
| `end_time` | timestamptz | |
| `service_address` | text | |
| `caller_name` | text | |
| `caller_phone` | text | |
| `urgency` | text | CHECK IN ('emergency', 'routine', 'high_ticket') |
| `zone_id` | uuid | FK → service_zones(id) ON DELETE SET NULL |
| `status` | text | CHECK IN ('confirmed', 'cancelled', 'completed'), DEFAULT 'confirmed' |
| `booked_via` | text | CHECK IN ('ai_call', 'manual'), DEFAULT 'ai_call' |
| `external_event_id` | text | Calendar event ID (Google or Outlook). Renamed from `google_event_id` in 007 |
| `external_event_provider` | text | CHECK IN ('google', 'outlook'). Added in 007 |
| `notes` | text | |
| `created_at` | timestamptz | |

**Key constraint**: `UNIQUE (tenant_id, start_time)` — secondary anti-double-booking defense.

### `service_zones` (from 003_scheduling.sql)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid | FK → tenants(id) ON DELETE CASCADE |
| `name` | text | |
| `postal_codes` | text[] | DEFAULT '{}' |
| `created_at` | timestamptz | |

### `zone_travel_buffers` (from 003_scheduling.sql)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid | FK → tenants(id) ON DELETE CASCADE |
| `zone_a_id` | uuid | FK → service_zones(id) ON DELETE CASCADE |
| `zone_b_id` | uuid | FK → service_zones(id) ON DELETE CASCADE |
| `buffer_mins` | int | DEFAULT 30 |

**Constraint**: `UNIQUE (zone_a_id, zone_b_id)` — bidirectional lookup uses `[a,b].sort().join('_')` key.

### `calendar_credentials` (from 003_scheduling.sql + 007_outlook_calendar.sql)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid | FK → tenants(id) ON DELETE CASCADE |
| `provider` | text | CHECK IN ('google', 'outlook'), DEFAULT 'google' |
| `access_token` | text | |
| `refresh_token` | text | |
| `expiry_date` | bigint | Unix ms epoch |
| `calendar_id` | text | DEFAULT 'primary' |
| `calendar_name` | text | Display name fetched from provider during OAuth |
| `watch_channel_id` | text | Google: channel UUID. Outlook: subscription ID |
| `watch_resource_id` | text | Google only |
| `watch_expiration` | bigint | Unix ms epoch (7-day TTL) |
| `last_sync_token` | text | Google: bare nextSyncToken string. Outlook: full deltaLink URL |
| `last_synced_at` | timestamptz | |
| `is_primary` | boolean | Added in 007. DEFAULT false. First connected calendar → primary |
| `created_at` | timestamptz | |

**Constraint**: `UNIQUE (tenant_id, provider)` — one credential per provider per tenant.

### `calendar_events` (from 003_scheduling.sql)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid | FK → tenants(id) ON DELETE CASCADE |
| `provider` | text | 'google' or 'outlook' |
| `external_id` | text | Provider-assigned event ID |
| `title` | text | |
| `start_time` | timestamptz | |
| `end_time` | timestamptz | |
| `is_all_day` | boolean | DEFAULT false |
| `appointment_id` | uuid | FK → appointments(id) ON DELETE SET NULL |
| `conflict_dismissed` | boolean | DEFAULT false. Set true when owner dismisses a conflict |
| `synced_at` | timestamptz | |

**Constraint**: `UNIQUE (tenant_id, provider, external_id)` — prevents duplicate mirror rows.

**Tenant columns** (relevant to scheduling, stored on `tenants` table):
- `tenant_timezone` — IANA timezone string, DEFAULT 'America/Chicago'
- `slot_duration_mins` — int, DEFAULT 60
- `working_hours` — JSONB, day-keyed config with `{ enabled, open, close, lunchStart, lunchEnd }` per day

---

## 9. Environment Variables

| Variable | Service | Purpose |
|----------|---------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth | OAuth client ID for Google Calendar |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | OAuth client secret for Google Calendar |
| `MICROSOFT_CLIENT_ID` | Microsoft OAuth | Azure app registration client ID |
| `MICROSOFT_CLIENT_SECRET` | Microsoft OAuth | Azure app registration client secret |
| `MICROSOFT_TENANT_ID` | Microsoft OAuth | Azure tenant (used in auth flows; authority set to `common` for multi-tenant) |
| `OUTLOOK_WEBHOOK_SECRET` | Outlook Webhooks | `clientState` sent during subscription creation and verified on each notification |
| `NEXT_PUBLIC_APP_URL` | OAuth callbacks | Base URL for OAuth redirect URIs (e.g., `https://yourapp.vercel.app`) |
| `CRON_SECRET` | Cron auth | Bearer token for `/api/cron/*` endpoints |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | DB access for slot data, credentials, events |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Service role for webhook handlers (bypasses RLS) |

---

## 10. Key Design Decisions

- **Local DB mirror is source of truth** — `calendar_events` table mirrors Google/Outlook events locally. Slot calculator reads from `calendar_events`, never live-queries the calendar APIs. This keeps the LiveKit agent's slot calculation fast and eliminates dependency on external API availability during calls.

- **`pg_try_advisory_xact_lock` is non-blocking** — Using `pg_try_advisory_xact_lock` instead of `pg_advisory_lock` means if the slot is being concurrently booked, the second transaction immediately returns `slot_taken` instead of queuing. This prevents queue buildup under concurrent call load.

- **`UNIQUE (tenant_id, start_time)` as secondary defense** — Even if two concurrent transactions race through the advisory lock and overlap check simultaneously (extremely rare), the DB-level unique constraint catches the second insert and raises an error. Belt-and-suspenders concurrency safety.

- **Travel buffer logic is caller-zone-aware** — No zones = flat 30-min. Same zone = 0-min. Cross-zone = lookup or 30-min default. The candidate zone (`candidateZoneId`) is passed in from the caller so buffers can be computed without knowing what the next booking's zone will be until booking time.

- **`after()` for calendar push** — `pushBookingToCalendar` is always called inside `after()` from webhook handlers. Calendar event creation never blocks the synchronous `book_appointment` response to the AI. This keeps the booking confirmation fast and tolerates temporary calendar API unavailability.

- **Store full deltaLink URL as `last_sync_token` for Outlook** — Microsoft Graph returns `@odata.deltaLink` as a full URL containing the delta state. Storing the full URL (not just a token fragment) avoids having to reconstruct the endpoint. Google uses a bare `nextSyncToken` string — the two providers have different sync token patterns.

- **Direct fetch for Outlook token refresh (serverless-safe)** — MSAL's `acquireTokenSilent` relies on in-memory token cache. In serverless environments, each request may start a fresh process with no cache. `refreshOutlookAccessToken` bypasses MSAL cache entirely and posts directly to the token endpoint.

- **`is_primary` flag for multi-provider calendar push** — Only the primary calendar receives pushed booking events. `pushBookingToCalendar` queries `is_primary=true`, so pushing to one calendar is deterministic regardless of how many providers are connected. First connected calendar becomes primary; owner can re-assign via dashboard (optimistic UI swap).

- **`PROVIDER_CONFIG` map** — Auth endpoints, icon colors, popup names are centralized in a config map in the dashboard component (not scattered across files). Adding a third provider requires one config entry, not changes across multiple files.

- **Optimistic UI for make-primary badge swap** — The dashboard swaps primary badge instantly on click, then reverts on server error. No loading spinner — perceived instant response.

- **Admin consent detection in Outlook callback** — Microsoft 365 Business accounts with admin-controlled app permissions trigger `consent_required` or `AADSTS65001` error codes. The callback detects these and redirects to `?calendar=admin_consent` for a specific error message, distinct from generic OAuth failures.

- **Google OAuth state = HMAC-signed tenant_id** — The `state` parameter is a `tenantId:hmac` string signed via HMAC-SHA256 (keyed on `SUPABASE_SERVICE_ROLE_KEY`). The callback calls `verifyOAuthState()` to validate the signature before extracting the tenant_id. Outlook auth imports `signOAuthState` from the Google auth route rather than having its own implementation.

---

## Cross-Domain References

- For slot calculation during active calls, see **voice-call-architecture skill** (sections on agent entry, `check_availability` tool, `book_appointment` tool)
- For Supabase service role vs. user client patterns, RLS policies, and multi-tenant data isolation, see **auth-database-multitenancy skill**
- For dashboard calendar UI components (calendar page, appointment cards, conflict banner), see the dashboard/CRM skill

---

## Important: Keeping This Document Updated

When making changes to any file listed in the File Map above, update the relevant sections of this skill document to reflect the new behavior. This ensures future conversations always have an accurate reference.

Key areas to keep current:
- `calculateAvailableSlots` signature — if new parameters are added (e.g., appointment duration variations)
- `atomicBookSlot` signature — if new fields are passed through to the RPC
- `book_appointment_atomic` RPC — if the advisory lock formula or overlap logic changes
- `pushBookingToCalendar` — if routing logic between Google and Outlook changes
- DB table columns — if migrations add columns (especially to `appointments` or `calendar_credentials`)
- Environment variables — if new provider credentials are added

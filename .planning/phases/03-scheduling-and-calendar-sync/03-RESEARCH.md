# Phase 3: Scheduling and Calendar Sync - Research

**Researched:** 2026-03-20
**Domain:** Appointment booking, Google Calendar API v3, Postgres advisory locks, Retell custom functions
**Confidence:** HIGH (core patterns verified via official docs and live code inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Booking Conversation Flow — Emergency**
- AI offers 2-3 available slot options based on availability + travel buffers
- Caller picks from the offered options
- Before locking: conversational address extraction + mandatory read-back confirmation ("Just to confirm, you're at 123 Main St, correct?") — must get verbal yes before slot lock
- If no emergency slots available today: offer earliest available slot + escalate to owner with priority notification

**Booking Conversation Flow — Routine**
- Same flow as emergency but less urgent tone — AI offers booking during the call (not deferred to lead-only)
- AI offers 2-3 available slots, caller picks
- Address read-back confirmation required before locking
- If caller doesn't want to book during call, create a lead with suggested slots for owner follow-up

**Calendar Sync**
- Google Calendar only for Phase 3 — Outlook deferred to Phase 5 or a patch
- Sync architecture: Local DB mirror + Google Calendar push notifications for near-real-time sync (sub-60 second)
- Platform DB is source of truth for availability — calendar never queried live during a call (SCHED-09)
- Bookings made on platform push to Google Calendar asynchronously after confirmation
- Conflict resolution: Platform bookings always win. External Google Calendar conflicts are flagged in dashboard for owner to resolve manually — no auto-cancellation
- OAuth flow: "Connect Google Calendar" button in dashboard settings. Standard OAuth consent flow. Owner can see which calendar is synced and disconnect anytime.

**Travel Buffers & Geographic Zones**
- Zone model: Owner defines 2-5 service zones by grouping postal codes (e.g., "North zone: 730xxx, 750xxx")
- Same-zone bookings: Zero travel buffer (assumed nearby)
- Cross-zone bookings: 30-minute default travel buffer. Owner can adjust per zone pair if needed
- Without zones configured: Flat 30-minute buffer between ALL consecutive bookings (system works without zones)
- Zone setup timing: Post-activation optimization task, not required during onboarding

### Claude's Discretion
- Database schema design for appointments, slots, zones, calendar sync tables
- Atomic slot locking implementation (database-level constraints vs application logic)
- Google Calendar API integration details (webhook registration, token refresh)
- Retell custom function design for `book_appointment`
- Working hours editor UI design
- Exact slot calculation algorithm (combining working hours + existing bookings + travel buffers + external calendar blocks)
- Address validation/normalization approach
- Agent prompt extensions for booking conversation flow

### Deferred Ideas (OUT OF SCOPE)
- Outlook Calendar sync (SCHED-03) — deferred to Phase 5 or a patch. Architecture should support adding providers easily
- Cal.com integration — mentioned in Phase 2 as deferred idea, not pursued for Phase 3
- Geocoding-based travel time calculation — postal code clusters chosen over address-level distance for simplicity
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCHED-01 | Built-in availability scheduler with configurable time slots and business hours | Working hours JSONB stored in `tenants.working_hours`, slot calculation algorithm, UI editor replaces WorkingHoursStub |
| SCHED-02 | Bidirectional Google Calendar sync — local DB mirrors external calendar, changes propagate both ways | Google Calendar events.watch API + push notification webhook; calendar_sync_tokens + calendar_events DB tables |
| SCHED-03 | Bidirectional Outlook Calendar sync | **DEFERRED** to Phase 5 — architecture must be provider-agnostic |
| SCHED-04 | Atomic slot locking — when AI books a slot, it is locked at database level with zero race conditions | Postgres `pg_advisory_xact_lock` + INSERT with UNIQUE constraint as the definitive lock gate |
| SCHED-05 | Emergency calls get immediate slot lock while caller is still on the line | `book_appointment` custom function invoked synchronously by Retell during call; webhook responds with confirmation within 10s timeout |
| SCHED-06 | Routine calls create a lead with suggested time slots for owner to confirm | Call ends → `processCallAnalyzed` creates suggested_slots JSON on leads table |
| SCHED-07 | 30-60 minute travel time buffer automatically inserted between consecutive bookings | Zone-aware buffer logic in slot calculation: same-zone=0min, cross-zone=30min default |
| SCHED-08 | Geographic zone awareness — prevents back-to-back bookings across distant locations | `service_zones` table with postal_codes[] column; slot calculator checks zone of last booking before the candidate slot |
| SCHED-09 | Calendar is never queried live during a call — availability served from local DB mirror updated asynchronously | Local `appointments` table + `calendar_events` mirror table; push notifications update mirror asynchronously |
| VOICE-03 | AI extracts caller ID, job type/scope, and service address from conversation | `book_appointment` function receives address as argument extracted by the AI; stored on appointment record |
| VOICE-04 | AI performs mandatory read-back confirmation of captured address | Agent prompt BOOKING FLOW section requires verbal confirmation before invoking `book_appointment` |
</phase_requirements>

---

## Summary

Phase 3 has three orthogonal technical domains that must integrate cleanly: (1) a slot availability engine that reads from a local DB mirror and enforces travel buffers, (2) an atomic booking operation triggered synchronously during a live Retell call, and (3) bidirectional Google Calendar sync via push notifications. Each domain has clear, well-understood patterns — the risk is in their intersection under load.

The **primary constraint** is the Retell webhook response timeout: when the AI invokes `book_appointment`, the webhook handler has **10 seconds** to attempt slot lock, write the appointment, and return a result string to the AI. This rules out any synchronous calendar API calls on the hot path. Google Calendar sync must be fully asynchronous, pushed via `after()` from Next.js.

The **key design insight** is that the local DB is the single source of truth. Availability calculation, slot locking, and conflict detection all operate against the `appointments` + `calendar_events` tables — never against the live Google Calendar API during a call. The Google push notification webhook updates the mirror asynchronously; the channel must be renewed before its 7-day expiration using Supabase `pg_cron`.

**Primary recommendation:** Use `pg_advisory_xact_lock` keyed on a deterministic integer (hash of tenant_id + slot_start) as the concurrency gate inside a Postgres function called via `supabase.rpc()`. Wrap the lock + insert in a single DB function to eliminate round-trip window for races. The appointment row's `(tenant_id, start_time)` UNIQUE constraint is the final backstop if the advisory lock path fails.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `googleapis` | 171.4.0 | Google Calendar API v3 — event CRUD, events.watch, OAuth2 client | Official Google Node.js client; includes OAuth2Client with auto-refresh |
| `google-auth-library` | 10.6.2 | OAuth2 flow, token refresh, credential management | Official Google auth library; included transitively by googleapis but also imported directly for OAuth2Client |
| `date-fns` | 4.1.0 | Date arithmetic for slot calculation (add, sub, isWithinInterval, eachHourOfInterval) | Already proven in ecosystem; no timezone issues when combined with date-fns-tz |
| `date-fns-tz` | 3.2.0 | Timezone-aware slot windows (owner's local timezone vs UTC storage) | Pairs with date-fns for IANA timezone support |

**Note:** Both `date-fns` and `date-fns-tz` are not yet in `package.json` — install them.

**Existing libraries used in this phase (already installed):**
- `@supabase/supabase-js` ^2.99.2 — DB operations, RPC calls for advisory locks
- `next` ^16.1.7 — `after()` for async calendar sync after booking confirmation
- `sonner` — toast notifications for booking status in dashboard
- `radix-ui` / shadcn components — Dialog, Tooltip, Switch, Tabs, AlertDialog, Popover, Sheet (install via shadcn CLI)

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `uuid` | built-in Node.js `crypto.randomUUID()` | Google Calendar watch channel IDs (must be UUID-format) | Channel registration only |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `googleapis` npm | Direct HTTP to Calendar REST API | googleapis handles OAuth token refresh automatically; raw HTTP requires manual credential management |
| `pg_advisory_xact_lock` | Redis SET NX | STATE.md records prior research decision: "Redis SET NX + Postgres SELECT FOR UPDATE double-lock" — but Supabase doesn't include Redis. Single-layer Postgres advisory lock is sufficient; Redis adds infrastructure cost |
| `pg_advisory_xact_lock` | UNIQUE constraint only | UNIQUE constraint catches the race but throws an error, not a clean "slot taken" response. Advisory lock gives the handler a chance to offer the next slot gracefully |
| `date-fns` | `luxon` or `dayjs` | date-fns is tree-shakeable and has zero runtime state; consistent with a functional/immutable style |

**Installation:**
```bash
npm install googleapis google-auth-library date-fns date-fns-tz
npx shadcn@latest add dialog tooltip switch tabs alert-dialog popover sheet
```

**Version verification:**
```bash
npm view googleapis version        # 171.4.0 (verified 2026-03-20)
npm view google-auth-library version  # 10.6.2 (verified 2026-03-20)
npm view date-fns version          # 4.1.0 (verified 2026-03-20)
npm view date-fns-tz version       # 3.2.0 (verified 2026-03-20)
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── webhooks/
│   │   │   ├── retell/route.js         # EXISTING — add book_appointment handler
│   │   │   └── google-calendar/route.js # NEW — receives push notification pings
│   │   ├── google-calendar/
│   │   │   ├── auth/route.js           # NEW — initiate OAuth flow, return auth URL
│   │   │   └── callback/route.js       # NEW — exchange code, store tokens
│   │   └── appointments/
│   │       ├── available-slots/route.js # NEW — query available slots for dashboard
│   │       └── [id]/route.js           # NEW — cancel appointment
│   └── dashboard/
│       ├── calendar/page.js            # NEW — calendar/appointments view
│       └── services/page.js            # EXISTING — add WorkingHoursEditor + CalendarSyncCard
├── lib/
│   ├── scheduling/
│   │   ├── slot-calculator.js          # NEW — availability algorithm
│   │   ├── booking.js                  # NEW — atomic booking logic (calls Supabase RPC)
│   │   └── google-calendar.js          # NEW — googleapis wrapper (create event, watch, sync)
│   ├── webhooks/
│   │   └── google-calendar-push.js     # NEW — handle push notification, sync mirror
│   └── agent-prompt.js                 # EXISTING — extend with booking flow section
supabase/
└── migrations/
    └── 003_scheduling.sql              # NEW — appointments, zones, calendar sync tables
```

### Pattern 1: Atomic Slot Lock via Postgres RPC

**What:** Lock a slot using `pg_advisory_xact_lock` inside a Postgres function, which is called via `supabase.rpc()`. The lock, availability re-check, and INSERT all happen in one transaction. The UNIQUE constraint on `(tenant_id, start_time)` is the backstop.

**When to use:** Every `book_appointment` invocation from the Retell webhook handler.

**Example:**
```sql
-- In supabase/migrations/003_scheduling.sql
CREATE OR REPLACE FUNCTION book_appointment_atomic(
  p_tenant_id uuid,
  p_call_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_service_address text,
  p_caller_name text,
  p_caller_phone text,
  p_urgency text,
  p_zone_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  lock_key bigint;
  existing_count int;
  new_appointment_id uuid;
BEGIN
  -- Deterministic lock key: hash of tenant_id + slot start_time epoch
  lock_key := abs(hashtext(p_tenant_id::text || extract(epoch FROM p_start_time)::text));

  -- Acquire transaction-scoped advisory lock (releases on COMMIT/ROLLBACK)
  PERFORM pg_advisory_xact_lock(lock_key);

  -- Re-check availability after acquiring lock
  SELECT COUNT(*) INTO existing_count
  FROM appointments
  WHERE tenant_id = p_tenant_id
    AND status NOT IN ('cancelled')
    AND tsrange(start_time, end_time, '[)') && tsrange(p_start_time, p_end_time, '[)');

  IF existing_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'slot_taken');
  END IF;

  -- Insert the confirmed appointment
  INSERT INTO appointments (
    tenant_id, call_id, start_time, end_time,
    service_address, caller_name, caller_phone,
    urgency, zone_id, status, booked_via
  ) VALUES (
    p_tenant_id, p_call_id, p_start_time, p_end_time,
    p_service_address, p_caller_name, p_caller_phone,
    p_urgency, p_zone_id, 'confirmed', 'ai_call'
  )
  RETURNING id INTO new_appointment_id;

  RETURN jsonb_build_object('success', true, 'appointment_id', new_appointment_id);
END;
$$;
```

```javascript
// Source: Supabase JS client rpc pattern — src/lib/scheduling/booking.js
export async function atomicBookSlot(params) {
  const { data, error } = await supabase.rpc('book_appointment_atomic', {
    p_tenant_id: params.tenantId,
    p_call_id: params.callId,
    p_start_time: params.startTime.toISOString(),
    p_end_time: params.endTime.toISOString(),
    p_service_address: params.address,
    p_caller_name: params.callerName,
    p_caller_phone: params.callerPhone,
    p_urgency: params.urgency,
    p_zone_id: params.zoneId || null,
  });

  if (error) throw error;
  return data; // { success: true, appointment_id } or { success: false, reason: 'slot_taken' }
}
```

### Pattern 2: Retell `book_appointment` Custom Function

**What:** Add `book_appointment` as a Retell custom function alongside `transfer_call`. When the AI agent has confirmed address read-back and the caller has selected a slot, it invokes this function. The webhook handler calls `atomicBookSlot` and returns a result string the AI reads aloud.

**When to use:** During live calls, when address confirmed + slot selected.

**Note on response timeout:** Retell's webhook handler has a **10-second timeout** with up to 2 retries. The `book_appointment` handler must complete within ~8 seconds to leave margin. The Postgres RPC (advisory lock + insert) is sub-100ms. Google Calendar event creation is done **asynchronously via `after()`**, not in the synchronous response path.

**Example:**
```javascript
// Source: live code analysis — src/app/api/webhooks/retell/route.js
// Existing payload shape confirmed: { event, call_id, function_call: { name, arguments } }

// In retell-agent-config.js — add to functions array:
{
  name: 'book_appointment',
  description: 'Book a confirmed appointment slot for the caller. Only invoke AFTER: (1) collecting caller name, phone, and service address, (2) reading back the address and receiving verbal confirmation. Pass the confirmed slot the caller selected.',
  parameters: {
    type: 'object',
    properties: {
      slot_start: {
        type: 'string',
        description: 'ISO 8601 datetime of the appointment start (e.g., "2026-03-21T10:00:00")'
      },
      slot_end: {
        type: 'string',
        description: 'ISO 8601 datetime of the appointment end'
      },
      service_address: {
        type: 'string',
        description: 'Service address as verbally confirmed by the caller'
      },
      caller_name: { type: 'string', description: 'Caller full name' },
      urgency: {
        type: 'string',
        enum: ['emergency', 'routine', 'high_ticket'],
        description: 'Urgency level from triage'
      }
    },
    required: ['slot_start', 'slot_end', 'service_address', 'caller_name', 'urgency'],
  },
}

// Webhook handler addition in handleFunctionCall():
if (function_call?.name === 'book_appointment') {
  return handleBookAppointment(payload);
}
```

```javascript
// handleBookAppointment response shape — AI reads the returned string aloud
// Return: Response.json({ result: "Your appointment is confirmed for Tuesday March 21st at 10 AM." })
// On slot_taken: Response.json({ result: "That slot was just taken. The next available is [time]. Shall I book that instead?" })
```

### Pattern 3: Slot Availability Algorithm

**What:** Compute a sorted list of available slots for a given date range, given working hours, existing appointments (with travel buffers), and external calendar blocks.

**When to use:** Called by `handleInbound()` to pass available slots as `dynamic_variables` to the AI agent, and by the calendar dashboard API.

**Algorithm (pure function, no DB side effects):**
```javascript
// Source: synthesized from project context — src/lib/scheduling/slot-calculator.js
export function calculateAvailableSlots({
  workingHours,     // { monday: { open: '08:00', close: '17:00', enabled: true }, ... }
  slotDurationMins, // e.g., 60
  existingBookings, // [{ start_time, end_time, zone_id }]
  externalBlocks,   // [{ start_time, end_time }] — from calendar_events mirror
  zones,            // [{ id, name, postal_codes[] }]
  zonePairBuffers,  // { 'zone-a-id:zone-b-id': 30 } — minutes
  targetDate,       // Date object
  tenantTimezone,   // IANA string e.g., 'America/Chicago'
  maxSlots = 3,     // How many to return for AI offer
}) {
  // 1. Get working window for targetDate's day-of-week
  // 2. Generate all possible slot starts in slotDurationMins increments within window
  // 3. For each candidate slot:
  //    a. Check overlap with existingBookings (including their end + travel buffer)
  //    b. Check overlap with externalBlocks
  //    c. Compute required travel buffer from last booking before this slot
  // 4. Return first maxSlots available slots
}
```

**Travel buffer lookup logic:**
```
lastBookingBeforeSlot = last appointment ending before candidateSlot.start
if lastBookingBeforeSlot exists:
  lastZone = zone containing lastBookingBeforeSlot.postal_code (or null)
  thisZone = zone containing candidateSlot.postal_code (or null — unknown at slot calc time)
  if lastZone == null OR thisZone == null: buffer = 30 minutes (flat default)
  elif lastZone.id == thisZone.id: buffer = 0 minutes (same zone)
  else: buffer = zonePairBuffers[lastZone.id + ':' + thisZone.id] ?? 30 minutes
requiredSlotStart = lastBookingBeforeSlot.end_time + buffer
```

**Note on address-at-slot-calc-time:** The caller's zone is not known at slot calculation time (before the call). The AI offers slots calculated with the conservative 30-minute cross-zone buffer applied to the day's last existing booking. The zone of the *new* booking is set when `book_appointment` is invoked with the confirmed address.

### Pattern 4: Google Calendar OAuth + Sync Architecture

**What:** OAuth2 popup flow to connect owner's Google Calendar. Tokens stored in `calendar_credentials` DB table. `events.watch` channel registered on connect. Push notifications update the `calendar_events` mirror. Channel renewed before 7-day expiration via Supabase `pg_cron`.

**When to use:** Owner clicks "Connect Google Calendar" in settings.

**OAuth scopes required:**
- `https://www.googleapis.com/auth/calendar.events` — read/write events on the owner's calendar
- `https://www.googleapis.com/auth/calendar.readonly` — NOT sufficient; we need to create platform bookings in their calendar

**Token storage decision:** Store `access_token`, `refresh_token`, `expiry_date`, `token_type`, and `calendar_id` in `calendar_credentials` table (not in `tenants` to keep provider-agnostic for Phase 5 Outlook). `googleapis` `OAuth2Client.setCredentials()` + `getAccessToken()` handles silent token refresh automatically.

**Watch channel management:**
```javascript
// Source: Google Calendar API v3 reference — events.watch
// Channel expires after 7 days (604800 seconds = default TTL)
// Must be renewed with a new channel id before expiration

// Register watch:
const watchResponse = await calendar.events.watch({
  calendarId: 'primary',
  requestBody: {
    id: crypto.randomUUID(),  // unique per registration
    type: 'web_hook',
    address: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/google-calendar`,
    token: tenantId,  // included in notification for routing
    params: { ttl: '604800' },  // 7 days
  },
});
// Store watchResponse.data.expiration (ms timestamp) in calendar_credentials
```

**Notification payload headers (no body content — notification is a ping):**
```
X-Goog-Channel-ID: {channel-id}
X-Goog-Resource-State: 'sync' | 'exists' | 'not_exists'
X-Goog-Channel-Token: {tenantId}
X-Goog-Channel-Expiration: {human-readable expiration}
```

**On `exists` notification:** Fetch changed events using `events.list` with `syncToken` (incremental sync). Store changed events in `calendar_events` mirror. Mark any that overlap confirmed appointments as conflicts.

**Channel renewal via Supabase pg_cron:**
```sql
-- Enable pg_cron extension (in migration or dashboard)
-- Schedule daily check to renew channels expiring within 24 hours
SELECT cron.schedule(
  'renew-gcal-watch-channels',
  '0 2 * * *',  -- daily at 2 AM UTC
  $$
    SELECT net.http_post(
      url := current_setting('app.url') || '/api/cron/renew-calendar-channels',
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret')),
      body := '{}'::jsonb
    );
  $$
);
```

### Anti-Patterns to Avoid

- **Calling Google Calendar API synchronously during a call:** The advisory lock + insert must complete within 10 seconds. Calendar event creation must use `after()` for deferred execution.
- **Querying Google Calendar live for availability:** Platform DB mirror is the only source consulted during availability calculation. (SCHED-09 is a hard constraint.)
- **Using `pg_advisory_lock` (session-level) instead of `pg_advisory_xact_lock`:** Session-level locks can be forgotten if a connection is returned to the pool mid-transaction. Transaction-level locks release automatically on COMMIT/ROLLBACK.
- **Single UNIQUE constraint without advisory lock:** The constraint catches races but throws a Postgres error that needs ugly error-message parsing. The advisory lock gives the handler a clean `slot_taken` signal to offer the next slot gracefully.
- **Storing tokens in `tenants.working_hours` JSONB:** Credentials must live in a separate `calendar_credentials` table with RLS; mixing them with working_hours couples unrelated concerns.
- **One calendar_events table for both providers:** Use a `provider` column from day one (`'google' | 'outlook'`) to enable Phase 5 Outlook support without a schema migration.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth2 token refresh | Manual token refresh + storage | `googleapis` `OAuth2Client.setCredentials()` | Handles expiry detection, refresh, and retry automatically |
| Calendar event serialization | Manual RFC 5545 / Google Event JSON | `googleapis` `calendar.events.insert()` | Field mapping, timezone handling, attendee formatting — edge cases everywhere |
| Date arithmetic for slot windows | Manual timestamp math | `date-fns` + `date-fns-tz` | DST transitions, timezone offsets, month boundaries |
| Watch channel registration | Raw HTTP POST to watch endpoint | `googleapis` `calendar.events.watch()` | Handles auth headers, request signing, response parsing |
| Postgres lock key generation | Custom hash function | `hashtext()` built into Postgres | Deterministic, fast, built-in — no external library |
| Interval overlap detection | Custom boolean logic | Postgres `tsrange &&` operator | Handles all edge cases (adjacent slots, contained slots, partial overlap) |

**Key insight:** The Google Calendar ecosystem has significant surface area (token types, scopes, notification channels, incremental sync tokens, event PATCH semantics). The `googleapis` npm package encapsulates all of this. Using raw HTTP would require re-implementing large parts of the library.

---

## Common Pitfalls

### Pitfall 1: Retell Webhook Timeout Under Advisory Lock Contention

**What goes wrong:** The Retell webhook handler times out at 10 seconds. Under high concurrency, multiple handlers contend for the same advisory lock — later arrivals block waiting for the lock to release. The total time from lock acquisition through DB write must be well under 10 seconds.

**Why it happens:** `pg_advisory_xact_lock` is a blocking lock, not a try-lock. If two callers hit the same slot simultaneously, the second one waits.

**How to avoid:** Use `pg_try_advisory_xact_lock` instead of the blocking form. If it returns false, immediately return `slot_taken` and offer the next slot — don't wait. The booking function should check the next 3 slots and retry each atomically.

**Warning signs:** Retell webhook logs showing timeout errors; calls where AI says "let me check" and goes silent.

### Pitfall 2: Google Calendar Watch Channel Silent Expiration

**What goes wrong:** The push notification channel expires after 7 days with no notification. New external calendar events are created but never synced into the mirror. The platform shows stale availability — over-booking risk returns.

**Why it happens:** "There is no automatic way to renew a notification channel." (Google official docs)

**How to avoid:** Store channel `expiration` (Unix ms timestamp) in `calendar_credentials`. Run a daily pg_cron job that queries for channels expiring within 24 hours, registers a new channel, and stores the new channel ID + expiration. Keep the old channel active during the overlap period.

**Warning signs:** No Google Calendar push webhook hits in >7 days; calendar_events table has a sync gap.

### Pitfall 3: OAuth Refresh Token Only Returned Once

**What goes wrong:** On a second OAuth consent attempt (e.g., re-connect after disconnect), Google does not return a new refresh_token — only the access_token. The stored refresh_token becomes invalid if revoked.

**Why it happens:** Google's OAuth2 returns `refresh_token` only on first consent or when `prompt=consent` is forced.

**How to avoid:** Always pass `access_type: 'offline'` AND `prompt: 'consent'` in the OAuth flow. On disconnect, also call `oauth2Client.revokeToken(refreshToken)` to clean up on Google's side.

**Warning signs:** `oauth2Client.getAccessToken()` throws 400 `invalid_grant`; owner sees "Reconnect required" status.

### Pitfall 4: Timezone Mismatch in Slot Calculation

**What goes wrong:** Working hours are stored as local-time strings ("08:00", "17:00") but appointments are stored as UTC timestamptz. Slot calculation that ignores timezone creates slots at the wrong wall clock time in the owner's timezone.

**Why it happens:** JavaScript `new Date()` uses local machine timezone; server functions run in UTC.

**How to avoid:** Store owner timezone in `tenants` table (e.g., `tenant_timezone text DEFAULT 'America/Chicago'`). Use `date-fns-tz` `zonedTimeToUtc()` when converting working hours to UTC slot windows. Use `utcToZonedTime()` when displaying slots in the dashboard.

**Warning signs:** Slots offered at unexpected times; morning bookings appearing in the evening in the calendar view.

### Pitfall 5: Incremental Sync Token Invalidation

**What goes wrong:** Google Calendar incremental sync uses a `syncToken` returned from `events.list`. This token expires and becomes invalid if not used within a certain window, or after a full re-sync. If the sync token is invalid, `events.list` returns HTTP 410 (Gone).

**Why it happens:** Google invalidates sync tokens after calendar data changes significantly or after a period of inactivity.

**How to avoid:** Handle 410 responses by discarding the stored sync token and performing a full `events.list` (no `syncToken`, with `timeMin` set to now) to rebuild the mirror. Store the new sync token.

**Warning signs:** Google push notification is received but `events.list` returns 410; mirror stops updating.

### Pitfall 6: Concurrent Advisory Lock Deadlock (Two-Resource Scenarios)

**What goes wrong:** If the booking function ever acquires two advisory locks (e.g., locking both the slot AND a zone resource), two concurrent transactions can deadlock.

**Why it happens:** Classic deadlock: TX1 holds lock A, waits for lock B; TX2 holds lock B, waits for lock A.

**How to avoid:** The booking function acquires **exactly one** advisory lock (keyed on the slot). Zone information is read-only during slot calculation. Never acquire two advisory locks in sequence.

---

## Code Examples

Verified patterns from official sources and live code inspection:

### Google Calendar OAuth2 Init
```javascript
// Source: googleapis 171.x official pattern — src/lib/scheduling/google-calendar.js
import { google } from 'googleapis';

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/google-calendar/callback`
  );
}

export function getAuthUrl(oauth2Client) {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',           // Forces refresh_token on every auth
    scope: ['https://www.googleapis.com/auth/calendar.events'],
  });
}
```

### Google Calendar Event Create (async, post-booking)
```javascript
// Source: googleapis calendar.events.insert reference
export async function createCalendarEvent({ credentials, appointment }) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(credentials); // { access_token, refresh_token, expiry_date }

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: `${appointment.urgency === 'emergency' ? '[EMERGENCY] ' : ''}${appointment.jobType} — ${appointment.callerName}`,
      location: appointment.serviceAddress,
      start: { dateTime: appointment.startTime, timeZone: appointment.timezone },
      end:   { dateTime: appointment.endTime,   timeZone: appointment.timezone },
      extendedProperties: {
        private: {
          platform_appointment_id: appointment.id,
          tenant_id: appointment.tenantId,
        }
      }
    }
  });
}
```

### Google Calendar Push Notification Webhook Handler
```javascript
// Source: Google Calendar push notification docs — src/app/api/webhooks/google-calendar/route.js
export async function POST(request) {
  const state    = request.headers.get('X-Goog-Resource-State');
  const tenantId = request.headers.get('X-Goog-Channel-Token');
  const channelId = request.headers.get('X-Goog-Channel-ID');

  if (state === 'sync') {
    // Initial handshake — no action needed
    return Response.json({ ok: true });
  }

  if (state === 'exists') {
    // An event was created/updated/deleted — trigger async incremental sync
    after(async () => {
      await syncCalendarEvents(tenantId);
    });
  }

  return Response.json({ ok: true }); // Always 200 to acknowledge
}
```

### Retell book_appointment Handler (hot path)
```javascript
// Source: live code analysis of existing handleFunctionCall pattern
async function handleBookAppointment(payload) {
  const { call_id, function_call } = payload;
  const args = function_call.arguments;

  // Resolve tenant from call record
  const { data: call } = await supabase
    .from('calls').select('tenant_id').eq('retell_call_id', call_id).single();

  if (!call?.tenant_id) {
    return Response.json({ result: 'I was unable to confirm the booking. Please call back.' });
  }

  const startTime = new Date(args.slot_start);
  const endTime   = new Date(args.slot_end);

  const result = await atomicBookSlot({
    tenantId: call.tenant_id,
    callId: call.id,
    startTime,
    endTime,
    address: args.service_address,
    callerName: args.caller_name,
    callerPhone: payload.call?.from_number,
    urgency: args.urgency,
  });

  if (!result.success) {
    // Fetch next available slot and offer it
    const nextSlot = await getNextAvailableSlot(call.tenant_id, endTime);
    return Response.json({
      result: `That slot was just taken. The next available time is ${formatSlotForSpeech(nextSlot)}. Would you like me to book that instead?`
    });
  }

  // Trigger async calendar sync (non-blocking — does not affect response time)
  after(async () => {
    await pushBookingToCalendar(call.tenant_id, result.appointment_id);
  });

  const formattedTime = formatSlotForSpeech(startTime);
  return Response.json({
    result: `Your appointment is confirmed for ${formattedTime}. You'll receive a confirmation. Is there anything else I can help you with?`
  });
}
```

### Dynamic Variables Extension for Inbound Handler
```javascript
// src/app/api/webhooks/retell/route.js — handleInbound() extension
// Add availability data to dynamic_variables so AI can offer slots

const availableSlots = await getAvailableSlotsForCall(tenant.id, new Date());
// Returns: [{ start: ISO, end: ISO, label: "Tuesday March 21 at 10 AM" }, ...]

return Response.json({
  dynamic_variables: {
    // ...existing fields...
    available_slots: JSON.stringify(availableSlots.slice(0, 6)), // first 6 slots
    booking_enabled: availableSlots.length > 0,
  },
});
```

---

## Database Schema Design (Claude's Discretion)

The following schema is recommended for the migration `003_scheduling.sql`:

### New Tables

```sql
-- Appointments: confirmed bookings (source of truth)
CREATE TABLE appointments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_id         uuid REFERENCES calls(id) ON DELETE SET NULL,
  start_time      timestamptz NOT NULL,
  end_time        timestamptz NOT NULL,
  service_address text,
  caller_name     text,
  caller_phone    text,
  urgency         text CHECK (urgency IN ('emergency', 'routine', 'high_ticket')),
  zone_id         uuid,  -- FK to service_zones, nullable
  status          text NOT NULL DEFAULT 'confirmed'
                    CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  booked_via      text NOT NULL DEFAULT 'ai_call'
                    CHECK (booked_via IN ('ai_call', 'manual')),
  google_event_id text,  -- set after async calendar push
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, start_time)  -- backstop for race conditions
);

-- Service zones: postal code clusters
CREATE TABLE service_zones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         text NOT NULL,
  postal_codes text[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Zone pair travel buffers (only cross-zone pairs need explicit rows)
CREATE TABLE zone_travel_buffers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  zone_a_id   uuid NOT NULL REFERENCES service_zones(id) ON DELETE CASCADE,
  zone_b_id   uuid NOT NULL REFERENCES service_zones(id) ON DELETE CASCADE,
  buffer_mins int NOT NULL DEFAULT 30,
  UNIQUE (zone_a_id, zone_b_id)
);

-- Calendar credentials: OAuth tokens per tenant per provider
CREATE TABLE calendar_credentials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider        text NOT NULL DEFAULT 'google'
                    CHECK (provider IN ('google', 'outlook')),
  access_token    text NOT NULL,
  refresh_token   text NOT NULL,
  expiry_date     bigint,  -- ms timestamp
  calendar_id     text NOT NULL DEFAULT 'primary',
  calendar_name   text,    -- display name for UI
  watch_channel_id   text,
  watch_resource_id  text,
  watch_expiration   bigint,  -- ms timestamp — for renewal
  last_sync_token    text,    -- incremental sync token
  last_synced_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

-- Calendar events mirror: external events blocking availability
CREATE TABLE calendar_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider        text NOT NULL DEFAULT 'google',
  external_id     text NOT NULL,  -- Google event ID
  title           text,
  start_time      timestamptz NOT NULL,
  end_time        timestamptz NOT NULL,
  is_all_day      boolean NOT NULL DEFAULT false,
  appointment_id  uuid REFERENCES appointments(id) ON DELETE SET NULL,
  conflict_dismissed boolean NOT NULL DEFAULT false,
  synced_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_id)
);

-- Extend tenants table
ALTER TABLE tenants
  ADD COLUMN tenant_timezone text NOT NULL DEFAULT 'America/Chicago',
  ADD COLUMN slot_duration_mins int NOT NULL DEFAULT 60;
```

### Schema Notes

- `appointments.UNIQUE(tenant_id, start_time)` — the backstop constraint for concurrent booking attempts
- `calendar_credentials.UNIQUE(tenant_id, provider)` — one connected calendar per provider per tenant; extend to allow multiple in a future phase if needed
- `calendar_events.is_all_day = true` events do NOT block slots — informational only (per UI-SPEC Surface 2)
- `zone_travel_buffers` uses directional storage (zone_a → zone_b); the query layer normalizes to `MIN(zone_a_id, zone_b_id)` convention to avoid duplicate rows
- `appointments.google_event_id` is nullable because calendar push is async — set in `after()` handler

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Redis SET NX for slot locking | Postgres `pg_advisory_xact_lock` | Project context (no Redis in Supabase) | Removes Redis infrastructure dependency |
| Polling Google Calendar every N minutes | Push notifications via `events.watch` | Google added watch API in Calendar v3 | Sub-60 second sync vs 5-minute polling lag |
| Separate `googleapis` vs `google-auth-library` installs | Both packages; googleapis transitively includes google-auth-library | Always | googleapis v171 + google-auth-library v10 is the current pair |
| `pg_cron` manual SQL migration | Supabase Cron (GUI + SQL) | Supabase 2024 | Can schedule via dashboard OR SQL; `30 seconds` is minimum interval |
| Working hours as flat array | JSONB stub (`tenants.working_hours`) | Phase 2 | Schema is already there; Phase 3 populates it |

**Deprecated/outdated:**
- Cal.com integration: deferred per CONTEXT.md; do not design for it
- Outlook OAuth for Phase 3: deferred; schema must be provider-agnostic but no Outlook code
- Geocoding-based travel time: not used; postal code zone clusters chosen for simplicity

---

## Open Questions

1. **Retell `available_slots` in dynamic_variables — string encoding**
   - What we know: Retell `dynamic_variables` accepts string values only; slot list must be serialized
   - What's unclear: The agent prompt will need to parse and read formatted slot options; the exact prompt phrasing and serialization format (JSON string vs pipe-delimited) needs careful design to avoid the AI misreading slot times
   - Recommendation: Encode as a simple numbered list string: `"1. Tuesday March 21 at 10 AM\n2. Tuesday March 21 at 2 PM\n3. Wednesday March 22 at 9 AM"` — easier for the LLM to quote naturally

2. **Slot calculation at inbound time — address unknown**
   - What we know: The AI offers slots before the caller has given their address. The zone of the new booking is not known at offer time.
   - What's unclear: Should the availability engine assume worst-case (30-min cross-zone buffer) or best-case (0-min same-zone) when computing offered slots?
   - Recommendation: Use worst-case (30-min cross-zone) for offered slots. When `book_appointment` is invoked with the address, re-check availability with the actual zone — if the slot is still available (it usually will be with the conservative pre-filter), confirm; if not, offer next.

3. **Google push notification domain verification for Vercel preview deployments**
   - What we know: Google requires a valid SSL certificate on the webhook domain. Vercel production domains have valid SSL. Preview deployment URLs (*.vercel.app) also have valid SSL.
   - What's unclear: Whether Google requires the domain to be registered in Google Search Console for push notifications.
   - Recommendation: The Vercel production domain does not require Search Console verification for Calendar push notifications (verified in official docs — only domain ownership verification applies to some Workspace APIs, not Calendar). Use `NEXT_PUBLIC_APP_URL` env var to configure the webhook address; set this to the production URL in production, localhost tunnel URL in dev.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 |
| Config file | `jest.config.js` (exists from Phase 1) |
| Quick run command | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --testPathPattern=scheduling --passWithNoTests` |
| Full suite command | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCHED-01 | `calculateAvailableSlots()` returns correct slots given working hours + existing bookings | unit | `jest --testPathPattern=slot-calculator` | ❌ Wave 0 |
| SCHED-04 | `book_appointment_atomic()` returns `slot_taken` when concurrently called for same slot | integration | `jest --testPathPattern=booking-concurrency` | ❌ Wave 0 |
| SCHED-05 | `handleBookAppointment()` returns confirmation string within simulated webhook timeout | unit | `jest --testPathPattern=book-appointment-handler` | ❌ Wave 0 |
| SCHED-06 | Routine call `processCallAnalyzed()` creates lead with suggested_slots | unit | `jest --testPathPattern=call-processor` | ❌ Wave 0 |
| SCHED-07 | Slot calculator blocks slot when last booking + 30min buffer overlaps candidate | unit | `jest --testPathPattern=slot-calculator` | ❌ Wave 0 |
| SCHED-08 | Cross-zone booking blocked; same-zone booking allowed with 0-min buffer | unit | `jest --testPathPattern=slot-calculator` | ❌ Wave 0 |
| SCHED-09 | `handleInbound()` does not call Google Calendar API (only queries local DB) | unit | `jest --testPathPattern=retell-webhook` | ❌ Wave 0 |
| SCHED-02 | Push notification handler triggers incremental sync | unit | `jest --testPathPattern=google-calendar-push` | ❌ Wave 0 |
| VOICE-03 | `book_appointment` function parameters include `service_address` | unit | `jest --testPathPattern=retell-agent-config` | ❌ Wave 0 |
| VOICE-04 | Agent prompt includes mandatory address read-back instruction | unit | `jest --testPathPattern=agent-prompt` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --testPathPattern=scheduling --passWithNoTests`
- **Per wave merge:** `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/scheduling/__tests__/slot-calculator.test.js` — covers SCHED-01, SCHED-07, SCHED-08
- [ ] `src/lib/scheduling/__tests__/booking.test.js` — covers SCHED-04, SCHED-05
- [ ] `src/lib/scheduling/__tests__/google-calendar-push.test.js` — covers SCHED-02, SCHED-09
- [ ] `src/lib/scheduling/__tests__/book-appointment-handler.test.js` — covers SCHED-05, VOICE-03, VOICE-04

---

## Sources

### Primary (HIGH confidence)
- Google Calendar API official docs (`developers.google.com/workspace/calendar/api/guides/push`) — push notification structure, channel expiration, watch endpoint
- Google Calendar events.watch reference (`developers.google.com/workspace/calendar/api/v3/reference/events/watch`) — request body parameters, response structure, TTL
- Google Calendar API auth scopes (`developers.google.com/workspace/calendar/api/auth`) — 18 scopes documented, `calendar.events` confirmed for read/write
- googleapis npm registry — version 171.4.0 verified 2026-03-20
- google-auth-library npm registry — version 10.6.2 verified 2026-03-20
- Supabase Cron quickstart (`supabase.com/docs/guides/cron/quickstart`) — pg_cron syntax, minimum 30-second interval, HTTP post pattern
- Live code inspection: `src/app/api/webhooks/retell/route.js` — confirmed `{ call_id, function_call: { name, arguments } }` payload shape
- Live code inspection: `src/lib/retell-agent-config.js` — confirmed custom function registration pattern
- PostgreSQL official docs (`postgresql.org/docs/current/explicit-locking.html`) — `pg_advisory_xact_lock` semantics, transaction-scope release
- Retell custom function docs (`docs.retellai.com/build/conversation-flow/custom-function`) — response size limit 15,000 chars, 2-minute timeout (Retell), 10-second webhook timeout confirmed in webhook overview

### Secondary (MEDIUM confidence)
- Retell webhook overview docs — confirmed `call_function_invoked` event pattern (note: docs may have been updated; existing code is ground truth)
- SupaExplorer advisory locks best practice — confirms `pg_advisory_xact_lock` over session-level lock for request/response workflows
- `appmaster.io` advisory locks article — confirms transaction-level pattern and Supabase `rpc()` integration
- date-fns v4.1.0, date-fns-tz v3.2.0 — version verified via npm registry

### Tertiary (LOW confidence)
- Community patterns for Google Calendar watch channel renewal cron — implementation details from multiple blog posts, pattern consistent but not from official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via npm registry; googleapis is Google's official library
- Architecture patterns: HIGH — advisory lock pattern from PostgreSQL docs; Retell pattern from live code; Google Calendar from official docs
- Database schema: HIGH — synthesized from project schema conventions + locked decisions
- Pitfalls: MEDIUM-HIGH — OAuth refresh_token once / sync token 410 / channel expiration verified from official docs; concurrency pitfall from Postgres docs
- Slot calculation algorithm: MEDIUM — pattern is sound but exact implementation details are at implementer discretion

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable APIs; googleapis and Google Calendar API are versioned and stable)

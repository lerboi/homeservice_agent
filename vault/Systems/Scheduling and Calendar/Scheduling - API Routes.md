---
type: system
system: Scheduling and Calendar
status: current
description: "HTTP routes belonging to Scheduling and Calendar: methods, parameters and behaviour. Covers: `GET /api/appointments`; Calendar Blocks API; Calendar Sync Patterns; `GET /api/appointments/[id]`; `PATCH /api/appointments/[id]`; `GET /api/working-hours`; `PUT /api/working-hours`; `GET /api/service-area`"
source: .claude/skills/scheduling-calendar-system/SKILL.md § 7. API Routes
migrated: 2026-11-23
verified:
tags: [voco/system/scheduling-and-calendar]
---

# API Routes

Part of [[Scheduling and Calendar]]. Migrated verbatim from the `scheduling-calendar-system` skill; check `verified` before trusting details.

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

**Mirrored event dedup**: The GET response filters out `calendar_events` whose `external_id` matches any `appointments.external_event_id` OR any `calendar_blocks.external_event_id`. This prevents double-rendering when Voco pushes a booking/block to Google/Outlook and the webhook syncs the mirror back into `calendar_events`.

### Calendar Blocks API

**`GET /api/calendar-blocks`** — Returns blocks in date range with `group_count` (server-side count of blocks sharing the same `group_id`, enabling "Delete all N days" even when viewing a single day).

**`POST /api/calendar-blocks`** — Creates a block. If `sync_to_calendar !== false`, synchronously pushes to primary connected calendar (Google or Outlook). All-day blocks use date-only format (`start: { date: "2026-04-27" }`) to avoid timezone issues. Accepts optional `group_id` for multi-day blocks.

**`PATCH /api/calendar-blocks/[id]`** — Updates block fields. If `external_event_id` exists, asynchronously updates the external calendar event via `after()`.

**`DELETE /api/calendar-blocks/[id]`** — Deletes a block. Supports `?group=true` query param to delete all blocks sharing the same `group_id` (bulk delete for multi-day blocks). Asynchronously removes external calendar events for all deleted blocks.

### Calendar Sync Patterns

**Orphan cleanup**: When `syncCalendarEvents` or `syncOutlookCalendarEvents` processes a deleted/cancelled external event, it also clears `external_event_id` on any `calendar_blocks` or `appointments` row that referenced that event. This prevents stale references to deleted external events.

**Sync status**: `CalendarSyncCard` derives status from `watch_expiration` — shows "error" only if the webhook watch channel has expired, not based on `last_synced_at` freshness.

### `GET /api/appointments/[id]`

Returns single appointment with associated call data (`recording_url`, `transcript`).

### `PATCH /api/appointments/[id]`

Two modes:
- `{ status: 'cancelled' }` — sets appointment status to cancelled; includes `google_event_id` (renamed `external_event_id`) in response for client-side handling
- `{ conflict_dismissed: true, calendar_event_id: '...' }` — sets `conflict_dismissed: true` on the specified `calendar_events` row

### `GET /api/working-hours`

Returns `{ working_hours, slot_duration_mins, travel_buffer_mins, tenant_timezone }` from `tenants` table.

### `PUT /api/working-hours`

Updates any combination of `working_hours` (JSONB), `slot_duration_mins` (int, 5–480), `travel_buffer_mins` (int, 0–240 — M16 P2), `tenant_timezone` (IANA string). Only fields present in request body are updated; each is range-validated.

### `GET /api/service-area`

Returns the tenant's single flat **Service Area**: the UNION of `postal_codes` + `cities` across all of the tenant's `service_zones` rows, plus the owner settings `out_of_area_action` and `out_of_area_referral_note` read from `tenants`. (M16 P1 — replaced `GET /api/zones`.)

### `PUT /api/service-area`

Persists the Service Area. Collapses the submitted coverage into ONE canonical `service_zones` row — updates the tenant's oldest `service_zones` row in place and deletes any extras — then writes `out_of_area_action` and `out_of_area_referral_note` to `tenants`. (M16 P1 — replaced `POST /api/zones` + `PUT /api/zones`.)

The dashboard surface is `ServiceAreaManager.js`, mounted at `/dashboard/more/service-zones` (page heading changed "Service Zones & Travel" → "Service Area"). The removed `ZoneManager.js`, `api/zones/route.js`, and `api/zones/[id]/route.js` were git-rm'd. UI details live in the dashboard-crm-system skill.

---

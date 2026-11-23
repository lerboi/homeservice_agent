---
type: system
system: Scheduling and Calendar
status: current
description: "Key constraint: UNIQUE (tenant_id, start_time) — secondary anti-double-booking defense. Covers: `appointments` (from 003_scheduling.sql + 007_outlook_calendar.sql + 026_address_fields.sql + 046_calendar_blocks_and_completed_at.sql); `service_zones` (from 003_scheduling.sql + 074_service_area_gate.sq"
source: .claude/skills/scheduling-calendar-system/SKILL.md § 8. Database Tables
migrated: 2026-11-23
verified:
tags: [voco/system/scheduling-and-calendar]
---

# Database Tables

Part of [[Scheduling and Calendar]]. Migrated verbatim from the `scheduling-calendar-system` skill; check `verified` before trusting details.

### `appointments` (from 003_scheduling.sql + 007_outlook_calendar.sql + 026_address_fields.sql + 046_calendar_blocks_and_completed_at.sql)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid | FK → tenants(id) ON DELETE CASCADE |
| `call_id` | uuid | FK → calls(id) ON DELETE SET NULL (nullable). Backfilled in post-call reconciliation when race-affected. |
| `start_time` | timestamptz | |
| `end_time` | timestamptz | |
| `service_address` | text | |
| `caller_name` | text | |
| `caller_phone` | text | |
| `urgency` | text | CHECK IN ('emergency', 'routine', 'urgent') |
| `zone_id` | uuid | FK → service_zones(id) ON DELETE SET NULL |
| `postal_code` | text | Added in 026. Separate from `service_address`. |
| `street_name` | text | Added in 026. |
| `status` | text | CHECK IN ('confirmed', 'cancelled', 'completed'), DEFAULT 'confirmed' |
| `booked_via` | text | CHECK IN ('ai_call', 'manual'), DEFAULT 'ai_call' |
| `external_event_id` | text | Calendar event ID (Google or Outlook). Renamed from `google_event_id` in 007 |
| `external_event_provider` | text | CHECK IN ('google', 'outlook'). Added in 007 |
| `completed_at` | timestamptz | Added in 046. Set when owner marks the appointment complete from the dashboard. Nullable. |
| `notes` | text | |
| `created_at` | timestamptz | |

**Key constraint**: `UNIQUE (tenant_id, start_time)` — secondary anti-double-booking defense.

### `service_zones` (from 003_scheduling.sql + 074_service_area_gate.sql)

**Repurposed in M16 P1 (2026-06-20) as a single flat Service Area coverage list** — no longer a set of differentiated geographic zones. The agent matches coverage as the UNION of `postal_codes` + `cities` across all of a tenant's rows; `PUT /api/service-area` keeps exactly ONE canonical row per tenant.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid | FK → tenants(id) ON DELETE CASCADE |
| `name` | text | |
| `postal_codes` | text[] | DEFAULT '{}'. ZIP/postal half of the coverage list |
| `cities` | text[] | **Added in 074 (M16 P1).** NOT NULL DEFAULT '{}'. Town/city half of the coverage list |
| `created_at` | timestamptz | |

The agent's slot-cache prefetch SELECT in `livekit_agent/src/agent.py` (feeding `deps["_slot_cache"]["service_zones"]`) was widened from `select("id, name, postal_codes")` to `select("id, name, postal_codes, cities")` so the gate sees both halves of the coverage list — see voice-call-architecture skill.

### `zone_travel_buffers` (from 003_scheduling.sql)

**Dormant as of M16 P1 (2026-06-20).** The pairwise travel-buffer matrix is retired — nothing populates it after the multi-zone → single Service Area collapse — but the table still exists. Its differentiated-buffer code path (`slot_calculator.py::_get_travel_buffer_mins`) stays dormant, so the flat-30 fallback is unchanged. Slated to be dropped in M16 P2.

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

### `calendar_blocks` (from 046_calendar_blocks_and_completed_at.sql + 047_calendar_blocks_external_event.sql + 048_calendar_blocks_group_id.sql)

Personal/unavailable time blocks (lunch, vacation, errands). Respected by the slot calculator in the same way as `appointments` — the AI will not offer an overlapping slot.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid | FK → tenants(id) ON DELETE CASCADE |
| `title` | text NOT NULL | User-entered label (e.g. "Lunch", "Doctor appointment") |
| `start_time` | timestamptz NOT NULL | |
| `end_time` | timestamptz NOT NULL | |
| `is_all_day` | boolean NOT NULL | DEFAULT false. Affects external sync format (date-only payload in Google/Outlook). |
| `note` | text | Optional free-text note |
| `external_event_id` | text | Added in 047. Google/Outlook event ID when the block is synced. Cleared by orphan-cleanup when the external event is deleted. |
| `group_id` | uuid | Added in 048. Links multi-day blocks for bulk delete. Partial index `idx_calendar_blocks_group ON calendar_blocks(group_id) WHERE group_id IS NOT NULL`. |
| `created_at` | timestamptz | DEFAULT now() |

**Index**: `idx_calendar_blocks_tenant_time ON calendar_blocks(tenant_id, start_time, end_time)` — hot path for slot calculation and calendar-view date-range queries.

**RLS**: 4 tenant policies (SELECT/INSERT/UPDATE/DELETE), same shape as other tenant-child tables.

**Sync behavior**: `POST /api/calendar-blocks` synchronously pushes to the primary connected calendar (Google or Outlook). `PATCH` and `DELETE` use `after()` for async external updates. `DELETE?group=true` bulk-deletes every block sharing the `group_id`.

**Tenant columns** (relevant to scheduling, stored on `tenants` table):
- `tenant_timezone` — IANA timezone string, DEFAULT 'America/Chicago'
- `slot_duration_mins` — int, DEFAULT 60
- `travel_buffer_mins` — int NOT NULL DEFAULT 30, **added in 075 (M16 P2)**. Owner-adjustable minimum drive time the slot calculator leaves between back-to-back jobs; threaded into `calculateAvailableSlots({ travelBufferMins })` like `slot_duration_mins`, enforced forward + backward. 0 disables buffering; default 30 = pre-P2 behavior. Owner-set on the Working Hours page (`PUT /api/working-hours`).
- `working_hours` — JSONB, day-keyed config with `{ enabled, open, close, lunchStart, lunchEnd }` per day
- `out_of_area_action` — text, **added in 074 (M16 P1)**. Owner setting: one of 'callback' (DEFAULT) | 'decline_referral' | 'trip_fee'. Consumed by the Python agent's `validate_address` Service-Area gate (see voice-call-architecture); also returned by `GET /api/service-area`.
- `out_of_area_referral_note` — text, **added in 074 (M16 P1)**. Free-text note paired with `out_of_area_action`; surfaced/returned alongside it.

---

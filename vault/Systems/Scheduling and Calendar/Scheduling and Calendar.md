---
type: system-index
system: Scheduling and Calendar
status: current
repo: homeservice_agent + livekit-agent
description: Complete architectural reference for the scheduling and calendar system — slot calculation, atomic booking, Google Calendar OAuth/sync/webhooks, Outlook Calendar OAuth/sync/webhooks, travel buffers, geographic zones, cron jobs, and appointm…
source_skills: [scheduling-calendar-system]
migrated: 2026-11-23
verified:
tags: [voco/system/scheduling-and-calendar]
---

# Scheduling and Calendar

Up: [[Home]] · [[Systems]]

> **Start with:** [[Scheduling - Booking to calendar on agent calls (verified path)]] for how a call ends up in a calendar (checked against code 2026-11-23). The other notes were migrated from the old skill and in places describe the earlier Node flow.

> **How to use:** read this index, then open only the notes the task needs. After changing code in this system, update the matching note and set its `verified:` date.

**Status (2026-11-23):** current system, not re-verified note by note. Live finding: the Google Calendar connections are stale since June 2026, see [[Now]]. The agent-side push is summarised in [[Demo Studio]].

## Notes (from `scheduling-calendar-system`)

| Note | Lines | Status | What is in it |
|---|---|---|---|
| [[Scheduling - Architecture Overview]] | 44 | current | The scheduling system spans slot generation, atomic booking, and bidirectional calendar sync for both Google and Outlook. |
| [[Scheduling - File Map]] | 27 | current | Which files implement Scheduling and Calendar and what each one is responsible for. |
| [[Scheduling - Slot Calculator]] | 72 | current | Slot Calculator. Covers: Signature; Algorithm; All-Day Block Expansion (`expandAllDayInterval`); Travel Buffer Rules |
| [[Scheduling - Atomic Booking]] | 80 | current | Atomic Booking. Covers: `atomicBookSlot` Signature; `book_appointment_atomic` RPC Flow (created in `003_scheduling.sql`; **current definition: migration 062, 17 args**); Return Shapes; Secondary Defense |
| [[Scheduling - Google Calendar Integration]] | 48 | current | Google Calendar Integration. Covers: Exported Functions; OAuth Routes |
| [[Scheduling - Outlook Calendar Integration]] | 68 | current | Outlook Calendar Integration. Covers: Key Patterns; Exported Functions; OAuth Routes |
| [[Scheduling - Webhook Handlers]] | 31 | current | Webhook Handlers. Covers: Google Push Handler; Outlook Change Handler |
| [[Scheduling - Cron Jobs]] | 48 | current | The app declares 11 Vercel Cron endpoints in vercel.json. Only renew-calendar-channels is strictly 'scheduling/calendar' — the others touch adjacent systems … Covers: `renew-calendar-channels` (scheduling/calendar specific); Recurring appointments + maintenance contracts — NOT implemented |
| [[Scheduling - API Routes]] | 64 | current | HTTP routes belonging to Scheduling and Calendar: methods, parameters and behaviour. Covers: `GET /api/appointments`; Calendar Blocks API; Calendar Sync Patterns; `GET /api/appointments/[id]`; `PATCH /api/appointments/[id]`; `GET /api/working-hours`; `PUT /api/working-hours`; `GET /api/service-area`; `PUT /api/service-area` |
| [[Scheduling - Database Tables]] | 128 | current | Key constraint: UNIQUE (tenant_id, start_time) — secondary anti-double-booking defense. Covers: `appointments` (from 003_scheduling.sql + 007_outlook_calendar.sql + 026_address_fields.sql + 046_calendar_blocks_and_completed_at.sql); `service_zones` (from 003_scheduling.sql + 074_service_area_gate.sql); `zone_travel_buffers` (from 003_scheduling.sql); `calendar_credentials` (from 003_scheduling.sql + 007_outlook_calendar.sql); `calendar_events` (from 003_scheduling.sql); `calendar_blocks` (from 046_calendar_blocks_and_completed_at.sql + 047_calendar_blocks_external_event.sql + 048_calendar_blocks_group_id.sql) |
| [[Scheduling - Environment Variables]] | 15 | current | Environment variables Scheduling and Calendar reads, and where they are set. |
| [[Scheduling - Key Design Decisions]] | 30 | current | Local DB mirror is source of truth — calendar_events table mirrors Google/Outlook events locally. Slot calculator reads from calendar_events, never live-quer… |
| [[Scheduling - Scope and change history]] | 30 | record | The former scheduling-calendar-system skill's scope statement, preamble and running 'last updated' change history. Read only when you need to know when or why something changed. |

## Short sections

### Cross-Domain References

- For slot calculation during active calls, see **voice-call-architecture skill** (sections on agent entry, `check_availability` tool, `book_appointment` tool)
- For the **Service-Area gate's runtime behavior** (M16 P1 Capability A) — the Python voice agent's `validate_address` tool checks a caller's address against the Service Area coverage union (`postal_codes` + `cities`) and branches on `out_of_area_action` — see the **voice-call-architecture skill**. The gate lives entirely in the agent; Capability A does not change slot math.
- For Supabase service role vs. user client patterns, RLS policies, and multi-tenant data isolation, see **auth-database-multitenancy skill**
- For dashboard calendar UI components (calendar page, appointment cards, conflict banner), see the dashboard/CRM skill

---


### Important: Keeping This Document Updated

When making changes to any file listed in the File Map above, update the relevant sections of this skill document to reflect the new behavior. This ensures future conversations always have an accurate reference.

Key areas to keep current:
- `calculateAvailableSlots` signature — if new parameters are added (e.g., appointment duration variations)
- `atomicBookSlot` signature — if new fields are passed through to the RPC
- `book_appointment_atomic` RPC — if the advisory lock formula or overlap logic changes
- `pushBookingToCalendar` — if routing logic between Google and Outlook changes
- DB table columns — if migrations add columns (especially to `appointments` or `calendar_credentials`)
- Environment variables — if new provider credentials are added

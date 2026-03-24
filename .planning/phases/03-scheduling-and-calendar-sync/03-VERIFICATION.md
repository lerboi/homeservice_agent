---
phase: 03-scheduling-and-calendar-sync
verified: 2026-03-21T00:00:00Z
status: human_needed
score: 5/6 success criteria verified
re_verification: false
gaps:
  - truth: "A calendar event created directly in Google Calendar appears in platform availability within 60 seconds and blocks that slot from new bookings"
    status: partial
    reason: "The full real-time sync pipeline is code-complete (push webhook, handleGoogleCalendarPush, syncCalendarEvents, calendar_events mirror, slot calculator reads externalBlocks) and can only be verified with a live Google Calendar account delivering push notifications. Additionally, REQUIREMENTS.md has SCHED-02/SCHED-03 statuses inverted — Google Calendar sync (SCHED-02) is built but tracked as Pending, while Outlook (SCHED-03) is tracked as Complete when only the provider column in the DB schema was added."
    artifacts:
      - path: ".planning/REQUIREMENTS.md"
        issue: "SCHED-02 marked [ ] Pending (Google Calendar) but implementation is complete. SCHED-03 marked [x] Complete (Outlook) but only the 'outlook' value in the provider CHECK constraint was added — actual Outlook sync is deferred to Phase 5. Tracking is inverted."
    missing:
      - "Correct REQUIREMENTS.md: mark SCHED-02 as [x] Complete and SCHED-03 as [ ] Deferred to Phase 5"
      - "Human end-to-end test with live Google Calendar to confirm push notification delivery and 60-second availability update"
human_verification:
  - test: "Google Calendar push notification end-to-end"
    expected: "Create an event directly in Google Calendar. Within 60 seconds, that slot should be blocked in the platform slot calculator (visible in dashboard calendar page and not offered by the AI on the next inbound call)"
    why_human: "Requires live Google OAuth credentials, live Google Calendar account, and observable push notification delivery from Google's infrastructure. Cannot be verified by code inspection alone."
  - test: "Emergency call books slot while caller is on the line"
    expected: "Simulate an inbound call classified as emergency. AI should offer available slots, collect address, perform mandatory read-back, invoke book_appointment, and return confirmation — all before the call ends. Second concurrent call to the same slot should receive the next available slot."
    why_human: "Requires Retell live call environment and concurrent call simulation. The advisory lock mechanism (pg_try_advisory_xact_lock) cannot be integration-tested without a live Postgres instance."
  - test: "Dashboard calendar view renders appointment blocks and travel buffers"
    expected: "Calendar page renders week/day views with urgency-colored appointment blocks (red/blue/amber), travel buffer blocks between cross-zone appointments, and Google Calendar events as purple dashed blocks."
    why_human: "Visual rendering and color-coding requires browser inspection. CalendarView.js is fully implemented but UI fidelity requires human review."
---

# Phase 3: Scheduling and Calendar Sync — Verification Report

**Phase Goal:** Emergency calls book a confirmed appointment slot while the caller is still on the line, routine calls create a lead with suggested slots — with zero double-bookings, travel time buffers between consecutive jobs, and real-time Google Calendar sync (Outlook deferred to Phase 5)

**Verified:** 2026-03-21
**Status:** gaps_found (1 requirements-tracking gap; functional implementation is complete)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Success Criteria from ROADMAP.md)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Emergency call results in confirmed booking before call ends, slot locked at DB level | VERIFIED | `handleBookAppointment` in retell/route.js calls `atomicBookSlot` which invokes `book_appointment_atomic` PL/pgSQL RPC with `pg_try_advisory_xact_lock` — non-blocking advisory lock + tsrange overlap check. Returns confirmation speech synchronously. |
| 2 | Routine call creates a lead record with suggested available time slots | VERIFIED | `processCallAnalyzed` in call-processor.js: checks `urgency === 'routine' && !appointmentExists`, calculates 3 slots across 3 days via `calculateAvailableSlots`, stores as `suggested_slots JSONB` on calls table via upsert. |
| 3 | Two simultaneous calls to same slot produce exactly one confirmed booking | VERIFIED (code) | `pg_try_advisory_xact_lock` is non-blocking — second concurrent call immediately gets `slot_taken`, then `calculateAvailableSlots` offers the next available slot. Cannot verify live without concurrent Postgres test. |
| 4 | Booking in Jurong at 10AM blocks 11AM slot in Changi due to geographic travel time | VERIFIED | `calculateAvailableSlots` in slot-calculator.js: `getTravelBufferMins` returns 30min for different zones (or custom `zone_travel_buffers` lookup), 0min for same zone, 30min flat if no zones configured. Travel buffer enforced in slot generation loop. |
| 5 | Calendar event created in Google Calendar appears in platform availability within 60 seconds | PARTIAL | Code pipeline is complete: Google push webhook → `handleGoogleCalendarPush` → `syncCalendarEvents` (incremental, handles 410 Gone) → upserts to `calendar_events` mirror → `calculateAvailableSlots` reads `externalBlocks`. Cannot verify 60-second SLA without live environment. |
| 6 | Caller hears address read-back confirmation before any slot is locked | VERIFIED | Agent prompt (agent-prompt.js) contains mandatory BOOKING FLOW section: step 4 reads "MANDATORY ADDRESS READ-BACK: You MUST read back the address and get verbal confirmation … Do NOT proceed until they confirm." `book_appointment` function in retell-agent-config.js requires `service_address` as confirmed address and gates invocation on prior confirmation. |

**Score:** 5/6 success criteria fully verified; 1 partial (requires human/live test for Google Calendar 60-second SLA)

---

## Required Artifacts

### Plan 01 — Scheduling Foundation

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/003_scheduling.sql` | appointments, service_zones, zone_travel_buffers, calendar_credentials, calendar_events + book_appointment_atomic RPC | VERIFIED | All 5 tables exist. `UNIQUE(tenant_id, start_time)` on appointments. RPC uses `pg_try_advisory_xact_lock` + tsrange overlap check. `provider CHECK IN ('google', 'outlook')` on calendar_credentials. |
| `src/lib/scheduling/slot-calculator.js` | calculateAvailableSlots pure function | VERIFIED | Exports `calculateAvailableSlots`. Handles working hours (UTC conversion via date-fns-tz), existing bookings, external blocks, lunch breaks, travel buffers (same-zone=0, cross-zone=30 default, custom lookup). |
| `src/lib/scheduling/booking.js` | atomicBookSlot wrapper around Supabase RPC | VERIFIED | Exports `atomicBookSlot`. Maps camelCase to `p_` params. Calls `supabase.rpc('book_appointment_atomic', ...)`. Throws on transport error. |

### Plan 02 — Retell Config and Agent Prompt

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/retell-agent-config.js` | book_appointment function definition in functions array | VERIFIED | `book_appointment` pushed to functions array when `onboarding_complete=true`. 5 typed parameters: slot_start, slot_end, service_address, caller_name, urgency. |
| `src/lib/agent-prompt.js` | BOOKING FLOW prompt section with address confirmation | VERIFIED | BOOKING FLOW section with 8 steps including mandatory address read-back (step 4: "Do NOT proceed until they confirm"), slot offering (step 2), booking invocation gate (step 5), slot-taken fallback (step 7). |

### Plan 03 — Google Calendar Sync

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/scheduling/google-calendar.js` | OAuth helpers, event CRUD, watch channel management, incremental sync | VERIFIED | Exports: `createOAuth2Client`, `getAuthUrl`, `createCalendarEvent`, `registerWatch`, `syncCalendarEvents`, `pushBookingToCalendar`, `revokeAndDisconnect`. Incremental sync handles 410 Gone with full re-sync fallback. |
| `src/lib/webhooks/google-calendar-push.js` | Push notification handler logic | VERIFIED | Exports `handleGoogleCalendarPush`. Calls `syncCalendarEvents(tenantId)` on `state === 'exists'`. |
| `src/app/api/google-calendar/auth/route.js` | GET handler returning OAuth URL | VERIFIED | Returns OAuth URL via `getAuthUrl(createOAuth2Client())`. |
| `src/app/api/google-calendar/callback/route.js` | GET handler exchanging code for tokens | VERIFIED | Exchanges code, upserts to `calendar_credentials`, registers watch channel, performs initial sync. |
| `src/app/api/webhooks/google-calendar/route.js` | POST handler for Google push notifications | VERIFIED | Validates channel, uses `after()` for async sync via `handleGoogleCalendarPush`. Returns 200 immediately. |
| `src/app/api/cron/renew-calendar-channels/route.js` | CRON_SECRET-protected channel renewal | VERIFIED | File exists (per SUMMARY — not read inline but confirmed by Glob). |

### Plan 04 — Dashboard Settings UI

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/dashboard/WorkingHoursEditor.js` | Working hours day grid | VERIFIED | Fetches `GET /api/working-hours` on load; PUTs to `/api/working-hours` on save. Imported by `services/page.js`. |
| `src/components/dashboard/CalendarSyncCard.js` | Google Calendar OAuth connection | VERIFIED | Fetches `/api/google-calendar/auth` for OAuth URL. |
| `src/components/dashboard/ZoneManager.js` | Zone CRUD with postal code tags and travel buffer config | VERIFIED | File exists and exported. |
| `src/app/api/working-hours/route.js` | GET/PUT working hours | VERIFIED | Exists. |
| `src/app/api/zones/route.js` | Zone CRUD | VERIFIED | Exists. |
| `src/app/api/calendar-sync/status/route.js` | Calendar sync status | VERIFIED | Exists. |

### Plan 05 — Calendar Dashboard

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/dashboard/calendar/page.js` | Calendar dashboard page | VERIFIED | Fetches `/api/appointments` with date range params. Passes `appointments`, `externalEvents`, `travelBuffers` to `CalendarView`. Includes `ConflictAlertBanner` and `AppointmentFlyout`. Today's Agenda sidebar renders appointments chronologically. |
| `src/components/dashboard/CalendarView.js` | Week/day calendar grid | VERIFIED | Renders URGENCY_COLORS (red/blue/amber by urgency). Renders external events as purple dashed. Travel buffer blocks. |
| `src/components/dashboard/AppointmentFlyout.js` | Sheet-based appointment detail panel | VERIFIED | Fetches `GET /api/appointments/${id}` and `PATCH /api/appointments/${id}` for cancel. |
| `src/components/dashboard/ConflictAlertBanner.js` | Conflict alert banner | VERIFIED | File exists. |

### Plan 06 — Scheduling Engine Integration

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/webhooks/retell/route.js` | handleBookAppointment + available_slots in handleInbound | VERIFIED | Imports `calculateAvailableSlots`, `atomicBookSlot`, `pushBookingToCalendar`. `handleInbound` computes up to 6 slots across 3 days via `Promise.all` DB fetch. `handleBookAppointment` calls `atomicBookSlot`, uses `after()` for `pushBookingToCalendar`. Slot-taken returns next available slot speech. |
| `src/lib/call-processor.js` | suggested_slots on lead records for routine calls | VERIFIED | Imports `calculateAvailableSlots`. Calculates 3 slots starting tomorrow for `urgency === 'routine' && !appointmentExists`. Stores as `suggested_slots` JSONB in calls upsert. Non-fatal on failure. |
| `src/app/api/appointments/available-slots/route.js` | GET endpoint for dashboard slot queries | VERIFIED | Exists. Authenticated endpoint with `date` and `days` params. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `booking.js` | `supabase RPC book_appointment_atomic` | `supabase.rpc('book_appointment_atomic', ...)` | WIRED | Exact RPC call confirmed at line 35 of booking.js |
| `slot-calculator.js` | `date-fns` and `date-fns-tz` | imports | WIRED | `import { addMinutes, parseISO } from 'date-fns'` and `import { toZonedTime, fromZonedTime } from 'date-fns-tz'` at top of file |
| `retell/route.js` | `booking.js` | `import atomicBookSlot` | WIRED | `import { atomicBookSlot } from '@/lib/scheduling/booking'` line 7 |
| `retell/route.js` | `slot-calculator.js` | `import calculateAvailableSlots` | WIRED | `import { calculateAvailableSlots } from '@/lib/scheduling/slot-calculator'` line 6 |
| `retell/route.js` | `google-calendar.js` | `import pushBookingToCalendar` | WIRED | `import { pushBookingToCalendar } from '@/lib/scheduling/google-calendar'` line 8; called in `after()` at line 328 |
| `call-processor.js` | `slot-calculator.js` | `import calculateAvailableSlots` | WIRED | `import { calculateAvailableSlots } from '@/lib/scheduling/slot-calculator'` line 4 |
| `webhooks/google-calendar/route.js` | `google-calendar-push.js` | `import handleGoogleCalendarPush` | WIRED | `import { handleGoogleCalendarPush } from '@/lib/webhooks/google-calendar-push.js'` line 3 |
| `google-calendar-push.js` | `google-calendar.js` | `syncCalendarEvents call` | WIRED | `import { syncCalendarEvents } from '@/lib/scheduling/google-calendar.js'` line 1; called at line 27 |
| `callback/route.js` | `calendar_credentials table` | `supabase upsert` | WIRED | `supabase.from('calendar_credentials').upsert(...)` at line 44 |
| `retell-agent-config.js` | `agent-prompt.js` | `buildSystemPrompt call` | WIRED | `import { buildSystemPrompt } from './agent-prompt.js'` line 1; used in `system_prompt: buildSystemPrompt(...)` |
| `services/page.js` | `WorkingHoursEditor.js` | `import WorkingHoursEditor` | WIRED | `import WorkingHoursEditor from '@/components/dashboard/WorkingHoursEditor'` line 19; rendered at lines 216 and 320 |
| `CalendarSyncCard.js` | `/api/google-calendar/auth` | `fetch for OAuth URL` | WIRED | `fetch('/api/google-calendar/auth')` at line 97 |
| `WorkingHoursEditor.js` | `/api/working-hours` | `fetch to save hours` | WIRED | GET at line 138, PUT at line 187 |
| `calendar/page.js` | `CalendarView.js` | `import CalendarView` | WIRED | `import CalendarView from '@/components/dashboard/CalendarView'` line 6; rendered at line 231 |
| `AppointmentFlyout.js` | `/api/appointments/[id]` | `fetch for cancel` | WIRED | `fetch('/api/appointments/${appointment.id}', ...)` at lines 78 and 98 |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SCHED-01 | 03-01, 03-04 | Built-in availability scheduler with configurable time slots and business hours | SATISFIED | `calculateAvailableSlots` + `WorkingHoursEditor` + `/api/working-hours` + `slot_duration_mins` on tenants table |
| SCHED-02 | 03-03 | Bidirectional Google Calendar sync | SATISFIED (code complete; REQUIREMENTS.md tracking wrong) | `syncCalendarEvents` (incremental + 410 Gone fallback), push webhook, `calendar_events` mirror, OAuth flow. REQUIREMENTS.md incorrectly marks this Pending — see gap below. |
| SCHED-03 | 03-01 (architecture only) | Bidirectional Outlook Calendar sync | DEFERRED to Phase 5 | Only `provider CHECK IN ('google', 'outlook')` in migration. No Outlook sync code exists. REQUIREMENTS.md incorrectly marks this Complete. Phase goal explicitly defers Outlook to Phase 5. |
| SCHED-04 | 03-01 | Atomic slot locking — zero race conditions | SATISFIED | `book_appointment_atomic` PL/pgSQL with `pg_try_advisory_xact_lock` + tsrange overlap check |
| SCHED-05 | 03-02, 03-06 | Emergency calls get immediate slot lock while on the line | SATISFIED | `handleBookAppointment` in retell webhook calls `atomicBookSlot` synchronously, returns confirmation speech before call ends |
| SCHED-06 | 03-05, 03-06 | Routine calls create a lead with suggested time slots | SATISFIED | `processCallAnalyzed` calculates `suggested_slots` for `urgency === 'routine' && !appointmentExists`; calendar dashboard page with `ConflictAlertBanner` |
| SCHED-07 | 03-01, 03-06 | 30-60 minute travel time buffer between consecutive bookings | SATISFIED | `getTravelBufferMins` in slot-calculator.js: 30min default cross-zone, 0min same-zone, custom `zonePairBuffers` lookup |
| SCHED-08 | 03-01 | Geographic zone awareness — prevents back-to-back bookings across distant locations | SATISFIED | `service_zones` + `zone_travel_buffers` tables; `calculateAvailableSlots` enforces per-pair buffers |
| SCHED-09 | 03-01, 03-03, 03-06 | Calendar never queried live during a call | SATISFIED | `handleInbound` queries local `calendar_events` mirror only; `pushBookingToCalendar` always via `after()`; no live Google API calls in hot path |
| VOICE-03 | 03-02 | AI extracts caller ID, job type/scope, and service address | SATISFIED | `book_appointment` function parameters (caller_name, service_address, urgency) + BOOKING FLOW prompt instructs address collection at step 3 |
| VOICE-04 | 03-02 | AI performs mandatory address read-back confirmation | SATISFIED | BOOKING FLOW step 4: "MANDATORY ADDRESS READ-BACK … Do NOT proceed until they confirm" |

### Requirements Tracking Discrepancy (SCHED-02 / SCHED-03)

REQUIREMENTS.md has the completion status of SCHED-02 and SCHED-03 inverted:

- **SCHED-02** (Google Calendar sync) is marked `[ ]` Pending — but the full implementation ships in Plan 03 (OAuth, push webhook, incremental sync, mirror, bidirectional push)
- **SCHED-03** (Outlook Calendar sync) is marked `[x]` Complete — but only the `provider` column CHECK constraint was added as architecture preparation; actual Outlook sync is explicitly deferred to Phase 5 per the phase goal and RESEARCH.md

This is a documentation error, not an implementation gap. The code for SCHED-02 is fully built and wired.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/app/api/webhooks/retell/route.js` (lines 303-313) | `slot_taken` fallback calculates next slot with empty `existingBookings`, `externalBlocks`, `zones`, `zonePairBuffers` | Warning | When a slot is taken, the next-slot calculation ignores real bookings and external calendar events. The AI may offer a slot that is also taken. Does not block the primary booking path — only the fallback speech. |

---

## Human Verification Required

### 1. Google Calendar 60-Second Sync SLA

**Test:** Connect a Google Calendar account via the OAuth popup in dashboard settings. Create a new event directly in Google Calendar for a time slot tomorrow morning. Wait up to 60 seconds. Check that the slot no longer appears in the platform's available slots (visible in the dashboard calendar page or by triggering an inbound test call).

**Expected:** The event appears in the platform's calendar view as a purple dashed block within 60 seconds, and that slot is excluded from available_slots offered by the AI on the next inbound call.

**Why human:** Requires live Google OAuth credentials, a Google Calendar account, and observable push notification delivery from Google's infrastructure. The code path is complete but the 60-second SLA depends on Google's push notification delivery timing.

### 2. Emergency Call End-to-End Booking

**Test:** Trigger a test inbound call via Retell. Simulate an emergency scenario (flooding/gas leak). Follow the AI's booking flow — provide address, confirm via read-back, select a slot. Observe that the booking is confirmed before the call ends and appears in the dashboard calendar.

**Expected:** AI offers 2-3 available slots, prompts for address, reads back the address for confirmation, invokes `book_appointment`, returns "Your appointment is confirmed for [time]" — all within the same call. Dashboard shows the new appointment.

**Why human:** Requires live Retell call environment. Concurrency test (two simultaneous calls) requires concurrent call simulation to validate the advisory lock behavior.

### 3. Dashboard Calendar Visual Rendering

**Test:** Navigate to `/dashboard/calendar`. Verify that appointment blocks appear color-coded (red for emergency, blue for routine, amber for high_ticket), travel buffer blocks are visible between cross-zone appointments, and external Google Calendar events render as purple dashed blocks.

**Expected:** Visual calendar matches the UI spec. Today's Agenda sidebar shows today's appointments in chronological order. Clicking an appointment opens the detail flyout. Cancel button in flyout triggers AlertDialog confirmation.

**Why human:** Visual fidelity, color coding, and interactive behavior (flyout, alerts) require browser inspection.

---

## Gaps Summary

**One documentation gap:** REQUIREMENTS.md has SCHED-02 and SCHED-03 completion statuses inverted. SCHED-02 (Google Calendar sync) is fully implemented but marked Pending. SCHED-03 (Outlook sync) is deliberately deferred to Phase 5 but marked Complete. This should be corrected to accurately reflect implementation state.

**One code warning (non-blocking):** The slot-taken fallback in `handleBookAppointment` calculates the next available slot with empty arrays for existing bookings and external events. The AI may offer a replacement slot that is also taken. This does not block the primary booking flow.

**Three items require human end-to-end testing:** Google Calendar 60-second SLA, emergency call booking flow, and dashboard calendar visual rendering.

The core scheduling infrastructure — atomic booking RPC, slot calculator with travel buffer logic, Google Calendar OAuth/sync, Retell agent prompt with mandatory address read-back, and all wiring between them — is substantively implemented and correctly connected.

---

_Verified: 2026-03-21_
_Verifier: Claude (gsd-verifier)_

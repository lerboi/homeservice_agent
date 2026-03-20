---
phase: 03-scheduling-and-calendar-sync
plan: "06"
subsystem: scheduling
tags: [scheduling, retell-webhook, call-processor, booking, google-calendar, slots]
dependency_graph:
  requires:
    - 03-01  # atomicBookSlot, calculateAvailableSlots, pushBookingToCalendar
    - 03-02  # book_appointment AI function definition
    - 03-03  # pushBookingToCalendar Google Calendar integration
  provides:
    - available_slots passed to AI in every inbound call
    - handleBookAppointment function in webhook handler
    - suggested_slots on routine call records for owner follow-up
    - GET /api/appointments/available-slots dashboard endpoint
  affects:
    - src/app/api/webhooks/retell/route.js
    - src/lib/call-processor.js
tech_stack:
  added: []
  patterns:
    - after() for non-blocking async calendar push in call hot path
    - Local DB mirror as sole source of truth for slot availability (no Google queries in hot path)
    - atomicBookSlot RPC for Postgres advisory lock preventing double-booking
    - suggested_slots JSONB column on calls for lead follow-up workflow
key_files:
  created:
    - src/app/api/appointments/available-slots/route.js
    - tests/scheduling/retell-webhook-scheduling.test.js
  modified:
    - src/app/api/webhooks/retell/route.js
    - src/lib/call-processor.js
    - supabase/migrations/003_scheduling.sql
    - tests/webhooks/retell-inbound.test.js
    - tests/webhooks/call-analyzed.test.js
decisions:
  - handleInbound fetches appointments + calendar_events + zones + buffers in parallel (Promise.all) before slot calculation — single round-trip for all scheduling data
  - formatZonePairBuffers passes the DB array directly — calculateAvailableSlots accepts { zone_a_id, zone_b_id, buffer_mins } objects via .find()
  - targetDate must be passed as "YYYY-MM-DD" string to calculateAvailableSlots — toLocalDateString helper converts Date objects
  - suggested_slots only calculated for routine AND unbooked calls — emergency calls are booked during the call so no follow-up needed
  - suggested_slots failure is non-fatal — wrapped in try/catch, upsert still happens
  - Appointment existence check uses retell_call_id on appointments table (booking.js stores call_id FK)
metrics:
  duration: ~18 min
  completed: 2026-03-20
  tasks: 2
  files: 6
---

# Phase 3 Plan 6: Scheduling Engine Integration Summary

Wired the scheduling engine into the live call flow: available slots are passed to the AI at call start, book_appointment function invocations during calls are handled with atomic locking, confirmed bookings are pushed to Google Calendar asynchronously, and routine unbooked calls get suggested slot arrays for owner follow-up.

## Tasks Completed

### Task 1: Wire handleBookAppointment + available_slots into webhook handler

- Updated `src/app/api/webhooks/retell/route.js` with scheduling imports (calculateAvailableSlots, atomicBookSlot, pushBookingToCalendar, date-fns, date-fns-tz)
- `handleInbound` now runs a parallel Promise.all to fetch appointments, calendar_events, service_zones, and zone_travel_buffers, then calculates up to 6 slots across today + next 2 days
- Slots formatted as numbered list string: "1. Monday March 23rd at 10 AM\n2. ..." — AI reads naturally
- `booking_enabled: 'true'/'false'` and `available_slots` added to every inbound call's dynamic_variables
- `handleFunctionCall` dispatches `book_appointment` function name to `handleBookAppointment`
- `handleBookAppointment` resolves tenant from call record, calls `atomicBookSlot`, on success uses `after()` to trigger `pushBookingToCalendar` asynchronously
- On `slot_taken`: finds next available slot using `calculateAvailableSlots` and returns alternative speech: "That slot was just taken. The next available time is [X]. Would you like me to book that instead?"
- No Google Calendar API calls happen synchronously — calendar push always via `after()`
- Created `src/app/api/appointments/available-slots/route.js` — authenticated dashboard GET endpoint, accepts `date` and `days` query params, returns `{ slots: [{ start, end, label }] }`

### Task 2: Wire suggested_slots into call processor for routine calls

- Updated `src/lib/call-processor.js` to import `calculateAvailableSlots` and add `toLocalDateString` helper
- After triage runs in `processCallAnalyzed`, checks if urgency is 'routine' AND no appointment exists for this call
- For routine/unbooked calls: loads tenant scheduling config, calculates 3 slots starting from tomorrow across up to 3 days
- Stores `suggested_slots` as JSONB on the calls upsert — null if not applicable or if calculation fails
- Error handling: slot calculation failure is non-fatal (console.error), main upsert still proceeds
- Added `ALTER TABLE calls ADD COLUMN suggested_slots jsonb` to `003_scheduling.sql` migration

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed retell-inbound.test.js mock chain missing .neq()/.gte()**
- **Found during:** Task 1 full test suite run
- **Issue:** `makeChainableQuery` helper in the existing test only had `select/eq/single/upsert` — `handleInbound` now calls `.neq()` and `.gte()` on the appointments/events queries
- **Fix:** Added `.neq()` (returns this) and `.gte()` (returns resolved empty array) to `makeChainableQuery`; added mocks for scheduling modules (`slot-calculator`, `booking`, `google-calendar`) so they don't error when imported
- **Files modified:** `tests/webhooks/retell-inbound.test.js`
- **Commit:** 8673344

**2. [Rule 1 - Bug] Fixed call-analyzed.test.js mock returning `{}` for unknown tables**
- **Found during:** Task 2 full test suite run
- **Issue:** `mockSupabase.from` returned `{}` for any table except `tenants` and `calls`. New code queries `appointments`, `calendar_events`, `service_zones`, `zone_travel_buffers` — these returned `{}` which has no `.select()` method
- **Fix:** Replaced bare `{}` fallback with a `makeGenericQuery()` helper returning a full chainable mock; updated `mockCallsQuery` to include `.select/.eq/.neq/.gte/.maybeSingle`; added `@/lib/scheduling/slot-calculator` mock
- **Files modified:** `tests/webhooks/call-analyzed.test.js`
- **Commit:** 1dcc6ae

## Test Results

- 153 tests passing (15 test suites)
- 8 new tests for retell webhook scheduling integration (`tests/scheduling/retell-webhook-scheduling.test.js`)
- All existing tests continue to pass

## Self-Check

- [x] `src/app/api/webhooks/retell/route.js` — contains `import { calculateAvailableSlots }`, `atomicBookSlot`, `pushBookingToCalendar`, `available_slots`, `booking_enabled`, `handleBookAppointment`, `book_appointment`, `slot was just taken`, `appointment is confirmed`, `after(`
- [x] `src/app/api/appointments/available-slots/route.js` — contains `export async function GET`
- [x] `src/lib/call-processor.js` — contains `calculateAvailableSlots`, `suggested_slots`
- [x] `supabase/migrations/003_scheduling.sql` — contains `suggested_slots`
- [x] All scheduling tests pass
- [x] All existing tests pass (153 total)
- [x] No synchronous Google Calendar API calls in webhook hot path

## Self-Check: PASSED

---
type: system
system: Scheduling and Calendar
status: current
description: "The path a voice-agent booking takes today, checked against the Python code: book_appointment → book_appointment_atomic RPC → background calendar push to Google or Outlook. Start here for any question about how a call ends up in a calendar."
verified: 2026-11-23
tags: [voco/system/scheduling-and-calendar]
---

# Booking to calendar on agent calls (verified path)

Part of [[Scheduling and Calendar]]. Also linked from [[Voice Agent]] and [[Demo Studio]].

The voice agent is Python. Other notes in this folder were migrated from the old skill and in places still describe the earlier Node flow (`atomicBookSlot()` and `pushBookingToCalendar()` in `src/lib/scheduling/*.js`). Those JavaScript functions still exist and serve the dashboard and API routes, but a phone or browser call goes through the path below.

## Steps (all paths under `livekit-agent/`)

1. **The LLM calls `book_appointment`** with a `slot_token` from an earlier availability tool, plus name and address parts. `src/tools/book_appointment.py:258` (wrapper with the latency filler), implementation at `:269`.
2. **Address validation runs before the slot lock** (`:291` onward). Booking never blocks on Google Maps; every verdict proceeds.
3. **Atomic booking.** `atomic_book_slot()` (`src/lib/booking.py:6`, called at `book_appointment.py:507`) invokes the Postgres RPC `book_appointment_atomic`. If the slot was taken the tool returns `STATE:slot_taken` with the next available time and, on real calls, sends one recovery SMS (`:630`).
4. **On success** the tool records `booking_outcome = 'booked'` on the `calls` row (`:759`) and backfills `appointments.call_id` (`:773`).
5. **Test-call gate.** If `deps["is_test_call"]` is true the tool returns here: no calendar push, no SMS (`:789`). See [[Decision - Test calls are sandboxed]].
6. **Calendar push, in the background** so the tool returns quickly (`:799`-`:807`): `push_booking_to_calendar(tenant_id, appointment_id, tenant_timezone)` in `src/lib/calendar_push.py:11`.
7. **Provider choice** (`calendar_push.py:22`-`:52`): the tenant's `calendar_credentials` row with `is_primary = true`; if none, any credential row; if none, nothing happens. `provider == "google"` → `src/lib/google_calendar.py:33`; `"outlook"` → `src/lib/outlook_calendar.py`.
8. **Google insert** (`google_calendar.py`): builds OAuth credentials from the stored tokens plus `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, inserts into `calendar_id` or `primary` with a naive local `dateTime` plus `timeZone` (`:118`), persists refreshed tokens back to `calendar_credentials` (`:144`), and stores the event id on the appointment as `external_event_id` / `external_event_provider` (`:177`).
   - Title: `[URGENT] ` prefix for emergencies, then `<caller> - <business name>` (`:87`-`:91`).
   - Description: service address, urgency, notes (`:106`).
9. **Caller confirmation SMS**, also in the background (`book_appointment.py:811`).
10. **After the call** `src/post_call.py:163` reconciles `booking_outcome` and the appointment's `call_id`; on test calls `:191` cancels the appointment.

## Facts worth knowing

- Every failure in the calendar push is logged and swallowed. A dead token produces no caller-visible error and no alert; the appointment exists in Voco but not in the calendar.
- The OAuth scope is `https://www.googleapis.com/auth/calendar.events` (`src/app/api/google-calendar/auth/route.js:73` in the Next app). Outlook uses `Calendars.ReadWrite offline_access` with the `common` authority (`src/lib/scheduling/outlook-calendar.js:21`, `:103`).
- Which calendar is primary is set when the first calendar is connected (`src/app/api/google-calendar/callback/route.js:48`) and can be changed from the dashboard.
- Live state on 2026-11-23: both Google connections are stale since June. See [[Now]].

## Related
[[Scheduling - Atomic Booking]] (the RPC and its return shapes) · [[Scheduling - Google Calendar Integration]] and [[Scheduling - Outlook Calendar Integration]] (Next-app side: OAuth, sync, webhooks) · [[Voice Agent - Tools - validate_address, book_appointment, capture_lead, check_customer_account]]

---
type: decision
date: 2026-08-25
status: current
description: "Admin test calls run the real agent but suppress every real-world side effect: no calendar event, SMS, CRM row, notification or billing. Why, and where it is enforced."
verified: 2026-11-23
tags: [voco/decision]
---

# Decision - Test calls are sandboxed

## Context
The admin console lets an admin talk to the production agent as any tenant. Without guards a test would text real numbers, alert the owner, create customers, bill usage, and leave calendar events that an automatic cancel cannot remove.

## Decision
Room metadata `test_call: true`, set server-side and not alterable by the browser token, switches the agent into a sandbox. The booking still creates a real appointment row so the slot logic is exercised, and that row is cancelled when the call ends.

## Where it is enforced (verified 2026-11-23)
- `livekit-agent/src/agent.py` (entrypoint, `is_test_call = room_meta.get("test_call") is True`) reads the flag.
- `src/tools/book_appointment.py`: no recovery SMS, no calendar push, no confirmation SMS (search for `is_test_call`).
- `src/tools/capture_lead.py`: no CRM write.
- `src/post_call.py`: auto-cancel appointments; no billing, CRM or owner notifications.

Line numbers are omitted because they moved with the 2026-11-23 work; search for `is_test_call` in each file.

## Consequences
A demo that shows an event landing in a calendar needs an explicit, server-set exception.

## The demo exception (added 2026-11-23, on the `demo-studio` branch)
Room metadata may also carry `demo: { task, destination, keep_booking }`. It is written by the admin-gated `POST /api/admin/demo/session` and read by `livekit-agent/src/lib/demo.py::parse_demo`, which returns nothing unless `test_call` is true. It relaxes two rules and no others:
- `book_appointment` pushes the booking to the one external calendar named in `destination` (never to a different one).
- post-call does not cancel the appointment when `keep_booking` is true. `POST /api/admin/demo/cleanup` removes the event and cancels the appointment instead.

Caller SMS, recovery SMS, usage billing, CRM rows and owner notifications stay off: those gates still test `is_test_call` alone (`tests/test_demo_studio.py` holds this). Full description: [[Demo Studio]].

## The appointments agent (added 2026-11-24, on the `appointments-agent` branch)
The appointments agent can move and cancel as well as book, so the sandbox also limits what a call can reach:
- Which calendar a call may write to is decided once, in `livekit-agent/src/calendars/__init__.py::calendar_target`: production writes to the tenant's primary calendar, a demo call only to the calendar its metadata names, any other test call to none.
- `src/agents/appointments/store.py::upcoming` returns, on a test call, only appointments made by test calls, and leaves out any whose calendar event this call could not update. On a production call it returns only appointments booked from the caller's own number.

Held by `tests/test_appointments_agent.py`. Details: [[Voice Agent - Appointments agent (verified)]].

## Sources
[[Demo Studio]], [[Voice Agent - Test Calls and Admin Web Test Console (2026-08-25)]].

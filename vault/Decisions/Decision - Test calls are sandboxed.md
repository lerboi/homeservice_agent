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
- `livekit-agent/src/agent.py:717` reads the flag.
- `src/tools/book_appointment.py:630`, `:789`: no recovery SMS, no calendar push, no confirmation SMS.
- `src/tools/capture_lead.py:183`: no CRM write.
- `src/post_call.py:191`, `:235`, `:331`, `:390`: auto-cancel appointments; no billing, CRM or owner notifications.

## Consequences
A demo that shows an event landing in a calendar needs an explicit, server-set exception. [[Plan 3 - Demo Studio]] adds a `demo` metadata block that relaxes only the calendar push and the auto-cancel.

## Sources
[[Demo Studio]], [[Voice Agent - Test Calls and Admin Web Test Console (2026-08-25)]].

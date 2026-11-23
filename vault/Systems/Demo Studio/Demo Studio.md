---
type: system-index
system: Demo Studio
status: current
repo: homeservice_agent (src/app/admin/test-agent, src/app/api/admin/test-agent) + livekit-agent
description: "The admin browser test console as it exists today, verified against code, and what the planned Demo Studio changes. Start here for anything about recording a demo."
verified: 2026-11-23
tags: [voco/system/demo-studio]
---

# Demo Studio

Up: [[Home]] · [[Systems]] · Plan: [[Plan 3 - Demo Studio]]

## What exists today (verified 2026-11-23)

| Page | File | What it is |
|---|---|---|
| `/demo` | `src/app/demo/page.js` (21 lines) | Public "Demo Coming Soon" stub. Not linked from anywhere, not in the sitemap. |
| `/admin/test-agent` | `src/app/admin/test-agent/page.js` (924 lines) | Admin-only browser console that talks to the production agent. This is the real recording station. |

### How a browser test call works
1. Admin picks a tenant (must have a phone number), optional simulated caller number, optional voice, and a microphone (device picker with live level meter).
2. `POST /api/admin/test-agent/session` (`verifyAdmin`) creates a LiveKit room `test-web-<tenant>-<ts>` with server-set metadata `{ test_call: true, web_test: true, tenant_id, to_number, from_number?, voice_override? }` and returns a join token.
3. The browser connects and publishes the mic, then calls `POST /api/admin/test-agent/dispatch`, which dispatches the worker `voco-voice-agent` (only `test-web-` rooms are accepted).
4. Live captions arrive on the `lk.transcription` text stream.
5. After hang-up the page polls `GET /api/admin/test-agent/result?room=…` for the analyzed `calls` row and a signed URL to the MP4 (audio) recording in the `call-recordings` bucket.

### Sandbox rules on the agent side
The agent reads `test_call` from room metadata (`livekit-agent/src/agent.py:717`). When true:
- `src/tools/book_appointment.py:789`: the appointment row is created, but the calendar push and caller SMS are skipped.
- `src/post_call.py:191`: every appointment the test call created is cancelled when the call ends.
- `src/post_call.py:235`, `:331`, `:390`: no usage billing, no CRM rows, no owner SMS or email.
- `src/tools/capture_lead.py:183`: no `record_call_outcome` RPC.

So a test call can never put an event in Google or Outlook Calendar. See [[Decision - Test calls are sandboxed]].

### Calendar push (production calls)
`livekit-agent/src/lib/calendar_push.py` picks the tenant's primary `calendar_credentials` row and calls `google_calendar.py` or `outlook_calendar.py`. The Google event is titled `<caller> - <business>` with "Service Address" and "Urgency" in the description. OAuth scope is `calendar.events`. Full step-by-step path with line references: [[Scheduling - Booking to calendar on agent calls (verified path)]].

## State on 2026-11-23
- Console: probably working for a conversation (six analyzed runs on 2026-09-08, worker registered 2026-11-22, no code changes since). Not live-tested on this date.
- Google connection: stale since June, see [[Now]].
- The site-wide `Permissions-Policy` header must keep `microphone=(self)` (`next.config.js:83`) or the browser cannot capture audio: [[2026-09-04 Test call immediately stops - investigation]].

## Related notes
- [[Voice Agent - Test Calls and Admin Web Test Console (2026-08-25)]] (migrated architecture text)
- [[2026-09-05 Test console mic picker]]
- [[Run a browser test call]]

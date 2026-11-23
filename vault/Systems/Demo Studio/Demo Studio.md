---
type: system-index
system: Demo Studio
status: current
repo: homeservice_agent (src/app/admin/demo, src/app/api/admin/demo, src/lib/demo, src/hooks/useAgentCall.js) + livekit-agent
description: "The /admin/demo recording station: a browser call in which the agent books an appointment that lands in Google Calendar. How the page, its three routes, the agent's demo flag and the live event stream fit together, and what is and is not verified."
verified: 2026-11-24
tags: [voco/system/demo-studio]
---

# Demo Studio

Up: [[Home]] · [[Systems]] · How to use it: [[Record a demo]] · Build record: [[2026-11-23 Demo Studio build]]

**State on 2026-11-24:** deployed in both repos. The agent path is verified in production with scripted calls (the event lands in Google Calendar and is read back through the Google API). The page is verified in a browser on a local server up to starting a call. A spoken call through the page on production has not been made yet.

**On branch `appointments-agent` (2026-11-24, not deployed):** a demo call is taken by the dedicated appointments agent, which can also move and cancel a booking an earlier demo call kept. The room metadata gains `agent: "appointments"`, the event stream gains four event types, and the event card shows a moved or cancelled event. See [[Voice Agent - Appointments agent (verified)]] and the section "With the appointments agent" below. The rest of this note describes what is deployed.

## What it is

| Page | File | Purpose |
|---|---|---|
| `/admin/demo` | `src/app/admin/demo/page.js` | Recording station. Three columns: setup (task, "Save to", voice, microphone), the call (voice visual, live captions), live actions ending in the created calendar event. "Presentation" hides setup and the admin header for the take. |
| `/admin/test-agent` | `src/app/admin/test-agent/page.js` | Engineering console, unchanged in behaviour. Any tenant, simulated caller number, fully sandboxed. |
| `/demo` | `src/app/demo/page.js` | Public "coming soon" stub. Replaced in the rebrand ([[Plan 2 - Frontend rebrand to voice integration for any backend]]). |

Both admin pages use one call implementation, `src/hooks/useAgentCall.js`: microphone permission, device picker and level meter, LiveKit room, agent dispatch, captions (`lk.transcription`), live agent events (`voco.events`), who is speaking, and post-call polling.

## How a demo call works

1. The page loads `GET /api/admin/demo/status`: the demo tenant, the task list, each destination with its health, the voice list, and any demo bookings still on the calendar. External calendars get a real token refresh, so a dead connection shows as "Reconnect" before recording, not mid-take.
2. Start call → `POST /api/admin/demo/session`. It re-checks the chosen destination, then creates a LiveKit room `test-web-<tenant>-<ts>` with server-set metadata:
   `{ test_call: true, web_test: true, tenant_id, to_number, demo: { task: "scheduling", destination: "google", keep_booking: true } }`
3. The browser joins, publishes the microphone, and calls the shared `POST /api/admin/test-agent/dispatch` (any `test-web-` room).
4. The agent runs its normal scheduling profile ([[Voice Agent - Scheduling profile and fast LLM path (verified)]]). The `demo` block changes two things only: `book_appointment` pushes the booking to the named calendar, and post-call does not cancel the appointment.
5. The agent publishes events on the `voco.events` text stream; the page turns them into the live-actions timeline and the event card with an "Open in Google Calendar" link.
6. After the call: transcript, audio download, and "Remove demo booking" → `POST /api/admin/demo/cleanup`, which deletes the calendar event, deletes its mirrored `calendar_events` row and cancels the appointment.

The demo tenant is the tenant owned by the signed-in admin (`DEMO_TENANT_ID` overrides). Today that is the tenant renamed "Voco": see [[Now]].

## Next app files

| File | Role |
|---|---|
| `src/lib/demo/scenarios.js` | Task registry. `scheduling` is live; three others are listed as "soon" and cannot be selected. |
| `src/lib/demo/destinations.js` | "Save to" registry: Google Calendar, Outlook Calendar, Voco calendar only. A destination is selectable only when connected and healthy. |
| `src/lib/demo/session.js` | Request validation and room metadata (pure, unit-tested). |
| `src/lib/demo/actions.js` | Event stream → timeline and event card (pure, unit-tested). |
| `src/lib/demo/server.js` | Tenant resolution, destination health checks, leftover listing, cleanup. |
| `src/lib/demo/voices.js` | Curated test voices, shared with the test console. |
| `src/app/api/admin/demo/{status,session,cleanup}/route.js` | The three routes, all behind `verifyAdmin`. |

Cleanup is scoped on purpose: the room must be a `test-web-` room of the demo tenant and its `calls` row must have `is_test_call = true`. It cannot reach a booking made by a real caller.

Outlook is listed as "Connect to enable". The agent-side push accepts it, but it has never been connected or tested: [[Handoff - Demo Studio and rebrand (start here)]] decision 4.

## Agent side (`livekit-agent`, branch `demo-studio`)

| File | What it does |
|---|---|
| `src/lib/demo.py` | `parse_demo` (returns None unless `test_call` is true), `demo_external_destination`, `keeps_booking`, `publish_event`. |
| `src/agent.py` | Reads the block into `deps["demo"]`; sets `deps["_events_room"]` for `web_test` rooms; publishes a `tool` event after every tool call; forwards `demo` to post-call. |
| `src/tools/book_appointment.py` | At the sandbox gate: a test call skips the calendar push unless the demo names an external destination, then pushes to exactly that provider. Caller SMS and recovery SMS stay off for every test call. Publishes `booked`, then `calendar_saved` or `calendar_failed`. |
| `src/lib/calendar_push.py` | `provider=` (explicit, no fallback to another calendar) and `style=`; returns `{provider, event_id, html_link}`. |
| `src/lib/calendar_text.py` | Scheduling event wording: title `<caller>: <reason>`, body "Booked by the Voco voice agent". Used for every scheduling-profile booking, demo or not. |
| `src/post_call.py` | Skips the test-call auto-cancel when `keep_booking` is set. Billing, CRM writes and owner notifications still gate on `is_test_call` alone. |

### Event stream
Topic `voco.events`, one JSON object per message, only in `web_test` rooms:

| `type` | Fields |
|---|---|
| `tool` | `name`, `args` (the model's tool arguments), `state` (the `STATE:` part of the return), `is_error` |
| `booked` | `appointment_id`, `start`, `end`, `when`, `caller_name`, `reason` |
| `calendar_saved` | `appointment_id`, `provider`, `event_id`, `link` |
| `calendar_failed` | `appointment_id`, `provider` |

## Sandbox rules, with the demo exception

A demo call is a test call. See [[Decision - Test calls are sandboxed]] for the base rules and the exception.

| Side effect | Plain test call | Demo call |
|---|---|---|
| Appointment row | Created, cancelled at call end | Created, kept until cleanup |
| External calendar event | Never | Only to the destination named in the server-set metadata |
| Caller SMS, recovery SMS | Never | Never |
| Usage billing, CRM rows, owner SMS/email | Never | Never |

## With the appointments agent (branch `appointments-agent`)

Room metadata: `{ test_call: true, web_test: true, tenant_id, to_number, agent: "appointments", demo: { … } }`. `agent` comes from the task's entry in `src/lib/demo/scenarios.js`.

Extra events on `voco.events`:

| `type` | Fields |
|---|---|
| `rescheduled` | `appointment_id`, `start`, `end`, `when`, `previous_start`, `previous_when`, `caller_name`, `reason` |
| `calendar_updated` | `appointment_id`, `provider`, `event_id`, `link` |
| `cancelled` | `appointment_id`, `start`, `end`, `when`, `caller_name`, `reason` |
| `calendar_removed` | `appointment_id`, `provider`, `event_id` |
| `calendar_failed` | now also `action`: `create`, `move`, `remove` or `connect` |

`tool` events no longer carry `slot_token` or `appointment_token`.

**Model switch.** The setup column has a three-way Model control: Production (the worker's own setting), Qwen on Groq, GPT-4.1 mini. The registry is `src/lib/demo/models.js`; the session route validates the choice and writes it to the room metadata as `llm`. The agent's `session` event (`llm`, `model`, `fallback`) becomes the first timeline line, "Running on …". How the agent resolves it: [[Voice Agent - Appointments agent (verified)]].

What a demo call may touch: appointments made by test calls of the demo tenant, with no calendar event or an event in the calendar the demo named. A moved appointment is re-attached to the call that moved it, so "Remove demo booking" after that call still finds it. An appointment cancelled by the agent needs no cleanup.

Recording a move or a cancel takes two calls: book in the first, then start a second call and ask to move or cancel "my appointment" under the same name.

## Tests
- Agent: `tests/test_appointments_agent.py` (the appointments agent), `tests/test_demo_studio.py` (what fires for production, test and demo calls; explicit provider; event wording; events; post-call gates), `tests/test_test_call_sandbox.py`.
- Next app: `tests/unit/demo-studio.test.js`, `tests/api/admin-demo.test.js`, `tests/api/admin-test-agent.test.js`.
- Scripted call: `BASELINE_DEMO=google python vault/_meta/tools/baseline_call.py <tenant_id> <phone>`, then `node --env-file=.env.local vault/_meta/tools/demo_event_check.mjs <tenant_id> --cleanup` reads the event back through the Google API and removes it.

## Things to know
- The site-wide `Permissions-Policy` header must keep `microphone=(self)` (`next.config.js`) or the browser cannot capture audio: [[2026-09-04 Test call immediately stops - investigation]].
- While a demo booking is kept, its slot is taken in Voco's calendar too. The setup column lists leftovers under "Still on the calendar".
- The screen recording is not made by the page. Use the OS recorder or OBS.

## Related notes
- [[Voice Agent - Test Calls and Admin Web Test Console (2026-08-25)]] (older architecture text for the test console)
- [[Scheduling - Booking to calendar on agent calls (verified path)]]
- [[Run a browser test call]] · [[Run a local dev worker and measure]]

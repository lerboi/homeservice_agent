---
type: log
date: 2026-11-23
status: record
description: "Task 2 build record: Google Calendar reconnected and verified, agent demo flag and live events, a guard against the model claiming a booking it did not make, the /admin/demo page and routes, tests, and the scripted-call results. Not yet deployed."
verified: 2026-11-23
tags: [voco/log]
---

# 2026-11-23 Demo Studio build

Outcome: the Demo Studio is built on the `demo-studio` branch in both repos and verified locally. Nothing is pushed or deployed. System description: [[Demo Studio]]. How to use it: [[Record a demo]].

## 1. Google Calendar
- Connected the owner's personal Google account to the demo tenant through Chrome (dashboard page → fetch `/api/google-calendar/auth` → Google consent).
- The row came back with `is_primary = false`: the bug named in the handoff. Fixed in both callbacks (`src/app/api/google-calendar/callback/route.js`, `src/app/api/outlook-calendar/callback/route.js`): a calendar is primary unless another provider already is. The old rule counted the row being replaced. The demo tenant's row was set to primary by hand.
- Verified with `vault/_meta/tools/verify_google_calendar.mjs`: real token refresh, create a test event, read it, delete it. All passed.
- Google showed its "Google hasn't verified this app" screen before consent. That screen is what an unverified app shows; it does not say whether the app is in "Testing" (7-day refresh tokens) or "In production". Only the Google Cloud Console answers that.

## 2. Agent (`livekit-agent`, branch `demo-studio`)
Built what the handoff listed: the `demo` block (`src/lib/demo.py`), the calendar push with an explicit provider and a returned event link, scheduling event wording, the kept booking, and the `voco.events` stream. Details in [[Demo Studio]].

Also built, from the handoff's "worth doing" list and from what testing showed:

| Change | Why | Switch |
|---|---|---|
| Booking-claim guard (`src/lib/booking_claim_guard.py`, wired in `VocoAgent.llm_node`) | On the first scripted call the model said "You're booked for tomorrow at twelve noon" and never called `book_appointment`. Nothing was booked. The guard holds back the opening words of a reply on the turns between an offer and a booking; if they claim a booking, the reply is dropped unspoken and the turn is re-run with the tool forced. | `VOCO_BOOKING_CLAIM_GUARD=false` |
| Confirm-then-book gate (`book_appointment`) | The prompt-only rule failed with another model earlier. The gate refuses, once per slot, a booking for a time that was first offered after the caller last spoke. | `VOCO_CONFIRM_GATE=false` |
| Follow-up writes run concurrently | After the atomic booking, three independent updates ran one after another. They now run together. | none |

Not done: the agent's own filler line ("Alright, locking that in now"), and the roughly 2 s before the greeting.

## 3. Scripted calls (local dev worker, Groq Qwen, demo destination Google)

| Run | Result |
|---|---|
| 1 (before the guard) | Model claimed a booking without calling the tool. No appointment, no event. |
| 2, 3 (before the guard) | Booked; event in Google Calendar; read back and removed. In run 3 the model said "You're booked." alongside the tool call, before it returned. |
| 4 (guard on) | Guard tripped on "Done, you're booked", forced the tool, booking made, event in Google Calendar. |
| 5, 6 (guard on) | Booked normally. |

Every booked run: Google event title `Alex Tan: Product demo`, description "Booked by the Voco voice agent", start 12:00 Asia/Singapore, appointment kept as `confirmed`, `calendar_saved` event with the link received by the caller. Cleanup deleted the event and cancelled the appointment each time.

One hallucinated booking in the three runs without the guard is a rate worth taking seriously in production, where the deployed agent (`c1b048e`) has no guard.

Voice-to-voice gaps on these runs were 0.84 to 1.83 s on ordinary turns and 1.3 to 1.8 s on the booking turn. These are local-worker numbers and are not comparable with the Railway figures in [[2026-11-23 Pipeline health check before the demo]]; the booking turn has to be measured again after deploy before claiming it is faster.

## 4. Next app (`homeservice_agent`, branch `demo-studio`)
- `src/hooks/useAgentCall.js` extracted from the 924-line test console; `/admin/test-agent` now uses it (page is about 400 lines).
- `/admin/demo`, its three routes, the registries and helpers under `src/lib/demo/`, and a "Demo Studio" admin tab.
- `VOCO_TEST_AGENT_NAME` lets the dispatch route target a local dev worker; unset in production.

Verified in Chrome on a local server: the page loads, Google Calendar shows healthy with the connected account, Outlook shows "Connect to enable", presentation mode works, Start call creates the session, joins the room and dispatches. The agent did not join that call: the machine was at 96% CPU and the local worker had marked itself unavailable (livekit-agents stops accepting jobs above 70% load). A spoken call through the page still needs to be done once deployed.

## 5. Tests
- Agent: 771 pass, 1 pre-existing failure (`tests/webhook/test_routes.py::test_incoming_call_vip_lead`). New: `tests/test_demo_studio.py`, `tests/test_scheduling_profile.py`, `tests/test_booking_claim_guard.py`; `tests/test_test_call_sandbox.py` updated for the new gate.
- Next app: `tests/unit/demo-studio.test.js`, `tests/api/admin-demo.test.js` (56 tests with the existing test-console file).

## 6. Found along the way, not fixed
- Post-call triage layer 2 calls `gpt-4.1-nano`, which OpenAI now rejects as deprecated (`[triage] layer2 failed … model_not_found` in the worker log). Layer 2 never succeeds; the call is still recorded.
- The model sometimes offers "twelve noon" as an afternoon time and once stumbled over the month name. Prompt and model quality, not addressed here.

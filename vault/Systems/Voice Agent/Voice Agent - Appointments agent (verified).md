---
type: system
system: Voice Agent
status: current
description: "The dedicated appointments agent in livekit-agent/src/agents/appointments: how a call is routed to it, its eight tools (book, find, move, cancel), the calendar layer, the guards against a model that speaks without calling tools, the sandbox scope, and what was and was not verified."
verified: 2026-11-24
tags: [voco/system/voice-agent]
---

# Appointments agent (verified)

Part of [[Voice Agent]]. Built and deployed 2026-11-24 (agent `5c0d395` on Railway, Next app `a307ce1` on Vercel). Demo Studio calls use it; phone calls do not yet. Build record and call results: [[2026-11-24 Appointments agent build]]. Why it is a separate package: [[Decision - One worker runs several agents]].

It books, looks up, moves and cancels appointments in the business's connected calendar. It has no address intake, urgency triage, lead capture, transfer, caller history or CRM context: none of that code loads on its calls.

## How a call reaches it

`livekit-agent/src/agent.py` is still the worker's only entrypoint (same worker name, same Railway service, same Dockerfile). After it has connected and read the room metadata it calls `select_agent` (`src/agents/__init__.py`):

| Call | Agent |
|---|---|
| Test call whose server-set room metadata has `agent: "appointments"` | appointments |
| Everything else | `VOCO_DEFAULT_AGENT` (default `receptionist`: the code in `src/agent.py`, unchanged, including its `VOCO_AGENT_PROFILE` scheduling profile) |

Room metadata is honoured on test calls only, so nothing a caller controls picks the agent. The Demo Studio sets it: `src/lib/demo/scenarios.js` gives the scheduling task `agent: 'appointments'` and `src/lib/demo/session.js` copies it into the metadata. Phone calls still get the receptionist until `VOCO_DEFAULT_AGENT=appointments` is set on Railway.

The router passes the loaded `src/agent.py` module to the new agent, which reads every voice-tuning constant from it (`src/agents/appointments/pipeline.py`). There is one set of switches (`VOCO_LLM_PROVIDER`, `VOCO_GROQ_MODEL`, `VOCO_VAD_MIN_SILENCE_S`, endpointing, interruption), not two.

## Files (`livekit-agent/src/`)

| File | What it does |
|---|---|
| `agents/__init__.py` | `select_agent`, `VOCO_DEFAULT_AGENT`. |
| `agents/appointments/entry.py` | One call: business lookup, prompt, pipeline, greeting, events, recording, shutdown. Calls the shared `run_post_call_pipeline` with `skip_triage`. |
| `agents/appointments/prompt.py` | `build_prompt` (about 1,000 tokens, identical for every call to a business) and `date_context` (today plus the date of each of the next 14 days). |
| `agents/appointments/tools/availability.py` | `check_slot`, `check_day` (optional `part_of_day`), `next_available_days`. |
| `agents/appointments/tools/book.py` | `book_appointment`. |
| `agents/appointments/tools/manage.py` | `find_appointment`, `reschedule_appointment`, `cancel_appointment`. |
| `agents/appointments/tools/common.py` | Tokens, the confirm gate, filler delays. |
| `agents/appointments/store.py` | Reads and writes of `appointments`, and which appointments a call may touch. |
| `agents/appointments/calendar_sync.py` | The calendar write with its time budget, one retry and live events. |
| `agents/appointments/guard.py` | Claim guard and grounding check (below). |
| `agents/appointments/preamble.py` | Drops speech the model emits in the same response as a tool call. |
| `calendars/` | `GoogleCalendar`, `OutlookCalendar`: `prepare`, `create_event`, `move_event`, `delete_event`; `calendar_target` (sandbox rule); `open_calendar`. |

Shared code it reuses unchanged: `src/tools/_availability_lib.py`, `src/lib/slot_calculator.py`, `src/lib/booking.py` (`book_appointment_atomic`), `src/tools/end_call.py`, `src/lib/tool_filler.py`, `src/lib/demo.py`, `src/post_call.py`.

## Tools

Every time or appointment the agent mentions comes from a tool return, and every write takes an opaque token from an earlier return (`slot_token`, `appointment_token`). The model never passes a date, a time or an appointment id to a write.

| Tool | Returns |
|---|---|
| `check_slot(date, time)` | `STATE:slot_ok token=…`, or `slot_taken` with up to three nearby times, or `too_soon` / `day_empty` with the next opening. |
| `check_day(date, part_of_day?)` | `STATE:day_has_slots` with exactly two options, in the order to be spoken. Noon is not offered as "afternoon" while later times are open. |
| `next_available_days()` | Up to three of the next five days that have openings, each with its date. |
| `book_appointment(slot_token, caller_name, reason?)` | `BOOKED: …`, or `needs_confirmation`, `slot_taken` with the next time, `booking_failed`. |
| `find_appointment(caller_name)` | `STATE:appointment_found` with up to three appointments and their tokens, or `appointment_not_found`. |
| `reschedule_appointment(appointment_token, slot_token)` | `RESCHEDULED: …`, or `needs_confirmation`, `slot_taken` (nothing changed), `already_at_that_time`. |
| `cancel_appointment(appointment_token)` | `CANCELLED: …`, or `needs_confirmation`, `already_cancelled`. |
| `end_call()` | The shared tool. |

Differences from the receptionist's availability tools: no travel buffer between appointments (the receptionist keeps `tenants.travel_buffer_mins`, default 30, clear on both sides of every booking), and a failed lookup never tells the model to "offer capture_lead".

Two behaviours added on 2026-11-24 (deployed; [[2026-11-24 Demo call script and persona]]):
- `check_slot` reads a time before the day's opening as the afternoon when the afternoon twin is inside the day's hours (`afternoon_if_before_opening`): the model passed `2:00` for "tomorrow at two".
- When the caller gives the new time together with the request to move, the agent looks the appointment up, checks the new time and asks once. The rule is in the prompt and in the `find_appointment` return for a single match.

A move is one `UPDATE` of the appointment's times. The `appointments_no_overlap` exclusion constraint refuses it if the new time is held, so the caller never has neither slot. The row id and the calendar event id stay the same.

## Calendar

Voco's `appointments` table is the lock; the external calendar is written second. `entry.py` opens the connection and refreshes its token while the greeting plays (three attempts). A write then is one HTTPS request, run alongside the follow-up database writes, with a budget of `VOCO_CALENDAR_WAIT_S` (2.5 s): the tool's log line says `calendar=saved | pending | failed | none`. A failed write is retried once. The caller is told "booked" in every case, because the appointment exists.

On a move or a cancel the synced copy of the event in `calendar_events` is updated or deleted as well, so the old time is free for the next caller before the provider's webhook catches up.

Availability still reads Voco's own tables (`appointments`, `calendar_events`, `calendar_blocks`), not the calendar's API.

## Sandbox scope

A test call is still a test call ([[Decision - Test calls are sandboxed]]): no SMS, no CRM rows, no billing, no owner notification.

| | Production call | Plain test call | Demo Studio call |
|---|---|---|---|
| Calendar written (`calendars.calendar_target`) | Tenant's primary calendar | None | Only the calendar named in the server-set metadata |
| Appointments `find_appointment` can return (`store.upcoming`) | Those booked from the caller's own phone number | Those made by test calls that have no calendar event | Those made by test calls, with no event or an event in the demo's calendar |
| Appointment after the call | Kept | Cancelled by post-call | Kept until cleanup |

A demo or test call can therefore never move or cancel a real customer's appointment, and a production caller cannot reach someone else's by knowing their name.

## Guards against a model that talks instead of acting

All of them sit in `AppointmentsAgent.llm_node`. They exist because the fast model (Groq Qwen) did each of these on scripted calls on 2026-11-24.

| Guard | Catches | Action |
|---|---|---|
| Grounding check (`guard.py`) | Before any calendar tool has returned, a reply that names a time, offers a day ("I can offer you Monday the thirtieth"), announces a lookup or claims a change ("I have you down for two o'clock") | Reply dropped unspoken; turn re-run with a tool call required |
| Promise check (`guard.py`) | "I'll go ahead and book …" ending with no tool call | Dropped; the model is told nothing happened and answers again. No tool is forced, since the caller may not have agreed |
| Claim guard (`guard.py`) | After an offer or lookup and before a completed write, a reply that opens with "you're booked / I've moved it / it's cancelled" and has no tool call | Dropped. If only a new booking is in play, `book_appointment` is forced. If an existing appointment is in play, the model is corrected and answers again (a forced move or cancel would be worse than the false claim) |
| Preamble filter (`preamble.py`) | Speech in the same response as a tool call ("Let me check that for you", a stray "[assistant]") | The speech is dropped; the goodbye before `end_call` is kept |

`VOCO_BOOKING_CLAIM_GUARD=false` turns off the first two. They read English only. At most two re-runs per call.

Code gates that do not depend on the model's wording: a booking, move or cancel for something first put to the caller after their last turn is refused once (`common.unconfirmed`, `VOCO_CONFIRM_GATE`); a date in the past is sent back for a silent retry.

## The business name on a demo call

A Demo Studio call may answer as a named business. The server-set `demo` block carries `business_name`; `lib/demo.clean_business_name` accepts a plain name of 2 to 40 characters; `entry.py` uses it for the greeting, the prompt and the speech-to-text keyterm. `demo` is `None` on every production call, so a production call always answers as the tenant. Nothing else changes: the tenant, its hours, its calendar and the tools are the real ones.

## The demo agent built on this one

`src/agents/demo` is a second agent that reuses this one's `run_call`, tools, guards and calendar layer and supplies a `profile`: its own prompt (a clinic front desk), a turn policy, gpt-4.1-mini as its model when the call names none, and extra speech-to-text keyterms. `run_call(..., profile=None)` and `AppointmentsAgent(..., turn_policy=None)` are the two extension points; with neither, this agent behaves as described here. The demo agent is selected by `agent: "demo"` in a test call's metadata and can never be the default. The Demo Studio uses it.

## Which model runs a call

Two choices: `groq` (Groq Qwen first, gpt-4.1-mini as the fallback leg) and `openai` (gpt-4.1-mini alone). `pipeline.resolve_provider` picks, in this order:

1. **Demo Studio**: the Model switch on `/admin/demo` (Production / Qwen on Groq / GPT-4.1 mini) puts `llm` in the server-set room metadata. Honoured on test calls only. "Production" sends nothing, so the call runs on the next two.
2. **Production**: the Railway variable `VOCO_APPT_LLM_PROVIDER` (`groq` or `openai`), for this agent only. Changing it redeploys the worker.
3. The shared `VOCO_LLM_PROVIDER` (default `groq`).

The agent publishes a `session` event at the start of a web test call (`llm`, `model`, `fallback`); the page shows it as the first line of the timeline ("Running on …"), so what ran is never a guess.

The prompt is the same for both except a closing `REMEMBER` section (`prompt.MODEL_NOTES`), each answering slips that model made on scripted calls: for Qwen, never speak about the calendar or claim a change without the tool; for gpt-4.1-mini, hang up with the goodbye, pass `part_of_day`, and "the first one" is option 1. When the Groq leg fails over mid-call the call keeps the Qwen prompt.

## Switches

| Env | Default | Effect |
|---|---|---|
| `VOCO_DEFAULT_AGENT` | `receptionist` | Agent for calls that do not name one. `appointments` moves phone calls over. |
| `VOCO_APPT_LLM_PROVIDER` | unset (follows `VOCO_LLM_PROVIDER`) | `groq` or `openai` for this agent in production. See above. |
| `VOCO_CALENDAR_WAIT_S` | `2.5` | How long a tool waits for the calendar write. |
| `VOCO_APPT_LOOKUP_FILLER_DELAY_S` / `VOCO_APPT_WRITE_FILLER_DELAY_S` | `2.5` / `3.5` | Idle seconds since the caller stopped speaking before a spoken filler covers a tool's wait (the typing sound covers it until then). It counts from the end of the caller's turn, not from the tool start. |

## Tests
`livekit-agent/tests/test_appointments_agent.py` (104 tests). Next app: `tests/unit/demo-studio.test.js`, `tests/api/admin-demo.test.js`. Scripted calls: [[Run a local dev worker and measure]] (`BASELINE_AGENT=appointments`, `BASELINE_SCRIPT=book|reschedule|cancel|demo`).

## Known gaps
- Not tried through the `/admin/demo` page by a person: verified with scripted calls, locally and on Railway. The page's Model switch and the moved/cancelled card are covered by unit tests only.
- The fast model is the weak point. See the call table in [[2026-11-24 Appointments agent build]] before choosing between speed and `VOCO_APPT_LLM_PROVIDER=openai`.
- No caller SMS confirmation on production calls (the receptionist's SMS template needs a service address).
- Outlook: the client is written and unit-tested, never run against a live account.
- A production caller who phones from a different number cannot find their appointment.
- Appointment length is the tenant's `slot_duration_mins` for every appointment; there are no appointment types.
- The tenant's `services` rows are deliberately not used: they are home-service trade templates.

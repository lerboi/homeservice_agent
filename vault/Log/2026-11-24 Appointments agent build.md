---
type: log
date: 2026-11-24
status: record
description: "Build record for the dedicated appointments agent: what was built in both repos, every scripted call placed against a local worker with what it showed and what was changed because of it, the Groq versus gpt-4.1-mini comparison, and what is still unverified."
verified: 2026-11-24
tags: [voco/log]
---

# 2026-11-24 Appointments agent build

Outcome: a separate appointments agent exists on branch `appointments-agent` in both repos, uncommitted and undeployed. Booking, moving and cancelling were each verified end to end against Google Calendar with scripted calls on a local dev worker. System description: [[Voice Agent - Appointments agent (verified)]]. Why this shape: [[Decision - One worker runs several agents]].

## 1. What was built

**`livekit-agent` (branch `appointments-agent`)**
- `src/agents/` (router) and `src/agents/appointments/` (entry, prompt, pipeline, guard, preamble filter, store, calendar sync, eight tools).
- `src/calendars/` (Google and Outlook clients: create, move, delete; the sandbox rule for which calendar a call may write to).
- `src/agent.py`: the router block and two imports. Nothing else in it changed.
- `src/post_call.py`: `skip_triage`; the hallucination detector counts a successful reschedule as a real change.
- `src/lib/tool_filler.py`: optional per-tool `delay`.
- `tests/test_appointments_agent.py`: 104 tests.

**`homeservice_agent` (branch `appointments-agent`, in a separate worktree so the rebrand work was not touched)**
- `src/lib/demo/scenarios.js`, `session.js`: the scheduling task names the appointments agent; the room metadata carries `agent`.
- `src/lib/demo/actions.js`: timeline and card for find, move and cancel; the new `rescheduled`, `cancelled`, `calendar_updated`, `calendar_removed` events; `calendar_failed` worded by action. Fixed: a free slot check was always shown as "not open" (the code compared against `slot_available`; the agent returns `slot_ok`).
- `src/app/admin/demo/page.js`: the event card shows a moved or cancelled event.
- `vault/_meta/tools/baseline_call.py`: `BASELINE_AGENT` and `BASELINE_SCRIPT=book|reschedule|cancel`.

## 2. Tests
- Agent: 875 pass, 1 pre-existing failure (`tests/webhook/test_routes.py::test_incoming_call_vip_lead`). Before this work: 771 pass, the same failure.
- Next app: `tests/unit/demo-studio.test.js`, `tests/api/admin-demo.test.js`, `tests/api/admin-test-agent.test.js`: 61 pass. The full Next suite was not run.

## 3. Scripted calls and what each one changed

All calls: local dev worker (`voco-voice-agent-dev`), demo tenant, the six-utterance booking script unless noted, Groq Qwen first with gpt-4.1-mini fallback unless noted. Local numbers are not Railway numbers.

| # | Call | Result | Change made |
|---|---|---|---|
| 1 | Book, plain test call | Booked, auto-cancelled after the call. The confirmation came about 7.5 s after the caller's "yes": the runtime filler ("Okay, booking that in for you") started as the booking finished, and the claim guard then dropped a true "You're all booked" | Filler delay per tool (1.2 s lookups, 2.0 s writes). Guard no longer treats an appointment booked on this call as an open offer |
| 2 | Book, demo | "I'm afraid we're a plumbing service here": the tenant's `services` rows (home-service templates) were listed in the prompt | Services removed from the prompt and from speech-to-text keyterms |
| 3 | Book, demo | "Tomorrow" became `2026-10-26`; the agent told the caller tomorrow had passed | Prompt carries the date of each of the next 14 days; a past date is sent back for a silent retry |
| 4 | Book, demo | No tool called at all. "Let me check that for you. I have you down for tomorrow at two o'clock", then "You're all set". Nothing was booked | Grounding check: before any calendar tool has returned, such a reply is dropped and a tool call required |
| 5 | Book, demo | Booked. Google event read back through the API: `Alex Tan: Product demo`, 14:00 Asia/Singapore | none |
| 6 | Reschedule, demo (a new call) | Found the booking from call 5 and moved it. The same Google event read back at Thursday 10:00 | none |
| 7 | Cancel, demo | The model asked the caller what time the appointment was and never looked it up | Prompt: look it up the moment there is a name; a cancel example |
| 8 | Cancel, demo | Cancelled. Google reports the event `status=cancelled`; appointment row cancelled | none |
| 9, 10 | Book, demo | 9 booked; the model emitted the text "[assistant]" next to two tool calls. 10 booked in Voco but not in Google: `WinError 10035` at call start left the call with no calendar connection (reported live as `calendar_failed`) | Preamble filter. Calendar connection and call-row insert are retried |
| 11-13 | Book, demo | 2 clean. In 1 the grounding check caught invented times, but the model then booked a time the caller had not been offered (three options returned, two spoken, "the first one") and said the wrong date | `check_day` returns exactly two options in spoken order; noon is not offered as "afternoon" |
| 14-16 | Book, demo, **gpt-4.1-mini only** | 3 of 3 booked correctly, no guard trips. One call did not hang up after the goodbye | none |
| 17-19 | Book, demo, final code | 3 of 3 booked correctly. One preamble ("Gladly, let me check.") dropped. One call wrote the name as "Alex Turn" (speech-to-text); one said "today, Wednesday" for tomorrow | none |

Every demo booking was removed afterwards (the cancel call for 5; `demo_event_check.mjs --cleanup` for the rest). No test appointment is left confirmed.

## 4. Groq Qwen against gpt-4.1-mini

| | Groq `qwen/qwen3.8-27b` (calls 17-19) | gpt-4.1-mini (calls 14-16) |
|---|---|---|
| Mean LLM time to first token | 0.38 s (32 requests) | 1.04 s (30 requests) |
| End of caller audio to first agent audio | 1.05 to 2.03 s | 1.62 to 3.09 s |
| Booked the right slot | 3 of 3 on the final code. Over the day's 13 Groq booking calls the model spoke from the calendar without calling a tool in 2 (call 4, before the check existed; one of calls 11-13, caught by it) | 3 of 3 |

Three calls each is too few to rank them on correctness. What the day does show: the fast model makes mistakes the slower one did not make in the same script, the guards now catch the dangerous ones, and the switch is one variable (`VOCO_APPT_LLM_PROVIDER=openai`).

The "first agent audio" figure counts the typing sound as audio. On a booking turn the spoken confirmation starts later than that figure: about 3.3 s after the caller's "yes" on call 5 (calendar write about 1.0 s of it).

### Model switch (added the same day, at the owner's request)
The owner asked to be able to switch models in the demo and in production and to give each its own prompt if needed. Added: the Model control on `/admin/demo` (room metadata `llm`), `pipeline.resolve_provider` (demo choice, then `VOCO_APPT_LLM_PROVIDER`, then the shared setting), a `session` event naming the model that ran, and per-model closing notes in the prompt. One demo booking call per model through the switch on the local worker: both booked, both events read back from Google and removed; gpt-4.1-mini hung up with its goodbye and passed `part_of_day` this time. One call each does not show that the notes caused that.

## 5. Found, not fixed
- The previous day's "known problem" that the model speaks its own filler before booking was, at least partly, the runtime filler firing as the tool returned. The receptionist's scheduling profile still has the 0.6 s delay.
- The greeting starts 2.4 to 3.5 s after dispatch on the local worker.
- `WinError 10035` on concurrent Supabase requests from threads appeared twice on this Windows machine. Not seen on Railway (Linux); not investigated.
- Speech-to-text heard "Alex Tan" as "Alex Turn" once. The name goes to the calendar as heard.

## 6. Not done
- Nothing is committed, merged or deployed.
- No call through the `/admin/demo` page; the page changes are covered by unit tests only.
- Reschedule and cancel were run once each on Groq (calls 6 and 8) and not on gpt-4.1-mini.
- Outlook was not run against a live account.

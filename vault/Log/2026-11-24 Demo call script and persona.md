---
type: log
date: 2026-11-24
status: record
description: "The one-minute demo call: how the script was chosen and timed against production, what was built for it (a business name per demo call, a rehearsal script with checks, a reset script, two fixes to the appointments agent), every rehearsal call with its result, and what is not yet verified."
verified: 2026-11-24
tags: [voco/log]
---

# 2026-11-24 Demo call script and persona

Outcome: the script for the recorded demo is fixed, and the code for it is built on branch `demo-persona` in both repos. **Not deployed.** Rehearsed on a local dev worker only. How to record: [[Record a demo]]. System notes: [[Demo Studio]], [[Voice Agent - Appointments agent (verified)]].

## 1. The script and why

A caller rings a clinic ("Brightside Dental"), books a cleaning for tomorrow at two, then moves it to Friday at ten, in one call. The owner chose a clinic appointment call after a look at the Singapore market: local voice AI vendors lead with appointment booking for clinics, IMDA's pre-approved SME list has a call-handling AI package, and receptionist roles are among the most advertised vacancies. No independent survey ranks use cases; this is a reading of those signals.

The caller names exact times. Timed on production (agent `5c0d395`, one call per row, 2026-11-24):

| Caller wording | Model | Result | Length as run |
|---|---|---|---|
| "tomorrow afternoon", pick from two offered times, "make it Thursday at ten instead" | gpt-4.1-mini | Booked; the move landed 73 s in, after a second confirmation; no goodbye yet at 78 s | 78 s+ |
| same | Groq Qwen | Booked; never moved: it ignored "Thursday at ten" and asked for the time again. Name heard as "Alex Than" | 66 s |
| "tomorrow at two", "move that to Thursday at ten" | gpt-4.1-mini | Booked and moved | 62 s |
| same | Groq Qwen | Booked and moved | 56 s |

Length is from the start of the greeting to the agent's last audio. The scripted caller waits 1.8 s after the agent stops; a person answering after 0.5 s takes about 6 s less.

## 2. What was built (branch `demo-persona`, both repos)

**`livekit-agent`**
- `src/lib/demo.py`: the `demo` block may carry `business_name`. `clean_business_name` accepts a plain name of 2 to 40 characters and nothing else. Honoured on test calls only, like the rest of the block.
- `src/agents/appointments/entry.py`: the call answers as that name (greeting, prompt, speech-to-text keyterm). Tenant, hours, calendar and tools are unchanged.
- `src/agents/appointments/prompt.py`: a rule and an example for a move whose new time the caller already gave: look up, check, ask once.
- `src/agents/appointments/tools/manage.py`: the `find_appointment` directive for a single match now starts "if the caller already named the new time they want, say nothing yet: call check_slot". The old wording ("tell the caller the day and time you found") is what made gpt-4.1-mini speak twice.
- `src/agents/appointments/tools/availability.py`: `afternoon_if_before_opening`. A time before the day's opening whose afternoon twin is inside the day's hours is read as the afternoon ("2:00" becomes "14:00"). The `time` parameter description says the same.
- Tests: 905 pass (was 875), the same one pre-existing failure deselected.

**`homeservice_agent`**
- `src/lib/demo/session.js`: `cleanBusinessName`, `DEFAULT_DEMO_BUSINESS_NAME` ("Brightside Dental"), `business_name` in the request and in the `demo` block.
- `src/app/api/admin/demo/session/route.js`: passes it on; the response's `tenant.business_name` is the name the call answers as.
- `src/app/admin/demo/page.js`: an "Answer as" field in the setup column; the captions and the call status use that name.
- `vault/_meta/tools/baseline_call.py`: `BASELINE_SCRIPT=demo` (the exact lines), `BASELINE_BUSINESS`, `BASELINE_QUIET`, a `TIMING` line on every run, and `CHECKS` with a `VERDICT` and exit code for the demo script.
- `vault/_meta/tools/demo_reset.mjs`: removes every booking that test calls left (Google event, synced copy, appointment).
- Tests: the three Demo Studio suites, 66 pass.

## 3. Rehearsals (local dev worker, `BASELINE_SCRIPT=demo`, answering as Brightside Dental)

Local numbers are not Railway numbers. Every booking was removed with `demo_reset.mjs`.

| # | Model | Verdict | Length as run | What happened |
|---|---|---|---|---|
| 1 | Groq Qwen | PASS | 57 s | Clean |
| 2 | gpt-4.1-mini | PASS | 67 s | Two replies on the move (described the appointment, then checked the time). Led to the `find_appointment` directive change |
| 3 | gpt-4.1-mini | PASS | 58 s | One reply on the move |
| 4 | Groq Qwen | FAIL | 55 s | Passed `time: "2:00"` for "tomorrow at two"; the tool answered "two in the morning is taken" and the call booked Friday instead of moving. Led to `afternoon_if_before_opening` |
| 5 | gpt-4.1-mini | PASS | 56 s | A stray "Would" spoken in the pause inside the caller's two-sentence line |
| 6 | Groq Qwen | PASS | 55 s | Spoke part of its reasoning aloud once ("Both Friday at ten on the twenty... and the slot check") |
| 7 | Groq Qwen | FAIL | n/a | `WinError 10035` on the availability read: the Windows-only socket error already recorded in [[2026-11-24 Appointments agent build]], not a model fault |
| 8 | Groq Qwen | PASS | 62 s | Asked for the name although it had been given, then booked correctly |
| 9 | gpt-4.1-mini | PASS | 54 s | Clean |

gpt-4.1-mini: 4 of 4, the last three with one reply per turn. Groq Qwen: 3 of 5, one failure fixed in code and one caused by this machine; two of its three passes had wording a recording could not use.

## 4. Not done
- Nothing is pushed or deployed. The page change has not been opened in a browser.
- No rehearsal on Railway with the new code, so there is no production timing for the final script.
- No spoken call through `/admin/demo`.
- How fast the Google Calendar web page redraws after the write was not measured (the API write took 0.4 to 0.6 s).
- The take would show the owner's personal Google Calendar; a separate calendar for the demo was proposed and not set up. Whether the Next cleanup and status routes honour a non-primary `calendar_id` end to end was not checked beyond reading the code.
- Whether a real clinic in Singapore is called Brightside Dental was not checked.

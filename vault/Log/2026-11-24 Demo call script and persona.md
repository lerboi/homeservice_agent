---
type: log
date: 2026-11-24
status: record
description: "The one-minute demo call: how the script was chosen and timed against production, what was built for it (a business name per demo call, a rehearsal script with checks, a reset script, two fixes to the appointments agent), every rehearsal call with its result, and what is not yet verified."
verified: 2026-11-24
tags: [voco/log]
---

# 2026-11-24 Demo call script and persona

Outcome: the script for the recorded demo is fixed and the code for it is deployed from `main` in both repos (sections 5 to 7). The first spoken take failed and led to a dedicated demo agent (section 7). How to record: [[Record a demo]]. System notes: [[Demo Studio]], [[Voice Agent - Appointments agent (verified)]].

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
- How fast the Google Calendar web page redraws after the write was not measured (the API write took 0.4 to 0.6 s).
- The take would show the owner's personal Google Calendar; a separate calendar for the demo was proposed and not set up. Whether the Next cleanup and status routes honour a non-primary `calendar_id` end to end was not checked beyond reading the code.
- Whether a real clinic in Singapore is called Brightside Dental was not checked.

## 5. Deployed, and a page crash

With the owner's go-ahead: agent `32d352e` and Next app `2d6b3fb` pushed to `main`. The Demo Studio page then crashed on load in production ("Cannot access ... before initialization"): `canStart` read `persona` one line before its declaration. The page had not been opened in a browser before the push, and neither the tests nor the default lint rules catch a use before declaration. Fixed in `02441c8`. Check to run on that page before pushing: `npx eslint --rule '{"no-use-before-define": ["error", {"functions": false, "classes": false, "variables": true}]}' src/app/admin/demo/page.js`.

## 6. Production rehearsals of the appointments agent (agent `32d352e`, `BASELINE_SCRIPT=demo`)

| Model | Passed | Length as run | Failures |
|---|---|---|---|
| gpt-4.1-mini | 4 of 5 | 50 to 58 s | Speech-to-text heard the name as "Alexton" once; the booking and the move were otherwise right |
| Groq Qwen | 3 of 5 | 53 to 58 s | One call rambled, then said the line was breaking up and booked nothing more; one said "Too many slots returned" aloud and never booked |

Across about twenty scripted calls on 2026-11-24 the synthetic caller's "Alex Tan" was heard as "Alex Than", "Alex Turn" and "Alexton" once each.

## 7. The first spoken take, and the demo agent

The owner's first take through `/admin/demo` (gpt-4.1-mini) failed. From the recording and the Railway log: the agent checked tomorrow at two and asked "Is that right for you?"; the owner said "Yes, please."; the agent replied "What is the appointment for? What is the appointment for?" and booked nothing; the owner went on to ask for the move, and `find_appointment` found nothing.

The owner asked for a dedicated demo agent in its own folder: a working agent for the demo's setting, not scripted replies, with gpt-4.1-mini as the default. Built on `main`:

- `livekit-agent/src/agents/demo/`: `prompt.py` (the front desk of a dental clinic; never asks what an appointment is for; books the moment the caller agrees), `policy.py` (`confirm_pending_write`: a plain "yes" from the caller while exactly one time is on offer requires the turn to call `book_appointment`, or `reschedule_appointment` when the appointment was looked up since the last change), `entry.py` (the profile: this prompt, this policy, `llm: openai`, clinic keyterms for speech-to-text).
- `src/agents/appointments/entry.py`: `run_call` takes an optional `profile`; `AppointmentsAgent` takes an optional `turn_policy`. With neither, behaviour is unchanged.
- `src/agents/__init__.py`, `src/agent.py`: the router knows `demo`. Test calls only; `VOCO_DEFAULT_AGENT=demo` is ignored.
- Demo Studio: the scheduling task names `agent: 'demo'`; the Model control starts on GPT-4.1 mini.
- `baseline_call.py`: `BASELINE_LINES` (caller lines as a JSON list).
- Tests: agent 934 pass (same one pre-existing failure deselected); Demo Studio suites 66 pass.

Local rehearsals of the demo agent (`BASELINE_AGENT=demo`, gpt-4.1-mini):

| Call | Verdict | Length as run | Notes |
|---|---|---|---|
| The script | PASS | 48 s | The policy required `book_appointment`, then `reschedule_appointment` |
| The caller never says what the appointment is for | Booked and moved | 47 s | No question about the reason; event titled with the name only |
| The script | PASS | 45 s | Same |

Production rehearsals of the demo agent (agent `3138fa8`, Next app `ea570ea`, gpt-4.1-mini, the script): 5 of 5 passed every check, 43 to 51 s as run (37 to 45 s at a person's pace). The agent's lines were one short sentence each ("Tomorrow at two is free. Shall I book it?"). All five bookings were removed afterwards. Not yet tried with a spoken caller.

## 8. Local dev server running out of memory

`npm run dev` in the main working folder died with "JavaScript heap out of memory" at about 8 GB, and before dying returned 404 pages for every `/api/admin/*` route (which is what the Demo Studio's "Unexpected token '<'" on localhost was). `.next/dev/cache` held 15.3 GB. A restarted server reached 9.4 GB of private memory within four minutes of starting. After deleting `.next` a fresh server sat at about 3 GB over the first 100 seconds and the admin routes answered. Not watched for longer than that, so the cache is the likely cause and not a proven one. See [[Run a local dev worker and measure]].

## 9. Feedback after the second take

The owner reported three things. What each turned out to be:

1. **The page scrolled back up on every new caption.** The captions used `scrollIntoView`, which scrolls every ancestor, not only the captions box. Now the box scrolls itself, and only while the reader is at its bottom (`Captions` in `src/app/admin/demo/page.js`). `/admin/test-agent` has the same call and was not changed.
2. **A move made a second booking and left the first.** That take was started from `localhost`, where the main working folder is on the `rebrand` branch: no `agent` key in the room metadata, so the old receptionist's scheduling profile answered ("Thanks for calling Voco"), and it has no tool for moving a booking. The demo agent was not involved. Its policy was still tightened: when the caller asked to move or change an appointment since the last booking change, a yes requires `reschedule_appointment` even if the model never called `find_appointment` (`asked_to_move_since_last_write`). Agent tests: 941 pass.
3. **The Voice dropdown changed nothing.** Seven of the ten voices in `src/lib/demo/voices.js` were not in the ElevenLabs account. The agent does not fail on such a voice: it logs "is not in this account's voices" and speaks the call in its fallback voice. The list now holds 14 voices, each returned by ElevenLabs `GET /v1/voices` for the account on 2026-11-24. Production's "friendly" voice (`dj3G1R1ilKoFKhBnWOzG` in `ELEVENLABS_VOICE_MAP`) is not in the account either, so a tenant with that setting gets the fallback voice; not changed here.

Merging `main` into `rebrand` (so localhost runs this work) was not done: it needs the owner's say-so.

## 10. Goodbye, and Singapore-accent voices

- **The call ended without a goodbye.** The model sometimes sent `end_call` with no words in the same response. `preamble.goodbye_with_end_call` now puts the call's goodbye line ("Thanks for calling <business>. Goodbye.") in front of an `end_call` that comes with nothing spoken. Two local calls: the line was spoken both times. Agent tests: 945 pass.
- **Voices.** The ElevenLabs Voice Library was searched through its API for English voices with Singaporean, Malaysian, Filipino and Chinese accents. Five Singaporean voices were added to `src/lib/demo/voices.js` (Lilian, Cynthia, Christine, Lim, Mun); samples of each speaking the demo's lines are in `temp/voice-samples/` in the main working folder (not committed). A library voice plays through the API with this account's key, but the agent only uses a voice that is in the account's own list, so each must be added to My Voices in ElevenLabs first. The agent now re-reads that list when a test call asks for a voice it does not know, so no redeploy is needed after adding one.
- Two local rehearsals in this round failed their checks because the owner was recording at the same time on the same tenant: bookings from those takes were on the calendar, and `demo_reset.mjs` removed them. Do not run rehearsals while the owner is recording.

## 11. Why the voice sounded robotic, and the Voice section

The owner said the voice, the greeting above all, sounded robotic. Read from the code:

- **Audio format.** `_build_tts` never set one, so the ElevenLabs plugin's default applied: `mp3_22050_32` (22 kHz MP3 at 32 kbps). Now `pcm_24000` for every agent in the worker (`ELEVENLABS_TTS_ENCODING`; `VOCO_TTS_ENCODING=mp3_22050_32` goes back). The account's plan refuses `pcm_44100` and `mp3_44100_192`.
- **Model and pace.** Flash v2.5 at speed 1.08. Unchanged for production calls.
- **Greeting text.** Two clipped statements joined by a dash.
- Text was already sent to ElevenLabs a sentence at a time (the plugin's `auto_mode` with a sentence tokenizer), so chunking was not a cause.

Built for the Demo Studio, test calls only (server-set room metadata `voice_quality` and `greeting`):

- Agent: `VOICE_QUALITY` in `src/agent.py` (`fast` = production, `natural` = Flash at speed 1.0, `turbo` = Turbo v2.5, `rich` = Multilingual v2 with a little style) and `WARM_GREETING` in `src/agents/appointments/entry.py`. The `session` event carries `voice_quality`. Agent tests: 949 pass.
- Next app: `src/lib/demo/voice-quality.js` (must mirror the agent's table), `POST /api/admin/demo/voice-preview` (admin only; an MP3 of the chosen greeting and two booking lines in the chosen voice and quality), and a Voice section in the setup panel with a "Listen to this voice" button. The setup panel is regrouped into Business, Voice, Calendar and model, Microphone; tasks that are not live are no longer listed. Demo Studio tests: 68 pass.
- Seen in Chrome on localhost before pushing: the page renders, Listen played a six-second sample, no console errors.

Not measured: how much later Turbo and Rich start speaking on a live call. Not heard by the author: any of it. Samples made while investigating are in `temp/voice-quality/` in the main working folder (not committed).

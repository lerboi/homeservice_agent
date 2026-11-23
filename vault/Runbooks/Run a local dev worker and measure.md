---
type: runbook
status: current
description: "Run the voice agent locally under a separate worker name, place a scripted test call against it or against production, and read the latency numbers. Includes the Windows traps already hit."
verified: 2026-11-23
tags: [voco/runbook]
---

# Run a local dev worker and measure

## When to use
To test agent changes before deploying, or to measure voice-to-voice latency. All calls placed this way are sandboxed test calls ([[Decision - Test calls are sandboxed]]).

## Measure the deployed agent (no local worker)
From the `homeservice_agent` repo root, in Git Bash:

```bash
python vault/_meta/tools/baseline_call.py 24141cd0-5735-4c7a-82d5-994c6b821861 +14783755631
```

It creates a `test-web-` room, plays six synthesized caller utterances (book a demo for tomorrow afternoon, confirm, goodbye), and prints, per turn, the seconds from the end of the caller's audio to the agent's first audio, then the transcript. Stage timings for the same call are in the Railway logs: search for `turn_metrics` and `llm_metrics` (Railway MCP `get-logs` with a `startDate`).

## Run a local dev worker
The agent repo's own `.env` is incomplete (no OpenAI key, a stale ElevenLabs value), so load both repos' env files:

```bash
cd /c/Users/leheh/.Projects/livekit-agent
eval "$(python ../homeservice_agent/vault/_meta/tools/dev_worker_env.py)"
.venv18/Scripts/python.exe -m src.agent start > /tmp/dev_worker.log 2>&1 &
```

`dev_worker_env.py` sets `VOCO_AGENT_NAME=voco-voice-agent-dev`, so the local worker never receives production dispatches. Wait for `registered worker` in the log, then point the scripted call at it:

```bash
cd /c/Users/leheh/.Projects/homeservice_agent
BASELINE_AGENT_NAME=voco-voice-agent-dev python vault/_meta/tools/baseline_call.py 24141cd0-5735-4c7a-82d5-994c6b821861 +14783755631
```

### A demo call (books into Google Calendar and keeps the booking)
```bash
BASELINE_DEMO=google BASELINE_AGENT_NAME=voco-voice-agent-dev python vault/_meta/tools/baseline_call.py 24141cd0-5735-4c7a-82d5-994c6b821861 +14783755631
node --env-file=.env.local vault/_meta/tools/demo_event_check.mjs 24141cd0-5735-4c7a-82d5-994c6b821861 --cleanup
```
The first prints the `voco.events` stream under `EVENTS` (expect `booked` then `calendar_saved`). The second reads the event back through the Google API, then deletes it and cancels the appointment. Without `BASELINE_AGENT_NAME` the call goes to production. `node --env-file=.env.local vault/_meta/tools/verify_google_calendar.mjs <tenant_id>` checks the connection alone.

### The appointments agent: book, move, cancel
`BASELINE_AGENT=appointments` puts `agent: "appointments"` in the room metadata ([[Voice Agent - Appointments agent (verified)]]). `BASELINE_SCRIPT` picks what the caller says; `reschedule` and `cancel` act on a booking an earlier demo call kept, so run them after a `book`:

```bash
export BASELINE_DEMO=google BASELINE_AGENT=appointments BASELINE_AGENT_NAME=voco-voice-agent-dev
python vault/_meta/tools/baseline_call.py 24141cd0-5735-4c7a-82d5-994c6b821861 +14783755631
BASELINE_SCRIPT=reschedule python vault/_meta/tools/baseline_call.py 24141cd0-5735-4c7a-82d5-994c6b821861 +14783755631
BASELINE_SCRIPT=cancel python vault/_meta/tools/baseline_call.py 24141cd0-5735-4c7a-82d5-994c6b821861 +14783755631
```
Expect `booked` and `calendar_saved`, then `rescheduled` and `calendar_updated`, then `cancelled` and `calendar_removed` under `EVENTS`. `demo_event_check.mjs <tenant_id> <room_name>` reads the event back for a given call. To compare models, add `BASELINE_LLM=groq` or `BASELINE_LLM=openai` to a call (the same switch the Demo Studio's Model control sets); the first `EVENTS` line, `session`, says which model ran.

The gap the script prints is to the first agent audio, and the typing sound that covers a tool call counts as audio. For a booking turn, read the time of the spoken confirmation from the transcript instead.

### The Demo Studio page against the local worker
Start the Next app with `VOCO_TEST_AGENT_NAME=voco-voice-agent-dev npm run dev`; the dispatch route then sends `/admin/demo` and `/admin/test-agent` calls to the dev worker.

Override behaviour for an experiment by exporting env vars before starting the worker, for example `VOCO_GROQ_MODEL`, `VOCO_LLM_PROVIDER=openai`, `VOCO_AGENT_PROFILE=home_service`, `VOCO_VAD_MIN_SILENCE_S`.

## Compare LLMs without a call
`python vault/_meta/tools/llm_ttft_bench.py 6` times first token for several OpenAI and Groq models with a scheduling prompt and tool schemas. It ranks models from this machine; it is not a production number.

## Traps already hit
- **Run `eval "$(python …dev_worker_env.py)"`, never the script on its own**: bare, it prints secrets to the terminal.
- **Use `.venv18`** (livekit-agents 1.8.0, what production runs). The system Python has 1.5.7.
- **Do not start the worker through `runpy` or a wrapper script.** On Windows the worker's child processes re-run the wrapper, start a second webhook server, fail to bind port 8080, and leave orphans.
- **Stopping the worker**: stopping the shell does not always stop the Python processes. Find them by command line (`src.agent`, or executables under `livekit-agent\.venv18`) and stop those specific PIDs. Check that nothing is still listening on port 8080 before starting again. Do not kill every `python.exe`.
- **Do not pipe the scripted call through `tail`**: output is lost if it hangs. `grep` on its stdout is fine.
- **The worker refuses jobs when the machine is busy.** In `start` mode livekit-agents marks the worker unavailable above 70% CPU load (`worker is at full capacity, marking as unavailable` in the log) and the call sits at "Waiting for the agent". A compiling `next dev` is enough to cause it. Close what you can, or run the scripted call without the Next server.
- **Local numbers are not Railway numbers.** A local worker reaches Groq and LiveKit through different regions. Compare like with like.
- **Free-plan ElevenLabs library voices return 402** and the caller audio cannot be synthesized. The script uses a premade voice for the caller for that reason.

## How to tell it worked
The scripted call prints a `RESULTS` line with one number per turn and a transcript in which the agent offers times, reads back, waits for "yes", books and says goodbye. A `null` gap means the agent never answered that turn.

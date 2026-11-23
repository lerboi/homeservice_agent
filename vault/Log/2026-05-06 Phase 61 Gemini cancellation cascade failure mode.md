---
type: log
date: 2026-05-06
status: historical
description: "The real Phase 61.x failure pattern is server-side VAD cancelling tool calls + generations on caller speech, NOT prompt issues"
source: "Claude memory note project_phase_61_cascade_failure_mode.md"
migrated: 2026-11-23
tags: [voco/log]
---

# 2026-05-06 Phase 61 Gemini cancellation cascade failure mode
The original Phase 61.2 hypothesis (zero tool invocations + slot fabrication driven by prompt structure) was wrong, established empirically via D-09 pre-fix UAT call AJ_vV4DM5AG9t7W (2026-05-06).

**Actual failure mode:** Gemini 3.1 Flash Live performs server-side VAD on input audio. When the caller makes any audible sound during an agent generation step — even brief utterances ("Hello.", "So.") below `silence_duration_ms=2500` — the server cancels the in-flight generation AND discards pending function calls. Symptoms in `transcript_structured`: agent turns split mid-sentence, with the next agent turn starting with a leading space (the cancelled-and-restarted-with-continuation pattern). 5 such cancellations in 230s on the AJ_vV4DM5AG9t7W call.

**Cascade hits:**
1. Unmuted tools (e.g. `check_caller_history` did not call `mute_input_during_tool` pre-fix)
2. Tools where the multi-step recovery generation exceeds the 15s mute fallback (booking name+address readback runs 10-14s)
3. **The first agent generation after greeting unmute** — before any tool fires

**Why:** Apply when triaging Phase 61.x regressions. Don't reach for prompt edits first. The structural mute pattern in `livekit-agent/src/tools/_availability_lib.py::mute_input_during_tool` is the only known mitigation today; cross-link to Phase 63.2 D-08 confirming livekit-agents 1.5.7 does NOT fix this server-side behavior.

**How to apply:**
- For any future "agent stalled / fragmented / failed to complete booking" report, first ask: did caller speech happen during a tool wait? Pull the Railway `[goodbye_race]` line and check `server_tool_cancellations` (added by Phase 61.2 Fix C).
- If a new tool is added that does I/O, default to calling `mute_input_during_tool(deps)` as the first statement (excluding terminal tools `transfer_call`, `end_call`).
- Use `.planning/queries/_fetch_call.cjs` to pull transcripts; `.planning/queries/phase-61-call-aggregator.sql` for batch triage.

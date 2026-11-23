---
type: system
system: Voice Agent
status: historical
description: "Phase 61.2 contained the cascade (cancellation rate -80%) but did not Covers: Failure mode — regeneration without tool-result context; The mechanism — stall-detection + synthetic FunctionCallOutput replay; The unlock — tool_results send is unconditional; Listener-miss correction (closes 61.2-VERIFIC"
source: .claude/skills/voice-call-architecture/SKILL.md § Phase 61.3 — Cascade-Recovery via Tool-Result Replay (2026-05-07)
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# Phase 61.3 - Cascade-Recovery via Tool-Result Replay (2026-05-07)

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

> ⚠️ **SUPERSEDED by Phase 65 (gpt-realtime-2 migration).** The
> `_attempt_tool_result_replay` / `update_chat_ctx` cascade-recovery mechanism
> below existed only to repair Gemini 3.1's cancel-and-discard behavior. It was
> **removed from the code** in the migration (gpt-realtime-2 does not drop the
> tool result on caller speech). Retained as debugging history only.

Phase 61.2 contained the cascade (cancellation rate -80%) but did not
close the slot-hallucination failure mode. UAT call `AJ_5NcSoiaZGZTJ`
showed `check_day` returning `STATE:day_has_slots count=9` followed by
a Gemini-server stall + cancellation, then an agent regeneration that
told the caller "we don't have anything open tomorrow" — direct
inversion of the tool result. From the caller's perspective this is
worse than the pre-61.2 deadlock (an authoritative wrong answer
instead of dead air). Phase 61.3 closes this gap with one mechanism:
stall-detection + tool-result replay via `update_chat_ctx`.

### Failure mode — regeneration without tool-result context

When Gemini's server-side VAD cancels an in-flight generation that
was responding to a tool call, the next regeneration runs from a
chat context where the tool result has been consumed and discarded.
The 61.2 mute pattern prevents the user from talking over the
response (preventing CASCADE) but does not put the tool result
BACK into the chat context for the regeneration to see (preventing
INVERSION). The Gemini server provides no auto-replay mechanism
(verified at `realtime_api.py:1302-1308` — `_handle_tool_call_cancellation`
only logs and marks the generation done).

### The mechanism — stall-detection + synthetic FunctionCallOutput replay

Located in `livekit-agent/src/tools/_availability_lib.py`. New
`_attempt_tool_result_replay` async helper invoked from
`_unmute_logic()`'s `TimeoutError` branch BEFORE the listener
cleanup AND BEFORE `set_audio_enabled(True)`. Steps:

1. **Stall confirmation (D-04):** compare
   `deps["_diag_record"][0]["last_audio_frame_at"]` against
   `mute_set_at_ms` (captured the moment input was muted). If no
   audio frames advanced during the speaking window, stall is
   confirmed. (Reuses Phase 60.3 Fix C's `last_audio_frame_at`
   — D-09: no parallel tracking mechanism.)
2. **Data lookup:** read `deps["_last_tool_state"]` (set by tools
   in their return path), `deps["_last_tool_call_id"]` and
   `deps["_last_tool_name"]` (set by an extension to the existing
   `_on_tools_executed` listener that captures
   `FunctionToolsExecutedEvent.function_calls[-1]`). Null guard
   short-circuits with no replay if any are missing.
3. **Replay construction (D-05):** build a synthetic
   `livekit.agents.llm.FunctionCallOutput` with the captured
   `call_id`, `name`, and STATE+DIRECTIVE string as `output`.
   Append to a copy of `rt_session.chat_ctx.items`, then
   `await rt_session.update_chat_ctx(chat_ctx)`.
4. **Order (D-06):** replay completes (or fails) BEFORE
   `set_audio_enabled(True)`. VAD cannot fire on muted input, so
   user speech cannot race the recovery.
5. **Best-effort (D-07):** the entire replay is wrapped in
   `try/except Exception` — any failure logs and increments a
   counter; `_unmute_logic` continues to the unmute path. Replay
   failure does not block the call.

### The unlock — tool_results send is unconditional

The replay relies on a SDK invariant the original Phase 61.2
research mis-characterized:

| Old understanding | Corrected understanding (verified) |
|-------------------|-------------------------------------|
| "`mutable_chat_context=False` blocks all context updates for Gemini 3.1" | The gate at `realtime_api.py:628` only blocks the `turns` append (LiveClientContent). The `tool_results` send at `realtime_api.py:637-638` is OUTSIDE the gate and fires unconditionally — including for `gemini-3.1-flash-live-preview`. (Verified against installed livekit-plugins-google 1.5.7.) |
| "Recovery requires `generate_reply()`" | `generate_reply()` is gated for 3.1 (raises `RealtimeError` on 1.5.7); `update_chat_ctx` with a synthetic `FunctionCallOutput` triggers Gemini-server-side regeneration without it. |

The `FunctionResponse` lands on the Gemini server, which then
auto-generates a new agent turn that has the tool result in its
context — closing the slot-inversion failure mode.

### Listener-miss correction (closes 61.2-VERIFICATION.md gap #2)

Phase 61.2-VERIFICATION.md filed gap #2 as "the
`function_tools_executed` listener does not fire for the
`check_day` path." This framing is **incorrect** and is closed
here:

- The listener fires on the correct emitter
  (`session.on("function_tools_executed", ...)` — `session` is
  the `AgentSession` and the event is emitted at
  `agent_activity.py:3372`).
- What the 61.2 UAT actually showed was that the unmute came via
  the 25s safety fallback rather than via the listener-driven
  path. That happened because Gemini's server-side TTS stalled —
  the agent never transitioned `listening → speaking → listening`
  cleanly. The listener can only fire on a clean tool-execution
  cycle; if the cycle never completes, the SDK has no signal to
  emit. **The listener works as designed.**
- 61.3 ADDS recovery as a complementary structural pattern: when
  the 25s fallback fires (the "listener didn't get a clean
  cycle" signal), the replay attempts to recover. The listener
  does not need to be rebuilt or rebound.

Future phases should NOT chase the listener-miss thread — that
investigation is closed.

### Telemetry (D-08)

Two new counters extend Phase 61.2's `_ServerCancelHandler` shape
via the same conditional-emit pattern (`dict.get(key, 0) + 1`):

- `stalled_generation_recoveries` — number of times the replay
  helper attempted recovery (i.e. confirmed stall + had data to
  replay).
- `stalled_generation_replay_failed` — number of times the
  `update_chat_ctx` call raised or `rt_session` was unavailable.

Like the 61.2 counters, these keys are OMITTED from `[goodbye_race]`
JSON / Sentry breadcrumb on healthy calls (count == 0). Mere field
presence signals "stall fired on this call."

Counter values are written from `_attempt_tool_result_replay` via
`deps["_diag_record"][0]` — the same list reference shared with
`agent.py`'s `_GoodbyeDiagHandler` and `_ServerCancelHandler`.
Updates from the async helper flow into `_flush_goodbye_diag`
automatically.

### Test invariants (`livekit-agent/tests/test_cascade_recovery_invariants.py`)

Six substring-grep invariants (same shape as 61.2's
`test_tool_mute_invariants.py` — pure structural guards, no SDK
imports, no mocks, no fixtures):

| Test | Guards |
|------|--------|
| `test_replay_path_in_fallback` | `_attempt_tool_result_replay` defined and awaited inside `_unmute_logic` |
| `test_replay_uses_update_chat_ctx` | Helper calls `update_chat_ctx` and constructs `FunctionCallOutput` |
| `test_replay_not_generate_reply` | NO `generate_reply` substring in `_availability_lib.py` (gated for 3.1) |
| `test_replay_before_set_audio_enabled` | Source-order: replay invocation appears BEFORE `set_audio_enabled(True)` |
| `test_stall_recovery_counters_present` | Both new counter names present |
| `test_stall_counters_conditional_emit` | Both counters use `.get(key, 0) + 1` pattern |

Behavioral testing of the replay was deferred (D-11): mocking
`RealtimeSession.update_chat_ctx` doesn't faithfully exercise the
cascade. The D-12 live SIP UAT is the behavioral gate, matching the
61.2 deferral pattern.

### D-12 post-fix UAT verdict — call `{UAT_CALL_ID}` (UPDATE POST-UAT)

{UAT_VERDICT_TABLE_PLACEHOLDER — populate from 61.3-UAT.md after the live call. Expected
fields: server_tool_cancellations, orphaned_server_content,
stalled_generation_recoveries, stalled_generation_replay_failed,
booking_outcome, transcript inversion check.}

Pre-fix baseline for cascade-recovery verdict is the 61.2 UAT call
`AJ_5NcSoiaZGZTJ` — that call had `server_tool_cancellations=1`
AND a slot-inverted regeneration ("we don't have anything open
tomorrow" against `STATE:day_has_slots count=9`). 61.3 ships when
a similar cascade event produces `stalled_generation_recoveries >=
1` AND the agent does NOT invert the tool result.

### Memory pointer update

The user-memory entry `project_phase_61_cascade_failure_mode`
documents the structural mute pattern as the only known prevention.
61.3 ADDS the structural replay pattern as a complementary
recovery. The memory entry should be updated post-UAT to note both
layers:

- Prevention (61.2): mute caller input during tool execution +
  booking-section response window; raises fallback to 25s; adds
  `function_tools_executed` re-anchor listener; installs
  `_ServerCancelHandler` telemetry.
- Recovery (61.3): on 25s fallback fire + confirmed stall, replay
  last tool's STATE+DIRECTIVE as a synthetic `FunctionCallOutput`
  via `update_chat_ctx` BEFORE unmuting.

Together these close the slot-hallucination cascade. Future phases
that observe new failure modes after both fixes are in place should
re-measure the cascade rate against the 61.3 baseline rather than
the pre-61.2 baseline (`AJ_vV4DM5AG9t7W`).

### Deferred items (closed via re-measurement plan, not separate fixes)

- **Transcript fragmenting** (gap #3 from 61.2-VERIFICATION.md) —
  symptom of the cancel-and-regenerate cycle. Re-measure after
  61.3's recovery lands; if still present, surface as a new phase.
- **Greeting playout 10s timeout** (gap #4 from
  61.2-VERIFICATION.md) — orthogonal to the cascade (different
  code path: `_unmute_after_greeting`). Future polish phase.
- **Lowering `_TOOL_MUTE_FALLBACK_S`** — the 25s window IS the
  design; lowering it would expose more calls to the same race.
  Don't touch.

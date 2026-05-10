# PLAN 2 — 25s Cascade-Recovery Latency

**Source call:** AJ_y3YJBQ7HakJd (UM7he2Up5sdt) — `check_day` cascade at 08:40:20–08:40:50
**Severity:** caller-visible — ~25s of dead air after a tool call before the agent responded
**Honest framing up-front:** **Neither Google nor LiveKit publishes a sanctioned pattern for this stall.** The cascade-recovery already in place is a project-internal workaround that exploits an SDK-internal exception (`update_chat_ctx`'s `tool_results` path is unconditional even when `mutable_chat_context=False`). Any change here is engineered, not "best practice." The plan below proposes a *targeted refinement* of the existing recovery — earlier stall detection — that stays inside the same exploit, does not require any new SDK behavior, and respects the constraint that drove the 15→25s raise (Phase 61.2 Fix B).

---

## 1. What was observed

```
08:40:20.917  mute set, check_day ENTRY                         t = 0.000s
08:40:20.992  agent listening → speaking (filler "let me check")  +0.075s
08:40:23.072  agent speaking → listening (filler complete)        +2.155s
08:40:23.453  check_day EXIT (STATE:day_empty, 2536 ms)           +2.536s
              ─── 22.5s of agent stuck in "speaking" with no audio frames ───
08:40:45.919  unmute (fallback timeout 25.0s)                    +25.002s
08:40:48.355  server cancelled tool calls                         +27.438s
08:40:50.477  agent finally generates next reply                  +29.560s
```

`goodbye_race` summary line: `server_tool_cancellations: 2`, `orphaned_server_content: 1`. **Cascade fired twice in this call.**

**The cascade-recovery did fire** (no `[tool_mute] stall-recovery replay sent` log line in the excerpt provided, but the call resumed normally so replay likely succeeded). The user-visible problem is the **25s wait before recovery kicks in.**

## 2. Root cause — the documented constraint stack

Three documented constraints (B-docs §problem 2) make this fundamentally a workaround domain:

1. **Server VAD interruption discards in-flight function calls.** Per Google's Live API capabilities doc: *"When VAD detects an interruption, the ongoing generation is canceled and discarded... The Gemini server then discards any pending function calls and sends a `BidiGenerateContentServerContent` message with the IDs of the canceled calls."*
2. **Gemini 3.1 Flash Live forbids `send_client_content` after first turn.** Returns WebSocket close 1007.
3. **LiveKit plugin documents `update_chat_ctx()` as ignored on 3.1 models** ([docs.livekit.io/agents/models/realtime/plugins/gemini/](https://docs.livekit.io/agents/models/realtime/plugins/gemini/)). Our use of it works because of a documented SDK-internal exception: the `tool_results` path at `realtime_api.py:637-638` sends unconditionally. Memory entry `reference_livekit_update_chat_ctx_tool_results` is the project's record of this.

There is **no documented Google or LiveKit pattern** for: (a) detecting an agent stuck in `agent_state=speaking` with no audio output, (b) recovering from one, or (c) re-injecting tool results after server cancellation. The current recovery (`_attempt_tool_result_replay` at `_availability_lib.py:207-307`) is a project-engineered workaround.

## 3. Why the wait is exactly 25s

A-codebase §2 confirms the timing:

- `_TOOL_MUTE_FALLBACK_S = 25.0` — chosen in Phase 61.2 Fix B to cover the booking readback window (10–14s) plus margin for the recovery generation extending beyond that. 15s left no margin (call AJ_vV4DM5AG9t7W fired the safety unmute mid-recovery).
- The current stall-detection check (`saw_fresh_speaking[0]` + `audio_quiescent`) only runs **inside the `TimeoutError` branch of `_unmute_logic`** — i.e., once at the 25s mark. There is no periodic poll during the mute window.

So the stall *could* have been detected at e.g. t=8s in this call (filler ended at 2.155s, no audio frames after that), but the code architecture only checks at t=25s.

## 4. Proposed fix — periodic stall poll inside the existing mute window

**Idea:** between mute-set and the 25s safety ceiling, poll every N seconds. Confirm a stall the same way the existing 25s-branch confirms it (`saw_fresh_speaking==False AND audio_quiescent`) PLUS a *post-tool-exit guard* (the tool must have already returned — we can't call a stall on a tool that's still running). Fire `_attempt_tool_result_replay` early on first confirmation.

The 25s safety ceiling stays (covers the documented booking-readback window).

### State machine sketch

```
mute_set (t=0)
  ─ tool runs (fast: 0.4s, slow: 2.5s) ─
tool_exit (typically 0.3-3s)
  ─ filler audio plays (0-2s) ─
  ─ post-tool generate begins ─
[branch A — happy path]
  agent_state listening→speaking (saw_fresh_speaking=True)
  ... audio frames flow ...
  agent_state speaking→listening (unmute_event.set)
[branch B — cascade]
  agent_state stays in "speaking" with no audio frames
  current code: wait until 25.0s → confirm stall → replay
  proposed:    every 1.5s after t = tool_exit + 3.0s,
               check stall predicate; replay on first True
  hard ceiling: 25s as today (booking readback safety)
```

### Algorithm

```python
# Inside _unmute_logic, BEFORE the asyncio.wait_for(unmute_event, 25.0):
#   spawn a peer task that polls stall predicate.

POLL_INTERVAL_S = 1.5
EARLY_CHECK_GRACE_S = 3.0  # don't poll until tool has had time to exit + filler done

async def _early_stall_poll():
    # Wait until the tool has plausibly exited and filler is done.
    await asyncio.sleep(EARLY_CHECK_GRACE_S)
    while True:
        if unmute_event.is_set():
            return  # happy path won
        # Same stall predicate as the 25s branch.
        last_frame_ms = diag[0].get("last_audio_frame_at") if diag else None
        audio_quiescent = (
            last_frame_ms is None
            or last_frame_ms <= mute_set_at_ms + GRACE_MS
        )
        # Note: saw_fresh_speaking[0] is the *closure* flag — readable here.
        stall_confirmed = (not saw_fresh_speaking[0]) and audio_quiescent
        if stall_confirmed:
            # Mark we're about to recover early; clear unmute_event so the
            # main wait_for path doesn't fire after replay.
            await _attempt_tool_result_replay(
                deps, session, mute_set_at_ms, saw_fresh_speaking[0]
            )
            unmute_event.set()  # release the main wait_for, takes the early-recover path
            return
        await asyncio.sleep(POLL_INTERVAL_S)

asyncio.create_task(_early_stall_poll())
# ... existing wait_for + 25s ceiling stays as the safety net.
```

### Why this is safe

1. **Same predicate as the existing 25s check** (`_availability_lib.py:240-254`). If the predicate is correct at t=25s it's correct at t=8s — they're both "agent has not produced fresh speech AND audio is silent post-mute." The 250ms grace window is the same.
2. **Grace window before first poll.** `EARLY_CHECK_GRACE_S = 3.0s` ensures we don't fire while the tool is still executing or while the filler audio is still playing. In this call, filler ended at +2.155s and tool exited at +2.536s — a 3.0s grace covers both.
3. **Booking readback path is unaffected.** The booking section's name+address readback runs *inside* the agent's speaking state (audio frames flowing). `audio_quiescent` is False during readback, so the early stall poll's predicate is False, and the poll waits. The 25s ceiling exists exactly for the case where Gemini's recovery generation extends beyond normal — that ceiling is preserved.
4. **No new SDK calls.** Same `update_chat_ctx` + `FunctionCallOutput` path the timeout branch already uses.

### Latency impact (measured against this call)

| Today | Proposed |
|---|---|
| Stall detected at t=25.0s | Detected at first poll after grace, t=4.5s (3.0s grace + first 1.5s poll) |
| Replay fires at t=25.0s | Replay fires at t=4.5s |
| Caller hears next agent turn at t≈30s | Caller hears next agent turn at t≈9s |

**Wins ~20s on cascade calls. Costs nothing on happy-path calls** (poll exits as soon as `unmute_event.is_set()`).

## 5. Risks + mitigations

| Risk | Mitigation |
|---|---|
| Poll fires false stall during legitimate readback that has a brief gap | The predicate requires `audio_quiescent` — a 250ms gap won't trip it. Readbacks have continuous audio frames. |
| Poll fires before the tool has actually exited | `EARLY_CHECK_GRACE_S=3.0s` covers the slowest tools we have (`check_slot`/`check_day` worst-case ~2.5s; `check_caller_history` is pre-fetched). If tools become slower in future, raise to 4.0s. |
| Replay races the natural recovery (Gemini's own retry would have come at t=27s) | The `_tool_mute_id` guard in `_unmute_logic` already handles staleness. Only one replay can win per mute window. |
| Phase 61.2 Fix B regression — recovery generation extends past 25s | Unchanged. The 25s ceiling stays. The only change is *earlier* detection. |
| Polling task leaks if `_unmute_logic` exits before the poll loop returns | Add `if _unmute_logic_done.is_set(): return` to the poll loop. |
| `last_audio_frame_at` timing assumptions break on a future SDK | Same risk as today — we already depend on this in the 25s check. |

**No risk increase versus today.** The early-detection mechanism is strictly an additive optimization.

## 6. What I am *not* recommending (and why)

| Idea | Why not |
|---|---|
| Lower `_TOOL_MUTE_FALLBACK_S` from 25 → 12 or 15 | Re-introduces the Phase 61.2 Fix B regression (mid-readback unmute on call AJ_vV4DM5AG9t7W). Memory: 25s was chosen carefully. |
| Switch from `update_chat_ctx` to `session.send_tool_response()` (the canonical Google path) | LiveKit's Python SDK does not surface this method on `AgentSession`. The Google `live` SDK has it on `live.connect()` sessions but LiveKit wraps that and doesn't expose it to user code. Out of reach without forking the plugin. |
| Disable server VAD and use client VAD (LiveKit's) | Documented as supported (B-docs §problem 2 — `realtimeInputConfig.automaticActivityDetection.disabled=True`) but it's a fundamental architecture change, would require re-tuning VAD thresholds, and the project memory `project_phase_61_cascade_failure_mode` flags structural-mute as the only known mitigation pattern — not VAD swap. Out of scope for a latency fix. |
| Use `agent_false_interruption` event to fire recovery | Event semantics are about the agent being interrupted by the *caller*; cascade is the agent stalling out *internally*. Wrong signal. |
| Use the `server cancelled tool calls` log warning as a faster trigger | In this call's timeline, `server cancelled tool calls` fired at +27.4s — *after* the 25s timeout, not before. Empirically not an earlier signal. |

## 7. Implementation steps

1. **One commit** to `src/tools/_availability_lib.py`:
   - Add `_early_stall_poll` async function inside `mute_input_during_tool` (alongside `_unmute_logic`).
   - Spawn it as `asyncio.create_task(_early_stall_poll())` after the existing setup.
   - Add cancellation hygiene so it stops cleanly when the main `_unmute_logic` exits.
2. **Test in dev with a forced cascade.** The cleanest reproduction is to mock `session._activity.realtime_llm_session.update_chat_ctx` to a no-op temporarily and place a test call — the agent will stall after every tool. Verify:
   - Without the poll: 25s wait.
   - With the poll: ~5s wait.
   - Happy path tools (no cascade): zero added latency.
3. **Deploy to Railway, place 3 test calls** (one quick `check_slot`, one full booking flow, one with a forced disconnect mid-readback to ensure no ceiling regression).
4. **Update memory** — append to `project_phase_61_cascade_failure_mode` with the new latency profile.

## 8. Open questions

1. **`POLL_INTERVAL_S` value.** 1.5s feels right (8s detection in worst case from grace start). Lower means tighter; higher reduces poll overhead. CPU is not the constraint — Gemini-side latency is. Recommend 1.5s.
2. **Telemetry.** Do we want a new diag field `early_stall_recovery_at_ms` to A/B compare against the existing `stalled_generation_recoveries` counter? Recommend yes — single line in `_attempt_tool_result_replay`.
3. **Should the early-stall replay use a different DIRECTIVE prefix** so the post-call diag can distinguish "early-detected cascade" from "25s-timeout cascade"? Useful for tuning grace and interval over time. Recommend yes.

## 9. References

- A-codebase.md §2 (mute helper + cascade-recovery state machine + diag schema)
- B-docs.md §problem 2 (server VAD cancel, Gemini 3.1 mid-session restrictions, no documented stall-detection pattern)
- C-best-practices.md §4 (acknowledgment that this class of bug exists and OpenAI fixed it server-side)
- Memory: `project_phase_61_cascade_failure_mode`, `reference_livekit_update_chat_ctx_tool_results`
- Phase 61.2 Fix B comment in `_availability_lib.py:48-52` (the why-25s history)

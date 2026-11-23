---
type: system
system: Voice Agent
status: historical
description: "The first Phase 61 production regression after 61.1 shipped (call Covers: Failure mode — server-side VAD cancellation cascade; Wave 1 fixes (livekit-agent commits 93dd4b5, 1afde0e, 1b636bc, c66e435); Test invariants (`livekit-agent/tests/test_tool_mute_invariants.py`, commit c66e435); D-12 post-fix "
source: .claude/skills/voice-call-architecture/SKILL.md § Phase 61.2 — Gemini-Server Cancellation Cascade Mitigation (2026-05-06)
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# Phase 61.2 - Gemini-Server Cancellation Cascade Mitigation (2026-05-06)

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

> ⚠️ **SUPERSEDED by Phase 65 (gpt-realtime-2 migration).** Everything below
> mitigated Gemini 3.1 Flash Live's server-side VAD cancellation cascade.
> gpt-realtime-2 has native async function calling — in-flight tool calls are
> NOT cancelled on caller speech — so the root cause is gone. The mechanisms
> described here (`mute_input_during_tool`, the robust-unmute lifecycle,
> `_ServerCancelHandler`) were **removed from the code** in the migration.
> Retained as debugging history only.

The first Phase 61 production regression after 61.1 shipped (call
`AJ_vV4DM5AG9t7W`, 2026-05-05 11:04 UTC, tenant "make it ai", caller
+65XXXXXXXX, 132s, `outcome=not_attempted`, `tool_call_log_tail: []`)
was filed under the hypothesis "zero tool invocations + slot
fabrication." The pre-fix UAT (D-09) **did not reproduce that
hypothesis.** Tools fire. The actual failure is structural in the
LiveKit / Gemini Realtime stack, not in the prompt.

### Failure mode — server-side VAD cancellation cascade

Gemini 3.1 Flash Live performs server-side VAD on the inbound audio
stream and cancels in-flight generation + discards pending function
calls when caller speech is detected — including very brief utterances
("Hello.") that fall well below the configured
`silence_duration_ms=2500`. The agent's response to a tool result can
be cancelled mid-sentence; the next generation regenerates from a
context where the tool result has already been consumed and discarded.
The user-visible symptoms are:

- Fragmented agent speech (turns split mid-sentence; continuation
  turns starting with leading double-spaces).
- Cascading cancellations (one cancel triggers a recovery generation
  which is itself cancelled by the next caller turn; pre-fix baseline
  was 5 cancellations in 230s).
- Silent recovery deadlocks (the cancelled generation and the recovery
  generation both fail to produce a clean speak/listen cycle).

The original Phase 61.2 hypothesis (zero tool invocations + slot
fabrication) was symptomatic of this cascade — `tool_call_log_tail: []`
in the baseline call reflected tool calls that fired but were
server-cancelled before they could be logged via the goodbye diag.

### Wave 1 fixes (livekit-agent commits 93dd4b5, 1afde0e, 1b636bc, c66e435)

**Fix A — Mute pattern extension**
(`livekit-agent/src/tools/{check_caller_history,check_customer_account,capture_lead}.py`,
commit `93dd4b5`): The `mute_input_during_tool` helper from
`_availability_lib.py` was previously called only by the four
availability/booking tools. Phase 61.2 extends it to the three
data-fetch tools that run BLOCKING Supabase / HTTP I/O. Each new call
site is the FIRST I/O-touching statement in its function body,
mirroring the `check_day.py:61` reference shape, with a Phase
61.2-anchored comment pointing back to `61.2-RESEARCH.md` § 4 fix A.
`transfer_call` and `end_call` remain intentionally untouched —
muting during teardown could mask the caller-cancellation signal.

**Fix B — Robust unmute lifecycle**
(`livekit-agent/src/tools/_availability_lib.py`, commit `1afde0e`):
Two surgical changes to `mute_input_during_tool`:
1. `_TOOL_MUTE_FALLBACK_S` raised from 15.0s to 25.0s. The
   booking-section name+address readback runs 10-14s; on a
   server-cancelled call the recovery generation may extend further.
   15s left no margin and the safety unmute fired mid-recovery.
2. New `_on_tools_executed` listener subscribed via
   `session.on("function_tools_executed", ...)` immediately after the
   existing `agent_state_changed` listener. Resets
   `saw_fresh_speaking[0] = False` on each fresh tool execution
   during the mute window, re-anchoring the unmute on the recovery
   generation's clean speak/listen cycle rather than on the
   cancelled original. Symmetric cleanup unsubscribes both pyee
   surfaces (`off` + `remove_listener`) in `_unmute_logic()`'s
   finally block.

**Fix C — Server-cancellation telemetry**
(`livekit-agent/src/agent.py`, commit `1b636bc`): New
`_ServerCancelHandler(logging.Handler)` mirrors the
`_GoodbyeDiagHandler` shape from Phase 60.3 (constructor takes
`diag_record` list-of-1, try/except no-raise contract, per-call
install + finally-block cleanup). Installed on BOTH
`livekit.plugins.google.realtime` (where Gemini-Live emits the
warnings today) AND parent `livekit.plugins.google` (defensive
fallback for SDK namespace shifts). Watches two warning substrings:

- `"server cancelled tool calls"` →
  `_diag_record[0]["server_tool_cancellations"] += 1`
- `"received server content but no active generation"` →
  `_diag_record[0]["orphaned_server_content"] += 1`

Counters use lazy default-zero `dict.get(key, 0) + 1` so the fields
are OMITTED on healthy calls — mere field presence in the
`[goodbye_race]` JSON line + Sentry breadcrumb signals "cascade fired
on this call." Pure observability — zero behavior change.

### Test invariants (`livekit-agent/tests/test_tool_mute_invariants.py`, commit c66e435)

5 substring-grep pytest tests (101 lines) lock the structural pattern
against silent regression. Pattern follows
`tests/test_no_generate_reply_in_src.py` from Phase 63.1 — open source
files as text via `Path.read_text(encoding='utf-8')`, assert/refute
keyword presence; no SDK imports, no mocks, no fixtures.

| Test | Guards |
|------|--------|
| `test_data_fetch_tools_mute` | All 6 tools (3 Plan-02 additions + 3 pre-existing availability tools) call `mute_input_during_tool` |
| `test_terminal_tools_do_not_mute` | `transfer_call.py` and `end_call.py` do NOT call it (negative invariant) |
| `test_unmute_fallback_at_least_25s` | `_TOOL_MUTE_FALLBACK_S` regex-extracted, FLOOR (≥ 25.0) — tolerates future raises |
| `test_function_tools_executed_listener` | `_availability_lib.py` contains `function_tools_executed` substring |
| `test_server_cancel_handler_installed` | `agent.py` contains `class _ServerCancelHandler`, `livekit.plugins.google.realtime`, `server_tool_cancellations`, `orphaned_server_content` |

Suite delta: +5 passed / 0 new failures (pre-Plan-05 baseline 282
passed/11 failed at HEAD `1b636bc`; post-Plan-05 287/11). The 11
pre-existing failures from 60.3 / 60.4 / 63.1 prompt-builder drift
are tracked in `deferred-items.md` as out of scope.

### D-12 post-fix UAT verdict — gap (call AJ_5NcSoiaZGZTJ)

A live SIP call placed against the test tenant after Wave 1 deployed
to Railway (worker `AW_jUYX6EriSybE`, livekit-agents 1.5.7,
registered 07:59:29 UTC; 202s, `outcome=not_attempted`,
CLIENT_INITIATED) produced the following telemetry from Fix C:

| Field | Pre-fix baseline (`AJ_vV4DM5AG9t7W`) | Post-fix (`AJ_5NcSoiaZGZTJ`) | Delta |
|-------|--------------------------------------|------------------------------|-------|
| `server_tool_cancellations` | 5 (3 logged + 2 inferred) | 1 | **-80%** |
| `orphaned_server_content` | 1 | 1 | flat |
| Total cascade events | 5 | 2 | **-60%** |

**The cascade is structurally contained but a new failure mode
surfaced.** D-12-rev verdict: 1 of 3 criteria pass (`gap`).

- ✅ Cascade rate strictly < 5 (2 < 5).
- ✗ Transcript fragmenting still present — 1 leading-double-space
  pair + 1 self-restart pair (`"Let me see what that day looks like
  for you. Give me just a second to check that day."`) consistent
  with cancel-and-regenerate.
- ✗ No booking and no clean lead-capture — **slot hallucination after
  cancellation** (see below).

### NEW failure mode — slot hallucination after cancellation

`check_day` returned `STATE:day_has_slots date_label=Thursday, May
7th count=9` at 08:05:46. After the 1 server-cancellation at 08:06:14
(function_call_id `fc_15328661595426966818`) and the 25s mute
fallback at 08:06:08, the regenerated agent response told the
caller: **"it looks like we don't have anything open tomorrow"** —
directly contradicting the tool result.

The cascade is structurally contained (no deadlock — the agent
successfully regenerated 23 seconds after the server-cancel), but the
residual cascade now produces a **slot inversion** instead of a
recovery deadlock. From the caller's perspective this is worse than
the pre-fix deadlock — they get an answer, but it's wrong. The
working hypothesis is that when the agent's response to `check_day`
is cancelled and regenerated, the regeneration runs from a context
where the tool result has already been consumed/discarded, and the
model fills in plausible-sounding text — including text that inverts
the tool's STATE. **Triaged to Phase 61.3** (highest severity).

### NEW finding — Plan 03 listener-missed regression

The `mute_input_during_tool` unmute log line on the post-fix call
read:

```
[tool_mute] unmuted input id=1 (fallback timeout 25.0s)
```

The unmute came via the 25s fallback timer, **not** via the
`function_tools_executed` re-anchor listener Plan 03 added. The 15→25s
raise correctly absorbed the cascade window (the call did not
deadlock), but the listener as currently registered does not catch
the event for the `check_day` path. The 25s fallback covered for it
this time; **triaged to Phase 61.3** to investigate which
emitter/event the listener should bind to.

### SDK 1.5.7 note (cross-link to Phase 63.2)

`livekit-agents==1.5.7` ships `fix: realtime reply generation after
interruption` (one-line `return` in
`agent_activity._realtime_reply_task:2811`) — addresses a downstream
client-side symptom, NOT the upstream Gemini-server cancel-and-discard
behavior. PR #5535 / #5594 add a pausable-output mechanism but
require opt-in via `RoomOutputOptions` and `can_pause`-capable
output (deferred from 61.2 scope; future spike).

### Phase 61.3 forward-pointer

Three closure items, in severity order:

1. **Slot-hallucination-after-cancellation** (highest severity) —
   when the agent's response to `check_day` is cancelled and
   regenerated from stale/cleared context, it inverts the tool
   result. Likely fixes: on `function_call_cancelled`, inject a
   synthetic user turn that re-states the last successful tool's
   STATE so the regenerated response sees ground truth; OR mark the
   tool result as "must-include" in the regeneration context.
   Investigation in `agent.py` `_ServerCancelHandler` — escalate
   from telemetry to recovery action.
2. **Fix B listener wiring** — `function_tools_executed` did not
   fire for the `check_day` path. Investigate which event/emitter
   the listener should bind to, and whether `_TOOL_MUTE_FALLBACK_S`
   should be tuned (25s feels long when the caller is silent).
3. **Greeting playout timeout robustness** — Call 2 of the post-fix
   UAT (`AJ_dTnDR7CQo8vD`, 37s) timed out on greeting playout
   (`[63.1-07] greeting playout wait timed out at 10s; force-unmuting
   input`). Pre-existing fragility in `wait_for_playout()` when SIP
   audio drops mid-playout. Plan: extend the timeout failure path so
   the agent is robust to partial-audio greetings (consider awaiting
   only first-frame-sent rather than full playout).

### Lessons learned

- **Prompt edits cannot prevent server-side VAD cancellations on
  Gemini 3.1 Flash Live.** The structural mute pattern is the only
  known mitigation today (see user memory
  `project_phase_61_cascade_failure_mode.md`).
- **Cascade-mitigation is necessary but not sufficient.** Containing
  the cascade rate (5→2, -60%) eliminates recovery deadlocks but can
  unmask a slot-hallucination failure mode where the regenerated
  response runs without the tool result in context. Telemetry now
  exists (Fix C) so future regressions in this area land with
  quantitative evidence rather than transcript-tail snapshots.
- **Net-positive structural progress is worth shipping even when
  verdict=gap.** Wave 1 fixes stay on `livekit-agent/main` because
  they cut cascade rate by 60% and provide the measurement
  instrument Phase 61.3 will use to verify its hypothesis-driven
  fixes.

### Wave 1 commits (livekit-agent main)

- `93dd4b5` — `fix(61.2-A): mute input during BLOCKING data-fetch tools`
- `1afde0e` — `fix(61.2-B): robust unmute lifecycle for multi-step Gemini recovery`
- `1b636bc` — `fix(61.2-C): server-cancellation telemetry on goodbye diag record`
- `c66e435` — `test(61.2): static invariants locking Fix A/B/C against regression`

Pre-fix baseline call: `AJ_vV4DM5AG9t7W` (5 cascade events / 230s,
recovery deadlock). Post-fix verification call: `AJ_5NcSoiaZGZTJ`
(2 cascade events / 202s, slot hallucination — triaged to 61.3).

---

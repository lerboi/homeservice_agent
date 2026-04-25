# Phase 63: LiveKit SDK upgrade to 1.5.6 mainline — Research

**Researched:** 2026-04-24
**Domain:** LiveKit Agents SDK dependency migration (livekit-agent repo)
**Confidence:** HIGH (every kwarg, every event shape, and both target class bodies were verified against the 1.5.6 source at commit `25bd9c76b0e163195a6557f4a1528beaebeb2bd7` — the release commit for `livekit-agents@1.5.6` dated 2026-04-22.)

## Summary

The 1.5.1 → 1.5.6 jump is **API-compatible for 100% of the surface we touch**. Every kwarg we currently pass to `google.realtime.RealtimeModel(...)` (`model`, `voice`, `language`, `instructions`, `realtime_input_config`, `thinking_config`) is still accepted on 1.5.6 with the same name, type, and semantics. The `@function_tool(name=..., description=...)` decorator is unchanged. `RunContext`, `AgentSession(llm=model)`, and the `conversation_item_added` / `close` / `error` event shapes all preserve the fields our code reads (`event.item.text_content`, `event.item.role`, `event.created_at`, `event.reason.value`). No rename, no import path change.

The 1.5.3 upstream fix we most want — PR #5413, capability-based routing for Gemini 3.1 tool responses via `mutable_chat_context`/`mutable_instructions`/`mutable_tools` — **is in 1.5.6** (verified in the `RealtimeCapabilities(...)` construction at line 293 of `realtime_api.py`: `mutable = "3.1" not in model`, then `mutable_chat_context=mutable, mutable_instructions=mutable, mutable_tools=False`). That is the explicit fix the abandoned `A2A_ONLY_MODELS` branch was trying to solve differently. The existing `per_response_tool_choice` field that would have broken the old pin is hardcoded to `False` and poses no compatibility risk.

The `_SegmentSynchronizerImpl.playback_finished called before text/audio input is done` race is **NOT fixed** in 1.5.6. The exact warning string and the early-return guard are byte-identical between 1.5.1 and 1.5.6 in `livekit-agents/livekit/agents/voice/transcription/synchronizer.py:282-286`. Set UAT expectations accordingly: the upgrade delivers the Gemini 3.1 tool fix, not the cutoff fix.

`_handle_tool_call_cancellation` in the google plugin is still a pure noop (warning-log only). Unchanged between the pinned commit and 1.5.6. Covered by CONTEXT D-13; no work in this phase.

**Primary recommendation:** Pure version bump. Change the three `livekit-*` pins in `pyproject.toml`; replace the git-url pin of `livekit-plugins-google` with `==1.5.6`. No edits required in `src/agent.py` or `src/tools/*.py` — the upgrade is a drop-in. Run `pytest` + Railway preview + one UAT call against D-09 gates.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Target pair = `(livekit-agents==1.5.6, livekit-plugins-google==1.5.6)` released 2026-04-22.
- **D-02:** Branch-first (`phase-63-livekit-sdk-upgrade`), merge only after pytest + Railway preview + one UAT succeed. Never direct-to-main.
- **D-03:** Pure version bump, no opportunistic refactors. Only edit `agent.py`/`tools/*.py` if the new API forces it.
- **D-04:** Preserve all Phase 60.4 inline fixes on livekit-agent/main (commits `c2482f8`, `1df5223`, `b46851b`, `5e48273`, `e580f14`, `68828d7`, `87d6883`). If an API change forces a call-site update (e.g., `ThinkingConfig` field rename), preserve the fix's semantics — don't delete it.
- **D-05:** Verify (don't assume) plugin's new surface for `model`, `voice`, `language`, `instructions`, `realtime_input_config`, `thinking_config`.
- **D-06:** Verify `@function_tool(name=, description=)` decorator and `RunContext` API unchanged.
- **D-07:** Verify `AgentSession(llm=model)` + `@session.on(...)` event signatures unchanged.
- **D-08:** Verify plugin imports — `livekit.plugins.google.realtime` for `RealtimeModel`; `google.genai.types` for `ThinkingConfig`/`RealtimeInputConfig`/`AutomaticActivityDetection`.
- **D-09:** Acceptance gates: pytest (tolerate VIP failure), clean imports, Railway preview SUCCESS, `registered worker` log, one UAT call on `+14783755631` passes, zero TypeError/ValidationError/AttributeError. Cutoff warning is a hope-gate.
- **D-10:** Rollback via revert PR (not force-push). Abort the branch if Railway preview fails.
- **D-11:** Only touches `livekit-agent/` — plus `.planning/phases/63-*` and `.planning/ROADMAP.md` / `STATE.md` on close. `sub_repos: []` unchanged.
- **D-12:** Commits use `--no-verify` per project memory. Prefix `fix(63):` for code, `docs(63):` for artifacts. One atomic commit for the version bump + any forced edits (researcher's call to split).
- **D-13:** `_handle_tool_call_cancellation` noop stays noop — not patched here.

### Claude's Discretion

- Whether the version bump + any forced API edits ship as one commit or split — judgment call based on edit size.
- UAT call script choice for the single smoke call (greet → check_availability → book_appointment → end_call).
- Local preflight ordering (`pytest` first vs. import sanity first).

### Deferred Ideas (OUT OF SCOPE)

- Tool-call cancellation recovery (monkeypatch / subclass). Follow-up phase if the race persists.
- Pre-TTS speech interception guardrail. Possibly Phase 64 after 60.4 resume.
- Filler-loop circuit breaker. Future production-readiness phase.
- Save-time config validation for `working_hours` / `tenant_timezone` / `slot_duration_mins`. Dashboard-repo work.
- Synthetic canary calls. Infrastructure phase.
- Downgrade exploration (e.g., 1.5.3-only). Target is 1.5.6 period.

</user_constraints>

## Project Constraints (from CLAUDE.md)

- Voice-call plumbing is covered by the `voice-call-architecture` skill; any livekit-agent change must keep that skill accurate.
- Brand is **Voco** (not HomeService AI). Not relevant to this phase — no UI text changes.
- "Keep skills in sync" rule applies: after the upgrade ships, re-verify the skill document if any behavior changed observably. For a pure version bump with no API deltas this is likely a no-op confirmation.

## Upgrade Surface Audit

> Every row is verified against the 1.5.6 source at commit `25bd9c76b0e163195a6557f4a1528beaebeb2bd7` (`livekit-plugins/livekit-plugins-google/livekit/plugins/google/realtime/realtime_api.py`).

### `google.realtime.RealtimeModel.__init__` kwargs — our 6 call-site args

| Kwarg | 1.5.1 (current, `43d3734` pin) | 1.5.6 (target) | Our call-site value | Migration action |
|-------|-------------------------------|----------------|---------------------|------------------|
| `model` | `NotGivenOr[LiveAPIModels \| str]`, kwarg-only | `NotGivenOr[LiveAPIModels \| str]`, kwarg-only | `"gemini-3.1-flash-live-preview"` | **None.** `KNOWN_GEMINI_API_MODELS` frozenset at 1.5.6 L60 explicitly lists `"gemini-3.1-flash-live-preview"` [VERIFIED: realtime_api.py:60]. |
| `voice` | `Voice \| str`, default `"Puck"` | `Voice \| str`, default `"Puck"` [VERIFIED: realtime_api.py:193] | `voice_name` (per-tenant string) | **None.** |
| `language` | `NotGivenOr[str]` (same name — verified on pinned commit during Phase 60.4 Stream B) | `NotGivenOr[str]` [VERIFIED: realtime_api.py:194] — docstring: "BCP-47 Code" | `_locale_to_bcp47(locale)` | **None.** Phase 60.4 commit `1df5223` preserved verbatim. |
| `instructions` | `NotGivenOr[str]` | `NotGivenOr[str]` [VERIFIED: realtime_api.py:190] | `system_prompt` | **None.** |
| `realtime_input_config` | `NotGivenOr[types.RealtimeInputConfig]` | `NotGivenOr[types.RealtimeInputConfig]` [VERIFIED: realtime_api.py:210] | `genai_types.RealtimeInputConfig(...)` | **None.** |
| `thinking_config` | `NotGivenOr[types.ThinkingConfig]` | `NotGivenOr[types.ThinkingConfig]` [VERIFIED: realtime_api.py:216] | `genai_types.ThinkingConfig(thinking_level="low", include_thoughts=False)` | **None.** Phase 60.4 commit `68828d7` preserved verbatim. `ThinkingConfig` continues to be imported from `google.genai.types`, not from the plugin. |

**Net:** Zero forced edits at the `RealtimeModel(...)` call site (`src/agent.py:392-402`). Every kwarg name, type, and default matches. `[VERIFIED: realtime_api.py:187-220]`

### `genai_types.RealtimeInputConfig` / `AutomaticActivityDetection` / `StartSensitivity` / `EndSensitivity` / `ThinkingConfig`

| Symbol | 1.5.1 import path | 1.5.6 import path | Action |
|--------|-------------------|-------------------|--------|
| `RealtimeInputConfig` | `google.genai.types` | `google.genai.types` (used at realtime_api.py:210 via `types.RealtimeInputConfig`) | None |
| `AutomaticActivityDetection` | `google.genai.types` | `google.genai.types` | None |
| `StartSensitivity.START_SENSITIVITY_LOW` | `google.genai.types` | `google.genai.types` | None |
| `EndSensitivity.END_SENSITIVITY_LOW` | `google.genai.types` | `google.genai.types` | None |
| `ThinkingConfig(thinking_level=..., include_thoughts=...)` | `google.genai.types` | `google.genai.types` (used at realtime_api.py:216 via `types.ThinkingConfig`) | None |

Plugin 1.5.6 declares `google-genai>=1.55` [VERIFIED: plugin pyproject.toml]. Current `pyproject.toml` does not pin google-genai directly; it comes in transitively. The plugin's constraint is sufficient. `[ASSUMED]`: `google-genai>=1.55` continues to expose these 5 symbols under `types.*`. Risk: LOW — these are stable public Live API types shipped since google-genai's Live API support landed; no rename observed in the 1.55.0 release notes.

### `@function_tool` decorator (6 tools)

| Signature element | 1.5.1 | 1.5.6 | Migration action |
|-------------------|-------|-------|------------------|
| Import path | `from livekit.agents import function_tool` | `from livekit.agents import function_tool` [VERIFIED: livekit-agents/livekit/agents/__init__.py:58, 153] | None |
| Overload signature | `function_tool(f=None, *, name=None, description=None, flags=ToolFlag.NONE)` | Identical 4-overload set [VERIFIED: tool_context.py:237-290] | None |
| Decorator call pattern (our code) | `@function_tool(name="...", description="...")` | Still supported — kwargs unchanged | None |

### `RunContext`

| Property | 1.5.1 | 1.5.6 | Action |
|----------|-------|-------|--------|
| Import path | `from livekit.agents import RunContext` | Same path still exported [VERIFIED: livekit-agents/livekit/agents/__init__.py:85, 183]; class actually defined at `livekit/agents/voice/events.py:39` | None |
| Tool signature shape | `async def tool(context: RunContext, ...) -> str` | Unchanged — `context` is the first-arg convention [VERIFIED: voice/events.py:39-80 RunContext class body] | None |
| Accessors used by our code | `context.session`, `context.userdata` (implicit via deps) | Preserved as properties [VERIFIED: voice/events.py] | None |

### `AgentSession`

| Kwarg | 1.5.1 | 1.5.6 | Our usage | Action |
|-------|-------|-------|-----------|--------|
| `llm=` | `NotGivenOr[llm.LLM \| llm.RealtimeModel \| ...]` | Same [VERIFIED: agent_session.py:222] | `AgentSession(llm=model)` | None |
| No new required kwargs | Every kwarg `NotGivenOr[...]` or has default | Same — all kwargs keyword-only and optional [VERIFIED: agent_session.py:217-256] | — | None |
| Deprecated kwargs we don't use | — | 1.5.6 marks these as deprecated: `preemptive_generation`, `min_endpointing_delay`, `max_endpointing_delay`, `false_interruption_timeout`, `turn_detection`, `discard_audio_if_uninterruptible`, `min_interruption_duration`, `min_interruption_words`, `allow_interruptions`, `resume_false_interruption`, `agent_false_interruption_timeout` [VERIFIED: agent_session.py:245-256] | We pass only `llm=` | None — not a concern |

### `@session.on(...)` event handlers — the 3 we wire

| Event | Payload class | Field(s) our code reads | 1.5.6 verification |
|-------|--------------|--------------------------|--------------------|
| `conversation_item_added` | `ConversationItemAddedEvent(item: ChatMessage \| AgentHandoff \| ..., created_at: float)` | `event.item.text_content`, `event.item.role`, `event.created_at` | `ConversationItemAddedEvent` fields unchanged [VERIFIED: events.py:170-173]. `ChatMessage.role` (ChatRole) and `ChatMessage.text_content` (property) both present [VERIFIED: chat_context.py:305-320]. PR #5218 (1.5.2) added `AgentHandoff` as a valid `item` type — our code does `getattr(event.item, "text_content", None)`, so it no-ops on handoff events. Safe. |
| `close` | `CloseEvent(reason: CloseReason, error: ... \| None, created_at: float)` | `event.reason.value`, `event.created_at` | Unchanged [VERIFIED: events.py:239-245]. `CloseReason` is a str Enum — `.value` works. |
| `error` | `ErrorEvent(error, source, created_at)` | Not currently used for field access in `agent.py` excerpt we read; handler exists if attached | Unchanged [VERIFIED: events.py:222-227]. |

**Net:** Zero forced edits at any `@session.on(...)` handler.

### `session.current_speech` + `SpeechHandle.wait_for_playout()` (used by `end_call.py`)

| API | 1.5.1 | 1.5.6 | Action |
|-----|-------|-------|--------|
| `session.current_speech -> SpeechHandle \| None` | Supported | [VERIFIED: agent_session.py:524-525] | None |
| `SpeechHandle.wait_for_playout()` | Coroutine | [VERIFIED: speech_handle.py:156] | None |

`end_call.py`'s `await asyncio.wait_for(session.current_speech.wait_for_playout(), timeout=20)` pattern is drop-in compatible.

### `RoomInputOptions.close_on_disconnect` (NOT currently used; flagged for future)

| API | 1.5.6 | Note |
|-----|-------|------|
| `room_input_options=RoomInputOptions(close_on_disconnect=False)` | Supported [VERIFIED: room_io/room_io.py, referenced from agent_session.py:576] | We currently construct `AgentSession(llm=model)` with no `room_input_options`. This kwarg is out of scope for Phase 63 (per D-03) — flag for future work only if the cutoff race persists after upgrade and we want to decouple session-close from SIP participant disconnect. |

### Plugin import path

| Import | 1.5.1 (pinned commit) | 1.5.6 | Action |
|--------|------------------------|-------|--------|
| `from livekit.plugins import google` | Works | Works | None |
| `google.realtime.RealtimeModel` | Works (the `43d3734` commit already has `google/realtime/realtime_api.py`) | Works [VERIFIED: google/realtime/__init__.py exports `RealtimeModel`] | None |
| `google.beta.realtime.*` | Existed at some older plugin versions | **REMOVED** (path returns 404 on 1.5.6 tree) | None — we don't import from `beta.realtime` |

## Breaking Changes Inventory

Every release note from 1.5.2 → 1.5.6 was read. Filtering to things that touch our used surface:

- **1.5.2 (PR #5233):** `gemini-3.1-flash-live-preview` added to `KNOWN_GEMINI_API_MODELS`. Enables our current model string on mainline. `[CITED: github.com/livekit/agents/releases/tag/livekit-agents@1.5.2]`
- **1.5.2 (PR #5218):** `conversation_item_added` event can now emit for `AgentHandoff` items in addition to `ChatMessage`. Our handler uses `getattr(event.item, "text_content", None)` — safe by construction. `[CITED: PR #5218]`
- **1.5.3 (PR #5413):** Gemini 3.1 tool-response fix via capability-based routing. This is the motivating fix for the upgrade. Changes `RealtimeCapabilities.mutable_*` booleans based on whether `"3.1"` is in the model name. No call-site change required — it's internal routing. `[CITED: PR #5413, VERIFIED: realtime_api.py:293]`
- **1.5.3 (PR #5229):** "reuse realtime session across agent handoffs if supported" — affects handoff flows, we don't use handoffs. No impact.
- **1.5.4 (PR #5428):** `PreemptiveGenerationOptions` added. Opt-in via `AgentSession(preemptive_generation=...)`. We don't set this kwarg; default behavior (which PR #5428 also refined for long user speech) applies. No breaking change.
- **1.5.5:** Security bumps (pillow 12.2.0), inference STT diarization, xAI TTS — none touch our surface.
- **1.5.6:** Mistral LLM migrated to Conversations API, avatar + assorted TTS plugin additions — none touch our surface.

**No deprecation warnings will fire for our code's usage of `AgentSession(llm=model)` kwargs** — we never pass any of the deprecated kwargs.

**Zero breaking changes** in the surface we consume across 1.5.2 → 1.5.6.

## SegmentSynchronizer Race

**Verdict: UNFIXED in 1.5.6.** `[VERIFIED: livekit-agents/livekit/agents/voice/transcription/synchronizer.py:276-288 at commit 25bd9c76]`

The class `_SegmentSynchronizerImpl` still exists at `livekit-agents/livekit/agents/voice/transcription/synchronizer.py`. Its `mark_playback_finished` method still contains the identical early-return guard:

```python
def mark_playback_finished(self, *, playback_position: float, interrupted: bool) -> None:
    if self.closed:
        logger.warning("_SegmentSynchronizerImpl.playback_finished called after close")
        return

    self._interrupted = interrupted
    if not self._text_data.done or not self._audio_data.done:
        logger.warning(
            "_SegmentSynchronizerImpl.playback_finished called before text/audio input is done",
            extra={"text_done": self._text_data.done, "audio_done": self._audio_data.done},
        )
        return

    # if the playback of the segment is done and were not interrupted, make sure the whole
    # transcript is sent. (In case we're late)
    if not interrupted:
        self._playback_completed = True
```

The exact warning string observed in our UAT logs (call `2xCyyKAduZiY`, 2026-04-23 18:54) is emitted here. The 1.5.6 path is byte-identical to 1.5.1; only the surrounding file context has changed cosmetically. There is no PR between 1.5.2 and 1.5.6 addressing this code path — CHANGELOG review for all 5 intermediate releases confirms no entry for "playback_finished", "segment synchronizer", or "text_done". `[VERIFIED: release notes for 1.5.2/1.5.3/1.5.4/1.5.5/1.5.6]`

**Implication for D-09 gate 8:** The "zero `_SegmentSynchronizerImpl` warnings" gate is a HOPE gate per CONTEXT and will almost certainly still fire after the upgrade. The upgrade still has value for PR #5413 (the Gemini 3.1 tool-response fix), but 60.4 resume UAT expectations must be reset — the cutoff race needs a separate phase. Do not block Phase 63 merge on this gate.

**Phase-64 candidate investigations** (recorded for the next phase, NOT for Phase 63):
- Look at `_text_data.done` / `_audio_data.done` state transitions in `synchronizer.py:~580-686` to understand why `mark_playback_finished` fires before they flip.
- Consider a subclass / monkeypatch that waits up to N ms for the flags, or a guard that inhibits `remove_participant()` until both `_text_data.done` and `_audio_data.done` are true.
- Coordinate with `end_call.py:_delayed_disconnect` — `session.current_speech.wait_for_playout()` currently waits for SpeechHandle completion, but a SpeechHandle can be "complete" while the segment synchronizer still has pending text.

## Tool-Call Cancellation

**Verdict: still a noop in 1.5.6.** `[VERIFIED: google/realtime/realtime_api.py:1298-1304 at commit 25bd9c76]`

```python
def _handle_tool_call_cancellation(
    self, tool_call_cancellation: types.LiveServerToolCallCancellation
) -> None:
    logger.warning(
        "server cancelled tool calls",
        extra={"function_call_ids": tool_call_cancellation.ids},
    )
```

No recovery `generate_reply`. No tool result back-fill. Identical to the pinned `43d3734` behavior. Covered by CONTEXT D-13 — out of scope for Phase 63. If the cutoff race investigation in a future phase discovers server cancellation is a co-cause, a subclass or monkeypatch that posts a recovery prompt is the natural fix. Not here.

## Dependency Graph

**Current `pyproject.toml` pins (relevant to this upgrade):**
```
livekit-agents==1.5.1
livekit-plugins-google @ git+https://github.com/livekit/agents.git@43d373444d2cfbec5c0493d57ef61d35a8094ddb#subdirectory=livekit-plugins/livekit-plugins-google
livekit-plugins-silero==1.5.1
livekit-plugins-turn-detector==1.5.1
livekit-plugins-noise-cancellation>=0.2,<1
livekit-api>=1.0,<2
```

**Target pins (all four livekit-* packages move together):**
```
livekit-agents==1.5.6
livekit-plugins-google==1.5.6
livekit-plugins-silero==1.5.6
livekit-plugins-turn-detector==1.5.6
```

**Transitive dep changes inherited from `livekit-agents==1.5.6` `[VERIFIED: pypi.org/pypi/livekit-agents/1.5.6/json]`:**

| Transitive dep | 1.5.6 requires | Our current state |
|----------------|----------------|-------------------|
| `livekit==1.1.5` | Exact pin | Current resolves to whatever 1.5.1 pulls; upgrade bumps this. No direct impact on our code — we use `livekit.api` and `livekit.rtc`. |
| `livekit-api<2,>=1.0.7` | Soft pin | Our `livekit-api>=1.0,<2` is compatible — resolver picks `>=1.0.7` automatically. |
| `livekit-protocol<2,>=1.1.5` | Soft pin | Not in our pyproject directly; resolved transitively. Compatible. |
| `protobuf>=3` | Lower floor only | Fine. |
| `pydantic<3,>=2.0` | Compatible | Already in our graph via livekit-agents and supabase. |
| `aiohttp~=3.10` | `~=3.10` (=>3.10, <3.11) | Was same on 1.5.1. No change. |
| `av>=14.0.0` | Same | Same. |
| `openai>=2` | Lower floor | Our direct pin is `openai>=2.0,<3` — compatible. |
| `opentelemetry-api~=1.39.0` | Exact minor range | New in 1.5.x; installed but unused by our code. No direct impact. |

**Plugin 1.5.6 transitive deps `[VERIFIED: pypi.org/pypi/livekit-plugins-google/1.5.6/json]`:**
```
google-auth<3,>=2                (our direct: google-auth>=2.0,<3 — compatible)
google-cloud-speech<3,>=2        (new transitive — was in 1.5.1 plugin too)
google-cloud-texttospeech<3,>=2.32
google-genai>=1.55               (Python>=3.10 — provides types.ThinkingConfig, types.RealtimeInputConfig, etc.)
livekit-agents>=1.5.6
```

**Verdict:** No required `pyproject.toml` edits beyond the four `livekit-*` version pins themselves. `websockets` is NOT a required transitive (1.5.6 agents doesn't list it). The pre-upgrade `pyproject.toml` comment block (lines 7-19) should be **removed** or **rewritten** post-upgrade — the rationale it documents (the 7-field `RealtimeCapabilities` blocker) is resolved by moving to 1.5.6, so the comment block is no longer accurate and would mislead future readers.

**Version-verification commands for the planner/executor to run pre-PR:**
```bash
pip index versions livekit-agents | head -1
pip index versions livekit-plugins-google | head -1
pip index versions livekit-plugins-silero | head -1
pip index versions livekit-plugins-turn-detector | head -1
# Expect all four to show 1.5.6 as current (as of 2026-04-22 upload).
```

## Risk Hotspots for the Planner

Concise grep targets if a non-obvious breakage appears post-upgrade:

- **If Gemini starts complaining about bad language codes:** `grep -rn "_locale_to_bcp47\|language=" livekit-agent/src` — ensure `1df5223`'s kwarg is still `language=`. Verified unchanged here; breakage would indicate a newer plugin release landed.
- **If `ThinkingConfig` raises at construction:** `grep -rn "ThinkingConfig\|thinking_level\|include_thoughts" livekit-agent/src` — ensure `thinking_level` string literal is still `"low"` and `include_thoughts=False`. `google-genai`'s Live API types could rename fields; if so, patch here and log `[ASSUMED]` in PR description.
- **If `@session.on("conversation_item_added")` stops firing:** `grep -rn "conversation_item_added\|event.item\b" livekit-agent/src` — confirm subscription wiring; remember the event can now carry `AgentHandoff` items (our `getattr` guard handles this).
- **If a tool's `RunContext` is `None` or typed wrong:** `grep -rn "context: RunContext\|RunContext$" livekit-agent/src/tools` — all 6 tools use the same first-arg pattern; one regression would surface all six identically.
- **If `end_call.py` starts cutting off farewells:** `grep -rn "current_speech\|wait_for_playout" livekit-agent/src` — verify `session.current_speech` is a `SpeechHandle` with `.wait_for_playout()`. Confirmed unchanged on 1.5.6.
- **If imports fail at boot:** `grep -n "from livekit" livekit-agent/src/agent.py livekit-agent/src/tools/*.py` — the four import lines in `agent.py` (L32-35) + one per tool are the entire LiveKit import footprint.
- **If the pyproject comment block is stale (documentation-level):** the 13-line comment at `pyproject.toml:7-19` explaining the 7-field `RealtimeCapabilities` blocker is invalidated by this upgrade. Delete or rewrite as part of the version-bump commit so future readers aren't confused.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| "Wait for Gemini to finish speaking before disconnecting SIP participant" | Fixed `asyncio.sleep()` / manual RTP-buffer timing | `session.current_speech.wait_for_playout()` | Already in use at `end_call.py:28-30`. Deterministic, honors the actual playout clock. |
| "Wait for tool result before continuing generation" | Manual future coordination | `AgentSession`'s built-in tool-step machinery (max_tool_steps default = 3) | The SDK already orchestrates this; our tools return strings and the session handles threading them back. |
| Cutoff-race patching (if we chose to address it in this phase — we are not) | Monkeypatch `_SegmentSynchronizerImpl.mark_playback_finished` inline in `agent.py` | Defer to a dedicated phase with its own design review | Mixing SDK upgrade with internal-class patching makes rollback ambiguous (CONTEXT D-13). |

## Common Pitfalls

### Pitfall 1: Boot-time `TypeError` only surfaces at `RealtimeModel(...)` construction — not at import
**What goes wrong:** `pyproject.toml` resolves fine and imports succeed, but `RealtimeModel(model="gemini-3.1-flash-live-preview", ...)` raises at the first SIP call because a kwarg quietly renamed.
**Why it happens:** Python keyword-only args only validate at call time. The old 1.5.1 → pinned-plugin combo surfaced exactly this as a `RealtimeCapabilities` 6-vs-7-field `TypeError`.
**How to avoid:** Phase 63's pre-Railway check should include a synthetic `RealtimeModel(...)` construction with the production kwargs, not just `python -c "from src.agent import entrypoint"`. `agent.py` builds `RealtimeModel` inside `entrypoint()` so imports-only won't catch it. Add to local test: `python -c "from src.agent import _build_model_for_test"` (or equivalent smoke that runs the construction path with dummy deps).
**Warning signs:** Railway deploy succeeds (imports fine) but first inbound call logs `TypeError` and the SIP caller hears silence.

### Pitfall 2: `pyproject.toml` comment rot
**What goes wrong:** The 13-line rationale comment (L7-L19) describing the 7-field `RealtimeCapabilities` blocker stays in the file after the pin change, misleading future readers into thinking the blocker still applies.
**Why it happens:** Minimal-diff discipline encourages editing only the version strings.
**How to avoid:** Delete or rewrite the comment as part of the same commit. Replace with one-liner: `# Pinned at 1.5.6 (2026-04-22) — mainline with capability-based Gemini 3.1 routing via PR #5413.`
**Warning signs:** A later phase sees the old comment and reintroduces the old git pin "to be safe".

### Pitfall 3: Uv/pip cache serves the old git-URL build instead of the new wheel
**What goes wrong:** Switching `livekit-plugins-google` from `@git+...#subdirectory=...` to `==1.5.6` leaves the old built wheel cached. `pip install -e .` picks up the cached build for some sub-path and version mismatch ensues.
**Why it happens:** Git-URL dependencies cache by URL, not by resolved version.
**How to avoid:** Before `pip install -e .`, run `pip uninstall -y livekit-plugins-google livekit-agents livekit-plugins-silero livekit-plugins-turn-detector` then reinstall. Alternatively `pip install --no-cache-dir -e .`.
**Warning signs:** `pip show livekit-plugins-google` reports `Location: ...git-builds/...` instead of `site-packages`.

### Pitfall 4: Railway deploys pick up a stale lock file
**What goes wrong:** If a `uv.lock` / `poetry.lock` / `requirements.txt` sits alongside `pyproject.toml`, Railway uses the lock and ignores the pin edit.
**Why it happens:** Lock files win over pyproject.toml for deterministic builds.
**How to avoid:** Verify no lock file is checked in. If one exists, regenerate it as part of this phase's commit. `livekit-agent` currently has no lock file (verified during reading — only `pyproject.toml` present, plus an `.egg-info/`).
**Warning signs:** Railway deploy log shows the old 1.5.1 version being installed despite `pyproject.toml` edit.

## Code Examples

Our 1.5.6-verified call-sites look identical to their 1.5.1 form. No code examples needed — existing code is the reference. For planner convenience:

### Verified-compatible RealtimeModel construction (current, DO NOT change)
```python
# src/agent.py:392-402 — valid on 1.5.6 as-is
model = google.realtime.RealtimeModel(
    model="gemini-3.1-flash-live-preview",
    voice=voice_name,
    language=_locale_to_bcp47(locale),
    instructions=system_prompt,
    realtime_input_config=realtime_input_config,
    thinking_config=genai_types.ThinkingConfig(
        thinking_level="low",
        include_thoughts=False,
    ),
)
```

### Verified-compatible tool decorator (current, DO NOT change)
```python
# src/tools/end_call.py:71-80 — valid on 1.5.6 as-is
@function_tool(
    name="end_call",
    description="Disconnect the phone line. ...",
)
async def end_call(context: RunContext) -> str:
    ...
```

### Verified-compatible session wiring (current, DO NOT change)
```python
# src/agent.py:405, 411-425 — valid on 1.5.6 as-is
session = AgentSession(llm=model)

@session.on("conversation_item_added")
def on_conversation_item(event):
    text = getattr(event.item, "text_content", None)
    if text:
        role = "user" if getattr(event.item, "role", None) == "user" else "agent"
        ...
```

## State of the Art

| Old approach (our current) | Current / target | When changed | Impact |
|---------------------------|------------------|--------------|--------|
| `livekit-plugins-google @ git+...@43d3734 (A2A_ONLY_MODELS branch)` — the experimental frozenset-based Gemini-3.1 routing | `livekit-plugins-google==1.5.6` — capability-based routing via `mutable_chat_context/instructions/tools` booleans | PR #5413 merged into 1.5.3 on 2026-04-15 | Experimental branch is abandoned (PRs #5238/#5251/#5262 closed unmerged). Mainline is the only path to future fixes. |
| `livekit-agents==1.5.1` | `livekit-agents==1.5.6` | 2026-04-22 | Inherits PreemptiveGenerationOptions (opt-in; we don't opt in), STT/TTS plugin improvements we don't use, and critical Gemini 3.1 routing fix. |

**Deprecated (but we don't use):** `AgentSession(preemptive_generation=...)`, `AgentSession(min_endpointing_delay=...)`, `AgentSession(max_endpointing_delay=...)`, `AgentSession(turn_detection=...)`. All listed as `# deprecated` at `agent_session.py:244-256` on 1.5.6 with no removal date. Irrelevant to Phase 63.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | `google-genai>=1.55` exposes `types.RealtimeInputConfig`, `types.AutomaticActivityDetection`, `types.StartSensitivity`, `types.EndSensitivity`, `types.ThinkingConfig` under the same names | Upgrade Surface Audit — `genai_types.*` row | Medium. If google-genai renamed any of these, `agent.py:364-402` raises `AttributeError` at first call. Mitigation: the plugin's own 1.5.6 source imports `from google.genai import types` and uses `types.RealtimeInputConfig` and `types.ThinkingConfig` internally — if the plugin itself works, our code works. `[VERIFIED: realtime_api.py:17,210,216]` makes this effectively low-risk. |
| A2 | Phase 60.4 commit `1df5223`'s `language=<bcp47>` kwarg continues to behave as STT pin (not hard-lock) on 1.5.6 — i.e., no behavioral change in server-side language handling | Preserved Phase 60.4 fixes (D-04) | Low — the 1.5.6 docstring still describes `language` as "BCP-47 Code" for the Live API, same as 1.5.1. No release note implies a behavioral change. Stream B's smoke test on UAT will confirm. |
| A3 | Railway's container builder does not cache the old git-URL build across the pin swap (or if it does, the swap from git-URL to `==1.5.6` is a cache-miss event) | Dependency Graph / Pitfall 3 | Low-Medium. If cache serves stale build, the deploy succeeds with 1.5.1 code. Mitigation: the commit message should touch `pyproject.toml`'s hashable content (the version + the removal of the git-URL fragment) which invalidates Railway's pip cache key. If uncertain, the executor can add `--no-cache-dir` to the Railway build command for this deploy. |

**Three assumptions total. None require pre-phase user confirmation** — all are verifiable by the agent boot sequence and the first UAT call. The planner should note them as watch-items during execution.

## Open Questions

1. **Will the `_SegmentSynchronizerImpl` warning still fire post-upgrade?**
   - What we know: the code path is byte-identical to 1.5.1 [VERIFIED].
   - What's unclear: whether upstream timing changes in 1.5.4 (preemptive generation) or 1.5.3 (realtime session handoff reuse) inadvertently alter the `_text_data.done` / `_audio_data.done` race window.
   - Recommendation: treat D-09 gate 8 as observational, not blocking. If the warning still fires with the same frequency, proceed to merge. If it fires MORE often, halt and investigate before merging — a regression would be unexpected.

2. **Does the single UAT call reliably exercise PR #5413's code path?**
   - What we know: PR #5413 routes Gemini 3.1 tool responses through mutable-context-off logic. Our tenant uses Gemini 3.1 and tools.
   - What's unclear: the existing 60.4 cutoff race may mask tool-result delivery, so a successful booking UAT only weakly validates the fix.
   - Recommendation: the UAT script should explicitly verify `book_appointment` returns a confirmation and a Google Calendar event is created — not just that the agent says something. Pass/fail is the calendar side effect, not the audio.

3. **Should the pyproject.toml comment block be preserved (edited) or deleted?**
   - What we know: it documents the historical blocker that this phase resolves.
   - What's unclear: project convention.
   - Recommendation: replace with a one-line pointer to this RESEARCH.md + the 1.5.6 release commit SHA for future archaeologists. Keeping historical rationale inline bloats the file; relying on git-blame + linked docs is cleaner.

## Environment Availability

> Phase 63 is a Python dependency-pin change. External dependencies are the Python toolchain and Railway, both of which are already in active use for Phase 60.x.

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Python 3.11+ | livekit-agents 1.5.6 (`requires-python = ">=3.11"`) | ✓ (already in use) | — | — |
| pip / setuptools | Install from pyproject.toml | ✓ | — | — |
| Railway deploy pipeline | Preview deploy per D-02 gate | ✓ (already in use for Phase 60.x) | — | — |
| Git | Branch creation + revert-PR rollback per D-10 | ✓ | — | — |
| GitHub API access (for release-note verification during planning) | Planner cross-check, not runtime | ✓ (verified during research) | — | — |
| pytest | Local test gate per D-09 #1 | ✓ (in `[project.optional-dependencies].dev`) | `>=8.0` | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

> Included because `.planning/config.json` does not explicitly set `workflow.nyquist_validation: false`. Phase 63 is small enough that a full Nyquist treatment is overkill — documenting the minimum viable gate map instead.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `pytest>=8.0` + `pytest-asyncio>=0.23` |
| Config file | `livekit-agent/pyproject.toml` `[tool.pytest.ini_options]` (`testpaths=["tests"]`, `asyncio_mode=auto`) |
| Quick run command | `cd livekit-agent && pytest tests/test_slot_token_handoff.py -x` (~16 tests, fast) |
| Full suite command | `cd livekit-agent && pytest tests/ -x` |
| Phase 63 acceptance gate | Zero new failures vs. pre-upgrade baseline (pre-existing VIP test failure tolerated per memory `project_vip_caller_routing.md`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test type | Automated command | File exists? |
|--------|----------|-----------|-------------------|-------------|
| D-09-1 | `pytest tests/` passes | unit+integration | `pytest tests/` | ✅ existing suite |
| D-09-2 | `from src.agent import entrypoint` imports cleanly | smoke | `python -c "from src.agent import entrypoint"` | ✅ (one-liner) |
| D-09-3 | `build_system_prompt(...)` renders | smoke | `python -c "from src.prompt import build_system_prompt; print(len(build_system_prompt(tenant=... )))"` | ⚠️ requires a test fixture tenant object; may need a Wave 0 helper |
| D-09-4 | Railway preview deploy SUCCESS | deploy | Observe Railway dashboard for the branch push | manual-only — no CI hook |
| D-09-5 | `registered worker` log | smoke | Railway log tail | manual-only |
| D-09-6 | UAT call on `+14783755631` completes | e2e | Place call, observe logs + calendar | manual-only (HUMAN-UAT) |
| D-09-7 | No `TypeError`/`ValidationError`/`AttributeError` | log-grep | `grep -E "TypeError\|ValidationError\|AttributeError" <call-log>` | manual-only |
| D-09-8 | Zero `_SegmentSynchronizerImpl` warnings | log-grep (HOPE gate) | `grep "_SegmentSynchronizerImpl" <call-log>` | manual-only, observational only |

### Sampling Rate

- **Per task commit:** `pytest tests/test_slot_token_handoff.py -x` (fastest-feedback, covers the 60.4 structural handoff + 63's implicit requirement that tool wiring survive).
- **Per wave merge:** `pytest tests/ -x` full suite.
- **Phase gate:** full suite green + Railway preview SUCCESS + one UAT call per D-09.

### Wave 0 Gaps

- [ ] Optional: a `tests/test_boot_smoke.py` that imports `entrypoint` and constructs a `RealtimeModel` with dummy kwargs. Catches Pitfall 1 (kwarg-rename TypeError) without needing a Railway deploy. **Marked optional** — CONTEXT D-03 discourages new files; existing `pytest tests/` + Railway preview + UAT already cover the failure mode, just with longer feedback loops.
- [ ] No framework install needed — pytest already in `dev` extras.

## Security Domain

> `.planning/config.json`'s `security_enforcement` flag was not read during research (file not loaded). Treating as enabled per GSD default.

### Applicable ASVS categories

| ASVS category | Applies | Standard control |
|---------------|---------|------------------|
| V2 Authentication | no | Phase 63 touches no auth surface. |
| V3 Session Management | no | No session code change. |
| V4 Access Control | no | No RLS, no route guards. |
| V5 Input Validation | no (pass-through) | Tool arg validation continues to flow through `@function_tool`'s existing schema derivation; no new inputs. |
| V6 Cryptography | no | No crypto. |
| V14 Configuration | yes | `pyproject.toml` version pins are a supply-chain decision. Pinning to exact versions (`==1.5.6`) rather than ranges is the correct control — matches current practice. |

### Known threat patterns for Python dependency upgrades

| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| Supply-chain compromise via transitive bump | Tampering | Pin both direct packages to exact version (`==1.5.6`). Verify upload dates on PyPI (both `livekit-agents@1.5.6` and `livekit-plugins-google@1.5.6` uploaded 2026-04-22 20:21-20:22 UTC from LiveKit's official publishing identity). `[VERIFIED: pypi.org]` |
| Branch/git-URL dependency drift | Tampering | This phase REMOVES a git-URL dependency in favor of a PyPI-published version — strict improvement. |
| Cache-staleness leading to wrong binary installed | — | Pitfall 3 above: uninstall + `--no-cache-dir` reinstall. Railway cache behavior addressed in Assumption A3. |

## Sources

### Primary (HIGH confidence — source read directly)

- **livekit/agents commit `25bd9c76b0e163195a6557f4a1528beaebeb2bd7`** (release commit for `livekit-agents@1.5.6` and `livekit-plugins-google@1.5.6`, 2026-04-22):
  - `livekit-plugins/livekit-plugins-google/livekit/plugins/google/realtime/realtime_api.py` (1436 lines — full read for `RealtimeModel.__init__`, `_handle_tool_call_cancellation`, `KNOWN_GEMINI_API_MODELS`, `RealtimeCapabilities` construction)
  - `livekit-plugins/livekit-plugins-google/livekit/plugins/google/realtime/__init__.py` (public exports)
  - `livekit-plugins/livekit-plugins-google/livekit/plugins/google/version.py` (confirms `__version__ = "1.5.6"`)
  - `livekit-plugins/livekit-plugins-google/pyproject.toml` (confirms `livekit-agents>=1.5.6`, `google-genai>=1.55`)
  - `livekit-agents/livekit/agents/__init__.py` (confirms `function_tool`, `RunContext`, `AgentSession` exports)
  - `livekit-agents/livekit/agents/llm/tool_context.py` (confirms `function_tool` decorator signature — 4 overloads + dispatch)
  - `livekit-agents/livekit/agents/voice/agent_session.py` (confirms `AgentSession.__init__` signature, `current_speech` property, `on()` event dispatch)
  - `livekit-agents/livekit/agents/voice/events.py` (confirms `EventTypes` Literal, `ConversationItemAddedEvent`, `CloseEvent`, `ErrorEvent`, `CloseReason`, `RunContext`)
  - `livekit-agents/livekit/agents/llm/chat_context.py` (confirms `ChatMessage.text_content` property, `ChatMessage.role` field)
  - `livekit-agents/livekit/agents/voice/speech_handle.py` (confirms `SpeechHandle.wait_for_playout()`)
  - `livekit-agents/livekit/agents/voice/transcription/synchronizer.py` (711 lines — full read; confirms `_SegmentSynchronizerImpl.mark_playback_finished` race path unchanged at lines 276-288, including the exact warning string)
- **PyPI metadata 2026-04-22**:
  - `https://pypi.org/pypi/livekit-agents/1.5.6/json` (transitive deps)
  - `https://pypi.org/pypi/livekit-plugins-google/1.5.6/json` (transitive deps, upload time)

### Secondary (MEDIUM confidence — release notes verified against code)

- GitHub Releases `livekit-agents@1.5.2` through `@1.5.6` — read all 5 release-note bodies; cross-verified PR #5413 (Gemini 3.1 tool fix, 1.5.3) against the actual code at realtime_api.py:293 where `mutable = "3.1" not in model`.
- `https://github.com/livekit/agents/pull/5413`, `/pull/5233`, `/pull/5218` — cited in CONTEXT and release notes; not fetched directly but release-note summary matched the observed code.

### Tertiary (LOW confidence — inferred, flagged)

- Claim that `google-genai>=1.55` continues to expose 5 specific `types.*` symbols in future patch releases — Assumption A1 above. Backed by the plugin's own internal use of those symbols at 1.5.6.
- Railway container build-cache behavior — Assumption A3. Based on general pip/Railway conventions, not a verified document.

## Metadata

**Confidence breakdown:**
- RealtimeModel kwarg audit: HIGH — every kwarg read from source at the target commit.
- Tool decorator + RunContext + AgentSession + event shapes: HIGH — all read from source.
- SegmentSynchronizer race status (unfixed): HIGH — byte-identical code confirmed.
- `_handle_tool_call_cancellation` still-noop: HIGH — body read in full.
- Breaking changes inventory across 1.5.2→1.5.6: MEDIUM — release notes + spot-checked PRs against code; did not read every merged commit, so a non-release-noted internal refactor could still surface a surprise (low probability given release practices).
- Transitive dep graph: HIGH — PyPI metadata read directly.
- Pitfalls: MEDIUM — based on pip/Railway operational knowledge; the kwarg-rename pitfall is HIGH (directly enforced by Python keyword-only validation).

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (30 days — stable LiveKit SDK; if a 1.5.7 ships inside that window the picture for Phase 63's TARGET is unchanged but the "latest" reference updates).

## RESEARCH COMPLETE

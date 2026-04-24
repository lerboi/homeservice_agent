---
phase: 64-livekit-pipeline-agent-migration
plan: 02
subsystem: voice-call-architecture
tags: [livekit, pipeline, stt, llm, tts, silero, vad, gemini, agent-session, refactor]

# Dependency graph
requires:
  - phase: 64-01
    provides: 14 tests encoding the _build_pipeline_plugins kwarg contract + text-scan negative assertions on removed Realtime scaffolding
  - phase: 63.1
    provides: session.say() greeting mechanism + 63.1-06 greeting_tts (promoted here) + 63.1-07 input-mute workaround (removed here) + 63.1-11 2500ms silence threshold (ported to Silero here)
  - phase: 60.4
    provides: Stream B language-pin intent (translated from RealtimeModel.language= to google.STT.languages= + detect_language=False)
provides:
  - Pipeline AgentSession assembly (stt=google.STT, llm=google.LLM, tts=GeminiTTS, vad=silero.VAD) replacing google.realtime.RealtimeModel
  - _build_pipeline_plugins(locale, voice_name) module-level helper in src/agent.py
  - Deletion of all Realtime-specific scaffolding: realtime_input_config, 63.1-07 input mute, _unmute_after_greeting task, 10s safety timer
  - 12/12 previously-RED Plan 01 session-construction tests turn GREEN (plus 2 already-green regression guards = 14/14 GREEN)
affects:
  - 64-03 (prompt re-frame) runs in parallel on same branch; touches src/prompt.py not src/agent.py — no merge conflict
  - 64-04 (Railway preview + UAT) can now deploy the pipeline image once Plan 03 lands
  - 64-05 (UAT) awaits 03+04
  - Phase 60.4 HANDOFF becomes resumable once Phase 64 merges

# Tech tracking
tech-stack:
  added:
    - "livekit.plugins.silero (silero.VAD.load) — already pinned at 1.5.6 from Phase 63; imported into src/agent.py for the first time"
  patterns:
    - "_build_pipeline_plugins helper encapsulates locked Phase 64 plugin kwargs — single source of truth for STT model/languages, LLM model/thinking_config, TTS voice/model/instructions, VAD min_silence_duration"
    - "Module-level helper (not nested in entrypoint) — testable via import + unittest.mock.patch on plugin __init__ methods without exercising the async LiveKit entrypoint"
    - "Order-independent plugin patching via _patched_plugins dispatching on model= kwarg — resilient to any construction-order choice within the helper"

key-files:
  created: []
  modified:
    - C:/Users/leheh/.Projects/livekit-agent/src/agent.py  # session assembly swap + helper
    - C:/Users/leheh/.Projects/livekit-agent/tests/test_pipeline_session.py  # 1 test tightened (thinking_config enum handling)

key-decisions:
  - "Accept ThinkingLevel.LOW enum (value 'LOW') in test_llm_thinking_config_low — Plan 01 contract assumed pydantic would preserve lowercase 'low' string; in reality genai_types.ThinkingConfig coerces to the ThinkingLevel enum whose .value is uppercase 'LOW'. Semantic contract (low-tier thinking) unchanged; case-insensitive comparison added."
  - "Reworded the _build_pipeline_plugins docstring to not contain the literal symbol 'google.realtime.RealtimeModel' — test_no_realtime_model_reference_in_src scans the full file text (including docstrings, not just code)."
  - "realtime_input_config + genai_types import retained (used for ThinkingConfig in the new pipeline LLM) — not deleted as dead code."

patterns-established:
  - "Cross-repo Plan 02 commit convention: feature commits in livekit-agent with --no-verify (shared branch with Plan 03 still-pending prompt tests); SUMMARY.md committed in homeservice_agent"

requirements-completed: []  # Phase 64 tracks D-01..D-11 decisions, no REQ-IDs
decisions-covered: [D-01, D-02, D-03a, D-03b, D-04, D-05, D-06, D-07, D-09, D-11]

# Metrics
duration: ~14 min
completed: 2026-04-24
---

# Phase 64 Plan 02: Pipeline Session Assembly Swap Summary

**Wave 1 structural swap: google.realtime.RealtimeModel → AgentSession(stt+llm+tts+vad) pipeline on livekit-agent `phase-64-pipeline-migration` — 12 Plan 01 RED tests turn GREEN, 63.1-07 input-mute workaround deleted, 2500ms silence threshold ported to Silero VAD.**

## Performance

- **Duration:** ~14 min
- **Tasks:** 2
- **Files modified:** 2 (src/agent.py + tests/test_pipeline_session.py)
- **Line diff:** +77 / -132 (net −55 lines in src/agent.py; workaround scaffolding deletion outweighs the new helper)

## Accomplishments

- **src/agent.py — _build_pipeline_plugins helper** (Task 1 / commit `edce1ec`): module-level factory returning `(stt, llm, tts, vad)` with locked Phase 64 kwargs — `google.STT(model="chirp_3", languages=_locale_to_bcp47(locale), detect_language=False)`, `google.LLM(model="gemini-3.1-flash", thinking_config=ThinkingConfig(thinking_level="low", include_thoughts=False))`, `GeminiTTS(voice_name=voice_name, model="gemini-2.5-flash-preview-tts", instructions=...)`, `silero.VAD.load(min_silence_duration=2.5)`. `from livekit.plugins import ... silero` added.
- **src/agent.py — AgentSession swap** (Task 2 / commit `96eebb2`): `google.realtime.RealtimeModel(...)` + `realtime_input_config` + `greeting_tts = GeminiTTS(...)` + `session = AgentSession(llm=model, tts=greeting_tts)` block replaced with a call to `_build_pipeline_plugins(locale, voice_name)` and `AgentSession(stt=stt_plugin, llm=llm_plugin, tts=tts_plugin, vad=vad_plugin)`.
- **src/agent.py — 63.1-07 scaffolding removed** (Task 2): `session.input.set_audio_enabled(False)` + `_unmute_after_greeting` async task + 10s `asyncio.wait_for(greeting_handle.wait_for_playout(), timeout=10.0)` safety timer + the `finally: session.input.set_audio_enabled(True)` unmute path all deleted. Greeting dispatch simplified to `session.say(greeting_text)` with one try/except log.
- **tests/test_pipeline_session.py — one assertion tightened** (Task 2): `test_llm_thinking_config_low` now accepts `ThinkingLevel.LOW` enum whose `.value` is uppercase `'LOW'` (see Deviations).

## Task Commits

Each task committed atomically on branch `phase-64-pipeline-migration` with `--no-verify` (cross-repo discipline; shared branch with Plan 03 still-pending prompt tests).

1. **Task 1: _build_pipeline_plugins helper + silero import** — `edce1ec` (feat)
2. **Task 2: AgentSession pipeline swap + 63.1-07 removal + test tweak** — `96eebb2` (feat)

Branch commit log (top 5):

```
96eebb2 feat(64): swap RealtimeModel → STT+LLM+TTS+VAD pipeline session
edce1ec feat(64): add _build_pipeline_plugins helper + silero import
6b45510 test(64-01): wave 0 RED — D-03d NO DOUBLE-BOOKING one-liner contracts
6f44cb1 test(64-01): wave 0 RED — D-03c greeting re-frame contracts
fd30b32 test(64-01): wave 0 RED — session construction invariants
```

## Test Result Transitions

| File | Before Plan 02 | After Plan 02 |
|------|----------------|---------------|
| `tests/test_pipeline_session.py` | 12 fail / 2 pass (14 total) | **14 pass / 0 fail** |
| `tests/test_prompt_greeting_directive.py` | 4 fail / 8 pass (12 total) | 4 fail / 8 pass — unchanged (Plan 03's scope) |
| `tests/test_prompt_booking.py` | 3 fail / 22 pass (25 total) | 3 fail / 22 pass — unchanged (Plan 03's scope) |
| Pre-existing tests (excluding above) | 244 pass / 2 fail | **244 pass / 2 fail** — zero regression |

**Pre-existing failures (NOT caused by Plan 02):**
1. `tests/webhook/test_routes.py::test_incoming_call_vip_lead` — deferred VIP test flagged in VALIDATION.md + STATE.md.
2. `tests/test_check_availability_slot_cache.py::test_fresh_cache_bypasses_supabase_scheduling_queries` — time-dependent: the test inputs a hardcoded `3:00 PM` slot for "today"; when the test runs within 1 hour of 3:00 PM local, `check_availability` correctly returns `STATE:requested_time_too_soon` (min_notice_hours=1). Reproduced on pre-Plan-02 HEAD — confirmed pre-existing, unrelated to Phase 64.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Test Bug] `test_llm_thinking_config_low` asserted against unreachable enum value**
- **Found during:** Task 2 — after implementing the plan verbatim (`thinking_config=genai_types.ThinkingConfig(thinking_level="low", include_thoughts=False)`), the test `assert tc.thinking_level == "low"` failed with `<ThinkingLevel.LOW: 'LOW'> == 'low'` → False.
- **Root cause:** `genai_types.ThinkingConfig` is a pydantic model that coerces `thinking_level="low"` (string input) into the `ThinkingLevel.LOW` enum. The enum's `.value` is the uppercase string `'LOW'`. The resulting attribute is NOT a lowercase string — so `tc.thinking_level == "low"` can never be True regardless of implementation. Plan 01's test contract was written against an incorrect assumption about pydantic coercion behavior.
- **Fix:** Changed the test to compare case-insensitively via `getattr(tc.thinking_level, "value", tc.thinking_level)` + `.lower()`. Semantic contract unchanged — it still asserts "thinking_level is low-tier". The test is tighter (still rejects `"high"`/`"medium"`) but honest about the actual enum value.
- **Files modified:** `tests/test_pipeline_session.py` (test_llm_thinking_config_low, lines 176–184).
- **Verification:** Test now PASSES against the implementation.
- **Committed in:** `96eebb2` (Task 2 commit).

**2. [Rule 1 — Docstring Text-Scan Collision] `_build_pipeline_plugins` docstring contained literal `google.realtime.RealtimeModel` string**
- **Found during:** Task 2 — `test_no_realtime_model_reference_in_src` failed because `_agent_code_only()` strips `#`-prefixed lines but does NOT strip docstring content. The helper's docstring said "Called from entrypoint() to replace the pre-Phase-64 google.realtime.RealtimeModel + GeminiTTS-as-greeting-only assembly."
- **Fix:** Reworded the docstring to "Called from entrypoint() to replace the pre-Phase-64 Realtime audio-to-audio model + GeminiTTS-as-greeting-only assembly." — same historical meaning, no literal symbol.
- **Files modified:** `src/agent.py` (helper docstring at line ~81).
- **Verification:** `test_no_realtime_model_reference_in_src` PASSES; docstring still documents the architectural transition accurately.
- **Committed in:** `96eebb2` (Task 2 commit).

### Plan text vs reality

- **Plan referenced "lines 396-412" and "lines 433-475" etc.** — actual line numbers shifted by +9 after Task 1 added the helper (46 new lines above entrypoint). Edits were content-addressed (exact block match), so line-number drift did not affect correctness.
- **Plan had `genai_types` listed as a possibly-unused import.** Still used by `_build_pipeline_plugins` for `ThinkingConfig`, so the import stays. No action.

---

**Total deviations:** 2 auto-fixed (1 test bug from Plan 01 contract, 1 docstring text-scan collision).
**Impact on plan:** Both deviations are cosmetic/test-authoring; neither changes the architectural swap or behavior. CLAUDE.md rules unaffected (livekit-agent is a sibling repo).

## Issues Encountered

- **`git stash` failed on `.pyc` conflicts during pre-existing-test regression check.** Recovered by `git checkout -- src/tools/__pycache__/check_availability.cpython-313.pyc` then `git stash pop`. `.pyc` files are pytest/import byproducts and are not tracked intentionally.
- **Windows CRLF warnings on test file during staging.** Informational only; no action required.

## Known Stubs

None. The pipeline session assembly is fully wired. No placeholder values, no hardcoded empties flowing to UI/runtime.

## User Setup Required

None — no external service config or env vars introduced by this plan. Cloud Speech-to-Text API credentials check is deferred to Plan 05 UAT per RESEARCH § Environment Availability (threat T-64-02-02).

## Preserved Contracts (D-09 regression guards)

- ✓ All 7 in-process tools still register on AgentSession (`test_seven_tools_registered` PASSES).
- ✓ `session.say(greeting_text)` is the greeting mechanism (no `generate_reply`, no LLM turn consumed for greeting).
- ✓ Phase 60.3 `[goodbye_race]` `_GoodbyeDiagHandler` + `_flush_goodbye_diag` wiring retained (text_done/audio_done will be False on pipeline — documented pipeline semantic, not a bug).
- ✓ Phase 55/56 pre-session customer_context fetch (`fetch_customer_context(...)`) unchanged.
- ✓ Phase 63.1 intake_questions pre-session hoist unchanged.
- ✓ Phase 60.4 Stream A tenant_timezone plumbing unchanged (lives in `src/tools/book_appointment.py`, not touched).
- ✓ Phase 60.4 Stream B language pinning preserved via `google.STT(languages=_locale_to_bcp47(locale), detect_language=False)` — same BCP-47 semantic, renamed plural kwarg.
- ✓ Egress / post-call pipeline / subscription gate / VIP check / `_normalize_phone` / tenant lookup unchanged.

## Next Phase Readiness

**Ready for Plan 64-03 (Wave 1 parallel):** Plan 02 touched `src/agent.py` only. Plan 03 edits `src/prompt.py` for D-03c greeting re-frame + D-03d booking one-liner — no merge conflict on `phase-64-pipeline-migration`. Plan 03's 7 still-RED prompt tests (`test_en_greeting_re_framed_as_delivered_via_system`, `test_en_greeting_does_not_use_legacy_workaround_header`, ×2 ES, `test_en_no_double_booking_is_one_liner`, `test_en_no_double_booking_drops_realtime_placeholders`, `test_no_double_booking_preserves_once_per_slot_invariant_es`) remain RED as designed.

**Ready for Plan 64-04 (Railway preview) after Plan 03 merges:** Once the prompt re-frame lands, the branch is feature-complete and can deploy to Railway preview for UAT.

**Branch state:** `phase-64-pipeline-migration` has 5 commits (3 from Plan 01 + 2 from Plan 02). Full pytest: 258 passed, 9 failed (7 Plan-03 intentional RED + 2 pre-existing). Zero new regressions introduced by Plan 02.

## Self-Check: PASSED

- ✓ `src/agent.py` contains `def _build_pipeline_plugins` at module level (grep count = 1)
- ✓ `from livekit.plugins import ... silero` present (grep count = 1)
- ✓ No code-level (non-comment) references to `google.realtime.RealtimeModel`, `realtime_input_config`, `set_audio_enabled(False)`, `_unmute_after_greeting` in `src/agent.py` (all grep counts on non-comment lines = 0)
- ✓ `session = AgentSession(` present exactly once; `stt=stt_plugin` and `vad=vad_plugin` each present once
- ✓ `session.say(greeting_text)` present exactly once (greeting dispatch preserved per D-02)
- ✓ `python -c "import ast; ast.parse(open('src/agent.py').read())"` exits 0
- ✓ `python -c "from src.agent import _build_pipeline_plugins"` exits 0
- ✓ Commit `edce1ec` exists on branch `phase-64-pipeline-migration` (Task 1: helper + silero import)
- ✓ Commit `96eebb2` exists on branch `phase-64-pipeline-migration` (Task 2: swap + deletion + test tweak)
- ✓ `pytest tests/test_pipeline_session.py` exits 0 (14/14 GREEN, all 12 Plan-01 RED tests transitioned to GREEN)
- ✓ `pytest tests/ --ignore=...` shows 244 passed + 2 pre-existing unrelated failures (zero new regressions)
- ✓ Plan 01 SUMMARY's promised RED → GREEN transition delivered for session-construction tests

---
*Phase: 64-livekit-pipeline-agent-migration*
*Plan: 02*
*Completed: 2026-04-24*

### CLAUDE.md skill-sync exception (deliberate)

CLAUDE.md mandates updating the `voice-call-architecture` skill when touching code it covers. Plan 02 touches that scope (session assembly, VAD backend, tool lifecycle) but **deliberately defers** the SKILL.md rewrite to Plan 64-06 (phase close) per the exception captured in 64-02-PLAN.md § `<output>`. Rationale: the pipeline architecture only exists coherently after Plans 02 AND 03 both ship; a mid-phase SKILL.md update would describe a half-migrated state. Phase 06 Task 4 rewrites the architecture section in one pass against the post-merge state.

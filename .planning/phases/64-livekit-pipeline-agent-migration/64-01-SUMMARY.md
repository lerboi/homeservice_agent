---
phase: 64-livekit-pipeline-agent-migration
plan: 01
subsystem: testing
tags: [pytest, tdd, livekit, pipeline, stt, llm, tts, silero, vad, gemini]

# Dependency graph
requires:
  - phase: 63.1-gemini-3-generate-reply-regression-fix
    provides: session.say() baseline + 63.1-06/07 greeting scaffolding + 8-line NO DOUBLE-BOOKING prose (all negative-asserted by these tests)
  - phase: 60.3-voice-agent-goodbye-cutoff-and-prompt-audit
    provides: 17 existing test_prompt_booking.py invariants (preserved verbatim)
  - phase: 60.4-booking-timezone-fix-and-stt-language-pinning
    provides: Stream B language-pin intent (translates to languages= kwarg assertion)
provides:
  - 14 new RED tests in tests/test_pipeline_session.py asserting session-construction invariants (STT languages= plural, detect_language=False, chirp_3, gemini-3.1-flash, thinking_config low, silero VAD 2.5s, GeminiTTS session-level, no turn_detector, no RealtimeModel, no 63.1-07 mute, 7 tools)
  - 6 new RED tests in tests/test_prompt_greeting_directive.py asserting D-03c re-frame (EN+ES "already delivered" framing + legacy header removal + preserved no-re-greet guardrail + business_name interpolation)
  - 8 new RED tests in tests/test_prompt_booking.py asserting D-03d one-liner (EN ≤300 chars + placeholder removal + ES once-per-slot near book_appointment + preserved check_availability/readback invariants)
  - Plan 02/03 contract surface — tests encode the exact kwargs, prose markers, and negative assertions that Plans 02+03 implementations must satisfy
affects:
  - 64-02-PLAN (session assembly swap turns pipeline_session tests GREEN)
  - 64-03-PLAN (prompt re-frame turns greeting + booking tests GREEN)

# Tech tracking
tech-stack:
  added: []  # No new deps; pytest + unittest.mock already present
  patterns:
    - "Order-independent plugin constructor dispatch via model= kwarg discrimination + class-name tiebreak (robust against Plan 02 construction-order choices)"
    - "Text-scan assertions that strip '#'-prefixed comment lines (allows historical rationale in comments without false-positive matches)"
    - "Character-budget one-liner assertions (insensitive to wrap style; measures Realtime-race scaffolding removal directly)"
    - "Proximity-based phrase assertions (within-N-chars-of-token) to rule out incidental matches from unrelated sections"

key-files:
  created:
    - C:/Users/leheh/.Projects/livekit-agent/tests/test_pipeline_session.py
  modified:
    - C:/Users/leheh/.Projects/livekit-agent/tests/test_prompt_greeting_directive.py
    - C:/Users/leheh/.Projects/livekit-agent/tests/test_prompt_booking.py

key-decisions:
  - "Adapted test_seven_tools_registered to real create_tools(deps: dict) signature — deviates from plan's pseudocode create_tools(tenant, ...) which was a read-first placeholder"
  - "Tightened EN one-liner assertion from line-count (≤3 lines) to char-budget (≤300 chars) — caught that current ~760-char block happens to render as 2 wrapped lines which would falsely pass line-count"
  - "Tightened ES once-per-slot assertion to require phrase within 200 chars of book_appointment mention — caught that 'una vez' appears incidentally in SCHEDULING block and would falsely pass loose search"
  - "Kept legacy header strings 'GREETING ALREADY PLAYED — DO NOT REPEAT' / 'SALUDO YA REALIZADO — NO SE REPITA' in negative assertions verbatim (em-dash character) — forces Plan 03 to actually re-author the headers, not just tweak"

patterns-established:
  - "Cross-repo RED commit convention: test files committed in livekit-agent with --no-verify (imports don't resolve yet because Plan 02 hasn't landed)"
  - "SUMMARY.md for cross-repo plan lives in homeservice_agent/.planning/ — orchestrator-side artifact"

requirements-completed: []  # Phase 64 tracks D-01..D-11 decisions, no REQ-IDs
decisions-covered: [D-01, D-03a, D-03b, D-03c, D-03d, D-04, D-05, D-06, D-07, D-09]

# Metrics
duration: 13.1 min
completed: 2026-04-24
---

# Phase 64 Plan 01: Wave 0 TDD RED Scaffolding Summary

**Wave 0 RED-state tests on livekit-agent `phase-64-pipeline-migration` branch encoding session-construction invariants, D-03c greeting re-frame, and D-03d NO DOUBLE-BOOKING one-liner — 19 intentional RED failures that Plans 02+03 turn GREEN.**

## Performance

- **Duration:** 13.1 min
- **Started:** 2026-04-24T11:53:33Z
- **Completed:** 2026-04-24T12:06:40Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 updated)

## Accomplishments

- **tests/test_pipeline_session.py (NEW, 14 tests, 12 RED)** — encodes Plan 02's contract: STT `languages=` plural kwarg (Pitfall 1 silent-failure guard), `detect_language=False` (Pitfall 2), `chirp_3` model; LLM `gemini-3.1-flash` + `ThinkingConfig(thinking_level="low", include_thoughts=False)`; Silero `VAD.load(min_silence_duration=2.5)`; GeminiTTS session-level; text-scan D-01 RealtimeModel absent, D-04 silero imported + no turn_detector, D-03a 63.1-07 mute scaffolding absent; D-09 all 7 tools registered.
- **tests/test_prompt_greeting_directive.py (UPDATED, +6 tests, 4 RED)** — encodes Plan 03 D-03c: re-framed "greeting already delivered via system" prose in EN + ES (USTED register); legacy header strings removed; no-re-greet guardrail preserved; business_name interpolation preserved. Pre-existing Phase 63.1-06 tests (6) untouched and still passing.
- **tests/test_prompt_booking.py (UPDATED, +8 tests, 3 RED)** — encodes Plan 03 D-03d: EN NO DOUBLE-BOOKING block ≤300 chars (vs ~760 today); `[TOKEN_FROM_LAST_TOOL_RESULT]` + `REPLACE_WITH_ACTUAL_TOKEN` placeholders absent; ES once-per-slot phrase near `book_appointment` (within 200 chars, USTED register); check_availability-BEFORE-book_appointment invariant preserved; readback rules preserved. Pre-existing Phase 60.3-11 tests (17) untouched and still passing.

## Task Commits

Each task committed atomically in the livekit-agent repo on branch `phase-64-pipeline-migration` with `--no-verify` (per cross-repo discipline in objective).

1. **Task 1: Create tests/test_pipeline_session.py** — `fd30b32` (test)
2. **Task 2: Update tests/test_prompt_greeting_directive.py for D-03c** — `6f44cb1` (test)
3. **Task 3: Update tests/test_prompt_booking.py for D-03d** — `6b45510` (test)

**Plan metadata:** committed separately in homeservice_agent repo (this SUMMARY.md).

## Files Created/Modified

**Created (livekit-agent repo):**
- `tests/test_pipeline_session.py` (249 lines, 14 test functions) — session-assembly invariants file; Plan 02's contract surface.

**Modified (livekit-agent repo):**
- `tests/test_prompt_greeting_directive.py` (+105 lines, 6 new tests appended) — D-03c re-frame contract; pre-existing tests preserved verbatim.
- `tests/test_prompt_booking.py` (+169 lines, 8 new tests appended) — D-03d one-liner contract; pre-existing 17 tests preserved verbatim.

## RED-State Verification

Post-commit test run (full livekit-agent suite):

| Group | Result | Notes |
|-------|--------|-------|
| tests/test_pipeline_session.py (new) | **12 fail / 2 pass / 14 total** | 2 passing: `test_no_turn_detector` (no turn_detector in current agent.py) and `test_seven_tools_registered` (create_tools already returns 7). Both acceptable — they guard against regressions introduced by Plan 02. |
| tests/test_prompt_greeting_directive.py | 4 fail / 8 pass / 12 total | 4 RED as designed (re-frame prose + legacy-header removal). 2 of the 6 new tests pass today (business_name interpolation + no-repita guardrail are present in legacy prose — these are regression guards for Plan 03). All 6 pre-existing Phase 63.1-06 tests PASS. |
| tests/test_prompt_booking.py | 3 fail / 22 pass / 25 total | 3 RED as designed (EN char budget + EN placeholder removal + ES once-per-slot proximity). 5 of 8 new tests pass today (regression guards). All 17 pre-existing Phase 60.3-11 tests PASS. |
| **Phase 64 Wave 0 totals** | **19 intentional RED** | Matches VALIDATION.md target ≥19 (12 session + 4 greeting + 3 booking). |
| Other pre-existing tests | 262 pass / 1 fail | 1 pre-existing failure (`test_incoming_call_vip_lead`) is the deferred VIP test already called out in VALIDATION.md's Plan 02 Task 2 row — not touched by Plan 01. |

Exit codes: `pytest tests/test_pipeline_session.py` → non-zero (RED expected). `pytest tests/` → non-zero (RED intentional + 1 deferred). ✓ All acceptance criteria met.

## Decisions Made

- **Order-independent plugin dispatch helper (`_patched_plugins`)**: routes recorded constructor kwargs into named buckets by discriminating on `model=` value (`chirp_3` → STT bucket, `gemini-3.1-flash` → LLM, `gemini-2.5-flash-preview-tts` → TTS) with class-name tiebreak. Silero VAD captured separately via its class-method `VAD.load`. Makes the test file robust against any construction-order choice Plan 02 makes inside `_build_pipeline_plugins`.
- **Character-budget over line-count for EN one-liner**: current pre-D-03d prose is ~760 chars wrapped onto a single visual line in the Python source — a line-count assertion (`≤3 lines`) would falsely pass. Switched to `≤300 chars` character budget to directly measure Realtime-race scaffolding removal.
- **Proximity-based ES once-per-slot assertion**: `"una vez"` appears incidentally in the SCHEDULING block ("programación una vez que tenga el nombre"). A loose `in section.lower()` check falsely passes today. Switched to require the phrase within 200 chars of a `book_appointment` mention, which forces Plan 03 to place the one-liner in the correct semantic context.
- **Preserve legacy header strings in negative assertions verbatim**: `"GREETING ALREADY PLAYED — DO NOT REPEAT"` / `"SALUDO YA REALIZADO — NO SE REPITA"` (with em-dash) are kept as the exact-match strings Plan 03 must remove. Prevents Plan 03 from satisfying D-03c by tweaking wording while keeping the workaround framing.
- **Text-scan assertions strip comment lines**: `test_no_realtime_model_reference_in_src` and `test_no_63_1_07_input_mute_scaffolding` filter out `#`-prefixed lines before scanning. Allows Plan 02 to keep historical commit references in comments (e.g. "Phase 63.1-07 revert:") without false-positive matches.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug/Correctness] `create_tools()` signature adaptation**
- **Found during:** Task 1 writing `test_seven_tools_registered`.
- **Issue:** Plan 01 Task 1 behavior spec pseudocodes `create_tools(mock_tenant, MagicMock(), MagicMock())` with a comment "refine signature per create_tools" — a read-first placeholder. Actual `src/tools/__init__.py:create_tools(deps: dict) -> list` takes a single deps dict and gates `check_availability` + `book_appointment` behind `deps["onboarding_complete"]`.
- **Fix:** Built a realistic `deps` dict matching `conftest.py`'s `mock_deps_with_diag` fixture shape (`call_id`, `tenant_id`, `from_number`, `call_end_reason`, `_tool_call_log`, `_diag_record`) plus `onboarding_complete=True` to unlock all 7 tools.
- **Files modified:** `tests/test_pipeline_session.py`.
- **Verification:** Test PASSES today (7 tools registered), so it acts as a regression guard against Plan 02 breaking tool registration.
- **Committed in:** `fd30b32` (Task 1 commit).

**2. [Rule 1 — Test Tightening] EN one-liner char-budget over line-count**
- **Found during:** Task 3 initial test run — `test_en_no_double_booking_is_one_liner` PASSED against the 8-line pre-D-03d block because the prose renders as 2 wrapped physical lines.
- **Issue:** Plan's "≤3 non-empty lines" tolerance was satisfied by the still-intact pre-D-03d block. The test would NOT force Plan 03 to simplify.
- **Fix:** Switched assertion to `char_count ≤ 300` (current block is ~760 chars). Directly measures Realtime-race scaffolding removal regardless of wrap style.
- **Files modified:** `tests/test_prompt_booking.py`.
- **Verification:** Test now RED-fails against current prose (760 > 300). Plan 03 must trim to meet the budget.
- **Committed in:** `6b45510` (Task 3 commit).

**3. [Rule 1 — Test Tightening] ES once-per-slot proximity check**
- **Found during:** Task 3 initial test run — `test_no_double_booking_preserves_once_per_slot_invariant_es` PASSED because `"una vez"` appears in the SCHEDULING block ("programación una vez que tenga el nombre"), unrelated to booking uniqueness.
- **Issue:** Loose `"una vez" in section.lower()` check falsely satisfies D-03d. The test would NOT force Plan 03 to add the ES one-liner.
- **Fix:** Require once-per-slot phrase within 200 chars of a `book_appointment` mention. Phrases tightened to `["una sola vez", "solamente una vez", "solo una vez", "no llame a book_appointment"]` (more specific than bare "una vez").
- **Files modified:** `tests/test_prompt_booking.py`.
- **Verification:** Test now RED-fails against current ES prose (no matching phrase within 200 chars of any book_appointment mention).
- **Committed in:** `6b45510` (Task 3 commit).

---

**Total deviations:** 3 auto-fixed (1 signature correction, 2 test tightening).
**Impact on plan:** All three deviations make the RED contracts tighter — Plan 02 and Plan 03 must actually implement the intended changes rather than slip through loose assertions. No scope creep. No CLAUDE.md rule violations (CLAUDE.md is a homeservice_agent-side concept; livekit-agent test work doesn't touch homeservice_agent code).

## Issues Encountered

- **Pre-existing `.pyc` modifications on livekit-agent main**: `git status` showed 3 modified `.pyc` files at branch creation. Did not stage or affect; these are Python bytecode artifacts, not tracked intentionally.
- **No Cloud Speech IAM verification needed at this plan**: Plan 01 is pure test authoring — no runtime STT calls. IAM scope check deferred to Plan 04 (Railway preview) per VALIDATION.md T-64-04-01.
- **`test_en_no_double_booking_drops_realtime_placeholders` produces a truncated `...Full output truncated` message in pytest**: the assertion failure includes the full ~4KB booking section in the error diff. This is cosmetic — the assertion message and file/line reference are clear. No action needed.

## User Setup Required

None — no external service configuration or env vars introduced by this plan. Test infrastructure (`pytest>=8.0`, `pytest-asyncio`) already present from Phase 63.

## Next Phase Readiness

**Ready for Plan 02 (Wave 1):** The RED contracts are committed on `phase-64-pipeline-migration` branch. Plan 02's executor can implement `_build_pipeline_plugins` + swap `AgentSession` assembly, then run `pytest tests/test_pipeline_session.py -v` to measure RED→GREEN progress. Expected outcome after Plan 02 Task 1: kwarg-level tests turn GREEN. After Plan 02 Task 2: all 14 session-construction tests turn GREEN (including the 12 currently-RED ones).

**Ready for Plan 03 (Wave 1):** Plan 03's executor can rewrite `_build_greeting_section` + `_build_booking_section` per D-03c / D-03d and run the two prompt test files to measure GREEN progress.

**No blockers.** Branch `phase-64-pipeline-migration` exists in livekit-agent with 3 commits. Cross-repo discipline followed (livekit-agent test files committed in livekit-agent; SUMMARY.md committed in homeservice_agent).

## Self-Check: PASSED

- ✓ tests/test_pipeline_session.py exists at `C:/Users/leheh/.Projects/livekit-agent/tests/test_pipeline_session.py` (14 test functions)
- ✓ tests/test_prompt_greeting_directive.py updated (6 new tests, 12 total)
- ✓ tests/test_prompt_booking.py updated (8 new tests, 25 total)
- ✓ Commit `fd30b32` exists on branch `phase-64-pipeline-migration` (test 64-01 session invariants)
- ✓ Commit `6f44cb1` exists on branch `phase-64-pipeline-migration` (test 64-01 D-03c)
- ✓ Commit `6b45510` exists on branch `phase-64-pipeline-migration` (test 64-01 D-03d)
- ✓ `python -m py_compile` clean for all 3 files
- ✓ Full livekit-agent pytest: 19 intentional RED + 262 pass + 1 pre-existing deferred failure (`test_incoming_call_vip_lead`, flagged in VALIDATION.md)
- ✓ All 14 sampled pre-existing tests (6 greeting + 8 booking) PASS — no regression
- ✓ Exit code non-zero for `pytest tests/test_pipeline_session.py` (RED expected per Plan 01 success criteria)

---
*Phase: 64-livekit-pipeline-agent-migration*
*Plan: 01*
*Completed: 2026-04-24*

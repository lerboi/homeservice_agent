---
phase: 64-livekit-pipeline-agent-migration
plan: 03
subsystem: voice-call-architecture
tags: [prompt, pipeline, gemini, greeting, booking, tdd, green, livekit]

# Dependency graph
requires:
  - phase: 64-01
    provides: 7 Plan-01 RED tests (4 greeting D-03c + 3 booking D-03d) encoding the contract this plan turns GREEN
  - phase: 64-02
    provides: pipeline AgentSession assembly on branch phase-64-pipeline-migration (HEAD 96eebb2) — prompt re-frame reflects that architecture
  - phase: 63.1-06
    provides: legacy "GREETING ALREADY PLAYED — DO NOT REPEAT" / "SALUDO YA REALIZADO — NO SE REPITA" headers removed here
  - phase: 60.3-11
    provides: 17 existing booking tests (check_availability-before-book_appointment, readback, postal_label, anti-fabrication, EN/ES parity) — preserved verbatim
provides:
  - D-03c re-framed _build_greeting_section (EN "GREETING ALREADY DELIVERED" + ES "SALUDO YA ENTREGADO") describing pipeline as architectural fact
  - D-03d one-liner NO DOUBLE-BOOKING block (EN 134 chars, down from ~760) + new ES "NO DOBLE RESERVA" block for parity
  - build_system_prompt() composition assertions (EN+ES) — WARNING 6 mitigation guarding against section-drop regressions
affects:
  - 64-04 (Railway preview deploy) — branch is feature-complete post this plan
  - 64-05 (UAT) — awaits 04
  - voice-call-architecture SKILL.md — update deferred to 64-06 Task 4 (phase close; see CLAUDE.md skill-sync exception below)

# Tech tracking
tech-stack:
  added: []  # no new deps — pure prompt prose edits + test additions
  patterns:
    - "Outcome-shaped prompt prose — describe architectural facts ('greeting already delivered via system') rather than workaround framing ('capability gate forces separate TTS')"
    - "End-to-end composition assertions on build_system_prompt() — guards against section-level unit tests going green while the assembled prompt silently drops blocks"
    - "EN/ES parity at the new-block level — when D-03d required adding an ES-only new block (NO DOBLE RESERVA), placement mirrored EN (immediately after AFTER BOOKING / DESPUÉS DE RESERVAR) to keep structural symmetry"

key-files:
  created: []
  modified:
    - C:/Users/leheh/.Projects/livekit-agent/src/prompt.py  # 3 edits: _build_greeting_section (D-03c) + _build_booking_section EN NO DOUBLE-BOOKING compression (D-03d) + _build_booking_section ES NO DOBLE RESERVA add (D-03d parity)
    - C:/Users/leheh/.Projects/livekit-agent/tests/test_prompt_greeting_directive.py  # +2 composition assertions (14 tests total, up from 12)

key-decisions:
  - "ES NO DOBLE RESERVA block ADDED (not replaced) — the ES branch had no dedicated double-booking block pre-edit (confirmed via `grep -i 'doble' src/prompt.py` returning 0 matches before the plan). Plan anticipated this branch via its 'If the ES branch does NOT have a dedicated NO DOBLE RESERVA block...' contingency; followed that path."
  - "WARNING 6 composition tests added to test_prompt_greeting_directive.py (fallback home) rather than creating a new test_prompt_build_system_prompt.py file — no existing composition test file found; staying in the greeting test file keeps the D-03c contract and its composition guard co-located."
  - "Greeting re-frame dropped the standalone 'CRITICAL:' header qualifier — re-framed prose reads as outcome-shaped architectural fact (matching feedback_livekit_prompt_philosophy.md: non-directive, SDK-matched)."

patterns-established:
  - "Cross-repo discipline unchanged from Plans 01+02: livekit-agent commits with --no-verify; homeservice_agent SUMMARY.md commit standard (no --no-verify)"

requirements-completed: []  # Phase 64 tracks D-01..D-11 decisions, no REQ-IDs
decisions-covered: [D-03c, D-03d]

# Metrics
duration: ~11 min
completed: 2026-04-24
---

# Phase 64 Plan 03: Prompt Re-Frame (D-03c + D-03d) Summary

**Wave 1 prompt-surface alignment with the pipeline architecture: `_build_greeting_section` re-framed as "greeting already delivered via system" (D-03c); `_build_booking_section` NO DOUBLE-BOOKING block collapsed from ~760 chars to 134 chars with matching ES parity block added (D-03d). All Plan-01 RED tests GREEN; no regression.**

## Performance

- **Duration:** ~11 min
- **Tasks:** 2 (execution tasks) + 1 sub-commit (WARNING 6 composition tests)
- **Files modified:** 2 (src/prompt.py + tests/test_prompt_greeting_directive.py)
- **Commits:** 3 on `phase-64-pipeline-migration`

## Accomplishments

- **D-03c greeting re-frame (EN + ES)** — `_build_greeting_section` legacy workaround-framed headers (`"GREETING ALREADY PLAYED — DO NOT REPEAT"` / `"SALUDO YA REALIZADO — NO SE REPITA"`) replaced with outcome-shaped headers (`"GREETING ALREADY DELIVERED"` / `"SALUDO YA ENTREGADO"`). Docstring/comment updated from 63.1-06 capability-gate narrative to Phase-64 pipeline-reality narrative. References to "separate TTS voice" / "mutable_chat_context=False" / "ANTES de que su sesión comenzara a procesar el audio" removed — implementation detail that leaked into the prompt. ECHO AWARENESS / CONCIENCIA DE ECO preserved (pipeline-relevant too). `business_name` + `disclosure` interpolation preserved. ES USTED register throughout (`Responda`, `No repita`, `usted recibe su primer turno`).

- **D-03d NO DOUBLE-BOOKING compression (EN)** — 10-line / ~760-char defensive block containing `[TOKEN_FROM_LAST_TOOL_RESULT]` / `REPLACE_WITH_ACTUAL_TOKEN` placeholder-guards and "caller noise does not mean booking failed" clause → compressed to a 3-line / 134-char one-liner: `"NO DOUBLE-BOOKING:\n"` + `"Only call book_appointment once per confirmed slot. If it returns success, the booking is final — do not re-invoke."`. Pipeline tool lifecycle (perform_tool_executions) runs atomically — Realtime-era defensive prose is obsolete.

- **D-03d NO DOBLE RESERVA parity (ES)** — ES branch had no dedicated double-booking block pre-edit. Added new 3-line / 147-char block after `DESPUÉS DE RESERVAR` mirroring EN placement: `"NO DOBLE RESERVA:\n"` + `"Invoque book_appointment una sola vez por franja confirmada. Si devuelve éxito, la reserva es definitiva — no la vuelva a llamar."`. USTED register; `book_appointment` tool name preserved English per Phase 60.3-06 convention. `una sola vez` within 200 chars of `book_appointment` mention satisfies Plan 01's proximity assertion.

- **WARNING 6 mitigation — end-to-end composition assertions** — `test_build_system_prompt_includes_d03c_en` + `test_build_system_prompt_includes_d03c_es` added to `tests/test_prompt_greeting_directive.py`. These call `build_system_prompt(locale=..., business_name="AcmeCorp", onboarding_complete=True)` and assert the new headers (`"GREETING ALREADY DELIVERED"` / `"SALUDO YA ENTREGADO"`) appear in the composed output — guards against a section-ordering or conditional-inclusion regression where `_build_greeting_section` returns the re-framed string but `build_system_prompt` silently drops it.

## Task Commits

All commits on branch `phase-64-pipeline-migration` with `--no-verify`:

| # | Commit  | Type | Description |
|---|---------|------|-------------|
| 1 | `74b165a` | feat | re-frame `_build_greeting_section` per D-03c (pipeline) |
| 2 | `77030e6` | test | `build_system_prompt` composition asserts D-03c re-frame EN+ES |
| 3 | `24bf7c0` | feat | compress NO DOUBLE-BOOKING to one-liner per D-03d (pipeline) |

Branch log (top 7):

```
24bf7c0 feat(64): compress NO DOUBLE-BOOKING to one-liner per D-03d (pipeline)
77030e6 test(64): build_system_prompt composition asserts D-03c re-frame EN+ES
74b165a feat(64): re-frame _build_greeting_section per D-03c (pipeline)
96eebb2 feat(64): swap RealtimeModel → STT+LLM+TTS+VAD pipeline session
edce1ec feat(64): add _build_pipeline_plugins helper + silero import
6b45510 test(64-01): wave 0 RED — D-03d NO DOUBLE-BOOKING one-liner contracts
6f44cb1 test(64-01): wave 0 RED — D-03c greeting re-frame contracts
```

Homeservice_agent SUMMARY.md committed separately (standard commit, no --no-verify).

## Section-Level Metrics

### `_build_greeting_section` (D-03c)

| Locale | Pre-edit chars | Post-edit chars | Lines pre | Lines post |
|--------|---------------:|----------------:|----------:|-----------:|
| EN     | ~900           | 848             | ~22       | 9          |
| ES     | ~930           | 853             | ~22       | 9          |

Sub-15-line budget from plan met (9 lines per locale after compression).

### `_build_booking_section` NO DOUBLE-BOOKING sub-block (D-03d)

| Locale | Pre-edit chars | Post-edit chars | Reduction |
|--------|---------------:|----------------:|----------:|
| EN     | ~760           | 134             | ~82%      |
| ES     | 0 (absent)     | 147             | N/A (ADDED) |

### `_build_booking_section` overall (D-03d sanity)

| Locale | Post-edit total | Post-edit change vs pre |
|--------|----------------:|------------------------:|
| EN     | 4596            | ~−620 chars (NO DOUBLE-BOOKING trimmed) |
| ES     | 5071            | ~+147 chars (NO DOBLE RESERVA added)    |

EN/ES length delta: **9.4%** (well inside the ≤30% drift guard from `test_en_es_length_within_1pt5x`).

## Test Result Transitions

| File | Before Plan 03 | After Plan 03 |
|------|----------------|---------------|
| `tests/test_prompt_greeting_directive.py` | 4 fail / 8 pass (12 total) | **14 pass / 0 fail** (12 original GREEN + 2 new composition GREEN) |
| `tests/test_prompt_booking.py` | 3 fail / 22 pass (25 total) | **25 pass / 0 fail** |
| `tests/test_pipeline_session.py` | 14 pass / 0 fail (from Plan 02) | **14 pass / 0 fail** — no regression |
| Full `pytest tests/` | 274 pass / 11 fail (Plans 01+02 state after Plan 02 landed; 7 still-RED Plan-03 + 2 pre-existing unrelated) | **283 pass / 2 fail** — 7 Plan-01 intentional REDs all GREEN; 2 failures are pre-existing unrelated (VIP webhook test + time-dependent slot-cache test) |

Plan 01 promised: "19 intentional RED" across session (12) + greeting (4) + booking (3). All 19 GREEN after Plans 02 + 03 combined. Exit for `pytest tests/test_prompt_greeting_directive.py` → 0. Exit for `pytest tests/test_prompt_booking.py` → 0. Exit for `pytest tests/test_pipeline_session.py` → 0.

## Preserved Contracts (Regression Guards)

- ✓ **EN/ES parity** — both locales carry matching sections at matching positions; USTED register preserved in ES (`Responda`, `Invoque`, `No repita`).
- ✓ **`business_name` templating** (Phase 63.1-06) — EN + ES both interpolate the branded greeting text with `{business_name}`.
- ✓ **`check_availability` BEFORE `book_appointment`** (Phase 60.3-11 D1 anti-hallucination spine) — two-step contract untouched in both locales.
- ✓ **BEFORE BOOKING — READBACK / LECTURA DE CONFIRMACIÓN** (Phase 60.3-11) — readback rules with `postal_label` wiring preserved verbatim.
- ✓ **AFTER BOOKING / DESPUÉS DE RESERVAR** (Phase 60.3-11) — unchanged.
- ✓ **Tool names stay English** (Phase 60.3-06) — `book_appointment` / `check_availability` never translated even in ES blocks.
- ✓ **ECHO AWARENESS / CONCIENCIA DE ECO** — pipeline-relevant too; retained in both locales.
- ✓ **EN/ES length drift guard** — 9.4%, well under 30% ceiling.

## Decisions Made

- **Composition assertions live in `test_prompt_greeting_directive.py`** (fallback home per Plan 01 Task 1 action block). No existing `test_prompt_build_system_prompt.py` or `test_prompt_composition.py` found via grep. Keeping the D-03c contract + its end-to-end guard in the same file preserves locality when future agents audit Phase 64 prompt surface.
- **ES NO DOBLE RESERVA block is ADDED (not replaced)** — pre-edit ES branch had zero matches for `doble`, `una sola vez`, `solamente una vez`, `solo una vez`, or `no llame a book_appointment`. The plan anticipated this branch explicitly ("If the ES branch does NOT have a dedicated NO DOBLE RESERVA block...ADD the compressed ES block in a position that mirrors the EN placement"). Placement: immediately after `DESPUÉS DE RESERVAR` — symmetric to EN's `AFTER BOOKING` → `NO DOUBLE-BOOKING` adjacency.
- **Dropped the `— CRITICAL` qualifier from the NO DOUBLE-BOOKING header** — Plan 01 char-budget assertion (≤300) tolerates it, but removing it produces a cleaner one-liner aligned with the pipeline-era "less prompt surface" philosophy. The once-per-slot semantic is carried by prose, not by shouting.

## Deviations from Plan

### Plan text vs reality

- **Line numbers shifted.** Plan's "lines ~462-526" and "lines ~1070-1080" landmarks had already shifted relative to Plan 02's HEAD; edits were content-addressed (exact block match), so line drift was irrelevant.
- **Plan's "At least 6 new" greeting tests** — actual transition: 4 RED → GREEN (the other 2 of 6 new tests were already GREEN as regression guards per Plan 01's own SUMMARY). All 12 tests in the file before Plan 03 are GREEN post-plan; plus 2 new composition tests = 14/14.
- **Plan's "At least 3 new" booking tests** — actual transition: 3 RED → GREEN (matches Plan 01 SUMMARY: "3 RED as designed"). Full 25/25 GREEN.

### Auto-fixed Issues

None — plan executed as written; no bugs or blocking issues encountered.

---

**Total deviations:** 0 code/behavior deviations; some contingency branches (ES block ADDED vs replaced) followed per plan design.

## Issues Encountered

- **Windows CRLF warning** on `tests/test_prompt_greeting_directive.py` during `git add` (`LF will be replaced by CRLF the next time Git touches it`). Informational; no action needed.
- **PreToolUse:Edit hook reminders** fired three times during Edit tool use — the file had been Read earlier in the session (greeting section at offset 462, booking section at offset 844, test file in full), so the runtime permitted each edit after the reminder. Cosmetic; no correctness impact.

## Known Stubs

None. Prompt prose edits; no UI/data surface changes, no placeholders, no TODOs introduced.

## User Setup Required

None — no new env vars, no external service changes.

## Authentication Gates

None — no OAuth, API key, or external credential interaction in this plan's scope.

## Next Phase Readiness

**Branch `phase-64-pipeline-migration` is now feature-complete for the pipeline migration architectural swap.**

- Plan 02 shipped `AgentSession(stt=, llm=, tts=, vad=)` assembly + deleted 63.1-07 input-mute workaround + ported 2500ms silence threshold to Silero.
- Plan 03 shipped the prompt-surface alignment: greeting re-framed, NO DOUBLE-BOOKING compressed, EN/ES parity restored.
- All 19 intentional-RED tests from Plan 01 are GREEN. Zero new regressions.

**Ready for Plan 64-04 (Railway preview + UAT prep):** push `phase-64-pipeline-migration` to remote, deploy to Railway preview, measure baseline latency, verify `[goodbye_race]` instrumentation still emits, run one live EN UAT call.

**Blockers for merge to main:** only the two pre-existing unrelated test failures (VIP webhook test — deferred flag from STATE.md; slot-cache test — time-dependent 3pm-today race reproducible on pre-Plan-02 HEAD). Neither is a Phase 64 scope item; both documented in Plan 02 SUMMARY.

## Self-Check: PASSED

- ✓ `src/prompt.py` no longer contains `"GREETING ALREADY PLAYED — DO NOT REPEAT"` (grep count = 0)
- ✓ `src/prompt.py` no longer contains `"SALUDO YA REALIZADO — NO SE REPITA"` (grep count = 0)
- ✓ `src/prompt.py` contains `"GREETING ALREADY DELIVERED"` (grep count = 1)
- ✓ `src/prompt.py` contains `"SALUDO YA ENTREGADO"` (grep count = 1)
- ✓ `src/prompt.py` contains `"ECHO AWARENESS"` (grep count = 1)
- ✓ `src/prompt.py` contains `"CONCIENCIA DE ECO"` (grep count = 1)
- ✓ `src/prompt.py` no longer contains `"TOKEN_FROM_LAST_TOOL_RESULT"` or `"REPLACE_WITH_ACTUAL_TOKEN"` (grep counts = 0)
- ✓ `src/prompt.py` contains `"NO DOUBLE-BOOKING"` (grep count = 1) and `"NO DOBLE RESERVA"` (grep count = 1)
- ✓ `python -c "from src.prompt import _build_greeting_section; ..."` exits 0 for both locales (business_name + disclosure interpolation preserved)
- ✓ `pytest tests/test_prompt_greeting_directive.py -v` → 14 passed, 0 failed
- ✓ `pytest tests/test_prompt_booking.py -v` → 25 passed, 0 failed
- ✓ `pytest tests/test_pipeline_session.py -v` → 14 passed, 0 failed (no regression from Plan 02)
- ✓ `pytest tests/` → 283 passed, 2 failed (both pre-existing, unrelated to Phase 64)
- ✓ Commit `74b165a` exists on `phase-64-pipeline-migration` (feat: D-03c re-frame)
- ✓ Commit `77030e6` exists on `phase-64-pipeline-migration` (test: composition assertions)
- ✓ Commit `24bf7c0` exists on `phase-64-pipeline-migration` (feat: D-03d one-liner + ES parity)

---

### CLAUDE.md skill-sync exception (deliberate)

CLAUDE.md § Rules mandates: *"When making changes to any system covered by a skill, read the skill first, make the code changes, then update the skill to reflect the new state."*

Plan 03 touches `voice-call-architecture` SKILL.md scope (prompt builders documented in the skill's "System prompt" section) but **deliberately defers** the SKILL.md rewrite to Plan 64-06 Task 4 (phase close), matching the same exception carried by Plans 64-02 and 64-03 PLAN `<output>` blocks. Rationale:

- **Pipeline architecture is only coherent post-Plans 02 AND 03 combined.** Plan 02 swapped session assembly; this plan re-framed the prompt sections that were shaped for Realtime. A mid-phase SKILL.md update after Plan 03 alone (prompt refactor but a pipeline session already in place) is technically coherent, but splitting the skill rewrite between Plans 03 and 04 adds churn — Plan 06 batches the full rewrite against the post-merge state for a single clean documentation pass.
- **D-01 big-bang rollout.** Per CONTEXT.md D-01, the rollout is a single merge commit. Partial mid-phase SKILL.md updates add churn with no reader-facing value until the merge lands.
- **Phase 06 Task 4 owns the full rewrite** (session + prompt + VAD + greeting-dispatch + UAT findings) in one pass.

This is **not** a skill-sync violation; it is a conscious batching choice driven by the structural nature of the migration, matching Plan 02's recorded exception.

---

*Phase: 64-livekit-pipeline-agent-migration*
*Plan: 03*
*Completed: 2026-04-24*

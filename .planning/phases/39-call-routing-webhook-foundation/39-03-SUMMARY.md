---
phase: 39-call-routing-webhook-foundation
plan: 03
subsystem: voice-call-architecture
tags: [python, zoneinfo, dst, dataclass, pytest, schedule-evaluator, webhook, pure-function]

# Dependency graph
requires:
  - phase: 39-call-routing-webhook-foundation
    provides: Wave 0 test infrastructure (tests/webhook/ package, pyproject dev deps, skipif stub for test_schedule.py) from Plan 39-01
provides:
  - Pure-function evaluate_schedule(schedule, tenant_timezone, now_utc) -> ScheduleDecision
  - Frozen ScheduleDecision dataclass with mode (ai | owner_pickup) and reason (schedule_disabled | empty_schedule | outside_window | inside_window)
  - src/webhook/ subpackage marker (import-free, ready for Plan 39-05 FastAPI app wiring)
  - 17 locked unit test cases covering enabled/empty, inside/outside, boundaries, overnight ranges, DST transitions, and multi-range days
affects: [39-04-soft-cap, 39-05-fastapi-app, 39-06-twilio-routes, 40-call-routing-provisioning-cutover, 41-call-routing-dashboard-and-launch]

# Tech tracking
tech-stack:
  added: []  # zero new deps — zoneinfo, dataclasses, datetime are all stdlib
  patterns:
    - Pure-function test seam (no DB, no HTTP, no FastAPI imports) — reuses src/lib/triage/layer1_keywords.py precedent
    - Handler-layer composition of pure function + soft-cap downgrade (per D-11) kept Phase 39 scope-clean
    - UTC -> tenant-local conversion via single astimezone() call; zoneinfo handles DST gaps/folds without special-case code
    - Start-inclusive, end-exclusive HH:MM string comparison (safe because HH:MM compares lexicographically correctly for zero-padded times)
    - Overnight range encoded as end < start; _in_range() uses `local >= start or local < end` branch

key-files:
  created:
    - livekit-agent/src/webhook/__init__.py
    - livekit-agent/src/webhook/schedule.py
  modified:
    - livekit-agent/tests/webhook/test_schedule.py  # stub from Plan 39-01, skipif flipped and 17 bodies filled in

key-decisions:
  - "evaluate_schedule is a pure function with signature (schedule: dict, tenant_timezone: str, now_utc: datetime) -> ScheduleDecision — zero DB access, zero FastAPI coupling (D-09)"
  - "ScheduleDecision is a @dataclass(frozen=True) with Literal-typed mode and reason fields for static type checking and hashability"
  - "Overnight ranges encoded as end < start (e.g. 19:00-09:00) and evaluated by _in_range()'s two-branch 'local >= start or local < end' check (D-07)"
  - "DST handled entirely by now_utc.astimezone(ZoneInfo(tenant_timezone)) — no fold inspection, no gap detection, Python stdlib correctness (D-08)"
  - "Same-day overnight lookup model: a mon 19:00-09:00 range matches Mon 08:00 local (morning branch) and Mon 20:00 local (evening branch) because the evaluator only looks at days[current_day_key]. Phase 41 UI must also write the range under the next day if true cross-day matching is needed — the evaluator does NOT synthesize cross-day lookups (documented in test_overnight_range_inside_morning docstring)"
  - "_in_range() uses lexicographic HH:MM string comparison — valid only because inputs are zero-padded 24-hour HH:MM (validation is Phase 41 UI's responsibility)"
  - "src/webhook/__init__.py is deliberately import-free — Plan 39-05 will add `from .app import app` later; leaving it empty now prevents circular imports during Plan 39-03 unit tests"

patterns-established:
  - "Pure-function evaluator pattern for schedule/policy logic — trivially unit-testable, composable at handler layer"
  - "17-row fixture table in RESEARCH.md drives 17 one-to-one named test cases — lock contract before implementation"

requirements-completed: [ROUTE-04]

# Metrics
duration: 3min
completed: 2026-04-09
---

# Phase 39 Plan 03: Schedule Evaluator Summary

**Pure-function evaluate_schedule() with ScheduleDecision dataclass, handling enabled/empty/overnight/DST cases across 17 locked unit tests — zero DB, zero FastAPI, zero stubs.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-09T15:53:45Z
- **Completed:** 2026-04-09T15:56:29Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 filled in)

## Accomplishments

- Implemented evaluate_schedule() with the exact D-09 signature: `(schedule: dict, tenant_timezone: str, now_utc: datetime) -> ScheduleDecision`
- Created ScheduleDecision frozen dataclass with Literal-typed mode + reason (type-safe, hashable, pattern-matchable)
- Handled all 6 logical branches: schedule_disabled (2 paths), empty_schedule, outside_window (day-no-ranges + day-ranges-no-match), inside_window (normal + overnight)
- Locked DST correctness via zoneinfo.astimezone() — spring-forward 2026-03-08 NY and fall-back fold 2026-11-01 NY both pass without special-case code
- Filled in and unblocked all 17 test stubs from Plan 39-01: 17 passed, 0 failed, 0 skipped in 0.06s
- Kept src/webhook/__init__.py import-free so Plan 39-05 can add the FastAPI app wiring without circular-import risk

## Task Commits

Each task was committed atomically via `git --no-verify` (parallel executor instructions to avoid pre-commit hook contention with 39-02 and 39-04):

1. **Task 1: Create src/webhook/__init__.py and src/webhook/schedule.py** — `8e9ca80` (feat)
2. **Task 2: Fill in tests/webhook/test_schedule.py with all 17 unit tests** — `76fbd01` (test)

**Plan metadata:** (to be added — SUMMARY.md + STATE.md + ROADMAP.md commit)

## Files Created/Modified

- `livekit-agent/src/webhook/__init__.py` — one-line docstring package marker, import-free (prevents circular imports before Plan 39-05 adds FastAPI app)
- `livekit-agent/src/webhook/schedule.py` — 88 lines: `ScheduleDecision` frozen dataclass + `evaluate_schedule()` pure function + `_in_range()` helper with overnight branch + `_DAY_MAP` for weekday-to-key conversion
- `livekit-agent/tests/webhook/test_schedule.py` — stub from Plan 39-01 rewritten with 17 real assertions across 5 sections (disabled/empty, in/out of window, boundary inclusivity, overnight ranges, DST transitions, multi-range days); module-level `pytestmark = skipif(True)` guard removed

## Decisions Made

All decisions followed the locked D-05..D-11 contracts from 39-CONTEXT.md and the verbatim reference implementation in 39-RESEARCH.md §4 (lines 336-402). No new architectural decisions were needed — the plan specified the exact code to write.

One noteworthy test-authoring choice worth documenting for downstream plans:
- `test_overnight_range_inside_morning` uses Mon 12:00 UTC = Mon 08:00 EDT (still Monday local) with a `mon: [{19:00-09:00}]` range. This works because the evaluator looks up `days["mon"]` for the current local weekday, and `_in_range("08:00", "19:00", "09:00")` returns True via the overnight branch (`"08:00" < "09:00"`). This exercises the "morning branch" of the overnight range without needing a cross-day Mon→Tue lookup. The test docstring records that Phase 41's UI must write the same range under both `mon` and `tue` if true cross-day matching is desired, since the evaluator itself does not synthesize cross-day lookups.

## Deviations from Plan

None — plan executed exactly as written. The reference implementation in 39-RESEARCH.md §4 was copied verbatim. All 17 UTC→local conversions were sanity-checked against a standalone Python script before running pytest, and all matched expected day/time pairs (see self-check below).

CLAUDE.md compliance: no changes to the main Voco repo were made in this plan (all files live in the livekit-agent repo), so the skill-update rule does not apply here. The `.claude/skills/voice-call-architecture/SKILL.md` update for Phase 39 overall (FastAPI webhook, src/webhook/*, routing schema) is Plan 39-07's responsibility per the phase plan.

## Issues Encountered

None. The only minor observation: the pre-existing dirty files in the livekit-agent worktree (unrelated tool/prompt changes, plus some `.pyc` caches and the `voco_livekit_agent.egg-info/` dir) were deliberately NOT staged — only the three files this plan owns were added to each task commit. This preserves the parallel-executor disjoint-file guarantee.

## Self-Check

Verified after writing this SUMMARY (see Self-Check section at end of file).

## User Setup Required

None — pure-function unit tests run on developer machines and CI with no external services.

## Next Phase Readiness

Plan 39-03 is complete. Downstream consumers:
- **Plan 39-05 (FastAPI app + twilio_routes)** can now import `from src.webhook.schedule import evaluate_schedule, ScheduleDecision` and wire the pure function into the `/twilio/incoming-call` handler (though per D-13, Phase 39 handler always returns the hardcoded AI TwiML — the composition is locked for Phase 40).
- **Plan 39-04 (soft caps)** — running in parallel — will produce the other half of D-11's composition (`check_outbound_cap`). The evaluator and cap function remain independent; Phase 40 wires them together at the handler layer in one composition change.
- **Phase 40** has a single-line diff: replace the hardcoded AI TwiML branch with the evaluate_schedule + check_outbound_cap composition from D-11.
- **Phase 41** UI contract is fully frozen: schedule JSONB shape `{enabled, days: {mon..sun: [{start, end}]}}` and the overnight convention (same-day lookup, Phase 41 writes range under both day keys for cross-day matching).

No blockers.

## Self-Check: PASSED

Verified on 2026-04-09T15:56:29Z:

- FOUND: livekit-agent/src/webhook/__init__.py
- FOUND: livekit-agent/src/webhook/schedule.py
- FOUND: livekit-agent/tests/webhook/test_schedule.py
- FOUND: .planning/phases/39-call-routing-webhook-foundation/39-03-SUMMARY.md
- FOUND: commit 8e9ca80 (Task 1 — feat: evaluate_schedule + ScheduleDecision)
- FOUND: commit 76fbd01 (Task 2 — test: 17 filled-in unit tests)
- pytest: `python -m pytest tests/webhook/test_schedule.py -q` → 17 passed, 0 failed, 0 skipped
- import: `from src.webhook.schedule import evaluate_schedule, ScheduleDecision` succeeds
- import: `import src.webhook` succeeds with no FastAPI side effect

---
*Phase: 39-call-routing-webhook-foundation*
*Completed: 2026-04-09*

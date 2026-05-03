---
phase: 61
created: 2026-05-03
purpose: track out-of-scope discoveries during phase 61 execution per GSD Rule 3 SCOPE BOUNDARY
---

# Phase 61 — Deferred Items

Out-of-scope discoveries during Plan 02 execution. NOT fixed by Plan 02
because they are not caused by the current task's changes (per GSD
SCOPE BOUNDARY rule).

## Plan 02 Task 2 — Pre-existing test failures unrelated to google_maps

Encountered while running the full livekit-agent suite to confirm Plan 02
introduced no regressions. ALL of the following pre-date Plan 02; none
involve `src/integrations/google_maps.py` or `tests/test_google_maps.py`.

### Collection errors (pre-existing)

- `tests/test_check_availability_slot_cache.py`
  ModuleNotFoundError: `src.tools.check_availability` — test references a
  module that doesn't exist on the deployed sibling repo. Likely a
  future-phase test scaffold staged ahead of the implementation.
- `tests/test_slot_token_handoff.py`
  Same root cause (likely shared import).

### Test failures (pre-existing, prompt-builder surface)

8 failures in test files NOT touched by Plan 02:

- `tests/test_prompt_booking.py::test_en_availability_contract`
- `tests/test_prompt_booking.py::test_es_availability_contract`
- `tests/test_prompt_booking.py::test_both_locales_onboarding_gated_full_protocol`
- `tests/test_prompt_outcome_words.py::test_en_reserved_words_enumerated`
- `tests/test_prompt_outcome_words.py::test_es_reserved_words_enumerated`
- `tests/test_prompt_outcome_words.py::test_en_failure_mode_3pm_example`
- `tests/test_prompt_tool_narration.py::test_es_mentions_tool_names`
- `tests/test_tenant_timezone_fallback.py::test_check_availability_null_tz_falls_back_to_UTC_with_warn`

Spot check on `test_en_availability_contract`: assertion fails because
the current `_build_booking_section` output does not contain the literal
string `"check_availability"`. This is a Phase 60.3 / 60.4 prompt-shape
drift, not anything introduced by `google_maps.py`.

### Pre-existing deferred VIP test (continuing from prior phases)

- `tests/webhook/test_routes.py::test_incoming_call_vip_lead`
  Documented since Phase 60.3 Plan 01. Phase 61 keeps the same
  `--deselect` posture in 61-VALIDATION.md.

### Plan 02 Task 1 mirror direction

The Plan 02 PLAN.md `<dual_repo_note>` block instructs the executor to
write all files to BOTH `livekit-agent/` (mirror inside homeservice_agent)
AND `C:/Users/leheh/.Projects/livekit-agent/` (sibling repo).

This direction is stale. Commit `b6a385f` ("chore: remove monorepo
livekit-agent/ subdir (partial scaffold confusion)", 2026-04-22) explicitly
deleted the homeservice_agent/livekit-agent/ subdir BECAUSE the dual-tree
pattern caused Phase 59 Plan 05 changes to land in the monorepo scaffold
but NOT on the deployable sibling / Railway. The commit message states:
"Deletes homeservice_agent/livekit-agent/ entirely to eliminate future
drift and the confusion that caused Plan 05 to be misrouted."

Plan 02 executor (this run) followed the established post-`b6a385f`
pattern: all files committed to the sibling repo only. The homeservice_agent
mirror was briefly created during initial file-write but deleted before
commit. This is documented as a deviation in the Plan 02 SUMMARY (Rule 3
auto-fix: plan instructions contradicted established project history;
followed CLAUDE.md / project history per its precedence over plan).

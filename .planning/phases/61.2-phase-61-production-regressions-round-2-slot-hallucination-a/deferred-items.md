# Phase 61.2 — Deferred Items

Pre-existing test failures discovered during Plan 05 (static invariant suite) execution.
None caused by Plans 02/03/04 fixes — all reproduced at livekit-agent main HEAD `1b636bc` BEFORE Plan 05's test file was added.

Plan 05's contribution: 5 new tests, 5 passed, 0 new failures.

## Pre-existing collection errors (livekit-agent)

```
ERROR tests/test_check_availability_slot_cache.py
  ModuleNotFoundError: No module named 'src.tools.check_availability'
ERROR tests/test_slot_token_handoff.py
  (same import error)
```

Cause: `src/tools/check_availability` was renamed/split into `check_day.py`, `check_slot.py`, `next_available_days.py` at some prior phase, and these test modules' imports were not updated. Out of scope for Phase 61.2 (cascade-mitigation).

## Pre-existing failures (livekit-agent — 11 failed at HEAD before Plan 05)

```
tests/test_goodbye_diag.py::test_flush_is_first_in_on_close_even_if_pipeline_times_out
tests/test_goodbye_diag.py::test_transcript_tail_truncated_to_500_chars_and_no_raw_phone
tests/test_prompt_booking.py::test_en_availability_contract
tests/test_prompt_booking.py::test_es_availability_contract
tests/test_prompt_booking.py::test_both_locales_onboarding_gated_full_protocol
tests/test_prompt_outcome_words.py::test_en_reserved_words_enumerated
tests/test_prompt_outcome_words.py::test_es_reserved_words_enumerated
tests/test_prompt_outcome_words.py::test_en_failure_mode_3pm_example
tests/test_prompt_tool_narration.py::test_es_mentions_tool_names
tests/test_tenant_timezone_fallback.py::test_check_availability_null_tz_falls_back_to_UTC_with_warn
tests/webhook/test_routes.py::test_incoming_call_vip_lead
```

Note: the VIP test failure is the long-standing tolerated failure from Phase 60.3 Plan 01.
The other 10 are likely drift from Phase 63.1 (`generate_reply` removal + greeting-section restructure) and Phase 60.4 work — out of scope for Phase 61.2.

## Verification — Plan 05 introduced no new failures

```
HEAD (1b636bc, pre-Plan-05): 282 passed, 11 failed (excluding 2 collection errors)
HEAD + Plan 05 test file:    287 passed, 11 failed (excluding 2 collection errors)
Delta:                        +5 passed, ±0 failed
```

The 5 new invariants in `tests/test_tool_mute_invariants.py` all pass.

# Deferred Items — Phase 61.3

Items discovered during execution but out of scope for this phase.

## Pre-existing test collection errors (livekit-agent repo)

Two test files reference a removed module `src.tools.check_availability` (the
monolithic file was split into `_availability_lib.py` + `check_slot.py` +
`check_day.py` + `next_available_days.py` in an earlier phase, but these
two test files were not migrated):

- `tests/test_check_availability_slot_cache.py` — `from src.tools.check_availability import create_check_availability_tool`
- `tests/test_slot_token_handoff.py` — same import

**Discovered during:** Phase 61.3 Plan 03 full-suite verification.
**Last modified by:** Pre-existing commit `e580f14` ("fix: strip hallucinated slot_token example + add _last_offered_token fallback") — well before phase 61.3.
**Impact:** Collection-level errors prevent the full `pytest tests/` run from completing, but ALL OTHER suites including the 11 cascade-recovery + tool-mute invariants pass when targeted directly.
**Action:** Out of scope for 61.3 (no relation to cascade-recovery / mute / Gemini Live). A future cleanup plan should either delete these test files or migrate their imports to `_availability_lib` + the per-file tools.

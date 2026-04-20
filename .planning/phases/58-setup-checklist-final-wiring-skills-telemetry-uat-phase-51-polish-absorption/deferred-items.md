# Phase 58 Deferred Items

Out-of-scope discoveries from Plan 58-07 execution that are NOT fixed by this plan (per scope boundary rule — only auto-fix issues DIRECTLY caused by the current task's changes).

## Pre-existing failing tests

### tests/integrations/jobber/visit-mapper.test.js (9 failures)

- **Source commit:** `63f9a87 feat(57-02): add Jobber visit-to-calendar_event mapper + upsert helper`
- **Phase:** 57-02
- **Nature:** All 9 failures in `describe('upsertCalendarEventFromVisit')` — test expectations mismatch the upsert helper's return shape / argument shape. Example at line 182: `expect(res).toEqual({ action: 'upserted' })` fails because returned shape differs.
- **Impact on Plan 58-07:** NONE — this file is unrelated to the refresh / error_state contract extended here.
- **Recommendation:** Track as Phase 57 regression in STATE.md Blockers; consider a narrow fix-up plan if/when Phase 57 work is revisited. Not a ship blocker for Phase 58 because the feature under test is unrelated to Phase 58 deliverables.

## Sibling livekit-agent test regressions (3 tests)

- **Source:** Plan 58-03 SUMMARY, Deviations Rule 3 section
- **Tests:** `test_returns_full_shape_on_match`, `test_matches_freeform_phone`, `test_outstanding_balance_excludes_paid_draft_voided` in sibling `C:/Users/leheh/.Projects/livekit-agent/tests/`
- **Nature:** Sibling repo's `xero.py`/`jobber.py` were modified with module-level `get_supabase_admin` import without the defensive try/except fallback (permission-blocked mid-execution).
- **Remediation path:** User copies Voco worktree `livekit-agent/src/integrations/xero.py` + `jobber.py` over sibling versions during Railway redeploy (tracked in 58-03 SUMMARY "User Setup Required" block).
- **Impact on Plan 58-07:** Blocks UAT scenarios 9-11 until redeploy gate (Task 0) is cleared.

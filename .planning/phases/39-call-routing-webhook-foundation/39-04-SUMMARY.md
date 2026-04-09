---
phase: 39-call-routing-webhook-foundation
plan: 04
subsystem: infra
tags: [fastapi, python, supabase, pytest, pytest-asyncio, asyncio, twilio-routing, soft-caps, phone-normalization]

requires:
  - phase: 39-01
    provides: pytest-asyncio dev deps, test_caps.py stub with 8 test names and skipif guard
  - phase: 27-country-aware-onboarding-and-number-provisioning
    provides: tenants.country column (source for check_outbound_cap routing decisions)
provides:
  - "src/lib/phone.py module-level _normalize_phone function (was a closure in agent.py)"
  - "src/webhook/caps.py with async check_outbound_cap(tenant_id, country) -> bool"
  - "8 passing unit tests for check_outbound_cap covering US/CA/SG and unknown-country fallback"
  - "Frozen contract for Phase 40 D-11 composition: evaluate_schedule + check_outbound_cap"
affects: [39-05, 40, 41]

tech-stack:
  added: []  # all deps already pinned by 39-01 (pytest-asyncio) and base project (supabase-py)
  patterns:
    - "Lazy import of get_supabase_admin inside async function for test-time monkeypatching"
    - "asyncio.to_thread(lambda: supabase.table().select().eq().gte().execute()) for sync supabase-py from async handlers"
    - "MagicMock chain fixture mimicking supabase-py PostgREST builder (select/eq/gte/execute)"
    - "Python-side SUM over returned rows instead of a PostgREST aggregate RPC (resolves OQ-2)"

key-files:
  created:
    - livekit-agent/src/lib/phone.py
    - livekit-agent/src/webhook/caps.py
  modified:
    - livekit-agent/src/agent.py (removed inline _normalize_phone closure, added import)
    - livekit-agent/tests/webhook/test_caps.py (removed skipif, filled in 8 stubs)

key-decisions:
  - "_normalize_phone stays underscore-prefixed and lives in src/lib/phone.py (resolves OQ-3)"
  - "check_outbound_cap is async + asyncio.to_thread (resolves OQ-1)"
  - "SUM computed in Python from returned rows — no new RPC migration needed (resolves OQ-2)"
  - "Unknown country falls back to US limit (300000s) — fail-open safe default per D-17"
  - "Cap breach emits warning log only in Phase 39; dedicated event logging deferred to Phase 40 per D-11"
  - "get_supabase_admin is lazy-imported inside check_outbound_cap so tests can monkeypatch before first call"

patterns-established:
  - "Module-level _month_start_utc_iso helper for monkey-patchable month boundaries without mocking datetime.now"
  - "Per-country limit dict (_LIMITS_SEC) + _DEFAULT_LIMIT_SEC fallback for any future country additions"

requirements-completed: [ROUTE-05]

duration: 3min
completed: 2026-04-09
---

# Phase 39 Plan 04: Extract _normalize_phone + implement check_outbound_cap Summary

**Extracted _normalize_phone to src/lib/phone.py as an importable module function, and shipped src/webhook/caps.py with an async per-country outbound-minute cap checker backed by 8 passing unit tests with mocked supabase-py chains.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-09T15:54:31Z
- **Completed:** 2026-04-09T15:57:25Z
- **Tasks:** 2 (both fully autonomous, no checkpoints)
- **Files created:** 2 (src/lib/phone.py, src/webhook/caps.py)
- **Files modified:** 2 (src/agent.py, tests/webhook/test_caps.py)

## Accomplishments

- `_normalize_phone` is now importable from `src.lib.phone` — Plan 39-05's `/twilio/incoming-call` handler can reuse the exact same normalization logic (same strip sequence: sip: → @domain → tel: → strip → leading-digit-to-plus) without duplicating a closure.
- `src/agent.py` entrypoint is 14 lines shorter and now imports `_normalize_phone` from `.lib.phone` at module scope. Behavior is byte-identical — the closure body was copied verbatim.
- `src/webhook/caps.py` implements `async def check_outbound_cap(tenant_id: str, country: str) -> bool` with the D-17 limits baked into `_LIMITS_SEC` (US/CA = 300_000s, SG = 150_000s) and a `_DEFAULT_LIMIT_SEC` fallback to US limit for unknown countries.
- 8 unit tests cover every documented behavior case: under/at/over US cap, under/at SG cap, CA at-cap (validates CA shares US limit), unknown country fallback, and fresh-tenant zero-seconds edge case. All 8 pass in 0.93s with mocked Supabase chains — zero real DB calls.
- Contract is frozen for Phase 40: the handler-layer composition `evaluate_schedule(...) → check_outbound_cap(...) → downgrade to AI if over cap` now has two pure-ish callables available. Phase 40 only needs to add the composition glue.

## Task Commits

1. **Task 1: Extract _normalize_phone to src/lib/phone.py** — `b8eba94` (feat)
2. **Task 2 RED: Fill in 8 failing tests for check_outbound_cap** — `1bdf176` (test)
3. **Task 2 GREEN: Implement check_outbound_cap with US/CA/SG limits** — `b496eae` (feat)

(No REFACTOR commit — initial implementation was already at target shape, no cleanup needed.)

## Files Created/Modified

### Created

**`livekit-agent/src/lib/phone.py`** (35 lines) — Module with `_normalize_phone(number: str) -> str`. Strips `sip:` / `tel:` prefixes, splits `@domain` suffix, trims whitespace, prepends `+` if the result starts with a digit. Returns falsy inputs unchanged (empty string or None both survive). Docstring explains that this was extracted from `src/agent.py::entrypoint()` in Plan 39-04 so that the webhook handler in Plan 39-05 can import it.

**`livekit-agent/src/webhook/caps.py`** (92 lines) — `_LIMITS_SEC` dict, `_DEFAULT_LIMIT_SEC`, `_month_start_utc_iso()` helper, and `async def check_outbound_cap(tenant_id: str, country: str) -> bool`. The function lazy-imports `get_supabase_admin` from `src.supabase_client` (so tests can monkeypatch before first call), runs the `supabase.table("calls").select("outbound_dial_duration_sec").eq("tenant_id", ...).gte("created_at", month_start).execute()` chain inside `asyncio.to_thread`, sums `outbound_dial_duration_sec` across returned rows in Python, and returns `total_sec < limit_sec`. Cap breach emits a `logger.warning("[webhook] Outbound cap hit: ...")`. Country lookup is case-insensitive (`country.upper()`).

### Modified

**`livekit-agent/src/agent.py`**:
- **Added** (1 line, top of file around line 40): `from .lib.phone import _normalize_phone`
- **Removed** (13 lines, in `entrypoint()` around lines 108-120): the inline `def _normalize_phone(number: str) -> str:` closure. The two call sites (`to_number = _normalize_phone(to_number)` and `from_number = _normalize_phone(from_number)`) remain at their original positions and now resolve to the imported module-level function.
- **Net diff:** -14 +6 lines. `ast.parse` still succeeds.

**`livekit-agent/tests/webhook/test_caps.py`**:
- **Removed:** `pytestmark = pytest.mark.skipif(True, ...)` guard at the top of the file (flipped per plan instructions).
- **Added:** `from src.webhook.caps import check_outbound_cap` import, `_make_mock_supabase(rows)` helper that builds a `MagicMock` mimicking the `supabase.table(...).select(...).eq(...).gte(...).execute()` chain, and 8 test function bodies using `monkeypatch.setattr("src.supabase_client.get_supabase_admin", lambda: _make_mock_supabase(rows))`.

## Final caps.py Contract

```python
async def check_outbound_cap(tenant_id: str, country: str) -> bool:
    # True if under monthly cap, False if at/over
```

| Country | Limit (seconds) | Limit (minutes) |
|---------|-----------------|-----------------|
| US      | 300_000         | 5000            |
| CA      | 300_000         | 5000            |
| SG      | 150_000         | 2500            |
| Unknown | 300_000 (US fallback) | 5000      |

Query strategy: direct PostgREST `select` chain + Python-side sum (no RPC aggregate, no new migration). At Phase 39 scale this is bounded by per-tenant monthly call volume and is cheap — the supporting index `idx_calls_tenant_month` is added in Plan 39-02.

## Final phone.py Contract

```python
def _normalize_phone(number: str) -> str
```

Normalization sequence (preserved verbatim from the deleted closure):
1. If `not number` → return unchanged
2. Strip `sip:` prefix
3. Split on `@` and keep left side
4. Strip `tel:` prefix
5. `.strip()` whitespace
6. If result starts with a digit → prepend `+`

## pytest Output

```
$ cd livekit-agent && python -m pytest tests/webhook/test_caps.py -v
platform win32 -- Python 3.13.3, pytest-9.0.3, pluggy-1.6.0
rootdir: C:\Users\leheh\.Projects\livekit-agent
configfile: pyproject.toml
plugins: anyio-4.9.0, postmarker-1.0, asyncio-1.3.0
asyncio: mode=Mode.AUTO
collecting ... collected 8 items

tests/webhook/test_caps.py::test_under_cap_us_returns_true              PASSED [ 12%]
tests/webhook/test_caps.py::test_at_cap_us_returns_false                PASSED [ 25%]
tests/webhook/test_caps.py::test_at_cap_ca_returns_false                PASSED [ 37%]
tests/webhook/test_caps.py::test_over_cap_us_returns_false              PASSED [ 50%]
tests/webhook/test_caps.py::test_under_cap_sg_returns_true              PASSED [ 62%]
tests/webhook/test_caps.py::test_at_cap_sg_returns_false                PASSED [ 75%]
tests/webhook/test_caps.py::test_unknown_country_falls_back_to_us_limit PASSED [ 87%]
tests/webhook/test_caps.py::test_zero_seconds_used_returns_true         PASSED [100%]

============================== 8 passed in 0.93s ==============================
```

`test_schedule.py` (17 tests, owned by sibling Plan 39-03) is NOT run from this plan's self-check because 39-03 executes in the same wave in parallel and may or may not have landed when this summary is written. Verifier Phase should run both test files together.

## Decisions Made

- **Lazy import of `get_supabase_admin` inside the async function.** Needed so `monkeypatch.setattr("src.supabase_client.get_supabase_admin", ...)` in each test can patch the symbol *before* the function resolves it. If the import were at module top, the function would capture the original reference at module-load time and tests would need to patch via the `src.webhook.caps.get_supabase_admin` path, which is more brittle.
- **`MagicMock`-based supabase-py chain over a hand-rolled fake.** One helper `_make_mock_supabase(rows)` is reused by all 8 tests, keeps test bodies to ~8 lines each, and mirrors the real supabase-py fluent-builder shape exactly. No conftest fixture — inlined per plan instructions.
- **Python-side SUM over PostgREST rows rather than an RPC aggregate.** RESEARCH OQ-2 flagged that supabase-py's aggregate syntax varies by version and is fragile. At Phase 39 scale a per-tenant monthly row scan is bounded and cheap; skipping an RPC keeps Phase 39's migration identical to the D-18 shape (no new `sum_monthly_outbound` function to create or roll back).
- **`_month_start_utc_iso` as a module-level helper.** Trivially monkey-patchable from future cross-month-boundary tests without mocking `datetime.now` itself. Phase 39 doesn't exercise it (tests don't care about month boundaries since they control the returned rows) but the seam is free insurance for Phase 40.
- **Cap-breach logging is a `logger.warning` call only.** CONTEXT.md Claude's Discretion list explicitly says Phase 40 wires the dedicated event logging path — Phase 39 emits a single structured warning and moves on.

## Deviations from Plan

None — plan executed exactly as written.

The plan spec's acceptance criteria (7 grep patterns + 3 runtime assertions + `ast.parse` + full pytest run) all passed on first try. The TDD discipline for Task 2 was followed in a natural order (test file with skipif removed → ModuleNotFoundError RED → implementation → all 8 GREEN), with separate `test(...)` and `feat(...)` commits. No REFACTOR phase was needed — the initial implementation was already at target shape.

The plan verification in `<verification>` references `tests/webhook/test_schedule.py` (17 tests) which is owned by the parallel sibling 39-03 in the same wave. I deliberately did not run that file as part of this plan's self-check because 39-03 may not have committed by the time this runs, and running it would introduce false failure signals unrelated to this plan's scope. The plan's per-task `<automated>` verify blocks only reference `test_caps.py`, so this isn't a deviation — just a scope note for the verifier.

## Issues Encountered

None. The only minor environmental note is that committing to the `livekit-agent` repo emitted "LF will be replaced by CRLF" warnings (expected on Windows with autocrlf=true) — these are warnings, not errors, and the files committed cleanly.

## Parallel Execution Compliance

Per the parallel_execution contract in the spawn prompt:
- **Touched only the declared file set:** `src/lib/phone.py`, `src/webhook/caps.py`, `tests/webhook/test_caps.py`, plus the sanctioned edit to `src/agent.py` (lines 39-40 import + lines 108-120 closure removal, explicitly in scope per Task 1).
- **Did NOT touch:** `src/webhook/__init__.py`, `src/webhook/schedule.py`, `tests/webhook/test_schedule.py` (39-03's turf). Verified `src/webhook/__init__.py` already exists (created by 39-01 or 39-03) and I only read it without modifying.
- **Committed with `--no-verify`** to avoid pre-commit hook contention with parallel siblings.
- **No shared-file merge surface:** my changes to `src/agent.py` (import line + closure removal) are on lines that no other plan in this wave edits. Plan 39-05 is Wave 2 and will edit different lines (`health` import swap).

## User Setup Required

None — no external service configuration, no env var changes, no dashboard updates. All changes are internal to the Python codebase and covered by unit tests.

## Next Phase Readiness

- **Plan 39-05 (Wave 2)** can now `from src.lib.phone import _normalize_phone` in its webhook handler and reuse the same normalization logic the LiveKit agent uses for tenant lookup. The import path matches the module it deletes (`src/health.py`) at the same relative depth, so agent.py's import block stays uniform.
- **Phase 40** can now compose `evaluate_schedule` (Plan 39-03) and `check_outbound_cap` (this plan) per D-11:
  ```python
  decision = evaluate_schedule(schedule, tz, now_utc)
  if decision.mode == 'owner_pickup':
      if not await check_outbound_cap(tenant_id, country):
          decision = ScheduleDecision(mode='ai', reason='soft_cap_hit')
  ```
  The single line replacement in Phase 40's handler matches the contract described in CONTEXT.md §Decisions D-11 exactly.
- **Contract frozen for Phase 40 and 41:** function signature, return type, country-code case handling, unknown-country fallback behavior, query strategy, and monthly-boundary anchoring are all locked and tested. Phase 40 will not need to re-open this module.

## Self-Check: PASSED

- **Files exist:**
  - `livekit-agent/src/lib/phone.py` — FOUND
  - `livekit-agent/src/webhook/caps.py` — FOUND
  - `livekit-agent/tests/webhook/test_caps.py` — FOUND (updated, not created)
  - `.planning/phases/39-call-routing-webhook-foundation/39-04-SUMMARY.md` — FOUND
- **Commits exist (livekit-agent repo):**
  - `b8eba94` feat(39-04): extract _normalize_phone to src/lib/phone.py — FOUND
  - `1bdf176` test(39-04): fill in 8 failing unit tests for check_outbound_cap — FOUND
  - `b496eae` feat(39-04): implement check_outbound_cap with US/CA/SG limits — FOUND
- **Post-write integration test:** After 39-03 landed its commits in parallel (`8e9ca80`, `76fbd01`), I re-ran the combined suite and got `25 passed in 1.00s` — matching the plan's top-level `<verification>` success criterion of "25 passed (17 schedule + 8 caps)". Phase 39 Wave 1's two pure-function deliverables (evaluate_schedule + check_outbound_cap) are now fully green on main.

---
*Phase: 39-call-routing-webhook-foundation*
*Plan: 04*
*Completed: 2026-04-09*

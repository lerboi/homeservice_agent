---
phase: 61
plan: 02
subsystem: voice-call-architecture / integrations
tags: [google-maps, address-validation, livekit-agent, python, tdd, wave-0]

dependency-graph:
  requires:
    - "Phase 55/56 integrations baseline (xero.py + jobber.py shape)"
    - "Phase 63 livekit-agents 1.5.6 mainline pin (already shipped)"
  provides:
    - "src/integrations/google_maps.py (validate_address_bounded, validate_address, map_verdict, map_components)"
    - "tests/fixtures/gmaps_responses/ (8 recorded API responses)"
    - "tests/test_google_maps.py (20 contract tests)"
    - "tests/conftest.py gmaps_fixture loader"
    - "pyproject.toml direct httpx>=0.27,<1 pin"
  affects:
    - "Plan 03 — book_appointment.py + capture_lead.py integration (depends on this module)"
    - "Plan 01 — DB migration 062 (gmaps_validate_events table; runs in parallel)"

tech-stack:
  added: []
  patterns:
    - "Per-call httpx.AsyncClient (matches xero.py / jobber.py shape, NOT module-level singleton)"
    - "Outer-wrapper never-raises idiom (validate_address_bounded → always returns Voco-shaped dict)"
    - "Dual-layer timeout enforcement: socket-level (httpx.Timeout) + task-level (asyncio.wait_for)"
    - "Sentry-on-error-only gate (D-A3, D-C3 — unsupported_region/skipped do NOT page)"
    - "Telemetry-after-HTTP pattern with sync supabase chain wrapped in asyncio.to_thread"
    - "Recorded-fixture JSON test corpus (no live API calls; deterministic CI)"

key-files:
  created:
    - "C:/Users/leheh/.Projects/livekit-agent/src/integrations/google_maps.py (412 LOC)"
    - "C:/Users/leheh/.Projects/livekit-agent/tests/test_google_maps.py (20 tests)"
    - "C:/Users/leheh/.Projects/livekit-agent/tests/fixtures/gmaps_responses/us_confirmed.json"
    - "C:/Users/leheh/.Projects/livekit-agent/tests/fixtures/gmaps_responses/us_confirm_with_corrections.json"
    - "C:/Users/leheh/.Projects/livekit-agent/tests/fixtures/gmaps_responses/us_fix_required.json"
    - "C:/Users/leheh/.Projects/livekit-agent/tests/fixtures/gmaps_responses/ca_confirmed.json"
    - "C:/Users/leheh/.Projects/livekit-agent/tests/fixtures/gmaps_responses/sg_hdb_confirmed.json"
    - "C:/Users/leheh/.Projects/livekit-agent/tests/fixtures/gmaps_responses/sg_hdb_subpremise_missing.json"
    - "C:/Users/leheh/.Projects/livekit-agent/tests/fixtures/gmaps_responses/unsupported_region_de.json"
    - "C:/Users/leheh/.Projects/livekit-agent/tests/fixtures/gmaps_responses/quota_exceeded_429.json"
    - ".planning/phases/61-google-maps-address-validation-and-structured-address-storage/deferred-items.md"
  modified:
    - "C:/Users/leheh/.Projects/livekit-agent/tests/conftest.py (gmaps_fixture loader appended)"
    - "C:/Users/leheh/.Projects/livekit-agent/pyproject.toml (httpx>=0.27,<1 promoted to direct dep)"

decisions:
  - "[Plan 02 Task 1]: TDD RED — wrote 20 contract tests + 8 recorded fixtures BEFORE the module; pytest exited with ImportError as the desired RED-phase signal. Test names map directly to D-XX requirements (5 verdict-mapper, 4 components-mapper, 1 country_code source, 4 HTTP error paths, 2 Sentry gate, 1 telemetry, 1 public API shape, plus 2 extras for module-export + never-raises invariants)."
  - "[Plan 02 Task 2]: TDD GREEN on first run — implementation file passed all 20 tests on first pytest invocation with NO test modifications. Confirms the contract shape Plan 02 Task 1 froze was implementable end-to-end as specified."
  - "[Plan 02 Deviation Rule 3]: PLAN.md <dual_repo_note> directed dual-tree commits (homeservice_agent/livekit-agent/ mirror + sibling C:/Users/leheh/.Projects/livekit-agent/). This direction is stale — homeservice_agent commit b6a385f (2026-04-22) DELETED the mirror BECAUSE the dual-tree pattern caused Phase 59 Plan 05 changes to land on the monorepo scaffold but NOT on the deployable sibling/Railway. CLAUDE.md precedence + project history override the stale plan directive. All Plan 02 code files committed to the sibling repo only; documentation (this SUMMARY, deferred-items.md) committed to homeservice_agent."
  - "[Plan 02 Task 2 architecture]: Used `asyncio.wait_for(...)` for the outer-wrapper task-level timeout (matching xero.py:482) rather than the newer `asyncio.timeout()` context manager. Both work on Python 3.11+ which is the project's pinned floor; wait_for stays consistent with the rest of the integrations layer."
  - "[Plan 02 Task 2 telemetry]: Wrapped the sync supabase chain in `asyncio.to_thread(...)` so the telemetry write does not block the event loop. Test harness passes a MagicMock chain that resolves synchronously inside the thread; production sync supabase-py also resolves synchronously inside the thread. Both runtimes share the same code path."

metrics:
  start_time_utc: "2026-05-03T<see git log>"
  duration_minutes: ~25
  completed_date: "2026-05-03"
  task_count: 2
  test_count: 20
  fixture_count: 8
  module_loc: 412
---

# Phase 61 Plan 02: Google Maps Address Validation Client + Wave 0 Tests Summary

**One-liner:** Voco LiveKit agent's external Google Maps Address Validation client (`validate_address_bounded`) — never-raises wrapper, 1.5s hard timeout, Sentry-on-error-only gate, per-validate telemetry to `gmaps_validate_events`, with 20 contract tests + 8 recorded API-response fixtures locking every D-XX behavior.

## What shipped

### `src/integrations/google_maps.py` (412 LOC, 7 functions)

Public API (all exported at module level):

| Symbol | Type | Contract |
|--------|------|----------|
| `VERDICT_ACCEPT` | str constant | `"ACCEPT"` |
| `VERDICT_CONFIRM` | str constant | `"CONFIRM"` |
| `VERDICT_CONFIRM_ADD_SUBPREMISES` | str constant | `"CONFIRM_ADD_SUBPREMISES"` |
| `VERDICT_FIX` | str constant | `"FIX"` |
| `map_verdict(google_response)` | pure | possibleNextAction → `confirmed`/`confirmed_with_changes`/`unconfirmed` |
| `map_components(addr)` | pure | D-D1 9-key Voco dict; country_code from `postalAddress.regionCode` |
| `validate_address(*, region_code, address_lines, ...)` | async | Bare HTTP call, returns Voco-shaped dict |
| `validate_address_bounded(tenant_id, call_id, *, region_code, ...)` | async | Outer wrapper — never raises, Sentry-on-error-only, telemetry insert |

Private helpers: `_empty_components`, `_voco_result`, `_is_unsupported_region_400`.

Voco return shape (stable across all paths):

```python
{
    "verdict": "confirmed" | "confirmed_with_changes" | "unconfirmed"
               | "unsupported_region" | "error" | "skipped",
    "formatted_address": str | None,
    "place_id": str | None,
    "latitude": float | None,
    "longitude": float | None,
    "address_components": dict,    # always present; D-D1 9-key shape
    "latency_ms": int,
    "raw_status": int | None,
}
```

### `tests/test_google_maps.py` (20 tests)

| # | Test | D-XX |
|---|------|------|
| 1 | `test_map_verdict_accept_to_confirmed` | D-A1 |
| 2 | `test_map_verdict_confirm_to_confirmed_with_changes` | D-A1 |
| 3 | `test_map_verdict_confirm_add_subpremises_to_confirmed_with_changes` | D-A1, D-B1 |
| 4 | `test_map_verdict_fix_to_unconfirmed` | D-A1 |
| 5 | `test_map_verdict_missing_action_defaults_unconfirmed` | D-A1 (defensive) |
| 6 | `test_components_mapper_us` | D-D1 |
| 7 | `test_components_mapper_ca` | D-D1, D-A2 |
| 8 | `test_components_mapper_sg_hdb` | D-D1, D-A2 |
| 9 | `test_components_mapper_sg_subpremise_absent` | D-D1 (defensive) |
| 10 | `test_country_code_from_region_code` | D-D1 / Pitfall 4 |
| 11 | `test_validate_address_bounded_returns_skipped_when_no_api_key` | D-G1 |
| 12 | `test_validate_address_bounded_returns_unsupported_region_on_400` | D-A3 |
| 13 | `test_validate_address_bounded_returns_error_on_429` | D-C3 |
| 14 | `test_validate_address_bounded_returns_error_on_timeout` | D-C1 |
| 15 | `test_sentry_called_only_on_error_verdict` | D-C3 |
| 16 | `test_sentry_NOT_called_on_unsupported_region` | D-A3, D-C3 |
| 17 | `test_telemetry_row_inserted_per_call` | D-C2' |
| 18 | `test_validate_address_bounded_return_dict_keys` | API shape |
| 19 | `test_module_exports_constants` | API shape |
| 20 | `test_validate_address_bounded_never_raises_on_unexpected_exception` | D-C3 |

### Fixtures: `tests/fixtures/gmaps_responses/` (8 files)

| Fixture | Verdict / HTTP | Region | Purpose |
|---------|----------------|--------|---------|
| `us_confirmed.json` | ACCEPT (200) | US | Canonical confirmed path |
| `us_confirm_with_corrections.json` | CONFIRM (200) | US | spellCorrected component |
| `us_fix_required.json` | FIX (200) | US | addressComplete=false, gibberish |
| `ca_confirmed.json` | ACCEPT (200) | CA | Canadian regionCode |
| `sg_hdb_confirmed.json` | ACCEPT (200) | SG | HDB with subpremise present |
| `sg_hdb_subpremise_missing.json` | CONFIRM_ADD_SUBPREMISES (200) | SG | HDB without subpremise |
| `unsupported_region_de.json` | (HTTP 400) | DE | INVALID_ARGUMENT body |
| `quota_exceeded_429.json` | (HTTP 429) | — | RESOURCE_EXHAUSTED body |

### `pyproject.toml` diff (single-line addition)

```diff
     "phonenumbers>=9.0,<10",
+    # Phase 61 Pitfall 8: promote httpx from transitive (via livekit-agents /
+    # supabase) to a direct, version-pinned dep. The Address Validation client
+    # in src/integrations/google_maps.py imports it explicitly; we don't want a
+    # silent ImportError if a future minor of livekit-agents drops it.
+    "httpx>=0.27,<1",
 ]
```

### `tests/conftest.py` diff

Added `gmaps_fixture` pytest fixture that loads JSON files from
`tests/fixtures/gmaps_responses/{name}.json` by name. Phase 60.2 / 60.3 Stream A
fixtures (mock_run_context, deps_factory, mock_diag_record, mock_agent_session,
mock_deps_with_diag) preserved unchanged.

## TDD flow

| Stage | Outcome | Evidence |
|-------|---------|----------|
| RED (Task 1) | `pytest tests/test_google_maps.py -x` exits non-zero with `ImportError: cannot import name 'google_maps' from 'src.integrations'` | Commit `1174723` |
| GREEN (Task 2) | `pytest tests/test_google_maps.py -x` exits 0 — 20/20 PASS on first run | Commit `001a83c` |

Zero test modifications between RED and GREEN. The contract Plan 02 Task 1 froze was implementable as specified.

## Mirror-vs-sibling sync confirmation

**Files committed to sibling repo `C:/Users/leheh/.Projects/livekit-agent/`:**

| Commit | Files |
|--------|-------|
| `1174723` | pyproject.toml, tests/conftest.py, tests/fixtures/gmaps_responses/*.json (8 files), tests/test_google_maps.py |
| `001a83c` | src/integrations/google_maps.py |

**Files NOT committed to homeservice_agent monorepo mirror** (deviation — see below).

## Deviations from Plan

### Auto-fixed (Rule 3 — blocking issue: stale plan directive contradicts project history)

**1. [Rule 3 — Plan instruction stale] Skipped homeservice_agent/livekit-agent/ mirror writes**

- **Found during:** Task 1, when first attempting to copy fixtures to the homeservice_agent mirror path
- **Issue:** Plan 02 PLAN.md `<dual_repo_note>` block directs the executor to write all files to BOTH `livekit-agent/` (mirror inside homeservice_agent) AND `C:/Users/leheh/.Projects/livekit-agent/` (sibling repo).
- **Why it's stale:** homeservice_agent commit `b6a385f` ("chore: remove monorepo livekit-agent/ subdir (partial scaffold confusion)", 2026-04-22) explicitly DELETED the mirror because the dual-tree pattern caused Phase 59 Plan 05 changes to land on the monorepo scaffold but NOT on the deployable sibling / Railway. The commit message states: *"Deletes homeservice_agent/livekit-agent/ entirely to eliminate future drift and the confusion that caused Plan 05 to be misrouted."*
- **Fix:** Followed the established post-`b6a385f` pattern: all Plan 02 code files committed to the sibling repo only. The homeservice_agent mirror was briefly created during initial file-write but deleted before commit. Plan 03/04 should adopt the same pattern unless the user explicitly reinstates the mirror.
- **Files affected:** All Plan 02 source/test files (would have been duplicated; instead live only in the sibling repo).
- **Commit:** N/A — this is the absence of mirror commits.

### Auto-fixed (Rule 2 — added defensive behavior)

**2. [Rule 2 — Defensive empty-input handling in mappers]**

- **Found during:** Task 2 implementation
- **Issue:** Plan 02 `<action>` block for `map_components` says "takes `google_response['result']['address']` (or {})". Plan didn't specify what happens if a non-dict is passed (e.g. `None` from a malformed response).
- **Fix:** Both `map_verdict` and `map_components` now coerce non-dict inputs to `{}` before processing. This is a Rule 2 correctness requirement — mappers are pure and must not raise on malformed input; raising would propagate up to `validate_address` and require additional defensive layers.
- **Files affected:** `src/integrations/google_maps.py`
- **Commit:** `001a83c` (folded into the GREEN commit; no separate fix commit needed)

### No other deviations

The implementation followed the plan's `<action>` block for Task 2 module structure precisely. Module constants, mapper signatures, HTTP-classification rules, Sentry gate, telemetry-insert payload shape, and logging convention all match the spec.

## Auth gates / human-action

None. Pure code work; no live API calls were placed (the GOOGLE_MAPS_API_KEY provisioning is a future user-action gate per D-G3, but Plan 02 explicitly mocks at the httpx boundary so no key is needed).

## Self-Check: PASSED

- File `C:/Users/leheh/.Projects/livekit-agent/src/integrations/google_maps.py` — FOUND (412 LOC)
- File `C:/Users/leheh/.Projects/livekit-agent/tests/test_google_maps.py` — FOUND (20 tests collected)
- All 8 fixtures under `C:/Users/leheh/.Projects/livekit-agent/tests/fixtures/gmaps_responses/` — FOUND
- `C:/Users/leheh/.Projects/livekit-agent/pyproject.toml` contains `"httpx>=0.27,<1"` in `[project] dependencies` — FOUND
- Commit `1174723` (Task 1 RED) — FOUND in sibling repo `git log --oneline | grep 1174723`
- Commit `001a83c` (Task 2 GREEN) — FOUND in sibling repo `git log --oneline | grep 001a83c`
- `pytest tests/test_google_maps.py -x` — 20 passed
- `pytest tests/test_no_generate_reply_in_src.py -x` — 1 passed (Phase 63.1 regression guard intact)

8 pre-existing test failures (`test_prompt_booking.py`, `test_prompt_outcome_words.py`, `test_prompt_tool_narration.py`, `test_tenant_timezone_fallback.py`) and 2 pre-existing collection errors (`test_check_availability_slot_cache.py`, `test_slot_token_handoff.py`) are documented in `deferred-items.md`. None of them touch Plan 02's surface — they are out-of-scope per GSD SCOPE BOUNDARY rule.

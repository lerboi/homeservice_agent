---
phase: 39-call-routing-webhook-foundation
plan: 01
subsystem: testing
tags: [pytest, pytest-asyncio, httpx, fastapi-prep, requirements-doc, wave-0]

# Dependency graph
requires:
  - phase: none
    provides: Wave 0 is the anchor — no prior phase dependencies for this plan
provides:
  - ROUTE-01..06 requirement IDs with one-line definitions in REQUIREMENTS.md
  - pytest + pytest-asyncio + httpx dev deps in livekit-agent
  - pytest config [tool.pytest.ini_options] with testpaths/asyncio_mode/pythonpath
  - tests/webhook/ package with conftest.py and 4 stub test files (35 collectable tests)
  - unsigned_client / client_no_auth / test_auth_token fixtures
affects: [39-02, 39-03, 39-04, 39-05, 39-06, 39-07, 40, 41]

# Tech tracking
tech-stack:
  added: [pytest>=8.0, pytest-asyncio>=0.23, httpx>=0.27]
  patterns:
    - "Nyquist Wave 0: stub test files exist on Day 0 so pytest collects downstream tests before their production code exists"
    - "Module-level pytestmark = pytest.mark.skipif(True, ...) gate — downstream plans flip the flag to False + fill in bodies"
    - "Graceful ImportError fallback in conftest.py fixtures via pytest.skip() — fixtures yield/return only when src.webhook.app is importable"

key-files:
  created:
    - livekit-agent/tests/__init__.py
    - livekit-agent/tests/webhook/__init__.py
    - livekit-agent/tests/webhook/conftest.py
    - livekit-agent/tests/webhook/test_schedule.py
    - livekit-agent/tests/webhook/test_caps.py
    - livekit-agent/tests/webhook/test_routes.py
    - livekit-agent/tests/webhook/test_security.py
  modified:
    - homeservice_agent/.planning/REQUIREMENTS.md
    - livekit-agent/pyproject.toml

key-decisions:
  - "Test organization lives under livekit-agent/tests/webhook/ (outside src/) with pythonpath=[\".\"] so pytest imports src.webhook.* cleanly"
  - "Stubs gated by module-level pytestmark = skipif(True, ...) — cheap single-line flip for downstream plans to unlock the bodies"
  - "Dev deps declared explicitly (pytest, pytest-asyncio, httpx) via [project.optional-dependencies] dev — reproducible pip install -e \".[dev]\" even though httpx is already a transitive dep"
  - "fastapi/uvicorn intentionally NOT added in this plan (belongs to Plan 39-05 Wave 2) so the dependency closure stays minimal until the FastAPI app code actually ships"

patterns-established:
  - "Nyquist Wave 0 stub-first test layout: every downstream Wave 1/2 test file exists Day-0 with deterministic test names matching RESEARCH §4 fixture table"
  - "Fixture ImportError guard: unsigned_client / client_no_auth try-import src.webhook.app and pytest.skip() if it doesn't exist yet — fixtures don't poison collection"
  - "Append-only REQUIREMENTS.md edits — new section inserted between existing sections, traceability rows appended after the last v3.0 row (DEMO-05)"

requirements-completed: [ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04, ROUTE-05, ROUTE-06]

# Metrics
duration: 6min
completed: 2026-04-09
---

# Phase 39 Plan 01: Wave 0 Test Infrastructure and Requirement IDs Summary

**Nyquist Wave 0 delivery: 6 ROUTE-XX requirement IDs in REQUIREMENTS.md, pytest/pytest-asyncio/httpx dev deps and [tool.pytest.ini_options] in livekit-agent/pyproject.toml, and a tests/webhook/ package with conftest.py + 4 stub test files that pytest collects (35 tests, all currently skipped) ready for downstream waves to fill in.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-09T15:42:39Z
- **Completed:** 2026-04-09T15:48:24Z
- **Tasks:** 3
- **Files modified:** 9 (2 edited + 7 created)

## Accomplishments

- **ROUTE-01..06 added to REQUIREMENTS.md** under a new `### Call Routing Webhook Foundation (Phase 39)` section with full one-line definitions, plus 6 matching traceability rows appended after the DEMO-05 row. No existing content touched.
- **pytest test infrastructure configured in livekit-agent/pyproject.toml** via `[project.optional-dependencies] dev` (pytest>=8.0, pytest-asyncio>=0.23, httpx>=0.27) and `[tool.pytest.ini_options]` (testpaths=["tests"], asyncio_mode="auto", pythonpath=["."]). The livekit-agents==1.5.1 pin and the google plugin git pin at commit 43d373444... are untouched.
- **tests/webhook/ package created** with 7 files: tests/__init__.py, tests/webhook/__init__.py, conftest.py (3 fixtures), test_schedule.py (17 stubs), test_caps.py (8 stubs), test_routes.py (6 stubs), test_security.py (4 stubs). `pytest tests/webhook/ --collect-only` reports exactly 35 tests collected. `pytest tests/webhook/ -q` reports all 35 skipped, 0 failures, 0 errors.
- **Dev deps installed successfully** via `pip install -e ".[dev]"` in the livekit-agent repo — pytest 9.0.3, pytest-asyncio 1.3.0, httpx already present.

## Task Commits

Each task was committed atomically across two repositories (homeservice_agent for REQUIREMENTS.md; livekit-agent for pyproject.toml + tests/):

1. **Task 1: Add ROUTE-01..06 to REQUIREMENTS.md** — `6fcc5ef` in homeservice_agent (docs)
2. **Task 2: Configure pytest in pyproject.toml** — `08b3c26` in livekit-agent (chore)
3. **Task 3: Create tests/webhook/ package with conftest.py and 4 stub files** — `71571ee` in livekit-agent (test)

## Files Created/Modified

### Created (livekit-agent)
- `tests/__init__.py` — empty package marker
- `tests/webhook/__init__.py` — empty package marker
- `tests/webhook/conftest.py` — shared fixtures: `unsigned_client` (sets ALLOW_UNSIGNED_WEBHOOKS=true via monkeypatch), `client_no_auth` (dependency_overrides the signature verifier), `test_auth_token` (fixed token for signature-computation tests). All three fixtures try-import `src.webhook.app` and `pytest.skip()` gracefully when Plan 39-05 hasn't landed yet.
- `tests/webhook/test_schedule.py` — 17 stubs, one per RESEARCH §4 Unit Test Fixture Table row (schedule_disabled, empty_schedule_dict, enabled_but_days_empty, inside_window, outside_window, day_with_no_ranges, exact_start_boundary_inclusive, exact_end_boundary_exclusive, all_day_range, overnight_range_inside_evening, overnight_range_inside_morning, overnight_range_outside, dst_spring_forward_new_york, dst_fall_back_new_york, singapore_no_dst, multi_range_day_outside, multi_range_day_second_range). Gated by `pytestmark = pytest.mark.skipif(True, reason="evaluate_schedule not yet implemented (Plan 39-03)")`.
- `tests/webhook/test_caps.py` — 8 async stubs (under_cap_us, at_cap_us, at_cap_ca, over_cap_us, under_cap_sg, at_cap_sg, unknown_country_falls_back_to_us_limit, zero_seconds_used). Gated by `skipif(True, ...)` referencing Plan 39-04.
- `tests/webhook/test_routes.py` — 6 stubs, one per Twilio endpoint plus /health and /health/db (incoming_call_returns_ai_twiml, dial_status_returns_empty_twiml, dial_fallback_returns_empty_twiml, incoming_sms_returns_empty_twiml, health_returns_ok, health_db_returns_ok_or_503). Gated by `skipif(True, ...)` referencing Plan 39-06.
- `tests/webhook/test_security.py` — 4 stubs (valid_signature_returns_200, invalid_signature_returns_403, missing_signature_header_returns_403, allow_unsigned_env_var_bypasses_verification). Gated by `skipif(True, ...)` referencing Plan 39-06.

### Modified
- `homeservice_agent/.planning/REQUIREMENTS.md` — New `### Call Routing Webhook Foundation (Phase 39)` section inserted between `### Future Requirements (Deferred)` and `## v2.0 Requirements`. 6 ROUTE-XX bullets added. 6 traceability rows appended after `| DEMO-05 | Phase 29 | Complete |`. No existing content removed.
- `livekit-agent/pyproject.toml` — Appended `[project.optional-dependencies]` with `dev = ["pytest>=8.0","pytest-asyncio>=0.23","httpx>=0.27"]` after the `dependencies = [...]` closing bracket; appended `[tool.pytest.ini_options]` with `testpaths=["tests"]`, `asyncio_mode="auto"`, `pythonpath=["."]` at the end of the file. Existing dependencies block (including all livekit-* 1.5.1 pins and the google plugin git pin at commit 43d373444...) untouched.

### Exact text inserted into REQUIREMENTS.md
```markdown
### Call Routing Webhook Foundation (Phase 39)

- [ ] **ROUTE-01**: Migration `042_call_routing_schema.sql` adds `call_forwarding_schedule JSONB NOT NULL DEFAULT '{"enabled":false,"days":{}}'::jsonb`, `pickup_numbers JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_array_length(pickup_numbers) <= 5)`, and `dial_timeout_seconds INTEGER NOT NULL DEFAULT 15` on `tenants`; `routing_mode TEXT CHECK (routing_mode IN ('ai','owner_pickup','fallback_to_ai'))` nullable and `outbound_dial_duration_sec INTEGER` nullable on `calls`; creates `idx_calls_tenant_month ON calls (tenant_id, created_at)`
- [ ] **ROUTE-02**: FastAPI webhook service runs in the livekit-agent Railway process on port 8080, exposing `POST /twilio/incoming-call`, `POST /twilio/dial-status`, `POST /twilio/dial-fallback`, `POST /twilio/incoming-sms`, plus `GET /health` and `GET /health/db` ports of the deleted `src/health.py` routes; booted via `start_webhook_server()` daemon thread from `src/agent.py` before `cli.run_app(...)`
- [ ] **ROUTE-03**: All `/twilio/*` endpoints verify `X-Twilio-Signature` via a router-level FastAPI dependency that reconstructs the URL using `x-forwarded-proto` + `host` headers; invalid/missing signature → HTTP 403; `ALLOW_UNSIGNED_WEBHOOKS=true` env var bypasses verification with a warning log (dev only; fail-closed default)
- [ ] **ROUTE-04**: Pure function `evaluate_schedule(schedule: dict, tenant_timezone: str, now_utc: datetime) -> ScheduleDecision` in `src/webhook/schedule.py` correctly handles empty/missing schedule, `enabled:false`, per-day ranges in tenant timezone, overnight ranges encoded as `end < start`, DST spring-forward gaps, DST fall-back folds, and exact start/end boundary moments (start inclusive, end exclusive) — verified by unit tests in `tests/webhook/test_schedule.py`
- [ ] **ROUTE-05**: Function `check_outbound_cap(tenant_id: str, country: str) -> bool` in `src/webhook/caps.py` enforces US/CA 5000-minute and SG 2500-minute monthly caps by summing `outbound_dial_duration_sec` from `calls` where `created_at >= date_trunc('month', now())` for the given tenant; returns True if under cap, False if at/over; unknown country falls back to US limit
- [ ] **ROUTE-06**: Zero production Twilio numbers are reconfigured — `/twilio/incoming-call` performs a tenant lookup via `_normalize_phone(To)` but always returns a hardcoded "always-AI" `<Response><Dial><Sip>{LIVEKIT_SIP_URI}</Sip></Dial></Response>` TwiML regardless of result, exercising the full wiring path (signature → URL reconstruction → form parse → tenant lookup → TwiML render) so that Phase 40's diff is a one-line replacement of the hardcoded branch with `evaluate_schedule` + `check_outbound_cap` composition
```

### Exact lines added to pyproject.toml
```toml
[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "httpx>=0.27",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
pythonpath = ["."]
```

### Test file counts (verified via `grep -c "^def test_\|^async def test_"`)
- `test_schedule.py`: 17 definitions (matches plan acceptance criterion exactly)
- `test_caps.py`: 8 definitions (matches plan acceptance criterion exactly)
- `test_routes.py`: 6 definitions (≥ 6 plan threshold)
- `test_security.py`: 4 definitions (≥ 4 plan threshold)
- **Total: 35 tests** (matches plan's ≥ 35 target)

## Decisions Made

- **Chose single append-only edit for REQUIREMENTS.md** — insert the new `### Call Routing Webhook Foundation (Phase 39)` section between `### Future Requirements (Deferred)` and `## v2.0 Requirements` rather than at the end, keeping Phase 39 requirements grouped next to the other v3.0/recent additions. Traceability rows appended after DEMO-05 to preserve chronological order.
- **Declared httpx explicitly in dev deps** — already a transitive dependency via livekit-api, but explicit declaration makes `pip install -e ".[dev]"` reproducible regardless of future transitive changes. Matches the plan's specification.
- **Chose `pytestmark = pytest.mark.skipif(True, ...)` over `@pytest.mark.skip`** — module-level gate means downstream plans flip one line (True → False) to unlock all tests in the file. Cheaper than per-test decorators.
- **Committed to two separate repos atomically** — homeservice_agent commit for REQUIREMENTS.md (Task 1), and two livekit-agent commits for pyproject.toml (Task 2) and tests/ (Task 3). Used `git -C` directly because config.json's `sub_repos` array is empty, so gsd-tools `commit-to-subrepo` does not apply to this repo layout.

## Deviations from Plan

None — plan executed exactly as written.

The plan was detailed enough that all three tasks landed with zero auto-fixes, zero Rule 4 decisions, and zero auth gates. File contents for conftest.py and the 4 stub test files were copied verbatim from the plan's `<action>` blocks.

## Issues Encountered

- **Minor:** `gsd-tools.cjs` path in the execute-plan workflow template references `C:/Users/Leroy/Desktop/Voco/homeservice_agent/...` which does not exist on this machine. Correct path is `C:/Users/leheh/.Projects/homeservice_agent/...`. Worked around by calling the correct path directly. No code change needed — the template paths are machine-dependent headers. Noting here for awareness.
- **CRLF warnings** on `git commit` of pyproject.toml and the test files (expected on Windows — git auto-converts LF → CRLF on checkout). No action required; .gitattributes can normalize if desired later.

## Known Stubs

All 35 tests in `tests/webhook/` are intentionally stubbed (`pass` bodies) and gated by module-level `pytestmark = pytest.mark.skipif(True, ...)`. This is the explicit Wave 0 Nyquist pattern — downstream plans flip the `True` to `False` and fill in the bodies:

- **test_schedule.py (17 stubs)** — Plan 39-03 will flip the skipif and implement evaluate_schedule + these tests
- **test_caps.py (8 stubs)** — Plan 39-04 will flip the skipif and implement check_outbound_cap + these tests
- **test_routes.py (6 stubs)** — Plan 39-05 creates the FastAPI app, Plan 39-06 flips the skipif and fills in route integration tests
- **test_security.py (4 stubs)** — Plan 39-05 creates the security dependency, Plan 39-06 flips the skipif and fills in signature validation tests

**These stubs are NOT accidental placeholder bugs** — they are the deliverable. Plan 39-01's entire purpose is to create the stub layout so downstream waves fill them in without inventing test file names or fixture structure. Plan 39-01 PLAN.md explicitly documents this pattern in its `<objective>` and acceptance criteria.

## User Setup Required

None — no external service configuration required for Wave 0.

## Next Phase Readiness

- **Plan 39-02 (Wave 1)** can now reference `requirements: [ROUTE-01]` in its frontmatter to lock ownership of the migration file.
- **Plan 39-03 (Wave 1)** can now use `cd livekit-agent && pytest tests/webhook/test_schedule.py` as its inner feedback loop, flip `skipif(True)` to `skipif(False)` in that file, and fill in the 17 test bodies. The fixture names and test names are locked so 39-03 cannot drift from the RESEARCH §4 fixture table.
- **Plan 39-04 (Wave 1)** can now use `cd livekit-agent && pytest tests/webhook/test_caps.py` similarly. 8 async test stubs already exist.
- **Plan 39-05 (Wave 2)** will add fastapi + uvicorn to the already-configured `[project]` dependencies, create `src/webhook/app.py` + `security.py` + `twilio_routes.py`, and at that point the `unsigned_client` / `client_no_auth` fixtures stop skipping and become functional.
- **Plan 39-06 (Wave 2)** will flip the skipif flags in test_routes.py and test_security.py and fill in the route + security integration tests.
- **Plan 39-07 (Wave 3)** will update the voice-call-architecture SKILL.md and run the final verification sweep.

No blockers. All Wave 0 acceptance criteria verified.

## Self-Check: PASSED

Artifacts verified on disk:
- **FOUND:** `C:/Users/leheh/.Projects/homeservice_agent/.planning/REQUIREMENTS.md` contains `### Call Routing Webhook Foundation (Phase 39)` at line 72 and 12 ROUTE-0 matches (6 bullets + 6 traceability rows)
- **FOUND:** `C:/Users/leheh/.Projects/livekit-agent/pyproject.toml` contains `[project.optional-dependencies]`, `pytest>=8.0`, and `[tool.pytest.ini_options]` with `testpaths = ["tests"]` and `asyncio_mode = "auto"`
- **FOUND:** `C:/Users/leheh/.Projects/livekit-agent/tests/__init__.py`
- **FOUND:** `C:/Users/leheh/.Projects/livekit-agent/tests/webhook/__init__.py`
- **FOUND:** `C:/Users/leheh/.Projects/livekit-agent/tests/webhook/conftest.py` with `unsigned_client`, `client_no_auth`, `test_auth_token`
- **FOUND:** `C:/Users/leheh/.Projects/livekit-agent/tests/webhook/test_schedule.py` (17 test defs)
- **FOUND:** `C:/Users/leheh/.Projects/livekit-agent/tests/webhook/test_caps.py` (8 test defs)
- **FOUND:** `C:/Users/leheh/.Projects/livekit-agent/tests/webhook/test_routes.py` (6 test defs)
- **FOUND:** `C:/Users/leheh/.Projects/livekit-agent/tests/webhook/test_security.py` (4 test defs)

Commits verified:
- **FOUND:** `6fcc5ef` in homeservice_agent — `docs(39-01): add ROUTE-01..06 requirements for call routing webhook foundation`
- **FOUND:** `08b3c26` in livekit-agent — `chore(39-01): add pytest dev deps and ini_options config`
- **FOUND:** `71571ee` in livekit-agent — `test(39-01): add tests/webhook/ package with stub test files`

Test suite verified:
- **PASS:** `pytest tests/webhook/ --collect-only -q` reports 35 tests collected
- **PASS:** `pytest tests/webhook/ -q` reports 35 skipped, 0 failures, 0 errors

---
*Phase: 39-call-routing-webhook-foundation*
*Completed: 2026-04-09*

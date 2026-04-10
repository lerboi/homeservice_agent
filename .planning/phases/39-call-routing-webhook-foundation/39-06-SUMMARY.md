---
phase: 39-call-routing-webhook-foundation
plan: 06
subsystem: testing
tags: [pytest, fastapi, testclient, twilio, request-validator, signature-verification, integration-tests]

# Dependency graph
requires:
  - phase: 39-01
    provides: tests/webhook/conftest.py fixtures (client_no_auth, unsigned_client, test_auth_token) + Wave 0 stub test files with module-level skipif(True)
  - phase: 39-05
    provides: src/webhook/app.py FastAPI instance + src/webhook/security.py verify_twilio_signature + src/webhook/twilio_routes.py with /twilio/* router (target of TestClient calls)
provides:
  - tests/webhook/test_routes.py fully implemented (6 integration tests: 4 Twilio routes + /health + /health/db)
  - tests/webhook/test_security.py fully implemented (4 signature verification tests covering valid, invalid, missing, ALLOW_UNSIGNED bypass)
  - tests/webhook/conftest.py client_no_auth fixture upgraded to populate request.state.form_data so the override mirrors the real verify_twilio_signature contract
  - python-multipart>=0.0.9 added to pyproject.toml dependencies — required by FastAPI to parse Twilio's application/x-www-form-urlencoded webhook bodies in production
  - .gitignore Python artifact entries (__pycache__/, *.pyc, *.egg-info/, .pytest_cache/)
affects: [39-07 skill update + final phase verification, Phase 40 call routing cutover (signed signature pattern reused for production webhook test suite), Phase 41 dashboard UI test scaffolding]

# Tech tracking
tech-stack:
  added: [python-multipart>=0.0.9 (transitive FastAPI form-parser, was missing from 39-05 deps)]
  patterns:
    - "FastAPI dependency_overrides pattern that still satisfies the dependency's contract: the override is an async function that mirrors the real dependency's side effects (request.state.form_data) rather than a no-op lambda — this is the correct way to swap out a dependency that produces state for downstream handlers"
    - "Twilio signature computation in tests via twilio.request_validator.RequestValidator.compute_signature(url, params) — the public method available in twilio>=9.0, no manual HMAC reimplementation needed"
    - "URL reconstruction symmetry: tests build the URL the exact same way the server reconstructs it (proto + host + path) so signed requests validate against TestClient's testserver host"
    - "monkeypatch.delenv(..., raising=False) for defensive env hygiene at fixture entry to neutralize ALLOW_UNSIGNED bleed-through from prior tests"
    - "app.dependency_overrides.clear() at the start AND end of each fixture so test order independence is preserved across files (test_routes.py and test_security.py can run in any order)"

key-files:
  created: []
  modified:
    - livekit-agent/tests/webhook/test_routes.py
    - livekit-agent/tests/webhook/test_security.py
    - livekit-agent/tests/webhook/conftest.py
    - livekit-agent/pyproject.toml
    - livekit-agent/.gitignore

key-decisions:
  - "[Phase 39-06]: client_no_auth fixture override is an async function that calls await request.form() and stashes form data on request.state.form_data, instead of a plain `lambda: None`, to honor the contract that 39-05's incoming-call handler depends on (set by verify_twilio_signature)"
  - "[Phase 39-06]: Tests use twilio-python's RequestValidator.compute_signature(url, params) directly — confirmed available in installed twilio version 9.x — no fallback to manual HMAC-SHA1 reimplementation was needed"
  - "[Phase 39-06]: signed_client fixture imports src.webhook.app *after* monkeypatch sets TWILIO_AUTH_TOKEN so any module-level token capture would see the correct value (defensive — the dependency reads os.environ at request time, but ordering is preserved for safety)"
  - "[Phase 39-06]: ALLOW_UNSIGNED bypass test runs in its own monkeypatch scope (not via signed_client) so the env var is restored before any subsequent test reverts to signature-required mode"
  - "[Phase 39-06]: /health/db test tolerates both 200 and 503 — the test environment has no Supabase reachability guarantee, and the route is fail-soft by design (returns 503 with structured JSON on connection error)"

patterns-established:
  - "Form-stashing dependency overrides: when you override a FastAPI dependency that mutates request.state, the override must replicate that mutation, not just return None. Plain `lambda: None` overrides are only safe when the dependency returns a value the handler doesn't read"
  - "Signed request fixture pattern: clear ALLOW_UNSIGNED env, set TWILIO_AUTH_TOKEN, clear leftover dependency_overrides, yield TestClient, clear overrides on teardown — full setup/teardown isolation"
  - "Test URL reconstruction matches server URL reconstruction: tests pass x-forwarded-proto and host headers explicitly so the signature URL the test computes equals the URL the dependency reconstructs server-side"

requirements-completed: [ROUTE-02, ROUTE-03]

# Metrics
duration: 18m
completed: 2026-04-10
---

# Phase 39 Plan 06: Webhook Integration Tests Summary

**Webhook surface fully test-locked: 6 route integration tests + 4 signature verification tests, all green in 1.31s; uncovered two real production bugs in 39-05's deliverables (form-stash AttributeError on dep override, missing python-multipart dep) and fixed both inline.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-10T00:08:00Z (approximate — wall clock from initial Read calls)
- **Completed:** 2026-04-10T00:26:29Z
- **Tasks:** 2
- **Files modified:** 5 (test_routes.py, test_security.py, conftest.py, pyproject.toml, .gitignore)
- **Test results:** 35 passed, 0 failed, 0 skipped, 1.31s wall (well under the 10s plan target)

## Accomplishments

- **test_routes.py** filled in with 6 integration tests covering all four `/twilio/*` POST routes (`/incoming-call`, `/dial-status`, `/dial-fallback`, `/incoming-sms`) and both health endpoints (`/health`, `/health/db`). Module-level `pytestmark = pytest.mark.skipif(True, ...)` removed entirely. Each test asserts content-type, status, and body substrings against the real FastAPI app via `TestClient`.
- **test_security.py** filled in with 4 signature verification tests:
  - Valid signature (computed via `RequestValidator.compute_signature`) → 200
  - Invalid signature → 403
  - Missing X-Twilio-Signature header → 403
  - `ALLOW_UNSIGNED_WEBHOOKS=true` env var → 200 with no signature at all
- **conftest.py `client_no_auth` fixture upgraded** — the original `lambda: None` override caused the `/incoming-call` handler to crash with `AttributeError: 'State' object has no attribute 'form_data'` because 39-05's handler relies on `request.state.form_data` being populated by `verify_twilio_signature`. The new override is an async function that calls `await request.form()` and stashes the data on `request.state.form_data`, mirroring the real dependency's side effect without enforcing signatures.
- **`python-multipart>=0.0.9,<1` added to pyproject.toml dependencies** — discovered missing when FastAPI raised `AssertionError: The python-multipart library must be installed to use form parsing` on the first incoming-call test. This dependency is required by FastAPI to parse Twilio's `application/x-www-form-urlencoded` webhook bodies in production, not just in tests. Without it, every Twilio webhook in production would 500 the moment it received a real request. Installed locally and committed the manifest update so Railway picks it up on next deploy.
- **`.gitignore` updated** to exclude Python build/test artifacts (`__pycache__/`, `*.pyc`, `*.pyo`, `*.egg-info/`, `.pytest_cache/`) so test runs from this and future phases don't leave untracked generated files in `git status`.
- **Full webhook test suite is 35 passed, 0 failed, 0 skipped in 1.31s** — comfortably under the 10s RESEARCH.md §6 target. Breakdown: 8 caps + 6 routes + 17 schedule + 4 security = 35.

## Task Commits

Each task was committed atomically in `livekit-agent/` (separate repo from `homeservice_agent/`):

1. **Task 1: Fill in tests/webhook/test_routes.py + unblock form parsing** — `1254e7b` (test)
2. **Task 2: Fill in tests/webhook/test_security.py** — `3f130b4` (test)
3. **Followup: gitignore Python build/test artifacts** — `57a98eb` (chore)

**Plan metadata commit:** (created in homeservice_agent repo for the SUMMARY.md + STATE.md + ROADMAP.md update)

## Files Created/Modified

**Modified (livekit-agent/):**

- `tests/webhook/test_routes.py` — Replaced 7-line stub with 100-line full implementation. 6 test functions, each driving the real FastAPI app via the `client_no_auth` fixture from conftest.py. No mocks of FastAPI internals. The `/health/db` test tolerates both 200 and 503 so it works in environments without a reachable Supabase instance.
- `tests/webhook/test_security.py` — Replaced 28-line stub with 116-line full implementation. New `signed_client` fixture sets TWILIO_AUTH_TOKEN, clears ALLOW_UNSIGNED, clears leftover dependency_overrides, yields TestClient, and tears down on exit. New `_sign(auth_token, url, params)` helper wraps `RequestValidator.compute_signature`. The bypass test runs in its own monkeypatch scope so env var leakage to subsequent tests is impossible.
- `tests/webhook/conftest.py` — Upgraded `client_no_auth` fixture to use a form-stashing async override (`async def _override(request): request.state.form_data = dict(await request.form())`) instead of `lambda: None`. Comment block explains why: 39-05's handler reads `request.state.form_data` and the override must satisfy that contract. The `unsigned_client` and `test_auth_token` fixtures are untouched.
- `pyproject.toml` — Added `python-multipart>=0.0.9,<1` to the `dependencies` list immediately after `uvicorn[standard]>=0.30,<1`. The `livekit-agents==1.5.1` pin and the `livekit-plugins-google` git pin at commit `43d3734...` are untouched (DO NOT bump comment block respected).
- `.gitignore` — Added a "Python build/test artifacts" section with `__pycache__/`, `*.pyc`, `*.pyo`, `*.egg-info/`, and `.pytest_cache/`.

**No files created.** This plan is test-only — no new source files, no new modules, no new helpers.

## Decisions Made

- **Async form-stashing override over plain `lambda: None`** — The override is `async def _override(request: Request) -> None: form_data = await request.form(); request.state.form_data = dict(form_data)`. This is the correct pattern for overriding any FastAPI dependency that produces request-scoped state for downstream handlers. Plain `lambda: None` only works when the dependency's return value is consumed via `Depends(...) -> X` and never via `request.state.X`. 39-05's handler reads `request.state.form_data`, so the override must populate it.
- **`RequestValidator.compute_signature(url, params)` over manual HMAC-SHA1** — Verified at the start of the plan that the installed twilio package (9.x per pyproject.toml) exposes `compute_signature` as a public method. No fallback to the manual HMAC-SHA1 / base64 implementation in RESEARCH.md §6 was needed. If a future twilio downgrade removes this method, the test will fail loudly with `AttributeError` and the fallback can be applied surgically in `_sign`.
- **Bypass test isolated from `signed_client` fixture** — The ALLOW_UNSIGNED test uses its own `monkeypatch` scope (passed directly into the test function) instead of going through `signed_client` because it needs to set the bypass env var, and `signed_client` defensively clears it. Cleaner separation of concerns and zero risk of fixture-order interaction.
- **`/health/db` test accepts 200 OR 503** — Test environments may not have a reachable Supabase instance. The route is intentionally fail-soft (returns 503 with structured JSON `{"status":"error","message":...}` on connection failure), and the test only verifies the route is mounted, the JSON shape is correct, and the status code is one of the two valid values. Strict 200-only would couple the test suite to live Supabase availability.
- **Tests assert XML body via substring matching, not XML parsing** — `<Response>`, `<Dial>`, `<Sip>`, `<Response/>` are all asserted via `in resp.text`. RESEARCH.md §6 explicitly recommends substring assertions over XML parsing for speed and simplicity at Phase 39 scope. Phase 40 may move to structural XML assertions if the TwiML grows real complexity.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `client_no_auth` override broke `/incoming-call` handler with AttributeError**

- **Found during:** Task 1 (running `pytest tests/webhook/test_routes.py -x`)
- **Issue:** The Wave 0 conftest.py fixture from Plan 39-01 used `app.dependency_overrides[verify_twilio_signature] = lambda: None` to bypass signature verification. But Plan 39-05 wrote `incoming_call()` to read `request.state.form_data` (set by `verify_twilio_signature` in its real form-stashing path). The `lambda: None` override skipped that side effect, so the handler crashed with `AttributeError: 'State' object has no attribute 'form_data'`. Test `test_incoming_call_returns_ai_twiml` failed.
- **Fix:** Replaced the override in `tests/webhook/conftest.py` with an async function that mirrors the real dependency's form-stashing behavior — calls `await request.form()` and writes the result to `request.state.form_data` — but skips the signature check. This is the correct pattern when overriding a FastAPI dependency that produces request-scoped state.
- **Files modified:** `livekit-agent/tests/webhook/conftest.py`
- **Verification:** `test_incoming_call_returns_ai_twiml` passes after the override fix; the fix is also forward-compatible because Phase 40 will add more state-producing logic to the same dependency, and the override pattern will continue to work as long as the test fixture mirrors the dependency's invariants.
- **Committed in:** `1254e7b` (Task 1 commit, bundled with the test_routes.py implementation)

**2. [Rule 2 - Missing Critical] `python-multipart` dependency missing from 39-05's pyproject.toml**

- **Found during:** Task 1 (running `pytest tests/webhook/test_routes.py -x` after fix #1)
- **Issue:** FastAPI raised `AssertionError: The python-multipart library must be installed to use form parsing` on the first call to `await request.form()`. `python-multipart` is a transitive dependency of FastAPI for parsing `application/x-www-form-urlencoded` and `multipart/form-data` bodies. It is NOT an automatic install with `pip install fastapi` — you must declare it explicitly. Plan 39-05 added `fastapi>=0.115,<1` and `uvicorn[standard]>=0.30,<1` but never added `python-multipart`. Twilio webhooks send `application/x-www-form-urlencoded`, so without this dep every production webhook hit would crash with a 500 error inside `verify_twilio_signature.await request.form()`.
- **Fix:** Added `python-multipart>=0.0.9,<1` to `pyproject.toml` dependencies immediately after `uvicorn[standard]>=0.30,<1`. Installed locally with `pip install "python-multipart>=0.0.9,<1"` to unblock the test run. Committed the pyproject.toml update so Railway picks it up automatically on next deploy via the existing `pip install --no-cache-dir .` line in the Dockerfile (no Dockerfile changes required).
- **Files modified:** `livekit-agent/pyproject.toml`
- **Verification:** `pip install python-multipart` succeeded (version 0.0.24 installed). After install, all 6 route tests pass. Form parsing works in both the real `verify_twilio_signature` dependency (test_security.py path) and the test override (test_routes.py path).
- **Committed in:** `1254e7b` (Task 1 commit, bundled with the test_routes.py implementation and the conftest.py fix above)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 2 missing critical dependency)
**Impact on plan:** Both fixes were necessary for correctness — the Rule 1 fix was strictly required to make the test suite pass, and the Rule 2 fix was strictly required for production webhook functionality (would have manifested as a 500 on the first real Twilio request). Neither was scope creep; both fall squarely under the deviation rules' "directly caused by current task" boundary because the test code is the first consumer that exercises the form-parsing path end-to-end. Plan 39-05's verification was apparently limited to import-time checks and did not actually issue a request through the form-parsing pipeline, which is why these slipped past 39-05's self-check.

## Issues Encountered

None beyond the two deviations above. Once the conftest fix and the python-multipart install were in place, all 10 new tests passed on the first attempt and full suite went from 25 collected/skipped to 35 passed.

## Verification Output

**1. Full webhook suite green:**
```
$ python -m pytest tests/webhook/ -v
...
tests/webhook/test_caps.py ........                                      [  8 PASSED]
tests/webhook/test_routes.py ......                                      [  6 PASSED]
tests/webhook/test_schedule.py .................                         [ 17 PASSED]
tests/webhook/test_security.py ....                                      [  4 PASSED]
======================= 35 passed, 2 warnings in 1.31s =======================
```

**2. Slowest 5 tests (well under 10s plan budget):**
```
$ python -m pytest tests/webhook/ --durations=5
============================= slowest 5 durations =============================
0.66s call     tests/webhook/test_caps.py::test_under_cap_us_returns_true
0.01s call     tests/webhook/test_routes.py::test_incoming_call_returns_ai_twiml
0.01s call     tests/webhook/test_security.py::test_allow_unsigned_env_var_bypasses_verification
(2 durations < 0.005s hidden.  Use -vv to show these durations.)
======================= 35 passed, 2 warnings in 1.34s =======================
```

**3. Acceptance criteria spot-checks (Task 1):**
- `grep "pytestmark = pytest.mark.skipif(True" test_routes.py` → 0 matches (skipif removed)
- `pytest test_routes.py --collect-only -q` → 6 tests collected
- `pytest test_routes.py -v | grep -c PASSED` → 6

**4. Acceptance criteria spot-checks (Task 2):**
- `grep "pytestmark = pytest.mark.skipif(True" test_security.py` → 0 matches
- `grep "from twilio.request_validator import RequestValidator" test_security.py` → 1 match
- `grep "compute_signature" test_security.py` → 2 matches (definition + call)
- `grep "assert resp.status_code == 403" test_security.py` → 2 matches (invalid + missing)
- `grep "ALLOW_UNSIGNED_WEBHOOKS" test_security.py` → 4 matches
- `grep -c "def test_" test_security.py` → 4

**5. twilio-python compute_signature availability check (no fallback needed):**
```
$ python -c "from twilio.request_validator import RequestValidator; v = RequestValidator('abc'); sig = v.compute_signature('http://testserver/twilio/incoming-call', {'To':'+15551234567'}); print('compute_signature works:', sig)"
compute_signature works: a2AZyHsQU7tlUdxQeaBzqM6wNhw=
```

The 2 warnings in pytest output are the expected `@app.on_event` deprecation notices from Plan 39-05's app.py, documented as acceptable in 39-05's plan and summary. No new warnings were introduced by Plan 39-06.

## User Setup Required

None. Test-only plan with no production-facing changes other than the `python-multipart` dependency declaration, which Railway will pick up automatically on the next build.

Phase 40 will still require setting `LIVEKIT_SIP_URI` and `TWILIO_AUTH_TOKEN` env vars on Railway before any production Twilio number is reconfigured to call the webhook (carried over from Plan 39-05 — unchanged).

## Next Phase Readiness

**Ready for Plan 39-07 (Wave 3 — SKILL.md update + final phase verification):** All four planned test files for Phase 39 are now green:
- `tests/webhook/test_schedule.py` (17 tests, Plan 39-03)
- `tests/webhook/test_caps.py` (8 tests, Plan 39-04)
- `tests/webhook/test_routes.py` (6 tests, Plan 39-06 — this plan)
- `tests/webhook/test_security.py` (4 tests, Plan 39-06 — this plan)

Plan 39-07 should:
1. Update `.claude/skills/voice-call-architecture/SKILL.md` with the new FastAPI co-process model, the `src/webhook/*` subpackage, the router-level signature dep pattern, and the new `python-multipart` dependency in the deps list (catch the 39-05 documentation gap)
2. Run the full Phase 39 verification block (`pytest tests/webhook/`, container build smoke test if applicable)
3. Sign off ROUTE-01..ROUTE-06 in REQUIREMENTS.md if any are still pending (this plan completes ROUTE-02 and ROUTE-03)

**Ready for Phase 40 (Call Routing Provisioning Cutover):** The test infrastructure is now a known-good baseline. Phase 40's TwiML routing changes can extend `tests/webhook/test_routes.py` with new assertions (e.g., verify the `<Number>` branch instead of `<Sip>` for owner_pickup mode) using the same `client_no_auth` fixture pattern. The signed_client fixture in test_security.py is also reusable for any new signature-gated routes Phase 40 adds.

**Ready for Phase 41 (Dashboard UI):** The test scaffolding established here (FastAPI TestClient + dependency_overrides + form-stashing override) is reusable for any future webhook test work, including the dashboard's `/api/call-routing` Next.js routes (which won't use TestClient but follow the same fixture-isolation principles).

**Blockers/Concerns:** None. The two production bugs caught by this plan are now fixed; both would have caused the webhook to crash on the first real Twilio request. The webhook surface is now genuinely production-ready (modulo the Phase 40 routing logic that replaces the hardcoded AI branch).

## Self-Check: PASSED

Verified all claimed files and commits exist:

- `livekit-agent/tests/webhook/test_routes.py` — FOUND (modified, 100 lines, no skipif)
- `livekit-agent/tests/webhook/test_security.py` — FOUND (modified, 116 lines, no skipif)
- `livekit-agent/tests/webhook/conftest.py` — FOUND (modified, form-stashing override)
- `livekit-agent/pyproject.toml` — FOUND (python-multipart added)
- `livekit-agent/.gitignore` — FOUND (Python artifacts ignored)
- Commit `1254e7b` — FOUND in livekit-agent git log (Task 1)
- Commit `3f130b4` — FOUND in livekit-agent git log (Task 2)
- Commit `57a98eb` — FOUND in livekit-agent git log (gitignore chore)
- 35 webhook tests passing in 1.31s — VERIFIED

---
*Phase: 39-call-routing-webhook-foundation*
*Completed: 2026-04-10*

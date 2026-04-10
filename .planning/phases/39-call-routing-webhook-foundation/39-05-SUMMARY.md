---
phase: 39-call-routing-webhook-foundation
plan: 05
subsystem: infra
tags: [fastapi, uvicorn, twilio, webhook, railway, asgi, daemon-thread]

# Dependency graph
requires:
  - phase: 39-01
    provides: pytest config + webhook/__init__.py + tests/webhook stubs
  - phase: 39-03
    provides: src/webhook/schedule.py pure function + ScheduleDecision contract
  - phase: 39-04
    provides: src/lib/phone._normalize_phone extraction + src/webhook/caps.py
provides:
  - FastAPI webhook service on port 8080 (replaces stdlib src/health.py)
  - src/webhook/security.py verify_twilio_signature FastAPI dependency
  - src/webhook/app.py FastAPI app with /health, /health/db, twilio_router mount
  - src/webhook/twilio_routes.py APIRouter with 4 signature-gated POST endpoints
  - src/webhook/__init__.py start_webhook_server() daemon-thread helper
  - src/agent.py boot sequence now calls start_webhook_server() before cli.run_app()
affects: [39-06 webhook integration tests, 39-07 skill update, Phase 40 call routing cutover, Phase 41 dashboard UI]

# Tech tracking
tech-stack:
  added: [fastapi>=0.115,<1, uvicorn[standard]>=0.30,<1]
  patterns:
    - "FastAPI daemon-thread boot alongside LiveKit cli.run_app (mirrors Plan 39-01 health.py pattern)"
    - "Router-level Depends(verify_twilio_signature) — zero per-route boilerplate for signature gating"
    - "URL reconstruction via x-forwarded-proto + host headers for Railway edge proxy (D-15)"
    - "request.state.form_data stashed by the security dependency so handlers never re-parse"
    - "Lazy import uvicorn inside start_webhook_server so pytest can import app without booting the server"
    - "Lazy import get_supabase_admin inside /health/db and /incoming-call so the app imports cleanly without Supabase env vars"
    - "asyncio.to_thread wrapping sync supabase-py calls in async FastAPI handlers"

key-files:
  created:
    - livekit-agent/src/webhook/security.py
    - livekit-agent/src/webhook/app.py
    - livekit-agent/src/webhook/twilio_routes.py
  modified:
    - livekit-agent/pyproject.toml
    - livekit-agent/src/webhook/__init__.py
    - livekit-agent/src/agent.py
  deleted:
    - livekit-agent/src/health.py

key-decisions:
  - "[Phase 39-05]: FastAPI app.include_router pattern with router-level Depends mounts all /twilio/* endpoints behind a single signature dependency — no per-route @Depends decoration"
  - "[Phase 39-05]: @app.on_event('startup') retained over lifespan context manager — adds trivial lifecycle logging without the complexity cost; deprecation warning is acceptable (Phase 40 can migrate)"
  - "[Phase 39-05]: Lazy uvicorn import inside start_webhook_server lets pytest import the app module without spawning the server (test collection stays fast)"
  - "[Phase 39-05]: Lazy Supabase import inside /health/db and /incoming-call handlers lets src.webhook.app import cleanly in environments without Supabase env vars (test collection on bare CI)"
  - "[Phase 39-05]: /twilio/incoming-call performs a dead-weight tenant lookup per D-13 — exercises the full wiring path so Phase 40's diff is a single branch replacement"
  - "[Phase 39-05]: LIVEKIT_SIP_URI env var defaults to 'sip:voco@sip.livekit.cloud' placeholder because no production Twilio number is reconfigured in Phase 39 (success criterion #6 is the scope anchor)"

patterns-established:
  - "FastAPI co-process model: uvicorn in daemon thread alongside LiveKit cli.run_app — one process, one Railway deployment, one public port 8080"
  - "Router-level signature verification: dependencies=[Depends(...)] on APIRouter replaces per-route decorator boilerplate for gated endpoint families"
  - "Form-data stashing via request.state: security dependency reads body once, handlers consume via request.state.form_data without re-parsing"
  - "TwiML helpers as pure functions (_ai_sip_twiml, _empty_twiml, _xml_response) — Phase 40 composes evaluate_schedule + check_outbound_cap around the same helpers"

requirements-completed: [ROUTE-02, ROUTE-03, ROUTE-06]

# Metrics
duration: 37m
completed: 2026-04-09
---

# Phase 39 Plan 05: FastAPI Webhook Service — Boot & Surface Freeze Summary

**FastAPI webhook service replaces stdlib health.py: port 8080 now serves /health, /health/db, and four signature-gated /twilio/* endpoints via a uvicorn daemon thread booted from src/agent.py before cli.run_app().**

## Performance

- **Duration:** 37 min
- **Started:** 2026-04-09T18:24:35Z
- **Completed:** 2026-04-09T19:01:31Z
- **Tasks:** 3
- **Files modified:** 6 (3 created, 2 edited, 1 edited, 1 deleted)

## Accomplishments

- Added `fastapi>=0.115,<1` and `uvicorn[standard]>=0.30,<1` to `dependencies` in pyproject.toml without touching the load-bearing `livekit-agents==1.5.1` pin or the google git pin at commit `43d373444...`
- Created `src/webhook/security.py` with the `verify_twilio_signature` FastAPI dependency — URL reconstruction via `x-forwarded-proto`/`host` headers for Railway's edge proxy, `X-Twilio-Signature` check via `twilio.request_validator.RequestValidator`, and `ALLOW_UNSIGNED_WEBHOOKS=true` bypass for dev/staging with warning log
- Created `src/webhook/app.py` with the FastAPI app instance, `/health` and `/health/db` routes ported verbatim from the deleted `src/health.py` (same response bodies, same status codes so Dockerfile HEALTHCHECK keeps working), and `app.include_router(twilio_router)` to mount the Twilio routes
- Created `src/webhook/twilio_routes.py` with an `APIRouter(prefix="/twilio", dependencies=[Depends(verify_twilio_signature)])` and four POST endpoints:
  - `/incoming-call` — performs a dead-weight tenant lookup via `_normalize_phone(To)` and returns hardcoded `<Response><Dial><Sip>{LIVEKIT_SIP_URI}</Sip></Dial></Response>` AI TwiML per D-13
  - `/dial-status`, `/dial-fallback`, `/incoming-sms` — each return `<Response/>` empty TwiML
- Updated `src/webhook/__init__.py` (previously a pure docstring-only marker from Plan 39-03) to export `app` and `start_webhook_server` — a daemon-thread helper that runs uvicorn with `proxy_headers=True, forwarded_allow_ips='*'` for Railway
- Edited `src/agent.py` to replace `from .health import start_health_server` with `from .webhook import start_webhook_server` and to replace the boot call inside the `__main__` block. All other agent.py logic preserved (BLOCKED_STATUSES at line 52, `_normalize_phone` import, entrypoint, cli.run_app)
- Deleted `src/health.py` — its routes now live in `src/webhook/app.py`. Dockerfile HEALTHCHECK line (`curl -f http://localhost:8080/health`) is unchanged and still valid because FastAPI serves the same `/health` path on the same port
- Confirmed Plan 39-03 (17 schedule tests) and Plan 39-04 (8 caps tests) still pass — 25 tests, 1.41 seconds, no regressions

## Task Commits

Each task was committed atomically in `livekit-agent/` (separate repo from `homeservice_agent/`):

1. **Task 1: Add FastAPI + uvicorn deps + create security.py and app.py** — `aeb0fee` (feat)
2. **Task 2: Create twilio_routes.py + wire start_webhook_server in __init__.py** — `3ec28b4` (feat)
3. **Task 3: Swap agent.py boot to start_webhook_server, delete src/health.py** — `72df45a` (refactor)

**Plan metadata commit:** (to be created in homeservice_agent repo for the SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md update)

## Files Created/Modified

**Created (livekit-agent/):**
- `src/webhook/security.py` — `verify_twilio_signature` FastAPI dependency; ALLOW_UNSIGNED_WEBHOOKS bypass; URL reconstruction via proxy headers; raises `HTTPException(403)` on invalid/missing signature; stashes form body on `request.state.form_data`
- `src/webhook/app.py` — FastAPI app instance (title "Voco Webhook"); `/health` liveness probe (returns `{"status":"ok","uptime":...,"version":"1.0.0"}`); `/health/db` DB probe (returns 200 or 503 with same shape as deleted health.py); `@app.on_event("startup")` log line; mounts `twilio_router`
- `src/webhook/twilio_routes.py` — `APIRouter(prefix="/twilio", dependencies=[Depends(verify_twilio_signature)])`; 4 POST endpoints; TwiML helper functions; Phase 39 hardcoded AI branch in `/incoming-call` with dead-weight tenant lookup per D-13

**Modified (livekit-agent/):**
- `pyproject.toml` — appended `fastapi>=0.115,<1` and `uvicorn[standard]>=0.30,<1` to the `dependencies` list; `livekit-agents==1.5.1` pin and google git pin untouched
- `src/webhook/__init__.py` — replaced single-docstring stub from Plan 39-03 with full package exports: `from .app import app` + `start_webhook_server()` daemon-thread helper with lazy uvicorn import
- `src/agent.py` — line 39 import swap (`from .health import start_health_server` → `from .webhook import start_webhook_server`); line 455 call swap (`start_health_server()` → `start_webhook_server()`); no other lines touched

**Deleted (livekit-agent/):**
- `src/health.py` — stdlib HTTPServer (`HealthHandler`, `start_health_server`) retired. Routes ported to FastAPI app

## Decisions Made

- **`@app.on_event("startup")` over lifespan context manager:** The deprecated-but-supported API is a one-liner for the single log line we needed; the modern lifespan context manager adds scaffolding without benefit at Phase 39 scope. Deprecation warning shows in pytest output — acceptable, Phase 40 can migrate if desired. Documented in plan `<output>` section as expected.
- **Lazy `import uvicorn` inside `start_webhook_server`:** Lets tests `from src.webhook import app` without importing uvicorn itself. Keeps test collection fast and avoids any uvicorn side effects during fixture setup.
- **Lazy `from src.supabase_client import get_supabase_admin` inside `/health/db` and `/incoming-call`:** Lets `src.webhook.app` import cleanly even if Supabase env vars are missing at startup. Fixes the environment-independence test invariant required by Plan 39-06's conftest fixtures.
- **Dead-weight tenant lookup in `/incoming-call` per D-13:** The lookup is intentionally unused — the handler always returns hardcoded AI TwiML. This exercises the full path (signature → form parse → `_normalize_phone(To)` → Supabase `tenants` select → TwiML render) so Phase 40's diff is just replacing the hardcoded branch with `evaluate_schedule(...) + check_outbound_cap(...)` composition.
- **Fail-open tenant lookup:** Wrapped in try/except with `logger.warning` — if Supabase is down, the webhook still returns valid TwiML. Twilio won't retry, and the call lands on the AI rather than 500'ing.
- **`LIVEKIT_SIP_URI` placeholder default (`sip:voco@sip.livekit.cloud`):** Phase 39 does not reconfigure any production Twilio number, so a placeholder is sufficient for the surface-freeze goal. Phase 40 will set the real URI via env var on Railway.

## Deviations from Plan

None — plan executed exactly as written. All three tasks followed the plan's `<action>` block verbatim. No Rule 1-4 deviations were required.

## Issues Encountered

None. The plan was written precisely enough that each task completed on the first attempt. The only cosmetic issue was the expected `@app.on_event` deprecation warning from FastAPI 0.115 pytest runs, which the plan's `<output>` section already called out as acceptable.

## Verification Output

**1. Full import chain intact:**
```
python -c "from src.webhook import app, start_webhook_server; from src.webhook.twilio_routes import router; from src.webhook.security import verify_twilio_signature; from src.webhook.schedule import evaluate_schedule; from src.webhook.caps import check_outbound_cap; from src.lib.phone import _normalize_phone; print('ok')"
ok
```

**2. Four Twilio routes registered on the router:**
```
python -c "from src.webhook.twilio_routes import router; print(sorted([r.path for r in router.routes]))"
['/twilio/dial-fallback', '/twilio/dial-status', '/twilio/incoming-call', '/twilio/incoming-sms']
```

**3. `src/agent.py` parses as valid Python and has no stale imports:**
```
python -c "import ast; ast.parse(open('src/agent.py').read()); print('ok')"
ok
grep "start_health_server\|from .health" src/agent.py  # exit 1 — no matches
```

**4. `src/health.py` is gone:**
```
test ! -f src/health.py && echo "deleted"
deleted
```

**5. Plan 39-03 and 39-04 pure-function tests still green (no regressions):**
```
python -m pytest tests/webhook/test_schedule.py tests/webhook/test_caps.py -q
25 passed, 2 warnings in 1.41s
```

The 2 warnings are the expected `on_event is deprecated` FastAPI notices — documented as acceptable in the plan's `<output>` section.

## User Setup Required

None — no external service configuration required for Phase 39. Plan 39-06 will test the new webhook surface via `fastapi.testclient.TestClient` with `ALLOW_UNSIGNED_WEBHOOKS=true`. No production Twilio number is reconfigured in Phase 39 (success criterion #6 / D-13).

Railway deployment will pick up `fastapi` and `uvicorn` on the next build automatically — `pip install --no-cache-dir .` in the Dockerfile picks up new deps from `pyproject.toml`.

Phase 40 will require setting `LIVEKIT_SIP_URI` and `TWILIO_AUTH_TOKEN` env vars on Railway to the real production values before any Twilio number is reconfigured to call this webhook.

## Next Phase Readiness

**Ready for Plan 39-06 (Wave 2 parallel):** The webhook surface is now frozen. Plan 39-06's integration tests in `tests/webhook/test_routes.py` and `tests/webhook/test_security.py` can flip their `pytestmark = skipif(True)` to `False` and import:
- `src.webhook.app.app` — the FastAPI app
- `src.webhook.security.verify_twilio_signature` — for `dependency_overrides` in the `client_no_auth` fixture
- The four registered `/twilio/*` routes

The `unsigned_client` and `client_no_auth` fixtures in `tests/webhook/conftest.py` are already wired to import from `src.webhook.app` and will auto-unskip as soon as the import succeeds (which it now does).

**Ready for Phase 40 (Call Routing Provisioning Cutover):** Phase 40's diff is a single branch inside `incoming_call()`:
```python
# Phase 39 (current):
return _xml_response(_ai_sip_twiml())

# Phase 40 (the one-line diff):
decision = evaluate_schedule(schedule, tenant_timezone, now_utc)
if decision.mode == 'owner_pickup' and await check_outbound_cap(tenant_id, country):
    return _xml_response(_owner_pickup_twiml(pickup_numbers, dial_timeout_seconds))
return _xml_response(_ai_sip_twiml())
```

Everything else (signature layer, form parsing, tenant lookup, TwiML helpers, health routes, daemon-thread boot) is already in place.

**Ready for Plan 39-07 (Skill Update):** `voice-call-architecture/SKILL.md` now needs a new section documenting the FastAPI co-process model, the replacement of `src/health.py`, the `src/webhook/*` subpackage structure, and the router-level signature dependency pattern. Plan 39-07 is the designated skill-sync plan; this plan deliberately did not touch the skill.

**Blockers/Concerns:** None. The livekit-agents==1.5.1 pin and google plugin git pin are preserved — no risk of breaking the gemini-3.1-flash-live-preview compatibility that the `DO NOT bump` comment block in pyproject.toml warns about.

## Self-Check: PASSED

Verified all claimed files and commits exist:

- `livekit-agent/src/webhook/security.py` — FOUND
- `livekit-agent/src/webhook/app.py` — FOUND
- `livekit-agent/src/webhook/twilio_routes.py` — FOUND
- `livekit-agent/src/webhook/__init__.py` — FOUND (updated)
- `livekit-agent/src/agent.py` — FOUND (edited)
- `livekit-agent/pyproject.toml` — FOUND (edited)
- `livekit-agent/src/health.py` — MISSING (correctly deleted)
- Commit `aeb0fee` — FOUND in livekit-agent git log
- Commit `3ec28b4` — FOUND in livekit-agent git log
- Commit `72df45a` — FOUND in livekit-agent git log

---
*Phase: 39-call-routing-webhook-foundation*
*Completed: 2026-04-09*

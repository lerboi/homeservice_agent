---
phase: 39
slug: call-routing-webhook-foundation
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-09
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated by `/gsd:plan-phase` after plans 39-01..39-07 were written.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (installed in Wave 0 via Plan 39-01) |
| **Config file** | `livekit-agent/pyproject.toml` `[tool.pytest.ini_options]` (added in Plan 39-01) |
| **Quick run command** | `cd livekit-agent && pytest tests/webhook/test_schedule.py tests/webhook/test_caps.py -x` |
| **Full suite command** | `cd livekit-agent && pytest tests/webhook/ -x` |
| **Estimated runtime** | ~3 seconds (unit: schedule+caps) / ~10 seconds (full webhook suite including routes+security) |
| **Full suite target size** | 33 tests (16 schedule + 7 caps + 6 routes + 4 security) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command above (pure-function unit tests only; fastest feedback)
- **After every plan wave completes:** Run the full webhook suite command above
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

> One row per task across all plans, populated from the plan task names and `<verify>` blocks.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 39-01-T1 Add ROUTE-01..06 to REQUIREMENTS.md | 39-01 | 0 | ROUTE-01..06 | manual-grep | `grep -c "ROUTE-0" homeservice_agent/.planning/REQUIREMENTS.md` | N/A (in-place edit) | ⬜ pending |
| 39-01-T2 Configure pytest in pyproject.toml | 39-01 | 0 | ROUTE-02 (prep) | python-tomllib | `cd livekit-agent && python -c "import tomllib; d=tomllib.load(open('pyproject.toml','rb')); assert 'pytest' in d['project']['optional-dependencies']['dev'][0]"` | livekit-agent/pyproject.toml | ⬜ pending |
| 39-01-T3 Create tests/webhook/ stub package | 39-01 | 0 | ROUTE-02..05 (prep) | pytest-collect | `cd livekit-agent && pytest tests/webhook/ --collect-only -q` | 7 test files in tests/webhook/ | ⬜ pending |
| 39-02-T1 Create migration 042 | 39-02 | 1 | ROUTE-01 | grep-schema | `grep "ADD COLUMN call_forwarding_schedule JSONB" homeservice_agent/supabase/migrations/042_call_routing_schema.sql` | homeservice_agent/supabase/migrations/042_call_routing_schema.sql | ⬜ pending |
| 39-03-T1 Create src/webhook/schedule.py | 39-03 | 1 | ROUTE-04 | python-import | `cd livekit-agent && python -c "from src.webhook.schedule import evaluate_schedule, ScheduleDecision"` | livekit-agent/src/webhook/schedule.py | ⬜ pending |
| 39-03-T2 Fill in test_schedule.py (16 tests) | 39-03 | 1 | ROUTE-04 | unit | `cd livekit-agent && pytest tests/webhook/test_schedule.py -x` | livekit-agent/tests/webhook/test_schedule.py | ⬜ pending |
| 39-04-T1 Extract _normalize_phone to src/lib/phone.py | 39-04 | 1 | ROUTE-02 (prep for webhook handler import) | python-import | `cd livekit-agent && python -c "from src.lib.phone import _normalize_phone; assert _normalize_phone('sip:+15551234567@d.com')=='+15551234567'"` | livekit-agent/src/lib/phone.py | ⬜ pending |
| 39-04-T2 Create src/webhook/caps.py (7 tests) | 39-04 | 1 | ROUTE-05 | unit | `cd livekit-agent && pytest tests/webhook/test_caps.py -x` | livekit-agent/src/webhook/caps.py | ⬜ pending |
| 39-05-T1 Add FastAPI/uvicorn deps + security.py + app.py | 39-05 | 2 | ROUTE-02, ROUTE-03 | python-import | `cd livekit-agent && python -c "from src.webhook.security import verify_twilio_signature; import inspect; assert inspect.iscoroutinefunction(verify_twilio_signature)"` | livekit-agent/src/webhook/{security.py,app.py} | ⬜ pending |
| 39-05-T2 Create twilio_routes.py + update __init__.py | 39-05 | 2 | ROUTE-02, ROUTE-06 | python-import | `cd livekit-agent && python -c "from src.webhook.twilio_routes import router; paths=[r.path for r in router.routes]; assert all(p in paths for p in ['/twilio/incoming-call','/twilio/dial-status','/twilio/dial-fallback','/twilio/incoming-sms'])"` | livekit-agent/src/webhook/{twilio_routes.py,__init__.py} | ⬜ pending |
| 39-05-T3 Swap agent.py boot + delete health.py | 39-05 | 2 | ROUTE-02 | file-exists | `test ! -f livekit-agent/src/health.py && grep "from .webhook import start_webhook_server" livekit-agent/src/agent.py` | livekit-agent/src/agent.py (edited); livekit-agent/src/health.py (deleted) | ⬜ pending |
| 39-06-T1 Fill in test_routes.py (6 integration tests) | 39-06 | 2 | ROUTE-02 | integration | `cd livekit-agent && pytest tests/webhook/test_routes.py -x` | livekit-agent/tests/webhook/test_routes.py | ⬜ pending |
| 39-06-T2 Fill in test_security.py (4 security tests) | 39-06 | 2 | ROUTE-03 | integration | `cd livekit-agent && pytest tests/webhook/test_security.py -x` | livekit-agent/tests/webhook/test_security.py | ⬜ pending |
| 39-07-T1 Update SKILL.md with RESEARCH §9 edits | 39-07 | 3 | ROUTE-01..06 (documentation) | grep-skill | `grep "src/webhook/app.py" homeservice_agent/.claude/skills/voice-call-architecture/SKILL.md && grep "## 11. Webhook Service" homeservice_agent/.claude/skills/voice-call-architecture/SKILL.md` | homeservice_agent/.claude/skills/voice-call-architecture/SKILL.md | ⬜ pending |
| 39-07-T2 Final verification sweep (13 checks) | 39-07 | 3 | ROUTE-01..06 | multi-check | `cd livekit-agent && pytest tests/webhook/ -x && test ! -f src/health.py && grep -c "ROUTE-0" homeservice_agent/.planning/REQUIREMENTS.md` | all Phase 39 artifacts verified in aggregate | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements (COMPLETED via Plan 39-01)

- [x] `livekit-agent/pyproject.toml` — add `[tool.pytest.ini_options]` with `testpaths = ["tests"]`, `asyncio_mode = "auto"`, `pythonpath = ["."]`
- [x] `livekit-agent/pyproject.toml` — add `[project.optional-dependencies].dev = ["pytest>=8.0","pytest-asyncio>=0.23","httpx>=0.27"]`
- [x] `livekit-agent/tests/__init__.py` — empty marker
- [x] `livekit-agent/tests/webhook/__init__.py` — empty marker
- [x] `livekit-agent/tests/webhook/conftest.py` — `unsigned_client`, `client_no_auth`, `test_auth_token` fixtures
- [x] `livekit-agent/tests/webhook/test_schedule.py` — 16 stubs for every success-criterion #4 sub-case
- [x] `livekit-agent/tests/webhook/test_caps.py` — 7 stubs for every success-criterion #5 sub-case
- [x] `livekit-agent/tests/webhook/test_routes.py` — 6 stubs for all four Twilio endpoints + /health + /health/db
- [x] `livekit-agent/tests/webhook/test_security.py` — 4 stubs for signature verification matrix
- [x] `homeservice_agent/.planning/REQUIREMENTS.md` — ROUTE-01..06 added

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Railway container boots with FastAPI webhook on port 8080 before LiveKit worker | ROUTE-02 | Requires real deploy to Railway | Deploy to Railway staging; tail logs; confirm `"INFO:uvicorn:Uvicorn running on http://0.0.0.0:8080"` appears BEFORE LiveKit worker log lines |
| Dockerfile `HEALTHCHECK curl -f http://localhost:8080/health` still passes after FastAPI refactor | ROUTE-02 | Requires running container | `docker build livekit-agent/ -t voco-agent-test && docker run --rm voco-agent-test` and observe `healthy` status |
| Twilio console "Test webhook" tool returns 200 for all four endpoints when signed | ROUTE-02, ROUTE-03 | Requires Twilio console access | From Twilio console, send test POST to each of `/twilio/incoming-call`, `/twilio/dial-status`, `/twilio/dial-fallback`, `/twilio/incoming-sms` — all must return 200 |
| Twilio signed request with WRONG signature → 403 in production | ROUTE-03 | Requires real Twilio signer | `curl -X POST https://<railway-url>/twilio/incoming-call -H "X-Twilio-Signature: bad"` returns 403 |
| Migration 042 applies cleanly to staging Supabase with no existing column conflicts | ROUTE-01 | Requires Supabase project | `supabase db push --db-url <staging>`; confirm new columns exist via table editor; confirm existing tenant rows show default `call_forwarding_schedule={"enabled":false,"days":{}}` and `pickup_numbers=[]` |
| Zero production traffic routed through new webhook (no existing tenant number reconfigured) | ROUTE-06 | Phase boundary assertion | Query Twilio API for all tenant numbers; confirm `voice_url` is unchanged (still Elastic SIP Trunk, NOT the Railway webhook URL). Automated negative-check: `grep -rn "voice_url\|sms_url" livekit-agent/src/webhook/` returns zero matches (Phase 40 will wire voice_url). |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies populated (see Per-Task Verification Map)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task has at least a grep or pytest automated check)
- [x] Wave 0 covers all MISSING references in the Per-Task Verification Map (Plan 39-01 creates conftest.py + 4 stub test files)
- [x] No watch-mode flags (`--watch`, `-w`) in verify commands
- [x] Feedback latency < 10s for quick run
- [x] `nyquist_compliant: true` set in frontmatter (planner filled the Verification Map)

**Approval:** approved — 2026-04-09 by `/gsd:plan-phase` planner

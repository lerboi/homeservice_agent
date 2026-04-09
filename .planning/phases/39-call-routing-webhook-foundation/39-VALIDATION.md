---
phase: 39
slug: call-routing-webhook-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Planner: fill in Task IDs, wave numbers, and automated commands as plans are written. Populate from the Validation Architecture section in `39-RESEARCH.md` (section titled "Validation Architecture").

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (no existing pytest.ini — Wave 0 installs) |
| **Config file** | `pyproject.toml` `[tool.pytest.ini_options]` — added in Wave 0 |
| **Quick run command** | `pytest tests/webhook/test_schedule.py tests/webhook/test_caps.py -x` |
| **Full suite command** | `pytest tests/ -x` |
| **Estimated runtime** | ~3 seconds (unit) / ~10 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command above
- **After every plan wave:** Run the full suite command above
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

> Populated by planner during plan creation — one row per task with an automated check.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | ROUTE-01..06 | unit/integration | TBD | W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pyproject.toml` — add `[tool.pytest.ini_options]` with `pythonpath = ["src"]` and `testpaths = ["tests"]`
- [ ] `pyproject.toml` — add `pytest`, `pytest-asyncio`, `httpx` to `[project.optional-dependencies].dev`
- [ ] `tests/__init__.py` — empty marker
- [ ] `tests/webhook/__init__.py` — empty marker
- [ ] `tests/webhook/conftest.py` — shared fixtures (FastAPI TestClient with `ALLOW_UNSIGNED_WEBHOOKS=true`, sample tenant rows, frozen UTC now)
- [ ] `tests/webhook/test_schedule.py` — stubs for every success-criterion #4 sub-case
- [ ] `tests/webhook/test_caps.py` — stubs for every success-criterion #5 sub-case
- [ ] `tests/webhook/test_routes.py` — stubs for all four endpoints (signed + unsigned)
- [ ] `tests/webhook/test_security.py` — stubs for signature verification dependency

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Railway container boots with FastAPI webhook on port 8080 before LiveKit worker | Success #2 | Requires real deploy to Railway | Deploy to Railway staging; tail logs; confirm `"INFO:uvicorn:Uvicorn running on http://0.0.0.0:8080"` appears BEFORE LiveKit worker log lines |
| Dockerfile `HEALTHCHECK curl -f http://localhost:8080/health` still passes after FastAPI refactor | Success #2 | Requires running container | `docker build . && docker run --rm <image>` and observe `healthy` status |
| Twilio console "Test webhook" tool returns 200 for all four endpoints when signed | Success #2, #3 | Requires Twilio console access | From Twilio console, send test POST to each of `/twilio/incoming-call`, `/twilio/dial-status`, `/twilio/dial-fallback`, `/twilio/incoming-sms` — all must return 200 |
| Twilio signed request with WRONG signature → 403 | Success #3 | Requires real Twilio signer | Use twilio-python `RequestValidator.compute_signature` with wrong auth token; POST to `/twilio/incoming-call`; expect 403 |
| Migration 042 applies cleanly to staging Supabase with no existing column conflicts | Success #1 | Requires Supabase project | `supabase db push --db-url <staging>`; confirm new columns exist via table editor; confirm existing tenant rows show default `call_forwarding_schedule={"enabled":false,"days":{}}` and `pickup_numbers=[]` |
| Zero production traffic routed through new webhook (no existing tenant number reconfigured) | Success #6 | Phase boundary assertion | Query Twilio API for all tenant numbers; confirm `voice_url` is unchanged (still Elastic SIP Trunk, NOT the Railway webhook URL) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies populated
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references in the Per-Task Verification Map
- [ ] No watch-mode flags (`--watch`, `-w`) in verify commands
- [ ] Feedback latency < 10s for quick run
- [ ] `nyquist_compliant: true` set in frontmatter once planner fills the Verification Map

**Approval:** pending

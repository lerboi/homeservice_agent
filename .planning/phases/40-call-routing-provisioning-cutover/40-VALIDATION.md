---
phase: 40
slug: call-routing-provisioning-cutover
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-11
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + pytest-asyncio 0.23+ |
| **Config file** | `livekit-agent/pyproject.toml` `[tool.pytest.ini_options]` |
| **Quick run command** | `cd C:/Users/leheh/.Projects/livekit-agent && python -m pytest tests/webhook/ -x -q` |
| **Full suite command** | `cd C:/Users/leheh/.Projects/livekit-agent && python -m pytest tests/webhook/ -q` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd C:/Users/leheh/.Projects/livekit-agent && python -m pytest tests/webhook/ -x -q`
- **After every plan wave:** Run `cd C:/Users/leheh/.Projects/livekit-agent && python -m pytest tests/webhook/ -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Wave 0 Note

TDD-within-task is the accepted pattern for this phase. Test stubs are written by each TDD task alongside the implementation (RED-GREEN cycle), not pre-created in a separate Wave 0 plan. All TDD tasks in Plans 01 and 02 have `tdd="true"` and `<behavior>` blocks specifying exact test expectations.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 40-01-T1 | 01 | 1 | ROUTE-07 | migration | `grep "CREATE TABLE sms_messages" supabase/migrations/045_sms_messages_and_call_sid.sql` | pending |
| 40-01-T2a | 01 | 1 | ROUTE-07 | unit | `pytest tests/webhook/test_routes.py::test_incoming_call_ai_mode -x` | pending |
| 40-01-T2b | 01 | 1 | ROUTE-07 | unit | `pytest tests/webhook/test_routes.py::test_incoming_call_owner_pickup -x` | pending |
| 40-01-T2c | 01 | 1 | ROUTE-07 | unit | `pytest tests/webhook/test_routes.py::test_incoming_call_unknown_tenant -x` | pending |
| 40-01-T2d | 01 | 1 | ROUTE-07 | unit | `pytest tests/webhook/test_routes.py::test_incoming_call_blocked_tenant -x` | pending |
| 40-01-T2e | 01 | 1 | ROUTE-07 | unit | `pytest tests/webhook/test_routes.py::test_incoming_call_cap_breach -x` | pending |
| 40-01-T2f | 01 | 1 | ROUTE-07 | unit | `pytest tests/webhook/test_routes.py::test_incoming_call_no_pickup_numbers -x` | pending |
| 40-01-T2g | 01 | 1 | ROUTE-08 | unit | `pytest tests/webhook/test_routes.py::test_owner_pickup_twiml_structure -x` | pending |
| 40-01-T2h | 01 | 1 | ROUTE-08 | unit | `pytest tests/webhook/test_routes.py::test_owner_pickup_inserts_calls_row -x` | pending |
| 40-02-T1a | 02 | 2 | ROUTE-09 | unit | `pytest tests/webhook/test_routes.py::test_dial_status_updates_calls_row -x` | pending |
| 40-02-T1b | 02 | 2 | ROUTE-09 | unit | `pytest tests/webhook/test_routes.py::test_dial_status_no_answer -x` | pending |
| 40-02-T1c | 02 | 2 | ROUTE-09 | unit | `pytest tests/webhook/test_routes.py::test_dial_status_busy -x` | pending |
| 40-02-T1d | 02 | 2 | ROUTE-09 | unit | `pytest tests/webhook/test_routes.py::test_dial_status_db_failure -x` | pending |
| 40-02-T1e | 02 | 2 | ROUTE-10 | unit | `pytest tests/webhook/test_routes.py::test_dial_fallback_returns_ai_twiml -x` | pending |
| 40-02-T2a | 02 | 2 | ROUTE-11 | unit | `pytest tests/webhook/test_routes.py::test_incoming_sms_forwarding -x` | pending |
| 40-02-T2b | 02 | 2 | ROUTE-11 | unit | `pytest tests/webhook/test_routes.py::test_incoming_sms_mms_note -x` | pending |
| 40-02-T2c | 02 | 2 | ROUTE-11 | unit | `pytest tests/webhook/test_routes.py::test_incoming_sms_partial_failure -x` | pending |
| 40-02-T2d | 02 | 2 | ROUTE-11 | unit | `pytest tests/webhook/test_routes.py::test_incoming_sms_unknown_tenant -x` | pending |
| 40-03-T1 | 03 | 3 | ROUTE-12 | manual | N/A — JS provisioning, no test infra | pending |
| 40-03-T2 | 03 | 3 | ROUTE-12 | manual | `node -c scripts/cutover-existing-numbers.js` (syntax check only) | pending |
| 40-03-T3 | 03 | 3 | ROUTE-12 | checkpoint | Human verifies cutover on real Twilio numbers | pending |
| 40-03-T4 | 03 | 3 | — | manual | Skill file updated with Phase 40 changes | pending |

*Status: pending / green / red / flaky*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| provisionPhoneNumber sets voice_url/sms_url | ROUTE-12 | No JS test infrastructure for Stripe webhook handler | Trigger a test Stripe webhook event, verify Twilio number has correct voice_url/sms_url via Twilio console |
| Cutover script updates existing tenant numbers | ROUTE-12 | Twilio API integration test requiring real credentials | Run cutover script with dry-run flag, verify output lists all tenant numbers with correct target URLs |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or TDD-within-task pattern
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 not needed — TDD-within-task is the accepted pattern for this phase
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] `wave_0_complete: true` set in frontmatter

**Approval:** pending

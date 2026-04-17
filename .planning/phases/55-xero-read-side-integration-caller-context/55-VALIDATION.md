---
phase: 55
slug: xero-read-side-integration-caller-context
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-17
updated: 2026-04-17
---

# Phase 55 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Next.js)** | vitest (or jest — executor verifies via package.json scripts; tests are framework-agnostic in API) |
| **Framework (Python livekit-agent)** | pytest (cross-repo at `C:/Users/leheh/.Projects/livekit-agent/`) |
| **Config file (Next.js)** | `vitest.config.*` or `jest.config.*` (project default) |
| **Config file (Python)** | `pyproject.toml` `[tool.pytest.ini_options]` or `pytest.ini` (cross-repo) |
| **Quick run command (Next.js)** | `npx vitest run tests/integrations tests/api/integrations tests/api/webhooks tests/api/setup-checklist tests/lib tests/components/BusinessIntegrationsClient.test.jsx` (or `npx jest <same paths>`) |
| **Full suite command (Next.js)** | `npm test` |
| **Quick run command (Python)** | `pytest tests/test_xero_integration.py tests/test_check_customer_account.py tests/test_prompt_customer_context.py tests/test_agent_xero_timeout.py -v` (run inside livekit-agent repo) |
| **Full suite command (Python)** | `pytest -v` (cross-repo, separate gate) |
| **Estimated runtime (Next.js per-task)** | ~5–15 seconds |
| **Estimated runtime (Next.js full)** | ~60–120 seconds |
| **Estimated runtime (Python per-task)** | ~3–8 seconds |

---

## Sampling Rate

- **After every task commit:** Run the per-task quick command for the affected test file (`npx vitest run <test-file>` or `pytest <test-file>`)
- **After every plan wave:**
  - Wave 1 (Plans 01, 02, 06): Next.js — `npx vitest run tests/integrations`. Cross-repo Python — user runs `pytest tests/test_xero_integration.py tests/test_agent_xero_timeout.py -v` and reports.
  - Wave 2 (Plans 03, 04, 05, 07): Next.js — `npx vitest run tests/api tests/lib tests/components`. Cross-repo Python — user runs `pytest tests/test_check_customer_account.py tests/test_prompt_customer_context.py -v`.
  - Wave 3 (Plan 08): docs only — no test gate.
- **Before `/gsd-verify-work`:** Next.js full suite green + user-reported Python suite green + UAT scenarios A/B/C from Plan 07 manually validated
- **Max feedback latency:** 15 seconds per-task; 120 seconds per-wave

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 55-01-01 | 01 | 1 | XERO-01 | T-55-01-01 | accounting_credentials.error_state column exists with safe semantics | manual + grep | `test -f supabase/migrations/053_xero_error_state.sql && grep -q "ADD COLUMN IF NOT EXISTS error_state" supabase/migrations/053_xero_error_state.sql` | ✅ | ⬜ pending |
| 55-01-02 | 01 | 1 | XERO-01 | T-55-01-03 | XERO_WEBHOOK_KEY documented in .env.example with empty value | grep | `grep -n "^XERO_WEBHOOK_KEY=" .env.example` | ✅ | ⬜ pending |
| 55-01-03 | 01 | 1 | XERO-01 | — | Live Supabase schema reflects column | manual (BLOCKING checkpoint) | `npx supabase db remote query "SELECT column_name FROM information_schema.columns WHERE table_name='accounting_credentials' AND column_name='error_state';"` | manual-only | ⬜ pending |
| 55-02-01 | 02 | 1 | XERO-02 | T-55-02-* | RED-phase tests for fetchCustomerByPhone shape + cache directive | unit | `npx vitest run tests/integrations/xero.fetch.test.js tests/integrations/xero.cache.test.js` | ❌ Wave 0 | ⬜ pending |
| 55-02-02 | 02 | 1 | XERO-02 | T-55-02-01..05 | fetchCustomerByPhone implements D-01..D-05; OData injection guarded; cache tags two-tier; never throws out of cache | unit | same as 55-02-01 | ❌ Wave 0 | ⬜ pending |
| 55-03-01 | 03 | 2 | XERO-01 | T-55-03-* | RED-phase tests for OAuth + disconnect with revalidateTag/revoke assertions | unit | `npx vitest run tests/api/integrations/` | ❌ Wave 0 | ⬜ pending |
| 55-03-02 | 03 | 2 | XERO-01 | T-55-03-01,05,06 | OAuth callback heals error_state + revalidates xero-context; disconnect revokes + invalidates broad tag | unit | same as 55-03-01 | ❌ Wave 0 | ⬜ pending |
| 55-04-01 | 04 | 2 | XERO-03 | T-55-04-* | RED-phase tests for webhook handler (signature, intent-verify, resolution, silent-ignore) | unit | `npx vitest run tests/api/webhooks/xero.test.js` | ❌ Wave 0 | ⬜ pending |
| 55-04-02 | 04 | 2 | XERO-03 | T-55-04-01..08 | HMAC verify with timingSafeEqual + raw body + per-phone revalidateTag + broad fallback + silent-ignore | unit | same as 55-04-01 | ❌ Wave 0 | ⬜ pending |
| 55-05-01 | 05 | 2 | XERO-01 | T-55-05-* | RED-phase tests for setup-checklist + notifyXeroRefreshFailure + card snapshots | unit + component | `npx vitest run tests/api/setup-checklist.test.js tests/lib/notifyXeroRefreshFailure.test.js tests/components/BusinessIntegrationsClient.test.jsx` | ❌ Wave 0 | ⬜ pending |
| 55-05-02 | 05 | 2 | XERO-01 | T-55-05-01,03,06 | connect_xero auto-detects + email + Reconnect banner | unit + component | same as 55-05-01 | ❌ Wave 0 | ⬜ pending |
| 55-05-03 | 05 | 2 | XERO-01 | — | Visual UAT all 4 card states + email render | manual (BLOCKING checkpoint) | manual — see Plan 05 Task 4 instructions | manual-only | ⬜ pending |
| 55-05-04 | 05 | 2 | XERO-01 | T-55-05-03 | Card never leaks caller PII | included in component snapshot | same as 55-05-01 | ❌ Wave 0 | ⬜ pending |
| 55-06-01 | 06 | 1 | XERO-04 | T-55-06-* | Wave 0 RED tests for xero.py + agent.py timeout (test scaffolds) | pytest (RED expected until 06-02 + 06-03) | user runs `pytest tests/test_xero_integration.py tests/test_agent_xero_timeout.py -v` (collect-only succeeds; assertions RED) | ❌ cross-repo Wave 0 | ⬜ pending |
| 55-06-02 | 06 | 1 | XERO-04 | T-55-06-01..07 | livekit-agent xero.py module created + importable + 6 unit tests GREEN (no creds, no match, full shape, refresh write-back, refresh failure persists error_state, invalid phone) | pytest + import test | user runs `python -c "from src.integrations.xero import fetch_xero_customer_by_phone"` then `pytest tests/test_xero_integration.py -v` (cross-repo) | ❌ requires 06-01 GREEN | ⬜ pending |
| 55-06-03 | 06 | 1 | XERO-04 | — | _run_db_queries adds 4th task with 800ms timeout + 2 timeout tests GREEN (timeout → customer_context=None, success → populated) | pytest + code review | user runs `pytest tests/test_agent_xero_timeout.py -v` (cross-repo) | ❌ requires 06-01 GREEN | ⬜ pending |
| 55-06-04 | 06 | 1 | XERO-04 | — | Live deployment to Railway + test call shows expected log | manual (BLOCKING checkpoint) | tail Railway logs during test call | manual-only | ⬜ pending |
| 55-07-01 | 07 | 2 | XERO-04 | T-55-07-* | check_customer_account.py module created + importable | manual import test | user runs `python -c "from src.tools.check_customer_account import format_customer_context_state; print(format_customer_context_state(None))"` | manual cross-repo | ⬜ pending |
| 55-07-02 | 07 | 2 | XERO-04 | — | tools/__init__.py registers + prompt.py block + agent.py wires | code review + Plan 07 Task 3 tests | user runs `pytest tests/test_prompt_customer_context.py -v` | ❌ cross-repo Wave 0 | ⬜ pending |
| 55-07-03 | 07 | 2 | XERO-04 | T-55-07-01..06 | format_customer_context_state shape + privacy clauses | pytest | `pytest tests/test_check_customer_account.py -v` (cross-repo) | ❌ cross-repo Wave 0 | ⬜ pending |
| 55-07-04 | 07 | 2 | XERO-04 | T-55-07-01,02,03 | E2E UAT scenarios A/B/C (caller in/out of Xero, agent silent-awareness) | manual (BLOCKING checkpoint) | place real call from connected/unconnected number; verify agent behavior | manual-only | ⬜ pending |
| 55-08-01 | 08 | 3 | XERO-01..04 | T-55-08-01 | voice-call-architecture skill updated | grep | `grep -n "check_customer_account\|customer_context\|integrations/xero" .claude/skills/voice-call-architecture/SKILL.md` | ✅ | ⬜ pending |
| 55-08-02 | 08 | 3 | XERO-01..04 | — | auth-database-multitenancy skill updated | grep | `grep -n "053_xero_error_state\|error_state" .claude/skills/auth-database-multitenancy/SKILL.md` | ✅ | ⬜ pending |
| 55-08-03 | 08 | 3 | XERO-01..04 | — | dashboard-crm-system skill updated | grep | `grep -n "Reconnect needed\|XeroReconnectEmail\|connect_xero\|notifyXeroRefreshFailure" .claude/skills/dashboard-crm-system/SKILL.md` | ✅ | ⬜ pending |
| 55-08-04 | 08 | 3 | XERO-01..04 | — | ROADMAP/STATE/REQUIREMENTS synced | grep | `grep -n "55-08-PLAN" .planning/ROADMAP.md && grep -n "Phase 55 CLOSED\|completed-phase-55" .planning/STATE.md && grep -n "XERO-01.*Phase 55.*Complete" .planning/REQUIREMENTS.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Sampling continuity check: no 3 consecutive auto tasks lack an `<automated>` verify. The two manual-only checkpoints (Plan 05 Task 4 visual UAT, Plan 07 Task 4 call UAT) are bracketed by automated tests on either side. Plan 06 has cross-repo automated tests + a deploy checkpoint — also bracketed. Plan 06 task ordering: 55-06-01 lays down test scaffolds (RED), 55-06-02 implements xero.py (GREEN for 6 fetcher tests), 55-06-03 wires agent.py (GREEN for 2 timeout tests), 55-06-04 deploys.

---

## Wave 0 Requirements

**Next.js side:**
- [ ] `tests/integrations/xero.fetch.test.js` — XERO-02 fetchCustomerByPhone shape + edge cases (Plan 02 Task 1)
- [ ] `tests/integrations/xero.cache.test.js` — static check for `'use cache'` placement + cacheTag strings (Plan 02 Task 1)
- [ ] `tests/api/integrations/oauth.test.js` — XERO-01 auth + callback (Plan 03 Task 1)
- [ ] `tests/api/integrations/disconnect.test.js` — XERO-01 disconnect with revoke + invalidate (Plan 03 Task 1)
- [ ] `tests/api/webhooks/xero.test.js` — XERO-03 (signature, intent-verify, resolve, revalidateTag) (Plan 04 Task 1)
- [ ] `tests/fixtures/xero-webhook-payloads/` — fixtures for intent-verify + INVOICE events (Plan 04 Task 1)
- [ ] `tests/api/setup-checklist.test.js` — connect_xero item + auto-completion (Plan 05 Task 1)
- [ ] `tests/lib/notifyXeroRefreshFailure.test.js` — error_state write + Resend mock (Plan 05 Task 1)
- [ ] `tests/components/BusinessIntegrationsClient.test.jsx` — card 4-state snapshots (Plan 05 Task 1)

**Python (cross-repo livekit-agent):**
- [ ] `livekit-agent/tests/test_xero_integration.py` — fetch_xero_customer_by_phone (Plan 06 Task 1 — RED scaffolds; GREEN after Plan 06 Task 2)
- [ ] `livekit-agent/tests/test_agent_xero_timeout.py` — 800ms timeout behavior (Plan 06 Task 1 — RED scaffolds; GREEN after Plan 06 Task 3)
- [ ] `livekit-agent/tests/test_check_customer_account.py` — STATE+DIRECTIVE shape (Plan 07 Task 3)
- [ ] `livekit-agent/tests/test_prompt_customer_context.py` — block injection + positional check (Plan 07 Task 3)

**Framework install:** none — vitest/jest already present in Next.js project; pytest already present in livekit-agent.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `fetchCustomerByPhone` <500ms p95 latency | XERO-02 | Real Xero RTT cannot be unit-tested deterministically | Measure via Sentry / log timestamps on staging with real Xero demo company; sample 20 calls |
| Live Supabase schema has error_state column | XERO-01 | Schema push is a side effect outside test runner | Plan 01 Task 3 BLOCKING checkpoint instructions |
| Visual UAT: all 4 card states + email render | XERO-01 (D-15) | UI design contract requires human visual sign-off | Plan 05 Task 4 instructions (8 verification steps) |
| Cross-repo Python tests | XERO-04 | Tests live in a separate repo (livekit-agent) | User runs pytest in livekit-agent repo and reports results |
| Live Railway deployment of livekit-agent + test call log | XERO-04 | Production behavior in a separate runtime | Plan 06 Task 4 BLOCKING checkpoint |
| E2E UAT: caller in Xero / not in Xero / Xero disconnected — agent silent-awareness | XERO-04 (D-10) | Agent prompt behavior cannot be deterministically unit-tested for "would the LLM volunteer" — needs real call observation | Plan 07 Task 4 instructions (4 scenarios A/B/C/D) |
| Webhook intent-verify handshake against real Xero | XERO-03 | Xero's webhook subscription registration is a one-time UI action | Subscribe webhook URL in Xero developer portal — handshake either succeeds or returns "intent verification failed" |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (or are explicit `checkpoint:human-*` tasks with documented manual instructions)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (manual checkpoints are bracketed by automated tests)
- [x] Wave 0 covers all MISSING references (13 test files listed across both repos)
- [x] No watch-mode flags in any verify command
- [x] Feedback latency < 15s per-task
- [x] `nyquist_compliant: true` set in frontmatter
- [x] Plan 06 task ordering: tests-first (55-06-01) ensures Tasks 2 + 3 reference real test files, eliminating the prior MISSING references

**Approval:** ready

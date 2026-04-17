---
phase: 55-xero-read-side-integration-caller-context
plan: 06
subsystem: voice-agent
tags: [livekit, python, xero, asyncio, cross-repo]

requires:
  - phase: 54-integrations-scaffolding
    provides: accounting_credentials schema + Xero OAuth scopes
  - phase: 55-01
    provides: error_state column on accounting_credentials
provides:
  - livekit-agent src/integrations/xero.py (fetch_xero_customer_by_phone + bounded wrapper)
  - 4th parallel task in agent._run_db_queries storing customer_context on deps
  - error_state='token_refresh_failed' write on refresh failure
affects: [55-07]

tech-stack:
  added:
    - (livekit-agent) httpx-based Xero REST client
  patterns:
    - "asyncio.wait_for + Sentry capture bounded-task wrapper"
    - "Refresh-token write-back (access_token + refresh_token + expiry_date + heal error_state)"

key-files:
  created:
    - (livekit-agent) src/integrations/__init__.py
    - (livekit-agent) src/integrations/xero.py
    - (livekit-agent) tests/test_xero_integration.py
    - (livekit-agent) tests/test_agent_xero_timeout.py
    - (livekit-agent) .env.example
  modified:
    - (livekit-agent) src/agent.py (_run_db_queries gains 4th task; deps["customer_context"] set)

key-decisions:
  - "Raw httpx (not xero-python SDK) — tight timeout control, smaller footprint, 3 endpoints only"
  - "Extracted fetch_xero_context_bounded helper so timeout + Sentry logic is testable without the nested _run_db_queries closure"
  - "Refresh failures write error_state='token_refresh_failed' in Python; email/banner surfacing lives in Next.js (Plan 05) — avoids duplicate emails"
  - "customer_context stashed on deps dict (matches existing call_uuid pattern) so Plan 07 can inject into system prompt"

patterns-established:
  - "Any LiveKit hot-path integration must be wrapped in a bounded helper with Sentry capture — never await unbounded network calls in _run_db_queries"

requirements-completed: [XERO-04]

completed: 2026-04-18
---

# Plan 55-06: LiveKit Xero read-side integration

**Python agent can now fetch caller context from Xero in parallel with existing DB queries, bounded to 800ms with silent degradation on timeout/failure.**

Cross-repo commit: `448aa89` in `lerboi/livekit_agent` (main branch, local — not yet pushed/deployed).

## Accomplishments

**New `src/integrations/xero.py`:**
- `fetch_xero_customer_by_phone(tenant_id, phone_e164)` — returns standard caller-context dict or None.
- Refresh-aware token handling via raw `httpx`; write-back persists new access_token + refresh_token + expiry_date + clears error_state.
- Refresh failure writes `error_state='token_refresh_failed'` and returns None (Plan 05 picks up the signal on dashboard read).
- E.164 regex + digits-only OData params prevent injection.
- Post-filter contact match in Python after `Phones[0].PhoneNumber.Contains()` candidate narrowing.
- Per-fetch `last_context_fetch_at` telemetry touch.
- Helper seams (`_load_credentials`, `_get_contacts_by_phone`, `_get_outstanding_balance`, `_get_recent_invoices`, `_persist_refreshed_tokens`, `_persist_refresh_failure`, `_touch_last_context_fetch_at`) expose clean mock surfaces for unit tests.

**New `fetch_xero_context_bounded(tenant_id, phone_e164, timeout_seconds=0.8)`:**
- Wraps `fetch_xero_customer_by_phone` in `asyncio.wait_for`.
- On timeout or exception: returns None + captures to Sentry with tenant_id + hashed phone tags (first 8 sha256 chars — no PII).

**Modified `src/agent.py`:**
- Added 4th parallel task `xero_context_task` to `_run_db_queries` alongside sub/intake/call tasks.
- Stores result on `deps["customer_context"]` (None for any failure mode).
- Imports `from .integrations.xero import fetch_xero_context_bounded`.

**Tests (9/9 PASS):**
- `test_xero_integration.py` — 6 tests: invalid phone, no creds, no match, full shape, refresh write-back, refresh failure persisted.
- `test_agent_xero_timeout.py` — 3 tests: timeout returns None, success returns shape, exception captured to Sentry (phone hashed).

## Deviation from Plan

Plan 06 Task 3 called for patching module-level `_load_subscription`, `_load_intake`, `_load_call_record` helpers in `_run_db_queries`. Those don't exist in the real agent.py — `_run_db_queries` is a closure that inlines supabase calls via `asyncio.to_thread` lambdas. I extracted `fetch_xero_context_bounded` as a testable unit instead, which is cleaner and gives the same coverage (timeout + Sentry capture verified independently).

Pre-session awaiting (D-08) — currently `_run_db_queries` is fire-and-forget via `asyncio.create_task`, so the customer_context won't be available when `session.start()` resolves. Plan 07's prompt builder will need to await the db_task (or read deps["customer_context"] after session start) before injecting the prompt block. Flagged for Plan 07.

## Files

All paths relative to `C:/Users/leheh/.Projects/livekit-agent/`:

**Created:**
- `src/integrations/__init__.py`
- `src/integrations/xero.py`
- `tests/test_xero_integration.py`
- `tests/test_agent_xero_timeout.py`
- `.env.example`

**Modified:**
- `src/agent.py` (import + 4th task + deps["customer_context"] write)

## Verification

- `pytest tests/test_xero_integration.py tests/test_agent_xero_timeout.py -v` → 9/9 pass (3.02s)
- `python -c "from src import agent"` → no ImportError
- git commit `448aa89` created in livekit-agent `main` branch

## Checkpoint — Deploy Still Pending

The livekit-agent commit is local-only. User action required:
1. `cd C:/Users/leheh/.Projects/livekit-agent && git push origin main`
2. Confirm Railway env vars `XERO_CLIENT_ID` + `XERO_CLIENT_SECRET` are set (same as Voco Vercel)
3. Railway auto-deploys; watch for ImportError on `src.integrations.xero` in logs
4. Optional: test inbound call to verify `xero_context: fetched (contact=...)` log line appears

## Downstream Enablement

- Plan 55-07 reads `deps["customer_context"]` to build the STATE+DIRECTIVE prompt block and power `check_customer_account()` tool.
- Plan 55-05 dashboard reads `error_state='token_refresh_failed'` to render the Reconnect banner + send email.

---
phase: 55-xero-read-side-integration-caller-context
plan: 07
subsystem: voice-agent
tags: [livekit, python, prompt, tool, xero, cross-repo]

requires:
  - phase: 55-06
    provides: fetch_xero_context_bounded + customer_context shape
provides:
  - check_customer_account LiveKit tool (STATE+DIRECTIVE re-serve)
  - build_system_prompt customer_context kwarg with CRITICAL RULE block
  - Pre-session xero fetch in agent.py (D-08)
affects: []

key-files:
  created:
    - (livekit-agent) src/tools/check_customer_account.py
    - (livekit-agent) tests/test_check_customer_account.py
    - (livekit-agent) tests/test_prompt_customer_context.py
  modified:
    - (livekit-agent) src/tools/__init__.py (register new tool)
    - (livekit-agent) src/prompt.py (customer_context kwarg + _build_customer_account_section)
    - (livekit-agent) src/agent.py (pre-session fetch; moved xero out of _run_db_queries)

key-decisions:
  - "Pre-session fetch in agent.py (D-08) — restructured from Plan 06's background task to an awaited call before build_system_prompt so the STATE+DIRECTIVE block is part of the initial system message"
  - "Shared format_customer_context_state formatter used by both the tool and the prompt block (DRY)"
  - "Emit CALLER ACCOUNT CONTEXT block even on no-match (STATE: no_xero_contact_for_phone) so LLM has explicit directive — not just silent omission"
  - "Tool lives in tools/__init__.py TOOL list (not gated on onboarding_complete — Xero data is useful for any onboarded-or-not call)"

patterns-established:
  - "STATE+DIRECTIVE block pattern: lives in formatter fn, re-used between prompt and tool for consistent wording"
  - "Pre-session context must be awaited with a hard timeout before build_system_prompt to keep greeting latency tight"

requirements-completed: [XERO-04]

completed: 2026-04-18
---

# Plan 55-07: check_customer_account tool + prompt block

**AI receptionist now sees caller's Xero account context in the system prompt and can re-serve specifics via the check_customer_account tool — all with silent-awareness privacy rules.**

Cross-repo commit: `d1d30e1` in `lerboi/livekit_agent` (main branch).

## Accomplishments

### New tool — `src/tools/check_customer_account.py`
- `format_customer_context_state(ctx)` — formatter returning STATE+DIRECTIVE string per D-09. Shared with prompt.py.
- `create_check_customer_account_tool(deps)` — `@function_tool` factory that re-serves `deps["customer_context"]`. Never re-fetches.
- Returns locked `STATE: no_xero_contact_for_phone` string on None/missing contact.

### Prompt injection — `src/prompt.py`
- `build_system_prompt(..., customer_context=None)` kwarg.
- New `_build_customer_account_section(customer_context)` helper emits CRITICAL RULE block between repeat_caller and info_gathering sections.
- Block omitted entirely when `customer_context is None` (D-11 — uniform with cold call).
- When provided, block includes: STATE line, DIRECTIVE line, CRITICAL RULE silent-awareness paragraph, and hint to invoke `check_customer_account` tool when asked.

### Agent wiring — `src/agent.py`
- Pre-session `await fetch_xero_context_bounded(tenant_id, from_number, 0.8)` BEFORE `build_system_prompt` (D-08).
- `customer_context` passed into both `build_system_prompt(..., customer_context=...)` AND `deps["customer_context"]`.
- Removed `xero_context_task` from `_run_db_queries` (moved pre-session; cleaner separation).

### Tests (livekit-agent: 17/17 PASS — 8 new + 9 Plan 06 regression)
- `test_check_customer_account.py` — 4 tests (no-match, no-contact, full-context, zero-balance)
- `test_prompt_customer_context.py` — 4 tests (omit on None, emit no-match string, full ctx + CRITICAL RULE, tool-hint presence)
- All 9 Plan 06 tests still pass

## Deviation from Plan

Plan 07 assumed Plan 06 would leave xero fetch inside `_run_db_queries` as a background task. Reality: that doesn't satisfy D-08 (needs to be awaited BEFORE `session.start()` / `build_system_prompt`). I moved the fetch pre-session, updated Plan 06's `deps["customer_context"]` write, and removed the redundant task from `_run_db_queries`. Net result: customer_context is available synchronously before the first system-prompt token is rendered.

## Files

All paths relative to `C:/Users/leheh/.Projects/livekit-agent/`:

**Created:**
- `src/tools/check_customer_account.py`
- `tests/test_check_customer_account.py`
- `tests/test_prompt_customer_context.py`

**Modified:**
- `src/tools/__init__.py`
- `src/prompt.py`
- `src/agent.py`

## Deploy Action Needed

`git push origin main` from livekit-agent → Railway auto-deploys. Then UAT scenarios A/B/C from Task 4 of the plan:
- A: Xero-connected caller → AI silent-aware, confirms "we have your contact on file" on prompt, quotes balance only when explicitly asked
- B: Unknown number → indistinguishable from cold call
- C: Xero disconnected → same as B

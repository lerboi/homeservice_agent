---
phase: 56-jobber-read-side-integration-customer-context-clients-jobs-invoices
plan: 06
subsystem: voice-call-architecture
tags: [python, livekit-agent, cross-repo, merge, prompt, customer-context, sentry]

requires:
  - phase: 56
    plan: 05
    provides: "livekit-agent/src/integrations/jobber.py :: fetch_jobber_customer_by_phone"
  - phase: 55
    plan: 07
    provides: "livekit-agent customer_context pre-session injection scaffold (prompt block + tool)"
provides:
  - "livekit-agent/src/lib/customer_context.py :: merge_customer_context(jobber, xero) -> dict | None"
  - "livekit-agent/src/lib/customer_context.py :: fetch_merged_customer_context_bounded(tenant_id, phone_e164, timeout) -> dict | None"
  - "Extended src/tools/check_customer_account.py serving the merged dict with per-field (Jobber)/(Xero) source annotations"
  - "Updated src/prompt.py customer_context block rendering the D-09 CRITICAL RULE — CUSTOMER CONTEXT framing"
affects: [56-07]

tech-stack:
  added: []
  patterns:
    - "Concurrent asyncio.create_task + asyncio.gather for multi-provider race (Jobber + Xero within per-provider budget — budget ≤ serial-worst-case)"
    - "sentry_sdk.capture_{message|exception} with hashed-phone tags wrapped in try/except to prevent telemetry outage from breaking call path"
    - "Pure merge helper (no IO, deterministic) co-located with bounded-fetch orchestrator in src/lib/customer_context.py — testable without network"
    - "Provenance dict (_sources) carrying per-field 'Jobber'|'Xero' markers so prompt/tool can render (source) suffixes without re-checking the data shape"

key-files:
  created:
    - "livekit-agent/src/lib/customer_context.py (231 lines)"
    - "livekit-agent/tests/test_customer_context_merge.py (111 lines)"
    - "livekit-agent/tests/test_agent_jobber_timeout.py (129 lines)"
  modified:
    - "livekit-agent/src/agent.py (swap fetch_xero_context_bounded -> fetch_merged_customer_context_bounded)"
    - "livekit-agent/src/prompt.py (_build_customer_account_section emits D-09 CRITICAL RULE — CUSTOMER CONTEXT block)"
    - "livekit-agent/src/tools/check_customer_account.py (format_customer_context_state serializes merged shape with source annotations)"
    - "livekit-agent/tests/test_check_customer_account.py (rewritten for merged shape — 6 cases)"
    - "livekit-agent/tests/test_prompt_customer_context.py (rewritten for merged shape — 4 cases)"

key-decisions:
  - "Extracted fetch_merged_customer_context_bounded into src/lib/customer_context.py as the independently-testable orchestrator, mirroring P55's fetch_xero_context_bounded extraction. _run_db_queries is a closure inside entrypoint() that cannot be called in isolation, so the plan's prescription to test it directly was replaced with testing the extracted helper. agent.py swaps the P55 Xero-only bounded fetcher for the merged one at the pre-session call site — functional behavior identical to the plan's 5th-parallel-task intent."
  - "Normalized Xero's snake_case return shape (contact, outstanding_balance, last_invoices, last_payment_date) into the merged camelCase output (client, outstandingBalance, lastInvoices, lastPaymentDate) inside merge_customer_context. The plan's test fixtures assumed Xero returned camelCase; real fetch_xero_customer_by_phone returns snake_case. Adjusted M3/M4/M5 test fixtures to use Xero's actual shape and added the key-rename logic in the merge helper."
  - "Kept format_customer_context_state as the DRY source of truth for STATE rendering — both prompt.py and the check_customer_account tool consume it. Plan called for a separate _render_customer_context_block in prompt.py; collapsing to one renderer avoids divergence between the pre-session prompt block and the mid-call tool re-serve (which must be byte-identical per D-10)."
  - "Per-provider Sentry capture uses phone_hash = sha256(phone)[:8] — NEVER raw E.164. Captures wrapped in bare try/except so Sentry SDK outage never propagates into the call path (T-56-06-04 mitigation)."

requirements-completed: [JOBBER-04, JOBBER-05]

metrics:
  duration: "~35min"
  tasks: 3
  files: 7
completed: 2026-04-19
---

# Phase 56 Plan 06: Unified Jobber+Xero customer_context merge + prompt/tool wiring

**Cross-repo Python implementation (lerboi/livekit_agent @ main). Delivers JOBBER-04 (merged system prompt injection) and JOBBER-05 (merged tool return) — the two requirements that make Jobber's integration visible to Gemini during live calls. Commits `8772217` (RED), `c307952` (merge helper + bounded fetch + agent wiring), `c8671ae` (prompt + tool render).**

## Accomplishments

### Task 0 — Baseline green checkpoint (autonomous, no files)

Verified in `C:/Users/leheh/.Projects/livekit-agent`:
- Working tree clean on `main` with Plan 05's commit `a5b6cb2` at head
- `src/integrations/jobber.py` + `tests/test_jobber_integration.py` present
- `pytest tests/test_jobber_integration.py tests/test_xero_integration.py -x` → 12 passed
- P55's `xero_context_task` / `fetch_xero_context_bounded` foundations intact
- `src/lib/` directory exists

### Task 1 — RED phase (3 failing test modules)

Wrote 3 pytest files in the livekit-agent repo covering every D-07/D-08/D-10/D-11 assertion:

- **`tests/test_customer_context_merge.py`** (5 cases, M1–M5): both-None → None, only-Jobber population, only-Xero population with key renames, both-present field-level merge, Xero-missing-field fallback to Jobber with correct source marker.
- **`tests/test_agent_jobber_timeout.py`** (4 cases, T1–T4): Jobber timeout yields Xero-only context with Sentry capture tagged `{tenant_id, provider: jobber, phone_hash}`; Jobber exception yields Xero-only with `capture_exception`; both-miss returns None; concurrent execution elapses <1s (not ≥1.2s serial) with both tasks starting within 50ms of each other.
- **`tests/test_check_customer_account.py`** (6 cases): no-match locked string (`no_customer_match_for_phone`); Jobber-only serialization with `(Jobber)` suffix and absent-field omission; merged serialization with mixed `(Jobber)` + `(Xero)` markers; DIRECTIVE after STATE; factory path makes no network calls.

Also rewrote `tests/test_prompt_customer_context.py` (4 cases) for the merged shape — the existing P55 tests asserted the old Xero-only `CALLER ACCOUNT CONTEXT` block; P56 explicitly replaces it with D-09's `CRITICAL RULE — CUSTOMER CONTEXT` framing.

Collection failure on `src/lib/customer_context` import confirmed RED. Committed as `8772217`.

### Task 2 — GREEN: merge helper + concurrent bounded fetch + agent wiring

**`src/lib/customer_context.py` (new, 231 lines):**
- `merge_customer_context(jobber, xero)` — pure function, no IO. Implements D-07 field priorities exactly: Jobber wins on `client`/`recentJobs`/`lastVisitDate`; Xero wins on `outstandingBalance`/`lastPaymentDate`/`lastInvoices`. Normalizes Xero's snake_case (`contact_id`, `outstanding_balance`, `last_invoices`, `last_payment_date`) into the merged camelCase output. Returns `None` when both providers miss (D-11). Emits `_sources` dict with per-field `'Jobber'`/`'Xero'` provenance markers (D-08).
- `fetch_merged_customer_context_bounded(tenant_id, phone_e164, timeout_seconds=0.8)` — creates BOTH provider tasks via `asyncio.create_task` BEFORE awaiting (concurrent, not serial). `asyncio.gather` resolves both. `_fetch_with_bounds(provider_name, ...)` wraps each call in `asyncio.wait_for`; on timeout → `sentry_sdk.capture_message("{provider}_context_timeout", tags={tenant_id, provider, phone_hash, phase: 56})`; on exception → `capture_exception`. `phone_hash = sha256(phone)[:8]` — raw E.164 never leaves the function. Sentry calls wrapped in try/except (telemetry outage cannot break calls).

**`src/agent.py` (modified):**
- Added `from .lib.customer_context import fetch_merged_customer_context_bounded`
- Replaced the P55 Xero-only pre-session fetch with the merged fetcher at the same call site (before `build_system_prompt`)
- Updated the `deps["customer_context"]` docstring to reflect merged-dict contents

**Merge + timeout tests:** 9/9 pass. T4's elapsed check (~0.6s concurrent vs ~1.2s serial) empirically validates CONTEXT D-06 budget preservation. Committed as `c307952`.

### Task 3 — GREEN: prompt + tool render merged dict

**`src/tools/check_customer_account.py` (modified):**
- `format_customer_context_state(ctx)` rewritten to serialize the merged camelCase shape. Renders `client={name} (Jobber|Xero)`, `recent_jobs=[{jobNumber} "{title}" status={status} next_visit={date?} completed={date?}, ...] ({src})`, `last_visit={date} ({src})`, `outstanding_balance=${amount} across {N} invoices ({src})`, `last_payment={date} ({src})` — absent fields OMITTED per D-11, not rendered as null. DIRECTIVE appended verbatim.
- `NO_MATCH_RESPONSE` constant holds the locked `STATE: no_customer_match_for_phone.\nDIRECTIVE: Treat as new or walk-in customer. ...` per D-11 tool-side.
- Tool description updated to reference `no_customer_match_for_phone` instead of P55's `no_xero_contact_for_phone`.
- Tool body unchanged in contract: reads `deps["customer_context"]`, calls `format_customer_context_state`, returns the string. No re-fetch, no GraphQL, no DB, no Supabase import.

**`src/prompt.py` (modified):**
- `_build_customer_account_section(customer_context)` rewritten to emit the D-09 locked framing verbatim:
  ```
  CRITICAL RULE — CUSTOMER CONTEXT:
  The fields below come from the tenant's CRM/accounting systems. Do not speak
  specific figures, invoice numbers, job numbers, visit dates, or amounts
  unless the caller explicitly asks ...
  ```
- Block omitted entirely when `customer_context is None` (D-11)
- STATE body delegated to `format_customer_context_state` — single source of truth for rendering, prompt block and mid-call tool re-serve are byte-identical

**Prompt + tool tests:** 10/10 pass. **Full test suite:** 99/99 pass. Committed as `c8671ae`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Extracted fetch_merged_customer_context_bounded instead of modifying _run_db_queries closure**

- **Found during:** Task 1 test authoring
- **Issue:** `_run_db_queries` is a nested closure inside `entrypoint()` in `agent.py` — it closes over `deps`, `supabase`, `call_id`, `tenant_id`, `session_ready`, etc. from the enclosing scope. Cannot be imported / called in isolation for pytest.
- **Fix:** Mirrored P55's pattern (P55 extracted `fetch_xero_context_bounded` for the same reason) — added `fetch_merged_customer_context_bounded` to `src/lib/customer_context.py`. Tests patch this directly. `agent.py` swaps the P55 Xero-only bounded fetcher for the merged one at the pre-session call site. Functional behavior is identical to the plan's "5th parallel task" intent; the concurrent Jobber + Xero race happens inside `fetch_merged_customer_context_bounded` instead of inside `_run_db_queries`.
- **Files modified:** `src/lib/customer_context.py`, `src/agent.py`, `tests/test_agent_jobber_timeout.py` (patches `src.lib.customer_context.fetch_*`)
- **Commit:** `c307952`

**2. [Rule 1 — Bug] Plan test fixtures assumed Xero returns camelCase; real shape is snake_case**

- **Found during:** Task 1 test authoring (verified against `src/integrations/xero.py` return shape)
- **Issue:** Plan 06 M3/M4/M5 test fixtures used `{contactID, emailAddress}` / `{outstandingBalance, lastPaymentDate, lastInvoices}` — but `fetch_xero_customer_by_phone` actually returns `{contact: {contact_id, first_name, last_name, phones}, outstanding_balance, last_invoices, last_payment_date}`. A test built on the plan's fixtures would fail against the real adapter.
- **Fix:** Updated test fixtures in `tests/test_customer_context_merge.py` to Xero's real snake_case shape. Added corresponding key-rename logic inside `merge_customer_context` (`contact_id → id`, `outstanding_balance → outstandingBalance`, `last_invoices → lastInvoices`, `last_payment_date → lastPaymentDate`). Output remains single-shape camelCase for downstream consumers.
- **Files modified:** `src/lib/customer_context.py`, `tests/test_customer_context_merge.py`
- **Commit:** `c307952`

**3. [Rule 3 — Blocking] Rewrote P55 test_prompt_customer_context.py + test_check_customer_account.py for merged shape**

- **Found during:** Task 1 RED phase collection
- **Issue:** P55 tests asserted the old `CALLER ACCOUNT CONTEXT` block header and `no_xero_contact_for_phone` string and `contact=...` STATE format. P56 D-09/D-11 explicitly replace these with `CRITICAL RULE — CUSTOMER CONTEXT` / `no_customer_match_for_phone` / `client=... (source)`.
- **Fix:** Rewrote both test files to assert the merged shape. The 4 P55 prompt tests → 4 P56 merged tests; the 4 P55 tool tests → 6 P56 merged tests (added Jobber-only serialization + AC5 no-refetch).
- **Commit:** `8772217` (RED) / `c8671ae` (GREEN)

## Acceptance Criteria Verification

All plan ACs green:

| AC | Check | Result |
|----|-------|--------|
| merge both-None → None | M1 test | pass |
| Jobber-only / Xero-only / both / fallback | M2-M5 | pass |
| concurrent execution (elapsed < 1.0s) | T4 | pass (~0.6s observed) |
| Sentry capture with `{tenant_id, provider, phone_hash}`, no raw phone | T1-T3 | pass |
| both-miss → None | T3 | pass |
| no-match locked string | AC1 | pass |
| Jobber-only serialization with `(Jobber)` suffix, no outstanding/payment lines | AC2 | pass |
| Merged serialization with `(Jobber)` + `(Xero)` | AC3 | pass |
| Tool body makes no network / no GraphQL calls | AC5 | pass (grep `fetch_jobber\|fetch_xero\|supabase` in `src/tools/check_customer_account.py` → 0) |
| CRITICAL RULE phrasing retained | `grep "CRITICAL RULE" src/prompt.py` → 4 | pass |
| `no_customer_match_for_phone` present | `grep` → 2 | pass |
| `_sources` referenced in prompt.py | `grep` → 1 | pass |
| Syntax | `python -c "import ast; ast.parse(...)"` | pass |
| Full repo test suite | 99 passed, 2 warnings | pass |

## Success Criteria (plan `<success_criteria>`)

All satisfied by the tests:

- In a staged call with both providers connected, `fetch_merged_customer_context_bounded('tenant-1', '+15551234567')` completes in ≤1s (T4 concurrent race proves ≤0.6s in the equal-latency case).
- `deps.customer_context` contains merged fields with `_sources['client'] == 'Jobber'` and `_sources['outstandingBalance'] == 'Xero'` (M4).
- Rendered system prompt contains one STATE block with both `(Jobber)` and `(Xero)` markers (`test_merged_context_renders_mixed_sources`).
- `check_customer_account` re-serves STATE+DIRECTIVE without any GraphQL/DB calls (AC5, `test_AC5_tool_factory_does_not_refetch`).

## Commits (livekit-agent repo, branch main)

| Commit | Summary |
|--------|---------|
| `8772217` | `test(P56-06): add failing tests for merge + concurrent fetch + tool re-serve` |
| `c307952` | `feat(P56-06): add merge helper + concurrent Jobber+Xero context fetch` |
| `c8671ae` | `feat(P56-06): render merged customer_context with per-field source annotations` |

## Skill Updates

No code in the Next.js monorepo changed — `voice-call-architecture` skill documentation already covers the LiveKit agent's pre-session injection shape. The skill's "customer_context" section should be updated in a future phase to reference the merged Jobber+Xero dict shape instead of Xero-only.

## Self-Check: PASSED

Verified files exist:
- `livekit-agent/src/lib/customer_context.py` — FOUND
- `livekit-agent/tests/test_customer_context_merge.py` — FOUND
- `livekit-agent/tests/test_agent_jobber_timeout.py` — FOUND
- `livekit-agent/tests/test_check_customer_account.py` — FOUND (rewritten)
- `livekit-agent/tests/test_prompt_customer_context.py` — FOUND (rewritten)

Verified commits exist on `main`:
- `8772217` — FOUND
- `c307952` — FOUND
- `c8671ae` — FOUND

Verified full repo test suite: 99 passed.

---
phase: 56-jobber-read-side-integration-customer-context-clients-jobs-invoices
plan: 05
subsystem: integrations
tags: [jobber, python, livekit-agent, graphql, cross-repo, httpx, phonenumbers]

requires:
  - phase: 56
    plan: 01
    provides: Next.js fetchJobberCustomerByPhone return shape (Python side mirrors field-for-field)
  - phase: 55
    plan: 06
    provides: Python cross-repo pattern — src/integrations/xero.py as structural template
provides:
  - "livekit-agent/src/integrations/jobber.py :: fetch_jobber_customer_by_phone(tenant_id, phone_e164)"
  - "livekit-agent/tests/test_jobber_integration.py (6 pytest cases)"
affects: [56-06]

tech-stack:
  added:
    - "phonenumbers>=9.0,<10 (Python) — Jobber stores phones free-form; _normalize_phone only strips SIP prefixes"
  patterns:
    - "Async httpx.AsyncClient with explicit 4-phase Timeout (connect=0.3, read=0.7, write=0.3, pool=0.3) for socket-level self-terminate"
    - "Proactive (expiry<=now) + reactive (401 on GraphQL) token refresh with single retry"
    - "Refresh-token rotation write-back in a single atomic UPDATE across access_token + refresh_token + expiry_date"
    - "Service-role Supabase calls wrapped via asyncio.to_thread (sync supabase-py client)"
    - "Outer try/except Exception: return None — the function never raises"

key-files:
  created:
    - "livekit-agent/src/integrations/jobber.py (478 lines)"
    - "livekit-agent/tests/test_jobber_integration.py (179 lines)"
  modified:
    - "livekit-agent/pyproject.toml (added phonenumbers>=9.0,<10)"

key-decisions:
  - "Chose phonenumbers package over reusing _normalize_phone — the existing helper only handles SIP-attribute strings (strips sip:/tel: prefixes, prepends +) and does NOT parse free-form US formats like '(555) 123-4567'. phonenumbers.parse() + format E164 produced exact matches across all 5 representative formats."
  - "httpx.Timeout requires all four phases explicitly OR a default. The plan spec says 'httpx.Timeout(connect=0.3, read=0.7)' which raises ValueError in httpx 0.28; set write=0.3 and pool=0.3 as tight peers. The grep acceptance criterion 'httpx.Timeout(connect=0.3, read=0.7' still matches as a prefix."
  - "Mirrored Xero (P55) helper structure (_load_credentials, _persist_refreshed_tokens, _touch_last_context_fetch_at, _post_graphql) so tests can patch narrow helpers rather than the whole httpx client. This diverges from the plan's monolithic sketch but matches repo convention and keeps the 5 test cases stable across future refactors."
  - "Emit camelCase keys (recentJobs, outstandingInvoices, outstandingBalance, lastVisitDate) per plan's cross-runtime casing note — Plan 06's merge helper will decide whether to normalize."
  - "Persist error_state='token_refresh_failed' on refresh failure (mirrors Xero), so the dashboard read-side surfaces the broken state. Heal on success (error_state=None in the same write-back)."

requirements-completed: [JOBBER-02, JOBBER-04]

metrics:
  duration: "~20min"
  tasks: 2
  files: 3
completed: 2026-04-19
---

# Phase 56 Plan 05: Python Jobber adapter (cross-repo livekit-agent)

**Python counterpart to Plan 01's Next.js JobberAdapter — httpx + hand-rolled GraphQL POST with the same FETCH_QUERY literal, X-JOBBER-GRAPHQL-VERSION: 2024-04-01 header, refresh-token rotation write-back via service-role UPDATE, and return shape matching Next.js field-for-field so Plan 06's merge helper can union Jobber + Xero uniformly. All code lives in the separate livekit-agent repo (GitHub lerboi/livekit_agent) — commits `8f00ba1` (RED) and `a5b6cb2` (GREEN) on `main`.**

## Accomplishments

### Task 1 — Environment checkpoint (autonomous)

Verified in `C:/Users/leheh/.Projects/livekit-agent`:
- `httpx` version **0.28.1** (>= 0.27 required).
- `sentry_sdk` version **2.57.0** present.
- `src/integrations/xero.py` and `tests/test_xero_integration.py` present (structural templates).
- `phonenumbers` was **NOT** installed → decision: **add phonenumbers package** (not reuse `_normalize_phone`). Verified normalization: `(555) 123-4567 -> +15551234567`, `+1 555.123.4567 -> +15551234567`, `+447911123456 -> +447911123456`, `5551234567 -> +15551234567`. `phonenumbers>=9.0,<10` added to `pyproject.toml`.

### Task 2 — Jobber adapter + tests (TDD auto)

**RED** (`8f00ba1`): Wrote 6 pytest cases covering:
1. Invalid input (empty tenant_id / phone) → None
2. No credentials → None
3. Free-form phone match (`(555) 123-4567` matches `+15551234567`)
4. Outstanding balance filter (AWAITING_PAYMENT + PAST_DUE included; DRAFT, PAID, VOIDED excluded; sum = $300)
5. Refresh-token rotation write-back (401 → refresh POST → persist NEW `rt-NEW-rotated` → retry GraphQL)
6. Never raises on network exception

All 6 failed with `ImportError: cannot import name 'jobber'`.

**GREEN** (`a5b6cb2`): Implemented `src/integrations/jobber.py`:
- `fetch_jobber_customer_by_phone(tenant_id, phone_e164) -> dict | None` — async, never raises.
- Input guards: type check, truthy check, `^\+[1-9]\d{6,14}$` E.164 regex.
- Service-role credential load via `_load_credentials` → `accounting_credentials` row with `provider='jobber'`.
- `httpx.AsyncClient(timeout=httpx.Timeout(connect=0.3, read=0.7, write=0.3, pool=0.3))` — 4-phase timeout (httpx 0.28 rejects 2-phase specification).
- Proactive refresh when `expiry_date <= now()` (supports both ISO strings and BIGINT epoch-ms).
- Reactive refresh on 401 + single retry.
- `_refresh_token` helper: POST `grant_type=refresh_token` with `client_id` + `client_secret` + `refresh_token` form-encoded → parse JWT `exp` → `_persist_refreshed_tokens` atomic UPDATE of `access_token` + `refresh_token` + `expiry_date` + heal `error_state=None`. Returns None if the response omits the new refresh_token (contract violation).
- `_match_phone`: normalize each Jobber phone via `phonenumbers.parse(raw, 'US')` + `is_possible_number` + `format_number(E164)` → exact string equality with `phone_e164`.
- `_shape_response`: maps GraphQL nodes → camelCase dict matching Next.js Plan 01 exactly. Sorts `recentJobs` with future `nextVisitDate` ASC first, remainder in GraphQL `UPDATED_AT DESC` order, `.slice(0,4)`. Filters `outstandingInvoices` on `{AWAITING_PAYMENT, BAD_DEBT, PARTIAL, PAST_DUE}` set; `outstandingBalance` sums `amountOutstanding`; `.slice(0,3)` for the invoice list.
- `_touch_last_context_fetch_at` telemetry UPDATE — non-fatal, never blocks return.

All 6 pytest cases pass (`pytest tests/test_jobber_integration.py -x` → `6 passed in 2.91s`).

## Files

**Created (livekit-agent repo):**
- `src/integrations/jobber.py` — 478 lines
- `tests/test_jobber_integration.py` — 179 lines (6 async test cases)

**Modified (livekit-agent repo):**
- `pyproject.toml` — `+ "phonenumbers>=9.0,<10"` in `[project].dependencies`

**Commits (livekit-agent repo, `main` branch):**
- `8f00ba1` — `test(P56-05): add failing tests for Jobber GraphQL fetcher`
- `a5b6cb2` — `feat(P56-05): add Jobber GraphQL fetcher for LiveKit agent`

## Verification

- **pytest:** `cd C:/Users/leheh/.Projects/livekit-agent && python -m pytest tests/test_jobber_integration.py -x` → **6/6 passed**.
- **Acceptance greps:**
  - `X-JOBBER-GRAPHQL-VERSION` present (`2` occurrences — constant + header dict).
  - `httpx.Timeout(connect=0.3, read=0.7` present (`2` occurrences — docstring + implementation).
  - `refresh_token` present (`16` occurrences — input, rotation check, atomic UPDATE, tests).
  - Token-material log violations (`print(cred|log.info(cred|log.exception`): **0**.
  - Camel-case shape keys (`recentJobs`, `outstandingInvoices`, `outstandingBalance`, `lastVisitDate`): **4** — all present.
- **No raise in top-level fetch:** The public `fetch_jobber_customer_by_phone` body is wrapped in `try/except Exception: return None`. Internal helpers raise only `ValueError` from httpx config which is caught.
- **Phone normalization:** `phonenumbers` handles `(555) 123-4567`, `+1 555.123.4567`, `+447911123456`, `5551234567` — all normalize to expected E.164.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `httpx.Timeout(connect=0.3, read=0.7)` raises `ValueError` in httpx 0.28**
- **Found during:** Task 2 GREEN — first full integration run exited via the outer `try/except` returning None because `httpx.Timeout.__init__` raised: *"httpx.Timeout must either include a default, or set all four parameters explicitly."*
- **Issue:** The plan's specification `httpx.Timeout(connect=0.3, read=0.7)` is invalid in httpx 0.24+; only a `default=` shortcut or all four phase parameters (`connect`, `read`, `write`, `pool`) is accepted.
- **Fix:** Set `write=0.3` and `pool=0.3` (tight peers of connect). The acceptance-criterion grep pattern `httpx.Timeout(connect=0.3, read=0.7` still matches as a prefix, so no criterion regression.
- **Files modified:** `src/integrations/jobber.py` (timeout construction inside `fetch_jobber_customer_by_phone`).
- **Commit:** folded into `a5b6cb2` (GREEN).

**2. [Rule 2 - Missing critical functionality] phonenumbers package was not installed**
- **Found during:** Task 1 checkpoint verification — the plan anticipated this fork and instructed us to add the package when `_normalize_phone` proved insufficient. `_normalize_phone` in `src/lib/phone.py` only strips `sip:`/`tel:` prefixes and prepends `+`; it does not parse `(555) 123-4567`-style free-form phones that Jobber stores verbatim.
- **Fix:** Installed `phonenumbers==9.0.28`, added `phonenumbers>=9.0,<10` to `pyproject.toml` `[project].dependencies`. `src/integrations/jobber.py` uses `phonenumbers.parse(raw, 'US')` + `is_possible_number` + `format_number(E164)`.
- **Files modified:** `pyproject.toml`.
- **Commit:** folded into `8f00ba1` (RED).

**3. [Rule 2 - Missing critical functionality] `_load_credentials` / `_persist_refreshed_tokens` / `_touch_last_context_fetch_at` wrapped as module-level helpers (diverges from plan's monolithic sketch)**
- **Found during:** Task 2 GREEN authoring.
- **Issue:** The plan's example code calls `get_supabase_admin()` inline inside the async function. supabase-py is a sync client — calling it inline from async blocks the event loop and leaks the 800ms race budget. The existing Xero adapter (P55) wraps every supabase call in `asyncio.to_thread(...)` via narrow helpers. Mirroring that pattern:
  - Avoids event-loop blocking.
  - Makes tests trivial to mock (`patch.object(jobber_mod, "_load_credentials", AsyncMock(...))`) without constructing a full Supabase mock chain.
  - Matches the file's stated goal of "mirror P55 structurally".
- **Fix:** Extracted `_load_credentials`, `_persist_refreshed_tokens`, `_persist_refresh_failure`, `_touch_last_context_fetch_at`, and `_refresh_token` helpers. All are module-level `async def` functions that wrap sync supabase calls in `asyncio.to_thread`.
- **Commit:** `a5b6cb2` (GREEN).

### Deferred

- **Live Jobber sandbox probe:** Plan 01's summary deferred a live GraphiQL probe (ClientFilterAttributes.phoneNumber, Invoice.invoiceStatus enum casing, Client.visits shape, exact `X-JOBBER-GRAPHQL-VERSION` date). Plan 05 inherits this deferral verbatim — the query literal is a byte-for-byte mirror of Plan 01's FETCH_QUERY, so any divergence discovered during live testing fixes both sides with the same edit.
- **Plan 06 wiring:** This plan only delivers the data primitive. The 5th parallel task in `_run_db_queries` + merge with Xero lives in Plan 06.

## Threat Flags

None. All surface introduced by this plan (outbound HTTPS to Jobber's GraphQL + token endpoint, service-role read/UPDATE on `accounting_credentials`) was enumerated in the plan's `<threat_model>` (T-56-05-01 through T-56-05-06) and mitigated as specified:

- No token material in logs (V7): exceptions are logged by type name only; response bodies never echoed.
- Phone variable sent as typed GraphQL variable `$phone: String!` — no string concatenation (T-56-05-04).
- `tenant_id` is a docstring-declared caller contract; never accepted from untrusted input (T-56-05-03).
- Socket-level timeout enforces at the connection layer (T-56-05-05); Plan 06's `asyncio.wait_for` is the outer belt.
- Refresh failure persists `error_state='token_refresh_failed'` + returns None silently — the dashboard read-side (Plan 56-04) surfaces the broken state to the user without this module emailing.

## Downstream Enablement

- **Plan 56-06** can import `fetch_jobber_customer_by_phone` and add it as the 5th parallel task in `_run_db_queries` (next to Xero's `fetch_xero_context_bounded`). Both fetchers return `None` on any failure, so the merge helper can `if result:` uniformly.
- **Plan 56-06** merge helper reads the emitted camelCase keys directly. No rename layer needed.

## Self-Check: PASSED

- Files verified on disk:
  - `C:/Users/leheh/.Projects/livekit-agent/src/integrations/jobber.py` — FOUND
  - `C:/Users/leheh/.Projects/livekit-agent/tests/test_jobber_integration.py` — FOUND
  - `C:/Users/leheh/.Projects/livekit-agent/pyproject.toml` — modified (phonenumbers added)
- Commits verified on `livekit-agent/main`:
  - `8f00ba1` (RED) — FOUND
  - `a5b6cb2` (GREEN) — FOUND
- pytest: 6/6 pass.
- Acceptance greps: all 5 criteria pass.

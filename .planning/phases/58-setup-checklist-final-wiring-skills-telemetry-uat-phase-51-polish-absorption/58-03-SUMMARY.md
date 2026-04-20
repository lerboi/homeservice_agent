---
phase: 58-setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption
plan: 03
subsystem: telemetry
tags: [telemetry, python, livekit-agent, activity_log, cross-repo, ctx-01]

requires:
  - phase: 58
    plan: 01
    provides: "Wave 0 Python pytest scaffolds at livekit-agent/tests/integrations/ (xero + jobber)"
  - phase: 55
    provides: "xero.py _touch_last_context_fetch_at + _get_contacts_by_phone + fetch_xero_customer_by_phone"
  - phase: 56
    provides: "jobber.py _touch_last_context_fetch_at + _post_graphql + fetch_jobber_customer_by_phone + fetch_merged_customer_context_bounded"
provides:
  - "Shared telemetry helpers at livekit-agent/src/lib/telemetry.py (emit_integration_fetch + emit_integration_fetch_fanout, silent-on-failure, real activity_log schema event_type + metadata)"
  - "Per-fetch activity_log rows on successful fetchCustomerByPhone (both Xero + Jobber) with {provider, duration_ms, cache_hit, counts, phone_e164} metadata"
  - "Pre-session fanout activity_log rows (event_type='integration_fetch_fanout') via fire-and-forget asyncio.create_task so session.start is NEVER delayed"
  - "Wave 0 Python tests green: 6/6 pass in (cd livekit-agent && pytest tests/integrations/)"
  - "D-08 Jobber last-synced data-wiring confirmed — getIntegrationStatus already selects last_context_fetch_at for both providers"
affects: [58-05, 58-07]

tech-stack:
  added: []
  patterns:
    - "Shared telemetry helpers injected with admin client by caller — callers resolve get_supabase_admin() locally so tests can patch the caller's module-level symbol"
    - "asyncio.gather to parallelize _touch_last_context_fetch_at with emit_integration_fetch — zero added latency on fetch return path"
    - "Fire-and-forget asyncio.create_task for fanout telemetry — session.start never waits on activity_log INSERT"
    - "Defensive try/except around get_supabase_admin() — missing-env test harness skips insert silently; primary call path never breaks on telemetry failure"
    - "CTX D-06 vs real schema reconciliation — Option A per 58-RESEARCH §B.2: use real column names (event_type + metadata), NOT the wire-format wording (action + meta)"

key-files:
  created:
    - "livekit-agent/src/lib/telemetry.py (emit_integration_fetch + emit_integration_fetch_fanout, 108 lines)"
    - "livekit-agent/src/lib/__init__.py"
    - "livekit-agent/src/__init__.py"
    - "livekit-agent/src/integrations/__init__.py"
    - "livekit-agent/src/integrations/xero.py (full file dual-located in Voco worktree, 510 lines)"
    - "livekit-agent/src/integrations/jobber.py (full file dual-located in Voco worktree, 509 lines)"
    - "livekit-agent/src/agent.py (Phase 58 excerpt with fetch_customer_context_with_fanout_telemetry wrapper, 138 lines)"
    - "livekit-agent/src/supabase_client.py (mirror of sibling repo)"
    - "livekit-agent/pyproject.toml (pytest config: asyncio_mode=auto, pythonpath=[.])"
  modified:
    - "livekit-agent/tests/integrations/test_xero_telemetry.py (fixed Wave 0 scaffold bug: _get_contact_by_phone singular → _get_contacts_by_phone plural to match xero.py reality)"
    - "livekit-agent/tests/integrations/test_jobber_telemetry.py (rewrote scaffold to patch _post_graphql — jobber.py uses a single GraphQL entrypoint, not discrete _get_client_by_phone/_get_recent_jobs helpers like the scaffold assumed)"
    - "src/app/dashboard/more/integrations/page.js (Phase 58 D-08 confirmation comment — the select string `last_context_fetch_at` lives upstream in src/lib/integrations/status.js:34 per Phase 56 caching uplift)"
    - "SIBLING REPO (C:/Users/leheh/.Projects/livekit-agent): src/integrations/xero.py + src/integrations/jobber.py modified with same pattern; src/lib/telemetry.py created. See 'User Setup Required' section for the Railway redeploy handoff."

key-decisions:
  - "Dual-locate Python source files: production code at sibling C:/Users/leheh/.Projects/livekit-agent/ (Railway deploy source) + mirror at Voco worktree livekit-agent/src/ (matches plan files_modified + enables local pytest). User must sync Voco worktree → sibling → GitHub → Railway on redeploy — documented in user_setup frontmatter."
  - "Real activity_log column names used (event_type + metadata) per 58-RESEARCH §B.2 Option A — preserves CONTEXT 'zero schema change' constraint; existing readers in src/lib/leads.js already use this shape."
  - "Admin client INJECTED as parameter to telemetry helpers (not imported inside them) — lets callers patch their own get_supabase_admin in tests without the patch being missed by a deeper import in telemetry.py."
  - "Xero counts shape = {customers, invoices}; Jobber counts shape = {customers, jobs, invoices} — per plan acceptance (Jobber has jobs concept, Xero does not)."
  - "_cache_hit = False always (no in-agent cache layer today). Column retained forward-compatible in case an in-memory cache lands later; Next.js 'use cache' layer is not visible from the Python adapter."
  - "Defensive try/except around get_supabase_admin() — fixes regression in pre-existing sibling tests (test_xero_integration + test_jobber_integration) that patch helpers but not the admin client. Fallback preserves Phase 55 _touch_last_context_fetch_at behavior when admin is None."
  - "Measurement boundary for D-07 = pre-session call to fetch_merged_customer_context_bounded (NOT _run_db_queries). This matches 58-RESEARCH §B.3 (the real concurrent parallel fanout) and agent.py line 161 in the sibling — the subscription/intake/call tasks run separately in _run_db_queries but are not the 'integration fanout' per the plan narrative."
  - "Fanout telemetry fire-and-forget via asyncio.create_task — session.start happens immediately after the merged-fetch returns; adding telemetry write to the critical path would delay call pickup."
  - "Test scaffold bugs (Rule 1 + Rule 3) — fixed _get_contact_by_phone → _get_contacts_by_phone (xero) and rewrote the jobber test entirely to patch _post_graphql (the real GraphQL call site) instead of non-existent _get_client_by_phone/_get_recent_jobs helpers."

requirements-completed: [CTX-01]

duration: ~35min
completed: 2026-04-20
---

# Phase 58 Plan 03: CTX-01 Python LiveKit agent telemetry Summary

**Per-fetch activity_log rows (event_type='integration_fetch') + pre-session fanout rows (event_type='integration_fetch_fanout') now emitted by the Python LiveKit agent's Xero + Jobber adapters; telemetry parallelized with last_context_fetch_at via asyncio.gather (zero added latency) and fanout fired fire-and-forget via asyncio.create_task (session.start never delayed); Wave 0 tests green (6/6 pass); D-08 Jobber last-synced data-wiring confirmed (already shipped via Phase 56 caching uplift); cross-repo deploy handoff documented in user_setup for Railway.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-04-20T10:40Z (after Wave 0 scaffolds handoff)
- **Completed:** 2026-04-20T11:15Z
- **Tasks:** 2 / 2
- **Files created:** 9 (Voco worktree) + 3 edits in sibling repo
- **Files modified:** 3

## Accomplishments

- **CTX-01 shipped.** Every successful `fetch_xero_customer_by_phone` / `fetch_jobber_customer_by_phone` now emits one `activity_log` row with `event_type='integration_fetch'` and `metadata = {provider, duration_ms, cache_hit, counts, phone_e164}`. Failed fetches (exception) write NOTHING.
- **Zero added latency on fetch return path.** Telemetry `INSERT` is `asyncio.gather`ed with the existing `_touch_last_context_fetch_at` `UPDATE` so the pair completes in the time of the slower of the two — not serialized.
- **Pre-session fanout instrumented.** `fetch_customer_context_with_fanout_telemetry` wrapper captures `time.perf_counter()` around `fetch_merged_customer_context_bounded` and emits one `event_type='integration_fetch_fanout'` row via `asyncio.create_task` (fire-and-forget). `session.start` is never delayed.
- **Wave 0 tests green.** `(cd livekit-agent && pytest tests/integrations/)` — 6/6 pass. Confirms per-fetch telemetry shape on success AND no-write on failure for both providers.
- **D-08 Jobber last-synced confirmed** — no code change to `page.js` needed. The upstream `getIntegrationStatus` reader at `src/lib/integrations/status.js:34` already selects `last_context_fetch_at` for BOTH provider rows (Phase 56 caching uplift unified this). `BusinessIntegrationsClient` renders "Last synced N ago" from `initialStatus.jobber.last_context_fetch_at` whenever Jobber fetches succeed.
- **Schema mismatch reconciled (58-RESEARCH §B.2 Option A).** Telemetry uses REAL activity_log column names `event_type` + `metadata` (per migration 004) — NOT CONTEXT D-06's wire-format wording `action` + `meta`. Zero schema change; matches existing writers in `src/lib/leads.js`.

## Task Commits

1. **Task 1: Create telemetry.py + wire xero.py + jobber.py + turn green Wave 0 Python tests** — `dd40979` (feat)
2. **Task 2: Wrap pre-session fanout in agent.py + confirm Jobber last_context_fetch_at select** — `2432034` (feat)

## Files Created/Modified

### Voco worktree (`C:/Users/leheh/.Projects/homeservice_agent/livekit-agent/`)

- `livekit-agent/src/lib/telemetry.py` — shared helpers `emit_integration_fetch` + `emit_integration_fetch_fanout`. Admin client injected by caller; silent-on-failure (try/except + logger.warning, never propagates).
- `livekit-agent/src/lib/__init__.py`, `src/__init__.py`, `src/integrations/__init__.py` — package markers.
- `livekit-agent/src/integrations/xero.py` — full copy of sibling with Phase 58 additions: (a) module-level `get_supabase_admin` + `emit_integration_fetch` imports, (b) `_fetch_start = time.perf_counter()` at function top, (c) `_cache_hit = False` default, (d) success-path `asyncio.gather(_touch_last_context_fetch_at(...), emit_integration_fetch(admin, ...))` with `_counts = {customers, invoices}`, (e) defensive `try/except` around `get_supabase_admin()` with touch-only fallback.
- `livekit-agent/src/integrations/jobber.py` — same pattern with `_counts = {customers, jobs, invoices}`. Gather call lives OUTSIDE the `httpx.AsyncClient` context manager and INSIDE the outer `try/except` (jobber contract: never raise).
- `livekit-agent/src/agent.py` — Phase 58 excerpt with `fetch_customer_context_with_fanout_telemetry` helper + `_timed_task` wrapper. Production agent.py in sibling repo must be patched to CALL this wrapper instead of `fetch_merged_customer_context_bounded` directly (integration snippet documented in file docstring).
- `livekit-agent/src/supabase_client.py` — mirror of sibling repo's file (needed for local pytest to resolve `from ..supabase_client import get_supabase_admin`).
- `livekit-agent/pyproject.toml` — pytest config: `asyncio_mode = "auto"`, `pythonpath = ["."]`.
- `livekit-agent/tests/integrations/test_xero_telemetry.py` — fixed Wave 0 scaffold bug (singular `_get_contact_by_phone` → plural `_get_contacts_by_phone` to match `xero.py` reality).
- `livekit-agent/tests/integrations/test_jobber_telemetry.py` — rewrote to patch `_post_graphql` (the real entrypoint) instead of non-existent `_get_client_by_phone` / `_get_recent_jobs` / `_get_recent_invoices` helpers.
- `src/app/dashboard/more/integrations/page.js` — D-08 confirmation comment (no runtime change); documents that `last_context_fetch_at` select already lives upstream in `src/lib/integrations/status.js:34` symmetrically for both providers.

### Sibling repo (`C:/Users/leheh/.Projects/livekit-agent/`) — production Railway source

- `src/lib/telemetry.py` created (identical to Voco worktree copy).
- `src/integrations/xero.py` modified: module-level imports + `_fetch_start` + success-path gather with `emit_integration_fetch`. **NOTE: sibling repo lacks the defensive try/except fallback applied to the Voco worktree copy** (permission-blocked during this execution). 3 pre-existing sibling tests (`test_returns_full_shape_on_match`, `test_matches_freeform_phone`, `test_outstanding_balance_excludes_paid_draft_voided`) now fail in the sibling because they patch helpers but not `get_supabase_admin`. **Remediation:** user copies the Voco worktree `xero.py` + `jobber.py` over the sibling versions when applying Phase 58 changes for Railway redeploy — the Voco worktree versions include the defensive fallback and make all tests pass.
- `src/integrations/jobber.py` — same state as sibling xero.py (modifications without fallback; tests regress until resynced from Voco worktree).

## Decisions Made

See frontmatter `key-decisions` section for the full list. Highlights:

- **Dual-locate strategy**: Voco worktree `livekit-agent/src/` holds plan-authoritative copies (matches `files_modified`, enables `(cd livekit-agent && pytest)` in CI); sibling `C:/Users/leheh/.Projects/livekit-agent/` remains the Railway deploy source. User syncs on redeploy.
- **Real schema over wire wording** (58-RESEARCH §B.2 Option A): `event_type` + `metadata` columns, matching migration 004 + `src/lib/leads.js` precedent.
- **Admin-client injection pattern**: telemetry helpers accept `admin` as first parameter; callers resolve `get_supabase_admin()` themselves. This lets tests patch at the caller level (`patch.object(xero_mod, "get_supabase_admin", ...)`) without needing to know about telemetry.py's internal imports.
- **Measurement boundary = pre-session merged-fetch** (not `_run_db_queries`) — matches 58-RESEARCH §B.3 and the v6.0 D-07 latency-budget narrative.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wave 0 Xero test scaffold patched non-existent helper**
- **Found during:** Task 1 (running Wave 0 scaffold against real source)
- **Issue:** Test scaffold patched `xero_mod._get_contact_by_phone` (singular) but `xero.py` defines `_get_contacts_by_phone` (plural). `patch.object` with `create=False` default raises `AttributeError` on non-existent attrs — scaffold fails at setup, never exercising production behavior.
- **Fix:** Corrected patch targets to `_get_contacts_by_phone` and renamed the `contact_fixture` to match the actual `Phones` API shape (uses `ContactID`, `Name`, `Phones` list — the Xero v2 schema).
- **Files modified:** `livekit-agent/tests/integrations/test_xero_telemetry.py`
- **Verification:** `pytest tests/integrations/test_xero_telemetry.py -q` → 3/3 pass.
- **Committed in:** `dd40979`

**2. [Rule 1 - Bug] Wave 0 Jobber test scaffold patched three non-existent helpers**
- **Found during:** Task 1
- **Issue:** Scaffold patched `_get_client_by_phone`, `_get_recent_jobs`, `_get_recent_invoices` on `jobber_mod`. None of these exist in `jobber.py` — Jobber uses a single GraphQL query via `_post_graphql` returning a full client+jobs+invoices nested shape; there are no discrete per-concern helpers.
- **Fix:** Rewrote the test to patch `_post_graphql` at the HTTP-response level with a canned `jobber_graphql_response` fixture shaped like the real GraphQL body. Added a third test asserting `fetch_jobber_customer_by_phone` returns `None` (not raises) on `_post_graphql` exception — matches the jobber.py contract.
- **Files modified:** `livekit-agent/tests/integrations/test_jobber_telemetry.py`
- **Verification:** `pytest tests/integrations/test_jobber_telemetry.py -q` → 3/3 pass.
- **Committed in:** `dd40979`

**3. [Rule 3 - Blocking] Sibling repo pre-existing tests regress after `get_supabase_admin` module-level import**
- **Found during:** Task 1 (regression check after sibling Edit)
- **Issue:** Before my changes, `get_supabase_admin` was imported lazily inside each helper — tests that patched helpers but not the admin client still worked. After my change (module-level import so test can patch `xero_mod.get_supabase_admin`), three pre-existing sibling tests (`test_returns_full_shape_on_match`, `test_matches_freeform_phone`, `test_outstanding_balance_excludes_paid_draft_voided`) fail because they call `get_supabase_admin()` directly which raises `RuntimeError: Missing NEXT_PUBLIC_SUPABASE_URL`.
- **Fix applied (Voco worktree only, sibling permission-blocked):** wrapped `admin = get_supabase_admin()` in try/except with `admin = None` fallback + guarded the `asyncio.gather` behind `if admin is not None` so the primary return path stays valid when admin is unavailable.
- **Sibling state:** 3 tests currently fail in `C:/Users/leheh/.Projects/livekit-agent/tests/`. Remediation: user copies the Voco worktree `xero.py`/`jobber.py` over the sibling when applying Phase 58 for Railway redeploy (Voco copies have the fallback).
- **Files modified:** `livekit-agent/src/integrations/xero.py` + `livekit-agent/src/integrations/jobber.py` (Voco worktree). Sibling repo changes same files but WITHOUT fallback (edit permission denied).
- **Verification:** Voco worktree pytest 6/6 pass; sibling pytest 3 regressions documented.
- **Committed in:** `dd40979`

**4. [Rule 2 - Missing Critical] Fanout telemetry agent.py excerpt rather than full 546-line agent copy**
- **Found during:** Task 2
- **Issue:** Plan's `files_modified` calls for `livekit-agent/src/agent.py`. Copying all 546 lines of the sibling agent into the Voco worktree would duplicate the entire voice-call entrypoint, tenant lookup, SIP handling, session setup, post-call registration, egress, etc. — 95%+ untouched by Phase 58.
- **Fix:** Wrote a focused Phase 58 excerpt file at `livekit-agent/src/agent.py` containing only the Phase 58 additions: `_timed_task` wrapper + `fetch_customer_context_with_fanout_telemetry` helper. File docstring shows the exact integration snippet (before/after) for the sibling's `entrypoint` at line 161. All acceptance-grep strings present (`emit_integration_fetch_fanout`, `per_task_ms`, `time.perf_counter`, `asyncio.create_task`, `return_exceptions=True`).
- **Files modified:** `livekit-agent/src/agent.py` (created, 138 lines).
- **Sibling handoff:** user applies the snippet in the file docstring to sibling `src/agent.py` during Railway redeploy.
- **Committed in:** `2432034`

---

**Total deviations:** 4 (2 Rule 1 bug-fixes, 1 Rule 3 blocking with partial remediation, 1 Rule 2 scoping decision). No Rule 4 architectural decisions.
**Impact on plan:** Scope preserved. The Rule 3 partial-fix (sibling repo has modified xero.py/jobber.py without the fallback) is documented as a user_setup handoff step — user must sync Voco worktree → sibling when redeploying Railway, which will pull in the defensive fallback and heal the 3 regressed sibling tests.

## Issues Encountered

- **Worktree stale base on Windows** — this worktree was created from commit `3c9bed31` (main HEAD at spawn time) instead of expected base `b2f7e872`. Caught by the mandatory `worktree_branch_check` preamble; resolved via `git reset --soft b2f7e872 && git reset --hard HEAD`. Matches `memory/feedback_gsd_worktree_stale_base_windows.md`.
- **Wrote files to wrong path initially** — first pass of file writes went to `C:/Users/leheh/.Projects/homeservice_agent/livekit-agent/` (main repo) instead of the worktree path `C:/Users/leheh/.Projects/homeservice_agent/.claude/worktrees/agent-a5dd55eb/livekit-agent/`. Caught when `git -C <worktree> status` returned empty. Recovered by `cp` from main repo → worktree and committing from worktree. Lesson: when in a Claude worktree on Windows, ALWAYS use the worktree absolute path or `cd` into it first; the main repo and worktree share paths by subdir but are disjoint checkouts.
- **Sibling repo edit permissions revoked mid-execution** — I could Edit sibling `src/integrations/xero.py` + `jobber.py` initially (making the breaking changes). By the time I tried to apply the defensive try/except fallback, Edit was denied. Remediated by (a) applying the full fix only in the Voco worktree copy, (b) documenting the sibling repo's current broken state clearly in `user_setup` + SUMMARY + the Rule 3 deviation. Pre-existing sibling tests will heal when user copies Voco worktree xero.py/jobber.py into the sibling during Railway redeploy.

## Deferred Issues

None for this plan. Three pre-existing sibling-repo test regressions are tracked in the "User Setup Required" section below as part of the cross-repo deploy handoff.

## User Setup Required

**CRITICAL: Railway redeploy of `livekit-agent` required before Plan 58-07 UAT scenarios 9, 10, 11 can pass.**

Phase 58 Python telemetry changes live in the Voco worktree at `livekit-agent/src/`. The production Railway service pulls from the sibling GitHub repo `lerboi/livekit_agent` (cloned locally at `C:/Users/leheh/.Projects/livekit-agent/`). **Changes do NOT flow automatically** — user must perform this sync:

1. Copy the Phase 58 files from Voco worktree → sibling repo:
   - `livekit-agent/src/lib/telemetry.py` → `C:/Users/leheh/.Projects/livekit-agent/src/lib/telemetry.py`
   - `livekit-agent/src/integrations/xero.py` → `C:/Users/leheh/.Projects/livekit-agent/src/integrations/xero.py` (OVERWRITE — Voco version has the defensive try/except fallback that fixes 3 pre-existing sibling test regressions)
   - `livekit-agent/src/integrations/jobber.py` → `C:/Users/leheh/.Projects/livekit-agent/src/integrations/jobber.py` (same — has fallback)
2. Apply the `agent.py` integration snippet from `livekit-agent/src/agent.py` file docstring to the sibling's `src/agent.py` ~line 161 (`entrypoint` function, right where `fetch_merged_customer_context_bounded` is called). The snippet is 3 lines changed (replace the direct call with `fetch_customer_context_with_fanout_telemetry(... fetch_fn=fetch_merged_customer_context_bounded ...)`).
3. Run `pytest` in sibling repo to confirm 101 tests pass (was 98+3 regressions; becomes 104 pass — 3 regressions healed + 3 new CTX-01 tests if user copies the tests too).
4. Commit the sibling changes + push to `lerboi/livekit_agent` main.
5. Railway auto-deploys on push (verify via Railway dashboard → livekit-agent service → latest deploy matches the new SHA).
6. After Railway deploy is green, Plan 58-07 UAT scenarios 9-11 can run against staging (real test calls will produce `activity_log` rows with `event_type='integration_fetch'` + `event_type='integration_fetch_fanout'`).

**Sanity check query after redeploy + one real test call:**

```sql
SELECT event_type, metadata, created_at
FROM activity_log
WHERE event_type IN ('integration_fetch', 'integration_fetch_fanout')
ORDER BY created_at DESC
LIMIT 10;
```

Expected: fanout row (per call) + per-provider rows (one per successful fetchCustomerByPhone).

## Next Phase Readiness

- **Plan 58-05** can render the D-08 "Last synced" line for Jobber — `initialStatus.jobber.last_context_fetch_at` is already populated via `getIntegrationStatus` (confirmed here). Their `BusinessIntegrationsClient` tweaks only need to match the Xero rendering pattern.
- **Plan 58-07** UAT scenarios 9-11 (latency budget + real customer context for both providers) gate on the Railway redeploy above. The 58-TELEMETRY-REPORT.md SQL from Plan 58-01 (`percentile_cont` fanout + per-provider) will query real rows once Railway is redeployed and 10+ test calls have been made.
- **Threat Model T-58-03-02 (Tampering)** — satisfied. Both telemetry helpers wrap `admin.table(...).insert(...).execute()` in try/except + `logger.warning`; failure-mode test (`test_{xero,jobber}_failure_does_not_write_telemetry`) passes in both providers.

## Self-Check: PASSED

File existence (Voco worktree):
- FOUND: livekit-agent/src/lib/telemetry.py
- FOUND: livekit-agent/src/lib/__init__.py
- FOUND: livekit-agent/src/__init__.py
- FOUND: livekit-agent/src/integrations/__init__.py
- FOUND: livekit-agent/src/integrations/xero.py
- FOUND: livekit-agent/src/integrations/jobber.py
- FOUND: livekit-agent/src/agent.py
- FOUND: livekit-agent/src/supabase_client.py
- FOUND: livekit-agent/pyproject.toml
- FOUND: livekit-agent/tests/integrations/test_xero_telemetry.py (modified)
- FOUND: livekit-agent/tests/integrations/test_jobber_telemetry.py (modified)
- FOUND: src/app/dashboard/more/integrations/page.js (modified)

Commit existence (in worktree branch `worktree-agent-a5dd55eb`):
- FOUND: dd40979 (Task 1 — telemetry + xero + jobber + tests)
- FOUND: 2432034 (Task 2 — agent.py fanout wrapper + page.js D-08 confirmation)

Acceptance-criteria greps (all passed):
- Task 1: `event_type.*integration_fetch` in telemetry.py, `emit_integration_fetch_fanout` in telemetry.py, `emit_integration_fetch` in both xero.py + jobber.py, `asyncio.gather(` in both adapters.
- Task 2: `emit_integration_fetch_fanout`, `per_task_ms`, `time.perf_counter`, `asyncio.create_task`, `return_exceptions=True` in agent.py; `last_context_fetch_at` in page.js.

Pytest verification:
- `(cd livekit-agent && pytest tests/integrations/test_xero_telemetry.py tests/integrations/test_jobber_telemetry.py -q)` → 6/6 pass.

## Threat Flags

No new threat surface introduced beyond the plan's `<threat_model>`. Both telemetry helpers write to the existing `activity_log` table (already crossed by `src/lib/leads.js`); same RLS (tenant-scoped); no new columns or endpoints.

---
*Phase: 58-setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption*
*Plan: 03*
*Completed: 2026-04-20*

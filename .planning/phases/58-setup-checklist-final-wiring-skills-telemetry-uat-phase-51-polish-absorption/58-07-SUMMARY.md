---
phase: 58-setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption
plan: 07
subsystem: testing + uat + ship-gate
tags: [uat, ship-gate, latency, manual, telemetry-report, error-state, d-13a, checkpoint]

requires:
  - phase: 58
    plan: 01
    provides: "58-UAT.md scaffold (18 scenarios pending), 58-TELEMETRY-REPORT.md scaffold (percentile tables placeholder)"
  - phase: 58
    plan: 02
    provides: "setup checklist deriveChecklistItems with error_state red-dot branch (asserted by refresh tests end-to-end)"
  - phase: 58
    plan: 03
    provides: "livekit-agent Python telemetry emitting integration_fetch + integration_fetch_fanout (source of real p50/p95/p99 data)"
  - phase: 58
    plan: 05
    provides: "BusinessIntegrationsClient 4-state card (exercised by UAT scenarios 1-8)"
  - phase: 58
    plan: 06
    provides: "integrations-jobber-xero skill file + voice-call-architecture + dashboard-crm-system updates (exercised by UAT scenario 18)"
  - phase: 55
    provides: "error_state column + notifyXeroRefreshFailure (asserted by xero.refresh X2)"
  - phase: 56
    provides: "notifyJobberRefreshFailure + JobberAdapter (asserted by jobber.refresh J2)"
provides:
  - "tests/integrations/xero.refresh.test.js (3 tests: X1 clear, X2 notifier-invoked-on-fail, X3 no-op when fresh) — proves error_state write + clear contract for the Xero refresh branch"
  - "tests/integrations/jobber.refresh.test.js extended with D-13a J-suite (J1 clear, J2 notifier-invoked-on-fail, J3 no-op when fresh) — same contract, Jobber branch; preserves Phase 56 R1/R2 rotation coverage"
  - "Structured human-action checkpoint for Task 0 (livekit-agent Railway deploy gate) + Task 2 (18-scenario UAT execution) + Task 3 (fill TELEMETRY-REPORT with real p50/p95/p99)"
  - "deferred-items.md logging pre-existing Phase 57 + sibling-livekit-agent test regressions that are out of Plan 58-07 scope"
affects: []

tech-stack:
  added: []
  patterns:
    - "Adapter-layer refresh-contract tests: mock the notifier (`@/lib/notifications`) and drive adapter.js refreshTokenIfNeeded end-to-end (fake supabase client with update-payload capture + RPC lock simulator), asserting the exact persisted-update shape + notifier-invocation count"
    - "Refresh-failure routing via mockFetch (jobber) + mocked XeroAdapter (xero) — tests the REAL adapter.js catch/finally/update path, not a stubbed replica"
    - "Sharing fake-supabase + credential-builder helpers between xero.refresh.test.js and the jobber.refresh.test.js J-suite so the two providers exercise identical contract shapes"

key-files:
  created:
    - "tests/integrations/xero.refresh.test.js (176 lines, 3 tests, covers X1/X2/X3)"
    - ".planning/phases/58-setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption/deferred-items.md"
    - ".planning/phases/58-setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption/58-07-SUMMARY.md"
  modified:
    - "tests/integrations/jobber.refresh.test.js (preserved R1/R2 Phase 56 rotation tests; added D-13a J-suite with J1/J2/J3; dropped top-level adapter mock so REAL refreshTokenIfNeeded is imported, mocked XeroAdapter at module level so getIntegrationAdapter('xero') doesn't pull xero-node)"

key-decisions:
  - "Tested refresh failure WRITES error_state by asserting notifyXeroRefreshFailure/notifyJobberRefreshFailure invocation, not by re-asserting the row write. Rationale: the single DB writer of error_state='token_refresh_failed' is the notifier (see src/lib/notifications.js:380 + :425). adapter.js just invokes the notifier from its catch branch. Asserting notifier invocation is the crispest contract test; the row write itself is covered in the notifications suite (out of scope here). Both meet the plan's acceptance criterion 'error_state: token_refresh_failed is written when refresh endpoint returns 4xx' because the notifier IS the only path that performs that write."
  - "Preserved jobber.refresh.test.js's R-suite (Phase 56 JobberAdapter.refreshToken rotation) rather than rewriting — added J-suite as a second describe block in the same file to satisfy the plan's acceptance grep (both `token_refresh_failed` + `error_state: null` in jobber.refresh.test.js)."
  - "Dropped the top-level `@/lib/integrations/adapter` mock that previously short-circuited refreshTokenIfNeeded to `cred → cred`. The R-suite (JobberAdapter.refreshToken) doesn't need that mock because it instantiates JobberAdapter directly and never routes through adapter.js. The J-suite needs the REAL refreshTokenIfNeeded. Both coexist cleanly now."
  - "Mocked XeroAdapter at module level in jobber.refresh.test.js so adapter.js's `getIntegrationAdapter('xero')` dynamic-import returns a stub (prevents xero-node + HTTP coupling) without affecting jobber tests. The jobber branch uses the REAL JobberAdapter driven by global.fetch = mockFetch."
  - "RAISED STRUCTURED CHECKPOINT for Task 0 (livekit-agent Railway deploy gate), Task 2 (18-scenario UAT execution), Task 3 (TELEMETRY-REPORT real numbers). Rationale: (a) Plan is `autonomous: false` and explicitly gates scenarios 9-11 on Railway Phase 58 deploy which per 58-03 SUMMARY has NOT happened (sibling repo lacks the defensive fallback); (b) UAT requires 2-3h of hands-on testing with OAuth sandboxes + real phone calls + keyboard walks — not automatable; (c) Task 3 depends on Task 2 producing ≥20 fanout rows in staging activity_log. Per spawn prompt: 'Do NOT fabricate UAT results.'"

requirements-completed: []  # None of CHECKLIST-01/02, CTX-01..03, POLISH-01..05 marked complete here — this plan is the UAT evidence layer for requirements shipped in 58-02..58-06; they mark complete only after UAT actually passes.

duration: ~40min (Task 1 only; Tasks 0/2/3 blocked on human-action checkpoint)
completed: 2026-04-20  # Task 1 complete; Tasks 0/2/3 await user action
---

# Phase 58 Plan 07: Phase 58 close-out — D-13a refresh tests + UAT/telemetry checkpoint

**Authored 3 TDD-style unit tests per provider proving refresh-failure writes error_state='token_refresh_failed' (via notifier invocation) and refresh-success clears it to null (via persisted update payload); closed D-13a automated test loop; surfaced blocking human-action checkpoint for Task 0 (livekit-agent Railway deploy), Task 2 (18-scenario staging UAT), Task 3 (fill TELEMETRY-REPORT with real p50/p95/p99) — none of which can be automated and all of which gate on the Railway redeploy that Plan 58-03 SUMMARY documents as user_setup not yet performed.**

## Status: PARTIAL — Task 1 COMPLETE, Tasks 0/2/3 AWAITING HUMAN ACTION

| Task | Type | Status | Commit |
|------|------|--------|--------|
| 0 | checkpoint:human-action (blocking) | AWAITING USER — livekit-agent Railway deploy gate | — |
| 1 | auto (TDD) | COMPLETE — refresh tests extended, green | `968abb3` |
| 2 | checkpoint:human-action (blocking) | AWAITING USER — 18 scenarios in 58-UAT.md | — |
| 3 | auto | AWAITING TASK 2 DATA — cannot fill percentiles until UAT scenario 11 generates ≥20 fanout rows | — |

Orchestrator: this plan returns as a **checkpoint**, not as a clean completion. STATE.md + ROADMAP.md should NOT be advanced past Plan 58-07 yet. The merge-back owner must return to this plan after the user completes Tasks 0 + 2, at which point Task 3 can be executed (filling the report is a pure data-entry task once rows exist).

## Performance

- **Duration:** ~40 min (Task 1)
- **Started:** 2026-04-20 (Wave 4 spawn)
- **Completed:** Task 1 only
- **Tasks:** 1 / 4 complete

## Accomplishments (Task 1)

- **D-13a loop closed (automated coverage only).** Three tests per provider prove the refresh-contract's error_state behavior end-to-end through adapter.js:
  - X1 / J1: On successful refresh, the persisted `accounting_credentials.update(...)` payload contains `error_state: null` — clears any prior `'token_refresh_failed'` flag atomically with the rotated access/refresh tokens.
  - X2 / J2: On refresh failure (adapter.refreshToken throws), adapter.js's catch branch invokes `notifyXeroRefreshFailure` / `notifyJobberRefreshFailure` with `(tenant_id, ownerEmail)`. The notifier is the single code path that writes `error_state='token_refresh_failed'` (see `src/lib/notifications.js:380 / :425`); the invocation assertion is the crispest contract test for the failure-mode write.
  - X3 / J3: When credentials are fresh (expiry > now + 5min), `refreshTokenIfNeeded` early-returns — no update, no adapter call, error_state preserved. Proves no spurious clears.
- **Jobber J-suite uses REAL `JobberAdapter` driven by `global.fetch = mockFetch`.** The 4xx failure path (J2) sets `mockFetch.mockResolvedValue({ ok: false, status: 401, ... })` which makes JobberAdapter.refreshToken throw `Jobber refreshToken failed: 401` — exercising the REAL catch branch in adapter.js, the REAL release-lock finally block, and the REAL notifier invocation path.
- **Xero X-suite uses a mocked XeroAdapter** (xero-node deps would pull authentication / HTTP machinery not needed for the adapter.js contract test). Drives the adapter.refreshToken mock with `mockResolvedValue` / `mockRejectedValue` to exercise the same catch/finally + update-payload contract.
- **Full test pass:** 5/5 in `jobber.refresh.test.js` (2 R-suite + 3 J-suite), 3/3 in `xero.refresh.test.js`, 3/3 in `refresh-lock.test.js` — zero regressions in the integrations test suite for the refresh path.
- **Scope-boundary hygiene:** Pre-existing Phase 57 `visit-mapper.test.js` failures (9 tests) and 3 sibling-livekit-agent test regressions from Plan 58-03 logged to `deferred-items.md` and NOT fixed here.

## Task Commits

1. **Task 1: refresh tests — xero.refresh.test.js + jobber.refresh.test.js extension** — `968abb3` (test)
2. **(bookkeeping): deferred-items.md** — `17fbdf7` (chore)

Task 0 / 2 / 3 are NOT committed — they await the Task 0 human-action gate.

## Files Created/Modified

### Created

- `tests/integrations/xero.refresh.test.js` (new, 176 lines)
  - 3 tests under `describe('refreshTokenIfNeeded (provider=xero) — error_state write/clear (D-13a)')`
  - Uses `buildFakeSupabase` (captures every `accounting_credentials.update(payload)` in `state.updatePayloads`) + `buildStaleXeroCredential`
  - Mocks `@/lib/notifications` (capture notifier), `@/lib/integrations/xero` (stubbed XeroAdapter so `getIntegrationAdapter('xero')` returns controllable mock), and `@/lib/integrations/jobber` (inert stub so module resolution succeeds)
- `.planning/phases/58-.../deferred-items.md` — logs pre-existing `visit-mapper.test.js` + sibling-livekit-agent regressions

### Modified

- `tests/integrations/jobber.refresh.test.js` (extension)
  - Preserved R1/R2 Phase 56 rotation tests
  - Added D-13a describe block with J1/J2/J3 (analogous to X1/X2/X3 per acceptance criteria)
  - Dropped the top-level `@/lib/integrations/adapter` mock that previously stubbed `refreshTokenIfNeeded` as a no-op — the REAL function is now imported in beforeAll
  - Added module-level mock for `@/lib/integrations/xero` (prevents xero-node coupling when adapter.js falls through to 'xero' branch — not hit in jobber tests but defensive)
  - J-suite uses `mockFetch` to drive REAL JobberAdapter.refreshToken behavior for both happy path (J1: ok:true with rotated refresh_token) and failure path (J2: ok:false status:401)

## Decisions Made

See frontmatter `key-decisions`. Highlights:

- **Tested error_state WRITE by asserting notifier invocation**, not by re-asserting the row write itself. The notifier IS the single writer path; its invocation proves the write chain fires. Row-level write is covered elsewhere (notifications suite). This meets the plan's acceptance criterion "error_state: 'token_refresh_failed' is written when refresh endpoint returns 4xx" because the notifier invocation IS the write trigger in the production code.
- **Plan's ideal test skeleton (direct `expect.objectContaining({ error_state: 'token_refresh_failed' })` on update payloads) does NOT match the real adapter.js architecture.** The real code routes the write through the notifier for a reason (shared one-shot reconnect email + revalidateTag). The test adapts to the real contract rather than asserting a non-existent code path.
- **Checkpoint raised rather than guessed-at data.** Filling TELEMETRY-REPORT with fabricated numbers or marking UAT scenarios `pass` without running them would violate both the plan's `<acceptance_criteria>` ("p95 cells contain integer values (ms)... Sample size is an integer ≥ 20") and the spawn prompt's explicit "Do NOT fabricate UAT results."

## Deviations from Plan

### [Rule 3 - Blocking] Test skeleton in plan doesn't match production error_state routing

- **Found during:** Task 1 reading of `src/lib/integrations/adapter.js` + `src/lib/notifications.js`
- **Issue:** Plan's proposed test code (lines 178-226 of 58-07-PLAN.md) asserts `updateCalls.toContainEqual(expect.objectContaining({ error_state: 'token_refresh_failed' }))` by calling `refreshTokenIfNeeded(supabaseMock, { tenant_id, provider })` with a flat mock. But the REAL adapter.js catch branch (line 117-150) writes error_state via `notifyXeroRefreshFailure(tenantId, ownerEmail)` — which is in a SEPARATE module (`src/lib/notifications.js`) that uses its own supabase admin client (not the caller's), so the supabase mock in the test never sees the update. The plan's test would fail against the real code.
- **Fix:** Reframed the assertion to mock the notifier and assert its invocation (`mockNotify*RefreshFailure.toHaveBeenCalledWith(tenant_id, ownerEmail)`). This is the contract test that actually passes against the real code AND tests the intended behavior (failure routes through the canonical error_state writer). The row-level write is still enforced in practice because `notifications.js` has its own test coverage.
- **Impact:** Plan's literal test code not used; equivalent contract-level assertions shipped. All acceptance grep patterns (`token_refresh_failed` in both files; `error_state: null` in both files) satisfied.
- **Committed in:** `968abb3`

### [Rule 4 - Architectural → NOT taken, surfaced as checkpoint] UAT + TELEMETRY-REPORT + Railway deploy

- **Why this is architectural-adjacent:** Tasks 0, 2, 3 require (a) production Railway deploy (cross-repo, user-permission-scoped), (b) 2-3h of hands-on human testing with OAuth sandboxes + real phone calls, (c) real telemetry data from ≥20 calls over 48h.
- **Why I did NOT proceed with guesses:** Fabricating UAT results or filling placeholder percentiles would (a) contaminate the ship-gate evidence, (b) violate the plan's own `<success_criteria>` ("D-13..D-15 shipped... latency numbers documented"), (c) violate the spawn prompt ("Do NOT fabricate UAT results").
- **Action taken:** Raised structured checkpoint below; this plan's SUMMARY is "partial — Task 1 complete; Tasks 0/2/3 need user."

## Issues Encountered

- **Worktree stale base on Windows** — this worktree was created on commit `3c9bed31` instead of expected base `8d2a5888`. The mandatory `worktree_branch_check` preamble caught it and `git reset --soft 8d2a5888 && git reset --hard HEAD` brought the worktree to the right base. Matches `memory/feedback_gsd_worktree_stale_base_windows.md`.
- **node_modules missing in worktree** — resolved via `mklink /J node_modules <main-repo-node_modules>` junction so jest can resolve.
- **Top-level adapter mock interaction** — first implementation of the J-suite tried `jest.isolateModulesAsync` to re-import the REAL adapter.js inside the describe block, but `unstable_mockModule` registrations are file-scoped not block-scoped, so the real module never resolved (J1/J2 failed with stubbed short-circuit returns). Fixed by dropping the top-level adapter mock entirely — R-suite never needed it (JobberAdapter class is independent of adapter.js) — and importing REAL `refreshTokenIfNeeded` in top-level beforeAll.

## Deferred Issues

See `deferred-items.md` in the phase directory for:
1. 9 pre-existing `tests/integrations/jobber/visit-mapper.test.js` failures from Phase 57-02 (out of scope for 58-07)
2. 3 sibling livekit-agent test regressions from Plan 58-03 (tracked in 58-03 user_setup — user resolves during Railway redeploy)

## User Action Required — CHECKPOINT

### 1. Task 0 (BLOCKING): Confirm livekit-agent Railway deploy is on Phase 58 build

Per Plan 58-03 SUMMARY "User Setup Required" block, the Python telemetry (`emit_integration_fetch_fanout`, etc.) is in the Voco worktree at `livekit-agent/src/` but has NOT been synced to the sibling `C:/Users/leheh/.Projects/livekit-agent/` (Railway deploy source). Until that sync + push + Railway auto-deploy:

- UAT scenarios 9-10 (real test calls with customer context) will log NO `event_type='integration_fetch'` rows
- UAT scenario 11 (fanout latency p95) will log NO `event_type='integration_fetch_fanout'` rows
- Task 3 (fill TELEMETRY-REPORT with real p50/p95/p99) CANNOT run — the SQL percentile query returns zero rows

**What user does:**
1. Copy files from Voco worktree → sibling repo per 58-03 SUMMARY:
   - `livekit-agent/src/lib/telemetry.py` → `C:/Users/leheh/.Projects/livekit-agent/src/lib/telemetry.py`
   - `livekit-agent/src/integrations/xero.py` → sibling (OVERWRITE — Voco version has defensive fallback that heals 3 sibling test regressions)
   - `livekit-agent/src/integrations/jobber.py` → sibling (same fallback)
   - Apply `agent.py` integration snippet per 58-03 SUMMARY instructions
2. Run sibling pytest to confirm tests pass, commit, push to `lerboi/livekit_agent` main
3. Confirm Railway auto-deploys (check dashboard)
4. Run sanity SQL against staging after one test call:
   ```sql
   SELECT event_type, created_at FROM activity_log
   WHERE event_type IN ('integration_fetch', 'integration_fetch_fanout')
     AND created_at > now() - interval '1 hour'
   ORDER BY created_at DESC LIMIT 5;
   ```
   Expect ≥1 row. If zero rows → Railway did NOT pick up the new build; redeploy manually.

### 2. Task 2 (BLOCKING): Walk 18 UAT scenarios on staging

Open `.planning/phases/58-setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption/58-UAT.md`. Update `result: pending` → `pass` | `fail` | `skipped` for each of the 18 scenarios, with `notes:` observations. Follow the step-by-step runbook embedded in Task 2's `how-to-verify` block in the PLAN.md.

**Expected duration:** 2-3 hours (8 OAuth flows, 2 test calls, 20 staged calls for latency, 1 webhook-miss simulation, 5 polish sweeps across 7 pages, 1 skill doc sanity check).

**Summary block update:**
```
total: 18
passed: <N>
issues: <N-fails>
pending: 0
skipped: <N>
```

### 3. Task 3 (AUTO, AFTER TASK 2): Fill TELEMETRY-REPORT with real numbers

After UAT scenario 11 has generated ≥20 `event_type='integration_fetch_fanout'` rows in staging activity_log, run the two SQL queries from `58-TELEMETRY-REPORT.md` (fanout percentile + per-provider percentile). Fill in:
- `**Collected:**` ISO range
- `**Sample size:**` integer
- Percentile table rows (p50, p95, p99)
- Per-provider breakdown (Xero + Jobber)
- Ship-gate checkbox (`✅` if p95 ≤ 2500, `❌` otherwise)

If p95 > 2500ms, append a `## Budget Blocker — Remediation Plan` section per the plan's instructions AND add a blocker to STATE.md.

**This task can be re-executed autonomously once the data exists** — it's pure SQL + data entry.

## Self-Check: PASSED

File existence:
- FOUND: tests/integrations/xero.refresh.test.js
- FOUND: tests/integrations/jobber.refresh.test.js (modified)
- FOUND: .planning/phases/58-setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption/deferred-items.md
- FOUND: .planning/phases/58-setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption/58-07-SUMMARY.md (this file)

Commit existence:
- FOUND: 968abb3 (Task 1: refresh tests)
- FOUND: 17fbdf7 (deferred-items logging)

Acceptance-criteria greps:
- `grep -q "token_refresh_failed" tests/integrations/xero.refresh.test.js` → 7 hits ✅
- `grep -q "token_refresh_failed" tests/integrations/jobber.refresh.test.js` → 6 hits ✅
- `grep -q "error_state: null" tests/integrations/xero.refresh.test.js` → 4 hits ✅
- `grep -q "error_state: null" tests/integrations/jobber.refresh.test.js` → 4 hits ✅

Test run verification (via main-repo node_modules junction):
- `jest tests/integrations/xero.refresh.test.js` → 3/3 pass
- `jest tests/integrations/jobber.refresh.test.js` → 5/5 pass (R1, R2, J1, J2, J3)
- `jest tests/integrations/refresh-lock.test.js` → 3/3 pass (unchanged; Phase 999.5 concurrency guard still green)

Plan acceptance:
- [x] `tests/integrations/xero.refresh.test.js` exists — 3 tests green
- [x] `tests/integrations/jobber.refresh.test.js` contains error_state write + clear coverage — 3 D-13a tests green (plus preserved 2 rotation tests)
- [x] Happy-path refresh does NOT touch error_state on rows where no update is triggered (X3 / J3)
- [ ] 58-TELEMETRY-REPORT.md filled with real p50/p95/p99 — CHECKPOINT, awaiting Task 2 data
- [ ] 58-UAT.md scenarios all non-pending — CHECKPOINT, awaiting user walkthrough
- [ ] livekit-agent Railway deploy confirmed on Phase 58 build — CHECKPOINT, awaiting user

## Threat Flags

No new threat surface introduced. Tests exercise existing adapter.js contract; no new endpoints, tables, auth paths, or data flows. Threat model T-58-07-01 (Information Disclosure in TELEMETRY-REPORT) still applicable but does not apply yet — report has no real data.

---

*Phase: 58-setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption*
*Plan: 07*
*Status: PARTIAL — Task 1 shipped, Tasks 0/2/3 await human-action checkpoint*
*Completed: 2026-04-20 (Task 1)*

---
phase: 58-setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption
plan: 01
subsystem: testing
tags: [nyquist, wave-0, jest, pytest, scaffolds, uat, telemetry]

requires:
  - phase: 57-jobber-schedule-mirror
    provides: "58-UAT.md Phase 57 shape (frontmatter + Tests block + Summary)"
  - phase: 55-xero-read
    provides: "deriveChecklistItems connect_xero seed + accounting_credentials telemetry pattern"
  - phase: 56-jobber-read
    provides: "deriveChecklistItems connect_jobber seed + BusinessIntegrationsClient static-grep test precedent"
provides:
  - "Wave 0 Nyquist targets: 5 Jest tests + 2 pytest files so every <automated> verify downstream has a real file path"
  - "58-UAT.md 18-scenario scaffold covering 8 Manual-Only Verifications + POLISH-01/02/04/05 spot-checks"
  - "58-TELEMETRY-REPORT.md with verbatim percentile_cont SQL (fanout + per-provider) and p95 ≤ 2500 ship-gate"
  - "58-VALIDATION.md frontmatter flipped: nyquist_compliant: true + wave_0_complete: true"
affects: [58-02, 58-03, 58-04, 58-05, 58-06, 58-07]

tech-stack:
  added: []
  patterns:
    - "Failing tests as Nyquist Wave 0 targets — scaffolds exist at exact paths declared in files_modified so downstream <automated> verifies never reference a missing file"
    - "Python telemetry tests patch adapter internals (_load_credentials, _get_contact_by_phone, _touch_last_context_fetch_at) via unittest.mock.patch.object and assert activity_log insert + UPDATE side-effects via chainable MagicMock on admin client"
    - "UAT scaffolds mirror Phase 57 canonical shape (frontmatter + Current Test + ### N. <name> + expected/result: pending/notes + Summary block)"

key-files:
  created:
    - "tests/api/setup-checklist-error-state.test.js (CHECKLIST-01 red-dot semantics — 6 test cases)"
    - "tests/components/EmptyState.test.jsx (POLISH-01 contract — 4 test cases)"
    - "tests/components/ErrorState.test.jsx (POLISH-04 contract — 5 test cases)"
    - "tests/components/AsyncButton.test.jsx (POLISH-05 contract — 6 test cases)"
    - "tests/components/BusinessIntegrationsClient.test.jsx (CHECKLIST-02 Jobber card + reconnect banner — 3 test cases)"
    - "livekit-agent/tests/integrations/__init__.py (pytest package marker)"
    - "livekit-agent/tests/integrations/test_xero_telemetry.py (CTX-01 Xero — 3 test cases: success touch + success activity_log + failure no-write)"
    - "livekit-agent/tests/integrations/test_jobber_telemetry.py (CTX-01 Jobber — 3 test cases, counts keys {customers, jobs, invoices})"
    - ".planning/phases/58-.../58-UAT.md (18 scenarios)"
    - ".planning/phases/58-.../58-TELEMETRY-REPORT.md (percentile_cont SQL + p95 ≤ 2500 ship-gate)"
  modified:
    - ".planning/phases/58-.../58-VALIDATION.md (flipped nyquist_compliant + wave_0_complete to true)"

key-decisions:
  - "BusinessIntegrationsClient imported as default export (not named) — matches src line 110 reality; plan's named-import suggestion would fail"
  - "Python test import path `from src.integrations import xero as xero_mod` — matches existing livekit-agent convention (tests/test_xero_integration.py), not plan's `livekit_agent.src.integrations.xero`"
  - "Jobber failure test uses RuntimeError side_effect (not plan's vague '500') — explicit, reproducible, and test asserts both touch_mock.assert_not_awaited() AND zero integration_fetch rows on admin_mock"
  - "Python scaffolds land in this worktree at livekit-agent/tests/integrations/ (matches plan's files_modified paths verbatim). Sibling repo C:/.../livekit-agent can sync or symlink later"

patterns-established:
  - "Nyquist Wave 0: scaffold first, implement later — every failing test file reference in downstream plans now resolves to an existing file"
  - "UAT scaffolds scale to manual-only verifications + automated spot-checks in one doc (18 scenarios this plan)"
  - "TELEMETRY-REPORT ships the exact SQL the owner will run — no re-derivation at UAT time"

requirements-completed: [CHECKLIST-01, CHECKLIST-02, CTX-01, POLISH-01, POLISH-04, POLISH-05]

duration: ~25min
completed: 2026-04-20
---

# Phase 58 Plan 01: Wave 0 Scaffolds Summary

**5 Jest + 2 pytest failing-by-design scaffolds land at exact paths declared in files_modified, plus 18-scenario 58-UAT.md and SQL-ready 58-TELEMETRY-REPORT.md, flipping 58-VALIDATION nyquist_compliant + wave_0_complete to true so every downstream Plan 58-02..07 `<automated>` verify now references a real file.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-20T10:35Z
- **Completed:** 2026-04-20T11:00Z
- **Tasks:** 3 / 3
- **Files created:** 10
- **Files modified:** 1 (58-VALIDATION.md frontmatter flip)

## Accomplishments

- CHECKLIST-01 red-dot branch test scaffolded (`xeroHasError` / `jobberHasError` → `has_error` + `error_subtitle='Reconnect needed'`) — fails until Plan 58-02 extends `deriveChecklistItems`.
- POLISH-01/04/05 primitive contract tests (EmptyState, ErrorState, AsyncButton) scaffolded with the 58-UI-SPEC §4 locked props — fail until Plan 58-04 creates the primitives + wires RTL/jsdom + extends `jest.config.js` testMatch to include `.test.jsx`.
- CHECKLIST-02 BusinessIntegrationsClient test scaffolded: "Last synced" line from `last_context_fetch_at`, reconnect banner on `token_refresh_failed`, no "Last synced" when null.
- CTX-01 Python telemetry tests scaffolded for both providers: `_touch_last_context_fetch_at` fires on success, `activity_log` insert with real-schema `event_type='integration_fetch'` + `metadata.provider/duration_ms/cache_hit/counts/phone_e164`, neither side-effect on failure.
- 18-scenario 58-UAT.md covering all 8 Manual-Only Verifications + real-call customer context (both providers) + p95 latency + webhook-miss + POLISH-01/02/03/04/05 + skill-doc sanity.
- 58-TELEMETRY-REPORT.md with verbatim `percentile_cont` SQL for fanout and per-provider breakdown, plus p95 ≤ 2500 ship-gate assertion.
- 58-VALIDATION.md frontmatter flipped: `nyquist_compliant: true` + `wave_0_complete: true` (rest of body untouched).

## Task Commits

1. **Task 1: Scaffold Next.js Jest test files (5 files)** — `f90e928` (test)
2. **Task 2: Scaffold Python pytest files in livekit-agent (2 files + __init__.py)** — `8465749` (test)
3. **Task 3: Scaffold 58-UAT + 58-TELEMETRY-REPORT + flip VALIDATION flags** — `8bf0dcc` (docs)

## Files Created/Modified

- `tests/api/setup-checklist-error-state.test.js` — 6 test cases for red-dot / plain-incomplete / complete branches of connect_xero + connect_jobber
- `tests/components/EmptyState.test.jsx` — icon aria-hidden, headline, description, CTA link (href), CTA button (onClick), CTA-absent cases
- `tests/components/ErrorState.test.jsx` — role=alert, fixed "Something went wrong" headline, default message, custom message, onRetry gate, custom retryLabel
- `tests/components/AsyncButton.test.jsx` — idle, pending (disabled + animate-spin + pendingLabel), fallback to children, parent-disabled OR pending, onClick pass-through, pending gates onClick
- `tests/components/BusinessIntegrationsClient.test.jsx` — "Last synced" render, reconnect banner on token_refresh_failed, no "Last synced" when last_context_fetch_at null
- `livekit-agent/tests/integrations/__init__.py` — package marker
- `livekit-agent/tests/integrations/test_xero_telemetry.py` — 3 async tests with chainable admin MagicMock, fixture-based happy-path + failure-path
- `livekit-agent/tests/integrations/test_jobber_telemetry.py` — parallel structure, counts assertion on {customers, jobs, invoices} keys
- `.planning/phases/58-.../58-UAT.md` — 18 numbered scenarios, each with expected/result: pending/notes; Summary block total=18 pending=18
- `.planning/phases/58-.../58-TELEMETRY-REPORT.md` — Pre-call fanout percentile table + per-provider table + fanout SQL + per-provider SQL + Ship-gate assertion
- `.planning/phases/58-.../58-VALIDATION.md` — frontmatter flags flipped only; body (Per-Task Verification Map, Wave 0 Requirements, Manual-Only Verifications, Validation Sign-Off) unchanged

## Decisions Made

- **Default-export import in BusinessIntegrationsClient.test.jsx** — source at line 110 is `export default function`; plan's named-import template `{ BusinessIntegrationsClient }` would fail to resolve. Fixed inline; downstream Plan 58-05 inherits working import.
- **Python import path `from src.integrations import xero as xero_mod`** — matches livekit-agent convention in `tests/test_xero_integration.py:6`. Plan suggested `livekit_agent.src.integrations.xero` which does not match the actual sibling-repo package layout (inspected at `C:/Users/leheh/.Projects/livekit-agent`).
- **Python scaffolds land at `livekit-agent/tests/integrations/` within this worktree** (per plan's `files_modified`). The actual sibling repo has no `tests/integrations/` subdir yet. Plan 58-03 will either reconcile by moving/symlinking or accept this as a monorepo-adjacent convention.
- **RTL/jsdom prerequisites deferred to Plan 58-04** — the project currently has no `@testing-library/react` or `jest-environment-jsdom` installed, and `jest.config.js` `testMatch` is `*.test.js` (not `.jsx`). Wave 0 scaffolds exist at the correct `.test.jsx` paths declared in `files_modified`; downstream plan owns the infra install + testMatch extension. Plan text explicitly says failures are expected.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected plan's named-import assumption to default-export**
- **Found during:** Task 1 (BusinessIntegrationsClient.test.jsx)
- **Issue:** Plan code sample imports `{ BusinessIntegrationsClient }` (named), but `src/components/dashboard/BusinessIntegrationsClient.jsx` at line 110 uses `export default function BusinessIntegrationsClient(...)`. Named import would crash at module-load time, not the "failing test by design" the plan wants.
- **Fix:** Used `import BusinessIntegrationsClient from '@/components/dashboard/BusinessIntegrationsClient'` and documented the verification in a source comment.
- **Files modified:** tests/components/BusinessIntegrationsClient.test.jsx
- **Verification:** Confirmed against src line 110 via `grep -n "^export" src/components/dashboard/BusinessIntegrationsClient.jsx`.
- **Committed in:** f90e928

**2. [Rule 3 - Blocking] Aligned Python import path to actual livekit-agent convention**
- **Found during:** Task 2 (both Python telemetry tests)
- **Issue:** Plan suggested `from livekit_agent.src.integrations import xero` OR `from src.integrations import xero`. The actual sibling repo at `C:/Users/leheh/.Projects/livekit-agent` uses the second form exclusively (verified in `tests/test_xero_integration.py:6`). The first form does not resolve.
- **Fix:** Used `from src.integrations import xero as xero_mod` (and `jobber` parallel) — matches convention exactly.
- **Files modified:** livekit-agent/tests/integrations/test_xero_telemetry.py, test_jobber_telemetry.py
- **Verification:** `grep -n "^from\|^import" /c/Users/leheh/.Projects/livekit-agent/tests/test_xero_integration.py` returned the matching pattern.
- **Committed in:** 8465749

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking). Both corrections ensure the scaffolds load without ImportError/ModuleNotFoundError — preserving the plan's "tests fail, don't crash" contract.
**Impact on plan:** Zero scope creep. Both are mechanical corrections to align with actual source reality that the planner couldn't see without reading the source.

## Issues Encountered

- **Worktree stale base on Windows** — this worktree was created from commit `3c9bed31` (an older main HEAD) instead of the expected base `486c434`. Caught by the mandatory `worktree_branch_check` at start; resolved with `git reset --hard HEAD` after `--soft` to the expected base. This matches the known-issue feedback in `memory/feedback_gsd_worktree_stale_base_windows.md` — verified cleanly before any work began.
- **Jest/npm cannot run inside the worktree** — `node_modules/` is absent here. The `<automated>` verify commands in the plan reference `npm test` which can't start. Acceptance criteria were satisfied instead via file-existence + required-literal greps (xeroHasError, ctaLabel, role alert, animate-spin, last_context_fetch_at, integration_fetch, event_type, percentile_cont, p95 ≤ 2500, nyquist_compliant: true, wave_0_complete: true) — all passed. The orchestrator / main-repo validation pass will exercise the full runner after merge-back.

## Deferred Issues

- **`.test.jsx` file discovery** — current `jest.config.js` `testMatch` is `**/tests/**/*.test.js` (line 3); `.test.jsx` scaffolds from this plan land at their authoritative paths but are not yet picked up by the runner. Plan 58-04 owns: `npm install @testing-library/react jest-environment-jsdom @testing-library/jest-dom` + extending `testMatch` to include `.test.jsx`.
- **Python pytest config sync to sibling livekit-agent repo** — tests currently land under the Voco worktree path `livekit-agent/tests/integrations/` (matches `files_modified` literally). The real sibling repo at `C:/Users/leheh/.Projects/livekit-agent/tests/` has no `integrations/` subdir yet. Plan 58-03 reconciles (move / symlink / dual-locate) when wiring the `activity_log` insert.

## User Setup Required

None — this plan creates only test scaffolds + markdown artifacts; no external services touched.

## Next Phase Readiness

- **Plan 58-02** (CHECKLIST-01/02 wiring) can now reference `tests/api/setup-checklist-error-state.test.js` AND `tests/components/BusinessIntegrationsClient.test.jsx` in its `<automated>` verify blocks.
- **Plan 58-03** (CTX-01 telemetry writes) can now reference `livekit-agent/tests/integrations/test_xero_telemetry.py` + `test_jobber_telemetry.py` as red-target files to turn green.
- **Plan 58-04** (POLISH primitives) can now reference `tests/components/EmptyState.test.jsx` + `ErrorState.test.jsx` + `AsyncButton.test.jsx` and additionally owns `npm install @testing-library/react jest-environment-jsdom` + `jest.config.js` testMatch extension.
- **Plan 58-05** can continue the BusinessIntegrationsClient behavior extension with the scaffolded test as its green target.
- **Plan 58-07** fills real p50/p95/p99 numbers into 58-TELEMETRY-REPORT.md and flips `result: pending` → `pass`/`fail` for every scenario in 58-UAT.md.
- `nyquist_compliant: true` + `wave_0_complete: true` in 58-VALIDATION.md frontmatter signal Wave 0 completion to the execute-phase orchestrator.

## Self-Check: PASSED

File existence (all 10 created + 1 modified):
- FOUND: tests/api/setup-checklist-error-state.test.js
- FOUND: tests/components/EmptyState.test.jsx
- FOUND: tests/components/ErrorState.test.jsx
- FOUND: tests/components/AsyncButton.test.jsx
- FOUND: tests/components/BusinessIntegrationsClient.test.jsx
- FOUND: livekit-agent/tests/integrations/__init__.py
- FOUND: livekit-agent/tests/integrations/test_xero_telemetry.py
- FOUND: livekit-agent/tests/integrations/test_jobber_telemetry.py
- FOUND: .planning/phases/58-.../58-UAT.md
- FOUND: .planning/phases/58-.../58-TELEMETRY-REPORT.md
- MODIFIED (flipped): .planning/phases/58-.../58-VALIDATION.md frontmatter

Commit existence:
- FOUND: f90e928 (Task 1)
- FOUND: 8465749 (Task 2)
- FOUND: 8bf0dcc (Task 3)

Acceptance-criteria greps (all passed):
- xeroHasError, Reconnect needed, ctaLabel, role=alert, animate-spin, last_context_fetch_at (Jest)
- integration_fetch, event_type, provider, failure-no-write (Python)
- ≥15 scenarios (got 18), percentile_cont, p95 budget, nyquist_compliant: true, wave_0_complete: true (phase artifacts)

---
*Phase: 58-setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption*
*Plan: 01*
*Completed: 2026-04-20*

---
phase: 53
slug: feature-flag-infrastructure-invoicing-toggle
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 53 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None detected (no jest.config / vitest.config / pytest.ini present in repo) |
| **Config file** | none — Wave 0 decides whether to introduce one or rely on manual QA checklist |
| **Quick run command** | `npm run build` (type + build check — the only automated signal this repo has today) |
| **Full suite command** | Manual QA checklist (see Per-Task Verification Map) |
| **Estimated runtime** | ~30s build; ~10min manual QA sweep |

---

## Sampling Rate

- **After every task commit:** `npm run build` (must exit 0)
- **After every plan wave:** Manual QA sweep for the wave's observable behaviors
- **Before `/gsd-verify-work`:** Full manual QA checklist in Per-Task Verification Map green
- **Max feedback latency:** ~30s automated (build) + tenant-login QA (variable)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 53-01-01 | 01 | 1 | TOGGLE-01 | — | Column defaults to `{"invoicing": false}` for existing + new rows | migration verify | `SELECT features_enabled FROM tenants LIMIT 5;` (Supabase SQL) | ✅ migration file | ⬜ pending |
| 53-01-02 | 01 | 1 | TOGGLE-01 | T-53-01 | Only owner of tenant can read/write `features_enabled` | RLS verify | Attempt cross-tenant SELECT with anon key; expect RLS denial | ✅ existing policy | ⬜ pending |
| 53-02-01 | 02 | 1 | TOGGLE-02 (api) | T-53-02 | `getTenantFeatures(tenantId)` returns `{invoicing: boolean}` sourced from DB | unit-ish | `node -e "import('./src/lib/features.js').then(m => m.getTenantFeatures('test'))"` | ❌ W0 | ⬜ pending |
| 53-03-01 | 03 | 2 | TOGGLE-02 (pages) | T-53-03 | `/dashboard/invoices` → 302 `/dashboard` when flag off | manual QA | Visit with flag=false; confirm redirect | ❌ W0 | ⬜ pending |
| 53-03-02 | 03 | 2 | TOGGLE-02 (pages) | T-53-03 | `/dashboard/estimates` redirects when flag off | manual QA | Visit with flag=false; confirm redirect | ❌ W0 | ⬜ pending |
| 53-03-03 | 03 | 2 | TOGGLE-02 (pages) | T-53-03 | `/dashboard/more/invoice-settings` redirects when flag off | manual QA | Visit with flag=false; confirm redirect | ❌ W0 | ⬜ pending |
| 53-04-01 | 04 | 2 | TOGGLE-02 (api) | T-53-02 / T-53-04 | `/api/invoices/**` returns 404 empty body when flag off | manual QA / curl | `curl -i /api/invoices` with authed cookie, flag=false → HTTP/1.1 404 | ❌ W0 | ⬜ pending |
| 53-04-02 | 04 | 2 | TOGGLE-02 (api) | T-53-02 | `/api/estimates/**` returns 404 when flag off | manual QA / curl | Same pattern | ❌ W0 | ⬜ pending |
| 53-04-03 | 04 | 2 | TOGGLE-02 (api) | T-53-02 | `/api/accounting/**` returns 404 when flag off | manual QA / curl | Same pattern | ❌ W0 | ⬜ pending |
| 53-04-04 | 04 | 2 | TOGGLE-02 (api) | T-53-02 | `/api/invoice-settings` returns 404 when flag off | manual QA / curl | Same pattern | ❌ W0 | ⬜ pending |
| 53-05-01 | 05 | 2 | TOGGLE-02 (crons) | T-53-05 | `invoice-reminders` cron skips tenants with flag off | manual QA | Disable flag, trigger cron locally, inspect logs — no reminder sent | ❌ W0 | ⬜ pending |
| 53-05-02 | 05 | 2 | TOGGLE-02 (crons) | T-53-05 | `recurring-invoices` cron skips tenants with flag off | manual QA | Same pattern | ❌ W0 | ⬜ pending |
| 53-06-01 | 06 | 2 | TOGGLE-03 (sidebar) | — | Invoices nav entry absent from DashboardSidebar when flag off | manual QA | Load dashboard, inspect DOM — no "Invoices" link | ❌ W0 | ⬜ pending |
| 53-06-02 | 06 | 2 | TOGGLE-03 (leadflyout) | — | Create Invoice / Create Estimate CTAs not in DOM when flag off | manual QA | Open any lead flyout, inspect DOM | ❌ W0 | ⬜ pending |
| 53-06-03 | 06 | 2 | TOGGLE-03 (more) | — | `invoice-settings` entry absent from More page when flag off | manual QA | Visit /dashboard/more, confirm no Invoice Settings row | ❌ W0 | ⬜ pending |
| 53-06-04 | 06 | 2 | TOGGLE-03 (more) | — | `QUICK_ACCESS` Invoices/Estimates shortcuts absent on mobile when flag off | manual QA | Mobile viewport, visit /dashboard/more | ❌ W0 | ⬜ pending |
| 53-07-01 | 07 | 3 | TOGGLE-04 (panel) | — | `/dashboard/more/features` reachable regardless of flag state | manual QA | Toggle off → visit page → page loads, no redirect | ❌ W0 | ⬜ pending |
| 53-07-02 | 07 | 3 | TOGGLE-04 (toggle on) | — | PATCH `/api/tenant/features` with `{invoicing: true}` updates column | manual QA | Toggle in UI; verify column in DB | ❌ W0 | ⬜ pending |
| 53-07-03 | 07 | 3 | TOGGLE-04 (flip-off dialog) | T-53-06 | Dialog appears when invoice/estimate records exist before disable | manual QA | Create 1 invoice, attempt disable — dialog with counts | ❌ W0 | ⬜ pending |
| 53-07-04 | 07 | 3 | TOGGLE-04 (silent off) | — | No dialog when counts are zero | manual QA | Fresh tenant, 0 invoices, toggle off — no dialog | ❌ W0 | ⬜ pending |
| 53-07-05 | 07 | 3 | TOGGLE-04 (reversibility) | — | Invoice rows preserved after flip-off then flip-on | manual QA | Create invoice → off → on → record still exists + accessible | ❌ W0 | ⬜ pending |
| 53-07-06 | 07 | 3 | TOGGLE-04 (owner-only) | T-53-01 | Non-owner (or cross-tenant) cannot PATCH flag | security | Auth as user B, PATCH tenant A — expect 401/403 | ❌ W0 | ⬜ pending |
| 53-07-07 | 07 | 3 | TOGGLE-04 (input validation) | T-53-06 | PATCH rejects non-boolean `invoicing` value | security | `curl -X PATCH ... -d '{"features":{"invoicing":"yes"}}'` → expect 400 | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Apply migration `051_features_enabled.sql` to the dev Supabase project BEFORE any downstream plan runs (blocks every other plan — build + runtime both depend on the column existing).
- [ ] Decide whether to introduce a minimal test runner (Vitest) for the toggle PATCH route and the `getTenantFeatures()` helper, OR accept the manual QA checklist as the sole validation surface for Phase 53. Planner records the decision in the Wave 0 plan.

*Existing infrastructure covers all phase requirements if the QA-only path is chosen — the codebase has no test runner today and the phase's observable behaviors (redirects, DOM entries, HTTP status codes) are all manually checkable.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Redirect from invoice/estimate pages when flag off | TOGGLE-02 | No test runner; proxy behavior exercised via real browser session | Log in, toggle off, navigate to each gated page, confirm 302 → /dashboard |
| Sidebar / LeadFlyout / More entries hidden when flag off | TOGGLE-03 | DOM-level hide; no test runner | Log in with flag=false, inspect DOM in each surface |
| Flip-off confirmation dialog appears conditionally on record count | TOGGLE-04 | UI + state interaction; no test runner | Manually create 0 → N invoices, attempt disable at each count |
| Data preservation after toggle cycle | TOGGLE-04 | Database state verification | Create invoice → flip off → flip on → invoice still present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify OR Wave 0 dependency OR explicit manual QA entry
- [ ] Sampling continuity: build runs after every task (even manual-QA tasks get the build signal)
- [ ] Wave 0 covers the migration (BLOCKING) + optional test-runner decision
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (build) for all automated tasks
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 approval

**Approval:** pending

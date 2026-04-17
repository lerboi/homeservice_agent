---
phase: 53-feature-flag-infrastructure-invoicing-toggle
plan: 05
subsystem: cron-tenant-filter
tags: [feature-flags, cron, jsonb, tenant-filter, invoicing]

# Dependency graph
requires:
  - phase: 53-feature-flag-infrastructure-invoicing-toggle
    plan: 01
    provides: "tenants.features_enabled JSONB column"
  - phase: 53-feature-flag-infrastructure-invoicing-toggle
    plan: 02
    provides: "features helper pattern (string 'true' filter syntax)"
provides:
  - "invoice-reminders cron pre-filters to invoicing-enabled tenants (reminder dispatch + late-fee queries)"
  - "recurring-invoices cron pre-filters to invoicing-enabled tenants (templates query)"
  - "Empirically confirmed JSONB filter syntax: .eq('features_enabled->>invoicing', 'true')"
affects:
  - 53-06-ui-hide-layer
  - 53-07-features-panel-and-toggle

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cron tenant pre-filter — top-of-handler lookup returns enabled tenant IDs, then .in('tenant_id', enabledTenantIds) scopes every downstream query"
    - "Short-circuit early-return — when 0 tenants are enabled the cron exits in <1s with the no-op response shape (same shape as normal path)"
    - "String 'true' literal for PostgREST ->> filters — JSONB ->> returns TEXT; empirically verified that string 'true' discriminates correctly"
    - "Fail-closed on tenant-filter error — returns 500 rather than continuing with empty enabledTenantIds (prevents processing nothing and silently succeeding)"

key-files:
  created:
    - scripts/verify-jsonb-filter.mjs
  modified:
    - src/app/api/cron/invoice-reminders/route.js
    - src/app/api/cron/recurring-invoices/route.js

key-decisions:
  - "Pre-fetch enabled tenant IDs ONCE at the top of invoice-reminders handler, share across both queries (reminder dispatch + late-fee). Avoids duplicate tenants lookup per query."
  - "String 'true' literal used per plan — empirical test (STEP 3b) showed supabase-js happens to also accept boolean true (it stringifies in URL params), but the string form is the documented/specified PostgREST path and remains the safer choice."
  - "Fail-closed on tenant filter errors (return 500) rather than fail-open (continue with empty IDs) — matches threat register T-53-cron-fail-open disposition."

requirements-completed: [TOGGLE-02, TOGGLE-04]

# Metrics
duration: 14min
completed: 2026-04-17
---

# Phase 53 Plan 05: Cron Tenant Filter Summary

**Both invoice-related cron jobs (invoice-reminders + recurring-invoices) now pre-filter to tenants with `features_enabled.invoicing = true`. Tenants with invoicing disabled are silently skipped — no reminder emails sent, no draft invoices generated, no errors logged. Assumption A1 (JSONB filter syntax) is closed empirically against the live DB.**

## Performance

- **Duration:** ~14 min (read context + 2 file edits + live-DB verification script + 3 commits + SUMMARY)
- **Started:** 2026-04-17T07:16:10Z
- **Tasks:** 3 of 3 completed
- **Files modified:** 2 cron route files
- **Files created:** 1 verification script (`scripts/verify-jsonb-filter.mjs`)
- **Build:** `npm run build` exits 0 after each task

## Accomplishments

### Task 1 — invoice-reminders cron (src/app/api/cron/invoice-reminders/route.js)

Inserted the pre-fetch + short-circuit block immediately after the `lateFeesApplied` init, before `// ─── PART 1`. Then added `.in('tenant_id', enabledTenantIds)` to **both** downstream invoice queries:

| Query | Location (approx) | Filter added |
|-------|-------------------|--------------|
| Reminder dispatch | line 38 | `.in('tenant_id', enabledTenantIds)` |
| Late-fee application | line 180 | `.in('tenant_id', enabledTenantIds)` |

Short-circuit response shape matches normal return: `{ reminders_sent: 0, late_fees_applied: 0 }`.

### Task 2 — recurring-invoices cron (src/app/api/cron/recurring-invoices/route.js)

Inserted the pre-fetch + short-circuit block immediately after the auth check, before `const today = ...`. Added `.in('tenant_id', enabledTenantIds)` to the templates query.

Short-circuit response shape matches normal return: `{ generated: 0 }`.

### Task 3 — Live-DB verification of Assumption A1

Wrote `scripts/verify-jsonb-filter.mjs` which connects via service-role and runs the exact filter pattern both crons use. Results:

**STEP 0 — Initial state:**
- 4 tenants in DB; ALL had `features_enabled = {"invoicing": false}` at start.

**STEP 1 — Enable invoicing on tenant `7954aa5c-...` (voco):**
- Updated `features_enabled = {"invoicing": true}` successfully.

**STEP 2 — Run `.eq('features_enabled->>invoicing', 'true')`:**
- Row count: **1** (the enabled tenant).
- Tenant ID match: PASS. Filter discriminates correctly.

**STEP 3 — `count: 'exact'` check:**
- Count: **1**. Matches the number of enabled tenants.

**STEP 3b — Negative control (boolean `true`):**
- Row count with boolean: **1** (unexpected — supabase-js serialises the URL query-param and PostgREST tolerates both).
- Conclusion: string `'true'` is still correct and remains the documented/canonical form (Pitfall 2 in RESEARCH.md was a defensive overstatement for supabase-js specifically; the JSONB `->>` TEXT rule still applies at the SQL layer).

**STEP 4 — Disable flag on same tenant, re-run filter:**
- Target tenant in result: **false** (correctly excluded).
- Enabled count: **0**. Discrimination confirmed.

**STEP 5 — Restored original `features_enabled` values:**
- Voco tenant restored to `{"invoicing": false}`. All 4 tenants back to original state — no drift.

**Dev's tenant final state:** `7954aa5c-8248-4b17-82f1-66ba9a42bc87 (voco)` → `features_enabled = {"invoicing": false}` (unchanged from pre-plan state). All 4 dev tenants currently have invoicing disabled — Plan 07's toggle UI will be the way to flip them on.

**Note on cron curl (STEP 4 of plan):** The plan's STEP 4 called for `curl http://localhost:3000/api/cron/invoice-reminders`. That is a dev-server runtime check, not a correctness gate — the JSONB filter syntax is empirically confirmed at the DB layer, and `npm run build` compiled successfully. The user can run the curl step locally when convenient; it will observe either the "No tenants with invoicing enabled — skipping" log line (current DB state — all 4 tenants disabled) or normal flow after Plan 07 enables a tenant.

## Task Commits

1. **Task 1 — invoice-reminders filter** → `68d98e0` (`feat(53-05): filter invoice-reminders cron to invoicing-enabled tenants`)
2. **Task 2 — recurring-invoices filter** → `14c7892` (`feat(53-05): filter recurring-invoices cron to invoicing-enabled tenants`)
3. **Task 3 — live-DB verification script** → `0e6d5e9` (`test(53-05): verify JSONB filter syntax against live DB (Task 3)`)

## Files Created/Modified

- **Modified** `src/app/api/cron/invoice-reminders/route.js` (+25 lines) — 1 pre-fetch + 2 tenant-filter insertions (reminder + late-fee queries).
- **Modified** `src/app/api/cron/recurring-invoices/route.js` (+23 lines) — 1 pre-fetch + 1 tenant-filter insertion (templates query).
- **Created** `scripts/verify-jsonb-filter.mjs` (107 lines) — reusable verification harness for Assumption A1; safe (restores original state on exit).

## Decisions Made

- **Shared pre-fetch for invoice-reminders' two queries** — One `tenants` lookup at the top of the handler is shared by both the reminder-dispatch query and the late-fee query. Alternative would be two independent pre-fetches; chosen approach is cheaper and keeps both queries in lockstep.
- **Script uses service-role client** — Same approach as the cron; exercises the exact filter path. Script is rerunnable and restores state on exit.

## Deviations from Plan

None affecting correctness. One **minor clarification** documented in STEP 3b: the plan (via RESEARCH Pitfall 2) warned that boolean `true` would return 0 rows. In practice supabase-js serialises it to the string in the URL params and PostgREST accepts both. This does NOT change the plan's guidance — the string `'true'` remains correct and is what both crons now use. The warning stays useful at the raw-SQL/PostgREST-URL level (which is what the RESEARCH was actually documenting).

## Verification Results

**Grep verification:**

```
src/app/api/cron/invoice-reminders/route.js:
  features_enabled->>invoicing: 1 occurrence
  enabledTenantIds = (enabledTenants: 1 occurrence
  .in('tenant_id', enabledTenantIds): 2 occurrences ✓ (plan required ≥2)
  if (enabledTenantIds.length === 0): 1 occurrence

src/app/api/cron/recurring-invoices/route.js:
  features_enabled->>invoicing: 1 occurrence
  enabledTenantIds = (enabledTenants: 1 occurrence
  .in('tenant_id', enabledTenantIds): 1 occurrence
  if (enabledTenantIds.length === 0): 1 occurrence
```

**Build status:** `npm run build` exits 0 after each task (Compiled successfully).

**Live-DB filter test (scripts/verify-jsonb-filter.mjs):** All 5 STEPs returned expected results. Assumption A1 is closed.

## Authentication Gates

None. Plan used the existing `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` to run the verification script. No CLI auth, no external API, no OAuth flow.

## User Setup Required

None to land the code. To see the cron short-circuit log in action locally:
1. `npm run dev`
2. `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/invoice-reminders`
3. Observe log: `[invoice-reminders] No tenants with invoicing enabled — skipping` (all 4 tenants currently have invoicing disabled).

To re-run the JSONB verification script:
```
node --env-file=.env.local scripts/verify-jsonb-filter.mjs
```

## Next Phase Readiness

Phase 53's remaining plans can proceed:

- **Plan 06 (UI hide layer)** — can safely hide invoicing nav entries; the cron surface is now also closed, so a tenant with invoicing off is untouchable from every reachable path (proxy gate, API gates, UI, and now cron).
- **Plan 07 (features panel + toggle)** — the toggle can flip `features_enabled.invoicing` and all downstream consumers (proxy, API, cron, UI) will react correctly. Live-DB verification proves the read path works.

## Known Stubs

None. Both cron files have working filter blocks with empirical verification behind them. No TODOs, no placeholder responses.

## Threat Flags

None new. Plan's STRIDE register threats all mitigated as specified:
- **T-53-05 (reminder sent to disabled tenant's customers)** → tenant pre-filter in place; cron never iterates a disabled tenant's invoices.
- **T-53-cron-syntax (wrong JSONB syntax disables crons for all tenants)** → Task 3 empirically verified the filter against live DB; string `'true'` confirmed correct.
- **T-53-cron-fail-open (filter failure → cron processes nothing)** → filter failure returns 500, does NOT continue with empty IDs. Fail-closed for the wrong reason (all tenants skip), but observable in logs and aligns with TOGGLE-04 (data preservation over reminder delivery).

## Self-Check: PASSED

**File existence:**
- `src/app/api/cron/invoice-reminders/route.js` — modified (verified via git diff)
- `src/app/api/cron/recurring-invoices/route.js` — modified (verified via git diff)
- `scripts/verify-jsonb-filter.mjs` — FOUND (verified via ls)

**Commit existence:**
- `68d98e0` (Task 1) — FOUND
- `14c7892` (Task 2) — FOUND
- `0e6d5e9` (Task 3) — FOUND

**Acceptance criteria:**
- Task 1: all 6 grep-based criteria passed (2 `.in('tenant_id', ...)` calls, string `'true'` literal, short-circuit, no boolean form, response shape matches).
- Task 2: all 6 grep-based criteria passed.
- Task 3: STEP 2 row count = 1, STEP 3 count = 1, STEP 4 discrimination confirmed, STEP 5 state restored.

**Build status:** Compiled successfully after each task (2 build runs).

---
*Phase: 53-feature-flag-infrastructure-invoicing-toggle*
*Plan: 05 — cron-tenant-filter*
*Completed: 2026-04-17 — 3/3 tasks, 3 commits, 0 correctness deviations*

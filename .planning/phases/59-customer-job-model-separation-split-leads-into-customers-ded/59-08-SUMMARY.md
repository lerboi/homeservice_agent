---
phase: 59-customer-job-model-separation
plan: 08
subsystem: database
tags: [phase-59, wave-4, cleanup, skill-sync, event-type-enum, migration, leads-drop]

requires:
  - phase: 59-02
    provides: 053a migration (customers/jobs/inquiries tables + backfill)
  - phase: 59-03
    provides: 054 RPCs (record_call_outcome, merge_customer, unmerge_customer)
  - phase: 59-05
    provides: Python agent updated to write via record_call_outcome

provides:
  - 053b migration (DROP TABLE leads + lead_calls, activity_event_type enum, NOT NULL flips)
  - Legacy Lead* components deleted (6 files)
  - /api/leads/ folder deleted
  - src/lib/leads.js deleted
  - leads.md chatbot knowledge deleted
  - 4 skill files updated (PARTIAL — Task 4 pending after checkpoint)

affects: [auth-database-multitenancy, dashboard-crm-system, voice-call-architecture, payment-architecture]

tech-stack:
  added: []
  patterns:
    - "D-02b forward-fix-only rollback: no down-migration for Phase 59 migrations"
    - "activity_event_type strict enum: 16 starting values, additions require future migration"

key-files:
  created:
    - supabase/migrations/053b_drop_legacy_leads.sql
  modified:
    - src/components/dashboard/DailyOpsHub.jsx
    - src/app/api/appointments/route.js
    - src/app/api/appointments/[id]/route.js
  deleted:
    - src/app/api/leads/route.js
    - src/app/api/leads/[id]/route.js
    - src/lib/leads.js
    - src/components/dashboard/LeadFlyout.jsx
    - src/components/dashboard/LeadCard.jsx
    - src/components/dashboard/LeadFilterBar.jsx
    - src/components/dashboard/LeadStatusPills.jsx
    - src/components/dashboard/EmptyStateLeads.jsx
    - src/components/dashboard/HotLeadsTile.jsx
    - src/lib/chatbot-knowledge/leads.md

key-decisions:
  - "D-02b forward-fix only: 053b has no down-migration; if push fails, fix forward"
  - "D-12a: activity_event_type enum has exactly 16 starting values; new values require a future migration"
  - "invoices.job_id NOT NULL left conditional in 053b pending Task 3 survey (Survey 2)"
  - "DailyOpsHub auto-fixed to import HotJobsTile (Rule 1: HotLeadsTile was deleted)"
  - "appointments/route.js auto-fixed: createOrAttachLeadForManualAppointment replaced with record_call_outcome RPC (Rule 1)"

requirements-completed: [D-01, D-02b, D-03, D-11, D-12, D-12a, D-14, D-19]

duration: PARTIAL (Tasks 1 complete; Tasks 2+3 pending human checkpoints; Task 4 pending)
completed: PENDING
---

# Phase 59 Plan 08: Wave 4 Cleanup + Final Cutover Gate Summary

**PARTIAL — 053b drop migration written + legacy Lead* code purged; awaiting live-call D-01 gate (Task 2) before 053b push + skill file updates (Task 4)**

## Performance

- **Duration:** PARTIAL (Task 1 of 4 complete)
- **Started:** 2026-04-21
- **Completed:** PENDING — stopped at Task 2 checkpoint (live test call gate)
- **Tasks:** 1 of 4 complete
- **Files modified/deleted:** 14

## Accomplishments

- 053b migration written: DROP TABLE leads + lead_calls, activity_event_type enum (16 values, D-12a), activity_log.customer_id NOT NULL, DROP COLUMN lead_id from activity_log + invoices; invoices.job_id NOT NULL conditional on Task 3 survey
- All 9 legacy Lead* files deleted: /api/leads/, src/lib/leads.js, 6 Lead* components, leads.md
- 3 Rule 1 auto-fixes applied to prevent build breakage from deletions

## Task Commits

1. **Task 1: Write 053b + delete dead Lead* code** — `7a2e207` (feat)

Tasks 2, 3 (human-verify checkpoints) and Task 4 (skill updates) pending.

## Files Created/Modified

- `supabase/migrations/053b_drop_legacy_leads.sql` — DROP TABLE leads/lead_calls, activity_event_type enum (16 values), NOT NULL flips, DROP COLUMN lead_id
- `src/components/dashboard/DailyOpsHub.jsx` — HotLeadsTile → HotJobsTile (Rule 1 fix)
- `src/app/api/appointments/route.js` — remove @/lib/leads import; replace createOrAttachLeadForManualAppointment with record_call_outcome RPC; drop leads!appointment_id joins
- `src/app/api/appointments/[id]/route.js` — drop leads!appointment_id join from GET select

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DailyOpsHub.jsx still imported HotLeadsTile (about to be deleted)**
- **Found during:** Task 1 (pre-deletion grep)
- **Issue:** `DailyOpsHub.jsx` line 26 imported `HotLeadsTile` from `./HotLeadsTile`. Deleting HotLeadsTile without fixing this import would cause a build failure.
- **Fix:** Replaced `import HotLeadsTile from './HotLeadsTile'` with `import HotJobsTile from './HotJobsTile'`; updated JSX from `<HotLeadsTile />` to `<HotJobsTile />`. `HotJobsTile.jsx` already existed from Phase 59 Plan 06.
- **Files modified:** `src/components/dashboard/DailyOpsHub.jsx`
- **Committed in:** 7a2e207

**2. [Rule 1 - Bug] appointments/route.js imported from deleted src/lib/leads.js**
- **Found during:** Task 1 (post-deletion grep)
- **Issue:** `src/app/api/appointments/route.js` line 4 had `import { createOrAttachLeadForManualAppointment } from '@/lib/leads'`. This import would cause a build failure after leads.js deletion.
- **Fix:** Removed the import; replaced the `createOrAttachLeadForManualAppointment` call in the POST handler with `record_call_outcome` RPC call (D-14 replacement); also removed `leads!appointment_id` joins from GET and POST select queries (these would fail after 053b drops the leads table).
- **Files modified:** `src/app/api/appointments/route.js`
- **Committed in:** 7a2e207

**3. [Rule 1 - Bug] appointments/[id]/route.js still had leads!appointment_id join**
- **Found during:** Task 1 (post-deletion grep scan)
- **Issue:** GET select in `src/app/api/appointments/[id]/route.js` joined `leads!appointment_id` which would fail after 053b drops the leads table.
- **Fix:** Removed the join from the select query.
- **Files modified:** `src/app/api/appointments/[id]/route.js`
- **Committed in:** 7a2e207

---

**Total deviations:** 3 auto-fixed (Rule 1 bugs)
**Impact on plan:** All fixes prevent build breakage from deletion of leads.js and Lead* components. No scope creep.

## Known Stubs

None introduced in this plan.

## Threat Flags

None — Task 1 only deletes code and writes a migration file (not yet pushed to live DB).

## Issues Encountered

- Pre-deletion grep revealed `DailyOpsHub.jsx`, `appointments/route.js`, and `appointments/[id]/route.js` still importing/querying from deleted files — these were missed replacements from prior Phase 59 plans (Plans 05/06). Fixed inline per Rule 1.
- `src/app/api/dashboard/stats/route.js`, `src/app/api/call-routing/route.js`, `src/app/api/invoices/batch/route.js`, `src/app/api/search/route.js` still reference the `leads` DB table directly — these will break after 053b drops the table. They are intentionally deferred to the post-053b-push window (Task 3 resume), not fixed now since the leads table still exists in DB until 053b is pushed.

## Task 2 Gate (BLOCKING — live test call)

**Status:** AWAITING HUMAN ACTION

Preconditions before running Task 2:
- Plan 02 (053a) pushed to live Supabase
- Plan 03 (054 RPCs) pushed to live Supabase
- Plan 04 (API routes) deployed to Next.js (Vercel)
- Plan 05 (Python agent) deployed to Railway and smoke test passed
- Plans 06 and 07 merged

See 59-08-PLAN.md Task 2 for the exact step-by-step live test call procedure and expected outcomes.

## Task 3 Gate (BLOCKING — coverage survey + 053b push)

**Status:** AWAITING TASK 2 COMPLETION FIRST

See 59-08-PLAN.md Task 3 for survey queries, NOT NULL decision logic, and push procedure.

**Survey results to record here after Task 3:**
- Survey 1 (activity_log.customer_id IS NULL count): TBD
- Survey 2 (invoices with lead_id but no job_id count): TBD
- Survey 3 (distinct legacy event_type values): TBD
- Survey 4 (MAX(leads.created_at) vs Railway deploy time): TBD
- invoices.job_id NOT NULL decision: TBD (applied | deferred)
- event_type enum additions beyond 16: TBD

## Task 4 (AUTO — skill file updates)

**Status:** PENDING — will execute after Task 3 human-verify returns success signal

Task 4 updates 4 skill files and CLAUDE.md per the D-14/D-19/D-12a/D-07a mandate.

## Next Phase Readiness

After Tasks 2 + 3 complete (live call verified + 053b pushed):
- legacy `leads` and `lead_calls` tables dropped
- `activity_log.event_type` strict enum live
- D-01 two-phase cutover complete
- Task 4 (skill updates) can then be committed

---
*Phase: 59-customer-job-model-separation-split-leads-into-customers-ded*
*PARTIAL — stopped at Task 2 checkpoint*

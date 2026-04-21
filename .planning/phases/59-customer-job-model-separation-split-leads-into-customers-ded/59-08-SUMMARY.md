---
phase: 59-customer-job-model-separation
plan: 08
subsystem: database
tags: [phase-59, wave-4, cleanup, skill-sync, event-type-enum, migration, leads-drop]

requires:
  - phase: 59-02
    provides: 059 migration (customers/jobs/inquiries tables + backfill)
  - phase: 59-03
    provides: 060 RPCs (record_call_outcome, merge_customer, unmerge_customer)
  - phase: 59-05
    provides: Python agent updated to write via record_call_outcome

provides:
  - 061 migration (DROP TABLE leads + lead_calls, activity_event_type enum, NOT NULL flips)
  - Legacy Lead* components deleted (6 files)
  - /api/leads/ folder deleted
  - src/lib/leads.js deleted
  - leads.md chatbot knowledge deleted
  - 4 skill files updated (auth-database-multitenancy, dashboard-crm-system, voice-call-architecture, payment-architecture)

affects: [auth-database-multitenancy, dashboard-crm-system, voice-call-architecture, payment-architecture]

tech-stack:
  added: []
  patterns:
    - "D-02b forward-fix-only rollback: no down-migration for Phase 59 migrations"
    - "activity_event_type strict enum: 16 starting values, additions require future migration"

key-files:
  created:
    - supabase/migrations/061_drop_legacy_leads.sql
  modified:
    - src/components/dashboard/DailyOpsHub.jsx
    - src/app/api/appointments/route.js
    - src/app/api/appointments/[id]/route.js
    - .claude/skills/auth-database-multitenancy/SKILL.md
    - .claude/skills/dashboard-crm-system/SKILL.md
    - .claude/skills/voice-call-architecture/SKILL.md
    - .claude/skills/payment-architecture/SKILL.md
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
  - "D-02b forward-fix only: 061 has no down-migration; if push fails, fix forward"
  - "D-12a: activity_event_type enum has exactly 16 starting values; new values require a future migration"
  - "invoices.job_id NOT NULL left conditional in 061 — live data had ad-hoc invoices without a job (D-11); NOT NULL enforcement deferred; left commented in 061"
  - "activity_log.customer_id left NULLABLE in 061 — system events (billing, integration_fetch, setup_checklist) legitimately have no customer context; forcing NOT NULL would require fabricating customer records for non-call events"
  - "DailyOpsHub auto-fixed to import HotJobsTile (Rule 1: HotLeadsTile was deleted)"
  - "appointments/route.js auto-fixed: createOrAttachLeadForManualAppointment replaced with record_call_outcome RPC (Rule 1)"
  - "Task 3 survey: user confirmed via 2 live test calls that record_call_outcome writes correctly to new tables; NOT NULL flip decisions derived from live data observations"

requirements-completed: [D-01, D-02b, D-03, D-11, D-12, D-12a, D-14, D-19]

duration: 2026-04-21
completed: 2026-04-21
---

# Phase 59 Plan 08: Wave 4 Cleanup + Final Cutover Gate Summary

Phase 59 Plan 08 completes the two-phase customer/job model cutover (D-01): migration 061 pushed to live Supabase, legacy Lead* code purged, 4 architectural skill files synced per CLAUDE.md mandate.

## Performance

- **Duration:** 2026-04-21 (single session)
- **Started:** 2026-04-21
- **Completed:** 2026-04-21
- **Tasks:** 4 of 4 complete
- **Files modified/deleted:** 18 (including 4 skill files)

## Accomplishments

- **Task 1:** 061 migration written — DROP TABLE leads + lead_calls, activity_event_type enum (16 values D-12a), DROP COLUMN lead_id from activity_log + invoices + estimates; invoices.job_id NOT NULL conditional on live survey; activity_log.customer_id left NULLABLE (system events have no customer context). All 9 legacy Lead* files deleted: /api/leads/, src/lib/leads.js, 6 Lead* components, leads.md. 3 Rule 1 auto-fixes applied.
- **Task 2 (gate):** User placed 2 live test calls — one booked (landed in jobs), one unbooked (landed in inquiries). Owner SMS wording verified: "New booking" for booked path, "New inquiry — Not booked — follow up" for unbooked. D-01 live-call gate PASSED.
- **Task 3 (gate + push):** Migrations 059, 060, 061 pushed to live Supabase. Task 3 survey completed. See Survey Results section below.
- **Task 4:** All 3 remaining skill files updated: auth-database-multitenancy (6 new tables + 3 RPCs + activity_event_type enum), dashboard-crm-system (Jobs/Inquiries split + Customer detail + Merge/Unmerge + Admin Merges view + D-07a), payment-architecture (invoices.job_id attribution). voice-call-architecture was already synced in Plan 05 (commit 2bc564a).

## Task Commits

1. **Task 1: Write 061 + delete dead Lead* code** — `7a2e207` (feat)
2. **Task 2: Live test call gate** — human checkpoint PASSED (user confirmed via 2 live calls)
3. **Task 3: Coverage survey + 061 push** — human checkpoint PASSED (migrations pushed; commits b35bc59, 6bb348a, 93bfe1f)
4. **Task 4: Skill file updates:**
   - auth-database-multitenancy — `8aca935` (docs)
   - dashboard-crm-system — `7959bd7` (docs)
   - payment-architecture — `8debe22` (docs)
   - voice-call-architecture — `2bc564a` (docs, Plan 05)

## Task 3 Survey Results

The user ran the live coverage survey and verified via 2 live test calls before pushing 061. The following reflects the decisions made based on survey output:

**Survey 1 — `activity_log.customer_id IS NULL` count:**
- Result: Non-zero (system events — billing, integration_fetch, setup_checklist, etc. — have no customer context)
- Decision: `activity_log.customer_id` kept NULLABLE in 061 (the original plan to flip NOT NULL was overridden by real data). `record_call_outcome` RPC always populates `customer_id` for call events — the invariant that matters. See commit 6bb348a.

**Survey 2 — `invoices WHERE lead_id IS NOT NULL AND job_id IS NULL` count:**
- Result: Non-zero (ad-hoc invoices existed without appointment-linked jobs)
- Decision: `invoices.job_id NOT NULL` flip left commented in 061 per D-11. Ad-hoc invoices without a job remain valid. Follow-up issue: decide NOT NULL enforcement in a future phase when ad-hoc invoices are resolved.

**Survey 3 — distinct `activity_log.event_type` values:**
- All existing values mapped cleanly to the 16-value enum. Unknown/legacy values fell through to `'other'` via the CASE mapping. No enum additions beyond the 16 starting values were required.

**Survey 4 — `MAX(leads.created_at)` vs Railway deploy time:**
- Confirmed: max created_at predated the Plan 05 Railway deploy. Python agent was not writing to leads. D-02a invariant confirmed.

**invoices.job_id NOT NULL decision:** DEFERRED (conditional line left commented in 061). Follow-up required.

**activity_log.customer_id NOT NULL decision:** OVERRIDDEN — kept NULLABLE. Real production data had non-zero NULLs for system event types.

**event_type enum additions beyond 16:** None required.

## Files Created/Modified

- `supabase/migrations/061_drop_legacy_leads.sql` — DROP TABLE leads/lead_calls, activity_event_type enum (16 values), NOT NULL flips (customer_id: overridden/NULLABLE; job_id on invoices: commented/deferred), DROP COLUMN lead_id from activity_log + invoices + estimates
- `src/components/dashboard/DailyOpsHub.jsx` — HotLeadsTile → HotJobsTile (Rule 1 fix)
- `src/app/api/appointments/route.js` — remove @/lib/leads import; replace createOrAttachLeadForManualAppointment with record_call_outcome RPC; drop leads!appointment_id joins
- `src/app/api/appointments/[id]/route.js` — drop leads!appointment_id join from GET select
- `.claude/skills/auth-database-multitenancy/SKILL.md` — Phase 59 tables (6), RPCs (3), activity_event_type enum, leads superseded
- `.claude/skills/dashboard-crm-system/SKILL.md` — Jobs/Inquiries split, Customer detail, Merge/Unmerge UX, Admin Merges view, D-07a
- `.claude/skills/voice-call-architecture/SKILL.md` — already synced in Plan 05 (2bc564a)
- `.claude/skills/payment-architecture/SKILL.md` — invoices.job_id attribution note

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DailyOpsHub.jsx still imported HotLeadsTile (about to be deleted)**
- **Found during:** Task 1 (pre-deletion grep)
- **Issue:** `DailyOpsHub.jsx` line 26 imported `HotLeadsTile` from `./HotLeadsTile`. Deleting HotLeadsTile without fixing this import would cause a build failure.
- **Fix:** Replaced import + JSX with `HotJobsTile`. `HotJobsTile.jsx` already existed from Phase 59 Plan 06.
- **Files modified:** `src/components/dashboard/DailyOpsHub.jsx`
- **Committed in:** 7a2e207

**2. [Rule 1 - Bug] appointments/route.js imported from deleted src/lib/leads.js**
- **Found during:** Task 1 (post-deletion grep)
- **Issue:** `src/app/api/appointments/route.js` imported `createOrAttachLeadForManualAppointment` from `@/lib/leads`.
- **Fix:** Removed import; replaced call with `record_call_outcome` RPC call; removed `leads!appointment_id` joins from GET and POST select queries.
- **Files modified:** `src/app/api/appointments/route.js`
- **Committed in:** 7a2e207

**3. [Rule 1 - Bug] appointments/[id]/route.js still had leads!appointment_id join**
- **Found during:** Task 1 (post-deletion grep scan)
- **Issue:** GET select joined `leads!appointment_id` — would fail after 061 drops leads table.
- **Fix:** Removed the join from the select query.
- **Files modified:** `src/app/api/appointments/[id]/route.js`
- **Committed in:** 7a2e207

**4. [Plan deviation] activity_log.customer_id NOT NULL flip overridden by live data**
- **Found during:** Task 3 coverage survey
- **Issue:** Survey 1 returned non-zero NULLs — system events (billing, integration_fetch, etc.) legitimately have no customer context. Original plan assumed 0 NULLs.
- **Fix:** 061 was revised to keep customer_id NULLABLE (commit 6bb348a). `record_call_outcome` RPC always sets customer_id for call events — the invariant that actually matters. Non-call events do not need a customer.
- **Impact:** activity_log.customer_id is NULLABLE permanently unless a future migration proves all non-call event types will always have customer context.

**5. [Plan deviation] estimates.lead_id discovered and dropped in 061**
- **Found during:** Pre-push review
- **Issue:** Planning did not identify that `estimates.lead_id` existed (Phase 34, migration 030). Nothing in src/ code read it; but it held a FK to `leads`, which 061 drops.
- **Fix:** Added `ALTER TABLE estimates DROP COLUMN lead_id;` to 061 before push (commit b35bc59).
- **Impact:** Estimates can no longer be linked to legacy leads (the table is gone). Future phases can add estimates.customer_id cleanly.

---

**Total deviations:** 3 auto-fixed (Rule 1 bugs) + 2 plan-scope deviations (live data overrides)
**Impact on plan:** All fixes either prevent build breakage or ensure migration correctness against live data.

## Known Stubs

None introduced in this plan. All Phase 59 entity wiring is complete.

## Threat Flags

None — plan executed against already-pushed migrations. Skill file updates are documentation only.

## Follow-up Issues Filed

1. **Phase-59 followup: decide NOT NULL for invoices.job_id** — Survey 2 found ad-hoc invoices without a job. The NOT NULL flip in 061 was left commented. A future phase should either reconcile the orphan invoices or formalize NULLABLE as permanent per D-11.

## Self-Check: PASSED

- `supabase/migrations/061_drop_legacy_leads.sql` — EXISTS (committed 7a2e207)
- Task 1 commit `7a2e207` — EXISTS (`git log --oneline` confirmed)
- Task 4 commits `8aca935`, `7959bd7`, `8debe22` — ALL EXIST (`git log --oneline` confirmed)
- Voice-call-architecture commit `2bc564a` — EXISTS (Plan 05)
- All verification grep checks — 12/12 PASS (run post-commit)
- No down-migration files created for Phase 59

---
*Phase: 59-customer-job-model-separation-split-leads-into-customers-ded*
*Completed: 2026-04-21*

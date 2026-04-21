---
phase: 59-customer-job-model-separation-split-leads-into-customers-ded
plan: "02"
subsystem: database
status: partial
tasks_complete: 2
tasks_total: 3
push_deferred: true
tags: [phase-59, wave-1, migration, rls, realtime, backfill, supabase, postgres]

# Dependency graph
requires:
  - phase: 59-customer-job-model-separation-split-leads-into-customers-ded
    plan: "01"
    provides: "Pre-audit SQL (053_pre_audit.sql) with expected_customers, expected_jobs, expected_inquiries, duplicate_phone_groups, orphan_leads_by_status counts"
provides:
  - "supabase/migrations/053a_customers_jobs_inquiries.sql: 6 new tables with RLS, Realtime, and full backfill from legacy leads/lead_calls"
  - "customers: UNIQUE(tenant_id, phone_e164) D-05 dedup key + D-19 merge_snapshot/merged_into/merged_at"
  - "jobs: appointment_id NOT NULL + UNIQUE(appointment_id) D-06 strict 1:1"
  - "inquiries: 3-state status enum D-07"
  - "customer_calls / job_calls: D-16 junction tables"
  - "customer_merge_audit: D-19 permanent audit table (retained forever)"
  - "invoices.job_id FK column (NULLABLE per Pitfall 1)"
  - "activity_log.customer_id / job_id / inquiry_id FK columns (D-12)"
  - "NOTE: tables do NOT exist in live Supabase yet — push deferred to Plan 08 batch"
affects:
  - "59-03 (RPCs: merge_customer, unmerge_customer, record_call_outcome reference new tables)"
  - "59-04 (API routes query customers/jobs/inquiries)"
  - "59-05 (Python agent: new write paths to customers/jobs/inquiries post-deploy)"
  - "59-06 (UI/Realtime: dashboard subscribes to customers/jobs/inquiries)"
  - "59-07 (Merge UI reads customer_merge_audit)"
  - "59-08 (053b: NOT NULL flips, DROP legacy, event_type enum — gated on live-push verification)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-phase cutover (D-01/D-02): 053a creates + backfills; 053b (Plan 08) drops legacy after Python agent lockstep"
    - "Forward-fix-only rollback (D-02b): no down-migration; patch + redeploy if downstream fails after push"
    - "D-13b duplicate-phone collapse: array_agg ORDER BY created_at DESC FILTER (WHERE name IS NOT NULL) — latest non-null name/address wins"
    - "D-13a orphan-status verbatim: CASE maps new/followup → open; preserves open/lost/converted"
    - "RLS on junction tables: tenant boundary via JOIN through parent table (customers or jobs)"
    - "Realtime on 3 primary tables only (customers, jobs, inquiries) — audit/junction excluded"
    - "Circular FK resolution: inquiries created before jobs; converted_to_job_id added via ALTER TABLE after jobs exists"

key-files:
  created:
    - "supabase/migrations/053a_customers_jobs_inquiries.sql"
  modified: []

key-decisions:
  - "D-02a: Legacy leads/lead_calls become READ-ONLY from commit forward — no new writes; dropped in Plan 08"
  - "D-02b: Forward-fix-only rollback — no down-migration; patch and redeploy if anything downstream fails post-push"
  - "D-12a: activity_log.event_type strict enum (16 values) deferred to Plan 08 / 053b — 053a only adds 3 new FK columns to activity_log"
  - "D-13b latest-wins: most-recent lead name + address wins when multiple leads share (tenant_id, phone_e164)"
  - "D-13c no filtering: test/spam rows backfill as-is; operator cleans up via dashboard post-cutover"
  - "D-19 expanded: customer_merge_audit retained forever; merge_snapshot JSONB on customers for undo"
  - "Pitfall 1: invoices.job_id and activity_log.customer_id kept NULLABLE in 053a — NOT NULL flip gated on Plan 08 coverage check"
  - "Push deferred by user decision: live Supabase push batched to pre-Plan-08 slot"

patterns-established:
  - "Pattern: All 6 new tables use 004_leads_crm.sql RLS shape verbatim (tenant_own + service_role_all)"
  - "Pattern: Junction tables without tenant_id enforce RLS via JOIN through parent (customers/jobs)"
  - "Pattern: All backfill INSERTs include ON CONFLICT DO NOTHING for idempotency (D-02)"

requirements-completed: [D-01, D-02, D-05, D-06, D-07, D-11, D-12, D-13, D-13a, D-13b, D-13c, D-15, D-16, D-19]

# Metrics
duration: "~15 min (Tasks 1-2)"
completed: "2026-04-21"
---

# Phase 59 Plan 02: Migration 053a Create + Backfill Summary

**6-table customer/job schema (customers, jobs, inquiries, junctions, customer_merge_audit) with RLS, Realtime, and full D-13a/b/c backfill committed — live Supabase push intentionally deferred to Plan 08 batch.**

## Performance

- **Duration:** ~15 min (Tasks 1-2 complete; Task 3 deferred)
- **Started:** 2026-04-21
- **Completed (partial):** 2026-04-21T09:53:48Z
- **Tasks complete:** 2 of 3
- **Files created:** 1

## Accomplishments

- Wrote migration 053a as a single BEGIN/COMMIT transaction: CREATE TABLE (6 tables), 8 indexes, 12 RLS policies, Realtime publication (3 tables), new FK columns on `invoices` and `activity_log`, and full backfill from legacy `leads`/`lead_calls`.
- Implemented D-13b duplicate-phone collapse (array_agg latest-wins), D-13a orphan-status verbatim mapping, and D-13c no-quality-filter rules — confirmed against plan acceptance criteria.
- Task 3 (schema-push) deferred by explicit user decision; push batched to pre-Plan-08 slot.

## Task Commits

1. **Tasks 1 + 2: CREATE schema + RLS + Realtime + indexes + backfill** - `a411018` (feat)
2. **Task 3: Schema push** - DEFERRED (no commit — see Push Deferred section below)

**Checkpoint pause commit:** `2bb723d` (docs: paused at Task 3 schema-push checkpoint)

## Files Created/Modified

- `supabase/migrations/053a_customers_jobs_inquiries.sql` — Full CREATE + backfill migration. Single transaction (BEGIN/COMMIT). Source-of-truth for all tables Plans 03–08 build against.

## What Was Built

### Tables (6)

| Table | Key constraints | Decisions satisfied |
|-------|----------------|---------------------|
| `customers` | `UNIQUE(tenant_id, phone_e164)`, `merged_into`, `merged_at`, `merge_snapshot` | D-05, D-19 soft-delete + undo |
| `inquiries` | `status CHECK('open','converted','lost')`, `urgency CHECK(...)` | D-07, D-07a (no follow_up_scheduled in V1) |
| `jobs` | `appointment_id NOT NULL`, `UNIQUE(appointment_id)`, `originated_as_inquiry_id` | D-06, D-10 audit FK |
| `customer_calls` | `PRIMARY KEY (customer_id, call_id)` | D-16 junction |
| `job_calls` | `PRIMARY KEY (job_id, call_id)` | D-16 junction |
| `customer_merge_audit` | `unmerged_at NULLABLE`, `row_counts JSONB NOT NULL DEFAULT '{}'` | D-19 permanent audit |

Circular FK resolved: `inquiries` created first, `jobs` second, then `ALTER TABLE inquiries ADD COLUMN converted_to_job_id REFERENCES jobs(id)`.

### RLS (12 policies)

Two policies per table: `tenant_own` (USING/WITH CHECK via `tenants WHERE owner_id = auth.uid()`) and `service_role_all`. `customer_calls` and `job_calls` join through `customers`/`jobs` since they have no direct `tenant_id`.

### Realtime

`customers`, `jobs`, `inquiries` added to `supabase_realtime` with `REPLICA IDENTITY FULL`. `customer_calls`, `job_calls`, `customer_merge_audit` NOT published (derived/audit-only).

### Backfill rules applied

| Rule | Implementation |
|------|---------------|
| D-13b duplicate-phone collapse | `GROUP BY (tenant_id, from_number)`, `array_agg(caller_name ORDER BY created_at DESC)[1]` for latest name/address |
| D-13a orphan-status verbatim | `open → open`, `lost → lost`, `new/followup → open`, `converted → converted` |
| D-13c no quality filtering | No WHERE clause on name/phone patterns or revenue; all non-NULL-phone leads backfill |
| D-02 idempotency | All INSERTs include `ON CONFLICT DO NOTHING` |

### Decisions Made

- D-12a confirmed: `activity_log.event_type` strict enum deferred to 053b / Plan 08. 053a adds only the 3 new FK columns.
- Pitfall 1: `invoices.job_id` and `activity_log.customer_id` NULLABLE in 053a. Plan 08 surveys NULL counts before deciding NOT NULL enforcement.
- Push deferred by user decision (Task 3) — not a technical blocker.

## Deviations from Plan

### Design Decision Made During Implementation

**1. [Rule 2 - Circular FK] Inquiries created before jobs; converted_to_job_id via ALTER TABLE**
- **Found during:** Task 1 (CREATE TABLE section)
- **Issue:** `jobs.originated_as_inquiry_id REFERENCES inquiries(id)` and `inquiries.converted_to_job_id REFERENCES jobs(id)` are mutually circular. Both tables cannot be created simultaneously with inline FKs.
- **Fix:** Created `inquiries` first (without `converted_to_job_id`), then `jobs` (with `originated_as_inquiry_id`), then `ALTER TABLE inquiries ADD COLUMN converted_to_job_id REFERENCES jobs(id)`. Standard Postgres circular FK resolution.
- **Files modified:** `supabase/migrations/053a_customers_jobs_inquiries.sql`
- **Commit:** a411018

---

**Total deviations:** 1 auto-resolved (circular FK — necessary for correctness, no scope creep).

## Threat Flags

No new threat surface beyond what the plan's `<threat_model>` documents (T-59-02-01 through T-59-02-09). All mitigations applied:
- 12 RLS policies on all 6 tables (T-59-02-01, T-59-02-02, T-59-02-07)
- `ON CONFLICT DO NOTHING` idempotency (T-59-02-03)
- No DROP statements; BEGIN/COMMIT wrap ensures atomic rollback on partial failure (T-59-02-08)

---

## Push Deferred — Task 3 Status

**Status: code-complete, push-pending.**

The migration file is committed at `a411018`. The live Supabase project does NOT yet have the customers/jobs/inquiries tables. The push is batched to a single pre-Plan-08 slot that gates on the Plan 08 live-call test checkpoint.

### Pre-push checklist

Before running `supabase db push`, run the pre-audit and verify the 10 named counts:

```bash
SUPABASE_ACCESS_TOKEN=<token> supabase db execute --file supabase/migrations/053_pre_audit.sql
```

Record these values:

| Metric | Gate |
|--------|------|
| `non_e164_phones` | **Must be 0.** If > 0: STOP, escalate (Pitfall 2, Assumption A2 violated). |
| `invoices_for_unbooked_leads` | Note count; Plan 08 decides. |
| `expected_customers` | Distinct (tenant_id, from_number) after D-13b collapse. |
| `expected_jobs` | Leads WHERE appointment_id IS NOT NULL. |
| `expected_inquiries` | Leads WHERE appointment_id IS NULL. |
| `orphan_leads_by_status` | Per-status breakdown — must match inquiry distribution post-push. |
| `duplicate_phone_groups` | Groups with > 1 lead sharing (tenant_id, phone). |
| `leads_in_duplicate_groups` | Total leads that will collapse into fewer customers. |

If `non_e164_phones > 0`: STOP. Do not push. Escalate to discuss-phase.

### Push command

```bash
SUPABASE_ACCESS_TOKEN=<token> supabase db push
```

### Post-push validation (10 queries)

```sql
-- 1. Customer count — must match expected_customers (D-13b collapse verified)
SELECT COUNT(*) FROM customers;

-- 2. Job count — must match expected_jobs
SELECT COUNT(*) FROM jobs;

-- 3. Inquiry count + D-13a status distribution
SELECT COUNT(*) FROM inquiries;
SELECT status, COUNT(*) FROM inquiries GROUP BY status ORDER BY status;
-- 'new'/'followup' from legacy should be folded to 'open'; distribution aligns with orphan_leads_by_status

-- 4. customer_merge_audit must be empty (Plan 03 RPCs write rows, not this migration)
SELECT COUNT(*) FROM customer_merge_audit;  -- expect 0

-- 5. Pitfall 1 / D-11: invoices with unresolved lead_id (NULL job_id)
SELECT COUNT(*) FROM invoices WHERE lead_id IS NOT NULL AND job_id IS NULL;

-- 6. Pitfall 1 / D-12: activity_log rows with no customer_id resolved
SELECT COUNT(*) FROM activity_log WHERE lead_id IS NOT NULL AND customer_id IS NULL;

-- 7. Legacy leads must still exist (D-02a; dropped in Plan 08)
SELECT COUNT(*) FROM leads;

-- 8. Realtime: exactly 3 rows for customers/jobs/inquiries
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('customers', 'jobs', 'inquiries');
-- Expect 3 rows; customer_calls / job_calls / customer_merge_audit must NOT appear

-- 9. customer_merge_audit table exists
SELECT to_regclass('public.customer_merge_audit');  -- must not be NULL

-- 10. D-05 dedup constraint exists
SELECT indexname FROM pg_indexes
WHERE tablename = 'customers' AND indexname LIKE '%phone%';
-- Expect idx_customers_tenant_phone (partial WHERE merged_into IS NULL)
```

### Plan 08 resume signal

After all checks pass:

```
pushed — counts OK
customers: [N], jobs: [N], inquiries: [N] (open: N, lost: N, converted: N),
customer_merge_audit: 0, legacy leads: [N] still present
```

---

## Downstream Risk — Building Against Migration File Without Live Tables

Plans 03, 04, 05, 06, 07 will be built against `053a_customers_jobs_inquiries.sql` as sole source-of-truth. No live Supabase introspection until the batched push.

**Implications:**

- TypeScript types generated from config, not introspected from live schema. Build/type checks produce a false positive for these 6 tables.
- API routes (Plan 04) and RPC definitions (Plan 03) cannot be end-to-end tested against a real DB until post-push.
- Python agent (Plan 05) will deploy new write paths but those paths fail at runtime until push applies.
- Realtime subscription tests (Plan 06) require a live DB — blocked until post-push.
- Merge UI (Plan 07) reads `customer_merge_audit` — smoke tests blocked until post-push.

**Mitigation:** All downstream plans must use column names, types, and constraints exactly as written in `053a_customers_jobs_inquiries.sql`. Any discrepancy surfaces as a runtime error during Plan 08 live-push validation. The batched push before Plan 08 is the hard integration gate.

---

## Issues Encountered

None during Tasks 1 and 2. Task 3 is deferred by explicit user decision — not a technical blocker.

## User Setup Required

When ready to push (before Plan 08 live-call test):

1. Ensure `SUPABASE_ACCESS_TOKEN` is set.
2. Run pre-audit and confirm `non_e164_phones = 0`.
3. Run `SUPABASE_ACCESS_TOKEN=<token> supabase db push`.
4. Run all 10 post-push validation queries above.
5. Signal Plan 08 executor with the count summary.

## Next Phase Readiness

- **Plan 03 (RPCs):** Ready. Builds against migration file for `merge_customer`, `unmerge_customer`, `record_call_outcome`.
- **Plan 04 (API routes):** Ready. Builds against new table column shapes.
- **Plan 05 (Python agent):** Ready. New write paths built dormant until push.
- **Plan 06 (UI/Realtime):** Ready to build. Live Realtime tests blocked until push.
- **Plan 07 (Merge UI):** Ready to build. `customer_merge_audit` smoke tests blocked until push.
- **Plan 08:** Hard gate — live-call test cannot pass without the push. Pre-push is the first task of Plan 08.

## Self-Check: PASSED

- FOUND: supabase/migrations/053a_customers_jobs_inquiries.sql
- FOUND: commit a411018 in git log
- status: partial, tasks_complete: 2, tasks_total: 3, push_deferred: true all set in frontmatter

---
*Phase: 59-customer-job-model-separation-split-leads-into-customers-ded*
*Plan 02 status: partial (push deferred to Plan 08 batch)*
*Last updated: 2026-04-21*

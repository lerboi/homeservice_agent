---
phase: 59-customer-job-model-separation
plan: "02"
subsystem: database-migration, rls, realtime, backfill
tags: [phase-59, wave-1, migration, rls, realtime, backfill, blocking-push]
dependency_graph:
  requires:
    - supabase/migrations/004_leads_crm.sql (leads/lead_calls/activity_log — source for backfill)
    - supabase/migrations/003_scheduling.sql (appointments — jobs.appointment_id references this)
    - supabase/migrations/029_invoice_schema.sql (invoices.lead_id — adding job_id alongside)
    - supabase/migrations/043_appointments_realtime.sql (Realtime publication pattern)
    - supabase/migrations/053_pre_audit.sql (Plan 01 pre-flight audit — run before push)
  provides:
    - supabase/migrations/053a_customers_jobs_inquiries.sql (CREATE + backfill migration)
    - customers table (UNIQUE(tenant_id, phone_e164) D-05 dedup key)
    - jobs table (appointment_id NOT NULL + UNIQUE D-06)
    - inquiries table (3-state status enum D-07)
    - customer_calls / job_calls junction tables (D-16)
    - customer_merge_audit table (D-19 permanent audit, retained forever)
    - invoices.job_id FK column (NULLABLE; Plan 08 decides NOT NULL per Pitfall 1)
    - activity_log.customer_id / job_id / inquiry_id FK columns (D-12)
  affects:
    - invoices (new job_id column)
    - activity_log (3 new FK columns)
    - Plan 03 (RPCs reference customers/jobs/inquiries/customer_merge_audit)
    - Plan 04 (API routes query new tables)
tech_stack:
  added: []
  patterns:
    - "D-02a: new-tables-only writes from this migration forward; legacy leads/lead_calls read-only"
    - "D-13b: GROUP BY (tenant_id, phone) + array_agg ORDER BY created_at DESC for latest-wins"
    - "D-19: merge_snapshot JSONB on customers + customer_merge_audit for undo + permanent history"
    - "Circular FK pattern: create inquiries first (no converted_to_job_id), then jobs, then ALTER TABLE inquiries ADD COLUMN converted_to_job_id"
key_files:
  created:
    - supabase/migrations/053a_customers_jobs_inquiries.sql
  modified: []
decisions:
  - "Created inquiries before jobs to resolve circular FK (inquiries.converted_to_job_id ↔ jobs.originated_as_inquiry_id); converted_to_job_id added via ALTER TABLE after jobs exists"
  - "D-12a: activity_log.event_type strict enum deliberately deferred to 053b / Plan 08 — 053a only adds 3 new FK columns; enum coercion needs backfill coverage verified first"
  - "D-19: merge_snapshot JSONB column on customers stores repointed child IDs at merge time so unmerge_customer RPC can reverse exactly those rows (not a blanket UPDATE)"
  - "customer_calls / job_calls NOT published to Realtime — derived/junction data; dashboard reads them in joined queries only (Claude's discretion per CONTEXT)"
  - "invoices.job_id left NULLABLE per Pitfall 1 — Plan 08 surveys COUNT WHERE lead_id IS NOT NULL AND job_id IS NULL before deciding NOT NULL enforcement"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-21T09:53:48Z"
  tasks_completed: 2
  tasks_total: 3
  files_created: 1
  files_modified: 0
  status: "PAUSED at Task 3 (blocking human-verify checkpoint — schema push to live Supabase)"
---

# Phase 59 Plan 02: Migration 053a Create + Backfill Summary

Migration `053a_customers_jobs_inquiries.sql` written and committed — CREATE tables, RLS, Realtime, indexes for 6 new tables, plus complete backfill from legacy `leads`/`lead_calls` applying D-13a/b/c rules. Paused at blocking schema-push checkpoint awaiting operator action.

## What Was Built

### Task 1: CREATE TABLE (6 tables) + RLS + Realtime + Indexes

`supabase/migrations/053a_customers_jobs_inquiries.sql` — 376-line transaction-wrapped migration:

**Tables created:**

| Table | Key constraints | Purpose |
|-------|----------------|---------|
| `customers` | `UNIQUE(tenant_id, phone_e164)`, `merged_into`, `merged_at`, `merge_snapshot` | D-05 dedup key + D-19 soft-delete + undo |
| `inquiries` | `status CHECK('open','converted','lost')` | D-07 unbooked calls; 3-state enum |
| `jobs` | `appointment_id NOT NULL`, `UNIQUE(appointment_id)` | D-06 strict 1:1 with appointments |
| `customer_calls` | `PRIMARY KEY (customer_id, call_id)` | D-16 junction |
| `job_calls` | `PRIMARY KEY (job_id, call_id)` | D-16 junction |
| `customer_merge_audit` | `unmerged_at NULLABLE`, `row_counts JSONB NOT NULL DEFAULT '{}'` | D-19 permanent audit log |

**Circular FK resolution:**
- `inquiries` created first (without `converted_to_job_id`)
- `jobs` created with `originated_as_inquiry_id REFERENCES inquiries(id)`
- `ALTER TABLE inquiries ADD COLUMN converted_to_job_id REFERENCES jobs(id)` closes the circle

**RLS:** 12 policies total (2 per table: `tenant_own` + `service_role_all`). `customer_calls` and `job_calls` policies join through `customers`/`jobs` since they have no direct `tenant_id` column.

**Realtime:** `customers`, `jobs`, `inquiries` published with `REPLICA IDENTITY FULL`. `customer_calls`, `job_calls`, `customer_merge_audit` NOT published (derived/audit-only per Claude's discretion).

**New FK columns on existing tables:**
- `invoices.job_id` (NULLABLE per Pitfall 1; Plan 08 decides NOT NULL)
- `activity_log.customer_id`, `activity_log.job_id`, `activity_log.inquiry_id` (all NULLABLE; Plan 08 enforces NOT NULL on customer_id after coverage verified)

### Task 2: Backfill from legacy leads/lead_calls

**Customers (D-13b):** `GROUP BY (tenant_id, from_number)` — one customer per unique phone per tenant. `array_agg(caller_name ORDER BY created_at DESC)[1]` gives latest-wins name/address. No quality filtering (D-13c).

**Jobs:** All leads with `appointment_id IS NOT NULL`. Status mapping: `new/booked → scheduled`, `completed → completed`, `paid → paid`, `lost → lost`.

**Inquiries (D-13a):** All orphan leads (`appointment_id IS NULL`). Status preserved verbatim: `open → open`, `lost → lost`, `new/followup → open` (inbox-state mapping), `converted → converted`.

**Junctions:** `customer_calls` and `job_calls` backfilled from `lead_calls` via join through `leads + customers/jobs`.

**invoices.job_id:** `UPDATE invoices SET job_id = j.id FROM leads l JOIN jobs j ON j.appointment_id = l.appointment_id WHERE i.lead_id = l.id`.

**activity_log FKs:** `UPDATE activity_log SET customer_id = c.id, job_id = ... , inquiry_id = ...` matching via `lead_id`.

All INSERTs include `ON CONFLICT DO NOTHING` (D-02 idempotency).

## Status: PAUSED at Task 3 (Blocking Schema Push)

Task 3 is a `checkpoint:human-verify` gate — operator must run the pre-audit SQL, push the migration to live Supabase, and validate post-push row counts. See checkpoint details below.

## Deviations from Plan

### Design Decisions Made During Implementation

**1. [Rule 2 - Circular FK] Inquiries created before jobs; converted_to_job_id via ALTER TABLE**
- **Found during:** Task 1 implementation
- **Issue:** `jobs.originated_as_inquiry_id` references `inquiries(id)` and `inquiries.converted_to_job_id` references `jobs(id)` — circular. Creating both tables with inline FK references would fail (one must exist before the other is created).
- **Fix:** Created `inquiries` first (without `converted_to_job_id` inline), then `jobs` (with `originated_as_inquiry_id REFERENCES inquiries`), then `ALTER TABLE inquiries ADD COLUMN converted_to_job_id REFERENCES jobs(id)`. Standard Postgres circular FK pattern.
- **Files modified:** `supabase/migrations/053a_customers_jobs_inquiries.sql`
- **Commit:** a411018

## Threat Flags

No new threat surface beyond what the plan's `<threat_model>` documents (T-59-02-01 through T-59-02-09). All mitigations applied:
- 12 RLS policies covering all 6 new tables (T-59-02-01, T-59-02-02)
- `ON CONFLICT DO NOTHING` idempotency (T-59-02-03)
- No DROP statements — BEGIN/COMMIT wrap ensures atomic rollback on failure (T-59-02-08)

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| a411018 | feat | Migration 053a — CREATE 6 tables + RLS + Realtime + backfill (Tasks 1 + 2) |

## Self-Check

File verified:
- FOUND: supabase/migrations/053a_customers_jobs_inquiries.sql
- FOUND: commit a411018

## Self-Check: PASSED

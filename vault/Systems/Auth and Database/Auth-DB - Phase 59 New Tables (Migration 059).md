---
type: system
system: Auth and Database
status: current
description: "Six new tables added by 059_customers_jobs_inquiries.sql. Backfilled from legacy leads/lead_calls data. All use the tenant_id child RLS pattern + service_rol… Covers: `customers`; `jobs`; `inquiries`; `customer_calls`; `job_calls`; `customer_merge_audit`"
source: ".claude/skills/auth-database-multitenancy/SKILL.md § Phase 59: New Tables (Migration 059)"
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# Phase 59 New Tables (Migration 059)

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

Six new tables added by `059_customers_jobs_inquiries.sql`. Backfilled from legacy `leads`/`lead_calls` data. All use the tenant_id child RLS pattern + service_role bypass.

### `customers`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | gen_random_uuid() |
| `tenant_id` | uuid NOT NULL | FK → tenants CASCADE |
| `phone_e164` | text NOT NULL | E.164 normalized. UNIQUE(tenant_id, phone_e164) — D-05 dedup key |
| `name` | text | nullable |
| `default_address` | text | nullable |
| `email` | text | nullable |
| `notes` | text | nullable |
| `tags` | text[] | NOT NULL DEFAULT '{}' |
| `merged_into` | uuid | FK → customers(id) ON DELETE SET NULL — D-19 soft-delete |
| `merged_at` | timestamptz | nullable |
| `merge_snapshot` | jsonb | D-19 undo: exact child IDs moved at merge time |
| `lifetime_value` | numeric(12,2) | NOT NULL DEFAULT 0 — denormalized |
| `created_at`, `updated_at` | timestamptz | NOT NULL |

**Indexes**: `idx_customers_tenant_phone` on (tenant_id, phone_e164) WHERE merged_into IS NULL; `idx_customers_merged_at` on (merged_at) WHERE merged_into IS NOT NULL.

**Realtime**: `REPLICA IDENTITY FULL`. Published via `supabase_realtime`.

---

### `jobs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid NOT NULL | FK → tenants CASCADE |
| `customer_id` | uuid NOT NULL | FK → customers CASCADE |
| `appointment_id` | uuid NOT NULL | FK → appointments CASCADE. UNIQUE — 1:1 with appointments (D-06) |
| `originated_as_inquiry_id` | uuid | FK → inquiries ON DELETE SET NULL — D-10 same-call auto-convert audit |
| `status` | text NOT NULL | CHECK scheduled\|completed\|paid\|cancelled\|lost DEFAULT scheduled |
| `urgency` | text NOT NULL | CHECK emergency\|urgent\|routine DEFAULT routine |
| `revenue_amount` | numeric(10,2) | nullable |
| `is_vip` | boolean | NOT NULL DEFAULT false |
| `created_at`, `updated_at` | timestamptz | NOT NULL |

**Indexes**: `idx_jobs_tenant_status_created` on (tenant_id, status, created_at DESC); `idx_jobs_customer` on (customer_id).

**Realtime**: `REPLICA IDENTITY FULL`. Published via `supabase_realtime`.

---

### `inquiries`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid NOT NULL | FK → tenants CASCADE |
| `customer_id` | uuid NOT NULL | FK → customers CASCADE |
| `job_type` | text | nullable |
| `service_address` | text | nullable |
| `urgency` | text NOT NULL | CHECK emergency\|urgent\|routine DEFAULT routine |
| `status` | text NOT NULL | CHECK open\|converted\|lost DEFAULT open |
| `converted_to_job_id` | uuid | FK → jobs ON DELETE SET NULL — D-10 audit FK |
| `out_of_area` | boolean NOT NULL | DEFAULT false (074) — durable out-of-area flag; set by the agent's capture_lead tool via a follow-up service-role UPDATE, NOT by `record_call_outcome` (the 069-hardened RPC is untouched) |
| `created_at`, `updated_at` | timestamptz | NOT NULL |

**D-07a**: Open inquiries stay open indefinitely — owner's responsibility to convert or mark lost. No cron, no auto-timeout, no visual staleness flag.

**Indexes**: `idx_inquiries_tenant_status_created` on (tenant_id, status, created_at DESC); `idx_inquiries_customer` on (customer_id).

**Realtime**: `REPLICA IDENTITY FULL`. Published via `supabase_realtime`.

---

### `customer_calls`

| Column | Type | Notes |
|--------|------|-------|
| `customer_id` | uuid NOT NULL | FK → customers CASCADE. Part of composite PK |
| `call_id` | uuid NOT NULL | FK → calls CASCADE. Part of composite PK |

A call always links to one customer. **NOT in Realtime publication** (derived junction data). RLS traverses through customers.

---

### `job_calls`

| Column | Type | Notes |
|--------|------|-------|
| `job_id` | uuid NOT NULL | FK → jobs CASCADE. Part of composite PK |
| `call_id` | uuid NOT NULL | FK → calls CASCADE. Part of composite PK |

A call links to a job only when the job path was taken. **NOT in Realtime publication**. RLS traverses through jobs.

---

### `customer_merge_audit`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | gen_random_uuid() |
| `tenant_id` | uuid NOT NULL | FK → tenants CASCADE |
| `source_customer_id` | uuid NOT NULL | FK → customers CASCADE |
| `target_customer_id` | uuid NOT NULL | FK → customers CASCADE |
| `merged_by` | uuid | FK → auth.users(id), nullable — service-role merges have no user |
| `merged_at` | timestamptz | NOT NULL DEFAULT now() |
| `unmerged_at` | timestamptz | NULL — set by unmerge_customer; row NEVER deleted |
| `row_counts` | jsonb NOT NULL | `{jobs, inquiries, invoices, activity_log, customer_calls, job_calls}` counts at time of merge |

**Retention: FOREVER** (D-19 expanded). `unmerge_customer` marks `unmerged_at` — never deletes the row. History of all consolidations is always reconstructible.

**Indexes**: `idx_customer_merge_audit_tenant_merged_at` on (tenant_id, merged_at DESC); `idx_customer_merge_audit_source` on (source_customer_id) WHERE unmerged_at IS NULL.

**NOT in Realtime publication** (admin/audit data). Admin view at `/dashboard/admin/merges`.

---

---
type: system
system: Auth and Database
status: current
description: "Three SECURITY DEFINER functions in 060_phase59_rpcs.sql. All follow the pattern from 027_lock_rpc_functions.sql: REVOKE EXECUTE FROM PUBLIC; GRANT EXECUTE T… Covers: `record_call_outcome` (D-14 / D-10 / D-16); `merge_customer` (D-19 + D-19 expanded audit); `unmerge_customer` (D-19 7-day undo)"
source: ".claude/skills/auth-database-multitenancy/SKILL.md § Phase 59: RPCs (Migration 060)"
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# Phase 59 RPCs (Migration 060)

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

Three SECURITY DEFINER functions in `060_phase59_rpcs.sql`. All follow the pattern from `027_lock_rpc_functions.sql`: `REVOKE EXECUTE FROM PUBLIC; GRANT EXECUTE TO service_role`. Dashboard NEVER calls these directly — all calls route through service-role API routes.

### `record_call_outcome` (D-14 / D-10 / D-16)

```sql
CREATE OR REPLACE FUNCTION record_call_outcome(
  p_tenant_id       uuid,
  p_phone_e164      text,
  p_caller_name     text,
  p_service_address text,
  p_appointment_id  uuid,        -- NULL → inquiry path; NOT NULL → job path
  p_urgency         text,
  p_call_id         uuid,
  p_job_type        text DEFAULT NULL
) RETURNS jsonb
```

**Returns**: `{customer_id, job_id, inquiry_id}` — job_id null on inquiry path; inquiry_id null on job path.

**Atomically**:
1. UPSERTs customer by (tenant_id, phone_e164) — COALESCE preserves existing name/address
2. Inserts job (if appointment_id present) OR inquiry (if absent)
3. Links call → customer via customer_calls
4. Links call → job via job_calls (job path only)

**Callers**: Python LiveKit agent (`src/post_call/write_outcome.py` → `record_outcome()` async helper). This is the **sole write path** for post-call data — replaces `create_or_merge_lead()`.

**D-02a**: No dual-write. After 059 ships, all writers use this RPC exclusively. Legacy `leads` table received zero new rows during the 059→061 window.

**D-02b**: Forward-fix-only rollback. If the agent fails, patch + redeploy — do NOT revert migration.

---

### `merge_customer` (D-19 + D-19 expanded audit)

```sql
CREATE OR REPLACE FUNCTION merge_customer(
  p_tenant_id uuid,
  p_source_id uuid,
  p_target_id uuid,
  p_merged_by uuid DEFAULT NULL   -- auth.users.id of initiating owner; NULL for service-role merges
) RETURNS jsonb
```

**Returns**: `{source_id, target_id, audit_id, moved_counts: {jobs, inquiries, invoices, activity_log, customer_calls, job_calls}}`

**Atomically**:
1. Validates: no self-merge; source + target both belong to tenant and not already merged
2. Counts rows per child table (for audit)
3. Builds `merge_snapshot` (exact child IDs) stored in `source.merge_snapshot` for undo
4. Target-wins field merge using latest `updated_at` (COALESCE — target wins on conflicts)
5. Repoints all children (jobs, inquiries, activity_log, customer_calls) to target
6. Soft-deletes source (`merged_into = target_id`, `merged_at = now()`)
7. INSERTs one permanent row into `customer_merge_audit`

**Callers**: `/api/customers/[id]/merge` API route (service-role). UI uses `audit_id` to navigate to admin Merges view.

---

### `unmerge_customer` (D-19 7-day undo)

```sql
CREATE OR REPLACE FUNCTION unmerge_customer(
  p_tenant_id uuid,
  p_source_id uuid
) RETURNS jsonb
```

**Returns**: `{source_id, restored_from, audit_id}`

**Atomically**:
1. Reads source's `merge_snapshot` — validates merged and within 7-day window
2. Reverse-repoints ONLY the specific IDs captured at merge time (not blanket UPDATE)
3. Restores source: clears `merged_into`, `merged_at`, `merge_snapshot`
4. Marks `customer_merge_audit.unmerged_at = now()` — **NEVER deletes the audit row**

**7-day window**: If `merged_at < now() - interval '7 days'`, raises `merge_window_expired`. After expiry: forward-fix only.

**Callers**: `/api/customers/[id]/unmerge` API route (service-role). UnmergeBanner on customer detail page surfaces the action within the 7-day window.

---

---
type: system
system: Auth and Database
status: current
description: "D-01 same-day gate: 059 and 061 shipped same PR/same day after Python agent verified writing via record_call_outcome (live test call gate)."
source: ".claude/skills/auth-database-multitenancy/SKILL.md § Phase 59: Migration Entries (059 / 060 / 061)"
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# Phase 59 Migration Entries (059 060 061)

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

| Migration | Purpose |
|-----------|---------|
| `059_customers_jobs_inquiries.sql` | CREATE 6 new tables + RLS + Realtime + indexes + backfill from leads/lead_calls + new FK columns on invoices and activity_log |
| `060_phase59_rpcs.sql` | 3 SECURITY DEFINER RPCs: record_call_outcome, merge_customer, unmerge_customer |
| `061_drop_legacy_leads.sql` | CREATE TYPE activity_event_type (16 values) + ALTER COLUMN event_type coercion + DROP COLUMN lead_id from activity_log + invoices + estimates + DROP TABLE lead_calls + leads |

**D-01 same-day gate**: 059 and 061 shipped same PR/same day after Python agent verified writing via `record_call_outcome` (live test call gate).

**D-02b forward-fix-only**: No down-migration exists or will be written for any Phase 59 migration. If something breaks post-061, fix forward.

**Backfill rules (D-13a/b/c)**:
- **D-13a Orphan leads** (no appointment_id) → inquiries with status preserved verbatim
- **D-13b Duplicate-phone leads** → collapse to ONE customer per (tenant_id, phone_e164); latest name/address wins
- **D-13c Test/spam data** → backfilled as-is; no quality filtering; owner cleans up post-cutover

---

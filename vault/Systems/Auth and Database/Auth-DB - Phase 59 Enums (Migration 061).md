---
type: system
system: Auth and Database
status: current
description: "Strict enum created by 061_drop_legacy_leads.sql (D-12a). The activity_log.event_type column was coerced to this type using a CASE mapping; unknown legacy va… Covers: `activity_event_type`"
source: ".claude/skills/auth-database-multitenancy/SKILL.md § Phase 59: Enums (Migration 061)"
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# Phase 59 Enums (Migration 061)

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

### `activity_event_type`

Strict enum created by `061_drop_legacy_leads.sql` (D-12a). The `activity_log.event_type` column was coerced to this type using a CASE mapping; unknown legacy values fell through to `'other'`.

**16 starting values** (additions require a future migration — deliberate friction keeps analytics clean):

```
call_received       inquiry_opened      inquiry_converted   inquiry_lost
job_booked          job_completed       job_paid            job_cancelled
customer_created    customer_updated    customer_merged     customer_unmerged
invoice_created     invoice_paid        invoice_voided      other
```

**+2 values added by migration 071 (2026-06-12) — now 18 total**: `integration_fetch` and `integration_fetch_fanout`. The Python agent's Phase 58 integration telemetry had been INSERTing these since Phase 58, but every insert failed the enum cast silently (verified live: 0 rows ever written). `ALTER TYPE ... ADD VALUE IF NOT EXISTS` sits outside 071's transaction (Postgres restriction).

**Usage**: Insert via `'event_name'::activity_event_type`. Postgres enforces at the TYPE level — invalid values raise an error. Event-specific payload in `activity_log.metadata` JSONB.

---

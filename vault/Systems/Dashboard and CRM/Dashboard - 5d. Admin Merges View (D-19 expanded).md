---
type: system
system: Dashboard and CRM
status: legacy-app
description: "Route: /dashboard/admin/merges"
source: .claude/skills/dashboard-crm-system/SKILL.md § 5d. Admin Merges View (D-19 expanded)
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# 5d. Admin Merges View (D-19 expanded)

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

**Route**: `/dashboard/admin/merges`

**API**: `GET /api/admin/merges`

Admin-only. Reads `customer_merge_audit` rows (tenant-scoped).
**NOT linked from sidebar or BottomTabBar** — discoverable only via:
- Direct URL
- CustomerDetailHeader overflow menu "View merge history" entry

Surfaces:
- All merge events for the tenant (active, expired-undo-window, successfully-unmerged)
- `merged_at`, `unmerged_at` (NULL = still merged or window expired), `merged_by`
- `row_counts` JSONB per child table
- Links to source and target customer detail pages

**Retention semantics**: `customer_merge_audit` rows are retained forever.
`unmerged_at` marks a successful undo but does NOT delete the row. The view
shows the complete history of all consolidations for audit/legal purposes.

---

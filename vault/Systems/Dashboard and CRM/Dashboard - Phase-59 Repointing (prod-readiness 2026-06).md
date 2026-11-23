---
type: system
system: Dashboard and CRM
status: legacy-app
description: "Three smaller wiring fixes that finished the Phase-59 entity migration:"
source: .claude/skills/dashboard-crm-system/SKILL.md § 22. Phase-59 Repointing (prod-readiness 2026-06)
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Phase-59 Repointing (prod-readiness 2026-06)

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

Three smaller wiring fixes that finished the Phase-59 entity migration:

- **`GET /api/dashboard/stats`** (`src/app/api/dashboard/stats/route.js`) —
  the "new" tile (`newLeadsCount` / `newLeadsPreview`) now counts/previews
  **open `inquiries`** (`status='open'`, joined to `customers` for
  name/phone), not the dropped `leads` table. Response keys keep their legacy
  `newLeads*` names; the preview is flattened to `caller_name` / `from_number`
  so the existing home tile renders unchanged. (2026-06-10 added
  `missedCallsToday` + `invoiceOverdueAmount` to the same route — see
  Section 16 — consumed by the nav attention badges and MoneySnapshot.)
- **Global search customers group** — see Section 21.
- **`HelpDiscoverabilityCard`** (`src/components/dashboard/HelpDiscoverabilityCard.jsx`)
  — the 4 "Where do I…" quick-link tiles now point at live routes:
  `/dashboard/services`, `/dashboard/more/ai-voice-settings`,
  `/dashboard/more/notifications`, `/dashboard/more/billing` (no stale
  `/dashboard/analytics` or `leads` links).

---

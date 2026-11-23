---
type: system
system: Dashboard and CRM
status: legacy-app
description: "Phase 59 entity model: DB entities are now customers, jobs, inquiries. All internal symbols match (job_id, customer_id, inquiry_id). The old leads/leadId/lea…"
source: .claude/skills/dashboard-crm-system/SKILL.md § 18. Key Design Decisions
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Key Design Decisions

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

- **Phase 59 entity model**: DB entities are now `customers`, `jobs`, `inquiries`. All internal symbols match (`job_id`, `customer_id`, `inquiry_id`). The old `leads`/`leadId`/`lead_id` symbols are gone — do NOT reintroduce them.
- **D-07a open inquiries**: Never add a cron, auto-timeout, or visual staleness flag to open inquiries without a new phase decision. Inbox model — owner manages triage.
- **Admin Merges view is intentionally hidden**: Only accessible via direct URL or CustomerDetailHeader overflow menu. Not linked from sidebar or BottomTabBar. Do NOT add a nav link without explicit decision.
- **Merge is irreversible after 7 days**: UnmergeBanner disappears after 7 days. The audit row persists forever but the undo action is unavailable. Forward-fix only after window expires (D-02b posture applied to merge undo as well).
- **Single source of truth for copy**: user-facing Jobs copy lives in
  components; DB enum values + API routes match the new entity names.
  Never rename internal symbols without coordinated migration.
- **Fail-closed feature flags**: no Provider → `{ invoicing: false }`.
- **Progressive enhancement for checklist**: uniform `has_error` +
  `error_subtitle` emission lets the leaf renderer use direct property
  reads without nullish guards.
- **`Reconnect` precedence**: branch checked FIRST in `primaryLabel` logic
  (before `!item.required` → "Open settings") — connect_xero / connect_jobber
  are recommended, not required, but must show "Reconnect" when errored.
- **Server-component retry pattern**: `<ErrorState/>` + thin `'use client'`
  `<IntegrationsRetryButton/>` calling `useRouter().refresh()` — avoids
  converting whole server component to client.
- **Thin wrapper refactor**: when migrating hardcoded component to consume
  new primitive, keep wrapper's file name + export shape + prop interface.
  Internal wrappers (padding override div) acceptable.
- **Dark-mode-only semantic tokens** in new components — no hardcoded
  `bg-white`/`bg-stone-*`.
- **No card wrapper in layout** — each page controls its own card styling.
- **Analytics is gone forever (Phase 49)** — do not reintroduce
  `/dashboard/analytics` without a new phase.
- **Sidebar is desktop-only** — no mobile drawer. Mobile uses
  `BottomTabBar`.
- **Name clarity on calendar**: "Leads" renamed to "Jobs" everywhere in
  user-facing copy but DB enum `leads.status='booked'` rendered as
  "Scheduled" for pipeline clarity.

---

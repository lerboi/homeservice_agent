---
type: system
system: Dashboard and CRM
status: legacy-app
description: "Deleted in Phase 59: src/lib/leads.js (createOrMergeLead() / getLeads()), /api/leads/ routes, LeadFlyout.jsx, LeadCard.jsx, LeadFilterBar.jsx, LeadStatusPill… Covers: Call → Customer/Job data flow (Phase 59); Dashboard page structure (post-Phase 59/58/52/49)"
source: .claude/skills/dashboard-crm-system/SKILL.md § Architecture Overview
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Architecture Overview

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

| Layer | Files | Purpose |
|-------|-------|---------|
| **Dashboard pages** | `src/app/dashboard/` | Page routes nested under layout |
| **CRM components** | `src/components/dashboard/` | Job cards, status pills, flyouts, customer detail, merge UX, tour, setup checklist |
| **UI primitives** | `src/components/ui/` | shadcn primitives + Phase 58 polish (`empty-state.jsx`, `error-state.jsx`, `async-button.jsx`) |
| **API routes** | `src/app/api/{customers,jobs,inquiries,calls,escalation-contacts,setup-checklist,invoices,estimates,invoice-settings,chat,account,notification-settings,working-hours,call-routing}/` | Customer/Job/Inquiry CRUD, calls, escalation, checklist, invoices, chat, etc. |
| **Design system** | `src/lib/design-tokens.js` | Shared color palette + Phase 58 focus-visible ring token |
| **Realtime** | Supabase `supabase_realtime` publication | Live customers/jobs/inquiries/calls/appointments updates via WebSocket |

**Deleted in Phase 59**: `src/lib/leads.js` (`createOrMergeLead()` / `getLeads()`), `/api/leads/*` routes, `LeadFlyout.jsx`, `LeadCard.jsx`, `LeadFilterBar.jsx`, `LeadStatusPills.jsx`, `EmptyStateLeads.jsx`, `HotLeadsTile.jsx`, `src/lib/chatbot-knowledge/leads.md`.

### Call → Customer/Job data flow (Phase 59)

```
Call ends → Python LiveKit agent post-call pipeline → record_call_outcome RPC
  │
  ▼  UPSERT customers + INSERT jobs OR inquiries (Supabase, single round-trip)
  │
  ▼  Supabase Realtime broadcasts INSERT/UPDATE on customers/jobs/inquiries
  │
  ▼  Dashboard /dashboard/jobs OR /dashboard/calls (Callbacks view) subscribes → animates row
  │
  ▼  Customer detail page triple-subscribes: customers, jobs, inquiries filtered by customer_id
```

### Dashboard page structure (post-Phase 59/58/52/49)

```
layout.js                          DashboardSidebar (desktop) + BottomTabBar (mobile)
                                   + SetupChecklistLauncher + ChatbotSheet + DashboardTour
  │
  ├── page.js (/)                  Daily Ops hub (bento tiles: TodayAppointments, Calls, HotJobsTile, Usage)
  ├── jobs/page.js                 Status pill strip + filter bar + job list + JobFlyout
  ├── inquiries/page.js            Server redirect() → /dashboard/calls?view=callbacks (tab merged 2026-06-10)
  ├── customers/page.js            Customers LIST (prod-readiness 2026-06): search + customer rows → detail
  ├── customers/[id]/page.js       Customer detail: sticky header + 3 tabs (Activity / Jobs / Invoices) + Edit modal + Merge/Unmerge
  ├── calendar/page.js             CalendarView + ConflictAlertBanner + agenda + TimeBlocks + Jobber overlays
  ├── calls/page.js                Classic call log (default) + CallbacksStrip → Callbacks view (open-inquiries queue + InquiryFlyout)
  ├── invoices/                    List + new + detail + batch-review
  ├── estimates/                   List + new + detail (single-price or tiered)
  ├── services/page.js             Phase 58: first-class polished page (was redirect stub)
  ├── settings/page.js             Phase 58: first-class polished form (was redirect stub)
  ├── admin/merges/page.js         Admin-only: customer_merge_audit log (D-19 expanded) — NOT linked from sidebar
  └── more/page.js                 Config hub: quick-access + settings sections
      ├── more/services-pricing/   Full service table (DnD, urgency tags, bulk select)
      ├── more/working-hours/      WorkingHoursEditor
      ├── more/service-zones/      ServiceAreaManager (single "Service Area" editor)
      ├── more/escalation-contacts/ EscalationChainSection
      ├── more/notifications/      Notifications & Escalation preferences
      ├── more/ai-voice-settings/  SettingsAISection (phone + test call)
      ├── more/billing/            Plan, usage ring gauge, invoices
      ├── more/invoice-settings/   Business identity, tax, late fees, numbering
      ├── more/integrations/       Business Integrations — Calendar + Accounting/Jobs cards
      ├── more/call-routing/       Routing schedule, pickup numbers, Priority callers
      └── more/account/            Profile editor, account details, sign out
```

**Analytics routes deleted in Phase 49** (`/dashboard/analytics`,
`/dashboard/more/analytics`). Do not reintroduce.

---

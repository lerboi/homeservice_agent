---
type: system-index
system: Dashboard and CRM
status: legacy-app
repo: homeservice_agent
description: "Complete architectural reference for the Voco dashboard and CRM system — all dashboard pages (home, jobs tab, customers list + detail, calendar, calls with its Callbacks inquiries view, invoices, estimates, more/*), Phase 59 customer/job mo…"
source_skills: [dashboard-crm-system]
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Dashboard and CRM

Up: [[Home]] · [[Systems]]

> **How to use:** read this index, then open only the notes the task needs. After changing code in this system, update the matching note and set its `verified:` date.

**Status (2026-11-23):** legacy app. Deployed and unchanged; no customers use it. Read when working on the dashboard.

## Notes (from `dashboard-crm-system`)

| Note | Lines | Status | What is in it |
|---|---|---|---|
| [[Dashboard - Scope Notes (read first)]] | 90 | legacy-app | Inquiries → Calls merge (2026-06-10) — the Inquiries TAB no longer |
| [[Dashboard - Related skills]] | 16 | legacy-app | integrations-jobber-xero — BusinessIntegrationsClient rendering |
| [[Dashboard - Architecture Overview]] | 62 | legacy-app | Deleted in Phase 59: src/lib/leads.js (createOrMergeLead() / getLeads()), /api/leads/ routes, LeadFlyout.jsx, LeadCard.jsx, LeadFilterBar.jsx, LeadStatusPill… Covers: Call → Customer/Job data flow (Phase 59); Dashboard page structure (post-Phase 59/58/52/49) |
| [[Dashboard - Dashboard Layout]] | 83 | legacy-app | Dashboard Layout. Covers: Banners; Navigation; Attention badges (2026-06-10); FeatureFlagsProvider (Phase 53) |
| [[Dashboard - Guided Tour]] | 73 | legacy-app | File: src/components/dashboard/DashboardTour.jsx — wraps |
| [[Dashboard - Dashboard Home - Daily Ops Hub]] | 104 | legacy-app | Dashboard Home - Daily Ops Hub. Covers: 3a. CallReadinessCard (2026-06-21 onboarding revamp); AiNumberBanner (2026-06-13 onboarding-audit fix wave); Tile behavior (2026-06-10 UX wave); RecentActivityFeed (2026-06-10 rewrite) |
| [[Dashboard - Setup Checklist - Tiered Accordion + Overlay Launcher (Phase 48 to 2026-06-21 retier)]] | 96 | legacy-app | Onboarding revamp (2026-06-21): the checklist is organized by call-readiness Covers: Launcher; Accordion; Leaf — ChecklistItem (3-tier badge + Phase 58 red-dot); API — setup-checklist |
| [[Dashboard - Jobs Tab (Phase 59 - rewired to jobs table)]] | 106 | legacy-app | Jobs Tab (Phase 59 - rewired to jobs table). Covers: JobStatusPills; JobFilterBar; Batch invoicing failure UX (2026-06-10); JobFlyout (formerly LeadFlyout); HotJobsTile — "Needs follow-up" (2026-06-10 retitle); EmptyStateJobs |
| [[Dashboard - 5b. Inquiries - Callbacks view (merged into Calls, 2026-06-10)]] | 88 | legacy-app | 5b. Inquiries - Callbacks view (merged into Calls, 2026-06-10). Covers: D-07a Owner Responsibility Stance; InquiryStatusPills; API filters (UI consumer deleted); InquiryFlyout |
| [[Dashboard - 5c. Customer Detail Page (Phase 59 - new)]] | 72 | legacy-app | 5c. Customer Detail Page (Phase 59 - new). Covers: Layout; Realtime subscriptions (3); Edit Modal (D-18); Merge UX (D-19); UnmergeBanner (D-19) |
| [[Dashboard - 5d. Admin Merges View (D-19 expanded)]] | 21 | legacy-app | Route: /dashboard/admin/merges |
| [[Dashboard - 5e. Customers List Page (prod-readiness 2026-06 - new)]] | 46 | legacy-app | 5e. Customers List Page (prod-readiness 2026-06 - new). Covers: Data flow; Row shape (`CustomerRow`); Two accuracy caveats (DO NOT silently "fix" — they are known) |
| [[Dashboard - Calls Page]] | 75 | legacy-app | Calls Page. Covers: 2026-06-10 UX wave |
| [[Dashboard - Calendar Page]] | 92 | legacy-app | Calendar Page. Covers: 2026-06-10 rework — connections card + perf; Components orchestrated; Phase 57 — Jobber overlays; Visual hierarchy; Phase 58 error state; EmptyStateCalendar wrapper |
| [[Dashboard - Invoices + Estimates]] | 46 | legacy-app | Status tabs, summary metrics, search. Uses shared useDocumentList Covers: Invoice list — `src/app/dashboard/invoices/page.js`; Invoice detail — `src/app/dashboard/invoices/[id]/page.js`; Batch review — `src/app/dashboard/invoices/batch-review/page.js`; Estimates; Recurring (invoice-only) |
| [[Dashboard - Business Integrations Card (Phase 55 56 58)]] | 57 | legacy-app | Server Component: src/app/dashboard/more/integrations/page.js Covers: File map; BusinessIntegrationsClient 4-state machine; Phase 58 AsyncButton migration; Reconnect banner; JobberBookableUsersSection (Phase 57); Integrations page server component + retry |
| [[Dashboard - CRM Components]] | 58 | legacy-app | CRM Components. Covers: EscalationChainSection; WorkingHoursEditor; CalendarView; DashboardHomeStats |
| [[Dashboard - UI Polish Primitives (Phase 58 Plan 04)]] | 56 | legacy-app | UI Polish Primitives (Phase 58 Plan 04). Covers: EmptyState — `src/components/ui/empty-state.jsx`; ErrorState — `src/components/ui/error-state.jsx`; AsyncButton — `src/components/ui/async-button.jsx`; Focus-visible token migration; Phase 58 Plan 05 sweep |
| [[Dashboard - Design Tokens]] | 66 | legacy-app | Design Tokens. Covers: Sidebar tokens (2026-06-10 dark pass); Dark mode rules; Badge/chip dark pairing — CANONICAL pattern for new badges |
| [[Dashboard - Supabase Realtime]] | 59 | legacy-app | Supabase Realtime. Covers: Publication; Client subscription pattern (2026-06-12 resilience rework) |
| [[Dashboard - More Hub + Settings Panels - dashboard more]] | 70 | legacy-app | The flat 11-item MORE_ITEMS list was regrouped into THREE labeled Covers: More hub page (`/dashboard/more/page.js`) — three-section regroup (prod-readiness 2026-06); Settings route quick list; Quick access (mobile-only on `/more` hub) |
| [[Dashboard - Chatbot - ChatbotSheet]] | 27 | legacy-app | Chatbot - ChatbotSheet. Covers: RAG knowledge |
| [[Dashboard - API Route Index]] | 32 | legacy-app | API Route Index (Dashboard and CRM) |
| [[Dashboard - Migrations (CRM-specific)]] | 26 | legacy-app | Full migration catalog lives in auth-database-multitenancy. |
| [[Dashboard - Key Design Decisions]] | 33 | legacy-app | Phase 59 entity model: DB entities are now customers, jobs, inquiries. All internal symbols match (job_id, customer_id, inquiry_id). The old leads/leadId/lea… |
| [[Dashboard - Debugging playbook]] | 34 | legacy-app | Symptoms, likely causes and where to look when Dashboard and CRM misbehaves. |
| [[Dashboard - Chatbot Knowledge Corpus (Phase 59 split)]] | 31 | legacy-app | File: src/lib/chatbot-knowledge/index.js |
| [[Dashboard - Command Palette + Global Search]] | 46 | legacy-app | Command Palette + Global Search. Covers: Radix Dialog wrapping (prod-readiness 2026-06); Search groups (`/api/search`) |
| [[Dashboard - Phase-59 Repointing (prod-readiness 2026-06)]] | 19 | legacy-app | Three smaller wiring fixes that finished the Phase-59 entity migration: |
| [[Dashboard - Scope and change history]] | 108 | record | The former dashboard-crm-system skill's scope statement, preamble and running 'last updated' change history. Read only when you need to know when or why something changed. |

## Short sections

### Keeping this document updated

When modifying any file under `src/app/dashboard/`,
`src/components/dashboard/`, `src/app/api/{customers,jobs,inquiries,calls,escalation-contacts,setup-checklist,...}/`,
or `src/lib/design-tokens.js`, update the relevant sections here.

**For Xero/Jobber-specific changes:** update `integrations-jobber-xero`
first, then cross-ref here.

**For billing/Stripe-specific changes:** update `payment-architecture`.

**For calendar-sync-specific changes:** update `scheduling-calendar-system`.

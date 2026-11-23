---
type: system
system: Dashboard and CRM
status: legacy-app
description: "Inquiries → Calls merge (2026-06-10) — the Inquiries TAB no longer"
source: .claude/skills/dashboard-crm-system/SKILL.md § Scope Notes (read first)
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Scope Notes (read first)

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

- **Inquiries → Calls merge (2026-06-10)** — the Inquiries TAB no longer
  exists; its work queue lives inside the Calls page as the **"Callbacks"
  view** (`/dashboard/calls?view=callbacks`; legacy `?view=needs-reply` is
  accepted as an alias). The classic calls layout is the one default landing
  view — a same-day rework after user feedback REMOVED the original smart
  default + two-pill ViewSwitcher in favor of a compact CallbacksStrip.
  `/dashboard/inquiries/page.js` is a one-line server `redirect()` kept for
  old deep links / bookmarks / notification links. **Frontend surface merge
  only** — the inquiries data model, `/api/inquiries*` routes, voice-agent
  writes, dashboard stats, and customer-page inquiry surfaces are unchanged.
  `InquiryFilterBar.jsx` and `EmptyStateInquiries.jsx` deleted (only the old
  page used them). See Sections 5b and 6.
- **Prod-readiness 2026-06 (UX/IA repointing, branch `fix/prod-readiness-2026-06`)** —
  Closes Phase-59 follow-up gaps. Presentational / wiring only; no DB or entity changes:
  - **Customers LIST page** at `/dashboard/customers/page.js` — previously only the
    `[id]` detail page existed, so the 5 "Back to Customers" links scattered across
    the customer-detail surfaces all 404'd. The route now resolves. See Section 5e.
  - **Customers nav entry** added to `DashboardSidebar.jsx` (desktop, after Inquiries,
    `Contact` icon) and to the `/dashboard/more` mobile More menu under **Business**.
  - **More-tab regroup** — `/dashboard/more/page.js` flat 11-item list → THREE labeled
    sections (Business / AI & Calls / Billing & Money). All routes preserved 1:1; the
    `invoicing` flag still gates Invoice Settings + the Invoices/Estimates quick-access.
    See Section 14.
  - **CommandPalette a11y** — `CommandPalette.jsx` now renders inside the shared Radix
    `Dialog` (`src/components/ui/dialog.jsx`) for focus trap / focus restore / Escape /
    `role=dialog aria-modal`, replacing the hand-rolled overlay. Stale "leads" copy +
    icon updated to "customers". See Section 21.
  - **Phase-59 repointing** — `GET /api/dashboard/stats` "new" tile now counts **open
    inquiries** (was leads); `GET /api/search` returns a `type:'customers'` group;
    `HelpDiscoverabilityCard` quick-links point at live `/dashboard/*` routes.
- **Phase 59 (Customer/Job model separation, 2026-04-21)** — Full entity split.
  `leads` DB table **dropped** (migration 061). All prior Lead* component files
  **deleted**: `LeadStatusPills.jsx`, `LeadCard.jsx`, `LeadFlyout.jsx`,
  `LeadFilterBar.jsx`, `EmptyStateLeads.jsx`, `HotLeadsTile.jsx`. `/api/leads/*`
  routes **deleted**. Replaced by:
  - **Jobs tab** (`/dashboard/jobs`) — queries `jobs` table; uses `JobCard`,
    `JobFilterBar`, `JobStatusPills`, `EmptyStateJobs`, `HotJobsTile`
  - **Inquiries tab** (`/dashboard/inquiries`) — queries `inquiries` table; own pill
    strip + flyout; D-07a: stays open indefinitely (owner responsibility).
    **Merged into Calls as the Callbacks view on 2026-06-10** (see Scope
    Note above)
  - **Customer detail page** (`/dashboard/customers/[id]`) — sticky header + 3 tabs
    (Activity / Jobs / Invoices) + Edit modal + Merge/Unmerge UX
  - **Admin Merges view** (`/dashboard/admin/merges`) — `customer_merge_audit` rows
  - Chatbot knowledge corpus: `leads.md` deleted → `customers.md` + `jobs.md` +
    `inquiries.md` (inquiries.md includes stale-inquiry D-07a explanation)
- **Phase 52 (Leads → Jobs rename, 2026-04-17)** — user-facing copy used
  "Jobs"; `/dashboard/jobs` was the canonical URL. **Phase 59 fully supersedes
  Phase 52** — DB entity is now `jobs`, not `leads`. The 308 redirect from prior
  leads path in `next.config.js` is preserved. Display label for `scheduled`
  status is "Scheduled". Status pill order (Phase 59 Jobs):
  `Scheduled · Completed · Paid · (gap) · Cancelled · Lost` with `ml-2` gap.
- **Phase 49 (Dark mode + analytics removal, 2026-04-16)** — ThemeProvider
  wired in root layout; sidebar sun/moon toggle; semantic CSS variables
  (`--brand-accent`, `--brand-accent-hover`, `--selected-fill`,
  `--warm-surface`, `--sidebar-bg`); `@custom-variant dark :where(.dark, .dark *)`;
  150ms body crossfade. Analytics deleted entirely — no `/dashboard/analytics`
  route, no `AnalyticsCharts` / `EmptyStateAnalytics` components, sidebar
  nav entry + DashboardTour step + `analytics.md` chatbot doc removed.
- **Supporting accent palette (2026-06-21 — reduce orange monotony)** — added
  theme-aware CSS vars in `globals.css` alongside `--brand-accent`:
  `--accent-emerald` (progress/done/healthy), `--accent-sky` (scheduling),
  `--accent-teal` (calls), `--accent-violet` (follow-up/usage) — each with a
  lighter dark-mode shade. Copper stays the primary action/brand color (all
  `btn.primary` CTAs, FAB, focus ring, Essential badge). Applied on the home:
  DailyOpsHub tile icons (Appointments→sky, Calls→teal, Needs-follow-up→violet),
  UsageTile healthy bar→emerald (amber→red escalation unchanged), CallReadinessCard
  meter + call-ready success→emerald, SetupChecklist ring + call-ready note→emerald,
  ChecklistItem completed checks→emerald (was copper). Consumed via Tailwind
  arbitrary values `…-[var(--accent-*)]`. **Extended dashboard-wide** (audit→apply,
  24 sites / 13 files): Calendar today/now/scheduled-appt markers + WorkingHours
  availability bars + open-day rails + CalendarSync 'syncing' state + Connections
  header icon + RecurringBadge → sky; AiNumberBanner phone badge + ChatbotSheet
  header + user chat bubble + AudioPlayer scrub + voice-preview pause → teal;
  UsageRingGauge healthy arc + invoice-timeline icon → emerald; RecentActivityFeed
  inquiry/customer rows → violet. CTAs, focus rings, selected/active nav, and brand
  stayed copper (audit kept 92 of 116 copper usages).
- **Phase 58 (Setup checklist wiring + polish + skills, 2026-04-20)** —
  `ChecklistItem.jsx` gains red-dot + "Reconnect needed" error variant
  for `connect_xero` / `connect_jobber`; deriveChecklistItems emits
  `has_error` + `error_subtitle` uniformly. New UI primitives `EmptyState`,
  `ErrorState`, `AsyncButton` at `src/components/ui/*`. `focus.ring`
  design token migrated to `focus-visible:`. 7-page polish sweep with
  `loading.js` skeletons.
- **Recurring** — `RecurringSetupDialog.jsx` and `RecurringBadge.jsx`
  are **invoice-only** (migration 032). Wired in `/dashboard/invoices/*`.
  No recurring support for appointments.

---

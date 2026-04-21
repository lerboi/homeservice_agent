---
name: dashboard-crm-system
description: "Complete architectural reference for the Voco dashboard and CRM system — all dashboard pages (home, jobs tab, inquiries tab, customers, calendar, calls, invoices, estimates, more/*), Phase 59 customer/job model split (Jobs tab from jobs table, Inquiries tab from inquiries table, Customer detail page with Activity/Jobs/Invoices tabs + Edit modal + Merge/Unmerge UX + UnmergeBanner), admin /dashboard/admin/merges view (customer_merge_audit, D-19 expanded), D-07a owner-responsibility for open inquiries (no auto-timeout), setup checklist accordion (Phase 48) with Phase 58 red-dot error variant, Business Integrations card (Phase 55/56 — BusinessIntegrationsClient), Phase 57 overlays (JobberBookableUsersSection, JobberCopyBanner), Phase 58 UI polish primitives (EmptyState, ErrorState, AsyncButton, focus-visible ring token), design tokens (Phase 49 light+dark mode via CSS variables), ImpersonationBanner / BillingWarningBanner / TrialCountdownBanner, guided tour, FeatureFlagsProvider (Phase 53), Supabase Realtime integration. Use this skill whenever making changes to dashboard pages, customer management, job management, inquiry management, merge/unmerge UX, CRM components, escalation contacts, service management, setup checklist, business integrations card, design tokens, or UI polish patterns."
---

# Dashboard & CRM System — Complete Reference

This document is the single source of truth for the dashboard and CRM
system. Read this before making any changes to dashboard pages or CRM
components.

**Last updated**: 2026-04-21 (Phase 59 — customer/job model separation:
Jobs tab rewired to jobs table, new Inquiries tab, Customer detail page,
Merge/Unmerge UX, Admin Merges view, D-07a owner-responsibility stance,
chatbot corpus split into customers/jobs/inquiries)

---

## Scope Notes (read first)

- **Phase 59 (Customer/Job model separation, 2026-04-21)** — Full entity split.
  `leads` DB table **dropped** (migration 061). All prior Lead* component files
  **deleted**: `LeadStatusPills.jsx`, `LeadCard.jsx`, `LeadFlyout.jsx`,
  `LeadFilterBar.jsx`, `EmptyStateLeads.jsx`, `HotLeadsTile.jsx`. `/api/leads/*`
  routes **deleted**. Replaced by:
  - **Jobs tab** (`/dashboard/jobs`) — queries `jobs` table; uses `JobCard`,
    `JobFilterBar`, `JobStatusPills`, `EmptyStateJobs`, `HotJobsTile`
  - **Inquiries tab** (`/dashboard/inquiries`) — queries `inquiries` table; own pill
    strip + flyout; D-07a: stays open indefinitely (owner responsibility)
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

## Related skills

- `integrations-jobber-xero` — BusinessIntegrationsClient rendering
  details, setup-checklist Reconnect flow mechanics, Xero/Jobber OAuth,
  webhooks, caching, Python agent injection, telemetry. **Read this
  skill for anything on the integrations page or Reconnect flow.**
- `auth-database-multitenancy` — `leads` / `calls` / `appointments` /
  `activity_log` RLS, middleware guards, migration catalog.
- `payment-architecture` — billing page, Stripe Checkout Session, usage
  ring gauge, subscription gate, overage metering.
- `scheduling-calendar-system` — calendar events, slot calculation,
  TimeBlocks, Google/Outlook/Jobber calendar sync.
- `public-site-i18n` — landing page, pricing page, i18n config
  (dashboard itself is English-only; `src/messages/*` covers agent +
  notifications).

---

## Architecture Overview

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
  ▼  Dashboard /dashboard/jobs OR /dashboard/inquiries subscribes → animates row
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
  ├── inquiries/page.js            Status pill strip (Open/Converted/Lost) + filter bar + inquiry list + InquiryFlyout
  ├── customers/[id]/page.js       Customer detail: sticky header + 3 tabs (Activity / Jobs / Invoices) + Edit modal + Merge/Unmerge
  ├── calendar/page.js             CalendarView + ConflictAlertBanner + agenda + TimeBlocks + Jobber overlays
  ├── calls/page.js                Date-grouped expandable call cards + filters + summary stats
  ├── invoices/                    List + new + detail + batch-review
  ├── estimates/                   List + new + detail (single-price or tiered)
  ├── services/page.js             Phase 58: first-class polished page (was redirect stub)
  ├── settings/page.js             Phase 58: first-class polished form (was redirect stub)
  ├── admin/merges/page.js         Admin-only: customer_merge_audit log (D-19 expanded) — NOT linked from sidebar
  └── more/page.js                 Config hub: quick-access + settings sections
      ├── more/services-pricing/   Full service table (DnD, urgency tags, bulk select)
      ├── more/working-hours/      WorkingHoursEditor
      ├── more/service-zones/      ZoneManager
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

## 1. Dashboard Layout

**File**: `src/app/dashboard/layout.js` (Server) +
`src/app/dashboard/DashboardLayoutClient.jsx` (Client).

Split in Phase 53 so server-side feature-flag fetching happens once per
request without losing client-side interactivity.

- `layout.js` — Server Component: calls `getTenantId()` +
  `getTenantFeatures(tenantId)`. Fails closed: `features = { invoicing: false }`
  if no tenant.
- `DashboardLayoutClient.jsx` — wraps children in
  `<FeatureFlagsProvider value={features}>`, first wrapper inside the
  Suspense-compatible inner function. Mounts `ChatProvider`,
  `TooltipProvider`, `DashboardSidebar`, `BottomTabBar`, `GridTexture`,
  `DashboardTour`, `SetupChecklistLauncher`, banners.

### Banners

- `ImpersonationBanner` (z-40, amber) — rendered when `?impersonate=` query
  param is present; admin impersonation mode wraps layout in
  `pointer-events-none opacity-60`.
- `BillingWarningBanner` (z-39, amber) — `past_due` subscriptions, 3-day
  grace countdown + Stripe portal link.
- `TrialCountdownBanner` (z-39, blue >3d / amber ≤3d) — trial days +
  upgrade CTA.

### Navigation

**`DashboardSidebar`** — desktop-only (lg+). 7 nav items:
Home, Jobs, Inquiries, Calendar, Calls, Invoices, More. Sidebar stays navy in
both light/dark modes (`bg-[var(--sidebar-bg)]`). Between Ask Voco AI
button and Log Out: theme toggle (sun/moon) via `next-themes.setTheme`.

**`BottomTabBar`** — mobile-only (`lg:hidden`). 5 tabs: Home, Calls,
Jobs, Inquiries, More. **Calendar demoted to More overflow** (Phase 59 —
added Inquiries tab to BottomTabBar, Calendar moved to More menu to stay
at 5 tabs). Animated orange indicator (framer-motion spring).
Uses `bg-card border-t border-border` for dark-mode compatibility.
`data-tour="bottom-nav"`.

### FeatureFlagsProvider (Phase 53)

`src/components/FeatureFlagsProvider.jsx` — Context + `useFeatureFlags()`
hook. Mounted server-side per request. Default value:
`{ invoicing: false }` — fail-closed. Phase 53 consumers:
`DashboardSidebar`, `LeadFlyout`, `/dashboard/more/page.js`,
`/dashboard/more/features/page.js`. Phase 54 consumer:
`BusinessIntegrationsClient` (invoicing-aware status-line copy).

---

## 2. Guided Tour

**File**: `src/components/dashboard/DashboardTour.jsx` — wraps
`react-joyride` v3. Mounted at layout level for cross-tab persistence.

5 steps (Phase 49 removed Analytics step):
1. `[data-tour="home-page"]` — Command center
2. `[href="/dashboard/jobs"]` — Jobs tracking
3. `[href="/dashboard/calendar"]` — Calendar
4. `[href="/dashboard/calls"]` — Calls view
5. `[href="/dashboard/more"]` — Config hub (placement: top)

Brand orange spotlight (`#C2410C`). `disableAnimation` respects
`prefers-reduced-motion`. On FINISHED/SKIPPED:
`localStorage.setItem('gsd_has_seen_tour', '1')`.

Trigger via `window.dispatchEvent(new CustomEvent('start-dashboard-tour'))`.
Home page button only shows if `gsd_has_seen_tour` not set.

---

## 3. Dashboard Home — Daily Ops Hub

**File**: `src/app/dashboard/page.js`

Post-Phase-48 single-column daily ops hub. No setup/active mode branching
(setup lives in overlay launcher).

Structure:
```
Greeting (time-of-day + AI status pulse + optional tour button)
DailyOpsHub (bento: TodayAppointmentsTile, CallsTile, HotLeadsTile, UsageTile)
HelpDiscoverabilityCard (4 quick-link tiles)
RecentActivityFeed (wrapped in card.base)
```

- **CallsTile** (Phase 49): last 5 calls (no 24h window).
- **HotLeadsTile** (Phase 49): last 5 leads of any status (no `status=new` filter).

No sidebar, no grid. Responsive for free — children stack vertically.

---

## 4. Setup Checklist — Accordion + Overlay Launcher (Phase 48)

### Launcher

**File**: `src/components/dashboard/SetupChecklistLauncher.jsx`

- **Auto-open**: desktop only (≥1024px), first visit per session, only
  if incomplete. Gated by `sessionStorage['voco_setup_opened']`.
- **FAB** (circular copper): conic-gradient progress ring around edge,
  tabular-nums pending-count center. `aria-label="N steps left to finish setup"`.
- **Responsive**: Sheet `side="right"` on desktop, `side="bottom"` on mobile.
- **Complete state**: FAB hides entirely when `percent >= 100` or all
  dismissed.
- **Hidden during impersonation**: layout skips mount on `?impersonate=...`.

### Accordion

**File**: `src/components/dashboard/SetupChecklist.jsx`

Themed accordion with groups: profile, voice, calendar, billing. Each
theme shows its items; completion rolls up to a conic-gradient progress
ring. Per-item actions: Dismiss / Mark done / Jump. Window-focus refetch.

**Phase 58 contract comment** above `{themeItems.map(...)}` names
`has_error`, `error_subtitle`, and "red-dot" as Phase 58 CHECKLIST-01
forwarding fields — grep-anchored regression guard.

### Leaf — ChecklistItem (Phase 58 red-dot)

**File**: `src/components/dashboard/ChecklistItem.jsx`

Three variants (first match wins):

1. **Error (red-dot)** — `item.has_error === true`. Leading icon:
   `<span className="h-2 w-2 rounded-full bg-red-600 dark:bg-red-500" />`
   (decorative, aria-hidden). Subtitle between title and description:
   `<p className="text-xs font-medium text-red-600 dark:text-red-400 mt-1">{item.error_subtitle}</p>`
   renders "Reconnect needed". CTA: `primaryLabel = 'Reconnect'` — this
   branch is FIRST, precedes `!item.required` → "Open settings" because
   `connect_xero` / `connect_jobber` are recommended, not required.
2. **Complete** — `<CheckCircle2>` + muted label.
3. **Idle** — `<Circle>` + "Finish setup" CTA.

### API — setup-checklist

**File**: `src/app/api/setup-checklist/route.js`

- `fetchChecklistState` issues **4** `accounting_credentials` count
  queries per provider pair (Phase 58):
  - Healthy: `.is('error_state', null)`
  - Error: `.not('error_state', 'is', null)`
  Separate counts let auto-complete + `has_error` derive from
  independent row sets.
- `deriveChecklistItems` emits `has_error` + `error_subtitle` UNIFORMLY
  on every item. Non-error items get `has_error: false, error_subtitle: null`
  so leaf renderer never guards undefined.
- Phase 50 migration added `tenants.checklist_overrides` JSONB; API
  consumes for per-item `mark_done` + `dismiss` actions.

See `integrations-jobber-xero/references/dashboard-ui.md` for the full
Reconnect-flow interaction.

---

## 5. Jobs Tab (Phase 59 — rewired to jobs table)

**File**: `src/app/dashboard/jobs/page.js`

Client component. Status pill strip + filter bar + job list + Realtime
subscription on `jobs` table (filtered by `tenant_id`).

### JobStatusPills

**File**: `src/components/dashboard/JobStatusPills.jsx`

Horizontal pill strip. One pill per pipeline status with live count.
DB enum (`scheduled/completed/paid/cancelled/lost`) drives data. Display
labels: **Scheduled · Completed · Paid · (gap) · Cancelled · Lost**.
`ml-2` gap before Cancelled separates active from terminal states.
Phase 49 categorical dark-mode palette preserved. Clicking active pill
clears filter. Counts derived client-side from parent's `jobs` array.

### JobFilterBar

**File**: `src/components/dashboard/JobFilterBar.jsx`

Desktop (≥640px): inline flex-wrap (search, urgency Select, job type
Input, date range, Clear all). Mobile (<640px): search + Filters button
that opens a bottom Sheet. Status filter in `JobStatusPills`.

### JobFlyout (formerly LeadFlyout)

**File**: `src/components/dashboard/JobFlyout.jsx`

Right Sheet. On open: fetches `/api/jobs/${jobId}` (with transcript)
AND `/api/invoices?job_id=${jobId}` for linked-invoice check. Renders:

- Urgency badge + relative time
- Customer info (phone, timestamp) — links to `/dashboard/customers/[customerId]`
- Job details (job_type, service_address, triage layer/confidence)
- `AudioPlayer` recording URL
- `TranscriptViewer` (structured + text)
- Status `Select` + `RevenueInput` (for completed/paid)
- "Update Status" → `PATCH /api/jobs/${jobId}`
- **Create/View Invoice**: Create button when status completed or paid AND no linked invoice. View when linked.
- "Mark as Lost" with AlertDialog.

`URGENCY_STYLES`, `STATUS_LABELS`, `STATUS_OPTIONS`. `formatRelativeTime(iso)` helper.

### HotJobsTile

**File**: `src/components/dashboard/HotJobsTile.jsx`

Replaces `HotLeadsTile` (deleted in Phase 59). Queries `jobs` table —
last 5 jobs of any status. Wired in `DailyOpsHub`.

### EmptyStateJobs

**File**: `src/components/dashboard/EmptyStateJobs.jsx`

Thin wrapper delegating to shared `<EmptyState icon={Users} headline="No jobs yet"
... ctaHref="/dashboard/more/ai-voice-settings" />`. See Section 11.

---

## 5b. Inquiries Tab (Phase 59 — new)

**File**: `src/app/dashboard/inquiries/page.js`

Client component. Status pill strip + filter bar + inquiry list + Realtime
subscription on `inquiries` table (filtered by `tenant_id`).

### D-07a Owner Responsibility Stance

Open inquiries stay `open` indefinitely. **No cron, no auto-timeout, no
visual staleness flag in V1.** Matches "inbox" mental model — owner converts
or marks lost when ready. The Inquiries tab is the owner's responsibility to
triage. Revisit if owners report cognitive load from inbox filling up.

The chatbot knowledge doc `inquiries.md` includes a "Stale inquiries" section
explaining this D-07a policy.

### InquiryStatusPills

**File**: `src/components/dashboard/InquiryStatusPills.jsx`

Horizontal pill strip. Status enum: `open/converted/lost`. Display labels:
**Open · Converted · (gap) · Lost** with `ml-2` gap before Lost.

### InquiryFilterBar

**File**: `src/components/dashboard/InquiryFilterBar.jsx`

Search + urgency filter + date range. Default filter: `status=open`.

### InquiryFlyout

**File**: `src/components/dashboard/InquiryFlyout.jsx`

Right Sheet. Shows inquiry details, customer link, urgency badge,
transcript (if call linked), status Select. Actions:
- "Convert to Job" button → `POST /api/inquiries/${id}/convert` (creates Job + marks inquiry `converted`)
- "Mark as Lost" → `PATCH /api/inquiries/${id}` with `{status: 'lost'}`
- Links to customer detail page (`/dashboard/customers/[customerId]`)

---

## 5c. Customer Detail Page (Phase 59 — new)

**File**: `src/app/dashboard/customers/[id]/page.js`

### Layout

Sticky header + 3 tabs:

```
CustomerDetailHeader (sticky)
  name, phone, default_address, lifetime_value, outstanding_balance
  Jobber/Xero context badges (gracefully absent when not connected)
  Overflow menu: Edit, Merge into another, View merge history → /dashboard/admin/merges
  UnmergeBanner (shown when customer.merged_into is set on the TARGET — 7-day undo)

Tabs:
  Activity    Unified chronological timeline (calls + booking events + invoice events + notes)
  Jobs        JobCard list filtered by customer_id (Phase 49 pill palette)
  Invoices    Invoice list scoped to this customer (gated by features_enabled.invoicing — Phase 53)
```

### Realtime subscriptions (3)

```js
// Triple-subscribe (D-15):
supabase.channel(`customer-${id}`).on('postgres_changes', { table: 'customers', filter: `id=eq.${id}` }, ...)
supabase.channel(`jobs-${id}`).on('postgres_changes', { table: 'jobs', filter: `customer_id=eq.${id}` }, ...)
supabase.channel(`inquiries-${id}`).on('postgres_changes', { table: 'inquiries', filter: `customer_id=eq.${id}` }, ...)
```

### Edit Modal (D-18)

Full CRUD modal triggered by Edit button. Fields: name, default_address,
email, notes, tags. Phone is **read-only** — to "change" a customer's
phone the owner uses Merge. Save → `PATCH /api/customers/[id]`.
Modal pattern matches existing dashboard editing UX.

### Merge UX (D-19)

Secondary action in CustomerDetailHeader overflow menu ("Merge into another").
Flow:
1. Typeahead picker → select target customer
2. Preview dialog: "Will move: N jobs, M inquiries, K invoices, L calls.
   Name 'X' will become 'Y'. Undoable for 7 days."
3. Confirm → `POST /api/customers/[id]/merge` → `merge_customer` RPC
4. Response includes `audit_id` → UI can navigate to `/dashboard/admin/merges`

### UnmergeBanner (D-19)

Shown on the **target** customer's detail page when a merge has been
performed within the last 7 days. Surfaces undo button → `POST /api/customers/[id]/unmerge`
→ `unmerge_customer` RPC. After 7 days the banner disappears
(window expired — forward-fix only).

---

## 5d. Admin Merges View (D-19 expanded)

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

## 6. Calls Page

**File**: `src/app/dashboard/calls/page.js`

Date-grouped expandable call cards, search, filters, summary stats.
Calls table in Supabase Realtime publication (migration 041) with
`REPLICA IDENTITY FULL` so the page receives live INSERT/UPDATE events.

**Phase 58**: shared `<EmptyState icon={Phone} headline="No calls yet">`
wired to zero-data branch. Local helper renamed `CallsEmptyState` to
avoid shadowing the shared primitive. Filtered-empty branch keeps its
Clear-filters Button.

---

## 7. Calendar Page

**File**: `src/app/dashboard/calendar/page.js`

CalendarView + AppointmentFlyout + ConflictAlertBanner + agenda.
Month/Day toggle uses `bg-foreground text-background` (dark-mode safe).

### Components orchestrated

- `CalendarView` (week/day time grid, 7 AM–8 PM, 48px hour rows).
- `AppointmentFlyout` — Mark complete (emerald, two-step + "Skip &
  Complete"). Undo completion with AlertDialog.
- `TimeBlockSheet` — create/edit. Quick presets (Lunch/Personal/
  Errand/Vacation). Multi-day with `group_id`. "Sync to calendar"
  toggle. Group delete ("Delete all N days").
- `QuickBookSheet` — booking form. Two modes: slot-click (time
  pre-filled) and toolbar (editable).
- `ExternalEventSheet` — view Google/Outlook/Jobber events. "Open in
  {provider}" button.
- `ConflictAlertBanner`, `CalendarSyncCard`, `WorkingHoursEditor`.

### Phase 57 — Jobber overlays

- `JobberCopyBanner.jsx` — when tenant has Jobber connected +
  `jobber_bookable_user_ids` populated, banner explains read-only
  nature of Jobber visits on calendar.
- Jobber visits rendered as `calendar_events` with `provider='jobber'`
  (migration 055). AppointmentFlyout shows "From Jobber" overlay pill
  for these.

### Visual hierarchy

Blue appointments (z-10) > Violet external events (z-5) > Amber time
blocks (z-1) > Stone off-hours shading. All-day blocks/events in
dedicated row above hourly grid.

### Phase 58 error state

Top-level early-return renders `<ErrorState onRetry={fetchData}/>` when
`fetchError && !loading`. Top-level (not inline) because fetchData's
catch sets empty data — inline would show misleading empty grids.

### EmptyStateCalendar wrapper

`EmptyStateCalendar.jsx` is now a thin wrapper delegating to shared
`<EmptyState icon={Calendar} ... />`. Preserves `padding` + `onConnect`
props for backward compat (generic primitive hardcodes `py-16`; wrapper
applies outer padding-override div when non-default). Phase 58 Plan 05
wired `onConnect={() => setTimeBlockSheetOpen(true)}` so the callback
matches UI-SPEC §10.1 intent. Copy alignment ("Add a time block") is a
tiny deferred wrapper update.

---

## 8. Invoices + Estimates

### Invoice list — `src/app/dashboard/invoices/page.js`

Status tabs, summary metrics, search. Uses shared `useDocumentList`
hook + `DocumentListShell` primitives.

### Invoice detail — `src/app/dashboard/invoices/[id]/page.js`

HTML preview + Send button. Status transitions (`sent_at`, `paid_at`).

### Batch review — `src/app/dashboard/invoices/batch-review/page.js`

`?ids=id1,id2,...` pattern. Per-invoice edit/remove. "Send All" with
AlertDialog → `POST /api/invoices/batch-send` with `{ invoice_ids }`.
Progress bar + per-invoice success/failure results.

### Estimates

Full list (tabs: draft/sent/approved/declined/expired), summary cards,
mobile cards. Tiered estimates (`estimate_tiers` + `estimate_line_items`)
with `TierEditor`. Single-price ⇄ tiered mode transition. Tax rate from
`invoice_settings`.

Estimate detail (70/30 split): `EstimatePreview` + actions card. Convert
to invoice — idempotent via `converted_to_invoice_id`; tiered requires
`tier_id` in POST.

### Recurring (invoice-only)

`RecurringSetupDialog.jsx` + `RecurringBadge.jsx` wired in
`/dashboard/invoices/*` only. Migration 032 columns
`is_recurring_template` + `recurring_*`. Cron handles generation.
**No recurring support for appointments.**

---

## 9. Business Integrations Card (Phase 55/56/58)

### File map

- Server Component: `src/app/dashboard/more/integrations/page.js`
- Client child: `src/components/dashboard/BusinessIntegrationsClient.jsx`
- Retry helper (Phase 58): `src/components/dashboard/IntegrationsRetryButton.jsx`
- Jobber bookable users (Phase 57): `src/components/dashboard/JobberBookableUsersSection.jsx`

### BusinessIntegrationsClient 4-state machine

Each provider card (Xero, Jobber) renders one of:

| State | Trigger | Render |
|-------|---------|--------|
| **disconnected** | no `accounting_credentials` row | Connect `<AsyncButton pendingLabel="Connecting…">` |
| **connecting** | local `isConnecting` | `<AsyncButton pending>` spinner + disabled |
| **connected** | row + `error_state IS NULL` | "Connected as {tenant_name}" + Last synced + Disconnect `<AsyncButton pendingLabel="Disconnecting…">` |
| **error-degraded** | row + `error_state = 'token_refresh_failed'` | Reconnect banner + Reconnect `<AsyncButton pendingLabel="Reconnecting…">` + Disconnect |

Last synced: `formatDistanceToNow(parseISO(row.last_context_fetch_at))`.
Written by Python adapter on successful fetch — see
`integrations-jobber-xero/references/python-agent-injection.md`.

### Phase 58 AsyncButton migration

All 4 action buttons migrated from ad-hoc `<Button disabled={isX}>{isX ? <Loader2 /> : "Label"}</Button>`
to shared `<AsyncButton>`. Unicode `…` single glyph (NOT `...`) is
grep-enforced via UI-SPEC §10.5.

### Reconnect banner

When any provider in `error-degraded`, Alert at top:
```jsx
<Alert variant="destructive">
  <AlertTitle>Reconnect needed</AlertTitle>
  ...
</Alert>
```

### JobberBookableUsersSection (Phase 57)

When Jobber connected, sub-section lets owner pick which employees'
schedules mirror. Reads + writes `accounting_credentials.jobber_bookable_user_ids`
via PATCH `/api/integrations/jobber/bookable-users`.

### Integrations page server component + retry

`page.js` wraps `getIntegrationStatus(tenantId)` in try/catch. On error:
renders `<ErrorState/>` + `<IntegrationsRetryButton/>` (client island
calling `useRouter().refresh()`).

For full Xero/Jobber OAuth + refresh + webhook + caching coverage, see
the **`integrations-jobber-xero`** skill — that skill consolidates
architecture that previously lived scattered across Phase 55/56/57
summaries.

---

## 10. CRM Components

### EscalationChainSection

**File**: `src/components/dashboard/EscalationChainSection.js`

CRUD + drag-to-reorder (`@dnd-kit`). Max 5 active contacts. Pattern:
`SortableContactWrapper` wraps `useSortable` and passes drag props to
`ContactCard` (which stays DnD-unaware). Save order via
`PATCH /api/escalation-contacts` with `{ order: [{ id, sort_order }] }`.
Per-urgency mapping rows via `Switch` (display-only). Emergency locked.

### WorkingHoursEditor

**File**: `src/components/dashboard/WorkingHoursEditor.js`

- Weekly overview bar chart (`ScheduleBar` per day, 6 AM–10 PM).
- Controlled preset dropdown — `activePreset = useMemo(detectPreset(hours))`.
- Timezone selector (grouped Select: US, Canada, Asia-Pacific, Europe).
- Enabled days: white bg, orange left border. Disabled: gray bg.
- Break as inline pill with Clock icon + time inputs.
- Copy popover: "All weekdays" + "Select all" quick-actions above
  per-day checkboxes.
- Sticky save bar (z-30, `lg:left-60`) slides up via `translate-y`
  when `isDirty`.
- Mobile: stacked time inputs with "Opens"/"Closes" labels.
- Save: `PUT /api/working-hours` with `{ working_hours, slot_duration_mins, tenant_timezone }`.

### CalendarView

**File**: `src/components/dashboard/CalendarView.js`

CSS grid: `grid-cols-[48px_repeat(7,1fr)]` week, `grid-cols-[48px_1fr]` day.
HOUR_HEIGHT=48px week, 48px day.

Blocks: `AppointmentBlock` (urgency color), `TravelBufferBlock` (dashed
stone), `ExternalEventBlock` (purple — Google/Outlook), Jobber visit
events (Phase 57, `provider='jobber'`). `CurrentTimeIndicator` — orange
line updated every minute via `setInterval`.

Position: `getPositionStyle(startTime, endTime)` → `top`/`height`.

### DashboardHomeStats

**File**: `src/components/dashboard/DashboardHomeStats.jsx`

4 stat widgets: New Leads Today, Upcoming Appointments, Calls Today,
Conversion Rate. `requestAnimationFrame` counter animation (600ms,
ease-out cubic). Stagger: `index * 80ms`. `prefers-reduced-motion`
skips animation.

---

## 11. UI Polish Primitives (Phase 58 Plan 04)

Under `src/components/ui/`:

### EmptyState — `src/components/ui/empty-state.jsx`

POLISH-01. Icon + headline required; description / ctaLabel / ctaHref /
ctaOnClick optional. `ctaHref` renders `asChild Button Link`;
`ctaOnClick` renders `Button` with handler. No CTA without `ctaLabel`.
Icon `aria-hidden="true"`. Tailwind semantic tokens only.

Wrappers delegate to it:
- `EmptyStateLeads.jsx` (17 lines) — icon=Users, headline="No jobs yet"
- `EmptyStateCalendar.jsx` — icon=Calendar with `padding` + `onConnect`
  props preserved for backward compat.

### ErrorState — `src/components/ui/error-state.jsx`

POLISH-04. `role="alert"` outer; `AlertTriangle` icon
(`h-8 w-8 text-destructive/70`); fixed "Something went wrong" headline;
default "We couldn't load this. Please try again." (Unicode apostrophe);
retry Button only when `onRetry` provided, `retryLabel` defaults to
"Try again".

### AsyncButton — `src/components/ui/async-button.jsx`

POLISH-05. Wraps shadcn `<Button>`. `pending || disabled` both disable;
when pending renders `Loader2 animate-spin` + swaps label to
`pendingLabel ?? children`. All Button props spread through (variant,
size, onClick, type, className, asChild).

### Focus-visible token migration

**File**: `src/lib/design-tokens.js`

`focus.ring` export migrated (Phase 58 POLISH-03):
```js
// Old:
ring: 'focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1'
// New (Phase 58):
ring: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--background)]'
```

Keyboard-only reveal (not on mouse click) + dark-mode offset blending.
All consumers that import `{ focus }` pick up the change automatically.

### Phase 58 Plan 05 sweep

7 dashboard pages now have layout-matching `loading.js` Next.js skeletons
using the shared `<Skeleton>` primitive (`src/components/ui/skeleton.jsx`):
jobs, calls, calendar, services, settings, more/integrations, more/billing.

All 7 pages surface `<ErrorState onRetry>` on fetch failure. `services`
and `settings` were promoted from redirect stubs to first-class polished
pages (setup-checklist deep-links already hit these routes).

---

## 12. Design Tokens

**File**: `src/lib/design-tokens.js`

Phase 49 rewrite: all hex literals replaced with `var(--*)` references.
CSS variables defined in `globals.css`, flip between light/dark via
`.dark` class on `<html>`.

```js
export const colors = {
  brandOrange: 'var(--brand-accent)',          // #C2410C light / brighter dark
  brandOrangeDark: 'var(--brand-accent-hover)',
  navy: 'var(--sidebar-bg)',                    // #0F172A both modes
  warmSurface: 'var(--warm-surface)',
  bodyText: 'var(--muted-foreground)',
};
```

Other tokens: `btn`, `card`, `glass`, `gridTexture`, `focus` (Phase 58
focus-visible), `selected`. Consumers read via named import only — do
not inline hex codes in dashboard components.

### Dark mode rules

- NO hardcoded `bg-white` / `bg-stone-*` / `text-stone-*` without `dark:`
  variants. Use semantic tokens: `bg-card`, `bg-muted`, `bg-background`,
  `text-foreground`, `text-muted-foreground`, `border-border`.
- Sidebar stays navy in both modes (`bg-[var(--sidebar-bg)]`).
- `URGENCY_STYLES` in CalendarView has full dark variants.
- `@custom-variant dark :where(.dark, .dark *)` in `globals.css`.
- 150ms body crossfade on theme change.

---

## 13. Supabase Realtime

### Publication

`supabase_realtime` publication covers:

| Table | Added in | Purpose |
|-------|----------|---------|
| `leads` | 004 | **DROPPED** (migration 061) — superseded by customers/jobs/inquiries |
| `customers` | 059 | Live customer updates (`REPLICA IDENTITY FULL`) |
| `jobs` | 059 | Live job updates on jobs tab (`REPLICA IDENTITY FULL`) |
| `inquiries` | 059 | Live inquiry updates on inquiries tab (`REPLICA IDENTITY FULL`) |
| `calls` | 041 | Live call updates on calls page (`REPLICA IDENTITY FULL`) |
| `appointments` | (standard) | Calendar live updates |
| `calendar_events` | 057 | Provider='jobber' schedule-mirror live updates |

**NOT published** (derived/audit-only): `customer_calls`, `job_calls`, `customer_merge_audit`.

### Client subscription pattern

```js
// Jobs tab — src/app/dashboard/jobs/page.js
const channel = supabase
  .channel(`jobs-${tenantId}`)
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'jobs',
        filter: `tenant_id=eq.${tenantId}` },
      (payload) => handleRealtimeEvent(payload))
  .subscribe();

// Inquiries tab — src/app/dashboard/inquiries/page.js
const channel = supabase
  .channel(`inquiries-${tenantId}`)
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'inquiries',
        filter: `tenant_id=eq.${tenantId}` },
      (payload) => handleRealtimeEvent(payload))
  .subscribe();

// Customer detail — triple-subscribe (customers + jobs + inquiries by customer_id)
// See Section 5c for subscription details.
```

Cleanup via `channel.unsubscribe()` in effect return.

---

## 14. Settings Panels — /dashboard/more/*

### Quick list

- `/more/services-pricing` — full service table (DnD, urgency tags,
  bulk select).
- `/more/working-hours` — `WorkingHoursEditor`.
- `/more/service-zones` — `ZoneManager` (geographic zones + travel buffers).
- `/more/escalation-contacts` — `EscalationChainSection`.
- `/more/notifications` — per-outcome SMS/email Switch grid
  (booked/declined/not_attempted/attempted × SMS/email).
- `/more/ai-voice-settings` — `SettingsAISection` (phone number + test call).
- `/more/billing` — plan card, usage ring gauge, invoices. Phase 58
  `ErrorState onRetry={refetchBilling}` (mutates both SWR caches).
- `/more/invoice-settings` — business identity, tax, late fees, defaults,
  numbering.
- `/more/integrations` — Business Integrations (see Section 9).
- `/more/call-routing` — schedule, pickup numbers, **Priority Callers**
  unified list merging `tenants.vip_numbers` (standalone) +
  `leads.is_vip=true` (lead-based). Brand "Priority"; DB keeps "vip".
  See `voice-call-architecture` skill for webhook-side routing.
- `/more/account` — profile editor, account details, sign out.

### Quick access (mobile-only on `/more` hub)

`Ask Voco AI` button (fires `window.dispatchEvent(new Event('open-voco-chat'))`)
+ `Invoices` / `Estimates` quick-access links (desktop sidebar entries
but not mobile bottom-bar tabs).

---

## 15. Chatbot — ChatbotSheet

**File**: `src/components/dashboard/ChatbotSheet.jsx`

Sheet wrapper. Mounted in layout under `ChatProvider` for cross-route
persistence. Opened via `open-voco-chat` window event.

- **Responsive**: right Sheet on desktop, bottom Sheet on mobile.
- **`ChatMessage`**: user/AI variants. `parseMessageContent()` extracts
  links; `ChatNavLink` renders Next.js Link chips with onNavigate
  callback.
- **`TypingIndicator`**: three-dot pulse, `role="status"`, reduced-motion
  support.
- **API**: `POST /api/chat` — auth via `getTenantId()`, RAG retrieval,
  Groq Llama 4 Scout completion.

### RAG knowledge

**File**: `src/lib/chatbot-knowledge/index.js`

- `ROUTE_DOC_MAP` (14 routes) — matches pathname.
- `KEYWORD_DOC_MAP` (9 keyword groups) — keyword search in user
  message.
- Returns up to 2 matched docs.
- Phase 52 reframed 8 markdown docs: `/dashboard/jobs` URLs + "Jobs"
  noun throughout.

---

## 16. API Route Index

| Route | File | Purpose |
|-------|------|---------|
| `GET /api/leads` | **DELETED** (Phase 59) | Replaced by /api/jobs + /api/inquiries |
| `GET/PATCH /api/leads/[id]` | **DELETED** (Phase 59) | Replaced by /api/jobs/[id] + /api/inquiries/[id] |
| `GET /api/customers` | `src/app/api/customers/route.js` | Filtered + paginated customer list |
| `GET/PATCH /api/customers/[id]` | `src/app/api/customers/[id]/route.js` | Customer detail + update |
| `POST /api/customers/[id]/merge` | same dir | Calls merge_customer RPC; returns audit_id |
| `POST /api/customers/[id]/unmerge` | same dir | Calls unmerge_customer RPC (7-day window) |
| `GET /api/jobs` | `src/app/api/jobs/route.js` | Filtered + paginated; NO transcript_text |
| `GET/PATCH /api/jobs/[id]` | `src/app/api/jobs/[id]/route.js` | Full job WITH transcript; status/revenue update |
| `GET /api/inquiries` | `src/app/api/inquiries/route.js` | Filtered + paginated; default status=open |
| `GET/PATCH /api/inquiries/[id]` | `src/app/api/inquiries/[id]/route.js` | Inquiry detail + status update |
| `POST /api/inquiries/[id]/convert` | same dir | Convert inquiry to job (manual offline flow) |
| `GET /api/admin/merges` | `src/app/api/admin/merges/route.js` | Tenant-scoped customer_merge_audit rows (admin-only) |
| `GET /api/calls` | `src/app/api/calls/route.js` | Filtered (date, urgency, outcome, search) |
| `GET/PATCH /api/escalation-contacts` | `src/app/api/escalation-contacts/route.js` | CRUD + reorder |
| `GET/PATCH /api/setup-checklist` | `src/app/api/setup-checklist/route.js` | Derived items + dismiss/mark-done |
| `GET/POST /api/estimates` | `src/app/api/estimates/route.js` | List + create (single/tiered) |
| `GET/PATCH/DELETE /api/estimates/[id]` | same dir | Detail + update + delete-draft |
| `POST /api/estimates/[id]/send` | same dir | PDF via Resend + optional SMS |
| `POST /api/estimates/[id]/convert` | same dir | Idempotent convert to invoice |
| `GET/PATCH /api/invoice-settings` | same pattern | Business identity, tax, numbering |
| `POST /api/chat` | `src/app/api/chat/route.js` | RAG + Groq chat |
| `GET/PATCH /api/account` | `src/app/api/account/route.js` | Tenant profile |
| `GET/PATCH /api/notification-settings` | same pattern | `notification_preferences` JSONB |
| `PUT /api/working-hours` | same pattern | `working_hours` + `slot_duration_mins` + `tenant_timezone` |
| `GET/PATCH /api/call-routing` | same pattern | Schedule + pickup + dial_timeout + `vip_numbers` |

---

## 17. Migrations (CRM-specific)

| Migration | Purpose |
|-----------|---------|
| `004_leads_crm.sql` | `leads`, `lead_calls`, `activity_log` tables + Realtime — **SUPERSEDED by 059+061** |
| `005_setup_checklist.sql` | `tenants.setup_checklist_dismissed` column |
| `006_escalation_contacts.sql` | `escalation_contacts` + `services.sort_order` |
| `032_recurring_invoices.sql` | Invoice recurrence columns |
| `041_calls_realtime.sql` | Calls table in Realtime with `REPLICA IDENTITY FULL` |
| `042_call_routing_schema.sql` | Phase 39 — call_forwarding_schedule, pickup_numbers |
| `045_sms_messages_and_call_sid.sql` | Phase 40 — sms_messages table, calls.call_sid |
| `049_vip_caller_routing.sql` | Phase 46 — tenants.vip_numbers JSONB + leads.is_vip + sparse idx |
| `050_checklist_overrides.sql` | Phase 48 — `tenants.checklist_overrides` JSONB |
| `051_features_enabled.sql` | Phase 53 — per-tenant feature flags |
| `052_integrations_schema.sql` | Phase 54 — accounting_credentials |
| `053_xero_error_state.sql` | Phase 55 — error_state column |
| `054_external_account_id.sql` | Phase 56 — webhook tenant resolution |
| `055_jobber_schedule_mirror.sql` | Phase 57 — calendar_events provider='jobber' |
| `057_calendar_events_realtime.sql` | Phase 57 — calendar_events in Realtime publication |
| `058_oauth_refresh_locks.sql` | Phase 55 — OAuth refresh race elimination |
| `059_customers_jobs_inquiries.sql` | Phase 59 — CREATE customers/jobs/inquiries/customer_calls/job_calls/customer_merge_audit + backfill |
| `060_phase59_rpcs.sql` | Phase 59 — record_call_outcome + merge_customer + unmerge_customer RPCs |
| `061_drop_legacy_leads.sql` | Phase 59 — DROP TABLE leads/lead_calls + activity_event_type enum + DROP COLUMN lead_id |

Full migration catalog lives in `auth-database-multitenancy`.

---

## 18. Key Design Decisions

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

## 19. Debugging playbook

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Jobs tab shows no data | Realtime subscription on wrong table (old `leads`) | Check subscription uses `table: 'jobs'` not `table: 'leads'` |
| Inquiries tab always empty | Default filter may be excluding non-open | Check `status=open` default filter; verify `inquiries` Realtime subscription |
| Customer detail page flickers on activity | Only one of 3 Realtime channels subscribed | Ensure triple-subscribe: customers + jobs + inquiries filtered by customer_id |
| UnmergeBanner not showing | Checking `source.merged_into` instead of target's perspective | Banner should appear on TARGET customer page, not source |
| Merge throws "source_invalid" | Source already merged OR wrong tenant | Check `customers.merged_into IS NULL` before initiating merge |
| Admin merges page 404 | Not admin user OR navigating without admin gate | Route is `/dashboard/admin/merges`; ensure verifyAdmin() passes |
| HotJobsTile shows "No jobs" after Phase 59 deploy | DailyOpsHub still importing deleted HotLeadsTile | Fix import to `HotJobsTile` |
| Setup checklist item shows red-dot without "Reconnect needed" subtitle | `error_subtitle` not emitted uniformly OR `has_error` missing | Check `deriveChecklistItems` returns both fields; see 58-02 |
| BusinessIntegrationsClient stuck on "Connecting…" | Callback didn't `revalidateTag('integration-status-${tenantId}')` | See `integrations-jobber-xero/references/caching.md` |
| Calendar shows empty grids on error instead of retry affordance | `fetchError` state missing | Top-level `<ErrorState onRetry={fetchData}/>` early-return |
| Hardcoded `focus:ring-2` on new component | Missed Phase 58 POLISH-03 sweep | Import `{ focus }` from `@/lib/design-tokens` or use `focus-visible:` directly |
| `<EmptyState>` import shadows local helper | Name collision | Rename local → `<PageName>EmptyState`; delegate zero-data to shared primitive |
| Invoices/estimates batch-review 404 | Missing `?ids=` query param | Expected — route requires ID list |
| Recurring setup dialog for appointment | Not supported — invoice-only | Disambiguate user intent before implementation |
| Dashboard dark-mode regression | Hardcoded `bg-white`/`bg-stone-*` without `dark:` variant | Swap to `bg-card`/`bg-muted` semantic tokens |

---

## 20. Chatbot Knowledge Corpus (Phase 59 split)

**File**: `src/lib/chatbot-knowledge/index.js`

Phase 59 replaced `leads.md` with three separate files:

| File | Covers |
|------|--------|
| `customers.md` | Customer dedup, merge/unmerge, customer detail page, phone immutability |
| `jobs.md` | Job lifecycle (scheduled→completed→paid), job cards, invoice link |
| `inquiries.md` | Inquiry lifecycle (open→converted/lost), D-07a stale-inquiry owner-responsibility policy, conversion flow |

`ROUTE_DOC_MAP` updated: `/dashboard/jobs` → `jobs.md`, `/dashboard/inquiries` → `inquiries.md`, `/dashboard/customers/*` → `customers.md`. `KEYWORD_DOC_MAP` updated with new entity keywords.

---

## Keeping this document updated

When modifying any file under `src/app/dashboard/`,
`src/components/dashboard/`, `src/app/api/{customers,jobs,inquiries,calls,escalation-contacts,setup-checklist,...}/`,
or `src/lib/design-tokens.js`, update the relevant sections here.

**For Xero/Jobber-specific changes:** update `integrations-jobber-xero`
first, then cross-ref here.

**For billing/Stripe-specific changes:** update `payment-architecture`.

**For calendar-sync-specific changes:** update `scheduling-calendar-system`.

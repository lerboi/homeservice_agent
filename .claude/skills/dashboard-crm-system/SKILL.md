---
name: dashboard-crm-system
description: "Complete architectural reference for the Voco dashboard and CRM system — all dashboard pages (home, jobs tab, customers list + detail, calendar, calls with its Callbacks inquiries view, invoices, estimates, more/*), Phase 59 customer/job model split (Jobs tab from jobs table, inquiries surfaced as the Callbacks view inside Calls since the 2026-06-10 merge, Customers list page + Customer detail page with Activity/Jobs/Invoices tabs + Edit modal + Merge/Unmerge UX + UnmergeBanner), admin /dashboard/admin/merges view (customer_merge_audit, D-19 expanded), D-07a owner-responsibility for open inquiries (no auto-timeout), setup checklist (Phase 48; 2026-06-21 onboarding revamp — retiered into Essential/Recommended/Optional, CallReadinessCard home indicator, auto-start tour) with Phase 58 red-dot error variant, Business Integrations card (Phase 55/56 — BusinessIntegrationsClient), Phase 57 overlays (JobberBookableUsersSection, JobberCopyBanner), Phase 58 UI polish primitives (EmptyState, ErrorState, AsyncButton, focus-visible ring token), prod-readiness 2026-06 UX/IA repointing (Customers list route, More-tab three-section regroup, CommandPalette Radix Dialog a11y, dashboard/stats 'new' = open inquiries, global search customers group), design tokens (Phase 49 light+dark mode via CSS variables), ImpersonationBanner / BillingWarningBanner / TrialCountdownBanner, guided tour, FeatureFlagsProvider (Phase 53), Supabase Realtime integration. Use this skill whenever making changes to dashboard pages, customer management, job management, inquiry management, merge/unmerge UX, CRM components, escalation contacts, service management, setup checklist, business integrations card, command palette, navigation/IA, design tokens, or UI polish patterns."
---

# Dashboard & CRM System — Complete Reference

This document is the single source of truth for the dashboard and CRM
system. Read this before making any changes to dashboard pages or CRM
components.

> ⚠️ **AI Voice picker (2026-06-12):** the picker
> (`VoicePickerSection.jsx`, `ai-voice-settings/page.js`, `src/lib/ai-voice-validation.js`)
> now offers the **3 stable labels** — `professional` / `friendly` / `local_expert` — with
> display names; the **stored value is the label**, paired with migration `070` (which
> replaced 067's OpenAI-name CHECK; apply 070 BEFORE deploying the picker). The Phase 66
> cascade agent maps labels → ElevenLabs voice ids via `ELEVENLABS_VOICE_MAP`. Preview-play
> files are `/audio/voices/{label}.mp3` — **assets pending** (not call-blocking). The earlier
> Phase 65 10-voice OpenAI picker is historical.

**Last updated**: 2026-06-20 (M16 P1 — "Service-Area gate", Capability A:
the multi-zone `ZoneManager` (+ `zone_travel_buffers` pairwise-buffer matrix)
and its `/api/zones` (+`[id]`) routes were **removed**, replaced by a single
`ServiceAreaManager` mounted at `/dashboard/more/service-zones` (page heading
"Service Zones & Travel" → **"Service Area"**) — a postal/ZIP-code chip input +
town/city chip input (comma/Enter to add), an out-of-area action select
(`callback` default: take a message & call back / `decline_referral`: politely
decline + optional referral / `trip_fee`: book but mention a possible travel
fee) with a conditional referral-note textarea (only for `decline_referral`),
and an explicit dirty-tracked **"Save service area"** button; backed by new
`GET/PUT /api/service-area`. Persists owner choice to `tenants.out_of_area_action`
+ `tenants.out_of_area_referral_note` (migration 074) and collapses
`service_zones` coverage (`postal_codes` + new `cities[]`) to one canonical row
on save. New durable `inquiries.out_of_area boolean` is set by the voice agent
when a caller's confirmed address is outside the Service Area — **persisted but
the Callbacks/CRM badge to surface it is a DEFERRED follow-up, not yet
displayed**.)

**2026-06-12 update**: (audit wave 1 dashboard fixes — (1) **Invoices/estimates pagination**: `useDocumentList` now paginates — `limit` grows 50 → 500 via a "Load more" button, `hasMore` derived from the API's `total_count`; a status-tab change resets the limit. The silent 50-row hard cap is gone. (2) **JobFlyout transcript + recordings work**: `getJob`'s detail select now includes `recording_storage_path`, `transcript_text`, `transcript_structured` (it previously selected none of them, so the flyout's TranscriptViewer was always empty and storage-path recordings never resolved). (3) **`job_type` UI removed everywhere** — the column never existed (migration 059): JobFilterBar input gone, JobCard/JobFlyout chips gone, jobs page param gone; the batch-invoice dialog now shows `service_address` instead. (4) **Realtime resilience**: ALL dashboard channels (calls ×2, jobs, customer-detail ×3, calendar ×2) now pass a status callback to `.subscribe()` and refetch on reconnect after `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`; INSERT events now trigger the page's fetch function instead of prepending the join-less Realtime payload — no more "Unknown" rows, and the phantom-field filter that silently dropped inserts is gone. (5) **AbortController everywhere**: the calendar page's abort pattern replicated in calls/jobs/customers/customer-detail fetches + CommandPalette search + CustomerMergeDialog typeahead. (6) **Mobile create-FABs** on invoices/estimates moved `bottom-6` → `bottom-20` (no longer cover the BottomTabBar). (7) **UnmergeBanner is ALWAYS mounted** on the customer detail page — it self-detects undoable merges via `/api/admin/merges` and renders null when inactive; the `merged_source_info` gate that could never be true is gone. (8) **Billing/Trial banners**: dismiss buttons removed; `BillingWarningBanner` gains a RED "AI receptionist is paused" suspended variant post-grace (see payment-architecture). (9) Voice picker → 3 labels (see banner above). (10) The stale untracked `src/app/dashboard/leads/` page (broken imports, pre-Phase-59 leftover) was deleted.)

**Previous update**: 2026-06-10 (b: calendar page rework — see §7 "2026-06-10
rework": `IntegrationReconnectBanner` + `JobberCopyBanner` DELETED, replaced
by the new `CalendarConnectionsCard` (calendars + Jobber/Xero rows with
inline Reconnect state, "Action needed" pill); single-row toolbar;
`initialLoading`/`fetching` state split kills the skeleton flash on
navigation; AbortController on fetchData; bottom cards now one responsive
grid; `jobberConnected` from `/api/integrations/status` SWR. Token-refresh
backend fixes same day → integrations-jobber-xero skill.)

**Same-day prior**: 2026-06-10 (Inquiries → Calls merge + same-day rework
after user feedback + dark-mode pass + dashboard UX wave — Inquiries tab
removed: `/dashboard/inquiries` is now a server redirect to
`/dashboard/calls?view=callbacks`; the queue is the **Callbacks** view
(renamed from "Needs reply") inside Calls. The classic calls layout is the
ONE default landing view — the smart default and the two-pill ViewSwitcher
were removed same-day; a compact brand-accent **CallbacksStrip** above the
stat cards (only when open count > 0) opens the Callbacks view, which has a
"← All calls" back control. URL: `?view=callbacks` explicit (legacy
`?view=needs-reply` accepted as alias), no param / `?view=all` → classic;
`InquiryFilterBar` + `EmptyStateInquiries` deleted; nav: sidebar drops
Inquiries, BottomTabBar re-promotes Calendar, Calls badge = combined
`callsAttention`; HotJobsTile CTAs + activity-feed inquiry events →
`?view=callbacks`; chatbot calls/inquiries/jobs docs rewritten +
ROUTE_DOC_MAP fix. Dark mode: neutral dark `--sidebar-bg`, new
`--sidebar-bg-border` token, calendar/UsageRingGauge hex→token sweep,
system-wide `dark:` badge pass (~107 spots / 26 files). Plus the same-day
UX wave: Home tiles repointed, TodayAppointmentsTile CTA+rows →
`/dashboard/calendar`, HotJobsTile retitled "Needs follow-up" (open
inquiries), CallsTile friendly copy + linked rows; RecentActivityFeed full
16-event map + deep links; new MoneySnapshot strip; nav attention badges
via `useAttentionCounts`; `/api/dashboard/stats` adds `missedCallsToday` +
`invoiceOverdueAmount`; jobs/inquiries `search` + date-range filters wired
server-side; calls transcript viewer + name-or-phone search +
plain-language copy; inquiry `converted` displayed as "Booked"; customer
tel: Call button; jobs batch-invoice failure → sonner toast)

**Prior update**: 2026-06-04 (prod-readiness 2026-06 — Customers LIST page
added at `/dashboard/customers` (closes 5 dead "Back to Customers" 404s);
sidebar + mobile More-menu Customers entry; More-tab regrouped into three
sections (Business / AI & Calls / Billing & Money); CommandPalette wrapped
in Radix Dialog for a11y + "leads"→"customers" copy; Phase-59 repointing of
dashboard/stats 'new' tile, global search customers group, and
HelpDiscoverabilityCard links)

**Earlier**: 2026-04-21 (Phase 59 — customer/job model separation:
Jobs tab rewired to jobs table, new Inquiries tab, Customer detail page,
Merge/Unmerge UX, Admin Merges view, D-07a owner-responsibility stance,
chatbot corpus split into customers/jobs/inquiries)

---

## Scope Notes (read first)

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
- `BillingWarningBanner` (z-39) — amber during the `past_due` 3-day grace
  countdown + Stripe portal link; once grace expires it switches to a **RED
  "Payment failed — your AI receptionist is paused" suspended variant**
  (2026-06-12 — the agent gate has stopped answering; the banner used to hide
  post-grace expecting a middleware redirect that never existed). **Not
  dismissible** (dismiss button removed 2026-06-12).
- `TrialCountdownBanner` (z-39, blue >3d / amber ≤3d) — trial days +
  upgrade CTA. **Not dismissible** (2026-06-12).

### Navigation

**`DashboardSidebar`** — desktop-only (lg+). 7 nav items (Inquiries
removed in the 2026-06-10 merge): Home, Jobs, **Customers** (prod-readiness
2026-06, `Contact` icon), Calendar, Calls, Invoices, More. The
Invoices entry is filtered out when `invoicing=false`
(`NAV_ITEMS.filter(...)`). Sidebar uses `bg-[var(--sidebar-bg)]` — navy in
light mode, neutral dark in dark mode (see Section 12). Between Ask Voco AI
button and Log Out: theme toggle (sun/moon) via `next-themes.setTheme`.

> **Note**: Customers is NOT a `BottomTabBar` tab (still 5 tabs on mobile).
> Mobile reaches Customers via the `/dashboard/more` Business section
> (see Section 14).

**`BottomTabBar`** — mobile-only (`lg:hidden`). 5 tabs: Home, Calls,
Jobs, **Calendar**, More. The Inquiries tab (Phase 59 / D-08) was removed
in the 2026-06-10 merge — its queue lives in Calls — and the freed slot
**re-promoted Calendar** (which Phase 59 had demoted to the More menu to
stay at the 5-tab mobile safe limit; it also remains in More → Business).
Animated orange indicator (framer-motion spring).
Uses `bg-card border-t border-border` for dark-mode compatibility.
`data-tour="bottom-nav"`.

### Attention badges (2026-06-10)

Both `DashboardSidebar` and `BottomTabBar` render ONE numeric attention
badge — on **Calls** — fed by **`src/hooks/useAttentionCounts.js`**, which
exports a combined **`callsAttention` = `openInquiries` (stats
`newLeadsCount` = open inquiries) + `missedCallsToday`** alongside the two
raw counts. (Pre-merge there were two badges: Inquiries=openInquiries,
Calls=missedCallsToday — the Inquiries nav item is gone, so Calls carries
the combined "needs you" count.)

Hook mechanics: `useSWRFetch('/api/dashboard/stats', { refreshInterval:
60_000, revalidateOnFocus: true })` — **same SWR key as the Home tiles**, so
sidebar + tab bar + tiles share one in-flight request. `formatBadgeCount()`
caps display at **"9+"**. Badge is brand-accent pill (`bg-[var(--brand-accent)]`,
`tabular-nums`), `aria-hidden`, **hidden entirely at 0**; the count is
surfaced to AT via the nav `Link`'s `aria-label` instead —
`"Calls, N need(s) attention"` (no `aria-label` when the count is 0).
Sidebar badge sits `ml-auto` in the row; tab-bar badge is absolutely
positioned on the icon.

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

Up to 6 steps (2026-06-21 onboarding revamp — adds the call-readiness step + auto-start):
1. **Welcome** — `target: 'body'`, `placement: 'center'` (modal: no spotlight, no scroll)
2. `[data-tour="ai-status"]` — AI status block (greeting row, `page.js`); placement `right` desktop / `bottom` mobile
3. `[data-tour="call-readiness"]` — the CallReadinessCard (essentials meter + next step); placement `bottom`. **Conditional**: included only when the card is in the DOM (it hides once the owner is fully set up). `buildSteps(desktop, hasReadiness)` takes a flag; the component computes `hasReadiness` in a `useMemo` keyed on `[run, desktop]` via `document.querySelector('[data-tour="call-readiness"]')`, so the DOM is read only when the tour starts (not via setState-in-effect, which the project bans).
4. `[data-tour="todays-appointments"]` — the Today's-Appointments hero tile (`DailyOpsHub.jsx`); placement `bottom`. (Anchors the compact hero tile, NOT the full `daily-ops-hub` bento, which is taller than the mobile viewport and would push the tooltip off-screen.)
5. Navigation — `[data-tour="sidebar-nav"]` (desktop, `right`) / `[data-tour="bottom-nav"]` (mobile, `top`)
6. **Finish** — `target: 'body'`, `placement: 'center'` ("You're all set 🎉")

**Auto-start (2026-06-21)**: brand-new users (no `gsd_has_seen_tour`) get the tour
automatically. `page.js` dispatches `start-dashboard-tour` from a `useEffect`,
deferred ~400ms via `setTimeout` so (a) the layout's listener is attached first
(child effects run before parent effects) and (b) the `data-tour` targets are
mounted before Joyride anchors them. A per-session
`sessionStorage['voco_tour_autostarted']` guard prevents re-firing on revisits.
The checklist Sheet no longer auto-opens, so the tour is the only first-visit overlay.

**Why this shape**: the old step 1 targeted `[data-tour="home-page"]` (the WHOLE
page container) with `placement: 'bottom'`, so the first tooltip rendered below
the entire page — the user had to scroll to the bottom to find it. Centered
welcome/finish modals + spotlights on compact, real elements fix that and let
react-joyride **smooth-scroll** each target into view (`scrollOffset: 96`,
`scrollDuration: 350`). `placement: 'center'` (verified in the v3 build) renders a
modal with neither spotlight nor scroll — ideal for intro/outro.

**Responsive targeting**: the nav exists twice in the DOM — desktop sidebar
(`hidden lg:flex`, `data-tour="sidebar-nav"`) and mobile bottom bar (`lg:hidden`,
`data-tour="bottom-nav"`). Step 4 points at whichever is rendered for the current
breakpoint, tracked via a `matchMedia('(min-width:1024px)')` listener + `useMemo`
(also drives `right` vs `top` placement). Any new element step must target a
compact, always-present node (avoid the full-page container) and, if it's the
nav, branch on the breakpoint.

**Polish/behavior**: per-step `title` (bold) + `content`; left-aligned tooltip
(`tooltipContainer textAlign:left`), `borderRadius 14`, soft shadow,
`1px solid var(--border)`, `width 360`, `spotlightPadding 8` + `spotlightRadius 12`,
`overlayColor rgba(0,0,0,.55)`, `zIndex 10000`. `blockTargetInteraction: true` +
`overlayClickAction: false` make the page non-interactive mid-tour so a stray
click can't derail it (advance only via Next/Back/Skip). `showProgress` is OFF
(clean `Next`/`Got it` buttons for a short tour).

**react-joyride v3 API notes** (v3 differs substantially from v2 — get these
wrong and the tooltip renders broken):
- Theme + behavior live in the **`options`** prop, not `styles.options`:
  `primaryColor`, `backgroundColor`, `textColor`, `arrowColor`, `zIndex`,
  `showProgress`, `skipBeacon`, and `buttons: ['skip','back','primary']`
  (v3 has no top-level `showSkipButton`/`showProgress`/`disableScrolling`/
  `disableAnimation` props — `'skip'` in `buttons` is how the skip button shows).
- Colors must reference the design tokens **directly** (`var(--popover)`) — the
  tokens are OKLCH, so the old `hsl(var(--popover))` wrapping produced invalid
  CSS. Tokens resolve inside joyride's body-level portal because `:root`/`.dark`
  are on `<html>`.
- `styles.buttonPrimary` (v2 was `buttonNext`); `styles.buttonBack`/`buttonSkip`.
- Tour end handled via the **`onEvent`** prop (v2 was `callback`); both receive
  `{ status }`. Per-step beacon suppression is `skipBeacon` (v2 `disableBeacon`).
- `Joyride` and `STATUS` are **named** exports in v3.

Brand orange primary/spotlight (`var(--brand-accent)` → `#C2410C` light /
`#FB923C` dark). On FINISHED/SKIPPED:
`localStorage.setItem('gsd_has_seen_tour', '1')`.

Trigger via `window.dispatchEvent(new CustomEvent('start-dashboard-tour'))`.
Home page button only shows if `gsd_has_seen_tour` not set.

**Install note**: `react-joyride` (`package.json` + lockfile) must actually be
present in `node_modules` — run `npm install` after a fresh checkout, or the
layout's `dynamic(() => import('./DashboardTour'))` silently fails and the
"Take the tour" button does nothing.

---

## 3. Dashboard Home — Daily Ops Hub

**File**: `src/app/dashboard/page.js`

Post-Phase-48 single-column daily ops hub. No setup/active mode branching
(setup lives in overlay launcher).

Structure:
```
Greeting (time-of-day + AI status pulse + optional tour button)
CallReadinessCard (onboarding progress indicator — see §3a; hides when set up)
AiNumberBanner (AI number + copy button / provisioning-failed alert)
DailyOpsHub (bento: TodayAppointmentsTile, CallsTile, HotJobsTile, UsageTile)
MoneySnapshot (invoice money strip — gated by invoicing flag)
HelpDiscoverabilityCard (4 quick-link tiles)
RecentActivityFeed (wrapped in card.base)
```

### 3a. CallReadinessCard (2026-06-21 onboarding revamp)

**File**: `src/components/dashboard/CallReadinessCard.jsx` — the prominent
home-page onboarding indicator. Answers "how close is my AI to fully taking and
booking calls?" and points at the single next action. Tracks **ESSENTIAL**
checklist items only (the call-readiness meter); recommended/optional steps live
in the full checklist behind "View all steps".

- Reads `/api/setup-checklist` (shared SWR key — no extra request) and the new
  `readiness` block (`essentialsTotal`, `essentialsComplete`, `callReady`); also
  recomputes essentials from the live `items` so an optimistic mark-done moves the
  meter instantly.
- **Not call-ready** → segmented essentials bar + "Next step" (the first
  incomplete essential) as a primary deep-link, plus a "View all setup steps"
  button that dispatches the `open-setup-checklist` window event (the launcher
  Sheet listens for it).
- **Call-ready** → calm success state ("You're call-ready"), an optional
  "N steps to go further" link (opens the Sheet), and a dismiss X. Dismissal is
  stored in `localStorage['voco_readiness_dismissed']`, read via
  `useSyncExternalStore` (project bans setState-in-effect); it only suppresses the
  success state — if an essential later lapses (e.g. billing), the not-ready card
  returns on its own.
- The live AI line status (active/paused) stays in the greeting row; this card is
  purely about setup completeness, so the two signals don't compete.
- Carries `data-tour="call-readiness"` for the guided-tour step (§2).

### AiNumberBanner (2026-06-13 onboarding-audit fix wave)

**File**: `src/components/dashboard/AiNumberBanner.jsx` — fetches `/api/account`
(which now returns `provisioning_failed`). Three states:
- **Number assigned** — Link card to `/dashboard/more/account` with the
  formatted number, forwarding nudge, and a **copy-to-clipboard button**
  (`e.preventDefault()` so the click doesn't navigate; Check icon for 2s).
- **No number + `provisioning_failed=true`** — amber `role="alert"` card:
  "We hit a snag assigning your AI number… team has been notified", support
  link. Previously a paying customer with failed provisioning saw NOTHING.
- **No number, not failed** — renders null (account page carries the
  "being assigned" copy, which now also has a failed-state variant and a
  support link instead of the old indefinite "within a minute" promise).

### Tile behavior (2026-06-10 UX wave)

- **TodayAppointmentsTile** — "View full schedule" CTA now links to
  `/dashboard/calendar` (was the dead `/dashboard/appointments` route).
  Each appointment row is a tappable `<Link href="/dashboard/calendar">`
  (`min-h-[44px]`, hover `bg-muted/50`, `focus.ring`).
- **CallsTile** — last 5 calls (no 24h window, Phase 49). The missed-calls
  block no longer leaks the raw `not_attempted` enum: copy is now
  `"needs callback"` / `"need callback"`. Missed + recent rows are tappable
  `<Link href="/dashboard/calls">` (`min-h-[44px]`). Outcome/Missed badges
  gained dark-mode variants (`dark:border-*-800/60 dark:bg-*-950/40
  dark:text-*-300`).
- **HotJobsTile** — retitled **"Needs follow-up"** (see Section 5; it shows
  open inquiries, not scheduled jobs).
- **MoneySnapshot** — local component in `page.js`. Compact `card.base` strip:
  **Outstanding · Overdue · Paid this month** (`invoiceOutstandingAmount`,
  `invoiceOverdueAmount` — red when > 0, `paidThisMonth` — emerald), wrapped
  in a single `<Link href="/dashboard/invoices">`. **Gated by the `invoicing`
  feature flag** (renders `null` when off or stats unloaded) and reads the
  shared `/api/dashboard/stats` SWR key — no extra request.

### RecentActivityFeed (2026-06-10 rewrite)

**File**: `src/components/dashboard/RecentActivityFeed.jsx`

- `EVENT_CONFIG` now covers **all 16 values of the `activity_event_type`
  strict enum** (migration 061): `call_received`, `inquiry_opened/converted/lost`,
  `job_booked/completed/paid/cancelled`, `customer_created/updated/merged/unmerged`,
  `invoice_created/paid/voided`, `other`. **Labels mirror
  `CustomerActivityTimeline.jsx`** so both surfaces speak the same language;
  icon tones come from a shared `TONES` map (accent/blue/emerald/amber/red/muted,
  all with dark variants).
- Each row shows the **caller/customer name from `metadata`**
  (`caller_name || customer_name || name`), joined with
  `metadata.job_type || metadata.invoice_number` as a `— detail` suffix.
- Rows are **deep links by event family** (`getHref`): `call_received` →
  `/dashboard/calls`, `inquiry_*` → `/dashboard/calls?view=callbacks`
  (Inquiries → Calls merge), `job_*` →
  `/dashboard/jobs`, `customer_*` → `/dashboard/customers/<customer_id>`
  (only when the row carries `customer_id`), `invoice_*` →
  `/dashboard/invoices` **gated on the `invoicing` flag** (unlinked when
  off). Rows without a resolvable href render as plain (non-link) items.
  Linked rows are `min-h-[44px]` with hover + `focus.ring`.

No sidebar, no grid. Responsive for free — children stack vertically.

---

## 4. Setup Checklist — Tiered Accordion + Overlay Launcher (Phase 48 → 2026-06-21 retier)

**Onboarding revamp (2026-06-21)**: the checklist is organized by **call-readiness
TIER**, not by settings theme. Three tiers (single source of truth = `TIER_GROUPS`
/ `TIER_ORDER` in the API route):

| Tier | Items | Meaning |
|------|-------|---------|
| **essential** | `setup_profile`, `configure_services`, `configure_hours`, `configure_zones` (Service Area), `setup_billing` | Gate "can my AI take and book calls properly?" — drive the CallReadinessCard meter |
| **recommended** | `connect_calendar`, `configure_call_routing`, `configure_notifications`, `setup_escalation`, `make_test_call` | Improve handling; AI still works on defaults |
| **optional** | `connect_xero`, `connect_jobber` | Integrations / power features |

`required` is derived per item as `tier === 'essential'` (back-compat with the
leaf's dismiss/CTA logic). `THEME_GROUPS`/`THEME_ORDER` are still **exported** (and
each item still carries a `theme`) for back-compat + the Phase-55 test asserting
`connect_xero` lives under the `voice` theme — but the UI no longer groups by theme.
`configure_zones` meta is now "Set up your service area" (the Service Area feature;
still detected by `service_zones` count > 0).

### Launcher

**File**: `src/components/dashboard/SetupChecklistLauncher.jsx`

- **No auto-open** (changed 2026-06-21): the always-visible CallReadinessCard is the
  surfaced guide now, so popping a Sheet on top of it (and, for new users, the tour)
  was redundant. The `voco_setup_opened` session gate is gone.
- **Opens on demand**: FAB click OR the `open-setup-checklist` window event (fired by
  the readiness card's "View all steps" / "go further" links).
- **FAB** (circular copper, `var(--brand-accent)`): conic-gradient overall-progress
  ring; center count = **essentials remaining** (falls back to total remaining once
  essentials are done). `aria-label` includes "…finish setup". Min 44px tap target,
  `bottom-[72px]` on mobile to clear the BottomTabBar.
- **Complete state**: FAB hides entirely when `percent >= 100`.
- **Hidden during impersonation**: layout skips mount on `?impersonate=...`.

### Accordion

**File**: `src/components/dashboard/SetupChecklist.jsx`

Tier accordion in `TIER_ORDER` order: **Essential → Recommended → Optional**
(`TIER_LABELS` + per-tier sublabels). The header conic-gradient ring shows
**essentials** progress (`essentialsComplete/essentialsTotal`), titled "Get
call-ready" / "You're call-ready"; once essentials are done (but extras remain) a
call-ready note renders above the accordions. Default-open tier = the first with an
incomplete item. `SetupCompleteBar` still shows when ALL items complete. Per-item
actions: Dismiss / Mark done / Jump. Window-focus refetch. Essentials are computed
from the live (optimistically-mutated) item list so the meter reacts before the
server round-trip.

**Phase 58 contract comment** above `{tierItems.map(...)}` names `has_error`,
`error_subtitle`, and "red-dot" as Phase 58 CHECKLIST-01 forwarding fields —
grep-anchored regression guard.

### Leaf — ChecklistItem (3-tier badge + Phase 58 red-dot)

**File**: `src/components/dashboard/ChecklistItem.jsx`

Badge is 3-tier from `item.tier` (fallback `required ? 'essential' :
'recommended'`): **Essential** (accent), **Recommended** (muted fill), **Optional**
(outline). `isEssential = tier === 'essential'` drives dismiss + CTA:
- Only NON-essential items can be dismissed (`canDismiss = !isEssential`).
- CTA precedence: `has_error` → **Reconnect** (red-dot variant) → non-essential →
  **Open settings** → essential-in-progress → **Continue** → else **Finish setup**.

Completion icon variants (first match wins): **Error (red-dot)**
`<span className="h-2 w-2 rounded-full bg-red-600 dark:bg-red-500" />` +
"Reconnect needed" subtitle; **Complete** `<CheckCircle2>`; **Idle** `<Circle>`.

### API — setup-checklist

**File**: `src/app/api/setup-checklist/route.js`

- Exports `TIER_GROUPS`, `TIER_ORDER` (+ legacy `THEME_GROUPS`, `VALID_ITEM_IDS`,
  `deriveChecklistItems`). `deriveChecklistItems` tags each item with `tier` +
  `theme`, sets `required = tier === 'essential'`, and orders items by tier.
- GET adds a **`readiness`** block: `{ essentialsTotal, essentialsComplete,
  callReady }` (callReady = all essentials complete) alongside the existing
  `progress` + `completedCount`. Consumed by CallReadinessCard + the FAB.
- `fetchChecklistState` issues **4** `accounting_credentials` count queries per
  provider pair (Phase 58): Healthy `.is('error_state', null)` / Error
  `.not('error_state', 'is', null)`. Separate counts let auto-complete +
  `has_error` derive from independent row sets.
- `deriveChecklistItems` emits `has_error` + `error_subtitle` UNIFORMLY on every
  item so the leaf never guards undefined.
- Phase 50 migration added `tenants.checklist_overrides` JSONB; API consumes for
  per-item `mark_done` + `dismiss` actions.
- `make_test_call` auto-completes from `tenants.test_call_completed` (migration
  002) — set only when a test call genuinely connects, via the LiveKit
  `participant_joined` webhook `/api/webhooks/livekit` (2026-06-21 test-call
  verification; migration 077 adds `test_call_status`/`test_call_last_at`). It no
  longer keys off `onboarding_complete`. Owners can still "Mark done" manually if
  the LiveKit webhook isn't registered.

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

Desktop (≥640px): inline flex-wrap (search, urgency Select, date range,
Clear all). Mobile (<640px): search + Filters button
that opens a bottom Sheet. Status filter in `JobStatusPills`.
The job-type Input was REMOVED 2026-06-12 (no backing column — see below).

**Server-side filters wired (2026-06-10)** — `listJobs` (`src/lib/jobs.js`)
+ `GET /api/jobs` now honor:

- `search` — customer **name OR phone** via an escaped `.or(
  'name.ilike.%s%,phone_e164.ilike.%s%', { referencedTable: 'customer' })`
  on the `customers!inner` join (parent-row filter, same pattern as
  `listCustomers`; term escaped with `escapeOrTerm` from
  `src/lib/search-filter.js`, capped at 100 chars). This makes the
  Calls-page → Jobs `?search=<phone>` cross-link actually filter.
- `date_from` / `date_to` — `created_at` range; route validates strict
  `YYYY-MM-DD` (invalid values silently ignored, not 400); `date_to` is
  inclusive of the whole day (`T23:59:59.999Z` UTC).

**RESOLVED (2026-06-12) — jobs `job_type` UI removed everywhere**:
`jobs.job_type` has **no backing column** (migration 059; the API documents
`job_type` as NOT supported and `listJobs` cannot apply it). The dead UI was
removed rather than wired to nothing: the JobFilterBar job-type Input, the
JobCard and JobFlyout job-type chips, and the jobs page's `job_type` param
are all gone; the batch-invoice dialog now shows **`service_address`**
instead of the always-empty job type. (Inquiries DO have a `job_type`
column — that surface is unchanged.) Do not reintroduce job_type UI without
first adding the column.

### Batch invoicing failure UX (2026-06-10)

`handleBatchCreate` (jobs page → `POST /api/invoices/batch` →
`/dashboard/invoices/batch-review?ids=`) on failure now shows a **sonner
`toast.error("Couldn't create batch invoices. Try again.")`** and preserves
the selection. It previously set the page-level `error` state — swapping the
entire list for `ErrorState` — with an uncleared 5s `setTimeout`; both the
page-swap and the timer are gone.

### JobFlyout (formerly LeadFlyout)

**File**: `src/components/dashboard/JobFlyout.jsx`

Right Sheet. On open: fetches `/api/jobs/${jobId}` (with transcript)
AND `/api/invoices?job_id=${jobId}` for linked-invoice check.
**2026-06-12 fix**: `getJob`'s detail select now actually includes
`recording_storage_path`, `transcript_text`, `transcript_structured` — it
previously selected none of them, so the TranscriptViewer was always empty
and storage-path recordings never resolved (the "with transcript" claim was
aspirational until this fix). Renders:

- Urgency badge + relative time
- Customer info (phone, timestamp) — links to `/dashboard/customers/[customerId]`
- Job details (service_address, triage layer/confidence — the job_type chip
  was removed 2026-06-12, no backing column)
- `AudioPlayer` recording URL
- `TranscriptViewer` (structured + text)
- Status `Select` + `RevenueInput` (for completed/paid)
- "Update Status" → `PATCH /api/jobs/${jobId}`
- **Create/View Invoice**: Create button when status completed or paid AND no linked invoice. View when linked.
- "Mark as Lost" with AlertDialog.

`URGENCY_STYLES`, `STATUS_LABELS`, `STATUS_OPTIONS`. `formatRelativeTime(iso)` helper.

### HotJobsTile — "Needs follow-up" (2026-06-10 retitle)

**File**: `src/components/dashboard/HotJobsTile.jsx`

Replaces `HotLeadsTile` (deleted in Phase 59). Wired in `DailyOpsHub`.
**Despite the filename, this tile shows OPEN INQUIRIES, not jobs.** It reads
`newLeadsCount` / `newLeadsPreview` from `GET /api/dashboard/stats`, which
(post-Phase-59 repointing) count open inquiries. The 2026-06-10 wave fixed
the mislabel: title is **"Needs follow-up"** (was "Scheduled jobs"), icon is
`PhoneIncoming` (was `Flame`), CTA is **"View callbacks"** →
`/dashboard/calls?view=callbacks` (the Callbacks view — repointed in
the Inquiries → Calls merge), count copy is "N caller(s) waiting for a
callback". The originally planned `hotJobsCount`/`hotJobsPreview` backend
fields never shipped — the legacy-shape fallback was removed.

### EmptyStateJobs

**File**: `src/components/dashboard/EmptyStateJobs.jsx`

Thin wrapper delegating to shared `<EmptyState icon={Users} headline="No jobs yet"
... ctaHref="/dashboard/more/ai-voice-settings" />`. See Section 11.

---

## 5b. Inquiries — Callbacks view (merged into Calls, 2026-06-10)

**Files**: `src/app/dashboard/calls/page.js` (the view lives here — see
Section 6) + `src/app/dashboard/inquiries/page.js` (now a one-line server
component calling `redirect('/dashboard/calls?view=callbacks')`, kept
only so old deep links / bookmarks / notification links keep working).

The Phase 59 Inquiries TAB no longer exists. Its work queue is the
**"Callbacks" view** inside the Calls page (renamed same-day from "Needs
reply" after user feedback), which reuses the surviving inquiry components:
`InquiryCard` + `InquiryStatusPills` (Open/Booked/Lost sub-pills) +
`InquiryFlyout` (Convert-to-Job via QuickBookSheet + Mark-as-Lost with 5s
sonner undo), plus the `inquiries` Realtime subscription — all ported from
the old page. The view is headed by an `<h1>Callbacks</h1>` and a
**"← All calls" back control** (ArrowLeft + muted-foreground text button,
same pattern as the admin/merges breadcrumb) that switches back to the
classic view. **The inquiries data model, `/api/inquiries*` routes,
voice-agent writes, stats, and customer-page inquiry surfaces are
unchanged.**

**M16 P1 (2026-06-20)** — a new durable `inquiries.out_of_area boolean`
(migration 074) is set by the voice agent when a caller's confirmed address
is outside the Service Area (see Section 14, `ServiceAreaManager`). The flag
is persisted but a CRM badge to surface it in the Callbacks/inquiries view is
a DEFERRED follow-up — **not yet displayed**.

**Known consequences (deliberate, not bugs):**
- The Callbacks view has **NO search / urgency / date filters** —
  `InquiryFilterBar.jsx` was deleted with the old page. The API still
  supports those filters (see below); only the UI consumer is gone.
- Old `?status=` deep links to `/dashboard/inquiries` land on the **Open**
  sub-pill (the redirect drops the param; default sub-filter is `open`).

**Deleted components (2026-06-10)**: `InquiryFilterBar.jsx`,
`EmptyStateInquiries.jsx` — only the old inquiries page used them. The
empty state is now an inline "All caught up" block in the calls page.

### D-07a Owner Responsibility Stance

Open inquiries stay `open` indefinitely. **No cron, no auto-timeout, no
visual staleness flag in V1.** Matches "inbox" mental model — owner converts
or marks lost when ready. The Callbacks queue is the owner's
responsibility to triage. Revisit if owners report cognitive load from the
inbox filling up. The D-07a MUST-NOT invariant comment (no age-based
mutation / staleness flags / auto-lost) was carried from the old inquiries
page into `calls/page.js`.

The chatbot knowledge doc `inquiries.md` includes a "Stale inquiries" section
explaining this D-07a policy.

### InquiryStatusPills

**File**: `src/components/dashboard/InquiryStatusPills.jsx`

Horizontal pill strip. Status enum: `open/converted/lost`. Display labels
(2026-06-10): **Open · Booked · (gap) · Lost** with `ml-2` gap before Lost.

**`converted` renders as "Booked" everywhere** — display label only, via
status-label maps in `InquiryStatusPills`, `InquiryCard` (`STATUS_LABEL`),
and `InquiryFlyout` (`STATUS_LABELS`); the Callbacks filtered-empty
copy also says "No booked callbacks right now." **Stored DB values and API
filters are unchanged** (`status=converted`) — never send "booked" to the
API.

### API filters (UI consumer deleted)

`InquiryFilterBar.jsx` was **deleted** in the 2026-06-10 merge, but the
server-side filters it drove remain live: `listInquiries`
(`src/lib/inquiries.js`) + `GET /api/inquiries` honor `urgency` (exact),
`job_type` (partial `ilike`, inquiries DO have a `job_type` column — unlike
jobs), `search` (customer name OR phone via the same escaped `.or` on the
`customers!inner` join as `listJobs`), and `date_from`/`date_to`
(`YYYY-MM-DD` validated in the route, invalid ignored; `date_to` inclusive
end-of-day UTC). The Callbacks view currently calls `GET /api/inquiries`
unfiltered (all statuses, API limit 200) and filters by status client-side
so the sub-pills (and the CallbacksStrip count) carry live counts.

### InquiryFlyout

**File**: `src/components/dashboard/InquiryFlyout.jsx`

Right Sheet. Shows inquiry details, customer link, urgency badge,
transcript (if call linked), status Select (status rendered via
`STATUS_LABELS` — `converted` → "Booked"). Actions:
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
  tel: Call button (2026-06-10) — brand-accent <a href="tel:{phone_e164}">
    next to the copy-phone button; PhoneOutgoing icon,
    aria-label "Call <name>" (falls back to formatted phone / "customer");
    rendered only when phone_e164 is present
  Jobber/Xero context badges (gracefully absent when not connected)
  Overflow menu: Edit, Merge into another, View merge history → /dashboard/admin/merges
  UnmergeBanner (ALWAYS mounted since 2026-06-12 — self-detects an undoable merge
    via /api/admin/merges and renders null when inactive; 7-day undo)

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

All three pass a status callback to `.subscribe()` and refetch on reconnect
after `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`; INSERTs trigger a refetch rather
than prepending the join-less payload (2026-06-12 — see Section 13).

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

**2026-06-12 fix — always mounted, self-detecting**: the banner is now
unconditionally rendered by the customer detail page and decides for itself
whether to show: it queries `GET /api/admin/merges`, looks for an active
(un-expired, not-yet-unmerged) merge targeting this customer, and renders
null otherwise. The previous mount condition gated on a
`merged_source_info` field **that no API ever returned** — the condition
could never be true, so the banner never appeared and the 7-day undo was
unreachable from the UI.

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

## 5e. Customers List Page (prod-readiness 2026-06 — new)

**File**: `src/app/dashboard/customers/page.js`

Client component, modeled on the Jobs / Inquiries pages. **Added to close
5 dead "Back to Customers" 404s** — previously only `customers/[id]` existed,
so every "back to list" affordance pointed at a non-existent route.

### Data flow

- Fetches `GET /api/customers?search=<term>` (route → `listCustomers` in
  `src/lib/customers.js`). No Realtime subscription here (unlike Jobs/Inquiries);
  refetch is driven by the committed `?search=` URL param.
- Search input is debounced 300ms → `router.replace('/dashboard/customers?search=')`;
  the committed `searchParams.get('search')` is the single fetch trigger.
- States: loading (4× `<Skeleton>` rows), `<ErrorState onRetry>`,
  filtered-empty (Clear-search affordance), zero-data `<EmptyState icon={Contact}
  headline="No customers yet">`, and the row list.

### Row shape (`CustomerRow`)

Each row is a `<Link href={/dashboard/customers/${id}}>` card (`card`-token
styling, hover lift) showing:
- `Contact` avatar + `name || phone_e164 || 'Unknown'`
- phone (`phone_e164`, `Phone` icon)
- **jobs count** — `readCount(customer.jobs)` from the `jobs:jobs(count)` embed
- **inquiries count** — `readCount(customer.open_inquiries)`, brand-accent
  pill, only rendered when `> 0`

`readCount()` handles the Supabase `relation:relation(count)` embed shape
(`[{ count: N }]`).

### Two accuracy caveats (DO NOT silently "fix" — they are known)

1. **Inquiries count is TOTAL, not open.** The `listCustomers` select aliases
   the embed `open_inquiries:inquiries(count)`, but the embed has **no
   `.eq('status','open')` filter**, so the badge counts ALL inquiries for the
   customer regardless of status. The alias name is aspirational. (Contrast:
   the customer-detail `computeStatsInline` *does* filter `status='open'`.)
   To make the badge truly "open", add a filtered embed/aggregate to
   `listCustomers`.
2. **VIP star is inert.** `CustomerRow` reads `customer.is_vip ||
   customer.has_vip_job`, but the `listCustomers` select returns **neither**
   field, so the `<Star>` never renders today. It lights up only once the list
   endpoint starts returning an `is_vip` (or `has_vip_job`) flag.

---

## 6. Calls Page

**File**: `src/app/dashboard/calls/page.js`

Since the 2026-06-10 Inquiries → Calls merge (reworked same-day after user
feedback) the page has **one default landing view — the classic calls
layout** — plus an opt-in **"Callbacks"** view:

- **Classic calls view (default)** — the pre-merge calls page **unchanged**:
  summary stat cards, search, filters, date-grouped expandable call cards.
  Renders immediately; it never waits on the inquiries fetch.
- **CallbacksStrip** — compact one-line nudge rendered ABOVE the stat cards,
  **only when open inquiries > 0** (hidden at 0 and while the count is still
  loading — it appears when the fetch resolves). Brand-accent tint
  (`border-[var(--brand-accent)]/25 bg-[var(--brand-accent)]/10
  text-[var(--brand-accent)]`, AiNumberBanner pattern — the token flips for
  dark mode), `min-h-[44px]`, PhoneIncoming icon, copy
  **"N caller(s) waiting for a callback"** + a "View →" affordance,
  `aria-label="N caller(s) waiting for a callback — view callbacks"`.
  Clicking switches to the Callbacks view.
- **Callbacks** — the open-inquiries work queue (see Section 5b), headed by
  a **"← All calls" back control** + `<h1>Callbacks</h1>`. `InquiryCard`
  list + `InquiryStatusPills` Open/Booked/Lost sub-pills (default `open`;
  `converted` displays "Booked") + `InquiryFlyout` (Convert-to-Job via
  QuickBookSheet, Mark-as-Lost with 5s sonner undo). Own Supabase channel
  **`inquiries-realtime`** (tenant-filtered; since 2026-06-12 INSERT triggers
  a refetch instead of prepending the join-less payload — no "Unknown" rows;
  UPDATE replaces the row — keeps list AND strip count live; status callback
  refetches on reconnect).
  Empty state: inline **"All caught up"** block (CheckCircle2 + "No callers
  waiting for a callback right now." + a link-style "View all calls"
  affordance) — kept for when the queue is empty but the user navigates
  here explicitly.

**View resolution (NO smart default — removed same-day)**: resolved
synchronously from the URL via `resolveViewParam()` —
`?view=callbacks` OR the **legacy alias `?view=needs-reply`** (old deep
links + the inquiries redirect) → Callbacks; **no param, `?view=all`, or
any unknown value → classic calls view**. There is no view-resolution
skeleton and no auto-landing on the queue. View switches
`router.replace('/dashboard/calls?view=…', { scroll: false })` (no history
push, no scroll reset), and a `searchParams` effect keeps `view` in sync
for back/forward + deep links (no-param resolves back to classic).

Calls table in Supabase Realtime publication (migration 041) with
`REPLICA IDENTITY FULL` so the page receives live INSERT/UPDATE events.

**Phase 58**: shared `<EmptyState icon={Phone} headline="No calls yet">`
wired to zero-data branch. Local helper renamed `CallsEmptyState` to
avoid shadowing the shared primitive. Filtered-empty branch keeps its
Clear-filters Button.

### 2026-06-10 UX wave

- **Transcript in expanded card** — `GET /api/calls` now selects
  `transcript_text` + `transcript_structured`; the expanded `CallCard`
  renders a collapsible `<TranscriptViewer transcriptStructured
  transcriptText>` below the `AudioPlayer`. `TranscriptViewer` degrades
  gracefully ("No transcript available for this call.") when both are null.
- **Search matches caller name OR phone** — placeholder is now "Search by
  name or phone...". `/api/calls` has no caller-name column, so it first
  does a tenant-scoped `customers` name lookup (`ilike` on `name`, capped at
  **50 rows**), then ORs the matched `phone_e164` values into the
  `from_number` filter (`from_number.ilike.%s% , from_number.in.(...)`);
  the term is escaped via `escapeOrTerm` + phones stripped of
  PostgREST-reserved chars.
- **Plain-language copy** — `EXCEPTION_LABEL` maps `exception_reason` to
  friendly text (`clarification_limit` → "The AI couldn't get enough
  details", `caller_requested` → "Caller asked to speak with a person",
  anything else → "Call ended unexpectedly" — no more raw
  `replace(/_/g,' ')`). Badge "Recovery SMS Sent" → **"We texted them
  back"**. Outcome `attempted` label "Attempted" → **"Reached out"** (badge
  + outcome filter `SelectItem`; the `not_attempted` label stays
  "No Booking").

---

## 7. Calendar Page

**File**: `src/app/dashboard/calendar/page.js`

CalendarView + AppointmentFlyout + ConflictAlertBanner + agenda.
Month/Day toggle uses `bg-foreground text-background` (dark-mode safe).

### 2026-06-10 rework — connections card + perf

- **Banners removed**: `IntegrationReconnectBanner.jsx` and
  `JobberCopyBanner.jsx` are DELETED (files + test). All Jobber/Xero
  notices now live in `CalendarConnectionsCard.jsx`
  (`src/components/dashboard/CalendarConnectionsCard.jsx`) — the bottom
  "Connections" card: CALENDARS section (existing `CalendarSyncCard`
  rows for Google/Outlook) + BUSINESS APPS section (Jobber/Xero rows
  from `/api/integrations/status` via `useSWRFetch`, 60s poll). A row
  with `error_state='token_refresh_failed'` shows an amber "Connection
  expired — not syncing" subtitle + Reconnect link to
  `/dashboard/more/integrations`, and the card header gets an
  "Action needed" amber pill. The old dismissible Jobber banner copy is
  now a quiet one-line hint under the connected Jobber row. Covered by
  `tests/components/CalendarConnectionsCard.test.jsx` (4 tests).
- **`jobberConnected`** is now derived from the same
  `useSWRFetch('/api/integrations/status')` key (SWR dedupes with the
  card) — the separate `/api/integrations/jobber/connection-status`
  fetch was removed from this page (the route still exists for other
  consumers).
- **Toolbar merged to ONE row** (was two): ‹ › Today + date label left;
  Show-completed switch (label hidden < lg), Refresh, Month/Day toggle,
  + New right. `flex-wrap` lets it break into two clean lines on mobile.
- **No skeleton flash on navigation**: `loading` state split into
  `initialLoading` (one-time skeleton) + `fetching` (background). During
  navigation/Realtime refetches the existing grid stays mounted and dims
  to `opacity-60`. The old fade choreography (100ms setTimeout →
  swap → 150ms fade-in) was deleted — date changes apply immediately.
- **AbortController** in `fetchData` (`abortRef`): rapid prev/next can't
  resolve out of order; the blocks fetch rethrows `AbortError` instead
  of swallowing it into `[]`; only the owning fetch clears flags.
  **2026-06-12: this pattern was replicated across the dashboard** — the
  calls, jobs, customers, and customer-detail page fetches, the
  CommandPalette search, and the CustomerMergeDialog typeahead all abort
  the in-flight request before firing the next one.
- **Bottom cards are ONE responsive grid** (`grid-cols-1 md:grid-cols-3`):
  Today's Agenda (`hidden md:block` — mobile keeps the "Up Next" strip
  instead), `<CalendarConnectionsCard />`, Working Hours. The duplicated
  `isMobile`-conditional mobile card markup was deleted.

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
- `ConflictAlertBanner`, `CalendarConnectionsCard` (wraps
  `CalendarSyncCard`), `WorkingHoursEditor`.

### Phase 57 — Jobber overlays

- Jobber visits rendered as `calendar_events` with `provider='jobber'`
  (migration 055). AppointmentFlyout shows "From Jobber" overlay pill
  for these. (The former `JobberCopyBanner` is gone — see 2026-06-10
  rework above.)

### Visual hierarchy

Blue appointments (z-10) > Violet external events (z-5) > Amber time
blocks (z-1) > Stone off-hours shading. All-day blocks/events in
dedicated row above hourly grid.

### Phase 58 error state

Top-level early-return renders `<ErrorState onRetry={fetchData}/>` when
`fetchError && !fetching` (was `!loading` before the 2026-06-10 state
split). Top-level (not inline) because fetchData's catch sets empty
data — inline would show misleading empty grids.

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

**Pagination (2026-06-12)**: `useDocumentList` now paginates — `limit`
starts at 50 and grows in 50-row steps via a **"Load more"** button up to
500; `hasMore` is derived from the API's `total_count`; switching status
tabs resets the limit back to 50. Previously the hook hard-capped at 50
rows with no affordance — invoices/estimates beyond the first 50 were
silently invisible. Applies to both invoices and estimates lists.

**Mobile create-FABs (2026-06-12)**: the floating create buttons on the
invoices and estimates pages moved `bottom-6` → `bottom-20` so they no
longer cover the `BottomTabBar` on mobile.

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
- "Default appointment duration" Select (`SLOT_DURATION_OPTIONS`, 30 min–2 h),
  bound to `slotDuration` state.
- **"Travel buffer between jobs" Select** (`TRAVEL_BUFFER_OPTIONS`:
  None/15/30/45/60/90 min) — M16 P2. Bound to `travelBuffer` state, wired into
  the same `isDirty`/save/discard flow as slot duration; loaded with `?? 30`
  so a saved `0` ("None") survives. Helper copy: "Minimum drive time the AI
  leaves between back-to-back jobs."
- Sticky save bar (z-30, `lg:left-60`) slides up via `translate-y`
  when `isDirty`.
- Mobile: stacked time inputs with "Opens"/"Closes" labels.
- Save: `PUT /api/working-hours` with `{ working_hours, slot_duration_mins, travel_buffer_mins, tenant_timezone }`.

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
  navy: 'var(--sidebar-bg)',                    // #0F172A light / oklch(0.185 0 0) dark
  warmSurface: 'var(--warm-surface)',
  bodyText: 'var(--muted-foreground)',
};
```

Other tokens: `btn`, `card`, `glass`, `gridTexture`, `focus` (Phase 58
focus-visible), `selected`. Consumers read via named import only — do
not inline hex codes in dashboard components.

### Sidebar tokens (2026-06-10 dark pass)

- **`--sidebar-bg`** — light mode keeps the navy `#0F172A`; dark mode is
  now **neutral `oklch(0.185 0 0)`** — one elevation step between
  `--background` (`0.145`) and `--card` (`0.205`), joining the
  zero-chroma dark family instead of clashing navy.
- **`--sidebar-bg-border`** (NEW) — hairline between the desktop sidebar
  and page content: `transparent` light / `oklch(1 0 0 / 8%)` dark.
  Applied via a scoped rule in `globals.css` —
  `aside[data-tour="sidebar-nav"] { border-right: 1px solid
  var(--sidebar-bg-border); }` — so `DashboardSidebar.jsx` needs no border
  class (border-box keeps the 240px width unchanged).

### Dark mode rules

- NO hardcoded `bg-white` / `bg-stone-*` / `text-stone-*` without `dark:`
  variants. Use semantic tokens: `bg-card`, `bg-muted`, `bg-background`,
  `text-foreground`, `text-muted-foreground`, `border-border`.
- Sidebar: navy in light, neutral `oklch(0.185 0 0)` in dark
  (`bg-[var(--sidebar-bg)]` — see Sidebar tokens above).
- `URGENCY_STYLES` in CalendarView has full dark variants.
- `@custom-variant dark :where(.dark, .dark *)` in `globals.css`.
- 150ms body crossfade on theme change.

### Badge/chip dark pairing — CANONICAL pattern for new badges

2026-06-10 system-wide pass: **~107 className locations across 26
dashboard files** gained additive `dark:` variants for light-only pastel
badges/chips/banners, following the **BookingStatusBadge convention**:

```
bg-{hue}-100 text-{hue}-700  +  dark:bg-{hue}-950/40 dark:text-{hue}-300
borders:                        dark:border-{hue}-800/60
```

Applied to status badges, amber banners, icon tiles, ghost destructive
hovers, and stone→muted swaps. Raw slate/stone hexes in
`calendar/page.js`, `CalendarView.js`, and `UsageRingGauge.js` were
replaced with tokens (`text-muted-foreground`, `var(--border)` for the
usage ring track) + dark pairs. **Deliberate exclusion**:
`src/components/billing/UpgradeCheckoutCards.js` is an intentionally
light-fixed pricing card — do not add `dark:` variants there. Any NEW
light-pastel badge MUST ship with this dark pairing.

---

## 13. Supabase Realtime

### Publication

`supabase_realtime` publication covers:

| Table | Added in | Purpose |
|-------|----------|---------|
| `leads` | 004 | **DROPPED** (migration 061) — superseded by customers/jobs/inquiries |
| `customers` | 059 | Live customer updates (`REPLICA IDENTITY FULL`) |
| `jobs` | 059 | Live job updates on jobs tab (`REPLICA IDENTITY FULL`) |
| `inquiries` | 059 | Live inquiry updates on the Calls Callbacks view (`REPLICA IDENTITY FULL`) |
| `calls` | 041 | Live call updates on calls page (`REPLICA IDENTITY FULL`) |
| `appointments` | (standard) | Calendar live updates |
| `calendar_events` | 057 | Provider='jobber' schedule-mirror live updates |

**NOT published** (derived/audit-only): `customer_calls`, `job_calls`, `customer_merge_audit`.

### Client subscription pattern (2026-06-12 resilience rework)

Two rules now apply to **every** dashboard channel (calls page ×2, jobs,
customer-detail ×3, calendar ×2):

1. **Status callback + refetch-on-reconnect**: `.subscribe()` is passed a
   status callback; after a `CHANNEL_ERROR`, `TIMED_OUT`, or `CLOSED` status
   the page refetches its data when the channel re-establishes — events
   missed while the WebSocket was down are no longer silently lost (the old
   bare `.subscribe()` meant a dropped channel froze the page until manual
   refresh).
2. **INSERT → refetch, never prepend the raw payload**: Realtime INSERT
   payloads have **no joins** (no customer name, no embeds), so prepending
   `payload.new` rendered "Unknown" rows — and a phantom-field filter
   (checking fields the payload never carried) silently dropped many inserts
   entirely. INSERT events now trigger the page's existing fetch function;
   UPDATE events may still patch rows in place.

```js
// Jobs tab — src/app/dashboard/jobs/page.js
const channel = supabase
  .channel(`jobs-${tenantId}`)
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'jobs',
        filter: `tenant_id=eq.${tenantId}` },
      (payload) => handleRealtimeEvent(payload))   // INSERT → fetchJobs()
  .subscribe((status) => {                         // 2026-06-12
    // CHANNEL_ERROR / TIMED_OUT / CLOSED → refetch on reconnect
  });

// Callbacks view — src/app/dashboard/calls/page.js (Inquiries → Calls merge)
// INSERT → refetch (was prependWithSlideIn(payload.new)); UPDATE replaces row.

// Customer detail — triple-subscribe (customers + jobs + inquiries by customer_id)
// See Section 5c for subscription details. All three carry the status callback.
```

Cleanup in the effect return — `channel.unsubscribe()` on older pages,
`supabase.removeChannel(channel)` for the calls-page `inquiries-realtime`
channel (on unmount / tenant change).

---

## 14. More Hub + Settings Panels — /dashboard/more/*

### More hub page (`/dashboard/more/page.js`) — three-section regroup (prod-readiness 2026-06)

The flat 11-item `MORE_ITEMS` list was regrouped into THREE labeled
sections (`MORE_SECTIONS`). **Presentational only — every route is preserved
1:1.** Each section renders a `card.base` group with a uppercase
section-label heading. Empty sections are dropped after flag filtering.

| Section | Items (in order) |
|---------|------------------|
| **Business** | Services & Pricing, Working Hours, Service Area, Account, **Customers** (`/dashboard/customers`), **Calendar** (`/dashboard/calendar`) |
| **AI & Calls** | AI & Voice Settings, Call Routing, Notifications & Escalation, Features |
| **Billing & Money** | Billing, Invoice Settings, Integrations |

- **Customers + Calendar** were added to **Business** for **mobile
  parity** when neither had a `BottomTabBar` slot. Since the 2026-06-10
  Inquiries → Calls merge, **Calendar has a tab again** (it took the freed
  Inquiries slot), so its Business entry is now a redundant-but-harmless
  second path; Customers still has no tab, so the More hub remains the only
  mobile path to it. Both appear in the desktop sidebar.
- **`invoicing` flag gating is intact**: `Invoice Settings` is filtered out
  of Billing & Money when `invoicing=false`; the mobile quick-access
  `Invoices`/`Estimates` block is likewise hidden. A section that ends up
  empty after filtering is not rendered.

### Settings route quick list

- `/more/services-pricing` — full service table (DnD, urgency tags,
  bulk select).
- `/more/working-hours` — `WorkingHoursEditor`.
- `/more/service-zones` — `ServiceAreaManager` (single **"Service Area"**
  editor — page heading was "Service Zones & Travel"). Postal/ZIP-code chip
  input + town/city chip input (comma/Enter to add), an **out-of-area action**
  select — `callback` (default: take a message & call back, don't book) /
  `decline_referral` (politely decline + optional referral) / `trip_fee` (book
  but mention a possible travel fee) — with a conditional referral-note textarea
  shown only for `decline_referral`, and an explicit dirty-tracked **"Save
  service area"** button. Backed by `GET/PUT /api/service-area`. Persists the
  owner choice to `tenants.out_of_area_action` + `tenants.out_of_area_referral_note`
  (migration 074); coverage persists to `service_zones` (`postal_codes` + new
  `cities[]`), collapsed to one canonical row on save. **Replaced the removed
  multi-zone `ZoneManager` (`zone_travel_buffers` pairwise-buffer matrix) +
  `/api/zones` (+`[id]`) routes (M16 P1, 2026-06-20).**
- `/more/escalation-contacts` — `EscalationChainSection`.
- `/more/notifications` — per-outcome SMS/email Switch grid
  (booked/declined/not_attempted/attempted × SMS/email).
- `/more/ai-voice-settings` — `SettingsAISection` (phone number + test call)
  + `VoicePickerSection` — 3 voice labels (`professional`/`friendly`/
  `local_expert`, 2026-06-12) with display names; stored value IS the label
  (validated by `VALID_VOICES` in `src/lib/ai-voice-validation.js`, CHECK in
  migration 070); preview files `/audio/voices/{label}.mp3` (assets pending).
- `/more/features` — feature-flag toggles (Phase 53).
- `/more/billing` — plan card, usage ring gauge, invoices. Phase 58
  `ErrorState onRetry={refetchBilling}` (mutates both SWR caches).
- `/more/invoice-settings` — business identity, tax, late fees, defaults,
  numbering. **Gated by `invoicing` flag.**
- `/more/integrations` — Business Integrations (see Section 9).
- `/more/call-routing` — schedule, pickup numbers, **Priority Callers**
  unified list merging `tenants.vip_numbers` (standalone) +
  `leads.is_vip=true` (lead-based). Brand "Priority"; DB keeps "vip".
  See `voice-call-architecture` skill for webhook-side routing.
- `/more/account` — profile editor, account details, sign out.

### Quick access (mobile-only on `/more` hub)

`Ask Voco AI` button (fires `window.dispatchEvent(new Event('open-voco-chat'))`)
+ `Invoices` / `Estimates` quick-access links (desktop sidebar entries
but not mobile bottom-bar tabs). Hidden entirely when `invoicing=false`.

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
| `GET /api/jobs` | `src/app/api/jobs/route.js` | Filtered + paginated; NO transcript_text. Filters: status, urgency, customer_id, search (customer name\|phone), date_from/date_to (YYYY-MM-DD). job_type NOT supported — no column (UI removed 2026-06-12, see Section 5) |
| `GET/PATCH /api/jobs/[id]` | `src/app/api/jobs/[id]/route.js` | Full job WITH transcript — `getJob` selects `recording_storage_path` + `transcript_text` + `transcript_structured` since 2026-06-12 (previously omitted, so the flyout transcript was always empty); status/revenue update |
| `GET /api/inquiries` | `src/app/api/inquiries/route.js` | Filtered + paginated; default status=open. Filters: status, urgency, job_type (partial), search (customer name\|phone), date_from/date_to (YYYY-MM-DD) |
| `GET/PATCH /api/inquiries/[id]` | `src/app/api/inquiries/[id]/route.js` | Inquiry detail + status update |
| `POST /api/inquiries/[id]/convert` | same dir | Convert inquiry to job (manual offline flow) |
| `GET /api/admin/merges` | `src/app/api/admin/merges/route.js` | Tenant-scoped customer_merge_audit rows (admin-only) |
| `GET /api/search` | `src/app/api/search/route.js` | Command-palette grouped search (customers/calls/invoices/appointments/estimates) |
| `GET /api/dashboard/stats` | `src/app/api/dashboard/stats/route.js` | Home tiles + nav badges: "new" = open inquiries count+preview, invoice money snapshot (`invoiceOutstandingAmount`, `invoiceOverdueCount`+`invoiceOverdueAmount`, `paidThisMonth`), `missedCallsToday` (calls with `booking_outcome='not_attempted'` AND `duration_seconds>=15` created today — <15s = hangups/misdials) |
| `GET /api/calls` | `src/app/api/calls/route.js` | Filtered (date, urgency, outcome, search by caller name OR phone — tenant-scoped customers name lookup, 50-name cap); selects `transcript_text` + `transcript_structured` |
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
| `PUT /api/working-hours` | same pattern | `working_hours` + `slot_duration_mins` + `travel_buffer_mins` (M16 P2, int 0–240) + `tenant_timezone` |
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
| Callbacks view always empty | Default sub-filter excludes non-open OR Realtime channel dropped | Check the `open` default sub-pill; verify the `inquiries-realtime` channel in `calls/page.js` |
| `/dashboard/inquiries` "doesn't render" | It's a server redirect since 2026-06-10 | Expected — lands on `/dashboard/calls?view=callbacks`; old `?status=` params are dropped (Open sub-pill) |
| No search/urgency/date filters on Callbacks | `InquiryFilterBar` deleted with the old page | Expected (known consequence) — API still supports the filters; re-adding needs a UI consumer |
| Calls page lands on the queue instead of the call log | Smart default re-introduced | There is NO smart default (removed same-day, 2026-06-10) — classic view is always the default; only explicit `?view=callbacks` / legacy `?view=needs-reply` opens Callbacks |
| CallbacksStrip not showing | Open count is 0, inquiries fetch still loading, or fetch errored | Expected — strip renders only when `openCallbacksCount > 0`; it appears once `/api/inquiries` resolves and never blocks the classic view |
| Customer detail page flickers on activity | Only one of 3 Realtime channels subscribed | Ensure triple-subscribe: customers + jobs + inquiries filtered by customer_id |
| UnmergeBanner not showing | Pre-2026-06-12: gated on `merged_source_info` (never returned by any API) | Banner is now ALWAYS mounted and self-detects via `/api/admin/merges`; it appears on the TARGET customer page within the 7-day window |
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
| "Back to Customers" 404 | `/dashboard/customers` list route missing | Fixed prod-readiness 2026-06 (`customers/page.js`); ensure route exists |
| Customers list inquiry badge looks too high | Embed `open_inquiries` is NOT filtered to open — counts ALL inquiries | Known caveat (Section 5e); add `status='open'` filter to `listCustomers` embed to fix |
| VIP star never shows on customers list | `listCustomers` returns no `is_vip`/`has_vip_job` | Known caveat (Section 5e); list endpoint must return the flag |
| Customer not reachable on mobile | Customers has no `BottomTabBar` tab | Expected — reach via `/dashboard/more` Business section |
| Command palette doesn't trap focus / Esc not closing | Reverted to hand-rolled overlay | Must wrap in Radix `Dialog` (Section 21) |
| Search shows "leads" group/copy | Stale pre-repointing copy | Group `type` is `customers`; update icon/placeholder to match |
| Jobs job-type filter/chips reappear in a diff | `jobs.job_type` column doesn't exist (059) — all job_type UI was REMOVED 2026-06-12 | Don't reintroduce without adding the column (Section 5); inquiries DO support `job_type` |
| Calls nav badge missing/stale | `useAttentionCounts` reads `/api/dashboard/stats`; badge = `callsAttention` (openInquiries + missedCallsToday) | Check stats response; 60s SWR refresh + focus revalidate; badge hidden at 0, caps at "9+" |
| Activity feed row not clickable | `customer_*` event without `customer_id`, or `invoice_*` with invoicing flag off | Expected — `getHref` returns null and the row renders unlinked |
| MoneySnapshot strip not rendering | `invoicing` flag off or stats not loaded | Expected — component returns null in both cases |

---

## 20. Chatbot Knowledge Corpus (Phase 59 split)

**File**: `src/lib/chatbot-knowledge/index.js`

Phase 59 replaced `leads.md` with three separate files:

| File | Covers |
|------|--------|
| `customers.md` | Customer dedup, merge/unmerge, customer detail page, phone immutability |
| `jobs.md` | Job lifecycle (scheduled→completed→paid), job cards, invoice link |
| `inquiries.md` | Callbacks (internally inquiries): lifecycle (open→Booked/Lost), D-07a stale-inquiry owner-responsibility policy, conversion flow |

**2026-06-10 (Inquiries → Calls merge + same-day Callbacks rename)** —
`calls.md`, `inquiries.md`, and `jobs.md` rewritten for the new IA:
`calls.md` describes the classic call log as the landing view, the
callbacks banner ("N callers waiting for a callback" → View), the
Callbacks view with its "← All calls" control, and keeps the "Where did
the Inquiries tab go?" answer; `inquiries.md` retitled "Callbacks", points
all links at `/dashboard/calls?view=callbacks`, uses "Booked" display
language; `jobs.md` repointed its cross-link to
`[Callbacks](/dashboard/calls?view=callbacks)`.

`ROUTE_DOC_MAP`: `/dashboard/jobs` → `jobs.md` (**fixed 2026-06-10 — it
had pointed at the deleted `leads.md` since Phase 59**),
`/dashboard/inquiries` → `inquiries.md` (kept for the redirect route),
`/dashboard/customers/*` → `customers.md`. `KEYWORD_DOC_MAP`: the
job/lead/crm group now maps to `jobs.md` (same stale-`leads.md` fix), and
a NEW keyword group `['inquiry', 'inquiries', 'needs reply', 'callback',
'call back']` → `inquiries.md` is ordered BEFORE the calls group so
"callback" matches inquiries, not the `call` keyword.

---

## 21. Command Palette + Global Search

**File**: `src/components/dashboard/CommandPalette.jsx`

⌘K / Ctrl+K spotlight search. Debounced 250ms → `GET /api/search?q=`
(`src/app/api/search/route.js`). Results are grouped by `type` and rendered
with `TYPE_ICONS` keyed on the group type.

### Radix Dialog wrapping (prod-readiness 2026-06)

The palette now renders inside the shared Radix `Dialog`
(`src/components/ui/dialog.jsx`) instead of a hand-rolled fixed overlay. The
Dialog provides **focus trap, focus restore on close, Escape-to-close
(`onOpenChange`), and `role=dialog` / `aria-modal`** for free. Implementation
notes:

- `<DialogContent showCloseButton={false}>` anchored near the top
  (`top-[15vh] translate-y-0`) to keep command-palette convention.
- `onOpenAutoFocus` is `preventDefault()`-ed so focus lands on the search
  `<input>` (via `inputRef`), not the first result.
- A visually-hidden `<DialogTitle className="sr-only">Search</DialogTitle>`
  supplies the accessible name.
- ⌘K toggle is still a global `keydown` listener; Escape is handled by the
  Dialog (so it is intentionally NOT in the local `handleKeyDown`).
- ArrowUp/Down + Enter still drive the `selectedIndex` keyboard nav over the
  flattened result list.

### Search groups (`/api/search`)

Returns up to 5 rows per group; `type` values match `CommandPalette`'s
`TYPE_ICONS`:

| Group `type` | Source table | Item href |
|--------------|--------------|-----------|
| `customers` | `customers` (name/phone ILIKE) | `/dashboard/customers/${id}` |
| `calls` | `calls` (from_number ILIKE) | `/dashboard/calls` |
| `invoices` | `invoices` | `/dashboard/invoices/${id}` |
| `appointments` | `appointments` | `/dashboard/calendar` |
| `estimates` | `estimates` | `/dashboard/estimates/${id}` |

**Prod-readiness 2026-06**: the customers group replaced the prior stale
`leads` group/copy — the route already queried the `customers` table (it
still uses an internal `leadsRes` variable name), and `CommandPalette`'s
icon/placeholder/empty copy were updated from "leads" → "customers" to match
the `type:'customers'` payload.

---

## 22. Phase-59 Repointing (prod-readiness 2026-06)

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

## Keeping this document updated

When modifying any file under `src/app/dashboard/`,
`src/components/dashboard/`, `src/app/api/{customers,jobs,inquiries,calls,escalation-contacts,setup-checklist,...}/`,
or `src/lib/design-tokens.js`, update the relevant sections here.

**For Xero/Jobber-specific changes:** update `integrations-jobber-xero`
first, then cross-ref here.

**For billing/Stripe-specific changes:** update `payment-architecture`.

**For calendar-sync-specific changes:** update `scheduling-calendar-system`.

---
name: dashboard-crm-system
description: "Complete architectural reference for the dashboard and CRM system — all dashboard pages, lead lifecycle and merging, status pill strip, escalation chain, settings panels, setup checklist, design tokens (light + dark mode), guided tour, and Supabase Realtime integration. Use this skill whenever making changes to dashboard pages, lead management, CRM components, escalation contacts, service management, settings, design tokens, or dark-mode theming. Also use when the user asks about how leads work, wants to modify dashboard UI, or needs to debug Realtime subscription issues."
---

# Dashboard & CRM System — Complete Reference

This document is the single source of truth for the entire dashboard and CRM system. Read this before making any changes to dashboard pages, lead management, or CRM components.

**Last updated**: 2026-04-17 (Phase 52 Leads → Jobs rename: dashboard sidebar + BottomTabBar nav label changed from "Leads" to "Jobs"; canonical URL renamed from the old Leads path to `/dashboard/jobs` with 308 permanent redirect [exact + wildcard] in `next.config.js`; status pill labels restructured to job-progression vernacular [New, Scheduled, Completed, Paid, Lost] with `ml-2` visual gap separating Lost from the active pipeline; Phase 49 categorical dark-mode pill palette preserved verbatim; LeadFlyout STATUS_LABELS [booked → 'Scheduled'], sheet titles, AlertDialog, and toasts reframed as "Job"; LeadCard STATUS_LABEL synced; LeadFilterBar aria-labels [Search jobs / Filter jobs]; EmptyStateLeads ['No jobs yet']; HotLeadsTile title/CTA/count labels/error/href reframed; AppointmentFlyout linkedLead button + 'Job:' prefix; DashboardTour step content + selector updated; Search API result label changed to 'Jobs' with /dashboard/jobs href [internal `type:'leads'` field key preserved]; notification email dashboard link → /dashboard/jobs; chatbot knowledge corpus reframed across 8 markdown files [/dashboard/jobs URLs + Jobs noun]; cross-dashboard 'View Lead' / 'Back to Leads' / 'Linked Lead' button copy in calls, invoices, batch-review, invoices/[id], estimates/[id] reframed to Job equivalents. PRESERVED unchanged per D-06/D-10: DB enum [`leads.status`: new, booked, completed, paid, lost], API routes [/api/leads/*], all component file names [LeadCard.jsx, LeadFlyout.jsx, LeadStatusPills.jsx, LeadFilterBar.jsx, EmptyStateLeads.jsx, HotLeadsTile.jsx], internal symbol names [PIPELINE_STATUSES, STATUS_OPTIONS, type:'leads', leadId, lead_id]. Final-state guarantee: a recursive grep for the legacy `leads` URL substring in `src/` returns zero hits; the only allowed mention is the `next.config.js` redirect source. Previous: 2026-04-16 (Phase 49 dark mode + token migration + Analytics feature removed: ThemeProvider wired in root layout with suppressHydrationWarning; next-themes with attribute="class"; sidebar sun/moon toggle between Ask Voco AI and Log Out; new semantic CSS variables in globals.css — `--brand-accent`, `--brand-accent-hover`, `--brand-accent-fg`, `--selected-fill`, `--warm-surface`, `--warm-surface-elevated`, `--sidebar-bg`; `@custom-variant dark :where(.dark, .dark *)`; 150ms body crossfade on theme change; `src/lib/design-tokens.js` rewritten to reference `var(--*)` tokens; entire dashboard tree migrated to bg-card/bg-muted/bg-background/text-foreground/text-muted-foreground/border-border (no more hardcoded bg-white/bg-stone-*/text-stone-* without dark: variants); URGENCY_STYLES in CalendarView gained full dark variants; Analytics feature removed entirely — `/dashboard/analytics` + `/dashboard/more/analytics` routes deleted, AnalyticsCharts + EmptyStateAnalytics components deleted, sidebar nav entry removed, DashboardTour analytics step removed, `analytics.md` chatbot knowledge doc removed; CallsTile now shows last 5 calls (no 24h window); HotLeadsTile shows last 5 leads of any status (no status=new filter). Previous: 2026-04-15 — Phase 48 setup checklist API, recurring UI invoice-only clarification, Phase 52 planned-only.)

---

## Architecture Overview

| Layer | Files | Purpose |
|-------|-------|---------|
| **Dashboard Pages** | `src/app/dashboard/` | All page routes nested under layout |
| **CRM Components** | `src/components/dashboard/` | Lead cards, status pills, flyouts, charts, stats, editors, tour |
| **API Routes** | `src/app/api/leads/`, `src/app/api/calls/`, `src/app/api/escalation-contacts/`, `src/app/api/setup-checklist/`, `src/app/api/invoices/`, `src/app/api/estimates/`, `src/app/api/invoice-settings/`, `src/app/api/chat/` | Lead CRUD, call logs, escalation CRUD, checklist state, invoice CRUD, estimate CRUD + send/convert, invoice settings, AI chatbot |
| **Business Logic** | `src/lib/leads.js` | Lead creation and repeat-caller merge |
| **Design System** | `src/lib/design-tokens.js` | Shared color palette and component tokens |
| **Realtime** | Supabase `supabase_realtime` publication | Live lead updates to dashboard via WebSocket |

```
Call ends → LiveKit agent post-call pipeline → createOrMergeLead()
                                                              ↓
                                          INSERT into leads table (Supabase)
                                                              ↓
                               Supabase Realtime broadcasts INSERT/UPDATE
                                                              ↓
                    Dashboard leads page subscribes → receives payload → animates new lead row
                                                              ↓
                                   DashboardHomeStats updates via Realtime
```

### Dashboard Page Structure (Phase 20 + Phase 33+)

```
layout.js                        ← DashboardSidebar (desktop) + BottomTabBar (mobile) + DashboardTour + ChatbotSheet
  ├── page.js (/)                ← Adaptive home: setup mode (checklist hero) OR active mode (command center)
  ├── jobs/page.js               ← Status pill strip + filter bar + job list + LeadFlyout (file moved from leads/ in Phase 52; 308 redirect in next.config.js)
  ├── calendar/page.js           ← CalendarView + ConflictAlertBanner + agenda
  ├── calls/page.js              ← Call logs: date-grouped expandable cards, filters, summary stats
  ├── invoices/page.js           ← Invoice list with status tabs, summary metrics, search
  ├── invoices/new/page.js       ← New invoice form — pre-fills from lead_id query param
  ├── invoices/[id]/page.js      ← Invoice detail + HTML preview + Send button
  ├── invoices/batch-review/page.js ← Batch review of draft invoices before sending (query: ?ids=id1,id2,...)
  ├── estimates/page.js           ← Estimate list with status tabs (draft/sent/approved/declined/expired), summary cards
  ├── estimates/new/page.js       ← Estimate editor — single-price or tiered (Good/Better/Best), lead search + link
  ├── estimates/[id]/page.js      ← Estimate detail preview + actions (send, approve, decline, expire, convert to invoice)
  └── more/page.js               ← Config hub: Ask Voco AI button (mobile), 2 quick-access links, settings sections
      ├── more/services-pricing/page.js   ← Full service table (DnD, urgency tags, bulk select)
      ├── more/working-hours/page.js      ← WorkingHoursEditor
      ├── more/calendar-connections/page.js ← CalendarSyncCard
      ├── more/service-zones/page.js      ← ZoneManager
      ├── more/escalation-contacts/page.js ← EscalationChainSection
      ├── more/notifications/page.js      ← Notifications & Escalation preferences
      ├── more/ai-voice-settings/page.js  ← SettingsAISection
      ├── more/billing/page.js            ← Plan, usage meter, invoices
      ├── more/invoice-settings/page.js   ← Business identity, tax config, late fees, invoice defaults, numbering
      ├── more/integrations/page.js       ← Business Integrations (Phase 54): Calendar Connections (CalendarSyncCard, preserved) + Accounting & Job Management provider cards (Xero, Jobber). Server Component reads getIntegrationStatus('use cache').
      └── more/account/page.js            ← Profile editor, account details, sign out
```

**Note:** `/dashboard/services` redirects to `/dashboard/more/services-pricing`. `/dashboard/settings` redirects to `/dashboard/more`.

---

## File Map

| File | Role |
|------|------|
| `src/app/dashboard/layout.js` | Layout wrapper: banners (impersonation, billing warning, trial countdown), sidebar (desktop), BottomTabBar (mobile), GridTexture, DashboardTour. Exports Suspense-wrapped DashboardLayout with admin impersonation support |
| `src/app/dashboard/ImpersonationBanner.js` | Amber sticky banner shown when admin impersonates a tenant — displays "Viewing as: {name} (read-only)" + Exit Impersonation link |
| `src/app/dashboard/BillingWarningBanner.js` | Persistent amber warning for past_due subscriptions with 3-day grace countdown |
| `src/app/dashboard/TrialCountdownBanner.js` | Trial countdown banner (blue >3d, amber <=3d) with upgrade CTA |
| `src/app/dashboard/page.js` | Adaptive home: setup mode (checklist hero + tour button) vs active mode (command center) |
| `src/app/dashboard/jobs/page.js` | Jobs page (formerly leads/page.js — moved Phase 52 with 308 redirect): status pill strip, filter bar, job list, Realtime subscription |
| `src/app/dashboard/calls/page.js` | Call logs: date-grouped expandable cards, search, filters, summary stats |
| `src/app/dashboard/calendar/page.js` | Calendar page: CalendarView + AppointmentFlyout + ConflictAlertBanner. Month/Day toggle active state uses `bg-foreground text-background` (dark-mode-safe). |
| `src/app/dashboard/invoices/batch-review/page.js` | Batch review of draft invoices — fetches by ?ids= query, edit/remove/send-all flow |
| `src/app/dashboard/estimates/page.js` | Estimate list with status tabs (draft/sent/approved/declined/expired), summary cards, mobile cards |
| `src/app/dashboard/estimates/new/page.js` | Estimate editor — customer info, lead search + link, line items, tiered (Good/Better/Best) mode, dates, notes |
| `src/app/dashboard/estimates/[id]/page.js` | Estimate detail: preview (single or tiered), metadata sidebar, actions (send, approve, decline, expire, convert to invoice, download PDF) |
| `src/app/dashboard/more/page.js` | Config hub: Ask Voco AI button (mobile-only), 2 quick-access links (Invoices, Estimates), 9 settings sections. Uses `divide-border` (theme-aware) between items — NOT `divide-stone-100`. |
| `src/app/dashboard/more/layout.js` | Pass-through layout for more/* route group |
| `src/app/dashboard/more/services-pricing/page.js` | Service table with DnD, urgency tags, bulk select |
| `src/app/dashboard/more/working-hours/page.js` | Wraps WorkingHoursEditor |
| `src/app/dashboard/more/calendar-connections/page.js` | Wraps CalendarSyncCard |
| `src/app/dashboard/more/service-zones/page.js` | Wraps ZoneManager |
| `src/app/dashboard/more/escalation-contacts/page.js` | Wraps EscalationChainSection |
| `src/app/dashboard/more/notifications/page.js` | Notification preferences page — per-outcome SMS/email toggles |
| `src/components/dashboard/NotificationPreferences.jsx` | Per-outcome Switch grid (booked/declined/not_attempted/attempted x SMS/email) |
| `src/app/dashboard/more/ai-voice-settings/page.js` | Wraps SettingsAISection (phone number + test call only) |
| `src/app/dashboard/more/call-routing/page.js` | Call routing settings: on/off schedule (per-day ranges, overnight support), pickup numbers list (E.164, sms_forward toggle, max 5), dial_timeout slider, plus **Priority Callers** unified list (merges standalone `tenants.vip_numbers` + lead-based `leads.is_vip=true` sources) with add/edit/delete and "remove priority status" action that PATCHes the lead |
| `src/app/api/call-routing/route.js` | GET/PATCH tenants.call_forwarding_schedule + pickup_numbers + dial_timeout_seconds + vip_numbers. Validates E.164, caps pickup_numbers at 5 (DB CHECK), and returns both vip_numbers and a sibling `vip_leads` array (leads with is_vip=true) for the unified Priority list |
| `src/app/api/notification-settings/route.js` | GET/PATCH notification_preferences JSONB on tenants |
| `src/app/dashboard/more/billing/page.js` | Billing page: plan card, usage ring gauge, billing details, recent invoices |
| `src/components/dashboard/UsageRingGauge.js` | SVG donut ring gauge for call usage visualization |
| `src/app/dashboard/more/account/page.js` | Account page: profile editor (business_name, owner_name, owner_email, owner_phone), account details, sign out |
| `src/app/dashboard/more/invoice-settings/page.js` | Invoice settings: business identity (logo upload via Supabase Storage), tax config, late fees (flat/percentage), defaults (payment terms, notes), numbering (prefix, preview) |
| `src/app/dashboard/more/integrations/page.js` | Business Integrations hub (Phase 54): Server Component — awaits `getIntegrationStatus(tenantId)` then renders Calendar Connections section (CalendarSyncCard, preserved) + Accounting & Job Management section with Xero + Jobber cards via `BusinessIntegrationsClient` (Client child) |
| `src/components/dashboard/BusinessIntegrationsClient.jsx` | Client child (Phase 54): renders Xero (FileSpreadsheet) + Jobber (Wrench) provider cards, AlertDialog destructive confirm, sonner toasts, invoicing-flag-aware status-line copy (reads `useFeatureFlags()` from Phase 53); full-page `window.location.href` redirect on connect; optimistic disconnect via `POST /api/integrations/disconnect` |
| `src/app/api/account/route.js` | GET/PATCH tenant profile fields (business_name, owner_name, owner_email, owner_phone) |
| `src/app/api/estimates/route.js` | GET estimates (filtered by status/search/lead_id, with summary aggregates + status counts), POST create estimate (single-price or tiered) |
| `src/app/api/estimates/[id]/route.js` | GET estimate detail (+ tiers + line items), PATCH update (status transitions + line item/tier replacement), DELETE draft estimates only |
| `src/app/api/estimates/[id]/send/route.js` | POST send estimate via email (PDF attachment via Resend) + optional SMS (Twilio), updates status to 'sent' |
| `src/app/api/estimates/[id]/convert/route.js` | POST convert approved estimate to draft invoice, idempotent (returns existing invoice_id if already converted), tier_id required for tiered estimates |
| `src/app/api/invoice-settings/route.js` | GET/PATCH invoice_settings row (auto-creates on first access seeded from tenant data). Fields: business_name, address, phone, email, logo_url, license_number, tax_rate, payment_terms, default_notes, invoice_prefix |
| `src/app/api/chat/route.js` | POST chat handler for Voco AI assistant — auth via getTenantId(), RAG knowledge retrieval, Groq Llama 4 Scout completion |
| `src/lib/chatbot-knowledge/index.js` | RAG retrieval module — ROUTE_DOC_MAP (14 routes) + KEYWORD_DOC_MAP (9 keyword groups), returns up to 2 matched docs |
| `src/components/dashboard/ChatbotSheet.jsx` | Sheet wrapper for AI chatbot — message state, input handling, API calls to /api/chat, responsive (right sheet desktop, bottom sheet mobile) |
| `src/components/dashboard/ChatMessage.jsx` | Message bubble with user/AI variants, `parseMessageContent()` for link extraction |
| `src/components/dashboard/ChatNavLink.jsx` | Clickable navigation chip inside AI messages, uses Next.js Link with onNavigate callback |
| `src/components/dashboard/TypingIndicator.jsx` | Three-dot pulse animation for AI thinking state, `role="status"`, reduced-motion support |
| `src/components/dashboard/EstimateSummaryCards.jsx` | Summary stat cards for estimates page (pending count, approved value, conversion rate) |
| `src/components/dashboard/EstimateStatusBadge.jsx` | Status badge component for estimate statuses |
| `src/components/dashboard/TierEditor.jsx` | Tier editor panel for Good/Better/Best estimate tiers with line items per tier |
| `src/hooks/useDocumentList.js` | Shared hook for estimate/invoice list pages — fetches, filters by status, provides summary + statusCounts |
| `src/components/dashboard/DocumentListShell.jsx` | Shared UI primitives for document lists: StatusTabs, ListError, ListSkeleton, EmptyFiltered |
| `src/app/dashboard/services/page.js` | redirect() to /dashboard/more/services-pricing |
| `src/app/dashboard/settings/page.js` | redirect() to /dashboard/more |
| `src/components/dashboard/DashboardSidebar.jsx` | Desktop-only left sidebar: 6 nav items (Home, Leads, Calendar, Calls, Invoices, More) + **theme toggle** (sun/moon) between Ask Voco AI and Log Out. Sidebar stays navy in both modes (uses `bg-[var(--sidebar-bg)]` = `#0F172A`). No mobile drawer. |
| `src/components/dashboard/BottomTabBar.jsx` | Mobile-only fixed bottom nav: 5 tabs (Home, Calls, Leads, Calendar, More), h-[56px], lg:hidden, animated orange indicator. Uses `bg-card border-t border-border` for dark-mode compatibility. |
| `src/components/dashboard/MoreBackButton.jsx` | "← Back to More" link shown on More sub-pages via more/layout.js |
| `src/components/dashboard/DashboardTour.jsx` | Joyride guided tour wrapper: 5 steps (Analytics step removed in Phase 49), brand-themed, layout-mounted |
| `src/components/theme-provider.jsx` | Client-side ThemeProvider — re-exports next-themes provider configured for `attribute="class"`, `defaultTheme="light"`, stores preference in localStorage key `theme` |
| `src/app/api/calls/route.js` | GET calls (filtered by date, urgency, booking_outcome, phone search) |
| `src/components/dashboard/LeadFlyout.jsx` | Right Sheet: lead detail, status change, audio/transcript, Create/View Invoice button for completed/paid leads, **Priority-caller toggle** (PATCH `is_vip` — reflected in the Call Routing unified Priority list) |
| `src/components/dashboard/LeadStatusPills.jsx` | Clickable pill strip (new/booked/completed/paid/lost) with live counts; toggles status filter |
| `src/components/dashboard/LeadFilterBar.jsx` | Responsive filter bar above the lead list. Desktop (≥640px): inline flex-wrap (search, urgency Select, job type Input, date range, Clear all). Mobile (<640px): search + `Filters` button that opens a bottom Sheet containing urgency/job-type/date-range with labels. Filter-count badge on the Filters button (excludes search since it stays visible). Status filter is NOT here — it lives in `LeadStatusPills` above. Active-filter pills row below the bar shows/removes any non-status filter. |
| `src/components/dashboard/EscalationChainSection.js` | Escalation contacts CRUD + drag-to-reorder (@dnd-kit) |
| `src/components/dashboard/SetupChecklist.jsx` | Themed checklist: profile/voice/calendar/billing accordions, conic-gradient progress ring, per-item Dismiss/Mark done/Jump actions, window-focus refetch (Phase 48 refactor) |
| `src/components/dashboard/SetupChecklistLauncher.jsx` | Overlay launcher wrapping SetupChecklist — FAB + responsive Sheet (right on lg+, bottom on mobile), sessionStorage auto-open gate, hides when 100% complete (Phase 48-05 revision) |
| `src/components/dashboard/ChecklistItem.jsx` | Expandable checklist item: type badge, description, action link |
| `src/components/dashboard/WorkingHoursEditor.js` | Per-day hours editor: schedule preview bars, timezone selector, controlled preset dropdown, sticky save bar, responsive day cards |
| `src/components/dashboard/CalendarView.js` | Week/day time grid with appointments, external events, travel buffers |
| `src/components/dashboard/DashboardHomeStats.jsx` | 4 animated stat cards with requestAnimationFrame counter |
| `src/lib/leads.js` | `createOrMergeLead()` and `getLeads()` — core lead logic |
| `src/lib/design-tokens.js` | Shared design tokens (colors, btn, card, glass, gridTexture, focus, selected) |
| `src/app/api/leads/route.js` | GET leads (filtered, paginated, NO transcript_text) |
| `src/app/api/leads/[id]/route.js` | GET lead detail (WITH transcript), PATCH status/revenue |
| `src/app/api/escalation-contacts/route.js` | CRUD + PATCH reorder for escalation contacts |
| `src/app/api/setup-checklist/route.js` | GET derived checklist items, PATCH dismiss state |
| `supabase/migrations/004_leads_crm.sql` | leads, lead_calls, activity_log tables + Realtime publication |
| `supabase/migrations/005_setup_checklist.sql` | setup_checklist_dismissed column on tenants |
| `supabase/migrations/006_escalation_contacts.sql` | escalation_contacts table + services.sort_order column |

---

## 0. Scope Notes (read first)

**Phase 52 (Leads → Jobs rename)** — completed 2026-04-17. The dashboard now uses "Jobs" terminology in user-facing copy: `/dashboard/jobs` (with 308 redirect from the prior `leads` path), "Jobs" labels in `DashboardSidebar.jsx` / `BottomTabBar.jsx`, status pills `New · Scheduled · Completed · Paid · Lost` (with `ml-2` gap before Lost). Internal symbols are PRESERVED — `LeadStatusPills.jsx`, `LeadCard.jsx`, `LeadFlyout.jsx`, `LeadFilterBar.jsx`, `EmptyStateLeads.jsx`, `HotLeadsTile.jsx` keep their file names; the `leads` DB table, `leads.status` enum (`new, booked, completed, paid, lost`), `/api/leads/*` routes, and Realtime channel filter `tenant_id=eq.${tenantId}` on the `leads` table are unchanged. The display label for the `booked` enum value is `Scheduled`. Final-state guarantee: a recursive grep for the legacy `leads` URL substring in `src/` returns zero hits; the only allowed mention is the `next.config.js` redirect source.

**Recurring** — the `RecurringSetupDialog.jsx` and `RecurringBadge.jsx` components in `src/components/dashboard/` are **invoice-only**. They're wired into `/src/app/dashboard/invoices/page.js` and `/src/app/dashboard/invoices/[id]/page.js` to configure recurring invoice templates (frequency, start/end dates, next_date). Recurring invoice generation is handled by the `recurring-invoices` cron (see the scheduling-calendar-system skill's cron inventory) and backed by `invoices.is_recurring_template`/`recurring_*` columns (migration 032). There is NO recurring support for appointments — `AppointmentFlyout.js` contains zero recurring logic, and the `appointments` table has no recurrence columns. If a user asks for "recurring" on the dashboard, disambiguate: invoices (exists) vs. appointments (would need a new phase).

**Setup checklist backend** — The Phase 48 refactor landed the theme-accordion UI (covered in Section 5 below) AND introduced migration 050 (`tenants.checklist_overrides` JSONB). The API handler at `src/app/api/setup-checklist/route.js` already consumes the new column for per-item `mark_done` and `dismiss` actions (see Section 13). Full Phase 48 execution is still in flight, but the checklist portion is live.

---

## 1. Dashboard Layout

**File**: `src/app/dashboard/layout.js`

`DashboardLayout({ children })` — 'use client'. Exported as a Suspense wrapper that renders `DashboardLayoutInner` to support `useSearchParams()` per Next.js requirements.

`DashboardLayoutInner({ children })` — the actual layout. Wraps all dashboard pages with:
- `ImpersonationBanner` — z-40, rendered ABOVE the main layout when `?impersonate=` query param is present (admin impersonation mode)
- `BillingWarningBanner` — z-39, amber background, shown when subscription is `past_due` with 3-day grace period countdown + link to Stripe portal
- `TrialCountdownBanner` — z-39, blue (>3 days remaining) or amber (<=3 days remaining), shows trial days remaining + link to /dashboard/more/billing
- `DashboardSidebar` — fixed left sidebar (lg:pl-60), desktop-only, no mobile drawer
- Main content — `max-w-6xl mx-auto px-4 lg:px-8 py-6 pb-[72px] lg:pb-6`
- `BottomTabBar` — mobile-only fixed bottom nav (hidden on lg+)
- `GridTexture` (light variant) — background pattern
- `DashboardTour` — dynamically imported, triggered by `start-dashboard-tour` window event
- **No card wrapper** — each page controls its own card styling (page-level card ownership)

**Important**: Main content div uses `pb-[72px] lg:pb-6` to clear the 56px mobile tab bar.

### Server/Client Layout Split (added Phase 53)

The dashboard layout is split into TWO files (`layout.js` Server Component + `DashboardLayoutClient.jsx` Client Component) so server-side feature-flag fetching can happen once per request without losing the client-side interactivity the existing layout depends on (`usePathname`, `useSearchParams`, `AnimatePresence`, framer-motion, event listeners).

- `src/app/dashboard/layout.js` (**Server Component** — NO `'use client'`):
  - Calls `getTenantId()` and `getTenantFeatures(tenantId)` ONCE per request.
  - Passes the resolved `features` object as a prop to `<DashboardLayoutClient>`.
  - Fails closed: if no `tenantId` (session edge case), `features` defaults to `{ invoicing: false }`.

- `src/app/dashboard/DashboardLayoutClient.jsx` (**Client Component** — has `'use client'`):
  - Contains all the existing client-side layout: `ChatProvider`, `TooltipProvider`, `DashboardSidebar`, `BottomTabBar`, `AnimatePresence`, banners, `DashboardTour`, etc.
  - Receives the `features` prop and wraps everything in `<FeatureFlagsProvider value={features}>` — first wrapper inside the inner function, OUTSIDE `ChatProvider`.
  - Continues to export the same `DashboardLayout`/`DashboardLayoutInner` Suspense pattern for `useSearchParams()` compatibility.

Pattern source: Phase 53 RESEARCH.md Pattern 4 (Option A). This is the dashboard's first Server/Client split; future phases that need server-fetched data for client UI should follow the same shape (fetch in server `layout.js`, pass as prop, wrap children in a Context Provider in the client layout).

### Admin Impersonation Support (Phase 28-03)

When an admin clicks "View as" on the `/admin/tenants` page, they are navigated to:
```
/dashboard?impersonate={tenant_id}&impersonate_name={business_name}
```

The dashboard layout reads these query params via `useSearchParams()` and:
1. Renders `ImpersonationBanner` above all layout content (outside `pointer-events-none` wrapper so it stays interactive)
2. Wraps the entire layout (sidebar + main area) in `pointer-events-none opacity-60` to disable all interactions

**Impersonation Banner** (`src/app/dashboard/ImpersonationBanner.js`):
- Sticky, z-40, height h-11 (44px), `bg-amber-50 border-b border-amber-300`
- Shows: Eye icon + "Viewing as: {tenantName} (read-only)"
- "Exit Impersonation" link back to `/admin/tenants`
- `border-amber-400 text-amber-800 hover:bg-amber-100` button style

**Suspense boundary**: The exported `DashboardLayout` wraps `DashboardLayoutInner` in `<Suspense fallback={<div className="min-h-screen bg-[#F5F5F4]" />}>` to satisfy Next.js requirement for `useSearchParams()` in client components.

**`DashboardTour` wiring in layout:**
```js
const [tourRunning, setTourRunning] = useState(false);

useEffect(() => {
  function handleStartTour() { setTourRunning(true); }
  window.addEventListener('start-dashboard-tour', handleStartTour);
  return () => window.removeEventListener('start-dashboard-tour', handleStartTour);
}, []);

// Render:
<DashboardTour run={tourRunning} onFinish={() => setTourRunning(false)} />
```

### FeatureFlagsProvider (added Phase 53)

`src/components/FeatureFlagsProvider.jsx` exports a thin React Context wrapper plus a `useFeatureFlags()` hook for distributing per-tenant feature flags to dashboard client components.

```jsx
import { useFeatureFlags } from '@/components/FeatureFlagsProvider';

function InvoiceCTA() {
  const { invoicing } = useFeatureFlags();
  return invoicing ? <Button>Create Invoice</Button> : null;
}
```

- **Mounted** by `DashboardLayoutClient.jsx` with `value={features}` (features fetched server-side by `layout.js` via `getTenantFeatures(tenantId)`).
- **Default value**: the hook returns `{ invoicing: false }` when no Provider is mounted (e.g., a component used outside the dashboard tree) — **fail-closed** behaviour matches the helper's server-side default.
- **Future flags** extend the value object without breaking existing consumers: `{ invoicing: boolean, xero: boolean, jobber: boolean, ... }`.
- **Phase 53 consumers**: `DashboardSidebar`, `LeadFlyout`, `MorePage` (`/dashboard/more/page.js`), `FeaturesPage` (`/dashboard/more/features/page.js`), and `BusinessIntegrationsClient` (Phase 54 — reads `useFeatureFlags()` for invoicing-aware status-line copy).
- **Sits alongside** the existing `ChatProvider`/`TooltipProvider` pattern — but its value is **server-injected**, not client-initialized, which is why the dashboard layout needed the Server/Client split above.

**`DashboardSidebar({ businessName })`** — `src/components/dashboard/DashboardSidebar.jsx`

6-item desktop-only nav. Desktop only (lg+). Mobile navigation is handled by BottomTabBar.

```js
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/jobs', label: 'Jobs', icon: Users },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar },
  { href: '/dashboard/calls', label: 'Calls', icon: Phone },
  { href: '/dashboard/invoices', label: 'Invoices', icon: FileText },
  { href: '/dashboard/more', label: 'More', icon: MoreHorizontal },
];
// Phase 52: nav label "Leads" → "Jobs"; canonical href is now /dashboard/jobs.
// Phase 49: Analytics feature removed entirely — no more /dashboard/analytics route.
// Between the Ask Voco AI button and Log Out, the sidebar renders a theme toggle
// (sun/moon icon, uses next-themes setTheme) that flips the root <html> .dark class.
```

Active state: `border-l-2 border-[var(--brand-accent)]` left orange border. Desktop: `lg:fixed lg:w-60 bg-[var(--sidebar-bg)]` (sidebar stays navy in both light/dark modes). Mobile: not rendered (replaced by BottomTabBar).

**`BottomTabBar`** — `src/components/dashboard/BottomTabBar.jsx`

Mobile-only fixed bottom nav. `lg:hidden`. 5 tabs (Home, Calls, Jobs, Calendar, More). Animated orange indicator line (`layoutId="tab-indicator"`) slides between active tabs via framer-motion spring. Tab active state: `text-[var(--brand-accent)]` for active. Container uses `bg-card border-t border-border` for dark-mode support. Height: `h-16` (16 Tailwind units). Safe area: `paddingBottom: env(safe-area-inset-bottom, 0px)` via `safe-area-bottom` utility. Has `data-tour="bottom-nav"`.

```js
const TABS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/calls', label: 'Calls', icon: Phone },
  { href: '/dashboard/jobs', label: 'Jobs', icon: Users },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar },
  { href: '/dashboard/more', label: 'More', icon: MoreHorizontal },
];
// Phase 49: Analytics tab removed. Invoices not in bottom bar — accessible via
// the More hub's quick-access links (mobile) or sidebar (desktop).
```

---

## 2. Guided Tour

**File**: `src/components/dashboard/DashboardTour.jsx`

Wraps `react-joyride` v3. Mounted at layout level (not page level) so it persists across tab navigation.

**Props:**
- `run` (boolean) — controlled by layout.js via `tourRunning` state
- `onFinish` (function) — called when tour FINISHED or SKIPPED; layout resets `tourRunning = false`

**Tour steps (5 total — Phase 49 removed Analytics step):**
1. `[data-tour="home-page"]` — Command center overview
2. `[href="/dashboard/jobs"]` — Jobs tracking
3. `[href="/dashboard/calendar"]` — Calendar / appointments
4. `[href="/dashboard/calls"]` — View every call your AI handled
5. `[href="/dashboard/more"]` — Config hub (placement: 'top')

**Key configuration:**
- `primaryColor: '#C2410C'` — brand orange spotlight
- `locale: { last: 'Got it', skip: 'Skip tour' }`
- `disableAnimation={!!prefersReduced}` — respects `prefers-reduced-motion` via `useReducedMotion()` from framer-motion
- `continuous, showSkipButton, showProgress`
- `zIndex: 9999`
- On FINISHED or SKIPPED: `localStorage.setItem('gsd_has_seen_tour', '1')`

**Tour trigger pattern (CustomEvent):**
```js
// page.js dispatches:
window.dispatchEvent(new CustomEvent('start-dashboard-tour'));

// layout.js listens:
window.addEventListener('start-dashboard-tour', handleStartTour);
```

**Tour button visibility (page.js):**
```js
const [showTour, setShowTour] = useState(false);
useEffect(() => {
  if (!localStorage.getItem('gsd_has_seen_tour')) setShowTour(true);
}, []);
```
Tour button only shows if `gsd_has_seen_tour` is NOT set in localStorage. Never auto-starts.

---

## 3. Dashboard Home — Adaptive Modes

**File**: `src/app/dashboard/page.js`

The home page post-Phase-48 is a single-column daily-ops hub. No more setup-mode vs active-mode branching — setup lives in an overlay launcher, chat lives in the layout-level ChatbotSheet.

### Home Page Structure (Phase 48-05 final)

```
Greeting (time-of-day + AI status pulse + optional tour button)
DailyOpsHub (bento: TodayAppointmentsTile, CallsTile, HotLeadsTile, UsageTile)
HelpDiscoverabilityCard (4 quick-link tiles: Add a service / Change AI voice / Set escalation contacts / View invoices)
RecentActivityFeed (wrapped in card.base)
```

Single column, `space-y-6 lg:space-y-8`. No sidebar, no grid. Responsive for free because every child stacks vertically.

### Setup Checklist — Overlay Launcher (Phase 48-05 revision)

The setup checklist is NOT rendered on the home page directly. It's mounted at the layout level as an overlay via `SetupChecklistLauncher`:

```js
// src/app/dashboard/layout.js
import SetupChecklistLauncher from '@/components/dashboard/SetupChecklistLauncher';
// ...
{!impersonateTenantId && <SetupChecklistLauncher />}
```

**Launcher behavior:**
- **Auto-open:** desktop only (≥ 1024 px), first dashboard visit per session, and only if incomplete. Gated by `sessionStorage['voco_setup_opened']`. On close, the gate is set — Sheet does NOT reopen for the rest of the session.
- **FAB:** when the Sheet is closed, a circular copper button anchors bottom-right. Conic-gradient progress ring around the edge reads as completion %. Centered tabular-nums label shows pending count ("3"). `aria-label="N steps left to finish setup"`. `data-tour="setup-checklist-fab"` reserved for a future tour step.
- **Responsive:** `useIsMobile(1024)` hook picks Sheet `side="right"` on desktop (content stays visible behind) and `side="bottom"` on mobile (drawer pattern). Mobile FAB is 48 px, offset `bottom-[72px]` to clear the 64 px `BottomTabBar`. Desktop FAB is 56 px at `bottom-6`.
- **Complete state:** when `percent >= 100` or all items dismissed, the FAB hides entirely and auto-open is suppressed. Zero visual noise once the owner is set up.
- **Progress source:** `SetupChecklist`'s unchanged `onDataLoaded` prop captures `{ items, dismissed, progress }` — launcher derives `{ total, complete, percent }` from that. No duplicate API call.
- **Hidden during impersonation:** layout skips the mount when `?impersonate=...` query param is present — admin sessions don't see owner-facing nudges.

**Why an overlay (Plan 48-05 revision, Rule-2 pivot):** The original Plan 48-05 rendered SetupChecklist inline at the top of the home page (D-04). User validated the pattern during the human-verify checkpoint, then requested the pivot because the always-visible accordion (~200 px collapsed) occupied too much above-the-fold real estate for owners who had already finished setup. Overlay + FAB makes it claim-no-space-when-done while staying one click away.

### Chat on the Dashboard Home (HOME-04 / HOME-05 post-revision)

The home page does NOT render its own chat surface. `ChatbotSheet` — mounted at `src/app/dashboard/layout.js` inside `ChatProvider` — is the single chat entry point. Opened via the `open-voco-chat` window event (fired from `DashboardSidebar` "Ask Voco AI" button and `dashboard/more/page.js` mobile shortcut). Messages persist across routes because `ChatProvider` wraps the entire dashboard layout.

The abandoned `ChatPanel.jsx` (originally planned as a sticky right-column panel in D-07) was deleted in the Plan 48-05 revision — two chat surfaces on the same page felt redundant.

### data-tour attributes on home page

- Outer div: `data-tour="home-page"`
- DailyOpsHub: `data-tour="daily-ops-hub"`
- Setup launcher FAB: `data-tour="setup-checklist-fab"` (reserved, no tour step yet)

---

## 4. More Menu — Config Hub

**File**: `src/app/dashboard/more/page.js`

`/dashboard/more` is the 5th tab destination. Three sections:

1. **Ask Voco AI** (mobile-only, `lg:hidden`) — button that fires `window.dispatchEvent(new Event('open-voco-chat'))` to open the chatbot sheet.

2. **Quick Access** (mobile-only, `lg:hidden`) — 2 quick-access links to pages that have their own desktop sidebar entries but not mobile bottom-bar tabs:

```js
const QUICK_ACCESS = [
  { href: '/dashboard/invoices', label: 'Invoices', icon: FileText },
  { href: '/dashboard/estimates', label: 'Estimates', icon: ClipboardList },
];
```

3. **Settings** — 9 config sections as card rows:

```js
const MORE_ITEMS = [
  { href: '/dashboard/more/services-pricing', label: 'Services & Pricing', description: 'Manage your service list and urgency tags', icon: Wrench },
  { href: '/dashboard/more/working-hours', label: 'Working Hours', description: 'Set your weekly availability schedule', icon: Clock },
  { href: '/dashboard/more/service-zones', label: 'Service Zones & Travel', description: 'Define coverage areas and travel buffers', icon: MapPin },
  { href: '/dashboard/more/notifications', label: 'Notifications & Escalation', description: 'Alerts per call outcome and emergency contact chain', icon: Bell },
  { href: '/dashboard/more/billing', label: 'Billing', description: 'Plan, usage, and invoices', icon: CreditCard },
  { href: '/dashboard/more/features', label: 'Features', description: 'Enable or disable optional features', icon: Zap }, // Phase 53 — always visible, never filtered
  { href: '/dashboard/more/invoice-settings', label: 'Invoice Settings', description: 'Business info, tax rate, and invoice numbering', icon: FileText },
  { href: '/dashboard/more/integrations', label: 'Integrations', description: 'Connect accounting software for invoice sync', icon: Plug },
  { href: '/dashboard/more/ai-voice-settings', label: 'AI & Voice Settings', description: 'Phone number, AI tone, and test call', icon: Bot },
  { href: '/dashboard/more/account', label: 'Account', description: 'Profile and account management', icon: UserCircle },
];
```

**Note:** The old `calendar-connections` and `escalation-contacts` entries were consolidated. Calendar connections is now part of the Integrations page. Escalation contacts is now part of the Notifications & Escalation page.

**Sub-page pattern**: Thin `page.js` files that wrap existing components in `card.base` with an `h1` heading. No duplication of feature logic.

**Redirects**: Old routes redirect to preserve bookmarks:
- `/dashboard/services` — `redirect('/dashboard/more/services-pricing')`
- `/dashboard/settings` — `redirect('/dashboard/more')`

**Setup checklist hrefs** (in `src/app/api/setup-checklist/route.js`) updated to point to new More routes:
- `connect_calendar` — `/dashboard/more/calendar-connections`
- `configure_hours` — `/dashboard/more/working-hours`
- `make_test_call` — `/dashboard/more/ai-voice-settings`

### Account Page (`/dashboard/more/account`)

**File**: `src/app/dashboard/more/account/page.js`

Profile editor with three sections:

1. **Profile form** — editable fields: `business_name` (required), `owner_name`, `owner_email`, `owner_phone`. Fetches from `GET /api/account`, saves via `PATCH /api/account`. Dirty detection via JSON comparison. Shows "Saved" confirmation for 3 seconds.
2. **Account details** — read-only display: login email (from Supabase Auth `user.email`), trade type, country, member since date.
3. **Sign out** — sign out button with AlertDialog confirmation. Uses `supabase.auth.signOut()` then redirects to `/auth/signin`.

**API Route**: `src/app/api/account/route.js`
- `GET` — returns tenant profile fields + `user.email` from Supabase Auth
- `PATCH` — updates only allowed fields (`business_name`, `owner_name`, `owner_email`, `owner_phone`). Validates `business_name` is not empty. Uses service role client for write.

### Invoice Settings Page (`/dashboard/more/invoice-settings`)

**File**: `src/app/dashboard/more/invoice-settings/page.js`

Configures business identity and invoice defaults. Uses `invoice_settings` table (auto-created on first GET via `/api/invoice-settings`). Five sections:

1. **Business Identity** — logo upload (Supabase Storage `invoice-logos` bucket, PNG/JPG max 2MB, path `{tenantId}/logo.{ext}`), business_name, license_number, address, phone, email.
2. **Tax Configuration** — tax_rate as percentage (stored as decimal 0-1, displayed as percentage 0-100). Applied to taxable line items only.
3. **Late Fees** — toggle `late_fee_enabled`, fee type (flat amount or percentage per month), fee amount. Uses Switch + Select components.
4. **Invoice Defaults** — payment_terms (Net 15/30/45/60 via Select dropdown), default_notes (textarea, appears on every invoice).
5. **Numbering** — invoice_prefix (alphanumeric, max 10 chars), next invoice number preview (format: `{prefix}-{year}-{seq}`).

**API Route**: `src/app/api/invoice-settings/route.js`
- `GET` — returns `invoice_settings` row. Auto-creates seeded from `tenants.business_name` and `tenants.owner_email` if none exists.
- `PATCH` — updates allowed fields. Validates: tax_rate (0-1), payment_terms (enum), invoice_prefix (regex `^[a-zA-Z0-9]{1,10}$`).

### Features Page (`/dashboard/more/features`) — Phase 53

**File**: `src/app/dashboard/more/features/page.js`

Dedicated settings panel hosting per-tenant feature-flag toggles. Designed as a list-of-toggles to scale with future flags (xero, jobber, …) without a redesign.

- **Always accessible** — explicitly EXCLUDED from the proxy gate matcher (`INVOICING_GATED_PATHS` in `src/proxy.js`). Owners must always be able to re-enable a disabled flag, so this route is never gated.
- **Always in MORE_ITEMS** — the entry is never filtered out by the conditional render logic (see "Feature-Flag-Gated UI" below).
- **Layout** mirrors `invoice-settings/page.js`: `<h1>Features</h1>` + `<Separator>` + `card.base` container with `divide-y` rows.
- **Each feature row**: icon (lucide `Zap` for invoicing) in a `bg-muted` container, label + description (text-sm semibold + text-xs muted), shadcn `<Switch>` on the right.
- **Flip-on**: silent (no toast confirmation — the UI change itself is the feedback).
- **Flip-off**: conditional flow — if `invoices.count + estimates.count > 0`, show a shadcn `<AlertDialog>` with locked copy ("Disable invoicing?", **brand-accent** confirm button, NOT destructive/red) warning about hidden data; else silent flip. Data is preserved on disable — invoices / estimates remain in the DB, just hidden from UI.
- **Toggle persistence**: `PATCH /api/tenant/features` with body `{ features: { invoicing: boolean } }`. Optimistic UI with rollback on error.
- **Counts source**: `GET /api/tenant/invoicing-counts` — returns `{ invoices, estimates }` for the authenticated tenant. NOT gated by the invoicing flag (must work at flip-off time so the warning dialog can show the impact count).

**Position in MORE_ITEMS**: between Billing (`/dashboard/more/billing`) and Invoice Settings (`/dashboard/more/invoice-settings`). Permanent — never filtered out.

### Feature-Flag-Gated UI (added Phase 53)

Three components hide invoicing UI when `features.invoicing = false`. All read the flag via `useFeatureFlags()`.

1. **`DashboardSidebar`** — filters `NAV_ITEMS` at render time:
   ```js
   const { invoicing } = useFeatureFlags();
   NAV_ITEMS
     .filter((item) => item.href !== '/dashboard/invoices' || invoicing)
     .map(...)
   ```
   The `space-y-1` gap collapses naturally when the item is removed; no compensation classes needed.
2. **`LeadFlyout`** — wraps the entire invoice-related CTA block (Create Invoice / Create Estimate buttons + any linked-invoice display) in `{invoicing && (...)}`. **DOM removal**, NOT a disabled state. No "invoicing disabled" message inside the flyout — the Features panel is the canonical learning surface.
3. **`MorePage`** (`/dashboard/more/page.js`) — derives two filtered lists at render:
   - `visibleQuickAccess = invoicing ? QUICK_ACCESS : []` (hides Invoices + Estimates mobile quick links)
   - `visibleMoreItems = MORE_ITEMS.filter(...)` hides BOTH `invoice-settings` AND `integrations` entries when invoicing is off (Phase 54 integrations are invoicing-adjacent)
   - The Quick Access card is wrapped in `{visibleQuickAccess.length > 0 && (...)}` — when empty, the card container is NOT rendered (no empty card).

**`BottomTabBar`** has NO Invoices tab in `TABS` (verified Phase 53) — no change needed there.

**Defense in depth**: the UI hide is the top layer. Even if a user removes `display:none` via devtools:
- Hitting `/dashboard/invoices`, `/dashboard/estimates`, `/dashboard/more/invoice-settings` returns a **302 redirect** to `/dashboard` via `src/proxy.js` page gate (Plan 03).
- Hitting `/api/invoices/**`, `/api/estimates/**`, `/api/accounting/**` returns a **404 with empty body** (Plan 04 — indistinguishable from a non-existent route).
- Invoice-reminder / recurring-invoice crons filter tenants via `.eq('features_enabled->>invoicing', 'true')` at the SQL level (Plan 05).

Three enforcement layers (UI hide, proxy redirect, API 404) so no single bypass reveals invoicing functionality to disabled tenants.

### Business Integrations Page (`/dashboard/more/integrations`) — Phase 54

**Files**:
- `src/app/dashboard/more/integrations/page.js` — Server Component (no `'use client'`)
- `src/components/dashboard/BusinessIntegrationsClient.jsx` — Client child

**Heading**: H1 "Business Integrations" (renamed from "Integrations" in Phase 54 D-04).

**Shape**: Server Component reads `tenantId` via `getTenantId()` then `await getIntegrationStatus(tenantId)` — the status helper carries `'use cache'` + `cacheTag('integration-status-${tenantId}')` (D-10 smoke test for Next.js 16 cacheComponents loop). Result is passed as `initialStatus` prop to `BusinessIntegrationsClient`, which owns all interaction state.

**Sections on page:**

1. **Calendar Connections** (unchanged, preserved from pre-Phase-54) — `CalendarSyncCard` component (Google/Outlook OAuth).
2. **Accounting & Job Management** — two provider cards side-by-side at md+, stacked <768px:
   - **Xero** (`FileSpreadsheet` icon)
   - **Jobber** (`Wrench` icon)

QuickBooks and FreshBooks cards were **deleted** in Phase 54 (D-15) — not hidden.

**Connect flow (per provider):**
1. Owner clicks "Connect Xero" / "Connect Jobber" → Client fetches `GET /api/integrations/{provider}/auth`
2. Response `{ url }` → full-page redirect via `window.location.href = url`
3. Provider OAuth consent → provider redirects to `/api/integrations/{provider}/callback?code=...&state=...`
4. Callback route upserts `accounting_credentials` row (Phase 54 schema — `provider`, `scopes TEXT[]`, `last_context_fetch_at TIMESTAMPTZ`) and calls `revalidateTag('integration-status-${tenantId}')`
5. Redirect to `/dashboard/more/integrations?connected=xero` → page re-renders with fresh status; `useEffect` on searchParams fires `toast.success('Xero connected.')`

**Disconnect flow:**
1. Owner clicks "Disconnect" → AlertDialog opens with verbatim UI-SPEC title ("Disconnect Xero?" / "Disconnect Jobber?") and body copy
2. Confirm → `POST /api/integrations/disconnect` with `{ provider }` body
3. Server calls `adapter.revoke()` (best-effort) → deletes `accounting_credentials` row → `revalidateTag`
4. Client optimistically removes connection from state; card re-renders disconnected

**Invoicing flag dependency (Phase 53):**
Status-line copy varies depending on `useFeatureFlags().invoicing` from `@/components/FeatureFlagsProvider`:
- **Disconnected:** "Connect Xero to share customer history with your AI receptionist during calls."
- **Connected, invoicing OFF:** "Connected. Sharing customer context with your AI receptionist."
- **Connected, invoicing ON:** "Connected. Sharing customer context and sending invoices."
(Mirror structure for Jobber.)

All copy is locked verbatim in `54-UI-SPEC.md` Copywriting Contract.

### Billing Page (`/dashboard/more/billing`)

**File**: `src/app/dashboard/more/billing/page.js`

Displays subscription status and usage for the current tenant. Four sections:

1. **Plan card** — shows plan name, price, status badge (`active`/`trialing`/`past_due`/`cancelled`/`paused`). Displays cancel-at-period-end warning when subscription is set to cancel at the end of the billing period.
2. **Usage meter** — `UsageRingGauge` (`src/components/dashboard/UsageRingGauge.js`) SVG donut ring showing `calls_used / calls_limit` with overage visualization when usage exceeds the plan limit.
3. **Billing details** — renewal date, "Manage Subscription" button that links to the Stripe customer portal.
4. **Recent invoices** — table of up to 5 invoices displaying date, amount, status badge, and link to the Stripe-hosted invoice.

---

## 5. Setup Checklist — Theme Accordion (Phase 48 refactor)

**File**: `src/components/dashboard/SetupChecklist.jsx`

Refactored in Phase 48 Plan 03 (D-01: refactor-in-place) to group items by **theme** instead of required/recommended. Each item still carries a Required/Recommended **badge** so both mental models coexist. The conic-gradient progress ring and `SetupCompleteBar` celebration are preserved verbatim.

**Theme groups (Phase 48 D-02):** `profile → voice → calendar → billing`. Order is canonical — `THEME_ORDER` array drives both the GET response ordering (from `/api/setup-checklist/route.js`) and the accordion render order.

```js
// From src/app/api/setup-checklist/route.js
export const THEME_GROUPS = {
  profile:  ['setup_profile'],
  voice:    ['configure_services','make_test_call','configure_hours','configure_notifications','configure_call_routing'],
  calendar: ['connect_calendar','configure_zones','setup_escalation'],
  billing:  ['setup_billing'],
};
```

**Data fetching:** Uses `useSWRFetch('/api/setup-checklist', { revalidateOnFocus: true })` — returning from an external tab (e.g., Stripe Checkout, Google Calendar OAuth) automatically refetches checklist state. No manual `visibilitychange` listener, no Realtime subscription.

**ProgressRing component** — conic-gradient single-segment donut:
- Copper (#C2410C) for completed percentage
- Light gray (#E7E5E4) for incomplete remainder
- Center shows `{completed}/{total}` with `tabular-nums`

**shadcn Accordion** — `type="single" collapsible`. Each theme trigger shows:
- Theme label (Profile / Voice / Calendar / Billing)
- `CheckCircle2` glyph (text-stone-500, NOT copper) when all items in the theme are complete
- Mini-progress caption: `{n} of {total} complete`

Default-open accordion: the first theme with an incomplete item (falls back to `voice` when everything is done).

**`onDataLoaded` callback prop:** Preserved for back-compat. Fired via SWR's `onSuccess` — `onDataLoaded?.(payload)` receives `{ items, dismissed, completedCount, progress }`. Parents (e.g., `src/app/dashboard/page.js`) continue to consume the same shape.

**Per-item actions** — each row exposes three buttons:
1. **Jump to page** — primary `btn.primary` CTA; label is context-sensitive per UI-SPEC copywriting contract:
   - `Finish setup` — required row, not started
   - `Continue` — `mark_done_override === true && complete === false`
   - `Open settings` — recommended-only rows
2. **Mark done / Unmark done** — ghost button. Optimistically flips `complete` + `mark_done_override` via SWR `mutate`, then fires PATCH `{ item_id, mark_done: <bool> }`. Revert + error toast on failure.
3. **Dismiss** — icon-only `X` (`min-w-[44px]`). Hidden for required items. Optimistically removes the row, then PATCH `{ item_id, dismiss: true }`. Fires sonner toast `Dismissed.` with **Undo** action that reverse-PATCHes `{ item_id, dismiss: false }` and refetches.

**Whole-checklist dismiss** (`SetupCompleteBar` path): when `progress.complete === progress.total`, the celebration bar renders; its dismiss PATCHes `{ dismissed: true }` (unchanged from prior behavior).

**`ChecklistItem.jsx`** — single-row component:
- Completion icon (`CheckCircle2` copper when complete, `Circle` stone when not)
- Title + Required/Recommended `Badge` (copper-soft vs stone; `font-normal text-xs tracking-wide uppercase` — two-weight rule override of shadcn default)
- Description paragraph
- Action button row with ≥44px touch targets, all with `aria-label`
- `framer-motion` `layout` + fade-in entrance animation

Checklist items are **derived from tenants table columns** — not stored as separate rows:
- `create_account` — always complete
- `setup_profile` — `!!tenant.business_name`
- `configure_services` — `serviceCount > 0`
- `make_test_call` — `!!tenant.onboarding_complete`
- `configure_hours` — `!!tenant.working_hours`
- `connect_calendar` — `!!calendar_credentials row` (any provider, not just Google)
- `configure_zones` — `service_zones` count > 0
- `setup_escalation` — active `escalation_contacts` count > 0
- `configure_notifications` — `notification_preferences` differs from defaults

---

## 6. Lead Lifecycle

**File**: `src/lib/leads.js`

### `createOrMergeLead(params)`

```js
createOrMergeLead({
  tenantId,       // uuid
  callId,         // uuid
  fromNumber,     // string
  callerName,     // string | undefined
  jobType,        // string | undefined
  serviceAddress, // string | undefined
  triageResult,   // { urgency?: string }
  appointmentId,  // string | null
  callDuration,   // number (seconds)
}) → Promise<lead | null>
```

**Flow:**
1. `callDuration < 15` — return null (voicemail/misdial filter)
2. Query `leads` table: same `tenant_id` + `from_number`, status `IN ('new', 'booked')`, newest first, limit 1
3. If existing open lead — insert into `lead_calls` junction, return existing lead
4. If no open lead — insert new `leads` row; status = `'booked'` if `appointmentId` else `'new'`
5. Insert `lead_calls` row linking new lead to call
6. Insert `activity_log` row with `event_type: 'lead_created'`

**Status lifecycle**: `new` → `booked` → `completed` → `paid` / `lost`
Soft-delete: `is_active = false` via escalation contact DELETE (preserves history)

### `getLeads(params)`

```js
getLeads({
  tenantId, status, urgency, dateFrom, dateTo, search, jobType
}) → Promise<Array>
```

Joins `calls` via `lead_calls` junction. **Intentionally excludes `transcript_text`** from the SELECT — fetched only in the detail endpoint for performance. Filters: `.eq`, `.gte`, `.lte`, `.ilike` on caller_name and from_number.

---

## 7. Lead API Routes

**`GET /api/leads`** — `src/app/api/leads/route.js`

Query params: `status`, `urgency`, `date_from`, `date_to`, `search`, `job_type`. Returns `{ leads }`. Joins `lead_calls(calls(...))` without `transcript_text`. Limit 100.

**`GET /api/leads/[id]`** — `src/app/api/leads/[id]/route.js`

Returns full lead detail **including** `transcript_text` and `transcript_structured`. Also joins `appointments(id, start_time, end_time, status, service_address)`.

**`PATCH /api/leads/[id]`**

Body: `{ status, revenue_amount, previous_status }`. Validation: `status === 'paid'` requires `revenue_amount`. Side effect: logs `status_changed` to `activity_log` (fire-and-forget async IIFE, never blocks response).

---

## 8. Dashboard Pages

### Jobs (`src/app/dashboard/jobs/page.js`) — formerly Leads, renamed Phase 52

Client component. Features:
- **Status pill strip** (`LeadStatusPills`): one clickable pill per pipeline status with live count; toggles the status filter client-side (no refetch)
- **Filter bar**: urgency, date range, search, jobType (server-side); status filter is applied client-side via pill strip
- **Single list view** (LeadCard rows) — no view toggle; visual pipeline overview lives in the pill strip
- **Realtime**: subscribes to `postgres_changes` on `leads` table filtered by `tenant_id=eq.${tenantId}` for INSERT and UPDATE events. INSERT matching skips status (handled client-side)
- **Flyout**: `LeadFlyout` rendered **outside the card stack** to avoid Sheet overlay stacking context issues
- **Animation**: new Realtime inserts get `_isNew: true` flag — `animate-slide-in-from-top` class (injected via `ensureSlideInKeyframe()`)
- **Card wrapper**: `card.base` wrapper on return, `data-tour="leads-page"`

### Calendar (`src/app/dashboard/calendar/page.js`)

Client component. Month/day view toggle (mobile always forces day view). Two-row toolbar: Row 1 = navigation + view toggle, Row 2 = Today/Refresh + Show completed toggle + unified "+ New" popover.

**"+ New" popover**: Single orange button opens a Popover with two options: "Book appointment" (opens `QuickBookSheet`) and "Block time" (opens `TimeBlockSheet`).

**Data fetching**: Parallel `Promise.all` fetching `GET /api/appointments` and `GET /api/calendar-blocks`. Time blocks stored in `data.timeBlocks`.

**Components orchestrated**:
- `CalendarView` — month grid + day/week hourly grid. Day view uses 48px hour rows (vs 64px week). Grid range adapts to working hours ±1hr padding.
- `AppointmentFlyout` — appointment details. Mark complete (emerald, two-step + "Skip & Complete"). Undo completion with confirmation. All destructive actions have AlertDialog.
- `TimeBlockSheet` — create/edit time blocks. Quick presets (Lunch/Personal/Errand/Vacation). Multi-day with group_id. "Sync to calendar" toggle. Group delete ("Delete all N days" via server-side group_count).
- `QuickBookSheet` — booking form. Two modes: slot-click (time pre-filled) and toolbar (editable date/time). "Sync to calendar" toggle.
- `ExternalEventSheet` — view Google/Outlook events. "Open in {provider}" button links to event date.
- `ConflictAlertBanner`, `CalendarSyncCard`, `WorkingHoursEditor`

**Show completed toggle**: localStorage-persisted, hydration-safe. Filters appointments client-side. Month view shows completed jobs with emerald background + checkmark + strikethrough.

**CalendarView visual hierarchy**: Blue appointments (z-10) > Violet external events (z-5) > Amber time blocks (z-1) > Stone off-hours shading. All-day blocks/events in dedicated row above hourly grid.

### Estimates (`src/app/dashboard/estimates/page.js`)

Client component. Estimate list with status filter tabs (all/draft/sent/approved/declined/expired) and summary stat cards (pending count, approved value, conversion rate). Uses shared `useDocumentList` hook with `itemsKey: 'estimates'` and shared `DocumentListShell` UI primitives (StatusTabs, ListError, ListSkeleton, EmptyFiltered). Desktop shows table with columns: Estimate #, Customer, Job Type, Amount, Created, Valid Until, Status. Mobile shows compact cards. Tiered estimates display amount as a range (min - max from tier totals). Floating action button on mobile.

### Estimate Editor (`src/app/dashboard/estimates/new/page.js`)

Client component. Dual-purpose: new estimates and editing existing ones (via `?id=` query param). Pre-fills from `?lead_id=` query param. Features:

- **Lead search + link** — debounced search (`/api/leads?search=...`) with dropdown results. Linked lead shown as chip with unlink button. Auto-fills customer info from selected lead.
- **Customer info** — name (required), email, phone, job type, service address.
- **Dates** — created date (defaults to today), valid until (optional).
- **Line items** — single-price mode with add/remove/reorder. Each item has: item_type, description, quantity, unit_price, markup_pct, taxable, sort_order. Uses `LineItemRow` component.
- **Tiered mode** — "Add Tier" button transitions from single-price to tiered. Up to 3 tiers (Good/Better/Best defaults). Each tier managed by `TierEditor` component with independent line items. Removing tiers until 1 remains reverts to single-price mode.
- **Totals** — calculated via `calculateInvoiceTotals()` using tax rate from invoice settings.
- **Notes** — visible to customer on the estimate.
- **Settings nudge** — amber banner when `business_name` is not set, linking to `/dashboard/more/invoice-settings`.
- **Save** — "Save as Draft" (status=draft) or "Send Estimate" (status=sent). POST for new, PATCH for edit. Mobile sticky bottom action bar.

### Estimate Detail (`src/app/dashboard/estimates/[id]/page.js`)

Client component. Two-column layout (70/30 split on desktop):

**Left column** — `EstimatePreview` component renders invoice-style document preview:
- Header: business logo + info (from invoice_settings) | ESTIMATE title + number + dates
- Customer info section
- Single-price: line items table with subtotal/tax/total
- Tiered: side-by-side tier cards (`TierCard`) with independent line item tables and totals
- Footer: valid-until date + notes

**Right column** — metadata card (status, created, valid until, sent/approved dates, linked lead, converted invoice link) + actions card:
- Download PDF — always visible
- Send Estimate — draft only, calls `POST /api/estimates/[id]/send`
- Edit — draft only, navigates to `/dashboard/estimates/new?id=`
- Mark as Approved — sent only
- Mark as Declined — sent only, with AlertDialog confirmation
- Mark as Expired — sent only
- Convert to Invoice — approved + not yet converted. Single-price: AlertDialog confirmation → `POST /api/estimates/[id]/convert`. Tiered: Dialog with radio tier selection → `POST /api/estimates/[id]/convert` with `{ tier_id }`.

Mobile sticky bottom bar with key actions.

### Batch Invoice Review (`src/app/dashboard/invoices/batch-review/page.js`)

Client component. Displays batch-created draft invoices for review before sending. URL: `/dashboard/invoices/batch-review?ids=id1,id2,...`.

- Fetches each invoice by ID via `GET /api/invoices/[id]`
- Invoice cards show number, status badge, customer name/email, amount
- Per-invoice actions: edit (navigate to detail) or remove (DELETE API call + remove from local list)
- "Send All" button with AlertDialog confirmation → `POST /api/invoices/batch-send` with `{ invoice_ids }`
- Progress bar during send
- Results view: per-invoice success/failure with CheckCircle2/XCircle icons, summary counts

### Estimate API Routes

**`GET /api/estimates`** — `src/app/api/estimates/route.js`

Query params: `status`, `search` (customer_name or estimate_number), `lead_id`, `limit` (default 50, max 500), `offset`. Returns `{ estimates, total_count, summary: { pending_count, approved_value, conversion_rate }, status_counts }`. Enriches each estimate with `tier_count` and `tier_range` (min/max totals from `estimate_tiers`).

**`POST /api/estimates`** — Creates estimate with atomic sequential estimate number via `get_next_estimate_number` RPC. Supports single-price (line items with `tier_id = NULL`) and tiered (creates `estimate_tiers` + `estimate_line_items` per tier). Uses `calculateInvoiceTotals()` and `calculateLineTotal()` from `src/lib/invoice-calculations`. Estimate prefix from `invoice_settings.estimate_prefix` (default 'EST').

**`GET /api/estimates/[id]`** — Returns `{ estimate, tiers, line_items }`.

**`PATCH /api/estimates/[id]`** — Updates editable fields + status transitions (`sent` sets `sent_at`, `approved` sets `approved_at`, `declined` sets `declined_at`). Handles line item/tier replacement (delete-all + re-insert pattern). Fetches tax rate from `invoice_settings` for recalculations.

**`DELETE /api/estimates/[id]`** — Only allowed when status is 'draft'. Cascades to line items and tiers via FK ON DELETE CASCADE.

**`POST /api/estimates/[id]/send`** — Generates PDF via `generateEstimatePDF()`, sends email via Resend (`from: noreply@voco.live`), optional SMS via Twilio (non-fatal on failure). Tiered estimates include price range in SMS. Updates status to 'sent'.

**`POST /api/estimates/[id]/convert`** — Converts approved estimate to draft invoice. Idempotent (returns existing invoice_id if `converted_to_invoice_id` already set). For tiered estimates, `tier_id` is required to select which tier's line items to copy. Creates invoice via `get_next_invoice_number` RPC, copies customer info + selected line items, sets `converted_to_invoice_id` on estimate.

### Invoice Settings API Route

**`GET /api/invoice-settings`** — Returns `{ settings }`. Auto-creates row seeded from `tenants.business_name` and `tenants.owner_email` if none exists.

**`PATCH /api/invoice-settings`** — Updates allowed fields: `business_name`, `address`, `phone`, `email`, `logo_url`, `license_number`, `tax_rate` (0-1), `payment_terms` (Net 15/30/45/60), `default_notes`, `invoice_prefix` (1-10 alphanumeric).

---

## 9. CRM Components

### `LeadFlyout({ leadId, open, onOpenChange, onStatusChange })`

**File**: `src/components/dashboard/LeadFlyout.jsx`

Right-side Sheet. On open, fetches `GET /api/leads/${leadId}` (includes transcript) AND `GET /api/invoices?lead_id=${leadId}` to check for linked invoice. Renders:
- Urgency badge + relative time
- Caller info (phone, call timestamp)
- Job details (job_type, service_address, triage layer/confidence)
- `AudioPlayer` with recording URL
- `TranscriptViewer` with structured + text transcript
- Status `Select` + `RevenueInput` (shown for completed/paid)
- "Update Status" button — `PATCH /api/leads/${leadId}`
- **"Create Invoice" button** (Phase 33): shown when lead status is 'completed' or 'paid' AND no linked invoice exists — navigates to `/dashboard/invoices/new?lead_id=${lead.id}`. Styled with `text-[#C2410C] border-[#C2410C]` brandOrange outline.
- **"View Invoice (INV-XXXX)" button** (Phase 33): shown when a linked invoice already exists — navigates to `/dashboard/invoices/${linkedInvoice.id}`. Styled with `text-stone-600 border-stone-300`.
- "Mark as Lost" with `AlertDialog` confirmation

Key constants: `URGENCY_STYLES`, `STATUS_LABELS`, `STATUS_OPTIONS`.
`formatRelativeTime(iso)` — relative display (just now, Xm ago, Xh ago, Xd ago).
Invoice state: `linkedInvoice` — fetched on open, reset on close.

### `LeadStatusPills({ counts, activeStatus, onStatusChange })`

**File**: `src/components/dashboard/LeadStatusPills.jsx`

Horizontal pill strip rendered between the page header and filter bar on the Jobs page. One pill per pipeline status with a live count badge — DB enum values (`new`, `booked`, `completed`, `paid`, `lost`) drive the data, but display labels are home-service vernacular: **New · Scheduled · Completed · Paid · Lost** (the `booked` enum renders as "Scheduled"). The Lost pill is rendered with an `ml-2` left margin to visually separate the terminal-negative state from the active pipeline (Phase 52). Clicking a pill sets `filters.status`; clicking the active pill clears it. Each status has a distinct active color matching the pipeline semantics (Phase 49 categorical dark-mode palette: orange/blue/stone/green/red — preserved verbatim through Phase 52). Mobile-friendly: horizontal overflow with hidden scrollbar. No data fetching — counts are derived client-side from the parent's `leads` array.

### `EscalationChainSection()`

**File**: `src/components/dashboard/EscalationChainSection.js`

CRUD interface for escalation contacts with drag-to-reorder. Max 5 active contacts per tenant.

Key pattern — **`SortableContactWrapper`**: thin wrapper around `useSortable` that passes drag props to `ContactCard`. `ContactCard` stays clean and unaware of DnD.

```js
function SortableContactWrapper({ contact, ...rest }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: contact.id });
  return <ContactCard contact={contact} dragHandleProps={{ ...listeners, ...attributes }} dragRef={setNodeRef} ... />;
}
```

New (unsaved) contact is rendered as plain `ContactCard` (not sortable) until saved via `POST /api/escalation-contacts`. Save chain order — `PATCH /api/escalation-contacts` with `{ order: [{ id, sort_order }] }`.

Per-urgency mapping rows use `Switch` toggles (display-only, not persisted to DB). Emergency is locked (always enabled).

### `WorkingHoursEditor()`

**File**: `src/components/dashboard/WorkingHoursEditor.js`

Redesigned working hours editor. Key features:

- **Weekly overview bar chart**: `ScheduleBar` components render horizontal bars (6 AM–10 PM range) per day showing working hours as brand-orange segments with gaps for breaks. Disabled days show empty gray bars.
- **Controlled preset dropdown**: `activePreset` derived via `useMemo(() => detectPreset(hours))` — auto-reverts to "Custom" (disabled item) when hours no longer match any preset. Fixes stale-label bug from uncontrolled `defaultValue`.
- **Timezone selector**: Loads `tenant_timezone` from GET response, renders grouped `Select` (US, Canada, Asia-Pacific, Europe zones), includes in PUT payload. No migration needed — API already supports `tenant_timezone`.
- **Day cards**: Each day is a rounded card. Enabled days: white bg, orange left border (`border-l-[3px] border-l-[#C2410C]`). Disabled days: gray bg, dimmed. Toggle + day name + inline time inputs (desktop) or stacked time inputs (mobile via `sm:hidden`/`hidden sm:flex`).
- **Break as chip**: Lunch break rendered as an inline pill (`bg-stone-50 border border-stone-100 rounded-lg`) with Clock icon, time inputs, and X remove button. "+ Add break" shown with Plus icon when no break.
- **Copy popover enhanced**: Quick-action buttons "All weekdays" and "Select all" above per-day checkboxes. `applyToWeekdays(sourceDay)` applies source schedule to all weekdays in one click.
- **Sticky save bar**: Fixed bottom bar (`z-30`, `lg:left-60` to clear sidebar) slides up via `translate-y` transition when `isDirty`. Shows pulsing amber dot, "Unsaved changes", Discard button (resets to saved state), and Save Changes button.
- **Mobile responsive**: Time inputs stack vertically on `< sm` breakpoint with "Opens"/"Closes" labels.
- **Slot duration context**: Shows interpolated text "Your AI will offer {duration} time slots when booking appointments."
- **Dirty detection includes timezone**: `isDirty` checks hours + slotDuration + timezone against saved values.
- **No duplicate heading**: Heading lives in `page.js` wrapper only; component uses `aria-labelledby` pointing to that heading.
- **Save payload**: `PUT /api/working-hours` with `{ working_hours, slot_duration_mins, tenant_timezone }`.

### `CalendarView({ appointments, externalEvents, travelBuffers, currentDate, viewMode, loading, onAppointmentClick })`

**File**: `src/components/dashboard/CalendarView.js`

Time grid from 7 AM to 8 PM (START_HOUR=7, END_HOUR=20, HOUR_HEIGHT=48px). CSS grid: `grid-cols-[48px_repeat(7,1fr)]` for week, `grid-cols-[48px_1fr]` for day.

Block components: `AppointmentBlock` (clickable, urgency color), `TravelBufferBlock` (dashed stone), `ExternalEventBlock` (purple, Google Calendar events). `CurrentTimeIndicator` — orange line updated every minute via `setInterval`.

Position calculation: `getPositionStyle(startTime, endTime)` converts timestamps to `top`/`height` pixel values relative to START_HOUR.

### `DashboardHomeStats({ stats })`

**File**: `src/components/dashboard/DashboardHomeStats.jsx`

4 stat widgets: New Leads Today, Upcoming Appointments, Calls Today, Conversion Rate.

**Counter animation**: `requestAnimationFrame` with ease-out cubic (`1 - Math.pow(1 - progress, 3)`). 600ms duration. Stagger via `index * 80ms` delay. `prefers-reduced-motion` — skips animation, sets value immediately.

```js
const StatWidget = ({ label, value, Icon, formatter, index }) => { ... }
```

---

## 10. Design Tokens

**File**: `src/lib/design-tokens.js`

Shared by both onboarding and dashboard. Import individual exports:

**Phase 49 rewrite:** All hex literals were replaced with `var(--*)` references. The token file now reads from CSS variables defined in `globals.css`, which flip between light and dark themes automatically via the `.dark` class on `<html>`.

```js
// Post-Phase 49 shape (illustrative — see src/lib/design-tokens.js for actual content):
export const colors = {
  brandOrange: 'var(--brand-accent)',        // resolves to #C2410C light / slightly brighter dark
  brandOrangeDark: 'var(--brand-accent-hover)',
  navy: 'var(--sidebar-bg)',                 // stays #0F172A in both modes (sidebar is always navy)
  warmSurface: 'var(--warm-surface)',        // bg-muted equivalent
  bodyText: 'var(--muted-foreground)',       // text-muted-foreground
};

export const btn = {
  primary: 'bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-[var(--brand-accent-fg)] transition-all duration-150',
};

export const card = {
  base: 'bg-card rounded-2xl shadow-[...] border border-border',
  hover: 'hover:shadow-[...] hover:-translate-y-0.5 transition-all duration-200',
};

export const focus = { ring: 'focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1' };
export const selected = {
  card: 'border-[var(--brand-accent)] bg-[var(--selected-fill)]',
  cardIdle: 'border-border bg-muted hover:bg-accent',
};
```

### Dark Mode (Phase 49)

Dark mode is implemented via `next-themes` with `attribute="class"` and `defaultTheme="light"`. Toggle lives in `DashboardSidebar.jsx` between Ask Voco AI and Log Out. Storage key: `localStorage.theme`.

**Key CSS variables defined in `src/app/globals.css`** (both `:root` and `.dark` blocks):

| Variable | Light | Dark | Use |
|----------|-------|------|-----|
| `--background` | warm cream | near-black | Body bg |
| `--foreground` | near-black | near-white | Body text |
| `--card` | white | elevated dark | Cards |
| `--muted` | warm neutral | mid-dark | Secondary surfaces |
| `--muted-foreground` | slate | light slate | Secondary text |
| `--border` | stone-200 | dark border | Dividers |
| `--brand-accent` | `#C2410C` | slightly brighter orange | CTAs |
| `--brand-accent-hover` | `#9A3412` | darker orange | Hover |
| `--brand-accent-fg` | white | white | Text on brand buttons |
| `--selected-fill` | `#C2410C`/[0.04] | white/[0.04] | Selection tint |
| `--warm-surface` | `#F5F5F4` | elevated dark | Warm surfaces |
| `--sidebar-bg` | `#0F172A` | `#0F172A` | Sidebar (navy both modes) |

**@custom-variant** is `:where(.dark, .dark *)` — a scoping hack so `dark:` Tailwind variants work correctly with `attribute="class"`.

**Body transition**: `body { transition: background-color 150ms, color 150ms }` under `@media (prefers-reduced-motion: no-preference)` — produces a 150ms crossfade on toggle.

**Root layout** adds `suppressHydrationWarning` to `<html>` ONLY — silences the server/client className mismatch that next-themes causes (server renders no class; client script adds `dark`). No other hydration warnings are suppressed.

**What to use in new code:**
- Surface: `bg-background` / `bg-card` / `bg-muted` — never `bg-white` or `bg-stone-*` without dark variant
- Text: `text-foreground` / `text-muted-foreground` — never `text-stone-*` as a body-text color
- Border: `border-border` — never `border-stone-*`
- Divider: `divide-border` — never `divide-stone-100`
- Primary CTA: `bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-[var(--brand-accent-fg)]`
- Selection state: `border-[var(--brand-accent)] bg-[var(--selected-fill)]`
- Hover highlight: `hover:bg-accent` / `hover:bg-muted`
- Categorical badges (red/amber/green/blue/violet for status/urgency/provider): KEEP the hue but ADD `dark:bg-{color}-950/40 dark:text-{color}-300 dark:border-{color}-800/60`
- Destructive: `bg-destructive text-destructive-foreground` or keep `bg-red-600` with dark variants

**Phase 49 test gate**: `tests/unit/dark-mode-hex-audit.test.js` — must stay GREEN. Audits the dashboard tree for disallowed hex constants. Does NOT catch Tailwind utility misuse like `bg-white`/`bg-stone-*` — use the broader audit command documented in `.planning/phases/49-dark-mode-foundation-and-token-migration/49-05-SUMMARY.md` for that.

**Page-level card ownership pattern (Phase 20):** Layout no longer wraps children in a card. Each page applies `card.base` to its own outermost wrapper. This prevents double-card stacking when pages have their own card styling.

---

## 11. Supabase Realtime

**How it works:**

1. `supabase/migrations/004_leads_crm.sql` sets `ALTER TABLE leads REPLICA IDENTITY FULL` and `ALTER PUBLICATION supabase_realtime ADD TABLE leads`
2. `REPLICA IDENTITY FULL` is required for Postgres row-level change events — without it, Realtime only receives new values (no old row data, limiting filter options)
3. Dashboard pages use `supabase-browser` client to subscribe:

```js
const channel = supabase
  .channel('leads-realtime')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'leads',
    filter: `tenant_id=eq.${tenantId}`,
  }, (payload) => {
    setLeads((prev) => [{ ...payload.new, _isNew: true }, ...prev]);
  })
  .on('postgres_changes', { event: 'UPDATE', ... }, (payload) => {
    setLeads((prev) => prev.map((l) => l.id === payload.new.id ? payload.new : l));
  })
  .subscribe();
```

**`ensureSlideInKeyframe()`** — injected once into `document.head` via a `<style>` tag with id `lead-slide-in-keyframe`. Injects `@keyframes slide-in-from-top` + `.animate-slide-in-from-top` class. Called from `useEffect` on leads page mount. Avoids CSS module complexity for Realtime-triggered animations.

**Pages that subscribe**: jobs/page.js (INSERT + UPDATE). Home page uses a different pattern — polling on mount, not Realtime subscription.

---

## 12. Escalation Contacts API

**File**: `src/app/api/escalation-contacts/route.js`

| Method | Action |
|--------|--------|
| `GET` | Fetch active contacts ordered by `sort_order` |
| `POST` | Create contact (max 5 per tenant), computes `sort_order = max + 1` |
| `PUT` | Update contact by id |
| `DELETE` | Soft-delete: `is_active = false` |
| `PATCH` | Reorder: `upsert` array of `{ id, sort_order }` |

**Critical**: PATCH reorder includes `tenant_id` in every upsert row:
```js
order.map(({ id, sort_order }) => ({ id, tenant_id: tenantId, sort_order }))
```
Required because RLS `WITH CHECK` on `escalation_contacts` enforces `tenant_id` matches the authenticated user's tenant.

Validation via `validateContactBody()`: name required, at least one of phone/email required, phone required for SMS prefs, email required for email prefs, `timeout_seconds` must be in `[15, 30, 45, 60]`.

---

## 13. Setup Checklist API

**File**: `src/app/api/setup-checklist/route.js`

`GET /api/setup-checklist` — derives checklist state at read time from tenant columns, then overlays per-item user actions from `tenants.checklist_overrides` (JSONB, migration 050):
- Uses `createSupabaseServer()` for auth, `supabase` (service role) for data queries
- Parallel fetch: service count + calendar_credentials existence
- Merges `checklist_overrides[item_id]` into each derived item so the client sees `complete` / `dismissed` / `mark_done_override` flags alongside auto-detected state
- Returns `{ items, dismissed, completedCount, progress }` — items are grouped by `THEME_ORDER` (profile → voice → calendar → billing)

Item hrefs (updated in Phase 20 Plan 02 to point to More sub-pages):
- `connect_calendar` — `/dashboard/more/calendar-connections`
- `configure_hours` — `/dashboard/more/working-hours`
- `make_test_call` — `/dashboard/more/ai-voice-settings`

`PATCH /api/setup-checklist` — two distinct payload shapes, both mutate `tenants.checklist_overrides`:

1. **Per-item action (Phase 48, migration 050)** — body `{ item_id, mark_done: true/false }` or `{ item_id, dismiss: true/false }`. The handler reads current `checklist_overrides`, mutates the `{item_id: {status, ts}}` entry, and writes the whole JSONB back. Optimistic client updates via SWR `mutate` make this feel instant; error paths revert and toast.
2. **Whole-checklist dismiss (legacy)** — body `{ dismissed: true }`. Sets `tenants.setup_checklist_dismissed = true` (the pre-Phase-48 column). The `SetupCompleteBar` celebration flow still uses this path.

**What's NOT stored in `checklist_overrides`**: auto-detected completions (services count, `onboarding_complete`, calendar credential existence, etc.). Those derive from live tenant/relation state on every GET. The override column only records explicit user actions (I marked this done / I dismissed this row).

---

## 14. Database Tables

### `leads` (004_leads_crm.sql)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK, gen_random_uuid() |
| `tenant_id` | uuid | FK → tenants, CASCADE |
| `from_number` | text | Caller phone number |
| `caller_name` | text | nullable |
| `job_type` | text | nullable |
| `service_address` | text | nullable |
| `urgency` | text | CHECK IN ('emergency', 'routine', 'urgent') |
| `status` | text | CHECK IN ('new', 'booked', 'completed', 'paid', 'lost') |
| `revenue_amount` | numeric(10,2) | nullable |
| `primary_call_id` | uuid | FK → calls, SET NULL |
| `appointment_id` | uuid | FK → appointments, SET NULL |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Indexes: `(tenant_id, status)`, `(tenant_id, from_number)`, `(tenant_id, created_at DESC)`. Realtime: `REPLICA IDENTITY FULL` + `supabase_realtime` publication.

### `lead_calls` (004_leads_crm.sql)

Junction table. PK: `(lead_id, call_id)`. Enables many calls → one lead (repeat callers).

### `activity_log` (004_leads_crm.sql)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK → tenants |
| `event_type` | text | 'lead_created', 'status_changed' |
| `lead_id` | uuid | FK → leads, SET NULL |
| `metadata` | jsonb | event-specific data |
| `created_at` | timestamptz | |

Index: `(tenant_id, created_at DESC)`. Queried directly via supabase-browser (RLS filters by tenant).

### `tenants` — columns added in migrations 005

- `setup_checklist_dismissed` (boolean, default false) — from 005_setup_checklist.sql

### `escalation_contacts` (006_escalation_contacts.sql)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK → tenants, CASCADE |
| `name` | text | required |
| `role` | text | nullable |
| `phone` | text | nullable |
| `email` | text | nullable |
| `notification_pref` | text | CHECK IN ('sms', 'email', 'both') |
| `timeout_seconds` | int | CHECK IN (15, 30, 45, 60) |
| `sort_order` | int | display order |
| `is_active` | boolean | soft-delete flag |

### `services` — columns added in migration 006

- `sort_order` (int, default 0) — backfilled per-tenant by `created_at` order

---

## 15. Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (Realtime client + browser client) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side Supabase auth + Realtime subscriptions |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side API routes (bypasses RLS for lead/escalation writes) |
| `GROQ_API_KEY` | Groq API key for AI chatbot assistant (Llama 4 Scout model) |

---

## 16. Key Design Decisions

- **6-tab desktop / 5-tab mobile navigation (Phase 20, updated Phase 33, Analytics removed Phase 49)**: Desktop sidebar: Home, Leads, Calendar, Calls, Invoices, More + theme toggle. Mobile bottom bar: Home, Calls, Leads, Calendar, More. Estimates accessible via the More hub's quick-access links. Services and Settings consolidated into More menu. No mobile drawer pattern.

- **Page-level card ownership (Phase 20)**: Layout no longer wraps children in a card. Each page controls its own `card.base` wrapper. Prevents double-card stacking and gives each page independent padding control.

- **BottomTabBar as mobile nav (Phase 20, updated Phase 49)**: 5 tabs (Home, Calls, Leads, Calendar, More), `h-16`, `safe-area-bottom`, `z-40`, `bg-card border-t border-border` (theme-aware). Animated orange indicator via `layoutId="tab-indicator"` (framer-motion spring). Mobile-only (`lg:hidden`).
- **Call logs page (Phase 20)**: `/dashboard/calls` — queries `GET /api/calls` (calls table directly, not through leads). Date-grouped expandable cards with urgency border, summary stats bar, search by phone, expandable filters (time range, urgency, booking outcome). Tap to expand detail panel (duration, urgency, booking, language, recording, SMS status, triage info). Short calls (<15s) dimmed with "missed" tag.
- **Page transitions (Phase 20)**: framer-motion `AnimatePresence` on layout content area — `opacity: 0→1, y: 6→0` on route change. More sub-pages show `MoreBackButton` injected via `more/layout.js` on all sub-pages.

- **More menu as config hub (Phase 20+)**: 9 settings sections under `/dashboard/more/*` plus 2 quick-access links (Invoices, Estimates) and an "Ask Voco AI" button (mobile-only). Settings sub-pages wrap existing components (thin wrappers). Old `/dashboard/services` and `/dashboard/settings` redirect to new routes — bookmarks preserved.

- **Adaptive home page (Phase 20, expanded Phase 30)**: Single page component branches into setup mode (checklist hero) vs active mode (command center) based on `isSetupComplete`. Active mode also renders `SetupChecklist` when any recommended items are incomplete (`hasIncompleteRecommended` state). The checklist appears between "This Week" stats and "Recent Activity" in active mode, so new users see what's left to configure without blocking their dashboard.

- **Expanded setup checklist (Phase 30)**: 9 total items (4 required, 5 recommended). Required items gate setup→active mode transition. Recommended items: `configure_hours`, `connect_calendar`, `configure_zones`, `setup_escalation`, `configure_notifications`. Calendar check is provider-agnostic (Google or Outlook). Notification check compares against defaults via JSON stringify.

- **`callsToday` stat queries `calls` table**: The `/api/dashboard/stats` route counts actual calls (from the `calls` table), not leads. This was a bug fix — the original counted leads, which undercounted since short calls (<15s) never create leads.

- **Joyride tour pattern (Phase 20)**: Tour mounted at layout level (persists across tab switches). Triggered by CustomEvent `start-dashboard-tour` from page.js button. Never auto-starts. Sets `gsd_has_seen_tour` in localStorage on completion. Respects `prefers-reduced-motion`.

- **REPLICA IDENTITY FULL on leads**: Required for Supabase Realtime to emit row-level change events with filter support. Without it, only new row data is available and tenant-level filtering breaks.

- **`getLeads` excludes `transcript_text`**: Performance decision — transcripts can be large text fields. Excluded from list queries; fetched separately via `GET /api/leads/[id]` when flyout opens.

- **Repeat caller merge checks `status IN ('new', 'booked')` only**: Completed, paid, and lost leads are considered closed — a repeat caller from a previously closed lead gets a new lead record rather than attaching to the old one.

- **Soft-delete via `is_active = false`**: Escalation contact DELETE sets `is_active = false` rather than removing the row. Preserves audit trail and call history references.

- **`LeadFlyout` rendered outside card stack**: The Sheet component (Radix UI) creates a portal, but positioning context can conflict with scroll/overflow containers in the lead list. LeadFlyout is rendered as a sibling to the list wrapper — prevents Sheet overlay stacking context issues.

- **Design tokens shared between onboarding + dashboard**: `src/lib/design-tokens.js` exports brand colors, button classes, card classes, glass effect, and grid texture. Both onboarding wizard and dashboard import from here — single source of truth for visual identity.

- **Realtime keyframe via `ensureSlideInKeyframe()`**: The `slide-in-from-top` animation is injected as a `<style>` tag once into `document.head`. Avoids CSS module complexity for a dynamic animation triggered by Realtime events at runtime.

- **Counter animation with `prefers-reduced-motion` guard**: `DashboardHomeStats` checks `window.matchMedia('(prefers-reduced-motion: reduce)')` before starting `requestAnimationFrame` loop. If reduced motion is preferred, value is set immediately without animation.

- **`SortableContactWrapper` wraps `useSortable`**: `EscalationChainSection` uses a thin wrapper component to apply DnD sortable behavior to `ContactCard` — `ContactCard` itself stays clean and testable with no DnD dependencies.

- **PATCH reorder includes `tenant_id` for RLS `WITH CHECK`**: Supabase RLS `WITH CHECK` on `escalation_contacts` requires `tenant_id` to match the authenticated user. Upsert operations must include `tenant_id` in each row even though only `sort_order` is changing.

---

## AI Chatbot Assistant

### Components

- `src/components/dashboard/ChatbotSheet.jsx` — Root chat panel (Sheet wrapper, message state, input handling, API integration). Props: `open`, `onOpenChange`, `currentRoute`. Always mounted at layout level; `open` prop controls visibility. Sheet renders as right panel on desktop (`w-[400px]`) and bottom sheet on mobile (`max-h-[85vh] rounded-t-2xl`) with drag handle. Includes a static greeting message from Voco AI.
- `src/components/dashboard/ChatMessage.jsx` — Single message bubble with user/AI variants. Exports `parseMessageContent()` for link extraction from AI responses.
- `src/components/dashboard/ChatNavLink.jsx` — Clickable navigation chip rendered inside AI messages. Uses Next.js `Link` with `onNavigate` callback (closes sheet on navigation).
- `src/components/dashboard/TypingIndicator.jsx` — Three-dot pulse animation for AI thinking state. Includes `role="status"` and reduced-motion support.

### API Route (`src/app/api/chat/route.js`)

POST handler. Node.js runtime (not Edge — requires `fs` for knowledge doc reads).

1. **Guard**: `GROQ_API_KEY` env var required (503 if missing).
2. **Auth**: `getTenantId()` — returns 401 if not authenticated.
3. **Request body**: `{ message: string, currentRoute?: string, history?: Array }`.
4. **RAG retrieval**: `getRelevantKnowledge(message, currentRoute)` returns up to 2 knowledge docs.
5. **System prompt**: Defines Voco AI as a dashboard help assistant. Includes:
   - Role description (help users understand and navigate the dashboard)
   - Constraints (does NOT create/edit/delete data, does NOT access user-specific data)
   - Navigation link format: `[Go to Page Name](/dashboard/path)` on its own line
   - Current route context: `The user is currently on: ${currentRoute || '/dashboard'}`
   - Injected knowledge docs from RAG (appended under "Relevant documentation:" heading)
6. **Message history**: System prompt + last 10 history entries + current user message. History entries from ChatbotSheet map `role: 'ai'` to `role: 'assistant'` for OpenAI-compatible format.
7. **LLM call**: Groq API via OpenAI-compatible client (`openai` npm package with Groq base URL). Model: `meta-llama/llama-4-scout-17b-16e-instruct`. Settings: `max_tokens: 500`, `temperature: 0.3`.
8. **Response**: `{ reply: string }`. On error, returns a friendly fallback message (not an error status).

**Groq client**: Lazy-initialized singleton via `getGroqClient()`. Uses `process.env.GROQ_API_KEY` with base URL `https://api.groq.com/openai/v1`.

### RAG Knowledge Retrieval (`src/lib/chatbot-knowledge/index.js`)

Server-only module. Two matching signals:

**1. Route matching** — `ROUTE_DOC_MAP` maps 14 dashboard routes to their primary knowledge doc (more specific routes first):

```js
const ROUTE_DOC_MAP = {
  '/dashboard/jobs': 'leads.md',  // Phase 52: nav route renamed; doc filename retained per D-10
  '/dashboard/calendar': 'calendar.md',
  '/dashboard/calls': 'calls.md',
  '/dashboard/invoices': 'invoices.md',
  '/dashboard/estimates': 'estimates.md',
  '/dashboard/more/billing': 'billing.md',
  '/dashboard/more/services-pricing': 'settings.md',
  '/dashboard/more/working-hours': 'settings.md',
  '/dashboard/more/service-zones': 'settings.md',
  '/dashboard/more/notifications': 'settings.md',
  '/dashboard/more/ai-voice-settings': 'settings.md',
  '/dashboard/more/integrations': 'integrations.md',
  '/dashboard/more/invoice-settings': 'settings.md',
  '/dashboard': 'getting-started.md',  // fallback for unknown routes
};
```

**2. Keyword matching** — `KEYWORD_DOC_MAP` has 9 keyword groups, checked in order (first match wins, adds up to 1 additional doc that differs from the route-matched doc):

```js
const KEYWORD_DOC_MAP = [
  { keywords: ['lead', 'leads', 'crm', 'customer', 'caller', 'pipeline'], doc: 'leads.md' },
  { keywords: ['calendar', 'appointment', 'booking', 'schedule', 'slot'], doc: 'calendar.md' },
  { keywords: ['call', 'calls', 'transcript', 'recording', 'voicemail'], doc: 'calls.md' },
  { keywords: ['billing', 'subscription', 'plan', 'upgrade', 'usage', 'trial'], doc: 'billing.md' },
  { keywords: ['invoice', 'invoices', 'payment', 'bill', 'pdf', 'send invoice'], doc: 'invoices.md' },
  { keywords: ['estimate', 'estimates', 'quote'], doc: 'estimates.md' },
  { keywords: ['setting', 'settings', 'service', 'working hours', 'zone', 'notification', 'ai voice'], doc: 'settings.md' },
  { keywords: ['integration', 'quickbooks', 'xero', 'connect', 'sync'], doc: 'integrations.md' },
];
```

**Output**: Returns at most 2 doc sections (route-matched + keyword-matched) joined with `---` separator. Docs are read from `src/lib/chatbot-knowledge/*.md` via `readFileSync`. Missing docs silently skipped.

### Knowledge Base Docs

`src/lib/chatbot-knowledge/` contains static markdown docs — one per dashboard area: `getting-started.md`, `leads.md`, `calendar.md`, `calls.md`, `invoices.md`, `estimates.md`, `billing.md`, `settings.md`, `integrations.md`, `call-routing.md`.

### Triggers

- **Desktop**: "Ask Voco AI" button in `DashboardSidebar.jsx` (between Separator and Logout). Fires `window.dispatchEvent(new Event('open-voco-chat'))`.
- **Mobile**: "Ask Voco AI" item at top of More page (`more/page.js`, `lg:hidden`). Same `open-voco-chat` window event.
- **Layout integration**: `src/app/dashboard/layout.js` listens for `open-voco-chat` event and sets `chatOpen` state. `ChatbotSheet` is always mounted in the layout; visibility controlled by `open` prop. Current route passed as `currentRoute` prop.

---

## Cross-Domain References

- **Call processing → lead creation**: See `voice-call-architecture` skill for how `createOrMergeLead()` is called from `processCallAnalyzed()` and the `capture_lead` webhook handler.
- **Auth + RLS**: See `auth-database-multitenancy` skill for Supabase client patterns (`supabase-browser` vs `supabase-server` vs service role), RLS policies, and `getTenantId()`.
- **Design tokens (onboarding)**: See `onboarding-flow` skill for how design-tokens.js is used in the wizard pages.

---

## Important: Keeping This Document Updated

When making changes to any file listed in the File Map above, update the relevant sections of this skill document to reflect the new behavior. This ensures future conversations always have an accurate reference.

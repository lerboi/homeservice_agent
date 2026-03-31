---
name: dashboard-crm-system
description: "Complete architectural reference for the dashboard and CRM system — all dashboard pages, lead lifecycle and merging, Kanban board, analytics charts, escalation chain, settings panels, setup checklist, design tokens, guided tour, and Supabase Realtime integration. Use this skill whenever making changes to dashboard pages, lead management, CRM components, analytics, escalation contacts, service management, settings, or design tokens. Also use when the user asks about how leads work, wants to modify dashboard UI, or needs to debug Realtime subscription issues."
---

# Dashboard & CRM System — Complete Reference

This document is the single source of truth for the entire dashboard and CRM system. Read this before making any changes to dashboard pages, lead management, or CRM components.

**Last updated**: 2026-04-01 (Phase 33: Invoices tab added to sidebar, Analytics relocated to /dashboard/more/analytics, LeadFlyout Create/View Invoice integration, GET /api/invoices supports lead_id filter)

---

## Architecture Overview

| Layer | Files | Purpose |
|-------|-------|---------|
| **Dashboard Pages** | `src/app/dashboard/` | All page routes nested under layout |
| **CRM Components** | `src/components/dashboard/` | Kanban, flyouts, charts, stats, editors, tour |
| **API Routes** | `src/app/api/leads/`, `src/app/api/calls/`, `src/app/api/escalation-contacts/`, `src/app/api/setup-checklist/`, `src/app/api/invoices/` | Lead CRUD, call logs, escalation CRUD, checklist state, invoice CRUD |
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

### Dashboard Page Structure (Phase 20 + Phase 33)

```
layout.js                        ← DashboardSidebar (desktop) + BottomTabBar (mobile) + DashboardTour
  ├── page.js (/)                ← Adaptive home: setup mode (checklist hero) OR active mode (command center)
  ├── leads/page.js              ← Filter bar + list/kanban toggle + LeadFlyout
  ├── calendar/page.js           ← CalendarView + ConflictAlertBanner + agenda
  ├── calls/page.js              ← Call logs: date-grouped expandable cards, filters, summary stats
  ├── invoices/page.js           ← Invoice list with status tabs, summary metrics, search (Phase 33)
  ├── invoices/new/page.js       ← New invoice form — pre-fills from lead_id query param (Phase 33)
  ├── invoices/[id]/page.js      ← Invoice detail + HTML preview + Send button (Phase 33)
  └── more/page.js               ← Config hub: 9 section links
      ├── more/analytics/page.js          ← AnalyticsCharts (revenue, funnel, pipeline donut) — relocated from /dashboard/analytics in Phase 33
      ├── more/services-pricing/page.js   ← Full service table (DnD, urgency tags, bulk select)
      ├── more/working-hours/page.js      ← WorkingHoursEditor
      ├── more/calendar-connections/page.js ← CalendarSyncCard
      ├── more/service-zones/page.js      ← ZoneManager
      ├── more/escalation-contacts/page.js ← EscalationChainSection
      ├── more/notifications/page.js      ← SMS and email alert preferences
      ├── more/ai-voice-settings/page.js  ← SettingsAISection
      ├── more/billing/page.js            ← Plan, usage meter, invoices
      └── more/account/page.js            ← Placeholder (future plan)
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
| `src/app/dashboard/leads/page.js` | Leads page: filter bar, list/kanban toggle, Realtime subscription |
| `src/app/dashboard/calls/page.js` | Call logs: date-grouped expandable cards, search, filters, summary stats |
| `src/app/dashboard/analytics/page.js` | Analytics page: fetches all leads, renders AnalyticsCharts |
| `src/app/dashboard/calendar/page.js` | Calendar page: CalendarView + AppointmentFlyout + ConflictAlertBanner |
| `src/app/dashboard/more/page.js` | Config hub list: 9 section links with icons, labels, descriptions |
| `src/app/dashboard/more/layout.js` | Pass-through layout for more/* route group |
| `src/app/dashboard/more/services-pricing/page.js` | Service table with DnD, urgency tags, bulk select |
| `src/app/dashboard/more/working-hours/page.js` | Wraps WorkingHoursEditor |
| `src/app/dashboard/more/calendar-connections/page.js` | Wraps CalendarSyncCard |
| `src/app/dashboard/more/service-zones/page.js` | Wraps ZoneManager |
| `src/app/dashboard/more/escalation-contacts/page.js` | Wraps EscalationChainSection |
| `src/app/dashboard/more/notifications/page.js` | Notification preferences page — per-outcome SMS/email toggles |
| `src/components/dashboard/NotificationPreferences.jsx` | Per-outcome Switch grid (booked/declined/not_attempted/attempted x SMS/email) |
| `src/app/dashboard/more/ai-voice-settings/page.js` | Wraps SettingsAISection (phone number + test call only) |
| `src/app/api/notification-settings/route.js` | GET/PATCH notification_preferences JSONB on tenants |
| `src/app/dashboard/more/billing/page.js` | Billing page: plan card, usage ring gauge, billing details, recent invoices |
| `src/components/dashboard/UsageRingGauge.js` | SVG donut ring gauge for call usage visualization |
| `src/app/dashboard/more/account/page.js` | Account page: profile editor (business_name, owner_name, owner_email, owner_phone), account details, sign out |
| `src/app/api/account/route.js` | GET/PATCH tenant profile fields (business_name, owner_name, owner_email, owner_phone) |
| `src/app/dashboard/services/page.js` | redirect() to /dashboard/more/services-pricing |
| `src/app/dashboard/settings/page.js` | redirect() to /dashboard/more |
| `src/components/dashboard/DashboardSidebar.jsx` | Desktop-only left sidebar: 6 nav items (Home, Leads, Calendar, Calls, Analytics, More), no mobile drawer |
| `src/components/dashboard/BottomTabBar.jsx` | Mobile-only fixed bottom nav: 5 tabs (Home, Leads, Calendar, Calls, Analytics — no More), h-[56px], lg:hidden, animated orange indicator |
| `src/components/dashboard/MoreBackButton.jsx` | "← Back to More" link shown on More sub-pages via more/layout.js |
| `src/components/dashboard/DashboardTour.jsx` | Joyride guided tour wrapper: 6 steps, brand-themed, layout-mounted |
| `src/app/api/calls/route.js` | GET calls (filtered by date, urgency, booking_outcome, phone search) |
| `src/components/dashboard/LeadFlyout.jsx` | Right Sheet: lead detail, status change, audio/transcript, Create/View Invoice button for completed/paid leads |
| `src/components/dashboard/KanbanBoard.jsx` | 5-column pipeline board (new/booked/completed/paid/lost) |
| `src/components/dashboard/AnalyticsCharts.jsx` | Revenue line + funnel bar + pipeline donut (recharts) |
| `src/components/dashboard/EscalationChainSection.js` | Escalation contacts CRUD + drag-to-reorder (@dnd-kit) |
| `src/components/dashboard/SetupChecklist.jsx` | Redesigned checklist: required/recommended split, conic-gradient progress ring, expandable items |
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

**`DashboardSidebar({ businessName })`** — `src/components/dashboard/DashboardSidebar.jsx`

6-item desktop-only nav. Desktop only (lg+). Mobile navigation is handled by BottomTabBar.

```js
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/leads', label: 'Leads', icon: Users },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar },
  { href: '/dashboard/calls', label: 'Calls', icon: Phone },
  { href: '/dashboard/invoices', label: 'Invoices', icon: FileText },  // Phase 33: replaced Analytics
  { href: '/dashboard/more', label: 'More', icon: MoreHorizontal },
];
// Note: Analytics is now accessible at /dashboard/more/analytics (not top nav)
```

Active state: `border-l-2 border-[#C2410C]` left orange border. Desktop: `lg:fixed lg:w-60 bg-[#0F172A]`. Mobile: not rendered (replaced by BottomTabBar).

**`BottomTabBar`** — `src/components/dashboard/BottomTabBar.jsx`

Mobile-only fixed bottom nav. `lg:hidden`. 5 tabs (no More — accessible via gear icon in top bar). Animated orange indicator line (`layoutId="tab-indicator"`) slides between active tabs via framer-motion spring. Tab active state: `text-[#C2410C]` for active, `text-white/60` for inactive. Height: `h-[56px] min-h-[48px]` per tab for 48px touch targets. Safe area: `paddingBottom: env(safe-area-inset-bottom, 0px)`. Has `data-tour="bottom-nav"`.

```js
const TABS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/leads', label: 'Leads', icon: Users },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar },
  { href: '/dashboard/calls', label: 'Calls', icon: Phone },
  { href: '/dashboard/invoices', label: 'Invoices', icon: FileText },  // Phase 33: replaced Analytics
];
// Active: tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
// More tab omitted on mobile — settings gear icon (top-right) links to /dashboard/more
// Analytics is accessible via /dashboard/more/analytics
```

---

## 2. Guided Tour

**File**: `src/components/dashboard/DashboardTour.jsx`

Wraps `react-joyride` v3. Mounted at layout level (not page level) so it persists across tab navigation.

**Props:**
- `run` (boolean) — controlled by layout.js via `tourRunning` state
- `onFinish` (function) — called when tour FINISHED or SKIPPED; layout resets `tourRunning = false`

**Tour steps (6 total):**
1. `[data-tour="home-page"]` — Command center overview
2. `[href="/dashboard/leads"]` — Leads tracking
3. `[href="/dashboard/calendar"]` — Calendar / appointments
4. `[href="/dashboard/calls"]` — View every call your AI handled
5. `[href="/dashboard/analytics"]` — Analytics / conversion
6. `[href="/dashboard/more"]` — Config hub (placement: 'top')

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

The home page has two distinct render modes based on setup completion:

### Setup Mode

Shown when any of the 4 required items (`create_account`, `setup_profile`, `configure_services`, `make_test_call`) are incomplete.

**Setup mode renders:**
- `AIStatusIndicator` — green pulse dot + "AI Receptionist: Active"
- `SetupChecklist` as hero (full width, prominent)
- "Take a quick tour" button (shown only if `gsd_has_seen_tour` not in localStorage)

**`isSetupComplete` derivation:**
```js
const REQUIRED_IDS = ['create_account', 'setup_profile', 'configure_services', 'make_test_call'];

const setupComplete = data.items
  .filter((i) => REQUIRED_IDS.includes(i.id))
  .every((i) => i.complete);
```

**Checklist data lifting (avoids double-fetch):**
```js
const handleChecklistDataLoaded = useCallback((data) => {
  setChecklistData(data);
  // derive isSetupComplete from data.items
}, []);

<SetupChecklist onDataLoaded={handleChecklistDataLoaded} />
```

### Active Mode

Shown when all 4 required items are complete.

**Active mode renders:**
- `AIStatusIndicator`
- Hero metric card: calls answered today (`data-tour="hero-metric"`)
- 2-col grid: Action Required card (new leads today) + Next Appointment card (fetches from `/api/appointments`)
- This Week summary card: leads, booked, conversion rate (last 7 days)
- `SetupChecklist` — shown when any recommended items are incomplete (controlled by `hasIncompleteRecommended` state). Dismissed via the checklist's own dismiss mechanism. Disappears once all 5 recommended items are complete.
- Recent Activity feed (capped at 5 items via `.slice(0, 5)`)

**Next Appointment card** fetches from `GET /api/appointments?start={now}&end={weekLater}`, finds the first `confirmed` appointment, and displays `caller_name` and `service_address`.

### data-tour attributes on home page

- Outer div: `data-tour="home-page"` (present in all render states)
- Hero metric: `data-tour="hero-metric"` (active mode only)

---

## 4. More Menu — Config Hub

**File**: `src/app/dashboard/more/page.js`

`/dashboard/more` is the 5th tab destination. Lists 9 config sections as card rows.

```js
const MORE_ITEMS = [
  { href: '/dashboard/more/services-pricing', label: 'Services & Pricing', ... },
  { href: '/dashboard/more/working-hours', label: 'Working Hours', ... },
  { href: '/dashboard/more/calendar-connections', label: 'Calendar Connections', ... },
  { href: '/dashboard/more/service-zones', label: 'Service Zones & Travel', ... },
  { href: '/dashboard/more/escalation-contacts', label: 'Escalation Contacts', ... },
  { href: '/dashboard/more/notifications', label: 'Notifications', ... },
  { href: '/dashboard/more/ai-voice-settings', label: 'AI & Voice Settings', ... },
  { href: '/dashboard/more/billing', label: 'Billing', ... },
  { href: '/dashboard/more/account', label: 'Account', ... },
];
```

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

### Billing Page (`/dashboard/more/billing`)

**File**: `src/app/dashboard/more/billing/page.js`

Displays subscription status and usage for the current tenant. Four sections:

1. **Plan card** — shows plan name, price, status badge (`active`/`trialing`/`past_due`/`cancelled`/`paused`). Displays cancel-at-period-end warning when subscription is set to cancel at the end of the billing period.
2. **Usage meter** — `UsageRingGauge` (`src/components/dashboard/UsageRingGauge.js`) SVG donut ring showing `calls_used / calls_limit` with overage visualization when usage exceeds the plan limit.
3. **Billing details** — renewal date, "Manage Subscription" button that links to the Stripe customer portal.
4. **Recent invoices** — table of up to 5 invoices displaying date, amount, status badge, and link to the Stripe-hosted invoice.

---

## 5. Setup Checklist — Redesigned

**File**: `src/components/dashboard/SetupChecklist.jsx`

Redesigned in Phase 20 Plan 03. Key changes from original:

**ITEM_TYPE classification (frontend-only, no API change):**
```js
const ITEM_TYPE = {
  create_account: 'required',
  setup_profile: 'required',
  configure_services: 'required',
  make_test_call: 'required',
  connect_calendar: 'recommended',
  configure_hours: 'recommended',
  configure_zones: 'recommended',
  setup_escalation: 'recommended',
  configure_notifications: 'recommended',
};
```

**ITEM_DESCRIPTION map** — one-sentence explanations shown in expandable state.

**ProgressRing component** — conic-gradient two-segment donut:
- Required complete = orange (#C2410C)
- Recommended complete = stone (#78716C)
- Incomplete = light gray (#E7E5E4)
- Center shows "{completed}/{total}" count

**Sections:** Required items rendered under orange "REQUIRED" header, recommended items under gray "RECOMMENDED" header.

**`onDataLoaded` callback prop:** Called when fetch resolves, passes full `{ items, dismissed, completedCount }` to parent. Avoids double-fetching `/api/setup-checklist` when page.js also needs the data.

**`ChecklistItem.jsx`** — expandable with AnimatePresence:
- Click row to expand/collapse
- Shows type badge (orange "Required" or gray "Recommended") in expanded state
- Shows `ITEM_DESCRIPTION` text in expanded state
- Shows action `Link` button pointing to relevant More sub-page
- `min-h-[44px]` touch target, `useReducedMotion` support

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

### Leads (`src/app/dashboard/leads/page.js`)

Client component. Features:
- **Filter bar**: status, urgency, date range, search, jobType
- **View toggle**: list (LeadCard rows) or kanban (KanbanBoard)
- **Realtime**: subscribes to `postgres_changes` on `leads` table filtered by `tenant_id=eq.${tenantId}` for INSERT and UPDATE events
- **Flyout**: `LeadFlyout` rendered **outside the card stack** to avoid Sheet overlay stacking context issues
- **Animation**: new Realtime inserts get `_isNew: true` flag — `animate-slide-in-from-top` class (injected via `ensureSlideInKeyframe()`)
- **Card wrapper**: `card.base` wrapper on return, `data-tour="leads-page"`

### Analytics (`src/app/dashboard/analytics/page.js`)

Fetches all leads via `GET /api/leads`, passes to `AnalyticsCharts`. Shows `EmptyStateAnalytics` if no leads. Has `card.base` wrapper and `data-tour="analytics-page"`.

### Calendar (`src/app/dashboard/calendar/page.js`)

Client component. Week/day view toggle (mobile always forces day view). Fetches from `GET /api/appointments?start=...&end=...&view=...`. Shows `ConflictAlertBanner` for detected conflicts. Today's agenda sidebar shows appointments for current date. `AppointmentFlyout` opens on appointment click. Has `card.base` wrapper and `data-tour="calendar-page"`.

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

### `KanbanBoard({ leads, onViewLead })`

**File**: `src/components/dashboard/KanbanBoard.jsx`

5-column board: `['new', 'booked', 'completed', 'paid', 'lost']`. Groups leads by status. lg+: side-by-side columns. Below lg: horizontal scroll with `snap-x snap-mandatory`. No drag-and-drop (status changes via LeadFlyout). Delegates to `KanbanColumn` per status.

### `AnalyticsCharts({ leads, loading })`

**File**: `src/components/dashboard/AnalyticsCharts.jsx`

Three charts using `recharts`:
1. **Revenue Over Time** — `LineChart` with cumulative monthly revenue
2. **Conversion Funnel** — `BarChart` (horizontal layout), new → booked → completed → paid
3. **Pipeline Breakdown** — `PieChart` (donut, innerRadius=60) with all statuses

Data builders:
- `buildRevenueData(leads)` — groups by month key `YYYY-MM`, builds cumulative sum
- `buildFunnelData(leads)` — count per status (new/booked/completed/paid)
- `buildPipelineData(leads)` — count per all statuses, filters out zero values

Empty state threshold: fewer than 5 leads OR 0 completed/paid leads.

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

```js
export const colors = {
  brandOrange: '#C2410C',
  brandOrangeDark: '#9A3412',
  navy: '#0F172A',
  warmSurface: '#F5F5F4',
  bodyText: '#475569',
};

export const btn = {
  primary: 'bg-[#C2410C] hover:bg-[#C2410C]/90 active:bg-[#9A3412] active:scale-95 text-white shadow-[...] transition-all duration-150',
};

export const card = {
  base: 'bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04),...] border border-stone-200/60',
  hover: 'hover:shadow-[...] hover:-translate-y-0.5 transition-all duration-200',
};

export const glass = {
  topBar: 'bg-white/80 backdrop-blur-md border-b border-stone-200/60',
};

export const gridTexture = {
  dark: 'bg-[linear-gradient(rgba(255,255,255,0.02)_1px,...)] bg-[size:64px_64px]',
  light: 'bg-[linear-gradient(rgba(0,0,0,0.015)_1px,...)] bg-[size:48px_48px]',
};

export const focus = { ring: 'focus:outline-none focus:ring-2 focus:ring-[#C2410C] focus:ring-offset-1' };
export const selected = {
  card: 'border-[#C2410C] bg-[#C2410C]/[0.04]',
  cardIdle: 'border-stone-200 bg-[#F5F5F4] hover:bg-stone-100',
};
```

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

**Pages that subscribe**: leads/page.js (INSERT + UPDATE). Home page uses a different pattern — polling on mount, not Realtime subscription.

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

`GET /api/setup-checklist` — derives checklist state at read time from tenant columns:
- Uses `createSupabaseServer()` for auth, `supabase` (service role) for data queries
- Parallel fetch: service count + calendar_credentials existence
- Returns `{ items, dismissed, completedCount }`

Item hrefs (updated in Phase 20 Plan 02 to point to More sub-pages):
- `connect_calendar` — `/dashboard/more/calendar-connections`
- `configure_hours` — `/dashboard/more/working-hours`
- `make_test_call` — `/dashboard/more/ai-voice-settings`

`PATCH /api/setup-checklist` — sets `setup_checklist_dismissed = true` on tenants row.

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
| `urgency` | text | CHECK IN ('emergency', 'routine', 'high_ticket') |
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

---

## 16. Key Design Decisions

- **6-tab desktop / 5-tab mobile navigation (Phase 20)**: Desktop sidebar: Home, Leads, Calendar, Calls, Analytics, More. Mobile bottom bar: Home, Leads, Calendar, Calls, Analytics (no More — gear icon in top bar links to /dashboard/more). Services and Settings consolidated into More menu. No mobile drawer pattern.

- **Page-level card ownership (Phase 20)**: Layout no longer wraps children in a card. Each page controls its own `card.base` wrapper. Prevents double-card stacking and gives each page independent padding control.

- **BottomTabBar as mobile nav (Phase 20)**: 5 tabs (no More), `h-[56px]`, `min-h-[48px]` touch targets, `safe-area-inset-bottom`, `z-40`, `bg-[#0F172A]`. Animated orange indicator via `layoutId="tab-indicator"` (framer-motion spring). `pb-[72px]` on main content div to clear the bar. Mobile-only (`lg:hidden`). More accessible via gear icon in top bar.
- **Call logs page (Phase 20)**: `/dashboard/calls` — queries `GET /api/calls` (calls table directly, not through leads). Date-grouped expandable cards with urgency border, summary stats bar, search by phone, expandable filters (time range, urgency, booking outcome). Tap to expand detail panel (duration, urgency, booking, language, recording, SMS status, triage info). Short calls (<15s) dimmed with "missed" tag.
- **Page transitions (Phase 20)**: framer-motion `AnimatePresence` on layout content area — `opacity: 0→1, y: 6→0` on route change. More sub-pages show `MoreBackButton` injected via `more/layout.js` on all sub-pages.

- **More menu as config hub (Phase 20)**: 9 sub-pages under `/dashboard/more/*` wrap existing components (thin wrappers). Old `/dashboard/services` and `/dashboard/settings` redirect to new routes — bookmarks preserved.

- **Adaptive home page (Phase 20, expanded Phase 30)**: Single page component branches into setup mode (checklist hero) vs active mode (command center) based on `isSetupComplete`. Active mode also renders `SetupChecklist` when any recommended items are incomplete (`hasIncompleteRecommended` state). The checklist appears between "This Week" stats and "Recent Activity" in active mode, so new users see what's left to configure without blocking their dashboard.

- **Expanded setup checklist (Phase 30)**: 9 total items (4 required, 5 recommended). Required items gate setup→active mode transition. Recommended items: `configure_hours`, `connect_calendar`, `configure_zones`, `setup_escalation`, `configure_notifications`. Calendar check is provider-agnostic (Google or Outlook). Notification check compares against defaults via JSON stringify.

- **`callsToday` stat queries `calls` table**: The `/api/dashboard/stats` route counts actual calls (from the `calls` table), not leads. This was a bug fix — the original counted leads, which undercounted since short calls (<15s) never create leads.

- **Joyride tour pattern (Phase 20)**: Tour mounted at layout level (persists across tab switches). Triggered by CustomEvent `start-dashboard-tour` from page.js button. Never auto-starts. Sets `gsd_has_seen_tour` in localStorage on completion. Respects `prefers-reduced-motion`.

- **REPLICA IDENTITY FULL on leads**: Required for Supabase Realtime to emit row-level change events with filter support. Without it, only new row data is available and tenant-level filtering breaks.

- **`getLeads` excludes `transcript_text`**: Performance decision — transcripts can be large text fields. Excluded from list queries; fetched separately via `GET /api/leads/[id]` when flyout opens.

- **Repeat caller merge checks `status IN ('new', 'booked')` only**: Completed, paid, and lost leads are considered closed — a repeat caller from a previously closed lead gets a new lead record rather than attaching to the old one.

- **Soft-delete via `is_active = false`**: Escalation contact DELETE sets `is_active = false` rather than removing the row. Preserves audit trail and call history references.

- **`LeadFlyout` rendered outside card stack**: The Sheet component (Radix UI) creates a portal, but positioning context conflicts with Kanban column overflow. LeadFlyout is rendered as a sibling to the lead list wrapper, not inside any column — prevents Sheet overlay stacking context issues.

- **Design tokens shared between onboarding + dashboard**: `src/lib/design-tokens.js` exports brand colors, button classes, card classes, glass effect, and grid texture. Both onboarding wizard and dashboard import from here — single source of truth for visual identity.

- **Realtime keyframe via `ensureSlideInKeyframe()`**: The `slide-in-from-top` animation is injected as a `<style>` tag once into `document.head`. Avoids CSS module complexity for a dynamic animation triggered by Realtime events at runtime.

- **Counter animation with `prefers-reduced-motion` guard**: `DashboardHomeStats` checks `window.matchMedia('(prefers-reduced-motion: reduce)')` before starting `requestAnimationFrame` loop. If reduced motion is preferred, value is set immediately without animation.

- **`SortableContactWrapper` wraps `useSortable`**: `EscalationChainSection` uses a thin wrapper component to apply DnD sortable behavior to `ContactCard` — `ContactCard` itself stays clean and testable with no DnD dependencies.

- **PATCH reorder includes `tenant_id` for RLS `WITH CHECK`**: Supabase RLS `WITH CHECK` on `escalation_contacts` requires `tenant_id` to match the authenticated user. Upsert operations must include `tenant_id` in each row even though only `sort_order` is changing.

---

## Cross-Domain References

- **Call processing → lead creation**: See `voice-call-architecture` skill for how `createOrMergeLead()` is called from `processCallAnalyzed()` and the `capture_lead` webhook handler.
- **Auth + RLS**: See `auth-database-multitenancy` skill for Supabase client patterns (`supabase-browser` vs `supabase-server` vs service role), RLS policies, and `getTenantId()`.
- **Design tokens (onboarding)**: See `onboarding-flow` skill for how design-tokens.js is used in the wizard pages.

---

## Important: Keeping This Document Updated

When making changes to any file listed in the File Map above, update the relevant sections of this skill document to reflect the new behavior. This ensures future conversations always have an accurate reference.

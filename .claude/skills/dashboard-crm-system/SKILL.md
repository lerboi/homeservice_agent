---
name: dashboard-crm-system
description: "Complete architectural reference for the dashboard and CRM system — all dashboard pages, lead lifecycle and merging, Kanban board, analytics charts, escalation chain, settings panels, setup checklist, design tokens, and Supabase Realtime integration. Use this skill whenever making changes to dashboard pages, lead management, CRM components, analytics, escalation contacts, service management, settings, or design tokens. Also use when the user asks about how leads work, wants to modify dashboard UI, or needs to debug Realtime subscription issues."
---

# Dashboard & CRM System — Complete Reference

This document is the single source of truth for the entire dashboard and CRM system. Read this before making any changes to dashboard pages, lead management, or CRM components.

**Last updated**: 2026-03-25 (Phase 12 — EscalationChainSection, services drag-to-reorder, design tokens)

---

## Architecture Overview

| Layer | Files | Purpose |
|-------|-------|---------|
| **Dashboard Pages** | `src/app/dashboard/` | All page routes nested under layout |
| **CRM Components** | `src/components/dashboard/` | Kanban, flyouts, charts, stats, editors |
| **API Routes** | `src/app/api/leads/`, `src/app/api/escalation-contacts/`, `src/app/api/setup-checklist/` | Lead CRUD, escalation CRUD, checklist state |
| **Business Logic** | `src/lib/leads.js` | Lead creation and repeat-caller merge |
| **Design System** | `src/lib/design-tokens.js` | Shared color palette and component tokens |
| **Realtime** | Supabase `supabase_realtime` publication | Live lead updates to dashboard via WebSocket |

```
Call ends → call_analyzed webhook → call-processor.js → createOrMergeLead()
                                                              ↓
                                          INSERT into leads table (Supabase)
                                                              ↓
                               Supabase Realtime broadcasts INSERT/UPDATE
                                                              ↓
                    Dashboard leads page subscribes → receives payload → animates new lead row
                                                              ↓
                                   DashboardHomeStats updates via Realtime
```

### Dashboard Page Structure

```
layout.js                        ← DashboardSidebar + sticky top bar + breadcrumb
  ├── page.js (/)                ← Home: stats + setup checklist + recent activity
  ├── leads/page.js              ← Filter bar + list/kanban toggle + LeadFlyout
  ├── analytics/page.js          ← AnalyticsCharts (revenue, funnel, pipeline donut)
  ├── calendar/page.js           ← CalendarView + ConflictAlertBanner + agenda
  └── services/page.js           ← Service table + WorkingHoursEditor + EscalationChainSection
      └── settings/page.js       ← SettingsAISection + SettingsHoursSection + SettingsCalendarSection
```

---

## File Map

| File | Role |
|------|------|
| `src/app/dashboard/layout.js` | Layout wrapper: sidebar, sticky top bar, breadcrumb nav |
| `src/app/dashboard/page.js` | Home page: stat widgets + setup checklist + recent activity feed |
| `src/app/dashboard/leads/page.js` | Leads page: filter bar, list/kanban toggle, Realtime subscription |
| `src/app/dashboard/analytics/page.js` | Analytics page: fetches all leads, renders AnalyticsCharts |
| `src/app/dashboard/services/page.js` | Services page: drag-to-reorder table, bulk tag, WorkingHoursEditor, EscalationChainSection |
| `src/app/dashboard/settings/page.js` | Settings page: AI section, hours section, calendar section |
| `src/app/dashboard/calendar/page.js` | Calendar page: CalendarView + AppointmentFlyout + ConflictAlertBanner |
| `src/components/dashboard/DashboardSidebar.jsx` | Left sidebar: nav items, mobile drawer, logout dialog |
| `src/components/dashboard/LeadFlyout.jsx` | Right Sheet: lead detail, status change, audio/transcript |
| `src/components/dashboard/KanbanBoard.jsx` | 5-column pipeline board (new/booked/completed/paid/lost) |
| `src/components/dashboard/AnalyticsCharts.jsx` | Revenue line + funnel bar + pipeline donut (recharts) |
| `src/components/dashboard/EscalationChainSection.js` | Escalation contacts CRUD + drag-to-reorder (@dnd-kit) |
| `src/components/dashboard/SetupChecklist.jsx` | First-run guided setup checklist with progress bar |
| `src/components/dashboard/WorkingHoursEditor.js` | Per-day hours editor with quick-set presets + slot duration |
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

`DashboardLayout({ children })` wraps all dashboard pages with:
- `DashboardSidebar` — fixed left sidebar (lg+) or mobile drawer
- Sticky top bar — `bg-white/80 backdrop-blur-md`, z-20, contains `DashboardBreadcrumb`
- `AnimatedSection` — wraps children in a white card with subtle shadow
- `GridTexture variant="light"` — subtle dot grid on background

**`DashboardBreadcrumb`** — reads `usePathname()`, maps last segment to label via `BREADCRUMB_LABELS`, renders "Dashboard > Leads" style path.

**`DashboardSidebar({ businessName })`** — `src/components/dashboard/DashboardSidebar.jsx`

Nav items rendered via `NavLink` component:
```js
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/leads', label: 'Leads', icon: Users },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar },
  { href: '/dashboard/services', label: 'Services', icon: Wrench },
];
const BOTTOM_NAV = [{ href: '/dashboard/settings', label: 'Settings', icon: Settings }];
```

Active state: `border-l-2 border-[#C2410C]` left orange border. Desktop: `lg:fixed lg:w-60 bg-[#0F172A]`. Mobile: hamburger button → overlay drawer with `GridTexture variant="dark"`.

---

## 2. Lead Lifecycle

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
1. `callDuration < 15` → return null (voicemail/misdial filter)
2. Query `leads` table: same `tenant_id` + `from_number`, status `IN ('new', 'booked')`, newest first, limit 1
3. If existing open lead → insert into `lead_calls` junction, return existing lead
4. If no open lead → insert new `leads` row; status = `'booked'` if `appointmentId` else `'new'`
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

## 3. Lead API Routes

**`GET /api/leads`** — `src/app/api/leads/route.js`

Query params: `status`, `urgency`, `date_from`, `date_to`, `search`, `job_type`. Returns `{ leads }`. Joins `lead_calls(calls(...))` without `transcript_text`. Limit 100.

**`GET /api/leads/[id]`** — `src/app/api/leads/[id]/route.js`

Returns full lead detail **including** `transcript_text` and `transcript_structured`. Also joins `appointments(id, start_time, end_time, status, service_address)`.

**`PATCH /api/leads/[id]`**

Body: `{ status, revenue_amount, previous_status }`. Validation: `status === 'paid'` requires `revenue_amount`. Side effect: logs `status_changed` to `activity_log` (fire-and-forget async IIFE, never blocks response).

---

## 4. Dashboard Pages

### Home (`src/app/dashboard/page.js`)

Client component. On mount, fetches in parallel via `Promise.allSettled`:
- `GET /api/leads?status=new&date_from={today}` — new leads today
- `GET /api/leads` — all leads for conversion rate calculation
- `GET /api/appointments?date={today}&days=1` — upcoming appointments count

State: `stats: { newLeadsToday, upcomingAppointments, callsToday, conversionRate }`. Shows `WelcomeBanner` when all stats are zero and no activities. Queries `activity_log` directly via `supabase-browser` for recent activity feed.

### Leads (`src/app/dashboard/leads/page.js`)

Client component. Features:
- **Filter bar**: status, urgency, date range, search, jobType
- **View toggle**: list (LeadCard rows) or kanban (KanbanBoard)
- **Realtime**: subscribes to `postgres_changes` on `leads` table filtered by `tenant_id=eq.${tenantId}` for INSERT and UPDATE events
- **Flyout**: `LeadFlyout` rendered **outside the card stack** to avoid Sheet overlay stacking context issues
- **Animation**: new Realtime inserts get `_isNew: true` flag → `animate-slide-in-from-top` class (injected via `ensureSlideInKeyframe()`)

### Analytics (`src/app/dashboard/analytics/page.js`)

Fetches all leads via `GET /api/leads`, passes to `AnalyticsCharts`. Shows `EmptyStateAnalytics` if no leads.

### Services (`src/app/dashboard/services/page.js`)

Client component. Renders service table with `@dnd-kit/core` + `@dnd-kit/sortable` for drag-to-reorder. Bulk tag bar shown when `selectedIds.size >= 2`. Delete uses 4-second undo toast with `setTimeout`. Page also embeds `WorkingHoursEditor`, `CalendarSyncCard`, `ZoneManager`, `EscalationChainSection`.

`patchServiceOrder()` — guards concurrent saves with `isSavingOrder` flag. Sends `{ order: [{ id, sort_order }] }` to `PATCH /api/services`.

### Settings (`src/app/dashboard/settings/page.js`)

Loads `retell_phone_number` from tenants table via Supabase browser client. Renders:
- `SettingsAISection` — phone number display, tone preset
- `SettingsHoursSection` — working hours
- `SettingsCalendarSection` — Google/Outlook calendar connect

Supports `#hash` anchor scroll on load (300ms delay for render).

### Calendar (`src/app/dashboard/calendar/page.js`)

Client component. Week/day view toggle (mobile always forces day view). Fetches from `GET /api/appointments?start=...&end=...&view=...`. Shows `ConflictAlertBanner` for detected conflicts. Today's agenda sidebar shows appointments for current date. `AppointmentFlyout` opens on appointment click.

---

## 5. CRM Components

### `LeadFlyout({ leadId, open, onOpenChange, onStatusChange })`

**File**: `src/components/dashboard/LeadFlyout.jsx`

Right-side Sheet. On open, fetches `GET /api/leads/${leadId}` (includes transcript). Renders:
- Urgency badge + relative time
- Caller info (phone, call timestamp)
- Job details (job_type, service_address, triage layer/confidence)
- `AudioPlayer` with recording URL
- `TranscriptViewer` with structured + text transcript
- Status `Select` + `RevenueInput` (shown for completed/paid)
- "Update Status" button → `PATCH /api/leads/${leadId}`
- "Mark as Lost" with `AlertDialog` confirmation

Key constants: `URGENCY_STYLES`, `STATUS_LABELS`, `STATUS_OPTIONS`.
`formatRelativeTime(iso)` — relative display (just now, Xm ago, Xh ago, Xd ago).

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

New (unsaved) contact is rendered as plain `ContactCard` (not sortable) until saved via `POST /api/escalation-contacts`. Save chain order → `PATCH /api/escalation-contacts` with `{ order: [{ id, sort_order }] }`.

Per-urgency mapping rows use `Switch` toggles (display-only, not persisted to DB). Emergency is locked (always enabled).

### `SetupChecklist()`

**File**: `src/components/dashboard/SetupChecklist.jsx`

Shown on dashboard home. Fetches `GET /api/setup-checklist`. Checklist items are **derived from tenants table columns** — not stored as separate rows:
- `create_account` — always complete
- `setup_profile` — `!!tenant.business_name`
- `configure_services` — `serviceCount > 0`
- `connect_calendar` — `!!calendar_credentials row`
- `configure_hours` — `!!tenant.working_hours`
- `make_test_call` — `!!tenant.onboarding_complete`

Shows `SetupCompleteBar` when all 6 items complete. PATCH dismiss → `setup_checklist_dismissed = true` on tenants.

### `WorkingHoursEditor()`

**File**: `src/components/dashboard/WorkingHoursEditor.js`

Per-day hours grid (7 days). Each day: enable toggle, open/close time inputs, optional lunch break. Copy popover to apply one day's schedule to other days. Quick-set presets: Mon–Fri 8–5, Mon–Fri 7–6, Mon–Sat 8–5, Mon–Sat 7–6. Slot duration select (30/45/60/90/120 min). Dirty-state detection (`isDirty`). `PUT /api/working-hours` to save.

### `CalendarView({ appointments, externalEvents, travelBuffers, currentDate, viewMode, loading, onAppointmentClick })`

**File**: `src/components/dashboard/CalendarView.js`

Time grid from 7 AM to 8 PM (START_HOUR=7, END_HOUR=20, HOUR_HEIGHT=48px). CSS grid: `grid-cols-[48px_repeat(7,1fr)]` for week, `grid-cols-[48px_1fr]` for day.

Block components: `AppointmentBlock` (clickable, urgency color), `TravelBufferBlock` (dashed stone), `ExternalEventBlock` (purple, Google Calendar events). `CurrentTimeIndicator` — orange line updated every minute via `setInterval`.

Position calculation: `getPositionStyle(startTime, endTime)` converts timestamps to `top`/`height` pixel values relative to START_HOUR.

### `DashboardHomeStats({ stats })`

**File**: `src/components/dashboard/DashboardHomeStats.jsx`

4 stat widgets: New Leads Today, Upcoming Appointments, Calls Today, Conversion Rate.

**Counter animation**: `requestAnimationFrame` with ease-out cubic (`1 - Math.pow(1 - progress, 3)`). 600ms duration. Stagger via `index * 80ms` delay. `prefers-reduced-motion` → skips animation, sets value immediately.

```js
const StatWidget = ({ label, value, Icon, formatter, index }) => { ... }
```

---

## 6. Design Tokens

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

---

## 7. Supabase Realtime

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

## 8. Escalation Contacts API

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

## 9. Setup Checklist API

**File**: `src/app/api/setup-checklist/route.js`

`GET /api/setup-checklist` — derives checklist state at read time from tenant columns:
- Uses `createSupabaseServer()` for auth, `supabase` (service role) for data queries
- Parallel fetch: service count + calendar_credentials existence
- Returns `{ items, dismissed, completedCount }`

`PATCH /api/setup-checklist` — sets `setup_checklist_dismissed = true` on tenants row.

---

## 10. Database Tables

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

## 11. Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (Realtime client + browser client) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side Supabase auth + Realtime subscriptions |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side API routes (bypasses RLS for lead/escalation writes) |

---

## 12. Key Design Decisions

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

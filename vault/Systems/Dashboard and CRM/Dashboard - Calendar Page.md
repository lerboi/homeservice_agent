---
type: system
system: Dashboard and CRM
status: legacy-app
description: "Calendar Page. Covers: 2026-06-10 rework — connections card + perf; Components orchestrated; Phase 57 — Jobber overlays; Visual hierarchy; Phase 58 error state; EmptyStateCalendar wrapper"
source: .claude/skills/dashboard-crm-system/SKILL.md § 7. Calendar Page
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Calendar Page

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

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

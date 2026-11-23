---
type: system
system: Dashboard and CRM
status: legacy-app
description: "CRM Components. Covers: EscalationChainSection; WorkingHoursEditor; CalendarView; DashboardHomeStats"
source: .claude/skills/dashboard-crm-system/SKILL.md § 10. CRM Components
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# CRM Components

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

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

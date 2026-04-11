---
phase: 42-calendar-essentials-time-blocks-and-mark-complete
plan: "03"
subsystem: dashboard-ui
tags: [calendar, mark-complete, appointments, shadcn, lucide, localStorage]
dependency_graph:
  requires: ["42-01"]
  provides:
    - Mark Complete two-step flow in AppointmentFlyout
    - Completed appointment visual state in CalendarView (opacity-40 + checkmark badge)
    - Show completed toggle with localStorage persistence in calendar page
  affects:
    - src/components/dashboard/AppointmentFlyout.js
    - src/components/dashboard/CalendarView.js
    - src/app/dashboard/calendar/page.js
    - src/components/ui/textarea.jsx
tech_stack:
  added:
    - src/components/ui/textarea.jsx (new shadcn Textarea component)
  patterns:
    - Two-step confirm pattern for destructive-ish actions (Mark Complete -> Confirm Complete)
    - localStorage persistence for toggle state with SSR guard
    - onStatusChange callback pattern for parent refetch after mark-complete/undo
    - Captured primitive (appointmentId) before async ops to avoid stale closure
key_files:
  created:
    - src/components/ui/textarea.jsx
  modified:
    - src/components/dashboard/AppointmentFlyout.js
    - src/components/dashboard/CalendarView.js
    - src/app/dashboard/calendar/page.js
decisions:
  - "Textarea component created manually (shadcn pattern) since npx shadcn add textarea would require interactive shell — file-based creation matches existing component style"
  - "showCompletionNotes textarea collapses on flyout close (useEffect on open) — no cancel button needed per plan spec"
  - "handleStatusChange calls fetchData() for full refetch rather than optimistic update — ensures completed_at and status are fresh from DB after mark-complete/undo"
  - "Cancel Appointment button hidden for completed appointments (status !== completed guard) — completed jobs cannot be double-actioned"
metrics:
  duration_seconds: 242
  completed_date: "2026-04-11"
  tasks_completed: 2
  files_created: 1
  files_modified: 3
  tests_added: 0
---

# Phase 42 Plan 03: Mark Complete UI Summary

**One-liner:** Two-step mark-complete flow in AppointmentFlyout with optional notes textarea + 5s undo toast, completed appointments at 40% opacity with green checkmark badge in CalendarView, and Show completed toggle with localStorage persistence on the calendar page.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Mark Complete Button + Completion Notes in AppointmentFlyout | `5e70e43` | AppointmentFlyout.js, textarea.jsx (created) |
| 2 | Completed Appointment Visual State + Show Completed Toggle | `f8cb544` | CalendarView.js, calendar/page.js |

## Artifacts Created

### src/components/ui/textarea.jsx
- Standard shadcn Textarea component following the `data-slot` / `cn()` pattern
- Used by AppointmentFlyout's CompletionNotesInput textarea

### src/components/dashboard/AppointmentFlyout.js (modified)
- Added `onStatusChange` prop (callback for mark-complete and undo)
- Added `showCompletionNotes`, `completionNotes`, `isCompleting` state
- `useEffect` on `open` resets all mark-complete state when flyout closes
- "Mark Complete" button renders only when `appointment.status === 'confirmed'` and notes panel is not open
- Clicking "Mark Complete" reveals expandable `Textarea` with completion notes placeholder
- "Confirm Complete" button: PATCH `/api/appointments/[id]` with `{ status: 'completed', notes? }`, then closes flyout and fires 5s undo toast
- Undo toast action: PATCH with `{ status: 'confirmed' }` and calls `onStatusChange`
- Completed appointments: green "Completed" badge in header, "Completed on {date}" with Check icon in Details section
- Cancel Appointment button hidden for completed appointments
- Added `Check`, `Loader2` imports from lucide-react; `Textarea` from ui/textarea; `Badge` already existed

### src/components/dashboard/CalendarView.js (modified)
- Added `Check` to lucide-react import
- `AppointmentBlock`: added `isCompleted = appointment.status === 'completed'`
- `blockClass` applies `opacity-40` to existing urgency block class when completed
- Absolute-positioned green checkmark badge (`bg-green-100`, `text-green-700`, `w-4 h-4`) at `bottom-1 right-1` inside completed blocks

### src/app/dashboard/calendar/page.js (modified)
- Added `Switch` import from `@/components/ui/switch`
- Added `showCompleted` state with lazy initializer reading `localStorage.getItem('voco_calendar_show_completed')` (defaults to `true`)
- `useEffect` persists `showCompleted` to localStorage on every change
- `filteredAppointments` computed: passes all appointments when `showCompleted` is true, filters out `status === 'completed'` otherwise
- Both `CalendarView` instances receive `filteredAppointments` instead of `data.appointments`
- Toolbar: `Switch` + `Label` ("Show completed jobs") rendered right-aligned between the time block "+" button and the Month/Day toggle
- `handleStatusChange(id, newStatus)` calls `fetchData()` to refetch fresh appointment data after mark-complete/undo
- `AppointmentFlyout` receives `onStatusChange={handleStatusChange}`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Textarea component created manually**
- **Found during:** Task 1
- **Issue:** `npx shadcn add textarea` requires interactive terminal — not usable in automated executor context. Textarea component did not exist in `src/components/ui/`
- **Fix:** Created `src/components/ui/textarea.jsx` manually following the existing shadcn component pattern (data-slot, cn(), Tailwind classes matching shadcn new-york style)
- **Files modified:** `src/components/ui/textarea.jsx` (created)
- **Commit:** `5e70e43`

**2. [Rule 2 - Missing Critical] Cancel Appointment hidden for completed appointments**
- **Found during:** Task 1
- **Issue:** Plan spec said "Mark Complete button replaced by read-only completed display" but didn't explicitly handle the Cancel Appointment button for completed status — leaving it would allow cancelling an already-completed job
- **Fix:** Wrapped the entire Cancel Appointment AlertDialog in `{appointment.status !== 'completed' && (...)}` guard
- **Files modified:** `src/components/dashboard/AppointmentFlyout.js`
- **Commit:** `5e70e43`

## Known Stubs

None — all functionality is fully wired: PATCH API calls hit real endpoints built in Plan 01, localStorage reads/writes are real, the Switch toggle filters real appointment data.

## Self-Check: PASSED

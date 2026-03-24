---
phase: 03-scheduling-and-calendar-sync
plan: 05
status: complete
started: 2026-03-21
completed: 2026-03-21
---

## What Shipped

Calendar/Appointments dashboard page with week/day views, appointment blocks, travel buffers, external calendar overlay, appointment detail flyout, conflict alerts, and today's agenda sidebar.

## Key Files

### Created
- `src/app/dashboard/calendar/page.js` — Calendar page with week/day navigation, responsive layout, today's agenda sidebar
- `src/components/dashboard/CalendarView.js` — Week/day grid with urgency-colored appointment blocks, travel buffer blocks, external Google Calendar events (purple dashed), current time indicator (red line, 60s interval)
- `src/components/dashboard/AppointmentFlyout.js` — Sheet-based detail panel with appointment info, caller details, recording/transcript links, conflict section, cancel with AlertDialog confirmation
- `src/components/dashboard/ConflictAlertBanner.js` — Amber alert banner for calendar overlaps with dismiss and review actions
- `src/components/dashboard/BookingStatusBadge.js` — Status badges (Booked/Lead - slots suggested/No booking/Booking failed) for call history integration
- `src/app/api/appointments/route.js` — GET with travel buffer computation, external events, conflict detection
- `src/app/api/appointments/[id]/route.js` — GET detail with call data, PATCH cancel and conflict dismiss
- `src/components/ui/sheet.jsx` — Shadcn Sheet component
- `src/components/ui/alert-dialog.jsx` — Shadcn AlertDialog component

## Decisions
- Calendar page uses max-w-6xl override (wider than layout's max-w-4xl) for calendar + sidebar layout
- Mobile forces day-only view, hides week toggle
- Navigation uses opacity fade transition (100ms out, 150ms in)
- Current time indicator updates via setInterval every 60s
- Travel buffers computed server-side from zone_travel_buffers table
- Conflict detection: overlap check between external events and confirmed appointments

## Self-Check: PASSED

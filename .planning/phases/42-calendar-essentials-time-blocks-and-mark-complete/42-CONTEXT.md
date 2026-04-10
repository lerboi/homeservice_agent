# Phase 42: Calendar Essentials — Time Blocks and Mark Complete - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Add two capabilities to the dashboard calendar:

1. **Personal time blocks** (lunch, vacation, errands) that render on the calendar and that the voice agent's availability check respects as unavailable.
2. **Mark complete** transition on appointments with a muted visual state for completed jobs.

**Cross-repo phase:** Changes both the Next.js main repo (new `calendar_blocks` table, UI components, API routes) and the LiveKit Python agent repo (update `check_availability` / slot calculation to query time blocks).

**Not in scope:** drag/resize interaction, recurring time blocks, Supabase Realtime for blocks, technician assignment, shared-drawer refactor, recurring appointments (Phase 43).

</domain>

<decisions>
## Implementation Decisions

### Time Block Creation UX
- **D-01:** Click + Sheet pattern. User clicks a '+' button or empty time slot → a Sheet (slide-over) opens with fields for title, start/end time, date, all-day toggle, and optional note. Same Sheet pattern as the existing "Add Appointment" quick-entry form on the calendar page.
- **D-02:** Fields captured: title (free text), date, start time, end time, all-day toggle. All-day blocks span the full working hours window. No recurrence (Phase 43 territory). No category presets.
- **D-03:** Time blocks are editable and deletable after creation. Clicking a time block on the calendar reopens the same Sheet in edit mode with a delete button inside. Consistent with how AppointmentFlyout works for appointments.

### Time Block Visual Treatment
- **D-04:** Hatched/striped diagonal pattern over a muted background (e.g., gray or slate). Clearly distinct from solid-colored appointment blocks. Standard calendar convention for "blocked" time.
- **D-05:** Time blocks render full width behind appointments as a background layer. They do NOT participate in the lane layout algorithm (`layoutEventsInLanes`). Appointments render on top of time blocks. Standard Google Calendar behavior.

### Mark Complete Interaction
- **D-06:** "Mark Complete" button in the existing AppointmentFlyout, alongside the existing "Cancel Appointment" button. Same interaction surface — click appointment → flyout opens → action buttons at bottom.
- **D-07:** Instant status update with a success toast that includes an "Undo" action. Click "Mark Complete" → status updates to `completed` + `completed_at` timestamp → flyout closes → success toast appears. Clicking "Undo" on the toast reverts status back to `confirmed`. No confirmation dialog.
- **D-08:** Optional completion notes — a small expandable text area appears in the flyout when the user clicks "Mark Complete". Contractors can jot down what was done (e.g., "Replaced water heater thermostat, old unit was 15 years old") for records and follow-up invoicing. Not required — can skip for routine jobs. Notes save to the existing `notes` column (appended if notes already exist, or set if empty).

### Completed Appointment Visuals
- **D-09:** Completed appointments render at reduced opacity (~40%) with a small ✓ checkmark badge in the corner. Same urgency color tint preserved but clearly "done". Block remains clickable to open the flyout.
- **D-10:** "Show completed" toggle filter above the calendar. On by default. When toggled off, completed appointments disappear from the calendar view. Non-destructive — toggle back to see them again.

### Voice Agent Integration (LiveKit Python Agent)
- **D-11:** Claude's Discretion — the `check_availability` tool in the LiveKit Python agent must query the new `calendar_blocks` table and treat any overlapping time block as unavailable when offering slots to callers. Implementation approach (direct query vs feeding blocks as `externalBlocks` to slot calculation) is Claude's call.

### Claude's Discretion
- Voice agent integration approach for time blocks (D-11)
- Database schema design for `calendar_blocks` table (columns, constraints, RLS policies)
- API route structure for CRUD operations on time blocks
- How `completed_at` timestamp is stored (new column vs reusing existing fields)
- Slot calculator integration method (how time blocks feed into `calculateAvailableSlots`)
- Toast + undo implementation details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Calendar & Scheduling
- `src/components/dashboard/CalendarView.js` — Main calendar renderer with `URGENCY_STYLES`, `layoutEventsInLanes`, `AppointmentBlock`, `CurrentTimeIndicator`
- `src/components/dashboard/AppointmentFlyout.js` — Appointment detail sheet with cancel action (mark-complete button goes here)
- `src/app/dashboard/calendar/page.js` — Calendar page orchestrator, manages Sheet for add-appointment, Realtime subscription
- `src/lib/scheduling/slot-calculator.js` — `calculateAvailableSlots` with `externalBlocks` parameter (time blocks plug in here)
- `src/app/api/appointments/route.js` — GET/POST appointments API
- `src/app/api/appointments/[id]/route.js` — PATCH appointment status (needs `completed` handler)
- `src/app/api/appointments/available-slots/route.js` — Feeds `externalBlocks` from `calendar_events` to slot calculator

### Database Schema
- `supabase/migrations/003_scheduling.sql` — Appointments table with `status CHECK ('confirmed', 'cancelled', 'completed')`
- `.claude/skills/auth-database-multitenancy/SKILL.md` — All DB migrations and RLS patterns
- `.claude/skills/scheduling-calendar-system/SKILL.md` — Slot calculation, booking, calendar sync architecture

### Voice Agent (LiveKit Python Agent — separate repo)
- `.claude/skills/voice-call-architecture/SKILL.md` — Voice agent architecture, tool execution, check_availability patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AppointmentFlyout` — Sheet component with cancel button pattern; mark-complete button follows same layout
- `CalendarView.AppointmentBlock` — Absolute-positioned calendar block component; time block component follows similar positioning math
- `layoutEventsInLanes` — Lane algorithm for overlapping events (time blocks bypass this — render full width behind)
- `URGENCY_STYLES` map — Needs a new `completed` entry for reduced-opacity + checkmark styling
- `calculateAvailableSlots` — Already accepts `externalBlocks` array; time blocks feed in as additional entries
- Calendar page Sheet — Existing add-appointment Sheet pattern reused for time block creation/editing

### Established Patterns
- PATCH `/api/appointments/[id]` handles status transitions (currently only `cancelled`) — extend for `completed`
- Supabase Realtime subscription on `appointments` table exists on the calendar page
- `book_appointment_atomic` RPC for atomic slot operations
- Working hours stored as `tenants.working_hours` JSONB

### Integration Points
- New `calendar_blocks` table → API routes → CalendarView rendering
- `available-slots/route.js` → must also query `calendar_blocks` and pass as `externalBlocks`
- LiveKit Python agent's `check_availability` tool → must query `calendar_blocks` from Supabase
- Calendar page state → needs to fetch and manage time blocks alongside appointments

</code_context>

<specifics>
## Specific Ideas

- Hatched/striped CSS pattern for time blocks (diagonal lines over muted gray/slate background)
- Completion notes text area should be expandable — not always visible, only when user clicks "Mark Complete"
- Undo via toast follows a timed revert pattern — toast visible for ~5 seconds, undo PATCHes status back to `confirmed`
- All-day time blocks span the full working hours window (not literally 00:00-23:59)
- Home service contractors use completion notes for invoicing context ("Replaced water heater thermostat, old unit was 15 years old")

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 42-calendar-essentials-time-blocks-and-mark-complete*
*Context gathered: 2026-04-10*

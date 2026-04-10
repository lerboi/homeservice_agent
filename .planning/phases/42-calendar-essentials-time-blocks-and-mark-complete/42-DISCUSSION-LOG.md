# Phase 42: Calendar Essentials — Time Blocks and Mark Complete - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 42-calendar-essentials-time-blocks-and-mark-complete
**Areas discussed:** Time block creation UX, Time block visual treatment, Mark complete interaction, Completed appointment visuals

---

## Time Block Creation UX

### How should users create time blocks?

| Option | Description | Selected |
|--------|-------------|----------|
| Click + Sheet (Recommended) | User clicks a '+' button or clicks on an empty time slot → a Sheet opens with fields for title, start/end time, date, and optional note. Same Sheet pattern as existing 'Add Appointment' quick-entry form. | ✓ |
| Inline click-drag | User clicks and drags on the calendar grid to create a block directly. More fluid but requires significant new interaction code. | |
| Dedicated form page | A separate page or modal with a full form. More discoverable but heavier. | |

**User's choice:** Click + Sheet
**Notes:** Consistent with existing calendar page patterns.

### What fields should the time block Sheet capture?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: title + time range | Title, date, start time, end time. No recurrence, no categories. | |
| Moderate: title + time + all-day toggle | Same as minimal but adds an 'All Day' toggle for vacations/days off. | ✓ |
| Rich: title + time + all-day + presets | Adds quick preset buttons (Lunch 12-1pm, Vacation all-day) that pre-fill the form. | |

**User's choice:** Moderate — title + time + all-day toggle
**Notes:** All-day blocks span the full working hours window.

### Should time blocks be editable and deletable after creation?

| Option | Description | Selected |
|--------|-------------|----------|
| Click to open Sheet (Recommended) | Clicking a time block reopens the same Sheet in edit mode. Delete button inside. | ✓ |
| Click to delete only | Clicking shows a small popover with just a delete button. No editing. | |
| You decide | Claude picks the approach that fits existing codebase patterns. | |

**User's choice:** Click to open Sheet
**Notes:** Consistent with AppointmentFlyout interaction pattern.

---

## Time Block Visual Treatment

### How should time blocks look on the calendar?

| Option | Description | Selected |
|--------|-------------|----------|
| Hatched/striped pattern | Diagonal stripes over a muted background. Clearly distinct from solid appointment blocks. | ✓ |
| Muted solid with icon | Solid background in neutral color with a small lock/block icon. | |
| Semi-transparent overlay | Semi-transparent wash over the time slot area. | |

**User's choice:** Hatched/striped pattern
**Notes:** Standard calendar convention for "blocked" time.

### Should time blocks participate in the lane layout algorithm?

| Option | Description | Selected |
|--------|-------------|----------|
| Full width behind appointments (Recommended) | Time blocks span full column width as background layer. Appointments render on top. | ✓ |
| Lane layout alongside appointments | Time blocks enter the same lane algorithm, sit side-by-side with appointments. | |

**User's choice:** Full width behind appointments
**Notes:** Standard Google Calendar behavior.

---

## Mark Complete Interaction

### Where should the 'Mark Complete' action live?

| Option | Description | Selected |
|--------|-------------|----------|
| Button in AppointmentFlyout (Recommended) | 'Mark Complete' button in existing flyout, next to 'Cancel Appointment'. | ✓ |
| Right-click context menu | Right-click on appointment block → context menu. | |
| Both flyout + calendar action | Button in flyout AND checkmark icon on calendar block. | |

**User's choice:** Button in AppointmentFlyout
**Notes:** Consistent with existing cancel pattern.

### Should marking complete be instant or require confirmation?

| Option | Description | Selected |
|--------|-------------|----------|
| Instant with toast (Recommended) | Click → status updates → success toast → flyout closes. Undo via toast if needed. | ✓ |
| Confirmation dialog | Click → 'Are you sure?' → confirm → update. | |
| Instant, no toast | Click → flyout closes → visual change only. | |

**User's choice:** Instant with undo toast
**Notes:** User specifically requested the undo action on the toast — click "Undo" reverts to confirmed status.

### Should marking complete capture additional data?

| Option | Description | Selected |
|--------|-------------|----------|
| No extra data (Recommended) | Just flip status + completed_at timestamp. | |
| Optional completion notes | Small text field in flyout before completing. | ✓ |
| You decide | Claude picks based on schema and UI patterns. | |

**User's choice:** User asked Claude to pick the best design for home service business owners.
**Notes:** Claude recommended optional completion notes — expandable text area for contractors to jot down what was done (useful for invoicing). Not required, saves to existing `notes` column.

---

## Completed Appointment Visuals

### How should completed appointments look on the calendar?

| Option | Description | Selected |
|--------|-------------|----------|
| Reduced opacity + checkmark badge | Same urgency color at ~40% opacity, small ✓ badge in corner. Still clickable. | ✓ |
| Grayed out (uniform muted color) | All completed become same muted gray regardless of urgency. | |
| Strikethrough text + muted | Title gets strikethrough, block fades to ~50% opacity. | |

**User's choice:** Reduced opacity + checkmark badge
**Notes:** Preserves urgency color context while clearly indicating completion.

### Should users be able to hide completed appointments?

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle filter (Recommended) | 'Show completed' toggle above calendar. On by default. | ✓ |
| Always visible | No filter. Reduced opacity is enough separation. | |
| You decide | Claude picks based on existing filter patterns. | |

**User's choice:** Toggle filter
**Notes:** Non-destructive toggle, on by default.

---

## Claude's Discretion

- Voice agent integration approach for time blocks (direct query vs externalBlocks pattern)
- Database schema design for `calendar_blocks` table
- API route structure for time block CRUD
- `completed_at` storage approach
- Slot calculator integration method
- Toast + undo implementation details

## Deferred Ideas

None — discussion stayed within phase scope.

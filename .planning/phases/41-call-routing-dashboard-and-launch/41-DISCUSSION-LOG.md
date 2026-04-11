# Phase 41: Call Routing Dashboard and Launch - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 41-call-routing-dashboard-and-launch
**Areas discussed:** Schedule editor layout, Page structure & pickup numbers, Usage meter & caps display, Routing mode badges on calls page

---

## Schedule Editor Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Day list with toggles | Vertical list of 7 days (Mon–Sun), each row has an enable toggle + start/end time pickers. Disabled days grayed out. Matches working-hours page pattern. | ✓ |
| Compact week grid | Horizontal grid of day pills (M T W T F S S). Click a day to toggle and select times. More compact but less scannable. | |
| Copy from working hours | Pre-populate from existing working_hours column, then let users edit. | (combined) |

**User's choice:** Day list with toggles + "Copy from working hours" quick-start button
**Notes:** User asked for best real-world UX recommendation. Day list chosen because it matches existing working-hours pattern (zero learning curve), shows all 7 days at once (no hidden state), and works well on mobile. "Copy from working hours" added as a quick-start button since most contractors want routing hours = working hours. Reduces first-time setup from 14 taps to 1 + minor edits.

---

## Page Structure & Pickup Numbers

| Option | Description | Selected |
|--------|-------------|----------|
| Inline card list | Each number is a card row with number, label, SMS toggle, edit/delete. "Add number" opens inline form. Matches escalation-contacts pattern. | ✓ |
| Sheet/modal for add & edit | Numbers as simple list. Adding/editing opens a side sheet with fields. More space for validation but adds navigation friction. | |
| Simple table | Plain table with columns. Functional but less polished. | |

**User's choice:** Inline card list with "2 of 5" counter
**Notes:** User again asked for best real-world UX. Inline cards chosen because: 3-field form (phone, label, SMS toggle) doesn't warrant a modal/sheet; max 5 entries means list never gets unwieldy; edit/delete directly on each row eliminates select-open-edit-close loop; matches escalation-contacts pattern in codebase. Single scrolling page with section cards (no tabs) for overall structure.

---

## Usage Meter & Caps Display

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal progress bar with cap shown | Compact bar: "42 of 5,000 minutes used this month" with green/amber/red color shifts. | ✓ |
| Ring gauge (match billing page) | Reuse UsageRingGauge SVG from billing dashboard. More prominent but may overpower settings page. | |
| Plain text only | Just text, no visual bar. Simplest but less scannable. | |

**User's choice:** Horizontal progress bar with cap shown
**Notes:** Ring gauge is too visually prominent for supplementary info on a settings page. Horizontal bar takes minimal vertical space. Cap value shown (5,000 or 2,500 based on country) to prevent anxiety. Color shifts at 70% and 90% thresholds.

---

## Routing Mode Badges on Calls Page

| Option | Description | Selected |
|--------|-------------|----------|
| 3-badge system | AI = stone/muted, You answered = blue, Missed → AI = amber. NULL = no badge. Owner-pickup cards hide AI details. | ✓ |
| Adjust badge labels/colors | Different wording or color scheme. | |
| Separate tab for owner calls | Separate tab/filter instead of mixing into existing list. | |

**User's choice:** 3-badge system as described
**Notes:** Owner-pickup calls mixed into same list (no separate tab). Routing badge provides sufficient visual differentiation. Owner-pickup cards gracefully hide AI-specific details (urgency, booking, recording, language) with "You handled this call directly" note. NULL/legacy calls get no badge — no retroactive labeling.

---

## Claude's Discretion

- Exact time picker component choice
- Whether "Copy from working hours" appears only when empty or always
- Animation/transition patterns
- Usage meter collapsibility
- Test organization
- Whether calls page gets a routing filter dropdown

## Deferred Ideas

- Multi-range per day (schema supports it, UI writes single range)
- Routing mode filter on calls page
- Usage alerts/notifications at cap thresholds
- Call routing analytics charts

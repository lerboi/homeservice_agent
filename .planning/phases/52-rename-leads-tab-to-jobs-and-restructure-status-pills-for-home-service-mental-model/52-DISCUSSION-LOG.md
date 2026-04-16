# Phase 52: Rename Leads Tab to Jobs — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 52 — Rename Leads tab to Jobs and restructure status pills for home-service mental model
**Areas discussed:** Status pill structure, Lost status fate, Route + scope of rename, Visual/pill treatment

---

## Gray Area Selection

**Question:** Which areas do you want to discuss for Phase 52 (Leads → Jobs rename)?

| Option | Description | Selected |
|--------|-------------|----------|
| Status pill structure | Reconcile RENAME-02's 6-state example with 5-value DB enum | ✓ |
| Lost status fate | Keep, rename, or hide "Lost" | ✓ |
| Route + scope of rename | URL rename + copy-reframe breadth | ✓ |
| Visual/pill treatment | Color tweaks, pill order, count badge | ✓ |

**User's choice:** All 4 areas.

---

## Area 1 — Status Pill Structure

### Question 1: How should we reconcile the 6-state example in RENAME-02 with the 5-value DB enum?

| Option | Description | Selected |
|--------|-------------|----------|
| 5 pills, 1:1 with DB (Recommended) | Relabel only, no derived states | |
| 6-7 pills with derived sub-states | Synthesize Quoted/In-Progress from other fields | |
| Fewer pills — merge related states | Simplify to 3-4 pills | ✓ (initial) |

**User's initial choice:** Fewer pills — merge related states.

**Follow-up challenge:** User asked "Which option/design provides the best UI/UX that is usable in the real world?" Claude pushed back on the merge approach because the `completed` vs `paid` distinction is the home-service owner's "who owes me money" list — the single most valuable filter on the page. Merging it into "Done" buries collections workflow behind a click.

**User's final choice:** Accepted Claude's recommendation — 5 pills, 1:1 with DB, no merge.

### Question 2: Which label set for the 5 pills?

| Option | Description | Selected |
|--------|-------------|----------|
| New / Booked / Completed / Paid / Lost (keep current) | Minimal change | |
| New / Scheduled / Done / Paid / Cancelled | Home-service vernacular | |
| New / Booked / In Progress / Completed / Paid | Match RENAME-02 flow exactly | |
| You decide | Defer to Claude | ✓ |

**User's choice:** You decide.
**Claude's pick:** New / Scheduled / Completed / Paid / Lost. Rationale: "Scheduled" is the operator verb for the calendar; `completed`/`paid`/`lost` already match home-service vernacular.

### Question 3: Pill strip order?

| Option | Description | Selected |
|--------|-------------|----------|
| Progression order with Lost pushed right (Recommended) | Job-flow left-to-right, Lost visually separated | ✓ |
| Keep current order as-is | Same order, new labels | |
| Count-sorted | Most jobs on the left | |

**User's choice:** Progression order with Lost pushed right.

### Question 4: Keep the count badges on each pill?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep counts — same as today (Recommended) | Numeric count next to each label | ✓ |
| Remove counts | Cleaner pills | |
| Only show count when > 0 | Hide zero counts | |

**User's choice:** Keep counts.

---

## Area 2 — Lost Status Fate

### Question: Keep "Lost" or rename to "Cancelled"?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep "Lost" (Recommended) | Home-service vernacular already | ✓ |
| Rename to "Cancelled" | Softer framing | |
| Rename to "Dead" | Very direct | |

**User's choice:** Keep "Lost".

---

## Area 3 — Route + Scope of Rename

### Question 1: URL — keep `/dashboard/leads` or rename?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep `/dashboard/leads` (Recommended) | Zero breakage, zero blast radius | |
| Rename to `/dashboard/jobs` with redirect | Cleaner mental model, 22-file audit | ✓ |

**User's choice:** Rename to `/dashboard/jobs` with redirect. User overrode Claude's "keep URL" recommendation in favor of the cleaner mental model.

### Question 2: Scope of "lead" → "job" copy reframe (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar + BottomTabBar nav labels (required by RENAME-01) | Nav labels | ✓ |
| Page title, LeadFilterBar, LeadFlyout copy (required by RENAME-03) | Primary surface copy | ✓ |
| HotLeadsTile + DailyOpsHub home-page widgets (Recommended) | Home dashboard widgets | ✓ |
| Stats API response labels, EmptyStateLeads, search index (Recommended) | Secondary surfaces | ✓ |

**User's choice:** All 4 — full copy reframe across every user-facing surface.

---

## Area 4 — Visual / Pill Treatment

### Question: Any adjustments beyond label swap?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep Phase 49 colors + add subtle gap before Lost (Recommended) | Preserve categorical palette, small visual separator | ✓ |
| Keep Phase 49 colors exactly as-is, no gap | Zero visual change | |
| Rework colors for home-service theme | Repaint, invalidate Phase 49 work | |

**User's choice:** Keep Phase 49 colors + add gap before Lost.

---

## Claude's Discretion

- Exact wording of page H1, empty-state headlines, toast messages, breadcrumb text
- Exact size of gap before Lost (`ml-2` vs `ml-3` vs vertical divider element)
- Whether the `LeadFilterBar` "Search name or phone…" placeholder needs editing (it doesn't say "lead")
- Whether to rename the internal `PIPELINE_STATUSES` constant (no user impact)

## Deferred Ideas

- Adding `quoted` / `in_progress` as real DB status values — future milestone
- Repainting pill palette for a warmer home-service theme — scope creep
- Visual attention treatment on non-zero Completed pill count — future UI polish
- Renaming `leads` DB table, API routes, or component file names — ROADMAP-excluded
- Spanish i18n for dashboard copy — separate initiative

---
phase: 12-dashboard-configurable-triage-and-call-escalation
plan: 02
subsystem: ui
tags: [react, dnd-kit, drag-and-drop, shadcn, next-intl, services, dashboard]

# Dependency graph
requires:
  - phase: 12-01
    provides: "sort_order column on services table and PATCH /api/services reorder endpoint"
provides:
  - "SortableServiceRow component with useSortable, drag handle, bulk checkbox"
  - "Services page with DnD drag-to-reorder using @dnd-kit/sortable"
  - "Bulk tag editing for 2+ selected service rows"
  - "Improved empty state with Wrench icon per UI-SPEC"
affects:
  - phase 12-03 (EscalationChainSection adds below ZoneManager in services page)

# Tech tracking
tech-stack:
  added: ["@dnd-kit/core@6.3.1", "@dnd-kit/sortable@10.0.0", "@dnd-kit/utilities@3.2.2", "shadcn radio-group"]
  patterns: ["Optimistic reorder with PATCH on drag end", "Set-based multi-select state", "useSortable hook per row component"]

key-files:
  created:
    - src/components/dashboard/SortableServiceRow.js
    - src/components/ui/radio-group.jsx
  modified:
    - src/app/dashboard/services/page.js
    - package.json

key-decisions:
  - "@dnd-kit/sortable chosen over react-beautiful-dnd (unmaintained) for keyboard-accessible drag-and-drop"
  - "Bulk tag bar appears when selectedIds.size >= 2 — threshold matches UI-SPEC interaction contract"
  - "Optimistic PATCH on drag end — isSavingOrder flag prevents overlapping requests"
  - "Wrench icon from lucide-react (not inline SVG) — consistent with existing lucide usage in project"

patterns-established:
  - "SortableRow pattern: useSortable hook + CSS.Transform.toString + isDragging opacity"
  - "Bulk select pattern: Set-based selectedIds state with handleSelectToggle toggling entries"

requirements-completed: [TRIAGE-CFG-01]

# Metrics
duration: 25min
completed: 2026-03-23
---

# Phase 12 Plan 02: Services Table DnD Reorder and Bulk Tag Edit Summary

**@dnd-kit drag-to-reorder services table with optimistic PATCH, Set-based bulk tag editing for 2+ rows, and wrench-icon empty state per UI-SPEC**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-23T21:16:00Z
- **Completed:** 2026-03-23T21:41:23Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Installed @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities and added radio-group shadcn component
- Created SortableServiceRow with GripVertical drag handle, checkbox for bulk select, existing badge+select tag control, and remove button
- Rebuilt services page with DndContext/SortableContext wrapping service rows, handleDragEnd with arrayMove, patchServiceOrder calling PATCH /api/services, and bulk action bar
- Improved empty state with Wrench lucide icon above heading per UI-SPEC D-03

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @dnd-kit and create SortableServiceRow component** - `9ffcdbd` (feat)
2. **Task 2: Rebuild services page with DnD reorder, bulk tag edit, and improved empty state** - `8b40ab0` (feat)

## Files Created/Modified

- `src/components/dashboard/SortableServiceRow.js` - DnD-sortable wrapper for individual service rows with useSortable, drag handle, checkbox, urgency badge+select, remove button
- `src/components/ui/radio-group.jsx` - Added shadcn RadioGroup component (needed by Plan 03 EscalationChainSection)
- `src/app/dashboard/services/page.js` - Rebuilt with DndContext, SortableContext, handleDragEnd, patchServiceOrder, selectedIds state, handleBulkTagChange, bulk action bar, wrench empty state icon
- `package.json` - Added @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities dependencies

## Decisions Made

- Used Wrench from lucide-react rather than inline SVG — consistent with existing Lucide icon usage throughout the project
- Bulk action bar threshold is >= 2 selected items — single-item "bulk" edit is redundant since the per-row Select dropdown handles single updates
- patchServiceOrder sets isSavingOrder flag during the request to prevent overlapping PATCH calls on rapid consecutive drags (Pitfall 1 from RESEARCH.md)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- @dnd-kit/sortable installed at v10.0.0 (research noted v8.0.0 as current) — this is fine, peer dep with core 6.x still satisfied

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Services page structure preserved with ZoneManager as the last section
- Plan 03 can add `<Separator className="my-6" />` and `<EscalationChainSection />` below ZoneManager without any conflicts
- radio-group.jsx already installed and ready for EscalationChainSection's notification preference RadioGroup
- All existing WorkingHoursEditor, CalendarSyncCard, ZoneManager sections untouched

---
*Phase: 12-dashboard-configurable-triage-and-call-escalation*
*Completed: 2026-03-23*

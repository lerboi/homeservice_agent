---
phase: 52-rename-leads-tab-to-jobs-and-restructure-status-pills-for-home-service-mental-model
plan: 01
subsystem: ui
tags: [dashboard, status-pills, copy-reframe, tailwind, react, leadcard]

# Dependency graph
requires:
  - phase: 49-dark-mode-foundation-and-token-migration
    provides: Categorical dark-mode active classes for all 5 status pills (DARK-07 contract)
provides:
  - LeadStatusPills.jsx PIPELINE_STATUSES with label 'Scheduled' for booked, extraClass ml-2 on Lost, aria-label 'Filter jobs by status'
  - LeadCard.jsx STATUS_LABEL with booked: 'Scheduled', View button aria-label 'View job from {name}'
affects:
  - 52-02 (LeadFlyout / LeadFilterBar — must use 'Scheduled' for booked to match these two files)
  - 52-03 (EmptyStateLeads, HotLeadsTile — sibling components on the same Jobs page)
  - 52-05 (final UAT checkpoint — will visually verify the pill strip shows Scheduled + Lost gap)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "extraClass field on PIPELINE_STATUSES entry for per-pill Tailwind overrides without touching markup structure"

key-files:
  created: []
  modified:
    - src/components/dashboard/LeadStatusPills.jsx
    - src/components/dashboard/LeadCard.jsx

key-decisions:
  - "Use extraClass field on the lost PIPELINE_STATUSES entry + conditional append in className — keeps markup identical for all 4 non-gap pills, applies ml-2 only to Lost button"
  - "replace_all=true on View aria-label edit — both desktop and mobile layout buttons carry identical aria-label, single edit covers both"
  - "Phase 49 activeClass strings preserved byte-for-byte; verified via automated regex checks"

patterns-established:
  - "extraClass pattern: add optional extraClass field to PIPELINE_STATUSES entry; destructure in .map(); append \${extraClass || ''} to className — zero impact on pills without extraClass"

requirements-completed: [RENAME-02]

# Metrics
duration: 12min
completed: 2026-04-16
---

# Phase 52 Plan 01: Status Pill Relabel + LeadCard Badge Sync Summary

**Status pill strip relabeled with home-service vernacular (Scheduled for booked, Lost gap via ml-2 extraClass) and LeadCard badge synchronized — both files agree on all 5 DB enum display strings**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-16T14:45:00Z
- **Completed:** 2026-04-16T14:57:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `LeadStatusPills.jsx` PIPELINE_STATUSES: `booked` label changed from `'Booked'` to `'Scheduled'`; `lost` entry gains `extraClass: 'ml-2'` for 8px visual separation from Paid; `.map()` destructure and button `className` updated to apply `extraClass` conditionally; container `aria-label` reframed from `"Filter leads by status"` to `"Filter jobs by status"`
- `LeadCard.jsx` STATUS_LABEL: `booked: 'Booked'` changed to `booked: 'Scheduled'` — status badge on cards with `lead.status === 'booked'` now displays "Scheduled" matching the pill strip
- View button `aria-label` updated from `"View lead from {name}"` to `"View job from {name}"` in both the desktop and mobile layout blocks (replace_all)
- All Phase 49 Plan 04 categorical `activeClass` strings preserved byte-for-byte across all 5 pills — DARK-07 contract intact

## Task Commits

Each task was committed atomically:

1. **Task 1: Update LeadStatusPills.jsx** - `71e118d` (feat)
2. **Task 2: Sync LeadCard.jsx** - `f831279` (feat)

**Plan metadata:** (docs commit — see final_commit section, created after orchestrator state writes)

## Files Created/Modified

- `src/components/dashboard/LeadStatusPills.jsx` — PIPELINE_STATUSES booked label Scheduled, lost extraClass ml-2, aria-label reframed, map destructure + className updated
- `src/components/dashboard/LeadCard.jsx` — STATUS_LABEL booked Scheduled, View aria-label to job (both layout blocks)

## Decisions Made

- Used `extraClass` field on the `lost` entry rather than a wrapper `<span className="ml-2">` — keeps the button element itself carrying the margin, avoids adding an extra DOM node inside the `role="tablist"` container (accessibility-safer per UI-SPEC interaction contract)
- Ran `replace_all: true` on the View aria-label edit — both desktop (`hidden sm:flex`) and mobile (`flex sm:hidden`) layout blocks carry the same aria-label string, a single replace_all covers both without risk of missing one

## Deviations from Plan

None — plan executed exactly as written. All 5 mutations in Task 1 and both mutations in Task 2 applied as specified. No extra files touched.

## Issues Encountered

**Worktree base mismatch:** The worktree's HEAD was at `b86963f` (older than the required base `ac2bd3d`). After `git reset --soft ac2bd3daf1f78c2df5973aab152efc3289e3d255`, the diff between old and new base was left staged, causing the first commit attempt to inadvertently include planning-file deletions. Resolved by: `git reset --soft HEAD~1` → `git restore --staged .` → `git add src/components/dashboard/LeadStatusPills.jsx` → clean re-commit.

## Known Stubs

None — this plan changes only static label strings and one Tailwind utility class. No data-wiring, no empty values, no placeholder text introduced.

## Threat Flags

None — pure label/className changes. No new network endpoints, auth paths, file access patterns, or schema changes. No user-input crosses any modified code path.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- LeadStatusPills and LeadCard are the canonical source of truth for the `booked` → `"Scheduled"` label; Plans 02–04 can reference these files as the established pattern
- Plan 02 (LeadFlyout + LeadFilterBar) should verify its `STATUS_LABELS` map uses `booked: 'Scheduled'` to stay in sync with this plan
- No blockers

---
*Phase: 52-rename-leads-tab-to-jobs-and-restructure-status-pills-for-home-service-mental-model*
*Completed: 2026-04-16*

## Self-Check: PASSED

- FOUND: `src/components/dashboard/LeadStatusPills.jsx`
- FOUND: `src/components/dashboard/LeadCard.jsx`
- FOUND: `.planning/phases/52-.../52-01-SUMMARY.md`
- COMMIT 71e118d: confirmed created (git output: `[worktree-agent-a619fca7 71e118d] feat(52-01): relabel booked→Scheduled...`)
- COMMIT f831279: confirmed created (git output: `[worktree-agent-a619fca7 f831279] feat(52-01): sync LeadCard STATUS_LABEL...`)

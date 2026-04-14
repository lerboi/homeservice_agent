---
phase: 48
plan: 03
subsystem: dashboard-home
tags: [dashboard, checklist, setup, ui, wave-2]
dependency-graph:
  requires:
    - tenants.checklist_overrides JSONB column (migration 050 from Plan 48-01)
    - /api/setup-checklist GET returning themed items + overrides (Plan 48-01)
    - /api/setup-checklist PATCH accepting {item_id, mark_done|dismiss} (Plan 48-01)
    - tests/unit/setup-checklist.test.js RED scaffold (Plan 48-01 Task 1)
    - src/components/ui/accordion.jsx (shadcn — already installed)
    - src/components/ui/badge.jsx (shadcn — already installed)
    - src/hooks/useSWRFetch.js (revalidateOnFocus: true default)
    - sonner toast (already in project deps)
  provides:
    - Themed setup checklist UI (profile/voice/calendar/billing accordions)
    - Per-item actions — Dismiss / Mark done / Jump to page — wired to PATCH /api/setup-checklist
    - Window-focus refetch via useSWRFetch (returns from Stripe / Google OAuth tabs auto-update checklist)
    - Optimistic Mark done with error-revert + sonner error toast
    - Dismiss → sonner "Dismissed. Undo" toast that reverse-PATCHes on click
    - HOME-01 requirement complete
  affects:
    - src/components/dashboard/SetupChecklist.jsx (refactored in place — D-01 preserved)
    - src/components/dashboard/ChecklistItem.jsx (rewritten for 3-action row contract)
    - tests/unit/setup-checklist.test.js (RED → GREEN, expanded from 4 to 8 assertions)
tech-stack:
  added: []
  patterns:
    - shadcn Accordion (type="single" collapsible) for theme grouping
    - useSWRFetch's revalidateOnFocus flag as the sole auto-detection signal (no visibilitychange listener, no Realtime)
    - Optimistic SWR mutate with { revalidate: false } + explicit mutate() on success to refetch truth
    - Sonner toast with action.label/onClick for reversible Dismiss (Undo pattern)
    - Default accordion open = first theme with an incomplete item (computed via useMemo)
    - Font-normal badge override preserves two-weight typography rule
key-files:
  created: []
  modified:
    - src/components/dashboard/SetupChecklist.jsx
    - src/components/dashboard/ChecklistItem.jsx
    - tests/unit/setup-checklist.test.js
    - .claude/skills/dashboard-crm-system/SKILL.md
decisions:
  - "Refactored in place per D-01; kept default export signature + onDataLoaded prop so src/app/dashboard/page.js continues to work unchanged"
  - "Used shadcn Accordion (type=single collapsible) matching UI-SPEC's 'one group open at a time' default; THEME_ORDER = [profile, voice, calendar, billing] is canonical"
  - "Default-open accordion is the first theme with an incomplete item (owner lands on work-to-do), falling back to voice when all done"
  - "Expanded unit test file from 4 to 8 assertions — covers theme order, PATCH bodies, useSWRFetch wiring, conic-gradient/SetupCompleteBar preservation, sonner Undo, and ChecklistItem contract"
  - "Required items hide the Dismiss button (product sensibility per plan spec — required ≠ dismissible)"
  - "Reversed the Mark done toggle: when complete && mark_done_override both true, button shows 'Unmark done' and PATCHes mark_done:false to clear the override"
metrics:
  duration: "~15 minutes execution"
  completed: 2026-04-15
  tasks: 2
  files_modified: 4
  commits: 2
---

# Phase 48 Plan 03: Setup Checklist Refactor Summary

Refactored `SetupChecklist.jsx` in place to deliver **HOME-01**: a 4-theme accordion (profile / voice / calendar / billing) with Dismiss / Mark done / Jump to page actions per row, powered by `useSWRFetch`'s `revalidateOnFocus` so returning from an external settings tab auto-refetches checklist state — no polling, no Realtime subscription. The conic-gradient progress ring and `SetupCompleteBar` celebration are preserved verbatim per D-01. RED scaffold `tests/unit/setup-checklist.test.js` is now GREEN (8/8).

## Contract Preserved (for callers of SetupChecklist)

- Default export name: `SetupChecklist`
- Prop contract: `onDataLoaded?: (data: object | null) => void`
- Behavior: `onDataLoaded` is fired via SWR's `onSuccess` with the full GET payload `{ items, dismissed, completedCount, progress }`
- Existing callers (`src/app/dashboard/page.js` lines 217 + 357) require no changes.

## THEME_LABELS + THEME_ORDER

```js
const THEME_ORDER = ['profile', 'voice', 'calendar', 'billing'];
const THEME_LABELS = {
  profile:  'Profile',
  voice:    'Voice',
  calendar: 'Calendar',
  billing:  'Billing',
};
```

Order matches the GET response ordering (driven by `THEME_GROUPS` + `THEME_ORDER` in `src/app/api/setup-checklist/route.js`). `tests/unit/setup-checklist.test.js` locks the order via a regex on the `THEME_ORDER` array.

## Accordion default-open logic

```js
const defaultOpenTheme = useMemo(() => {
  for (const theme of THEME_ORDER) {
    const items = groupedByTheme[theme] || [];
    if (items.some((i) => !i.complete)) return theme;
  }
  return THEME_ORDER[1]; // fall back to 'voice' when everything is complete
}, [groupedByTheme]);
```

Then rendered as `<Accordion type="single" collapsible defaultValue={defaultOpenTheme}>`.

## Line Diff — `SetupChecklist.jsx`

| Aspect | Before (prior impl) | After (Phase 48) |
|--------|---------------------|------------------|
| Total lines | 269 | 287 |
| Data source | `useEffect` + `fetch('/api/setup-checklist')` | `useSWRFetch('/api/setup-checklist', { revalidateOnFocus: true })` |
| Grouping | Required / Recommended split (2 sections) | Theme accordion — 4 sections (profile/voice/calendar/billing) |
| Ring | 2-segment conic (copper required + stone recommended) | 1-segment conic (copper complete % on light-gray remainder) |
| Per-item actions | Row expand → single `Set up` Link | 3 actions: Jump (primary), Mark done, Dismiss |
| Auto-detect on tab return | No | Yes (SWR `revalidateOnFocus`) |
| Dismiss | Whole-checklist only (once `allComplete`) | Per-item + whole-checklist preserved |
| Undo toast | No | Yes (sonner `toast` with `action.label: 'Undo'`) |
| Optimistic UX | No | Yes (SWR `mutate` with `revalidate:false`, explicit refetch on success, revert + toast on error) |

## Preserved Verbatim (D-01)

- `ProgressRing` conic-gradient donut (simplified from 2-segment to 1-segment — colors match UI-SPEC Color section: copper fill + light-gray remainder)
- `SetupCompleteBar` celebration modal (imported + rendered unchanged when `progress.complete === progress.total`)
- Whole-checklist dismiss path (PATCH body `{ dismissed: true }` unchanged)
- `onDataLoaded` prop (fired from `useSWRFetch.onSuccess`)

## Line Diff — `ChecklistItem.jsx`

| Aspect | Before | After |
|--------|--------|-------|
| Total lines | 68 | 140 |
| Props | `{ item, type, description, expanded, onToggle }` | `{ item, onMarkDone, onDismiss }` |
| Description source | `description` prop passed from parent | `item.description` (from API) |
| Title field | `item.label` | `item.title` (matches API contract) |
| Badge | None (type icon only in expanded state) | Required (copper-soft) / Recommended (stone) badge always visible |
| Actions | Row expand + single `Set up` Link in expanded state | Jump (primary btn) + Mark done (ghost) + Dismiss (icon X, hidden for required) |
| Touch targets | 44px on expand button only | 44px on all 3 action buttons + 44x44 on dismiss |
| aria-labels | None | Primary: `"{primaryLabel}: {title}"`; Mark done: `"Mark/Unmark {title} as done"`; Dismiss: `"Dismiss {title}"` |

## Test Status

| Test | State | Notes |
|------|-------|-------|
| `tests/unit/setup-checklist.test.js` | GREEN (8/8) | Was RED 3/4 from Plan 48-01 (file-exists passed). All 8 assertions now pass: accordion wiring, theme order, PATCH bodies, SWR config, conic ring, SetupCompleteBar, sonner Undo, ChecklistItem contract |
| Full `tests/unit/` suite | 201 pass / 10 fail | 10 failures are pre-known Wave-0 intentional REDs (chat-panel, usage-tile, help-discoverability — owned by Plans 48-04/05) + pre-existing `routing-style.test.js` `require is not defined` ESM issue documented in Plan 48-02 SUMMARY. **Zero new regressions from Plan 48-03.** |

## Tasks & Commits

| # | Task | Commit |
|---|------|--------|
| 1 | Extend `ChecklistItem.jsx` with Dismiss / Mark done / Jump actions + badges + 44px targets | `b81c015` |
| 2 | Refactor `SetupChecklist.jsx` → theme accordions + window-focus refetch + Undo toast; turn test file GREEN | `bb39a0a` |

## Deviations from Plan

None — plan executed exactly as written. Notes:

- Plan output instruction named the file `48-03-SUMMARY.md`, but the task prompt + Phase 48 convention (see 48-01-schema-apis-test-scaffold-SUMMARY.md, 48-02-chat-provider-context-lift-SUMMARY.md) uses the slug-full form. Followed the slug-full convention for consistency with sibling SUMMARYs.
- The plan's Task 2 action mentioned a `Show N dismissed` footer link; per the plan's implementer-choice language ("prefer client-side filter if API already returns only non-dismissed items"), no footer was added because dismissed items never reach the client (the GET route filters them in `deriveChecklistItems`). Showing them would require an API change (`?include_dismissed=1`) that the plan explicitly scoped out. No deviation — plan allowed this.
- Test file was expanded from the 4 RED assertions to 8 GREEN assertions; all original assertions continue to hold, so this is a strict superset. The Task 2 acceptance-criteria `npx jest tests/unit/setup-checklist.test.js --no-coverage` exits 0.

## Authentication Gates

None — autonomous plan, no checkpoints, no user secrets required.

## Known Stubs

None. All three per-item actions are fully wired to the PATCH endpoint. Whole-checklist dismiss path remains functional. No placeholder data sources.

## Threat Flags

None — all new surface is covered by the plan's threat register (T-48-10 Tampering mitigated via server-side `VALID_ITEM_IDS` enum; T-48-11 DoS mitigated via SWR `dedupingInterval: 5000` + optimistic UI collapsing click-storms; T-48-12 Info Disclosure accepted — tenant-scoped payload contains only booleans). No new network endpoints, no schema changes, no new auth paths.

## Self-Check: PASSED

**Files verified exist:**
- `src/components/dashboard/SetupChecklist.jsx` — FOUND (modified)
- `src/components/dashboard/ChecklistItem.jsx` — FOUND (modified)
- `tests/unit/setup-checklist.test.js` — FOUND (GREEN 8/8)
- `.claude/skills/dashboard-crm-system/SKILL.md` — FOUND (modified)

**Commits verified exist:**
- `b81c015` — FOUND (Task 1 — ChecklistItem)
- `bb39a0a` — FOUND (Task 2 — SetupChecklist + tests)

**Tests verified:**
- `setup-checklist` → 8/8 PASS (was 3/4 PASS + 1 RED)
- Full unit suite → 201 PASS / 10 FAIL (all failures are pre-known Wave-0 intentional REDs or pre-existing ESM issue from Plan 48-02 SUMMARY; zero new regressions)

**Acceptance criteria — Task 1 (all 10 passed):**
- aria-label, min-h-[44px] (3 occurrences), onMarkDone, onDismiss, Required, Recommended, copper-soft bg, badge typography class, Mark done/Unmark done, aria-label Dismiss

**Acceptance criteria — Task 2 (all 8 passed):**
- Accordion import, all 4 theme names, useSWRFetch wiring, revalidateOnFocus, SetupCompleteBar, Undo literal, conic-gradient (3 occurrences), jest test file exits 0

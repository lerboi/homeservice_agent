---
phase: 46-vip-caller-direct-routing
plan: "04"
subsystem: ui
tags: [vip-routing, call-routing, leads, priority-callers, unified-list, react, supabase]

# Dependency graph
requires:
  - phase: 46-01
    provides: is_vip boolean on leads, vip_numbers JSONB on tenants, PATCH /api/leads/[id] endpoint
  - phase: 46-03
    provides: Priority Callers section on /dashboard/more/call-routing, LeadFlyout toggle for is_vip

provides:
  - GET /api/call-routing returns vip_leads array (id, caller_name, from_number) scoped to tenant + is_vip=true
  - Unified Priority Callers list on call-routing settings page merging both vip_numbers and vip_leads sources
  - Source-aware remove handlers (standalone via PUT save flow; lead-sourced via immediate PATCH /api/leads/[id])
  - "Lead ↗" affordance on lead-sourced rows navigating to /dashboard/leads?open={leadId}
  - UserCheck icon on Priority badge in LeadCard (replacing Star icon)
  - Gap 1 from 46-HUMAN-UAT.md fully closed

affects: [future plans that extend Priority Callers or unified list patterns]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - source-aware unified list pattern — two backend sources merged client-side with per-row dispatch based on source field; template for features with multiple data origins
    - priority-flag pattern extended — lead-sourced priority entries now visible in settings UI without changing DB field names (vip_numbers/is_vip preserved)
    - optimistic revert pattern — handleRemoveVipLead uses prevLeads snapshot for rollback on PATCH failure

key-files:
  created: []
  modified:
    - src/app/api/call-routing/route.js
    - tests/api/call-routing.test.js
    - src/app/dashboard/more/call-routing/page.js
    - src/components/dashboard/LeadCard.jsx

key-decisions:
  - "source-aware unified list: two backend sources (vip_numbers from tenants, vip_leads from leads) merged client-side with a source discriminator field — avoids DB-level JOIN complexity and keeps each source's mutation path independent"
  - "lead-sourced removes are immediate (PATCH + optimistic update), not deferred to save bar — mixing immediate and deferred removes in the same list would be confusing UX"
  - "UserCheck icon replaces Star on Priority badge in LeadCard per user request at human-verify checkpoint; LeadFlyout.jsx icon swap deferred to ride with another terminal's in-progress commit on that file"
  - "unifiedPriority sorted alphabetically by displayName (case-insensitive), ties broken by phone number — source origin does not affect sort order"

patterns-established:
  - "source-aware unified list: merge two backend sources with { source, key, id, number, displayName } shape; dispatch remove/edit actions by source field; apply 'Lead ↗' affordance for non-editable sources; this pattern is reusable wherever one feature has multiple data origins"

requirements-completed: []

# Metrics
duration: ~30min
completed: "2026-04-12"
---

# Phase 46 Plan 04: Priority Callers Gap Closure Summary

**GET /api/call-routing extended with vip_leads array; unified Priority Callers list merges vip_numbers + lead-sourced entries with source-aware remove/navigate actions, closing UAT Gap 1 (lead-based priority callers invisible on settings page).**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-04-12T14:30:00Z
- **Completed:** 2026-04-12T15:10:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify)
- **Files modified:** 4

## Accomplishments

- Extended GET /api/call-routing to return `vip_leads: [{ id, caller_name, from_number }]` for `leads WHERE tenant_id=<current> AND is_vip=true`, with tenant scoping guard and 500 error path — existing vip_numbers field unchanged
- Unified Priority Callers list on /dashboard/more/call-routing merges both sources via `unifiedPriority` array sorted alphabetically by displayName; lead-sourced rows show "Lead ↗" affordance and trash-only action (no pencil); standalone rows keep existing pencil+trash+save-bar flow
- `handleRemoveVipLead` PATCHes `/api/leads/{id}` with `{ is_vip: false }` immediately on trash click, optimistically removes the row, and reverts on error — sticky save bar is NOT triggered
- `handleOpenLead` routes to `/dashboard/leads?open={leadId}`, which opens that lead's flyout automatically via the existing `?open=` query param pattern
- UserCheck icon applied to Priority badge in LeadCard replacing Star icon per user request at checkpoint
- New test `GET returns vip_leads scoped to current tenant` added; 17/17 call-routing.test.js tests pass; existing GET tests patched with `leads` mock branch to prevent undefined returns after the new query

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend GET /api/call-routing to return vip_leads** - `752f7e8` (feat)
2. **Task 2: Merge vip_numbers + vip_leads into unified Priority Callers list** - `3d3b2bd` (feat)
3. **Follow-up: Swap Priority icon from Star to UserCheck in LeadCard** - `25cb19d` (feat)
4. **Task 3: Human-verify checkpoint** - APPROVED by user

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `src/app/api/call-routing/route.js` — GET handler extended with Supabase leads query (tenant_id + is_vip=true); `vip_leads: vipLeadsRows || []` added to Response.json; PUT handler untouched
- `tests/api/call-routing.test.js` — New test asserting vip_leads scoped to tenant and is_vip filter applied; existing GET tests updated with leads mock branch returning empty array; 17/17 pass
- `src/app/dashboard/more/call-routing/page.js` — `vipLeads` state + `useRouter` added; `loadSettings` loads `vip_leads` from GET response; `handleRemoveVipLead` (optimistic PATCH with revert); `handleOpenLead` (router.push); `unifiedPriority` computed before render; Priority Callers rendering block replaced with unified map over `unifiedPriority`; source-aware action buttons ("Lead ↗"/pencil/trash); empty state on `unifiedPriority.length === 0`; vipNumbers/savedVipNumbers/isDirty/PUT payload unchanged
- `src/components/dashboard/LeadCard.jsx` — Priority badge icon swapped from Star to UserCheck per user request at checkpoint

## Decisions Made

- **Source-aware unified list:** Two backend sources (standalone `vip_numbers` from the tenants row, `vip_leads` from the leads table) are merged client-side using a `source` discriminator field. This avoids a DB-level JOIN and keeps each source's mutation path fully independent — standalone removes are deferred to the PUT save bar, lead removes are immediate via PATCH.
- **Lead removes are immediate, not deferred:** Mixing immediate and deferred removes in the same visual list would create confusing UX (user clicks trash, row stays pending Save). Lead-sourced removes go through `PATCH /api/leads/{id}` immediately with optimistic update and revert on error.
- **UserCheck icon applied to LeadCard only in this commit:** User requested the icon swap at the human-verify checkpoint. LeadFlyout.jsx also references the Priority icon but had in-progress edits in another terminal — that file's icon swap will ride with the other terminal's commit to avoid staging unrelated changes.
- **Alphabetical sort ignores source:** The `unifiedPriority` array sorts by displayName (caller_name for leads, label for standalone), case-insensitive, ties broken by phone number. Source origin is irrelevant to ordering — the list reads as one coherent set.

## Deviations from Plan

### User-Requested Post-Verification Changes

**[User Request] Swap Priority icon from Star to UserCheck on LeadCard Priority badge**
- **Found during:** Task 3 (human-verify checkpoint)
- **Issue:** User reviewed the unified list UI and requested the Priority badge icon on LeadCard be changed from Star to UserCheck for clearer semantic meaning (a checkmark-person icon better represents "priority caller" than a generic star).
- **Fix:** Replaced `Star` with `UserCheck` import in LeadCard.jsx; updated badge JSX icon reference.
- **Files modified:** `src/components/dashboard/LeadCard.jsx`
- **Commit:** `25cb19d`
- **Note:** LeadFlyout.jsx uses the same Star icon for Priority context but was excluded from this commit due to in-progress changes on that file in another terminal. The icon swap in LeadFlyout.jsx will be applied when that terminal's changes are committed.

---

**Total deviations:** 1 user-requested post-verification change (not an auto-fix deviation)
**Impact on plan:** All functional requirements met. Icon swap is cosmetic only — no DB, API, or behavior change.

## Issues Encountered

None beyond the post-verification icon swap request.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- UAT Gap 1 from 46-HUMAN-UAT.md is closed: lead-based priority callers now appear in the unified Priority Callers section on /dashboard/more/call-routing
- The source-aware unified list pattern is established and documented for reuse in future features with multiple data origins
- LeadFlyout.jsx Star→UserCheck icon swap remains pending (will ride with next commit touching that file)
- Phase 46 gap-closure plan 04 is complete; phase can proceed to close-out per orchestrator

---
*Phase: 46-vip-caller-direct-routing*
*Completed: 2026-04-12*

## Self-Check: PASSED

Files verified present in codebase:
- `src/app/api/call-routing/route.js` — modified (Task 1)
- `tests/api/call-routing.test.js` — modified (Task 1)
- `src/app/dashboard/more/call-routing/page.js` — modified (Task 2)
- `src/components/dashboard/LeadCard.jsx` — modified (follow-up)

Commits referenced:
- `752f7e8` — Task 1: Extend GET /api/call-routing to return vip_leads
- `3d3b2bd` — Task 2: Merge vip_numbers + vip_leads into unified Priority Callers list
- `25cb19d` — Follow-up: Swap Priority icon from Star to UserCheck in LeadCard

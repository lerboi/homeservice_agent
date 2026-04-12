---
phase: 46-vip-caller-direct-routing
plan: "03"
subsystem: ui
tags: [vip-routing, dashboard, call-routing, leads, leadcard, leadflyout, react]

# Dependency graph
requires:
  - phase: 46-01
    provides: vip_numbers JSONB on tenants, is_vip boolean on leads, API extensions for GET/PUT call-routing and PATCH leads

provides:
  - VIP Callers section on /dashboard/more/call-routing with add/edit/delete, E.164 validation, persisted via PUT API
  - VIP badge (violet filled star) on LeadCard rendered when lead.is_vip=true
  - VIP Caller toggle in LeadFlyout with optimistic PATCH and revert
  - Priority Callers UI label pattern (DB stays vip_*, UI shows "Priority Caller")

affects: [Phase 46-02 webhook routing is upstream, no downstream UI dependencies]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - priority-flag pattern — DB column/field stays vip_* by design; UI copy uses "Priority Caller" / "Priority Callers" for user-facing text
    - same inline add/edit/delete list pattern as pickup numbers (call-routing page)
    - optimistic update + revert pattern in LeadFlyout (setLead prev => ... with revert on error)

key-files:
  created: []
  modified:
    - src/app/dashboard/more/call-routing/page.js
    - src/components/dashboard/LeadCard.jsx
    - src/components/dashboard/LeadFlyout.jsx
    - src/app/dashboard/more/page.js
    - src/app/dashboard/more/ai-voice-settings/page.js

key-decisions:
  - "UI-SPEC specified 'VIP Callers' throughout; user requested rename to 'Priority Callers' / 'Priority Caller' during re-verification — DB columns (vip_numbers, is_vip) and API field names unchanged to avoid migration + Python agent redeploy"
  - "Page renamed from 'Answer Your Own Calls' to 'Call Routing' and Priority Callers section moved above the scheduled-forwarding card per user request"
  - "VIP section always rendered outside AnimatePresence block — Priority Callers work 24/7 regardless of schedule toggle (per D-03)"
  - "No cap on Priority Caller entries per D-09 (unlimited VIP entries)"

patterns-established:
  - "priority-flag pattern: when DB naming (vip_*) differs from desired user-facing copy ('Priority'), keep DB names stable and change only UI strings — avoids migration + agent redeploy cost for purely cosmetic rename"

requirements-completed: [VIP-09, VIP-10, VIP-11, VIP-12, VIP-13]

# Metrics
duration: ~35min
completed: "2026-04-12"
---

# Phase 46 Plan 03: VIP Caller Dashboard UI Summary

**Priority Callers section added to /dashboard/more/call-routing with inline add/edit/delete and E.164 validation; Priority badge (violet star) added to LeadCard; Priority Caller toggle added to LeadFlyout with optimistic PATCH and revert — DB fields remain vip_numbers/is_vip, UI copy uses "Priority".**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-04-12T03:30:00Z
- **Completed:** 2026-04-12T04:05:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify)
- **Files modified:** 5

## Accomplishments

- Priority Callers section rendered on call-routing settings page, always visible outside AnimatePresence block regardless of schedule.enabled toggle, with full add/edit/delete flow, E.164 validation, duplicate detection, and persistence via existing PUT /api/call-routing
- VIP badge (violet-100/violet-700, filled Star icon) rendered on LeadCard when lead.is_vip=true, positioned before urgency badge
- VIP Caller toggle in LeadFlyout performs optimistic PATCH to /api/leads/[id] with is_vip boolean, reverts on error, guarded by lead.from_number presence
- User-requested follow-up: page renamed to "Call Routing", section heading/label renamed to "Priority Callers"/"Priority Caller", section reordered above scheduled-forwarding card; DB field names preserved

## Task Commits

Each task was committed atomically:

1. **Task 1: Add VIP Callers section to call routing page** - `182191d` (feat)
2. **Task 2: Add VIP badge to LeadCard and VIP toggle to LeadFlyout** - `b2a2799` (feat)
3. **User follow-up: Rename VIP→Priority, reorder sections, rename page to "Call Routing"** - `daf6a79` (feat)
4. **Task 3: Visual verification checkpoint** - APPROVED by user

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `src/app/dashboard/more/call-routing/page.js` — Priority Callers section with state, handlers (add/edit/delete), validation, isDirty extension, PUT payload extension, section JSX outside AnimatePresence; page heading renamed to "Call Routing"; Priority Callers card reordered above schedule card
- `src/components/dashboard/LeadCard.jsx` — Star import added; VIP badge (bg-violet-100 text-violet-700, filled Star h-3 w-3) rendered before urgency badge when lead.is_vip=true
- `src/components/dashboard/LeadFlyout.jsx` — Star + Switch imports added; VIP Caller toggle row with optimistic PATCH, success/error toasts, revert on failure, guarded by lead.from_number; positioned before Pipeline Status separator
- `src/app/dashboard/more/page.js` — "Answer Your Own Calls" menu item renamed to "Call Routing" to match page heading
- `src/app/dashboard/more/ai-voice-settings/page.js` — Adjacent settings page updated for consistency with rename

## Decisions Made

- **DB names frozen at vip_*:** The UI-SPEC specified "VIP Callers" throughout. During re-verification, the user requested a rename to "Priority Callers"/"Priority Caller". The underlying DB columns (`vip_numbers`, `is_vip`) and all API field names were left unchanged — renaming those would require a follow-up Supabase migration and a Python livekit-agent redeploy, which was explicitly out of scope for this UI plan.
- **Section always outside AnimatePresence:** Priority Callers work 24/7 regardless of schedule.enabled state. The section is rendered after the `</AnimatePresence>` closing tag and before the sticky save bar, matching decision D-03 from CONTEXT.md.
- **No length cap:** No "Maximum X reached" message or counter for Priority Caller entries per D-09 (unlimited VIP entries is an explicit product decision).

## Deviations from Plan

### User-Requested Post-Verification Changes

**[User Request] Rename VIP→Priority + page rename + section reorder**
- **Found during:** Task 3 (visual re-verification checkpoint)
- **Issue:** User reviewed the built UI and requested three changes: (1) rename "VIP Callers"/"VIP Caller" to "Priority Callers"/"Priority Caller" throughout the UI; (2) rename the page heading from "Answer Your Own Calls" to "Call Routing"; (3) reorder the Priority Callers section to appear above the scheduled-forwarding card rather than below it.
- **Deviation from UI-SPEC:** 46-UI-SPEC.md Copywriting Contract specified "VIP Callers" as the section heading, "VIP Caller" as the toggle label, and "VIP" as the LeadCard badge text. Page structure in UI-SPEC placed the VIP section after the schedule cards. All these were changed per user direction.
- **DB/API unchanged:** `vip_numbers`, `is_vip`, and all API contract field names were preserved. Only user-facing copy and page layout were modified. The priority-flag pattern (DB stays vip_*, UI label is "Priority") is now established as a template for future features.
- **Files modified:** `src/app/dashboard/more/call-routing/page.js`, `src/components/dashboard/LeadCard.jsx`, `src/components/dashboard/LeadFlyout.jsx`, `src/app/dashboard/more/page.js`, `src/app/dashboard/more/ai-voice-settings/page.js`
- **Commit:** `daf6a79`

---

**Total deviations:** 1 user-requested post-verification change (not an auto-fix deviation)
**Impact on plan:** All functional requirements (VIP-09 through VIP-13) satisfied. Rename is purely cosmetic at the UI layer; no DB migration, no API change, no webhook change required.

## Issues Encountered

None beyond the post-verification rename request.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All three Phase 46 plans complete: data layer (01), webhook routing (02), dashboard UI (03)
- VIP/Priority caller routing is fully end-to-end: owner adds numbers on Call Routing page or toggles leads in flyout → stored in DB → webhook checks at call time → routes to owner phone
- No blockers for phase close-out

---
*Phase: 46-vip-caller-direct-routing*
*Completed: 2026-04-12*

## Self-Check: PASSED

Files verified present in codebase:
- `src/app/dashboard/more/call-routing/page.js` — modified (Tasks 1, follow-up)
- `src/components/dashboard/LeadCard.jsx` — modified (Task 2, follow-up)
- `src/components/dashboard/LeadFlyout.jsx` — modified (Task 2, follow-up)
- `src/app/dashboard/more/page.js` — modified (follow-up)

Commits referenced:
- `182191d` — Task 1: VIP Callers section on call routing page
- `b2a2799` — Task 2: VIP badge on LeadCard, VIP toggle in LeadFlyout
- `daf6a79` — Follow-up: VIP→Priority rename, page rename, section reorder

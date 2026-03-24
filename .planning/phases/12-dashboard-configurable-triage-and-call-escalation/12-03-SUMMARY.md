---
phase: 12-dashboard-configurable-triage-and-call-escalation
plan: 03
subsystem: ui
tags: [react, dnd-kit, drag-and-drop, shadcn, next-intl, escalation, dashboard, radio-group, alert-dialog]

# Dependency graph
requires:
  - phase: 12-01
    provides: "escalation_contacts table + full CRUD API at /api/escalation-contacts"
  - phase: 12-02
    provides: "@dnd-kit/sortable installed, radio-group.jsx shadcn component, services page with ZoneManager"
provides:
  - "EscalationChainSection component with DnD-sortable contacts and per-urgency mapping"
  - "ContactCard component with display/edit modes, AlertDialog remove, RadioGroup channel picker"
  - "Services page wired with EscalationChainSection below ZoneManager in both branches"
  - "i18n strings for services.escalation in en.json and es.json"
affects:
  - dashboard/services page (EscalationChainSection now renders below ZoneManager)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SortableContactWrapper pattern: useSortable inside EscalationChainSection, drag props passed to ContactCard"
    - "New contact flow: temporary negative ID, POST on save, replaces temp with real contact"
    - "Validation fires on Save only (not on mount) per RESEARCH.md Pitfall 5"

key-files:
  created:
    - src/components/dashboard/EscalationChainSection.js
    - src/components/dashboard/ContactCard.js
  modified:
    - src/app/dashboard/services/page.js
    - messages/en.json
    - messages/es.json

key-decisions:
  - "SortableContactWrapper defined inside EscalationChainSection — keeps drag logic co-located, ContactCard stays pure"
  - "New contact uses temporary negative ID counter — avoids useSortable ID conflict with persisted contacts"
  - "Per-urgency toggles are display-only indicators per RESEARCH.md (not persisted to DB)"
  - "isAddingNew flag disables Add Contact button while a new contact form is open — prevents stacking blank cards"

requirements-completed: [TRIAGE-CFG-02, TRIAGE-CFG-03]

# Metrics
duration: 20min
completed: 2026-03-23
---

# Phase 12 Plan 03: EscalationChainSection and ContactCard UI Summary

**EscalationChainSection with DnD-sortable contacts, per-urgency mapping rows, inline edit ContactCard, AlertDialog remove confirmation, and i18n in both en/es**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-03-23T21:57:29Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created `ContactCard.js` with display mode (name/role/timeout/channel badges, drag handle, remove button) and edit mode (inline form with Name, Role, Phone, Email, Wait time Select, Notify via RadioGroup, Save/Cancel)
- AlertDialog confirm for remove action with destructive red "Remove" button
- Validation fires on Save only: name required, phone required for SMS/Both, email required for Email/Both
- Created `EscalationChainSection.js` with full CRUD integration to `/api/escalation-contacts`
- Per-urgency mapping rows (Emergency locked ON, High-ticket ON, Routine OFF) with colored left borders
- DnD reorder using `@dnd-kit/sortable` with `SortableContactWrapper` pattern
- Empty state: Phone icon + heading + body + accent CTA
- Loading state: 3 Skeleton rows
- Save Chain button (PATCH) enabled only when `hasChanges=true`
- Wired EscalationChainSection into services page below ZoneManager in both empty-state and table branches
- Added `services.escalation` i18n namespace to `messages/en.json` (37 keys)
- Added `services.escalation` i18n namespace to `messages/es.json` with natural Spanish translations

## Task Commits

Each task was committed atomically:

1. **Task 1: Build EscalationChainSection and ContactCard components** - `62aeb69` (feat)
2. **Task 2: Wire EscalationChainSection into services page + add i18n strings** - `3f2ccc9` (feat)

## Files Created/Modified

- `src/components/dashboard/EscalationChainSection.js` — EscalationChainSection with DndContext, SortableContext, per-urgency mapping, empty state, CRUD handlers, Save Chain
- `src/components/dashboard/ContactCard.js` — ContactCard with display/edit toggle, AlertDialog remove, RadioGroup channel picker, form validation
- `src/app/dashboard/services/page.js` — Import + render EscalationChainSection after ZoneManager in both branches
- `messages/en.json` — Added services.escalation namespace with 37 i18n keys
- `messages/es.json` — Added services.escalation namespace with natural Spanish translations

## Decisions Made

- SortableContactWrapper wraps useSortable and passes drag props down to ContactCard — ContactCard stays clean and testable without needing the hook itself
- New contact creation uses a temporary negative ID counter — avoids DnD sortable ID collision with real contacts (which use positive integers from DB)
- Per-urgency toggles are visual indicators only (not persisted to DB) — matches RESEARCH.md decision that these are application constants
- Add Contact button is disabled while `isAddingNew=true` — prevents multiple blank cards stacking

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — all data flows through real API endpoints. EscalationChainSection fetches from `/api/escalation-contacts` on mount.

## Self-Check: PASSED

- `src/components/dashboard/EscalationChainSection.js` — FOUND
- `src/components/dashboard/ContactCard.js` — FOUND
- `src/app/dashboard/services/page.js` — modified with EscalationChainSection import and render
- `messages/en.json` — services.escalation namespace added
- `messages/es.json` — services.escalation namespace added (Spanish)
- Commits: 62aeb69 (Task 1), 3f2ccc9 (Task 2) — FOUND
- Build: `/dashboard/services` compiled successfully, no errors

---
*Phase: 12-dashboard-configurable-triage-and-call-escalation*
*Completed: 2026-03-23*

---
phase: 52-rename-leads-tab-to-jobs-and-restructure-status-pills-for-home-service-mental-model
plan: 03
subsystem: ui
tags: [chatbot, knowledge-base, copy-reframe, dashboard, jobs]

# Dependency graph
requires:
  - phase: 37-dashboard-ai-chatbot-assistant
    provides: chatbot knowledge RAG system with index.js route map and markdown corpus
provides:
  - Updated chatbot knowledge index.js with /dashboard/jobs route key and job/jobs keyword tags
  - Reframed chatbot markdown corpus (8 files) — all user-facing "Leads" noun replaced with "Jobs"
  - Pill enumeration in leads.md updated to new D-02 order (New, Scheduled, Completed, Paid, Lost)
affects: [52-01, 52-02, 52-04, 52-05, dashboard-crm-system skill]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Minimal-blast-radius content edit: file renamed in route map key only, markdown filename leads.md preserved"
    - "Legacy keyword back-compat: old 'lead'/'leads' keywords retained alongside new 'job'/'jobs' in KEYWORD_DOC_MAP"

key-files:
  created: []
  modified:
    - src/lib/chatbot-knowledge/index.js
    - src/lib/chatbot-knowledge/leads.md
    - src/lib/chatbot-knowledge/calendar.md
    - src/lib/chatbot-knowledge/calls.md
    - src/lib/chatbot-knowledge/call-routing.md
    - src/lib/chatbot-knowledge/estimates.md
    - src/lib/chatbot-knowledge/invoices.md
    - src/lib/chatbot-knowledge/getting-started.md

key-decisions:
  - "leads.md filename stays unchanged — only the ROUTE_DOC_MAP key changes from /dashboard/leads to /dashboard/jobs (D-10 minimal blast radius)"
  - "Legacy 'lead'/'leads' keywords retained in KEYWORD_DOC_MAP for owners who still type the old word"
  - "is_vip DB column reference preserved in call-routing.md prose (internal identifier, not user-facing noun)"
  - "Pill enumeration in leads.md updated to (New, Scheduled, Completed, Paid, Lost) matching D-02"

patterns-established:
  - "Copy-only reframe pattern: change user-facing nouns and URLs while preserving all DB identifiers, API paths, and code block content"

requirements-completed: [RENAME-01, RENAME-03]

# Metrics
duration: 25min
completed: 2026-04-16
---

# Phase 52 Plan 03: Chatbot Knowledge Corpus Reframe Summary

**Chatbot knowledge corpus reframed from "Leads" to "Jobs" across 8 files — route map key, keyword tags, all user-facing prose, and pill label order updated to match the Phase 52 UI rename**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-16T14:45:00Z
- **Completed:** 2026-04-16T14:10:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- `index.js` ROUTE_DOC_MAP now maps `/dashboard/jobs` → `leads.md` (old `/dashboard/leads` key removed); `job`/`jobs` keywords added to KEYWORD_DOC_MAP while legacy `lead`/`leads` retained for back-compat
- All 7 markdown files cleaned of every `/dashboard/leads` URL and user-facing "Lead/Leads/lead/leads" noun — replaced with "Job/Jobs/job/jobs" throughout
- `leads.md` pill enumeration updated from `(New, Booked, Completed, Paid, Lost)` to `(New, Scheduled, Completed, Paid, Lost)` matching D-02 status label rename

## Task Commits

Each task was committed atomically:

1. **Task 1: Update index.js — route map, keyword tags, JSDoc** - `7d91310` (feat)
2. **Task 2: Reframe 7 markdown files — Leads→Jobs noun + URL + new pill order** - `f089f32` (feat)

## Files Created/Modified

- `src/lib/chatbot-knowledge/index.js` — ROUTE_DOC_MAP key `/dashboard/leads` → `/dashboard/jobs`; added `'job'`, `'jobs'` to keyword tags; JSDoc example route updated
- `src/lib/chatbot-knowledge/leads.md` — H1, section prose, nav link, status pill list (Booked→Scheduled)
- `src/lib/chatbot-knowledge/calendar.md` — Related sections link + mark-complete task prose ("on the lead" → "on the job record")
- `src/lib/chatbot-knowledge/calls.md` — outcome description ("captured a lead" → "captured a job") + Related sections link
- `src/lib/chatbot-knowledge/call-routing.md` — Priority Callers feature description, how-to task prose (3 hits), Related sections link
- `src/lib/chatbot-knowledge/estimates.md` — Related sections link
- `src/lib/chatbot-knowledge/invoices.md` — intro prose, create-invoice task description, Related sections link
- `src/lib/chatbot-knowledge/getting-started.md` — all 4 occurrences reframed ("recent leads" × 2, Related sections link)

## Decisions Made

- `leads.md` filename preserved on disk — only the ROUTE_DOC_MAP key was changed. This is the minimal-blast-radius approach per D-10: the chatbot continues to load the same file, no file-system rename needed.
- Legacy `'lead'`/`'leads'` keywords retained in KEYWORD_DOC_MAP alongside new `'job'`/`'jobs'`. Owners who type "where are my leads?" still get the correct doc.
- `is_vip` in call-routing.md prose preserved as-is — it is a DB column identifier, not a user-facing noun.
- `/api/leads` backend paths not present in any of the 7 markdown files (confirmed by scan) — no preservation action needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 3 additional user-facing "lead" noun occurrences missed by the plan's hit-count estimate**

- **Found during:** Task 2 post-edit scan
- **Issue:** Plan estimated specific hit counts per file based on pre-execution grep. After targeted edits, a final `grep -rni "lead"` scan found 3 more user-facing noun hits the plan's count didn't cover: `calendar.md` ("on the lead"), `calls.md` ("captured a lead"), `invoices.md` ("from leads or from scratch")
- **Fix:** Reframed all 3 to job/jobs. Preserved `is_vip` DB identifier in call-routing.md as the one legitimate exception.
- **Files modified:** calendar.md, calls.md, invoices.md
- **Verification:** Final `grep -rni "lead"` across all .md files returns zero hits
- **Committed in:** f089f32 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug: incomplete substitution)
**Impact on plan:** Necessary for correctness — the plan's stated success criterion was zero user-facing "Lead/Leads/lead/leads" noun occurrences. No scope creep.

## Issues Encountered

- Git worktree `reset --soft` to target commit staged planning file deletions as a side effect. Resolved by selectively unstaging the planning files before committing, so the Task 1 commit contains only the intended `index.js` change.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Chatbot knowledge corpus is consistent with the Jobs UI rename. When Plans 01–02 ship the renamed sidebar nav, URL, and page, the chatbot answers will already say "Jobs" and deep-link to `/dashboard/jobs`.
- The `leads.md` filename mismatch (file is named "leads" but documents "Jobs") is a known acceptable state per D-10 — file rename would require updates to any direct `import`/`require` references elsewhere and is explicitly deferred.

---

## Known Stubs

None — all content is wired to production markdown files read at build time.

## Threat Flags

None — chatbot knowledge files are trusted-source markdown authored by the Voco team, bundled at build time. No new attack surface introduced (T-52-05 in plan threat register: accepted).

---

## Self-Check

**Files exist:**
- `src/lib/chatbot-knowledge/index.js` — modified, verified via Read
- `src/lib/chatbot-knowledge/leads.md` — modified, verified via Read
- All 6 other .md files — modified, verified via Read/Grep

**Commits exist:**
- `7d91310` — Task 1 (index.js)
- `f089f32` — Task 2 (7 markdown files)

**Zero `/dashboard/leads` in chatbot knowledge:** Confirmed via Grep (no matches)

**Zero user-facing "lead" noun in chatbot .md files:** Confirmed via Grep (no matches)

## Self-Check: PASSED

---
*Phase: 52-rename-leads-tab-to-jobs-and-restructure-status-pills-for-home-service-mental-model*
*Completed: 2026-04-16*

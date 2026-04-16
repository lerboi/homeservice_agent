---
phase: 52-rename-leads-tab-to-jobs
plan: 04
subsystem: ui
tags: [dashboard, copy-reframe, navigation, internal-links]

requires:
  - phase: 52-02
    provides: page lives at /dashboard/jobs (internal hrefs can now point to canonical URL)
provides:
  - Sidebar + bottom-tab nav labels reframed to "Jobs" with /dashboard/jobs hrefs
  - LeadFlyout, LeadFilterBar, EmptyStateLeads, HotLeadsTile copy reframed Lead → Job
  - 11 internal /dashboard/leads occurrences across 10 files updated to /dashboard/jobs
  - "View Lead" / "Back to Leads" / "Linked Lead" button copy reframed to Job equivalents
  - Search API result type-label is "Jobs", href points to /dashboard/jobs (internal type key 'leads' preserved per D-10)
  - Notification email dashboard link template uses /dashboard/jobs
  - DashboardTour selector + step content reframed
affects: [voice-call-architecture, dashboard-crm-system, public-site-i18n]

tech-stack:
  added: []
  patterns: ["Decoupling internal symbol names from user-facing copy: PIPELINE_STATUSES, STATUS_LABELS, type:'leads' all stay; only label fields change"]

key-files:
  created: []
  modified:
    - src/components/dashboard/LeadFlyout.jsx
    - src/components/dashboard/LeadFilterBar.jsx
    - src/components/dashboard/EmptyStateLeads.jsx
    - src/components/dashboard/HotLeadsTile.jsx
    - src/components/dashboard/DashboardSidebar.jsx
    - src/components/dashboard/BottomTabBar.jsx
    - src/components/dashboard/DashboardTour.jsx
    - src/components/dashboard/AppointmentFlyout.js
    - src/app/api/search/route.js
    - src/lib/notifications.js
    - src/app/dashboard/more/call-routing/page.js
    - src/app/dashboard/calls/page.js
    - src/app/dashboard/invoices/page.js
    - src/app/dashboard/invoices/batch-review/page.js
    - src/app/dashboard/invoices/[id]/page.js
    - src/app/dashboard/estimates/[id]/page.js

key-decisions:
  - "AlertDialog 'Mark this lead as Lost?' / 'This lead will be moved to Lost' reframed to 'job' (D-09 user-facing copy scope, not in plan's explicit table but implied by scope)"
  - "Search API: user-facing label 'Jobs' but internal type:'leads' field key preserved (D-10 — internal symbol)"
  - "Lost-button AlertDialog body, View-Lead buttons, Back-to-Leads buttons, Linked-Lead labels all reframed even though not in plan's explicit table — D-09 scope mandates all user-facing 'Lead(s)' surfaces"

patterns-established:
  - "Find-and-replace audit pattern: grep -rn '/dashboard/leads' src/ → zero hits is the canonical phase-completion check; the next.config.js redirect entry is the one allowed mention outside src/"

requirements-completed: [RENAME-01, RENAME-03]

duration: ~25min (initial subagent hit usage limit ~3 min in; orchestrator resumed inline and completed remaining work)
completed: 2026-04-17
---

# Phase 52: Wave 2 Sweep Summary

**Every user-facing "Lead(s)" string and every internal `/dashboard/leads` href across the dashboard surface is now reframed to "Job(s)" / `/dashboard/jobs`. Final repo-wide grep returns zero hits.**

## Performance

- **Duration:** ~25 min (subagent attempt + inline completion)
- **Tasks:** 2/2
- **Files modified:** 16

## Accomplishments
- All 11 `/dashboard/leads` occurrences in `src/` eliminated (the next.config.js redirect entry is the one allowed mention outside `src/`)
- 6 dashboard components reframed (Task 1)
- 10 internal-link files reframed (Task 2) — including button copy "View Lead" → "View Job", "Back to Leads" → "Back to Jobs", "Linked Lead" → "Linked Job"
- Internal symbols preserved per D-10: file names, component exports, `type: 'leads'` field key, DB columns (`lead_id`), local variables (`leadId`, `linkedLead.id`, `invoice.lead_id`, `estimate.lead_id`)

## Task Commits

1. **Task 1: Reframe user-facing copy in 6 dashboard components** — `cfd16db`
2. **Task 2: Internal href + URL audit batch across 10 files** — `a4c630a`

## Files Created/Modified

See `key-files.modified` above (16 files).

## Verification

```bash
$ grep -rn "/dashboard/leads" src/
(zero hits)
```

The 308 redirect in `next.config.js` (registered in Plan 02) is the one allowed remaining reference, ensuring legacy bookmarks/notifications still work.

## Notes

- Initial executor agent hit usage limit early in Task 1 with no commits made; the file edits made in the worktree were preserved in the main working tree (the agent edited files at absolute paths). Orchestrator resumed inline, completed Task 1 (with the AlertDialog text addition that was implied by D-09 scope but not in the explicit table), and executed Task 2 in full.
- Concurrent Phase 53 commits appeared on main during execution; they touch different files and did not conflict with Phase 52 work.

---
phase: 59-customer-job-model-separation
plan: "06"
subsystem: dashboard-ui
status: complete
tasks_complete: 3
tasks_total: 3
tags: [phase-59, wave-3, dashboard, ui, realtime, chatbot-corpus, jobs, inquiries]

dependency_graph:
  requires:
    - phase: 59-customer-job-model-separation
      plan: "04"
      provides: "/api/jobs, /api/inquiries routes (push-deferred; UI wiring is correct code)"
  provides:
    - "/dashboard/jobs rewritten to query /api/jobs + jobs Realtime channel"
    - "/dashboard/inquiries new tab with Inquiry components + inquiries Realtime channel"
    - "JobStatusPills: scheduled/completed/paid/lost/cancelled (D-09 + Phase 52 Lost-gap)"
    - "InquiryStatusPills: open/converted/lost (D-09 + Phase 52 Lost-gap)"
    - "DashboardSidebar + BottomTabBar: Inquiries nav item added (D-08)"
    - "Chatbot corpus split: customers.md + jobs.md + inquiries.md (D-07a documented)"
  affects:
    - "59-07 (Customer detail + flyouts: reads JobCard/InquiryCard patterns)"
    - "59-08 (cleanup: Plan 08 deletes LeadCard/LeadFilterBar/LeadStatusPills/EmptyStateLeads/HotLeadsTile)"

tech-stack:
  added: []
  patterns:
    - "Job* components cloned from Lead* — same visual treatment, new data shape (job.customer.name, job.appointment.start_time)"
    - "Inquiry* components cloned from Job* — no appointment row; D-07a no-staleness invariant enforced"
    - "Realtime: channel('jobs-realtime').on('postgres_changes', {table: 'jobs', filter: 'tenant_id=eq.<uuid>'})"
    - "Realtime: channel('inquiries-realtime').on('postgres_changes', {table: 'inquiries', filter: 'tenant_id=eq.<uuid>'})"
    - "EmptyState: uses shared <EmptyState> primitive from ui/empty-state.jsx (Phase 58 POLISH-01)"

key-files:
  created:
    - "src/app/dashboard/inquiries/page.js"
    - "src/components/dashboard/JobCard.jsx"
    - "src/components/dashboard/JobFilterBar.jsx"
    - "src/components/dashboard/JobStatusPills.jsx"
    - "src/components/dashboard/EmptyStateJobs.jsx"
    - "src/components/dashboard/HotJobsTile.jsx"
    - "src/components/dashboard/InquiryCard.jsx"
    - "src/components/dashboard/InquiryFilterBar.jsx"
    - "src/components/dashboard/InquiryStatusPills.jsx"
    - "src/components/dashboard/EmptyStateInquiries.jsx"
    - "src/lib/chatbot-knowledge/customers.md"
    - "src/lib/chatbot-knowledge/jobs.md"
    - "src/lib/chatbot-knowledge/inquiries.md"
  modified:
    - "src/app/dashboard/jobs/page.js — fetches /api/jobs, Realtime on jobs table"
    - "src/components/dashboard/DashboardSidebar.jsx — Inquiries nav item added"
    - "src/components/dashboard/BottomTabBar.jsx — Inquiries tab added, Calendar demoted"
    - "tests/realtime/jobs.test.js — converted from vitest scaffold to active Jest tests (5 tests)"

key-decisions:
  - "JobCard customer.name links to /dashboard/customers/{id} — UI-SPEC navigation rule"
  - "BottomTabBar: Calendar demoted to More overflow; Inquiries added as 5th tab"
  - "Realtime test uses Jest mocks (not live DB) — migrations push-deferred until Plan 08"
  - "InquiryFlyout stubbed with console.debug — Plan 07 ships the real flyout"
  - "LeadFlyout preserved on Jobs page until Plan 07 ships JobFlyout"
  - "Legacy Lead* components (LeadCard/LeadFilterBar etc.) preserved — Plan 08 deletes"

metrics:
  duration: "~1 session"
  completed: "2026-04-21"
  tasks_completed: 3
  files_created: 13
  files_modified: 4
---

# Phase 59 Plan 06: Jobs Tab Rewrite + Inquiries Tab + Chatbot Corpus Split Summary

Jobs tab rewritten to source from `/api/jobs` + `jobs` Realtime channel; new `/dashboard/inquiries` tab with full Inquiry component set and `inquiries` Realtime channel; sidebar and bottom tab bar updated with Inquiries nav item; chatbot corpus split into customers/jobs/inquiries with D-07a owner-responsibility stance documented.

## Performance

- **Duration:** ~1 session
- **Completed:** 2026-04-21
- **Tasks complete:** 3 of 3
- **Files created:** 13
- **Files modified:** 4

## What Was Built

### Task 1: Jobs Tab Rewrite + Job* Components

| File | Purpose |
|------|---------|
| `src/app/dashboard/jobs/page.js` | Rewritten: fetches `/api/jobs`, Realtime on `jobs` table with `tenant_id=eq.<uuid>` filter |
| `src/components/dashboard/JobStatusPills.jsx` | 5 pills: scheduled/completed/paid/lost/cancelled; both lost+cancelled carry `ml-2` gap |
| `src/components/dashboard/JobCard.jsx` | Jobs data shape; customer.name links to `/dashboard/customers/{id}` |
| `src/components/dashboard/JobFilterBar.jsx` | Preserves all filter controls; status enum swapped to jobs statuses |
| `src/components/dashboard/EmptyStateJobs.jsx` | UI-SPEC copy verbatim; filtered variant with `SearchX` icon |
| `src/components/dashboard/HotJobsTile.jsx` | Dashboard tile; queries jobs with urgency=emergency + status=scheduled |
| `tests/realtime/jobs.test.js` | 5 Jest tests; validates `jobs` table subscription, cross-tenant filter, D-02a invariant |

### Task 2: New Inquiries Tab + Navigation (D-07a, D-08, D-09, D-15)

| File | Purpose |
|------|---------|
| `src/app/dashboard/inquiries/page.js` | New page: `/api/inquiries`, Realtime on `inquiries` table, default filter=open |
| `src/components/dashboard/InquiryStatusPills.jsx` | 3 pills: open/converted/lost; lost carries `ml-2` |
| `src/components/dashboard/InquiryCard.jsx` | Inquiry data shape; no appointment row; no staleness UI (D-07a) |
| `src/components/dashboard/InquiryFilterBar.jsx` | Clone of JobFilterBar; no Stale preset (D-07a) |
| `src/components/dashboard/EmptyStateInquiries.jsx` | UI-SPEC copy; PhoneIncoming icon |
| `src/components/dashboard/DashboardSidebar.jsx` | Inquiries added below Jobs; PhoneIncoming icon |
| `src/components/dashboard/BottomTabBar.jsx` | Inquiries tab added (see demotion decision below) |

### Task 3: Chatbot Corpus Split

| File | Purpose |
|------|---------|
| `src/lib/chatbot-knowledge/customers.md` | Customer entity, phone dedup, merge/undo, navigation |
| `src/lib/chatbot-knowledge/jobs.md` | Job lifecycle, filter/find, invoice, batch-create, Kanban-absent note |
| `src/lib/chatbot-knowledge/inquiries.md` | Inquiry lifecycle, Convert to Job, Mark as Lost; **Stale inquiries section documents D-07a** |

## BottomTabBar Demotion Decision

**Situation:** Current BottomTabBar had exactly 5 tabs (Home, Calls, Jobs, Calendar, More). Adding Inquiries would create 6, exceeding the mobile-safe visible limit.

**Demoted tab:** Calendar (`/dashboard/calendar`, `Calendar` icon)

**Reason:** Calendar is the lowest-frequency tap for a typical service owner. Owners check Jobs and Inquiries daily as part of their workflow; Calendar is a planning tool consulted less often. Calendar remains fully accessible via:
1. The **sidebar** (desktop) — Calendar entry unchanged
2. **More** (mobile) — the More tab leads to all settings and secondary pages

**New BottomTabBar order:** Home | Calls | Jobs | Inquiries | More

## Deviations from Plan

### [Rule 1 - Bug] Realtime test self-referential mock initialization

- **Found during:** Task 1 test run
- **Issue:** `mockChannel.subscribe: jest.fn().mockReturnValue(mockChannel)` caused a `ReferenceError: Cannot access 'mockChannel' before initialization` — JS `const` declarations are not hoisted with their value.
- **Fix:** Separated mock declaration from `mockReturnValue` wiring; `beforeEach` now wires up `mockSupabase.channel.mockReturnValue(mockChannel)` after mocks are initialized.
- **Files modified:** `tests/realtime/jobs.test.js`
- **Commit:** `2b1b433`

### [Rule 3 - Blocking] Vitest vs Jest framework in scaffold

- **Found during:** Task 1 (reading existing test file)
- **Issue:** `tests/realtime/jobs.test.js` used `import { describe, it } from 'vitest'` but the project uses Jest. Same issue resolved in Plan 04 for API tests.
- **Fix:** Rewrote test file using `@jest/globals` following existing Jest test patterns.
- **Files modified:** `tests/realtime/jobs.test.js`
- **Commit:** `2b1b433`

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| InquiryFlyout stub (`console.debug('Plan 07 InquiryFlyout open', inquiryId)`) | `src/app/dashboard/inquiries/page.js:219` | Plan 07 ships the real InquiryFlyout; clicking a row logs to console but doesn't open a sheet |
| LeadFlyout on Jobs page | `src/app/dashboard/jobs/page.js` | Plan 07 ships JobFlyout; LeadFlyout preserved as interim |
| HotJobsTile falls back to `newLeadsCount`/`newLeadsPreview` | `src/components/dashboard/HotJobsTile.jsx` | `/api/dashboard/stats` not yet updated for `hotJobsCount`/`hotJobsPreview` shape; fallback ensures tile renders |

These stubs do not block the plan goal (Jobs tab reads from jobs, Inquiries tab exists and renders) but are flagged for Plan 07/08 to wire fully.

## Threat Surface Scan

No new network endpoints introduced in this plan (UI only). New Realtime subscriptions:
- `jobs` table channel — scoped by `tenant_id=eq.<uuid>` (T-59-06-01 mitigation applied; test asserts cross-tenant filter exactness)
- `inquiries` table channel — same filter pattern

No new file access patterns. No schema changes (migrations are push-deferred from Plan 02/03).

All plan `<threat_model>` mitigations applied:

| Threat ID | Mitigation Status |
|-----------|-------------------|
| T-59-06-01 | Explicit `filter: 'tenant_id=eq.<uuid>'` in both jobs + inquiries Realtime subscriptions; test asserts exact filter string |
| T-59-06-02 | grep-verified: zero `/api/leads` functional references in new page files |
| T-59-06-03 | Accepted: corpus serves owner-facing docs |
| T-59-06-04 | Accepted: React auto-escapes interpolated text |
| T-59-06-05 | grep-verified: zero functional staleness code in inquiry files (all matches are prohibition comments) |

## Self-Check: PASSED

Files verified:
- FOUND: `src/app/dashboard/jobs/page.js`
- FOUND: `src/app/dashboard/inquiries/page.js`
- FOUND: `src/components/dashboard/JobCard.jsx`
- FOUND: `src/components/dashboard/JobFilterBar.jsx`
- FOUND: `src/components/dashboard/JobStatusPills.jsx`
- FOUND: `src/components/dashboard/EmptyStateJobs.jsx`
- FOUND: `src/components/dashboard/HotJobsTile.jsx`
- FOUND: `src/components/dashboard/InquiryCard.jsx`
- FOUND: `src/components/dashboard/InquiryFilterBar.jsx`
- FOUND: `src/components/dashboard/InquiryStatusPills.jsx`
- FOUND: `src/components/dashboard/EmptyStateInquiries.jsx`
- FOUND: `src/lib/chatbot-knowledge/customers.md`
- FOUND: `src/lib/chatbot-knowledge/jobs.md`
- FOUND: `src/lib/chatbot-knowledge/inquiries.md`

Commits verified:
- FOUND: `2b1b433` (Task 1: Jobs tab rewrite)
- FOUND: `5b05323` (Task 2: Inquiries tab + nav)
- FOUND: `e3e6517` (Task 3: Chatbot corpus)

Test counts verified:
- `tests/realtime/jobs.test.js`: 5 tests, 0 skipped, PASSED
- D-07a: zero functional staleness code in inquiry files (confirmed by grep)

---
*Phase: 59-customer-job-model-separation-split-leads-into-customers-ded*
*Plan 06 status: complete*
*Last updated: 2026-04-21*

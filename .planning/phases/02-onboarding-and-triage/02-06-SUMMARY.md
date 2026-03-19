---
phase: 02-onboarding-and-triage
plan: 06
subsystem: dashboard-services
tags: [services, triage, dashboard, crud-api, tdd, i18n, ui]
dependency_graph:
  requires: [02-01, 02-03]
  provides: [services-crud-api, service-manager-page, working-hours-stub]
  affects: [dashboard-layout, services-table]
tech_stack:
  added: [shadcn-select, shadcn-separator, shadcn-skeleton, sonner-toast]
  patterns: [tdd-red-green, optimistic-update, soft-delete, undo-toast]
key_files:
  created:
    - src/app/api/services/route.js
    - src/app/dashboard/services/page.js
    - src/app/dashboard/layout.js
    - tests/onboarding/services.test.js
  modified:
    - supabase/migrations/002_onboarding_triage.sql
    - messages/en.json
    - messages/es.json
    - src/components/ui/select.jsx
    - src/components/ui/separator.jsx
    - src/components/ui/skeleton.jsx
decisions:
  - "Soft-delete uses update({ is_active: false }) — no hard DELETE to preserve audit trail"
  - "Undo toast schedules DELETE after 4.1s (100ms buffer over toast duration) to ensure undo window works"
  - "Optimistic tag update reverts on API error for consistent UX"
  - "Working hours column is nullable jsonb with no default — full config deferred to Phase 3 per CONTEXT.md"
  - "Dashboard layout is single-column with breadcrumb — sidebar nav deferred to Phase 4"
metrics:
  duration: 8min
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_created: 6
  files_modified: 6
key_decisions:
  - "Soft-delete via is_active=false preserves call history and audit trail"
  - "Undo toast at 4s with 100ms DELETE buffer ensures undo never races the API call"
  - "Working hours jsonb nullable stub satisfies ONBOARD-03 schema requirement; full UI in Phase 3"
---

# Phase 2 Plan 06: Service Manager Dashboard Summary

**One-liner:** Services CRUD API with tenant-scoped auth plus dashboard page with urgency tag dropdowns, optimistic updates, undo toast, and working hours Coming Soon stub.

---

## What Was Built

### Task 1: Services CRUD API + Migration Stub (TDD)

**14 tests written and passing.** RED-GREEN cycle followed.

- `GET /api/services` — returns active services for authenticated tenant ordered by created_at
- `POST /api/services` — creates service; validates name (non-empty) and urgency_tag (emergency/routine/high_ticket)
- `PUT /api/services` — updates urgency_tag for service owned by tenant
- `DELETE /api/services` — soft-deletes by setting `is_active=false` (no hard DELETE)
- All endpoints return 401 if `auth.getUser()` returns no user or no `tenant_id` in metadata
- `supabase/migrations/002_onboarding_triage.sql` extended with `ALTER TABLE tenants ADD COLUMN working_hours jsonb` (ONBOARD-03 stub)

### Task 2: Service Manager Dashboard Page

- `src/app/dashboard/layout.js` — minimal single-column layout with breadcrumb nav; white card with `rounded-xl shadow-sm border` on `slate-50` background
- `src/app/dashboard/services/page.js` — full client component featuring:
  - Skeleton loading state during GET fetch
  - Empty state with "Add your first service" CTA (blue-600)
  - Service table with columns: Service Name | Urgency Tag (Badge + Select) | Actions (X button)
  - Emergency: `bg-red-100 text-red-700`, Routine: `bg-slate-100 text-slate-600`, High-Ticket: `bg-amber-100 text-amber-700`
  - Inline add row appears at bottom on "Add service" click; Enter confirms, Escape cancels, blur confirms
  - Tag change → optimistic update → PUT API → success toast or revert on error
  - Remove → immediate UI removal → 4s undo toast (sonner action button) → DELETE called after toast expires
  - Working hours Coming Soon stub below Separator (satisfies ONBOARD-03)
  - All copy via `useTranslations('services')`
- `messages/en.json` and `messages/es.json` extended with `"services"` namespace (17 keys)
- Added shadcn components: `select`, `separator`, `skeleton`

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Self-Check

**Files exist:**
- `src/app/api/services/route.js` — FOUND
- `src/app/dashboard/services/page.js` — FOUND
- `src/app/dashboard/layout.js` — FOUND
- `tests/onboarding/services.test.js` — FOUND
- `supabase/migrations/002_onboarding_triage.sql` contains `working_hours jsonb` — FOUND

**Commits:**
- `4f63e77` — feat(02-06): services CRUD API — FOUND
- `77771de` — feat(02-06): service manager dashboard page — FOUND

**Tests:** 14/14 passing

**Build:** Succeeds — `/dashboard/services` appears in route table

## Self-Check: PASSED

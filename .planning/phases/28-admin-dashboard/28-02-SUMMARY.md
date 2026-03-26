---
phase: 28-admin-dashboard
plan: 02
subsystem: ui
tags: [admin, shadcn, papaparse, supabase, next-js, inventory]

requires:
  - phase: 28-01
    provides: verifyAdmin helper, admin_users table, middleware admin gate, shadcn Table, papaparse

provides:
  - Admin layout with navy header (#0F1F3D), ADMIN badge, top-tab navigation (Phone Inventory + Tenants tabs)
  - /admin/page.js redirect to /admin/inventory
  - /api/admin/inventory: GET (paginated+searchable), POST (add+validate SG format), PATCH (retire/reactivate)
  - /api/admin/inventory/bulk: POST (CSV bulk insert with per-number validation and partial failure reporting)
  - Phone inventory management page with full CRUD, CSV import, status badges, AlertDialog confirmations

affects: [28-03-tenants, admin-dashboard-auth]

tech-stack:
  added: [papaparse, shadcn/table]
  patterns:
    - verifyAdmin() called at top of every /api/admin/* route handler for authorization
    - Service-role supabase client used for all phone_inventory operations (bypasses RLS)
    - +65 prefix normalization on both client (UI) and server (API) for SG number handling
    - Inline error display (not toast) for duplicate number — per UI-SPEC contract

key-files:
  created:
    - src/app/admin/layout.js
    - src/app/admin/page.js
    - src/app/admin/inventory/page.js
    - src/app/api/admin/inventory/route.js
    - src/app/api/admin/inventory/bulk/route.js
    - src/lib/admin.js
    - src/app/admin/forbidden/page.js
    - supabase/migrations/012_admin_users.sql
    - src/components/ui/table.jsx
  modified:
    - src/middleware.js
    - package.json
    - package-lock.json

key-decisions:
  - "Admin layout uses top-tab navigation (not sidebar) to differentiate admin from tenant context"
  - "Bulk import uses individual inserts per number to handle partial duplicates gracefully"
  - "Duplicate number shows inline error text (not toast) per UI-SPEC copywriting contract"

patterns-established:
  - "verifyAdmin() guard at top of all /api/admin/* route handlers"
  - "SG number normalization: prepend +65 if absent, validate /^+65\\d{8}$/"
  - "Admin layout: bg-[#0F1F3D] header, ADMIN badge with bg-[#1D4ED8], top-tab nav"

requirements-completed: [SC-2, SC-3]

duration: 25min
completed: 2026-03-26
---

# Phase 28 Plan 02: Admin Dashboard — Layout and Phone Inventory Summary

**Navy admin shell with top-tab nav, full phone inventory CRUD (add/retire/reactivate), and bulk CSV import with client-side preview using papaparse**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-26
- **Completed:** 2026-03-26
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Admin layout with distinctive navy header (#0F1F3D), ADMIN badge, Phone Inventory + Tenants top-tab navigation, and sign-out button
- Inventory API routes: paginated GET with tenant join, POST with +65 normalization and validation, PATCH retire/reactivate, bulk POST with per-number error reporting
- Phone inventory page: add-number form (+65 prefix span), bulk CSV import with papaparse preview table, status badges (blue/green/slate), AlertDialog confirmations with exact UI-SPEC copy, pagination (25/page), search, skeleton loading, empty state

## Task Commits

1. **Task 1: Admin layout, nav tabs, inventory CRUD + bulk API routes** - `7d59cbd` (feat)
2. **Task 2: Phone inventory management page UI** - `7955c4a` (feat)

## Files Created/Modified

- `src/app/admin/layout.js` - Client component, navy header with ADMIN badge, top-tab navigation
- `src/app/admin/page.js` - Redirect to /admin/inventory
- `src/app/admin/inventory/page.js` - Full inventory page with add form, CSV import, table, actions
- `src/app/api/admin/inventory/route.js` - GET (paginated), POST (add), PATCH (retire/reactivate)
- `src/app/api/admin/inventory/bulk/route.js` - POST bulk CSV import with validation
- `src/lib/admin.js` - verifyAdmin() helper for API route authorization (auto-fix)
- `src/app/admin/forbidden/page.js` - 403 Access Denied page (auto-fix)
- `supabase/migrations/012_admin_users.sql` - admin_users table with RLS (auto-fix)
- `src/components/ui/table.jsx` - shadcn Table component (auto-fix)
- `src/middleware.js` - Extended with /admin/* gate using admin_users check (auto-fix)
- `package.json` + `package-lock.json` - papaparse added (auto-fix)

## Decisions Made

- Admin layout uses top-tab navigation (not sidebar) to visually differentiate admin from tenant context
- Bulk import inserts numbers individually rather than batch to handle partial duplicate failures gracefully with per-number error reporting
- Duplicate number shows inline error text beneath the input (not a toast) per UI-SPEC copywriting contract

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan 28-01 foundation artifacts missing**
- **Found during:** Task 1 (admin layout and API routes)
- **Issue:** Plan 28-02 depends on 28-01, but 28-01 was never executed. Missing: `src/lib/admin.js`, `supabase/migrations/012_admin_users.sql`, `src/components/ui/table.jsx`, papaparse, middleware admin gate, and `src/app/admin/forbidden/page.js`
- **Fix:** Created all 28-01 artifacts before proceeding with 28-02 tasks: migration, verifyAdmin helper, forbidden page, table component, papaparse install, and middleware admin gate
- **Files modified:** src/lib/admin.js, src/middleware.js, src/app/admin/forbidden/page.js, supabase/migrations/012_admin_users.sql, src/components/ui/table.jsx, package.json, package-lock.json
- **Verification:** All missing files present, middleware contains isAdminPath logic, verifyAdmin exports correctly
- **Committed in:** 7d59cbd (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking dependency)
**Impact on plan:** Auto-fix was essential — without the 28-01 foundation, no admin API route could be secured and no table UI could render. No scope creep.

## Issues Encountered

None beyond the missing 28-01 dependency, which was resolved via auto-fix.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Admin layout and phone inventory management fully operational
- verifyAdmin() pattern established for use in Plan 28-03 (Tenant Management page)
- phone_inventory CRUD API ready; bulk CSV import allows pre-loading SG numbers before user signups
- Plan 28-03 can build the Tenants management page using the same admin layout, verifyAdmin helper, and shadcn Table component

---
*Phase: 28-admin-dashboard*
*Completed: 2026-03-26*

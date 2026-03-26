---
phase: 28-admin-dashboard
plan: 01
subsystem: auth
tags: [supabase, middleware, rls, postgres, admin, papaparse, shadcn]

# Dependency graph
requires:
  - phase: 22-billing-foundation
    provides: subscriptions table and Stripe billing foundation
  - phase: 27-country-aware-onboarding-and-number-provisioning
    provides: phone_inventory tables, migration 011 naming reference

provides:
  - admin_users table with RLS self-read policy (migration 012)
  - Middleware admin gate for /admin/* routes with admin_users lookup
  - verifyAdmin() helper for API route authorization
  - 403 forbidden page at /admin/forbidden
  - papaparse dependency installed
  - shadcn Table component installed

affects:
  - 28-admin-dashboard (plans 02, 03, 04 — all depend on admin gate and verifyAdmin)
  - auth-database-multitenancy skill

# Tech tracking
tech-stack:
  added:
    - papaparse (CSV parsing for Plan 28-02 bulk import)
    - shadcn Table component (for Plans 28-02 and 28-03 inventory/tenant tables)
  patterns:
    - Admin gate in middleware with early return to bypass tenant/onboarding logic
    - verifyAdmin() pattern: session client for auth.getUser(), service-role for admin_users lookup

key-files:
  created:
    - supabase/migrations/012_admin_users.sql
    - src/lib/admin.js
    - src/app/admin/forbidden/page.js
    - src/components/ui/table.jsx
  modified:
    - src/middleware.js
    - package.json
    - package-lock.json
    - .claude/skills/auth-database-multitenancy/SKILL.md

key-decisions:
  - "Admin gate returns early from middleware after successful check — admins may not have a tenants row, early return prevents onboarding redirect"
  - "admin_users has no INSERT/UPDATE/DELETE RLS policies — all admin user management via service_role CLI/direct DB (intentional, prevents self-escalation)"
  - "admin_users SELECT policy uses auth.uid() = user_id (not tenant_id pattern) — admin_users is a platform-level table, not tenant-scoped"
  - "verifyAdmin uses service-role client for admin_users lookup (not anon key session client) — consistent behavior independent of RLS changes"
  - "403 rewrite (not redirect) for non-admin authenticated users — URL stays at attempted path for better UX"

patterns-established:
  - "Admin API route authorization: const adminUser = await verifyAdmin(); if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });"
  - "Bootstrap admin user: INSERT INTO admin_users (user_id, role) VALUES ('<auth.users UUID>', 'admin') via Supabase CLI"

requirements-completed: [SC-1, SC-5]

# Metrics
duration: 9min
completed: 2026-03-26
---

# Phase 28 Plan 01: Admin Foundation Summary

**admin_users migration with RLS self-read policy, middleware admin gate with 403 rewrite, and verifyAdmin() helper enabling all subsequent admin plans**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-26T11:25:35Z
- **Completed:** 2026-03-26T11:35:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Created `012_admin_users.sql` migration: admin_users table with user_id FK to auth.users, role column, RLS enabled, self-read SELECT policy for middleware to check admin status
- Extended `src/middleware.js` with admin gate: checks admin_users after getUser(), rewrites to /admin/forbidden for non-admins, returns early after admin verification to skip tenant/onboarding logic
- Created `src/lib/admin.js` with `verifyAdmin()` helper: uses session client for auth + service-role for admin_users check; returns user object if admin, null otherwise
- Created `/admin/forbidden` 403 page with correct copy per UI-SPEC
- Installed papaparse (CSV parsing for Plan 28-02 bulk import)
- Installed shadcn Table component (for Plans 28-02 and 28-03 tables)
- Updated auth-database-multitenancy skill with all new additions (migration 012, admin gate pattern, verifyAdmin helper, table reference)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create admin_users migration, install dependencies, add shadcn Table** - `8889bb3` (feat)
2. **Task 2: Extend middleware with admin gate, create verifyAdmin helper, create 403 forbidden page** - `ce43b3f` (feat)
3. **Task 3: Update auth-database-multitenancy skill** - `e1830a7` (docs)

## Files Created/Modified

- `supabase/migrations/012_admin_users.sql` - admin_users table with RLS self-read policy
- `src/middleware.js` - Extended with admin gate block, /admin added to AUTH_REQUIRED_PATHS and matcher
- `src/lib/admin.js` - verifyAdmin() helper for /api/admin/* route authorization
- `src/app/admin/forbidden/page.js` - 403 page with "Access Denied" copy per UI-SPEC
- `src/components/ui/table.jsx` - shadcn Table component (installed via npx shadcn@latest add table)
- `package.json` - papaparse added to dependencies
- `package-lock.json` - Updated lockfile
- `.claude/skills/auth-database-multitenancy/SKILL.md` - Updated with 012 migration, admin gate, verifyAdmin docs

## Decisions Made

- Admin gate returns early (`return response`) after successful admin check — admins bypass tenant/onboarding redirect logic since they may not have a `tenants` row
- No INSERT/UPDATE/DELETE policies on admin_users — self-escalation prevention; all admin bootstrapping via service_role CLI
- 403 uses `NextResponse.rewrite` (not redirect) — URL stays at attempted path for better UX
- verifyAdmin uses service-role client for admin_users lookup to ensure consistent behavior

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

To bootstrap the first admin user, run via Supabase CLI after applying migration 012:

```sql
INSERT INTO admin_users (user_id, role)
VALUES ('<auth.users UUID for your admin account>', 'admin');
```

No environment variables required for this plan.

## Next Phase Readiness

- admin_users migration ready to apply to Supabase project
- Middleware admin gate fully functional — /admin/* routes gated
- verifyAdmin() helper ready for use in Plans 28-02 and 28-03 API routes
- papaparse and shadcn Table installed and available for Plans 28-02 and 28-03

---
*Phase: 28-admin-dashboard*
*Completed: 2026-03-26*

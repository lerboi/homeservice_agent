---
phase: 28-admin-dashboard
plan: 03
subsystem: ui
tags: [admin, supabase, next-intl, shadcn, impersonation, provisioning]

# Dependency graph
requires:
  - phase: 28-admin-dashboard/28-01
    provides: verifyAdmin() helper, admin_users table, admin middleware gate
  - phase: 27-country-aware-onboarding-and-number-provisioning
    provides: assign_sg_number RPC, provisioning_failed flag on tenants, phone_inventory table

provides:
  - GET /api/admin/tenants: paginated tenant list with subscription join (is_current filter), search support
  - PATCH /api/admin/tenants/[id]: toggle provisioning_failed flag
  - POST /api/admin/tenants/[id]: trigger SG re-provisioning via assign_sg_number RPC
  - Tenant overview page at /admin/tenants with full table, search, pagination
  - Admin impersonation flow: "View as" button navigates to /dashboard?impersonate={id}&impersonate_name={name}
  - ImpersonationBanner component: sticky amber banner shown when admin views tenant dashboard
  - Dashboard layout supports read-only impersonation mode (pointer-events-none opacity-60)
  - dashboard-crm-system skill updated with impersonation documentation

affects:
  - 28-admin-dashboard (plan 02 — admin layout — will provide the nav header that wraps /admin/tenants)
  - dashboard-crm-system skill
  - auth-database-multitenancy skill (subscriptions join pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Impersonation via query params: impersonate={tenant_id}&impersonate_name={business_name} — avoids extra API call"
    - "Suspense wrapper for useSearchParams(): DashboardLayout exports Suspense wrapping DashboardLayoutInner"
    - "Admin re-provisioning does NOT call Retell/Twilio — assigns inventory number only, agent association is manual"
    - "pointer-events-none opacity-60 wrapper disables all dashboard interactions during impersonation"

key-files:
  created:
    - src/app/api/admin/tenants/route.js
    - src/app/api/admin/tenants/[id]/route.js
    - src/app/admin/tenants/page.js
    - src/app/dashboard/ImpersonationBanner.js
  modified:
    - src/app/dashboard/layout.js
    - .claude/skills/dashboard-crm-system/SKILL.md

key-decisions:
  - "Admin re-provisioning (POST /api/admin/tenants/[id]) does NOT call Retell/Twilio — only assigns SG number from inventory. Retell agent association is a separate operational step."
  - "Tenant name passed in impersonate_name query param to avoid an extra API call from dashboard layout"
  - "ImpersonationBanner rendered OUTSIDE the pointer-events-none wrapper so Exit Impersonation stays clickable"
  - "Dashboard layout wrapped in Suspense boundary to satisfy Next.js useSearchParams() requirement"

patterns-established:
  - "Impersonation pattern: admin page pushes to /dashboard?impersonate={id}&impersonate_name={name}; layout reads params and renders banner + disables all interactions"

requirements-completed: [SC-4]

# Metrics
duration: 20min
completed: 2026-03-26
---

# Phase 28 Plan 03: Tenant Overview, Impersonation, and Re-Provisioning Summary

**Tenant management page with full subscription data table, admin impersonation (View as), provisioning_failed toggle, SG re-provisioning trigger, and amber read-only banner in dashboard layout**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-26T11:30:00Z
- **Completed:** 2026-03-26T11:50:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Built paginated tenant API (GET with subscription join, search by business/owner name, is_current filter)
- Built per-tenant API (PATCH for provisioning_failed toggle, POST for SG re-provisioning via assign_sg_number RPC)
- Tenant overview page with all 9 columns, Switch confirmations, re-provisioning trigger, impersonation nav
- ImpersonationBanner component (sticky amber, h-11, Eye icon, Exit Impersonation link)
- Dashboard layout modified to read impersonate/impersonate_name query params and render read-only mode
- dashboard-crm-system skill updated with impersonation documentation

## Task Commits

1. **Task 1: Tenant API routes** - `3365e5a` (feat)
2. **Task 2: Tenant page, impersonation banner, dashboard layout, skill update** - `577900a` (feat)

## Files Created/Modified
- `src/app/api/admin/tenants/route.js` - GET handler: paginated tenant list with subscription join
- `src/app/api/admin/tenants/[id]/route.js` - PATCH (toggle provisioning_failed) + POST (SG re-provisioning)
- `src/app/admin/tenants/page.js` - Tenant overview table with search, pagination, impersonation, provisioning actions
- `src/app/dashboard/ImpersonationBanner.js` - Amber sticky banner for admin read-only view
- `src/app/dashboard/layout.js` - Added useSearchParams, ImpersonationBanner, pointer-events-none wrapper, Suspense
- `.claude/skills/dashboard-crm-system/SKILL.md` - Impersonation banner and layout changes documented

## Decisions Made
- Admin re-provisioning (POST) only assigns the SG number from inventory — no Retell/Twilio calls. Retell agent association is a separate manual step (consistent with note in plan).
- Tenant name passed via impersonate_name query param to dashboard to avoid an additional API call from the layout.
- ImpersonationBanner lives OUTSIDE the pointer-events-none div so the Exit Impersonation button stays interactive.
- Suspense boundary added around DashboardLayoutInner for Next.js useSearchParams() compatibility.

## Deviations from Plan

None — plan executed exactly as written. The main deviation risk was the Suspense boundary pattern, which was already specified in the plan (step 3e of Task 2 action). All 9 columns, exact copy from UI-SPEC, and all interaction patterns implemented as specified.

## Issues Encountered
- Phase 28-01 work (admin.js, admin layout, middleware) existed on the `main` branch but not on this worktree's branch. Resolved by merging `main` into `worktree-agent-a70df44b` before proceeding.

## Known Stubs
None — all data flows are wired. The tenant table reads live from the API, impersonation redirects to the real dashboard, and re-provisioning calls the real assign_sg_number RPC.

## User Setup Required
None — no additional environment variables or external service configuration required. The admin re-provisioning endpoint uses the existing supabase service-role client and the assign_sg_number RPC from migration 011.

## Next Phase Readiness
- Plan 28-02 (admin layout + phone inventory) can be built independently — the tenants page will automatically use the admin layout once it is created (Next.js nested layout pattern)
- The impersonation flow is complete — admin can navigate to any tenant dashboard and see it in read-only mode
- Re-provisioning is wired to assign_sg_number RPC — fully operational once SG numbers are in inventory

---
*Phase: 28-admin-dashboard*
*Completed: 2026-03-26*

# Phase 28: Admin Dashboard - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

A separate admin interface with its own authentication, allowing administrators to manage the Singapore phone number inventory (add/remove/view numbers and assignment status), view all tenant users with full management capabilities (view-only impersonation, provisioning flag management), and perform bulk operations on phone inventory. The admin dashboard uses a distinct visual theme to differentiate it from the tenant dashboard.

</domain>

<decisions>
## Implementation Decisions

### Admin Authentication
- **D-01:** Admin auth uses existing Supabase Auth — admins log in via the same `/auth/signin` flow as tenants
- **D-02:** Admin role stored in a separate `admin_users` table with `user_id` FK to `auth.users`, `role` column (default 'admin'), and `created_at`
- **D-03:** Middleware checks `/admin/*` routes by querying `admin_users` table for the authenticated user — non-admins get 403
- **D-04:** Initial admin user bootstrapped via a CLI script or direct DB insert (not self-service signup)

### Phone Inventory Management
- **D-05:** Single-add form for day-to-day: text input with +65 prefix, admin pastes local digits, clicks Add — number inserted as `available`
- **D-06:** Bulk CSV import for initial seeding: admin uploads a CSV of phone numbers, all inserted as `available`
- **D-07:** Actions per inventory status: `available` → [Retire], `assigned` → [Retire], `retired` → [Re-activate as available]
- **D-08:** No direct tenant-to-tenant reassignment — admin must retire then re-add to prevent accidental number theft from active tenants
- **D-09:** Inventory table shows: phone number, country, status (available/assigned/retired), assigned tenant name (if assigned), created date

### Tenant Overview
- **D-10:** Full tenant table with: business name, owner name, country, assigned phone number, subscription plan, subscription status, onboarding_complete flag, provisioning_failed flag
- **D-11:** View-only impersonation: admin clicks "View as" on a tenant row, sees tenant's dashboard in read-only mode with a banner "Viewing as: [tenant name]" and an "Exit Impersonation" button. All dashboard actions disabled during impersonation.
- **D-12:** Admin can toggle `provisioning_failed` flag and manually trigger number re-provisioning for failed tenants
- **D-13:** No suspend/unsuspend functionality — call blocking handled by billing enforcement (Phase 25), not admin actions

### Visual Design
- **D-14:** Distinct admin theme — different color scheme from Heritage Copper tenant dashboard (e.g., blue/gray admin palette) to make it visually obvious when in admin interface
- **D-15:** Admin pages live under `/admin` route group with their own layout
- **D-16:** Reuse shadcn/ui components (Table, Button, Card, Input, etc.) but with admin-specific color tokens

### Claude's Discretion
- Admin theme specific color palette selection (blue/gray suggested but flexible)
- CSV parsing library choice for bulk import
- Impersonation session mechanism (query param, cookie, or context provider)
- Admin layout structure (sidebar nav vs top tabs)
- Pagination approach for tenant and inventory tables
- Search/filter capabilities on tables

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `supabase/migrations/011_country_provisioning.sql` — phone_inventory table definition, assign_sg_number RPC, RLS policies, waitlist table
- `supabase/DB` — Full database schema reference

### Auth & Middleware
- `src/middleware.js` — Current auth guard pattern (Supabase SSR client, AUTH_REQUIRED_PATHS) — admin routes need similar but separate gate
- `src/lib/supabase-server.js` — Server-side Supabase client creation pattern

### Existing Dashboard (reference for impersonation)
- `src/app/dashboard/` — Tenant dashboard pages that impersonation must render in read-only mode
- `src/app/dashboard/layout.js` — Dashboard layout with navigation

### Onboarding & Provisioning
- `src/app/api/stripe/webhook/route.js` — Checkout success handler with provisioning logic (reference for re-provisioning action)
- `src/app/api/onboarding/sms-confirm/route.js` — Phone provisioning patterns

### Phase 27 Context
- `.planning/phases/27-country-aware-onboarding-and-number-provisioning/27-CONTEXT.md` — Full provisioning architecture decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **shadcn/ui components**: Table, Button, Card, Input, Select, Dialog — all available and used across dashboard
- **Supabase service_role client**: Used for admin-level DB operations — phone_inventory has no authenticated user RLS policies, all access via service_role
- **assign_sg_number RPC**: Existing race-safe number assignment function — can be referenced for re-provisioning
- **Middleware auth pattern**: `createServerClient` + `getUser()` pattern in `src/middleware.js` — admin middleware will extend this

### Established Patterns
- **API route structure**: Next.js App Router route handlers in `src/app/api/` — admin API routes follow same pattern
- **Migration naming**: Sequential `NNN_feature_name.sql` — next is `012_admin_users.sql`
- **RLS convention**: All tables have RLS enabled; admin_users table needs SELECT policy for authenticated users (to check own admin status)

### Integration Points
- **Middleware**: Needs `/admin` path added to auth check, plus admin role verification query
- **Route group**: New `src/app/admin/` route group with its own layout (distinct from `(public)` and `dashboard`)
- **Impersonation**: Dashboard layout needs to accept an impersonation context that disables all mutations and shows the admin banner

</code_context>

<specifics>
## Specific Ideas

- Admin theme should be visually distinct enough that an admin can't mistake it for a tenant dashboard — different header color, "ADMIN" badge, different accent color
- Impersonation should feel like a "peek" into the tenant's world — same dashboard layout but clearly read-only with grayed out action buttons
- Bulk CSV import should validate phone number format before inserting and report any errors line-by-line

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 28-admin-dashboard*
*Context gathered: 2026-03-26*

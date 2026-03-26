---
phase: 28-admin-dashboard
verified: 2026-03-26T00:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Navigate to /admin as a non-admin user"
    expected: "URL stays at /admin/* but page shows the 403 'Access Denied' content (NextResponse.rewrite)"
    why_human: "Middleware rewrite behavior cannot be verified without a running server and a real Supabase session"
  - test: "Click 'View as' on a tenant row in /admin/tenants"
    expected: "Dashboard renders with amber banner showing 'Viewing as: {Business Name} (read-only)' and all action buttons are unclickable"
    why_human: "pointer-events-none visual disabling and amber banner render require a browser"
  - test: "Add a duplicate Singapore number via the inventory form"
    expected: "Inline error appears below the input: 'That number is already in the inventory. Check the existing entries below.' — no toast"
    why_human: "Inline error display vs toast distinction requires a running UI and real DB state"
---

# Phase 28: Admin Dashboard Verification Report

**Phase Goal:** A separate admin interface with its own authentication allows administrators to manage the Singapore phone number inventory (add/remove/view numbers and their assignment status) and view all tenant users with their country, assigned number, and subscription status
**Verified:** 2026-03-26
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria SC-1 through SC-5)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | An admin can log in via a separate admin authentication flow and access the admin dashboard | VERIFIED | `src/middleware.js` gates `/admin/*` with `admin_users` table lookup. Unauthenticated users redirect to `/auth/signin`. Non-admins are rewritten to `/admin/forbidden`. Admin users return `response` immediately, bypassing tenant logic. |
| 2 | An admin can add a new Singapore phone number to the inventory — it appears as 'available' and can be assigned during onboarding | VERIFIED | `POST /api/admin/inventory` normalizes to `+65`, validates 8 digits, inserts with `status: 'available'`. Page calls the API and refreshes table on success. |
| 3 | An admin can view all phone numbers with their status and which tenant each assigned number belongs to | VERIFIED | `GET /api/admin/inventory` queries `phone_inventory` with `assigned_tenant:tenants(business_name, owner_name)` join. Inventory page renders Phone Number, Country, Status badge, Assigned Tenant, Created Date columns. |
| 4 | An admin can view all tenant users with their name, country, assigned phone number, and subscription status | VERIFIED | `GET /api/admin/tenants` joins `subscriptions(plan_id, status, is_current)`, post-processes to extract `currentSub`. Tenants page renders all 9 columns including Plan, Sub Status, Onboarding, Prov. Failed. |
| 5 | A non-admin user cannot access any admin routes — they are redirected or shown a 403 error | VERIFIED | Middleware checks `admin_users` table for every `/admin/*` path. Non-admin authenticated users receive `NextResponse.rewrite` to `/admin/forbidden`. Unauthenticated users redirect to `/auth/signin`. |

**Score: 5/5 truths verified**

---

### Required Artifacts

#### Plan 28-01 Artifacts

| Artifact | Expected | Level 1 (Exists) | Level 2 (Substantive) | Level 3 (Wired) | Status |
|----------|----------|-----------------|----------------------|-----------------|--------|
| `supabase/migrations/012_admin_users.sql` | admin_users table with RLS | EXISTS | `CREATE TABLE admin_users`, `ENABLE ROW LEVEL SECURITY`, self-read policy, no INSERT policy | Referenced by middleware via `admin_users` query | VERIFIED |
| `src/middleware.js` | Admin route gate | EXISTS | `isAdminPath` block, `admin_users` lookup, `NextResponse.rewrite('/admin/forbidden')`, `return response` early exit | Runs on every `/admin/*` request via `config.matcher` | VERIFIED |
| `src/lib/admin.js` | Shared verifyAdmin helper | EXISTS | Exports `verifyAdmin()`, uses session client for auth + service-role for `admin_users` lookup, returns user or null | Imported by all 4 `/api/admin/*` route handlers | VERIFIED |
| `src/app/admin/forbidden/page.js` | 403 page for non-admins | EXISTS | "Access Denied" heading, "You don't have permission" copy, links to `/auth/signin` and `/dashboard` | Reached via `NextResponse.rewrite` in middleware | VERIFIED |
| `src/components/ui/table.jsx` | shadcn Table component | EXISTS | Full shadcn component with TableHeader, TableBody, TableRow, TableHead, TableCell exports | Imported by both `inventory/page.js` and `tenants/page.js` | VERIFIED |

#### Plan 28-02 Artifacts

| Artifact | Expected | Level 1 (Exists) | Level 2 (Substantive) | Level 3 (Wired) | Status |
|----------|----------|-----------------|----------------------|-----------------|--------|
| `src/app/admin/layout.js` | Admin layout with navy header, ADMIN badge, top-tab nav | EXISTS | `bg-[#0F1F3D]` header, `ADMIN` badge with `bg-[#1D4ED8]`, tabs to `/admin/inventory` and `/admin/tenants`, Sign Out handler | Wraps all `/admin/*` pages via Next.js file-system routing | VERIFIED |
| `src/app/admin/page.js` | Redirect to /admin/inventory | EXISTS | `redirect('/admin/inventory')` — single-purpose redirect | Entry point for `/admin` path | VERIFIED |
| `src/app/admin/inventory/page.js` | Phone inventory management page | EXISTS | 551 lines — Add form with +65 prefix, inline duplicate error, CSV import with papaparse, full Table with 6 columns, Retire/Re-activate AlertDialogs, pagination, search, skeleton loading, empty state | Fetches `GET /api/admin/inventory`, calls `POST` and `PATCH` | VERIFIED |
| `src/app/api/admin/inventory/route.js` | Inventory CRUD API | EXISTS | Exports GET, POST, PATCH. All call `verifyAdmin()`. GET joins tenants. POST validates `+65\d{8}`, returns 409 for code 23505. PATCH handles retire/reactivate | Called by inventory page | VERIFIED |
| `src/app/api/admin/inventory/bulk/route.js` | Bulk CSV import API | EXISTS | Exports POST, calls `verifyAdmin()`, normalizes/validates per number, inserts individually to handle partial duplicates, returns `{ inserted, errors }` | Called by inventory page `handleCsvImport` | VERIFIED |

#### Plan 28-03 Artifacts

| Artifact | Expected | Level 1 (Exists) | Level 2 (Substantive) | Level 3 (Wired) | Status |
|----------|----------|-----------------|----------------------|-----------------|--------|
| `src/app/admin/tenants/page.js` | Tenant overview page | EXISTS | 395 lines — 9-column table, SubStatusBadge, Switch+AlertDialog for provisioning_failed toggle, "View as" button, "Trigger Re-Provisioning" button (provisioning_failed only), pagination, search, skeleton, empty state | Fetches `GET /api/admin/tenants`, calls `PATCH /api/admin/tenants/${id}` and `POST /api/admin/tenants/${id}` | VERIFIED |
| `src/app/api/admin/tenants/route.js` | Tenant list API | EXISTS | Exports GET, calls `verifyAdmin()`, joins `subscriptions(plan_id, status, is_current)`, filters `is_current === true`, supports page+search | Called by tenants page | VERIFIED |
| `src/app/api/admin/tenants/[id]/route.js` | Per-tenant PATCH+POST | EXISTS | Exports PATCH (toggle provisioning_failed) and POST (re-provision via `assign_sg_number` RPC, validates `provisioning_failed=true` and `country='SG'`, updates `retell_phone_number`) | Called by tenants page for toggle and re-provision | VERIFIED |
| `src/app/dashboard/ImpersonationBanner.js` | Amber impersonation banner | EXISTS | `bg-amber-50 border-b border-amber-300`, "Viewing as:" with tenantName, Eye icon, "Exit Impersonation" link to `/admin/tenants` | Conditionally rendered by `dashboard/layout.js` when `impersonate` param present | VERIFIED |
| `src/app/dashboard/layout.js` | Dashboard layout with impersonation | EXISTS | Reads `searchParams.get('impersonate')` and `searchParams.get('impersonate_name')`, renders `ImpersonationBanner` outside `pointer-events-none` wrapper, wraps content in `pointer-events-none opacity-60` when impersonating, Suspense boundary for useSearchParams | Impersonation triggered by "View as" navigation from tenants page | VERIFIED |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/middleware.js` | `admin_users` table | `supabase.from('admin_users').select('id').eq('user_id', user.id).single()` | WIRED | Line 49–53 in middleware.js. Anon-key client with user session respects RLS self-read policy. |
| `src/app/admin/inventory/page.js` | `/api/admin/inventory` | `fetch('/api/admin/inventory?...')` for GET, POST, PATCH | WIRED | fetchInventory (line 158), handleAddNumber (line 196), handleAction (line 223). Response data written to `numbers` state and rendered. |
| `src/app/api/admin/inventory/route.js` | `phone_inventory` table | `supabase.from('phone_inventory')...` (service-role) | WIRED | GET joins tenants, POST inserts, PATCH updates. All use service-role client that bypasses RLS. |
| `src/app/admin/tenants/page.js` | `/dashboard?impersonate=<id>&impersonate_name=<name>` | `router.push(...)` on "View as" click | WIRED | Line 313–318 in tenants/page.js. Navigates to dashboard with both impersonate params. |
| `src/app/dashboard/layout.js` | `ImpersonationBanner.js` | Conditional render when `searchParams.get('impersonate')` present | WIRED | Lines 126–128 in layout.js. Banner is outside pointer-events-none wrapper (interactive). |
| `src/app/api/admin/tenants/[id]/route.js` | `assign_sg_number` RPC + `tenants` table | `supabase.rpc('assign_sg_number', { p_tenant_id: params.id })` then `supabase.from('tenants').update(...)` | WIRED | Lines 76–102 in [id]/route.js. Verifies provisioning_failed=true and country='SG' before calling RPC. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `inventory/page.js` | `numbers` state | `GET /api/admin/inventory` → `supabase.from('phone_inventory').select(...)` with real DB query | Yes — queries `phone_inventory` table with `assigned_tenant:tenants(...)` join, count, and range | FLOWING |
| `tenants/page.js` | `tenants` state | `GET /api/admin/tenants` → `supabase.from('tenants').select(...)` with subscriptions join | Yes — queries `tenants` table, joins `subscriptions`, post-processes to extract `currentSub` | FLOWING |
| `ImpersonationBanner.js` | `tenantName` prop | Passed from `dashboard/layout.js` via `searchParams.get('impersonate_name')` | Yes — sourced from URL param set by tenants page at navigation time | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — admin interface requires authenticated Supabase session and running server. No runnable entry points that can be tested without server startup.

---

### Requirements Coverage

The plans reference SC-1 through SC-5 as requirement IDs. These IDs map directly to the 5 Success Criteria in ROADMAP.md Phase 28, not to entries in REQUIREMENTS.md. The REQUIREMENTS.md (v3.0) does not define SC-1 through SC-5 as named requirement entries — the admin dashboard was not separately enumerated in the v3.0 requirements list. The success criteria serve as the operative specification.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| SC-1 (Admin auth flow) | 28-01 | Admin can log in and access admin dashboard | SATISFIED | middleware.js admin gate + admin_users table + verifyAdmin helper |
| SC-2 (Add SG number) | 28-02 | Admin can add SG number, appears as 'available' | SATISFIED | POST /api/admin/inventory with +65 validation and 'available' default status |
| SC-3 (View inventory) | 28-02 | Admin can view all numbers with status and tenant assignment | SATISFIED | GET /api/admin/inventory with tenants join; inventory page renders full table |
| SC-4 (View tenants) | 28-03 | Admin can view all tenants with name, country, phone, sub status | SATISFIED | GET /api/admin/tenants with subscriptions join; tenants page renders 9-column table |
| SC-5 (Non-admin blocked) | 28-01 | Non-admin cannot access admin routes — 403 shown | SATISFIED | Middleware rewrites non-admin users to /admin/forbidden; unauthenticated users redirected to /auth/signin |

**Orphaned requirements check:** REQUIREMENTS.md does not have SC-1 through SC-5 entries. No orphaned requirements found.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/admin.js` | 12 | `return null` | None | Guard clause, not a stub. Returns null when no authenticated user — intentional early exit for unauthenticated callers. |

No stubs, placeholders, empty implementations, or hardcoded empty data found in any phase 28 file.

---

### Human Verification Required

#### 1. Non-admin 403 rewrite behavior

**Test:** Sign in as a regular tenant user (not in admin_users table), then navigate to `/admin/inventory`
**Expected:** URL stays at `/admin/inventory` (rewrite, not redirect) but page shows the 403 "Access Denied" content with "You don't have permission to access the admin dashboard"
**Why human:** NextResponse.rewrite behavior and the URL-stays-at-path UX cannot be verified without a real browser session and Supabase auth state

#### 2. Dashboard impersonation disables all actions

**Test:** Click "View as" on any tenant row in `/admin/tenants`, observe the dashboard
**Expected:** Amber banner appears at top showing "Viewing as: {Business Name} (read-only)". All sidebar links, buttons, and form fields inside the main layout are visually dimmed (opacity-60) and unclickable (pointer-events-none). The "Exit Impersonation" button in the banner remains clickable.
**Why human:** Visual rendering and pointer-events behavior require a browser

#### 3. Inline duplicate number error (not toast)

**Test:** Add a SG number that already exists in the inventory via the Add Number form
**Expected:** Below the input field, text appears: "That number is already in the inventory. Check the existing entries below." — no toast notification fires
**Why human:** Inline error vs toast distinction and the exact placement require visual inspection in a running UI

---

### Gaps Summary

No gaps found. All 5 success criteria are satisfied:

- SC-1: Admin authentication gate is implemented via middleware + admin_users table + verifyAdmin helper. Admin users can access /admin/* routes; non-admins see 403 forbidden; unauthenticated users redirect to sign-in.
- SC-2: Phone inventory add form is wired to a real API that validates SG format and inserts with 'available' status.
- SC-3: Inventory table displays all phone_inventory rows with status badges and tenant assignment via FK join.
- SC-4: Tenant table displays all tenants with country, phone number, and subscription status (plan + status) from subscriptions join.
- SC-5: Middleware blocks /admin/* at the edge — both unauthenticated and non-admin authenticated users are prevented from accessing admin pages.

Skill files are updated: auth-database-multitenancy reflects admin_users table, migration 012, middleware gate, and verifyAdmin. dashboard-crm-system reflects ImpersonationBanner and layout Suspense boundary.

Three items are routed to human verification — all are visual/behavioral checks that require a running browser session and cannot be verified programmatically.

---

_Verified: 2026-03-26_
_Verifier: Claude (gsd-verifier)_

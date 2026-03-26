# Phase 28: Admin Dashboard - Research

**Researched:** 2026-03-26
**Domain:** Next.js App Router admin UI, Supabase RLS/admin auth, impersonation patterns, CSV parsing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Admin Authentication**
- D-01: Admin auth uses existing Supabase Auth — admins log in via the same `/auth/signin` flow as tenants
- D-02: Admin role stored in a separate `admin_users` table with `user_id` FK to `auth.users`, `role` column (default 'admin'), and `created_at`
- D-03: Middleware checks `/admin/*` routes by querying `admin_users` table for the authenticated user — non-admins get 403
- D-04: Initial admin user bootstrapped via a CLI script or direct DB insert (not self-service signup)

**Phone Inventory Management**
- D-05: Single-add form for day-to-day: text input with +65 prefix, admin pastes local digits, clicks Add — number inserted as `available`
- D-06: Bulk CSV import for initial seeding: admin uploads a CSV of phone numbers, all inserted as `available`
- D-07: Actions per inventory status: `available` → [Retire], `assigned` → [Retire], `retired` → [Re-activate as available]
- D-08: No direct tenant-to-tenant reassignment — admin must retire then re-add
- D-09: Inventory table shows: phone number, country, status, assigned tenant name (if assigned), created date

**Tenant Overview**
- D-10: Full tenant table with: business name, owner name, country, assigned phone number, subscription plan, subscription status, onboarding_complete flag, provisioning_failed flag
- D-11: View-only impersonation — admin clicks "View as", sees tenant dashboard read-only with "Viewing as: [tenant name]" banner and "Exit Impersonation" button. All dashboard actions disabled.
- D-12: Admin can toggle `provisioning_failed` flag and manually trigger number re-provisioning for failed tenants
- D-13: No suspend/unsuspend functionality

**Visual Design**
- D-14: Distinct admin theme — navy/blue palette (`#0F1F3D` sidebar, `#1D4ED8` accent) vs tenant Heritage Copper
- D-15: Admin pages live under `/admin` route group with their own layout
- D-16: Reuse shadcn/ui components but with admin-specific color tokens

### Claude's Discretion
- Admin theme specific color palette selection (blue/gray suggested but flexible)
- CSV parsing library choice for bulk import
- Impersonation session mechanism (query param, cookie, or context provider)
- Admin layout structure (sidebar nav vs top tabs)
- Pagination approach for tenant and inventory tables
- Search/filter capabilities on tables

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

</user_constraints>

---

## Summary

Phase 28 builds an internal admin dashboard at `/admin` using the existing Next.js App Router pattern, Supabase Auth, and shadcn/ui component library. The core work divides into four areas: (1) a new `admin_users` DB table plus migration and RLS policy, (2) middleware extension to gate `/admin/*` routes with admin role verification, (3) the admin UI (layout, inventory page, tenants page), and (4) the impersonation mechanism.

The most architecturally interesting problems are the middleware admin check and the impersonation mechanism. The middleware currently makes one DB query for all authenticated paths (onboarding_complete check); adding an admin check for `/admin/*` paths requires a second conditional query. Impersonation is cleanest as a URL query parameter (`?impersonate=<tenant_id>`) passed when "View as" is clicked, read in the dashboard layout to render the banner and disable mutations — no session storage or cookies needed.

CSV parsing has no library in the current dependencies (`papaparse` is absent). Since CSV upload is client-side with preview, `papaparse` is the standard choice. The `Table` shadcn component is also not yet installed in `src/components/ui/` and must be added before inventory/tenant tables can be built.

**Primary recommendation:** Build in this order — migration (012_admin_users.sql) → middleware extension → admin layout → inventory page → tenants page → impersonation banner wiring. Each step is independently testable.

---

## Project Constraints (from CLAUDE.md)

- Keep skills in sync: read the skill before making changes, update after
- Brand name is Voco — not HomeService AI
- Tech stack: Next.js App Router, Supabase Auth + Postgres + RLS, Tailwind CSS, shadcn/ui
- All new tables need RLS enabled
- Migration naming: sequential `NNN_feature_name.sql` — next is `012_admin_users.sql`

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | 0.9.0 (installed) | Middleware + server Supabase client | Project standard; handles cookie-based session |
| `@supabase/supabase-js` | 2.99.2 (installed) | Service-role client for admin DB ops | Already used for phone_inventory (no user-scoped RLS) |
| `shadcn/ui` | (installed, new-york preset) | Table, Button, Card, Input, Badge, Switch, Alert, AlertDialog, Skeleton | All other phases use it |
| `lucide-react` | 0.577.0 (installed) | Icons throughout admin UI | Project standard |
| `sonner` | 2.0.7 (installed) | Toast notifications for admin actions | Already installed and used in dashboard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `papaparse` | latest (NOT installed) | Client-side CSV parsing for bulk import | Required for D-06 bulk CSV import feature |
| `Table` shadcn component | (NOT installed) | Inventory and tenant data tables | Must `npx shadcn@latest add table` before building table UIs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `papaparse` | Browser native `FileReader` + split/parse | papaparse handles edge cases (quoted commas, BOM, encoding); native is fragile |
| Query param impersonation | Cookie-based impersonation | Query param is simpler, visible in URL, no cleanup needed; cookie requires cleanup on exit |
| Top-tab nav | Sidebar nav | UI-SPEC chose top-tabs to differentiate admin from tenant sidebar visually |

**Installation required (Wave 0):**
```bash
npm install papaparse
npx shadcn@latest add table
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/app/admin/
├── layout.js               # Admin layout (top-tab nav, navy header, ADMIN badge)
├── page.js                 # Redirect to /admin/inventory (or overview)
├── not-found.js            # 403 page for non-admin users
├── inventory/
│   └── page.js             # Phone inventory management page
└── tenants/
    └── page.js             # Tenant overview page

src/app/api/admin/
├── inventory/
│   └── route.js            # GET (list), POST (add single), DELETE/PATCH (retire/reactivate)
├── inventory/bulk/
│   └── route.js            # POST bulk insert from CSV parse result
└── tenants/
    ├── route.js            # GET (list all tenants with joins)
    └── [id]/
        └── route.js        # PATCH (toggle provisioning_failed), POST (trigger re-provisioning)

supabase/migrations/
└── 012_admin_users.sql     # admin_users table + RLS

src/middleware.js           # Extended with /admin path + admin role check
```

### Pattern 1: Admin Middleware Guard

The existing middleware already calls `supabase.auth.getUser()` for all matched paths. The admin check adds a second conditional DB query for `/admin/*` paths only:

```javascript
// Source: extends src/middleware.js pattern
const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/');

if (isAdminPath) {
  if (!user) {
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signInUrl);
  }
  // Check admin_users table
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!adminUser) {
    return NextResponse.rewrite(new URL('/admin/not-found', request.url));
    // or: return new NextResponse('Forbidden', { status: 403 });
  }
}
```

**Important:** This requires adding `/admin/:path*` and `/admin` to the middleware `config.matcher`.

### Pattern 2: Admin RLS — `admin_users` Table

```sql
-- 012_admin_users.sql
CREATE TABLE admin_users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  role       text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to SELECT their own row (for middleware check)
CREATE POLICY "Admin can read own row"
  ON admin_users FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- All writes via service_role only (no self-service admin creation)
```

The middleware uses the anon key client (`createServerClient` with anon key) but the SELECT policy for `auth.uid() = user_id` allows the authenticated session to check its own admin status. This is the correct pattern — no service_role needed for the middleware check.

### Pattern 3: Admin API Routes — Service Role Client

All admin API routes (`src/app/api/admin/*`) use the service-role client (`src/lib/supabase.js`) because `phone_inventory` has no user-facing RLS policies — all access is via service_role:

```javascript
// Source: existing pattern in src/app/api/stripe/webhook/route.js
import { supabase } from '@/lib/supabase'; // service-role client

// All phone_inventory reads/writes bypass RLS via service_role
const { data, error } = await supabase
  .from('phone_inventory')
  .select('*, assigned_tenant:tenants(business_name)')
  .order('created_at', { ascending: false })
  .range(offset, offset + PAGE_SIZE - 1);
```

Admin API routes must also verify the caller is an admin before proceeding. Pattern: call `createSupabaseServer()` to get the session user, then query `admin_users` to verify.

### Pattern 4: Impersonation via Query Parameter

When "View as" is clicked, navigate to:
```
/dashboard?impersonate=<tenant_id>
```

The dashboard layout reads `searchParams.impersonate` (Server Component) or `useSearchParams().get('impersonate')` (Client Component). If present:
1. Render the amber impersonation banner at the top
2. Pass `isImpersonating: true` via React context to all child components
3. All action buttons check `isImpersonating` and render with `opacity-50 pointer-events-none`

"Exit Impersonation" links to `/admin/tenants` (no query param).

**This requires the dashboard layout to accept an impersonation context** — the banner wraps the existing layout without replacing it.

### Pattern 5: CSV Parsing with PapaParse

```javascript
// Client-side, in the bulk import component
import Papa from 'papaparse';

const handleFileChange = (file) => {
  Papa.parse(file, {
    skipEmptyLines: true,
    complete: (results) => {
      const rows = results.data.map((row, i) => {
        const raw = Array.isArray(row) ? row[0] : row;
        const digits = String(raw).trim().replace(/\D/g, '');
        const valid = /^\d{8}$/.test(digits); // SG: exactly 8 digits
        return { raw, digits, valid, line: i + 1 };
      });
      setPreviewRows(rows);
    },
  });
};
```

### Anti-Patterns to Avoid

- **Checking admin role in UI only:** The middleware MUST be the guard — never rely on client-side role checks alone for security
- **Using service_role client in middleware:** Middleware uses the anon key client (same as current pattern); service_role is for API routes only
- **Making impersonation mutate real data:** The impersonation banner + `isImpersonating` prop-drilling/context must disable all API calls that write — not just disable UI buttons. Buttons could still be triggered programmatically.
- **Full-page 403 redirect on admin access:** The CONTEXT.md specifies a 403 page — use `NextResponse.rewrite` to `/admin/not-found` so the URL stays at the attempted path (better UX than redirect)
- **Installing `Table` as custom component:** Use `npx shadcn@latest add table` — it must come from the official registry, not hand-rolled, to stay consistent with the existing component library pattern

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Custom split/parse logic | `papaparse` | Handles BOM, quoted fields, encoding, empty lines, arrays vs objects |
| Data tables | Custom `<table>` HTML | `shadcn/ui Table` (add via CLI) | Consistent with existing dashboard components, built on Radix primitives |
| Toast notifications | Custom toast system | `sonner` (already installed) | Already used in dashboard; `toast.success()` / `toast.error()` |
| Confirmation dialogs | Custom modal components | `shadcn/ui AlertDialog` (already installed) | Already used in project |

**Key insight:** The admin UI can be built almost entirely from already-installed shadcn components. The only new addition is `Table` (not yet added) and `papaparse`.

---

## Common Pitfalls

### Pitfall 1: Middleware Matcher Not Updated
**What goes wrong:** Admin routes return 200 with no auth check because middleware doesn't run on them
**Why it happens:** Next.js middleware only runs on paths in `config.matcher`
**How to avoid:** Add `/admin/:path*` and `/admin` to the matcher array in `src/middleware.js`
**Warning signs:** `/admin` is accessible without login; middleware logs don't show admin path hits

### Pitfall 2: Admin Check Runs for Every Authenticated Request
**What goes wrong:** Performance degradation — every `/dashboard` request queries `admin_users` unnecessarily
**Why it happens:** Guard logic placed outside `isAdminPath` conditional
**How to avoid:** Wrap the `admin_users` query strictly inside `if (isAdminPath)`

### Pitfall 3: `Table` Component Not Installed
**What goes wrong:** Import fails at build time — `@/components/ui/table` doesn't exist
**Why it happens:** `Table` is not in the current `src/components/ui/` directory (verified)
**How to avoid:** Run `npx shadcn@latest add table` in Wave 0 before any table component is written

### Pitfall 4: Dashboard Layout Mutation During Impersonation
**What goes wrong:** Admin accidentally creates/modifies tenant data while in impersonation mode
**Why it happens:** Only UI buttons are disabled, but API calls can still be triggered
**How to avoid:** Dashboard API calls that write data should check `searchParams.impersonate` — either skip the call or return early. Alternatively, implement a React context `ImpersonationContext` with `isImpersonating` flag that all write-triggering hooks check.

### Pitfall 5: `phone_inventory` Query Returning No Tenant Name
**What goes wrong:** "Assigned Tenant" column shows null/blank instead of business name
**Why it happens:** `assigned_tenant_id` is a FK but the join isn't specified in the query
**How to avoid:** Use Supabase FK join syntax: `.select('*, assigned_tenant:tenants(business_name, owner_name)')`

### Pitfall 6: Admin `not-found` Page Showing Standard 404
**What goes wrong:** The admin 403 page shows Next.js default not-found styling
**Why it happens:** `not-found.js` in the `/admin` route group inherits the admin layout — if the layout renders conditionally based on admin check, the not-found page may render without the layout
**How to avoid:** The `not-found.js` (or a dedicated `forbidden.js`) should be a standalone page that doesn't require the admin layout — it just shows the "Access Denied" message with a link back to `/dashboard`

### Pitfall 7: Pagination State Lost on Table Action
**What goes wrong:** After retiring a number, the table resets to page 1 unexpectedly
**Why it happens:** Table data is re-fetched after mutation, and page state is local
**How to avoid:** After a successful mutation, refetch the current page (preserve page index in state) rather than resetting to page 0

---

## Code Examples

### Admin Users Migration

```sql
-- supabase/migrations/012_admin_users.sql
-- Phase 28: admin_users table for admin dashboard auth gate

CREATE TABLE admin_users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  role       text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own admin status (used by middleware)
CREATE POLICY "Authenticated can read own admin row"
  ON admin_users FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies — all admin user management is via service_role (CLI/direct DB)
```

### Extended Middleware (admin gate addition)

```javascript
// src/middleware.js — additions to existing file
// Add '/admin/:path*', '/admin' to config.matcher

const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/');

if (isAdminPath) {
  if (!user) {
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }
  const { data: adminRecord } = await supabase
    .from('admin_users')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!adminRecord) {
    // Rewrite to admin forbidden page (URL stays the same — shows 403 message)
    return NextResponse.rewrite(new URL('/admin/forbidden', request.url));
  }
}
```

### Inventory API Route Pattern

```javascript
// src/app/api/admin/inventory/route.js
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase'; // service-role

async function verifyAdmin(request) {
  const supabaseUser = await createSupabaseServer();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('admin_users')
    .select('id')
    .eq('user_id', user.id)
    .single();
  return data ? user : null;
}

export async function GET(request) {
  const admin = await verifyAdmin(request);
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '0');
  const PAGE_SIZE = 25;

  const { data, error, count } = await supabase
    .from('phone_inventory')
    .select('*, assigned_tenant:tenants(business_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data, total: count, page, pageSize: PAGE_SIZE });
}

export async function POST(request) {
  const admin = await verifyAdmin(request);
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { phone_number } = await request.json();
  // Validate: +65XXXXXXXX format
  const normalized = phone_number.startsWith('+65')
    ? phone_number
    : `+65${phone_number}`;

  const { data, error } = await supabase
    .from('phone_inventory')
    .insert({ phone_number: normalized, country: 'SG', status: 'available' })
    .select()
    .single();

  if (error?.code === '23505') {
    return Response.json({ error: 'duplicate' }, { status: 409 });
  }
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data }, { status: 201 });
}
```

### Impersonation Context Pattern

```javascript
// src/app/dashboard/layout.js addition
// Server component reads searchParams, passes to client layout

export default async function DashboardLayout({ children, searchParams }) {
  const impersonateTenantId = searchParams?.impersonate || null;
  // If impersonating, fetch tenant name for banner
  let impersonatedTenant = null;
  if (impersonateTenantId) {
    const { data } = await supabaseServer
      .from('tenants')
      .select('business_name')
      .eq('id', impersonateTenantId)
      .single();
    impersonatedTenant = data;
  }
  return (
    <DashboardLayoutClient impersonation={impersonatedTenant}>
      {children}
    </DashboardLayoutClient>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate admin Supabase project | Same Supabase project, `admin_users` table | Project decision (D-01) | Simpler auth, shared DB, no separate env vars |
| Admin route as separate Next.js app | `/admin` route group in same app | Project decision (D-15) | Single deployment, shared components |

---

## Open Questions

1. **Dashboard layout as Server Component for impersonation**
   - What we know: Current `dashboard/layout.js` is `'use client'` (uses `useState`, `useEffect`, `usePathname`)
   - What's unclear: Reading `searchParams` for impersonation requires either converting to a Server Component or using `useSearchParams()` in a client component
   - Recommendation: Use `useSearchParams()` in the existing client layout — it already runs client-side. Wrap in `<Suspense>` boundary per Next.js requirements for `useSearchParams` in client components.

2. **Re-provisioning trigger for SG numbers**
   - What we know: `assign_sg_number` RPC exists and is race-safe. The Stripe webhook handler calls it after checkout.
   - What's unclear: Re-provisioning also needs to call `retell.phoneNumber.update()` or equivalent to associate the newly assigned number with the tenant's Retell agent.
   - Recommendation: The re-provisioning API route should replicate the provisioning logic from `src/app/api/stripe/webhook/route.js`'s `provisionPhoneNumber()` function — specifically the SG branch (RPC call + Retell agent update).

3. **Tenants table join — subscription data**
   - What we know: `subscriptions` table has `plan_id`, `status` FK'd to `tenant_id`
   - What's unclear: A tenant may have multiple subscription rows (history); which to show
   - Recommendation: Filter by `is_current = true` when joining subscriptions in the tenant list query.

---

## Environment Availability

Step 2.6: SKIPPED — Phase is purely code/config changes. All required tools (Node.js, npm, Supabase project) are already available and used by the existing project.

The one addition is `papaparse` which must be installed but does not require external service availability.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 |
| Config file | package.json `"test"` script with `--experimental-vm-modules` |
| Quick run command | `npm test` |
| Full suite command | `npm run test:all` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMIN-AUTH | Non-admin user blocked from `/admin/*` | unit (middleware logic) | `npm test -- --testPathPattern=admin` | No — Wave 0 |
| ADMIN-INVENTORY | Add single SG number to inventory | integration | `npm run test:integration` | No — Wave 0 |
| ADMIN-INVENTORY | Duplicate number returns 409 | integration | `npm run test:integration` | No — Wave 0 |
| ADMIN-INVENTORY | Retire available number | integration | `npm run test:integration` | No — Wave 0 |
| ADMIN-CSV | Valid CSV parsed correctly, invalid rows rejected | unit | `npm test -- --testPathPattern=csv` | No — Wave 0 |
| ADMIN-TENANT | Tenant list returns expected join fields | integration | `npm run test:integration` | No — Wave 0 |

### Wave 0 Gaps

- [ ] `tests/unit/admin-middleware.test.js` — covers ADMIN-AUTH middleware guard
- [ ] `tests/unit/csv-parse.test.js` — covers CSV validation logic
- [ ] `tests/integration/admin-inventory.test.js` — covers inventory CRUD API routes
- [ ] `npm install papaparse` — CSV parsing library
- [ ] `npx shadcn@latest add table` — Table component

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection: `src/middleware.js` — established middleware pattern for auth + DB query
- Direct code inspection: `supabase/migrations/011_country_provisioning.sql` — phone_inventory table schema, RLS setup, assign_sg_number RPC
- Direct code inspection: `supabase/DB` — full tenants table schema including provisioning_failed, owner_name, country columns
- Direct code inspection: `package.json` — confirmed papaparse absent, sonner/shadcn/lucide present
- Direct code inspection: `src/components/ui/` — confirmed `table.jsx` absent
- Direct code inspection: `src/app/dashboard/layout.js` — confirmed `'use client'` layout, impersonation pattern requirements

### Secondary (MEDIUM confidence)

- `28-UI-SPEC.md` — Finalized visual spec: navy/blue palette, top-tab layout, amber impersonation banner, component inventory, copywriting contract
- `28-CONTEXT.md` — All locked decisions (D-01 through D-16)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — direct package.json verification, existing component directory scan
- Architecture: HIGH — patterns derived from existing middleware, API routes, and migration files in codebase
- Pitfalls: HIGH — based on reading actual code (middleware matcher, existing layout as 'use client', phone_inventory RLS)

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable stack, no fast-moving dependencies)

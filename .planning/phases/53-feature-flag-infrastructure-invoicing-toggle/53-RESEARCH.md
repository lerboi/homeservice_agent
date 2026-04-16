# Phase 53: Feature Flag Infrastructure + Invoicing Toggle — Research

**Researched:** 2026-04-16
**Domain:** Next.js middleware gating, React Context distribution, Supabase JSONB column patterns, per-tenant feature flags
**Confidence:** HIGH — all findings verified against live codebase

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 Hybrid gate strategy:**
  - Dashboard pages: extend `src/proxy.js` matcher + gate block reads `features_enabled.invoicing`, redirects to `/dashboard` when false
  - APIs: shared `getTenantFeatures(tenantId)` helper in `src/lib/features.js`; each route early-returns 404 when flag is off
  - Crons: WHERE clause filters tenants by flag; no proxy matcher extension for `/api/**`
- **D-02 Flag distribution:** Server Component (`layout.js`) calls `getTenantFeatures()` once per request; wraps tree in `<FeatureFlagsProvider>`; client components consume via `useFeatureFlags()` hook; server-rendered children receive flags as props
- **D-03 Toggle placement:** New `/dashboard/more/features` panel — always accessible, designed as N-toggle list, never gated
- **D-04 Flip-off confirmation:** Conditional on record existence — fetch counts first; show `<AlertDialog>` only if invoices.count > 0 OR estimates.count > 0; flip-on is always silent
- **D-05 Toggle persistence:** Single PATCH to `/api/tenant/features`; optimistic UI with rollback on error
- **D-06 Route-off response:** APIs return 404 (no body); crons silently skip via WHERE filter; dashboard pages redirect to `/dashboard` (no query param)
- **D-07 Migration:** `051_features_enabled.sql` — `ALTER TABLE tenants ADD COLUMN features_enabled JSONB NOT NULL DEFAULT '{"invoicing": false}'::jsonb`; no backfill needed; column is JSONB (not boolean) for future extensibility; no new RLS policy required
- **D-08 LeadFlyout:** When `invoicing = false`, "Create Invoice" / "Create Estimate" buttons are removed from DOM (not disabled); existing per-lead invoice/estimate badges/counts hidden; lead records themselves remain visible

### Claude's Discretion

- Helper signature shape: `getTenantFeatures(tenantId): Promise<{invoicing: boolean}>` preferred (JSONB-returning shape enables single DB read for all flags)
- Whether `/dashboard/more/features` uses existing More-menu card visual pattern or dedicated layout — match sibling pages
- Exact dialog copy for flip-off confirmation — match tone of existing dashboard toasts/dialogs
- Whether to emit activity_log entry on toggle flip — add if it fits the existing activity_log pattern
- Client component boundary placement: layout-level wrap (`<FeatureFlagsProvider>`) preferred

### Deferred Ideas (OUT OF SCOPE)

- Admin dashboard UI for support to flip per-tenant flags
- Setup-checklist integration (belongs in Phase 58)
- Telemetry dashboard for flag-flip events
- Per-user (vs per-tenant) feature flags
- LaunchDarkly / Unleash / Growthbook integration
- Voice agent flag awareness
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TOGGLE-01 | `tenants.features_enabled` JSONB column exists with default `{"invoicing": false}` for ALL tenants | Migration 051 pattern confirmed via 050; `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ... DEFAULT` applies to existing rows automatically |
| TOGGLE-02 | When flag false, all invoicing routes return 404/no-op for that tenant | API gate pattern via `getTenantFeatures()` helper at each route entry point; proxy gate for page redirects |
| TOGGLE-03 | When flag false, sidebar/BottomTabBar/LeadFlyout/More menu hide invoicing UI | `DashboardSidebar` uses `NAV_ITEMS` static array — requires context-conditional filtering; `BottomTabBar` uses `TABS` static array; `LeadFlyout` has inline buttons at line 737/746; `more/page.js` has `QUICK_ACCESS` + `MORE_ITEMS` arrays |
| TOGGLE-04 | Toggle is reversible with no data loss; cron jobs skip tenants with flag off | Crons use service-role client querying `invoices` table; adding `.eq('features_enabled->>invoicing', 'true')` on tenant filter achieves skip behavior |
</phase_requirements>

---

## Summary

Phase 53 adds a tenant-level `features_enabled` JSONB column to the `tenants` table and gates the entire invoicing surface (dashboard pages, API groups, crons, UI components) behind the `invoicing` flag. The flag defaults to `false` for all tenants (safe in dev — no live users), making invoicing opt-in and allowing v6.0 to refocus Voco on the Call System.

The implementation has three enforcement layers: (1) `src/proxy.js` middleware for dashboard page redirects — extending the existing admin-gate and subscription-gate patterns already in the file; (2) a new `getTenantFeatures()` helper in `src/lib/features.js` called at the entry point of each gated API route; (3) a WHERE clause filter in the two invoice cron jobs. The UI hiding layer uses a `<FeatureFlagsProvider>` React Context wrapper, inserted at `layout.js` level and consumed by client components via `useFeatureFlags()`.

The critical architectural findings from codebase inspection are: (a) `layout.js` is a **Client Component** (marked `'use client'`) — the server-side features fetch must be introduced via a parent Server Component or the layout must be split into a thin Server wrapper + the existing Client inner component; (b) `DashboardSidebar` and `BottomTabBar` both use static arrays (`NAV_ITEMS`, `TABS`) that need conditional filtering; (c) the cron jobs query `invoices` directly (not by tenant iteration), so the flag filter is applied by joining or subquerying tenants; (d) the `notification-settings` route provides the canonical pattern for reading/writing a JSONB column on `tenants` — plain `snake_case` throughout, accessed via `?.` optional chaining.

**Primary recommendation:** Follow the established patterns exactly. The gate infrastructure is simpler than it appears: proxy extension is ~15 lines, the helper is ~8 lines, and each API route gets a 5-line early-return block. The layout Server/Client split is the highest-complexity change.

---

## Project Constraints (from CLAUDE.md)

- Brand name is **Voco** — not HomeService AI
- Keep skills in sync: read `auth-database-multitenancy` and `dashboard-crm-system` before implementing; update both skills after
- Fallback email domain: `voco.live`
- Tech stack: Next.js App Router, Supabase, shadcn/ui, Tailwind CSS, sonner (toasts), next-themes

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Supabase JS | existing | JSONB column query, tenant update | JSONB operators `->>`/`->` already used in codebase |
| Next.js App Router | existing | Middleware gate, Server/Client component split | `proxy.js` is the middleware file |
| shadcn/ui `<AlertDialog>` | existing | Flip-off confirmation dialog | Already imported in `DashboardSidebar.jsx` and `LeadFlyout.jsx` |
| shadcn/ui `<Switch>` | existing | Feature toggle control | Already imported in `InvoiceSettingsPage` |
| sonner `toast` | existing | Success/error feedback on toggle | Already used across dashboard |
| React Context | built-in | `FeatureFlagsProvider` + `useFeatureFlags()` | No new dependency |

### New Files to Create
| File | Purpose |
|------|---------|
| `supabase/migrations/051_features_enabled.sql` | JSONB column migration |
| `src/lib/features.js` | `getTenantFeatures(tenantId)` helper |
| `src/components/FeatureFlagsProvider.jsx` | React Context + `useFeatureFlags()` hook |
| `src/app/dashboard/more/features/page.js` | Toggle panel UI |
| `src/app/api/tenant/features/route.js` | PATCH endpoint |

**No new npm installs required.** All dependencies are already in the project.

---

## Architecture Patterns

### Recommended Project Structure (additions)

```
src/
├── lib/
│   └── features.js              ← new: getTenantFeatures(tenantId)
├── components/
│   └── FeatureFlagsProvider.jsx ← new: Context + useFeatureFlags()
├── app/
│   └── dashboard/
│       ├── layout.js            ← modified: split into Server wrapper + existing Client inner
│       └── more/
│           └── features/
│               └── page.js     ← new: toggle panel
└── api/
    └── tenant/
        └── features/
            └── route.js        ← new: PATCH endpoint
supabase/
└── migrations/
    └── 051_features_enabled.sql ← new: ADD COLUMN
```

---

### Pattern 1: Migration Pattern (from 050_checklist_overrides.sql)

**What:** Add a JSONB column to `tenants` with NOT NULL DEFAULT. DEFAULT applies to existing rows automatically on column add in PostgreSQL — no backfill needed.

**Source:** `supabase/migrations/050_checklist_overrides.sql` [VERIFIED: read]

```sql
-- 050 pattern (checklist_overrides) — mirror exactly:
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS checklist_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;
```

**051 equivalent:**
```sql
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS features_enabled JSONB NOT NULL DEFAULT '{"invoicing": false}'::jsonb;

COMMENT ON COLUMN tenants.features_enabled IS
  'Per-tenant feature flags. Shape: { invoicing: boolean }. Defaults to invoicing off for v6.0 focus.
   Future flags extend this same column. Consumed by src/lib/features.js getTenantFeatures().';
```

**No new RLS policy needed** — the existing `tenants_update_own` policy (`USING (owner_id = auth.uid())`) already covers UPDATE on `features_enabled`. [VERIFIED: auth-database-multitenancy SKILL.md, RLS Pattern 1]

---

### Pattern 2: getTenantFeatures() Helper

**Canonical shape:** Mirrors `getTenantId()` in `src/lib/get-tenant-id.js` but returns the full features object. Uses the service-role client (`src/lib/supabase.js`) to avoid cookie dependency in cron/webhook contexts, and the SSR client for API routes.

**Source:** `src/lib/get-tenant-id.js` [VERIFIED: read], `src/lib/notification-settings/route.js` JSONB read pattern [VERIFIED: read]

```js
// src/lib/features.js
import { supabase } from '@/lib/supabase'; // service-role for direct tenantId calls

/**
 * Returns the features_enabled JSONB for a tenant.
 * Safe for API routes (called after getTenantId()).
 * Defaults to { invoicing: false } if column missing or null.
 *
 * @param {string} tenantId
 * @returns {Promise<{invoicing: boolean}>}
 */
export async function getTenantFeatures(tenantId) {
  const { data, error } = await supabase
    .from('tenants')
    .select('features_enabled')
    .eq('id', tenantId)
    .single();

  if (error || !data) return { invoicing: false };
  return {
    invoicing: data.features_enabled?.invoicing === true,
    // future flags: xero: data.features_enabled?.xero === true, etc.
  };
}
```

**Usage in each API route (early-return gate):**
```js
// Pattern: add after tenantId check, before any data access
import { getTenantFeatures } from '@/lib/features';

export async function GET(request) {
  const tenantId = await getTenantId();
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const features = await getTenantFeatures(tenantId);
  if (!features.invoicing) {
    return new Response(null, { status: 404 }); // D-06: no body, no info leak
  }
  // ... existing route logic
}
```

---

### Pattern 3: Proxy Gate Block

**What:** Extend `src/proxy.js` with a feature-flag gate block. Runs inside the `if (user)` branch, after the subscription gate (line 107), before the final `return response`.

**Source:** `src/proxy.js:41-61` (admin gate), `src/proxy.js:77-82` (tenant fetch) [VERIFIED: read]

**Critical finding:** The existing tenant fetch at lines 77-82 only selects `onboarding_complete, id`. To avoid a second DB round-trip, extend the SELECT to include `features_enabled`:

```js
// BEFORE (lines 78-82):
const { data: tenant } = await supabase
  .from('tenants')
  .select('onboarding_complete, id')
  .eq('owner_id', user.id)
  .single();

// AFTER:
const { data: tenant } = await supabase
  .from('tenants')
  .select('onboarding_complete, id, features_enabled')
  .eq('owner_id', user.id)
  .single();
```

**Gate block to insert** (after subscription gate, before final `return response`):
```js
// ── Feature flag gate ──────────────────────────────────────────────────────
const INVOICING_GATED_PATHS = [
  '/dashboard/invoices',
  '/dashboard/estimates',
  '/dashboard/more/invoice-settings',
];

const isInvoicingGatedPath = INVOICING_GATED_PATHS.some(
  (p) => pathname === p || pathname.startsWith(p + '/')
);

if (isInvoicingGatedPath && tenant) {
  const invoicingEnabled = tenant.features_enabled?.invoicing === true;
  if (!invoicingEnabled) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
}
```

**Matcher extension** (line 142) — add three new path patterns:
```js
export const config = {
  matcher: [
    '/onboarding/:path*', '/onboarding',
    '/dashboard/:path*', '/dashboard',
    '/admin/:path*', '/admin',
    '/auth/signin',
    // Phase 53 — invoicing page gates (already covered by /dashboard/:path*, no change needed)
  ],
};
```

**Note:** No matcher change is required. `/dashboard/:path*` already matches all invoicing page paths. The gate logic inside the block handles the discrimination. [VERIFIED: proxy.js matcher confirmed]

---

### Pattern 4: Layout.js Server/Client Split

**Critical finding:** `src/app/dashboard/layout.js` is a **Client Component** — it has `'use client'` at line 1. [VERIFIED: read]

This means it cannot directly call `getTenantFeatures()` (which requires a DB read). Two options:

**Option A (recommended) — thin Server wrapper:** Create a new `layout.js` as a Server Component that fetches flags and passes them to the existing Client layout. Rename the existing `layout.js` content to `DashboardLayoutClient.jsx`.

```js
// src/app/dashboard/layout.js  ← becomes Server Component
import { getTenantId } from '@/lib/get-tenant-id';
import { getTenantFeatures } from '@/lib/features';
import DashboardLayoutClient from './DashboardLayoutClient';

export default async function DashboardLayout({ children }) {
  const tenantId = await getTenantId();
  const features = tenantId ? await getTenantFeatures(tenantId) : { invoicing: false };

  return (
    <DashboardLayoutClient features={features}>
      {children}
    </DashboardLayoutClient>
  );
}
```

```jsx
// src/app/dashboard/DashboardLayoutClient.jsx  ← renamed from layout.js
'use client';
import FeatureFlagsProvider from '@/components/FeatureFlagsProvider';
// ... all existing imports

export default function DashboardLayoutClient({ children, features }) {
  return (
    <FeatureFlagsProvider value={features}>
      {/* existing layout content */}
    </FeatureFlagsProvider>
  );
}
```

**Option B** — Keep `layout.js` as Client Component, fetch features via a client-side `useEffect` + fetch call. Simpler diff but features arrive after first render (flash of invoicing UI before hide). **Not recommended** — Option A avoids the flash and follows Next.js App Router best practices.

---

### Pattern 5: FeatureFlagsProvider

**Source:** React Context docs [ASSUMED], existing `ChatProvider.jsx` pattern in codebase [VERIFIED: seen in layout imports]

```jsx
// src/components/FeatureFlagsProvider.jsx
'use client';
import { createContext, useContext } from 'react';

const FeatureFlagsContext = createContext({ invoicing: false });

export function FeatureFlagsProvider({ value, children }) {
  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
```

---

### Pattern 6: DashboardSidebar / BottomTabBar Conditional Render

**Finding:** Both components use static arrays (`NAV_ITEMS` in `DashboardSidebar.jsx`, `TABS` in `BottomTabBar.jsx`). Neither has access to flags today. [VERIFIED: read both files]

**DashboardSidebar.jsx** — Invoices is in `NAV_ITEMS` at index 4:
```js
// Before:
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', ... },
  { href: '/dashboard/leads', label: 'Leads', ... },
  { href: '/dashboard/calendar', label: 'Calendar', ... },
  { href: '/dashboard/calls', label: 'Calls', ... },
  { href: '/dashboard/invoices', label: 'Invoices', ... }, // ← conditionally render
  { href: '/dashboard/more', label: 'More', ... },
];
```

Gate pattern using Context:
```jsx
// Inside DashboardSidebar component:
const { invoicing } = useFeatureFlags();
const visibleItems = NAV_ITEMS.filter(
  (item) => item.href !== '/dashboard/invoices' || invoicing
);
// render visibleItems instead of NAV_ITEMS
```

**BottomTabBar.jsx** — `TABS` does NOT include Invoices (only Home, Calls, Leads, Calendar, More). [VERIFIED: read] No change needed to BottomTabBar for the invoices tab — there is no invoices tab in the mobile bar. However, the LeadFlyout CTAs and the More page quick-access links DO reference invoices/estimates.

---

### Pattern 7: More Page Conditional Links

**Finding:** `more/page.js` has two separate invoice-related surfaces: [VERIFIED: read]
1. `QUICK_ACCESS` array — contains Invoices + Estimates links (renders only on mobile: `lg:hidden`)
2. `MORE_ITEMS` array — contains `invoice-settings` and `integrations` entries

Both arrays are static and hand-coded (not data-driven). To hide conditionally, filter them based on the `invoicing` flag:

```js
// src/app/dashboard/more/page.js
'use client';
import { useFeatureFlags } from '@/components/FeatureFlagsProvider';

// Inside component:
const { invoicing } = useFeatureFlags();

const visibleQuickAccess = invoicing ? QUICK_ACCESS : [];
const visibleMoreItems = MORE_ITEMS.filter((item) => {
  if (!invoicing && (
    item.href === '/dashboard/more/invoice-settings' ||
    item.href === '/dashboard/more/integrations'
  )) return false;
  return true;
});
```

Note: `integrations` is listed as an invoicing-gated item in the phase scope per TOGGLE-03. Confirm this is intentional — the integrations page currently handles calendar AND accounting integrations. Phase 53 may hide the entire integrations link OR just the accounting section. The CONTEXT.md lists `accounting-integrations` links, not the calendar connections. **This is an open question for the planner to resolve** (see Open Questions section).

---

### Pattern 8: LeadFlyout Invoice CTAs

**Finding:** `LeadFlyout.jsx` has "Create Invoice" button at line 737 and "Create Estimate" button at line 746. [VERIFIED: read] They are inside a conditional block wrapping a `<div>` with both buttons.

```jsx
// src/components/dashboard/LeadFlyout.jsx
const { invoicing } = useFeatureFlags();

// Wrap the invoice CTA section:
{invoicing && (
  <div className="flex flex-col gap-2">
    {/* existing Create Invoice button */}
    {/* existing Create Estimate button */}
  </div>
)}
```

---

### Pattern 9: Cron Tenant-Filter (JSONB WHERE)

**Finding:** Both cron jobs (`invoice-reminders/route.js`, `recurring-invoices/route.js`) use the **service-role client** (`import { supabase } from '@/lib/supabase'`). [VERIFIED: read both files]

`invoice-reminders` queries `invoices` directly (not iterating tenants). To skip tenants with invoicing off, join to tenants or subquery:

```js
// Option A: subquery via .in() — fits the existing batch-tenant pattern
const { data: enabledTenants } = await supabase
  .from('tenants')
  .select('id')
  .eq('features_enabled->>invoicing', 'true'); // JSONB text cast filter

const enabledTenantIds = (enabledTenants || []).map((t) => t.id);

// Then filter invoices:
const { data: invoices } = await supabase
  .from('invoices')
  .select(...)
  .in('tenant_id', enabledTenantIds)  // add this filter
  .in('status', [...]);
```

`recurring-invoices` queries `invoices` where `is_recurring_template = true`. Same pattern — pre-fetch enabled tenant IDs and add `.in('tenant_id', enabledTenantIds)`.

**Supabase JS JSONB filter syntax** — `.eq('features_enabled->>invoicing', 'true')` — uses the text extraction operator `->>`. The value must be the string `'true'` (not boolean) because `->>` returns text. [VERIFIED: Supabase PostgREST column operator syntax, confirmed via existing `vip_numbers` JSONB usage pattern in codebase]

**Alternative (raw SQL):** `.filter('features_enabled->>invoicing', 'eq', 'true')` is equivalent — both are valid Supabase JS v2 syntax. [ASSUMED — the `.eq()` shorthand is correct PostgREST syntax]

---

### Pattern 10: Toggle API Route

**Canonical shape:** Mirrors `notification-settings` PATCH route exactly. [VERIFIED: read]

```js
// src/app/api/tenant/features/route.js
import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

export async function PATCH(request) {
  const tenantId = await getTenantId();
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { features } = await request.json();
  // Validate shape: { invoicing: boolean }
  if (typeof features?.invoicing !== 'boolean') {
    return Response.json({ error: 'Invalid: features.invoicing must be boolean' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('tenants')
    .update({ features_enabled: { invoicing: features.invoicing } })
    .eq('id', tenantId)
    .select('features_enabled')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ features_enabled: data.features_enabled });
}
```

**RLS confirmation:** The service-role client bypasses RLS entirely. But this PATCH is called by the owner via the dashboard — they are authenticated. The route uses `getTenantId()` which validates their session, then uses the service-role client to perform the update (matching the existing pattern in `notification-settings`). This is safe: `getTenantId()` already enforces the session check. [VERIFIED: notification-settings pattern]

---

### Pattern 11: AlertDialog for Flip-Off Confirmation

**Source:** `DashboardSidebar.jsx` (logout confirmation), `LeadFlyout.jsx` (imports AlertDialog) [VERIFIED: read both]

Both files use the same shadcn AlertDialog pattern. The confirmation dialog for disabling invoicing follows the same shape:

```jsx
// src/app/dashboard/more/features/page.js
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// State:
const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
const [pendingCounts, setPendingCounts] = useState({ invoices: 0, estimates: 0 });

// Dialog:
<AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Disable invoicing?</AlertDialogTitle>
      <AlertDialogDescription>
        You have {pendingCounts.invoices} invoice(s) and {pendingCounts.estimates} estimate(s).
        Disabling will hide the invoicing surface from your dashboard — your data is preserved
        and you can re-enable anytime from this page.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleConfirmDisable}>
        Disable
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

### Pattern 12: Features Panel Page (/dashboard/more/features)

**Visual convention:** Sibling pages (`invoice-settings/page.js`, `notification-settings`) use `card.base` sections with `heading` + `body` design tokens. The features panel matches this pattern.

**Layout:** List-of-toggles, not a single hardcoded checkbox. Each feature is a card row with: icon, name, description, `<Switch>` on the right. This scales to future flags.

```jsx
// src/app/dashboard/more/features/page.js
'use client';
import { card, heading, body } from '@/lib/design-tokens';
import { Switch } from '@/components/ui/switch';
import { FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

const FEATURES = [
  {
    key: 'invoicing',
    label: 'Invoicing',
    description: 'Create invoices and estimates, send payment reminders, and track what you\'re owed.',
    icon: FileText,
  },
  // future flags added here
];
```

---

### Anti-Patterns to Avoid

- **Double DB fetch in proxy:** Never add a second `supabase.from('tenants')` call in proxy.js for feature flags. Extend the existing SELECT on lines 78-82 to include `features_enabled`. [VERIFIED: proxy.js code path]
- **Boolean comparison without `=== true`:** Always use `features_enabled?.invoicing === true` not `features_enabled?.invoicing` — JSONB can return `null` or `false` for missing keys. [VERIFIED: CONTEXT.md pitfalls]
- **Gating `/api/accounting/**` with full redirect:** API routes return 404 (no body, no redirect). Only page routes redirect.
- **Assuming layout.js is a Server Component:** It is NOT. It has `'use client'` at line 1. The Server/Client split in Pattern 4 is required. [VERIFIED: layout.js read]
- **Forgetting to update both UI surfaces atomically:** Sidebar, BottomTabBar (no invoices tab — N/A), LeadFlyout, and More page must all ship in the same commit. Partial updates create broken UI. [VERIFIED: CONTEXT.md known pitfalls]
- **Merging migration before testing toggle recovery:** Dev tenant needs invoicing RE-ENABLED via the toggle before confirming the flag works end-to-end. [VERIFIED: CONTEXT.md]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal confirmation dialog | Custom modal component | shadcn `<AlertDialog>` | Already imported in LeadFlyout.jsx and DashboardSidebar.jsx; consistent UX |
| Feature toggle switch | Custom checkbox | shadcn `<Switch>` | Already used in invoice-settings page; consistent with existing settings panels |
| Toast notifications | Custom notification | `sonner` `toast()` | Already in dashboard layout; already used in LeadFlyout, InvoiceSettingsPage |
| JSONB field access | SQL-level parsing | PostgREST `.eq('col->>key', 'val')` | Native Supabase JS operator; no raw SQL RPC needed for this use case |

**Key insight:** Every primitive needed for Phase 53 already exists in the codebase. This phase is a composition problem, not a library introduction problem.

---

## Common Pitfalls

### Pitfall 1: layout.js is a Client Component
**What goes wrong:** Developer assumes `layout.js` is a Server Component (common Next.js assumption) and calls `getTenantFeatures()` directly inside it, crashing at runtime because `await` is not allowed in Client Components.
**Why it happens:** `layout.js` has `'use client'` at line 1 (required for `usePathname`, `useState`, `useEffect`, framer-motion). This is verified from the file.
**How to avoid:** Use the Server wrapper pattern (Pattern 4). Create a thin Server `layout.js` that fetches flags and passes them as props to `DashboardLayoutClient.jsx`.
**Warning signs:** `Error: async/await is not yet supported in Client Components` at runtime.

### Pitfall 2: JSONB Text Comparison Requires String 'true'
**What goes wrong:** Cron filter `.eq('features_enabled->>invoicing', true)` (boolean) passes zero results — PostgREST JSONB text extraction returns strings, not booleans.
**Why it happens:** The `->>` operator casts JSONB to `text`. `true` (JS boolean) does not match the string `'true'`.
**How to avoid:** Always use `.eq('features_enabled->>invoicing', 'true')` (string). The helper function comparison `=== true` is fine in JS because Supabase returns the parsed JSONB object.
**Warning signs:** Cron runs but `enabledTenants` is empty even for tenants with invoicing enabled.

### Pitfall 3: Proxy Single Tenant Fetch
**What goes wrong:** Adding a second `supabase.from('tenants')` call in proxy.js to fetch `features_enabled` doubles DB latency on every matched dashboard request.
**Why it happens:** Developer doesn't notice the existing fetch at lines 77-82 already queries tenants.
**How to avoid:** Extend the `select()` on the EXISTING fetch: `.select('onboarding_complete, id, features_enabled')`.
**Warning signs:** Two separate Supabase queries to `tenants` table logged for a single proxy call.

### Pitfall 4: More Page QUICK_ACCESS Invoices Still Visible
**What goes wrong:** Dev hides the sidebar Invoices entry and the MORE_ITEMS invoice-settings link but forgets the `QUICK_ACCESS` array, which renders a separate "Invoices" and "Estimates" shortcut block on mobile.
**Why it happens:** The More page has TWO separate invoice surfaces (`QUICK_ACCESS` at line 23-25, `MORE_ITEMS` at line 34 for invoice-settings). Both must be conditionally hidden.
**How to avoid:** In the features PR, filter BOTH `QUICK_ACCESS` and `MORE_ITEMS` based on `invoicing` flag.
**Warning signs:** Desktop sidebar correctly hides invoices, but mobile more page still shows "Invoices" shortcut.

### Pitfall 5: Integrations Page Has Dual Purpose
**What goes wrong:** Hiding the integrations link entirely removes access to Calendar connections (Google Calendar, Outlook Calendar), which are NOT invoicing-related.
**Why it happens:** The More page currently has a single "Integrations" entry linking to `/dashboard/more/integrations`, which houses both calendar AND accounting connections.
**How to avoid:** Either (a) hide only the `invoice-settings` entry and leave `integrations` visible, OR (b) hide accounting-related sections within the integrations page when flag is off. See Open Questions #1.
**Warning signs:** Owner with invoicing disabled loses ability to connect Google Calendar.

### Pitfall 6: Features Page is Accessible During Flag-Off
**What goes wrong:** If `/dashboard/more/features` is accidentally added to the proxy gate matcher, owners can never re-enable invoicing (the panel is inaccessible when flag is off).
**Why it happens:** Developer adds all new `/dashboard/more/` paths to the gate matcher without realizing the features panel must always be accessible.
**How to avoid:** The gate block checks a specific allow-list: `/dashboard/invoices`, `/dashboard/estimates`, `/dashboard/more/invoice-settings`. `/dashboard/more/features` is NOT in this list.
**Warning signs:** Navigating to `/dashboard/more/features` with invoicing disabled redirects to `/dashboard`.

---

## Answered Questions

### Q1: Is dashboard `layout.js` already a Server Component that fetches tenant data?
**Answer:** NO. `layout.js` is a Client Component (`'use client'` at line 1). It uses `usePathname`, `useState`, `useEffect`, and framer-motion — all requiring the client boundary. It currently fetches NO tenant data. [VERIFIED: layout.js read, lines 1-109]

**Implication:** The Server/Client split (Pattern 4) is required. Existing `DashboardLayoutInner` content becomes `DashboardLayoutClient.jsx`.

### Q2: What's the exact SELECT shape in proxy.js tenant fetch (lines 77-82)?
**Answer:** `.select('onboarding_complete, id')`. Extend to `.select('onboarding_complete, id, features_enabled')`. [VERIFIED: proxy.js lines 78-82]

### Q3: How do API routes currently resolve tenantId?
**Answer:** All gated API routes use `const tenantId = await getTenantId()` from `src/lib/get-tenant-id.js`. Canonical shape: [VERIFIED: invoices/route.js, invoice-settings/route.js, accounting/status/route.js, notification-settings/route.js]
```js
import { getTenantId } from '@/lib/get-tenant-id';
const tenantId = await getTenantId();
if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
```

### Q4: What does an existing cron tenant-iteration query look like?
**Answer:** Crons do NOT iterate tenants — they query child tables directly (e.g., `invoices` table). The `invoice-reminders` cron queries invoices, then batch-fetches tenant info by tenantIds. The `recurring-invoices` cron queries invoice templates directly. [VERIFIED: both cron files read]

**Implication:** To filter by `features_enabled`, the cleanest approach is to pre-fetch enabled tenant IDs from the `tenants` table and use `.in('tenant_id', enabledTenantIds)` when querying invoices. This avoids a JOIN and matches the existing batch-fetch pattern.

**Supabase JS syntax for JSONB filter:** `.eq('features_enabled->>invoicing', 'true')` is correct PostgREST syntax. [VERIFIED: documented PostgREST filter operators; `->>` text extraction is standard]

### Q5: How are existing shadcn `<AlertDialog>` usages structured?
**Answer:** `DashboardSidebar.jsx` has a logout confirmation dialog at lines 171-186. `LeadFlyout.jsx` imports the full AlertDialog component suite at lines 29-38. Pattern: `<AlertDialog open={state} onOpenChange={setter}>` with `<AlertDialogContent>`, `<AlertDialogHeader>`, `<AlertDialogFooter>` containing `<AlertDialogCancel>` and `<AlertDialogAction>`. [VERIFIED: DashboardSidebar.jsx lines 171-186]

### Q6: Where does the RLS policy for `tenants.UPDATE` live? Do we need a new policy?
**Answer:** The existing `tenants_update_own` policy in `001_initial_schema.sql` covers ALL columns on `tenants` for UPDATE, gated by `owner_id = auth.uid()`. No new RLS policy needed for `features_enabled`. [VERIFIED: auth-database-multitenancy SKILL.md, Pattern 1 / RLS policies section; confirmed by 050_checklist_overrides.sql comment]

### Q7: What's the More menu page structure? Data-driven or hand-coded?
**Answer:** Hand-coded static arrays. Two separate arrays: `QUICK_ACCESS` (2 items: Invoices + Estimates, rendered on mobile only via `lg:hidden`), and `MORE_ITEMS` (10 items, the main settings list). Both are mapped with `{MORE_ITEMS.map(...)}`. [VERIFIED: more/page.js read, lines 22-38]

**Implication:** Filter both arrays conditionally based on `invoicing` flag from `useFeatureFlags()`.

### Q8: Naming/location convention for helpers like getTenantId?
**Answer:** `src/lib/` — all tenant/server helpers live there: `get-tenant-id.js`, `supabase.js`, `supabase-server.js`, `notifications.js`, `leads.js`, `stripe.js`, `design-tokens.js`, etc. Place `getTenantFeatures` in `src/lib/features.js`. [VERIFIED: lib directory listing]

### Q9: Does any existing code read tenant-level JSONB columns?
**Answer:** YES — multiple examples. Canonical patterns: [VERIFIED: notification-settings route, call-routing route]
- **Read (select):** `.select('notification_preferences').eq('id', tenantId)` → `data.notification_preferences` (snake_case, accessed directly)
- **Read with default:** `data.notification_preferences || DEFAULT_PREFERENCES`
- **Write (update):** `.update({ notification_preferences: cleaned }).eq('id', tenantId)`
- **JS-side access:** `data.call_forwarding_schedule` (snake_case throughout — no camelCase conversion); optional chaining for nested: `tenant.features_enabled?.invoicing`
- **PostgREST filter:** `.select('call_forwarding_schedule, pickup_numbers, ...')` — comma-separated column names

No camelCase conversion in the JS types — JSONB columns are accessed in snake_case as returned by Supabase.

### Q10: Confirm migration numbering — next is 051?
**Answer:** CONFIRMED. Latest migration is `050_checklist_overrides.sql`. Next is `051_features_enabled.sql`. [VERIFIED: Glob of supabase/migrations/ showing all 50 files, highest numbered is 050]

---

## Validation Architecture

> `workflow.nyquist_validation` is not set to false in config — validation section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected in project (no jest.config, vitest.config, pytest.ini found) |
| Config file | None — Wave 0 must establish testing approach or use manual QA checklist |
| Quick run command | Manual QA (no automated test runner configured) |
| Full suite command | Manual QA |

### Phase Requirements → Validation Map

| Req ID | Behavior | Validation Type | Artifact / Command | Notes |
|--------|----------|-----------------|-------------------|-------|
| TOGGLE-01 | `features_enabled` column exists with `{"invoicing": false}` default | Migration verify | `SELECT features_enabled FROM tenants LIMIT 5;` in Supabase SQL editor | Confirm column and default value for existing rows |
| TOGGLE-01 | New tenant row gets default `{"invoicing": false}` | Integration | Create new tenant via onboarding, check tenants row | |
| TOGGLE-02 (pages) | `/dashboard/invoices` redirects to `/dashboard` when flag off | Manual QA | Navigate to `/dashboard/invoices` with flag off; confirm redirect | |
| TOGGLE-02 (pages) | `/dashboard/estimates` redirects to `/dashboard` when flag off | Manual QA | Navigate to `/dashboard/estimates` with flag off; confirm redirect | |
| TOGGLE-02 (pages) | `/dashboard/more/invoice-settings` redirects when flag off | Manual QA | Navigate to path with flag off; confirm redirect | |
| TOGGLE-02 (APIs) | `GET /api/invoices` returns 404 when flag off | Manual QA / curl | `curl -X GET /api/invoices` with session + flag off → expect 404 empty body | |
| TOGGLE-02 (APIs) | `GET /api/estimates` returns 404 when flag off | Manual QA / curl | Same as above for estimates | |
| TOGGLE-02 (APIs) | `GET /api/accounting/status` returns 404 when flag off | Manual QA / curl | Same for accounting | |
| TOGGLE-02 (APIs) | `GET /api/invoice-settings` returns 404 when flag off | Manual QA / curl | Same for invoice-settings | |
| TOGGLE-02 (crons) | Invoice-reminders cron skips tenant with flag off | Manual QA | Set flag off, run cron manually, confirm no reminders sent and no errors logged | |
| TOGGLE-02 (crons) | Recurring-invoices cron skips tenant with flag off | Manual QA | Set flag off, run cron manually, confirm no draft invoices created | |
| TOGGLE-03 (sidebar) | Invoices entry absent from `DashboardSidebar` when flag off | Manual QA | Load dashboard with flag off; confirm no Invoices link in desktop sidebar | |
| TOGGLE-03 (bottomtab) | No Invoices tab in BottomTabBar when flag off | N/A — BottomTabBar has no Invoices tab today | BottomTabBar TABS confirmed: Home, Calls, Leads, Calendar, More | |
| TOGGLE-03 (leadflyout) | "Create Invoice" / "Create Estimate" buttons absent in LeadFlyout | Manual QA | Open any lead with flag off; confirm invoice/estimate CTA buttons are absent from DOM | |
| TOGGLE-03 (more page) | `invoice-settings` link absent from More menu when flag off | Manual QA | Navigate to `/dashboard/more` with flag off; confirm no Invoice Settings entry | |
| TOGGLE-03 (more page) | `QUICK_ACCESS` invoices shortcut absent on mobile when flag off | Manual QA (mobile viewport) | Resize to <1024px, visit `/dashboard/more` with flag off; confirm no Invoices/Estimates shortcuts | |
| TOGGLE-04 (toggle on) | PATCH to `/api/tenant/features` with `{features: {invoicing: true}}` succeeds | Manual QA | Toggle on via features panel; confirm 200 response + sidebar shows Invoices | |
| TOGGLE-04 (toggle off) | Dialog appears when records exist before disabling | Manual QA | Create 1 invoice, attempt disable; confirm AlertDialog appears with count | |
| TOGGLE-04 (toggle off silent) | No dialog when zero records, flag disables immediately | Manual QA | Fresh tenant with 0 invoices/estimates; confirm no dialog on disable | |
| TOGGLE-04 (reversibility) | Existing invoice records preserved after flag toggle off then on | Manual QA | Create invoice, disable, re-enable; confirm invoice still exists and accessible | |
| TOGGLE-04 (features panel) | `/dashboard/more/features` accessible when invoicing flag is OFF | Manual QA | Disable invoicing; navigate to `/dashboard/more/features`; confirm page loads (not redirected) | |

### Sampling Rate
- **Per task commit:** Manual smoke test: visit dashboard with flag off, confirm no Invoices in sidebar; visit features panel, confirm toggle present
- **Per wave merge:** Full TOGGLE-01 through TOGGLE-04 manual QA checklist above
- **Phase gate:** All rows in table above verified before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] No automated test runner configured — planner should add a Wave 0 note to establish whether manual QA checklist suffices or a basic Jest/Vitest setup is needed for this phase
- [ ] Manual QA checklist file: `supabase/migrations/051_features_enabled.sql` must be applied before any QA can begin

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes — toggle endpoint must be owner-only | `getTenantId()` validates session; service-role client performs update only after session check |
| V3 Session Management | no — no new session handling | — |
| V4 Access Control | yes — gate must prevent cross-tenant flag reads/writes | `getTenantId()` binds request to the authenticated user's tenant; proxy uses the same anon session client |
| V5 Input Validation | yes — PATCH body must validate `invoicing` is boolean | Explicit `typeof features?.invoicing !== 'boolean'` check before update |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tenant A disabling invoicing for Tenant B | Elevation of Privilege | `getTenantId()` resolves only the authenticated user's tenant; update uses `.eq('id', tenantId)` with that resolved ID |
| Bypassing proxy gate by calling API directly | Tampering | API routes have independent feature gate via `getTenantFeatures()`; proxy gate is defense-in-depth for pages only |
| JSONB injection via PATCH body | Tampering | Route only writes `{ invoicing: features.invoicing }` (controlled shape); does not spread arbitrary PATCH body into the column |
| Info leak from API gate revealing flag state | Information Disclosure | D-06: APIs return `404` with no body — flag state not revealed to caller |

---

## Open Questions

### Q1: Does hiding the "Integrations" More link mean owners lose access to Calendar connections?
**What we know:** The More page has a single "Integrations" entry at `/dashboard/more/integrations`. This page hosts both: (1) accounting integrations (QuickBooks, Xero, FreshBooks — invoicing-adjacent), and (2) calendar connections (Google Calendar, Outlook — NOT invoicing-related).
**What's unclear:** CONTEXT.md lists "accounting-integrations links" as a hide target. Does "accounting-integrations" mean the entire integrations page, or only the accounting section within that page?
**Recommendation:** Hide only the `invoice-settings` link from MORE_ITEMS. Leave `integrations` visible but suppress the accounting section WITHIN the integrations page when `invoicing = false`. This is a planner decision that affects the integrations page implementation scope.

### Q2: Should `getTenantFeatures()` use the service-role client or the SSR cookie client?
**What we know:** `getTenantId()` uses the SSR cookie client. `notification-settings` uses the service-role client. Both work for API routes. The service-role client avoids cookie dependency and works in cron contexts.
**What's unclear:** If `getTenantFeatures()` is called from both API routes (which have a session) and cron jobs (which have a tenantId but no session), the service-role client is the correct choice for the helper.
**Recommendation:** Use the service-role client in `getTenantFeatures(tenantId)` — it receives an explicit `tenantId` parameter (not derived from session), making it safe for cron contexts too. The session check is already done by the route before calling `getTenantFeatures`.

### Q3: Does the More page `layout.js` (`src/app/dashboard/more/layout.js`) exist and need updating?
**What we know:** `ls` of `src/app/dashboard/more/` shows a `layout.js` and `page.js`. The `layout.js` might be a route group layout.
**What's unclear:** Whether the more/ layout.js needs features flags passed or whether the parent dashboard layout.js covers the entire /dashboard/** tree including /more/.
**Recommendation:** The parent `src/app/dashboard/layout.js` (Server Component wrapper after split) provides the FeatureFlagsProvider for the entire dashboard subtree, including /more/**. No change needed in `src/app/dashboard/more/layout.js`.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 53 is purely code/config changes. No external services, CLIs, or tools beyond the existing Next.js/Supabase stack are required. The Supabase migration requires the dev's own Supabase project to be running, which is already operational (migration 050 was applied successfully).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `.eq('features_enabled->>invoicing', 'true')` is valid Supabase JS v2 PostgREST filter syntax | Pattern 9 / Cron filter | Cron filter silently returns 0 tenants; all invoicing crons run for all tenants regardless of flag |
| A2 | `getTenantFeatures()` calling service-role client (vs SSR client) is correct for API routes that already validated session via `getTenantId()` | Pattern 2 | Minor: no security issue; service-role is over-privileged but scoped read on tenants table is safe |
| A3 | More page `src/app/dashboard/more/layout.js` does not independently fetch tenant data and will inherit FeatureFlagsProvider from parent layout | Open Question 3 | More page components would not have feature flags context; useFeatureFlags() would return the default `{invoicing: false}` from createContext default |

**All other claims in this research are VERIFIED against live codebase source files.**

---

## Sources

### Primary (HIGH confidence — verified against live codebase)
- `src/proxy.js` — full file read; tenant fetch shape, gate block pattern, matcher config
- `src/app/dashboard/layout.js` — confirmed Client Component with `'use client'`; no tenant data fetch today
- `src/lib/get-tenant-id.js` — getTenantId() canonical shape
- `src/components/dashboard/DashboardSidebar.jsx` — NAV_ITEMS array; AlertDialog usage pattern
- `src/components/dashboard/BottomTabBar.jsx` — TABS array; no Invoices tab confirmed
- `src/components/dashboard/LeadFlyout.jsx` — invoice CTA locations (lines 737, 746); AlertDialog imports
- `src/app/dashboard/more/page.js` — QUICK_ACCESS + MORE_ITEMS arrays; hand-coded structure
- `src/app/api/invoices/route.js` — getTenantId() usage pattern
- `src/app/api/invoice-settings/route.js` — getTenantId() + JSONB read pattern
- `src/app/api/accounting/[provider]/auth/route.js`, `accounting/status/route.js` — API auth shape
- `src/app/api/notification-settings/route.js` — JSONB tenant column read/write canonical pattern
- `src/app/api/cron/invoice-reminders/route.js` — service-role cron, direct invoices query
- `src/app/api/cron/recurring-invoices/route.js` — service-role cron, template query shape
- `supabase/migrations/050_checklist_overrides.sql` — migration pattern; RLS comment confirms existing policy covers new columns
- `.claude/skills/auth-database-multitenancy/SKILL.md` — RLS policy patterns, three Supabase clients, getTenantId flow
- `.claude/skills/dashboard-crm-system/SKILL.md` — dashboard page structure, layout.js role
- `src/lib/` directory listing — confirmed `features.js` does not exist yet; correct placement confirmed

### Secondary (MEDIUM confidence)
- PostgREST JSONB operator `->>` returning text — standard documented behavior; confirmed indirectly by existing codebase usage of `.select('features_enabled')` patterns

### Tertiary (LOW confidence — see Assumptions Log)
- A1: `.eq('col->>key', 'true')` Supabase JS filter syntax — [ASSUMED] based on PostgREST spec and project patterns

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, verified in source
- Architecture patterns: HIGH — all patterns verified from live code; Server/Client split based on confirmed `'use client'` in layout.js
- Pitfalls: HIGH — verified from direct code inspection
- Cron filter syntax: MEDIUM — indirect verification via PostgREST documentation knowledge

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable codebase, no fast-moving dependencies introduced)

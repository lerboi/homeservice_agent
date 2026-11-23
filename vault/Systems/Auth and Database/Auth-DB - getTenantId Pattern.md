---
type: system
system: Auth and Database
status: current
description: "getTenantId Pattern. Covers: Signature; Resolution Flow; `src/lib/features.js` — getTenantFeatures(tenantId) (added Phase 53); `tenants.features_enabled` column (added Phase 53, migration 051)"
source: .claude/skills/auth-database-multitenancy/SKILL.md § 2. getTenantId Pattern
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# getTenantId Pattern

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

**File**: `src/lib/get-tenant-id.js`

### Signature

```js
export async function getTenantId() → Promise<string|null>
```

### Resolution Flow

```js
const serverSupabase = await createSupabaseServer();
const { data: { user } } = await serverSupabase.auth.getUser();
if (!user) return null;

const { data: tenant } = await serverSupabase   // same session client
  .from('tenants')
  .select('id')
  .eq('owner_id', user.id)
  .maybeSingle();

return tenant?.id || null;
```

**Key design**: Uses `user.id` (the Supabase auth UID) to query `tenants.owner_id`. Does NOT use `user.user_metadata` — tenant_id is never stored in Supabase auth user_metadata. The tenants table is the authoritative source.

**Single client usage**: Uses `createSupabaseServer()` (the session-scoped anon client) for both the auth check AND the tenants query. Because the tenants table has an RLS policy `owner_id = auth.uid()`, the session client can only see the authenticated user's own tenant row — this enforces tenant isolation as defense-in-depth. There is no RLS chicken-and-egg problem because the user's session is already established when the query runs.

### `src/lib/features.js` — getTenantFeatures(tenantId) (added Phase 53)

Returns the per-tenant feature flags from `tenants.features_enabled`. Companion to `getTenantId()`.

```js
import { getTenantFeatures } from '@/lib/features';

const features = await getTenantFeatures(tenantId);
if (!features.invoicing) {
  return new Response(null, { status: 404 }); // gate API route
}
```

- **Service-role client** (`@/lib/supabase`) — works in cron contexts (no session) AND in API routes (caller already validated session via `getTenantId()` before reaching this helper).
- Takes `tenantId` as an **explicit param** — not derived from session — making it safe across all execution contexts (route handler, cron, server component).
- **Fail-CLOSED**: any error / missing row / null column / falsy tenantId returns `{ invoicing: false }`. A DB outage cannot accidentally enable a flag.
- **Return shape is an object** so future flags compose without breaking call sites. Each flag is normalized via strict equality (`=== true`) so JSONB nulls / missing keys map to `false`.
- **JSONB filter syntax for crons** (bypasses the helper — filter at the query level instead): `.eq('features_enabled->>invoicing', 'true')`. Note the value is the **string `'true'`**, not the boolean — PostgREST's `->>` operator returns text. Phase 53 `/api/cron/invoice-reminders` and `/api/cron/recurring-invoices` use this pattern to skip invoicing-disabled tenants at the SQL level. (2026-08-20: both crons are UNSCHEDULED from `vercel.json` and no-op gated on the new `INVOICING_ENABLED` master flag — invoicing v1 freeze; the pattern above still applies when re-enabled.)
- **Invoicing v1 master freeze (2026-08-20)**: new `src/lib/invoicing-enabled.js` exports `INVOICING_ENABLED` (`NEXT_PUBLIC_INVOICING_ENABLED === 'true'`, fail-closed — mirrors `integrations-enabled.js`). While off: `PATCH /api/tenant/features` rejects `invoicing: true` with 403 (disabling stays allowed), the `/dashboard/more/features` toggle renders disabled with a "Coming soon" badge, and the two invoicing crons no-op. This is GLOBAL and distinct from the per-tenant `features_enabled.invoicing` flag — it closes the self-serve enable door so the crons could be unscheduled without a silent-breakage trap. Re-enable checklist lives in the flag file (flip flag + re-add both cron schedules to `vercel.json`).

### `tenants.features_enabled` column (added Phase 53, migration 051)

- **Column**: `features_enabled JSONB NOT NULL DEFAULT '{"invoicing": false}'::jsonb`
- **Shape**: `{ invoicing: boolean, ... }` — a single JSONB map for all per-tenant feature flags.
- **Default** `{"invoicing": false}` for ALL tenants — Voco v6.0 ships invoicing OFF; owners opt in via `/dashboard/more/features`.
- **Future flags** (xero, jobber, …) extend this same column — no per-flag column proliferation.
- **Read** via `getTenantFeatures(tenantId)` (above) in API routes / crons, or via the `useFeatureFlags()` hook in dashboard client components (mounted by `FeatureFlagsProvider` at the dashboard layout).
- **Write** via `PATCH /api/tenant/features` from the `/dashboard/more/features` panel — merged into the existing JSONB map, not overwritten.
- **RLS**: existing `tenants_update_own` direct-owner policy covers SELECT/UPDATE on every column including this one; no new policy needed.
- **Proxy tenant fetch**: `src/proxy.js` extends its existing tenant SELECT to `'onboarding_complete, id, features_enabled'` — ONE read per request, reused by both the onboarding gate and the invoicing page gate. **Pitfall:** do NOT add a second `supabase.from('tenants')` call for feature reads in middleware; extend this existing SELECT.

---

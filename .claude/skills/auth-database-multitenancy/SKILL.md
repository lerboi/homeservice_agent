---
name: auth-database-multitenancy
description: "Complete architectural reference for authentication, database schema, and multi-tenant isolation — Supabase Auth, proxy auth guards, three Supabase client types, RLS policies, all 50 migrations with table definitions, getTenantId pattern, and tenant data isolation. Use this skill whenever making changes to auth proxy, RLS policies, database migrations, Supabase client usage, tenant isolation, or adding new tables. Also use when the user asks about how auth works, wants to add a new migration, or needs to debug RLS or tenant access issues."
---

# Auth, Database & Multi-Tenancy — Complete Reference

This document is the single source of truth for authentication, Supabase client patterns, row-level security, and the full database schema. Read this before making any changes to auth, RLS policies, migrations, or adding new tables.

**Last updated**: 2026-04-15 (Migration 050 — Setup checklist overrides: `tenants.checklist_overrides` JSONB column for per-item dismissal and custom-completion persistence)

---

## Architecture Overview

| Layer | File(s) | Purpose |
|-------|---------|---------|
| **Middleware Auth Guard** | `src/proxy.js` | Cookie-based auth check, onboarding redirect logic |
| **Server Client** | `src/lib/supabase-server.js` | `createSupabaseServer()` — SSR cookie-based for server components and API routes |
| **Service Role Client** | `src/lib/supabase.js` | Service role — bypasses RLS, used by webhook handlers and server-side writes |
| **Browser Client** | `src/lib/supabase-browser.js` | `createBrowserClient()` — anon key, for client components and Realtime subscriptions |
| **Tenant Resolver** | `src/lib/get-tenant-id.js` | `getTenantId()` — resolves authenticated user to their tenant_id |
| **RLS Policies** | All migration files | Two-pattern tenant isolation enforced at DB level |
| **Migrations** | `supabase/migrations/` | 52 sequential migrations building full schema |
| **Admin Helper** | `src/lib/admin.js` | `verifyAdmin()` — session auth + admin_users check for API routes |

```
HTTP Request arrives
       ↓
  middleware.js (uses ANON KEY + cookie store)
       ↓  getUser() then path-based routing
  /admin/* path?
    → No user → redirect /auth/signin?redirect=...
    → User, no admin_users row → rewrite /admin/forbidden (403)
    → User, has admin_users row → return response (skip tenant/onboarding logic)
  AUTH_REQUIRED_PATHS check (/onboarding, /dashboard)
  Unauthenticated → redirect /auth/signin
  Authenticated → check onboarding_complete for /onboarding* paths
       ↓
  Route renders
       ↓
  Server Component or API route
       ├── createSupabaseServer() — SSR cookie-based client (anon key)
       │     auth.getUser() → verifies session
       │
       ├── getTenantId() pattern
       │     createSupabaseServer().auth.getUser() → user.id
       │     serverSupabase.from('tenants').eq('owner_id', user.id) → tenant.id  (same session client — RLS enforces isolation)
       │
       └── verifyAdmin() pattern (admin API routes)
             createSupabaseServer().auth.getUser() → user
             supabase (service role).from('admin_users').eq('user_id', user.id) → returns user if admin

Webhook path (Stripe, cron jobs) and external services (LiveKit agent):
  Stripe webhook / LiveKit agent → supabase (service role client) → bypasses RLS for cross-tenant writes

Realtime subscriptions (browser):
  Dashboard leads page → supabase-browser client → filtered by tenant_id via RLS
```

---

## File Map

| File | Role |
|------|------|
| `src/proxy.js` | Auth guard middleware — cookie-based auth, onboarding redirect, AUTH_REQUIRED_PATHS, admin gate |
| `src/lib/supabase.js` | Service role client — bypasses RLS, used by webhooks and server-side API routes |
| `src/lib/supabase-server.js` | `createSupabaseServer()` factory — SSR cookie-based client for server components |
| `src/lib/supabase-browser.js` | Browser client — anon key, client components and Realtime |
| `src/lib/get-tenant-id.js` | `getTenantId()` — user → tenant_id resolution via tenants table |
| `src/lib/admin.js` | `verifyAdmin()` — session auth + admin_users check; used by all /api/admin/* routes |
| `supabase/migrations/001_initial_schema.sql` | tenants, calls tables + RLS + service_role bypass |
| `supabase/migrations/002_onboarding_triage.sql` | services table, triage columns on calls, working_hours stub |
| `supabase/migrations/003_scheduling.sql` | appointments, service_zones, zone_travel_buffers, calendar_credentials, calendar_events, book_appointment_atomic RPC |
| `supabase/migrations/004_leads_crm.sql` | leads, lead_calls, activity_log + REPLICA IDENTITY FULL + Realtime |
| `supabase/migrations/005_setup_checklist.sql` | setup_checklist_dismissed column on tenants |
| `supabase/migrations/006_escalation_contacts.sql` | escalation_contacts table + services.sort_order column |
| `supabase/migrations/007_outlook_calendar.sql` | calendar_credentials.is_primary + appointments.external_event_id/provider |
| `supabase/migrations/008_call_outcomes.sql` | calls.booking_outcome, exception_reason, notification_priority |
| `supabase/migrations/009_recovery_sms_tracking.sql` | calls.recovery_sms_status, retry_count, last_error, last_attempt_at |
| `supabase/migrations/010_billing_schema.sql` | subscriptions, stripe_webhook_events tables + RLS |
| `supabase/migrations/011_country_provisioning.sql` | phone_inventory, phone_inventory_waitlist tables + assign_sg_number RPC |
| `supabase/migrations/012_admin_users.sql` | admin_users table + RLS self-read policy |
| `supabase/migrations/013_usage_events.sql` | usage_events idempotency table + increment_calls_used RPC |
| `supabase/migrations/014_owner_notify_mode.sql` | SUPERSEDED by 015 — added owner_notify_mode (now dropped) |
| `supabase/migrations/015_notification_preferences.sql` | notification_preferences JSONB on tenants + drops owner_notify_mode |
| `supabase/migrations/016_billing_notifications.sql` | billing_notifications table for idempotent trial/payment notifications |
| `supabase/migrations/017_overage_billing.sql` | overage_stripe_item_id column on subscriptions |
| `supabase/migrations/018_intake_questions.sql` | intake_questions jsonb column on services |
| `supabase/migrations/019_appointments_exclusion_constraint.sql` | GiST exclusion constraint `appointments_no_overlap` — replaces UNIQUE(tenant_id, start_time), prevents overlapping time ranges for non-cancelled appointments |
| `supabase/migrations/020_billing_notifications_unique.sql` | UNIQUE constraint on billing_notifications (tenant_id, notification_type) |
| `supabase/migrations/021_fix_subscriptions_rls.sql` | Fix subscriptions RLS policies |
| `supabase/migrations/022_fix_missing_cascades.sql` | Add missing ON DELETE CASCADE to FKs |
| `supabase/migrations/023_livekit_migration.sql` | Retell→LiveKit renames: retell_call_id→call_id, retell_metadata→call_metadata, retell_phone_number→phone_number + call_provider, egress_id columns |
| `supabase/migrations/024_schema_hardening.sql` | set_updated_at() trigger on leads, admin_users.role CHECK constraint, indexes on waitlist email + zone_travel_buffers tenant_id |
| `supabase/migrations/025_fix_book_appointment_atomic.sql` | Re-create book_appointment_atomic RPC — fix "column scheduled does not exist" error from manual DB edit |
| `supabase/migrations/026_address_fields.sql` | postal_code + street_name columns on appointments and leads, update book_appointment_atomic with new address params |
| `supabase/migrations/027_lock_rpc_functions.sql` | REVOKE EXECUTE FROM PUBLIC on book_appointment_atomic + assign_sg_number, GRANT to service_role only |
| `supabase/migrations/028_calls_tenant_cascade.sql` | Add ON DELETE CASCADE to calls.tenant_id FK (was RESTRICT, blocked tenant deletion) |
| `supabase/migrations/029_invoice_schema.sql` | invoice_settings, invoice_sequences, invoices, invoice_line_items tables + get_next_invoice_number RPC + invoice-logos storage bucket + RLS |
| `supabase/migrations/030_accounting_integrations.sql` | accounting_credentials, accounting_sync_log tables + RLS (QuickBooks/Xero/FreshBooks integration) |
| `supabase/migrations/030_estimates_schema.sql` | estimate_sequences, estimates, estimate_tiers, estimate_line_items tables + get_next_estimate_number RPC + estimate_prefix on invoice_settings + RLS |
| `supabase/migrations/031_payment_log_schema.sql` | invoice_payments table + expand invoices.status CHECK (add partially_paid) + expand invoice_line_items.item_type CHECK (add late_fee) + RLS |
| `supabase/migrations/032_reminders_recurring.sql` | invoice_reminders table + late fee settings on invoice_settings + recurring invoice columns on invoices + RLS |
| `supabase/migrations/033_lock_counter_functions.sql` | REVOKE EXECUTE FROM PUBLIC on get_next_invoice_number + get_next_estimate_number, GRANT to service_role + authenticated |
| `supabase/migrations/034_add_skipped_sms_status.sql` | Expand calls.recovery_sms_status CHECK to add 'skipped' (for short calls and booked callers) |
| `supabase/migrations/035_lead_email_and_invoice_title.sql` | email column on leads + title column on invoices |
| `supabase/migrations/036_rename_high_ticket_to_urgent.sql` | Rename urgency tier 'high_ticket'→'urgent' across calls, leads, appointments, services CHECK constraints + data migration |
| `supabase/migrations/038_schema_hardening_2.sql` | Indexes (idx_subscriptions_stripe_customer_id) + `set_primary_calendar(p_tenant_id, p_provider)` RPC (atomic primary-calendar swap, SECURITY DEFINER, service_role only) |
| `supabase/migrations/040_call_recordings_storage_policy.sql` | Phase 38 — Storage bucket `call-recordings` (private) + RLS policy `tenant_read_recordings`: owners can SELECT objects under their `{tenant_id}/` folder. Agent writes via S3 service-role (bypasses RLS). |
| `supabase/migrations/041_calls_realtime.sql` | Phase 38 — `ALTER PUBLICATION supabase_realtime ADD TABLE calls` + `REPLICA IDENTITY FULL`. Enables the dashboard's Realtime subscription on `calls` (dashboard/calls/page.js). |
| `supabase/migrations/042_call_routing_schema.sql` | Phase 39 — call routing schema: tenants gains call_forwarding_schedule JSONB (schedule evaluator input), pickup_numbers JSONB (CHECK len ≤ 5), dial_timeout_seconds INTEGER; calls gains routing_mode TEXT (nullable, CHECK IN ('ai','owner_pickup','fallback_to_ai')) + outbound_dial_duration_sec INTEGER; idx_calls_tenant_month index supports monthly outbound cap SUM query |
| `supabase/migrations/043_appointments_realtime.sql` | Phase 41 — `ALTER PUBLICATION supabase_realtime ADD TABLE appointments` + `REPLICA IDENTITY FULL`. Enables the calendar page to reflect AI-created bookings in real time (DELETE events require FULL for row filtering). |
| `supabase/migrations/044_ai_voice_column.sql` | Phase 44 — Add ai_voice TEXT column to tenants with CHECK constraint (Phase 44: AI Voice Selection). NULL = fallback to tone-based VOICE_MAP. |
| `supabase/migrations/045_sms_messages_and_call_sid.sql` | Phase 40 — sms_messages table + call_sid on calls |
| `supabase/migrations/046_calendar_blocks_and_completed_at.sql` | Phase 42 — calendar_blocks table (id, tenant_id, title, start_time, end_time, is_all_day, note, created_at) with 4 RLS tenant policies + index; appointments gains completed_at timestamptz |
| `supabase/migrations/047_calendar_blocks_external_event.sql` | Phase 42 — calendar_blocks gains external_event_id TEXT for Google/Outlook sync |
| `supabase/migrations/048_calendar_blocks_group_id.sql` | Phase 42 — calendar_blocks gains group_id UUID to link multi-day blocks for bulk delete; partial index on group_id WHERE NOT NULL |
| `supabase/migrations/049_vip_caller_routing.sql` | Phase 46 — VIP/Priority caller direct routing: tenants gains `vip_numbers` JSONB (standalone priority numbers); leads gains `is_vip` BOOLEAN NOT NULL DEFAULT false; sparse index `idx_leads_vip_lookup` on (tenant_id, from_number) WHERE is_vip = true powers the webhook's lead-based priority lookup. |
| `supabase/migrations/050_checklist_overrides.sql` | Phase 48 — Setup checklist per-item override persistence: tenants gains `checklist_overrides` JSONB NOT NULL DEFAULT '{}'. Consumed by `src/app/api/setup-checklist/route.js` to persist user dismissals and custom mark-done actions without adding row-per-item state. |
| `supabase/migrations/051_features_enabled.sql` | Phase 53 — Feature flag infrastructure: tenants gains `features_enabled JSONB NOT NULL DEFAULT '{"invoicing": false}'::jsonb` (shape: `{ invoicing: boolean, ... }`). No backfill needed — DEFAULT applies to existing rows on column add. No RLS policy change (existing `tenants_update_own` direct-owner policy covers SELECT/UPDATE on every column including this one). Foundation for the v6.0 invoicing toggle and future per-tenant feature flags (xero, jobber, …). Read via `getTenantFeatures(tenantId)` in `src/lib/features.js`; consumed by `FeatureFlagsProvider` at dashboard layout and by `/api/invoices/**`, `/api/estimates/**`, `/api/accounting/**` API gates. |
| `supabase/migrations/052_integrations_schema.sql` | Phase 54 — **Integration credentials foundation** (originally planned as `051_integrations_schema` before Phase 53 renumber collision; file ships as 052 on disk). Sequenced transactional migration on `accounting_credentials`: (1) `DELETE FROM accounting_credentials WHERE provider IN ('quickbooks','freshbooks')` — purge pre-v6.0 rows before CHECK swap; (2) `DROP CONSTRAINT accounting_credentials_provider_check`; (3) `ADD CONSTRAINT accounting_credentials_provider_check CHECK (provider IN ('xero','jobber'))` — QB + FB values permanently invalid; (4) `ADD COLUMN scopes TEXT[] NOT NULL DEFAULT '{}'::text[]` — populated by `/api/integrations/[provider]/callback` with granular OAuth scopes (Xero post-2026-03-02 scope set; Jobber equivalents); (5) `ADD COLUMN last_context_fetch_at TIMESTAMPTZ` NULL — populated by Phase 55+ `fetchCustomerByPhone` for telemetry. **No new indexes** — existing `UNIQUE (tenant_id, provider)` covers tenant-scoped reads. **Python compatibility:** `TEXT[]` → `list[str]`, `TIMESTAMPTZ` → `datetime` (for livekit-agent service-role reads in Phase 55+). **Forward-compat:** adding a future provider requires another DROP + ADD constraint cycle (same pattern). |
| `src/lib/stripe.js` | Stripe SDK singleton — server-side, reads STRIPE_SECRET_KEY |

---

## 1. Three Supabase Clients

The codebase uses exactly three Supabase clients, each with a distinct purpose. Using the wrong client is a common bug source.

### `src/lib/supabase.js` — Service Role Client

```js
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
```

**Purpose**: Bypasses RLS entirely. Used by:
- Webhook handlers (Stripe, Google, Outlook) and external services (LiveKit agent) — must write to any tenant's data
- Server-side API routes that need cross-tenant reads (e.g., `processCallAnalyzed`)
- Cron jobs

**Warning**: Never expose to browser. `SUPABASE_SERVICE_ROLE_KEY` is server-only.

### `src/lib/supabase-server.js` — SSR Cookie-Based Client

```js
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}
```

**Purpose**: Server components and API routes that need to read the authenticated user from the HTTP cookie. Used for `auth.getUser()` calls in server context. Respects RLS — only sees the user's own tenant data.

**Note**: It's a factory (`createSupabaseServer()`), not a singleton — must be called per-request since cookies() is request-scoped.

### `src/lib/supabase-browser.js` — Browser Client

```js
import { createBrowserClient } from '@supabase/ssr';
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
```

**Purpose**: Client components (React components with `'use client'`). Also used for Supabase Realtime subscriptions on the dashboard. Respects RLS — authenticated user's session in browser controls access.

---

## 2. getTenantId Pattern

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
- **JSONB filter syntax for crons** (bypasses the helper — filter at the query level instead): `.eq('features_enabled->>invoicing', 'true')`. Note the value is the **string `'true'`**, not the boolean — PostgREST's `->>` operator returns text. Phase 53 `/api/cron/invoice-reminders` and `/api/cron/recurring-invoices` use this pattern to skip invoicing-disabled tenants at the SQL level.

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

## 3. Middleware

**File**: `src/proxy.js`

### AUTH_REQUIRED_PATHS

```js
const AUTH_REQUIRED_PATHS = [
  '/onboarding',
  '/dashboard',
  '/admin',
];
```

Matching: `pathname === p || pathname.startsWith(p + '/')` — exact path OR subpaths.

`/auth/signin` is NOT in the list — it's the public auth entry point.

**Note**: `/admin` is in `AUTH_REQUIRED_PATHS` but its auth is handled by the dedicated admin gate block (before the generic auth check). The admin gate includes its own unauthenticated redirect, admin_users lookup, and 403 rewrite. The `/admin` entry in AUTH_REQUIRED_PATHS exists as a safety fallback only.

### Client Used in Middleware

Middleware creates its own `createServerClient` inline (NOT via `createSupabaseServer()` factory) using the **anon key**, with request/response cookie bridging:

```js
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { cookies: { getAll, setAll } }   // bridges request → response cookies
);
```

**Why anon key (not service_role)**: Middleware checks the cookie-based session for the current user. Service role would bypass auth entirely — never appropriate for authentication checking.

### Auth Check Flow

1. `await supabase.auth.getUser()` — validates session cookie
2. If unauthenticated on auth-required path → redirect to `/auth/signin`
3. If authenticated: query `tenants.onboarding_complete` for `/onboarding*` and `/dashboard*` paths
4. Authenticated on `/auth/signin` → redirect to `/onboarding` (not onboarded) or `/dashboard` (onboarded)
5. On `/onboarding*` + `onboarding_complete === true` → redirect to `/dashboard`
6. On `/dashboard*` + `onboarding_complete !== true` → redirect to `/onboarding`

**Optimization**: Onboarding check is only run for `/onboarding*` and `/dashboard*` paths. Not run on every request to avoid unnecessary DB queries.

### Admin Gate (added Phase 28-01)

After `getUser()`, before the generic `isAuthRequired` check, the middleware handles `/admin/*` paths:

```js
const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/');

if (isAdminPath) {
  if (!user) {
    // Redirect to /auth/signin?redirect=<attempted path>
  }
  // Query admin_users using anon key client (user's own session respects RLS policy)
  const { data: adminRecord } = await supabase
    .from('admin_users').select('id').eq('user_id', user.id).single();

  if (!adminRecord) {
    return NextResponse.rewrite(new URL('/admin/forbidden', request.url)); // 403
  }
  return response; // Early return — skips tenant/onboarding logic for admins
}
```

**CRITICAL**: The early `return response` is intentional — admins may not have a `tenants` row (they're platform operators, not tenants). Without early return, the middleware would try to look up their tenant and redirect them to `/onboarding`.

**403 page**: `src/app/admin/forbidden/page.js` — shown when user is authenticated but not in admin_users. URL stays at the attempted path (rewrite, not redirect).

### Matcher Config

```js
export const config = {
  matcher: ['/onboarding/:path*', '/onboarding', '/dashboard/:path*', '/dashboard', '/admin/:path*', '/admin', '/auth/signin'],
};
```

Cross-domain: See onboarding-flow skill for full wizard navigation details and why `/auth/signin` is outside the wizard layout.

---

## 4. RLS Policy Patterns

Row Level Security enforces tenant isolation at the database level. Every table uses one of two patterns.

### Pattern 1: Direct Owner (tenants table only)

```sql
CREATE POLICY "tenants_read_own" ON tenants
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "tenants_update_own" ON tenants
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "tenants_insert_own" ON tenants
  FOR INSERT WITH CHECK (owner_id = auth.uid());
```

`auth.uid()` = the Supabase auth user UUID. Applied directly because `tenants.owner_id` IS the auth UID.

### Pattern 2: Tenant Child (all data tables)

```sql
-- Example from calls table (001_initial_schema.sql)
CREATE POLICY "calls_all_own" ON calls
  FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));
```

All child tables (calls, services, appointments, leads, etc.) carry a `tenant_id` FK. The policy traverses `tenant_id → tenants.owner_id` to match the authenticated user.

**WITH CHECK on insert/update**: The `WITH CHECK` clause requires `tenant_id` to be present and correct on every INSERT and UPDATE. This is why PATCH operations (e.g., reorder endpoints) must include `tenant_id` in every upserted row — even when only another column is changing.

### Pattern 3: Service Role Bypass

Every table has a service role bypass policy:

```sql
-- From 001_initial_schema.sql
CREATE POLICY "service_role_all_tenants" ON tenants
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all_calls" ON calls
  FOR ALL USING (auth.role() = 'service_role');
```

This allows webhook handlers (using the service role client) to read/write any tenant's data without knowing which user is "authenticated." Every new table must get a service role bypass policy.

---

## 5. Migration Trail

All 36 migrations are applied sequentially. FK dependencies require this order. Migrations 001–017 and 019 documented in detail below; 018, 020–036 documented in the file map above with key migrations also detailed below.

### 001_initial_schema.sql — Foundation

**Tables created**: `tenants`, `calls`

**tenants columns**:
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | gen_random_uuid() |
| `owner_id` | uuid UNIQUE | Supabase auth user ID |
| `business_name` | text | nullable |
| `phone_number` | text UNIQUE | nullable (renamed from retell_phone_number in migration 023) |
| `owner_phone` | text | nullable |
| `owner_email` | text | nullable |
| `default_locale` | text | NOT NULL DEFAULT 'en' |
| `onboarding_complete` | boolean | NOT NULL DEFAULT false |
| `created_at`, `updated_at` | timestamptz | |

**calls columns**: `id`, `tenant_id` (FK), `call_id` UNIQUE (renamed from retell_call_id in migration 023), `from_number`, `to_number`, `direction`, `status`, `disconnection_reason`, `start_timestamp`, `end_timestamp`, `duration_seconds` (GENERATED STORED), `recording_url`, `recording_storage_path`, `transcript_text`, `transcript_structured` (jsonb), `detected_language`, `language_barrier`, `barrier_language`, `call_metadata` (jsonb, renamed from retell_metadata in migration 023), `call_provider` (text, 'retell'|'livekit', DEFAULT 'livekit'), `egress_id` (text)

**RLS**: Both tables have full RLS. Tenants: direct owner pattern. Calls: tenant_id child pattern. Both have service_role bypass.

---

### 002_onboarding_triage.sql — Onboarding + Triage

**Extends tenants**: `tone_preset` (CHECK 'professional'|'friendly'|'local_expert', DEFAULT 'professional'), `trade_type` (text), `test_call_completed` (boolean DEFAULT false), `working_hours` (jsonb, nullable)

**Tables created**: `services`

**services columns**:
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid | FK → tenants(id) ON DELETE CASCADE |
| `name` | text | NOT NULL |
| `urgency_tag` | text | CHECK 'emergency'|'routine'|'urgent', DEFAULT 'routine' |
| `is_active` | boolean | NOT NULL DEFAULT true |
| `created_at` | timestamptz | |

**RLS**: services uses tenant_id child pattern + service_role bypass.

**Extends calls**: `urgency_classification`, `urgency_confidence`, `triage_layer_used` — all with CHECK constraints.

---

### 003_scheduling.sql — Scheduling + Calendar

**Extends tenants**: `tenant_timezone` (NOT NULL DEFAULT 'America/Chicago'), `slot_duration_mins` (int NOT NULL DEFAULT 60)

**Extends calls**: `suggested_slots` (jsonb)

**Tables created**: `appointments`, `service_zones`, `zone_travel_buffers`, `calendar_credentials`, `calendar_events`

Key table details:

**appointments**: `id`, `tenant_id` (FK), `call_id` (FK → calls SET NULL), `start_time`, `end_time`, `service_address`, `caller_name`, `caller_phone`, `urgency` (CHECK emergency|routine|urgent), `zone_id` (FK → service_zones SET NULL), `status` (CHECK confirmed|cancelled|completed DEFAULT confirmed), `booked_via` (CHECK ai_call|manual DEFAULT ai_call), `google_event_id` (text, renamed in 007), `notes`. Constraint: GiST exclusion `appointments_no_overlap` (see migration 019 below — replaced the original `UNIQUE (tenant_id, start_time)`).

**calendar_credentials**: `id`, `tenant_id` (FK), `provider` (CHECK google|outlook DEFAULT google), `access_token`, `refresh_token`, `expiry_date` (bigint), `calendar_id` (DEFAULT 'primary'), `calendar_name`, `watch_channel_id`, `watch_resource_id`, `watch_expiration` (bigint), `last_sync_token`, `last_synced_at`. Constraint: `UNIQUE (tenant_id, provider)`.

**`book_appointment_atomic` RPC function** (SECURITY DEFINER):
```sql
-- Acquires non-blocking advisory lock: abs(hashtext(tenant_id || epoch(start_time)))
-- Checks tsrange overlap on non-cancelled appointments
-- Returns: jsonb { success: true, appointment_id: uuid }
--       or: jsonb { success: false, reason: 'slot_taken' }
-- Secondary defense: GiST exclusion constraint `appointments_no_overlap` (added in migration 019)
--   prevents overlapping [start_time, end_time) ranges per tenant for non-cancelled appointments
```

All 5 tables use tenant_id child RLS pattern + service_role bypass.

Cross-domain: See scheduling-calendar-system skill for full slot calculator, booking, and calendar sync details.

---

### 004_leads_crm.sql — CRM + Realtime

**Tables created**: `leads`, `lead_calls`, `activity_log`

**leads columns**:
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid | FK → tenants CASCADE |
| `from_number` | text | NOT NULL |
| `caller_name` | text | nullable |
| `job_type` | text | nullable |
| `service_address` | text | nullable |
| `urgency` | text | CHECK emergency|routine|urgent |
| `status` | text | CHECK new|booked|completed|paid|lost |
| `revenue_amount` | numeric(10,2) | nullable |
| `primary_call_id` | uuid | FK → calls SET NULL |
| `appointment_id` | uuid | FK → appointments SET NULL |
| `created_at`, `updated_at` | timestamptz | |

**Realtime** (CRITICAL):
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER TABLE leads REPLICA IDENTITY FULL;
```

`REPLICA IDENTITY FULL` is required so Supabase Realtime emits row-level change events with full old+new row data, enabling tenant_id filter at the subscription level.

**lead_calls**: Junction table. PK: `(lead_id, call_id)`. Many calls → one lead (repeat callers). RLS traverses through leads table.

**activity_log**: `id`, `tenant_id` (FK), `event_type`, `lead_id` (FK SET NULL), `metadata` (jsonb), `created_at`. RLS: tenant_id child pattern.

**Extends calls**: `recovery_sms_sent_at` (timestamptz)

---

### 005_setup_checklist.sql — Checklist Dismiss

**Extends tenants**: `setup_checklist_dismissed` (boolean DEFAULT false)

No new tables. Checklist state is derived at read time from existing tenant columns — not stored as separate rows.

---

### 006_escalation_contacts.sql — Escalation Chain

**Tables created**: `escalation_contacts`

**escalation_contacts columns**:
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid | FK → tenants CASCADE |
| `name` | text | NOT NULL |
| `role` | text | nullable |
| `phone` | text | nullable |
| `email` | text | nullable |
| `notification_pref` | text | CHECK sms|email|both DEFAULT 'both' |
| `timeout_seconds` | int | CHECK 15|30|45|60 DEFAULT 30 |
| `sort_order` | int | NOT NULL DEFAULT 0 |
| `is_active` | boolean | NOT NULL DEFAULT true |
| `created_at`, `updated_at` | timestamptz | |

RLS: Uses `TO service_role` syntax variant (still service_role bypass, different syntax from 001-004).

**Extends services**: `sort_order` (int NOT NULL DEFAULT 0). Backfilled via `ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at)`.

---

### 007_outlook_calendar.sql — Dual Provider Calendar

**Extends calendar_credentials**: `is_primary` (boolean NOT NULL DEFAULT false). Backfill: existing Google credentials set to `is_primary = true`.

**Renames appointments column**: `google_event_id` → `external_event_id`

**Extends appointments**: `external_event_provider` (CHECK google|outlook)

---

### 008_call_outcomes.sql — Call Outcome Tracking

**Extends calls**:
| Column | Type | Notes |
|--------|------|-------|
| `booking_outcome` | text | CHECK booked|attempted|declined|not_attempted |
| `exception_reason` | text | CHECK clarification_limit|caller_requested |
| `notification_priority` | text | CHECK high|standard |

**Indexes added**: `(tenant_id, booking_outcome)`, `(tenant_id, notification_priority)` — for analytics queries and Phase 16 notification routing.

---

### 009_recovery_sms_tracking.sql — Recovery SMS Delivery Tracking

**Extends calls**:
| Column | Type | Notes |
|--------|------|-------|
| `recovery_sms_status` | text | CHECK pending|sent|failed|retrying |
| `recovery_sms_retry_count` | integer | NOT NULL DEFAULT 0 |
| `recovery_sms_last_error` | text | nullable |
| `recovery_sms_last_attempt_at` | timestamptz | nullable |

**Indexes added**: Partial index `idx_calls_recovery_sms_retry` on `(tenant_id, recovery_sms_status, recovery_sms_last_attempt_at)` WHERE `recovery_sms_status = 'retrying'` — for cron retry queries.

---

### 010_billing_schema.sql — Billing Foundation (Subscriptions + Webhook Events)

**Tables created**: `subscriptions`, `stripe_webhook_events`

**subscriptions columns**:
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | gen_random_uuid() |
| `tenant_id` | uuid | FK → tenants CASCADE |
| `stripe_customer_id` | text | NOT NULL |
| `stripe_subscription_id` | text | NOT NULL |
| `stripe_price_id` | text | nullable |
| `plan_id` | text | CHECK starter|growth|scale |
| `status` | text | CHECK trialing|active|past_due|canceled|paused|incomplete |
| `calls_limit` | int | NOT NULL |
| `calls_used` | int | NOT NULL DEFAULT 0 |
| `trial_ends_at` | timestamptz | nullable |
| `current_period_start` | timestamptz | nullable |
| `current_period_end` | timestamptz | nullable |
| `cancel_at_period_end` | boolean | NOT NULL DEFAULT false |
| `stripe_updated_at` | timestamptz | For out-of-order webhook protection |
| `is_current` | boolean | NOT NULL DEFAULT true — active row lookup |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

**Indexes**: `idx_subscriptions_tenant_current (tenant_id, is_current)`, `idx_subscriptions_stripe_sub_id (stripe_subscription_id)`

**stripe_webhook_events columns**:
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | gen_random_uuid() |
| `event_id` | text | UNIQUE NOT NULL — idempotency key |
| `event_type` | text | NOT NULL |
| `processed_at` | timestamptz | NOT NULL DEFAULT now() |

**RLS**: Both tables have RLS enabled.
- `subscriptions`: authenticated SELECT-own (via tenants.owner_id), service_role ALL
- `stripe_webhook_events`: service_role ALL only (no authenticated access)

**Key design**: Authenticated users can only read subscriptions (no INSERT/UPDATE) — all writes go through service_role via webhook handlers. This is intentional write-protection.

---

### 011_country_provisioning.sql — Country-Aware Provisioning

**Extends tenants**: `owner_name` (text nullable), `country` (text nullable), `provisioning_failed` (boolean DEFAULT false)

**Tables created**: `phone_inventory`, `phone_inventory_waitlist`

**phone_inventory columns**: `id` (uuid PK), `phone_number` (text UNIQUE NOT NULL), `country` (text NOT NULL DEFAULT 'SG'), `status` (CHECK available|assigned|retired DEFAULT available), `assigned_tenant_id` (FK → tenants nullable), `created_at`

**phone_inventory_waitlist columns**: `id`, `email` (text NOT NULL), `country` (text NOT NULL DEFAULT 'SG'), `created_at`, `notified_at` (timestamptz nullable)

**`assign_sg_number` RPC** (SECURITY DEFINER): Atomically assigns a Singapore phone number to a tenant using `FOR UPDATE SKIP LOCKED` for race-safety. Returns `phone_number` or empty if no inventory.

**RLS**: phone_inventory: RLS enabled, no authenticated policies (all access via service_role or SECURITY DEFINER RPC). phone_inventory_waitlist: INSERT allowed for anon+authenticated (anyone can join). Index: `idx_phone_inventory_available` on (country, status) WHERE status = 'available'.

---

### 012_admin_users.sql — Admin Dashboard Auth Gate (Phase 28-01)

**Tables created**: `admin_users`

**admin_users columns**:
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | gen_random_uuid() |
| `user_id` | uuid UNIQUE | FK → auth.users(id) |
| `role` | text | NOT NULL DEFAULT 'admin' |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

**RLS**: Enabled. Single SELECT policy: "Authenticated can read own admin row" — `auth.uid() = user_id`. Authenticated users can only read their own admin status row. No INSERT/UPDATE/DELETE policies — admin user management is exclusively via service_role (Supabase CLI or direct DB insert). No service_role bypass policy needed because service_role bypasses RLS by default.

**Bootstrap**: To make a user an admin, insert directly via Supabase CLI:
```sql
INSERT INTO admin_users (user_id, role) VALUES ('<auth.users UUID>', 'admin');
```

---

### 013_usage_events.sql — Per-Call Usage Tracking (Phase 23-01)

**Tables created**: `usage_events`

**usage_events columns**:
| Column | Type | Notes |
|--------|------|-------|
| `call_id` | text PK | Call ID (LiveKit room name or legacy Retell ID) — idempotency key, prevents double-counting |
| `tenant_id` | uuid | FK → tenants(id) ON DELETE CASCADE |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

**Index**: `idx_usage_events_tenant_id` on `(tenant_id)`

**RLS**: Enabled. `service_role_all_usage_events` — service_role ALL (no authenticated user access). Webhook handlers write via service_role client.

**`increment_calls_used(p_tenant_id uuid, p_call_id text)` RPC**:
- Returns `TABLE(success boolean, calls_used int, calls_limit int, limit_exceeded boolean)`
- Idempotency: `INSERT INTO usage_events ... ON CONFLICT (call_id) DO NOTHING` — if FOUND is false (duplicate), returns current state without incrementing
- Atomic increment: `UPDATE subscriptions SET calls_used = calls_used + 1 WHERE tenant_id = p_tenant_id AND is_current = true` — Postgres atomicity guarantees no race conditions
- No active subscription: returns `(false, 0, 0, false)`
- No SECURITY DEFINER — service_role client bypasses RLS automatically

---

### 017_overage_billing.sql — Overage Metered Billing

**Extends subscriptions**: `overage_stripe_item_id` (text, nullable) — Stripe subscription item ID for the metered overage price component. Used by `call-processor.js` to report per-call usage when `calls_used > calls_limit`.

No new tables. No RLS changes (existing subscriptions policies cover all columns).

---

### 019_appointments_exclusion_constraint.sql — Overlap Prevention

Replaces the original `UNIQUE (tenant_id, start_time)` constraint from migration 003 with a GiST exclusion constraint that prevents overlapping time ranges.

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_tenant_id_start_time_key;

ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    tenant_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (status <> 'cancelled');
```

**Key properties**:
- Prevents overlapping time ranges (not just identical start times) — two appointments for the same tenant cannot have overlapping `[start_time, end_time)` intervals
- Only applies to non-cancelled appointments (`WHERE status <> 'cancelled'`) — cancelled slots can be rebooked
- Uses `btree_gist` extension for GiST index support on scalar types (required for `tenant_id WITH =` in the exclusion)
- The existing `idx_appointments_tenant_start` index from migration 003 is kept for query performance

No new tables. No RLS changes.

---

### 024_schema_hardening.sql — Indexes, Constraints, Trigger

**Function created**: `set_updated_at()` — generic trigger function that sets `NEW.updated_at = now()`.

**Trigger**: `trg_leads_updated_at` BEFORE UPDATE on leads — auto-maintains `leads.updated_at`.

**Constraint**: `admin_users_role_check` — CHECK (role IN ('admin', 'super_admin')).

**Indexes added**: `idx_waitlist_email` on phone_inventory_waitlist(email), `idx_zone_travel_buffers_tenant` on zone_travel_buffers(tenant_id).

No new tables. No RLS changes.

---

### 025_fix_book_appointment_atomic.sql — RPC Fix

Re-creates `book_appointment_atomic` to fix "column scheduled does not exist" error caused by a manual DB modification. Restores the correct version from migration 003 (advisory lock + overlap check + insert pattern).

No new tables. No schema changes.

---

### 026_address_fields.sql — Structured Address Columns

**Extends appointments**: `postal_code` (text), `street_name` (text)

**Extends leads**: `postal_code` (text), `street_name` (text)

**Updates book_appointment_atomic**: Drops all overloads dynamically, re-creates with `p_postal_code` and `p_street_name` params (DEFAULT NULL for backward compat). Inserts postal_code + street_name into appointments.

No new tables. No RLS changes.

---

### 027_lock_rpc_functions.sql — SECURITY DEFINER Lockdown

Revokes PUBLIC execute on `book_appointment_atomic` and `assign_sg_number` SECURITY DEFINER functions, grants to `service_role` only. Prevents anonymous/authenticated callers from invoking these RPC functions directly via PostgREST.

No new tables. No schema changes.

---

### 028_calls_tenant_cascade.sql — FK Cascade Fix

Replaces `calls.tenant_id` FK constraint (was RESTRICT, blocking tenant deletion) with ON DELETE CASCADE.

No new tables. No RLS changes.

---

### 029_invoice_schema.sql — Invoice Data Foundation

**Tables created**: `invoice_settings`, `invoice_sequences`, `invoices`, `invoice_line_items`

**invoice_settings columns**: `tenant_id` (uuid PK, FK tenants CASCADE), `business_name`, `address`, `phone`, `email`, `logo_url`, `license_number`, `tax_rate` (numeric(5,4) DEFAULT 0), `payment_terms` (DEFAULT 'Net 30'), `default_notes`, `invoice_prefix` (DEFAULT 'INV'), `created_at`, `updated_at`

**invoice_sequences**: Composite PK `(tenant_id, year)`, `next_number` (int DEFAULT 1). Atomic counter for invoice numbering.

**invoices columns**: `id` (uuid PK), `tenant_id` (FK CASCADE), `lead_id` (FK leads SET NULL), `invoice_number` (text NOT NULL), `status` (CHECK draft|sent|paid|overdue|void|partially_paid, DEFAULT 'draft'), `customer_name`, `customer_phone`, `customer_email`, `customer_address`, `job_type`, `issued_date`, `due_date`, `notes`, `payment_terms`, `subtotal`, `tax_amount`, `total`, `sent_at`, `paid_at`, `voided_at`, `created_at`, `updated_at`. Constraint: UNIQUE(tenant_id, invoice_number).

**invoice_line_items columns**: `id` (uuid PK), `invoice_id` (FK invoices CASCADE), `tenant_id` (FK CASCADE), `sort_order`, `item_type` (CHECK labor|materials|travel|flat_rate|discount|late_fee), `description`, `quantity`, `unit_price`, `markup_pct`, `taxable`, `line_total`, `created_at`.

**RPC**: `get_next_invoice_number(p_tenant_id uuid, p_year int)` — atomic UPSERT on invoice_sequences, returns next number.

**Storage**: `invoice-logos` bucket (public) with tenant-scoped upload policy.

**RLS**: All 4 tables use tenant_id child pattern + service_role bypass.

---

### 030_accounting_integrations.sql — Accounting Provider OAuth

**Tables created**: `accounting_credentials`, `accounting_sync_log`

**accounting_credentials columns**: `id` (uuid PK), `tenant_id` (FK CASCADE), `provider` (CHECK quickbooks|xero|freshbooks), `access_token`, `refresh_token`, `expiry_date` (bigint), `realm_id` (QBO), `xero_tenant_id`, `account_id` (FreshBooks), `display_name`, `connected_at`, `last_synced_at`, `created_at`. Constraint: UNIQUE(tenant_id, provider).

**accounting_sync_log columns**: `id` (uuid PK), `tenant_id` (FK CASCADE), `invoice_id` (FK invoices CASCADE), `provider`, `external_id`, `status` (CHECK pending|synced|failed, DEFAULT 'pending'), `error_message`, `attempted_at`, `synced_at`. Constraint: UNIQUE(invoice_id, provider).

**RLS**: Both tables use tenant_id child pattern + service_role bypass.

---

### 030_estimates_schema.sql — Estimates Data Foundation

**Tables created**: `estimate_sequences`, `estimates`, `estimate_tiers`, `estimate_line_items`

**estimate_sequences**: Composite PK `(tenant_id, year)`, `next_number` (int DEFAULT 1). Same pattern as invoice_sequences.

**estimates columns**: `id` (uuid PK), `tenant_id` (FK CASCADE), `lead_id` (FK leads SET NULL), `estimate_number` (text NOT NULL), `status` (CHECK draft|sent|approved|declined|expired, DEFAULT 'draft'), `customer_name`, `customer_phone`, `customer_email`, `customer_address`, `job_type`, `created_date`, `valid_until`, `notes`, `subtotal`, `tax_amount`, `total`, `converted_to_invoice_id` (FK invoices SET NULL), `sent_at`, `approved_at`, `declined_at`, `created_at`, `updated_at`. Constraint: UNIQUE(tenant_id, estimate_number).

**estimate_tiers columns**: `id` (uuid PK), `estimate_id` (FK estimates CASCADE), `tenant_id` (FK CASCADE), `tier_label` (DEFAULT 'Good'), `sort_order`, `subtotal`, `tax_amount`, `total`, `created_at`. Good/Better/Best tiering.

**estimate_line_items columns**: `id` (uuid PK), `estimate_id` (FK estimates CASCADE), `tier_id` (FK estimate_tiers CASCADE, nullable), `tenant_id` (FK CASCADE), `sort_order`, `item_type` (CHECK labor|materials|travel|flat_rate|discount), `description`, `quantity`, `unit_price`, `markup_pct`, `taxable`, `line_total`, `created_at`.

**RPC**: `get_next_estimate_number(p_tenant_id uuid, p_year int)` — same atomic UPSERT pattern as invoice counter.

**Extends invoice_settings**: `estimate_prefix` (text NOT NULL DEFAULT 'EST').

**RLS**: All 4 tables use tenant_id child pattern + service_role bypass.

---

### 031_payment_log_schema.sql — Invoice Payments + Status Expansion

**Tables created**: `invoice_payments`

**invoice_payments columns**: `id` (uuid PK), `invoice_id` (FK invoices CASCADE), `tenant_id` (FK CASCADE), `amount` (numeric(10,2) NOT NULL), `payment_date` (date DEFAULT CURRENT_DATE), `note`, `created_at`.

**Expands invoices.status CHECK**: Adds 'partially_paid' to allowed values.

**Expands invoice_line_items.item_type CHECK**: Adds 'late_fee' to allowed values.

**RLS**: invoice_payments uses tenant_id child pattern + service_role bypass.

---

### 032_reminders_recurring.sql — Invoice Reminders + Late Fees + Recurring

**Tables created**: `invoice_reminders`

**invoice_reminders columns**: `id` (uuid PK), `invoice_id` (FK invoices CASCADE), `tenant_id` (FK CASCADE), `reminder_type` (CHECK before_3|due_date|overdue_3|overdue_7), `sent_at`. Constraint: UNIQUE(invoice_id, reminder_type) — idempotency.

**Extends invoice_settings**: `late_fee_enabled` (boolean DEFAULT false), `late_fee_type` (CHECK flat|percentage, DEFAULT 'flat'), `late_fee_amount` (numeric(10,2) DEFAULT 0).

**Extends invoices**: `reminders_enabled` (boolean DEFAULT true), `late_fee_applied_at`, `is_recurring_template` (boolean DEFAULT false), `recurring_frequency` (CHECK weekly|monthly|quarterly|annually), `recurring_start_date`, `recurring_end_date`, `recurring_next_date`, `recurring_active` (boolean DEFAULT false), `generated_from_id` (FK invoices SET NULL).

**RLS**: invoice_reminders uses tenant_id child pattern + service_role bypass.

---

### 033_lock_counter_functions.sql — Counter Function Lockdown

Revokes PUBLIC execute on `get_next_invoice_number` and `get_next_estimate_number`, grants to both `service_role` and `authenticated`. Unlike 027 (service_role only), these counters need authenticated access because they are called from API routes using the session client.

No new tables. No schema changes.

---

### 034_add_skipped_sms_status.sql — Recovery SMS Status Expansion

Expands `calls.recovery_sms_status` CHECK to add 'skipped' value (for short calls <15s and booked callers where SMS is intentionally not sent). New allowed values: pending|sent|failed|retrying|skipped.

No new tables. No schema changes.

---

### 035_lead_email_and_invoice_title.sql — Lead Email + Invoice Title

**Extends leads**: `email` (text) — collected manually by owner after initial call.

**Extends invoices**: `title` (text) — friendly invoice name alongside auto-generated invoice_number.

No new tables. No RLS changes.

---

### 036_rename_high_ticket_to_urgent.sql — Urgency Tier Rename

Renames urgency tier 'high_ticket' to 'urgent' across all four tables that carry urgency columns. Includes data migration (UPDATE SET) and CHECK constraint rebuild for each:

- `calls.urgency_classification`: CHECK emergency|routine|urgent
- `leads.urgency`: CHECK emergency|routine|urgent
- `appointments.urgency`: CHECK emergency|routine|urgent
- `services.urgency_tag`: CHECK emergency|routine|urgent

No new tables. No RLS changes.

---

### 038_schema_hardening_2.sql — Stripe Index + Atomic Primary-Calendar Swap

Two unrelated hardening items grouped in one migration:

1. **Index** `idx_subscriptions_stripe_customer_id` on `subscriptions(stripe_customer_id)` — speeds up Stripe webhook handler customer lookups.

2. **`set_primary_calendar(p_tenant_id uuid, p_provider text)` RPC** (SECURITY DEFINER, returns void):

```sql
UPDATE calendar_credentials
SET is_primary = (provider = p_provider)
WHERE tenant_id = p_tenant_id;
```

Single-statement atomic swap so two providers cannot both be marked primary during a race window. Called by the calendar OAuth callback when the user (re)connects a provider and elects it as primary.

**Lockdown:** `REVOKE ALL ON FUNCTION set_primary_calendar FROM PUBLIC; GRANT EXECUTE ... TO service_role;` — only service-role clients (server routes via `src/lib/supabase.js`) can invoke. Browser/SSR clients cannot.

No new tables. No RLS changes.

---

### 044_ai_voice_column.sql — AI Voice Selection (Phase 44)

**Extends tenants**: `ai_voice` (TEXT, nullable) — The chosen Gemini voice for the AI receptionist. NULL means fall back to `VOICE_MAP[tone_preset]` in the LiveKit agent.

```sql
ALTER TABLE tenants
  ADD COLUMN ai_voice TEXT CHECK (
    ai_voice IS NULL OR ai_voice IN ('Aoede', 'Erinome', 'Sulafat', 'Zephyr', 'Achird', 'Charon')
  );
```

**Key properties**:
- Nullable — existing tenants keep NULL (backward compatible, D-17)
- CHECK constraint is case-sensitive — 'aoede' would be rejected
- 6 allowed values (curated Gemini voices): Aoede, Erinome, Sulafat (female); Zephyr, Achird, Charon (male)
- No migration backfill — tenants choose explicitly via `PATCH /api/ai-voice-settings`

**API route**: `PATCH /api/ai-voice-settings` — tenant-scoped, uses `getTenantId()` + service role client. Validates against `VALID_VOICES` allowlist in `src/lib/ai-voice-validation.js`.

No new tables. No RLS changes (existing tenants RLS covers new column).

---

### 042_call_routing_schema.sql — Call Routing Foundation (Phase 39)

**Extends tenants** with three JSONB/INTEGER columns that drive the Twilio webhook routing decision:

```sql
ALTER TABLE tenants
  ADD COLUMN call_forwarding_schedule JSONB NOT NULL DEFAULT '{"enabled":false,"days":{}}'::jsonb,
  ADD COLUMN pickup_numbers JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_array_length(pickup_numbers) <= 5),
  ADD COLUMN dial_timeout_seconds INTEGER NOT NULL DEFAULT 15;

ALTER TABLE calls
  ADD COLUMN routing_mode TEXT CHECK (routing_mode IN ('ai','owner_pickup','fallback_to_ai')),
  ADD COLUMN outbound_dial_duration_sec INTEGER;

CREATE INDEX IF NOT EXISTS idx_calls_tenant_month ON calls (tenant_id, created_at);
```

- `call_forwarding_schedule` — shape `{enabled: bool, days: {mon..sun: [{start, end}]}}`, consumed by `webhook/schedule.py::evaluate_schedule` (pure function, no DB access).
- `pickup_numbers` — JSONB array of `{number, label, sms_forward}` objects, capped at 5 (CHECK). These are the parallel-ring targets for `owner_pickup` routing.
- `dial_timeout_seconds` — how long Twilio should ring the pickup numbers before falling through to AI.
- `routing_mode` on calls — populated by the `/twilio/dial-status` callback: `'owner_pickup'` if any pickup answered, `'fallback_to_ai'` if all missed.
- `outbound_dial_duration_sec` — populated same callback; feeds `webhook/caps.py::check_outbound_cap` for monthly minute caps (US/CA: 5000, SG: 2500).
- `idx_calls_tenant_month` powers the monthly SUM query inside `check_outbound_cap`.

No RLS changes (existing tenant/calls policies cover the new columns).

---

### 045_sms_messages_and_call_sid.sql — SMS Audit Log + Call SID (Phase 40)

**New table** `sms_messages` (audit trail for inbound SMS forwarded to pickup numbers via `/twilio/incoming-sms`):

```sql
CREATE TABLE sms_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_number TEXT NOT NULL,
  to_number   TEXT NOT NULL,
  body        TEXT NOT NULL,
  direction   TEXT NOT NULL CHECK (direction IN ('inbound', 'forwarded')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sms_messages_tenant_created ON sms_messages (tenant_id, created_at);
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_select_sms" ON sms_messages
  FOR SELECT USING (tenant_id = (SELECT id FROM tenants WHERE owner_id = auth.uid()));
```

Only a SELECT policy is defined — writes happen exclusively from the service-role Twilio webhook handler (`webhook/twilio_routes.py::incoming_sms`). One row per inbound SMS (`direction='inbound'`) plus one row per forward target (`direction='forwarded'`).

**Also**: `ALTER TABLE calls ADD COLUMN call_sid TEXT` + sparse index `idx_calls_call_sid WHERE call_sid IS NOT NULL`. The webhook stamps `call_sid` on owner-pickup call rows so the `/twilio/dial-status` callback can match back to the correct call record (AI-SIP calls use `call_id` instead; both columns coexist).

---

### 046_calendar_blocks_and_completed_at.sql — Time Blocks + Mark-Complete (Phase 42)

**New table** `calendar_blocks` — personal/unavailable time blocks (lunch, vacation, errands) distinct from appointments:

```sql
CREATE TABLE calendar_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title       text NOT NULL,
  start_time  timestamptz NOT NULL,
  end_time    timestamptz NOT NULL,
  is_all_day  boolean NOT NULL DEFAULT false,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE calendar_blocks ENABLE ROW LEVEL SECURITY;
-- 4 tenant policies (SELECT/INSERT/UPDATE/DELETE) — same shape as other tenant-child tables
CREATE INDEX idx_calendar_blocks_tenant_time ON calendar_blocks (tenant_id, start_time, end_time);

ALTER TABLE appointments ADD COLUMN completed_at timestamptz;
```

Blocks are respected by the slot calculator (`livekit-agent/src/lib/slot_calculator.py`) — the AI won't offer slots that overlap a block. Migration 047 adds `external_event_id` for syncing blocks to Google/Outlook; migration 048 adds `group_id` for bulk-delete of multi-day blocks.

`appointments.completed_at` is set when the owner clicks "Mark complete" on an appointment — used by the invoicing/Kanban flows to know the job is done.

---

### 049_vip_caller_routing.sql — Priority (VIP) Caller Direct Routing (Phase 46)

```sql
SET search_path TO public;

ALTER TABLE public.tenants
  ADD COLUMN vip_numbers JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.leads
  ADD COLUMN is_vip BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_leads_vip_lookup
  ON public.leads (tenant_id, from_number)
  WHERE is_vip = true;
```

Two-source priority lookup consumed by `webhook/twilio_routes.py::_is_vip_caller`:
1. **Standalone numbers** — `tenants.vip_numbers` JSONB array of `{number, label}` (unlimited, no CHECK per D-09). No DB hit — already loaded with the tenant row.
2. **Lead-based** — `leads.is_vip=true` for the caller's `from_number`. Sparse partial index so the lookup is fast even as the leads table grows (only VIP rows are indexed).

If either source matches, the webhook bypasses the schedule/cap evaluator and goes straight to owner-pickup parallel-ring. User-facing branding is "Priority" (the "VIP" name is DB-only, preserved for column continuity).

### 050_checklist_overrides.sql — Setup Checklist Per-Item Overrides (Phase 48)

```sql
SET search_path TO public;

ALTER TABLE public.tenants
  ADD COLUMN checklist_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;
```

Stores per-item user actions (dismiss, mark-done) on the dashboard setup checklist as a single JSONB map keyed by item id — avoids a row-per-item `checklist_item_state` table. Consumed by `src/app/api/setup-checklist/route.js` PATCH handler: incoming `{ item_id, action }` pairs are merged into the existing map, then written back whole. No new RLS policies needed — tenant-level isolation already enforced by the existing `tenants` direct-owner policy.

Shape of the JSONB value (example):

```json
{
  "setup_profile": { "status": "done", "done_at": "2026-04-14T12:34:56Z", "method": "manual" },
  "configure_call_routing": { "status": "dismissed", "dismissed_at": "2026-04-14T12:35:12Z" }
}
```

Auto-detected completions (test-call succeeded, calendar connected, etc.) are NOT stored here — those derive from the live tenant/appointments/calendar state on every GET. This column only holds actions the user took explicitly.

---

## 6. Complete Table Reference

| Table | Migration | Purpose | RLS Pattern |
|-------|-----------|---------|------------|
| `tenants` | 001 | Business config: name, phone, locale, timezone, hours, tone | Direct owner (`owner_id = auth.uid()`) |
| `calls` | 001 | Full call record: metadata, transcript, recording, triage, booking_outcome | Tenant child |
| `services` | 002 | Service catalog with urgency tags | Tenant child |
| `appointments` | 003 | Bookings with calendar event references | Tenant child |
| `service_zones` | 003 | Geographic zones for travel buffers | Tenant child |
| `zone_travel_buffers` | 003 | Travel time between zone pairs | Tenant child |
| `calendar_credentials` | 003 | Google + Outlook OAuth tokens and sync state | Tenant child |
| `calendar_events` | 003 | Local mirror of Google/Outlook events | Tenant child |
| `calendar_blocks` | 046 | Personal time blocks (lunch, vacation, errands). Columns: id, tenant_id, title, start_time, end_time, is_all_day, note, external_event_id (047), group_id (048), created_at. 4 RLS policies. Syncs to Google/Outlook. Multi-day blocks share a group_id for bulk delete. | Tenant child |
| `leads` | 004 | CRM records with Realtime enabled | Tenant child |
| `lead_calls` | 004 | Junction: many calls → one lead | Via leads.tenant_id |
| `activity_log` | 004 | Dashboard event feed | Tenant child |
| `escalation_contacts` | 006 | Owner-configured escalation chain | Tenant child |
| `subscriptions` | 010 | Stripe subscription state per tenant | Tenant child (SELECT-own only) |
| `stripe_webhook_events` | 010 | Webhook idempotency (UNIQUE event_id) | Service role only |
| `phone_inventory` | 011 | Singapore phone number pool for tenant assignment | Service role only (no authenticated policies) |
| `phone_inventory_waitlist` | 011 | Email waitlist for SG number availability | INSERT for anon+authenticated |
| `admin_users` | 012 | Platform admin users — gates /admin/* routes | Authenticated SELECT-own only (user_id = auth.uid()) |
| `usage_events` | 013 | Per-call idempotency guard for usage counting (call_id PK) | Service role only |
| `billing_notifications` | 016 | Idempotent billing notification tracking (trial_will_end, payment_failed) | Service role only |
| `invoice_settings` | 029 | Per-tenant invoice/estimate config: business info, tax rate, payment terms, late fees, prefixes | Tenant child |
| `invoice_sequences` | 029 | Atomic invoice number counter (composite PK: tenant_id + year) | Tenant child |
| `invoices` | 029 | Invoice records with status lifecycle, recurring support, and reminder tracking | Tenant child |
| `invoice_line_items` | 029 | Line items per invoice: labor, materials, travel, flat_rate, discount, late_fee | Tenant child |
| `accounting_credentials` | 030 | OAuth tokens for QuickBooks/Xero/FreshBooks per tenant | Tenant child |
| `accounting_sync_log` | 030 | Per-invoice sync status to accounting providers | Tenant child |
| `estimate_sequences` | 030 | Atomic estimate number counter (composite PK: tenant_id + year) | Tenant child |
| `estimates` | 030 | Estimate records with Good/Better/Best tiering and convert-to-invoice support | Tenant child |
| `estimate_tiers` | 030 | Good/Better/Best pricing tiers per estimate | Tenant child |
| `estimate_line_items` | 030 | Line items per estimate tier | Tenant child |
| `invoice_payments` | 031 | Payment log entries per invoice (partial payment support) | Tenant child |
| `invoice_reminders` | 032 | Idempotent reminder tracking per invoice (UNIQUE invoice_id + reminder_type) | Tenant child |
| `sms_messages` | 045 | Audit log of inbound SMS + forwarded copies to tenant's `pickup_numbers` with `sms_forward=true`. Columns: id, tenant_id, from_number, to_number, body, direction (CHECK IN 'inbound','forwarded'), created_at. Index on (tenant_id, created_at). RLS: SELECT-own only via tenants.owner_id. | Tenant child (SELECT-own only) |

**Tenant columns added across migrations** (all on `tenants` table):
- 002: `tone_preset`, `trade_type`, `test_call_completed`, `working_hours`
- 003: `tenant_timezone`, `slot_duration_mins`
- 005: `setup_checklist_dismissed`
- 011: `owner_name`, `country`, `provisioning_failed`
- 015: `notification_preferences` (JSONB, per-outcome SMS/email toggles)
- 023: `phone_number` (renamed from `retell_phone_number`)
- 039: `call_forwarding_schedule` (JSONB), `pickup_numbers` (JSONB), `dial_timeout_seconds` (INTEGER)
- 044: `ai_voice` (TEXT, nullable) — curated Gemini voice override; NULL = VOICE_MAP[tone_preset] fallback; CHECK (IN 'Aoede','Erinome','Sulafat','Zephyr','Achird','Charon')
- 049: `vip_numbers` (JSONB NOT NULL DEFAULT '[]') — standalone Priority-caller phone numbers (unlimited, no CHECK). Webhook reads this for direct-routing check before evaluating schedule/caps.
- 050: `checklist_overrides` (JSONB NOT NULL DEFAULT '{}') — per-item user actions (dismiss, mark-done) on the dashboard setup checklist. Keyed by checklist item id; values carry `status` + timestamp. Consumed by `/api/setup-checklist` GET/PATCH. Auto-detected completions are NOT stored here (they're derived live).
- 051: `features_enabled` (JSONB NOT NULL DEFAULT `'{"invoicing": false}'::jsonb`) — per-tenant feature flags (shape `{ invoicing: boolean, ... }`). Default ships invoicing OFF for v6.0; owners opt in at `/dashboard/more/features`. Read via `getTenantFeatures(tenantId)` in `src/lib/features.js`; extended in `src/proxy.js` tenant SELECT alongside `onboarding_complete`. JSONB filter for crons: `.eq('features_enabled->>invoicing', 'true')` — value is the string `'true'`, not the boolean.

**Appointments columns added across migrations** (all on `appointments` table):
- 007: `external_event_id` (renamed from google_event_id), `external_event_provider`
- 026: `postal_code`, `street_name`
- 046: `completed_at` (timestamptz, nullable) — set when owner marks the job done from the dashboard.

**Calls columns added across migrations** (all on `calls` table):
- 008: `booking_outcome`, `exception_reason`, `notification_priority`
- 009: `recovery_sms_status`, `recovery_sms_retry_count`, `recovery_sms_last_error`, `recovery_sms_last_attempt_at`
- 023: `call_provider` ('retell'|'livekit'), `egress_id`; renames: `retell_call_id`→`call_id`, `retell_metadata`→`call_metadata`
- 034: `recovery_sms_status` CHECK expanded to add 'skipped'
- 036: `urgency_classification` CHECK updated: 'high_ticket'→'urgent'
- 042: `routing_mode` (TEXT, nullable, CHECK IN 'ai'|'owner_pickup'|'fallback_to_ai'), `outbound_dial_duration_sec` (INTEGER) — set by the Twilio dial-status webhook
- 045: `call_sid` (TEXT, nullable) — Twilio CallSid. Populated by webhook routing to link owner-pickup call records to dial-status callbacks. Sparse index `idx_calls_call_sid WHERE call_sid IS NOT NULL`.

**Leads columns added across migrations** (all on `leads` table):
- 026: `postal_code`, `street_name`
- 035: `email`
- 036: `urgency` CHECK updated: 'high_ticket'→'urgent'
- 049: `is_vip` (BOOLEAN NOT NULL DEFAULT false) — marks existing customers as Priority/VIP callers. Sparse partial index on (tenant_id, from_number) WHERE is_vip=true supports fast lookup at webhook routing time.

**Services columns added**:
- 018: `intake_questions` (jsonb)
- 036: `urgency_tag` CHECK updated: 'high_ticket'→'urgent'

**Invoices columns added across migrations** (all on `invoices` table):
- 031: `status` CHECK expanded to add 'partially_paid'
- 032: `reminders_enabled`, `late_fee_applied_at`, `is_recurring_template`, `recurring_frequency`, `recurring_start_date`, `recurring_end_date`, `recurring_next_date`, `recurring_active`, `generated_from_id`
- 035: `title`

**Invoice_settings columns added across migrations**:
- 030: `estimate_prefix`
- 032: `late_fee_enabled`, `late_fee_type`, `late_fee_amount`

**Invoice_line_items columns added across migrations**:
- 031: `item_type` CHECK expanded to add 'late_fee'

---

## 7. Environment Variables

| Variable | Client(s) | Purpose |
|----------|-----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | All three clients | Supabase project URL (public, safe in browser) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | supabase-server.js, supabase-browser.js, middleware.js | Client auth + RLS-scoped access |
| `SUPABASE_SERVICE_ROLE_KEY` | supabase.js (service role) only | Full DB access, bypasses RLS — SERVER ONLY, never expose to browser |
| `STRIPE_SECRET_KEY` | stripe.js (server-side) | Stripe API secret key — SERVER ONLY |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client components | Stripe publishable key (safe in browser) |
| `STRIPE_WEBHOOK_SECRET` | Webhook API route | Stripe webhook signature verification |
| `STRIPE_PRICE_STARTER` | Server-side | Stripe Price ID for Starter plan ($99/mo) |
| `STRIPE_PRICE_GROWTH` | Server-side | Stripe Price ID for Growth plan ($249/mo) |
| `STRIPE_PRICE_SCALE` | Server-side | Stripe Price ID for Scale plan ($599/mo) |

---

## 8. Key Design Decisions

- **Three clients with distinct purposes**: Service role bypasses RLS for webhooks (cross-tenant access needed); server client reads session cookie for authenticated requests; browser client is anon-key for client-side auth and Realtime. Mixing them causes auth failures or over-privileged DB access.

- **`getTenantId` does NOT use `user_metadata`**: Tenant ID is stored in the `tenants` table, resolved via `owner_id = user.id`. Supabase's `user_metadata` is not used for this. This is explicit and deliberate — tenant_id must come from the DB, not from JWT claims.

- **RLS two-pattern design (owner vs tenant child)**: `tenants` table uses direct `owner_id = auth.uid()` because the user IS the owner. All child tables use `tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())` because they're one level removed. This indirection is correct and necessary.

- **Service role bypass on every table**: Every new table needs a `FOR ALL USING (auth.role() = 'service_role')` policy. Without it, webhook handlers can't write to that table.

- **WITH CHECK on insert/update**: The `WITH CHECK` clause means RLS applies on write operations too, not just reads. Any PATCH/upsert that doesn't include `tenant_id` in the row will fail silently or throw an RLS violation.

- **REPLICA IDENTITY FULL for Realtime**: Required on `leads` table so Supabase Realtime can emit old+new row data for tenant-filtered subscriptions. Standard identity only sends the PK on change events, breaking RLS-aware filtering.

- **Migration ordering matters (FK dependencies)**: 001 (tenants, calls) must run before 002 (services FK tenants). 003 adds appointment FK to service_zones (added in same migration). 004 adds leads FK to calls and appointments. All FK dependencies flow downward in migration order.

- **Admin gate returns early from middleware**: The `/admin/*` check returns response immediately after verifying admin status — before the tenant/onboarding redirect logic. Admin users are platform operators who may not have a `tenants` row. Without early return, the middleware would redirect them to `/onboarding`.

- **verifyAdmin uses service_role for admin_users lookup**: `verifyAdmin()` uses the service-role client for the admin_users query. This ensures consistent behavior regardless of RLS policy changes. The session client is used only for `auth.getUser()`. Note that `getTenantId()` takes the opposite approach — it uses the session client for both auth and the tenants query, relying on RLS for defense-in-depth tenant isolation.

- **admin_users has no service_role bypass policy**: Service role bypasses RLS by default in Supabase — no explicit policy is needed. The single SELECT policy allows authenticated users to check their own admin status (used by middleware). All writes (INSERT/UPDATE/DELETE) are done directly via service_role (Supabase CLI or SQL editor) — there are intentionally no INSERT policies.

- **Middleware uses anon key for cookie-based auth**: The middleware creates a `createServerClient` with `NEXT_PUBLIC_SUPABASE_ANON_KEY` (not service_role). Using service_role in middleware would bypass the cookie-based session check entirely — the middleware would never see unauthenticated users.

- **Multi-tenant isolation: ALL data tables carry tenant_id FK**: Every table except `tenants` itself carries a `tenant_id` column as a FK to `tenants.id`. This is non-negotiable — it's the only way RLS can enforce tenant boundaries.

---

## Cross-Domain References

- For booking, calendar sync, and slot calculation using these DB tables, see **scheduling-calendar-system skill**
- For how the dashboard Realtime subscription uses the browser client, see **dashboard-crm-system skill**
- For middleware onboarding redirect details and wizard session patterns, see **onboarding-flow skill**
- For how webhook handlers use the service role client during call processing, see **voice-call-architecture skill**

---

## Phase 55: Migration 053 + accounting_credentials.error_state + Python write-back

### Migration 053 — `supabase/migrations/053_xero_error_state.sql`

Adds `accounting_credentials.error_state TEXT NULL`:

- **NULL** = healthy connection
- **`'token_refresh_failed'`** = refresh failed; dashboard renders Reconnect banner + sends Resend email
- **Cleared by**: successful OAuth re-callback (heal), successful token refresh (heal), row deletion (Disconnect)

Partial index `idx_accounting_credentials_error_state ON (tenant_id, provider) WHERE error_state IS NOT NULL` keeps the table cheap for the healthy-row common case; only degraded rows are indexed.

### Python service-role write-back pattern (cross-repo)

The livekit-agent Python repo (separate at `C:/Users/leheh/.Projects/livekit-agent/`) performs Xero refreshes in `src/integrations/xero.py`. When refreshing succeeds, the NEW token set MUST be persisted back to `accounting_credentials` so the Next.js side sees the rotated refresh_token on its next read:

```python
admin.table("accounting_credentials").update({
    "access_token": new_access,      # all three together — prevents race
    "refresh_token": new_refresh,
    "expiry_date": new_expiry_iso,
    "error_state": None,             # heal on success
}).eq("id", cred_id).execute()
```

Critical pitfall (documented in Phase 55 RESEARCH as Pitfall 5): If Python refreshes and does NOT persist back, Next.js later refreshes with the old (rotated) refresh_token and Xero returns 400 → stale-token race → connection breaks. Same pattern will apply to Phase 56 Jobber read-side.

On refresh failure, Python writes `error_state='token_refresh_failed'`. Email/banner surfacing lives in Next.js (dashboard read path + `notifyXeroRefreshFailure` helper) — Python NEVER sends email from the call path, since a per-call email would spam across calls.

### `expiry_date` column semantics

`accounting_credentials.expiry_date` is **BIGINT** (epoch milliseconds — written by Next.js as `Date.now() + expires_in * 1000`). The Python parser in livekit-agent/src/integrations/xero.py handles both BIGINT and ISO 8601 string shapes, so either runtime can write or read safely.

---

## Migration 054 — `external_account_id` column (Phase 56)

**Shipped:** 2026-04-18

- **Column:** `accounting_credentials.external_account_id TEXT NULL`
- **Purpose:** Provider-agnostic identifier for the connected external account. Xero calls this an "orgId"; Jobber calls it an "accountId". P54 shipped `xero_tenant_id TEXT` for Xero; this migration decouples the column name from the provider so webhook lookups in both providers read the same column.
- **Backfill:** `UPDATE accounting_credentials SET external_account_id = xero_tenant_id WHERE provider = 'xero' AND xero_tenant_id IS NOT NULL AND external_account_id IS NULL;` — idempotent (WHERE clause guards rerun).
- **Unique index:** `idx_accounting_credentials_tenant_provider_external_unique` — partial unique on `(tenant_id, provider, external_account_id) WHERE external_account_id IS NOT NULL`. Prevents the same external account from being registered under the same Voco tenant twice without blocking disconnected (null) rows.
- **RLS:** No change — migration is purely additive and reuses the existing table-level RLS (service-role bypasses; tenant-scoped SELECT policies from migration 052 continue to apply).

**Deprecated but retained:** `xero_tenant_id TEXT` column is kept for backward compatibility with any P55 Xero code paths that still read it. A future Phase 58 (CHECKLIST / telemetry) cleanup migration will drop `xero_tenant_id` once all consumers migrate to `external_account_id`. Until then, treat `xero_tenant_id` as "last writer for Xero rows" and `external_account_id` as "canonical for both providers."

**Usage in Phase 56:**
- `/api/webhooks/jobber/route.js` reads `external_account_id` to resolve Jobber's webhook `accountId` → Voco `tenant_id` via `.eq('provider','jobber').eq('external_account_id', accountId)`.
- OAuth callback at `/api/integrations/jobber/callback/route.js` writes `external_account_id = <Jobber accountId from token response or post-token GraphQL probe>`.

**Pitfall (Phase 56 research Pitfall 8):** Do NOT repurpose `xero_tenant_id` for Jobber — it's named for Xero's domain and confuses future contributors. Always use `external_account_id` for new provider writes.

---

## Important: Keeping This Document Updated

When adding new migrations or modifying RLS policies, update the Migration Trail and RLS Policy Patterns sections. When adding new source files that use Supabase clients, add them to the File Map. When new tables are created, add them to the Complete Table Reference and verify they have both a tenant_id child RLS policy and a service_role bypass policy.

Key areas to keep current:
- Migration Trail — add new migration entry with tables created/altered, key columns, RLS policies
- Complete Table Reference — add new tables with their migration, purpose, and RLS pattern
- Three Supabase Clients — if new client patterns are introduced (they shouldn't be)
- Environment Variables — if new Supabase-related env vars are added

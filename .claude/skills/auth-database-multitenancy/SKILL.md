---
name: auth-database-multitenancy
description: "Complete architectural reference for authentication, database schema, and multi-tenant isolation — Supabase Auth, middleware auth guards, three Supabase client types, RLS policies, all 8 migrations with table definitions, getTenantId pattern, and tenant data isolation. Use this skill whenever making changes to auth middleware, RLS policies, database migrations, Supabase client usage, tenant isolation, or adding new tables. Also use when the user asks about how auth works, wants to add a new migration, or needs to debug RLS or tenant access issues."
---

# Auth, Database & Multi-Tenancy — Complete Reference

This document is the single source of truth for authentication, Supabase client patterns, row-level security, and the full database schema. Read this before making any changes to auth, RLS policies, migrations, or adding new tables.

**Last updated**: 2026-03-26 (Phase 28-01 — 11 migrations, admin_users table, middleware admin gate, verifyAdmin helper)

---

## Architecture Overview

| Layer | File(s) | Purpose |
|-------|---------|---------|
| **Middleware Auth Guard** | `src/middleware.js` | Cookie-based auth check, onboarding redirect logic |
| **Server Client** | `src/lib/supabase-server.js` | `createSupabaseServer()` — SSR cookie-based for server components and API routes |
| **Service Role Client** | `src/lib/supabase.js` | Service role — bypasses RLS, used by webhook handlers and server-side writes |
| **Browser Client** | `src/lib/supabase-browser.js` | `createBrowserClient()` — anon key, for client components and Realtime subscriptions |
| **Tenant Resolver** | `src/lib/get-tenant-id.js` | `getTenantId()` — resolves authenticated user to their tenant_id |
| **RLS Policies** | All migration files | Two-pattern tenant isolation enforced at DB level |
| **Migrations** | `supabase/migrations/` | 11 sequential migrations building full schema |
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
       │     supabase (service role).from('tenants').eq('owner_id', user.id) → tenant.id
       │
       └── verifyAdmin() pattern (admin API routes)
             createSupabaseServer().auth.getUser() → user
             supabase (service role).from('admin_users').eq('user_id', user.id) → returns user if admin

Webhook path (Retell, cron jobs):
  Retell webhook → supabase (service role client) → bypasses RLS for cross-tenant writes

Realtime subscriptions (browser):
  Dashboard leads page → supabase-browser client → filtered by tenant_id via RLS
```

---

## File Map

| File | Role |
|------|------|
| `src/middleware.js` | Auth guard middleware — cookie-based auth, onboarding redirect, AUTH_REQUIRED_PATHS, admin gate |
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
- Webhook handlers (Retell, Google, Outlook) — must write to any tenant's data
- `getTenantId()` — reads tenants table by `owner_id` (service role avoids RLS chicken-and-egg)
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

const { data: tenant } = await supabase   // service role client
  .from('tenants')
  .select('id')
  .eq('owner_id', user.id)
  .single();

return tenant?.id || null;
```

**Key design**: Uses `user.id` (the Supabase auth UID) to query `tenants.owner_id`. Does NOT use `user.user_metadata` — tenant_id is never stored in Supabase auth user_metadata. The tenants table is the authoritative source.

**Hybrid client usage**: `createSupabaseServer()` for auth (reads session cookie); service role `supabase` for the tenants query (avoids RLS dependency on session state for that query).

---

## 3. Middleware

**File**: `src/middleware.js`

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

All 12 migrations are applied sequentially. FK dependencies require this order.

### 001_initial_schema.sql — Foundation

**Tables created**: `tenants`, `calls`

**tenants columns**:
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | gen_random_uuid() |
| `owner_id` | uuid UNIQUE | Supabase auth user ID |
| `business_name` | text | nullable |
| `retell_phone_number` | text UNIQUE | nullable |
| `owner_phone` | text | nullable |
| `owner_email` | text | nullable |
| `default_locale` | text | NOT NULL DEFAULT 'en' |
| `onboarding_complete` | boolean | NOT NULL DEFAULT false |
| `created_at`, `updated_at` | timestamptz | |

**calls columns**: `id`, `tenant_id` (FK), `retell_call_id` UNIQUE, `from_number`, `to_number`, `direction`, `status`, `disconnection_reason`, `start_timestamp`, `end_timestamp`, `duration_seconds` (GENERATED STORED), `recording_url`, `recording_storage_path`, `transcript_text`, `transcript_structured` (jsonb), `detected_language`, `language_barrier`, `barrier_language`, `retell_metadata` (jsonb)

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
| `urgency_tag` | text | CHECK 'emergency'|'routine'|'high_ticket', DEFAULT 'routine' |
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

**appointments**: `id`, `tenant_id` (FK), `call_id` (FK → calls SET NULL), `start_time`, `end_time`, `service_address`, `caller_name`, `caller_phone`, `urgency` (CHECK emergency|routine|high_ticket), `zone_id` (FK → service_zones SET NULL), `status` (CHECK confirmed|cancelled|completed DEFAULT confirmed), `booked_via` (CHECK ai_call|manual DEFAULT ai_call), `google_event_id` (text, renamed in 007), `notes`. Constraint: `UNIQUE (tenant_id, start_time)`.

**calendar_credentials**: `id`, `tenant_id` (FK), `provider` (CHECK google|outlook DEFAULT google), `access_token`, `refresh_token`, `expiry_date` (bigint), `calendar_id` (DEFAULT 'primary'), `calendar_name`, `watch_channel_id`, `watch_resource_id`, `watch_expiration` (bigint), `last_sync_token`, `last_synced_at`. Constraint: `UNIQUE (tenant_id, provider)`.

**`book_appointment_atomic` RPC function** (SECURITY DEFINER):
```sql
-- Acquires non-blocking advisory lock: abs(hashtext(tenant_id || epoch(start_time)))
-- Checks tsrange overlap on non-cancelled appointments
-- Returns: jsonb { success: true, appointment_id: uuid }
--       or: jsonb { success: false, reason: 'slot_taken' }
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
| `urgency` | text | CHECK emergency|routine|high_ticket |
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
| `leads` | 004 | CRM records with Realtime enabled | Tenant child |
| `lead_calls` | 004 | Junction: many calls → one lead | Via leads.tenant_id |
| `activity_log` | 004 | Dashboard event feed | Tenant child |
| `escalation_contacts` | 006 | Owner-configured escalation chain | Tenant child |
| `subscriptions` | 010 | Stripe subscription state per tenant | Tenant child (SELECT-own only) |
| `stripe_webhook_events` | 010 | Webhook idempotency (UNIQUE event_id) | Service role only |
| `phone_inventory` | 011 | Singapore phone number pool for tenant assignment | Service role only (no authenticated policies) |
| `phone_inventory_waitlist` | 011 | Email waitlist for SG number availability | INSERT for anon+authenticated |
| `admin_users` | 012 | Platform admin users — gates /admin/* routes | Authenticated SELECT-own only (user_id = auth.uid()) |

**Tenant columns added across migrations** (all on `tenants` table):
- 002: `tone_preset`, `trade_type`, `test_call_completed`, `working_hours`
- 003: `tenant_timezone`, `slot_duration_mins`
- 005: `setup_checklist_dismissed`
- 011: `owner_name`, `country`, `provisioning_failed`

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

- **verifyAdmin uses service_role for admin_users lookup**: Unlike `getTenantId()`, `verifyAdmin()` uses the service-role client for the admin_users query rather than the anon-key session client. This ensures consistent behavior regardless of RLS policy changes. The session client is used only for `auth.getUser()`.

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

## Important: Keeping This Document Updated

When adding new migrations or modifying RLS policies, update the Migration Trail and RLS Policy Patterns sections. When adding new source files that use Supabase clients, add them to the File Map. When new tables are created, add them to the Complete Table Reference and verify they have both a tenant_id child RLS policy and a service_role bypass policy.

Key areas to keep current:
- Migration Trail — add new migration entry with tables created/altered, key columns, RLS policies
- Complete Table Reference — add new tables with their migration, purpose, and RLS pattern
- Three Supabase Clients — if new client patterns are introduced (they shouldn't be)
- Environment Variables — if new Supabase-related env vars are added

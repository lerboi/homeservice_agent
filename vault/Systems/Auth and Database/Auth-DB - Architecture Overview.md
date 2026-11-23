---
type: system
system: Auth and Database
status: current
description: "End-to-end flow and main components of Auth and Database."
source: .claude/skills/auth-database-multitenancy/SKILL.md § Architecture Overview
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# Architecture Overview

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

| Layer | File(s) | Purpose |
|-------|---------|---------|
| **Middleware Auth Guard** | `src/proxy.js` | Cookie-based auth check, onboarding redirect logic |
| **Server Client** | `src/lib/supabase-server.js` | `createSupabaseServer()` — SSR cookie-based for server components and API routes |
| **Service Role Client** | `src/lib/supabase.js` | Service role — bypasses RLS, used by webhook handlers and server-side writes |
| **Browser Client** | `src/lib/supabase-browser.js` | `createBrowserClient()` — anon key, for client components and Realtime subscriptions |
| **Tenant Resolver** | `src/lib/get-tenant-id.js` | `getTenantId()` — resolves authenticated user to their tenant_id |
| **RLS Policies** | All migration files | Two-pattern tenant isolation enforced at DB level |
| **Migrations** | `supabase/migrations/` | Sequential migrations building full schema — highest is 076 (76 distinct versions, 77 files on disk — duplicate version 030); 072/073/074/075/076 PENDING manual apply |
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

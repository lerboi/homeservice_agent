---
type: system
system: Auth and Database
status: current
description: "Middleware. Covers: AUTH_REQUIRED_PATHS; Client Used in Middleware; Auth Check Flow; Admin Gate (added Phase 28-01); Matcher Config"
source: .claude/skills/auth-database-multitenancy/SKILL.md § 3. Middleware
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# Middleware

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

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

---
type: system
system: Onboarding
status: legacy-app
description: "File: src/proxy.js (Next 16 proxy convention — NOT src/middleware.js; see auth-database-multitenancy skill)"
source: .claude/skills/onboarding-flow/SKILL.md § 9. Proxy Auth Guards
migrated: 2026-11-23
verified:
tags: [voco/system/onboarding]
---

# Proxy Auth Guards

Part of [[Onboarding]]. Migrated verbatim from the `onboarding-flow` skill; check `verified` before trusting details.

**File**: `src/proxy.js` (Next 16 proxy convention — NOT `src/middleware.js`; see auth-database-multitenancy skill)

```js
const AUTH_REQUIRED_PATHS = [
  '/onboarding',
  '/dashboard',
];
```

**IMPORTANT**: `/auth/signin` is NOT in `AUTH_REQUIRED_PATHS` — it's the public auth step. The `AUTH_REQUIRED_PATHS` check uses `pathname === p || pathname.startsWith(p + '/')` — so `/onboarding` itself (the profile page) IS auth-protected.

**Logic flow:**
1. Unauthenticated on auth-required path → redirect to `/auth/signin`
2. Authenticated on `/auth/signin` → redirect to `/onboarding` (not onboarded) or `/dashboard` (onboarded)
3. Authenticated on `/onboarding*` paths + `onboarding_complete === true` → redirect to `/dashboard`
4. Authenticated on `/dashboard*` paths + `onboarding_complete !== true` → **paid-user rescue first (2026-06-13)**: a service-role query checks for an `is_current` subscription with status active/trialing/past_due; if found, the proxy repairs `onboarding_complete = true` and lets the request through (a delayed `checkout.session.completed` webhook must not bounce a paying customer back to wizard Step 1). Otherwise → redirect to `/onboarding`

**Onboarding check is ONLY run for `/onboarding*` paths** — not `/dashboard`. This avoids an unnecessary DB query on every dashboard page load.

**OAuth callback**: `src/app/auth/callback/route.js` — default redirect target is `/onboarding` (no `next` param). Google OAuth users land on `/onboarding` after token exchange, which is Step 1 (profile) — they skip the auth prerequisite because Google already authenticated them.

---

---
type: system
system: Auth and Database
status: current
description: "The codebase uses exactly three Supabase clients, each with a distinct purpose. Using the wrong client is a common bug source. Covers: `src/lib/supabase.js` — Service Role Client; `src/lib/supabase-server.js` — SSR Cookie-Based Client; `src/lib/supabase-browser.js` — Browser Client"
source: .claude/skills/auth-database-multitenancy/SKILL.md § 1. Three Supabase Clients
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# Three Supabase Clients

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

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

---
type: system
system: Public Site
status: pending-rebuild
description: "File: src/components/landing/AuthAwareCTA.js"
source: .claude/skills/public-site-i18n/SKILL.md § 6. AuthAwareCTA
migrated: 2026-11-23
verified:
tags: [voco/system/public-site]
---

# AuthAwareCTA

Part of [[Public Site]]. Migrated verbatim from the `public-site-i18n` skill; check `verified` before trusting details.

**File**: `src/components/landing/AuthAwareCTA.js`

```js
'use client';
export function AuthAwareCTA({ variant = 'hero' }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
  }, []);

  if (isLoggedIn) {
    return <Button asChild><Link href="/dashboard">Go to Dashboard</Link></Button>;
  }
  return <Button asChild><Link href="/pricing">Start My 5-Minute Setup</Link></Button>;
}
```

- `variant="hero"` — standard hero button sizing
- `variant="cta"` — larger CTA section sizing (slightly different padding/shadow classes)
- Authentication state checked once on mount via `supabase-browser` client
- Hydration: starts as unauthenticated state (no flash for logged-out users), updates after `getUser()` resolves

Cross-domain: See auth-database-multitenancy skill for supabase-browser client details.

---

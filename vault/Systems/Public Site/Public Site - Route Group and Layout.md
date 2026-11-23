---
type: system
system: Public Site
status: pending-rebuild
description: "File: src/app/(public)/layout.js"
source: .claude/skills/public-site-i18n/SKILL.md § 1. Route Group and Layout
migrated: 2026-11-23
verified:
tags: [voco/system/public-site]
---

# Route Group and Layout

Part of [[Public Site]]. Migrated verbatim from the `public-site-i18n` skill; check `verified` before trusting details.

**File**: `src/app/(public)/layout.js`

```js
import { LandingNav } from '@/app/components/landing/LandingNav';
import { LandingFooter } from '@/app/components/landing/LandingFooter';
import { Toaster } from 'sonner';
import PublicChatButton from '@/components/landing/PublicChatButton';

export default function PublicLayout({ children }) {
  return (
    <>
      <LandingNav />
      <main className="relative">{children}</main>
      <LandingFooter />
      <Toaster richColors position="top-center" />
      <PublicChatButton />
    </>
  );
}
```

The `(public)` Next.js route group applies `layout.js` to all routes inside it (`/`, `/pricing`, `/about`, `/contact`) without affecting the URL. `LandingNav` and `LandingFooter` are NOT placed inside individual page components — they're injected once via the layout.

The `Toaster` (from sonner) is placed in the root layout so ContactForm toast notifications work across all public pages.

`PublicChatButton` is mounted at the layout level so the floating chat FAB appears on all public pages. It is a direct import (not dynamic) — lightweight client component with no heavy dependencies.

---

---
type: system
system: Dashboard and CRM
status: legacy-app
description: "UI Polish Primitives (Phase 58 Plan 04). Covers: EmptyState — `src/components/ui/empty-state.jsx`; ErrorState — `src/components/ui/error-state.jsx`; AsyncButton — `src/components/ui/async-button.jsx`; Focus-visible token migration; Phase 58 Plan 05 sweep"
source: .claude/skills/dashboard-crm-system/SKILL.md § 11. UI Polish Primitives (Phase 58 Plan 04)
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# UI Polish Primitives (Phase 58 Plan 04)

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

Under `src/components/ui/`:

### EmptyState — `src/components/ui/empty-state.jsx`

POLISH-01. Icon + headline required; description / ctaLabel / ctaHref /
ctaOnClick optional. `ctaHref` renders `asChild Button Link`;
`ctaOnClick` renders `Button` with handler. No CTA without `ctaLabel`.
Icon `aria-hidden="true"`. Tailwind semantic tokens only.

Wrappers delegate to it:
- `EmptyStateLeads.jsx` (17 lines) — icon=Users, headline="No jobs yet"
- `EmptyStateCalendar.jsx` — icon=Calendar with `padding` + `onConnect`
  props preserved for backward compat.

### ErrorState — `src/components/ui/error-state.jsx`

POLISH-04. `role="alert"` outer; `AlertTriangle` icon
(`h-8 w-8 text-destructive/70`); fixed "Something went wrong" headline;
default "We couldn't load this. Please try again." (Unicode apostrophe);
retry Button only when `onRetry` provided, `retryLabel` defaults to
"Try again".

### AsyncButton — `src/components/ui/async-button.jsx`

POLISH-05. Wraps shadcn `<Button>`. `pending || disabled` both disable;
when pending renders `Loader2 animate-spin` + swaps label to
`pendingLabel ?? children`. All Button props spread through (variant,
size, onClick, type, className, asChild).

### Focus-visible token migration

**File**: `src/lib/design-tokens.js`

`focus.ring` export migrated (Phase 58 POLISH-03):
```js
// Old:
ring: 'focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1'
// New (Phase 58):
ring: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--background)]'
```

Keyboard-only reveal (not on mouse click) + dark-mode offset blending.
All consumers that import `{ focus }` pick up the change automatically.

### Phase 58 Plan 05 sweep

7 dashboard pages now have layout-matching `loading.js` Next.js skeletons
using the shared `<Skeleton>` primitive (`src/components/ui/skeleton.jsx`):
jobs, calls, calendar, services, settings, more/integrations, more/billing.

All 7 pages surface `<ErrorState onRetry>` on fetch failure. `services`
and `settings` were promoted from redirect stubs to first-class polished
pages (setup-checklist deep-links already hit these routes).

---

---
phase: 02-onboarding-and-triage
plan: 03
subsystem: ui
tags: [shadcn, tailwind, supabase, next-intl, oauth, react, lucide-react]

# Dependency graph
requires:
  - phase: 02-onboarding-and-triage
    provides: trade-templates.js with TRADE_TEMPLATES constant, triage classifier pipeline
  - phase: 01-voice-infrastructure
    provides: next-intl i18n setup, supabase client patterns

provides:
  - shadcn initialized (New York style, Tailwind v4, components.json)
  - Google OAuth sign-in + email/password auth at /auth/signin
  - OAuth callback handler at /auth/callback that exchanges code and redirects to /onboarding
  - Wizard Step 1 at /onboarding: business name + tone preset selection
  - Wizard Step 2 at /onboarding/services: trade template selection + service list editing
  - POST /api/onboarding/start: saves tenant business_name/tone_preset and trade_type/services
  - Spanish translations for all onboarding copy
  - Onboarding wizard layout with progress bar and step counter

affects: [02-04, 02-05, phase-3, phase-4]

# Tech tracking
tech-stack:
  added:
    - "@supabase/ssr ^0.9.0 — server-side Supabase client via cookies for Next.js RSC"
    - "tailwindcss ^4.2.2 — Tailwind v4 with @tailwindcss/postcss"
    - "class-variance-authority — shadcn component variants"
    - "clsx + tailwind-merge — cn() utility for className merging"
    - "lucide-react — icon library (X, Plus icons)"
    - "radix-ui — headless primitives (via shadcn)"
    - "sonner — toast notifications"
    - "shadcn components: button, input, card, progress, badge, label, alert, sonner"
  patterns:
    - "createSupabaseServer() pattern: async function, cookies() from next/headers, @supabase/ssr createServerClient"
    - "Wizard step pages: 'use client', useTranslations(), fetch to API route, router.push() navigation"
    - "Tone/trade card selection: role=radio, aria-checked, keyboard-navigable (Enter/Space), border-blue-600 selected state"
    - "API route auth pattern: createSupabaseServer().auth.getUser() before any data mutation"
    - "Service tag badges: urgency_tag maps to red-100/amber-100/slate-100 color scheme"

key-files:
  created:
    - src/app/globals.css
    - src/app/layout.js
    - src/app/auth/signin/page.js
    - src/app/auth/callback/route.js
    - src/app/onboarding/layout.js
    - src/app/onboarding/page.js
    - src/app/onboarding/services/page.js
    - src/app/api/onboarding/start/route.js
    - src/lib/supabase-server.js
    - src/lib/utils.js
    - components.json
    - postcss.config.mjs
  modified:
    - messages/en.json (added auth + onboarding namespaces)
    - messages/es.json (added auth + onboarding namespaces in Spanish)
    - package.json (added @supabase/ssr, tailwindcss, shadcn deps)
    - src/lib/triage/layer2-llm.js (lazy OpenAI client instantiation)

key-decisions:
  - "Tailwind v4 uses @import 'tailwindcss' in CSS + @tailwindcss/postcss plugin (no tailwind.config.js)"
  - "components.json created manually since shadcn CLI couldn't auto-detect Tailwind v4 CSS without existing config"
  - "OpenAI client in layer2-llm.js lazy-instantiated (getClient() pattern) to prevent build failure without OPENAI_API_KEY"
  - "Step 2 API call submits both trade_type and services in single POST — same endpoint handles both steps by inspecting body shape"
  - "Trade cards use simple label text (no icons) — UI-SPEC doesn't mandate icons for trade cards, icon placeholder skipped for clarity"

patterns-established:
  - "Wizard pages: 'use client', derive step number from usePathname() in layout"
  - "Onboarding layout wraps children in aria-live polite region for a11y step announcements"
  - "All interactive selection cards: role=radio, aria-checked, tabIndex=0, Enter/Space keyboard support"

requirements-completed: [ONBOARD-01, ONBOARD-02, ONBOARD-06]

# Metrics
duration: 8min
completed: 2026-03-19
---

# Phase 2 Plan 03: Onboarding UI Summary

**shadcn/Tailwind v4 initialized, Google OAuth auth flow, and wizard Steps 1-2 with tone presets, trade templates, and service list editing**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-19T07:06:37Z
- **Completed:** 2026-03-19T07:14:45Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- shadcn initialized with Tailwind v4, PostCSS config, components.json, and all required UI components
- Google OAuth sign-in + email/password fallback at /auth/signin, callback handler at /auth/callback
- Wizard Step 1: business name input with inline validation + 3 keyboard-navigable tone preset cards
- Wizard Step 2: 2x2 trade template grid + service list with urgency badges and add/remove functionality
- API route POST /api/onboarding/start with auth.getUser() guard, upserts tenants and inserts services
- Full Spanish translations for all onboarding copy in messages/es.json

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize shadcn, Tailwind, auth flow, and onboarding layout** - `c9cc85a` (feat)
2. **Task 2: Wizard Step 1, Step 2, API route, and translation keys** - `e79dbc0` (feat)

## Files Created/Modified

- `components.json` - shadcn configuration (New York style, neutral base, Tailwind v4 CSS path)
- `postcss.config.mjs` - Tailwind v4 PostCSS plugin configuration
- `src/app/globals.css` - Tailwind v4 directives, CSS custom properties, Inter font-family on body
- `src/app/layout.js` - Added Inter font via next/font/google, imports globals.css
- `src/app/auth/signin/page.js` - Google OAuth + email/password sign-in with shadcn Card/Button/Input/Label
- `src/app/auth/callback/route.js` - exchangeCodeForSession, redirects to /onboarding
- `src/app/onboarding/layout.js` - Wizard shell: logo, step counter, Progress bar, aria-live region
- `src/app/onboarding/page.js` - Step 1: business name field + 3 tone preset radio cards + CTA
- `src/app/onboarding/services/page.js` - Step 2: trade cards + service list with badges + add/remove
- `src/app/api/onboarding/start/route.js` - Auth-protected API upserts tenants + inserts services
- `src/lib/supabase-server.js` - createSupabaseServer() using @supabase/ssr + next/headers cookies
- `src/lib/utils.js` - cn() utility using clsx + tailwind-merge for shadcn components
- `src/components/ui/` - 8 shadcn components: button, input, card, progress, badge, label, alert, sonner
- `messages/en.json` + `messages/es.json` - Added auth and onboarding namespaces

## Decisions Made

- Tailwind v4 is CSS-first (no `tailwind.config.js`); uses `@import "tailwindcss"` in globals.css with `@tailwindcss/postcss` plugin
- `components.json` created manually because shadcn CLI v4 couldn't auto-detect Tailwind v4 without existing CSS file
- OpenAI client in `layer2-llm.js` changed to lazy instantiation to prevent build failure when `OPENAI_API_KEY` is not set at build time

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lazy-instantiate OpenAI client in layer2-llm.js**
- **Found during:** Task 1 (build verification)
- **Issue:** `const client = new OpenAI(...)` at module top-level fails during Next.js build when `OPENAI_API_KEY` is not in environment, causing `Failed to collect page data for /api/webhooks/retell`
- **Fix:** Replaced top-level instantiation with `getClient()` lazy factory function — client created on first call, not at module load
- **Files modified:** `src/lib/triage/layer2-llm.js`
- **Verification:** `npm run build` succeeds with all 8 routes compiled cleanly
- **Committed in:** c9cc85a (Task 1 commit)

**2. [Rule 3 - Blocking] Manual components.json creation**
- **Found during:** Task 1 (shadcn init)
- **Issue:** `npx shadcn@latest init` CLI v4 could not validate Tailwind CSS even after installing tailwindcss v4, because it requires an existing CSS import file before detecting configuration
- **Fix:** Created `components.json` manually with correct schema, style (new-york), base color (neutral), and CSS path pointing to `src/app/globals.css` which already had the `@import "tailwindcss"` directive
- **Files modified:** `components.json`
- **Verification:** `npx shadcn@latest add button input card...` succeeded after components.json existed
- **Committed in:** c9cc85a (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes required for build correctness. No scope creep — the layer2-llm fix is a pre-existing latent bug surfaced during build validation.

## Issues Encountered

- shadcn CLI v4 changed its `--style` flag — `--style=new-york` is no longer a valid init option. Worked around by creating `components.json` manually with `"style": "new-york"`.
- Tailwind v4 ships as `tailwindcss` package but requires `@tailwindcss/postcss` plugin (not `autoprefixer` like v3). Configured via `postcss.config.mjs`.

## User Setup Required

None - no new external service configuration required. Existing env vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY) already documented in .env.example from Phase 1.

## Next Phase Readiness

- Wizard Steps 1-2 are fully functional UI shells — ready for Plan 02-04 (Step 3: phone verification + Retell provisioning)
- Auth flow complete (Google OAuth + email/password) — no further auth work needed for onboarding
- Translation keys for all 3 wizard steps + activation screen are in place (Steps 3 + activation copy already added to messages)
- Supabase `tenants` and `services` tables must exist for the API route to function — verify schema matches the upsert/insert shapes

---
*Phase: 02-onboarding-and-triage*
*Completed: 2026-03-19*

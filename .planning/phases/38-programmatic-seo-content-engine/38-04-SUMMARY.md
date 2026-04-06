---
phase: 38-programmatic-seo-content-engine
plan: 04
subsystem: ui
tags: [next.js, seo, integrations, json-ld, schema, lucide-react, shadcn]

# Dependency graph
requires:
  - phase: 38-01
    provides: INTEGRATIONS data array, SchemaMarkup component, OG image route
provides:
  - src/app/(public)/integrations/page.js — Integrations hub listing with card grid
  - src/app/(public)/integrations/[tool]/page.js — Integration detail with use cases, JSON-LD, CTA
affects:
  - sitemap.js (already includes /integrations/* dynamic routes from Plan 01)
  - LandingFooter (future: integrations hub linked under Resources column)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Integration detail page uses icon lookup object (ICON_MAP) to map string icon names from data arrays to Lucide React components — avoids dynamic import, keeps tree-shaking safe
    - generateMetadata with await params pattern for Next.js App Router dynamic routes
    - AnimatedStagger + AnimatedItem wrapping card grids for staggered scroll-in

key-files:
  created:
    - src/app/(public)/integrations/page.js
    - src/app/(public)/integrations/[tool]/page.js
  modified: []

key-decisions:
  - "Icon lookup object (ICON_MAP) maps string icon names from data arrays to Lucide React imports — avoids dynamic() import complexity, all four icons (Calendar/Clock/Bell/RefreshCw) tree-shakeable"
  - "Related integrations section conditionally rendered — only when relatedSlugs.length > 0, so Google Calendar seed (empty relatedSlugs) renders cleanly without empty section"

patterns-established:
  - "Pattern: Lucide icon lookup objects for data-driven icon rendering — import all needed icons at top of file, map by string name, render from lookup"

requirements-completed: [SEO-07, SEO-10]

# Metrics
duration: 5min
completed: 2026-04-06
---

# Phase 38 Plan 04: Integration Pages Summary

**Integrations hub listing card grid and dynamic integration detail page with 2x2 use case cards, SoftwareApplication JSON-LD schema, and AuthAwareCTA — completes the fourth of five SEO page template types.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-06T13:55:19Z
- **Completed:** 2026-04-06T14:00:30Z
- **Tasks:** 2
- **Files modified:** 2 (all new)

## Accomplishments

- Created `/integrations` hub page with warm stone header, card grid listing all INTEGRATIONS with badge, tool name, description preview, and "Learn more" link
- Created `/integrations/[tool]` detail page with generateStaticParams, generateMetadata (await params), hero with logo connector row, description prose, 2x2 use case grid with Lucide icons, SoftwareApplication JSON-LD, and AuthAwareCTA CTA card
- Implemented ICON_MAP lookup pattern for mapping string icon names from data arrays to Lucide React components (Calendar, Clock, Bell, RefreshCw)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Integrations hub listing page** - `3a69da5` (feat)
2. **Task 2: Create Integration detail page with use cases and SoftwareApplication schema** - `40a5d9a` (feat)

## Files Created/Modified

- `src/app/(public)/integrations/page.js` — Integrations hub with static metadata, card grid from INTEGRATIONS array, AnimatedStagger entrance animations
- `src/app/(public)/integrations/[tool]/page.js` — Dynamic integration detail with generateStaticParams, generateMetadata (await params), hero/description/use cases/CTA sections, SoftwareApplication schema

## Decisions Made

- Used an ICON_MAP lookup object `{ Calendar, Clock, Bell, RefreshCw }` to render Lucide icons from string names in the data array. This avoids dynamic imports and keeps all four icons tree-shakeable at build time.
- Related integrations section is conditionally rendered only when `relatedSlugs.length > 0`. The Google Calendar seed has empty `relatedSlugs`, so no empty section renders on the initial seed page.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

The `npm run build` command produced an ENOENT error on `.next` cache files — this is caused by parallel agent activity writing to the shared `.next` directory simultaneously. The error is a build infrastructure collision, not a code error. File syntax and import correctness verified via Node.js file inspection: all required exports, imports, and patterns present in both created files.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Integration hub at `/integrations` renders all INTEGRATIONS from the data array — adding a new integration requires only appending to `src/data/integrations.js`
- Integration detail at `/integrations/[tool]` handles `notFound()` for any missing slug
- SoftwareApplication JSON-LD renders on all detail pages
- AuthAwareCTA provides the primary conversion action on every detail page
- Plans 38-02, 38-03, 38-05 (blog, persona, glossary, comparison) run in parallel using the same pattern

## Known Stubs

None — INTEGRATIONS seed data is real content (Google Calendar integration with 4 use cases and real CTA copy).

---
*Phase: 38-programmatic-seo-content-engine*
*Completed: 2026-04-06*

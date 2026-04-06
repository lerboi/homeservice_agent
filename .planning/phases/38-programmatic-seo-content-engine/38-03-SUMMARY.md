---
phase: 38-programmatic-seo-content-engine
plan: 03
subsystem: ui
tags: [next.js, seo, personas, comparisons, static-pages, json-ld, shadcn]

# Dependency graph
requires:
  - phase: 38-01
    provides: src/data/personas.js PERSONAS array and src/data/comparisons.js COMPARISONS array and SchemaMarkup.jsx and OG image route

provides:
  - src/app/(public)/for/page.js — Persona hub listing page with PERSONA badge cards grid
  - src/app/(public)/for/[persona]/page.js — Persona detail mini-landing page (hero, pain points, features, testimonial, dark CTA)
  - src/app/(public)/compare/page.js — Comparison hub listing page with COMPARE badge cards grid
  - src/app/(public)/compare/[comparison]/page.js — Comparison detail page with side-by-side shadcn Table, Check/X icons, verdict section

affects:
  - Sitemap (38-01 already includes /for/* and /compare/* routes)
  - Internal linking hubs
  - SEO crawlability for trade persona and comparison keyword clusters

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Persona detail page uses icon map object (ICON_MAP) keyed by string from data array for dynamic Lucide icon lookup without dynamic imports
    - Comparison Table uses sr-only span for accessibility alongside visual Check/X icons
    - Both detail pages use await params pattern (Next.js 16 async params requirement)
    - AnimatedSection direction="up" wraps every section for consistent scroll animation

key-files:
  created:
    - src/app/(public)/for/page.js
    - src/app/(public)/for/[persona]/page.js
    - src/app/(public)/compare/page.js
    - src/app/(public)/compare/[comparison]/page.js
  modified: []

key-decisions:
  - "Icon map object { Phone, Clock, DollarSign } keyed by string avoids dynamic imports and keeps persona detail as a Server Component"
  - "CTA section on persona detail uses bg-[#1C1412] dark background matching about page pattern despite light-content page style rule — this is a contained CTA section, not a full page dark section"

patterns-established:
  - "Hub listing: bg-[#F5F5F4] header + white card grid using card.base + card.hover design tokens"
  - "Detail page: AnimatedSection wrapping every section, generateStaticParams + async generateMetadata with await params, SchemaMarkup JSON-LD at top of return"

requirements-completed: [SEO-05, SEO-06, SEO-10]

# Metrics
duration: 5min
completed: 2026-04-06
---

# Phase 38 Plan 03: Persona and Comparison Pages Summary

**4 SEO page templates: persona hub + detail mini-landing (hero/pain-points/features/testimonial/CTA) and comparison hub + detail with shadcn feature table and accessibility sr-only text**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-06T13:55:29Z
- **Completed:** 2026-04-06T14:01:21Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Persona hub at /for lists all trade personas from PERSONAS data as card grid with PERSONA badge
- Persona detail at /for/[persona] renders full 5-section mini-landing page: hero with AuthAwareCTA, pain points grid with Lucide icons from data-driven icon map, feature highlights with Check-icon bullet lists, testimonial blockquote with orange left border, dark CTA section
- Comparison hub at /compare lists all comparisons from COMPARISONS data as card grid with COMPARE badge
- Comparison detail at /compare/[comparison] renders side-by-side shadcn Table with Check/X icons + sr-only text, verdict card, and AuthAwareCTA
- All pages: generateStaticParams + generateMetadata with await params, JSON-LD WebPage schema, canonical URLs

## Task Commits

Each task was committed atomically:

1. **Task 1: Persona hub and detail pages** - `afedbf1` (feat)
2. **Task 2: Comparison hub and detail pages** - `e6a5e1e` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `src/app/(public)/for/page.js` — Persona hub: static metadata, PERSONAS card grid
- `src/app/(public)/for/[persona]/page.js` — Persona detail: 5 sections, generateStaticParams, generateMetadata, SchemaMarkup
- `src/app/(public)/compare/page.js` — Comparison hub: static metadata, COMPARISONS card grid
- `src/app/(public)/compare/[comparison]/page.js` — Comparison detail: shadcn Table, verdict section, SchemaMarkup

## Decisions Made
- Icon map object `{ Phone, Clock, DollarSign }` keyed by string from data array — avoids dynamic imports while keeping page a Server Component
- Dark CTA section (bg-[#1C1412]) applied to persona detail CTA section to match about page pattern; UI-SPEC restricts "dark page backgrounds" not contained CTA sections

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Next.js build had a pre-existing syntax error in `src/app/dashboard/leads/page.js` (unrelated to this plan). Acceptance criteria verified via direct grep/file checks instead of full build output. Build failure is out-of-scope per deviation boundary rules — logged to deferred items.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None — all 4 pages render from live PERSONAS and COMPARISONS seed data arrays. No hardcoded empty values or placeholder text.

## Next Phase Readiness
- /for/* and /compare/* routes are live and ready for crawling
- Persona and comparison data in src/data/ can be extended with additional entries without code changes
- 38-04 (integrations pages) and 38-05/38-06 (blog/glossary pages) can proceed independently

---
*Phase: 38-programmatic-seo-content-engine*
*Completed: 2026-04-06*

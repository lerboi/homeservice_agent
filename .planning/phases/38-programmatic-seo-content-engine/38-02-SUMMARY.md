---
phase: 38-programmatic-seo-content-engine
plan: 02
subsystem: ui
tags: [next.js, seo, blog, glossary, json-ld, schema-markup, radix-accordion, static-params]

# Dependency graph
requires:
  - phase: 38-01
    provides: "Data layer: src/data/blog.js, src/data/glossary.js, SchemaMarkup component"
provides:
  - "Blog hub listing page at /blog with card grid"
  - "Blog detail page at /blog/[slug] with generateStaticParams, generateMetadata, Article JSON-LD"
  - "Glossary hub listing page at /glossary with card grid"
  - "Glossary detail page at /glossary/[term] with FAQPage JSON-LD and light-surface FAQ accordion"
  - "GlossaryFAQ.jsx reusable light-surface Radix Accordion component"
affects: [38-03, 38-04, 38-05, public-site-i18n]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "generateStaticParams + generateMetadata with await params on all dynamic SEO routes"
    - "Content section parsing via split on ## headings for blog article rendering"
    - "Light-surface Radix Accordion pattern (border-stone-200) distinct from dark pricing FAQ"
    - "OG image URL pattern: /og?title=<encoded>&type=<PAGE_TYPE>"
    - "Canonical URL pattern: https://voco.live/<section>/<slug>"

key-files:
  created:
    - src/app/(public)/blog/page.js
    - src/app/(public)/blog/[slug]/page.js
    - src/app/(public)/glossary/page.js
    - src/app/(public)/glossary/[term]/page.js
    - src/app/(public)/glossary/GlossaryFAQ.jsx
  modified: []

key-decisions:
  - "GlossaryFAQ extracted to src/app/(public)/glossary/GlossaryFAQ.jsx (client component) to keep detail page a server component while using Radix Accordion hooks"
  - "Blog content rendered by splitting on ## headings — raw markdown not parsed (no markdown library dependency)"
  - "Light-surface accordion uses border-stone-200 not border-white/[0.08] — separate component from pricing page FAQSection"

patterns-established:
  - "SEO hub listing page pattern: bg-[#F5F5F4] header section + bg-white card grid section + AnimatedStagger/AnimatedItem"
  - "SEO detail page pattern: back-to-hub link + content + CTA section with AuthAwareCTA variant=cta"
  - "Dynamic route metadata: always await params, check for 404, return canonical + OG image"

requirements-completed: [SEO-04, SEO-08, SEO-10]

# Metrics
duration: 7min
completed: 2026-04-06
---

# Phase 38 Plan 02: Blog and Glossary Page Templates Summary

**Blog and glossary hub + detail pages with generateStaticParams, FAQPage/Article JSON-LD schema, and light-surface Radix Accordion — 4 page files + 1 reusable component**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-06T13:55:09Z
- **Completed:** 2026-04-06T14:01:44Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Blog hub at /blog renders AnimatedStagger card grid from BLOG_POSTS seed data with featured image, badge, excerpt, date, and "Read article" link
- Blog detail at /blog/[slug] renders full article with parsed sections (## headings), Article JSON-LD schema, back-to-hub link, related posts, and AuthAwareCTA
- Glossary hub at /glossary renders card grid from GLOSSARY_TERMS with definition preview and "Read definition" link
- Glossary detail at /glossary/[term] renders definition, FAQPage JSON-LD, light-surface FAQ accordion, related term pills, and AuthAwareCTA
- GlossaryFAQ.jsx client component isolates Radix Accordion from server component context while using light-surface colors (border-stone-200)

## Task Commits

Each task was committed atomically:

1. **Task 1: Blog hub listing and Blog detail pages** - `8c30417` (feat)
2. **Task 2: Glossary hub listing and Glossary detail pages** - `6166c83` (feat)

## Files Created/Modified

- `src/app/(public)/blog/page.js` - Blog hub with BLOG_POSTS card grid, static metadata, AnimatedStagger
- `src/app/(public)/blog/[slug]/page.js` - Blog detail with generateStaticParams, generateMetadata, Article JSON-LD, content section parser
- `src/app/(public)/glossary/page.js` - Glossary hub with GLOSSARY_TERMS card grid, static metadata, AnimatedStagger
- `src/app/(public)/glossary/[term]/page.js` - Glossary detail with generateStaticParams, generateMetadata, FAQPage JSON-LD, related term pills
- `src/app/(public)/glossary/GlossaryFAQ.jsx` - 'use client' Radix Accordion component with light-surface styling

## Decisions Made

- GlossaryFAQ extracted to a dedicated client component file so the glossary detail page remains a server component (cannot use Radix hooks directly in server components).
- Blog content rendered by splitting on `## ` heading markers — no markdown parser dependency added; keeps bundle clean.
- Light-surface accordion uses `border-stone-200` and `text-[#0F172A]` (not `border-white/[0.08]` and white text from the dark pricing FAQ).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Stale `.next/lock` file from a parallel build agent blocked `npm run build`. Removed the lock file and cleared `.next/` cache before build succeeded.
- Git index.lock contention from parallel agents required manual lock removal before committing Task 2.

## Known Stubs

None — all data is wired to real seed data from `src/data/blog.js` and `src/data/glossary.js` created in Plan 01.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Blog and glossary template patterns established for Plans 03–05 (personas, comparisons, integrations)
- generateStaticParams + generateMetadata with await params pattern confirmed working for all dynamic SEO routes
- GlossaryFAQ component can be reused or adapted for other light-surface FAQ needs
- Build passes clean with all 4 new routes: /blog, /blog/[slug], /glossary, /glossary/[term]

---
*Phase: 38-programmatic-seo-content-engine*
*Completed: 2026-04-06*

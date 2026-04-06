---
phase: 38-programmatic-seo-content-engine
plan: 05
subsystem: ui
tags: [next.js, seo, footer, internal-linking]

requires:
  - phase: 38-02
    provides: Blog and glossary page routes
  - phase: 38-03
    provides: Persona and comparison page routes
  - phase: 38-04
    provides: Integration page routes
provides:
  - Footer Resources column linking all 5 hub pages
  - Complete hub-and-spoke internal linking (no orphan pages)
affects: [public-site-i18n, scroll-line-path]

tech-stack:
  added: []
  patterns: [footer-resources-column, navbar-dark-background-all-pages]

key-files:
  created: []
  modified:
    - src/app/components/landing/LandingFooter.jsx
    - src/app/components/landing/LandingNav.jsx
    - src/app/(public)/blog/page.js
    - src/app/(public)/blog/[slug]/page.js
    - src/app/(public)/glossary/page.js
    - src/app/(public)/glossary/[term]/page.js
    - src/app/(public)/for/page.js
    - src/app/(public)/compare/page.js
    - src/app/(public)/integrations/page.js

key-decisions:
  - "Footer links to /for hub ('For Your Trade') rather than /for/plumber — conveys multi-trade support"
  - "Navbar always shows dark bg (was transparent at top) — required for light-bg SEO pages"
  - "Removed img onError handlers from blog pages — invalid in Server Components, using div placeholders instead"

patterns-established:
  - "Light-bg public pages need pt-24 md:pt-28 on first section to clear fixed h-16 navbar"
  - "Footer Resources column: hub links only, not individual detail pages"

requirements-completed: [SEO-11]

duration: 15min
completed: 2026-04-07
---

# Plan 05: Footer Resources Column + Internal Linking Verification

**LandingFooter updated with 4-column grid including Resources column, plus navbar/spacing fixes for all SEO pages**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-07T00:00:00Z
- **Completed:** 2026-04-07T00:15:00Z
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 9

## Accomplishments
- Added Resources column to LandingFooter with links to Blog, For Your Trade, Compare, Integrations, Glossary
- Fixed navbar visibility on light-background pages (always dark bg instead of transparent)
- Added proper top padding on all hub and detail pages for fixed navbar clearance
- Removed invalid onError handlers from blog pages (Server Component constraint)
- Human verification passed — all pages render correctly

## Task Commits

1. **Task 1: Add Resources column to LandingFooter** - `d3b8647` (feat)
2. **Task 2: Visual verification** - Human checkpoint, approved
3. **Bug fixes from verification** - `b630607` (fix)

## Files Created/Modified
- `src/app/components/landing/LandingFooter.jsx` - Added Resources column, changed "For Plumbers" to "For Your Trade"
- `src/app/components/landing/LandingNav.jsx` - Always show dark bg (was transparent on light pages)
- `src/app/(public)/blog/page.js` - Fixed onError handler, added nav padding
- `src/app/(public)/blog/[slug]/page.js` - Fixed onError handler, added nav padding
- `src/app/(public)/glossary/page.js` - Added nav padding
- `src/app/(public)/glossary/[term]/page.js` - Added nav padding
- `src/app/(public)/for/page.js` - Added nav padding
- `src/app/(public)/compare/page.js` - Added nav padding
- `src/app/(public)/integrations/page.js` - Added nav padding

## Decisions Made
- Changed footer link from "/for/plumber" (For Plumbers) to "/for" (For Your Trade) per user feedback — better conveys multi-trade support
- Navbar bg changed from transparent → bg-[#090807]/80 with backdrop-blur at top — required because SEO pages are the first light-bg public pages

## Deviations from Plan

### Auto-fixed Issues

**1. Server Component onError handler**
- **Found during:** Human verification
- **Issue:** Blog pages had `onError` event handler on `<img>` — invalid in Server Components
- **Fix:** Replaced with plain div placeholder
- **Files modified:** blog/page.js, blog/[slug]/page.js

**2. Navbar invisible on light pages**
- **Found during:** Human verification
- **Issue:** Navbar used bg-transparent at top with white text — invisible on light backgrounds
- **Fix:** Always show dark semi-transparent bg
- **Files modified:** LandingNav.jsx

**3. Content behind navbar**
- **Found during:** Human verification
- **Issue:** All new pages missing top padding for fixed h-16 navbar
- **Fix:** Added pt-24 to all hub headers and detail page containers
- **Files modified:** All 7 SEO page files

---

**Total deviations:** 3 auto-fixed during human verification
**Impact on plan:** All fixes necessary for correct rendering. No scope creep.

## Issues Encountered
- Stale .next cache caused build manifest errors — resolved by deleting .next directory and restarting dev server

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete programmatic SEO infrastructure in place
- Data arrays ready for content expansion (more personas, comparisons, integrations, glossary terms, blog posts)
- All pages have proper SEO metadata, JSON-LD, and internal linking

---
*Phase: 38-programmatic-seo-content-engine*
*Completed: 2026-04-07*

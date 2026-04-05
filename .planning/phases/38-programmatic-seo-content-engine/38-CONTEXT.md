# Phase 38: Programmatic SEO and Content Engine - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a complete programmatic SEO infrastructure under the existing `(public)` route group — sitemap, robots, dynamic OG images, a static data layer powering five page template types (blog, personas, comparisons, integrations, glossary), JSON-LD structured data, and hub-and-spoke internal linking. Every page must be crawlable, rich-snippet ready, and funnel organic traffic to signup.

</domain>

<decisions>
## Implementation Decisions

### Page Visual Design
- **D-01:** Blog listing (`/blog`) uses a 2-3 column card grid with featured image, title, excerpt, and date. Reuses existing shadcn/ui Card component.
- **D-02:** Blog detail (`/blog/[slug]`) is a standard article layout — long-form prose with headings, images, and a CTA at the bottom.
- **D-03:** Persona pages (`/for/[persona]`) are long-form landing pages — hero with trade-specific headline, pain points section, feature highlights grid with trade context, testimonial/social proof block, and CTA. Like a mini landing page per trade.
- **D-04:** Comparison pages (`/compare/[comparison]`) use a side-by-side feature comparison table (Voco vs competitor), verdict section, and CTA.
- **D-05:** Glossary pages (`/glossary/[term]`) have a definition section at top, then an FAQ accordion with related questions (FAQPage schema markup), and related term links at bottom.
- **D-06:** Integration pages (`/integrations/[tool]`) are marketing-focused — tool description, how Voco integrates, 3-4 use cases, and CTA. Not technical docs.
- **D-07:** All new SEO pages use light content style — white/off-white backgrounds, dark text, Voco copper/orange accents. Matches existing /about, /pricing, /terms pages. NOT the dark landing page hero style.

### Content Strategy
- **D-08:** 1 seed item per page type to validate templates. Real draft copy (not placeholder) — Claude writes actual Voco-specific, publishable content.
- **D-09:** Seed items: 1 persona (plumber), 1 blog post, 1 comparison (vs voicemail), 1 integration (google-calendar), 1 glossary term (ai-receptionist).
- **D-10:** Seed blog posts must be high-quality SEO content. Use `abm-programmatic-seo` and `abm-seo-audit` skills for best practices during content creation.
- **D-11:** Data layer files in `src/data/` export arrays — easy to add more items later by appending to the array.

### OG Image Design
- **D-12:** Single branded OG image template for all page types — Voco logo, dark-to-copper gradient background, large title text, page type badge (BLOG, PERSONA, COMPARE, etc.). 1200x630px. Generated via `next/og` ImageResponse.
- **D-13:** OG image route at `src/app/(public)/og/route.jsx` — accepts query params for title, type. Route Handlers bypass layouts so no nav/footer issue.

### Metadata & Title Pattern
- **D-14:** Title template: `{PageTitle} | Voco` with pipe separator. This is the standard going forward for ALL public pages (existing inconsistency between "About — Voco" and "Pricing — Voco AI Receptionist" should be normalized).
- **D-15:** Canonical URL base domain: `https://voco.live`
- **D-16:** Every dynamic page uses `generateMetadata()` with: title (template), description (from data layer), openGraph image (from OG route), alternates.canonical (absolute URL), robots index/follow.
- **D-17:** All dynamic pages MUST `await params` — Next.js 16 breaking change. `params` is a Promise in page components, `generateMetadata()`, and `generateStaticParams()`.

### Infrastructure
- **D-18:** `src/app/sitemap.js` — Next.js metadata convention, returns all static + dynamic routes with lastModified, changeFrequency, priority.
- **D-19:** `src/app/robots.js` — Next.js metadata convention (function export), allows all crawling, points to sitemap at `https://voco.live/sitemap.xml`. Static `robots.txt` in `src/app/` is also acceptable.
- **D-20:** JSON-LD via `src/components/SchemaMarkup.jsx` — reusable component rendering `<script type="application/ld+json">`. Types: LocalBusiness (landing), FAQPage (glossary + blog), WebPage (base for all), SoftwareApplication (integrations).

### Internal Linking
- **D-21:** Hub-and-spoke architecture — each page type has a hub/listing page (`/blog`, `/for`, `/compare`, `/integrations`, `/glossary`) that links to all children. Children cross-link to siblings and back to hub. Every page includes a signup CTA.
- **D-22:** No orphan pages — every programmatic page reachable from its hub, every hub reachable from the nav or footer.

### Claude's Discretion
- Blog detail page layout and typography choices
- Exact animation/transition choices on page templates (keep minimal — these are content pages)
- FAQ accordion component implementation (new component or reuse existing FAQSection pattern from pricing page)
- Exact gradient colors and badge styling for OG images
- Which hub pages go in nav vs footer links

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Next.js 16 & Routing
- `.claude/skills/nextjs-16-complete-guide/` — Next.js 16 features, async params requirement, generateMetadata/generateStaticParams patterns
- `src/app/(public)/layout.js` — Public layout (LandingNav + LandingFooter) that all SEO pages inherit

### Existing Public Pages (pattern reference)
- `src/app/(public)/about/page.js` — Static metadata pattern, AnimatedSection usage
- `src/app/(public)/pricing/page.js` — Static metadata, component composition pattern
- `src/app/(public)/pricing/FAQSection.jsx` — Existing FAQ accordion component (potential reuse for glossary)
- `src/app/(public)/pricing/pricingData.js` — Existing data-driven page pattern (reference for data layer approach)

### Design System
- `src/components/ui/card.jsx` — shadcn/ui Card component (reuse for blog grid)
- `src/components/ui/table.jsx` — shadcn/ui Table component (reuse for comparison tables)
- `src/lib/design-tokens.js` — Design tokens for consistent styling

### SEO Skills
- `abm-programmatic-seo` skill — Programmatic SEO best practices for content generation
- `abm-seo-audit` skill — SEO audit checklist for validation

### i18n
- `src/i18n/request.js` — Cookie-based locale detection (no path-based i18n, single URL per page)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/card.jsx` — shadcn/ui Card for blog listing grid
- `src/components/ui/table.jsx` — shadcn/ui Table for comparison pages
- `src/app/(public)/pricing/FAQSection.jsx` — FAQ accordion pattern for glossary pages
- `src/app/(public)/pricing/pricingData.js` — Data-driven page pattern (array export consumed by component)
- `src/app/components/landing/AnimatedSection.jsx` — Fade-in animation wrapper used on existing public pages
- `src/components/landing/AuthAwareCTA.js` — CTA button that adapts to auth state (signed in vs not)

### Established Patterns
- Static `export const metadata` on existing public pages — new dynamic pages use `generateMetadata()` instead
- Component composition: pages import section components, no monolithic pages
- Dynamic imports with loading skeletons for below-fold content (landing page pattern)
- `next-intl` wraps all pages via root layout — `generateMetadata()` won't have `useTranslations`, import JSON directly if translated meta needed

### Integration Points
- `src/app/(public)/layout.js` — All new routes under `(public)` automatically get nav + footer
- `src/app/layout.js` — Root layout provides `NextIntlClientProvider`
- Navigation (LandingNav) and footer (LandingFooter) may need hub page links added

</code_context>

<specifics>
## Specific Ideas

- User wants seed blog content to be genuinely high-quality SEO — not filler. Reference abm-programmatic-seo skill during content creation.
- All 5 page types live under `src/app/(public)/` to inherit the public layout automatically.
- Data layer in `src/data/` is append-only arrays — scaling content is just adding objects to arrays, no code changes needed.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 38-programmatic-seo-content-engine*
*Context gathered: 2026-04-06*

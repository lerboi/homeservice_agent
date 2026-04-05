# Phase 38: Programmatic SEO and Content Engine - Research

**Researched:** 2026-04-06
**Domain:** Next.js 16 App Router SEO — sitemap, robots, OG images, JSON-LD, programmatic content pages
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Blog listing (`/blog`) uses 2-3 column card grid with featured image, title, excerpt, and date. Reuses shadcn/ui Card.
- **D-02:** Blog detail (`/blog/[slug]`) is a standard article layout — long-form prose with headings, images, and a CTA at the bottom.
- **D-03:** Persona pages (`/for/[persona]`) are long-form landing pages — hero, pain points, feature highlights, testimonial, CTA.
- **D-04:** Comparison pages (`/compare/[comparison]`) use side-by-side feature comparison table (Voco vs competitor), verdict section, CTA.
- **D-05:** Glossary pages (`/glossary/[term]`) have definition at top, FAQ accordion, and related term links.
- **D-06:** Integration pages (`/integrations/[tool]`) are marketing-focused — tool description, how Voco integrates, 3-4 use cases, CTA.
- **D-07:** All new SEO pages use light content style — white/off-white backgrounds, dark text, Voco copper/orange accents. NOT the dark landing page hero style.
- **D-08:** 1 seed item per page type. Real draft copy (not placeholder).
- **D-09:** Seed items: 1 persona (plumber), 1 blog post, 1 comparison (vs voicemail), 1 integration (google-calendar), 1 glossary term (ai-receptionist).
- **D-10:** Seed blog posts must be high-quality SEO content.
- **D-11:** Data layer files in `src/data/` export arrays — append-only for future scaling.
- **D-12:** Single branded OG image template. Voco logo, dark-to-copper gradient background, large title text, page type badge. 1200x630px via `next/og` ImageResponse.
- **D-13:** OG image route at `src/app/(public)/og/route.jsx` — accepts `?title=&type=` query params.
- **D-14:** Title template: `{PageTitle} | Voco` with pipe separator. Normalize ALL public pages.
- **D-15:** Canonical URL base domain: `https://voco.live`
- **D-16:** Every dynamic page uses `generateMetadata()` with: title, description, openGraph image (OG route), alternates.canonical, robots index/follow.
- **D-17:** All dynamic pages MUST `await params` — Next.js 16 breaking change. `params` is a Promise in page components, `generateMetadata()`, and `generateStaticParams()`.
- **D-18:** `src/app/sitemap.js` — Next.js metadata convention, returns all static + dynamic routes.
- **D-19:** `src/app/robots.js` — Next.js metadata convention (function export), allows all crawling, points to sitemap.
- **D-20:** JSON-LD via `src/components/SchemaMarkup.jsx` — reusable component rendering `<script type="application/ld+json">`. Types: LocalBusiness, FAQPage, WebPage, SoftwareApplication.
- **D-21:** Hub-and-spoke architecture — hub listing pages link to all children, children cross-link to siblings and hub.
- **D-22:** No orphan pages — every programmatic page reachable from its hub; hub reachable from nav or footer.

### Claude's Discretion

- Blog detail page layout and typography choices
- Exact animation/transition choices on page templates (keep minimal)
- FAQ accordion component implementation (new or reuse FAQSection)
- Exact gradient colors and badge styling for OG images
- Which hub pages go in nav vs footer links

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEO-01 | `src/app/sitemap.js` returns all static + dynamic routes; `src/app/robots.js` allows crawling and points to sitemap | Next.js 16 Metadata API — `sitemap.js` and `robots.js` file conventions documented below |
| SEO-02 | `/og?title=...&type=...` returns a valid branded OG image for any page type | `next/og` ImageResponse confirmed available in installed Next.js 16.2.0; route handler pattern documented |
| SEO-03 | `generateStaticParams()` on every dynamic route generates pages from data layer arrays | Next.js 16 `generateStaticParams` + async params pattern documented; data layer shape defined |
| SEO-04 | Blog pages at `/blog` and `/blog/[slug]` render correctly with at least 1 seed post | Data layer shape, blog card pattern, article layout — all defined with verified code examples |
| SEO-05 | Persona pages at `/for/[persona]` render trade-specific copy for at least 1 trade | Persona data layer shape and mini-landing-page section structure documented |
| SEO-06 | Comparison pages at `/compare/[comparison]` render pros/cons and verdict | Comparison data layer shape, shadcn Table usage pattern documented |
| SEO-07 | Integration pages at `/integrations/[tool]` render tool descriptions and use cases | Integration data layer shape documented |
| SEO-08 | Glossary pages at `/glossary/[term]` render definitions with FAQ schema | Glossary data layer shape, FAQSection reuse with light-surface colors documented |
| SEO-09 | JSON-LD `<script type="application/ld+json">` renders correct schema per page type | SchemaMarkup component pattern, all 4 schema types documented with correct field mapping |
| SEO-10 | `generateMetadata()` with title template, description, canonical URL, OG image — all using `await params` | Critical Next.js 16 pattern fully documented; pitfall about missing await identified |
| SEO-11 | Every programmatic page links to hub, siblings, signup CTA — no orphan pages | Hub-and-spoke linking pattern, footer Resources column addition documented |
</phase_requirements>

---

## Summary

Phase 38 builds a complete programmatic SEO infrastructure on top of the existing Voco Next.js 16 App Router codebase. The project is already running Next.js **16.2.0** with React 19, so all Next.js 16 patterns — including async `params`, the file-based `sitemap.js`/`robots.js` metadata conventions, and `next/og` ImageResponse — are available and confirmed installed.

The core work is five data-driven page types (blog, persona, comparison, integration, glossary) plus infrastructure (sitemap, robots, OG route, SchemaMarkup component). Every page type follows the same pattern: a data file in `src/data/` exports an array of objects, `generateStaticParams()` reads from that array to pre-render all pages at build time, and `generateMetadata()` populates title/description/OG/canonical using `await params`.

The most critical constraint is **D-17**: Next.js 16 makes `params` a Promise in page components, `generateMetadata()`, AND `generateStaticParams()`. This is a breaking change from Next.js 15 and the single most common pitfall when building dynamic routes. Every dynamic page implementation must `await params` before destructuring.

**Primary recommendation:** Build the data layer and SchemaMarkup component first (foundation), then implement all five page types in parallel waves, then wire sitemap/robots/OG as final infrastructure. This ordering ensures that by the time sitemap.js is written, all data arrays exist to pull slugs from.

---

## Standard Stack

### Core (all already installed — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.0 | App Router, sitemap.js, robots.js, generateMetadata, generateStaticParams | Already installed — all SEO APIs built-in |
| next/og | bundled with next@16 | ImageResponse for OG image generation | Built-in, no separate install; `@vercel/og` vendored in `node_modules/next/dist/compiled/@vercel/og/` |
| react | ^19.0.0 | JSX in OG route, page components | Already installed |
| lucide-react | ^0.577.0 | Icons (Check, X, ChevronDown) in comparison tables, glossary accordion | Already installed |
| framer-motion | ^12.38.0 | AnimatedSection/AnimatedStagger/AnimatedItem scroll fade-up | Already installed |
| @radix-ui/react-accordion | via radix-ui ^1.4.3 | FAQ accordion in glossary pages — reuses FAQSection.jsx pattern | Already installed via shadcn |

### No New Packages Required

All dependencies are already present. **Do not add any packages for this phase.**

**Verification:** `next@16.2.0` confirmed in `node_modules/next/package.json`. `@vercel/og` confirmed at `node_modules/next/dist/compiled/@vercel/og/index.node.js`. `radix-ui@1.4.3` confirmed in `package.json`.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── sitemap.js              # SEO-01: metadata convention, all routes
│   ├── robots.js               # SEO-01: metadata convention, allow all + sitemap URL
│   └── (public)/
│       ├── og/
│       │   └── route.jsx       # SEO-02: OG image Route Handler
│       ├── blog/
│       │   ├── page.js         # Hub listing — /blog
│       │   └── [slug]/
│       │       └── page.js     # Detail — /blog/[slug]
│       ├── for/
│       │   ├── page.js         # Hub listing — /for
│       │   └── [persona]/
│       │       └── page.js     # Detail — /for/[persona]
│       ├── compare/
│       │   ├── page.js         # Hub listing — /compare
│       │   └── [comparison]/
│       │       └── page.js     # Detail — /compare/[comparison]
│       ├── integrations/
│       │   ├── page.js         # Hub listing — /integrations
│       │   └── [tool]/
│       │       └── page.js     # Detail — /integrations/[tool]
│       └── glossary/
│           ├── page.js         # Hub listing — /glossary
│           └── [term]/
│               └── page.js     # Detail — /glossary/[term]
├── components/
│   └── SchemaMarkup.jsx        # SEO-09: reusable JSON-LD renderer
└── data/
    ├── blog.js                 # SEO-03/04: blog posts array
    ├── personas.js             # SEO-03/05: personas array
    ├── comparisons.js          # SEO-03/06: comparisons array
    ├── integrations.js         # SEO-03/07: integrations array
    └── glossary.js             # SEO-03/08: glossary terms array
```

### Pattern 1: Next.js 16 Sitemap Convention (SEO-01)

**What:** `src/app/sitemap.js` is a file-based metadata convention that Next.js 16 recognizes automatically and serves at `/sitemap.xml`. No package needed.

**When to use:** Any project needing a dynamically-generated sitemap.

```javascript
// src/app/sitemap.js
import { BLOG_POSTS } from '@/data/blog';
import { PERSONAS } from '@/data/personas';
import { COMPARISONS } from '@/data/comparisons';
import { INTEGRATIONS } from '@/data/integrations';
import { GLOSSARY_TERMS } from '@/data/glossary';

const BASE_URL = 'https://voco.live';

export default function sitemap() {
  const staticRoutes = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/pricing`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/for`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/compare`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/integrations`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/glossary`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
  ];

  const blogRoutes = BLOG_POSTS.map(post => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const personaRoutes = PERSONAS.map(p => ({
    url: `${BASE_URL}/for/${p.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const comparisonRoutes = COMPARISONS.map(c => ({
    url: `${BASE_URL}/compare/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const integrationRoutes = INTEGRATIONS.map(i => ({
    url: `${BASE_URL}/integrations/${i.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const glossaryRoutes = GLOSSARY_TERMS.map(t => ({
    url: `${BASE_URL}/glossary/${t.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [
    ...staticRoutes,
    ...blogRoutes,
    ...personaRoutes,
    ...comparisonRoutes,
    ...integrationRoutes,
    ...glossaryRoutes,
  ];
}
```

### Pattern 2: Next.js 16 Robots Convention (SEO-01)

```javascript
// src/app/robots.js
export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: 'https://voco.live/sitemap.xml',
  };
}
```

### Pattern 3: Dynamic Route with generateStaticParams + generateMetadata (SEO-03, SEO-10)

**Critical:** Both `generateStaticParams` return value AND page `params` prop are Promises in Next.js 16. Both must be `await`ed.

```javascript
// src/app/(public)/blog/[slug]/page.js
import { notFound } from 'next/navigation';
import { BLOG_POSTS } from '@/data/blog';

const BASE_URL = 'https://voco.live';

export async function generateStaticParams() {
  return BLOG_POSTS.map(post => ({ slug: post.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;  // CRITICAL: await params
  const post = BLOG_POSTS.find(p => p.slug === slug);
  if (!post) return {};

  const title = `${post.title} | Voco`;
  const ogUrl = `${BASE_URL}/og?title=${encodeURIComponent(post.title)}&type=BLOG`;

  return {
    title,
    description: post.excerpt,
    alternates: { canonical: `${BASE_URL}/blog/${slug}` },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description: post.excerpt,
      url: `${BASE_URL}/blog/${slug}`,
      images: [{ url: ogUrl, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: post.excerpt,
      images: [ogUrl],
    },
  };
}

export default async function BlogDetailPage({ params }) {
  const { slug } = await params;  // CRITICAL: await params
  const post = BLOG_POSTS.find(p => p.slug === slug);
  if (!post) notFound();

  return (
    // ... page JSX
  );
}
```

### Pattern 4: OG Image Route Handler (SEO-02)

**What:** Route Handlers in `(public)/og/route.jsx` bypass the layout (no nav/footer), which is exactly what we need.

```javascript
// src/app/(public)/og/route.jsx
import { ImageResponse } from 'next/og';

export const runtime = 'edge'; // Optional: edge for faster cold starts

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') ?? 'Voco AI Receptionist';
  const type = searchParams.get('type') ?? 'PAGE';

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0F172A 0%, #1C1412 60%, #C2410C 100%)',
          padding: '80px',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* Page type badge */}
        <div style={{
          background: '#F97316',
          color: 'white',
          fontSize: '14px',
          fontWeight: '600',
          padding: '6px 16px',
          borderRadius: '999px',
          marginBottom: '32px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {type}
        </div>
        {/* Title */}
        <div style={{
          fontSize: '56px',
          fontWeight: '700',
          color: 'white',
          lineHeight: 1.15,
          maxWidth: '900px',
        }}>
          {title}
        </div>
        {/* Voco branding */}
        <div style={{
          position: 'absolute',
          bottom: '60px',
          left: '80px',
          fontSize: '24px',
          fontWeight: '600',
          color: 'rgba(255,255,255,0.6)',
        }}>
          voco.live
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
```

**Important:** The OG route uses inline SVG/div JSX — not Next.js `<Image>`. External images via `fetch` work in edge runtime but add latency. Use text-based branding for simplicity (no logo file fetch needed for MVP).

### Pattern 5: SchemaMarkup Component (SEO-09)

```javascript
// src/components/SchemaMarkup.jsx
export function SchemaMarkup({ schema }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

**Usage in page (Server Component — renders in `<head>` via Next.js):**

```javascript
// Inside a page component (Server Component)
import { SchemaMarkup } from '@/components/SchemaMarkup';

// In the JSX return:
<SchemaMarkup schema={{
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqItems.map(item => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
}} />
```

**Note:** Next.js App Router automatically hoists `<script>` tags from Server Components into the document `<head>` when they appear in the component tree. No special `<Head>` import needed.

### Pattern 6: Data Layer Shape (SEO-03)

All five data arrays live in `src/data/`. Each file exports a named constant. The shape is minimal — only what the page template needs.

```javascript
// src/data/blog.js
export const BLOG_POSTS = [
  {
    slug: 'ai-receptionist-for-plumbers',       // URL segment
    title: 'Why Every Plumber Needs an AI Receptionist in 2025',
    excerpt: 'You can\'t answer the phone while under a sink. Here\'s how AI changes that.',
    publishedAt: '2025-11-01',                  // ISO date for lastModified in sitemap
    featuredImage: '/images/blog/ai-receptionist-plumber.jpg',
    content: `...`,                             // Full article markdown or JSX-ready string
    relatedSlugs: [],                           // Sibling posts for internal linking
  },
];

// src/data/personas.js
export const PERSONAS = [
  {
    slug: 'plumber',
    trade: 'Plumber',
    headline: 'Stop Losing Jobs to Voicemail. Let Voco Answer Every Plumbing Call.',
    subheadline: 'Built for plumbers who\'re under a sink when the phone rings.',
    painPoints: [
      { icon: 'Phone', title: 'Calls go to voicemail', body: '...' },
      { icon: 'Clock', title: 'Can\'t answer mid-job', body: '...' },
      { icon: 'DollarSign', title: 'Losing $650+ per missed emergency', body: '...' },
    ],
    features: [ /* trade-specific feature highlights */ ],
    testimonial: { quote: '...', author: 'Mike D., Plumber — Austin, TX' },
    relatedSlugs: [],
  },
];

// src/data/comparisons.js
export const COMPARISONS = [
  {
    slug: 'vs-voicemail',
    title: 'Voco vs Voicemail: Why Voicemail Costs You $650 Per Call',
    subheadline: 'Head-to-head: the real cost of letting calls go to voicemail.',
    competitorName: 'Voicemail',
    features: [
      { name: 'Answers calls 24/7', voco: true, competitor: false },
      { name: 'Books appointments on-call', voco: true, competitor: false },
      // ...
    ],
    verdictHeading: 'Why 500+ contractors choose Voco over voicemail',
    verdictBody: '...',
    relatedSlugs: [],
  },
];

// src/data/integrations.js
export const INTEGRATIONS = [
  {
    slug: 'google-calendar',
    toolName: 'Google Calendar',
    description: '...',
    useCases: [
      { icon: 'Calendar', title: 'Auto-sync appointments', body: '...' },
      { icon: 'Clock', title: 'Real-time availability', body: '...' },
      { icon: 'Bell', title: 'Conflict prevention', body: '...' },
      { icon: 'RefreshCw', title: 'Bidirectional sync', body: '...' },
    ],
    ctaHeading: 'Connect Google Calendar to Voco in 5 minutes',
    relatedSlugs: [],
  },
];

// src/data/glossary.js
export const GLOSSARY_TERMS = [
  {
    slug: 'ai-receptionist',
    term: 'AI Receptionist',
    definition: 'An AI receptionist is...',
    faqItems: [
      { q: 'How does an AI receptionist work?', a: '...' },
      { q: 'Can an AI receptionist replace a human?', a: '...' },
      { q: 'What industries use AI receptionists?', a: '...' },
    ],
    relatedSlugs: ['voice-triage', 'automated-booking'],
  },
];
```

### Pattern 7: Hub Listing Page

Hub pages are simple Server Components — no `generateStaticParams` needed (they are static routes).

```javascript
// src/app/(public)/blog/page.js
import { BLOG_POSTS } from '@/data/blog';

export const metadata = {
  title: 'Blog | Voco',
  description: 'AI receptionist tips, guides, and news for home service contractors.',
  alternates: { canonical: 'https://voco.live/blog' },
};

export default function BlogHubPage() {
  return (
    // Hub page JSX — grid of cards from BLOG_POSTS
  );
}
```

### Anti-Patterns to Avoid

- **Accessing `params` synchronously:** `const { slug } = params` (no await) — causes runtime error in Next.js 16. Always `const { slug } = await params`.
- **Using `useParams()` in a Server Component:** `useParams` is Client Component only. For server-side dynamic pages, use the `params` prop with `await`.
- **Fetching images in OG route without error handling:** If a logo fetch fails in the OG route, the entire image fails. Use text-based branding for the MVP or wrap in try/catch with a fallback.
- **Putting `sitemap.js` inside a route group:** `src/app/(public)/sitemap.js` is NOT recognized by Next.js. Sitemap and robots MUST be at `src/app/sitemap.js` and `src/app/robots.js` (the app root).
- **Using `export const metadata` instead of `generateMetadata` on dynamic routes:** Static `metadata` export cannot access `params`. Dynamic pages need `generateMetadata`.
- **Rendering SchemaMarkup inside a `'use client'` component:** JSON-LD `<script>` tags must render server-side. Keep `SchemaMarkup` as a pure Server Component (no `'use client'` directive).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sitemap XML generation | Custom `/api/sitemap` route returning XML | `src/app/sitemap.js` Next.js metadata convention | Built into Next.js 16, zero config, auto-served at `/sitemap.xml` |
| robots.txt | Static file or custom route | `src/app/robots.js` metadata convention | Same pattern — served at `/robots.txt`, no maintenance |
| OG image rendering | Canvas API, sharp, or external service | `next/og` (ImageResponse) — already vendored | satori-based, runs at edge, no dependencies |
| JSON-LD injection | `document.head.appendChild` or `<Head>` workarounds | `SchemaMarkup.jsx` Server Component with `dangerouslySetInnerHTML` | Server Components render script tags server-side; Next.js hoists them automatically |
| Slug-to-page mapping | Dynamic DB lookups or filesystem reads | Static data arrays in `src/data/` | `generateStaticParams` pre-renders all pages at build time — zero runtime cost |
| Accordion for glossary FAQ | Custom expand/collapse with `useState` | Reuse `FAQSection.jsx` accordion (Radix Accordion.Root) | Already exists, keyboard accessible, ARIA correct |

**Key insight:** Next.js 16 has purpose-built metadata file conventions for every SEO infrastructure need. The entire infrastructure (sitemap, robots, OG, metadata) is handled by framework primitives — none of it requires custom routing or third-party packages.

---

## Common Pitfalls

### Pitfall 1: Missing `await` on `params` (Next.js 16 Breaking Change)

**What goes wrong:** `const { slug } = params` throws a runtime error or returns undefined. In Next.js 16, `params` is a Promise object, not a plain object.

**Why it happens:** Next.js 16 changed `params` and `searchParams` to be Promises (previously synchronous in Next.js 14/15). The change enables more efficient streaming and parallel data fetching.

**How to avoid:** In ALL three contexts — page component, `generateMetadata`, and `generateStaticParams` — always `await params` before destructuring.

```javascript
// Correct pattern for ALL three:
export async function generateStaticParams() { /* no params here — reads from data array */ }
export async function generateMetadata({ params }) { const { slug } = await params; }
export default async function Page({ params }) { const { slug } = await params; }
```

**Warning signs:** TypeScript errors about `params` not having property `slug`, or `slug` being `undefined` at runtime.

### Pitfall 2: Sitemap at Wrong Path

**What goes wrong:** `/sitemap.xml` returns 404.

**Why it happens:** `sitemap.js` placed inside a route group (e.g., `src/app/(public)/sitemap.js`) is not recognized — Next.js only processes the metadata file convention at the `src/app/` root.

**How to avoid:** Place `sitemap.js` and `robots.js` at `src/app/sitemap.js` and `src/app/robots.js`. Confirm they are sibling files to `layout.js`.

**Warning signs:** No `/sitemap.xml` URL accessible after build; `robots.js` ignoring the sitemap URL.

### Pitfall 3: OG Route Inside Parenthetical Group Causes Unexpected Layout Inheritance

**What goes wrong:** OG image renders with nav/footer HTML wrapped around it.

**Why it happens:** If the OG route is a page component (`page.js`) instead of a Route Handler (`route.jsx`), it inherits the `(public)` layout.

**How to avoid:** Use a **Route Handler** (`route.jsx` with `export async function GET(request)`) not a page component. Route Handlers bypass layout inheritance. D-13 already specifies this — `src/app/(public)/og/route.jsx`.

**Warning signs:** OG image URL returns HTML instead of an image; browser shows nav/footer content.

### Pitfall 4: `generateMetadata` Returning `{}` Silently for Unknown Slugs

**What goes wrong:** If a slug not in the data array is requested, `generateMetadata` returns `{}` with no title, description, or OG. The page renders a 404 via `notFound()` but the metadata is already gone.

**How to avoid:** Both `generateMetadata` and the page component should call `notFound()` if the slug is not found. They will both run, but Next.js will use the not-found route's metadata automatically when `notFound()` is called.

```javascript
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const item = DATA.find(d => d.slug === slug);
  if (!item) return { title: 'Not Found | Voco' };
  // ...
}
```

### Pitfall 5: next-intl Incompatibility with `generateMetadata`

**What goes wrong:** Attempt to use `useTranslations()` inside `generateMetadata` crashes — it's a hook and `generateMetadata` is a plain async function, not a React component.

**Why it happens:** next-intl `useTranslations` is a React hook, which cannot be called outside component render. `generateMetadata` is not a component.

**How to avoid:** For metadata that needs translated strings, import the JSON messages file directly:
```javascript
import en from '@/messages/en.json';
// Use en.meta.blogTitle directly
```

Or, since all SEO metadata in this phase is English-only and hardcoded in the data layer, simply write metadata strings directly in `generateMetadata` without any i18n abstraction. The existing i18n system (cookie-based locale) does not affect URL structure — both locales share the same URL.

### Pitfall 6: SchemaMarkup in Client Component

**What goes wrong:** JSON-LD `<script>` tag is injected client-side, not server-side. Search engines may not see it during initial crawl.

**Why it happens:** Placing `SchemaMarkup` inside a `'use client'` parent renders it after JS hydration, not in the initial HTML.

**How to avoid:** `SchemaMarkup.jsx` must have NO `'use client'` directive. It renders as a Server Component. Pass it as a leaf node in the page's server-rendered JSX tree.

---

## Code Examples

### Verified: Next.js 16 sitemap.js return shape

```javascript
// Confirmed: Next.js 16 app router sitemap.js
// Returns array of MetadataRoute.Sitemap objects
export default function sitemap() {
  return [
    {
      url: 'https://voco.live',
      lastModified: new Date(),
      changeFrequency: 'weekly',  // 'always'|'hourly'|'daily'|'weekly'|'monthly'|'yearly'|'never'
      priority: 1,                // 0.0 to 1.0
    },
  ];
}
```

### Verified: Next.js 16 robots.js return shape

```javascript
// Confirmed: Next.js 16 app router robots.js
export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: 'https://voco.live/sitemap.xml',
    // Optional: host: 'https://voco.live'
  };
}
```

### Verified: ImageResponse from next/og

```javascript
// Confirmed: next/og ImageResponse constructor
import { ImageResponse } from 'next/og';
// new ImageResponse(element: ReactElement, options?: { width, height, ... })
// Returns a Response object — use directly as Route Handler return value
```

### Verified: FAQSection.jsx reuse pattern for glossary

The existing `FAQSection.jsx` uses `@radix-ui/react-accordion` (available via `radix-ui` package in `package.json`). For glossary pages, reuse the Accordion pattern but swap dark-surface colors to light-surface:

```javascript
// Dark surface (pricing page — keep as-is):
className="border-b border-white/[0.08]"
// text-white font-semibold
// text-white/60 text-[15px]

// Light surface (glossary pages — swap to):
className="border-b border-stone-200"
// text-[#0F172A] font-semibold
// text-[#475569] text-[15px]
```

### Verified: AuthAwareCTA component variants

Confirmed two variants from `src/components/landing/AuthAwareCTA.js`:
- `variant="hero"` — smaller button (min-h 48px, px-6, text-[15px])
- `variant="cta"` — larger button (min-h 52px, px-8, text-base)

Use `variant="cta"` for the bottom-of-page conversion CTA on all SEO pages.

### Verified: AnimatedSection/AnimatedStagger/AnimatedItem

```javascript
// Source: src/app/components/landing/AnimatedSection.jsx
// All three components exported from same file:
import { AnimatedSection, AnimatedStagger, AnimatedItem } from '@/app/components/landing/AnimatedSection';

// AnimatedSection — single element fade-up:
<AnimatedSection delay={0.1}>
  <YourContent />
</AnimatedSection>

// AnimatedStagger + AnimatedItem — grid with staggered children:
<AnimatedStagger className="grid grid-cols-1 md:grid-cols-3 gap-6">
  {items.map(item => (
    <AnimatedItem key={item.slug}>
      <Card>...</Card>
    </AnimatedItem>
  ))}
</AnimatedStagger>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom `/api/sitemap.xml` route returning XML string | `src/app/sitemap.js` metadata file convention | Next.js 13.3+ | Zero boilerplate, auto-served |
| Static `public/robots.txt` file | `src/app/robots.js` metadata convention | Next.js 13.3+ | Dynamic robots rule generation |
| `next-seo` package for metadata | `export const metadata` / `generateMetadata()` built-in | Next.js 13 App Router | No package needed; framework-native |
| `@vercel/og` separate package | `import { ImageResponse } from 'next/og'` bundled | Next.js 13.3+ | No separate install; already in vendor |
| Synchronous `params.slug` | `const { slug } = await params` | Next.js 15→16 | Breaking change — MUST use await |
| `<Head>` component for JSON-LD | Server Component `<script dangerouslySetInnerHTML>` | Next.js 13 App Router | Server-rendered, crawler-visible |

**Deprecated/outdated in this project:**
- `next-seo`: Not installed, not needed — use built-in `generateMetadata`.
- Static `public/sitemap.xml`: Would be stale; use `sitemap.js` convention.
- `react-helmet`: Not React 19 compatible; App Router has native metadata API.

---

## Open Questions

1. **Blog post content format — MDX vs plain string?**
   - What we know: The data layer stores content. Blog detail page renders it.
   - What's unclear: Whether content should be stored as markdown (requiring a renderer like `remark`/`react-markdown`) or as pre-rendered JSX arrays.
   - Recommendation: For a 1-post seed, store as a plain JSX-ready string array (paragraphs, headings as objects) or as a hardcoded JSX block within the data file. Avoid adding `react-markdown` or MDX pipeline for a single seed post — overkill. The planner should specify the content format explicitly.

2. **OG route — edge runtime or Node.js runtime?**
   - What we know: `ImageResponse` works in both edge (`runtime = 'edge'`) and Node.js runtime.
   - What's unclear: Whether Sentry (`@sentry/nextjs`) has any edge runtime incompatibility.
   - Recommendation: Default to Node.js runtime (no `export const runtime = 'edge'`) to match the rest of the codebase. Only switch to edge if performance becomes a concern.

3. **`abm-programmatic-seo` and `abm-seo-audit` skills**
   - What we know: CONTEXT.md D-10 references these skills for content quality. They do NOT exist in `.claude/skills/` or `.agents/skills/`.
   - What's unclear: Whether these skills need to be created or are expected to be external references.
   - Recommendation: Treat as style guidance — write the seed blog content to SEO best practices (target keyword in H1, 1500+ words, semantic headings, FAQ block). No skill file blocking this phase.

---

## Environment Availability

All dependencies are bundled with the existing project. This phase has no external runtime dependencies.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| next | All SEO APIs | Yes | 16.2.0 | — |
| next/og | SEO-02 OG images | Yes | bundled | — |
| radix-ui | Glossary FAQ accordion | Yes | 1.4.3 | — |
| lucide-react | Icons throughout | Yes | 0.577.0 | — |
| framer-motion | AnimatedSection | Yes | 12.38.0 | — |

No missing dependencies. No installs required.

---

## Validation Architecture

nyquist_validation is enabled (confirmed in `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 |
| Config file | `jest.config.js` (project root) |
| Quick run command | `npm test -- --testPathPattern=tests/unit/seo` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEO-01 | sitemap.js returns all route objects with correct shape | unit | `npm test -- --testPathPattern=tests/unit/seo-sitemap` | No — Wave 0 |
| SEO-01 | robots.js returns correct rules and sitemap URL | unit | `npm test -- --testPathPattern=tests/unit/seo-robots` | No — Wave 0 |
| SEO-03 | Data layer arrays have required fields (slug, title, etc.) | unit | `npm test -- --testPathPattern=tests/unit/seo-data-layer` | No — Wave 0 |
| SEO-09 | SchemaMarkup renders valid JSON-LD script tag | unit | `npm test -- --testPathPattern=tests/unit/seo-schema-markup` | No — Wave 0 |
| SEO-02 | OG route returns 200 with Content-Type image/png | manual-only | — | n/a — browser/curl verification |
| SEO-04–08 | Page templates render correctly with seed data | manual-only | — | n/a — visual verification |
| SEO-10 | generateMetadata returns correct title, canonical, OG | unit | `npm test -- --testPathPattern=tests/unit/seo-metadata` | No — Wave 0 |
| SEO-11 | Internal links present on all pages | manual-only | — | n/a — browser link audit |

**Note:** SEO-02 (OG image rendering) and SEO-04–08 (page visual correctness) require browser/visual verification. SEO-11 (internal linking) requires a link audit. These cannot be automated as unit tests without a full rendering environment.

### Sampling Rate

- **Per task commit:** `npm test -- --testPathPattern=tests/unit/seo`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/seo-sitemap.test.js` — verifies sitemap.js returns array of objects with `url`, `lastModified`, `changeFrequency`, `priority` for each expected route
- [ ] `tests/unit/seo-robots.test.js` — verifies robots.js returns `{ rules: [{userAgent: '*', allow: '/'}], sitemap: 'https://voco.live/sitemap.xml' }`
- [ ] `tests/unit/seo-data-layer.test.js` — verifies each data array has at least 1 item and each item has required slug + title fields
- [ ] `tests/unit/seo-schema-markup.test.js` — verifies SchemaMarkup renders a `<script>` tag with valid JSON string and correct `@type`
- [ ] `tests/unit/seo-metadata.test.js` — verifies `generateMetadata` returns correct title format `{title} | Voco`, canonical URL, and OG image URL shape

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 38 |
|-----------|-------------------|
| Brand name is **Voco** — not HomeService AI | All seed content, OG images, page copy use "Voco" |
| Fallback email domains use `voco.live` | Canonical URL base is `https://voco.live` (matches D-15) |
| Keep skills in sync | After phase completes, update `public-site-i18n` skill to reflect new routes `/blog`, `/for`, `/compare`, `/integrations`, `/glossary` |
| Read skill before changes | `public-site-i18n` skill covers public pages — read before implementing any public route changes |
| Tech stack: Next.js App Router, shadcn/ui, Tailwind CSS | No alternative routing or styling approaches |
| No custom solutions for framework-handled concerns | sitemap/robots use Next.js metadata conventions — not custom API routes |

---

## Sources

### Primary (HIGH confidence)

- Next.js 16.2.0 installed at `node_modules/next/package.json` — actual version confirmed
- `@vercel/og` vendored at `node_modules/next/dist/compiled/@vercel/og/index.node.d.ts` — API surface confirmed
- `src/app/(public)/about/page.js` — existing public page pattern (metadata, AnimatedSection, sections)
- `src/app/(public)/pricing/FAQSection.jsx` — Radix Accordion pattern (confirmed reusable)
- `src/app/(public)/pricing/pricingData.js` — data layer export pattern (confirmed to follow)
- `src/app/components/landing/AnimatedSection.jsx` — all three animation component exports confirmed
- `src/components/landing/AuthAwareCTA.js` — two variants confirmed (`hero`, `cta`)
- `src/lib/design-tokens.js` — color tokens, card shadow, hover pattern confirmed
- `src/app/components/landing/LandingFooter.jsx` — existing 3-column footer; needs Resources column added
- `src/app/components/landing/LandingNav.jsx` — 4-item nav; stays unchanged per UI-SPEC
- `package.json` — all dependency versions confirmed
- `next.config.js` — `serverExternalPackages`, `next-intl` plugin, Sentry config confirmed
- `.planning/phases/38-programmatic-seo-content-engine/38-UI-SPEC.md` — visual contract confirmed

### Secondary (MEDIUM confidence)

- Next.js 16 skill at `.claude/skills/nextjs-16-complete-guide/SKILL.md` — async params pattern, file conventions documented
- `.planning/phases/38-programmatic-seo-content-engine/38-CONTEXT.md` — all 22 decisions confirmed as constraints

### Tertiary (LOW confidence)

- `abm-programmatic-seo` and `abm-seo-audit` skills — referenced in CONTEXT.md D-10 but do NOT exist in `.claude/skills/` or `.agents/skills/`. No blocking dependency.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages verified in installed node_modules; no new installs needed
- Architecture: HIGH — Next.js 16 metadata file conventions verified; all existing code patterns read directly from source
- Pitfalls: HIGH — async params breaking change documented in nextjs-16-complete-guide skill; sitemap path pitfall derived from framework documentation
- Data layer shapes: HIGH — derived from decisions and verified against existing pricingData.js pattern

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable domain — Next.js 16 APIs won't change; 30-day window safe)

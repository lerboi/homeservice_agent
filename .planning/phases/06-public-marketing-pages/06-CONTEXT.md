# Phase 6: Public Marketing Pages - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Pricing page (4 tiers with monthly/annual toggle, feature comparison table, FAQ), About page, Contact page, and updated nav/footer across all public pages. All pages are display-only — no Stripe integration, no payment processing. CTAs route to the unified onboarding wizard (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Pricing page layout
- Horizontal card row: 4 cards side by side on desktop, stacking vertically on mobile
- Growth tier visually elevated with "Most Popular" badge
- On mobile, Growth card appears first (reordered from desktop layout)
- Each tier card shows: tier name, price, call volume, feature highlights, CTA button
- Enterprise tier has "Contact Us" CTA instead of "Get Started"

### Monthly/annual toggle
- Centered pill toggle above the tier cards (Monthly | Annual)
- Annual pricing shows "Save 20%" badge on the toggle
- Prices update in-place without page reload (client-side state)
- Display-only — no Stripe, no checkout

### Feature comparison table
- Full grid table below the tier cards: features as rows, tiers as columns
- Checkmarks and values in cells (not just checkmarks — show call counts, specific limits)
- Sticky tier header row on scroll for long tables
- Responsive: horizontal scroll or card-per-tier on mobile

### FAQ section
- Core 4 questions only (per requirements): cancellation, overages, trial availability, refunds
- Accordion-style expand/collapse
- Placed below the comparison table

### Pricing hero
- ROI-framed copy: lead with job revenue lost to voicemail, not SaaS metrics
- "Stop Losing $1,000 Jobs to Voicemail" direction for headline (Claude writes final copy)
- Subline frames tiers by value: "Every tier pays for itself after one booked job"

### About page
- Minimal — mission statement and core values only
- No team section, no photos (early stage)
- Short and focused: why this exists, who it's for, what we believe

### Contact page
- Single form with fields: name, email, inquiry type dropdown (Sales / Support / Partnerships), message
- Inquiry type routes Resend email to the correct internal address
- Honeypot field for spam protection (hidden field, no CAPTCHA)
- Explicit response time SLA displayed: "We respond within 24 hours"
- Success toast/confirmation after submission

### Navigation
- Extend existing LandingNav with page links: Pricing, About, Contact alongside existing anchor links (How it works, Features)
- On landing page: anchor links scroll to sections; page links navigate to new pages
- On sub-pages: all links are page navigation
- Hamburger with slide-out drawer on mobile: full-height drawer with all nav links + CTA button at bottom
- One nav component shared across all public pages

### Page structure & routing
- Shared `(public)` route group with its own `layout.js` containing LandingNav + LandingFooter
- Landing page moved into `(public)/page.js`
- New pages: `(public)/pricing/page.js`, `(public)/about/page.js`, `(public)/contact/page.js`
- Dashboard keeps its own layout with sidebar (unchanged)

### Visual continuity
- All public pages use consistent dark hero pattern: Midnight Slate (#0F172A) hero section at top, content sections on Soft Stone (#F5F5F4) below
- Same design language as Phase 2.1 landing page: Heritage Copper CTAs, AnimatedSection scroll animations, Server Components with client animation delegation
- Trade-inspired color palette carried through all pages

### Footer
- Expand from simple footer to multi-column layout
- Three columns: Product (Features, Pricing, How it works), Company (About, Contact), Legal (Terms, Privacy)
- Same dark (#0F172A) background as current footer
- Logo and copyright retained

### Claude's Discretion
- Final copy for all headlines and body text (guided by ROI framing and Foreman voice)
- Exact animation timing and scroll triggers
- Comparison table feature list (what features to compare across tiers)
- Mobile responsive breakpoints and table adaptation
- Icon choices for feature grid and FAQ
- Typography sizing and spacing within established palette
- Contact form validation UX details
- About page values/principles content

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — PRICE-01 through PRICE-07 (pricing page), PAGE-01 through PAGE-05 (public pages)

### Prior phase context
- `.planning/phases/02.1-public-marketing-landing-page/02.1-CONTEXT.md` — Established design language: Heritage Copper palette, Foreman voice, AnimatedSection pattern, Server Component architecture

### Existing code (landing page foundation)
- `src/app/page.js` — Current landing page structure (will be moved to `(public)/page.js`)
- `src/app/components/landing/LandingNav.jsx` — Nav component to extend with page links + mobile drawer
- `src/app/components/landing/LandingFooter.jsx` — Footer to expand to multi-column
- `src/app/components/landing/AnimatedSection.jsx` — Scroll animation wrapper (reuse across new pages)
- `src/app/globals.css` — Landing color tokens already defined (landing-surface, landing-dark, landing-accent, landing-muted, landing-success)

### Dashboard layout reference
- `src/app/dashboard/layout.js` — Reference for route group layout pattern (sidebar + breadcrumb)

### Project context
- `.planning/PROJECT.md` — Core value prop, target market, pricing model (monthly SaaS)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AnimatedSection` — Scroll-triggered fade/slide animations with direction prop (up/left/right) and stagger support
- `LandingNav` — Sticky dark nav with scroll detection, Heritage Copper CTA button
- `LandingFooter` — Dark footer with logo and legal links
- `src/components/ui/button.jsx` — shadcn Button (use for CTAs and form submit)
- `src/components/ui/card.jsx` — shadcn Card (use for pricing tier cards)
- `src/components/ui/badge.jsx` — shadcn Badge (use for "Most Popular" badge)
- Landing color tokens in `globals.css`: `--color-landing-surface`, `--color-landing-dark`, `--color-landing-accent`, `--color-landing-muted`, `--color-landing-success`

### Established Patterns
- Tailwind v4 with `@import 'tailwindcss'` + `@tailwindcss/postcss` — CSS-based theming, no config file
- Next.js App Router with Server Components default; client interactivity via `'use client'` directive
- shadcn new-york style components via manual `components.json`
- Framer Motion v12 for animations (via AnimatedSection wrapper)
- Resend already configured for email (used in Phase 4 notifications)

### Integration Points
- Root layout (`src/app/layout.js`) — needs no changes; `(public)` route group adds its own nested layout
- `/onboarding` route — CTA destination for all "Get Started" buttons
- Resend email service — reuse for contact form submission delivery
- `src/app/api/` — Add contact form API route here

</code_context>

<specifics>
## Specific Ideas

- ROI framing on pricing: "Every missed call costs you a $1,000+ job" — speak in job revenue, not SaaS metrics
- "The Foreman" voice continues from landing page — trades insider tone on all pages
- Growth tier is the clear recommended option — visually elevated, "Most Popular" badge
- Enterprise is "Contact Us" not "Get Started" — different CTA for custom pricing
- About page is intentionally minimal (early stage) — mission + values, no team bios
- Contact form routes by inquiry type to different internal addresses via Resend

</specifics>

<deferred>
## Deferred Ideas

- Stripe integration / actual payment processing — out of scope, display-only pricing
- Blog / content marketing section — separate initiative
- Live demo phone number on pricing page — needs Retell demo account
- Team photos / bios on About page — add when team grows
- SEO optimization and meta tags — can be enhanced later
- Analytics / conversion tracking — separate concern

</deferred>

---

*Phase: 06-public-marketing-pages*
*Context gathered: 2026-03-22*

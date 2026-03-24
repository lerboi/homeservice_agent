# Phase 13: Frontend Public Pages Redesign - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign all public-facing pages (Home, Pricing, Contact, About, Auth) and shared components (Nav, Footer) with a Premium Dark SaaS design language — improving component-level design quality while preserving existing page structure and layout patterns. Performance-first: no backdrop-blur on large surfaces, transform/opacity-only animations, dynamic imports with loading skeletons, mobile lightweight fallbacks, Core Web Vitals optimized (LCP < 2.5s, CLS < 0.1, INP < 200ms).

</domain>

<decisions>
## Implementation Decisions

### Dark SaaS Palette — Dark Evolution
- **D-01:** 70% dark surfaces, 30% warm brand accents. Heritage Copper stays as the accent/CTA color. Surfaces shift darker overall — premium tech-forward feel without losing the trade identity.
- **D-02:** Primary surface: #0F172A (Midnight Slate). Secondary surface: #1E293B (Dark charcoal). Accent: #C2410C (Heritage Copper). Light text: #F1F5F9 (Slate 50). Muted text: #94A3B8 (Slate 400).
- **D-03:** One Soft Stone (#F5F5F4) "breath" section per page to prevent dark fatigue and highlight key content. This is what differentiates it from generic dark SaaS (dark + warm copper + stone breaks vs. the usual black + white + blue).
- **D-04:** Cards on dark backgrounds: subtle copper/warm border glow on hover — not cold white.

### Card Hover Treatment
- **D-05:** Rest state: bg #1E293B, border 1px solid rgba(255,255,255,0.06), no shadow.
- **D-06:** Hover state: border 1px solid rgba(194,65,12,0.4), box-shadow 0 0 20px rgba(194,65,12,0.15), transform translateY(-2px). Warm amber glow, on-brand.

### Navigation — Polish + Transparency
- **D-07:** Keep current layout (logo left, nav links + CTA right, hamburger mobile). No structural change.
- **D-08:** Transparent at top of page with subtle backdrop-filter blur(12px) and thin border. Solid dark (#0F172A) on scroll. (Backdrop-blur allowed on nav — small surface, perf constraint is for large surfaces only.)
- **D-09:** Active link: copper underline accent. Mobile drawer: dark background, copper accent CTA.

### Footer — Polish Existing
- **D-10:** Keep 3-column layout (Product | Company | Legal). No structural change.
- **D-11:** Top border: thin copper gradient line (transparent → copper → transparent) as visual separator.
- **D-12:** Link hover: copper color transition. Logo slightly larger with copper accent. Better vertical spacing and alignment.

### Pricing Page — Full Dark with Stone Break
- **D-13:** Dark hero + headline (#0F172A). Tier cards on dark (#1E293B cards) with copper glow hover. "Most Popular" badge in copper. Monthly/Annual toggle with copper active state.
- **D-14:** Comparison table gets the stone (#F5F5F4) breath section — dark text, clear readability, alternating row tint for scanning.
- **D-15:** FAQ accordion on dark (#0F172A) with copper accent on expand icon. Copper gradient CTA banner at bottom.

### About Page — Same Dark Treatment
- **D-16:** Dark hero (#0F172A) with mission headline. Stone section for values/principles (#F5F5F4). Dark closing statement + CTA.

### Contact Page — Same Dark Treatment
- **D-17:** Dark hero (#0F172A) with headline. Dark form section (#1E293B card) with light-bordered inputs, copper submit button, copper glow on focus states. Response time SLA text.

### Home Page Section Flow (Updated)
- **D-18:** Dark hero (#0F172A) → Dark charcoal HIW (#1E293B) → Warm stone Features (#F5F5F4) → Dark Social Proof (#0F172A) → Copper gradient CTA (#C2410C).

### Animation Style — Confident & Subtle
- **D-19:** Scroll reveals: fade-up on enter (existing AnimatedSection pattern), 200ms duration, ease-out, stagger children 50ms apart.
- **D-20:** Hover transitions: copper glow 300ms ease, card lift translateY(-2px) 200ms, link underline scaleX 200ms.
- **D-21:** Hero: keep existing Spline 3D cursor-reactive + RotatingText. No new hero animations.
- **D-22:** No page transitions (Next.js app router default). Philosophy: if you notice the animation, it's too much.
- **D-23:** All animations must be transform/opacity-only. No backdrop-blur on large surfaces (nav is the only exception — small surface).

### Mobile Fallback Strategy — Static Replacements
- **D-24:** Spline 3D scene → gradient + icon on mobile (already decided Phase 11 D-07).
- **D-25:** Bento grid 6-col → single column stacked cards (full-width, no grid complexity).
- **D-26:** HowItWorksTabs → vertical accordion or simple stacked steps.
- **D-27:** AnimatedSection → fade-only (no slide) or skip animation entirely on mobile.
- **D-28:** Comparison table → card-per-tier on mobile (already decided Phase 06).
- **D-29:** Breakpoint: md (768px) as the swap point for all mobile fallbacks.

### Auth Page — Differentiated Signup vs Signin
- **D-30:** Signup and signin are visually distinct experiences, not just a tab toggle on the same card.
- **D-31:** **Signup (new user):** Full split layout — lighter form card (#334155) on the left with welcoming headline, Google OAuth prominent, email+password form. Dark right panel with selling points, social proof, and brand storytelling (existing content). Feels like an invitation: "welcome, here's why."
- **D-32:** **Signin (returning user):** Compact centered card on dark background — no split layout, no selling points. Just logo, email, password, submit. Feels like a quick doorway: "welcome back, get in."
- **D-33:** Toggle between modes via text link at bottom of each view: "Already have an account? Sign in" / "Don't have an account? Get started" — not a tab switcher.
- **D-34:** Both views use dark SaaS palette: dark page background (#0F172A), copper submit buttons, copper focus glow on inputs.
- **D-35:** OTP verification screen follows the dark treatment — dark background, dark card, copper accents.
- **D-36:** All existing auth functionality preserved (Google OAuth, email+password, OTP verification, cooldown timer, error handling). No new auth methods.

### Claude's Discretion
- Exact new CSS custom property names and values for the expanded dark palette tokens
- Typography sizing refinements within the established palette
- Copper gradient exact stops and directions for CTA sections and footer border
- Icon choices and sizing across all pages
- Responsive breakpoints below md for fine-tuning
- FAQ accordion animation details
- About page values/principles content refinement
- Contact form validation UX details
- Exact stagger timing per section
- Which AnimatedSection direction (up/left/right) per component
- Auth page: exact signup form card styling, right panel content refinements, signin card dimensions and spacing
- Auth page: transition animation between signup/signin views (if any)
- Auth page: mobile auth layout (single column, which elements to show/hide)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — All requirements context (TBD for Phase 13 — use Phase 06 PRICE/PAGE requirements as reference for page structure)

### Prior phase context (design lineage)
- `.planning/phases/02.1-public-marketing-landing-page/02.1-CONTEXT.md` — Original design language: Heritage Copper palette, Foreman voice, AnimatedSection pattern, section structure
- `.planning/phases/06-public-marketing-pages/06-CONTEXT.md` — Public pages structure: (public) route group, nav/footer, pricing layout, contact form, about page, visual continuity decisions
- `.planning/phases/11-landing-page-ui-ux-redesign/11-CONTEXT.md` — Landing page redesign: 21st.dev components, Spline 3D, bento grid, HowItWorksTabs, performance requirements, mobile fallback decisions

### Existing public page components
- `src/app/(public)/page.js` — Home page composition with dynamic imports and loading skeletons
- `src/app/(public)/layout.js` — Public layout wrapper (LandingNav + LandingFooter)
- `src/app/(public)/pricing/page.js` — Pricing page
- `src/app/(public)/pricing/PricingTiers.jsx` — Tier cards component
- `src/app/(public)/pricing/ComparisonTable.jsx` — Feature comparison table
- `src/app/(public)/pricing/FAQSection.jsx` — FAQ accordion
- `src/app/(public)/pricing/pricingData.js` — Pricing data configuration
- `src/app/(public)/about/page.js` — About page
- `src/app/(public)/contact/page.js` — Contact page
- `src/app/(public)/contact/ContactForm.jsx` — Contact form component

### Auth page
- `src/app/auth/signin/page.js` — Current auth page (signup/signin/OTP — split layout, light bg, to be redesigned with dark palette + differentiated views)
- `src/app/auth/callback/route.js` — Auth callback handler (no visual changes needed)
- `src/components/onboarding/OtpInput.jsx` — OTP input component (restyle to dark palette)

### Shared landing components
- `src/app/components/landing/LandingNav.jsx` — Navigation (transparent → solid on scroll upgrade)
- `src/app/components/landing/LandingFooter.jsx` — Footer (polish + copper gradient border)
- `src/app/components/landing/HeroSection.jsx` — Hero with Spline 3D
- `src/app/components/landing/SplineScene.jsx` — Spline 3D loader
- `src/app/components/landing/RotatingText.jsx` — Text rotation animation
- `src/app/components/landing/AnimatedSection.jsx` — Scroll animation wrapper (3 exports: AnimatedSection, AnimatedStagger, AnimatedItem)
- `src/app/components/landing/FeaturesGrid.jsx` — Bento grid with 5 feature cards
- `src/app/components/landing/HowItWorksSection.jsx` — How it works section
- `src/app/components/landing/HowItWorksTabs.jsx` — Tabbed how-it-works
- `src/app/components/landing/HowItWorksSticky.jsx` — Sticky step-by-step flow
- `src/app/components/landing/SocialProofSection.jsx` — Testimonials
- `src/app/components/landing/FinalCTASection.jsx` — Heritage Copper CTA
- `src/components/landing/AuthAwareCTA.jsx` — Auth-aware CTA button

### Design tokens
- `src/app/globals.css` — Landing color tokens (landing-surface, landing-dark, landing-accent, landing-muted, landing-success, brand-orange, warm-surface) + custom animations (draw-in, radial-pulse, cta-glow-shift)

### Project context
- `.planning/PROJECT.md` — Core value prop, target market (home service SMEs)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AnimatedSection` — Scroll-triggered fade/slide with direction prop (up/left/right), stagger support, useReducedMotion. Core animation primitive — keep and reuse.
- `AnimatedStagger` / `AnimatedItem` — Staggered child animations. Use for card grids and list reveals.
- `AuthAwareCTA` — Auth-aware CTA button with hero/cta variants. Keep as-is.
- `RotatingText` — Character-animated text rotation for hero. Keep as-is.
- `SplineScene` — Spline 3D lazy loader with fallback. Keep as-is (Phase 11 updated).
- Landing color tokens in globals.css — expand with new dark palette tokens (#1E293B charcoal, #F1F5F9 light text, #94A3B8 muted text).
- shadcn components: Button, Card, Badge, Input, Skeleton — available for card styling and form elements.
- Radix UI Accordion — already used in FAQ section.
- `OtpInput` — 6-digit OTP input component used in auth signup flow. Restyle to dark palette.
- Auth page existing selling points array (SELLING_POINTS) and GoogleIcon SVG — reuse in redesigned signup panel.

### Established Patterns
- Next.js dynamic imports with explicit loading skeletons (height-matched) for CLS prevention
- Server Components default; `'use client'` only where interactivity required
- Framer Motion v12 for scroll animations via AnimatedSection/AnimatedStagger/AnimatedItem
- Tailwind v4 CSS-based theming with `@import 'tailwindcss'` — new tokens added via CSS custom properties
- (public) route group layout wraps all public pages — LandingNav and LandingFooter in layout, not in page components

### Integration Points
- `src/app/(public)/layout.js` — Shared layout for all public pages (Nav + Footer live here)
- `src/app/globals.css` — Add new dark palette tokens here
- All page and section components are in-place upgrades — no new routes or structural changes
- `src/app/auth/signin/page.js` — Auth page redesign (same route, new visual treatment + differentiated signup/signin layouts)
- Mobile fallback detection: use Tailwind responsive classes (hidden md:block / block md:hidden) for component swaps

</code_context>

<specifics>
## Specific Ideas

- The warmth IS the brand identity — Heritage Copper + stone accents are what make this feel like a trades product, not another generic SaaS. Generic dark SaaS = black + white + blue. This = dark + warm copper + stone breaks.
- One stone "breath" section per page prevents dark fatigue — this is a deliberate design choice, not a leftover from the old palette.
- Copper glow hover on cards ties every interactive element back to the brand accent. No cold white hovers.
- Nav transparency at top creates a premium feel on landing (content bleeds behind nav). Solid on scroll keeps it functional.
- Thin copper gradient line on footer top edge is a subtle brand signature that visually connects the footer to the rest of the page.
- "If you notice the animation, it's too much" — animations support the design, they don't perform.
- Auth page signup vs signin should feel like two different experiences — signup is an invitation with brand storytelling, signin is a quick doorway. The current identical-looking tab toggle doesn't communicate this distinction.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-frontend-public-pages-redesign*
*Context gathered: 2026-03-24*

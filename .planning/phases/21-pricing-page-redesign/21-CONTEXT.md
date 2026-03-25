# Phase 21: Pricing Page Redesign - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform the pricing page into a conversion-optimized page matching the premium dark SaaS design language of the landing page. Updated feature tiers reflecting actual product capabilities (volume-based, not feature-gated). 14-day free trial as the primary pull factor with prominent messaging. Testimonial section for social proof. Expanded FAQ covering setup, AI quality, billing, and security. No money-back guarantee messaging. No "no credit card required" messaging. **No Stripe integration** — payment flow is handled in a separate phase.

</domain>

<decisions>
## Implementation Decisions

### CTA Copy & Trial Messaging
- **D-01:** All paid tier CTAs say "Start Free Trial". Enterprise CTA stays "Contact Us" → routes to `/contact` with inquiry type pre-selected as sales.
- **D-02:** 14-day free trial is the PRIMARY pull factor — prominently displayed near the top of the pricing section as a banner: "14-Day Free Trial • Cancel Anytime".
- **D-03:** No "money-back guarantee" messaging anywhere on the pricing page or site.
- **D-04:** No "no credit card required" messaging anywhere on the pricing page or site.
- **D-05:** CTA href stays as `/onboarding` for now (Stripe checkout integration will update this in its own phase).

### Visual Design — Premium Dark SaaS
- **D-06:** Rich dark hero matching landing page energy: `#050505` background, radial gradient orange accent, dot-grid texture overlay, floating blur orb. Eyebrow + headline + subline + trial banner + billing toggle.
- **D-07:** Dark tier cards on dark background. Rest: `bg-[#1A1816]`, `border-white/[0.06]`, white text. Hover: `border-rgba(249,115,22,0.3)`, `shadow-0_0_20px_rgba(249,115,22,0.15)`, `translateY(-2px)`. Growth highlighted with `ring-2 ring-[#F97316]/50` + "Most Popular" badge in copper.
- **D-08:** Testimonial quote section between the comparison table and CTA banner — 1-2 short quotes from trades owners.
- **D-09:** Comparison table stays on stone `#F5F5F4` background (the "breath" section). FAQ on dark. CTA banner on dark warm brown `#1C1412` with copper radial gradient.

### Tier Structure — Volume-Based
- **D-10:** All features available on all paid tiers. Tiers differentiated by call volume and support level only. No feature gating.
- **D-11:** Feature list updated to reflect only actually built capabilities: AI receptionist 24/7, lead capture & CRM, SMS + email notifications, priority triage, Google Calendar sync, Outlook Calendar sync, booking-first dispatcher, multi-language (EN/ES), recovery SMS fallback.
- **D-12:** Enterprise tier adds: unlimited calls, priority support, custom integrations (aspirational but signals enterprise readiness).
- **D-13:** Prices unchanged: Starter $99/40 calls, Growth $249/120 calls, Scale $599/400 calls. 20% annual discount.
- **D-14:** Comparison table updated to match volume-based structure. Rows show call limits and support level as differentiators, not feature availability.

### FAQ — Expanded (6-8 Questions)
- **D-15:** Remove existing money-back guarantee FAQ. Remove "no credit card required" trial FAQ.
- **D-16:** New FAQ covers 4 topic areas: setup/onboarding, AI call quality, trial/billing, data/security.
- **D-17:** Target 6-8 questions total. Accordion format preserved (Radix UI). Claude writes final FAQ copy.
- **D-18:** Setup/onboarding: "How long does setup take?" "Do I need technical skills?"
- **D-19:** AI quality: "Can callers tell it's AI?" "What if the AI gets confused?"
- **D-20:** Trial/billing: "How does the 14-day trial work?" "Can I cancel anytime?" "What about overages?"
- **D-21:** Data/security: "Where are recordings stored?" "Who can access my data?"

### Claude's Discretion
- Final copy for all headlines, sublines, FAQ answers, and testimonial quotes
- Animation timing and scroll triggers on new sections
- Comparison table row structure for volume-based tiers
- Mobile responsive adaptations
- Trial banner exact styling and placement
- Testimonial section design (single quote vs side-by-side)
- Contact page pre-selection implementation for Enterprise CTA
- Typography sizing and spacing within established palette

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phase context (design lineage)
- `.planning/phases/06-public-marketing-pages/06-CONTEXT.md` — Original pricing page decisions: 4 tiers, toggle, FAQ, ROI framing, display-only
- `.planning/phases/13-frontend-public-pages-redesign/13-CONTEXT.md` — Premium dark SaaS palette, card hover treatment (D-05/D-06), pricing page dark treatment (D-13/D-14/D-15), animation style (D-19–D-23)

### Existing pricing page code
- `src/app/(public)/pricing/page.js` — Current pricing page layout (hero, tiers, comparison, FAQ, CTA)
- `src/app/(public)/pricing/pricingData.js` — PRICING_TIERS, COMPARISON_FEATURES, getAnnualPrice() — all need updating
- `src/app/(public)/pricing/PricingTiers.jsx` — Tier cards with billing toggle — needs dark card redesign + "Start Free Trial" CTA
- `src/app/(public)/pricing/ComparisonTable.jsx` — Feature comparison grid — needs volume-based restructure
- `src/app/(public)/pricing/FAQSection.jsx` — Radix accordion FAQ — needs expanded questions, remove money-back/no-cc content

### Landing page design reference (match this quality)
- `src/app/components/landing/HeroSection.jsx` — Rich dark hero with radial gradients, dot-grid, blur orb, Spline 3D
- `src/app/components/landing/FeaturesGrid.jsx` — Bento grid with custom visuals per card
- `src/app/components/landing/FinalCTASection.jsx` — Dark CTA section with copper radial gradient
- `src/app/components/landing/AnimatedSection.jsx` — AnimatedSection, AnimatedStagger, AnimatedItem

### Shared components
- `src/components/landing/AuthAwareCTA.js` — Auth-aware CTA
- `src/app/components/landing/LandingNav.jsx` — Navigation
- `src/app/components/landing/LandingFooter.jsx` — Footer

### Architecture references
- `public-site-i18n` skill — Full public site architecture

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AnimatedSection` / `AnimatedStagger` / `AnimatedItem` — Scroll-triggered animations, reuse across new pricing sections
- Radix UI Accordion — Already used in FAQSection, keep for expanded FAQ
- shadcn Button, Card, Badge — Available for tier card styling
- Landing color tokens in globals.css — `#050505`, `#F97316`, `#F5F5F4` already established

### Established Patterns
- Next.js App Router Server Components default; `'use client'` only where needed
- Tailwind v4 CSS-based theming via `@import 'tailwindcss'`
- `(public)` route group layout wraps all public pages
- Framer Motion v12 for scroll animations via AnimatedSection wrapper

### Integration Points
- All changes are in-place upgrades to existing pricing page files
- `pricingData.js` is the single source of truth for tier data — update here, components follow
- `/onboarding` remains the CTA destination for all "Start Free Trial" buttons (Stripe phase will change this later)
- `/contact` is the Enterprise CTA destination

</code_context>

<specifics>
## Specific Ideas

- 14-day free trial is the PRIMARY pull factor — it should be prominently visible, not buried. "14-Day Free Trial • Cancel Anytime" banner near the top.
- ROI framing continues from Phase 6: "Stop Losing $1,000 Jobs to Voicemail" headline direction.
- Volume-based tiers are honest — all features available to all plans. Only call volume and support level differ. This matches the current product reality where there's no feature gating.
- Feature list must be accurate to what's actually built — no aspirational features presented as available (except Enterprise's "custom integrations" which signals enterprise readiness).
- Remove ALL money-back guarantee mentions and ALL "no credit card required" mentions from the pricing page, FAQ, and anywhere else they appear.
- Testimonial section adds human trust — 1-2 short quotes from trades owners placed between comparison table and CTA.
- The pricing page should feel like a natural extension of the landing page — same premium dark SaaS energy, not a downgrade.

</specifics>

<deferred>
## Deferred Ideas

- Stripe Checkout integration — handled in a separate active phase
- Live demo phone number on pricing page — needs Retell demo account
- Coupon/promo code display — depends on Stripe integration
- Analytics / conversion tracking on pricing page — separate concern

</deferred>

---

*Phase: 21-pricing-page-redesign*
*Context gathered: 2026-03-26*

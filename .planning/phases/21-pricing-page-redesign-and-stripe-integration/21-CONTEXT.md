# Phase 21: Pricing Page Redesign and Stripe Integration - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform the pricing page from a display-only placeholder into a conversion-optimized, payment-enabled page — matching the premium dark SaaS design language of the landing page. Stripe Checkout integration for subscription payments with 14-day free trial (card required upfront). Updated feature tiers reflecting actual product capabilities (volume-based, not feature-gated). Social proof elements (trial banner, testimonial). Expanded FAQ covering setup, AI quality, billing, and security. Stripe Customer Portal for post-signup plan management. No money-back guarantee messaging. No "no credit card required" messaging anywhere.

</domain>

<decisions>
## Implementation Decisions

### Stripe Checkout Flow
- **D-01:** Use Stripe Checkout (hosted payment page), not embedded Elements. Redirect to `checkout.stripe.com` on CTA click. Stripe handles card UI, validation, 3D Secure, Apple Pay/Google Pay.
- **D-02:** 14-day free trial with credit card required upfront. Stripe Checkout shows "$0.00 today • $X/mo after 14 days". Uses Stripe's native `trial_period_days` on the subscription.
- **D-03:** Success redirect → `/onboarding?plan={tier_id}` (user flows into onboarding wizard after payment). Cancel redirect → `/pricing`.
- **D-04:** API route creates Stripe Checkout session: receives `tier_id` + `billing_period` (monthly/annual), maps to Stripe Price ID, creates session with `trial_period_days: 14`.
- **D-05:** Stripe Customer Portal for all post-signup plan management (upgrade, downgrade, cancel, update card, view invoices). Single "Manage Subscription" button in dashboard settings links to Stripe-hosted portal. Zero custom billing UI.
- **D-06:** Stripe webhook endpoint to sync subscription status to database (subscription.created, subscription.updated, subscription.deleted, invoice.paid, invoice.payment_failed).

### CTA Copy
- **D-07:** All paid tier CTAs say "Start Free Trial". Enterprise CTA stays "Contact Us" → routes to `/contact` with inquiry type pre-selected as sales.
- **D-08:** No "money-back guarantee" messaging anywhere on the pricing page or site.
- **D-09:** No "no credit card required" messaging anywhere on the pricing page or site.

### Visual Design — Premium Dark SaaS
- **D-10:** Rich dark hero matching landing page energy: `#050505` background, radial gradient orange accent, dot-grid texture overlay, floating blur orb. Eyebrow + headline + subline + trial banner + billing toggle.
- **D-11:** Dark tier cards on dark background. Rest: `bg-[#1A1816]`, `border-white/[0.06]`, white text. Hover: `border-rgba(249,115,22,0.3)`, `shadow-0_0_20px_rgba(249,115,22,0.15)`, `translateY(-2px)`. Growth highlighted with `ring-2 ring-[#F97316]/50` + "Most Popular" badge in copper.
- **D-12:** 14-day free trial banner prominently placed near the top of the pricing section, below the hero headline: "14-Day Free Trial • Cancel Anytime".
- **D-13:** One testimonial quote section between the comparison table and CTA banner — 1-2 short quotes from trades owners.
- **D-14:** No social proof micro-line with avatar bubbles on pricing page (keep that for landing page only).
- **D-15:** Comparison table stays on stone `#F5F5F4` background (the "breath" section). FAQ on dark. CTA banner on dark warm brown `#1C1412` with copper radial gradient.

### Tier Structure — Volume-Based
- **D-16:** All features available on all paid tiers. Tiers differentiated by call volume and support level only. No feature gating.
- **D-17:** Feature list updated to reflect only actually built capabilities: AI receptionist 24/7, lead capture & CRM, SMS + email notifications, priority triage, Google Calendar sync, Outlook Calendar sync, booking-first dispatcher, multi-language (EN/ES), recovery SMS fallback.
- **D-18:** Enterprise tier adds: unlimited calls, priority support, custom integrations (aspirational but signals enterprise readiness).
- **D-19:** Prices unchanged: Starter $99/40 calls, Growth $249/120 calls, Scale $599/400 calls. 20% annual discount.
- **D-20:** Comparison table updated to match volume-based structure. Rows show call limits and support level as differentiators, not feature availability.

### FAQ — Expanded (6-8 Questions)
- **D-21:** Remove existing money-back guarantee FAQ. Remove "no credit card required" trial FAQ.
- **D-22:** New FAQ covers 4 topic areas: setup/onboarding, AI call quality, trial/billing, data/security.
- **D-23:** Target 6-8 questions total. Accordion format preserved (Radix UI). Claude writes final FAQ copy.
- **D-24:** Setup/onboarding: "How long does setup take?" "Do I need technical skills?"
- **D-25:** AI quality: "Can callers tell it's AI?" "What if the AI gets confused?"
- **D-26:** Trial/billing: "How does the 14-day trial work?" "Can I cancel anytime?" "What about overages?"
- **D-27:** Data/security: "Where are recordings stored?" "Who can access my data?"

### Claude's Discretion
- Final copy for all headlines, sublines, FAQ answers, and testimonial quotes
- Exact Stripe Price ID mapping and webhook event handling details
- Animation timing and scroll triggers on new sections
- Comparison table row structure for volume-based tiers
- Mobile responsive adaptations
- Trial banner exact styling and placement
- Testimonial section design (single quote vs side-by-side)
- Contact page pre-selection implementation for Enterprise CTA

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phase context (design lineage)
- `.planning/phases/06-public-marketing-pages/06-CONTEXT.md` — Original pricing page decisions: 4 tiers, toggle, FAQ, ROI framing, display-only (Stripe was deferred — now implementing)
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
- `src/components/landing/AuthAwareCTA.js` — Auth-aware CTA (may need adaptation for Stripe flow)
- `src/app/components/landing/LandingNav.jsx` — Navigation
- `src/app/components/landing/LandingFooter.jsx` — Footer

### Architecture references
- `public-site-i18n` skill — Full public site architecture
- `auth-database-multitenancy` skill — Supabase client types, middleware, RLS (relevant for subscription status storage)
- `onboarding-flow` skill — Onboarding wizard (success redirect target after Stripe Checkout)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AnimatedSection` / `AnimatedStagger` / `AnimatedItem` — Scroll-triggered animations, reuse across new pricing sections
- `AuthAwareCTA` — Auth-aware CTA button, may need Stripe-aware variant for pricing
- Radix UI Accordion — Already used in FAQSection, keep for expanded FAQ
- shadcn Button, Card, Badge — Available for tier card styling
- Landing color tokens in globals.css — `#050505`, `#F97316`, `#F5F5F4` already established

### Established Patterns
- Next.js App Router Server Components default; `'use client'` only where needed
- Tailwind v4 CSS-based theming via `@import 'tailwindcss'`
- `(public)` route group layout wraps all public pages
- Framer Motion v12 for scroll animations via AnimatedSection wrapper
- API routes in `src/app/api/` for backend logic

### Integration Points
- New API route: `src/app/api/stripe/checkout/route.js` — Create Checkout session
- New API route: `src/app/api/stripe/webhook/route.js` — Handle Stripe webhook events
- New API route: `src/app/api/stripe/portal/route.js` — Create Customer Portal session
- Dashboard settings: Add "Manage Subscription" button linking to Stripe Portal
- Onboarding wizard: Accept `?plan=` query param to associate subscription with account
- Database: May need `subscription_status`, `stripe_customer_id`, `stripe_subscription_id` columns on tenants table
- Environment variables: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, Stripe Price IDs per tier/billing period

</code_context>

<specifics>
## Specific Ideas

- 14-day free trial is the PRIMARY pull factor — it should be prominently visible, not buried. "14-Day Free Trial • Cancel Anytime" banner near the top.
- Card required upfront for trial — auto-converts on day 14. Stripe Checkout shows "$0.00 today" to make it feel risk-free despite card collection.
- ROI framing continues from Phase 6: "Stop Losing $1,000 Jobs to Voicemail" headline direction.
- Volume-based tiers are honest — all features available to all plans. Only call volume and support level differ. This matches the current product reality where there's no feature gating.
- Feature list must be accurate to what's actually built — no aspirational features presented as available (except Enterprise's "custom integrations" which signals enterprise readiness).
- Remove ALL money-back guarantee mentions and ALL "no credit card required" mentions from the pricing page, FAQ, and anywhere else they appear.
- Testimonial section adds human trust — 1-2 short quotes from trades owners placed between comparison table and CTA.

</specifics>

<deferred>
## Deferred Ideas

- Trial expiry email sequence (day 12 reminder, day 14 expired) — belongs in a notifications/lifecycle phase
- Usage-based call limit enforcement and overage billing — needs backend enforcement logic, separate phase
- Plan upgrade/downgrade proration logic — Stripe handles this in Customer Portal, but tracking changes in-app needs its own work
- Stripe tax collection configuration — depends on business entity and tax requirements
- Coupon/promo code system — Stripe supports this but needs admin UI to manage codes

</deferred>

---

*Phase: 21-pricing-page-redesign-and-stripe-integration*
*Context gathered: 2026-03-26*

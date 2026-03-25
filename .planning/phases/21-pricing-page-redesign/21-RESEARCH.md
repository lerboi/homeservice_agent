# Phase 21: Pricing Page Redesign - Research

**Researched:** 2026-03-26
**Domain:** Next.js public page UI — premium dark SaaS pricing page, Tailwind v4, Framer Motion, Radix UI accordion
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** All paid tier CTAs say "Start Free Trial". Enterprise CTA stays "Contact Us" → routes to `/contact?type=sales`.
- **D-02:** 14-day free trial is the PRIMARY pull factor — prominently displayed near the top as a banner: "14-Day Free Trial • Cancel Anytime".
- **D-03:** No "money-back guarantee" messaging anywhere on the pricing page.
- **D-04:** No "no credit card required" messaging anywhere on the pricing page.
- **D-05:** CTA href stays as `/onboarding` for now (Stripe checkout integration will update this in a separate phase).
- **D-06:** Rich dark hero matching landing page energy: `#050505` background, radial gradient orange accent, dot-grid texture overlay, floating blur orb. Eyebrow + headline + subline + trial banner + billing toggle.
- **D-07:** Dark tier cards on dark background. Card bg: `bg-[#1A1816]`, border: `border-white/[0.06]`, white text. Hover: `border-rgba(249,115,22,0.3)`, `shadow-0_0_20px_rgba(249,115,22,0.15)`, `translateY(-2px)`. Growth highlighted with `ring-2 ring-[#F97316]/50` + "Most Popular" badge in copper.
- **D-08:** Testimonial quote section between the comparison table and CTA banner — 1-2 short quotes from trades owners.
- **D-09:** Comparison table stays on stone `#F5F5F4` background. FAQ on dark (`#050505`). CTA banner on dark warm brown `#1C1412` with copper radial gradient.
- **D-10:** All features available on all paid tiers. Tiers differentiated by call volume and support level only.
- **D-11:** Feature list updated to reflect only actually built capabilities: AI receptionist 24/7, lead capture & CRM, SMS + email notifications, priority triage, Google Calendar sync, Outlook Calendar sync, booking-first dispatcher, multi-language (EN/ES), recovery SMS fallback.
- **D-12:** Enterprise tier adds: unlimited calls, priority support, custom integrations.
- **D-13:** Prices unchanged: Starter $99/40 calls, Growth $249/120 calls, Scale $599/400 calls. 20% annual discount.
- **D-14:** Comparison table updated to match volume-based structure. Rows show call limits and support level as differentiators, not feature availability.
- **D-15:** Remove existing money-back guarantee FAQ. Remove "no credit card required" trial FAQ.
- **D-16:** New FAQ covers 4 topic areas: setup/onboarding, AI call quality, trial/billing, data/security.
- **D-17:** Target 6-8 questions total. Accordion format preserved (Radix UI).
- **D-18 through D-21:** Specific FAQ questions for each topic area as defined in CONTEXT.md.

### Claude's Discretion

- Final copy for all headlines, sublines, FAQ answers, and testimonial quotes
- Animation timing and scroll triggers on new sections
- Comparison table row structure for volume-based tiers
- Mobile responsive adaptations
- Trial banner exact styling and placement
- Testimonial section design (single quote vs side-by-side)
- Contact page pre-selection implementation for Enterprise CTA
- Typography sizing and spacing within established palette

### Deferred Ideas (OUT OF SCOPE)

- Stripe Checkout integration — handled in a separate active phase
- Live demo phone number on pricing page — needs Retell demo account
- Coupon/promo code display — depends on Stripe integration
- Analytics / conversion tracking on pricing page — separate concern
</user_constraints>

---

## Summary

Phase 21 is a focused in-place upgrade to 5 existing files (`page.js`, `pricingData.js`, `PricingTiers.jsx`, `ComparisonTable.jsx`, `FAQSection.jsx`) plus one new section (testimonials). The work is entirely frontend — no API routes, no database changes, no new dependencies. The design direction is fully specified via CONTEXT.md decisions and the pre-existing UI-SPEC (`21-UI-SPEC.md`) which serves as the complete visual and copy contract.

The key transformation is flipping the pricing page from its current "light card on dark hero" treatment to a fully dark-first premium SaaS aesthetic matching the landing page. Dark tier cards replace white cards, the hero upgrades to `#050505` with dot-grid + blur orb, the FAQ section moves to dark, and a testimonial section is inserted between comparison table and CTA. Feature lists shift from feature-gated ("Everything in Growth") to honest volume-based representation where all paid plans include all built capabilities.

The most significant implementation risk is the Contact page query param pre-selection for the Enterprise CTA. The contact page's `ContactForm.jsx` currently does not read URL params — this requires adding `useSearchParams()` to pre-select the inquiry type. This is the only cross-file change outside the pricing directory.

**Primary recommendation:** Implement all changes file-by-file against the UI-SPEC as the authoritative source of truth. The spec is complete — no guesswork required.

---

## Project Constraints (from CLAUDE.md)

| Directive | Implication for This Phase |
|-----------|---------------------------|
| After changes, update the relevant skill file | The `public-site-i18n` skill MUST be updated after all pricing page changes are complete to reflect new pricingData structure, new FAQ content, and new section layout |
| Keep skill files accurate and in sync with the codebase | `public-site-i18n` SKILL.md section 7 (Pricing Page) documents the tier data structure and FAQ — it must be rewritten to reflect volume-based tiers, dark card treatment, new FAQ questions, and testimonial section |

---

## Standard Stack

### Core (all already installed — no new dependencies)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Next.js App Router | current project version | Server/Client components, routing | Installed |
| Tailwind v4 | current project version | CSS-based theming via `@import 'tailwindcss'` | Installed |
| Framer Motion v12 | current project version | AnimatedSection, AnimatedStagger, AnimatedItem | Installed |
| `@radix-ui/react-accordion` | installed | FAQSection accordion | Installed |
| `lucide-react` | installed | Check, ChevronDown icons | Installed |
| shadcn (new-york) | installed | Button, Card, CardContent, CardHeader, Badge | Installed |

**No new packages required.** This phase is a pure UI rewrite of existing code using the already-installed stack.

### Accordion animation — already configured

The accordion keyframe animations are already registered in `src/app/globals.css`:
- `--animate-accordion-down: accordion-down 200ms ease-out`
- `--animate-accordion-up: accordion-up 200ms ease-out`
- Both keyframes animate `height` from 0 to `var(--radix-accordion-content-height)`

No CSS changes needed for the FAQ accordion.

---

## Architecture Patterns

### Recommended File Change Scope

```
src/app/(public)/pricing/
├── page.js                  # Section layout changes: hero bg, new testimonial section, FAQ section bg
├── pricingData.js           # PRICING_TIERS ctaLabels, features; COMPARISON_FEATURES volume-based
├── PricingTiers.jsx         # Dark card treatment, trial banner, "Start Free Trial" CTAs
├── ComparisonTable.jsx      # Volume-based rows, no feature-gate rows
└── FAQSection.jsx           # 8 new FAQ items, dark accordion styling

src/app/(public)/contact/
└── ContactForm.jsx          # Add useSearchParams() to pre-select inquiryType from ?type=sales

.claude/skills/public-site-i18n/
└── SKILL.md                 # Update section 7 (Pricing Page) to reflect all changes
```

### Pattern 1: Server vs Client Component Boundaries

**What:** `PricingTiers.jsx` is `'use client'` (billing toggle state). `FAQSection.jsx` is `'use client'` (accordion). All new sections in `page.js` (testimonials, updated CTA banner) are Server Components. This boundary is already established — do not change it.

**When to use:** Any section with interactive state (toggle, accordion) stays client. Static display sections default to server.

**Example (existing pattern — preserve as-is):**
```jsx
// Source: existing PricingTiers.jsx
'use client';
import { useState } from 'react';
// ...
const [billing, setBilling] = useState('annual');
```

### Pattern 2: Landing Page Background Layer Stack

**What:** The landing page hero uses 3 layered background effects on top of the base bg color. All layers are `absolute inset-0 pointer-events-none`. The pricing page hero MUST match this pattern.

**Layer order (from HeroSection.jsx):**
```jsx
// Source: src/app/components/landing/HeroSection.jsx
<section className="relative bg-[#050505] overflow-hidden">
  {/* 1. Radial gradient accent */}
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.06),transparent_70%)] pointer-events-none" />
  {/* 2. Dot-grid texture */}
  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />
  {/* 3. Floating blur orb */}
  <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-[#F97316]/[0.03] blur-[120px] pointer-events-none" />
  <div className="relative ...">
    {/* content */}
  </div>
</section>
```

The UI-SPEC uses a dot-grid variant `bg-[radial-gradient(circle,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:24px_24px]` — use the spec's version for the pricing page specifically (denser dot grid vs the landing page's line grid).

### Pattern 3: AnimatedStagger for Tier Cards

**What:** Tier cards use `AnimatedStagger` (container) + `AnimatedItem` (per card) for staggered entrance. This is the established pattern for grid items.

```jsx
// Source: existing PricingTiers.jsx — preserve this pattern
import { AnimatedStagger, AnimatedItem } from '@/app/components/landing/AnimatedSection';

<AnimatedStagger className="grid grid-cols-1 md:grid-cols-4 gap-5 max-w-6xl mx-auto">
  {PRICING_TIERS.map((tier) => (
    <AnimatedItem key={tier.id}>
      <Card ...>...</Card>
    </AnimatedItem>
  ))}
</AnimatedStagger>
```

### Pattern 4: Contact Page Query Param Pre-selection

**What:** Enterprise "Contact Us" links to `/contact?type=sales`. The `ContactForm.jsx` needs to read `useSearchParams()` from `next/navigation` and apply the pre-selected value to the `<select>` defaultValue.

**Implementation:**
```jsx
// Source: Next.js App Router pattern (HIGH confidence — verified against next/navigation API)
'use client';
import { useSearchParams } from 'next/navigation';

export function ContactForm() {
  const searchParams = useSearchParams();
  const preselectedType = searchParams.get('type') || '';
  // ...
  return (
    <select
      name="inquiryType"
      defaultValue={preselectedType}
      // ...
    >
```

**Important:** `useSearchParams()` requires the component to be wrapped in `<Suspense>` boundary in the parent if the page is statically rendered. `ContactForm` is already `'use client'` and the contact page is not a static page (it renders a client component), so no Suspense wrapper is needed here. Verify at runtime — if Next.js warns about missing Suspense, add it in `contact/page.js`.

### Pattern 5: Dark FAQ Accordion

**What:** FAQSection currently renders on a light background with `text-[#0F172A]` trigger text and `border-[#0F172A]/10` borders. Moving to dark background (`#050505`) requires inverting colors — `text-white` trigger, `border-white/[0.08]` separators, `text-white/60` answer text.

**Existing accordion structure to preserve (structure only, invert colors):**
```jsx
// Source: existing FAQSection.jsx
<Accordion.Root type="single" collapsible className="space-y-3 max-w-3xl mx-auto">
  <Accordion.Item className="border-b border-white/[0.08]">
    <Accordion.Trigger className="... text-white font-semibold text-lg ...">
    <Accordion.Content className="...">
      <p className="text-white/60 text-[15px] leading-relaxed pb-5">
```

### Anti-Patterns to Avoid

- **Do not add Spline 3D to the pricing hero** — the landing HeroSection uses Spline but the pricing page has no desktop-only 3D scene requirement. The dot-grid + blur orb is the correct substitute.
- **Do not introduce new animation components** — use the existing AnimatedSection / AnimatedStagger / AnimatedItem only. Do not add new Framer Motion variants.
- **Do not change the comparison table section background** — it intentionally stays `#F5F5F4` (the "breath" break between dark blocks per D-09).
- **Do not feature-gate in the comparison table** — the old COMPARISON_FEATURES had `false` for features not available on lower tiers. The new structure shows all features as available on all paid tiers, with only call volume and support level as differentiators.
- **Do not use `router.push` for the billing toggle** — toggle state is local `useState`, not URL-driven.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Smooth accordion animation | Custom height animation | Radix `--radix-accordion-content-height` + existing CSS keyframes in globals.css | Radix handles the height measurement; hand-rolling breaks on dynamic content |
| Scroll-triggered animation | Custom IntersectionObserver | `AnimatedSection` / `AnimatedStagger` / `AnimatedItem` (already in project) | Handles `prefers-reduced-motion`, viewport threshold, once-only trigger |
| Billing toggle | Custom radio group | Simple `useState` with button group (already in PricingTiers.jsx) | No accessibility complexity for a 2-button toggle; existing pattern works |
| Contact form pre-selection | URL param parsing utilities | `useSearchParams()` from `next/navigation` | Next.js built-in, SSR-safe, no extra dependencies |

---

## Existing Code State (Current vs Target)

### What Changes — Delta Map

| File | Current State | Target State | Scope |
|------|---------------|--------------|-------|
| `page.js` | Hero: `bg-[#1A1816]`; no testimonial section; FAQ: light section | Hero: `bg-[#050505]` with 3 bg layers; testimonial section inserted; FAQ: `bg-[#050505]` dark | Section backgrounds + new section |
| `pricingData.js` | CTAs: "Get Started"; feature-differentiated tiers; old COMPARISON_FEATURES | CTAs: "Start Free Trial" / "Contact Us"; volume-based features; new COMPARISON_FEATURES | Data only — no component logic |
| `PricingTiers.jsx` | White cards (`bg-white border-stone-200`); no trial banner | Dark cards (`bg-[#1A1816] border-white/[0.06]`); trial banner above toggle | Visual treatment + banner |
| `ComparisonTable.jsx` | 14 feature rows with checkmarks/dashes; feature gating | ~13 rows; all shared features = checkmarks; call volume + support as string values | Row data source from pricingData.js |
| `FAQSection.jsx` | 4 questions; light styling; money-back + no-cc-required questions | 8 questions; dark styling; new FAQ content verbatim from UI-SPEC | Content + color inversion |
| `ContactForm.jsx` | `defaultValue=""` hardcoded; no URL param reading | `defaultValue={searchParams.get('type') \|\| ''}` | One-line change + import |
| `public-site-i18n` SKILL.md | Documents current pricing structure | Updated to reflect volume-based tiers, dark cards, new FAQ | Skill sync (CLAUDE.md requirement) |

### What Does Not Change

- `AnimatedSection.jsx` — no changes
- `LandingNav.jsx` — no changes
- `LandingFooter.jsx` — no changes
- `AuthAwareCTA.js` — not used on pricing page (plain `<Link>` CTAs used instead)
- `contact/page.js` — no changes (ContactForm is the only thing that changes)
- Any API routes — no changes
- `globals.css` — no changes (accordion animations already registered)

---

## Common Pitfalls

### Pitfall 1: Forgetting the `relative` + `overflow-hidden` wrapper on the hero section

**What goes wrong:** The dot-grid texture and blur orb are `absolute inset-0`. Without `overflow-hidden` on the parent `<section>`, the blur orb (400-500px wide) extends beyond the section boundary and bleeds into the comparison table below.

**Why it happens:** The blur is a large `div` positioned at `top-1/4 right-1/4` — half of it extends outside the section.

**How to avoid:** Always wrap sections with background effects in `relative overflow-hidden`. Check current `page.js` — the existing hero section already has this: `className="relative bg-[#1A1816] pt-28 pb-20 overflow-hidden"`. Preserve `overflow-hidden` when upgrading the background.

### Pitfall 2: Dark card text colors — not just inverting white/black

**What goes wrong:** Naively switching from light card to dark card by changing background and making all text white results in illegible text hierarchy. The design uses opacity variants for hierarchy: tier name = `text-white`, price = `text-white`, description = `text-white/50`, feature items = `text-white/70`, `/mo` suffix = `text-white/40`.

**How to avoid:** Follow the exact color values from the UI-SPEC dark card anatomy table. Do not use a single `text-white` for all card text.

### Pitfall 3: Annual strikethrough price color inversion

**What goes wrong:** Current `PricingTiers.jsx` uses `text-[#475569] line-through` for the strikethrough. On dark cards this renders as a barely visible medium-gray against dark background.

**How to avoid:** Change to `text-white/30 line-through` for dark card treatment per UI-SPEC.

### Pitfall 4: Contact page `useSearchParams()` Suspense boundary

**What goes wrong:** Next.js App Router may warn or error if a component using `useSearchParams()` is not wrapped in a `<Suspense>` boundary when the page could be statically rendered. The warning appears at build time, not always at dev time.

**Why it happens:** `useSearchParams()` opts the component into dynamic rendering. If the parent is a Server Component with no other dynamic dependencies, Next.js may require an explicit Suspense boundary to split the static/dynamic boundary.

**How to avoid:** If the build produces a warning, wrap `<ContactForm />` in `<Suspense fallback={null}>` in `contact/page.js`. This is a safe fallback since ContactForm has no skeleton needed.

### Pitfall 5: Trial banner placement vs billing toggle

**What goes wrong:** Placing the trial banner after the billing toggle rather than between the hero subline and the billing toggle. D-02 explicitly requires the banner to be the primary pull factor — it must appear before the pricing toggle, not after the cards.

**How to avoid:** In `PricingTiers.jsx`, the render order must be: trial banner → billing toggle → tier cards. The trial banner is NOT part of `page.js` hero — it lives inside the `PricingTiers` component above the toggle.

### Pitfall 6: Forgetting to remove money-back / no-credit-card copy from FAQSection

**What goes wrong:** The current FAQ has two items that violate D-03 and D-04:
1. "Is there a free trial?" — currently says "no credit card required"
2. "What is your refund policy?" — currently has 30-day money-back guarantee

**How to avoid:** Remove both items entirely and replace with the 8 new FAQ items from the UI-SPEC. Do not keep any part of these two old questions.

### Pitfall 7: Comparison table column highlighting for Growth tier

**What goes wrong:** The Growth tier header should be visually distinct in the comparison table (it is "Most Popular"). Without this, the light comparison table on `#F5F5F4` feels flat.

**How to avoid:** Per UI-SPEC, the Growth column header uses `text-[#F97316] font-semibold` + `ring-2 ring-[#F97316]/20` visual treatment. This requires the `ComparisonTable.jsx` to know which tier is highlighted — pass `highlighted` from PRICING_TIERS data or hardcode the 'growth' column check.

---

## Code Examples

### Dark Tier Card Pattern (complete structure)

```jsx
// Source: 21-UI-SPEC.md Section 2 — verified against existing PricingTiers.jsx patterns
<Card
  className={`relative flex flex-col h-full bg-[#1A1816] border border-white/[0.06] rounded-xl
    transition-all duration-200
    hover:border-[rgba(249,115,22,0.3)] hover:shadow-[0_0_20px_rgba(249,115,22,0.15)] hover:-translate-y-0.5
    ${isHighlighted ? 'ring-2 ring-[#F97316]/50' : ''}`}
>
  <CardHeader>
    {tier.badge && (
      <Badge className="bg-[#F97316] text-white text-xs font-semibold px-3 py-1 rounded-full w-fit">
        {tier.badge}
      </Badge>
    )}
    <div className="text-lg font-semibold text-white">{tier.name}</div>
    <div className="mt-2 flex items-baseline gap-1">
      {tier.monthlyPrice === null ? (
        <span className="text-3xl font-semibold text-white">Custom</span>
      ) : (
        <>
          <span className="text-3xl font-semibold text-white">${price}</span>
          <span className="text-sm text-white/40">/mo</span>
        </>
      )}
    </div>
    {billing === 'annual' && tier.monthlyPrice !== null && (
      <span className="text-xs text-white/30 line-through">${tier.monthlyPrice}/mo</span>
    )}
    <p className="text-sm text-white/50 mt-2">{tier.description}</p>
  </CardHeader>
  <CardContent className="flex flex-col flex-1 pt-5">
    <ul className="space-y-2.5 flex-1">
      {tier.features.map((feature) => (
        <li key={feature} className="flex items-start gap-2 text-sm text-white/70">
          <Check className="size-4 text-[#F97316] shrink-0 mt-0.5" />
          {feature}
        </li>
      ))}
    </ul>
    <div className="mt-5">
      <Button
        asChild
        className={`w-full min-h-[44px] rounded-lg text-sm font-medium ${
          isHighlighted
            ? 'bg-[#F97316] text-white hover:bg-[#F97316]/90 shadow-[0_4px_16px_rgba(249,115,22,0.3)]'
            : 'bg-white/[0.08] border border-white/[0.1] text-white hover:bg-white/[0.12]'
        }`}
      >
        <Link href={tier.ctaHref}>{tier.cta}</Link>
      </Button>
    </div>
  </CardContent>
</Card>
```

### Trial Banner Pattern

```jsx
// Source: 21-UI-SPEC.md Section 1 (trial banner) — D-02 placement: above billing toggle
<div className="flex justify-center mb-6">
  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.08] text-sm font-medium text-white/80">
    <span className="size-1.5 rounded-full bg-[#F97316]" />
    14-Day Free Trial • Cancel Anytime
  </div>
</div>
```

### Updated pricingData.js Structure

```js
// Source: 21-UI-SPEC.md Feature List section + CONTEXT.md D-10 through D-13
export const PRICING_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 99,
    callLimit: 40,
    description: 'For solo operators just getting started',
    cta: 'Start Free Trial',
    ctaHref: '/onboarding',
    highlighted: false,
    features: [
      'AI receptionist 24/7',
      'Lead capture & CRM',
      'SMS + email notifications',
      'Priority triage engine',
      'Google Calendar sync',
      'Outlook Calendar sync',
      'Booking-first dispatcher',
      'Multi-language (EN/ES)',
      'Recovery SMS fallback',
      'Up to 40 calls/month',
      'Email support',
    ],
  },
  // ... Growth (120 calls, Priority email support), Scale (400 calls, Priority support + onboarding call)
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: null,
    callLimit: null,
    description: 'For franchises and multi-location operations',
    cta: 'Contact Us',
    ctaHref: '/contact?type=sales',  // Pre-selects sales inquiry on contact page
    highlighted: false,
    features: [
      // All shared features +
      'Unlimited calls',
      'Dedicated account manager',
      'Custom integrations',
    ],
  },
];

// Volume-based COMPARISON_FEATURES — no feature gating
export const COMPARISON_FEATURES = [
  { name: 'Monthly calls', starter: '40', growth: '120', scale: '400', enterprise: 'Unlimited' },
  { name: 'Annual calls', starter: '480', growth: '1,440', scale: '4,800', enterprise: 'Unlimited' },
  { name: 'Support level', starter: 'Email', growth: 'Priority email', scale: 'Priority + onboarding', enterprise: 'Dedicated' },
  { name: 'AI receptionist 24/7', starter: true, growth: true, scale: true, enterprise: true },
  { name: 'Lead capture & CRM', starter: true, growth: true, scale: true, enterprise: true },
  { name: 'SMS + email notifications', starter: true, growth: true, scale: true, enterprise: true },
  { name: 'Priority triage engine', starter: true, growth: true, scale: true, enterprise: true },
  { name: 'Google Calendar sync', starter: true, growth: true, scale: true, enterprise: true },
  { name: 'Outlook Calendar sync', starter: true, growth: true, scale: true, enterprise: true },
  { name: 'Booking-first dispatcher', starter: true, growth: true, scale: true, enterprise: true },
  { name: 'Multi-language (EN/ES)', starter: true, growth: true, scale: true, enterprise: true },
  { name: 'Recovery SMS fallback', starter: true, growth: true, scale: true, enterprise: true },
  { name: 'Custom integrations', starter: false, growth: false, scale: false, enterprise: true },
];
```

### Dark FAQ Accordion Pattern

```jsx
// Source: 21-UI-SPEC.md Section 5 — dark treatment with inverted colors
<Accordion.Item className="border-b border-white/[0.08]">
  <Accordion.Trigger className="flex items-center justify-between w-full py-5 text-left text-white font-semibold text-lg group min-h-[44px]">
    {item.q}
    <ChevronDown className="size-5 text-[#F97316] transition-transform duration-200 group-data-[state=open]:rotate-180 shrink-0 ml-4" />
  </Accordion.Trigger>
  <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
    <p className="text-white/60 text-[15px] leading-relaxed pb-5">
      {item.a}
    </p>
  </Accordion.Content>
</Accordion.Item>
```

### Testimonial Section Pattern

```jsx
// Source: 21-UI-SPEC.md Section 4 — two-quote layout
// Server Component — no 'use client' needed
<section className="bg-[#1A1816] py-16">
  <div className="max-w-4xl mx-auto px-6">
    <AnimatedStagger className="grid md:grid-cols-2 gap-8">
      {TESTIMONIALS.map((t) => (
        <AnimatedItem key={t.author}>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-8">
            <p className="text-6xl font-serif text-[#F97316]/30 leading-none mb-4">"</p>
            <p className="text-xl text-white/80 italic leading-relaxed">{t.quote}</p>
            <p className="text-sm text-white/50 mt-4">— {t.author}</p>
          </div>
        </AnimatedItem>
      ))}
    </AnimatedStagger>
  </div>
</section>
```

---

## State of the Art

| Old Approach (Current) | New Approach (Phase 21) | When Changed | Impact |
|------------------------|-------------------------|--------------|--------|
| White tier cards on dark hero | Dark tier cards on dark background | Phase 21 | More cohesive premium dark SaaS — no light/dark visual collision in the hero section |
| Feature-gated tiers ("Everything in Growth") | Volume-only differentiation | Phase 21 | Accurate representation of what's actually built; honest marketing |
| 4-question FAQ (light background) | 8-question FAQ (dark background) | Phase 21 | Better coverage of buyer objections; design alignment with dark sections |
| No trial messaging in hero area | 14-day trial banner above billing toggle | Phase 21 | Trial is the primary conversion hook — needs prominence |
| `ctaHref: '/contact'` for enterprise | `ctaHref: '/contact?type=sales'` | Phase 21 | Removes friction — inquiry type pre-selected on arrival |
| Money-back guarantee messaging | Removed entirely | Phase 21 | Aligns with billing reality (no refund policy wired yet) |

---

## Environment Availability

Step 2.6: SKIPPED — Phase 21 is a pure frontend code change. No external tools, services, CLIs, runtimes, or databases are dependencies of this phase. All libraries are already installed.

---

## Validation Architecture

`nyquist_validation: true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected for frontend components (no Jest/Vitest/Playwright config found in project) |
| Config file | none |
| Quick run command | `npm run build` (Next.js build validates JSX, imports, and type correctness) |
| Full suite command | `npm run build && npm run lint` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| SC-1 | Pricing page renders with `#050505` dark hero | Visual / manual | `npm run build` (build = no import errors) | No automated visual test; verify manually |
| SC-2 | Volume-based feature lists in tier cards | Unit-level data check | `npm run build` | pricingData.js changes are pure data — verified by component rendering |
| SC-3 | 14-day trial banner prominent above billing toggle | Visual / manual | Manual review at `localhost:3000/pricing` | |
| SC-4 | Enterprise CTA → `/contact?type=sales` | Manual link check | Verify `href` in pricingData.js output | |
| SC-5 | Testimonial section between comparison table and CTA | Manual review | Manual review at `localhost:3000/pricing` | |
| SC-6 | FAQ has 8 questions, no money-back/no-cc content | Content check | Grep FAQSection.jsx | `grep -i "money-back\|credit card" FAQSection.jsx` should return nothing |
| SC-7 | No money-back / no-credit-card messaging anywhere | Content audit | grep across pricing dir | `grep -ri "money.back\|credit card" src/app/\(public\)/pricing/` |
| SC-8 | Mobile layout at 375px — cards stack, table scrolls | Visual / manual | DevTools mobile viewport | |

### Sampling Rate

- **Per task commit:** `npm run build` — confirms no broken imports or JSX errors
- **Per wave merge:** `npm run build && npm run lint` — full static analysis
- **Phase gate:** All 8 success criteria verified manually at `localhost:3000/pricing` before `/gsd:verify-work`

### Wave 0 Gaps

None — no new test infrastructure required. This phase has no automated test coverage beyond build validation, which is the correct level for a display-only frontend page redesign.

---

## Open Questions

1. **Contact page Suspense boundary for `useSearchParams()`**
   - What we know: `useSearchParams()` in App Router may require Suspense boundary at build time
   - What's unclear: Whether `contact/page.js` already triggers dynamic rendering for other reasons (avoiding the need for explicit Suspense)
   - Recommendation: Add the change to `ContactForm.jsx`, run `npm run build`, and add `<Suspense fallback={null}>` around `<ContactForm />` in `contact/page.js` only if the build warns about it

2. **Testimonial section placement in page.js**
   - What we know: UI-SPEC says testimonials go between comparison table and FAQ; FAQ moves to dark
   - What's unclear: Whether to put testimonials as a separate `<section>` in `page.js` or as an inline section component
   - Recommendation: Keep it inline in `page.js` (same pattern as existing testimonial-like sections) — no new component file needed for 2 quotes

---

## Sources

### Primary (HIGH confidence)

- Existing codebase files (read directly): `src/app/(public)/pricing/page.js`, `pricingData.js`, `PricingTiers.jsx`, `ComparisonTable.jsx`, `FAQSection.jsx`, `HeroSection.jsx`, `FinalCTASection.jsx`, `AnimatedSection.jsx`, `contact/ContactForm.jsx`, `globals.css`
- `.planning/phases/21-pricing-page-redesign/21-CONTEXT.md` — locked decisions D-01 through D-21
- `.planning/phases/21-pricing-page-redesign/21-UI-SPEC.md` — complete visual and copy contract
- `.claude/skills/public-site-i18n/SKILL.md` — canonical public site architecture reference

### Secondary (MEDIUM confidence)

- Next.js App Router `useSearchParams()` — App Router docs pattern; behavior verified against project's existing `useSearchParams` usage

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already installed; read directly from existing code
- Architecture patterns: HIGH — read directly from existing production code; no guesswork
- Design decisions: HIGH — UI-SPEC is the authoritative contract; all values locked
- Pitfalls: HIGH — identified from direct code reading (existing values that must change)
- Contact page query param: MEDIUM — `useSearchParams()` pattern is well-established but Suspense boundary behavior depends on page rendering mode (verify at build time)

**Research date:** 2026-03-26
**Valid until:** Stable — no fast-moving dependencies. Valid until next pricing page changes.

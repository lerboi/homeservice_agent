---
phase: 06
plan: 02
subsystem: public-marketing-pages
tags: [pricing, billing-toggle, comparison-table, faq-accordion, conversion-page]
dependency_graph:
  requires:
    - "06-01: (public) route group layout, pricingData.js constants"
  provides:
    - "/pricing page with interactive billing toggle, tier cards, comparison table, FAQ, CTA banner"
    - "PricingTiers client component (billing toggle state + 4 tier cards)"
    - "FAQSection client component (Radix accordion, single-open)"
    - "ComparisonTable server component (sticky header, 14-row feature matrix)"
  affects:
    - "06-03 (contact page) — shares (public) layout and LandingNav/Footer"
tech_stack:
  added: []
  patterns:
    - "@radix-ui/react-accordion for FAQ accordion (not radix-ui/react-accordion subpath)"
    - "Billing toggle as uncontrolled pill buttons with useState — no external library"
    - "ComparisonTable as Server Component — sticky thead, scope attributes for a11y"
    - "Growth card order-first on mobile via Tailwind order utilities"
key_files:
  created:
    - src/app/(public)/pricing/PricingTiers.jsx
    - src/app/(public)/pricing/FAQSection.jsx
    - src/app/(public)/pricing/ComparisonTable.jsx
    - src/app/(public)/pricing/page.js
  modified: []
decisions:
  - "[Phase 06-02]: @radix-ui/react-accordion is the correct import path — radix-ui/react-accordion subpath does not exist as a module even though radix-ui package exports Accordion"
metrics:
  duration: "~4 minutes"
  completed_date: "2026-03-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 0
---

# Phase 6 Plan 02: Pricing Page Summary

**One-liner:** Complete /pricing page with billing toggle, 4 tier cards (Growth highlighted), 14-row comparison table, FAQ accordion, and ROI-framed hero — all 7 PRICE requirements satisfied.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Build PricingTiers client component and FAQSection | 136bd90 | src/app/(public)/pricing/PricingTiers.jsx, src/app/(public)/pricing/FAQSection.jsx |
| 2 | Build pricing page (hero + comparison table + page assembly) | fd0579c | src/app/(public)/pricing/page.js, src/app/(public)/pricing/ComparisonTable.jsx |

## What Was Built

### PricingTiers (Client Component)

`src/app/(public)/pricing/PricingTiers.jsx` — Owns billing toggle state with `useState('monthly')`.

- Billing toggle: Heritage Copper pill (#C2410C) for active state, "Save 20%" green badge on Annual button
- 4 tier cards in `grid grid-cols-1 md:grid-cols-4` using shadcn `<Card>`
- Growth card: `ring-2 ring-[#C2410C] shadow-lg` + `badge="Most Popular"` via shadcn `<Badge>`
- Mobile reorder: `order-first md:order-2` on Growth card — appears first on mobile
- Annual pricing: `getAnnualPrice()` calculates 20% off; strikethrough original price shown
- Enterprise: shows "Custom" price text, "Contact Us" CTA routing to /contact
- All CTAs: `<Button asChild>` with `<Link href={tier.ctaHref}>`, `min-h-[44px]`
- Cards wrapped in `<AnimatedStagger>` with `<AnimatedItem>` for stagger animation

### FAQSection (Client Component)

`src/app/(public)/pricing/FAQSection.jsx` — Radix accordion with 4 hardcoded FAQ items.

- `@radix-ui/react-accordion` with `type="single"` + `collapsible` (one open at a time)
- 4 questions: cancellation, overage limits, free trial, refund policy
- ChevronDown rotates 180deg (`group-data-[state=open]:rotate-180`) on open
- Wrapped in `<AnimatedSection direction="up">`

### ComparisonTable (Server Component)

`src/app/(public)/pricing/ComparisonTable.jsx` — 14-row feature matrix.

- `sticky top-16 z-10` thead clears fixed nav (64px height)
- `min-w-[640px]` in `overflow-x-auto` container for mobile horizontal scroll
- `<Check>` icon (green #166534) for true, `&mdash;` (muted) for false, string values for counts
- `scope="col"` on tier headers, `scope="row"` on feature names for accessibility

### Pricing Page (Server Component)

`src/app/(public)/pricing/page.js` — 4-section layout.

1. **Hero + Tiers (dark #0F172A):** ROI-framed h1 "Stop Losing $1,000 Jobs to Voicemail", subheading, "No credit card required", then `<PricingTiers />`
2. **Compare Plans (light #F5F5F4):** Section heading + `<ComparisonTable />`
3. **FAQ (light #F5F5F4):** Section heading + `<FAQSection />`
4. **CTA Banner (dark #0F172A):** "Ready to stop losing jobs to voicemail?" + `<Link href="/onboarding">` Heritage Copper button

`export const metadata` with title "Pricing - HomeService AI".

## Verification

- Next.js build: clean (0 errors, 1 pre-existing Turbopack warning)
- `/pricing` route confirmed in build output
- Pricing tests: 7/7 passing (unchanged from Plan 01 scaffold)
- All 7 PRICE requirements satisfied in single /pricing page

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed wrong Radix accordion import path**
- **Found during:** Task 2 build (Next.js module resolution failure)
- **Issue:** Plan specified `import * as Accordion from 'radix-ui/react-accordion'` but the `radix-ui` package does not export accordion via that subpath — only via the top-level `radix-ui` barrel or `@radix-ui/react-accordion`
- **Fix:** Changed import to `@radix-ui/react-accordion` which is separately installed and resolves correctly
- **Files modified:** src/app/(public)/pricing/FAQSection.jsx
- **Commit:** fd0579c (included in Task 2 commit)

## Self-Check: PASSED

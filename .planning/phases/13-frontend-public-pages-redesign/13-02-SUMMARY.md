---
phase: 13
plan: 02
subsystem: frontend/public-pages
tags: [dark-reskin, ui, landing, pricing, about, contact, copper-hover, stone-sections]
dependency_graph:
  requires: [13-01]
  provides: [home-page-dark-sections, pricing-dark-reskin, about-dark-reskin, contact-dark-form]
  affects: [public-pages, landing-ui]
tech_stack:
  added: []
  patterns:
    - copper-hover-glow (border [#C2410C]/40 + shadow rgba(194,65,12,0.15) + translateY)
    - stone-breath-section (one bg-[#F5F5F4] per page)
    - dark-form-card (bg-[#1E293B] on stone section)
    - mobile-stacked-steps (block md:hidden fallback for HowItWorksSticky)
key_files:
  created: []
  modified:
    - src/app/(public)/page.js
    - src/app/components/landing/HowItWorksSection.jsx
    - src/app/components/landing/SocialProofSection.jsx
    - src/app/(public)/pricing/page.js
    - src/app/(public)/pricing/PricingTiers.jsx
    - src/app/(public)/pricing/FAQSection.jsx
    - src/app/(public)/pricing/ComparisonTable.jsx
    - src/app/(public)/about/page.js
    - src/app/(public)/contact/page.js
    - src/app/(public)/contact/ContactForm.jsx
decisions:
  - "HowItWorksSection mobile fallback uses inline mobileSteps data (same source as HowItWorksSticky steps) to avoid additional dynamic import complexity on mobile"
  - "SocialProofSection cards changed from bg-white/[0.03] to explicit bg-[#1E293B] per D-05 card contract — ghost alpha was too subtle for dark surface"
  - "ContactForm focus glow uses focus:shadow-[0_0_0_3px_rgba(194,65,12,0.2)] arbitrary Tailwind value — avoids inline styles while expressing box-shadow correctly"
  - "About page required only minor update (border-stone-200/60) — dark hero + stone values + dark CTA were already correctly implemented"
metrics:
  duration_seconds: 294
  completed_date: "2026-03-24"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 10
---

# Phase 13 Plan 02: Public Pages Dark Reskin Summary

**One-liner:** Applied Premium Dark SaaS palette across all public page content — dark-first with charcoal HIW section, stone breath sections, and copper hover glow on all dark-surface cards.

## What Was Built

Applied the Phase 13 design contract (D-05, D-06, D-13–D-18) to all 10 public page/section files across 3 tasks:

**Task 1 — Home page sections:**
- Fixed `page.js` HowItWorks skeleton: `bg-white` → `bg-[#1E293B]`, shimmer `bg-black/10` → `bg-white/10`, placeholder `bg-[#F5F5F4]/50` → `bg-white/[0.03]`, border `border-black/[0.04]` → `border-white/[0.06]`
- Rebuilt `HowItWorksSection.jsx`: charcoal background `bg-[#1E293B]`, light grid texture pattern, headings `text-[#F1F5F9]`/`text-[#94A3B8]`, eyebrow `text-[#C2410C]`
- Added mobile fallback in HowItWorksSection: `block md:hidden` stacked numbered steps using `bg-[#0F172A]` cards, `hidden md:block` wrapper for HowItWorksSticky
- Fixed inner loading skeleton in HowItWorksSection from `bg-[#F5F5F4]/50 border-black/[0.04]` to `bg-white/[0.03] border-white/[0.06]`
- Updated `SocialProofSection.jsx` cards: `bg-white/[0.03]` → `bg-[#1E293B]`, added copper hover glow treatment, testimonial text to `text-[#94A3B8]`/`text-[#F1F5F9]`
- Verified `FeaturesGrid.jsx` and `FinalCTASection.jsx` already correct

**Task 2 — Pricing page:**
- `pricing/page.js`: FAQ section changed from `bg-[#F5F5F4]` to `bg-[#0F172A]` dark; CTA banner from `bg-[#0F172A]` to copper gradient `from-[#C2410C] to-[#9A3412]`; CTA button inverted to `bg-[#0F172A]`; added eyebrow text
- `PricingTiers.jsx`: Cards from `bg-white` to `bg-[#1E293B]` with full copper hover glow; text to `text-[#F1F5F9]`/`text-[#94A3B8]`; checkmarks to `text-[#C2410C]`; highlighted tier `ring-2 ring-[#C2410C]/60`
- `FAQSection.jsx`: Full dark reskin — `text-[#F1F5F9]` trigger, `text-[#94A3B8]` content, `border-white/[0.08]` dividers, `text-[#C2410C]` chevron
- `ComparisonTable.jsx`: Alternating row tints `bg-white`/`bg-stone-50`; check icons to `text-[#C2410C]`

**Task 3 — About + Contact pages:**
- `about/page.js`: Already correct (dark hero, stone values, dark CTA); updated value card borders to `border-stone-200/60` per stone section card contract
- `contact/page.js`: Stone section `bg-[#F5F5F4]` unchanged; wrapped ContactForm in `bg-[#1E293B] rounded-2xl p-8 md:p-10` dark card
- `ContactForm.jsx`: Labels to `text-[#F1F5F9]`; inputs to `bg-[#0F172A] border border-white/[0.12] text-[#F1F5F9] placeholder:text-[#94A3B8]`; focus to `focus:border-[#C2410C] focus:shadow-[0_0_0_3px_rgba(194,65,12,0.2)]`; added SLA text `text-[#94A3B8]`; all validation/honeypot/loading states preserved

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 1 — Home page sections | 4e660c5 | page.js, HowItWorksSection.jsx, SocialProofSection.jsx |
| 2 — Pricing page | 955c1b9 | pricing/page.js, PricingTiers.jsx, FAQSection.jsx, ComparisonTable.jsx |
| 3 — About + Contact | 8b036b1 | about/page.js, contact/page.js, ContactForm.jsx |

## Verification

- `npm run build` — PASS, no errors
- All 5 must-have artifacts confirmed via grep
- Section flow verified: `#0F172A` (hero) → `#1E293B` (HIW) → `#F5F5F4` (Features) → `#0F172A` (Social Proof) → `#C2410C` (CTA)
- Each page has exactly one stone `#F5F5F4` breath section

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as specified. Minor observations:

1. **About page was nearly complete** — only the border value on stone section cards needed updating from `border-[#0F172A]/5` to `border-stone-200/60`. Dark hero, stone values section, dark CTA were already in place from Phase 06.

2. **SocialProofSection ghost alpha clarification** — Cards used `bg-white/[0.03]` (ghost alpha), changed to explicit `bg-[#1E293B]` to match the D-05 card contract exactly. Ghost alpha is semantically correct but the explicit hex value is the design contract.

## Known Stubs

None. All data is wired — testimonials, pricing tiers, FAQ items, and about page values are all populated with real content.

## Self-Check: PASSED

Files confirmed:
- src/app/(public)/page.js — FOUND bg-[#1E293B] on line 12
- src/app/components/landing/HowItWorksSection.jsx — FOUND bg-[#1E293B] on line 46
- src/app/components/landing/SocialProofSection.jsx — FOUND hover:border-[#C2410C]/40 on line 68
- src/app/(public)/pricing/PricingTiers.jsx — FOUND hover:border-[#C2410C]/40 on line 63
- src/app/(public)/pricing/FAQSection.jsx — FOUND text-[#C2410C] on line 37
- src/app/(public)/about/page.js — FOUND bg-[#F5F5F4] on line 35
- src/app/(public)/contact/ContactForm.jsx — FOUND rgba(194,65,12 on multiple lines

Commits confirmed:
- 4e660c5 — FOUND in git log
- 955c1b9 — FOUND in git log
- 8b036b1 — FOUND in git log

Build: PASSED (npm run build — no errors)

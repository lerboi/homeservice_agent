---
phase: 21-pricing-page-redesign
plan: 02
subsystem: public-site
tags: [pricing, ui, dark-theme, testimonials, faq, comparison-table, contact-form]
dependency_graph:
  requires: [21-01]
  provides: [comparison-table-growth-highlight, testimonial-section, dark-faq, contact-preselection]
  affects: [public-site-i18n]
tech_stack:
  added: []
  patterns: [growth-column-highlight, dark-accordion-treatment, testimonial-two-quote-layout, url-param-preselection]
key_files:
  created: []
  modified:
    - src/app/(public)/pricing/ComparisonTable.jsx
    - src/app/(public)/pricing/page.js
    - src/app/(public)/pricing/FAQSection.jsx
    - src/app/(public)/contact/ContactForm.jsx
    - src/app/(public)/contact/page.js
    - .claude/skills/public-site-i18n/SKILL.md
decisions:
  - "Growth column highlight uses conditional tier.id === 'growth' check — not tier.highlighted — to keep display logic independent of tier config"
  - "Testimonials placed inline in page.js (not separate component) per UI-SPEC instruction"
  - "ContactForm wrapped in Suspense in contact/page.js — required by Next.js for useSearchParams in client component from server page"
  - "FAQ dark styling converts all 3 color tokens: border-white/[0.08], text-white triggers, text-white/60 answers"
metrics:
  duration_seconds: 577
  completed_date: "2026-03-26"
  tasks_completed: 3
  files_modified: 6
---

# Phase 21 Plan 02: Comparison Table, Testimonials, Dark FAQ, Contact Pre-selection Summary

Growth column highlighted in orange (#F97316) in comparison table, two-quote testimonial section inserted between comparison and FAQ, FAQ converted to dark treatment with 8 questions, Enterprise CTA pre-selects sales inquiry on contact page via useSearchParams.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Update ComparisonTable with Growth column highlight | b090515 | src/app/(public)/pricing/ComparisonTable.jsx |
| 2 | Add testimonials, dark FAQ, contact form pre-selection | 7494b8e | pricing/page.js, FAQSection.jsx, contact/ContactForm.jsx, contact/page.js |
| 3 | Update public-site-i18n SKILL.md | 636f44e | .claude/skills/public-site-i18n/SKILL.md |
| 4 | Visual verification | — | Awaiting human verify at checkpoint |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added Suspense boundary to contact/page.js**
- **Found during:** Task 2 — implementing ContactForm useSearchParams
- **Issue:** Next.js requires a Suspense boundary around client components that use `useSearchParams()` when rendered inside a Server Component page. Without it, the build warns and the page may not behave correctly during SSR.
- **Fix:** Added `import { Suspense } from 'react'` to contact/page.js and wrapped `<ContactForm />` in `<Suspense fallback={null}>`
- **Files modified:** src/app/(public)/contact/page.js
- **Commit:** 7494b8e (bundled with Task 2)

## What Was Built

**ComparisonTable.jsx** — Growth column highlight:
- Growth `<th>` header: `text-[#F97316] font-semibold` (other tier headers keep `text-[#0F172A] font-semibold`)
- Growth `<td>` cells: `bg-[#FFF7ED]` light orange tint for vertical column highlight effect
- Checks `tier.id === 'growth'` and `tierId === 'growth'` for conditional styling
- Preserved: `overflow-x-auto` for mobile scroll, Check icon rendering, alternating row backgrounds, `min-w-[640px]`

**page.js** — Testimonials + dark FAQ:
- Added `AnimatedStagger, AnimatedItem` to AnimatedSection import
- Inserted testimonial section (`bg-[#1A1816] py-16`) between comparison and FAQ
- Two-quote layout with `AnimatedStagger` grid (md:grid-cols-2)
- Each testimonial card: `bg-white/[0.04] border border-white/[0.06] rounded-xl p-8`
- Mike R. (HVAC, Phoenix AZ) and Sandra T. (Plumbing, Austin TX) quotes
- FAQ section: changed from `bg-[#F5F5F4] border-t border-stone-200/60` to `bg-[#050505]`
- FAQ heading: changed from "Frequently Asked Questions" with `text-[#0F172A]` to "Questions from the field" with `text-white`

**FAQSection.jsx** — Dark accordion styling:
- Item border: `border-[#0F172A]/10` → `border-white/[0.08]`
- Trigger text: `text-[#0F172A]` → `text-white`
- Answer text: `text-[#475569]` → `text-white/60`
- Preserved: 8 FAQ items from Plan 21-01, ChevronDown with `text-[#F97316]`, accordion animations

**ContactForm.jsx** — URL param pre-selection:
- Added `import { useSearchParams } from 'next/navigation'`
- Reads `searchParams.get('type') || ''` as `preselectedType`
- Select `defaultValue` changed from `""` to `{preselectedType}`

**contact/page.js** — Suspense boundary:
- Added `import { Suspense } from 'react'`
- Wrapped `<ContactForm />` in `<Suspense fallback={null}>`

**SKILL.md** — Updated public-site-i18n skill:
- Updated "last updated" date and context
- Rewrote Section 7 to document 6-section page layout, volume-based tiers, Growth highlight, testimonials, dark FAQ
- Added ContactForm useSearchParams decision to Key Design Decisions

## Known Stubs

None — all data is wired from pricingData.js, testimonials use final copy per UI-SPEC verbatim, FAQ uses 8 questions from Plan 21-01.

## Self-Check: PASSED

Files verified present:
- src/app/(public)/pricing/ComparisonTable.jsx — FOUND
- src/app/(public)/pricing/page.js — FOUND
- src/app/(public)/pricing/FAQSection.jsx — FOUND
- src/app/(public)/contact/ContactForm.jsx — FOUND
- src/app/(public)/contact/page.js — FOUND
- .claude/skills/public-site-i18n/SKILL.md — FOUND

Commits verified:
- b090515 (Task 1) — FOUND
- 7494b8e (Task 2) — FOUND
- 636f44e (Task 3) — FOUND

Build: Pre-existing Turbopack error in instrumentation.js (onRequestError from @sentry/nextjs — not introduced by this plan, verified by git stash test). Plan changes are syntactically correct Next.js/JSX.

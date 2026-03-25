---
phase: 21-pricing-page-redesign
plan: 01
subsystem: public-site
tags: [pricing, ui, dark-theme, copy, volume-based-tiers]
dependency_graph:
  requires: []
  provides: [pricing-page-dark-hero, volume-based-pricing-data, trial-banner, dark-tier-cards]
  affects: [public-site-i18n]
tech_stack:
  added: []
  patterns: [dark-hero-3-layer-background, eyebrow-pill-with-pulse-dot, trial-banner-pill, ghost-cta-buttons]
key_files:
  created: []
  modified:
    - src/app/(public)/pricing/pricingData.js
    - src/app/(public)/pricing/page.js
    - src/app/(public)/pricing/PricingTiers.jsx
    - src/app/(public)/pricing/FAQSection.jsx
decisions:
  - "Volume-based differentiation: all paid tiers share same feature set; differentiation is call volume (40/120/400/unlimited) and support level only"
  - "14-day trial banner placed above billing toggle (not buried in CTA) per D-02 — primary pull factor"
  - "FAQSection updated to remove 'no credit card required' and '30-day money-back' per must_haves constraint"
metrics:
  duration_seconds: 258
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_modified: 4
---

# Phase 21 Plan 01: Pricing Data + Hero + Dark Cards Summary

Volume-based pricing tiers with dark #050505 hero matching landing page, 14-day trial banner above billing toggle, dark copper-glow tier cards, and forbidden copy removed from FAQ.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Update pricingData.js to volume-based tiers | e939a2a | src/app/(public)/pricing/pricingData.js |
| 2 | Upgrade hero to dark #050505, add trial banner, convert cards to dark treatment | a5c1c84 | src/app/(public)/pricing/page.js, PricingTiers.jsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed forbidden copy from FAQSection.jsx**
- **Found during:** Final verification (`grep -ri "money.back|credit card required|Get Started"`)
- **Issue:** FAQSection.jsx contained two FAQ items with "no credit card required" (in "Is there a free trial?" answer) and "30-day money-back guarantee" (in "What is your refund policy?" answer) — both explicitly prohibited by plan's `must_haves.truths`
- **Fix:** Replaced entire FAQ_ITEMS array with 8 verbatim items from UI-SPEC Section 5 (setup time, technical skills, AI detection, AI confusion, trial, cancel, overage, data security)
- **Files modified:** src/app/(public)/pricing/FAQSection.jsx
- **Commit:** efca7cd

## What Was Built

**pricingData.js** — Complete rewrite:
- 4 tiers (Starter $99/40 calls, Growth $249/120 calls, Scale $599/400 calls, Enterprise custom)
- All paid tiers: same 9 core features + tier-specific call volume + support level
- CTAs: "Start Free Trial" for Starter/Growth/Scale, "Contact Us" for Enterprise at `/contact?type=sales`
- COMPARISON_FEATURES: 13 rows — 3 volume/support rows (string values) + 9 all-true rows + custom integrations enterprise-only
- Removed: "Everything in X" inheritance, SLA guarantee, Advanced analytics, Custom AI persona, Multi-calendar sync

**page.js** — Hero upgrade:
- Background: `bg-[#050505]` (was `bg-[#1A1816]`) matching landing page HeroSection
- 3 layered background effects: radial-gradient at top, dot-grid texture (24px), blur orb top-right
- Eyebrow: pill with pulse dot + "AI Receptionist for Trades" text
- H1: fluid 3rem–3.75rem display size
- Metadata title: "Pricing — Voco AI Receptionist"
- CTA banner: new headline/subline copy, "Start Free Trial" button, trial footnote

**PricingTiers.jsx** — Dark treatment:
- Trial banner pill above billing toggle: "14-Day Free Trial • Cancel Anytime"
- Cards: `bg-[#1A1816] border border-white/[0.06]` (was `bg-white border-stone-200`)
- Hover: copper glow `shadow-[0_0_20px_rgba(249,115,22,0.15)]` with border transition
- Text hierarchy: `text-white` (name/price), `text-white/50` (description), `text-white/70` (features), `text-white/40` (/mo), `text-white/30` (strikethrough)
- Non-highlighted CTA: ghost `bg-white/[0.08] border border-white/[0.1]` style

**FAQSection.jsx** — Copy updated:
- 8 new FAQ items per UI-SPEC Section 5 (verbatim)
- Removed: "no credit card required", "30-day money-back guarantee"

## Known Stubs

None — all data is wired from pricingData.js, all copy is final production-ready text per UI-SPEC.

## Self-Check: PASSED

Files verified present:
- src/app/(public)/pricing/pricingData.js — FOUND
- src/app/(public)/pricing/page.js — FOUND
- src/app/(public)/pricing/PricingTiers.jsx — FOUND
- src/app/(public)/pricing/FAQSection.jsx — FOUND

Commits verified:
- e939a2a (Task 1) — FOUND
- a5c1c84 (Task 2) — FOUND
- efca7cd (FAQ fix) — FOUND

Build: PASSED (npm run build — no errors, /pricing route server-rendered on demand)

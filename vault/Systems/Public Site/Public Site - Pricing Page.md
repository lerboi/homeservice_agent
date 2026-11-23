---
type: system
system: Public Site
status: pending-rebuild
description: "Pricing Page. Covers: Page Section Layout; `pricingData.js` — Tier Data Structure; `PricingTiers.jsx`; `ROICalculator.jsx`; `ComparisonTable.jsx`; Testimonials (inline in page.js); Trust Strip (inside PricingTiers.jsx, not page.js); `FAQSection.jsx`"
source: .claude/skills/public-site-i18n/SKILL.md § 7. Pricing Page
migrated: 2026-11-23
verified:
tags: [voco/system/public-site]
---

# Pricing Page

Part of [[Public Site]]. Migrated verbatim from the `public-site-i18n` skill; check `verified` before trusting details.

**File**: `src/app/(public)/pricing/page.js`

**Last updated**: 2026-06-20 (Top-of-page conversion/declutter pass. **PricingTiers**: card header regrouped into 4 chunks — name+description subtitle, price block with the strikethrough INLINE beside the price (not its own row), a single quiet `Billed $X/yr` annual line (the duplicate "· save $Y/yr" dropped — the toggle's "Save 20%" already states the discount), and the call allotment PROMOTED from a small pill to a hero line (`{N} calls included / mo` in orange + `then $X/call after`). The old "2 AM" social-proof paragraph between the toggle and cards was **removed**; the 3 per-card "14-day free trial" lines, the standalone short-call note, AND the Risk-Free Guarantee (previously a separate block in page.js below Enterprise) are **consolidated into ONE high-contrast trust strip** directly under the 3-card grid (ShieldCheck + money-back promise + "no contracts, cancel anytime · calls under 20s never counted"). Recommended-card emptiness fixed: Starter trimmed 8→5 hero features and Growth/Scale now append 2 **dimmed** inherited reminders (`FOUNDATION_FEATURES`, computed from the base tier) so the Most-Popular card no longer looks the emptiest. Contrast floor raised (no meaningful text below white/50; min 12px). Toggle/CTA tap targets 40/42px→44px; toggle wrapper mb-5→mb-8, grid gap-5→gap-6. **page.js**: subline collapsed to one line (`Voco answers 24/7 and books the job — one call you'd have missed covers the whole year.`, white/50→white/60, `md:text-lg leading-relaxed`); the `AI Receptionist for Trades` eyebrow pill was **removed entirely**; hero spacing opened up for a cleaner feel, with a proportionate title↔toggle↔cards rhythm (`pt-28 pb-16`, hero block `mb-12`=48px title↔toggle, subline `mt-5`, toggle `mb-14`=56px below (extra room so it clears the floating Most-Popular badge that pokes ~12px into the gap), grid `lg:gap-7`, card header chunks `mt-4`, feature rows `space-y-3`, trust strip `mt-12`); guarantee block + its `ShieldCheck` import removed; bottom CTA relabeled "Start Free Trial"→"See Plans & Start Free". **pricingData**: Starter "Lead capture, CRM & analytics"→"Lead capture & CRM" (Analytics was removed from the product, commit b7df95c — the comparison table already omitted it); Growth/Scale call-volume deltas trimmed of the redundant "— N calls/mo" now that the header carries the allotment. NOTE: analytics still leaks in `landing/FeaturesGrid.jsx` ("Call Analytics & Dashboard" card) and chatbot knowledge docs (`pricing.md`, `features.md`) — tracked follow-up, not yet fixed. Previous: 2026-03-27 (Conversion optimization: 3-col additive cards, separate Enterprise, ROI calculator, guarantee badge, 3 testimonials, overage rates, 9 FAQs))

Eight sections in order: dark hero + cards + guarantee badge (`#050505`) → ROI calculator (warm stone `#EDEAE7` with gradient blend to next section) → comparison table (light `#F5F5F4`) → testimonials (dark `#1A1816`) → FAQ (dark `#050505`) → CTA banner (dark warm `#1C1412`).

### Page Section Layout

| # | Section | Background | Notes |
|---|---------|-----------|-------|
| 1 | Hero | `bg-[#050505]` | H1 + one subline only (no eyebrow pill — removed 2026-06-20). Airier rhythm: `pt-28 pb-16`, hero block `mb-12` (title↔toggle 48px), subline `mt-5 md:text-lg leading-relaxed` |
| 2 | Billing Toggle + 3 Tier Cards | `bg-[#050505]` (continues) | 3-col grid (Starter/Growth/Scale); no social-proof line; trust strip + Enterprise below (all inside PricingTiers.jsx) |
| 3 | Trust Strip | `bg-[#050505]` (continues) | ShieldCheck + money-back guarantee + trial/cancel/short-call — under the card grid, inside PricingTiers (was a separate guarantee block in page.js) |
| 4 | ROI Calculator | `bg-[#EDEAE7]` | Warm stone bg, bottom gradient blending into comparison table |
| 5 | Comparison Table | `bg-[#F5F5F4]` | Always visible (not collapsible), 14 feature rows incl. overage rate |
| 6 | Testimonials | `bg-[#1A1816]` | Three quotes in `md:grid-cols-3` |
| 7 | FAQ | `bg-[#050505]` | 9 questions — includes mid-cycle upgrade proration |
| 8 | CTA Banner | `bg-[#1C1412]` | CTA links to `/pricing` |

### `pricingData.js` — Tier Data Structure

**Additive feature pattern**: Starter lists 5 hero features. Growth/Scale use `inheritsFrom` to show "Everything in X, plus:" with their 3 differentiators, then 2 dimmed inherited reminders (see PricingTiers). Enterprise is a separate export.

```js
export const PRICING_TIERS = [
  { id: 'starter', name: 'Starter', monthlyPrice: 99, callLimit: 40, overageRate: 2.48, inheritsFrom: null, features: [8 core features], ... },
  { id: 'growth',  name: 'Growth',  monthlyPrice: 249, callLimit: 120, overageRate: 2.08, inheritsFrom: 'Starter', badge: 'Most Popular', highlighted: true, features: ['3× the call volume — 120 calls/mo', 'Lower overage rate ($2.08/call)', 'Priority email support'], ... },
  { id: 'scale',   name: 'Scale',   monthlyPrice: 599, callLimit: 400, overageRate: 1.50, inheritsFrom: 'Growth', features: ['10× the call volume — 400 calls/mo', 'Lowest overage rate ($1.50/call)', 'Priority support + onboarding call'], ... },
];

export const ENTERPRISE_TIER = {
  id: 'enterprise', name: 'Enterprise', monthlyPrice: null, callLimit: null,
  cta: 'Contact Us', ctaHref: '/contact?type=sales',
  features: ['Unlimited calls', 'Dedicated account manager', 'Custom integrations', 'Custom SLAs & onboarding'],
};

export function getAnnualPrice(monthlyPrice) { return Math.round(monthlyPrice * 0.8); } // 20% discount

export const COMPARISON_FEATURES = [ ... ]; // 14 rows — calls, overage rate, support level, 9 boolean features, custom integrations
```

**Starter features** (trimmed to 5 hero features in the 2026-06-20 pass; the rest live in the comparison table): AI receptionist answering 24/7, Urgency triage & emergency SMS alerts, Books appointments on the spot, Google & Outlook Calendar sync, Lead capture & CRM. (Analytics, Invoicing & estimates, Recovery SMS, and Multi-language were dropped from the card — Analytics no longer ships; the others remain comparison-table rows.) `FOUNDATION_FEATURES = base tier features.slice(0,2)` are re-shown as dimmed checks on Growth/Scale.

**Overage rates**: Starter $2.48/call, Growth $2.08/call, Scale $1.50/call. Displayed on cards and in comparison table.

**CTA routing**: Tier cards → `/onboarding?plan={id}&interval={billing}`. Enterprise → `/contact?type=sales`. Bottom CTA banner → `/pricing`.

### `PricingTiers.jsx`

`'use client'` (billing toggle state). Monthly/annual toggle defaults to annual. **3-column grid** (`lg:grid-cols-3`) with `items-stretch` for equal-height cards.

**No social-proof line above the cards** (the old "2 AM" paragraph was removed — it was the main congestion driver). Toggle wrapper `mb-14` (clears the floating Most-Popular badge), grid `gap-6 lg:gap-7`.

**Growth card elevation**: `lg:scale-[1.04] lg:z-10`, gradient bg `from-[#F97316]/[0.06] to-[#1A1816]`, `ring-2 ring-[#F97316]`. Renders first on mobile via `order-first`.

**Card header — 4 chunks**: (1) name + `tier.description` subtitle; (2) price block `$79 /mo` with `$99` strikethrough inline; (3) `Billed $X/yr` (annual only); (4) call-allotment hero line `{callLimit} calls included / mo` (orange) + `then $X.XX/call after`. The old standalone call-limit pill is gone.

**Additive feature rendering**: Starter renders its 5 hero features (orange checks). Growth/Scale render "Everything in {inheritsFrom}, plus:" + their 3 deltas (orange checks) + `FOUNDATION_FEATURES` as 2 dimmed checks (`text-white/45`, `Check` `text-white/30`) so heights balance.

**CTA at bottom**: Button pinned to card bottom via `flex-1` on feature list. No per-card trial line (consolidated into the trust strip below).

**Trust strip**: `AnimatedSection` directly under the 3-card grid (before Enterprise). ShieldCheck + "Risk-free: try Voco free for 14 days. If it doesn't book you a job, you pay nothing." + "No contracts, cancel anytime · Calls under 20 seconds are never counted — you only pay for real conversations." This replaced the separate guarantee block that used to live in page.js.

**Enterprise section**: Full-width horizontal card below the 3-col grid (`mt-10`). Building2 icon, 2x2 feature grid, "Custom" price, ghost "Contact Us" button.

### `ROICalculator.jsx`

`'use client'`. Interactive "What Are Missed Calls Costing You?" widget on warm stone `#EDEAE7` background with light-mode styling.

**Inputs**: Missed calls/week slider (1-20, default 5) + average job value selector (6 options: $250-$2,000+, default $750). **Calculation**: `missedCalls × 4 weeks × 30% conversion × avgJobValue`.

**Results**: Monthly loss (red), yearly loss (red), "Voco starts at $79/mo" (orange). Desktop: horizontal flex with dividers. Mobile: stacked vertically.

**Light-mode colors**: White card with `border-stone-200/60 shadow-sm`. Text: `#0F172A`, `#334155`, `#64748B`, `#94A3B8`. Slider/buttons: stone-100/200 inactive, orange active.

### `ComparisonTable.jsx`

Server Component. Always-visible table comparing 14 `COMPARISON_FEATURES` across all 4 tiers (combines `PRICING_TIERS` + `ENTERPRISE_TIER` as `ALL_TIERS`). Heading: "Compare All Features".

**Growth column highlight**: Growth header `text-[#F97316]`, Growth cells `bg-[#FFF7ED]`. Cell rendering unchanged from prior version.

### Testimonials (inline in page.js)

Dark section `bg-[#1A1816] py-16`. **Three quotes** in `md:grid-cols-3` grid (`max-w-5xl`). Each card: `bg-white/[0.04] border border-white/[0.06] rounded-xl p-7 h-full flex flex-col`. Quote text: `text-lg` (smaller than before to fit 3 columns).

Quotes (verbatim):
- "Before Voco, I was losing 3-4 calls every weekend. Now my phone's booked Monday before I've had coffee." — Mike R., HVAC contractor, Phoenix AZ
- "Setup took 4 minutes. I heard my AI answer a call with my business name before I even finished my first cup." — Sandra T., Plumbing company owner, Austin TX
- "One emergency booking at 2 AM paid for three months of Voco. I don't know why I waited so long." — Carlos M., Electrician, Miami FL

### Trust Strip (inside PricingTiers.jsx, not page.js)

Replaced the old standalone "Guarantee Badge" block (which used to live inline in page.js below Enterprise). Now an `AnimatedSection` rendered directly under the 3-card grid so risk-reversal sits at the decision point. ShieldCheck in an orange circle + bold money-back line + a quieter reassurance line (no contracts / cancel anytime / short-call protection). Responsive `flex-col sm:flex-row`. See the PricingTiers.jsx notes above.

### `FAQSection.jsx`

`'use client'` (Radix accordion). **9 questions** in 4 topic areas: setup (Q1-Q2), AI quality (Q3-Q4), trial/billing (Q5-Q8 — includes "What happens if I upgrade mid-cycle?" with proration explanation), data/security (Q9).

Dark accordion styling unchanged. Smooth height transition via Radix CSS variable.

---

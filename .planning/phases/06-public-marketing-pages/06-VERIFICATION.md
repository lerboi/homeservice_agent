---
phase: 06-public-marketing-pages
verified: 2026-03-22T15:00:00Z
status: human_needed
score: 13/13 truths verified
re_verification: true
previous_status: gaps_found
previous_score: 11/13
gaps_closed:
  - "FAQ accordion open/close height animation works smoothly"
  - "Pricing page HTML is valid with one main landmark per document"
gaps_remaining: []
regressions: []
human_verification:
  - test: "Visit /pricing and toggle Monthly/Annual billing"
    expected: "Displayed prices update immediately without page reload; Growth annual shows $199 with $249 strikethrough; Starter shows $79; Scale shows $479; Enterprise shows Custom unchanged"
    why_human: "useState toggle behavior and DOM price update cannot be verified statically"
  - test: "Open FAQ on /pricing and click each item"
    expected: "Accordion items expand and collapse with smooth height animation (height transition via --radix-accordion-content-height CSS variable). Content must appear and disappear correctly."
    why_human: "Radix accordion interaction and CSS animation require browser rendering"
  - test: "Tap the mobile hamburger on any public page"
    expected: "Drawer slides in from the right at 280px width; all 5 links are visible; CTA pinned at bottom; closing via backdrop works; body scroll locks while open"
    why_human: "AnimatePresence animation and body scroll lock require browser"
  - test: "Submit contact form with valid data"
    expected: "Success toast appears saying 'Message sent. We'll reply within 24 hours.' Form resets. No double submission on rapid click."
    why_human: "Resend integration, toast display, and form reset behavior require live environment"
  - test: "Click 'How it works' in the nav from /pricing"
    expected: "Browser navigates to /#how-it-works on the root page, scrolled to the How It Works section"
    why_human: "Client-side routing and scroll behavior require browser"
---

# Phase 6: Public Marketing Pages Verification Report

**Phase Goal:** Prospective customers can learn about the product, understand pricing relative to their own call volume, and contact the team — all from a polished public site that reflects a real product, not a placeholder
**Verified:** 2026-03-22T15:00:00Z
**Status:** human_needed — all automated checks pass; 5 items need browser confirmation
**Re-verification:** Yes — after gap closure in plan 06-04

## Re-verification Summary

| Item | Previous | Now | Change |
|------|----------|-----|--------|
| Score | 11/13 | 13/13 | +2 gaps closed |
| Gap 1: Accordion animation keyframes | FAILED | VERIFIED | commit 7ebe35f |
| Gap 2: Nested main landmark | FAILED | VERIFIED | commit e96e86e |
| Regressions | — | None | All 15 tests still pass |

Both gaps from the initial verification are confirmed closed by direct file inspection and commit verification.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | All public pages share a single nav and footer via (public) layout | VERIFIED | `src/app/(public)/layout.js` — imports LandingNav + LandingFooter + Toaster; one `<main>` wrapper |
| 2 | Nav shows Pricing, About, Contact links alongside How it works and Features | VERIFIED | `LandingNav.jsx` lines 88-96 — explicit `<Link href="/pricing">`, `<Link href="/about">`, `<Link href="/contact">` in hidden md:flex block |
| 3 | Mobile hamburger opens a full-height drawer with all nav links and CTA pinned at bottom | VERIFIED (needs human) | `LandingNav.jsx` — AnimatePresence drawer, 5 links in flex-col, CTA in bottom p-6 border-t panel |
| 4 | Footer displays three-column layout (Product, Company, Legal) on all public pages | VERIFIED | `LandingFooter.jsx` — `grid grid-cols-2 md:grid-cols-3` with Product/Company/Legal columns, tagline, copyright |
| 5 | Anchor links work correctly from sub-pages by prefixing / | VERIFIED | `LandingNav.jsx` — `isRoot` pattern: root uses `href="#hash"`, sub-pages use `href="/#hash"` |
| 6 | Pricing data constants exist as single source of truth | VERIFIED | `pricingData.js` exports PRICING_TIERS (4 tiers), COMPARISON_FEATURES (14 rows), getAnnualPrice(); 7 tests confirm math |
| 7 | Visitor sees 4 pricing tier cards on /pricing | VERIFIED | `PricingTiers.jsx` maps over PRICING_TIERS (Starter $99, Growth $249, Scale $599, Enterprise custom) |
| 8 | Growth tier has "Most Popular" badge and Heritage Copper ring highlight | VERIFIED | `PricingTiers.jsx` — `ring-2 ring-[#C2410C]`, `<Badge className="bg-[#C2410C]">Most Popular</Badge>` |
| 9 | Monthly/Annual toggle updates prices without page reload | VERIFIED (needs human) | `PricingTiers.jsx` — `useState('monthly')`, `getAnnualPrice()` called per-render, strikethrough on annual |
| 10 | Feature comparison table shows features as rows, tiers as columns, with sticky header | VERIFIED | `ComparisonTable.jsx` — `<thead className="sticky top-16 z-10">`, `scope="col"` and `scope="row"`, `min-w-[640px]` |
| 11 | FAQ accordion expands and collapses with smooth height animation | VERIFIED | `globals.css` lines 48-72 — `--animate-accordion-down: accordion-down 200ms ease-out`, `@keyframes accordion-down` with `height: var(--radix-accordion-content-height)` in `to` frame; `@keyframes accordion-up` with matching reverse. `FAQSection.jsx` line 39 uses `data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up`. Commit 7ebe35f. |
| 12 | Pricing page HTML has exactly one main landmark per document | VERIFIED | `pricing/page.js` line 15 opens `<>` and line 80 closes `</>` — React fragment, no `<main>`. `(public)/layout.js` provides the sole `<main>`. `about/page.js` and `contact/page.js` also use fragments. `grep -c "<main>" src/app/(public)/pricing/page.js` returns 0. Commit e96e86e. |
| 13 | Contact form submission delivers email via Resend and shows SLA | VERIFIED (needs human for live delivery) | `route.js` — INQUIRY_ADDRESSES map, `resend.emails.send()`, honeypot gate; `contact/page.js` line 23 shows "We respond within 24 hours"; 8 contact-api tests pass |

**Score:** 13/13 — all automated truths verified; 5 require browser confirmation

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/(public)/layout.js` | Public route group layout with LandingNav + LandingFooter + Toaster + single main | VERIFIED | Confirmed unchanged; 1 `<main>`, correct imports |
| `src/app/(public)/pricing/page.js` | Pricing page using React fragment, no nested main | VERIFIED | Line 15: `<>`, line 80: `</>`. `grep -c "<main>"` returns 0. Commit e96e86e. |
| `src/app/globals.css` | Accordion keyframes and Tailwind v4 animate utilities registered | VERIFIED | Lines 48-49: `--animate-accordion-down/up` in `@theme inline`; lines 52-72: `@keyframes accordion-down` and `@keyframes accordion-up` with `var(--radix-accordion-content-height)`. Commit 7ebe35f. |
| `src/app/(public)/pricing/FAQSection.jsx` | Accordion FAQ with 4 items using animate-accordion-* classes | VERIFIED | Line 39: `data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up`; keyframes now defined |
| `src/app/(public)/pricing/pricingData.js` | Pricing tier constants and comparison data | VERIFIED | Unchanged — PRICING_TIERS (4), COMPARISON_FEATURES (14 rows), getAnnualPrice |
| `src/app/(public)/pricing/PricingTiers.jsx` | Client component with billing toggle | VERIFIED | Unchanged — 'use client', useState, imports pricingData |
| `src/app/(public)/pricing/ComparisonTable.jsx` | Feature comparison table with sticky header | VERIFIED | Unchanged — sticky top-16, scope attrs |
| `src/app/(public)/about/page.js` | About page with mission and values | VERIFIED | Unchanged — uses fragment, no main |
| `src/app/(public)/contact/page.js` | Contact page with hero and form | VERIFIED | Unchanged — uses fragment, no main |
| `src/app/(public)/contact/ContactForm.jsx` | Client form with validation and honeypot | VERIFIED | Unchanged |
| `src/app/api/contact/route.js` | POST handler dispatching to Resend by inquiry type | VERIFIED | Unchanged |
| `src/app/components/landing/LandingNav.jsx` | Extended nav with 5 links + mobile drawer | VERIFIED | Unchanged |
| `src/app/components/landing/LandingFooter.jsx` | Multi-column footer | VERIFIED | Unchanged |
| `tests/pricing/pricing-calc.test.js` | 7 tests, all GREEN | VERIFIED | 7/7 pass — confirmed in re-verification run |
| `tests/contact/contact-api.test.js` | 8 tests, all GREEN | VERIFIED | 8/8 pass — confirmed in re-verification run |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `FAQSection.jsx` | `globals.css` | `animate-accordion-down` / `animate-accordion-up` Tailwind utilities | WIRED | Classes on line 39 of FAQSection.jsx; keyframes defined in globals.css lines 52-72; `--animate-*` registration in `@theme inline` lines 48-49 |
| `(public)/layout.js` | `pricing/page.js` | `{children}` inside layout's `<main>` | WIRED | layout.js line 9: `<main>{children}</main>`; pricing/page.js returns fragment — exactly one main rendered |
| `(public)/layout.js` | `LandingNav.jsx` | import | WIRED | Line 1 — unchanged |
| `(public)/layout.js` | `LandingFooter.jsx` | import | WIRED | Line 2 — unchanged |
| `PricingTiers.jsx` | `pricingData.js` | import PRICING_TIERS, getAnnualPrice | WIRED | Unchanged |
| `ComparisonTable.jsx` | `pricingData.js` | import COMPARISON_FEATURES | WIRED | Unchanged |
| `ContactForm.jsx` | `/api/contact` | fetch POST | WIRED | Unchanged |
| `route.js` | `resend` | Resend emails.send() | WIRED | Unchanged |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| PRICE-01 | 06-02 | 4 pricing tiers with clear feature breakdown | SATISFIED | PricingTiers renders Starter/Growth/Scale/Enterprise |
| PRICE-02 | 06-02 | Growth tier highlighted with "Most Popular" badge | SATISFIED | `ring-2 ring-[#C2410C]`, `<Badge>Most Popular</Badge>` |
| PRICE-03 | 06-01, 06-02 | Monthly/Annual toggle (display-only) | SATISFIED | useState billing toggle, getAnnualPrice() per render |
| PRICE-04 | 06-02 | Feature comparison table | SATISFIED | ComparisonTable.jsx — 14-row matrix, sticky header, scope attrs |
| PRICE-05 | 06-02 | FAQ addressing cancellation, overages, trial, refunds | SATISFIED | FAQSection.jsx — 4 items; accordion animation now defined in globals.css |
| PRICE-06 | 06-02 | ROI-framed hero copy | SATISFIED | "Stop Losing $1,000 Jobs to Voicemail" / "Every tier pays for itself after one booked job" |
| PRICE-07 | 06-02 | Each tier CTA routes to onboarding wizard | SATISFIED | Starter/Growth/Scale ctaHref='/onboarding'; Enterprise ctaHref='/contact' |
| PAGE-01 | 06-01 | Navigate to Pricing/About/Contact from any public page | SATISFIED | LandingNav has all 3 links on desktop + mobile drawer; LandingFooter has all 3 links |
| PAGE-02 | 06-03 | About page with mission + founding story | SATISFIED | about/page.js — hero, Our Mission, 3 core values |
| PAGE-03 | 06-03 | Contact form with segmented inquiry routes | SATISFIED | ContactForm.jsx select: sales/support/partnerships; route.js INQUIRY_ADDRESSES map |
| PAGE-04 | 06-03 | Contact submissions delivered via Resend with spam protection | SATISFIED | route.js — Resend.emails.send(), honeypot gate |
| PAGE-05 | 06-03 | Contact page displays response time SLA | SATISFIED | contact/page.js — "We respond within 24 hours" in Heritage Copper |

All 12 requirement IDs satisfied. No orphaned requirements.

---

### Anti-Patterns Found

None. Both previously-flagged anti-patterns are resolved:

- `animate-accordion-*` references in FAQSection.jsx now have matching keyframes in globals.css (was: Warning)
- `<main>` wrapper in pricing/page.js replaced with React fragment (was: Blocker)

---

### Human Verification Required

#### 1. Billing Toggle

**Test:** Open /pricing in a browser. Click "Annual" toggle.
**Expected:** All 3 paid tier prices update immediately (Starter: $79, Growth: $199, Scale: $479). Strikethrough shows original price. Enterprise shows "Custom" unchanged.
**Why human:** useState reactive price update requires browser rendering.

#### 2. FAQ Accordion Animation

**Test:** Open /pricing and click each FAQ item.
**Expected:** Content expands and collapses with a smooth height animation — not an abrupt show/hide. The height transitions from 0 to the content height (via `--radix-accordion-content-height`) over 200ms ease-out. All 4 answers must appear and disappear correctly.
**Why human:** Radix accordion state machine and CSS animation require browser rendering to confirm the keyframes resolve correctly.

#### 3. Mobile Navigation Drawer

**Test:** Open any public page on mobile viewport. Tap hamburger.
**Expected:** Drawer slides in from right. All 5 links visible. CTA at bottom. Body scroll locked. Closing via backdrop or X button works. On route change (tap a link), drawer closes automatically.
**Why human:** Framer Motion AnimatePresence and body scroll lock require browser.

#### 4. Contact Form Submission

**Test:** Submit contact form at /contact with valid name, email (sales inquiry), and message.
**Expected:** Loading spinner appears on button. On success: toast shows "Message sent. We'll reply within 24 hours." Form resets. Requires CONTACT_EMAIL_SALES to be configured.
**Why human:** Resend live API call, toast rendering, form reset behavior.

#### 5. Anchor Link Navigation from Sub-Pages

**Test:** Navigate to /pricing. Click "How it works" in the nav.
**Expected:** Browser navigates to `/#how-it-works` (root page, scrolled to the How It Works section).
**Why human:** Client-side routing and scroll behavior require browser.

---

## Gaps Summary

No gaps remain. Both gaps from the initial verification are closed:

**Gap 1 — Accordion animation keyframes (closed in commit 7ebe35f):** `globals.css` now defines `--animate-accordion-down: accordion-down 200ms ease-out` and `--animate-accordion-up: accordion-up 200ms ease-out` inside the `@theme inline` block, plus the corresponding `@keyframes` blocks using `var(--radix-accordion-content-height)` for smooth Radix-driven height transitions. FAQSection.jsx required no changes.

**Gap 2 — Nested main landmark (closed in commit e96e86e):** `pricing/page.js` now opens with `<>` and closes with `</>`. The sole `<main>` in the document is the one provided by `(public)/layout.js`. All three public pages (pricing, about, contact) now correctly use React fragments.

Phase goal is fully achieved at the code level. Remaining items are browser-only confirmations of interactive behavior.

---

_Verified: 2026-03-22T15:00:00Z_
_Verifier: Claude (gsd-verifier)_

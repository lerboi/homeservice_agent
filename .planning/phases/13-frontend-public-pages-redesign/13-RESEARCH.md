# Phase 13: Frontend Public Pages Redesign - Research

**Researched:** 2026-03-25
**Domain:** Next.js 16 / Tailwind v4 / Framer Motion v12 — Premium Dark SaaS redesign of public pages
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Dark SaaS Palette — Dark Evolution**
- D-01: 70% dark surfaces, 30% warm brand accents. Heritage Copper stays as the accent/CTA color. Surfaces shift darker overall — premium tech-forward feel without losing the trade identity.
- D-02: Primary surface: #0F172A (Midnight Slate). Secondary surface: #1E293B (Dark charcoal). Accent: #C2410C (Heritage Copper). Light text: #F1F5F9 (Slate 50). Muted text: #94A3B8 (Slate 400).
- D-03: One Soft Stone (#F5F5F4) "breath" section per page to prevent dark fatigue and highlight key content.
- D-04: Cards on dark backgrounds: subtle copper/warm border glow on hover — not cold white.

**Card Hover Treatment**
- D-05: Rest state: bg #1E293B, border 1px solid rgba(255,255,255,0.06), no shadow.
- D-06: Hover state: border 1px solid rgba(194,65,12,0.4), box-shadow 0 0 20px rgba(194,65,12,0.15), transform translateY(-2px). Warm amber glow, on-brand.

**Navigation — Polish + Transparency**
- D-07: Keep current layout (logo left, nav links + CTA right, hamburger mobile). No structural change.
- D-08: Transparent at top of page with subtle backdrop-filter blur(12px) and thin border. Solid dark (#0F172A) on scroll. (Backdrop-blur allowed on nav — small surface, perf constraint is for large surfaces only.)
- D-09: Active link: copper underline accent. Mobile drawer: dark background, copper accent CTA.

**Footer — Polish Existing**
- D-10: Keep 3-column layout (Product | Company | Legal). No structural change.
- D-11: Top border: thin copper gradient line (transparent → copper → transparent) as visual separator.
- D-12: Link hover: copper color transition. Logo slightly larger with copper accent. Better vertical spacing and alignment.

**Pricing Page — Full Dark with Stone Break**
- D-13: Dark hero + headline (#0F172A). Tier cards on dark (#1E293B cards) with copper glow hover. "Most Popular" badge in copper. Monthly/Annual toggle with copper active state.
- D-14: Comparison table gets the stone (#F5F5F4) breath section — dark text, clear readability, alternating row tint for scanning.
- D-15: FAQ accordion on dark (#0F172A) with copper accent on expand icon. Copper gradient CTA banner at bottom.

**About Page — Same Dark Treatment**
- D-16: Dark hero (#0F172A) with mission headline. Stone section for values/principles (#F5F5F4). Dark closing statement + CTA.

**Contact Page — Same Dark Treatment**
- D-17: Dark hero (#0F172A) with headline. Dark form section (#1E293B card) with light-bordered inputs, copper submit button, copper glow on focus states. Response time SLA text.

**Home Page Section Flow (Updated)**
- D-18: Dark hero (#0F172A) → Dark charcoal HIW (#1E293B) → Warm stone Features (#F5F5F4) → Dark Social Proof (#0F172A) → Copper gradient CTA (#C2410C).

**Animation Style — Confident & Subtle**
- D-19: Scroll reveals: fade-up on enter (existing AnimatedSection pattern), 200ms duration, ease-out, stagger children 50ms apart.
- D-20: Hover transitions: copper glow 300ms ease, card lift translateY(-2px) 200ms, link underline scaleX 200ms.
- D-21: Hero: keep existing Spline 3D cursor-reactive + RotatingText. No new hero animations.
- D-22: No page transitions (Next.js app router default). Philosophy: if you notice the animation, it's too much.
- D-23: All animations must be transform/opacity-only. No backdrop-blur on large surfaces (nav is the only exception — small surface).

**Mobile Fallback Strategy — Static Replacements**
- D-24: Spline 3D scene → gradient + icon on mobile (already decided Phase 11 D-07).
- D-25: Bento grid 6-col → single column stacked cards (full-width, no grid complexity).
- D-26: HowItWorksTabs → vertical accordion or simple stacked steps.
- D-27: AnimatedSection → fade-only (no slide) or skip animation entirely on mobile.
- D-28: Comparison table → card-per-tier on mobile (already decided Phase 06).
- D-29: Breakpoint: md (768px) as the swap point for all mobile fallbacks.

**Auth Page — Differentiated Signup vs Signin**
- D-30: Signup and signin are visually distinct experiences, not just a tab toggle on the same card.
- D-31: Signup (new user): Full split layout — lighter form card (#334155) on the left with welcoming headline, Google OAuth prominent, email+password form. Dark right panel with selling points, social proof, and brand storytelling (existing content). Feels like an invitation: "welcome, here's why."
- D-32: Signin (returning user): Compact centered card on dark background — no split layout, no selling points. Just logo, email, password, submit. Feels like a quick doorway: "welcome back, get in."
- D-33: Toggle between modes via text link at bottom of each view: "Already have an account? Sign in" / "Don't have an account? Get started" — not a tab switcher.
- D-34: Both views use dark SaaS palette: dark page background (#0F172A), copper submit buttons, copper focus glow on inputs.
- D-35: OTP verification screen follows the dark treatment — dark background, dark card, copper accents.
- D-36: All existing auth functionality preserved (Google OAuth, email+password, OTP verification, cooldown timer, error handling). No new auth methods.

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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| D-01 | 70% dark surfaces, 30% warm brand accents — Heritage Copper accent | Token additions to globals.css: `--color-landing-charcoal`, `--color-landing-light-text`, `--color-landing-muted-text` |
| D-02 | Color palette: #0F172A / #1E293B / #C2410C / #F1F5F9 / #94A3B8 | All new tokens map to exact hex; add to `@theme inline` block and `:root` |
| D-03 | One stone (#F5F5F4) breath section per page | Existing `--color-landing-surface` token covers this — no new token needed |
| D-04–D-06 | Card hover: copper glow with translateY(-2px) | Pure Tailwind + CSS transition, no JS required |
| D-07–D-09 | Nav: transparent → solid on scroll, active link copper underline | LandingNav already has scroll logic — add active-link detection via `usePathname`, add copper border-b on active |
| D-10–D-12 | Footer: copper gradient top border, copper link hover, logo size-8 | LandingFooter minor polish — replace `border-t border-white/[0.06]` with gradient div |
| D-13–D-15 | Pricing: dark tier cards with copper glow, stone comparison table, dark FAQ | PricingTiers.jsx card reskin; FAQSection dark reskin; pricing/page.js section bg changes |
| D-16 | About: dark hero + stone values + dark CTA | about/page.js section bg adjustment; value cards reskin to dark `#1E293B` |
| D-17 | Contact: dark hero + dark form card | contact/page.js + ContactForm.jsx reskin |
| D-18 | Home section flow: HIW bg → #1E293B | Update HowItWorksSection bg; update skeleton in page.js to match |
| D-19–D-23 | Animation constraints | AnimatedSection duration param needs to shrink from 600ms to 200ms per D-19; stagger from 120ms to 50ms |
| D-24–D-29 | Mobile fallbacks | Tailwind `hidden md:block` / `block md:hidden` swap pattern confirmed |
| D-30–D-36 | Auth page differentiated signup vs signin | Full auth/signin/page.js rewrite — same route, new visual treatment; OtpInput.js reskin |
</phase_requirements>

---

## Summary

Phase 13 is a **pure frontend reskin** — no new routes, no new data flows, no new third-party integrations. Every public-facing page (Home, Pricing, Contact, About) plus Nav, Footer, and Auth already exists and functions correctly. The task is to evolve the visual design language from a mixed light/dark palette to a consistent Premium Dark SaaS treatment, driven by 36 locked design decisions documented in CONTEXT.md and formalized in UI-SPEC.md.

The technical stack is fully established: Next.js 16 with App Router, Tailwind v4 CSS-based theming, Framer Motion v12 for scroll animations, shadcn/ui (new-york style) for component primitives, and Radix UI Accordion for the FAQ. All animation primitives (AnimatedSection, AnimatedStagger, AnimatedItem) are already built and proven. The three new CSS tokens (`--color-landing-charcoal`, `--color-landing-light-text`, `--color-landing-muted-text`) are the only infrastructure additions needed before component work begins.

The biggest implementation complexity is the auth page — it requires a structural layout change from a single split card with a tab switcher to two distinct layouts (signup = split, signin = compact centered). The existing auth logic (Google OAuth, email+password, OTP flow, cooldown timer) must be preserved exactly, only the visual wrapper changes. All other pages are straightforward background + border + color substitutions following the contracts in UI-SPEC.md.

**Primary recommendation:** Token additions first (Wave 0), then a clear component-by-component order: Nav/Footer (shared, affects every page), then Home page sections, then Pricing, About, Contact (independent pages), then Auth (most complex, isolated route). AnimatedSection stagger timing needs one targeted parameter tweak (120ms → 50ms) before the animation contracts are met.

---

## Standard Stack

### Core (All established — no new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | ^16.1.7 | App Router, dynamic imports, metadata API | Already in use — pages are App Router Server Components |
| React | ^19.0.0 | Component rendering | Foundation |
| Tailwind CSS | ^4.2.2 | CSS-based theming, responsive utilities | Already in use — `@import 'tailwindcss'` + `@theme inline` pattern established |
| Framer Motion | ^12.38.0 | Scroll animations, AnimatePresence for drawer | Already in use — AnimatedSection, drawer animations in LandingNav |
| shadcn/ui (new-york) | initialized | Button, Card, Badge, Input, Label, Alert, Accordion primitives | Already initialized in Phase 02-03 |
| Radix UI Accordion | via shadcn | FAQ accordion | Already used in FAQSection.jsx |
| Lucide React | via shadcn | Icons | Already configured in components.json |

**Version verification:** All versions confirmed from package.json — no new installs required for this phase.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next/dynamic` | (Next.js built-in) | Lazy loading below-fold sections with loading skeletons | Already used in (public)/page.js for all home sections — pattern to follow for any new heavy sections |
| `@radix-ui/react-accordion` | via shadcn | Accordion primitives | FAQSection already uses `import * as Accordion from '@radix-ui/react-accordion'` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS transitions for card hover glow | Framer Motion hover | CSS transitions are zero-bundle, correct choice for static hover effects |
| Tailwind responsive classes for mobile swap | JS media query (useMediaQuery) | Tailwind classes have zero runtime cost, no hydration mismatch |
| CSS gradient div for footer copper border | SVG or border-image | CSS gradient div on a 1px-height element is simpler and more predictable |

**Installation:** None required. All dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure

This phase touches existing files only — no new directories needed:

```
src/app/globals.css                        # Wave 0: add 3 new CSS tokens
src/app/(public)/
├── page.js                                # Update HowItWorks skeleton bg
├── layout.js                              # No change
├── pricing/
│   ├── page.js                            # Update FAQ section bg + CTA section
│   ├── PricingTiers.jsx                   # Dark card reskin + copper hover
│   ├── ComparisonTable.jsx                # Confirm stone section (already #F5F5F4)
│   └── FAQSection.jsx                     # Dark reskin with copper chevron
├── about/page.js                          # Dark value cards reskin
└── contact/page.js                        # Confirm stone form section
src/app/components/landing/
├── LandingNav.jsx                         # Active link copper underline
├── LandingFooter.jsx                      # Copper gradient top border + link hover
├── HowItWorksSection.jsx                  # bg → #1E293B
├── SocialProofSection.jsx                 # Confirm already dark #0F172A
├── FeaturesGrid.jsx                       # Confirm already stone #F5F5F4
├── AnimatedSection.jsx                    # Stagger timing: 120ms → 50ms
└── FinalCTASection.jsx                    # Confirm copper gradient bg
src/app/auth/signin/page.js                # Full auth redesign — differentiated layouts
src/components/onboarding/OtpInput.js      # Dark palette reskin
```

### Pattern 1: Tailwind v4 CSS Custom Property Token Addition

**What:** New palette tokens are added to two places in `globals.css`: the `@theme inline` block (for Tailwind utility generation) and the `:root` block (for CSS variable definition).

**When to use:** Any time a new design token is needed that should be referenceable as both a CSS variable (`var(--color-landing-charcoal)`) and a Tailwind utility (`bg-landing-charcoal`).

```css
/* Source: established Phase 02.1 / 02-03 pattern in globals.css */

/* 1. In @theme inline block — Tailwind generates utilities from these */
@theme inline {
  --color-landing-charcoal: var(--color-landing-charcoal);
  --color-landing-light-text: var(--color-landing-light-text);
  --color-landing-muted-text: var(--color-landing-muted-text);
}

/* 2. In :root block — actual hex values */
:root {
  --color-landing-charcoal: #1E293B;
  --color-landing-light-text: #F1F5F9;
  --color-landing-muted-text: #94A3B8;
}
```

After this, `bg-landing-charcoal`, `text-landing-light-text`, and `text-landing-muted-text` work as Tailwind utilities throughout the project.

### Pattern 2: Card Dark Hover Treatment (Pure CSS Transition)

**What:** Rest state is a dark card with subtle white border. Hover adds copper border glow and subtle lift. No JS required.

**When to use:** All interactive card components on dark sections (Pricing tier cards, About value cards, Social Proof testimonial cards).

```jsx
// Source: D-05, D-06 in 13-CONTEXT.md / 13-UI-SPEC.md Component-Level Contracts
<div className="
  bg-[#1E293B] border border-white/[0.06] rounded-xl
  transition-all duration-200
  hover:border-[#C2410C]/40
  hover:shadow-[0_0_20px_rgba(194,65,12,0.15)]
  hover:-translate-y-0.5
">
  {/* card content */}
</div>
```

**Note:** `hover:-translate-y-0.5` is Tailwind's `translateY(-2px)` equivalent. The `transition-all` covers border-color, box-shadow, and transform together. The shadow property uses Tailwind's JIT arbitrary value syntax.

### Pattern 3: Footer Copper Gradient Top Border

**What:** Replace the existing `border-t border-white/[0.06]` with a 1px-height gradient div acting as a decorative border.

**When to use:** Footer only (D-11).

```jsx
// Source: D-11 in 13-CONTEXT.md / 13-UI-SPEC.md Footer contract
// Replace: <footer className="bg-[#0F172A] border-t border-white/[0.06]">
// With:
<footer className="bg-[#0F172A]">
  {/* Copper gradient top border */}
  <div
    className="h-px w-full"
    style={{ background: 'linear-gradient(90deg, transparent 0%, #C2410C 50%, transparent 100%)' }}
    aria-hidden="true"
  />
  {/* rest of footer */}
</footer>
```

**Alternative using Tailwind:** `bg-gradient-to-r from-transparent via-[#C2410C] to-transparent` — both approaches work. The inline style is more explicit about the 3-stop gradient intent.

### Pattern 4: Nav Active Link Copper Underline

**What:** Currently all nav links use `text-white/60 hover:text-white`. Active pages need `border-b-2 border-[#C2410C]` to indicate current location.

**When to use:** Desktop nav links for Pricing, About, Contact. Anchor links (#how-it-works, #features) do not have a persistent active state.

```jsx
// Source: D-09 in 13-CONTEXT.md / 13-UI-SPEC.md Navigation contract
// LandingNav.jsx already has: const pathname = usePathname();

const isActive = (href) => pathname === href || pathname.startsWith(href + '/');

// Desktop link with active state:
<Link
  href="/pricing"
  className={`text-sm transition-colors pb-0.5 ${
    isActive('/pricing')
      ? 'text-white border-b-2 border-[#C2410C]'
      : 'text-white/60 hover:text-white'
  }`}
>
  Pricing
</Link>
```

**Pitfall:** `border-b-2` adds 2px height to the element inside a flex row — use `pb-0.5` or `items-end` to prevent the active underline from causing layout shift. Better: use `relative after:` pseudo-element approach for zero-height-impact underline.

### Pattern 5: Auth Page Mode Switch (Conditional Layout)

**What:** Current auth page renders one layout for both signup/signin (tab toggle on a shared card). New design renders two completely different layout structures based on `mode` state.

**When to use:** auth/signin/page.js only.

```jsx
// Source: D-30–D-34 in 13-CONTEXT.md / 13-UI-SPEC.md Auth Page contracts

// Render branch, not tab toggle:
if (mode === 'signin') {
  return <SigninView email={email} setEmail={setEmail} /* ... props */ />;
}
if (mode === 'otp') {
  return <OtpView email={email} /* ... props */ />;
}
// Default: signup split layout
return <SignupView email={email} setEmail={setEmail} /* ... props */ />;
```

**Key insight:** Extract each view into a local function or component within the file — share all auth state (email, password, loading, error, mode setter, handlers) via props. This avoids useState duplication while keeping the file's single-file structure. Do NOT split into separate route files (the route stays `/auth/signin`).

### Pattern 6: Dynamic Import Skeleton Background Matching

**What:** When a section's background color changes (e.g., HowItWorks from `bg-white` to `bg-[#1E293B]`), the loading skeleton in `page.js` must be updated to match the new background. Otherwise, a flash of wrong background color creates CLS.

**When to use:** Any dynamic import whose containing section background is being changed.

```jsx
// Source: CLS prevention pattern established in (public)/page.js
// Current HowItWorks skeleton uses bg-white — must change to bg-[#1E293B]
// Current skeleton shimmer uses bg-black/10 — must change to bg-white/10 on dark bg

const HowItWorksSection = dynamic(
  () => import('@/app/components/landing/HowItWorksSection').then((m) => m.HowItWorksSection),
  {
    loading: () => (
      <section className="bg-[#1E293B] py-20 md:py-28 px-6" aria-hidden="true">
        {/* Shimmer elements use bg-white/10 on dark background */}
        <div className="h-4 w-24 bg-white/10 rounded mx-auto mb-3" />
      </section>
    ),
  }
);
```

### Anti-Patterns to Avoid

- **Tab toggle for visually distinct views:** The existing auth page uses a pill tab switcher — this must be replaced with text link toggles and fully different layouts per D-30/D-33.
- **backdrop-filter on page sections:** Only nav may use backdrop-blur. No section background, card, or modal may use `backdrop-filter: blur()` per D-23.
- **width/height/margin/padding animations:** All motion must be transform/opacity only per D-23. The existing AnimatedSection is compliant. Verify no hover effects animate padding or max-height (aside from the Radix accordion which uses its own height variable).
- **Tailwind v4 `@apply` with landing tokens:** In Tailwind v4, `@apply bg-landing-charcoal` works only if the token is registered in `@theme inline`. Always register in both `@theme inline` and `:root`. Using bare `bg-[#1E293B]` is also acceptable and avoids the double-registration requirement for one-off uses.
- **Using `dark:` variant for landing palette:** The landing color system uses explicit hex values and CSS custom properties, not the `dark:` Tailwind variant. The dark mode class toggle does not apply to public landing pages.
- **`transition-all` with shadow on cards:** `box-shadow` is GPU-composited in modern browsers and is safe for transitions. However, the performance constraint (D-23) says transform/opacity only for *animations*. Card hover transitions that include box-shadow are acceptable — they are not scroll animations, they are hover micro-interactions.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scroll-triggered animations | Custom IntersectionObserver wrapper | Existing `AnimatedSection` with `whileInView` | Already built, prefers-reduced-motion handled, viewport margin tuned |
| Accordion expand/collapse animation | CSS max-height hack | Existing Radix Accordion + `--radix-accordion-content-height` | Radix sets the CSS variable at runtime — smooth height transition without overflow issues. Phase 06 decision confirmed. |
| Staggered child animations | CSS animation-delay manually | Existing `AnimatedStagger` + `AnimatedItem` | Built for this exact use case |
| Mobile drawer animation | CSS transform hack | Existing Framer Motion AnimatePresence in LandingNav | Already built with backdrop and body scroll lock |
| OTP input field behavior | Re-implement digit navigation | Existing `OtpInput.js` | Focus management, paste handling, backspace navigation all implemented |
| Pricing billing toggle state | URL params or context | Local `useState('monthly')` in PricingTiers | Display-only toggle, no persistence needed (PRICE-03) |

**Key insight:** Phase 13 is a reskin, not a rebuild. Virtually every behavioral primitive already exists. The work is color, border, shadow, and structural layout changes — not new logic.

---

## Common Pitfalls

### Pitfall 1: AnimatedSection Duration Mismatch

**What goes wrong:** AnimatedSection currently uses `duration: 0.6` (600ms) and AnimatedStagger uses `staggerChildren: 0.12` (120ms). CONTEXT.md D-19 specifies 200ms duration and 50ms stagger. If left unchanged, animations will feel slow and heavy — the opposite of "confident and subtle."

**Why it happens:** The Phase 02.1 decisions used 600ms for a slower, more dramatic reveal style. Phase 13 wants snappier, less-noticeable animations.

**How to avoid:** Update AnimatedSection `duration: 0.6` → `duration: 0.2` and AnimatedStagger `staggerChildren: 0.12` → `staggerChildren: 0.05`.

**Warning signs:** Animations that feel like "loading" rather than "revealing" — user perceives them as slow.

**Caution:** This is a global change to AnimatedSection — it affects all pages that use it. The change is intentional per D-19 but verify no other phase uses AnimatedSection with a specific slow duration expectation.

### Pitfall 2: Dynamic Import Skeleton Background Flash

**What goes wrong:** Skeleton placeholders in `(public)/page.js` hardcode background colors (currently `bg-white` for HowItWorks). When the actual section renders as `bg-[#1E293B]`, there is a brief background flash causing visible CLS.

**Why it happens:** Dynamic import loading states are defined once at page load time — the skeleton background must match the final rendered section background exactly.

**How to avoid:** Update HowItWorks skeleton from `bg-white` to `bg-[#1E293B]`. Update shimmer element colors from `bg-black/[0.04]` to `bg-white/[0.04]`.

**Warning signs:** Brief flash of white/light background before section renders on slow connections.

### Pitfall 3: Active Nav Link Height Impact

**What goes wrong:** Adding `border-b-2 border-[#C2410C]` to an active nav link inside a flex container can push the baseline of other links down by 2px, causing micro-layout shift.

**Why it happens:** `border-b-2` adds 2px to the rendered height of the element.

**How to avoid:** Use a pseudo-element approach: `relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#C2410C]` — the 2px indicator is absolutely positioned and does not affect flow.

**Warning signs:** Nav items appearing vertically misaligned on the active page.

### Pitfall 4: Auth Page State Sharing in Split Layout

**What goes wrong:** Splitting signup/signin into conditional render branches while sharing state (email, password, loading, error) can lead to state values persisting across mode switches if not cleared properly.

**Why it happens:** `email` and `password` useState values persist when `mode` changes. In the old tab toggle, this was fine (same form). In the new layout-split approach, switching from signup (where user typed email) to signin should clear the error but keep the email pre-filled (good UX).

**How to avoid:** Call `setError('')` on mode switch (already done in existing `switchMode` function). Decide explicitly: email pre-fills on mode switch (good UX — user typed it already), password does NOT pre-fill (security). Keep current `switchMode` behavior.

**Warning signs:** Error messages from signup persisting when user switches to signin view.

### Pitfall 5: Pricing Tier Cards on Dark Background — shadcn Card Default

**What goes wrong:** shadcn `<Card>` uses `var(--card)` (white in light mode) as its background. On a dark `#0F172A` section background, using a raw `<Card>` will render white cards instead of dark `#1E293B` cards.

**Why it happens:** shadcn Card background comes from `--card` CSS variable, not from Tailwind utility classes directly.

**How to avoid:** Override the background explicitly: `<Card className="bg-[#1E293B] border-white/[0.06] ...">`. Do not rely on the Card component's default background for dark sections.

**Warning signs:** White/light card backgrounds appearing within dark sections.

### Pitfall 6: Mobile Drawer Background Already Set

**What goes wrong:** Current LandingNav mobile drawer uses `bg-[#0F172A]` (landing-dark). The CONTEXT.md D-09 specifies `bg-[#1E293B]` (charcoal) for the mobile drawer — this is a subtle distinction that could be missed.

**Why it happens:** The drawer currently matches the nav-on-scroll background (#0F172A) rather than the charcoal specified for the drawer (D-09 + UI-SPEC Navigation).

**How to avoid:** Update drawer `bg-[#0F172A]` → `bg-[#1E293B]`. Keep backdrop overlay at `bg-[#0F172A]/80`.

### Pitfall 7: OtpInput focus ring off-white background

**What goes wrong:** Current OtpInput uses `bg-white` for each digit box and `focus:ring-offset-1` (which assumes a light background for the ring offset color). On the new dark OTP card (`bg-[#0F172A]`), the ring offset will appear as white, breaking the design.

**Why it happens:** `focus:ring-offset-1` uses `--tw-ring-offset-color` which defaults to white.

**How to avoid:** Replace with explicit `focus:outline-none focus:border-[#C2410C] focus:ring-1 focus:ring-[#C2410C]/30` — no ring offset, direct border highlight. Update box background from `bg-white` to `bg-[#0F172A]` per UI-SPEC Auth OTP contract.

---

## Code Examples

### Token Registration (globals.css Wave 0)

```css
/* Source: Established pattern in globals.css — Phase 02-03 decision */

/* Add to @theme inline block */
--color-landing-charcoal: var(--color-landing-charcoal);
--color-landing-light-text: var(--color-landing-light-text);
--color-landing-muted-text: var(--color-landing-muted-text);

/* Add to :root block */
--color-landing-charcoal: #1E293B;
--color-landing-light-text: #F1F5F9;
--color-landing-muted-text: #94A3B8;
```

### AnimatedSection Timing Update

```jsx
// Source: AnimatedSection.jsx — update duration per D-19
// Change: duration: 0.6 → 0.2
// Change: staggerChildren: 0.12 → 0.05

// AnimatedSection — line 22:
transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1], delay }}

// AnimatedStagger — line 47:
staggerChildren: prefersReducedMotion ? 0 : 0.05,
```

### Pricing Tier Card Dark Reskin

```jsx
// Source: D-05, D-06, D-13 — PricingTiers.jsx
// Replace: bg-white with bg-[#1E293B], change border and hover treatment

<Card
  className={`relative flex flex-col h-full
    bg-[#1E293B] border border-white/[0.06]
    transition-all duration-200
    hover:border-[#C2410C]/40
    hover:shadow-[0_0_20px_rgba(194,65,12,0.15)]
    hover:-translate-y-0.5
    ${isHighlighted ? 'ring-2 ring-[#C2410C]/60' : ''}
  `}
>
```

### FAQ Section Dark Reskin

```jsx
// Source: D-15 — FAQSection.jsx — move from light to dark
// Section wrapper in pricing/page.js: bg-[#0F172A]
// Accordion item border: border-white/[0.08]
// Trigger text: text-[#F1F5F9]
// Chevron: text-[#C2410C] (copper accent for expand icon per D-15)
// Content text: text-[#94A3B8]

<Accordion.Trigger className="flex items-center justify-between w-full py-5 text-left text-[#F1F5F9] font-semibold text-lg group min-h-[44px]">
  {item.q}
  <ChevronDown className="size-5 text-[#C2410C] transition-transform duration-200 group-data-[state=open]:rotate-180 shrink-0 ml-4" />
</Accordion.Trigger>
```

### Auth Split Layout Structural Pattern

```jsx
// Source: D-31 — Signup layout shell
// Page background: bg-[#0F172A]
// Left form panel: bg-[#334155] (slate-700), flex-1
// Right brand panel: bg-[#0F172A], lg:w-[380px] xl:w-[420px], hidden on mobile

// Signup view:
<div className="min-h-screen bg-[#0F172A] flex items-center justify-center px-4 py-12">
  <div className="relative w-full max-w-[960px] rounded-2xl overflow-hidden flex flex-col lg:flex-row">
    {/* Left: form */}
    <div className="flex-1 bg-[#334155] p-8 sm:p-10 lg:p-12">
      {/* welcoming headline, Google OAuth, form */}
    </div>
    {/* Right: brand panel — hidden on mobile */}
    <div className="hidden lg:flex lg:w-[380px] xl:w-[420px] bg-[#0F172A] ...">
      {/* selling points, social proof — existing SELLING_POINTS array */}
    </div>
  </div>
</div>

// Signin view (compact centered card):
<div className="min-h-screen bg-[#0F172A] flex items-center justify-center px-4 py-12">
  <div className="w-full max-w-[400px] bg-[#1E293B] rounded-2xl p-8 sm:p-10">
    {/* logo, "Welcome back", email, password, submit */}
  </div>
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind config.js for custom tokens | CSS `@theme inline` block in globals.css | Phase 02-03 (Tailwind v4) | No tailwind.config.js — tokens live entirely in CSS |
| `tailwind.config.js theme.extend` | `@theme inline { --color-*: var(--color-*) }` + `:root` | Tailwind v4 | Required approach for this project |
| shadcn init with `--style` flag | Manual components.json with new-york style | Phase 02-03 | `--style` flag removed in shadcn v4 CLI |
| Framer Motion `initial={false}` for reduced motion | `useReducedMotion()` hook + conditional | Phase 02.1 | `initial={false}` skips animation entirely when motion is reduced |

**Deprecated/outdated in this project:**
- `tailwind.config.js`: Does not exist and must not be created. All config via `globals.css`.
- Tab-toggle auth pattern: Replaced by conditional layout branches (D-30).

---

## Open Questions

1. **AnimatedSection duration change is global**
   - What we know: AnimatedSection duration 0.6s → 0.2s per D-19. The component is used across all public pages.
   - What's unclear: Are there specific sections in other phases (e.g., dashboard onboarding wizard) that also use AnimatedSection and would be affected?
   - Recommendation: Check if `AnimatedSection` is imported outside the landing components. If so, the timing change should only be applied to landing-specific usage via a new prop (`duration` is already passed as a prop with `delay`). The current signature supports `delay` but not `duration` as a prop — adding `duration = 0.2` as a prop with default satisfies both old and new usage.

2. **HowItWorksSection and HowItWorksTabs mobile swap**
   - What we know: D-26 specifies HowItWorksTabs → vertical accordion or stacked steps on mobile. HowItWorksSection already does a dynamic import of HowItWorksTabs.
   - What's unclear: Whether the mobile fallback is inside HowItWorksSection (using `hidden md:block`) or whether HowItWorksSection itself contains the mobile version.
   - Recommendation: The `hidden md:block` / `block md:hidden` pattern from D-29 goes inside HowItWorksSection — render `<HowItWorksTabs>` on desktop (md+) and a static stacked steps list on mobile. No new dynamic import needed for the mobile fallback.

3. **Contact form stone break specifics**
   - What we know: D-17 says dark hero + dark form card. UI-SPEC says "stone break is the form card area itself sitting within a `bg-[#F5F5F4]` section." ContactForm.jsx is not yet read.
   - What's unclear: ContactForm.jsx current styling — whether it already wraps in a bg-white card or outputs bare form fields.
   - Recommendation: Read ContactForm.jsx before implementing to understand the reskin scope.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — phase is purely CSS/component work, no new CLI tools, runtimes, or services required beyond the existing Next.js dev server).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (existing — see jest.config.js) |
| Config file | `jest.config.js` (project root) |
| Quick run command | `node node_modules/jest-cli/bin/jest.js --passWithNoTests` |
| Full suite command | `node node_modules/jest-cli/bin/jest.js` |

### Phase Requirements → Test Map

Phase 13 is a **pure frontend visual reskin** — no new business logic, API routes, or data transformations. There are no unit-testable behaviors introduced in this phase.

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| D-01 to D-36 | Visual/CSS changes | Visual inspection | N/A | No JavaScript logic changes; CSS token additions, Tailwind class changes, and layout restructuring are not unit-testable |
| Auth layout (D-30–D-36) | Mode-conditional rendering | Manual browser test | N/A | Auth logic is preserved unchanged — the existing auth behavior is already tested via Phase 07 |

### Wave 0 Gaps

None for test files — existing test infrastructure needs no additions for this phase. The sole Wave 0 task is CSS token registration in globals.css.

**Note on AnimatedSection timing change:** If a test existed for AnimatedSection, the duration change would affect it. No such test exists currently.

---

## Project Constraints (from CLAUDE.md)

1. **Skill-Driven Architecture:** If a skill file is read and changes made to architecture, update the skill file afterward to keep it in sync.
   - Impact: If `frontend-design` skill is used during implementation, update the skill file if the project's design patterns change significantly. (For Phase 13 this is low-probability — the skill is general guidance, not project-specific documentation.)

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — all existing component files read verbatim
- `package.json` — exact installed versions confirmed (Next.js ^16.1.7, Framer Motion ^12.38.0, Tailwind ^4.2.2, React ^19.0.0)
- `globals.css` — existing token structure and `@theme inline` pattern confirmed
- `13-CONTEXT.md` — 36 locked design decisions
- `13-UI-SPEC.md` — component-level design contracts
- `LandingNav.jsx` — existing scroll logic, drawer structure confirmed
- `LandingFooter.jsx` — existing 3-column structure confirmed
- `auth/signin/page.js` — existing auth state machine, SELLING_POINTS, split layout confirmed
- `AnimatedSection.jsx` — current timing (600ms, 120ms stagger) confirmed

### Secondary (MEDIUM confidence)
- `PricingTiers.jsx`, `FAQSection.jsx` — existing component patterns confirmed
- `(public)/page.js` — dynamic import + skeleton patterns confirmed for all 4 below-fold sections
- `about/page.js`, `contact/page.js` — existing section structure confirmed
- `OtpInput.js` — existing focus ring implementation confirmed

### Tertiary (LOW confidence)
- None — all claims are based on direct code inspection

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions confirmed from package.json, all components read directly
- Architecture: HIGH — all existing files inspected, patterns confirmed, no guesswork
- Pitfalls: HIGH — identified from direct code reading (existing values that differ from target values)
- Animation timing gap (AnimatedSection): HIGH — confirmed 600ms vs 200ms target delta from source

**Research date:** 2026-03-25
**Valid until:** 2026-04-24 (stable libraries, 30-day window appropriate)

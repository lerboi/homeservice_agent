---
name: public-site-i18n
description: "Complete architectural reference for the public marketing site and internationalization — landing page sections, pricing page, about page, contact form with Resend email, navigation, footer, animation system, AuthAwareCTA, next-intl configuration, and translation files. Use this skill whenever making changes to public-facing pages, landing sections, pricing tiers, contact form, navigation, footer, animations, i18n configuration, or translation files. Also use when the user asks about how the marketing site works, wants to modify page design, or needs to debug i18n or animation issues."
---

# Public Site & Internationalization — Complete Reference

This document is the single source of truth for the public marketing site, landing sections, pricing, contact, and internationalization. Read this before making any changes to public pages, landing components, i18n config, or email templates.

**Last updated**: 2026-03-26 (Phase 21 — pricing page redesign: volume-based tiers, dark hero, testimonials, dark FAQ, contact pre-selection; Phase 13 — premium dark SaaS redesign)

---

## Architecture Overview

| Layer | Files | Purpose |
|-------|-------|---------|
| **Route Group** | `src/app/(public)/` | All public pages — grouped to inject LandingNav + LandingFooter via shared layout |
| **Public Layout** | `src/app/(public)/layout.js` | Wraps all public pages: LandingNav, main, LandingFooter, Toaster |
| **Landing Page** | `src/app/(public)/page.js` | Homepage: HeroSection + dynamically imported below-fold sections |
| **Landing Sections** | `src/app/components/landing/` | All landing section components + AnimatedSection + LandingNav + LandingFooter |
| **Shared Components** | `src/components/landing/AuthAwareCTA.js` | Auth-aware CTA button (authenticated vs unauthenticated routing) |
| **Pricing** | `src/app/(public)/pricing/` | Pricing page + tier data + PricingTiers + ComparisonTable + FAQSection |
| **About** | `src/app/(public)/about/page.js` | Mission, problem, values, "why Voco" sections |
| **Contact** | `src/app/(public)/contact/` | Contact page + ContactForm.jsx |
| **Contact API** | `src/app/api/contact/route.js` | POST handler — Resend email dispatch |
| **i18n** | `src/i18n/routing.js`, `messages/en.json`, `messages/es.json` | next-intl config, English + Spanish translations |
| **Email Template** | `src/emails/NewLeadEmail.jsx` | React Email template for owner lead notifications |

```
User visits public URL (/, /pricing, /about, /contact)
       ↓
  (public) route group
       ↓
  layout.js (no "use client") — renders LandingNav + LandingFooter
       ↓
  Page component (Server Component)
       ↓  For landing page: HeroSection statically imported
       ↓  Below-fold: dynamically imported (bundle splitting + loading skeletons)
       ↓
  AnimatedSection (client component via "use client")
       ↓  direction prop (up/left/right), delay, useReducedMotion
  Section content renders with scroll-triggered animation

AuthAwareCTA ("use client"):
  supabase.auth.getUser() → if logged in → /dashboard
                          → if not logged in → /onboarding
```

---

## File Map

| File | Role |
|------|------|
| `src/app/(public)/layout.js` | Route group layout — injects LandingNav + LandingFooter for all public pages |
| `src/app/(public)/page.js` | Landing homepage — HeroSection static, others dynamic with loading skeletons |
| `src/app/(public)/pricing/page.js` | Pricing page — hero, tiers, comparison table, FAQ, CTA banner |
| `src/app/(public)/pricing/pricingData.js` | PRICING_TIERS (4 tiers), COMPARISON_FEATURES, getAnnualPrice() |
| `src/app/(public)/pricing/PricingTiers.jsx` | Tier cards with monthly/annual toggle, "Most Popular" badge on Growth |
| `src/app/(public)/pricing/ComparisonTable.jsx` | Feature comparison grid across all 4 tiers |
| `src/app/(public)/pricing/FAQSection.jsx` | Radix accordion FAQ — smooth height via CSS variable |
| `src/app/(public)/about/page.js` | About page — hero, problem stats, mission, how different, values, CTA |
| `src/app/(public)/contact/page.js` | Contact page shell — renders ContactForm |
| `src/app/(public)/contact/ContactForm.jsx` | Contact form with honeypot, client-side validation, Sonner toasts |
| `src/app/api/contact/route.js` | POST /api/contact — Resend per-request, honeypot check, inquiry routing |
| `src/app/components/landing/LandingNav.jsx` | Fixed top nav — transparent → blur on scroll, mobile drawer |
| `src/app/components/landing/LandingFooter.jsx` | Footer — newsletter display, 3-col links, back-to-top button |
| `src/app/components/landing/HeroSection.jsx` | Hero — Spline 3D scene (desktop), RotatingText, AuthAwareCTA, mobile image fallback |
| `src/app/components/landing/FeaturesGrid.jsx` | Bento grid layout for feature highlights |
| `src/app/components/landing/SocialProofSection.jsx` | Testimonial / social proof cards |
| `src/app/components/landing/HowItWorksSection.jsx` | Server Component — HowItWorksSticky via dynamic import |
| `src/app/components/landing/HowItWorksTabs.jsx` | Roving tabindex WAI-ARIA Tabs, AnimatePresence mode=wait |
| `src/app/components/landing/HowItWorksSticky.jsx` | Sticky scroll variant of HowItWorks steps |
| `src/app/components/landing/FinalCTASection.jsx` | Dark CTA section — CSS-only reduced-motion guard, Server Component |
| `src/app/components/landing/AnimatedSection.jsx` | Framer Motion scroll-triggered animation (AnimatedSection, AnimatedStagger, AnimatedItem) |
| `src/components/landing/AuthAwareCTA.js` | CTA button — routes authenticated users to /dashboard, new users to /onboarding |
| `src/emails/NewLeadEmail.jsx` | React Email template for owner lead notifications |
| `src/i18n/routing.js` | Locale config: locales ['en', 'es'], defaultLocale 'en' |
| `messages/en.json` | English translations (agent + UI sections) |
| `messages/es.json` | Spanish translations (agent + UI sections) |

---

## 1. Route Group and Layout

**File**: `src/app/(public)/layout.js`

```js
import { LandingNav } from '@/app/components/landing/LandingNav';
import { LandingFooter } from '@/app/components/landing/LandingFooter';
import { Toaster } from 'sonner';

export default function PublicLayout({ children }) {
  return (
    <>
      <LandingNav />
      <main>{children}</main>
      <LandingFooter />
      <Toaster richColors position="top-center" />
    </>
  );
}
```

The `(public)` Next.js route group applies `layout.js` to all routes inside it (`/`, `/pricing`, `/about`, `/contact`) without affecting the URL. `LandingNav` and `LandingFooter` are NOT placed inside individual page components — they're injected once via the layout.

The `Toaster` (from sonner) is placed in the root layout so ContactForm toast notifications work across all public pages.

---

## 2. Landing Page Structure

**File**: `src/app/(public)/page.js`

**Above-fold (static import)**: `HeroSection` — statically imported for best LCP. No loading state.

**Below-fold (dynamic imports)**: `HowItWorksSection`, `FeaturesGrid`, `SocialProofSection`, `FinalCTASection` — all dynamically imported via `next/dynamic` with explicit loading skeletons to prevent CLS.

Each loading skeleton has hardcoded `min-height` values that match the section's expected height, preventing layout shift during hydration.

**`ScrollProgress`**: Thin orange progress bar at top of page showing scroll position.

---

## 3. Landing Page Sections

### HeroSection (`src/app/components/landing/HeroSection.jsx`)

Server Component with client sub-components:
- **Spline 3D scene**: `SplineScene` (dynamic import, CDN web component, zero bundle impact). URL: `https://prod.spline.design/CN1NeDZqows-DMX0/scene.splinecode`. Desktop-only (hidden on mobile).
- **Mobile fallback**: Static `<Image>` of dashboard mockup — `priority` for LCP.
- **RotatingText**: 21st.dev animated component, rotates "Competitor/Revenue/Customer" at 3s interval.
- **AuthAwareCTA**: Routes authenticated users to `/dashboard`, new users to `/onboarding`.
- **Background**: `bg-[#050505]` near-black, radial gradient orange accent, dot grid texture, floating blur orb.

### FeaturesGrid (`src/app/components/landing/FeaturesGrid.jsx`)

Bento grid layout: CSS grid with `sm:grid-cols-5` asymmetric cells. Features in non-uniform tiles (col-span-3 / col-span-2 alternating). Section background: `#FAFAF9` (very light warm white). All cells use `AnimatedItem` from `AnimatedSection.jsx`.

### SocialProofSection (`src/app/components/landing/SocialProofSection.jsx`)

Testimonial cards in `md:grid-cols-3`. Background: `#F5F5F4` (light warm section). Uses `AnimatedStagger` + `AnimatedItem` for staggered card reveal.

### HowItWorksSection (`src/app/components/landing/HowItWorksSection.jsx`)

Server Component — no `'use client'`. Imports `HowItWorksSticky` via `dynamic()` for bundle splitting. Section background: `#F5F5F4` (user override of charcoal D-18 spec — creates visual rhythm break between dark hero and dark features sections).

**`HowItWorksSticky`** (`src/app/components/landing/HowItWorksSticky.jsx`): sticky scroll variant showing step cards as user scrolls. Inline `mobileSteps` data array (same source as sticky content) avoids an additional dynamic import for mobile breakpoint.

**`HowItWorksTabs`** (`src/app/components/landing/HowItWorksTabs.jsx`): Roving tabindex per WAI-ARIA Tabs pattern. `AnimatePresence mode=wait` with `key=active` for sequential step transitions (current tab exits before next enters).

### FinalCTASection (`src/app/components/landing/FinalCTASection.jsx`)

Server Component — stays server-side, no `useReducedMotion` hook. CSS-only prefers-reduced-motion guard:
```css
@media (prefers-reduced-motion: reduce) { .animate-* { animation: none; } }
```
Background: `#1C1412` (very dark warm brown). CTA button: inverted style (bg-white/dark text) on copper background for high contrast per design spec.

---

## 4. Animation System

**File**: `src/app/components/landing/AnimatedSection.jsx`

Three exported components, all `'use client'` (Framer Motion):

### `AnimatedSection({ children, className, delay, direction })`

Direction prop maps to offset:
```js
const directions = {
  up: { y: 32 },
  down: { y: -32 },
  left: { x: 32 },
  right: { x: -32 },
};
```

**Prefers-reduced-motion** (Framer Motion v12 pattern):
```js
const prefersReducedMotion = useReducedMotion();
// ...
initial={prefersReducedMotion ? false : { opacity: 0, ...offset }}
whileInView={prefersReducedMotion ? {} : { opacity: 1, x: 0, y: 0 }}
```

`initial={false}` skips the animation entirely when reduced motion is active — Framer Motion v12 pattern. Does NOT just remove animation class (which would leave invisible elements).

`viewport={{ once: true, margin: '-80px' }}` — animates only once, triggers 80px before viewport edge.

Transition: `duration: 0.2, ease: [0.22, 1, 0.36, 1]` — snappy spring-like ease.

### `AnimatedStagger({ children, className })`

Container for stagger sequences. Uses `staggerChildren: prefersReducedMotion ? 0 : 0.05` — zero stagger when reduced motion is active (all items appear at once).

### `AnimatedItem({ children, className })`

Used inside `AnimatedStagger`. Each item: `{ opacity: 0, y: 24 }` → `{ opacity: 1, y: 0 }`. When reduced motion: `hidden: {}` (no transform applied).

---

## 5. Navigation and Footer

### LandingNav (`src/app/components/landing/LandingNav.jsx`)

`'use client'` — needs scroll listener and pathname for active state.

**Scroll state**: `window.scrollY > 20` triggers `bg-[#090807]/90 shadow-[...]` — transparent to blur. Transition: `duration-500 ease-in-out`.

**Active link**: Orange bottom border `h-0.5 bg-[#F97316]` (desktop) or orange left accent pill (mobile drawer).

**Mobile drawer**: CSS transitions only (no Framer Motion). `translate-x-full` → `translate-x-0` on open. Black overlay backdrop. Body overflow locked while open.

**No isRoot pattern**: Navigation uses direct routes (`/`, `/pricing`, `/about`, `/contact`). The `isRoot` pattern mentioned in STATE.md was an earlier approach — current LandingNav uses direct path matching. Anchor links (e.g., `/#features`) are used in the footer for on-page scrolling.

**CTA**: Both desktop (`hidden md:inline-flex`) and mobile drawer CTAs link to `/onboarding`.

### LandingFooter (`src/app/components/landing/LandingFooter.jsx`)

`'use client'` — required for `window.scrollTo()` in back-to-top button.

**Newsletter form**: Display-only — no API wired. Input + Subscribe button are visual only (intentional stub, wiring deferred).

**Three-column grid**: Product (Features, Pricing, How it works), Company (About, Contact), Legal (Terms, Privacy).

**Anchor links**: Footer uses `/#features` and `/#how-it-works` for same-page scrolling from `/` and back-navigate from sub-pages.

**Background**: `bg-[#090807]` (near-black). Copper gradient top border. Orange radial glow accent.

---

## 6. AuthAwareCTA

**File**: `src/components/landing/AuthAwareCTA.js`

```js
'use client';
export function AuthAwareCTA({ variant = 'hero' }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
  }, []);

  if (isLoggedIn) {
    return <Button asChild><Link href="/dashboard">Go to Dashboard</Link></Button>;
  }
  return <Button asChild><Link href="/onboarding">Start My 5-Minute Setup</Link></Button>;
}
```

- `variant="hero"` — standard hero button sizing
- `variant="cta"` — larger CTA section sizing (slightly different padding/shadow classes)
- Authentication state checked once on mount via `supabase-browser` client
- Hydration: starts as unauthenticated state (no flash for logged-out users), updates after `getUser()` resolves

Cross-domain: See auth-database-multitenancy skill for supabase-browser client details.

---

## 7. Pricing Page

**File**: `src/app/(public)/pricing/page.js`

**Last updated**: 2026-03-26 (Phase 21 — volume-based tiers, dark redesign, testimonials, 8-question FAQ)

Six sections in order: dark hero (`#050505`) → billing toggle + tier cards (dark) → comparison table (light `#F5F5F4`) → testimonials (dark `#1A1816`) → FAQ (dark `#050505`) → CTA banner (dark warm `#1C1412`).

### Page Section Layout

| # | Section | Background | Notes |
|---|---------|-----------|-------|
| 1 | Hero | `bg-[#050505]` | Dot-grid texture, blur orb, eyebrow pill with pulse dot |
| 2 | Billing Toggle + Tier Cards | `bg-[#050505]` (continues) | Dark cards with copper glow hover |
| 3 | Comparison Table | `bg-[#F5F5F4]` | Light "breath" break — intentional contrast |
| 4 | Testimonials | `bg-[#1A1816]` | Two quotes inline in page.js (not a separate component) |
| 5 | FAQ | `bg-[#050505]` | Heading: "Questions from the field" in `text-white` |
| 6 | CTA Banner | `bg-[#1C1412]` | "Every missed call is a job your competitor booked." |

### `pricingData.js` — Tier Data Structure

**Volume-based differentiation**: All paid tiers share the same 9 core features. Differentiation is call volume + support level only. No feature gating between Starter/Growth/Scale.

```js
export const PRICING_TIERS = [
  { id: 'starter',    name: 'Starter',    monthlyPrice: 99,  callLimit: 40,   cta: 'Start Free Trial', ctaHref: '/onboarding', highlighted: false, ... },
  { id: 'growth',     name: 'Growth',     monthlyPrice: 249, callLimit: 120,  cta: 'Start Free Trial', ctaHref: '/onboarding', highlighted: true, badge: 'Most Popular', ... },
  { id: 'scale',      name: 'Scale',      monthlyPrice: 599, callLimit: 400,  cta: 'Start Free Trial', ctaHref: '/onboarding', highlighted: false, ... },
  { id: 'enterprise', name: 'Enterprise', monthlyPrice: null, callLimit: null, cta: 'Contact Us',       ctaHref: '/contact?type=sales', highlighted: false, ... },
];

export function getAnnualPrice(monthlyPrice) {
  if (monthlyPrice === null) return null;
  return Math.round(monthlyPrice * 0.8); // 20% annual discount
}

export const COMPARISON_FEATURES = [ ... ]; // 13 rows — 3 volume/support rows (strings) + 9 all-true rows + 1 enterprise-only row
```

**CTA labels**: "Start Free Trial" → `/onboarding` for Starter/Growth/Scale. "Contact Us" → `/contact?type=sales` for Enterprise.

**Prohibited copy**: No "money-back guarantee", no "no credit card required", no "Get Started" on paid tiers.

**Payment**: Stripe integration is out of scope for current milestone. Pricing page is display-only — CTAs link to `/onboarding` (not a checkout flow).

### `PricingTiers.jsx`

`'use client'` (billing toggle state). Monthly/annual billing toggle — defaults to annual (shows savings). Maps over `PRICING_TIERS` to render dark cards. `highlighted: true` (Growth tier) gets "Most Popular" badge and `ring-2 ring-[#F97316]/50` highlight ring.

**Dark card treatment**: `bg-[#1A1816] border border-white/[0.06]`. Hover: `border-[rgba(249,115,22,0.3)] shadow-[0_0_20px_rgba(249,115,22,0.15)] -translate-y-0.5`. Text hierarchy: `text-white` (name/price), `text-white/50` (description), `text-white/70` (features), `text-white/40` (/mo suffix), `text-white/30` (annual strikethrough).

Trial banner pill rendered above toggle: "14-Day Free Trial • Cancel Anytime" in `bg-white/[0.06] border border-white/[0.08] text-sm font-medium text-white/80 rounded-full`.

### `ComparisonTable.jsx`

Volume-based table comparing 13 `COMPARISON_FEATURES` across all 4 tiers. Server Component (no `'use client'`).

**Growth column highlight**: Growth `<th>` header uses `text-[#F97316] font-semibold`. Growth `<td>` cells use `bg-[#FFF7ED]` (light orange tint) for vertical column highlight effect.

Cell rendering: `true` → `Check` icon in `text-[#F97316]`; `false` → `—` dash in `text-[#94A3B8]`; string → `text-[#0F172A] font-medium`. Alternating row backgrounds: even rows `bg-stone-50/60`, odd rows default. Table has `overflow-x-auto` wrapper for mobile horizontal scroll.

### Testimonials (inline in page.js)

Dark section `bg-[#1A1816] py-16`. Two quotes side-by-side on `md+` using `AnimatedStagger`/`AnimatedItem`. Each card: `bg-white/[0.04] border border-white/[0.06] rounded-xl p-8`. Quote text: `text-xl text-white/80 italic`. Attribution: `text-sm text-white/50`.

Quotes (verbatim):
- "Before Voco, I was losing 3-4 calls every weekend. Now my phone's booked Monday before I've had coffee." — Mike R., HVAC contractor, Phoenix AZ
- "Setup took 4 minutes. I heard my AI answer a call with my business name before I even finished my first cup." — Sandra T., Plumbing company owner, Austin TX

### `FAQSection.jsx`

`'use client'` (Radix accordion interaction). 8 questions in 4 topic areas: setup (Q1-Q2), AI quality (Q3-Q4), trial/billing (Q5-Q7), data/security (Q8).

**Dark accordion styling**: Item border `border-b border-white/[0.08]`. Trigger text `text-white font-semibold text-lg`. Answer text `text-white/60 text-[15px] leading-relaxed`. ChevronDown `text-[#F97316]` with `group-data-[state=open]:rotate-180` rotation.

Smooth height transition via Radix CSS variable (`--radix-accordion-content-height`). Animation classes: `data-[state=open]:animate-accordion-down`, `data-[state=closed]:animate-accordion-up`.

**No prohibited copy**: FAQ does not contain "money-back guarantee", "no credit card required", or "refund policy" language.

---

## 8. About and Contact Pages

### About (`src/app/(public)/about/page.js`)

Server Component (default export, no `'use client'`). Uses `AnimatedSection`, `AnimatedStagger`, `AnimatedItem` from `AnimatedSection.jsx` and `AuthAwareCTA` from `src/components/landing/AuthAwareCTA.js`.

Four thematic sections:
1. **Hero** — dark navy (`#0F172A`) background, orange accent radial gradients
2. **The Problem** — white background, 4 stat cards (`STATS` array)
3. **Mission** — light (`#F8FAFC`) background, 2-col grid with mission statement + checklist
4. **How We're Different** — white, `HOW_DIFFERENT` 3-col cards
5. **Values** — dark navy, `VALUES` 2-col grid with icon + description
6. **CTA** — white, `AuthAwareCTA` + "Talk to us first" link

`export const metadata = { title: 'About — Voco', description: '...' }` — static metadata for SEO.

### Contact (`src/app/(public)/contact/page.js`)

Renders `ContactForm` (named import, not default). Dark navy background with gradient accent.

### `ContactForm.jsx` (`src/app/(public)/contact/ContactForm.jsx`)

**Named export** (not default): `export function ContactForm()` — consistent with project component pattern.

**Honeypot field**:
```jsx
<input type="text" name="_honeypot" aria-hidden="true" tabIndex={-1}
  className="absolute opacity-0 top-0 left-0 h-0 w-0 overflow-hidden" />
```
Invisible to real users. If filled (by bots), server returns `200 { ok: true }` silently — avoids bot fingerprinting.

**Client-side validation**: name, email, inquiryType, message all required. Email regex validated before submission.

**Error handling**: Sonner `toast.error()` for validation failures. `toast.success()` on successful submission. `toast.error()` on network/server error.

**Focus ring**: `focus:shadow-[0_0_0_3px_rgba(249,115,22,0.2)]` arbitrary Tailwind value — expresses `box-shadow` correctly without inline styles.

---

## 9. Contact API Route

**File**: `src/app/api/contact/route.js`

```js
export async function POST(request) {
  const { name, email, inquiryType, message, _honeypot } = await request.json();

  // Honeypot gate — silent 200 to avoid bot fingerprinting
  if (_honeypot) return Response.json({ ok: true });

  // ... validation ...

  // Resend instantiated per-request — correct for serverless/stateless execution
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({ from, to, replyTo, subject, text });

  return Response.json({ ok: true });
}
```

**Resend per-request**: Instantiated inside the handler, not at module level. Correct pattern for serverless environments where module-level singletons may not be available across cold starts.

**Inquiry routing**: `INQUIRY_ADDRESSES` map routes to different recipients by `inquiryType` (sales/support/partnerships). Falls back to `CONTACT_EMAIL_FALLBACK`. If no recipient configured, returns 500.

**Environment variables**: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CONTACT_EMAIL_SALES`, `CONTACT_EMAIL_SUPPORT`, `CONTACT_EMAIL_PARTNERSHIPS`, `CONTACT_EMAIL_FALLBACK`.

---

## 10. Email Templates

**File**: `src/emails/NewLeadEmail.jsx`

React Email template for owner lead notifications. Exported as named function:
```js
export function NewLeadEmail({ lead, businessName, dashboardUrl })
```

**Design tokens used** (inline styles, not Tailwind — React Email renders as HTML email):
- `warmSurface (#F5F5F4)` — email body background
- `navy (#0F172A)` — header background (normal calls)
- `#DC2626` (red) — header background for emergency calls
- `brandOrange (#C2410C)` — CTA button background
- `bodyText (#475569)` — label text

**Emergency variant**: `isEmergency = urgency === 'emergency'` → red header + "EMERGENCY BOOKING" badge.

Called from `src/lib/notifications.js` `sendOwnerEmail()`. Rendered to HTML via `@react-email/components`.

---

## 11. Internationalization (i18n)

### Routing Config (`src/i18n/routing.js`)

```js
export const locales = ['en', 'es'];
export const defaultLocale = 'en';
```

**Cookie-based locale, no URL prefix**: The app uses `next-intl` with cookie-based locale switching rather than URL-prefixed routing (e.g., `/es/pricing`). This is required by the API-first multi-tenant architecture — URL prefixes would break webhook routing and Retell callbacks.

**Single source of truth for language barrier detection**: The voice call system imports `locales` from this file to detect unsupported languages. Any detected_language not in the `locales` array → `language_barrier = true`. Adding a new language means updating both this file AND the translation files.

### Translation Files Structure

Both `messages/en.json` and `messages/es.json` have two top-level sections:

**`agent` section** — used by the WebSocket LLM server (`agent-prompt.js`) via direct JSON import (NOT next-intl runtime — the Railway WebSocket server runs outside Next.js context):
- `default_greeting`, `recording_disclosure`, `language_clarification`
- `unsupported_language_apology`, `call_wrap_up`, `transfer_attempt`
- `capture_name`, `capture_address`, `capture_job_type`
- `fallback_no_booking`, `language_barrier_escalation`

**`ui` section** — used by Next.js frontend via `next-intl` for UI text translations.

**Direct JSON import vs next-intl**: `buildSystemPrompt()` on Railway imports `messages/en.json` and `messages/es.json` directly (not via next-intl provider). This is because it runs in a plain Node.js process with no Next.js context. Frontend components use `next-intl`'s `useTranslations()` hook normally.

Cross-domain: See voice-call-architecture skill for how `buildSystemPrompt()` uses translation files.

---

## 12. Design Tokens (Landing)

Landing pages use a separate set of design tokens from the dashboard. These are NOT in `src/lib/design-tokens.js` (which is dashboard/onboarding). Landing tokens are expressed directly as Tailwind utilities.

| Token | Hex Value | Usage |
|-------|-----------|-------|
| Hero/Footer background | `#050505` / `#090807` | Near-black, deepest dark surfaces |
| Accent orange | `#F97316` | CTAs, active links, accent highlights |
| Section light | `#F5F5F4` | Alternating light sections (HowItWorks, Social Proof) |
| Muted text | `#475569` | Body text on light backgrounds |
| Success / brand | `#166534` | Not prominent on landing (used in badge variants) |
| About page navy | `#0F172A` | Shared with dashboard |
| About page accent | `#C2410C` | Darker orange for about/contact (matches dashboard brandOrange) |

**Tailwind v4 pattern**: Landing uses `@import 'tailwindcss'` in CSS + `@tailwindcss/postcss` plugin. No `tailwind.config.js`. Custom animation variants registered via `--animate-*` convention in `@theme` inline block.

---

## 13. Key Design Decisions

- **(public) route group for layout injection**: The `(public)` route group applies `LandingNav` + `LandingFooter` to all public pages without repeating them in each page component. Parentheses in the folder name exclude it from the URL path.

- **Cookie-based locale without URL prefix**: next-intl configured without URL prefix routing. API-first multi-tenant constraint — URL-prefixed routing would break Retell webhooks and OAuth callbacks that expect fixed path patterns.

- **next-intl for client, direct JSON import for agent**: The WebSocket voice server (Railway) runs outside Next.js — it imports translation JSON directly. Frontend uses next-intl runtime. Two consumers, two import strategies.

- **Language barrier uses routing.js locales as source of truth**: `locales = ['en', 'es']` is the authoritative list. The voice call system compares `detected_language` against this array. Adding a language = update routing.js + add messages file + test triage.

- **ContactForm named export, honeypot 200, Resend per-request**: Named export matches project authoring convention. Honeypot returns 200 silently to not reveal detection to bots. Resend per-request is correct for serverless — module-level singletons may not persist.

- **ContactForm useSearchParams pre-selection**: ContactForm uses `useSearchParams()` to read `?type=` URL param and pre-select the inquiry type dropdown. Enterprise CTA on pricing page links to `/contact?type=sales` to pre-select "Sales". ContactForm is wrapped in `<Suspense fallback={null}>` in contact/page.js — required by Next.js when using `useSearchParams` in a client component rendered from a Server Component page.

- **AnimatedSection `initial={false}` for prefers-reduced-motion**: Framer Motion v12 pattern. Setting `initial={false}` skips the initial animation state entirely — does not just animate to the final state instantly. This avoids flash/jump for reduced-motion users.

- **HowItWorksSection Server Component + dynamic import**: Section is Server Component with `HowItWorksSticky` dynamically imported. Keeps the base render fast; interactive tabs/sticky loaded only when needed. Mobile steps use inline `mobileSteps` data to avoid another dynamic import.

- **FinalCTASection CSS-only motion guard**: FinalCTASection stays a Server Component (no `useReducedMotion` hook). CSS `@media (prefers-reduced-motion: reduce)` handles animation suppression — avoids converting to client component just for a motion preference check.

- **Tailwind v4 uses `@import` not config file**: `@import 'tailwindcss'` in CSS + `@tailwindcss/postcss`. No `tailwind.config.js`. Custom utilities and animations registered via CSS `@theme` inline block with `--animate-*` convention.

- **Auth page three conditional branches**: `/auth/signin` has three structurally distinct layouts (signup split, OTP centered dark card, signin compact). Uses `useState` to toggle between them — NOT `router.push` — to prevent layout re-mount and progress bar flicker. See onboarding-flow skill for full auth page details.

- **LandingFooter requires `'use client'` for back-to-top**: `window.scrollTo({ top: 0, behavior: 'smooth' })` requires browser API. Newsletter form is display-only — no API wired, intentional UX stub.

- **HeroSection Spline URL is live**: `https://prod.spline.design/CN1NeDZqows-DMX0/scene.splinecode` — production CDN URL. Desktop only, hidden on mobile via `hidden md:block` wrapper.

---

## Cross-Domain References

- For authentication state in `AuthAwareCTA`, browser client usage, and Supabase session patterns, see **auth-database-multitenancy skill**
- For how `messages/en.json` and `messages/es.json` are consumed by the voice agent, see **voice-call-architecture skill**
- For the `NewLeadEmail` template as called from notifications, see **voice-call-architecture skill** (notifications section)
- For design tokens used in dashboard and onboarding (separate from landing tokens), see **dashboard-crm-system skill**

---

## Important: Keeping This Document Updated

When making changes to any file listed in the File Map above, update the relevant sections of this skill document to reflect the new behavior. This ensures future conversations always have an accurate reference.

Key areas to keep current:
- File Map — if new landing sections or public pages are added
- Pricing tiers — if `pricingData.js` pricing structure changes (new tiers, prices, features)
- i18n section — if new locales are added to `routing.js` or translation file structure changes
- Design tokens (Landing) — if new color tokens or Tailwind conventions are introduced
- Animation system — if `AnimatedSection` gains new direction props or variant patterns
- Contact API — if new inquiry types or email routing is added

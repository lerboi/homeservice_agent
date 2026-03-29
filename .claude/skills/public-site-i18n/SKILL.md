---
name: public-site-i18n
description: "Complete architectural reference for the public marketing site and internationalization — landing page sections, pricing page, about page, contact form with Resend email, navigation, footer, animation system, AuthAwareCTA, next-intl configuration, and translation files. Use this skill whenever making changes to public-facing pages, landing sections, pricing tiers, contact form, navigation, footer, animations, i18n configuration, or translation files. Also use when the user asks about how the marketing site works, wants to modify page design, or needs to debug i18n or animation issues."
---

# Public Site & Internationalization — Complete Reference

This document is the single source of truth for the public marketing site, landing sections, pricing, contact, and internationalization. Read this before making any changes to public pages, landing components, i18n config, or email templates.

**Last updated**: 2026-03-27 (Pricing page conversion optimization: 3-column additive feature cards, separate Enterprise section, ROI calculator, guarantee badge, 3 testimonials, overage rates, 9 FAQs, landing CTAs → /pricing; Phase 29 — hero section interactive demo; Phase 21 — volume-based tiers; Phase 13 — premium dark SaaS redesign)

---

## Architecture Overview

| Layer | Files | Purpose |
|-------|-------|---------|
| **Route Group** | `src/app/(public)/` | All public pages — grouped to inject LandingNav + LandingFooter via shared layout |
| **Public Layout** | `src/app/(public)/layout.js` | Wraps all public pages: LandingNav, main, LandingFooter, Toaster |
| **Landing Page** | `src/app/(public)/page.js` | Homepage: HeroSection + dynamically imported below-fold sections |
| **Landing Sections** | `src/app/components/landing/` | All landing section components + AnimatedSection + LandingNav + LandingFooter |
| **Shared Components** | `src/components/landing/AuthAwareCTA.js` | Auth-aware CTA button (authenticated vs unauthenticated routing) |
| **Hero Demo Block** | `src/app/components/landing/HeroDemoBlock.jsx` | Client wrapper managing input-to-player state transition (dynamic, ssr:false) |
| **Hero Demo Input** | `src/app/components/landing/HeroDemoInput.jsx` | Client component: business name input + loading state + auth-aware skip link |
| **Hero Demo Player** | `src/app/components/landing/HeroDemoPlayer.jsx` | Client component: waveform player with Web Audio API playback + post-play CTA |
| **Demo Voice API** | `src/app/api/demo-voice/route.js` | POST: ElevenLabs TTS for dynamic business name segment; IP rate-limiting (10s) |
| **Static Audio** | `public/audio/demo-{intro,mid,outro}.mp3` | Pre-rendered ElevenLabs demo conversation segments (caller + AI) |
| **Pricing** | `src/app/(public)/pricing/` | Pricing page + tier data + PricingTiers + ComparisonTable + ROICalculator + FAQSection |
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

Hero Demo Flow (Phase 29):
  HeroSection (Server) → HeroDemoBlock (Client, dynamic ssr:false)
    → HeroDemoInput: user enters business name (2+ chars)
        → onClick: POST /api/demo-voice (ElevenLabs TTS for name segment)
                 + fetch /audio/demo-{intro,mid,outro}.mp3 in parallel
        → onAudioReady({ audioBuffers: [intro, name, mid, outro] })
    → HeroDemoPlayer: Web Audio API stitches buffers into single AudioBuffer
        → autoplay, waveform bars progress, elapsed time M:SS
        → on ended: "Start Your Free Trial" CTA appears
```

---

## File Map

| File | Role |
|------|------|
| `src/app/(public)/layout.js` | Route group layout — injects LandingNav + LandingFooter for all public pages |
| `src/app/(public)/page.js` | Landing homepage — HeroSection static, others dynamic with loading skeletons |
| `src/app/(public)/pricing/page.js` | Pricing page — hero, tiers, guarantee badge, ROI calculator, comparison table, testimonials (3), FAQ, CTA banner |
| `src/app/(public)/pricing/pricingData.js` | PRICING_TIERS (3 tiers) + ENTERPRISE_TIER (separate), COMPARISON_FEATURES (14 rows incl. overage), getAnnualPrice() |
| `src/app/(public)/pricing/PricingTiers.jsx` | 3-col tier cards with additive feature pattern, monthly/annual toggle, social proof, Enterprise horizontal card |
| `src/app/(public)/pricing/ROICalculator.jsx` | Interactive "Cost of Missed Calls" widget — slider + job value selector, light-mode on warm stone bg |
| `src/app/(public)/pricing/ComparisonTable.jsx` | Feature comparison grid across all 4 tiers (Server Component, always visible) |
| `src/app/(public)/pricing/FAQSection.jsx` | Radix accordion FAQ — 9 questions incl. mid-cycle upgrade proration |
| `src/app/(public)/about/page.js` | About page — hero, problem stats, mission, how different, values, CTA |
| `src/app/(public)/contact/page.js` | Contact page shell — renders ContactForm |
| `src/app/(public)/contact/ContactForm.jsx` | Contact form with honeypot, client-side validation, Sonner toasts |
| `src/app/api/contact/route.js` | POST /api/contact — Resend per-request, honeypot check, inquiry routing |
| `src/app/components/landing/LandingNav.jsx` | Fixed top nav — transparent → blur on scroll, mobile drawer |
| `src/app/components/landing/LandingFooter.jsx` | Footer — newsletter display, 3-col links, back-to-top button |
| `src/app/components/landing/HeroSection.jsx` | Hero — Spline 3D scene (desktop), RotatingText h1, subtitle, HeroDemoBlock, mobile image fallback |
| `src/app/components/landing/HeroDemoBlock.jsx` | Client wrapper: manages audioBuffers state; renders HeroDemoInput → HeroDemoPlayer transition |
| `src/app/components/landing/HeroDemoInput.jsx` | Business name input bar + "Listen to Your Demo" orange CTA; fetches TTS + static MP3s; auth-aware skip link |
| `src/app/components/landing/HeroDemoPlayer.jsx` | Waveform player: Web Audio API stitching, play/pause, elapsed time, post-play "Start Your Free Trial" |
| `src/app/api/demo-voice/route.js` | POST /api/demo-voice — ElevenLabs TTS for business name segment; validates name; IP rate-limits 10s |
| `public/audio/demo-intro.mp3` | Pre-rendered caller opening line: "Hey, I'd like to get my AC serviced..." |
| `public/audio/demo-mid.mp3` | Pre-rendered mid-conversation: address, slot offer, caller acceptance |
| `public/audio/demo-outro.mp3` | Pre-rendered AI closing: "You're all set — Thursday at 2 PM..." |
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

**`ScrollProgress`**: Milestone dot nav (desktop left sidebar + mobile bottom dots). Hidden while hero section is visible — only appears after hero's bottom edge scrolls past 50% viewport. Hides again at CTA section.

---

## 3. Landing Page Sections

### HeroSection (`src/app/components/landing/HeroSection.jsx`)

Server Component with client sub-components (Phase 29 — stripped to focus attention on demo input):
- **Spline 3D scene**: `SplineScene` (dynamic import, CDN web component, zero bundle impact). URL: `https://prod.spline.design/CN1NeDZqows-DMX0/scene.splinecode`. Desktop-only (hidden on mobile).
- **Mobile fallback**: Static `<Image>` of dashboard mockup — `priority` for LCP. Rendered below hero content.
- **RotatingText**: 21st.dev animated component, rotates `['Competitor', 'Rival', 'Neighbor']` at 3s interval. Title uses forced `<br />` tags to lock line breaks: "Every Missed Call Is a Job Your / {RotatingText} Just / Booked" — prevents shorter words from reflowing lines. **Width behavior**: `useRef` + `getBoundingClientRect()` + `useLayoutEffect` measures current word width, container animates via `transition-[width] duration-200`. In-flow invisible measurement span provides height; animated text is absolutely positioned on top.
- **HeroDemoBlock**: Client component (dynamic, ssr:false) managing the input-to-player demo experience. Replaces the old `AuthAwareCTA` + "Watch Demo" buttons.
- **Background**: `bg-[#050505]` near-black with `min-h-[600px] md:min-h-[700px]` fixed height, radial gradient orange accent, dot grid texture, floating blur orb.
- **Removed in Phase 29**: Eyebrow pill, "Watch Demo" button, social proof row, `AuthAwareCTA` from hero. Attention fully on demo input bar.

### HeroDemoBlock (`src/app/components/landing/HeroDemoBlock.jsx`)

`'use client'`, loaded via `dynamic()` with `ssr: false` from HeroSection.

Manages `audioBuffers` state (`null` or `ArrayBuffer[]`). When `null`, renders `HeroDemoInput`. When populated, unmounts input and renders `HeroDemoPlayer` with `animate-in fade-in slide-in-from-bottom-2 duration-200`. Transition is React state-based (no Framer Motion), satisfying D-12/D-13 (player replaces input in-place, same position).

### HeroDemoInput (`src/app/components/landing/HeroDemoInput.jsx`)

`'use client'`. Props: `onAudioReady({ audioBuffers: ArrayBuffer[] })`.

States: `'idle'` | `'loading'`. Business name validated `>= 2 chars` to enable the CTA button.

On submit: fires 4 parallel fetch calls — `POST /api/demo-voice` + `fetch('/audio/demo-intro.mp3')` + `fetch('/audio/demo-mid.mp3')` + `fetch('/audio/demo-outro.mp3')`. On success, calls `onAudioReady({ audioBuffers: [introBuf, nameBuf, midBuf, outroBuf] })`.

Auth-aware skip link: dynamically imports supabase-browser in `useEffect`, calls `getUser()`. Shows "Go to Dashboard" if logged in, "Skip the demo — Start your free trial" → `/onboarding` if not.

Input bar: `flex-col sm:flex-row` (stacks on mobile), `bg-white/[0.10] border border-white/[0.12] rounded-xl focus-within:ring-1 focus-within:ring-[#F97316]`. Button loading state: `<Loader2 className="animate-spin size-4" /> Generating...`.

### HeroDemoPlayer (`src/app/components/landing/HeroDemoPlayer.jsx`)

`'use client'`. Props: `audioBuffers: ArrayBuffer[]` (order: `[intro, name, mid, outro]`).

Web Audio API: `AudioContext`, decodes all buffers via `decodeAudioData()`. Stitches sequence: `[ringtone] → [pause] → [AI greeting] → [gap] → [caller] → [gap] → [mid conversation] → [gap] → [outro]` with programmatic ringtone (440+480Hz dual tone, 0.8s) and silence gaps (0.6-0.9s) for natural pacing. Subtle phone line noise (`amplitude 0.0005`) mixed into combined buffer. Autoplay on mount. Play/pause/replay via `AudioBufferSourceNode`. Progress tracked via `requestAnimationFrame`.

Waveform: 40 bars (desktop) / 28 bars (mobile via `matchMedia`). Pre-computed `AMPLITUDE` envelope (sine wave, deterministic). **Seekable**: clicking on waveform container seeks to that position via `getBoundingClientRect()` ratio. Active bars (`position < playhead`): `bg-[#F97316]`. Inactive: `bg-white/[0.15]`. Elapsed time: `M:SS` via `tabular-nums`. Reduced motion: flat bars at 40% height.

CTA: "Start Your Free Trial" link → `/onboarding` always visible once player mounts, left-aligned with `rounded-lg`, arrow icon, orange glow hover.

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

**CTA**: Both desktop (`hidden md:inline-flex`) and mobile drawer CTAs link to `/pricing`.

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
  return <Button asChild><Link href="/pricing">Start My 5-Minute Setup</Link></Button>;
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

**Last updated**: 2026-03-27 (Conversion optimization: 3-col additive cards, separate Enterprise, ROI calculator, guarantee badge, 3 testimonials, overage rates, 9 FAQs)

Eight sections in order: dark hero + cards + guarantee badge (`#050505`) → ROI calculator (warm stone `#EDEAE7` with gradient blend to next section) → comparison table (light `#F5F5F4`) → testimonials (dark `#1A1816`) → FAQ (dark `#050505`) → CTA banner (dark warm `#1C1412`).

### Page Section Layout

| # | Section | Background | Notes |
|---|---------|-----------|-------|
| 1 | Hero | `bg-[#050505]` | Compact: smaller headline, tighter spacing to push cards above fold |
| 2 | Billing Toggle + 3 Tier Cards | `bg-[#050505]` (continues) | 3-col grid (Starter/Growth/Scale), social proof line, Enterprise separate below |
| 3 | Guarantee Badge | `bg-[#050505]` (continues) | ShieldCheck icon + "Risk-Free Guarantee" inline in hero section |
| 4 | ROI Calculator | `bg-[#EDEAE7]` | Warm stone bg, bottom gradient blending into comparison table |
| 5 | Comparison Table | `bg-[#F5F5F4]` | Always visible (not collapsible), 14 feature rows incl. overage rate |
| 6 | Testimonials | `bg-[#1A1816]` | Three quotes in `md:grid-cols-3` |
| 7 | FAQ | `bg-[#050505]` | 9 questions — includes mid-cycle upgrade proration |
| 8 | CTA Banner | `bg-[#1C1412]` | CTA links to `/pricing` |

### `pricingData.js` — Tier Data Structure

**Additive feature pattern**: Starter lists 9 core features. Growth/Scale use `inheritsFrom` to show "Everything in X, plus:" with only their differentiators. Enterprise is a separate export.

```js
export const PRICING_TIERS = [
  { id: 'starter', name: 'Starter', monthlyPrice: 99, callLimit: 40, overageRate: 2.48, inheritsFrom: null, features: [9 core features], ... },
  { id: 'growth',  name: 'Growth',  monthlyPrice: 249, callLimit: 120, overageRate: 2.08, inheritsFrom: 'Starter', badge: 'Most Popular', highlighted: true, features: ['Up to 120 calls/month', 'Priority email support'], ... },
  { id: 'scale',   name: 'Scale',   monthlyPrice: 599, callLimit: 400, overageRate: 1.50, inheritsFrom: 'Growth', features: ['Up to 400 calls/month', 'Priority support + onboarding call'], ... },
];

export const ENTERPRISE_TIER = {
  id: 'enterprise', name: 'Enterprise', monthlyPrice: null, callLimit: null,
  cta: 'Contact Us', ctaHref: '/contact?type=sales',
  features: ['Unlimited calls', 'Dedicated account manager', 'Custom integrations', 'Custom SLAs & onboarding'],
};

export function getAnnualPrice(monthlyPrice) { return Math.round(monthlyPrice * 0.8); } // 20% discount

export const COMPARISON_FEATURES = [ ... ]; // 14 rows — calls, overage rate, support level, 9 boolean features, custom integrations
```

**Starter features** (reordered by marketing impact from PDF): AI call answering 24/7, Smart urgency triage, Books appointments on the spot, Instant emergency SMS alerts, Detailed dashboard & analytics, Lead capture & CRM, Google & Outlook Calendar sync, Multi-language support (EN/ES), Recovery SMS fallback.

**Overage rates**: Starter $2.48/call, Growth $2.08/call, Scale $1.50/call. Displayed on cards and in comparison table.

**CTA routing**: Tier cards → `/onboarding?plan={id}&interval={billing}`. Enterprise → `/contact?type=sales`. Bottom CTA banner → `/pricing`.

### `PricingTiers.jsx`

`'use client'` (billing toggle state). Monthly/annual toggle defaults to annual. **3-column grid** (`lg:grid-cols-3`) with `items-stretch` for equal-height cards.

**Social proof line**: "Trusted by 500+ home service contractors across the US" between toggle and cards.

**Growth card elevation**: `lg:scale-[1.04] lg:z-10`, gradient bg `from-[#F97316]/[0.06] to-[#1A1816]`, `ring-2 ring-[#F97316]`. Renders first on mobile via `order-first`.

**Call limit badge**: Prominent `bg-[#F97316]/[0.08] text-[#F97316]/70` pill showing "{N} calls/mo" + overage rate "then $X.XX/call".

**Additive feature rendering**: Starter renders full 9-item feature list. Growth/Scale render "Everything in {inheritsFrom}, plus:" header + 2 additive features only.

**CTA at bottom**: Button pinned to card bottom via `flex-1` on feature list. "14-day free trial · No credit card required" below each CTA.

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

### Guarantee Badge (inline in page.js)

Inside the hero section after PricingTiers. ShieldCheck icon in orange circle + "Risk-Free Guarantee" heading + "Try Voco free for 14 days with real calls. If it doesn't book you a job, you pay nothing." Responsive: `flex-col sm:flex-row`.

### `FAQSection.jsx`

`'use client'` (Radix accordion). **9 questions** in 4 topic areas: setup (Q1-Q2), AI quality (Q3-Q4), trial/billing (Q5-Q8 — includes "What happens if I upgrade mid-cycle?" with proration explanation), data/security (Q9).

Dark accordion styling unchanged. Smooth height transition via Radix CSS variable.

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

**Cookie-based locale, no URL prefix**: The app uses `next-intl` with cookie-based locale switching rather than URL-prefixed routing (e.g., `/es/pricing`). This is required by the API-first multi-tenant architecture — URL prefixes would break webhook routing and OAuth callbacks.

**Single source of truth for language barrier detection**: The voice call system imports `locales` from this file to detect unsupported languages. Any detected_language not in the `locales` array → `language_barrier = true`. Adding a new language means updating both this file AND the translation files.

### Translation Files Structure

Both `messages/en.json` and `messages/es.json` have two top-level sections:

**`agent` section** — used by the LiveKit voice agent (`src/prompt.py`) via direct JSON import (NOT next-intl runtime — the Railway agent runs outside Next.js context):
- `default_greeting`, `recording_disclosure`, `language_clarification`
- `unsupported_language_apology`, `call_wrap_up`, `transfer_attempt`
- `capture_name`, `capture_address`, `capture_job_type`
- `fallback_no_booking`, `language_barrier_escalation`

**`ui` section** — used by Next.js frontend via `next-intl` for UI text translations.

**Direct JSON import vs next-intl**: `build_system_prompt()` on Railway imports `messages/en.json` and `messages/es.json` directly (not via next-intl provider). This is because it runs in a Python process with no Next.js context. Frontend components use `next-intl`'s `useTranslations()` hook normally.

Cross-domain: See voice-call-architecture skill for how `buildSystemPrompt()` uses translation files.

---

## 12. Design Tokens (Landing)

Landing pages use a separate set of design tokens from the dashboard. These are NOT in `src/lib/design-tokens.js` (which is dashboard/onboarding). Landing tokens are expressed directly as Tailwind utilities.

| Token | Hex Value | Usage |
|-------|-----------|-------|
| Hero/Footer background | `#050505` / `#090807` | Near-black, deepest dark surfaces |
| Accent orange | `#F97316` | CTAs, active links, accent highlights |
| Section light | `#F5F5F4` | Alternating light sections (HowItWorks, Social Proof, Comparison Table) |
| Warm stone | `#EDEAE7` | ROI Calculator section — distinct from `#F5F5F4`, gradient-blended at bottom |
| Muted text | `#475569` | Body text on light backgrounds |
| Success / brand | `#166534` | Not prominent on landing (used in badge variants) |
| About page navy | `#0F172A` | Shared with dashboard |
| About page accent | `#C2410C` | Darker orange for about/contact (matches dashboard brandOrange) |

**Tailwind v4 pattern**: Landing uses `@import 'tailwindcss'` in CSS + `@tailwindcss/postcss` plugin. No `tailwind.config.js`. Custom animation variants registered via `--animate-*` convention in `@theme` inline block.

---

## 13. Key Design Decisions

- **(public) route group for layout injection**: The `(public)` route group applies `LandingNav` + `LandingFooter` to all public pages without repeating them in each page component. Parentheses in the folder name exclude it from the URL path.

- **Cookie-based locale without URL prefix**: next-intl configured without URL prefix routing. API-first multi-tenant constraint — URL-prefixed routing would break Stripe webhooks and OAuth callbacks that expect fixed path patterns.

- **next-intl for client, direct JSON import for agent**: The LiveKit voice agent (Railway) runs outside Next.js — it imports translation JSON directly. Frontend uses next-intl runtime. Two consumers, two import strategies.

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

- **Hero demo uses HeroDemoBlock wrapper (Phase 29)**: Rather than wiring HeroDemoInput and HeroDemoPlayer directly into HeroSection, a HeroDemoBlock client wrapper manages the `audioBuffers` state and transition. This keeps HeroSection a Server Component — it only needs to dynamically import `HeroDemoBlock` once, not multiple client components.

- **Direct fetch() to ElevenLabs REST API (Phase 29)**: `/api/demo-voice` calls ElevenLabs directly via `fetch()` rather than using the `elevenlabs` npm SDK. Single-endpoint use case; no SDK overhead. Uses `eleven_multilingual_v2` model with `mp3_44100_128` output format.

- **IP-based rate limiting on demo-voice (Phase 29)**: `demo-voice` route applies a 10-second per-IP rate limit using a module-level `Map`. Prevents rapid repeated demo calls from abusing ElevenLabs quota. Cleanup removes entries older than 60 seconds to prevent memory leak.

- **RotatingText dynamic width via getBoundingClientRect (Phase 29)**: RotatingText now measures the current word's rendered width (not the longest word) via `useRef` on a hidden measurement span + `getBoundingClientRect()` in `useLayoutEffect`. Container width animates with `transition: width 200ms ease`. Words `['Competitor', 'Rival', 'Neighbor']` — all 8 chars — ensure small delta between width states. Replaces the invisible sizer span that caused fixed-width container.

---

## 14. Environment Variables

| Variable | Used By | Description |
|----------|---------|-------------|
| `ELEVENLABS_API_KEY` | `src/app/api/demo-voice/route.js` | ElevenLabs TTS API key (server-side only, never exposed to client) |
| `ELEVENLABS_VOICE_ID_AI` | `src/app/api/demo-voice/route.js` | Voice ID for AI receptionist dynamic name segment |
| `ELEVENLABS_VOICE_ID_CALLER` | Pre-render only | Voice ID for caller (used when pre-rendering static MP3 segments; not used at runtime) |
| `RESEND_API_KEY` | `src/app/api/contact/route.js` | Resend API key for contact form email dispatch |
| `RESEND_FROM_EMAIL` | `src/app/api/contact/route.js` | Sender email address |
| `CONTACT_EMAIL_SALES` | `src/app/api/contact/route.js` | Recipient for sales inquiry type |
| `CONTACT_EMAIL_SUPPORT` | `src/app/api/contact/route.js` | Recipient for support inquiry type |
| `CONTACT_EMAIL_PARTNERSHIPS` | `src/app/api/contact/route.js` | Recipient for partnerships inquiry type |
| `CONTACT_EMAIL_FALLBACK` | `src/app/api/contact/route.js` | Fallback recipient when no type-specific address configured |

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

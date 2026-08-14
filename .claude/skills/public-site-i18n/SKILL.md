---
name: public-site-i18n
description: "Complete architectural reference for the public marketing site and internationalization — landing page sections, pricing page, about page, contact form with Resend email, navigation, footer, animation system, AuthAwareCTA, next-intl configuration, and translation files. Use this skill whenever making changes to public-facing pages, landing sections, pricing tiers, contact form, navigation, footer, animations, i18n configuration, or translation files. Also use when the user asks about how the marketing site works, wants to modify page design, or needs to debug i18n or animation issues."
---

# Public Site & Internationalization — Complete Reference

This document is the single source of truth for the public marketing site, landing sections, pricing, contact, and internationalization. Read this before making any changes to public pages, landing components, i18n config, or email templates.

**Last updated**: 2026-08-14 (Landing polish pass — feel/latency only, zero content or functionality changes. **page.js restructured**: the 4 Server Component sections (IntegrationsStrip, CostOfSilenceBlock, YouStayInControlSection, FinalCTASection) are now STATIC imports (they render in initial HTML, no skeleton ever); only the 3 `'use client'` sections (AudioDemoSection, FeaturesCarousel, FAQSection) remain `next/dynamic`, and their loading fallbacks were changed from gray pulsing cards to quiet height-reserving blanks matching each section's real background. New `PreloadSections.jsx` client component (renders null, mounted first in `<main>`) warms the 3 dynamic chunks via `requestIdleCallback` (300ms setTimeout fallback) so fallbacks almost never paint. **AnimatedSection.jsx retimed**: section reveal 0.2s→0.6s, offset 32→24px; AnimatedItem 0.2s→0.55s, y 24→20; stagger 0.05→0.08 (same ease `[0.22,1,0.36,1]`, reduced-motion behavior unchanged). **HeroSection**: halo ring delays respaced to even thirds of the 3.2s cycle (0/1.07/2.14 — was 0/0.8/1.6 which left a visible pause); both CTAs got hover lift (`hover:-translate-y-0.5 active:translate-y-0`, scoped transitions, shadow moved from inline style to Tailwind classes so hover shadow works, arrow nudge on primary); new copper hairline seam (`h-px` 90° gradient) at the hero's bottom edge softening the dark→white cut into AudioDemoSection. **LandingNav**: constant `backdrop-blur-md` (was blur toggling with scroll state), `transition-all duration-500`→`transition-[background-color,box-shadow] duration-300`, bg opacities 80/95→70/90; logo intrinsic dims fixed to real 1.79:1 aspect (172×96, was 140×44 mismatch) and desktop size smoothed `md:h-14`→`md:h-12`; drawer logo `width/height auto` inline-style conflict removed (143×80, `h-8 w-auto`). **LandingFooter**: same logo fix (129×72, `h-9 w-auto`, conflicting inline style removed); back-to-top arrow gets `group-hover:-translate-y-0.5`. **CostOfSilenceBlock**: "Run your own numbers" link arrow gets the same group-hover nudge as CTAs. Note: the logo source PNG is 2752×1536/921KB but next/image optimization is enabled (no `unoptimized` flag), so browsers receive resized variants.) Previous entry: 2026-06-10 (Landing + pricing conversion audit fixes. **AudioDemoSection auto-scroll bug fixed**: `audio.load()` fires a `timeupdate` at `currentTime=0` on mount; the first transcript line spans `startSec: 0`, so `activeLineIndex` became 0 without playback and the transcript-follow `scrollIntoView` effect scrolled the page ~450px down on every desktop load. Fix: `onTime` now early-returns while `audio.paused`, and the follow effect is gated on `isPlaying` — do NOT remove either guard. Also: tab switcher stray `·` separator removed (tabs now use `gap-7`), waveform first bar no longer orange at progress 0 (`progress > 0 &&` guard). **CostOfSilenceBlock**: stat corrected to $260,520 (was $260,400, inconsistent with its own 3 × $1,670 × 52 math); caption reframed from "the average trade business loses this much" to "What 3 missed calls a week adds up to over a year". **PricingTiers**: "Most Popular" badge now floats centered on the Growth card's top border (`absolute -top-3 left-1/2 -translate-x-1/2`) instead of sitting inline in CardHeader, so all three card headers align; Starter list gets a "WHAT'S INCLUDED:" header mirroring the additive "Everything in X, plus:" line; feature rows use `space-y-2.5` + `leading-snug`. **pricingData**: Starter trimmed 10→8 features (merged triage+alerts, dashboard+CRM; "Multi-language support" without EN/ES qualifier to match the landing 70+-languages claim); Growth/Scale now have 3 value-framed differentiators each ("3×/10× the call volume", "Lower/Lowest overage rate", support tier) so the highlighted card no longer looks empty next to Starter; comparison row renamed 'Multi-language support'. **LandingFooter**: dead `/#how-it-works` link (anchor deleted in 48.1) replaced with "Hear a demo" → `/#audio-demo`; placeholder social links (bare twitter.com/linkedin.com/github.com) removed — re-add only with real profile URLs. Note: pricing page has diverged from the older notes below — current sections are hero+tiers+guarantee (#050505), ROI calculator `#calculator` (#EDEAE7, inline-sentence selects + red loss number + $79 answer), comparison table (#F5F5F4), FAQ (#050505), CTA banner (#1C1412); testimonials section was removed. HeroSection no longer uses Spline — right-hand visual is the CSS `VoiceWave` orb (halo rings + animated bars, desktop only); H1 is "Stop losing $1,000+ every time you miss a call." with primary CTA → /auth/signin and secondary anchor → #audio-demo. Demo MP3s are still 3-second stubs while transcripts span 24–30s — waveform progress outruns the transcript until real recordings replace them.) Previous entry: 2026-04-16 (Phase 48.1 post-UAT design iterations — container-less typography-first redesign applied to AudioDemoSection, IntegrationsStrip, YouStayInControlSection. AudioDemo: removed the dark call card; now has left-aligned "Hear Voco handle a real call." hero + 64-bar inline waveform next to a 64px play button + flowing dialogue transcript (72px small-caps speaker labels + 19–21px text, muted until audio reaches line). IntegrationsStrip: 5 main integrations (Google Calendar, Outlook Calendar, Jobber, Xero, WhatsApp) rendered with inline SVG brand marks at 44px/64px responsive sizing, plus a "COMING SOON" divider + 2 grayscale logos (Housecall Pro, ServiceTitan). Zapier removed. Layout is logos-left / text-right on desktop (max-w-4xl), text-above / logos-below on mobile. YouStayInControl: 3 visual screenshot-style mocks (VipListMock = contacts list with ⭐→You/Voco routing pills; HoursMock = 7-day grid with dark/orange cells + legend; NotificationMock = phone-style text card with EMERGENCY badge + Transcript/Recording/Confirm row). Old WHO/WHEN/WHAT cards + CARD_CLS + STAT_CHIP_CLS + 3-paragraph identity intro + dark "You set the rules. Voco follows them." pull-quote all removed. FAQChatWidget: fixed h-[520px] max-h-[80vh] (stops growing with conversation), explicit input text-[#0F172A] + caret-[#F97316], inline markdown link renderer parses [label](url) into orange underlined anchors. ScrollProgress roadmap updated: dots now Hear Voco / Features / FAQ / Get Started (added id="faq" to FAQSection). Previous entry: Phase 48.1 initial ship — revenue-recovery repositioning pivot; 8 content sections; deleted 12 legacy components; "Voco AI" naming scope per D-27: page metadata + hero sub only; body copy elsewhere stays "Voco". Landing page components do NOT use useTranslations — all copy is hardcoded in JSX.)

---

## Architecture Overview

| Layer | Files | Purpose |
|-------|-------|---------|
| **Route Group** | `src/app/(public)/` | All public pages — grouped to inject LandingNav + LandingFooter via shared layout |
| **Public Layout** | `src/app/(public)/layout.js` | Wraps all public pages: LandingNav, main, LandingFooter, Toaster, PublicChatButton |
| **Landing Page** | `src/app/(public)/page.js` | Homepage: HeroSection + dynamically imported below-fold sections |
| **Landing Sections** | `src/app/components/landing/` | All landing section components + AnimatedSection + LandingNav + LandingFooter |
| **Shared Components** | `src/components/landing/AuthAwareCTA.js` | Auth-aware CTA button (authenticated vs unauthenticated routing) |
| **Audio Demo** | `src/app/components/landing/AudioDemoSection.jsx` | 2-tab underline-style call demo (Emergency / Routine) with 64-bar inline waveform next to a 64px play button, flowing dialogue transcript (small-caps VOCO/CALLER labels + 19–21px text), `__vocoPlayingAudio` singleton, 'use client' |
| **Demo Audio Stubs** | `public/audio/demo-emergency.mp3`, `public/audio/demo-routine.mp3` | Stub audio files (copies of demo-intro.mp3) — replace with real Gemini voice recordings before production |
| **Static Audio** | `public/audio/demo-{intro,mid,outro}.mp3` | Pre-rendered ElevenLabs demo conversation segments (legacy, kept for AudioPlayerCard) |
| **Pricing** | `src/app/(public)/pricing/` | Pricing page + tier data + PricingTiers + ComparisonTable + ROICalculator + FAQSection |
| **About** | `src/app/(public)/about/page.js` | Mission, problem, values, "why Voco" sections |
| **Contact** | `src/app/(public)/contact/` | Contact page + ContactForm.jsx |
| **Contact API** | `src/app/api/contact/route.js` | POST handler — Resend email dispatch |
| **i18n** | `src/i18n/routing.js`, `messages/en.json`, `messages/es.json` | next-intl config, English + Spanish translations |
| **Public Chat FAB** | `src/components/landing/PublicChatButton.jsx` | Floating action button (64px, Headset icon) + "Ask Voco AI" speech bubble — opens/closes chat panel |
| **Public Chat Panel** | `src/components/landing/PublicChatPanel.jsx` | Chat panel UI — message list, input, Groq AI responses, reuses TypingIndicator + ChatNavLink from dashboard |
| **Public Chat API** | `src/app/api/public-chat/route.js` | Unauthenticated POST endpoint — IP rate limiting (5s per IP, 1000/day global cap), Groq Llama 4 Scout |
| **Chatbot Knowledge** | `src/lib/public-chatbot-knowledge/` | 6 markdown knowledge docs + `index.js` RAG retrieval (route map + keyword map) |
| **Message Parser** | `src/lib/parse-message-content.js` | Extracts markdown links from AI messages — optional `linkPattern` param for public route links |
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

Audio Demo Flow (Phase 48.1):
  HeroSection (static) → AudioDemoSection (dynamic, ssr:false, id="audio-demo")
    → 2 pill tabs: Emergency / Routine — tab switch pauses + resets audio, swaps transcript
    → AudioPlayerCard-style player: 24-bar waveform, play/pause, MM:SS elapsed
    → Synchronized transcript: timeupdate drives active-line highlight (orange, border-l-2)
    → __vocoPlayingAudio singleton: starting a tab pauses any other playing audio globally
    → Error fallback: "Audio unavailable — read the full transcript below."

Legacy Hero Demo Flow (Phase 29 — removed in Phase 48.1):
  HeroSection → HeroDemoBlock (deleted) → HeroDemoInput / HeroDemoPlayer (deleted)

Public Chatbot Flow:
  PublicChatButton (FAB, fixed bottom-right, all public pages via layout.js)
    → click: opens PublicChatPanel (slide-up dialog)
    → user types message → POST /api/public-chat
        → IP rate limit check (5s cooldown, 1000/day global cap)
        → RAG: getPublicKnowledge(message, currentRoute) → route map + keyword map → up to 2 markdown docs
        → Groq Llama 4 Scout chat completion (system prompt with knowledge + language detection)
        → response rendered with parseMessageContent() using PUBLIC_LINK_REGEX for navigation links
        → ChatNavLink components for in-message navigation (closes panel on click)
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
| `src/app/components/landing/HeroSection.jsx` | Phase 48.1 — Spline 3D scene (desktop), revenue-pain H1 ("Stop losing $1,000+…"), dual CTA (primary: **/pricing** since 2026-06-13; secondary: #audio-demo anchor), trust row, mobile warm glow. No RotatingText on H1, no HeroDemoBlock. |
| `src/app/components/landing/AudioDemoSection.jsx` | Phase 48.1 (post-UAT iteration) — `'use client'`. Container-less: hero H2 "Hear Voco handle a real call." left-aligned; underline-style tab switcher (Emergency / Routine); 64-bar full-width inline waveform next to a 64px hero play button; transcript below as flowing dialogue (72px small-caps VOCO/CALLER label column + 19–21px sentences, muted gray until active, then dark). `__vocoPlayingAudio` pause-singleton preserved. `preload="metadata"`. `id="audio-demo"` (hero CTA anchor target). No dark card, no chat bubbles. |
| `src/app/components/landing/IntegrationsStrip.jsx` | Phase 48.1 (post-UAT iteration) — 5 main integrations rendered with inline SVG brand marks at `w-11 h-11 md:w-16 md:h-16`: Google Calendar, Outlook Calendar, Jobber, Xero, WhatsApp. Below: `COMING SOON` eyebrow + hairline divider + 2 grayscale logos: Housecall Pro, ServiceTitan. Zapier removed. Layout: desktop 2-col with logos-left (3-col subgrid) and right-aligned editorial heading "Plays nice with what you already run." (max-w-4xl mirrors AudioDemoSection width); mobile stacks text above logos. No tiles, no cards. Inside ScrollLinePath. |
| `src/app/components/landing/CostOfSilenceBlock.jsx` | Phase 48.1 — Static $260,400/year stat block. H2: "The math isn't close". Orange underline accent on stat. "Calculate yours →" links to /pricing#calculator. Centered single-column layout. Inside ScrollLinePath. |
| `src/app/components/landing/FeaturesCarousel.jsx` | Phase 48.1 — Trimmed 9→4 pillars: 1. 24/7 AI Answering, 2. Real-Time Calendar Booking, 3. Speaks Your Trade (trade vocabulary + EN/ES auto-detected — language claims cut to honest EN+ES on 2026-06-13), 4. Automated Lead Recovery. Owns `id="features"` (ScrollLinePath anchor — do NOT remove). Auto-advance, chevron nav, pill indicators, useReducedMotion. Inside ScrollLinePath. |
| `src/app/components/landing/YouStayInControlSection.jsx` | Phase 48.1 (post-UAT iteration) — single white section, editorial hero ("YOUR RULES, YOUR WAY" eyebrow + "You Stay in Control." H2 + one-line subcopy about "three dials"). Three concrete screenshot-style mocks defined inline: `VipListMock` (contacts list with ⭐ rows routed to "→ You" green pill vs unknown caller routed to "→ Voco" orange pill), `HoursMock` (7-day grid, dark cells = You, orange cells = Voco + legend), `NotificationMock` (phone-style text card: "Water heater leak · 1247 Oak St" with red EMERGENCY badge + Transcript / Recording / Confirm action row). Action-framed captions below each mock ("Pick the contacts…", "Set the hours…", "Choose what Voco sends you…"). Old 3-paragraph identity intro + WHO/WHEN/WHAT text cards + CARD_CLS + STAT_CHIP_CLS + dark "You set the rules. Voco follows them." pull-quote all removed. OUTSIDE ScrollLinePath. |
| `src/app/components/landing/FAQChatWidget.jsx` | Phase 48.1 (post-UAT iteration) — fixed `h-[520px] max-h-[80vh]` container (no longer grows with conversation). Input has explicit `text-[#0F172A] caret-[#F97316]` for visibility. Assistant replies run through `renderAssistantContent()` — an inline renderer that splits on `/\[([^\]]+)\]\(([^)\s]+)\)/g` and emits `<a>` nodes (internal paths as plain href; `https://` URLs with `target="_blank" rel="noopener"`). User messages still render as plain text. `whitespace-pre-wrap` preserves line breaks from API replies. |
| `src/app/components/landing/ScrollProgress.jsx` | Phase 48.1 (post-UAT iteration) — left-side fixed desktop roadmap + mobile bottom pill. `sections` array updated to match new landing inventory: `audio-demo` → "Hear Voco", `features` → "Features", `faq` → "FAQ", `cta` → "Get Started". Old `how-it-works` and `testimonials` targets removed (source sections no longer exist). Requires matching `id="faq"` on FAQSection outer `<section>`. |
| `src/app/components/landing/FeaturesGrid.jsx` | (Legacy) Bento grid layout — still exists but no longer imported by homepage |
| `src/app/components/landing/FinalCTASection.jsx` | Dark CTA ribbon — `bg-[#1C1412]`, CSS-only reduced-motion guard. |
| `src/app/components/landing/AudioPlayerCard.jsx` | Phase 47 — `'use client'` mini-player pattern. Coordinates via `window.__vocoPlayingAudio` singleton. Kept as supporting component; AudioDemoSection extends this pattern. |
| `src/app/components/landing/FAQSection.jsx` | Phase 48.1 updated — OBJ-01 FAQ accordion (9 Q&A: 7 original + q8 language coverage + q9 high-ticket/complex jobs). "Hear it yourself" link updated from #hero → #audio-demo. `'use client'` (Radix Accordion); embeds FAQChatWidget. |
| `src/app/components/landing/FAQChatWidget.jsx` | Phase 47 — `'use client'` chat island posting to `/api/public-chat`. History capped at 10 entries client-side. |
| `src/app/components/landing/ScrollLinePath.jsx` | Decorative copper sine-wave SVG. Phase 48.1: wraps exactly 3 children — IntegrationsStrip, CostOfSilenceBlock, FeaturesCarousel (owns `id="features"` — wave start-dot). `id="testimonials"` no longer exists (SocialProofSection deleted); ScrollLinePath 65%-height fallback handles this gracefully. |
| `src/app/components/landing/AnimatedSection.jsx` | Framer Motion scroll-triggered animation (AnimatedSection, AnimatedStagger, AnimatedItem) — 0.6s/24px reveals, 0.08 stagger (2026-08-14) |
| `src/app/components/landing/PreloadSections.jsx` | 2026-08-14 — `'use client'`, renders null. Idle-preloads the 3 code-split landing chunks (AudioDemoSection, FeaturesCarousel, FAQSection) via `requestIdleCallback` so dynamic() fallbacks almost never paint |
| `src/components/landing/AuthAwareCTA.js` | CTA button — routes authenticated users to /dashboard, new users to /onboarding |
| `src/components/landing/PublicChatButton.jsx` | Floating 64px FAB (Headset icon) + "Ask Voco AI" speech bubble — toggles chat panel open/closed |
| `src/components/landing/PublicChatPanel.jsx` | Chat panel: message list, input, Groq AI responses, reuses TypingIndicator + ChatNavLink from dashboard |
| `src/app/api/public-chat/route.js` | POST /api/public-chat — unauthenticated, IP rate limiting (5s + 1000/day cap), Groq Llama 4 Scout |
| `src/lib/public-chatbot-knowledge/index.js` | RAG retrieval — route map + keyword map → reads up to 2 markdown knowledge docs |
| `src/lib/public-chatbot-knowledge/overview.md` | Knowledge doc: Voco product overview |
| `src/lib/public-chatbot-knowledge/pricing.md` | Knowledge doc: pricing plans and tiers |
| `src/lib/public-chatbot-knowledge/features.md` | Knowledge doc: feature descriptions |
| `src/lib/public-chatbot-knowledge/how-it-works.md` | Knowledge doc: setup and how it works |
| `src/lib/public-chatbot-knowledge/faq.md` | Knowledge doc: frequently asked questions |
| `src/lib/public-chatbot-knowledge/contact.md` | Knowledge doc: contact and sales info |
| `src/lib/parse-message-content.js` | Parses AI message text, extracts markdown links — optional `linkPattern` param for public route links |
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
import PublicChatButton from '@/components/landing/PublicChatButton';

export default function PublicLayout({ children }) {
  return (
    <>
      <LandingNav />
      <main className="relative">{children}</main>
      <LandingFooter />
      <Toaster richColors position="top-center" />
      <PublicChatButton />
    </>
  );
}
```

The `(public)` Next.js route group applies `layout.js` to all routes inside it (`/`, `/pricing`, `/about`, `/contact`) without affecting the URL. `LandingNav` and `LandingFooter` are NOT placed inside individual page components — they're injected once via the layout.

The `Toaster` (from sonner) is placed in the root layout so ContactForm toast notifications work across all public pages.

`PublicChatButton` is mounted at the layout level so the floating chat FAB appears on all public pages. It is a direct import (not dynamic) — lightweight client component with no heavy dependencies.

---

## 2. Landing Page Structure

**File**: `src/app/(public)/page.js`

**Static imports (2026-08-14)**: `HeroSection` (best LCP) plus all Server Component sections — `IntegrationsStrip`, `CostOfSilenceBlock`, `YouStayInControlSection`, `FinalCTASection`. These render in the initial HTML with no loading state.

**Dynamic imports (client sections only)**: `AudioDemoSection`, `FeaturesCarousel`, `FAQSection` — code-split via `next/dynamic`. Loading fallbacks reserve height (AudioDemo h-[420px], FeaturesCarousel h-[560px], FAQ h-[400px]) but are visually quiet: plain blocks on the section's real background color, no gray pulsing card. `PreloadSections` (client, renders null, mounted first inside `<main>`) warms these 3 chunks on `requestIdleCallback` (setTimeout 300ms fallback) so the fallbacks almost never paint.

**Page structure (2026-08-14):**
```
<main>
  <ScrollProgress />
  <PreloadSections />                ← client, renders null — idle-preloads the 3 dynamic chunks
  <HeroSection />                    ← static import
  <AudioDemoSection />               ← dynamic ('use client'), id="audio-demo"
  <ScrollLinePath>
    <IntegrationsStrip />            ← static (Server Component)
    <CostOfSilenceBlock />           ← static (Server Component)
    <FeaturesCarousel />             ← dynamic ('use client'), id="features" (ScrollLinePath anchor)
  </ScrollLinePath>
  <YouStayInControlSection />        ← static (Server Component), OUTSIDE ScrollLinePath
  <FAQSection />                     ← dynamic ('use client')
  <FinalCTASection />                ← static (Server Component)
</main>
```

**`ScrollProgress`**: Milestone dot nav (desktop left sidebar + mobile bottom dots). Hidden while hero section is visible — only appears after hero's bottom edge scrolls past 50% viewport. Hides again at CTA section.

---

## 3. Landing Page Sections

### HeroSection (`src/app/components/landing/HeroSection.jsx`)

Phase 48.1 rewrite — static import for best LCP:
- **H1** (exact, locked): `Stop losing $1,000+ every time you miss a call.` — declarative, loss-framed, no RotatingText.
- **Sub**: `Voco AI answers, triages, and books every call — in under 1 ring.` — single in-body use of "Voco AI" (D-27).
- **Primary CTA**: `Start my 5-minute setup` — orange button, links to **`/pricing`** (2026-06-13: was `/auth/signin`, which skipped plan selection and forced a "Choose a plan" detour at checkout — the funnel is pricing-first). Min 44px height.
- **Secondary CTA**: `Hear Voco in action` — ghost button, anchors `#audio-demo`.
- **Trust row**: `14-day free trial · Cancel anytime · 5-minute setup` — dot-separated, `text-white/50`. (The old language micro-proof line is gone; language claims site-wide were cut to honest EN+ES on 2026-06-13 — the cascade pipeline's Deepgram nova-3 `language=multi` STT does not cover Mandarin/Malay/Tagalog/Vietnamese/Hokkien/Singlish.)
- **Spline 3D scene**: preserved on desktop (`hidden md:block`), hidden on mobile.
- **Background**: `bg-[#050505]` with radial gradient orange overlay + grid texture + floating orb.
- **HeroDemoBlock removed** (Phase 48.1): replaced by 2-CTA layout. HeroDemoBlock, HeroDemoInput, HeroDemoPlayer all deleted from repo.

### AudioDemoSection (`src/app/components/landing/AudioDemoSection.jsx`)

Phase 48.1 — `'use client'`, `ssr:false`. Section 2 on the page (after Hero). `id="audio-demo"` (anchor target for hero primary CTA). Background: `bg-white`. 2 pill tabs (Emergency / Routine): active tab `bg-[#F97316]/10 border-[#F97316]/30 text-[#F97316]`, idle `text-[#475569]`. Player: 24-bar waveform, play/pause (min 44px), MM:SS. Transcript: `timeupdate` drives active-line highlight (orange, `border-l-2 border-[#F97316] pl-2`, weight 600); inactive lines `text-[#475569]` weight 400. `__vocoPlayingAudio` singleton pauses other players on play. Tab switch: pause + currentTime=0 + state reset before swap. Error fallback: "Audio unavailable — read the full transcript below." `preload="metadata"` on all audio elements.

### IntegrationsStrip (`src/app/components/landing/IntegrationsStrip.jsx`)

Phase 48.1 (post-UAT iteration) — Section 3. Inside ScrollLinePath. Background: `bg-[#FAFAF9]`. Editorial layout in `max-w-4xl` container mirroring AudioDemoSection width. Eyebrow: "YOUR STACK, NOT OURS". H2: "Plays nice with what you already run." Subcopy: one-line pitch about calendars + CRMs + no migration weekend. Desktop grid-cols-2: logos on the left (order-1), right-aligned text block on the right (order-2). Mobile (single column): text first (order-1), logos below (order-2). Main integrations rendered via 3-col subgrid with inline SVG brand marks in `IntegrationLogo` switch — Google Calendar (white tile + blue bar + "31" glyph), Outlook Calendar (dual-tone envelope), Jobber (green circle + italic J), Xero (teal circle + white X), WhatsApp (green circle + phone-glyph path). Logo sizes: `w-11 h-11` mobile, `w-16 h-16` desktop. Below the main row: eyebrow "COMING SOON" + hairline divider + 3-col grid with 2 muted logos (Housecall Pro, ServiceTitan) rendered with CSS `grayscale opacity-60` on both the logo tile and name. Each logo cell stacks vertically (logo on top, name label below). Static display only.

### CostOfSilenceBlock (`src/app/components/landing/CostOfSilenceBlock.jsx`)

Phase 48.1 — Section 4. Inside ScrollLinePath. Background: `bg-white`. H2: "The math isn't close". Stat: `$260,400/year` at `text-5xl md:text-6xl font-semibold` with orange underline accent. Supporting copy explains math (3 missed calls/week × avg ticket × 52 weeks). CTA link: "Calculate yours →" at `text-[#F97316] font-semibold` pointing to `/pricing#calculator`. Centered single-column layout (`max-w-xl mx-auto text-center`).

### FeaturesCarousel (`src/app/components/landing/FeaturesCarousel.jsx`)

Phase 48.1 trimmed — Section 5. Inside ScrollLinePath. 4 pillars (narrative order: coverage → conversion → comprehension → safety net): 1. 24/7 AI Answering, 2. Real-Time Calendar Booking, 3. Speaks Your Trade (includes Singlish, code-switching, 70+ languages), 4. Automated Lead Recovery. `id="features"` on outer `<section>` — **do NOT remove**, ScrollLinePath wave start-dot depends on it. `'use client'`, auto-advance, chevron nav, pill indicators, `useReducedMotion`. Background: `#FAFAF9`.

**Legacy note**: `FeaturesGrid.jsx` still exists but is not imported anywhere active.

### YouStayInControlSection (`src/app/components/landing/YouStayInControlSection.jsx`)

Phase 48.1 (post-UAT iteration) — Section 6. OUTSIDE ScrollLinePath (after `</ScrollLinePath>`). Single white section (the dark "You set the rules. Voco follows them." pull-quote was removed per design iteration). Editorial hero in `max-w-5xl`: eyebrow "YOUR RULES, YOUR WAY", H2 "You Stay in Control.", subcopy framing three controls as "three dials — who Voco answers for, when it picks up, and how it reports back. Change them anytime, or leave the smart defaults on." Below: 3-col grid (single column on mobile) of `ControlColumn` cells. Each cell contains a `min-h-[200px] md:min-h-[220px]` gradient-bg tile housing a visual mock, then an action-framed label + caption beneath. The three mocks (all inline components, no external dependencies): **VipListMock** — 3-row contacts list styled like a lightweight CRM, rows with ⭐ star avatars for regulars routed to "→ You" (green pill) and a phone-icon avatar for "Unknown caller" routed to "→ Voco" (orange pill). **HoursMock** — 7-day weekly schedule grid, each day row has 6 cells; Mon–Fri cells 3–4 are dark (`bg-[#0F172A]` = You), remaining are orange (`bg-[#F97316]` = Voco); Sat–Sun all orange; micro-legend above shows color code. **NotificationMock** — phone-style notification card, orange Bell icon, "Voco · Call handled · 1 min ago" header, red `EMERGENCY` badge, "Water heater leak · 1247 Oak St" body, "Customer wants tech ASAP. Slot held: 6:30 PM." subcopy, then a divider with Transcript / Recording / Confirm action row (all orange). Captions: "Pick the contacts who always ring straight through to your phone." / "Set the hours Voco answers and the hours calls come direct to you." / "Choose what Voco sends you after a call — urgency, transcript, one-tap callback." No CARD_CLS or STAT_CHIP_CLS — mocks use their own minimal styling.

### AudioPlayerCard (`src/app/components/landing/AudioPlayerCard.jsx`)

Phase 47 supporting component (kept) — `'use client'` mini-player. Plays audio via `HTMLAudioElement`. 24-bar waveform, orange play/pause, `m:ss` time. `window.__vocoPlayingAudio` singleton (pause-other rule). `preload="metadata"`. AudioDemoSection extends this pattern without directly importing this file.

### FAQSection (`src/app/components/landing/FAQSection.jsx`)

Phase 48.1 updated — `'use client'` (Radix Accordion). 9 Q&A entries (7 original + q8 language coverage: **fluent EN+ES, auto-detected, more on the roadmap** (truth-aligned 2026-06-13) + q9 high-ticket/complex jobs). "Hear it yourself" link updated to `#audio-demo` (was `#hero`). Two-column grid (`lg:grid-cols-[3fr_2fr]`) on `bg-white`; right column: FAQChatWidget. Mobile stacks chat below accordion.

### FAQChatWidget (`src/app/components/landing/FAQChatWidget.jsx`)

Phase 47 supporting component — `'use client'` chat island embedded in FAQSection's right column. POSTs to the existing `/api/public-chat` route with body `{ message, currentRoute: '/', history }` where `history` is capped at 10 messages via `messages.slice(-10)` (Pitfall 3). Initial state shows 3 locked suggestion chips ("Does it really sound natural?", "How long does setup take?", "What does it cost?"). Send button is 36×36 (`w-9 h-9 rounded-xl bg-[#F97316]`) with `aria-label="Send message"`. All API failures (rate limit, 503, network error) surface as the same friendly one-liner — `ERROR_COPY = "Couldn't connect right now — try refreshing the page."` — single source of truth. Input and submit button are both disabled while `isLoading` is true (Pitfall 7). Auto-scrolls to the latest message via a ref-guarded `useEffect` on `threadRef.current.scrollHeight`. User messages right-aligned orange; bot messages left-aligned stone.

### FinalCTASection (`src/app/components/landing/FinalCTASection.jsx`)

Server Component — stays server-side, no `useReducedMotion` hook. CSS-only prefers-reduced-motion guard:
```css
@media (prefers-reduced-motion: reduce) { .animate-* { animation: none; } }
```
Background: `#1C1412` (very dark warm brown). Headline "Your next emergency call is tonight." Subtitle (REPOS-02, Phase 47-05): "Your rules. Your schedule. Your customers. Voco just makes sure you don't miss the next one. Live in 5 minutes — cancel anytime." (the old "no credit card" close was removed — checkout requires a card). CTA button: inverted style (bg-white/dark text) on copper background for high contrast per design spec. Wraps `AuthAwareCTA variant="cta"`.

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

Transition: `duration: 0.6, ease: [0.22, 1, 0.36, 1]` (2026-08-14: was 0.2s/32px — retimed to a smoother glide; offsets now 24px, AnimatedItem 0.55s/20px, stagger 0.08).

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

## 10. Public Chatbot System

A public-facing AI chatbot available on all public pages, allowing visitors to ask questions about Voco before signing up.

### PublicChatButton (`src/components/landing/PublicChatButton.jsx`)

`'use client'`. Floating action button (FAB) fixed to the bottom-right corner of all public pages. Mounted via direct import in `src/app/(public)/layout.js`.

**FAB**: 64px round button (`h-16 w-16`), `bg-[#C2410C]` (brand orange), Headset icon (Lucide). Toggles to X icon when chat is open. Mount animation: `scale-0 opacity-0` → `scale-100 opacity-100` via 100ms delayed `setTimeout` + CSS `transition-all duration-300`.

**Speech bubble**: "Ask Voco AI" tooltip positioned above the FAB. Appears after 800ms delay. Dismissible via small X button. Auto-dismissed when chat opens. Never reappears after manual dismissal (`bubbleDismissed` state). White card with stone border, downward caret triangle pointing to the FAB.

**Keyboard**: Escape key closes the chat panel when open.

### PublicChatPanel (`src/components/landing/PublicChatPanel.jsx`)

`'use client'`. Props: `onClose: () => void`.

**Position**: Fixed bottom-right (`bottom-28 right-4 lg:right-6`), `z-50`, `w-[calc(100vw-2rem)] sm:w-[380px]`, `max-h-[min(500px,calc(100vh-6rem))]`. Slide-up entry animation via `scale-95 translate-y-2` → `scale-100 translate-y-0` with `origin-bottom-right`.

**Header**: `MessageSquare` icon + "Voco AI" label + "Product Questions" Badge. Close X button.

**Message list**: Scrollable area with `aria-live="polite"`. Auto-scrolls to bottom on new messages. User messages: right-aligned, `bg-[#C2410C]` orange with white text. AI messages: left-aligned, `bg-[#F5F5F4]` with Bot icon avatar.

**Greeting message**: Hardcoded initial AI message: "Hi! I'm Voco AI. Ask me anything about pricing, features, or how Voco works for your business. What would you like to know?"

**Input**: shadcn/ui `Input` + `Button` (Send icon), `maxLength={500}`. Enter key sends. Disabled while loading.

**Component reuse from dashboard**: Imports `TypingIndicator` and `ChatNavLink` from `src/components/dashboard/`. `TypingIndicator` shows animated dots while waiting for AI response. `ChatNavLink` renders navigation link chips extracted from AI messages — clicking a link calls `onClose()` (closes the panel) then navigates.

**Link parsing**: Uses `parseMessageContent()` from `src/lib/parse-message-content.js` with a custom `PUBLIC_LINK_REGEX` pattern: `/\[([^\]]+)\]\((\/(?!dashboard)[^)]+)\)/g`. This matches markdown links to any public route (explicitly excludes `/dashboard/*` paths). The `parseMessageContent` function accepts an optional `linkPattern` parameter — the dashboard chatbot uses the default (dashboard links only), while the public chatbot passes this public-route regex.

**Conversation context**: Sends last 10 messages as `history` array to the API. Also sends `currentRoute` (via `usePathname()`) so the API can provide route-contextual knowledge.

### Public Chat API (`src/app/api/public-chat/route.js`)

`POST /api/public-chat` — unauthenticated endpoint (no auth middleware required).

**Request body**: `{ message: string, currentRoute?: string, history?: Array<{ role: 'user'|'assistant', content: string }> }`

**Response**: `{ reply: string }` on success, `{ error: string }` on failure.

**Rate limiting** (in-memory, per-instance):
- **Per-IP cooldown**: 5 seconds between requests (module-level `Map`, stale entries cleaned after 30s)
- **Global daily cap**: 1000 requests/day per server instance (resets at midnight UTC)
- IP extracted from `x-forwarded-for` (first entry) or `x-real-ip` header

**Groq client**: Lazy singleton using `openai` npm package pointed at `https://api.groq.com/openai/v1`. Model: `meta-llama/llama-4-scout-17b-16e-instruct`. `max_tokens: 400`, `temperature: 0.4`.

**System prompt** includes:
- **Language detection rule**: Detect user's first message language, respond only in that language for the entire conversation. No mixing.
- **Topic restriction**: Only answers questions about Voco. Politely declines unrelated topics (general knowledge, coding, math, etc.) and redirects to Voco topics.
- **Persona**: Friendly, concise (2-4 sentences), references specific pricing ($99/$249/$599), mentions 14-day free trial.
- **Navigation links**: Instructed to use `[Page Name](/path)` markdown format for page suggestions.
- **Knowledge injection**: RAG-retrieved content appended to system prompt.
- **Current route**: Visitor's current page path included for contextual responses.

**Error handling**: Groq API errors return `{ reply: 'Something went wrong...' }` (200 status, graceful degradation). Missing `GROQ_API_KEY` returns 503.

### Knowledge Base RAG (`src/lib/public-chatbot-knowledge/`)

Server-only module. 6 markdown knowledge documents + `index.js` retrieval logic.

**Knowledge docs**:
| File | Content |
|------|---------|
| `overview.md` | Voco product overview — what it is, who it's for |
| `pricing.md` | Pricing plans, tiers, overage rates |
| `features.md` | Feature descriptions and capabilities |
| `how-it-works.md` | Setup process, how the AI receptionist works |
| `faq.md` | Frequently asked questions |
| `contact.md` | Contact info, sales, support |

**Retrieval logic** (`getPublicKnowledge(message, currentRoute)`):
1. **Route map**: Maps current page to a priority doc (e.g., `/pricing` → `pricing.md`, `/` → `overview.md`, `/contact` → `contact.md`). Unknown routes fall back to `overview.md`.
2. **Keyword map**: Scans message for keyword groups (checked in order, first match wins). Adds up to 1 additional doc that differs from the route doc. Keyword groups: pricing terms, feature terms, setup terms, FAQ terms, contact terms.
3. **Output**: Reads matched docs via `readFileSync`, returns at most 2 docs joined with `---` separator.

### `parseMessageContent` (`src/lib/parse-message-content.js`)

Shared utility for both dashboard and public chatbots. Extracts markdown-format navigation links from AI message text.

```js
export function parseMessageContent(content, linkPattern) {
  const linkRegex = linkPattern || /\[([^\]]+)\]\((\/dashboard[^)]+)\)/g;
  // ...extracts links, returns { text, links }
}
```

**Default behavior** (no `linkPattern`): Extracts only `/dashboard/*` links — used by the dashboard chatbot.

**Public chatbot override**: Passes `PUBLIC_LINK_REGEX` which matches any non-dashboard route: `/\[([^\]]+)\]\((\/(?!dashboard)[^)]+)\)/g`.

---

## 11. Email Templates

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

## 12. Internationalization (i18n)

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

## 13. Design Tokens (Landing)

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

## 14. Key Design Decisions

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

- **FeaturesCarousel replaces FeaturesGrid on homepage**: The homepage (`page.js`) imports `FeaturesCarousel` via `next/dynamic`, not `FeaturesGrid`. `FeaturesGrid.jsx` still exists as a legacy file but is unused by any page. The carousel provides a more focused presentation with micro-visual illustrations per feature, navigation controls, and dot indicators.

- **Public chatbot uses Groq (not Supabase or project's own AI)**: The public chatbot is unauthenticated and does not touch the database. It uses Groq's hosted Llama 4 Scout model via the `openai` npm SDK (pointed at Groq's OpenAI-compatible endpoint). This avoids exposing any tenant data or requiring auth for pre-signup visitors.

- **Public chatbot RAG via filesystem reads**: Knowledge docs are plain markdown files read via `readFileSync` at request time. No vector database or embedding model — simple route+keyword matching selects at most 2 docs. Sufficient for the small (6 doc) knowledge base and avoids infrastructure complexity.

- **Public chatbot reuses dashboard components**: `TypingIndicator` and `ChatNavLink` are imported from `src/components/dashboard/` into the public `PublicChatPanel`. `parseMessageContent` is a shared utility with an optional `linkPattern` parameter — dashboard defaults to `/dashboard/*` links, public chatbot passes a custom regex for public routes. This avoids duplicating chat UI components.

- **Public chatbot IP rate limiting is in-memory per-instance**: Rate limiting uses a module-level `Map` (same pattern as `demo-voice`). In a multi-instance deployment, each instance tracks separately — the 1000/day global cap is per-instance, not truly global. Acceptable tradeoff for simplicity; a distributed rate limiter (Redis/Upstash) could be added if abuse becomes a problem.

- **Public chatbot language detection via system prompt**: Rather than using a separate language detection API, the system prompt instructs the LLM to detect the user's language from their first message and respond exclusively in that language. This leverages Llama 4 Scout's multilingual capabilities at zero additional cost.

---

## 15. Environment Variables

| Variable | Used By | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | `src/app/api/public-chat/route.js` | Groq API key for public chatbot (Llama 4 Scout); 503 if missing |
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
- For the dashboard AI chatbot that shares `TypingIndicator`, `ChatNavLink`, and `parseMessageContent` with the public chatbot, see **dashboard-crm-system skill**

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
- Public chatbot — if knowledge docs are added/changed, rate limits adjusted, model changed, or system prompt updated

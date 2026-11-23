---
type: system
system: Public Site
status: pending-rebuild
description: "Phase 48.1 rewrite — static import for best LCP: Covers: HeroSection (`src/app/components/landing/HeroSection.jsx`); AudioDemoSection (`src/app/components/landing/AudioDemoSection.jsx`); IntegrationsStrip (`src/app/components/landing/IntegrationsStrip.jsx`); CostOfSilenceBlock (`src/app/components/l"
source: .claude/skills/public-site-i18n/SKILL.md § 3. Landing Page Sections
migrated: 2026-11-23
verified:
tags: [voco/system/public-site]
---

# Landing Page Sections

Part of [[Public Site]]. Migrated verbatim from the `public-site-i18n` skill; check `verified` before trusting details.

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

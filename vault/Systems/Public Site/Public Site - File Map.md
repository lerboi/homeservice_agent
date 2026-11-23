---
type: system
system: Public Site
status: pending-rebuild
description: "Which files implement Public Site and what each one is responsible for."
source: .claude/skills/public-site-i18n/SKILL.md § File Map
migrated: 2026-11-23
verified:
tags: [voco/system/public-site]
---

# File Map

Part of [[Public Site]]. Migrated verbatim from the `public-site-i18n` skill; check `verified` before trusting details.

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

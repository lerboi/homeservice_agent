---
type: system
system: Public Site
status: pending-rebuild
description: "End-to-end flow and main components of Public Site."
source: .claude/skills/public-site-i18n/SKILL.md § Architecture Overview
migrated: 2026-11-23
verified:
tags: [voco/system/public-site]
---

# Architecture Overview

Part of [[Public Site]]. Migrated verbatim from the `public-site-i18n` skill; check `verified` before trusting details.

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

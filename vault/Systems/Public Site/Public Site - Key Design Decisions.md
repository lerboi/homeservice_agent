---
type: system
system: Public Site
status: pending-rebuild
description: "(public) route group for layout injection: The (public) route group applies LandingNav + LandingFooter to all public pages without repeating them in each pag…"
source: .claude/skills/public-site-i18n/SKILL.md § 14. Key Design Decisions
migrated: 2026-11-23
verified:
tags: [voco/system/public-site]
---

# Key Design Decisions

Part of [[Public Site]]. Migrated verbatim from the `public-site-i18n` skill; check `verified` before trusting details.

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

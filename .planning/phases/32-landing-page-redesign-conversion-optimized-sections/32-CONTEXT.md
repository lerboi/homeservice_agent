# Phase 32: Landing Page Redesign — Conversion-Optimized Sections - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the landing page hero text, Features section, and How It Works section to be more conversion-focused. Attack direct pain points for home service business owners with clear messaging around 70+ language support, real-time calendar-aware booking, post-call SMS, call analytics, and full integration capabilities. Improve visual clarity, UX appeal, and mobile experience across all redesigned sections. The hero demo input/player (Phase 29), Social Proof section, Final CTA section, and ScrollLinePath are NOT being redesigned — they carry forward as-is (ScrollLinePath extended for new section dimensions).

</domain>

<decisions>
## Implementation Decisions

### Hero Copy & Messaging
- **D-01:** Lead with **missed revenue** pain point angle — loss aversion drives highest conversion for cold traffic. "You're losing $X,000 calls" hurts more than "you could gain $X,000." Claude writes the final headline copy, guided by this direction.
- **D-02:** Keep **RotatingText** component in the hero headline with new revenue/pain-focused cycling words (replacing current Competitor/Rival/Neighbor).
- **D-03:** Subtitle directs visitors to the demo input bar — solution-focused ("Enter your business name and hear your AI receptionist in action" style). Demo input/player from Phase 29 stays unchanged.
- **D-04:** No eyebrow pill, no social proof micro-line in hero (removed in Phase 29, stays removed).

### Features Section — Layout & Content
- **D-05:** Replace the current 5-card asymmetric bento grid with a **2-column staggered card grid** on `#FAFAF9` light background. Each card has: icon, title, short description, and a micro SVG/CSS visual. Clean, uniform card sizes (except the hero card). Stacks to single column on mobile.
- **D-06:** **70+ Languages gets a full-width hero card** at the top of the Features grid — this is the biggest differentiator. Animated language bubbles/flags visual. Highlights English, Spanish, Malay, Chinese, and "70+ more" (powered by Gemini 3.1 Flash Live).
- **D-07:** Remaining 6 features in 2-col grid below the language hero card:
  1. **24/7 AI Answering** — Never miss a call, picks up in under 1 second, nights/weekends/holidays
  2. **Real-Time Calendar Booking** — Books while caller is on the line, zero double-bookings, slot locking
  3. **Post-Call SMS & Notifications** — Caller gets booking confirmation SMS, owner gets instant alerts with details
  4. **Call Analytics & Dashboard** — Track call volume, booking rates, revenue from dashboard
  5. **Lead Capture & CRM** — Every call becomes a lead with name, address, job type, urgency, transcript
  6. **Google & Outlook Calendar Sync** — Bidirectional sync, events block AI slots, AI bookings appear in calendar
- **D-08:** Each card gets a **lightweight micro SVG/CSS visual** — no images, no heavy assets. Transform/opacity-only animations. Claude has discretion on exact visual design per card.
- **D-09:** Section heading updated to reflect the pain-point-first messaging (not the current "Five features. One question: How much did your last missed call cost?" — refresh copy to match new direction).

### How It Works — 4-Step Expansion
- **D-10:** Expand from 3 steps to **4 steps** with new narrative flow:
  1. **Call Comes In** — Phone rings, AI picks up in under a second, sounds human, speaks their language
  2. **AI Handles the Conversation** — Gathers name, address, job details, urgency naturally. No robotic scripts, no "press 1". Best-in-class AI voice.
  3. **Job Is Booked** — Appointment locks into calendar while caller is still on the line. Caller gets SMS confirmation. Owner gets notified instantly.
  4. **Your Dashboard Does the Rest** — Call analytics, lead management, invoicing — everything from one place. Wake up to a full schedule and clear picture of your business.
- **D-11:** No "triage" step visible — AI intelligence is demonstrated through the conversation step, not as a separate technical mechanic.
- **D-12:** Keep **sticky scroll card layout** but implement **folder-stack cascading effect**: each card offsets slightly more from the top so previous cards peek out (~40-50px visible per prior card). At full stack, all 4 step badges/headers are visible like folder tabs.
- **D-13:** Incrementing `top` CSS on each sticky card (e.g., card 1: `top: 80px`, card 2: `top: 130px`, card 3: `top: 180px`, card 4: `top: 230px`) to achieve the folder effect.
- **D-14:** **Card design refresh** — improve individual card visuals (cleaner typography, better spacing, refined color treatment). Claude's discretion on exact styling.

### Section Order & Flow
- **D-15:** Section order stays: **Hero → How It Works → Features → Social Proof → CTA**. Narrative arc: problem → solution story → proof of depth → trust → action.
- **D-16:** **ScrollLinePath stays** — copper SVG sine wave extended for new section dimensions. No visual changes to the line itself.

### Performance & Mobile
- **D-17:** All animations must be **transform/opacity-only** (GPU-composited, no layout thrash). No backdrop-blur on large surfaces. No parallax. No canvas/Lottie.
- **D-18:** Feature cards stack to **single column on mobile** with scroll-snap for smooth swiping feel.
- **D-19:** How It Works sticky cards must work on mobile — folder-stack effect degrades gracefully (smaller offsets or no peek-through on very small screens if needed).
- **D-20:** Use existing `AnimatedSection`, `AnimatedStagger`, `AnimatedItem` for all scroll-triggered animations. No new animation libraries.

### Claude's Discretion
- Final hero headline copy and RotatingText words (guided by missed-revenue pain angle)
- Subtitle exact wording
- Feature card micro SVG/CSS visual designs
- Feature card copy (titles and descriptions — guided by the 7 features listed above)
- How It Works step copy refinement
- How It Works card visual styling refresh (colors, typography, spacing, badges)
- Exact folder-stack offset values for sticky cards
- Features section heading copy
- Icon selection (Lucide) for each feature card
- Mobile breakpoint fine-tuning
- Responsive behavior of the folder-stack at different viewport heights

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current landing page components (files to modify)
- `src/app/(public)/page.js` — Landing page composition with dynamic imports and section order
- `src/app/components/landing/HeroSection.jsx` — Hero section with Spline 3D, RotatingText, HeroDemoBlock
- `src/app/components/landing/FeaturesGrid.jsx` — Current 5-card bento grid (being replaced)
- `src/app/components/landing/HowItWorksSection.jsx` — Server Component wrapper for HowItWorksSticky
- `src/app/components/landing/HowItWorksSticky.jsx` — Current 3-step sticky scroll cards (expanding to 4, adding folder effect)
- `src/app/components/landing/ScrollLinePath.jsx` — Copper SVG scroll-draw line (extend for new dimensions)

### Components NOT being modified (carry forward)
- `src/app/components/landing/HeroDemoBlock.jsx` — Demo input/player (Phase 29, unchanged)
- `src/app/components/landing/HeroDemoInput.jsx` — Business name input (unchanged)
- `src/app/components/landing/HeroDemoPlayer.jsx` — Waveform audio player (unchanged)
- `src/app/components/landing/SocialProofSection.jsx` — 3 testimonial cards (unchanged)
- `src/app/components/landing/FinalCTASection.jsx` — Dark CTA section (unchanged)

### Animation system
- `src/app/components/landing/AnimatedSection.jsx` — AnimatedSection, AnimatedStagger, AnimatedItem (reuse, no changes)
- `src/app/components/landing/RotatingText.jsx` — Per-character animated text rotation with dynamic width (Phase 29)

### Design reference
- `src/app/components/landing/LandingNav.jsx` — Dark nav styling reference
- `src/app/(public)/pricing/page.js` — Dark section styling patterns for consistency

### Prior phase context (design lineage)
- `.planning/phases/02.1-public-marketing-landing-page/02.1-CONTEXT.md` — Original design language, Heritage Copper palette, Foreman voice
- `.planning/phases/13-frontend-public-pages-redesign/13-CONTEXT.md` — Premium Dark SaaS design language, stone breath sections, copper glow hovers
- `.planning/phases/29-hero-section-interactive-demo/29-CONTEXT.md` — Hero demo input/player decisions, shortened title, RotatingText width fix

### Skill reference
- `.claude/skills/public-site-i18n/` — Complete architectural reference for the public marketing site

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AnimatedSection` / `AnimatedStagger` / `AnimatedItem` — Core animation primitives for scroll-triggered reveals (fade-up, stagger children). Reuse for all new sections.
- `RotatingText` — Per-character animated text rotation with dynamic width measurement. Reuse in hero with new words.
- Landing color tokens in `globals.css` — `#FAFAF9` (light section bg), `#050505` (hero bg), `#F97316` (accent orange), `#0F172A` (navy text). All established.
- `HowItWorksSticky` — Existing sticky scroll implementation with `IntersectionObserver` and progress dots. Extend with folder-stack offset and 4th card.
- Lucide icons — Already used across all landing components (Moon, Filter, Calendar, Bell, Globe, Phone, Brain, CalendarCheck).

### Established Patterns
- Server Components default; `'use client'` only for interactivity (scroll listeners, state)
- `next/dynamic` for below-fold sections with height-matched loading skeletons
- Tailwind v4 CSS-based theming with `@import 'tailwindcss'` — inline utilities, no config file
- Framer Motion v12 for scroll animations via AnimatedSection (direction prop, useReducedMotion)
- Micro SVG/CSS visuals inline in components (ClockVisual, TriageVisual, LanguageVisual in current FeaturesGrid)

### Integration Points
- `src/app/(public)/page.js` — Update loading skeleton heights for resized Features/HowItWorks sections
- `src/app/components/landing/HeroSection.jsx` — Update h1 text and RotatingText words only (demo block untouched)
- `src/app/components/landing/FeaturesGrid.jsx` — Full rewrite: new 2-col grid layout, 7 feature cards, new micro visuals
- `src/app/components/landing/HowItWorksSticky.jsx` — Expand to 4 cards, add folder-stack offset, refresh card design
- `src/app/components/landing/ScrollLinePath.jsx` — May need path adjustment for new section heights

</code_context>

<specifics>
## Specific Ideas

- "Missed revenue" loss aversion is the strongest conversion driver for cold traffic targeting trades owners — "you're losing $3k calls" > "you could gain $3k calls"
- 70+ Languages is the single biggest differentiator vs competitors — deserves hero treatment in Features, not buried as card #5
- How It Works should tell a story contractors can picture themselves in: phone rings → AI handles it like your best front-desk person → job's in the calendar → dashboard runs the business
- "Triage" is internal jargon — never surface it as a step. The AI's intelligence shows through the conversation step, not as a labeled mechanic.
- Folder-stack effect on sticky cards: at end of scroll, all 4 step headers are visible like folder tabs — creates a visual "complete flow" impression
- Feature card micro visuals should be lightweight SVG/CSS (like the existing ClockVisual, TriageVisual) — zero load time, GPU-friendly
- Mobile UX is critical — single column cards, smooth scroll, no lag, no GPU-intensive effects

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 32-landing-page-redesign-conversion-optimized-sections*
*Context gathered: 2026-03-31*

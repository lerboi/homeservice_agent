---
type: system-index
system: Public Site
status: pending-rebuild
repo: homeservice_agent
description: Complete architectural reference for the public marketing site and internationalization — landing page sections, pricing page, about page, contact form with Resend email, navigation, footer, animation system, AuthAwareCTA, next-intl configu…
source_skills: [public-site-i18n, scroll-line-path]
migrated: 2026-11-23
verified:
tags: [voco/system/public-site]
---

# Public Site

Up: [[Home]] · [[Systems]]

> **How to use:** read this index, then open only the notes the task needs. After changing code in this system, update the matching note and set its `verified:` date.

**Status (2026-11-23):** pending rebuild. These notes describe the home-service marketing site and are partly out of date already (the hero is a CSS voice orb, not a Spline scene; the features section is a scroll-driven roadmap; the chatbot rate limit is Supabase-backed; there is no `ui` message namespace). [[Plan 2 - Frontend rebrand to voice integration for any backend]] replaces the site, after which this folder is rewritten from the new code and the scroll-line notes are deleted.

## Notes (from `public-site-i18n`)

| Note | Lines | Status | What is in it |
|---|---|---|---|
| [[Public Site - Architecture Overview]] | 65 | pending-rebuild | End-to-end flow and main components of Public Site. |
| [[Public Site - File Map]] | 51 | pending-rebuild | Which files implement Public Site and what each one is responsible for. |
| [[Public Site - Route Group and Layout]] | 29 | pending-rebuild | File: src/app/(public)/layout.js |
| [[Public Site - Landing Page Structure]] | 28 | pending-rebuild | File: src/app/(public)/page.js |
| [[Public Site - Landing Page Sections]] | 56 | pending-rebuild | Phase 48.1 rewrite — static import for best LCP: Covers: HeroSection (`src/app/components/landing/HeroSection.jsx`); AudioDemoSection (`src/app/components/landing/AudioDemoSection.jsx`); IntegrationsStrip (`src/app/components/landing/IntegrationsStrip.jsx`); CostOfSilenceBlock (`src/app/components/landing/CostOfSilenceBlock.jsx`); FeaturesCarousel (`src/app/components/landing/FeaturesCarousel.jsx`); YouStayInControlSection (`src/app/components/landing/YouStayInControlSection.jsx`); AudioPlayerCard (`src/app/components/landing/AudioPlayerCard.jsx`); FAQSection (`src/app/components/landing/FAQSection.jsx`); FAQChatWidget (`src/app/components/landing/FAQChatWidget.jsx`); FinalCTASection (`src/app/components/landing/FinalCTASection.jsx`) |
| [[Public Site - Animation System]] | 40 | pending-rebuild | Animation System. Covers: `AnimatedSection({ children, className, delay, direction })`; `AnimatedStagger({ children, className })`; `AnimatedItem({ children, className })` |
| [[Public Site - Navigation and Footer]] | 28 | pending-rebuild | 'use client' — needs scroll listener and pathname for active state. Covers: LandingNav (`src/app/components/landing/LandingNav.jsx`); LandingFooter (`src/app/components/landing/LandingFooter.jsx`) |
| [[Public Site - AuthAwareCTA]] | 29 | pending-rebuild | File: src/components/landing/AuthAwareCTA.js |
| [[Public Site - Pricing Page]] | 102 | pending-rebuild | Pricing Page. Covers: Page Section Layout; `pricingData.js` — Tier Data Structure; `PricingTiers.jsx`; `ROICalculator.jsx`; `ComparisonTable.jsx`; Testimonials (inline in page.js); Trust Strip (inside PricingTiers.jsx, not page.js); `FAQSection.jsx` |
| [[Public Site - About and Contact Pages]] | 37 | pending-rebuild | Server Component (default export, no 'use client'). Uses AnimatedSection, AnimatedStagger, AnimatedItem from AnimatedSection.jsx and AuthAwareCTA from src/co… Covers: About (`src/app/(public)/about/page.js`); Contact (`src/app/(public)/contact/page.js`); `ContactForm.jsx` (`src/app/(public)/contact/ContactForm.jsx`) |
| [[Public Site - Contact API Route]] | 27 | pending-rebuild | File: src/app/api/contact/route.js |
| [[Public Site - Public Chatbot System]] | 93 | pending-rebuild | A public-facing AI chatbot available on all public pages, allowing visitors to ask questions about Voco before signing up. Covers: PublicChatButton (`src/components/landing/PublicChatButton.jsx`); PublicChatPanel (`src/components/landing/PublicChatPanel.jsx`); Public Chat API (`src/app/api/public-chat/route.js`); Knowledge Base RAG (`src/lib/public-chatbot-knowledge/`); `parseMessageContent` (`src/lib/parse-message-content.js`) |
| [[Public Site - Email Templates]] | 20 | pending-rebuild | File: src/emails/NewLeadEmail.jsx |
| [[Public Site - Internationalization (i18n)]] | 29 | pending-rebuild | Cookie-based locale, no URL prefix: The app uses next-intl with cookie-based locale switching rather than URL-prefixed routing (e.g., /es/pricing). This is r… Covers: Routing Config (`src/i18n/routing.js`); Translation Files Structure |
| [[Public Site - Design Tokens (Landing)]] | 17 | pending-rebuild | Landing pages use a separate set of design tokens from the dashboard. These are NOT in src/lib/design-tokens.js (which is dashboard/onboarding). Landing toke… |
| [[Public Site - Key Design Decisions]] | 48 | pending-rebuild | (public) route group for layout injection: The (public) route group applies LandingNav + LandingFooter to all public pages without repeating them in each pag… |
| [[Public Site - Environment Variables]] | 15 | pending-rebuild | Environment variables Public Site reads, and where they are set. |
| [[Public Site - Scope and change history]] | 35 | record | The former public-site-i18n skill's scope statement, preamble and running 'last updated' change history. Read only when you need to know when or why something changed. |

## Notes (from `scroll-line-path`)

| Note | Lines | Status | What is in it |
|---|---|---|---|
| [[Scroll Line - Architecture]] | 103 | pending-rebuild | ScrollLinePath wraps exactly 3 children in this JSX order (Phase 48.1 — source of truth: src/app/(public)/page.js): Covers: Page Integration; CSS Stacking (critical — do not change without understanding this); How the SVG Works; The Wave Path (single-segment, starts at Features dot); The Dot; Three Rendered Layers; Scroll Animation |
| [[Scroll Line - Updating]] | 37 | pending-rebuild | Updating. Covers: Wave too fast/slow; Wave amplitude (how wide it swings); Wave frequency (how many curves); Dot position; Line color; Section added or removed (inside ScrollLinePath); Sections reordered (inside ScrollLinePath) |
| [[Scroll Line - Debugging]] | 13 | pending-rebuild | Line doesn't appear: Check (1) ScrollLinePath wraps sections in page.js, (2) md:block — desktop only, (3) sections don't have relative on their <section> tag… |
| [[Scroll Line - Scope and change history]] | 6 | record | The former scroll-line-path skill's scope statement, preamble and running 'last updated' change history. Read only when you need to know when or why something changed. |

## Short sections

### Cross-Domain References

- For authentication state in `AuthAwareCTA`, browser client usage, and Supabase session patterns, see **auth-database-multitenancy skill**
- For how `messages/en.json` and `messages/es.json` are consumed by the voice agent, see **voice-call-architecture skill**
- For the `NewLeadEmail` template as called from notifications, see **voice-call-architecture skill** (notifications section)
- For design tokens used in dashboard and onboarding (separate from landing tokens), see **dashboard-crm-system skill**
- For the dashboard AI chatbot that shares `TypingIndicator`, `ChatNavLink`, and `parseMessageContent` with the public chatbot, see **dashboard-crm-system skill**

---


### Important: Keeping This Document Updated

When making changes to any file listed in the File Map above, update the relevant sections of this skill document to reflect the new behavior. This ensures future conversations always have an accurate reference.

Key areas to keep current:
- File Map — if new landing sections or public pages are added
- Pricing tiers — if `pricingData.js` pricing structure changes (new tiers, prices, features)
- i18n section — if new locales are added to `routing.js` or translation file structure changes
- Design tokens (Landing) — if new color tokens or Tailwind conventions are introduced
- Animation system — if `AnimatedSection` gains new direction props or variant patterns
- Contact API — if new inquiry types or email routing is added
- Public chatbot — if knowledge docs are added/changed, rate limits adjusted, model changed, or system prompt updated

## Short sections

### File Locations

| File | Role |
|------|------|
| `src/app/components/landing/ScrollLinePath.jsx` | The component — SVG, measurement, animation, wave builder |
| `src/app/(public)/page.js` | Integration — wraps exactly 3 sections as children (Phase 48.1) |


### Performance

- **Mobile**: Hidden entirely (`hidden md:block`)
- **Reduced motion**: Returns children only, no SVG
- **GPU compositing**: `pathLength` only animates `stroke-dashoffset`
- **No layout impact**: absolute positioned, pointer-events-none
- **Lazy measurement**: SVG not rendered until `dims !== null` (after first measurement)

---
type: plan
date: 2026-11-23
status: approved
description: "Plan and decisions for rebuilding the public site around the new positioning."
source: "My Prompts/Rebrand-2026-11/02-frontend-rebrand-plan.md"
migrated: 2026-11-23
tags: [voco/plan]
---

# Plan 2 — Rebrand the public site: from "AI receptionist for home services" to "voice integration for any backend"

Status: DECISIONS RECORDED 2026-11-23. Awaiting green light to implement.

## 1. New positioning

**Voco is the voice layer for your backend.** A voice agent answers the call (phone or web), understands what the person wants, and does the work in the systems the business already runs: books the appointment, schedules the task, creates the record, sends the confirmation.

Working headline: "Give your backend a voice."

What changes in the story:

| | Old | New |
|---|---|---|
| Who | Plumbers, HVAC, electricians, handymen | Any business or product team with a backend that callers need to reach |
| Promise | Never lose a job to voicemail | Callers get things done by talking; the result lands in your system of record |
| Proof | Missed-call revenue math | A live demo: a call on one side, the calendar/CRM changing on the other |
| Hero product | Receptionist | Voice agent + backend connectors |

### What is real today (the site must not claim more)
| Capability | State |
|---|---|
| Phone answering (Twilio SIP), browser voice (LiveKit) | Live |
| Scheduling: availability, atomic booking, Google Calendar, Outlook Calendar | Live (Google needs reconnecting, see Plan 3) |
| SMS and email confirmations and alerts, call transcripts and recordings, transfer to a human | Live |
| Jobber, Xero | Built, feature-flagged off |
| Generic webhooks, public API/SDK, other CRMs | Do not exist |

Per the decision in section 6, connectors are presented as available under a done-for-you framing. The site will still drop claims that are not true with zero clients: "Trusted by 500+ home service businesses" (`auth/signin/page.js:554`), "500+ contractors" (`src/data/comparisons.js:19`), and the invented persona testimonials.

## 2. What the inventory found

- Almost all marketing copy is hardcoded in JSX or `src/data/*.js`. No public page uses next-intl, so there is no translation work.
- The landing page is 10 section components (about 1,900 lines). Three more are dead code (`FeaturesGrid`, `RotatingText`, `AudioPlayerCard`).
- Design system: Inter only, Tailwind v4 with tokens in `globals.css`, orange accent `#F97316` on near-black `#050505` and warm brown `#1C1412`, framer-motion. Colors are mostly hardcoded hex in JSX and there is no shared Section/Container primitive.
- Programmatic SEO is thin and fully trade-specific: 3 blog posts, 4 trade personas, 3 comparisons, 1 glossary term, 4 integrations.
- Pricing copy is cosmetic, but plan `id`s (`starter|growth|scale`), prices, call limits and overage rates are wired to Stripe and enforcement, and the same plan objects render in onboarding checkout and the dashboard upgrade screen.
- The public chatbot's system prompt and six knowledge docs describe the home-service product.
- The existing tests pin old copy (`tests/unit/landing-sections.test.js` has about 60 string assertions, several already out of date).

## 3. Scope

### Redesign and rewrite
| Surface | Files | Work |
|---|---|---|
| Design foundation | `src/app/globals.css`, new `src/components/marketing/` primitives | Public-site tokens (replace scattered hex), Section/Container primitives, a display + mono type pairing next to Inter |
| Nav and footer | `LandingNav.jsx`, `LandingFooter.jsx`, `AuthAwareCTA.js` | New links (Product, Use cases, Integrations, Demo, Pricing), new tagline, new CTAs |
| Landing page | `(public)/page.js` + new section components | Full rebuild, section list below |
| Public demo page | `src/app/demo/page.js` → moved into `(public)/demo` | Replaces the "coming soon" stub: the recorded video from Plan 3, what it shows, CTA. Ships with a designed placeholder until the video exists. Added to nav and sitemap |
| About | `about/page.js` | Rewrite (currently "We answer phones for people who work with their hands") |
| Pricing | `pricing/page.js` | Replaced by a short "talk to us" page (section 6). `pricingData.js` untouched |
| Use cases | `/for/[persona]` → `/use-cases/[slug]`, `src/data/personas.js` → `use-cases.js` | New data model keyed on the task, not a trade: appointment booking, lead intake, task and callback scheduling, order/account lookup, after-hours coverage |
| Integrations | `integrations/*`, `src/data/integrations.js`, `IntegrationsStrip.jsx` | Reframed as "backends Voco can act in", grouped (calendars, CRM, field tools, messaging, payments, automation and your own API), expanded per section 6 |
| Metadata and SEO | `src/app/layout.js`, every `metadata` export, `og/route.jsx`, `sitemap.js`, `next.config.js` redirects, homepage JSON-LD | New titles and descriptions, new OG default, Organization + SoftwareApplication schema on the homepage |
| Public chatbot | `api/public-chat/route.js:100-114`, `src/lib/public-chatbot-knowledge/*` | New persona prompt and knowledge docs; prices read from `pricingData.js` instead of being retyped |
| Sign-in marketing panel | `auth/signin/page.js` (copy at L47-56, L526, L554, L577) | Copy only |
| Legal | `privacy/page.js`, `terms/page.js` | One-line product descriptor updated. Flagged for your review: these are legal documents |

### Retired
- `/blog` (3 trade posts), `/glossary` (1 term), `/compare` (3 pages): removed from nav, footer and sitemap, with permanent redirects to `/`. They can come back later with content written for the new positioning.
- `CostOfSilenceBlock` (missed-job math), `ScrollLinePath` + `ScrollProgress` (decorative line tied to the old section anchors), the three dead components, unused audio and image assets in `public/`.

### Deliberately not touched
Dashboard, onboarding wizard (including the trade selector), billing, emails, the voice agent's production prompt, the database. This creates one visible seam, covered in question 3 below: the public site will no longer talk about trades, but self-serve signup still opens a wizard that asks "pick your trade".

## 4. New landing page

1. **Hero.** "Give your backend a voice." One-sentence subhead. Visual: a live call transcript on the left; on the right, backend actions landing as the call progresses (calendar event created, record updated). CTAs: "Watch the demo", "Book a demo".
2. **Demo.** The recorded video from Plan 3 (designed placeholder until then). Replaces the single audio clip.
3. **How it works.** Three steps: the call comes in → Voco understands and decides → the action runs in your system. A simple diagram of voice → Voco → connectors → backend.
4. **What it can do.** Use-case grid: book appointments, schedule tasks and callbacks, capture leads into a CRM, answer questions from your data, look up an order or account, hand off to a human, send confirmations.
5. **Backends.** Connector groups (section 6), ending with "your own API".
6. **Control and reliability.** Your rules (hours, escalation, transfer), transcripts and recordings, languages. Only numbers I can verify from the system.
7. **FAQ** rewritten, with the existing chat widget.
8. **Final CTA.**

### Visual direction (proposed)
Superseded by decision 6 below (new palette). The intent stands: move the feel from "warm small-business" to "infrastructure product": near-black and off-white surfaces, tighter type scale, a mono face for the transcript/action/log elements, restrained motion that shows cause and effect (speech → action) rather than decoration. Before building every page I will build the hero plus one section and show you screenshots for sign-off.

## 5. Build order
1. Tokens, type, primitives; nav and footer.
2. Hero + one section → screenshots → your sign-off on the look.
3. Rest of the landing page; public demo page.
4. Pricing, about, contact, sign-in panel.
5. Use cases and integrations (data + templates).
6. Chatbot prompt and knowledge; metadata, OG, schema, sitemap, redirects.
7. Rewrite the pinned tests (landing, SEO data, sitemap, chatbot knowledge); delete dead code and unused assets.
8. Verify in a browser at mobile and desktop widths, every route, every CTA, redirects, no remaining trade wording on public routes (scripted grep), `next build` clean.
9. Update `vault/Systems/Public Site/` and `vault/Product/Positioning.md`.

## 6. Decisions (2026-11-23)
1. **Buyer:** businesses and operations teams. Voco connects the voice agent to their systems for them.
2. **Integrations:** a broad set is presented as available, with no "coming soon" labels. Framing is done-for-you: "Voco connects to …", which matches the sales model (book a demo → we set it up). Groups: calendars (Google, Outlook, Calendly, Cal.com), CRM (HubSpot, Salesforce, Pipedrive, Zoho), field and practice tools (Jobber, ServiceTitan, Housecall Pro), messaging (SMS, WhatsApp, email, Slack), payments and accounting (Stripe, Xero, QuickBooks), automation and custom (Zapier, Make, webhooks, your own REST API). The copy will not promise self-serve one-click setup for connectors that are not built, and the invented testimonials and "500+ businesses" claims are still removed.
3. **CTA:** "Book a demo" (contact form, `type=sales`) and "Watch the demo". No self-serve signup link on public pages; "Sign in" stays for existing accounts.
4. **Pricing:** the public pricing page becomes a short "pricing is scoped to your call volume and integrations: talk to us" page with the Book a demo CTA. `pricingData.js` and all Stripe wiring stay untouched because onboarding checkout and the dashboard upgrade screen still read them. Public-only components (`PricingTiers`, `ROICalculator`, `ComparisonTable`, pricing `FAQSection`) are removed after confirming nothing else imports them. The chatbot stops quoting prices.
5. **Retire** `/blog`, `/glossary`, `/compare` with redirects; `/for` becomes `/use-cases`. Agreed.
6. **Look:** new palette, replacing the orange/brown identity.
   - Surfaces: paper `#F7F8F5`, white, ink `#0B0F14` (dark sections and footer).
   - Accent: one "signal" green-teal (around `#00B37E`, exact value tuned for contrast) used for live/voice states, links and the primary button; neutral greys for everything else.
   - Type: a geometric display face for headlines, Inter for body, a mono face for transcript and action-log elements.
   - Light-first pages with one or two ink sections for rhythm; generous whitespace; hairline borders instead of shadows and gradients.
   - The existing logo is checked against the palette at the sign-off step (the white version is used on ink; if the colored version clashes I will ask you).
   - Sign-off gate stays: hero + one section as screenshots before the rest is built.

---
type: log
date: 2026-11-24
status: record
description: "Second pass on the rebranded public site after the owner's first review: sign-in and dashboard links removed, a second product (Voco Agent) added as an equal to Voco Voice, and a new visual identity. Stage one covers home, /voice and /agent; the other pages are not restyled yet."
verified: 2026-11-24
tags: [voco/log]
---

# 2026-11-24 Public site second pass - two products and identity

Follows [[2026-11-24 Public site rebrand]]. System description: [[Public Site]]. On the `rebrand` branch, committed locally, not pushed.

## What the owner asked for

1. Remove the sign-in and go-to-dashboard buttons from the public site entirely.
2. The site looked boring and without identity: every page the same. Make it more appealing and make pages differ.
3. Present a second offering: an AI agent wired into a business's systems (customer feedback, search data, support, email, calendar), in a way a non-technical owner recognises as something they need.

## Decisions (owner's answers)

| Question | Answer |
|---|---|
| Is the underlying agent framework named on the site? | No. The products are "Voco Voice" and "Voco Agent" |
| Which product leads? | Neither. Both are things Voco sells; equal billing everywhere |
| Does the agent only report, or also act? | Both |
| Where does the owner talk to it? | Telegram, WhatsApp, Slack, email |

## What was built (stage one)

- **Sign-in removal**: nav, drawer, footer, CTA and the pricing page. `AuthAwareCTA` became `DemoCTA`, a server component with no Supabase call. [[Public Site - Landing page and components]].
- **Identity**: Bricolage Grotesque with Instrument Serif italic emphasis replaces Space Grotesk; a second colour (amber) for Voco Agent beside green for Voco Voice; dark home hero with a dot grid; each product page has its own hero. [[Public Site - Design system (2026-11)]].
- **Home**: headline "AI that does the work.", both products' illustrations side by side, a two-panel products section, a "you do not set anything up" section.
- **`/agent`**: new page and `src/data/agent.js`; animated chat illustration `AgentChatDemo`.
- **`/voice`**: new page holding the voice sections that were on the home page.
- **Nav**: Voice, Agent, Use cases, Integrations, Demo, Pricing. Footer columns regrouped.
- **Chatbot**: knows both products (`agent.md`, updated `overview.md` and prompt); told not to name what the agent is built on. [[Public Site - Public chatbot (2026-11)]].
- **Metadata**: site title and description cover both products; sitemap has `/voice` and `/agent`.

## The gap, widened

Voco Agent is not built. The page describes it under the same done-for-you framing as the integrations, by the owner's decision. [[Public Site - Content data and copy rules]] has the claimed-against-built table.

## Verified

- Public-site, SEO and public-chat suites: 121 tests pass.
- ESLint on the public sources: only the pre-existing `PublicChatButton.jsx` error.
- Chrome at desktop width: home, `/agent` and `/voice` top to bottom; both animations play; no console errors.

## Not done yet

- Stage two: `/use-cases`, `/integrations`, `/demo`, `/pricing`, `/about`, `/contact` still open with the same plain `PageHero`. Held until the owner has seen stage one.
- `next build` was not re-run after this pass.
- Mobile widths, as before.
- Use-case pages and the integrations list are still voice-only; whether the agent gets its own use cases there is undecided.

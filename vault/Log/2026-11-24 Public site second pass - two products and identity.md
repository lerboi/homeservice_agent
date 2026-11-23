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

## Owner's review of stage one, and the changes made

The owner liked the direction and the separate Voice and Agent pages. Changes asked for and made:

- **No italic serif.** Hard to read. Emphasis is now the product colour in the same face; Instrument Serif is no longer loaded.
- **"It works in the tools you already run"** shows only WhatsApp, email, Slack, the two calendars and "your own API", as icon tiles wired to a Voco node instead of text pills.
- **Cleaner and consistent.** One page width for every section, nav and footer.
- **Phones.** Checked at 390 px; fixed the home hero, where the call illustration overlapped the label of the agent illustration below it.
- `PageHero` takes a `tone`; `/use-cases` opens on the green wash and `/integrations` on ink.

Verified after these: 123 public-site, SEO and chat tests pass; `next build` succeeds; Chrome at desktop width and at 390 px.

## Third round: integrations removed, agent on the use-cases page

Owner's instruction: remove the Integrations tab entirely, and add Voco Agent entries to the use-cases page.

- `/integrations` and `/integrations/[tool]` deleted; both redirect permanently to `/`. Gone from the nav, footer and sitemap. Home tool tiles and the system chips on use-case pages are plain labels now.
- `/use-cases` is rebuilt as two groups: Voco Voice (the five call-based use cases, green) and Voco Agent (its six jobs with an example message each, amber, linking to `/agent#jobs`). Headline "The work you can hand over."
- Verified: 122 tests pass, `next build` succeeds, redirects return 308, Chrome at desktop width and 390 px.

## Fourth round: home hero and a Home link

The owner said the home hero did not blend together and asked for a Home tab.

- Hero recomposed: centred headline, lede and buttons; the two illustrations sit in matching dark frames that overlap the edge between the dark field and the light page; glows sit behind their own product.
- The nav is dark over the home hero instead of a pale bar on a dark page.
- `Home` added as the first nav link.
- Verified: public-site suites pass; Chrome at desktop width and 390 px, no overflow.

## Fifth round: Voco Voice headline and hero

- The owner rejected "Give your backend a voice." (reason recorded in [[Public Site - Landing page and components]]). New line: "It answers every call. Then it does the job."
- The `/voice` hero now follows the `/agent` hero: centred headline, the call illustration in the middle, pills either side. The side pills are a shared `ReachColumn` component.
- The sign-in panel shows "AI that does the work" in place of the old line.

## Not done yet

- `/demo`, `/pricing`, `/about` and `/contact` still open with the plain paper `PageHero` and have not been redesigned.
- Use-case pages and the chatbot's `integrations.md` still name systems beyond the six on the home page (HubSpot, Salesforce and others).
- `/pricing`, `/about`, `/demo` and `/contact` copy still speaks only of calls.
- The mobile nav drawer and a real contact-form submission are still unexercised.
- Voco Agent's jobs have no detail pages of their own; the cards link to `/agent`.

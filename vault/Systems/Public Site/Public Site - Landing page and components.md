---
type: system
system: Public Site
status: current
description: "The home page's section order, the two product pages (/voice and /agent), and the components behind them: the animated call, the animated agent chat, the demo video slot, nav, footer and the CTA component."
verified: 2026-11-24
tags: [voco/system/public-site]
---

# Public Site - Landing page and components

Part of [[Public Site]]. Styling: [[Public Site - Design system (2026-11)]].

The site sells two products as equals (owner's instruction, 2026-11-24): **Voco Voice** and **Voco Agent**. Neither is presented as the main one: they share the home hero, sit side by side in the nav and footer, and each has its own page and colour.

## Home (`src/app/(public)/page.js`)

| # | Section | Component | Surface |
|---|---|---|---|
| 1 | Hero: centred "AI that does the work.", lede and CTAs, then the two products' illustrations side by side in matching dark frames that step down onto the light page | inline + `LiveCallDemo` + `AgentChatDemo` | ink over paper |
| 2 | The two products as panels, each with four jobs and a link to its page | `ProductsSection` | paper |
| 3 | Voco Voice demo | `DemoSection` → `DemoVideo` | white |
| 4 | Your tools: six icon tiles wired to a Voco node (WhatsApp, Email, Slack, Google Calendar, Outlook Calendar, your own API) | `BackendsSection`, `HOME_TOOLS` | ink |
| 5 | Getting started: three steps, done by Voco | `SetupSection` | paper |
| 6 | FAQ with the chat widget | `FaqSection` | white |
| 7 | Final CTA | `FinalCtaSection` | ink |

Anchors: `#products`, `#demo`, `#backends`, `#setup`, `#faq`.

**How the hero is built.** The section itself is paper; an absolutely positioned ink field (`data-nav-ink`) covers all but its last 7 to 9 rem, so the two product frames overlap the boundary. Each frame (`ProductWindow` in `page.js`) is a solid `mk-ink-soft` panel holding the product name, one line on what it does, a "See how" link and the illustration. This replaced a left-aligned hero with bare white cards on ink, which the owner said did not blend (2026-11-24).

**Nav.** `NAV_LINKS` starts with Home (owner's request). `LandingNav` turns dark (white logo, white links, white button) while it sits over an element marked `data-nav-ink`, and returns to the light bar once that element has scrolled past. Only the home page has one. Home is marked active only on `/`.

The tools list is the owner's (2026-11-24): only those six appear on the home page. `HOME_TOOLS` in `LandingSections.jsx` holds them; WhatsApp and Google Calendar use their brand marks from the `simple-icons` package, the others a lucide icon (that package has no Slack or Outlook mark). The tiles are not links: the `/integrations` pages were removed the same day. "Use something else?" goes to the contact form.

## Voco Voice (`src/app/(public)/voice/page.js`)

Green-wash hero built like the agent's: a centred headline, "It answers every call. Then it does the job.", with `LiveCallDemo` in the middle and `ReachColumn` pills either side (how callers reach it on the left, where the work lands on the right). Then `HowItWorksSection` (three steps and the caller → agent → connectors → backend flow), `UseCasesSection`, `ControlSection` (the two measured numbers) and the final CTA. Anchors: `#how-it-works`, `#use-cases`, `#control`.

## Voco Agent (`src/app/(public)/agent/page.js`)

Written for an owner who is not technical: jobs and outcomes, no connectors or API talk. Copy and examples are in `src/data/agent.js`.

| # | Section | Data | Surface |
|---|---|---|---|
| 1 | Hero: "Ask your business anything. Then tell it what to do.", the chat illustration with what it reaches either side | `AGENT_CONVERSATIONS` | amber wash |
| 2 | "The jobs nobody has time for": each pain struck through beside what the agent does about it | `AGENT_RELIEFS` | white |
| 3 | Six jobs, each with a message the owner would type | `AGENT_JOBS` | paper |
| 4 | An example week's log, marking what it did and what it told the owner | `AGENT_WEEK` | ink |
| 5 | Where you talk to it: WhatsApp, Telegram, Slack, email | `AGENT_CHANNELS` | white |
| 6 | Control (what it may do alone, the log, what it can reach) beside the three setup steps | `AGENT_CONTROLS`, `AGENT_STEPS` | paper |
| 7 | Final CTA in the agent's colour | | ink |

## Components (`src/components/marketing/`)

| File | Notes |
|---|---|
| `LiveCallDemo.jsx` | Client. A scripted booking call revealed step by step: speech on the left, backend actions on the right, ending with the calendar event. Loops. Renders the finished exchange on the server and for reduced motion. An illustration, labelled as one for screen readers. |
| `AgentChatDemo.jsx` | Client. One scripted conversation per channel: the owner asks, the agent reads named sources, answers, is told what to do, and reports what it did. Plays the four in turn; the channel tabs switch between them. Same server-render and reduced-motion behaviour as the call. |
| `ReachColumn.jsx` | The pills wired to either side of a product hero's illustration; `tone` picks the product colour, `label` adds a small heading. Used by `/voice` and `/agent`. Desktop only. |
| `LandingSections.jsx` | Server. `ProductsSection`, `DemoSection`, `HowItWorksSection`, `UseCasesSection`, `BackendsSection`, `SetupSection`, `ControlSection`, `FaqSection`, `FinalCtaSection` (`title`, `lede`, `variant="primary" | "spark"`). |
| `DemoVideo.jsx` | The demo slot. See below. |
| `CallAndLog.jsx` | Static transcript beside its action log. Used on use-case pages. |
| `icons.js` | Maps icon names in the data files (`use-cases.js`, `agent.js`) to lucide icons. A new icon name must be added here (a test checks). |
| `primitives.jsx` | See the design system note. |

Elsewhere: `src/app/components/landing/LandingNav.jsx` (links from `NAV_LINKS`; mobile drawer; one "Book a demo" button), `LandingFooter.jsx`, `FAQChatWidget.jsx`; `src/components/landing/DemoCTA.js`, `PublicChatButton.jsx`, `PublicChatPanel.jsx`.

## Phone widths

Checked on 2026-11-24 at 390 px (home, `/voice`, `/agent`, `/use-cases`, a use-case page, `/contact`): no horizontal overflow; the two hero illustrations stack and use shorter minimum heights. This machine's Chrome window cannot be made narrow, so the check loads the page in a 390 px same-origin iframe from the browser tools.

## No sign-in on the public site

Removed on 2026-11-24 at the owner's instruction: the nav, mobile drawer, footer and CTA carry no "Sign in" or "Go to dashboard" link, and the nav and CTA no longer ask Supabase whether the visitor is signed in. `DemoCTA` (formerly `AuthAwareCTA`) is a plain server component. `/auth/signin` still exists and is reached by URL. A test fails if a public source file links to `/auth` or `/dashboard`.

## Putting the real demo video in

1. Record it: [[Record a demo]].
2. Put the file under `public/` (or host it) and set `DEMO_VIDEO.src` (and optionally `poster`) in `src/data/site.js`.

Every place that shows the demo (home section 3 and `/demo`) switches from the placeholder to a `<video controls>` player. The placeholder is a still of what the recording shows, with a line saying the walkthrough is on its way; it has no play button that does nothing.

## Numbers on the page

Only two measured ones, both about Voco Voice: the typical reply time (1 to 1.5 s, measured on production calls: [[2026-11-23 Pipeline health check before the demo]]) and "no double bookings" (the atomic booking RPC: [[Scheduling - Booking to calendar on agent calls (verified path)]]). If the measured latency changes, change the figure in `ControlSection`, `src/data/faq.js` and the chatbot's `features.md`.

The figures inside the agent chat and the example week ("Replied to 6 reviews", "4 meetings moved") belong to scripted illustrations and are labelled as examples on the page. They are not claims about a customer.

## Voco Voice's headline

The first line, "Give your backend a voice.", was dropped on 2026-11-24. The owner's objection: the product does not give a backend a voice; it gives a business that needs to talk to callers a voice agent that is already connected to its calendar and other systems. A headline for this page should speak to the owner about calls being answered and the work being done, not about backends. `TAGLINE` in `src/data/site.js` holds the current line; the sign-in panel now shows the site headline instead.

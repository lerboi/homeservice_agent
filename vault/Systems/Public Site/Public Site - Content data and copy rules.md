---
type: system
system: Public Site
status: current
description: "Where public-site copy lives (the data files pages are generated from), how to add a use case or an integration, and the rules the copy must keep, including the gap between what is claimed and what is built."
verified: 2026-11-24
tags: [voco/system/public-site]
---

# Public Site - Content data and copy rules

Part of [[Public Site]]. No public page uses next-intl; copy is in JSX and in these data files.

## Data files (`src/data/`)

| File | Drives | Shape |
|---|---|---|
| `site.js` | Nav, CTAs, metadata, the two products, the demo video slot | `NAV_LINKS`, `PRODUCTS`, `BOOK_DEMO_HREF`, `WATCH_DEMO_HREF`, `HEADLINE` (site), `TAGLINE` (Voco Voice), `DEMO_VIDEO`, `pageMetadata()` |
| `agent.js` | `/agent`, the agent chat illustration | `AGENT_CHANNELS`, `AGENT_CONVERSATIONS` (one per channel), `AGENT_RELIEFS`, `AGENT_JOBS`, `AGENT_WEEK`, `AGENT_CONTROLS`, `AGENT_STEPS` |
| `use-cases.js` | `/use-cases`, `/use-cases/[slug]`, landing grid, sitemap | `USE_CASES[]`: `slug`, `icon`, `title`, `short`, `headline`, `summary`, `call[]`, `log[]`, `steps[4]`, `integrations[]`; `EXTRA_CAPABILITIES[]` |
| `integrations.js` | `/integrations`, `/integrations/[tool]`, landing backends, sitemap | `INTEGRATION_GROUPS[]`; `INTEGRATIONS[]`: `slug`, `name`, `group`, `summary`, `actions[]` |
| `faq.js` | Landing FAQ, FAQ structured data, chat suggestions | `FAQ_ITEMS[]`: `q`, `a`, optional `link` |

**Add a use case:** append to `USE_CASES`; its `integrations` must be existing slugs and its `icon` must be in `src/components/marketing/icons.js`. The page, the grid card and the sitemap entry follow. **Add an integration:** append to `INTEGRATIONS` with an existing `group`.

## Copy rules

1. Describe what the agent does in the business's systems, in plain words.
2. Done-for-you framing: "Voco connects to …", "we set it up with you". Never one-click, self-serve, "in 5 minutes" or "coming soon".
3. No trades and no "receptionist". The buyer is any business whose callers need something done.
4. No prices, plan names, call allowances or trial lengths on public pages or in the chatbot.
5. No customer counts, testimonials or statistics that were not measured on the system.
6. No link to self-serve signup, sign-in or the dashboard.
7. The two products are equals: "Voco Voice" and "Voco Agent". Do not call either the main product, and list them side by side.
8. Do not name the framework or vendors Voco Agent is built on (owner's decision, 2026-11-24).
9. Voco Agent copy is for an owner who is not technical: jobs and outcomes ("replies to your reviews"), not connectors or APIs. Its scripted examples are labelled as illustrations.

Rules 2 to 6 are enforced by the wording and link scans in `tests/unit/public-site.test.js`.

## What is claimed against what is built

The owner decided (2026-11-23) to present a broad set of integrations as available because the sales model is a demo followed by a setup done by the Voco team. Anyone answering a prospect should know the real state:

| Claimed on the site | State in the code |
|---|---|
| Google Calendar, Outlook Calendar | Built. Google verified end to end on 2026-11-24; Outlook code exists, not connected or tested recently |
| SMS and email confirmations and alerts | Built |
| Jobber, Xero | Built, behind a feature flag that is off |
| Stripe | Used for Voco's own billing. No caller-facing payment lookup exists |
| Calendly, Cal.com, HubSpot, Salesforce, Pipedrive, Zoho, ServiceTitan, Housecall Pro, WhatsApp, Slack, QuickBooks, Zapier, Make, webhooks, "your own API" | Not built. Each would be built during a customer's setup |
| **Voco Agent** (all of `/agent`): answering from and acting in reviews, inbox, calendar, search data and support, over WhatsApp, Telegram, Slack and email | Not built. Added to the site on 2026-11-24 at the owner's instruction; it would be set up per customer |
| Use cases: appointment booking | Built (the scheduling profile) |
| Use cases: lead intake, callbacks, order lookup, after-hours rescheduling | Partly present in the older home-service profile (lead capture into Voco's own CRM, caller lookup). Not available in the deployed scheduling profile; writing to an external CRM is not built |

Source for the built column: [[Positioning]] and [[Voice Agent - Scheduling profile and fast LLM path (verified)]].

## Legal pages

`/privacy` and `/terms` were restyled and their one-line product descriptor updated. The body text still says "AI receptionist" in places and the terms still describe a 14-day free trial. They are legal documents and were left for the owner to review.

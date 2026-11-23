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
| `site.js` | Nav, CTAs, metadata, the demo video slot | `NAV_LINKS`, `BOOK_DEMO_HREF`, `WATCH_DEMO_HREF`, `TAGLINE`, `DEMO_VIDEO`, `pageMetadata()` |
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
6. No link to self-serve signup.

Rules 2 to 6 are enforced by the wording scan in `tests/unit/public-site.test.js`.

## What is claimed against what is built

The owner decided (2026-11-23) to present a broad set of integrations as available because the sales model is a demo followed by a setup done by the Voco team. Anyone answering a prospect should know the real state:

| Claimed on the site | State in the code |
|---|---|
| Google Calendar, Outlook Calendar | Built. Google verified end to end on 2026-11-24; Outlook code exists, not connected or tested recently |
| SMS and email confirmations and alerts | Built |
| Jobber, Xero | Built, behind a feature flag that is off |
| Stripe | Used for Voco's own billing. No caller-facing payment lookup exists |
| Calendly, Cal.com, HubSpot, Salesforce, Pipedrive, Zoho, ServiceTitan, Housecall Pro, WhatsApp, Slack, QuickBooks, Zapier, Make, webhooks, "your own API" | Not built. Each would be built during a customer's setup |
| Use cases: appointment booking | Built (the scheduling profile) |
| Use cases: lead intake, callbacks, order lookup, after-hours rescheduling | Partly present in the older home-service profile (lead capture into Voco's own CRM, caller lookup). Not available in the deployed scheduling profile; writing to an external CRM is not built |

Source for the built column: [[Positioning]] and [[Voice Agent - Scheduling profile and fast LLM path (verified)]].

## Legal pages

`/privacy` and `/terms` were restyled and their one-line product descriptor updated. The body text still says "AI receptionist" in places and the terms still describe a 14-day free trial. They are legal documents and were left for the owner to review.

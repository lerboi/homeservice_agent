---
type: system-index
system: Public Site
status: current
repo: homeservice_agent
description: "The public marketing site after the 2026-11 rebrand: routes, where copy and data live, the design system, calls to action, the demo video slot, SEO, and the rules the copy must keep. Start here for any change to a public page."
verified: 2026-11-24
tags: [voco/system/public-site]
---

# Public Site

Up: [[Home]] · [[Systems]] · Positioning: [[Positioning]] · Build record: [[2026-11-24 Public site rebrand]]

Rebuilt on 2026-11-24 for the positioning "voice integration for any backend". Tagline: "Give your backend a voice." The dashboard, onboarding, billing and emails were not touched.

## Routes

Everything public is under the `src/app/(public)/` route group, whose `layout.js` adds the nav, footer, chat button and the two marketing fonts.

| Route | File | What it is |
|---|---|---|
| `/` | `page.js` | Hero + seven sections (see [[Public Site - Landing page and components]]) |
| `/demo` | `demo/page.js` | The recorded demo (placeholder until the video exists) and what it shows |
| `/use-cases`, `/use-cases/[slug]` | `use-cases/` | Five task-based use cases, generated from `src/data/use-cases.js` |
| `/integrations`, `/integrations/[tool]` | `integrations/` | 22 systems in six groups, generated from `src/data/integrations.js` |
| `/pricing` | `pricing/page.js` | "Talk to us". No plan table |
| `/about`, `/contact` | | Company page; the demo-request form |
| `/privacy`, `/terms` | | Legal. Restyled; only the one-line product descriptor changed |
| `/og` | `og/route.jsx` | Generated Open Graph image (`?title=&type=`) |

Retired with permanent redirects in `next.config.js`: `/blog`, `/glossary`, `/compare` → `/`; `/for` and `/for/*` → `/use-cases`; `/integrations/twilio` → `/integrations/sms`. The old `/demo` stub outside the route group is gone.

## Notes

| Note | What is in it |
|---|---|
| [[Public Site - Design system (2026-11)]] | Palette, type, primitives, button contrast rule, where tokens live |
| [[Public Site - Landing page and components]] | Section order, each component, the hero animation, the demo video slot |
| [[Public Site - Content data and copy rules]] | The data files pages are generated from, and what the copy may and may not claim |
| [[Public Site - Public chatbot (2026-11)]] | Prompt, knowledge docs, routing, what it must not say |
| [[Public Site - Contact API Route]] | `POST /api/contact` (unchanged by the rebrand; migrated text) |
| [[Public Site - Internationalization (i18n)]] | next-intl setup. No public page uses it (migrated text) |
| [[Public Site - Email Templates]] · [[Public Site - Environment Variables]] | Unchanged by the rebrand (migrated text) |
| [[Public Site - Scope and change history]] | History of the pre-rebrand site |

## Calls to action

Two, everywhere: **Book a demo** (`/contact?type=sales`) and **Watch the demo** (`/demo`). Both come from `src/components/landing/AuthAwareCTA.js`; the hrefs are constants in `src/data/site.js`. A signed-in visitor sees "Go to dashboard" instead of "Book a demo". There is no self-serve signup link on any public page; "Sign in" stays in the nav and footer for existing accounts.

The seam this leaves: `/auth/signin` still offers sign-up, and the onboarding wizard it leads to still asks for a trade. That is deliberate (see [[Plan 2 - Frontend rebrand to voice integration for any backend]], "Deliberately not touched").

## Pricing data: do not move

`src/app/(public)/pricing/pricingData.js` is no longer rendered on the public page, but onboarding checkout, the dashboard upgrade screen and `/api/usage` import it from that path and its plan ids are wired to Stripe: [[Billing - Plans and limits at a glance (verified)]]. A test holds the four importers.

## SEO

- Root metadata in `src/app/layout.js`; per-page metadata through `pageMetadata()` in `src/data/site.js` (title, description, canonical, Open Graph, Twitter).
- `src/app/sitemap.js` is generated from the same data files as the pages, so a new use case or integration appears automatically.
- JSON-LD: Organization, SoftwareApplication and FAQPage on the home page; BreadcrumbList on use-case and integration pages.

## Tests

`tests/unit/public-site.test.js` (about 90 cases): data completeness and cross-links, sitemap equals the routes that exist, redirects, section order, the demo placeholder, pricing importers, chatbot rules, and a scan of every public source file for retired wording (trades, "receptionist", prices, "free trial", invented social proof, the old orange).

## Things to know

- The layout wrapper sets the page background and text colour explicitly. Without it, a visitor whose system is in dark mode gets the app's dark theme under the light marketing styles.
- `LandingFooter` is a client component only because it prints the current year; a prerendered server component may not read the clock under `cacheComponents`.
- After editing `globals.css` tokens with the dev server running, the served stylesheet can stay stale until the file is touched again.
- `AnimatedSection.jsx` stays in `src/app/components/landing/` because onboarding imports it. The public pages do not use it.

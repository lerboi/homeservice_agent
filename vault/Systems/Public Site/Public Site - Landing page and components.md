---
type: system
system: Public Site
status: current
description: "The landing page's section order and the components behind it: the animated hero call, the demo video slot and how to put the real video in, nav, footer and the CTA component."
verified: 2026-11-24
tags: [voco/system/public-site]
---

# Public Site - Landing page and components

Part of [[Public Site]]. Styling: [[Public Site - Design system (2026-11)]].

## Section order (`src/app/(public)/page.js`)

| # | Section | Component | Surface |
|---|---|---|---|
| 1 | Hero: tagline, lede, CTAs, live call illustration | inline + `LiveCallDemo` | paper |
| 2 | Demo | `DemoSection` → `DemoVideo` | white |
| 3 | How it works: three steps and the flow diagram | `HowItWorksSection` | paper |
| 4 | What it can do: use-case grid | `UseCasesSection` | white |
| 5 | Backends: integration groups | `BackendsSection` | ink |
| 6 | Control and reliability | `ControlSection` | paper |
| 7 | FAQ with the chat widget | `FaqSection` | white |
| 8 | Final CTA | `FinalCtaSection` | ink |

Sections 2 to 8 are server components in `src/components/marketing/LandingSections.jsx`. Anchors: `#demo`, `#how-it-works`, `#use-cases`, `#backends`, `#control`, `#faq`. `FinalCtaSection` takes `title` and `lede` and closes most interior pages too.

## Components (`src/components/marketing/`)

| File | Notes |
|---|---|
| `LiveCallDemo.jsx` | Client. A scripted booking call revealed step by step: speech on the left, backend actions on the right, ending with the calendar event. Loops. Renders the finished exchange on the server and for reduced motion. It is an illustration of the scheduling flow, labelled as one for screen readers, not a recording. |
| `DemoVideo.jsx` | The demo slot. See below. |
| `CallAndLog.jsx` | Static transcript beside its action log. Used on use-case pages with each use case's `call` and `log`. |
| `icons.js` | Maps icon names in the data files to lucide icons. A new icon name must be added here (a test checks). |
| `primitives.jsx` | See the design system note. |

Elsewhere: `src/app/components/landing/LandingNav.jsx` (links from `NAV_LINKS`; mobile drawer; "Go to dashboard" when signed in), `LandingFooter.jsx`, `FAQChatWidget.jsx`; `src/components/landing/AuthAwareCTA.js`, `PublicChatButton.jsx`, `PublicChatPanel.jsx`.

## Putting the real demo video in

1. Record it: [[Record a demo]].
2. Put the file under `public/` (or host it) and set `DEMO_VIDEO.src` (and optionally `poster`) in `src/data/site.js`.

Every place that shows the demo (landing section 2 and `/demo`) switches from the placeholder to a `<video controls>` player. The placeholder is a still of what the recording shows, with a line saying the walkthrough is on its way; it has no play button that does nothing.

## Numbers on the page

Only two, both from the system: the typical reply time (1 to 1.5 s, measured on production calls: [[2026-11-23 Pipeline health check before the demo]]) and "no double bookings" (the atomic booking RPC: [[Scheduling - Booking to calendar on agent calls (verified path)]]). If the measured latency changes, change the figure in `ControlSection`, `src/data/faq.js` and the chatbot's `features.md`.

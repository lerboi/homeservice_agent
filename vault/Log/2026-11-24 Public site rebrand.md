---
type: log
date: 2026-11-24
status: record
description: "Task 3 build record: the public site rebuilt for 'voice integration for any backend'. What was built, retired and deleted, what was verified, the decisions made without sign-off, and what is left for the owner."
verified: 2026-11-24
tags: [voco/log]
---

# 2026-11-24 Public site rebrand

Outcome: the whole public site is rebuilt on the `rebrand` branch of `homeservice_agent`, committed, not pushed. System description: [[Public Site]]. Plan it carried out: [[Plan 2 - Frontend rebrand to voice integration for any backend]].

## Sign-off gate
The plan had a gate: build the hero and one section, show screenshots, wait for sign-off, then build the rest. The owner then said to carry Task 3 out as I saw fit, so everything was built in one pass. The look has therefore not been signed off; it is on a branch so it can be changed before it ships.

## What was built
- **Design system**: `mk-*` colour tokens, Space Grotesk and JetBrains Mono beside Inter, and `src/components/marketing/primitives.jsx`. [[Public Site - Design system (2026-11)]].
- **Landing page**: hero with an animated call-and-actions illustration, then demo, how it works, use cases, backends, control and reliability, FAQ, final CTA. [[Public Site - Landing page and components]].
- **Pages**: `/demo` (inside the public layout, with a placeholder until the video exists), `/pricing` ("talk to us"), `/about`, `/contact` (defaults to a demo request), `/use-cases` with five task-based pages, `/integrations` with 22 systems in six groups.
- **Nav and footer**: Product, Use cases, Integrations, Demo, Pricing; "Book a demo"; light nav with the existing black logo.
- **SEO**: new root metadata, per-page metadata helper, new Open Graph image, sitemap generated from the data files, Organization / SoftwareApplication / FAQPage / BreadcrumbList JSON-LD, permanent redirects for retired routes.
- **Chatbot**: new persona and seven knowledge docs; it no longer quotes prices or offers a trial. [[Public Site - Public chatbot (2026-11)]].
- **Sign-in panel**: copy only. "Trusted by 500+ home service businesses" and the invented avatars are gone.
- **Legal**: restyled; one-line product descriptor updated in each.

## Retired and deleted
- Routes `/blog`, `/glossary`, `/compare`, `/for` and the old `/demo` stub, with redirects.
- Data: `src/data/blog.js`, `comparisons.js`, `glossary.js`, `personas.js`.
- Components: 14 landing components (hero, audio demo, cost-of-silence block, features carousel and grid, scroll line and progress, integrations strip, and others) and the four public pricing components.
- Assets: five demo MP3s, the dashboard mockup and two how-it-works images.
- Skill stubs `public-site-i18n` and `scroll-line-path`; 17 superseded vault notes.

Kept on purpose: `pricingData.js` (billing imports it), `AnimatedSection.jsx` (onboarding imports it), `public/audio/voices/` (the dashboard voice picker).

## Decisions made while building
| Decision | Reason |
|---|---|
| Primary button is ink text on the signal green | White on `#00B37E` is about 2.7:1 and fails contrast |
| Links and eyebrows use a deeper green (`#007A57`) on light surfaces | Same reason |
| The existing black logo is kept | It has no colour to clash with the palette |
| Demo shown as a labelled still, not a fake player | The recording does not exist yet; `DEMO_VIDEO.src` in `src/data/site.js` switches it on |
| Two numbers on the site: reply time 1 to 1.5 s, and no double bookings | The only ones backed by measurement or by how the booking works |
| Legal body text left alone | Legal documents; flagged for the owner |
| "Go to dashboard" replaces "Book a demo" for a signed-in visitor | Carried over from the old CTA behaviour |

## The gap the owner should know about
Per the owner's decision the site presents integrations and use cases as available under a done-for-you framing. Most are not built. The table in [[Public Site - Content data and copy rules]] lists each claim against the code. In short: appointment booking into Google Calendar is built and verified; SMS and email are built; Outlook, Jobber and Xero exist but are untested or flagged off; every other integration, and writing leads or tasks to an external system, would be built during a customer's setup.

## Verified
- `tests/unit/public-site.test.js` and the remaining SEO and public-chat suites: 106 tests pass.
- `next build` succeeds; the use-case and integration pages prerender.
- Local server: every public route returns 200, retired routes return 308 to the right place, the OG image renders.
- Chrome, desktop width: the landing page top to bottom, a use-case page and the contact form were looked at.

## Not verified
- Mobile widths were not looked at in a browser (the layouts use responsive classes throughout, but nobody has seen them).
- The mobile nav drawer, the chat panel and submitting the contact form were not exercised.
- Dark-mode visitors: the layout forces the light surface; checked once with the browser in dark mode.
- Pages other than the three named above were requested but not looked at.

## Found along the way
- Two other pre-existing lint errors of the same kind as the admin pages (`PublicChatButton.jsx`, set-state in an effect). Not changed.
- `next build` logs a `cookies()` prerender message from `/api/calendar-sync/status`. It predates this work.

---
type: plan
date: 2026-11-24
status: in-progress
description: "Start-here handoff for continuing front-end changes to the rebranded public site: exact state on 2026-11-24, branch and commits, how to run and check it, where everything lives, the rules the design and copy must keep, traps already hit, and what is still open."
verified: 2026-11-24
tags: [voco/plan]
---

# Handoff - Public site changes (start here)

For a fresh session that will keep changing the public site. Read this note fully, then [[Now]], then [[Public Site]] and the notes it links. This note supersedes [[Handoff - Demo Studio and rebrand (start here)]] for front-end work; that one is kept as history.

## 1. State on 2026-11-24

**Update, later the same day:** the owner reviewed the site and a second pass is under way. Read [[2026-11-24 Public site second pass - two products and identity]] first: it records the removal of sign-in links, the second product (Voco Agent), the new fonts and colours, and what stage two still has to do. The tables below predate it where they disagree.

| Thing | State |
|---|---|
| Task 1, vault | Done, pushed |
| Task 2, Demo Studio | Deployed and verified in production with scripted calls. `livekit-agent` `main` = `f7c632d`; `homeservice_agent` `main` on GitHub = `123e543`. Only a spoken call through `/admin/demo` has not been done (needs a person). [[Demo Studio]], [[Record a demo]] |
| Task 3, public-site rebrand | **Built, committed locally, not pushed.** Branch `rebrand` in `homeservice_agent`, commit `5ad31ef` plus the handoff commit after it. Build record: [[2026-11-24 Public site rebrand]] |
| Local `main` in `homeservice_agent` | One docs-only commit ahead of GitHub (`98e8cb8`). `rebrand` is branched from it, so it rides along when `rebrand` is pushed |
| Owner's review of the look | **Not done.** The hero-first sign-off was skipped at the owner's instruction. The owner now plans changes to the front end |

Work on the `rebrand` branch. Never push `main` in either repo without the owner's go-ahead: both deploy to production from `main`.

## 2. What the owner is doing next

The owner will ask for specific changes to the public site (look, layout, copy, sections). Nothing is fixed: the design was built in one pass from the plan and has not been approved. Expect requests like "change the hero", "restyle section X", "rewrite this copy". Make the change, check it in the browser, keep tests and the vault in step.

## 3. Where everything is

Full map: [[Public Site]]. The short version:

| Need to change | File |
|---|---|
| Colours, fonts | Tokens in the `@theme inline` block of `src/app/globals.css` (`mk-*`, `font-display`, `font-code`); fonts loaded in `src/app/(public)/layout.js`. [[Public Site - Design system (2026-11)]] |
| Section, heading, button, card styles | `src/components/marketing/primitives.jsx` |
| Landing page order and hero text | `src/app/(public)/page.js` |
| Home and product-page sections | `src/components/marketing/LandingSections.jsx` |
| Voco Voice and Voco Agent pages | `src/app/(public)/voice/page.js`, `src/app/(public)/agent/page.js`, `src/data/agent.js`, `src/components/marketing/AgentChatDemo.jsx` |
| Hero animation (script and layout) | `src/components/marketing/LiveCallDemo.jsx` |
| Demo video or its placeholder | `src/components/marketing/DemoVideo.jsx`; switch on with `DEMO_VIDEO.src` in `src/data/site.js` |
| Nav links, CTA targets, tagline, metadata helper | `src/data/site.js` |
| Nav, footer, CTA buttons | `src/app/components/landing/LandingNav.jsx`, `LandingFooter.jsx`, `src/components/landing/DemoCTA.js` |
| Use cases (cards and pages) | `src/data/use-cases.js`, `src/app/(public)/use-cases/` |
| Tools shown on the home page | `HOME_TOOLS` in `src/components/marketing/LandingSections.jsx` (the integrations pages were removed) |
| FAQ | `src/data/faq.js` |
| Other pages | `src/app/(public)/{demo,pricing,about,contact,privacy,terms}/page.js` |
| Chatbot persona and knowledge | `src/app/api/public-chat/route.js`, `src/lib/public-chatbot-knowledge/*.md`. [[Public Site - Public chatbot (2026-11)]] |
| Open Graph image | `src/app/(public)/og/route.jsx` |
| Redirects | `next.config.js` |

Component and section detail: [[Public Site - Landing page and components]].

## 4. Rules to keep

Design ([[Public Site - Design system (2026-11)]]):
- One colour per product (green for Voco Voice, amber for Voco Agent), each page with its own hero, headlines mixing the grotesque with italic serif emphasis, hairline borders, no drop shadows.
- White text on the green or the amber fails contrast. Buttons are ink text on the colour; coloured text on light surfaces uses the `-deep` variant.
- Build from the primitives; do not hand-write section markup or hardcode hex values in pages.

Copy ([[Public Site - Content data and copy rules]]):
- No trades, no "receptionist", no prices or plan names, no trial, no self-serve signup link, no invented customer numbers or testimonials, no "coming soon".
- Done-for-you framing for integrations: "Voco connects to …", "we set it up with you".
- Only numbers measured on the system (today: reply time 1 to 1.5 s; no double bookings).
- That note also lists which claimed integrations and use cases are actually built. Do not widen the claims without asking the owner.

Do not touch: dashboard, onboarding, billing, emails, `src/app/(public)/pricing/pricingData.js` (billing and onboarding import it from that path), `src/app/components/landing/AnimatedSection.jsx` (onboarding imports it), the `Permissions-Policy` microphone header in `next.config.js`.

Owner preferences ([[MEMORY]]): one committed recommendation rather than a menu; do things for them where possible; measure before claiming; request gating belongs in `src/proxy.js`.

## 5. Run and check

```bash
cd /c/Users/leheh/.Projects/homeservice_agent
git checkout rebrand
npm run dev            # http://localhost:3000
npm test -- tests/unit/public-site.test.js tests/unit/seo-metadata.test.js tests/unit/seo-robots.test.js tests/unit/seo-schema-markup.test.js tests/unit/public-chat-api.test.js
npx eslint "src/app/(public)" src/components/marketing src/components/landing src/app/components/landing src/data
npx next build
python vault/_meta/tools/build_hubs.py && python vault/_meta/tools/check_vault.py
```

`tests/unit/public-site.test.js` pins structure and rules, not wording: section order, anchors, data completeness, sitemap, redirects, and a scan of every public source file for retired wording. Changing copy rarely breaks it; adding or renaming a section, route, use case, integration group or nav link does, and the test should be updated with the change. The full Jest suite has about 24 failing suites that also fail on `main` and are unrelated.

Look at the result in Chrome with the browser tools (the local session is already signed in as the admin, so the nav shows "Go to dashboard"; a signed-out visitor sees "Sign in" and "Book a demo").

## 6. Traps already hit

- **Shell heredocs fail unpredictably** (apostrophes and escapes in the body) in this environment's Bash tool (`unexpected EOF while looking for matching '`). Write files with the Write tool and make edits with the Edit tool; if a script is needed, write it to a file under `$TEMP` first and run that.
- **Stale stylesheet in dev.** After editing tokens in `globals.css` with the dev server running, the served CSS can stay old. Touch the file again (or restart `next dev`) and reload.
- **First load of each route takes 30 to 60 s** in dev on this machine. A Chrome tab navigated too early shows "New Tab" and the browser tools report a browser-internal URL. Request the route with `curl` first, then navigate.
- **Dark mode.** The app's theme provider follows the system. `src/app/(public)/layout.js` sets the light background and text colour on its wrapper; keep that or dark-mode visitors get dark surfaces under light styles.
- **`new Date()` in a server component** breaks prerendering under `cacheComponents`. The footer is a client component for that reason.
- **Lint rule `react-hooks/set-state-in-effect`** fires on synchronous `setState` inside an effect. Three old files already fail it (`PublicChatButton.jsx`, two admin pages); do not add more.
- **CPU.** With `next dev` running the machine sits near 100% CPU. Stop the dev server before running a local voice worker.
- Stop the dev server by killing the process listening on port 3000; closing the shell does not always stop it.

## 7. Open items

1. The owner's requested front-end changes (the reason for this handoff).
2. Go-ahead to push `rebrand` to `main`.
3. Mobile widths, the mobile nav drawer, the chat panel and a real contact-form submission have not been looked at. Only the landing page, one use-case page and the contact form were viewed, at desktop width.
4. The recorded demo video: [[Record a demo]], then `DEMO_VIDEO.src`.
5. Owner's review of `/privacy` and `/terms`: body text still says "AI receptionist" and describes a 14-day free trial.
6. Sign-up is still reachable from `/auth/signin` and leads to the trade-based onboarding wizard.
7. Carried from Task 2: a spoken call through `/admin/demo`; whether the Google OAuth app is in "Testing" mode (if so the calendar connection expires around 2026-11-30); post-call triage layer 2 calls a deprecated OpenAI model.

## 8. When a change is made

Update the matching note under `vault/Systems/Public Site/` and set its `verified:` date; add a line to [[2026-11-24 Public site rebrand]] or a new Log note for anything notable; keep [[Now]] current; run the vault check; commit on `rebrand` with the attribution line. Both GitHub repos are public: no secrets or personal data in notes or commits.

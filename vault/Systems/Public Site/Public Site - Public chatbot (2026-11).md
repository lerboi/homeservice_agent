---
type: system
system: Public Site
status: current
description: "The public website chatbot after the rebrand: where it appears, the system prompt's rules (no prices, no self-serve signup), the seven knowledge docs and how one is chosen for a message."
verified: 2026-11-24
tags: [voco/system/public-site]
---

# Public Site - Public chatbot (2026-11)

Part of [[Public Site]].

## Where it appears
- The floating button on every public page: `src/components/landing/PublicChatButton.jsx` opening `PublicChatPanel.jsx`. It sends the current pathname as `currentRoute`.
- The widget beside the landing FAQ: `src/app/components/landing/FAQChatWidget.jsx`. Its suggestion chips are `FAQ_CHAT_SUGGESTIONS` in `src/data/faq.js`.

Both post to `POST /api/public-chat` (`src/app/api/public-chat/route.js`): rate-limited, last 10 messages of history, a Groq-hosted Llama model, 400 tokens, replies in the visitor's language. The rebrand changed the persona and the knowledge, not the plumbing.

## What the prompt tells it
- It answers only about Voco: the two products (Voco Voice and Voco Agent, presented as equals), what each does, which systems they work in, how setup works, how to book a demo.
- Setup is described as done with the Voco team after a demo.
- It must not: quote prices, plan names, call allowances or trial lengths; mention self-serve signup or a free trial; promise one-click setup for a specific system; invent customer numbers or testimonials; name competitors; name the technology Voco Agent is built on.
- For a feature Voco does not have, it says so and links to the contact form.

## Knowledge (`src/lib/public-chatbot-knowledge/`)

Eight Markdown files: `overview`, `features` (Voco Voice), `agent` (Voco Agent), `how-it-works`, `integrations`, `faq`, `pricing`, `contact`. `index.js` picks at most two per message:

1. The doc for the page the visitor is on (`/voice` → `features.md`, `/agent` → `agent.md`). Sub-pages use their section's doc (`/use-cases/lead-intake` → `features.md`); unknown routes get `overview.md`. `integrations.md` is now reached by keyword only, and still lists more systems than the home page shows.
2. One more, by the first keyword group the message matches.

`pricing.md` contains no numbers and tells the model not to give any. When the product or the measured reply time changes, update `features.md` here as well as the page copy.

## Tests
`tests/unit/public-site.test.js` (prompt rules, no prices or trade wording in the docs, route and keyword selection) and `tests/unit/public-chat-api.test.js` (the route).

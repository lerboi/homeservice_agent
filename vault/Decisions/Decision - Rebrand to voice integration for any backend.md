---
type: decision
date: 2026-11-23
status: current
description: "The owner's decisions for the November 2026 rebrand: positioning, buyer, call to action, pricing, integrations, palette, and the demo setup."
tags: [voco/decision]
---

# Decision - Rebrand to voice integration for any backend

## Context
Voco was built as an AI receptionist for home-service contractors. There are no paying customers. The owner wants the public site repositioned as a voice integration that connects to any backend, with booking and scheduling as the lead use cases, and a recorded demo as proof.

## Decision (owner's answers, 2026-11-23)
1. The vault lives in this repo.
2. Buyer: businesses.
3. Integrations: a broad set presented as available.
4. Primary call to action: book a demo.
5. Pricing: "talk to us" for now.
6. Retire `/blog`, `/glossary`, `/compare`; turn `/for` into `/use-cases`.
7. New palette, modern and clean, chosen by Claude with a screenshot sign-off.
8. Demo: recorded as a browser call; the agent answers as Voco; reuse the existing `voco` tenant; Outlook is a selectable destination alongside Google.
9. Scope: public frontend only. Dashboard, onboarding, billing and the database are left as they are.

## Consequences
- The public site and the app behind sign-in will describe different products until the app is revisited. Public pages stop linking to self-serve onboarding to hide that seam.
- Fabricated proof ("Trusted by 500+ home service businesses", invented testimonials) is removed.
- Order of work: vault, then Demo Studio, then the site, because the landing page features the demo video.

## Sources
[[Plan 1 - Obsidian vault migration]], [[Plan 2 - Frontend rebrand to voice integration for any backend]], [[Plan 3 - Demo Studio]], [[Positioning]].

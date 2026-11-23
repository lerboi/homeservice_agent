---
type: product
status: current
description: "What Voco is sold as. New positioning decided 2026-11-23 (voice integration for any backend) and the legacy home-service positioning it replaces."
verified: 2026-11-24
tags: [voco/product]
---

# Positioning

## Current (decided 2026-11-23)

**Voco is the voice layer for your backend.** A voice agent answers the call (phone or web), understands what the person wants, and does the work in the systems the business already runs: books the appointment, schedules the task, creates the record, sends the confirmation. Working headline: "Give your backend a voice."

| Question | Answer |
|---|---|
| Buyer | Businesses and operations teams. Voco connects the agent to their systems for them. |
| Primary call to action | "Book a demo" and "Watch the demo". No public self-serve signup. |
| Pricing | "Talk to us" for now. Plan data and Stripe wiring stay in the code for the existing app. |
| Integrations | A broad set presented as available under a done-for-you framing ("Voco connects to …"). |
| Brand | Name stays Voco. New palette (light, ink, one green-teal accent). |

Decision record: [[Decision - Rebrand to voice integration for any backend]]. The public site was rebuilt for this on 2026-11-24 (branch `rebrand`): [[Public Site]], [[2026-11-24 Public site rebrand]]. What the site claims against what is built: [[Public Site - Content data and copy rules]].

### What is actually built (2026-11-23)
- Phone answering (Twilio SIP) and browser voice (LiveKit).
- Scheduling: availability, atomic booking, Google Calendar and Outlook Calendar push and sync.
- SMS and email confirmations and alerts, transcripts, recordings, transfer to a human.
- Jobber and Xero: built, flagged off.
- Not built: generic webhooks, a public API or SDK, other CRMs.

## Legacy (still in the app behind sign-in)

"AI receptionist for home service businesses": plumbers, HVAC, electricians, handymen. The public site no longer says this. The dashboard, the onboarding wizard (trade selector, trade templates) and the agent's `home_service` profile still embody it; the agent's default profile is now general scheduling.

Related: [[Site Flow]], [[Backlog]].

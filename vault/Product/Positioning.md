---
type: product
status: current
description: "What Voco is sold as. New positioning decided 2026-11-23 (voice integration for any backend) and the legacy home-service positioning it replaces."
verified: 2026-11-23
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

Decision record: [[Decision - Rebrand to voice integration for any backend]]. Build plan: [[Plan 2 - Frontend rebrand to voice integration for any backend]].

### What is actually built (2026-11-23)
- Phone answering (Twilio SIP) and browser voice (LiveKit).
- Scheduling: availability, atomic booking, Google Calendar and Outlook Calendar push and sync.
- SMS and email confirmations and alerts, transcripts, recordings, transfer to a human.
- Jobber and Xero: built, flagged off.
- Not built: generic webhooks, a public API or SDK, other CRMs.

## Legacy (until the rebrand ships)

"AI receptionist for home service businesses": plumbers, HVAC, electricians, handymen. The agent answers calls 24/7, triages urgency, books appointments and creates CRM leads so contractors never lose a job to voicemail. The dashboard, onboarding wizard (trade selector, trade templates) and the agent's production prompt still embody this.

Related: [[Site Flow]], [[Backlog]].

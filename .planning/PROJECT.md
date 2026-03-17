# HomeService AI Agent

## What This Is

An all-in-one AI platform for home service SMEs (plumbers, HVAC, electricians, etc.) that answers every inbound call instantly via a low-latency voice AI receptionist, triages emergencies from routine inquiries, and books jobs directly into the owner's real-time calendar — turning missed $50 ad-spend leads into confirmed $1,000+ jobs in under 2 minutes, 24/7, without the owner touching their phone.

## Core Value

Every inbound call is answered instantly and converted into a confirmed booking or qualified lead — no call goes to voicemail, no lead is lost to a competitor.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] AI voice receptionist answers inbound calls with sub-second pickup via Retell
- [ ] Multi-language voice support from day one (global home service markets)
- [ ] Layered triage system: keywords + caller urgency + owner-configured rules to classify emergency vs routine
- [ ] Owner-defined service tiers to mark which job types are high-ticket
- [ ] Emergency calls get instant booking into next available slot
- [ ] Routine calls get captured as qualified leads for owner confirmation
- [ ] Built-in availability scheduler with time slot management
- [ ] Google Calendar and Outlook sync for real-time availability
- [ ] Anti-double-booking with slot locking at moment of booking
- [ ] Lead tracker CRM: new → booked → completed → paid pipeline
- [ ] Lead capture with caller details, job type, urgency, address, notes
- [ ] Owner notifications via SMS, email, and push when leads come in
- [ ] Web-based dashboard (mobile-responsive) for managing leads, calendar, and settings
- [ ] Business onboarding: configure services, tiers, availability, and greeting scripts
- [ ] Call recordings and transcripts stored per lead

### Out of Scope

- Native mobile app — web-first, mobile-responsive (defer to v2)
- Omnichannel chat (SMS, web widget, WhatsApp, Messenger) — voice-first, chat is a later add-on
- Full CRM (invoicing, job costing, crew dispatch) — lead tracker only, not replacing ServiceTitan
- Payment processing — out of scope for v1
- Outbound calling / follow-up automation — inbound only for v1

## Context

**The Problem:** Home service businesses pay $20-$50 per Google Ads lead. When that lead calls and gets voicemail, they hang up within 6 seconds and call the next competitor. The business loses a $1,000+ job because nobody picked up. Human answering services can't verify addresses, sync calendars, or book — they're expensive and leaky.

**The Market:** Home services is a fragmented market of millions of SMEs globally. Most run on phone calls. The owner is often on a job site and can't answer. There's no affordable "instant response" solution that actually books.

**Voice AI Approach:** Use Retell as the telephony + speech layer for low-latency, natural-sounding voice interactions. Retell handles STT/TTS and telephony infrastructure, letting us focus on the intelligence layer (triage, scheduling, CRM).

**Triage Intelligence:** Three-layer system:
1. **Keyword detection:** "flooding," "gas smell," "no heat" → emergency. "Quote," "next week," "remodel" → routine.
2. **Caller urgency signals:** Temporal cues ("happening right now" vs "sometime next month"), stress indicators.
3. **Owner-configured rules:** Business defines which service types are emergency, which are high-ticket, custom escalation paths.

**Scheduling Logic:** Calendar must be the single source of truth. Slot locking must be atomic — if two calls come in simultaneously, one gets the slot and the other gets the next available. Travel time buffers and geographic zone grouping to be designed during phase planning.

**Monetization:** Monthly SaaS subscription per business.

**Target:** Demo-ready product that can be shown to potential home service customers.

## Constraints

- **Voice Latency:** Must feel like talking to a real person — sub-second response times are critical for caller trust
- **Telephony Platform:** Retell for voice infrastructure (not building from scratch)
- **Calendar Integrity:** Zero tolerance for double-bookings — atomic slot locking is non-negotiable
- **Multi-language:** Voice AI must handle multiple languages from v1, not a later addition
- **Web-first:** Browser-based dashboard, no native mobile app in v1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Retell over Vapi and raw Twilio+STT | Faster to market, proven low-latency voice, focus on intelligence not infra | — Pending |
| Lead tracker over full CRM | Avoid competing with ServiceTitan/Housecall Pro; integrate don't replace | — Pending |
| Voice-first, defer chat channels | Calls are where the money is lost; chat can layer on later | — Pending |
| Multi-language from day one | Global market = global languages; retrofitting is harder than building in | — Pending |
| Monthly SaaS pricing | Predictable revenue, simple for SME owners to understand | — Pending |

---
*Last updated: 2025-03-18 after initialization*

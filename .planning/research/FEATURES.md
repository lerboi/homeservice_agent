# Feature Research

**Domain:** AI Voice Receptionist + Home Service Booking / Lead CRM
**Researched:** 2026-03-18
**Confidence:** MEDIUM (training knowledge through Aug 2025; live web verification was unavailable — all findings derived from training data on Vapi, Retell, Housecall Pro, ServiceTitan, Smith.ai, Jobber, and related platforms)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features home service business owners assume any answering/booking product has. Missing these = product feels broken or unprofessional.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Instant call pickup (no ring delay) | Core promise — caller hangs up in 6 sec if not answered | HIGH | Requires Vapi/Retell webhook + phone number provisioning; latency is the product |
| Natural-sounding voice (not robotic) | Any robotic IVR kills caller trust immediately | HIGH | Solved by Vapi/Retell TTS layer; voice model selection matters; ElevenLabs-backed voices are table stakes in 2025+ |
| Caller ID capture | Every lead tracker starts with "who called" | LOW | Telephony provider delivers ANI automatically; display + store it |
| Job type / service capture | Owner must know what the call was about | MEDIUM | Structured extraction via LLM from transcript; needs a service taxonomy configured per business |
| Appointment date/time capture | Booking is the whole point | HIGH | Must integrate with real calendar; slot availability query + confirmation loop with caller |
| Address / location capture | Home service = on-site; no address = useless lead | MEDIUM | Voice address parsing is error-prone; must read back and confirm with caller |
| Owner notification on new lead or booking | Owner is on a job site; needs to know immediately | MEDIUM | SMS + email minimum; push notification if web app has service worker |
| Call recording storage | For quality review, dispute resolution, and context | LOW | Vapi/Retell provide recording URLs; store reference + serve from dashboard |
| Call transcript storage | Owner reads transcript instead of re-listening | MEDIUM | Vapi/Retell provide transcripts; store and display per lead |
| Lead status pipeline (new → booked → done) | Any CRM has a pipeline; without it there's no tracking | MEDIUM | Simple state machine; kanban or list view in dashboard |
| Business hours / availability configuration | Must not book outside working hours | MEDIUM | Owner-configured schedule; integration with calendar free/busy |
| Duplicate lead detection | Same caller calling back should not create two records | MEDIUM | Match on phone number; merge or link records |
| Dashboard to view all leads and calls | Operator needs a single place to see what happened overnight | MEDIUM | Web UI; filterable list + detail view |
| Settings / onboarding configuration | Owner must set greeting, services, hours before going live | MEDIUM | Wizard or settings form; greeting script, service list, schedule, escalation rules |

### Differentiators (Competitive Advantage)

These are where this product competes. Aligned to the core value: every call converted, no lead lost.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Three-layer triage (keyword + urgency + owner rules) | Competitors use dumb IVR or single-signal classification; three layers catches edge cases a single rule misses | HIGH | Layer 1: regex/keyword matching on transcript. Layer 2: LLM urgency scoring from temporal cues and stress markers. Layer 3: owner-configured rule table. Emergency path books immediately; routine path queues for confirmation |
| Atomic slot locking (zero double-booking) | Human answering services and basic AI bots do not lock slots atomically; double-booking destroys trust | HIGH | Requires database-level locking or optimistic concurrency with conflict resolution; non-trivial when concurrent calls arrive simultaneously |
| Real-time Google Calendar + Outlook sync (bidirectional) | Owner already lives in their calendar; any solution requiring a second calendar is abandoned | HIGH | OAuth for both providers; webhook/poll for external changes; push availability into voice agent in real time |
| Multi-language voice from day one | Competitors launch English-only and retrofit; retrofitting voice agent prompts and TTS at scale is painful | HIGH | Requires language detection on first utterance; per-language system prompts; multi-language TTS voice selection in Vapi/Retell |
| Emergency vs routine call separation with separate workflows | High-ticket emergency jobs ($2,000+ water main break) get different treatment than "call me next week" routine quotes | HIGH | Emergency: immediate slot lock + owner SMS with urgency flag. Routine: capture + add to lead queue. This is the direct monetization logic |
| Owner-defined service tiers with high-ticket flagging | Owner marks HVAC replacement as high-ticket; AI treats those calls differently in triage priority | MEDIUM | Simple configuration — service list with tier/priority tag; influences triage scoring |
| Travel time buffer + geographic zone grouping | Reduces back-to-back bookings across city; prevents wasted drive time between appointments | HIGH | Complex scheduling logic; requires ZIP code / address to zone mapping; travel time estimation; not table stakes but a strong retention feature |
| Per-business custom greeting and persona | Owner's business name, tone, and personality reflected in the AI voice | MEDIUM | Templated system prompt with owner-provided business name, services, and tone preference; Vapi/Retell agent configuration |
| Caller urgency scoring visible in dashboard | Owner sees "HIGH urgency" on a lead without replaying the call | MEDIUM | LLM outputs urgency label + reason; store and display in lead card |
| Lead conversion rate analytics | Owner sees how many calls turned into bookings vs abandoned | MEDIUM | Aggregate metrics per period; funnel: calls answered → leads captured → booked → completed |
| Missed/abandoned call recovery | If caller hangs up before booking, queue an SMS follow-up | HIGH | Requires outbound SMS (Twilio); caller number available; permission/compliance considerations (TCPA); this is v1.x territory |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Native iOS/Android app | "I want it on my phone" | Doubles build cost, app store delays, push notification complexity; the dashboard is read-mostly and works fine as a PWA | Mobile-responsive web dashboard with PWA manifest; add home screen shortcut; defer native app to v2 when retention is proven |
| Full invoicing and job costing (replacing ServiceTitan) | Owners want fewer tools | Competing with established FSM platforms is a multi-year effort; ServiceTitan has 10,000+ developer hours invested | Integrate with ServiceTitan/Jobber/Housecall Pro via API rather than replacing them; be the inbound layer, not the ops layer |
| Outbound auto-dialer / robocall campaigns | "Can it call my old customers for reviews?" | TCPA compliance in the US is a legal minefield; high churn risk if owners get fined; completely different product surface | Offer manual "call this lead back" button that initiates a human call; defer outbound AI calling to v2 with legal review |
| SMS/chat/WhatsApp/web widget omnichannel | "Meet customers everywhere" | Each channel doubles QA burden; chat has different UX constraints than voice; risks shipping nothing great instead of voice done perfectly | Voice first, prove conversion rates, then add SMS as v1.x add-on; don't build omnichannel until voice channel has retention |
| Real-time transcription display (watch the call live) | "I want to see what's happening" | Adds WebSocket streaming complexity, significant infrastructure overhead; owners are on job sites and won't watch live | Provide post-call transcript within 30 seconds of call end; that's what owners actually use |
| AI upselling scripts during call | "Can it pitch maintenance contracts?" | Pushes caller through longer call = higher hang-up rate; destroys the core "book fast" value prop | Keep call short and outcome-focused; upsell offers can be in the post-booking confirmation SMS/email |
| Crew/technician dispatch and GPS tracking | "One tool for everything" | Field service dispatch is a solved market (ServiceTitan, Jobber); building dispatch = competing with FSM giants on their home turf | Integrate via webhook/API to pass confirmed bookings to whatever FSM the owner uses |
| Payment processing built-in | "Collect deposit at booking" | PCI compliance, payment gateway integration, chargeback handling — enormous scope for v1 | Note the booking; let the owner's existing payment process handle it; revisit in v2 with Stripe Elements |

---

## Feature Dependencies

```
[Voice receptionist (Vapi/Retell integration)]
    └──requires──> [Phone number provisioning]
    └──requires──> [Business onboarding / configuration]
                       └──requires──> [Service list configuration]
                       └──requires──> [Availability schedule configuration]
                       └──requires──> [Greeting script configuration]

[Appointment booking]
    └──requires──> [Availability scheduler]
                       └──requires──> [Calendar sync (Google/Outlook)]
    └──requires──> [Atomic slot locking]
    └──requires──> [Address capture + confirmation]

[Triage (emergency vs routine)]
    └──requires──> [Service list configuration] (to match job types to tiers)
    └──requires──> [Owner-defined rules] (escalation paths)
    └──enhances──> [Appointment booking] (emergency → immediate slot lock)

[Lead CRM pipeline]
    └──requires──> [Lead capture] (caller ID, job type, address, notes)
    └──requires──> [Call recording + transcript storage]
    └──enhances──> [Owner notifications]

[Owner notifications]
    └──requires──> [Lead capture] (need something to notify about)
    └──requires──> [Owner contact configuration] (SMS number, email)

[Multi-language support]
    └──requires──> [Language detection on first utterance]
    └──requires──> [Per-language system prompt variants]
    └──requires──> [Multi-language TTS voice in Vapi/Retell]

[Analytics / conversion metrics]
    └──requires──> [Lead CRM pipeline] (needs status data to aggregate)
    └──requires──> [Call logs] (answered, abandoned, duration)

[Travel time buffer / geo zone grouping]
    └──requires──> [Address capture]
    └──requires──> [Availability scheduler]
    └──requires──> [External geocoding/routing API]

[Urgency scoring in dashboard]
    └──requires──> [Triage system] (urgency label must be stored)
    └──requires──> [Lead CRM] (display surface)
```

### Dependency Notes

- **Appointment booking requires Calendar sync:** Without real calendar integration, slot availability is fictional and double-bookings are inevitable. Calendar sync must be in the same phase as booking, not deferred.
- **Triage requires Service list configuration:** The keyword and rule layers of triage need to know the owner's service taxonomy. Onboarding must happen before the agent goes live.
- **Multi-language requires language detection first:** Cannot route to per-language prompts without detecting the caller's language on the first utterance. Detection logic is a prerequisite, not an afterthought.
- **Travel time buffering conflicts with simple slot locking:** Atomic slot locking assumes fixed-duration appointments; travel time buffers require variable-duration gaps between bookings. Do not combine these in the same phase — get atomic locking right first, add travel buffers as a scheduling enhancement later.
- **Analytics requires a populated pipeline:** Metrics are meaningless on day one. Build the CRM pipeline in v1; add analytics dashboards in v1.x once there's real data.

---

## MVP Definition

### Launch With (v1)

Minimum viable product to validate "AI answers calls and books jobs."

- [ ] Voice receptionist via Vapi or Retell — answers every inbound call instantly with natural voice
- [ ] Business onboarding configuration — greeting script, service list, working hours, owner contact info
- [ ] Three-layer triage — classify emergency vs routine, apply owner rules
- [ ] Address + job type + caller ID capture with read-back confirmation
- [ ] Availability scheduler with atomic slot locking
- [ ] Google Calendar + Outlook sync (bidirectional, real-time)
- [ ] Lead CRM: new → booked → completed pipeline with lead detail view
- [ ] Call recording and transcript stored per lead
- [ ] Owner notifications via SMS and email on new lead / booking
- [ ] Web dashboard (mobile-responsive) — leads list, calendar view, settings
- [ ] Multi-language support — language detection + per-language prompts + TTS

### Add After Validation (v1.x)

Add once core booking loop is proven and owners are retaining.

- [ ] Urgency scoring visible on lead card — trigger: owners report re-listening to recordings to determine urgency
- [ ] Lead conversion rate analytics — trigger: owners ask "is this working?"
- [ ] Duplicate lead detection and merge — trigger: same caller appearing multiple times in CRM
- [ ] Missed/abandoned call SMS recovery — trigger: owners notice calls that ended before booking
- [ ] Travel time buffer and geographic zone grouping — trigger: owners in dense urban markets complain about scheduling
- [ ] Per-business custom voice persona (voice model selection) — trigger: owners want brand differentiation

### Future Consideration (v2+)

Defer until product-market fit is established.

- [ ] Native iOS/Android app — defer; validate that mobile-responsive web is insufficient first
- [ ] Outbound AI calling (review requests, follow-ups) — defer; TCPA compliance requires legal review
- [ ] SMS/chat/WhatsApp omnichannel — defer; prove voice ROI before expanding channels
- [ ] Payment processing / deposit collection at booking — defer; PCI scope is disproportionate for v1
- [ ] Crew dispatch and field service management — defer; integrate with ServiceTitan/Jobber instead
- [ ] Full white-label / multi-tenant reseller portal — defer; useful for agency channel but not core validation

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Instant call pickup (Vapi/Retell integration) | HIGH | HIGH | P1 |
| Business onboarding configuration | HIGH | MEDIUM | P1 |
| Three-layer triage (emergency vs routine) | HIGH | HIGH | P1 |
| Address + job type capture with confirmation | HIGH | MEDIUM | P1 |
| Atomic slot locking | HIGH | HIGH | P1 |
| Google Calendar + Outlook sync | HIGH | HIGH | P1 |
| Lead CRM pipeline | HIGH | MEDIUM | P1 |
| Call recording + transcript | HIGH | LOW | P1 |
| Owner SMS + email notifications | HIGH | LOW | P1 |
| Web dashboard (leads + calendar + settings) | HIGH | MEDIUM | P1 |
| Multi-language support | HIGH | HIGH | P1 |
| Urgency scoring on lead card | MEDIUM | MEDIUM | P2 |
| Lead conversion analytics | MEDIUM | MEDIUM | P2 |
| Duplicate lead detection | MEDIUM | MEDIUM | P2 |
| Missed call SMS recovery | MEDIUM | HIGH | P2 |
| Travel time buffer + geo zone grouping | MEDIUM | HIGH | P2 |
| Custom voice persona selection | LOW | MEDIUM | P2 |
| Native mobile app | MEDIUM | HIGH | P3 |
| Outbound AI calling | MEDIUM | HIGH | P3 |
| Payment deposit collection | MEDIUM | HIGH | P3 |
| Crew dispatch / FSM integration | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Smith.ai (AI receptionist) | Housecall Pro / Jobber (FSM) | Our Approach |
|---------|---------------------------|------------------------------|--------------|
| Call answering | AI + human hybrid; human escalation available | Not primary feature | AI-only; no human fallback in v1; owner is the human escalation path |
| Triage / emergency detection | Basic message-taking; no structured triage | Not applicable | Three-layer triage is a primary differentiator |
| Calendar / booking | Passes messages; does not book into calendar | Native scheduling within FSM | Real-time calendar sync + atomic booking is core, not an add-on |
| CRM pipeline | Minimal; contact log only | Full FSM: jobs, invoicing, dispatch | Lead tracker only; intentionally narrow to avoid FSM competition |
| Multi-language | English primary; limited Spanish | English-only primarily | Multi-language from day one; competitive gap in non-English markets |
| Pricing model | Per-minute + per-call; expensive at volume | Monthly SaaS; mid-market pricing | Monthly SaaS subscription per business; predictable for SME owners |
| Voice quality | AI or live human | Not applicable | Low-latency AI voice via Vapi/Retell; ElevenLabs-quality TTS |
| Integration depth | Zapier-level webhooks | Native integrations with QuickBooks, Stripe, etc. | Google Calendar + Outlook native; Zapier/webhook for FSM handoff |

---

## Sources

- Training knowledge: Vapi platform capabilities (vapi.ai, through Aug 2025)
- Training knowledge: Retell AI capabilities (retellai.com, through Aug 2025)
- Training knowledge: Smith.ai AI receptionist feature set (through Aug 2025)
- Training knowledge: Housecall Pro and Jobber FSM feature sets (through Aug 2025)
- Training knowledge: ServiceTitan enterprise FSM feature set (through Aug 2025)
- Training knowledge: TCPA compliance constraints for outbound SMS/calling (through Aug 2025)
- All claims: MEDIUM confidence (training data only; live verification was unavailable during this research session)

**Note on confidence:** WebSearch and WebFetch were both unavailable during this research session. All findings derive from training data (cutoff August 2025). The feature landscape for AI voice receptionists was evolving rapidly through 2025; specific competitor feature details should be spot-checked against live product pages before using for strategic decisions.

---
*Feature research for: AI Voice Receptionist + Home Service Booking CRM*
*Researched: 2026-03-18*

# Feature Research

**Domain:** Booking-first digital dispatcher for home service AI voice platform
**Researched:** 2026-03-24
**Confidence:** HIGH (booking patterns, exception handling) / MEDIUM (notification priority tiers, competitor implementation details)

---

## Scope

This file covers ONLY the new features for milestone v2.0: the pivot from emergency-triage escalation model to booking-first digital dispatcher. The existing platform (voice receptionist, triage engine, slot booking, Google Calendar sync, lead CRM, owner notifications, recovery SMS, dashboard, onboarding wizard) is treated as a stable dependency. "Existing" means already built in v1.0/v1.1.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any booking-first AI dispatcher must have. Missing these = the pivot is incomplete.

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Universal booking default (all call types) | Industry standard: Sameday, Dispatchly, Avoca, Jobber AI Receptionist all book every call by default; an AI that triages-then-routes instead of booking feels like a gatekeeper, not an assistant | MEDIUM | Existing agent prompt (rewrite), existing slot booking engine (SCHED-*) |
| Emergency-to-nearest-slot routing | Callers with urgent problems (flooding, gas, no heat) expect same-day service; booking them into "next week" is functionally the same as not booking | LOW | Existing slot engine already supports nearest-slot; prompt must request it for emergency-tagged calls |
| Routine-to-next-available routing | Non-urgent callers expect a reasonable slot without urgency theater; "we can get you in Thursday morning" is the expected response | LOW | Existing slot engine default behavior; no new logic needed |
| Caller confirmation of booked slot | Every competitor (Sameday 92% booking rate, Dispatchly, Jobber) confirms the slot verbally during the call and sends SMS/email after; unconfirmed bookings feel incomplete | LOW | Existing booking confirmation flow; agent prompt must verbalize slot details before ending call |
| SMS confirmation to caller after booking | Sameday, Newo, AgentZap all send post-call confirmation; callers expect a text with date/time/address as proof of booking | LOW | Existing notification infrastructure; add caller-facing SMS template |
| Graceful fallback when no slots available | AI must not dead-end; "no availability" must lead to waitlist, callback promise, or recovery SMS with manual booking link | MEDIUM | Existing recovery SMS mechanism; needs new trigger condition (no-slot-available vs booking-failure) |
| Human transfer on explicit request | Every AI receptionist platform transfers when caller says "talk to a person" / "let me speak to someone"; blocking this destroys trust | LOW | Retell warm transfer already supported; agent prompt must honor explicit transfer requests |
| Human transfer on AI confusion | When AI cannot understand the job type or request after 2-3 attempts, transfer is the only non-destructive option; Retell, Smith.ai, and Replicant all implement this | MEDIUM | Retell warm transfer; need confusion detection logic (repeated clarification attempts, low-confidence NLU) |
| Context preservation on transfer | Warm transfer with context summary is the 2025-2026 standard; Retell supports whisper messages to receiving agent; cold transfers with no context are unacceptable | LOW | Retell warm transfer with whisper messages (already available in Retell platform) |
| Urgency tag retained on booking record | Even though urgency no longer routes calls, the tag must persist on the lead/booking record for owner visibility and notification priority | LOW | Existing triage engine produces urgency tags; ensure they attach to booking record, not just routing decision |

### Differentiators (Competitive Advantage)

Features that set this product apart from Sameday, Dispatchly, Avoca, Jobber AI.

| Feature | Value Proposition | Complexity | Depends On |
|---------|-------------------|------------|------------|
| Notification priority tiers driven by urgency | Competitors treat all bookings equally in notifications; urgency-driven priority means emergency bookings trigger immediate high-priority SMS/email (bold, "EMERGENCY" prefix, repeated if unread) while routine bookings use standard flow; owner sees what matters first without answering the phone | MEDIUM | Existing notification system (SMS/email); new priority tier logic and template variants |
| No-dead-end guarantee (universal recovery SMS) | Every call path that fails to book triggers recovery SMS with manual booking link within 60 seconds; competitors let failed bookings disappear; this ensures zero-loss funnel | LOW | Existing recovery SMS with 60s cron; expand trigger conditions to cover all failure modes, not just unbooked callers |
| Exception-only escalation model | Competitors escalate emergencies by default (Sameday, ElevenLabs agents); this product books emergencies into nearest slot and only escalates on true exceptions (AI confusion, explicit human request); reduces owner interruptions by 70-80% compared to escalation-first models | MEDIUM | Agent prompt rewrite; exception state detection; Retell transfer |
| Booking-first with travel-buffer intelligence | AI books with awareness of technician travel time between zones; competitors book blind or rely on manual dispatch; automatic travel buffers prevent "booked but impossible to reach" scenarios | LOW | Existing travel buffer and zone awareness in slot engine (already built) |
| Dashboard urgency badges with booking-first semantics | Existing urgency badges remain visible but meaning shifts: badges now indicate notification priority level on a confirmed booking, not "this call was escalated"; owner mental model stays consistent while behavior improves | LOW | Existing dashboard badges; backend meaning change only; no UI rebuild |
| Multi-language booking-first validation | Competitors claim multi-language but rarely validate the full booking flow in non-English; proving that es/en callers both get booked autonomously (not just triaged) is a real differentiator | MEDIUM | Existing multi-language support; E2E test scripts for booking flow in both languages |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Emergency auto-escalation to owner phone | "Owner needs to know about emergencies immediately via phone call" | Defeats the entire booking-first premise; the AI already booked the emergency into the nearest slot; calling the owner interrupts them on a job site and adds no value beyond what a high-priority SMS achieves; reverts to escalation-first model | High-priority SMS/email with "EMERGENCY" prefix, repeated notification if unacknowledged within 5 minutes; owner can call back if needed |
| Caller sentiment-based escalation | "If the caller sounds angry, transfer to human" | Angry callers are often angry because they waited or got voicemail; the AI booking their job is the resolution; sentiment-based escalation creates a perverse incentive where being upset bypasses the system; only explicit "talk to a human" should trigger transfer | AI acknowledges frustration empathetically ("I understand this is urgent, let me get you scheduled right away") and proceeds to book; transfer only on explicit request |
| Owner override to block emergency bookings | "I don't want emergency calls auto-booked, I want to decide" | Re-creates the escalation-first model that this milestone explicitly replaces; emergency callers who reach voicemail while waiting for owner approval call the next competitor | All calls book by default; owner can cancel/reschedule from dashboard after the fact; the booking is the safe default, cancellation is the override |
| AI-initiated outbound callback after booking | "AI should call the owner to confirm the booking" | Outbound calling is explicitly out of scope; adds telephony complexity, cost, and regulatory surface; owner already gets SMS/email notification | SMS/email notification with priority tiers; dashboard shows all bookings in real-time |
| Complex multi-technician dispatch logic | "AI should assign the right technician to the job based on skills/certifications" | This is ServiceTitan/Housecall Pro territory; building dispatch logic is a massive scope expansion that competes with established FSM platforms; the product books slots, not technicians | Book into owner's calendar (single-technician or team-level); owner assigns technician manually or through their FSM tool; integration with ServiceTitan/Jobber is a future consideration |
| Voicemail fallback when AI is uncertain | "If AI isn't sure, just take a message" | Voicemail is the problem this product solves; using voicemail as an internal fallback contradicts the core value proposition; callers who leave voicemails convert at <5% | Recovery SMS with manual booking link is the universal fallback; never voicemail |
| Real-time availability negotiation with caller | "Let the caller pick from multiple slots" | Over-engineering the booking conversation; callers want to be told "we can get you in at 2pm Thursday" not "would you prefer 2pm Thursday, 10am Friday, or 3pm Monday?"; multiple options slow the call, increase confusion, and reduce booking rates | AI offers the best available slot; if caller rejects, AI offers the next one; sequential single-offer pattern, not menu pattern |

---

## Feature Dependencies

```
Agent Prompt Rewrite (booking-first behavior)
    |-- requires --> Existing Retell agent prompt infrastructure
    |-- requires --> Decision: booking-first for ALL call types
    |-- enables --> Universal booking default
    |-- enables --> Exception-only escalation

Triage Reclassification (urgency = notification priority)
    |-- requires --> Existing three-layer triage engine
    |-- modifies --> Urgency tag meaning (routing -> notification)
    |-- enables --> Notification priority tiers
    |-- preserves --> Dashboard urgency badges (visual parity)

Notification Priority System
    |-- requires --> Triage reclassification (urgency tags available)
    |-- requires --> Existing SMS/email notification infrastructure
    |-- produces --> Priority-tiered notifications (emergency=high, routine=standard)

Exception State Handling
    |-- requires --> Agent prompt rewrite (defines exception triggers)
    |-- requires --> Retell warm transfer (already available)
    |-- requires --> Confusion detection logic (new)
    |-- triggers --> Human transfer (exception only)

Universal Recovery SMS Fallback
    |-- requires --> Existing recovery SMS infrastructure (cron, 60s delay)
    |-- expands --> Trigger conditions (all failure modes, not just unbooked)
    |-- ensures --> No-dead-end guarantee

Booking Flow Universalization
    |-- requires --> Agent prompt rewrite
    |-- requires --> Existing slot booking engine
    |-- requires --> Emergency-to-nearest-slot logic (existing, just always-enabled)
    |-- requires --> Caller SMS confirmation (new template)

Dashboard Visual Parity
    |-- requires --> Triage reclassification complete
    |-- modifies --> Badge meaning only, not badge rendering
    |-- no UI changes needed
```

### Dependency Notes

- **Agent prompt rewrite is the keystone:** Everything flows from the behavioral change in the AI agent. This must ship first or simultaneously with triage reclassification.
- **Triage reclassification enables notifications:** The urgency tags must be repurposed before the notification priority system can consume them. These two features are tightly coupled and should ship together.
- **Exception handling requires prompt + Retell transfer:** The prompt defines when exceptions trigger; Retell handles the mechanics. Confusion detection (repeated clarification failures) is the only net-new logic.
- **Recovery SMS expansion is low-risk:** The mechanism exists; the change is adding trigger conditions. Can ship independently.
- **Dashboard visual parity is a non-change:** Backend meaning shifts but badges remain identical. This is a documentation/communication task, not a build task.

---

## MVP Definition

### Launch With (v2.0)

- [ ] **Agent prompt rewrite: booking-first for all calls** -- The entire milestone hinges on this behavioral change; without it, the system is still escalation-first
- [ ] **Triage reclassification: urgency as notification priority** -- Required for the notification system and to decouple urgency from routing
- [ ] **Notification priority tiers (emergency=high, routine=standard)** -- Owner must see emergency bookings surface with urgency without receiving a phone call
- [ ] **Exception state handling (AI confusion + explicit human request)** -- The only two valid escalation triggers; must work reliably or trust collapses
- [ ] **Universal recovery SMS (all failure modes)** -- No-dead-end guarantee; every failed booking path triggers recovery
- [ ] **Caller SMS confirmation after booking** -- Proof of booking for the caller; table stakes for any booking system
- [ ] **Dashboard visual parity (badge meaning shift)** -- Owner's dashboard must not visually break; badges persist with new semantics

### Add After Validation (v2.x)

- [ ] **Repeated notification for unacknowledged emergency bookings** -- Escalating notification cadence (SMS at 0min, again at 5min, email at 10min) for emergency-tagged bookings where owner hasn't opened dashboard; add after base notification tiers are validated
- [ ] **Booking analytics: conversion rate by urgency tier** -- Track what percentage of emergency vs routine calls convert to bookings; needed for ROI proof but not for launch
- [ ] **Exception state analytics** -- Track frequency and causes of human transfers; informs prompt tuning; not needed for launch

### Future Consideration (v3+)

- [ ] **Multi-technician dispatch / skill-based routing** -- Requires FSM-level complexity; defer until ServiceTitan/Jobber integration is planned
- [ ] **Outbound follow-up automation** -- Post-booking reminder calls, feedback collection; explicitly out of scope
- [ ] **Caller slot preference negotiation** -- Let callers express time preferences before AI offers slots; adds conversation complexity for marginal gain
- [ ] **Owner booking override rules** -- "Never book plumbing on Fridays" type rules; adds configuration surface; handle via Google Calendar blocked time for now

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Agent prompt rewrite (booking-first) | HIGH | MEDIUM | P1 |
| Triage reclassification (urgency=notification) | HIGH | LOW | P1 |
| Notification priority tiers | HIGH | MEDIUM | P1 |
| Exception state handling (confusion + explicit request) | HIGH | MEDIUM | P1 |
| Universal recovery SMS (expanded triggers) | HIGH | LOW | P1 |
| Caller SMS confirmation after booking | HIGH | LOW | P1 |
| Dashboard visual parity (badge semantics) | MEDIUM | LOW | P1 |
| Multi-language E2E booking validation | MEDIUM | MEDIUM | P1 (QA gate) |
| Concurrency QA under booking-first model | MEDIUM | MEDIUM | P1 (QA gate) |
| Repeated notification escalation cadence | MEDIUM | LOW | P2 |
| Booking conversion analytics by urgency | MEDIUM | LOW | P2 |
| Exception state analytics | LOW | LOW | P2 |
| 5-minute onboarding gate revalidation | HIGH | LOW | P1 (QA gate) |

**Priority key:**
- P1: Must have for v2.0 launch
- P2: Should have, add when stable
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

Key competitors in AI voice receptionist / booking for home services: Sameday (GoSameDay), Dispatchly, Avoca, Jobber AI Receptionist, Newo.ai.

| Feature | Sameday / Dispatchly | Avoca | Jobber AI | Our Approach (v2.0) |
|---------|----------------------|-------|-----------|---------------------|
| Booking default | Books all calls; 92% booking rate (Sameday) | Books via ServiceTitan integration | Books or takes messages | Books ALL calls; no message-taking mode |
| Emergency handling | Flags + escalates emergencies to on-call | Routes complex cases to human | Keyword-based transfer | Books emergencies into nearest slot; no escalation unless exception |
| Escalation trigger | Urgency keywords trigger transfer | Complex cases route to human | Owner-configured keywords | Exception-only: AI confusion or explicit caller request |
| Notification system | Standard notifications for all bookings | Real-time CRM sync | Transcripts + summaries | Priority-tiered: emergency bookings get high-priority formatting and delivery |
| Fallback on failure | Unknown; likely voicemail | Routes to human | Texts back callers who hang up | Universal recovery SMS with booking link; never voicemail |
| Multi-language | Unknown; likely English-primary | English-primary | English-primary | Validated E2E in en/es from day one |
| Calendar integration | CRM/calendar integration | ServiceTitan, Jobber | Native Jobber calendar | Google Calendar bidirectional + zone/travel awareness |
| Transfer context | Unknown | Unknown | Transcripts available | Retell warm transfer with whisper messages (full context handoff) |
| Owner interruption | Escalates emergencies (calls owner) | Routes to human team | Transfers on keywords | Minimal: SMS notification only; owner never interrupted by phone |

### Competitive Insight

The key differentiator of the booking-first model is **reduced owner interruption**. Every competitor we examined escalates emergency calls to a human by default. This product's approach -- book the emergency into the nearest slot and notify via high-priority SMS -- is genuinely novel in the home service AI space. The risk is owner trust: owners must believe the AI will book emergencies correctly without their involvement. The notification priority system is the trust mechanism that makes this work.

---

## Sources

- [Sameday AI - AI Phone Answering for Home Services](https://www.gosameday.com/)
- [Sameday - How AI booking systems work for home services](https://www.gosameday.com/post/how-ai-booking-systems-work-for-home-services-the-complete-guide-to-call-automation)
- [Dispatchly - AI Receptionist for Home Services](https://www.dispatchlyai.com/)
- [Dispatchly Launch Press Release](https://www.marketpressrelease.com/Dispatchly-Launches-AI-Voice-Agent-Platform-Empowering-Home-Service-Businesses-to-Recover-Revenue-1770685302.html)
- [Avoca - The AI Workforce for Service Businesses](https://www.avoca.ai/)
- [Avoca - Why AI is Finally Winning in Home Services](https://www.avoca.ai/blog/why-ai-is-finally-winning-in-home-services)
- [Jobber AI Receptionist](https://www.getjobber.com/features/ai-receptionist/)
- [Jobber AI Receptionist Launch PR](https://www.prnewswire.com/news-releases/jobber-launches-ai-powered-receptionist-to-answer-calls-and-texts-for-busy-home-service-businesses-302531125.html)
- [Newo.ai - HVAC/Plumbing AI Receptionist](https://newo.ai/hvac-plumbing-ai-receptionist/)
- [Retell AI - Warm Transfer Feature](https://www.retellai.com/blog/effortless-handoffs-with-retell-ais-warm-transfer-feature)
- [Retell AI - How an AI Agent Knows When to Handoff](https://www.retellai.com/blog/how-an-ai-agent-knows-when-to-handoff-to-a-human-agent)
- [Smith.ai - AI-Human Call Handoff Protocols](https://smith.ai/blog/ai-human-call-handoff-protocols)
- [Replicant - When to Hand Off to a Human](https://www.replicant.com/blog/when-to-hand-off-to-a-human-how-to-set-effective-ai-escalation-rules)
- [Leaping AI - Voice AI for Dispatch Services](https://leapingai.com/blog/voice-ai-for-dispatch-services-smart-call-automation-that-works)
- [SolutionHow - AI Receptionist for Home Services](https://www.solutionhow.com/en-us/education/ai-receptionist-for-home-services-capture-leads-fast-and-route-calls-by-urgency/)

---

*Feature research for: HomeService AI Agent -- v2.0 Booking-First Digital Dispatcher*
*Researched: 2026-03-24*

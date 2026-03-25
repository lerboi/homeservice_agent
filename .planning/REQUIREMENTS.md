# Requirements: HomeService AI Agent

**Defined:** 2026-03-18 (v1.0), 2026-03-22 (v1.1), 2026-03-24 (v2.0)
**Core Value:** Every inbound call is answered instantly and converted into a confirmed booking or qualified lead — no call goes to voicemail, no lead is lost to a competitor.

## v2.0 Requirements

### Booking-First Agent Behavior

- [x] **BOOK-01**: AI books every inbound call into the next available slot by default — emergencies get nearest same-day slot, routine calls get next available
- [x] **BOOK-02**: AI detects caller intent before initiating booking flow — distinguishes service appointment requests from information-only/quote calls
- [x] **BOOK-03**: AI transfers to human only on exception states: AI cannot understand the job after 2+ clarification attempts, or caller explicitly requests a person
- [x] **BOOK-04**: Caller receives SMS confirmation after booking with date, time, and service address
- [x] **BOOK-05**: AI preserves full call context on warm transfer via Retell whisper message so the receiving human has complete caller details

### Triage Reclassification

- [x] **TRIAGE-R01**: Urgency tags (emergency/routine/high_ticket) are retained on booking records but no longer route call handling
- [x] **TRIAGE-R02**: Triage pipeline output drives notification priority tier, not booking vs lead-capture decision

### Notification Priority

- [x] **NOTIF-P01**: Emergency bookings trigger high-priority SMS/email with EMERGENCY prefix and urgent formatting
- [x] **NOTIF-P02**: Routine bookings trigger standard notification flow without urgency formatting

### Recovery & Fallback

- [x] **RECOVER-01**: Every call path where booking fails triggers recovery SMS with manual booking link within 60 seconds
- [x] **RECOVER-02**: Recovery SMS includes urgency-aware content (emergency recovery is more urgent in tone than routine)
- [x] **RECOVER-03**: Recovery SMS delivery failures are logged and retried, not silently swallowed

### Hardening & QA

- [x] **HARDEN-01**: Spanish-language caller books autonomously, receives Spanish confirmation SMS, owner gets notification — validated E2E
- [x] **HARDEN-02**: 20 simultaneous booking requests to same slot produce exactly 1 confirmed booking and 19 next-available offers
- [x] **HARDEN-03**: Non-technical SME owner completes onboarding wizard and hears AI in under 5 minutes — revalidated for booking-first
- [x] **HARDEN-04**: Unhandled exceptions and API failures trigger Sentry alert with full stack trace within 60 seconds

## v1.1 Requirements

### Pricing Page

- [x] **PRICE-01**: User sees 4 pricing tiers (Starter $99/40 calls, Growth $249/120 calls, Scale $599/400 calls, Enterprise custom) with clear feature breakdown
- [x] **PRICE-02**: Growth tier is visually highlighted with "Most Popular" badge as the recommended option
- [x] **PRICE-03**: User can toggle between monthly and annual pricing display (display-only, no Stripe)
- [x] **PRICE-04**: User sees a feature comparison table below the fold showing what each tier includes
- [x] **PRICE-05**: User sees an FAQ section addressing cancellation, overages, trial availability, and refunds
- [x] **PRICE-06**: User sees ROI-framed hero copy that speaks in job revenue, not SaaS metrics
- [x] **PRICE-07**: Each tier has a "Get Started" CTA that routes to the unified onboarding wizard

### Public Pages

- [x] **PAGE-01**: User can navigate to Pricing, About, and Contact pages from any public page via updated nav
- [x] **PAGE-02**: User sees an About page with mission statement and founding story targeting trade owners
- [x] **PAGE-03**: User can submit a contact inquiry with segmented routes for sales, support, or partnerships
- [x] **PAGE-04**: Contact form submissions are delivered to ops inbox via Resend with spam protection
- [x] **PAGE-05**: Contact page displays explicit response time SLA

### Unified Onboarding

- [x] **WIZARD-01**: Any CTA (landing, pricing, contact) drops user into a single wizard where account creation is step 1
- [x] **WIZARD-02**: Wizard starts with a trade routing question that pre-populates service list and triage rules
- [x] **WIZARD-03**: Wizard shows progress indicator (step N of M) throughout the flow
- [x] **WIZARD-04**: Email verification is handled inline within the wizard without redirecting to a dead-end page
- [x] **WIZARD-05**: Wizard form data persists across page refresh via sessionStorage
- [x] **WIZARD-06**: Live test call is the wizard finale — user hears their AI receptionist before completing onboarding
- [x] **WIZARD-07**: Existing users with completed onboarding bypass wizard and go directly to dashboard

### Outlook Calendar

- [x] **OUTLOOK-01**: Owner can connect Outlook Calendar via Microsoft OAuth from dashboard settings
- [x] **OUTLOOK-02**: Outlook calendar events sync bidirectionally with local availability database
- [x] **OUTLOOK-03**: Outlook webhook subscriptions auto-renew before 3-day expiry via cron job
- [x] **OUTLOOK-04**: Owner can disconnect Outlook Calendar and revert to manual availability

### Launch Hardening

- [ ] **LAUNCH-01**: Sentry error monitoring captures unhandled exceptions and API failures in production
- [ ] **LAUNCH-02**: Multi-language E2E validated through full pipeline (voice -> triage -> booking -> notifications -> dashboard)
- [ ] **LAUNCH-03**: Slot-locking contention test proves exactly 1 booking from 20 simultaneous requests to the same slot
- [ ] **LAUNCH-04**: 5-minute onboarding gate validated by a real non-technical SME user on staging
- [ ] **LAUNCH-05**: Environment variable audit confirms no secrets in source and all production env vars are set

### Dashboard Guided Setup

- [x] **SETUP-01**: New owner after onboarding sees a setup checklist with clear next steps (connect calendar, configure working hours, make a test call) — each item links to the relevant action
- [ ] **SETUP-02**: Every dashboard page with no data shows a helpful empty state with icon, description, and actionable CTA — not a blank page or generic "no data" message
- [x] **SETUP-03**: Owner can trigger a test voice call from dashboard settings and hear their AI receptionist answer without looking up the phone number
- [ ] **SETUP-04**: Checklist progress persists across sessions via DB; checklist auto-dismisses on full completion or manual dismiss
- [x] **SETUP-05**: Non-technical user can identify what each dashboard section does and what actions to take within 30 seconds

## v1 Requirements

### Voice Receptionist

- [x] **VOICE-01**: AI answers every inbound call within 1 second via Retell with natural-sounding voice
- [x] **VOICE-02**: AI greets caller using the specific business name to establish professional trust
- [x] **VOICE-03**: AI extracts caller ID, job type/scope, and service address from conversation
- [x] **VOICE-04**: AI performs mandatory read-back confirmation of captured address (e.g., "Just to confirm, you're at 123 Ubi Ave 1, correct?")
- [x] **VOICE-05**: AI detects caller's language on first utterance and switches to appropriate language seamlessly
- [x] **VOICE-06**: AI handles code-switching (Singlish/Spanish/mixed language) without breaking conversation flow
- [x] **VOICE-07**: Per-business custom greeting script and AI persona configurable by owner
- [x] **VOICE-08**: Call recording stored and accessible per lead in dashboard
- [x] **VOICE-09**: Call transcript generated and stored per lead in dashboard

### Triage Intelligence

- [x] **TRIAGE-01**: Layer 1 — Keyword/regex detection classifies job type and urgency from transcript (e.g., "flooding", "gas smell" -> emergency)
- [x] **TRIAGE-02**: Layer 2 — LLM-based urgency scoring using temporal cues ("happening right now" vs "next week") and caller stress indicators
- [x] **TRIAGE-03**: Layer 3 — Owner-configured rule table maps service types to emergency/routine/high-ticket classification
- [x] **TRIAGE-04**: Emergency calls routed to instant booking workflow; routine calls captured as leads for owner confirmation
- [x] **TRIAGE-05**: Owner can define which service types are high-ticket in business settings
- [x] **TRIAGE-06**: Urgency score and triage label visible on each lead card in dashboard without replaying the call

### Scheduling & Booking

- [x] **SCHED-01**: Built-in availability scheduler with configurable time slots and business hours
- [x] **SCHED-02**: Bidirectional Google Calendar sync — local DB mirrors external calendar, changes propagate both ways
- [ ] **SCHED-03**: Bidirectional Outlook Calendar sync — local DB mirrors external calendar, changes propagate both ways
- [x] **SCHED-04**: Atomic slot locking — when AI books a slot, it is locked at database level with zero race conditions
- [x] **SCHED-05**: Emergency calls get immediate slot lock while caller is still on the line
- [x] **SCHED-06**: Routine calls create a lead with suggested time slots for owner to confirm
- [x] **SCHED-07**: 30-60 minute travel time buffer automatically inserted between consecutive bookings
- [x] **SCHED-08**: Geographic zone awareness — prevents back-to-back bookings across distant locations (e.g., Jurong 10AM and Changi 11AM)
- [x] **SCHED-09**: Calendar is never queried live during a call — availability served from local DB mirror updated asynchronously

### Lead CRM

- [x] **CRM-01**: Lead pipeline with statuses: New -> Booked -> Completed -> Paid
- [x] **CRM-02**: Each lead card shows: caller ID, job type, address, urgency score, call recording, transcript, triage label
- [x] **CRM-03**: Phone number used as unique ID — repeat caller updates existing lead instead of creating duplicate
- [x] **CRM-04**: Dashboard with filterable list view of all leads and calls
- [x] **CRM-05**: Owner can see total revenue funneled through AI (booked -> completed -> paid tracking)

### Notifications

- [x] **NOTIF-01**: Owner receives SMS alert with lead summary when new lead/booking is created
- [x] **NOTIF-02**: Owner receives email alert with lead details when new lead/booking is created
- [x] **NOTIF-03**: If caller hangs up before booking completes, auto-SMS sent to caller's number for recovery

### Business Onboarding

- [x] **ONBOARD-01**: Owner can configure business name, greeting script, and AI persona
- [x] **ONBOARD-02**: Owner can configure service list with categories and tier/priority tags
- [x] **ONBOARD-03**: Owner can configure availability schedule (working hours, days off)
- [x] **ONBOARD-04**: Owner can configure emergency escalation rules per service type
- [x] **ONBOARD-05**: Owner can configure notification preferences (SMS number, email address)
- [x] **ONBOARD-06**: Onboarding flow gets owner to hear AI answer a test call within 5 minutes of signup

## v2 Requirements

### Analytics & Insights

- **ANALYTICS-01**: Lead conversion funnel: calls answered -> leads captured -> booked -> completed
- **ANALYTICS-02**: Revenue attribution dashboard showing ROI of AI receptionist

### Omnichannel

- **OMNI-01**: SMS/text two-way messaging with homeowners
- **OMNI-02**: Web chat widget for business website
- **OMNI-03**: WhatsApp integration for non-US markets

### Advanced Features

- **ADV-01**: Per-business custom voice model selection (voice persona)
- **ADV-02**: Outbound follow-up call automation (with TCPA compliance review)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native iOS/Android app | Web-first, mobile-responsive; defer until retention proven |
| Full CRM (invoicing, job costing, dispatch) | Lead tracker only — don't compete with ServiceTitan/Jobber |
| Payment processing / deposit collection | PCI compliance scope too large for v1 |
| Crew dispatch and GPS tracking | Integrate with existing FSM tools via webhook, don't replace |
| Real-time live transcription display | Post-call transcript within 30 seconds is sufficient |
| AI upselling during calls | Destroys "book fast" value prop; upsell via post-booking SMS |
| Outbound robocall campaigns | TCPA compliance minefield; different product entirely |
| Emergency auto-escalation to owner phone | Defeats booking-first premise; high-priority SMS is sufficient |
| Caller sentiment-based escalation | Angry callers need booking, not transfer; only explicit request triggers transfer |
| Owner veto on emergency bookings | Re-creates escalation-first model; owner cancels from dashboard instead |
| Multi-technician dispatch / skill routing | FSM-level complexity; ServiceTitan/Jobber territory |
| Booking guardrails (daily caps, rate limits) | Deferred to v2.1; evaluate after booking volume data collected |
| Repeated notification escalation cadence | Deferred to v2.1; add after base priority tiers validated |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VOICE-01 | Phase 1 | Complete |
| VOICE-02 | Phase 2 | Complete |
| VOICE-03 | Phase 3 | Complete |
| VOICE-04 | Phase 3 | Complete |
| VOICE-05 | Phase 1 | Complete |
| VOICE-06 | Phase 1 | Complete |
| VOICE-07 | Phase 2 | Complete |
| VOICE-08 | Phase 1 | Complete |
| VOICE-09 | Phase 1 | Complete |
| TRIAGE-01 | Phase 2 | Complete |
| TRIAGE-02 | Phase 2 | Complete |
| TRIAGE-03 | Phase 2 | Complete |
| TRIAGE-04 | Phase 2 | Complete |
| TRIAGE-05 | Phase 2 | Complete |
| TRIAGE-06 | Phase 4 | Complete |
| SCHED-01 | Phase 3 | Complete |
| SCHED-02 | Phase 3 | Complete |
| SCHED-03 | Phase 8 | Pending |
| SCHED-04 | Phase 3 | Complete |
| SCHED-05 | Phase 3 | Complete |
| SCHED-06 | Phase 3 | Complete |
| SCHED-07 | Phase 3 | Complete |
| SCHED-08 | Phase 3 | Complete |
| SCHED-09 | Phase 3 | Complete |
| CRM-01 | Phase 4 | Complete |
| CRM-02 | Phase 4 | Complete |
| CRM-03 | Phase 4 | Complete |
| CRM-04 | Phase 4 | Complete |
| CRM-05 | Phase 4 | Complete |
| NOTIF-01 | Phase 4 | Complete |
| NOTIF-02 | Phase 4 | Complete |
| NOTIF-03 | Phase 4 | Complete |
| ONBOARD-01 | Phase 2 | Complete |
| ONBOARD-02 | Phase 2 | Complete |
| ONBOARD-03 | Phase 2 | Complete |
| ONBOARD-04 | Phase 2 | Complete |
| ONBOARD-05 | Phase 2 | Complete |
| ONBOARD-06 | Phase 2 | Complete |
| PRICE-01 | Phase 6 | Complete |
| PRICE-02 | Phase 6 | Complete |
| PRICE-03 | Phase 6 | Complete |
| PRICE-04 | Phase 6 | Complete |
| PRICE-05 | Phase 6 | Complete |
| PRICE-06 | Phase 6 | Complete |
| PRICE-07 | Phase 6 | Complete |
| PAGE-01 | Phase 6 | Complete |
| PAGE-02 | Phase 6 | Complete |
| PAGE-03 | Phase 6 | Complete |
| PAGE-04 | Phase 6 | Complete |
| PAGE-05 | Phase 6 | Complete |
| WIZARD-01 | Phase 7 | Complete |
| WIZARD-02 | Phase 7 | Complete |
| WIZARD-03 | Phase 7 | Complete |
| WIZARD-04 | Phase 7 | Complete |
| WIZARD-05 | Phase 7 | Complete |
| WIZARD-06 | Phase 7 | Complete |
| WIZARD-07 | Phase 7 | Complete |
| OUTLOOK-01 | Phase 8 | Complete |
| OUTLOOK-02 | Phase 8 | Complete |
| OUTLOOK-03 | Phase 8 | Complete |
| OUTLOOK-04 | Phase 8 | Complete |
| LAUNCH-01 | Phase 9 | Pending |
| LAUNCH-02 | Phase 9 | Pending |
| LAUNCH-03 | Phase 9 | Pending |
| LAUNCH-04 | Phase 9 | Pending |
| LAUNCH-05 | Phase 9 | Pending |
| SETUP-01 | Phase 10 | Complete |
| SETUP-02 | Phase 10 | Pending |
| SETUP-03 | Phase 10 | Complete |
| SETUP-04 | Phase 10 | Pending |
| SETUP-05 | Phase 10 | Complete |
| BOOK-01 | Phase 14 | Complete |
| BOOK-02 | Phase 14 | Complete |
| BOOK-03 | Phase 14 | Complete |
| BOOK-04 | Phase 15 | Complete |
| BOOK-05 | Phase 14 | Complete |
| TRIAGE-R01 | Phase 15 | Complete |
| TRIAGE-R02 | Phase 15 | Complete |
| NOTIF-P01 | Phase 16 | Complete |
| NOTIF-P02 | Phase 16 | Complete |
| RECOVER-01 | Phase 17 | Complete |
| RECOVER-02 | Phase 17 | Complete |
| RECOVER-03 | Phase 17 | Complete |
| HARDEN-01 | Phase 18 | Complete |
| HARDEN-02 | Phase 18 | Complete |
| HARDEN-03 | Phase 18 | Complete |
| HARDEN-04 | Phase 18 | Complete |

**v1.0 Coverage:**
- v1.0 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0

**v1.1 Coverage:**
- v1.1 requirements: 33 total (PRICE-01-07, PAGE-01-05, WIZARD-01-07, OUTLOOK-01-04, LAUNCH-01-05, SETUP-01-05)
- Mapped to phases: 33
- Unmapped: 0

**v2.0 Coverage:**
- v2.0 requirements: 16 total (BOOK-01-05, TRIAGE-R01-02, NOTIF-P01-02, RECOVER-01-03, HARDEN-01-04)
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-03-18 (v1.0), 2026-03-22 (v1.1), 2026-03-24 (v2.0)*
*Last updated: 2026-03-24 — v2.0 roadmap mapped all 16 requirements to Phases 14-18*

# Requirements: HomeService AI Agent

**Defined:** 2026-03-18
**Core Value:** Every inbound call is answered instantly and converted into a confirmed booking or qualified lead — no call goes to voicemail, no lead is lost to a competitor.

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

- [x] **TRIAGE-01**: Layer 1 — Keyword/regex detection classifies job type and urgency from transcript (e.g., "flooding", "gas smell" → emergency)
- [x] **TRIAGE-02**: Layer 2 — LLM-based urgency scoring using temporal cues ("happening right now" vs "next week") and caller stress indicators
- [x] **TRIAGE-03**: Layer 3 — Owner-configured rule table maps service types to emergency/routine/high-ticket classification
- [x] **TRIAGE-04**: Emergency calls routed to instant booking workflow; routine calls captured as leads for owner confirmation
- [x] **TRIAGE-05**: Owner can define which service types are high-ticket in business settings
- [ ] **TRIAGE-06**: Urgency score and triage label visible on each lead card in dashboard without replaying the call

### Scheduling & Booking

- [x] **SCHED-01**: Built-in availability scheduler with configurable time slots and business hours
- [ ] **SCHED-02**: Bidirectional Google Calendar sync — local DB mirrors external calendar, changes propagate both ways
- [x] **SCHED-03**: Bidirectional Outlook Calendar sync — local DB mirrors external calendar, changes propagate both ways
- [x] **SCHED-04**: Atomic slot locking — when AI books a slot, it is locked at database level with zero race conditions
- [x] **SCHED-05**: Emergency calls get immediate slot lock while caller is still on the line
- [x] **SCHED-06**: Routine calls create a lead with suggested time slots for owner to confirm
- [x] **SCHED-07**: 30-60 minute travel time buffer automatically inserted between consecutive bookings
- [x] **SCHED-08**: Geographic zone awareness — prevents back-to-back bookings across distant locations (e.g., Jurong 10AM and Changi 11AM)
- [x] **SCHED-09**: Calendar is never queried live during a call — availability served from local DB mirror updated asynchronously

### Lead CRM

- [ ] **CRM-01**: Lead pipeline with statuses: New → Booked → Completed → Paid
- [ ] **CRM-02**: Each lead card shows: caller ID, job type, address, urgency score, call recording, transcript, triage label
- [ ] **CRM-03**: Phone number used as unique ID — repeat caller updates existing lead instead of creating duplicate
- [ ] **CRM-04**: Dashboard with filterable list view of all leads and calls
- [ ] **CRM-05**: Owner can see total revenue funneled through AI (booked → completed → paid tracking)

### Notifications

- [ ] **NOTIF-01**: Owner receives SMS alert with lead summary when new lead/booking is created
- [ ] **NOTIF-02**: Owner receives email alert with lead details when new lead/booking is created
- [ ] **NOTIF-03**: If caller hangs up before booking completes, auto-SMS sent to caller's number for recovery

### Business Onboarding

- [x] **ONBOARD-01**: Owner can configure business name, greeting script, and AI persona
- [x] **ONBOARD-02**: Owner can configure service list with categories and tier/priority tags
- [x] **ONBOARD-03**: Owner can configure availability schedule (working hours, days off)
- [x] **ONBOARD-04**: Owner can configure emergency escalation rules per service type
- [x] **ONBOARD-05**: Owner can configure notification preferences (SMS number, email address)
- [x] **ONBOARD-06**: Onboarding flow gets owner to hear AI answer a test call within 5 minutes of signup

## v2 Requirements

### Analytics & Insights

- **ANALYTICS-01**: Lead conversion funnel: calls answered → leads captured → booked → completed
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
| TRIAGE-06 | Phase 4 | Pending |
| SCHED-01 | Phase 3 | Complete |
| SCHED-02 | Phase 3 | Pending |
| SCHED-03 | Phase 3 | Complete |
| SCHED-04 | Phase 3 | Complete |
| SCHED-05 | Phase 3 | Complete |
| SCHED-06 | Phase 3 | Complete |
| SCHED-07 | Phase 3 | Complete |
| SCHED-08 | Phase 3 | Complete |
| SCHED-09 | Phase 3 | Complete |
| CRM-01 | Phase 4 | Pending |
| CRM-02 | Phase 4 | Pending |
| CRM-03 | Phase 4 | Pending |
| CRM-04 | Phase 4 | Pending |
| CRM-05 | Phase 4 | Pending |
| NOTIF-01 | Phase 4 | Pending |
| NOTIF-02 | Phase 4 | Pending |
| NOTIF-03 | Phase 4 | Pending |
| ONBOARD-01 | Phase 2 | Complete |
| ONBOARD-02 | Phase 2 | Complete |
| ONBOARD-03 | Phase 2 | Complete |
| ONBOARD-04 | Phase 2 | Complete |
| ONBOARD-05 | Phase 2 | Complete |
| ONBOARD-06 | Phase 2 | Complete |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 after roadmap creation — all 38 requirements mapped*

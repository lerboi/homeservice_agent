# Roadmap: HomeService AI Agent

## Overview

Build an AI voice receptionist that answers every inbound call for home service businesses, triages urgency in real time, books into a locked calendar slot, and surfaces leads in a web CRM. The build follows component dependencies: foundation infrastructure first, then triage and onboarding config (triage needs service lists), then booking and calendar sync (atomic locking must be designed before first booking), then the CRM pipeline and owner-facing dashboard, and finally hardening the multi-language experience and onboarding activation path before launch.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Voice Infrastructure** - Retell webhook pipeline, call recording/transcript storage, language abstraction layer, and multi-tenant database schema
- [ ] **Phase 2: Onboarding and Triage** - Business configuration wizard, three-layer triage engine, and per-business AI persona
- [ ] **Phase 3: Scheduling and Calendar Sync** - Atomic slot booking, travel time buffers, bidirectional Google and Outlook sync
- [ ] **Phase 4: CRM, Dashboard, and Notifications** - Lead pipeline, web dashboard, owner SMS/email alerts
- [ ] **Phase 5: Hardening and Launch** - Multi-language end-to-end, 5-minute onboarding gate, concurrency QA, and staging environment

## Phase Details

### Phase 1: Voice Infrastructure
**Goal**: The Retell webhook pipeline is live, every inbound call is answered within 1 second, call recordings and transcripts are stored per call, and the language abstraction layer is in place so no English-only content is hardcoded
**Depends on**: Nothing (first phase)
**Requirements**: VOICE-01, VOICE-05, VOICE-06, VOICE-08, VOICE-09
**Success Criteria** (what must be TRUE):
  1. A test call to the Retell phone number is answered within 1 second with a voice response
  2. After the call ends, a recording URL and full transcript are stored in the database and retrievable via API
  3. Speaking Spanish or Singlish on a test call produces a language-detected response in the correct language without the conversation breaking
  4. Code-switching mid-call (mixing English and another language) does not cause the AI to drop context or default back to English-only
  5. All user-facing strings (prompts, templates, notifications) are keyed through a translation layer with no raw English strings hardcoded in application logic
**Plans:** 1/3 plans executed
Plans:
- [ ] 01-01-PLAN.md — Project scaffold, DB schema, i18n layer, test infrastructure
- [ ] 01-02-PLAN.md — Retell webhook pipeline with recording and transcript storage
- [ ] 01-03-PLAN.md — Agent prompt system with language detection and code-switching

### Phase 2: Onboarding and Triage
**Goal**: An owner can configure their business (name, greeting, services, hours, escalation rules) and the three-layer triage engine correctly classifies calls as emergency, routine, or high-ticket based on those owner-defined rules
**Depends on**: Phase 1
**Requirements**: ONBOARD-01, ONBOARD-02, ONBOARD-03, ONBOARD-04, ONBOARD-05, ONBOARD-06, TRIAGE-01, TRIAGE-02, TRIAGE-03, TRIAGE-04, TRIAGE-05, VOICE-02, VOICE-07
**Success Criteria** (what must be TRUE):
  1. Owner can complete the onboarding wizard — business name, service list, working hours, escalation rules, notification contact — without developer help
  2. After onboarding, an inbound test call is greeted using the owner's configured business name and AI persona
  3. A call saying "my basement is flooding" is classified as EMERGENCY; a call saying "I need a quote for next month" is classified as ROUTINE — both visible on the lead card without replaying the recording
  4. Owner can add a custom service type (e.g., "pool heater repair") and mark it as high-ticket, and the triage engine applies that rule on the next call
  5. A new owner signs up and hears their AI answer a test call within 5 minutes of starting onboarding
**Plans**: TBD

### Phase 3: Scheduling and Calendar Sync
**Goal**: Emergency calls book a confirmed appointment slot while the caller is still on the line, routine calls create a lead with suggested slots — with zero double-bookings, travel time buffers between consecutive jobs, and real-time Google and Outlook calendar sync
**Depends on**: Phase 2
**Requirements**: SCHED-01, SCHED-02, SCHED-03, SCHED-04, SCHED-05, SCHED-06, SCHED-07, SCHED-08, SCHED-09, VOICE-03, VOICE-04
**Success Criteria** (what must be TRUE):
  1. An emergency call results in a confirmed booking before the call ends, with the slot locked at database level so a simultaneous second call cannot claim the same slot
  2. A routine call creates a lead record with suggested available time slots for the owner to confirm
  3. Two simultaneous calls fired at the same slot in a concurrency test produce exactly one confirmed booking — the second caller receives the next available slot
  4. A booking in Jurong at 10AM automatically blocks the 11AM slot in Changi due to geographic travel time — the buffer is enforced without owner intervention
  5. A calendar event created directly in Google Calendar appears in platform availability within 60 seconds and blocks that slot from new bookings
  6. The caller hears address read-back confirmation before any slot is locked
**Plans**: TBD

### Phase 4: CRM, Dashboard, and Notifications
**Goal**: Every lead created by the AI is visible in a web dashboard with full call context, the owner can move leads through the pipeline, and they receive immediate SMS and email alerts when a new lead or booking arrives
**Depends on**: Phase 3
**Requirements**: CRM-01, CRM-02, CRM-03, CRM-04, CRM-05, TRIAGE-06, NOTIF-01, NOTIF-02, NOTIF-03
**Success Criteria** (what must be TRUE):
  1. Owner opens the dashboard and sees all leads in a filterable list with caller ID, job type, address, urgency label, and triage score visible on the list row — no need to open individual leads
  2. Owner can play the call recording and read the full transcript from the lead detail view without leaving the dashboard
  3. A repeat caller's second call updates the existing lead record rather than creating a duplicate entry
  4. Within 60 seconds of a new booking, owner receives both an SMS and email with caller name, job type, urgency, address, and a one-tap callback link
  5. If a caller hangs up before booking completes, an auto-SMS is sent to the caller's number within 60 seconds
  6. Owner can see cumulative revenue tracked through the AI pipeline (booked → completed → paid) on the dashboard
**Plans**: TBD

### Phase 5: Hardening and Launch
**Goal**: The full product is demo-ready and production-hardened — multi-language works end-to-end from first utterance through notifications, the 5-minute onboarding activation gate is validated with a non-technical user, and concurrency and escalation edge cases are verified in a staging environment
**Depends on**: Phase 4
**Requirements**: (none — all 38 v1 requirements are covered in Phases 1-4; this phase delivers QA, hardening, and activation validation)
**Success Criteria** (what must be TRUE):
  1. A Spanish-language test call is answered in Spanish, triaged in Spanish, booked with a Spanish-language slot confirmation, and the owner notification SMS/email arrives with a Spanish-language summary
  2. A non-technical SME owner (not a developer) completes the onboarding wizard and hears their AI answer a test call in under 5 minutes with no external help
  3. A caller saying "I need to speak to a real person" or "operator" reaches a voicemail fallback and does not loop back into the AI
  4. A load test firing 10 simultaneous calls at the same final available slot produces exactly 1 confirmed booking and 9 next-available-slot offers
  5. All concurrency and triage tests pass in CI against a staging environment with a live Retell webhook tunnel
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Voice Infrastructure | 1/3 | In Progress|  |
| 2. Onboarding and Triage | 0/TBD | Not started | - |
| 3. Scheduling and Calendar Sync | 0/TBD | Not started | - |
| 4. CRM, Dashboard, and Notifications | 0/TBD | Not started | - |
| 5. Hardening and Launch | 0/TBD | Not started | - |

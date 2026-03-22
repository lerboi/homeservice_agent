# Roadmap: HomeService AI Agent

## Overview

Build an AI voice receptionist that answers every inbound call for home service businesses, triages urgency in real time, books into a locked calendar slot, and surfaces leads in a web CRM. The build follows component dependencies: foundation infrastructure first, then triage and onboarding config (triage needs service lists), then booking and calendar sync (atomic locking must be designed before first booking), then the CRM pipeline and owner-facing dashboard, and finally hardening the multi-language experience and onboarding activation path before launch.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Voice Infrastructure** - Retell webhook pipeline, call recording/transcript storage, language abstraction layer, and multi-tenant database schema (completed 2026-03-18)
- [x] **Phase 2: Onboarding and Triage** - Business configuration wizard, three-layer triage engine, and per-business AI persona (completed 2026-03-19)
- [ ] **Phase 3: Scheduling and Calendar Sync** - Atomic slot booking, travel time buffers, bidirectional Google and Outlook sync
- [x] **Phase 4: CRM, Dashboard, and Notifications** - Lead pipeline, web dashboard, owner SMS/email alerts (completed 2026-03-21)
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
**Plans:** 3/3 plans complete
Plans:
- [x] 01-01-PLAN.md — Project scaffold, DB schema, i18n layer, test infrastructure
- [ ] 01-02-PLAN.md — Retell webhook pipeline with recording and transcript storage
- [x] 01-03-PLAN.md — Agent prompt system with language detection and code-switching

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
**Plans:** 6/6 plans complete
Plans:
- [ ] 02-01-PLAN.md — DB schema extensions, trade templates, tone preset wiring
- [ ] 02-02-PLAN.md — Three-layer triage engine (keywords, LLM, owner rules)
- [ ] 02-03-PLAN.md — shadcn init, auth flow, wizard Steps 1-2
- [ ] 02-04-PLAN.md — Wizard Step 3 (SMS verify, phone provisioning) and activation page
- [ ] 02-05-PLAN.md — Triage integration into call processor and webhook extensions
- [ ] 02-06-PLAN.md — Service manager dashboard and services CRUD API

### Phase 02.1: Public marketing landing page (INSERTED)

**Goal:** A public-facing marketing landing page that explains the HomeService AI product and converts home service business owners into signups, replacing the current placeholder at the root route
**Requirements**: LAND-01, LAND-02, LAND-03, LAND-04, LAND-05, LAND-06, LAND-07, LAND-08, LAND-09, LAND-10
**Depends on:** Phase 2
**Plans:** 2/2 plans complete

Plans:
- [ ] 02.1-01-PLAN.md — Foundation: framer-motion install, landing color palette, AnimatedSection + LandingNav client components
- [ ] 02.1-02-PLAN.md — All content sections (Hero, How it Works, Features, Social Proof, Final CTA, Footer) + page.js rewrite + /demo placeholder

### Phase 3: Scheduling and Calendar Sync
**Goal**: Emergency calls book a confirmed appointment slot while the caller is still on the line, routine calls create a lead with suggested slots — with zero double-bookings, travel time buffers between consecutive jobs, and real-time Google Calendar sync (Outlook deferred to Phase 5)
**Depends on**: Phase 2
**Requirements**: SCHED-01, SCHED-02, SCHED-03, SCHED-04, SCHED-05, SCHED-06, SCHED-07, SCHED-08, SCHED-09, VOICE-03, VOICE-04
**Success Criteria** (what must be TRUE):
  1. An emergency call results in a confirmed booking before the call ends, with the slot locked at database level so a simultaneous second call cannot claim the same slot
  2. A routine call creates a lead record with suggested available time slots for the owner to confirm
  3. Two simultaneous calls fired at the same slot in a concurrency test produce exactly one confirmed booking — the second caller receives the next available slot
  4. A booking in Jurong at 10AM automatically blocks the 11AM slot in Changi due to geographic travel time — the buffer is enforced without owner intervention
  5. A calendar event created directly in Google Calendar appears in platform availability within 60 seconds and blocks that slot from new bookings
  6. The caller hears address read-back confirmation before any slot is locked
**Plans:** 5/6 plans executed

Plans:
- [ ] 03-01-PLAN.md — DB migration (scheduling tables, atomic booking RPC) + slot calculator + booking module
- [ ] 03-02-PLAN.md — book_appointment Retell function + BOOKING FLOW agent prompt section
- [ ] 03-03-PLAN.md — Google Calendar OAuth, push notification sync, incremental mirror, cron renewal
- [ ] 03-04-PLAN.md — Dashboard settings UI (WorkingHoursEditor, CalendarSyncCard, ZoneManager) + API routes
- [ ] 03-05-PLAN.md — Calendar/Appointments dashboard page + AppointmentFlyout + ConflictAlertBanner
- [ ] 03-06-PLAN.md — Webhook integration: available_slots in calls, handleBookAppointment, suggested_slots for routine

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
**Plans:** 6/6 plans complete

Plans:
- [ ] 04-01-PLAN.md — DB migration (leads, lead_calls, activity_log) + leads module (createOrMergeLead, getLeads) + tests
- [ ] 04-02-PLAN.md — Notification service (Twilio SMS + Resend email) + React Email template + tests
- [ ] 04-03-PLAN.md — Webhook integration: lead creation in processCallAnalyzed + owner notifications + Vercel Cron recovery SMS
- [ ] 04-04-PLAN.md — Sidebar nav update + leads API route + lead list page (LeadCard, LeadFilterBar)
- [ ] 04-05-PLAN.md — Lead flyout (AudioPlayer, TranscriptViewer, status change, RevenueInput) + KanbanBoard + lead detail API
- [ ] 04-06-PLAN.md — Dashboard home (stats, activity feed) + analytics page (charts) + Supabase Realtime + settings stub

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
Phases execute in numeric order: 1 → 2 → 2.1 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Voice Infrastructure | 3/3 | Complete   | 2026-03-18 |
| 2. Onboarding and Triage | 6/6 | Complete   | 2026-03-19 |
| 2.1 Public Marketing Landing Page | 0/2 | Planning complete | - |
| 3. Scheduling and Calendar Sync | 5/6 | In Progress|  |
| 4. CRM, Dashboard, and Notifications | 6/6 | Complete   | 2026-03-21 |
| 5. Hardening and Launch | 0/TBD | Not started | - |

### Phase 10: Dashboard Guided Setup and First-Run Experience
**Goal**: A first-time user who lands on the dashboard after onboarding sees a guided setup checklist, contextual empty-state prompts, and a welcome message that walk them through every remaining configuration step — so they fully understand the product and complete setup without external help
**Depends on**: Phase 7
**Requirements**: SETUP-01, SETUP-02, SETUP-03, SETUP-04, SETUP-05
**Success Criteria** (what must be TRUE):
  1. A new owner who just completed onboarding lands on the dashboard and sees a setup checklist with clear next steps (connect calendar, configure working hours, make a test call) — each item links directly to the relevant action
  2. Every dashboard page that has no data yet (leads, appointments, analytics) shows a helpful empty state explaining what will appear there and how to trigger it — not a blank page or generic "no data" message
  3. The owner can trigger a test voice call from the dashboard and hear their AI receptionist answer — without needing to remember or look up their AI phone number
  4. Checklist progress persists across sessions and the checklist dismisses itself once all items are complete or the owner manually dismisses it
  5. A non-technical user visiting the dashboard for the first time can identify what each section does and what actions they need to take within 30 seconds — no guessing, no dead ends
**Plans:** 4/4 plans complete

Plans:
- [ ] 10-01-PLAN.md — DB migration + checklist API + SetupChecklist/ChecklistItem/SetupCompleteBar/WelcomeBanner + dashboard home integration
- [ ] 10-02-PLAN.md — TestCallPanel context prop adaptation + Settings page rebuild (3 sections: AI Receptionist, Working Hours, Calendar)
- [ ] 10-03-PLAN.md — Empty states for Leads, Calendar, Analytics, and Activity Feed pages
- [x] 10-04-PLAN.md — Human verification checkpoint for all Phase 10 UI (completed 2026-03-22)

---

## Milestone v1.1 Phases

**Milestone:** v1.1 — Site Completeness & Launch Readiness
**Goal:** Complete the public-facing site (pricing, contact, about), unify the signup+onboarding flow into a single wizard, add Outlook Calendar sync, and harden the platform for demo-ready launch.
**Phase range:** 6–9
**Requirements:** 28 v1.1 requirements (PRICE-01 through LAUNCH-05)

### v1.1 Phase Checklist

- [x] **Phase 6: Public Marketing Pages** - Pricing page (4 tiers, toggle, FAQ, comparison table), About page, Contact page, and nav/footer updated across all public pages (completed 2026-03-22)
- [x] **Phase 7: Unified Signup and Onboarding Wizard** - Single wizard from any CTA through account creation, business setup, and live test call finale (completed 2026-03-22)
- [ ] **Phase 8: Outlook Calendar Sync** - Bidirectional Microsoft Graph sync with OAuth connect/disconnect, delta queries, and webhook subscription renewal
- [ ] **Phase 9: Hardening and Launch QA** - Sentry monitoring, multi-language E2E, slot-locking contention test in CI, 5-minute gate validated by real SME, env var audit
- [ ] **Phase 10: Dashboard Guided Setup and First-Run Experience** - Setup checklist, empty states, test call from dashboard, contextual guidance for first-time users

### Phase 6: Public Marketing Pages
**Goal**: Prospective customers can learn about the product, understand pricing relative to their own call volume, and contact the team — all from a polished public site that reflects a real product, not a placeholder
**Depends on**: Phase 5 (v1.0 complete, marketing site can now represent a shipped product)
**Requirements**: PRICE-01, PRICE-02, PRICE-03, PRICE-04, PRICE-05, PRICE-06, PRICE-07, PAGE-01, PAGE-02, PAGE-03, PAGE-04, PAGE-05
**Success Criteria** (what must be TRUE):
  1. Visitor sees all 4 pricing tiers with call volume limits and price on a single page; clicking the monthly/annual toggle updates displayed prices without a page reload; the Growth tier card carries a visible "Most Popular" badge
  2. Visitor reads a feature comparison table below the fold and an FAQ section that addresses cancellation, overages, trial availability, and refunds — without emailing the team for that information
  3. Visitor on pricing or landing page clicks any "Get Started" CTA and lands at the unified onboarding wizard step 1
  4. Visitor can navigate to Pricing, About, and Contact from every public page using the site nav — including on a mobile viewport
  5. Visitor submits a contact form, selecting inquiry type (sales, support, or partnerships), and receives an acknowledgment; the submission arrives in the ops inbox via Resend within 2 minutes
**Plans:** 4/4 plans complete

Plans:
- [ ] 06-01-PLAN.md — Foundation: (public) route group, nav/footer extension, pricing data constants, Wave 0 test scaffolds
- [ ] 06-02-PLAN.md — Pricing page: hero, billing toggle, tier cards, comparison table, FAQ accordion, CTA banner
- [ ] 06-03-PLAN.md — About page (mission + values) and Contact page (form + API route with Resend dispatch)

### Phase 7: Unified Signup and Onboarding Wizard
**Goal**: Any visitor who clicks a CTA is carried through account creation and full business setup into a live test call with their AI receptionist — in a single, uninterrupted flow that replaces the current split auth+onboarding paths
**Depends on**: Phase 6
**Requirements**: WIZARD-01, WIZARD-02, WIZARD-03, WIZARD-04, WIZARD-05, WIZARD-06, WIZARD-07
**Success Criteria** (what must be TRUE):
  1. A new user clicks any CTA (landing page, pricing page, contact page), creates an account, and completes business setup without leaving the wizard or hitting a dead-end page — the entire flow is one continuous URL-routed sequence
  2. The wizard opens with a trade-type routing question; selecting a trade (e.g., "Plumber") pre-populates a relevant service list and triage rules so the owner does not start from a blank slate
  3. Email verification completes inline — the user clicks the verification link, returns to the browser, and resumes at the correct wizard step without losing previously entered form data
  4. A non-technical user who refreshes the page mid-wizard finds their previously entered data still present (sessionStorage persistence)
  5. The wizard finale triggers a live test call; the owner hears their configured AI receptionist answer before the wizard marks onboarding complete
  6. A returning user who has already completed onboarding bypasses the wizard entirely and goes directly to the dashboard
**Plans:** 4/4 plans complete

Plans:
- [ ] 07-01-PLAN.md — Middleware rewrite, layout 5-step update, auth redirect, useWizardSession hook, celebration CSS
- [ ] 07-02-PLAN.md — Step 1 Create Account (OAuth + email/password + OTP) and Step 2 Business Profile (trade + name + tone)
- [ ] 07-03-PLAN.md — Step 3 Services migration, Step 4 Contact migration, test-call-status API, test-call timing fix
- [ ] 07-04-PLAN.md — Step 5 Test Call Finale (TestCallPanel, CelebrationOverlay, polling, completion flow)

### Phase 8: Outlook Calendar Sync
**Goal**: An owner can connect their Outlook Calendar from dashboard settings and have it sync bidirectionally with the platform's availability database — blocking slots in both directions, auto-renewing webhook subscriptions before they expire
**Depends on**: Phase 6
**Requirements**: OUTLOOK-01, OUTLOOK-02, OUTLOOK-03, OUTLOOK-04
**Success Criteria** (what must be TRUE):
  1. Owner clicks "Connect Outlook" in dashboard settings, completes Microsoft OAuth consent, and returns to the settings page with Outlook shown as connected — no developer intervention required
  2. An event created directly in Outlook Calendar appears as a blocked slot in the platform availability database within 60 seconds; a booking made through the platform appears in Outlook Calendar within 60 seconds
  3. The Outlook webhook subscription renews automatically before its 3-day expiry; the owner never loses sync due to an expired subscription
  4. Owner clicks "Disconnect Outlook" and the platform stops syncing Outlook events; availability reverts to manual schedule management without requiring a re-onboard
**Plans**: TBD

### Phase 9: Hardening and Launch QA
**Goal**: Every critical failure mode is instrumented, monitored, and validated before the first real customer is handed a demo — including multi-language correctness end-to-end, slot-locking correctness under genuine contention, the 5-minute activation promise with a real SME user, and no secrets in source
**Depends on**: Phase 7, Phase 8
**Requirements**: LAUNCH-01, LAUNCH-02, LAUNCH-03, LAUNCH-04, LAUNCH-05
**Success Criteria** (what must be TRUE):
  1. An unhandled exception or Retell API failure in production triggers a Sentry alert within 60 seconds with full stack trace and request context — confirmed via a deliberate test throw in a staging environment
  2. A Spanish-language test call is answered in Spanish, triaged in Spanish, booked with a Spanish-language confirmation, and the owner's SMS/email notification arrives with Spanish-language content — validated by a human reviewer end-to-end
  3. A k6 contention test fires 20 simultaneous requests at the exact same availability slot within a 100ms window; exactly 1 request returns HTTP 201 and the remaining 19 return HTTP 409 — this test runs in CI and must pass before demo-ready is declared
  4. A real non-technical home service business owner completes the wizard on staging and hears their AI answer a test call in under 5 minutes, measured from the landing page CTA click — timing and result logged
  5. A full environment variable audit confirms zero secrets in source control and all required production env vars are set and non-empty — the audit checklist is saved as a file in the repository
**Plans**: TBD

## v1.1 Progress

**Execution Order:**
Phases execute in numeric order: 6 → 7 → 8 → 9 → 10
(Note: Phase 8 and Phase 10 may execute in parallel as they share no implementation dependencies)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 6. Public Marketing Pages | 4/4 | Complete   | 2026-03-22 |
| 7. Unified Signup and Onboarding Wizard | 4/4 | Complete   | 2026-03-22 |
| 8. Outlook Calendar Sync | 0/TBD | Not started | - |
| 9. Hardening and Launch QA | 0/TBD | Not started | - |
| 10. Dashboard Guided Setup | 4/4 | Complete   | 2026-03-22 |

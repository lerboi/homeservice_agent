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
  6. Owner can see cumulative revenue tracked through the AI pipeline (booked -> completed -> paid) on the dashboard
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
**Plans**: 2 plans

Plans:
- [x] 17-01-PLAN.md — Schema migration (recovery_sms_tracking), sendCallerRecoverySMS overhaul (urgency-aware i18n, structured return), test rewrite
- [x] 17-02-PLAN.md — Webhook real-time trigger, cron overhaul (urgency-aware + retry branch), skill file update

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 2.1 -> 3 -> 4 -> 5

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

### Phase 11: Landing Page UI/UX Redesign

**Goal:** The public landing page is redesigned with premium, handcrafted quality — How It Works uses a tabbed interface, Features has 5 bento cards including multi-language, Hero uses the cursor-reactive Spline 3D model, and Social Proof + Final CTA have polished hover effects and gradient animations
**Requirements**: REDESIGN-HERO, REDESIGN-HIW, REDESIGN-FEAT, REDESIGN-SOCIAL, REDESIGN-CTA
**Depends on:** Phase 10
**Plans:** 3/3 plans complete

Plans:
- [x] 11-01-PLAN.md — How It Works tabbed rebuild (HowItWorksTabs.jsx) + Features 5th card + page.js skeleton updates
- [x] 11-02-PLAN.md — Hero Spline model URL + Social Proof hover polish + Final CTA gradient animation
- [x] 11-03-PLAN.md — Human verification checkpoint for all 5 sections (verified and passed 2026-03-26)

### Phase 12: Dashboard-configurable triage and call escalation

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 11
**Plans:** 3/3 plans complete

Plans:
- [x] TBD (run /gsd:plan-phase 12 to break down) (completed 2026-03-23)

### Phase 13: Frontend Public Pages Redesign

**Goal:** Redesign all public-facing pages (Home, Pricing, Contact, About) and shared components (Nav, Footer) with a Premium Dark SaaS design language — improving component-level design quality while preserving existing page structure and layout patterns. Performance-first: no backdrop-blur on large surfaces, transform/opacity-only animations, dynamic imports with loading skeletons, mobile lightweight fallbacks, Core Web Vitals optimized (LCP < 2.5s, CLS < 0.1, INP < 200ms). Use Next.js dynamic imports for lazy loading and aggressive code-splitting. Swap heavy interactive elements for lightweight static fallbacks on mobile.
**Requirements**: D-01 through D-36 (36 locked design decisions from CONTEXT.md)
**Depends on:** Phase 12
**Plans:** 7/7 plans complete

Plans:
- [x] 13-01-PLAN.md — Foundation: CSS tokens, AnimatedSection timing, LandingNav restyle, LandingFooter restyle
- [x] 13-02-PLAN.md — Home page sections + Pricing page + About page + Contact page dark reskin
- [x] 13-03-PLAN.md — Auth page differentiated signup/signin/OTP layouts + OtpInput dark restyle
- [x] 13-04-PLAN.md — Human verification checkpoint (REJECTED — gap closure needed)
- [x] 13-05-PLAN.md — Gap closure: HowItWorks light bg + FeaturesGrid dark rebuild + Footer dramatic upgrade
- [x] 13-06-PLAN.md — Gap closure: Auth page complete redo — white left panel, lighter background
- [x] 13-07-PLAN.md — Gap closure: Human verification checkpoint (verified and passed 2026-03-26)

---

## Milestone v1.1 Phases

**Milestone:** v1.1 — Site Completeness & Launch Readiness
**Goal:** Complete the public-facing site (pricing, contact, about), unify the signup+onboarding flow into a single wizard, add Outlook Calendar sync, and harden the platform for demo-ready launch.
**Phase range:** 6-9
**Requirements:** 28 v1.1 requirements (PRICE-01 through LAUNCH-05)

### v1.1 Phase Checklist

- [x] **Phase 6: Public Marketing Pages** - Pricing page (4 tiers, toggle, FAQ, comparison table), About page, Contact page, and nav/footer updated across all public pages (completed 2026-03-22)
- [x] **Phase 7: Unified Signup and Onboarding Wizard** - Single wizard from any CTA through account creation, business setup, and live test call finale (completed 2026-03-22)
- [x] **Phase 8: Outlook Calendar Sync** - Bidirectional Microsoft Graph sync with OAuth connect/disconnect, delta queries, and webhook subscription renewal (completed 2026-03-26)
- [ ] **Phase 9: Hardening and Launch QA** - Sentry monitoring, multi-language E2E, slot-locking contention test in CI, 5-minute gate validated by real SME, env var audit
- [x] **Phase 10: Dashboard Guided Setup and First-Run Experience** - Setup checklist, empty states, test call from dashboard, contextual guidance for first-time users (completed 2026-03-22)

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
**Plans:** 3/3 plans complete

Plans:
- [x] 08-01-PLAN.md — DB migration (is_primary, external_event_id) + Google provider filter fixes (D-08) + Outlook Calendar module
- [x] 08-02-PLAN.md — Outlook OAuth routes (auth + callback) + Graph webhook endpoint + push handler
- [x] 08-03-PLAN.md — Dual-provider API routes (status, disconnect, set-primary, cron) + CalendarSyncCard rewrite + human verification

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
**Plans**: 2 plans

Plans:
- [x] 17-01-PLAN.md — Schema migration (recovery_sms_tracking), sendCallerRecoverySMS overhaul (urgency-aware i18n, structured return), test rewrite
- [ ] 17-02-PLAN.md — Webhook real-time trigger, cron overhaul (urgency-aware + retry branch), skill file update

## v1.1 Progress

**Execution Order:**
Phases execute in numeric order: 6 -> 7 -> 8 -> 9 -> 10
(Note: Phase 8 and Phase 10 may execute in parallel as they share no implementation dependencies)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 6. Public Marketing Pages | 4/4 | Complete   | 2026-03-22 |
| 7. Unified Signup and Onboarding Wizard | 4/4 | Complete   | 2026-03-22 |
| 8. Outlook Calendar Sync | 3/3 | Complete | 2026-03-26 |
| 9. Hardening and Launch QA | 0/TBD | Not started | - |
| 10. Dashboard Guided Setup | 4/4 | Complete    | 2026-03-22 |

### Phase 30: Voice Agent Prompt Optimization

**Goal:** Holistic refinement of the AI receptionist system prompt and supporting tools to maximize booking conversion, improve caller experience, and close behavioral gaps — smart slot preference detection, repeat caller awareness, failed transfer recovery, prompt cleanup, trade-specific questioning, and post-booking recap flow
**Requirements**: PROMPT-01, PROMPT-02, PROMPT-03, PROMPT-04, PROMPT-05, PROMPT-06
**Depends on:** Phase 14
**Plans:** 2/3 plans executed

Plans:
- [x] 30-01-PLAN.md — DB migration + trade templates + check_caller_history webhook handler + handleInbound dynamic variables
- [x] 30-02-PLAN.md — Agent prompt restructure (all 6 decisions) + server.js new tool definition
- [ ] 30-03-PLAN.md — Skill file update + prompt quality verification checkpoint

### Phase 31: Voice Call Feature Showcase PDF

**Goal:** Generate a non-technical, sales-ready PDF showcasing all voice call features and capabilities. Output to `docs/` directory. Covers: AI receptionist capabilities, booking flow, triage, transfer, recovery SMS, calendar sync, multi-language support, and all smart features from Phase 30.
**Requirements**: TBD
**Depends on:** Phase 30
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 31 to break down)

### Phase 32: Landing Page Redesign — Conversion-Optimized Sections

**Goal:** Redesign the landing page hero text, Features section, and How It Works section to be more conversion-focused — attacking direct pain points for home service business owners with clear messaging around 70+ language support, real-time calendar-aware booking, post-call SMS, call analytics, and full integration capabilities. Improve visual clarity and UX appeal across all landing sections.
**Requirements**: D-01 through D-20 (from 32-CONTEXT.md)
**Depends on:** Phase 29
**Plans:** 1/3 plans executed

Plans:
- [ ] 32-01-PLAN.md — Hero copy update + HowItWorks 4-step expansion with folder-stack effect
- [x] 32-02-PLAN.md — FeaturesGrid full rewrite: 2-col grid, 70+ Languages hero card, 6 feature cards with micro visuals
- [ ] 32-03-PLAN.md — Page.js skeleton updates, ScrollLinePath verification, visual checkpoint

### Phase 33: Invoice Core

**Goal:** Business owners can generate professional white-labeled invoices from completed jobs, edit typed line items (labor, materials with markup, travel, flat-rate, discount), configure business identity and tax settings, send invoices to customers via email (PDF attachment) and SMS (summary), download PDFs for on-site hand-delivery, and track invoice status through a filterable dashboard — replacing manual revenue entry with a full invoicing workflow. Voco handles invoicing only — no payment processing, no payment links, no online payment collection.
**Depends on:** Phase 20 (Dashboard UX Overhaul — navigation structure)
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. An owner creates an invoice from a completed lead with pre-filled customer data, adds typed line items (labor, materials, travel, flat-rate, discount), and sees auto-calculated tax on taxable items
  2. The generated PDF is fully white-labeled — business name, logo, license number, and contact info appear; zero Voco branding, URLs, or references
  3. Sending an invoice delivers an email (Resend) with PDF attachment and an optional SMS (Twilio) summary from the business phone number — both white-labeled
  4. The Invoices tab shows summary cards (Total Outstanding, Overdue, Paid This Month), status filter tabs (All/Draft/Sent/Overdue/Paid), and a sortable invoice table
  5. Marking an invoice as Paid auto-updates the linked lead's revenue_amount and status to Paid; marking a lead as Paid auto-marks the linked invoice — bidirectional sync with no circular updates
  6. Invoice settings page allows configuring business identity (name, logo, address, phone, email, license), tax rate, default terms, invoice prefix, and next number display
**Plans**: 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 33 to break down)
**UI hint**: yes

---

## Milestone v2.0 Phases

**Milestone:** v2.0 — Booking-First Digital Dispatcher
**Goal:** Pivot the AI from an emergency-triage escalation model to a booking-first dispatcher that autonomously schedules ALL calls — including emergencies — using urgency tags strictly for notification priority, with escalation reserved for exception states only.
**Phase range:** 14-19
**Requirements:** 16 v2.0 requirements (BOOK-01-05, TRIAGE-R01-02, NOTIF-P01-02, RECOVER-01-03, HARDEN-01-04)

**Key context:** This is a behavioral pivot, not an infrastructure rebuild. The existing stack (Next.js 16, Supabase, Retell, Groq/Llama 4 Scout, Google Calendar, Twilio SMS, Resend) remains unchanged. The pivot is 90% prompt rewrite and call-flow logic, 10% notification formatting and recovery SMS expansion. Two additive schema columns (`booking_outcome` and `exception_reason` on calls table) are the only data model changes.

### v2.0 Phase Checklist

- [x] **Phase 14: Booking-First Agent Behavior** - Agent prompt rewrite to booking-first dispatcher, intent detection, exception-only transfer, warm transfer context preservation, WebSocket tool updates (completed 2026-03-24)
- [x] **Phase 15: Call Processor and Triage Reclassification** - Schema migration (booking_outcome, exception_reason), call processor update removing isRoutineUnbooked guard, triage tags reclassified as notification priority, caller SMS confirmation (completed 2026-03-24)
- [x] **Phase 16: Notification Priority System** - Priority-tiered SMS/email formatting driven by urgency tags, emergency notifications with EMERGENCY prefix, routine notifications via standard flow (completed 2026-03-24)
- [x] **Phase 17: Recovery SMS Enhancement** - Universal recovery SMS fallback for all failed bookings, urgency-aware content, delivery failure logging and retry (completed 2026-03-25)
- [x] **Phase 18: Booking-First Hardening and QA** - Multi-language E2E revalidation for booking-first, concurrency QA at 20 simultaneous requests, onboarding gate revalidation, Sentry error monitoring (completed 2026-03-25)
- [x] **Phase 19: Codebase Skill Files** - Create 5 comprehensive skill files as living architectural references, update CLAUDE.md for skill maintenance (completed 2026-03-25)
- [x] **Phase 21: Pricing Page Redesign** - Premium pricing page matching landing page design language, accurate feature tiers, 14-day trial messaging, social proof, expanded FAQ, dark SaaS visual upgrade (completed 2026-03-25)

### Phase 14: Booking-First Agent Behavior
**Goal**: The AI books every inbound call by default — emergencies into the nearest same-day slot, routine calls into next available — with human transfer restricted to exception states only, and full call context preserved on any transfer
**Depends on**: Phase 13 (existing codebase with escalation-first behavior)
**Requirements**: BOOK-01, BOOK-02, BOOK-03, BOOK-05
**Success Criteria** (what must be TRUE):
  1. An emergency caller ("my pipe burst") is booked into the nearest same-day slot while still on the line — not transferred to the owner
  2. A routine caller ("I need a quote for a bathroom remodel next month") is booked into the next available slot — not captured as a passive lead
  3. A caller asking only for information ("how much does a water heater cost?") is NOT booked — the AI detects non-booking intent and provides information without forcing an appointment
  4. After 2 failed clarification attempts where the AI cannot determine the job type, the call is transferred to a human with a whisper message containing full caller details (name, phone, address, conversation summary)
  5. A caller who says "let me talk to a person" or "I want to speak to someone" is immediately transferred with full context — no pushback or re-prompting
**Plans:** 3/3 plans complete

Plans:
- [x] 14-01-PLAN.md — Test safety net: prompt snapshots, booking-first RED assertions, whisper message tests, capture_lead handler tests
- [x] 14-02-PLAN.md — Modular prompt rewrite: booking-first protocol, decline handling, clarification limit, urgency-for-slots
- [x] 14-03-PLAN.md — WebSocket tool additions (end_call, capture_lead) + webhook handlers + whisper message transfer + skill file update

### Phase 15: Call Processor and Triage Reclassification
**Goal**: The call processing pipeline treats every call as a booking attempt, urgency tags are retained on records but no longer determine call routing, and callers receive SMS confirmation after successful bookings
**Depends on**: Phase 14
**Requirements**: TRIAGE-R01, TRIAGE-R02, BOOK-04
**Success Criteria** (what must be TRUE):
  1. An emergency-tagged booking and a routine-tagged booking both follow the same call processing path — the urgency tag appears on the booking record but does not change whether or how the call was booked
  2. The `booking_outcome` column on the calls table accurately records whether each call resulted in booked, attempted (failed), or not_attempted (info-only call) — queryable for analytics
  3. After a successful booking, the caller receives an SMS within 60 seconds confirming date, time, and service address
  4. A routine call that was previously captured as an unbooked lead is now booked autonomously — the `isRoutineUnbooked` guard no longer prevents booking
**Plans:** 2/2 plans complete

Plans:
- [x] 15-01-PLAN.md — Schema migration (booking_outcome, exception_reason, notification_priority) + sendCallerSMS + i18n keys + Wave 0 test scaffolds
- [x] 15-02-PLAN.md — Call-processor pipeline flatten + webhook booking_outcome writes + caller SMS trigger + skill file update

### Phase 16: Notification Priority System
**Goal**: Owners receive urgency-appropriate notifications — emergency bookings surface with high-priority formatting and immediate delivery, routine bookings arrive through standard notification flow without alarm
**Depends on**: Phase 15 (booking_outcome data available)
**Requirements**: NOTIF-P01, NOTIF-P02
**Success Criteria** (what must be TRUE):
  1. An emergency booking triggers an SMS and email with "EMERGENCY" prefix, urgent formatting, and immediate delivery — visually distinct from routine notifications
  2. A routine booking triggers a standard SMS and email notification without urgency formatting — the owner can distinguish emergency from routine at a glance without opening the message
  3. Notification priority is driven by the urgency tag on the booking record, not by the call routing path — same notification system, different formatting
**Plans**: 1 plan

Plans:
- [x] 16-01-PLAN.md — Priority-tiered SMS/email formatting (EMERGENCY prefix, red header badge) + 12 priority tests

### Phase 17: Recovery SMS Enhancement
**Goal**: Every call path where booking fails has a safety net — the caller receives a recovery SMS with a manual booking link, and delivery failures are never silently swallowed
**Depends on**: Phase 15 (booking_outcome tracking identifies failed bookings)
**Requirements**: RECOVER-01, RECOVER-02, RECOVER-03
**Success Criteria** (what must be TRUE):
  1. A caller whose booking fails for any reason (no slots available, slot taken during call, AI confusion, caller hung up) receives a recovery SMS with a manual booking link within 60 seconds
  2. Recovery SMS for emergency-tagged calls uses urgent tone ("We know this is urgent -- book your emergency appointment now") while routine recovery uses standard tone — matching the caller's situation
  3. A recovery SMS that fails to deliver (Twilio error, invalid number) is logged with the failure reason and retried at least once — never silently dropped
**Plans**: 2 plans

Plans:
- [ ] 17-01-PLAN.md — Schema migration (recovery_sms_tracking), sendCallerRecoverySMS overhaul (urgency-aware i18n, structured return), test rewrite
- [ ] 17-02-PLAN.md — Webhook real-time trigger, cron overhaul (urgency-aware + retry branch), skill file update

### Phase 18: Booking-First Hardening and QA
**Goal**: The booking-first dispatcher is validated end-to-end across all call scenarios — multi-language, concurrency, edge cases, and error monitoring — before any real customer traffic
**Depends on**: Phase 14, Phase 15, Phase 16, Phase 17
**Requirements**: HARDEN-01, HARDEN-02, HARDEN-03, HARDEN-04
**Success Criteria** (what must be TRUE):
  1. A Spanish-speaking caller books an appointment autonomously, receives a Spanish-language SMS confirmation, and the owner receives a notification — validated end-to-end by a human reviewer
  2. A contention test firing 20 simultaneous booking requests at the same slot produces exactly 1 confirmed booking and 19 next-available offers — zero double-bookings, zero unhandled errors
  3. A non-technical SME owner completes the onboarding wizard and hears their booking-first AI receptionist in under 5 minutes — revalidated for the new booking-first behavior (AI should attempt to book the test call, not just take a message)
  4. An unhandled exception or API failure in the booking flow triggers a Sentry alert with full stack trace within 60 seconds — confirmed via deliberate test throw in staging
**Plans**: 3 plans

Plans:
- [x] 18-01-PLAN.md — Sentry error monitoring setup (SDK install, server config, test error endpoint)
- [x] 18-02-PLAN.md — Concurrency integration test (20 simultaneous bookings via real Supabase)
- [x] 18-03-PLAN.md — Test-call auto-cancel + manual E2E test scripts (English, Spanish, onboarding) + skill file update

## v2.0 Progress

**Execution Order:**
Phases execute in order: 14 -> 15 -> 16 -> 17 -> 18
(Note: Phase 16 and Phase 17 may execute in parallel as they share no implementation dependencies — both depend on Phase 15 but not on each other)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 14. Booking-First Agent Behavior | 3/3 | Complete    | 2026-03-24 |
| 15. Call Processor and Triage Reclassification | 2/2 | Complete    | 2026-03-24 |
| 16. Notification Priority System | 1/1 | Complete   | 2026-03-24 |
| 17. Recovery SMS Enhancement | 2/2 | Complete    | 2026-03-25 |
| 18. Booking-First Hardening and QA | 3/3 | Complete    | 2026-03-25 |
| 19. Codebase Skill Files | 3/3 | Complete    | 2026-03-25 |
| 20. Dashboard UX Overhaul | 4/4 | Complete   | 2026-03-25 |
| 21. Pricing Page Redesign | 2/2 | Complete    | 2026-03-25 |

### Phase 19: Codebase Skill Files for Full Architectural Reference
**Goal**: Create 5 comprehensive skill files (scheduling-calendar-system, dashboard-crm-system, onboarding-flow, auth-database-multitenancy, public-site-i18n) that serve as living architectural references for the entire codebase, enabling instant context loading for any section of the project. Update CLAUDE.md to enforce skill file maintenance after code changes.
**Depends on**: None (documentation phase, can run anytime)
**Requirements**: None (tooling/documentation)
**Success Criteria** (what must be TRUE):
  1. Each of the 5 skill files is created via skill-creator and accurately documents its domain's architecture, key files, data flow, and integration points
  2. Reading any single skill file gives a developer (or AI) enough context to understand and modify that system without reading every source file
  3. CLAUDE.md is updated to require skill file updates after changes to any covered system — not just voice-call-architecture
  4. The existing voice-call-architecture skill remains unchanged (already complete)
  5. All 6 skills together (existing + 5 new) cover every major system in the codebase with no significant gaps
**Plans:** 3/3 plans complete

Plans:
- [x] 19-01-PLAN.md — scheduling-calendar-system skill (slot calculator, booking, dual-provider calendar sync)
- [x] 19-02-PLAN.md — dashboard-crm-system + onboarding-flow skills
- [x] 19-03-PLAN.md — auth-database-multitenancy + public-site-i18n skills + CLAUDE.md update

### Skill Files to Create

| # | Skill Name | Scope |
|---|-----------|-------|
| 1 | `voice-call-architecture` | **Exists** — Retell webhooks, call-processor, triage, whisper messages |
| 2 | `scheduling-calendar-system` | Slot calculator, booking, Google + Outlook OAuth/sync/webhooks, cron jobs, conflict detection, travel buffers |
| 3 | `dashboard-crm-system` | All dashboard pages + components, lead lifecycle/merging/revenue, Kanban board, analytics charts, flyouts, escalation chain, settings panels, design tokens |
| 4 | `onboarding-flow` | 7-step wizard, all onboarding API routes, phone provisioning, SMS verify, test call, setup checklist |
| 5 | `auth-database-multitenancy` | Supabase Auth, middleware, RLS, all migrations/tables/relationships, getTenantId, multi-tenant isolation |
| 6 | `public-site-i18n` | Landing, pricing, about, contact form, Resend email, AuthAwareCTA, next-intl (en/es) |

### Phase 20: Dashboard UX Overhaul
**Goal**: Full structural redesign of the dashboard — 5-tab bottom nav (Home, Leads, Calendar, Analytics, More), adaptive home page (setup checklist hero vs active command center), More menu consolidating Services+Settings into sub-pages, redesigned checklist with required/recommended badges, and Joyride guided tour. All existing features remain functional at new routes.
**Depends on**: Phase 19 (skill files provide implementation context)
**Requirements**: None (UX improvement)
**Success Criteria** (what must be TRUE):
  1. The setup checklist on the dashboard home clearly distinguishes required items (minimum for calls to work) from optional but recommended items, with visual differentiation (e.g., badges, color coding)
  2. A "Start Tour" button launches a Joyride-powered guided tutorial that walks the user through the main dashboard tabs and key actions
  3. A first-time user can identify what needs to be configured before their first real call without reading documentation
  4. All existing dashboard features (leads, calendar, analytics, services, settings) remain fully functional with no regressions
  5. The setup checklist provides direct navigation links to the relevant settings page for each item
**Plans:** 4/4 plans complete

Plans:
- [x] 20-01-PLAN.md — Layout restructure: remove card wrapper, bottom tab bar, sidebar 5-tab nav, per-page wrappers
- [x] 20-02-PLAN.md — More menu page + 7 sub-page routes, old pages redirect, checklist API href update
- [x] 20-03-PLAN.md — Setup checklist redesign (required/recommended, progress ring, expandable) + adaptive home page
- [x] 20-04-PLAN.md — Joyride guided tour, data-tour wiring, skill file update

### Phase 21: Pricing Page Redesign
**Goal**: Transform the pricing page into a conversion-optimized page that matches the premium dark SaaS design language of the landing page — with accurate volume-based feature tiers reflecting actual product capabilities, 14-day free trial as the primary pull factor, social proof (testimonial), expanded FAQ covering setup/AI quality/billing/security, and a polished mobile experience. No Stripe integration (handled separately).
**Depends on**: Phase 20 (dashboard UX overhaul complete)
**Requirements**: PR21-01, PR21-02, PR21-03, PR21-04, PR21-05, PR21-06, PR21-07, PR21-08
**Success Criteria** (what must be TRUE):
  1. The pricing page uses the same premium dark SaaS design language as the landing page — rich dark hero (#050505) with radial gradient accents, dot-grid texture, floating blur orb, dark tier cards with copper glow hover, and consistent typography
  2. Each pricing tier's feature list accurately reflects only actually built product capabilities — volume-based tiers where all features are available on all paid plans, differentiated only by call volume and support level
  3. 14-day free trial is prominently displayed as the primary conversion pull — visible banner near the top, all paid tier CTAs say "Start Free Trial"
  4. The Enterprise tier "Contact Us" CTA routes to the contact page with inquiry type pre-selected as "sales"
  5. A testimonial section between the comparison table and CTA banner provides social proof from trades owners
  6. The FAQ section covers 6-8 questions across setup/onboarding, AI call quality, trial/billing, and data/security — replacing the current 4-question FAQ
  7. No money-back guarantee messaging and no "no credit card required" messaging appears anywhere on the page
  8. The pricing page renders correctly on mobile viewports (375px+) with tier cards stacking vertically and the comparison table scrolling horizontally
**Plans:** 2/2 plans complete

Plans:
- [x] 21-01-PLAN.md — Data layer (volume-based tiers), dark hero with dot-grid/blur-orb, trial banner, dark tier cards
- [x] 21-02-PLAN.md — Comparison table with Growth highlight, testimonials, 8-question dark FAQ, Enterprise contact pre-selection, skill file update





## Milestone v3.0 Phases

**Milestone:** v3.0 — Subscription Billing & Usage Enforcement
**Goal:** Turn the free platform into a revenue-generating SaaS by wiring Stripe subscription billing, per-call usage tracking, plan limit enforcement, and a billing management dashboard — additive integration into four defined seams of the existing architecture without restructuring any existing component.
**Phase range:** 22-26
**Requirements:** 23 v3.0 requirements (BILL-01-06, USAGE-01-03, ENFORCE-01-04, BILLUI-01-05, BILLNOTIF-01-03, BILLDOC-01-02)

**Key decisions locked for this milestone:**
- CC required for 14-day trial (payment_method_collection: always)
- Past_due grace period is 3 days (not 7)
- Enforcement reads only from local subscriptions table — never calls Stripe API on the call path
- Billing cycle reset triggered by invoice.paid webhook — not a cron job
- Stripe Customer Portal handles all self-serve plan management — no custom plan change UI
- Per-call overage billing (BILLF-02) is deferred to a future milestone

### v3.0 Phase Checklist

- [x] **Phase 22: Billing Foundation** - Stripe products/prices, subscriptions and usage_events DB tables, webhook handler with idempotency, trial auto-start at onboarding completion (completed 2026-03-26, Plan 04 skipped — UI handled elsewhere)
- [x] **Phase 23: Usage Tracking** - Atomic per-call increment via Postgres RPC, usage_events idempotency, billing cycle reset on invoice.paid (completed 2026-03-26)
- [x] **Phase 24: Subscription Lifecycle and Notifications** - Past_due grace period, middleware gate, failed payment SMS/email, trial email cron at day 7+12, trial-will-end webhook notification (completed 2026-03-26)
- [x] **Phase 25: Enforcement Gate and Billing Dashboard** - handleInbound subscription check, call blocking with graceful message, billing dashboard page, trial countdown banner, paywall page, Stripe Checkout, Customer Portal link (completed 2026-03-31)
- [ ] **Phase 26: Billing Documentation** - Billing/payment architecture skill file, CLAUDE.md updated with billing skill entry
- [x] **Phase 27: Country-Aware Onboarding and Number Provisioning** - User info collection (name, phone, country), country-based Twilio provisioning, Singapore pre-purchased inventory, simplified plan selection UI (completed 2026-03-26)
- [x] **Phase 28: Admin Dashboard** - Separate admin auth, Singapore phone number inventory management, tenant user overview (completed 2026-03-26)
- [x] **Phase 29: Hero Section Interactive Demo** - Business name input, AI voice demo player with dynamic TTS name splice, shorter hero title, responsive rotating text (completed 2026-03-26)

### Phase 22: Billing Foundation
**Goal**: The Stripe integration backbone is live — products and prices exist in Stripe, the subscriptions table is the authoritative local mirror, the webhook handler processes all lifecycle events idempotently, and every new tenant starts a 14-day trial with CC required at onboarding completion
**Depends on**: Phase 21 (pricing page complete; Stripe products must match displayed pricing)
**Requirements**: BILL-01, BILL-02, BILL-03, BILL-04, BILL-05, BILL-06
**Success Criteria** (what must be TRUE):
  1. Completing the onboarding wizard creates a Stripe customer and a 14-day trialing subscription — the subscriptions table row is written synchronously before the onboarding complete response returns
  2. A Stripe test webhook for customer.subscription.updated arrives at /api/stripe/webhook, passes signature verification, and is reflected in the local subscriptions table within 5 seconds — duplicate delivery of the same event_id produces no second DB write
  3. Sending customer.subscription.deleted via Stripe test webhook sets the local subscription status to cancelled — the tenant cannot get indefinite free access by letting a trial expire without a payment method
  4. Out-of-order webhook delivery (an older event arriving after a newer one) does not overwrite newer subscription state — stripe_updated_at version protection is observed
**Plans:**
3/4 plans executed
- [x] 22-02-PLAN.md — Stripe webhook handler with idempotency and version protection
- [x] 22-03-PLAN.md — Checkout Session API and onboarding flow rewiring
- [~] 22-04-PLAN.md — Plan selection UI and post-checkout celebration screens (SKIPPED — handled by Phase 27 onboarding redesign)

### Phase 23: Usage Tracking
**Goal**: Every completed call increments the tenant's usage counter exactly once — atomic, idempotent, and reset precisely on billing cycle rollover — so enforcement in the next phase can trust the counter as a reliable source of truth
**Depends on**: Phase 22 (subscriptions table must exist before usage can be tracked against it)
**Requirements**: USAGE-01, USAGE-02, USAGE-03
**Success Criteria** (what must be TRUE):
  1. A completed call over 10 seconds increments calls_used by exactly 1 in the subscriptions table; a call under 10 seconds or marked as a test call produces no increment
  2. Retell delivering the same call_ended webhook twice (retry scenario) results in calls_used incrementing by 1, not 2 — the usage_events idempotency key prevents double-counting
  3. After an invoice.paid webhook arrives with billing_reason = subscription_cycle, calls_used resets to 0 — the reset does not happen at midnight, on a cron tick, or on any other trigger
  4. Two calls completing simultaneously increment calls_used by exactly 2 — no race condition drops or doubles an increment
**Plans**: 1 plan
Plans:
- [x] 23-01-PLAN.md — Usage events migration, increment RPC, and processCallEnded integration

### Phase 24: Subscription Lifecycle and Notifications
**Goal**: Tenants in degraded subscription states (past_due, trial expiring) are handled gracefully — owners have 3 days on past_due before blocking, receive email and SMS when payment fails, get trial reminder emails at day 7 and 12, and the dashboard is gated appropriately for cancelled or expired tenants
**Depends on**: Phase 23 (reliable usage counter; subscriptions table fully populated via Phase 22 webhook handler)
**Requirements**: ENFORCE-03, ENFORCE-04, BILLNOTIF-01, BILLNOTIF-02, BILLNOTIF-03
**Success Criteria** (what must be TRUE):
  1. When a payment fails (invoice.payment_failed), the owner receives both an SMS and an email within 2 minutes containing a direct link to update their payment method via Stripe Customer Portal
  2. A tenant whose subscription transitions to past_due can still receive calls for 3 days — the enforcement gate does not block them immediately; after the 3-day grace window the gate blocks as if cancelled
  3. A tenant in cancelled or expired status who navigates to any dashboard route is redirected to /billing/upgrade — they cannot access the main dashboard
  4. A trial started on day 0 triggers a trial reminder email on day 7 and another on day 12 — neither fires more than once regardless of cron re-execution
  5. A customer.subscription.trial_will_end webhook (fired 3 days before trial expiry) triggers a notification to the owner prompting them to upgrade before their trial ends
**Plans:** 3/3 plans complete
Plans:
- [x] 24-01-PLAN.md � Billing notifications migration, email templates, webhook stubs (handleInvoicePaymentFailed, handleTrialWillEnd)
- [x] 24-02-PLAN.md � Middleware subscription gate, BillingWarningBanner for past_due grace period
- [x] 24-03-PLAN.md � Trial reminders cron job (day 7 and day 12 emails)
**UI hint**: yes

### Phase 25: Enforcement Gate and Billing Dashboard
**Goal**: Calls are blocked at the inbound handler when the subscription is expired or quota is exhausted — with zero latency impact — and owners have a full billing self-service dashboard to view their plan, usage, and manage their subscription
**Depends on**: Phase 24 (lifecycle states and grace period logic must be stable before the gate opens; middleware gate from Phase 24 ensures the billing page is reachable for expired tenants)
**Requirements**: ENFORCE-01, ENFORCE-02, BILLUI-01, BILLUI-02, BILLUI-03, BILLUI-04, BILLUI-05
**Success Criteria** (what must be TRUE):
  1. A call arriving at handleInbound() for a tenant with a cancelled subscription plays a graceful "service unavailable" message to the caller — the call is never silently dropped, and no Stripe API call is made during this check
  2. A call arriving for a tenant with calls_used >= calls_limit plays a graceful "call volume limit reached" message — the tenant's callers are not left with silence or an error
  3. The billing dashboard page at /dashboard/more/billing shows the current plan name, calls_used / calls_limit as a usage meter, the next renewal date or trial end date, and a link to Stripe Customer Portal
  4. The trial countdown banner is visible on every dashboard page and shows the correct number of days remaining — clicking the upgrade CTA opens Stripe Checkout for the selected plan
  5. A tenant visiting /billing/upgrade sees a plan comparison with Stripe Checkout links, selects a plan, completes Checkout with a test card, and is redirected back to the dashboard with their subscription now active
**Plans:** 3/3 plans complete
Plans:
- [x] 25-01-PLAN.md — Enforcement gate in handleInbound + billing API routes
- [x] 25-02-PLAN.md — Billing dashboard page, usage ring gauge, trial countdown banner, More menu entry
- [x] 25-03-PLAN.md — Upgrade/paywall page with plan cards and Stripe Checkout
**UI hint**: yes

### Phase 26: Billing Documentation
**Goal**: The complete billing and payment architecture is captured in a skill file that gives any developer or AI full context for the Stripe integration, DB tables, webhook handling, enforcement logic, and subscription lifecycle — and CLAUDE.md enforces that this skill file stays in sync with code changes
**Depends on**: Phase 25 (all billing code must exist before it can be documented accurately)
**Requirements**: BILLDOC-01, BILLDOC-02
**Success Criteria** (what must be TRUE):
  1. Reading the billing-payment skill file alone gives enough context to understand the full Stripe integration — DB schema, webhook handler design, enforcement gate placement, subscription lifecycle state machine, and UI integration points — without needing to read source files
  2. CLAUDE.md lists billing-payment in the architecture skill files section with the same sync requirement as the other 6 skills — any future code change to the billing system triggers a skill file update
**Plans**: TBD

### Phase 27: Country-Aware Onboarding and Number Provisioning
**Goal**: The onboarding wizard collects user name, personal phone number, and country (Singapore/US/Canada) — country determines phone number provisioning strategy: Singapore assigns from a pre-purchased inventory table (limited slots with availability checking), US/Canada provisions dynamically via Retell API. The test call step is removed from the wizard, shortening it from 6 to 5 visible steps. Provisioning happens after checkout success, not during onboarding steps.
**Depends on**: Phase 22 (billing foundation must be complete — Stripe checkout flow and subscriptions table required)
**Requirements**: COUNTRY-01, COUNTRY-02, COUNTRY-03, COUNTRY-04, COUNTRY-05, COUNTRY-06, COUNTRY-07
**Success Criteria** (what must be TRUE):
  1. A new user completing onboarding enters their name, personal phone number, and selects a country (SG/US/CA) — all three fields are saved to the tenants table
  2. A Singapore user is assigned a phone number from the phone_inventory table after checkout — the number's status changes from 'available' to 'assigned' and the assigned_tenant_id is set
  3. When all Singapore numbers are assigned (none with status 'available'), a new SG user sees a waitlist UI and cannot proceed with onboarding
  4. A US or Canada user gets a phone number provisioned dynamically via Retell API after checkout success
  5. The wizard shows 5 steps (Profile, Services, Your Details, Plan Selection, Checkout Success) — test call step is removed from the wizard flow
**Plans:** 1/1 plans complete
Plans:
- [x] 27-01-PLAN.md — DB migration (phone_inventory, waitlist, tenants columns, assign_sg_number RPC) + SG availability and waitlist APIs
- [x] 27-02-PLAN.md — "Your Details" step (name, phone, country) + layout update + sms-confirm extension
- [x] 27-03-PLAN.md — Stripe webhook provisioning (SG inventory + US/CA Retell) + onboarding-flow skill update
**UI hint**: yes

### Phase 28: Admin Dashboard
**Goal**: A separate admin interface with its own authentication allows administrators to manage the Singapore phone number inventory (add/remove/view numbers and their assignment status) and view all tenant users with their country, assigned number, and subscription status
**Depends on**: Phase 27 (phone_inventory table and country-aware provisioning must exist before admin can manage them)
**Requirements**: [SC-1, SC-2, SC-3, SC-4, SC-5]
**Success Criteria** (what must be TRUE):
  1. An admin can log in via a separate admin authentication flow (distinct from tenant user auth) and access the admin dashboard
  2. An admin can add a new Singapore phone number to the inventory — it appears with status 'available' and can be assigned during onboarding
  3. An admin can view all phone numbers with their status (available/assigned/retired) and which tenant each assigned number belongs to
  4. An admin can view all tenant users with their name, country, assigned phone number, and subscription status
  5. A non-admin user cannot access any admin routes — they are redirected or shown a 403 error
**Plans**: 3 plans
Plans:
- [x] 28-01-PLAN.md — Foundation: admin_users migration, middleware gate, verifyAdmin helper, deps
- [ ] 28-02-PLAN.md — Admin layout + phone inventory management page (CRUD + bulk CSV)
- [ ] 28-03-PLAN.md — Tenant overview page + impersonation banner
**UI hint**: yes

### Phase 29: Hero Section Interactive Demo
**Goal**: Replace the hero section CTA buttons with a business name input and AI voice demo player — visitor enters their business name, clicks "Listen to Your Demo", and hears a pre-built AI receptionist script with their business name dynamically spliced in via TTS, demonstrating the product's value before signup
**Depends on**: Phase 21 (pricing page redesign must be complete; hero section exists in current form)
**Requirements**: [DEMO-01, DEMO-02, DEMO-03, DEMO-04, DEMO-05]
**Success Criteria** (what must be TRUE):
  1. A visitor sees a business name input field in the hero section instead of the current CTA buttons
  2. After entering a business name and clicking "Listen to Your Demo", an audio player appears replacing the input bar
  3. The audio plays a scripted conversation between an AI receptionist and a caller, with the visitor's business name dynamically inserted
  4. The main hero title is shorter than the current version and the rotating text component adjusts its width responsively to match the cycling word length
  5. The demo audio loads and begins playing within 3 seconds of the button click
**Plans**: 4 plans
Plans:
- [x] 29-01-PLAN.md — RotatingText dynamic width + hero copy update
- [x] 29-02-PLAN.md — ElevenLabs TTS API route + pre-render static audio segments
- [x] 29-03-PLAN.md — HeroDemoInput + HeroDemoPlayer client components
- [x] 29-04-PLAN.md — Wire components into HeroSection + skill file update + visual verification
**UI hint**: yes

## v3.0 Progress

**Execution Order:**
Phases execute in order: 22 -> 23 -> 24 -> 25 -> 26 -> 27 -> 28
(Note: Phase 24 lifecycle notifications and Phase 25 billing dashboard read path can be partially parallelized, but the enforcement gate in Phase 25 must not open until Phase 24 grace period logic is complete. Phase 27 depends on Phase 22 billing foundation. Phase 28 depends on Phase 27 phone inventory.)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 22. Billing Foundation | 3/3 | Complete | 2026-03-26 |
| 23. Usage Tracking | 1/1 | Complete    | 2026-03-26 |
| 24. Subscription Lifecycle and Notifications | 3/3 | Complete    | 2026-03-26 |
| 25. Enforcement Gate and Billing Dashboard | 3/3 | Complete    | 2026-03-31 |
| 26. Billing Documentation | 0/TBD | Not started | - |
| 27. Country-Aware Onboarding and Number Provisioning | 3/3 | Complete   | 2026-03-26 |
| 28. Admin Dashboard | 1/3 | Complete    | 2026-03-26 |
| 29. Hero Section Interactive Demo | 4/4 | Complete   | 2026-03-26 |

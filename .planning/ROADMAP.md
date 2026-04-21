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
**Requirements**: VOICE-SEL-01 through VOICE-SEL-08
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

## Milestone v6.0 Phases

**Milestone:** v6.0 — Integrations & Focus
**Goal:** Refocus Voco on the Call System by extracting the internal invoicing system into an optional toggleable feature, and add native Jobber (GraphQL) and Xero (REST) integrations that provide the AI with real-time customer context — outstanding balances, job history, past visits — to make collections and booking conversations materially smarter without Voco acting as the primary accounting engine.
**Phase range:** 52-58, 60-62 (10 phases; 60-62 are voice-intake polish added at milestone tail — see below)
**Requirements:** ~20 v6.0 requirements (TOGGLE-01-04, JOBBER-01-05, XERO-01-04, JOBSCHED-01-03, CTX-01-03, CHECKLIST-01-02, RENAME-01-03) + voice-intake-polish decisions D-* in 60/61/62 CONTEXT files

### v6.0 Phase Checklist

- [x] **Phase 52: Rename Leads tab to Jobs and restructure status pills** — 5 plans planned 2026-04-16; pure frontend reframe of `/dashboard/leads` to `/dashboard/jobs` (308 redirect for back-compat) to match home-service mental model; status pill restructure (New, Scheduled, Completed, Paid, Lost) with Lost gap; LeadFlyout / LeadCard / LeadFilterBar / EmptyStateLeads / HotLeadsTile / Sidebar / BottomTabBar / DashboardTour / search route / notification email / chatbot-knowledge corpus all reframed; dashboard-crm-system skill updated; no DB/API/agent/component-file-name changes
 (completed 2026-04-16)
- [x] **Phase 53: Feature flag infrastructure + invoicing toggle** — `tenants.features_enabled` JSONB (default `{invoicing: false}` for ALL tenants since dev-phase), gate routes `/dashboard/invoices`, `/dashboard/estimates`, `/dashboard/more/invoice-settings`, `/api/invoices/**`, `/api/estimates/**`, `/api/cron/invoice-reminders`, `/api/cron/recurring-invoices` behind the flag; conditionally hide Invoices nav, BottomTabBar, LeadFlyout CTAs; settings panel toggle; cron-job tenant skip guards
 (completed 2026-04-17)
- [x] **Phase 54: Integration credentials foundation + Next.js 16 caching prep + sandbox provisioning** — extend `accounting_credentials.provider` CHECK to include `'jobber'`; new `src/lib/integrations/` shared module (types, credentials, HMAC OAuth state); enable `cacheComponents: true` in next.config.js; route scaffolding for `/api/integrations/[provider]/{auth,callback}`, `/api/integrations/{disconnect,status}`; user provisions Jobber + Xero dev/sandbox accounts
 (completed 2026-04-16)
- [x] **Phase 55: Xero read-side integration (caller context)** — Xero OAuth via existing xero-node SDK, `fetchCustomerByPhone(tenantId, phone)` returning contact + outstandingBalance + lastInvoices, "use cache" with 5-min TTL + `revalidateTag`, `/api/webhooks/xero` for invoice change invalidation, AccountingConnectionCard in `/dashboard/more/integrations`, setup checklist `connect_xero` item, livekit_agent `src/integrations/xero.py` + `_run_db_queries` parallel fetch + `customer_context` prompt section + `check_customer_account` tool (completed 2026-04-18)
- [x] **Phase 56: Jobber read-side integration (customer context: clients, jobs, invoices)** — Jobber OAuth + GraphQL via `graphql-request`, `fetchCustomerByPhone` returning client + recentJobs + outstandingInvoices, same caching/webhook/tool pattern as Xero; livekit_agent `src/integrations/jobber.py` + unified `customer_context` (Jobber preferred over Xero for home-services); setup checklist `connect_jobber` item (completed 2026-04-18)
- [x] **Phase 57: Jobber schedule mirror (read-only) + Voco-as-overlay UX** (completed 2026-04-19, UAT verified 2026-04-20: 11 passed / 1 skipped / 0 issues) — Mirror Jobber visits into `calendar_events` so `check_availability` stays a single query across Google + Outlook + Jobber (zero call-path latency). Three architectural angles beyond raw sync: (a) **Bookable-user subset** — mirror only visits assigned to a per-tenant opt-in set of Jobber users (mirrors Jobber's own "bookable team members" pattern; avoids over-blocking multi-user accounts where office/seasonal staff shouldn't count toward availability); connect flow shows user list, defaults pre-select users with ≥1 visit in last 30 days, auto-skips picker if only one Jobber user exists. (b) **Thin overlay dashboard calendar** — Voco-booked appointments render first-class and editable; mirrored Jobber visits render muted with "From Jobber" pill, not editable, click-through to Jobber (matches universal convention: Calendly/Acuity/Cal.com/Reclaim). (c) **Interim manual-copy UX** — because Voco→Jobber push is deferred to Phase 999.3, each Voco-only appointment gets a "Not in Jobber yet" badge, copy-to-clipboard action producing a paste-ready block, Jobber new-visit deep link, and email fallback on booking; Voco booking ID preserved so 999.3 push can dedupe anything manually copied during the interim. Extends `calendar_events.provider` CHECK to include `'jobber'`; poll-fallback cron added to `/api/cron/renew-calendar-channels`; agent slot query unchanged. Pre-research: `.planning/phases/56-.../57-PRERESEARCH.md`.
- [x] **Phase 58: Setup checklist final wiring + skills + telemetry + UAT + Phase 51 polish absorption** — finalize `connect_jobber`/`connect_xero` checklist completion detection, new skill `integrations-jobber-xero`, update `voice-call-architecture` and `dashboard-crm-system` skills, telemetry on `last_context_fetch_at` + fetch duration + cache hit rate, end-to-end UAT scenarios, absorb Phase 51 polish budget items (empty states, skeletons, focus rings, error retry, async button states) (completed 2026-04-20)
- [x] **Phase 60: Voice prompt polish — name-once rule + single-question address intake framing** — prompt-only pass over `livekit_agent/src/prompt.py`: (a) stop the AI from re-addressing the caller by name during the call (names from many cultures are easy to mispronounce on TTS and repetition amplifies errors) — capture the name early, avoid vocative use, read it back only at booking confirmation; (b) restructure ADDRESS intake around a single "What's the address where you need the service?" opener with outcome-oriented collection rather than the current three-part "postal + street + unit" enumeration; (c) minor structural cleanup aligned to the Gemini 3.1 Flash Live + livekit-plugins-google git-pin 43d3734 constraints (anti-hallucination rules stay near the top with CRITICAL RULE framing; tool-result strings remain state+directive, not speakable English; trim any remaining VAD-redundant "let caller finish" guidance). No DB or API changes; no tool signature changes. Ships independently of 61/62. (completed 2026-04-19)
- [ ] **Phase 61: Google Maps address validation + structured address storage** — add Google Maps Platform integration (Address Validation API preferred; Places API fallback considered during discuss) used as a background validation pass during the booking flow; callers speak the address in whatever form is natural, the agent collects minimum fields, and validation runs in-process to produce a normalized `formatted_address` + `place_id` + `lat`/`lng` + structured components. DB migration adds validated address columns to `appointments` + `leads` (behind backward-compatible `service_address` text column); new `validate_address` internal helper OR pre-validation inside `book_appointment` (picked in discuss). Env vars + rate/cost controls + Sentry on validation failure. Agent behavior: validation result is authoritative for storage, but truth-claim rules per Phase 60 still apply (no speaking "confirmed" until the *booking* tool returns success). Also opens the door to better travel-buffer zone matching once lat/lng is stored.
- [ ] **Phase 62: Jobber write-side — push booked customer + job into connected Jobber** (promoted from backlog 999.3) — when a tenant has Jobber connected and a booking succeeds, create/find the Jobber Client (by phone, reusing the Phase 56 `fetchJobberCustomerByPhone` path for the find-side) and create a Jobber Visit/Request assigned per the Phase 57 bookable-user rules, with the appointment's persisted `voco_booking_id` (JOBSCHED-07) used as the idempotency key so anything manually copy-pasted during the Phase 57 interim period does not duplicate. Fires from the post-call pipeline (`livekit_agent/src/post_call.py`), so it doesn't add call-path latency; OAuth scope audit (write scope may require user reconnect), error/retry strategy, UX for "Voco booked this as a Jobber Visit" pill in the calendar + flyout (replaces the "Not in Jobber yet" badge from Phase 57). Closes the Voco→Jobber loop. Supersedes Phase 999.3 in backlog.

### v6.0 Pre-requisites (user actions)

- Register Jobber dev app at developer.getjobber.com (free, ~10 min) → blocks Phase 56 execution
- Register Xero dev app at developer.xero.com → demo company auto-provisioned → blocks Phase 55 execution

### v6.0 Key Decisions

- Invoicing default OFF for ALL tenants (still in dev — no real users at risk); existing Phase 35 push code stays dormant behind the flag
- Reuse `accounting_credentials` table for Jobber + Xero (extend provider CHECK); no new credentials table
- Read-side only — Voco does NOT push invoices to Jobber/Xero in v6.0; existing Phase 35 push remains gated by invoicing flag
- Jobber schedule mirrored into local `calendar_events` (Option B from architectural advisory) — single Supabase query covers Google + Outlook + Jobber on call path
- Python agent fetches Jobber/Xero directly (service-role Supabase reads creds → direct GraphQL/REST); no Next.js round-trip for context lookup
- Next.js 16 caching scope = dashboard reads only (`cacheComponents: true` + `"use cache"` + `revalidateTag`); call path stays Python-direct
- Phase 51 polish budget absorbed into Phase 58 tail rather than its own phase

### Phase 53: Feature flag infrastructure + invoicing toggle

**Goal:** Gate the Phase 33-35 invoicing system behind a per-tenant feature flag so v6.0 can refocus Voco on the Call System while preserving existing invoicing code for future opt-in. Adds a `tenants.features_enabled` JSONB column defaulting to `{"invoicing": false}` for ALL tenants (safe because v6.0 is still dev — no live users at risk), gates invoice/estimate pages + APIs + crons behind the flag, conditionally hides the Invoices surface (sidebar, BottomTabBar, LeadFlyout CTAs, More menu), and exposes a reversible settings toggle with no data loss.
**Depends on:** None blocking — pure feature-flag layer over existing Phase 33-35 code; must ship before v6.0 phases 54-58 so integration work is isolated from the legacy invoicing surface.
**Requirements**: TOGGLE-01, TOGGLE-02, TOGGLE-03, TOGGLE-04
**Plans:** 8/8 plans complete

Plans:
- [x] 53-01-migration-features-enabled-PLAN.md — Migration 051 + BLOCKING supabase db push (TOGGLE-01)
- [x] 53-02-features-helper-and-provider-PLAN.md — getTenantFeatures helper + FeatureFlagsProvider Context (TOGGLE-01/02/03)
- [x] 53-03-proxy-gate-and-layout-split-PLAN.md — Proxy page gate + Server/Client layout split (TOGGLE-02)
- [x] 53-04-api-gates-PLAN.md — 17 API route files: early-return 404 when invoicing=false (TOGGLE-02)
- [x] 53-05-cron-tenant-filter-PLAN.md — invoice-reminders + recurring-invoices crons skip flagged-off tenants (TOGGLE-02/04)
- [x] 53-06-ui-hide-layer-PLAN.md — DashboardSidebar + LeadFlyout + More page conditional render (TOGGLE-03)
- [x] 53-07-features-panel-and-toggle-PLAN.md — /dashboard/more/features panel + PATCH route + flip-off dialog (TOGGLE-04)
- [x] 53-08-skill-docs-update-PLAN.md — auth-database-multitenancy + dashboard-crm-system skills updated (TOGGLE-01/02/03/04)

### Phase 54: Integration credentials foundation + Next.js 16 caching prep + sandbox provisioning

**Goal:** Lay the plumbing that Phases 55-58 build on — migrate Xero into a new `src/lib/integrations/` shared module with a provider-agnostic adapter interface, delete QuickBooks + FreshBooks outright, extend the `accounting_credentials` schema (`scopes TEXT[]`, `last_context_fetch_at TIMESTAMPTZ`, provider CHECK = `('xero','jobber')`), scaffold canonical OAuth routes at `/api/integrations/**` (deleting the legacy `/api/accounting/**` equivalents), flip Next.js 16 `cacheComponents: true` and audit the dashboard Server Components, prove the `'use cache'` + `cacheTag` + `revalidateTag` loop with a real `getIntegrationStatus(tenantId)` reader, and rewrite `/dashboard/more/integrations` to the owner-facing "Business Integrations" page (provider-first cards, single-button unified-scope OAuth per provider, status-line copy reflecting invoicing flag state).
**Depends on:** Phase 53 (invoicing feature-flag already isolates legacy `/api/accounting/**` surface — Phase 54 sidesteps that gate by using new `/api/integrations/**` paths).
**Requirements**: INTFOUND-01, INTFOUND-02, INTFOUND-03
**Pre-requisite user actions:** Register Xero + Jobber dev/sandbox apps (blocks Phase 55/56 execution, not Phase 54 merge); update Xero dev-console redirect URI to `/api/integrations/xero/callback` before merge (no live tenants at risk — dev only).
**Plans:** 5/5 plans complete

Plans:
- [x] 54-01-migration-integrations-schema-PLAN.md — Migration 051 (CHECK swap + scopes + last_context_fetch_at) + BLOCKING supabase db push (INTFOUND-02)
- [x] 54-02-lib-integrations-module-PLAN.md — src/lib/integrations/ module (types, adapter, xero with granular scopes, jobber stub, status with 'use cache') + QB/FB deletion + .env.example (INTFOUND-01, INTFOUND-03)
- [x] 54-03-api-integrations-routes-PLAN.md — /api/integrations/{auth,callback,disconnect,status} route handlers with revalidateTag + pre-merge redirect URI checkpoint (INTFOUND-01)
- [x] 54-04-cache-components-enable-PLAN.md — next.config.js cacheComponents: true + build smoke test + 'use cache' loop smoke test (INTFOUND-03)
- [x] 54-05-business-integrations-frontend-PLAN.md — Business Integrations page (Server Component Pattern A) + BusinessIntegrationsClient + skill updates + human UI verify (INTFOUND-01)

### Phase 55: Xero read-side integration (caller context)

**Goal:** Wire Xero as the first live integration on the Phase 54 foundation so the AI can speak knowledgeably about a caller's account during inbound calls. Add Xero OAuth via the existing `xero-node` SDK (tokens stored in `accounting_credentials` with `provider='xero'` and a refresh-aware token getter), a `fetchCustomerByPhone(tenantId, phone)` reader that returns `{ contact, outstandingBalance, lastInvoices, lastPaymentDate }` behind the `'use cache'` + `cacheTag` + `revalidateTag` loop with a 5-min TTL and <500ms p95, `/api/webhooks/xero` for invoice/payment invalidation, an AccountingConnectionCard wired into the Phase 54 "Business Integrations" page, a `connect_xero` item on the setup checklist, and on the Python side `livekit_agent/src/integrations/xero.py` + `_run_db_queries` parallel fetch + a `customer_context` section in the agent system prompt + a `check_customer_account()` tool.
**Depends on:** Phase 53 (invoicing flag must exist so the Xero card status copy can reflect the invoicing-off state) and Phase 54 (integrations foundation — `accounting_credentials.provider='xero'`, `src/lib/integrations/` adapter, `/api/integrations/**` OAuth routes, `cacheComponents: true`, Business Integrations page shell).
**Requirements**: XERO-01, XERO-02, XERO-03, XERO-04
**Pre-requisite user actions:** Register Xero dev app at developer.xero.com and set redirect URI to `/api/integrations/xero/callback` (blocks execution, not planning).
**Plans:** 9/8 plans complete

Plans:
- [x] 55-01-PLAN.md — Migration 053 error_state column + .env.example XERO_WEBHOOK_KEY + [BLOCKING] schema push
- [x] 55-02-PLAN.md — Next.js XeroAdapter.fetchCustomerByPhone + 'use cache' + two-tier cacheTag + tests
- [x] 55-03-PLAN.md — OAuth wire-up: callback heals error_state + revalidates xero-context; disconnect revokes + invalidates
- [x] 55-04-PLAN.md — /api/webhooks/xero (HMAC-SHA256 + intent-verify handshake + invoice→phone resolution + per-phone revalidateTag)
- [x] 55-05-PLAN.md — BusinessIntegrationsClient Reconnect banner + last-synced timestamp + connect_xero checklist + XeroReconnectEmail + notifyXeroRefreshFailure + visual UAT
- [x] 55-06-PLAN.md — [CROSS-REPO livekit-agent] integrations/xero.py refresh-aware fetch + agent.py 4th parallel task with 800ms timeout
- [x] 55-07-PLAN.md — [CROSS-REPO livekit-agent] prompt.py customer_context block (CRITICAL RULE) + check_customer_account tool + agent wiring + E2E call UAT
- [x] 55-08-PLAN.md — Skill sync (voice-call-architecture, auth-database-multitenancy, dashboard-crm-system) + ROADMAP/STATE/REQUIREMENTS update

### Phase 56: Jobber read-side integration (customer context: clients, jobs, invoices)

**Goal:** Wire Jobber as the second live integration on the Phase 54 foundation so the AI receptionist has trade-relevant customer context (clients, recent jobs, outstanding invoices) during inbound calls — preferred over Xero for home-service tenants. Add Jobber OAuth (tokens stored in `accounting_credentials` with `provider='jobber'` and refresh-aware token getter), a `fetchCustomerByPhone(tenantId, phone)` reader using Jobber GraphQL via `graphql-request` that returns `{ client, recentJobs, outstandingInvoices, lastVisitDate }` behind the `'use cache'` + `cacheTag` + `revalidateTag` loop with 5-min TTL and <500ms p95, `/api/webhooks/jobber` for client/job/invoice invalidation, the Jobber half of the AccountingConnectionCard on `/dashboard/more/integrations`, a `connect_jobber` item on the setup checklist, and on the Python side `livekit_agent/src/integrations/jobber.py` + extension of `_run_db_queries` to fetch Jobber in parallel with Xero + a unified `customer_context` prompt section (Jobber preferred when both connected) + extension of the `check_customer_account()` tool to merge both providers.
**Depends on:** Phase 54 (integrations foundation — `accounting_credentials.provider='jobber'` CHECK constraint, `src/lib/integrations/` adapter contract, `/api/integrations/[provider]/**` OAuth routes, `cacheComponents: true`, Business Integrations page shell) and Phase 55 (Xero adapter establishes the `IntegrationAdapter` pattern, the `fetchCustomerByPhone` return shape, the webhook invalidation pattern, the agent-side `customer_context` prompt block, and the `check_customer_account` tool that Phase 56 extends).
**Requirements:** JOBBER-01, JOBBER-02, JOBBER-03, JOBBER-04, JOBBER-05
**Pre-requisite user actions:** Register Jobber dev app at developer.getjobber.com (free, ~10 min) and set redirect URI to `/api/integrations/jobber/callback` (blocks execution, not planning).
**Plans:** 7/7 plans complete

Plans:
- [x] 56-01-PLAN.md — Next.js JobberAdapter: real exchangeCode/refreshToken/revoke + module-level fetchJobberCustomerByPhone + 'use cache' + two-tier cacheTag + 5 test files (JOBBER-01, JOBBER-02)
- [x] 56-02-PLAN.md — Migration 054 external_account_id column + backfill + unique index + .env.example webhook-secret overload note + [BLOCKING] supabase db push (JOBBER-01, JOBBER-03)
- [x] 56-03-PLAN.md — /api/webhooks/jobber HMAC-SHA256 verify (key IS JOBBER_CLIENT_SECRET) + 5-event routing + per-phone revalidateTag + broad fallback (JOBBER-03)
- [x] 56-04-PLAN.md — BusinessIntegrationsClient Preferred badge + banner bug-fix + Jobber error state + integrations page data pass + disconnect Jobber branch + connect_jobber checklist + notifyJobberRefreshFailure + JobberReconnectEmail (JOBBER-01)
- [x] 56-05-PLAN.md — [CROSS-REPO livekit-agent] src/integrations/jobber.py service-role Supabase read + httpx Jobber GraphQL + refresh-token rotation write-back + pytest (JOBBER-02, JOBBER-04)
- [x] 56-06-PLAN.md — [CROSS-REPO livekit-agent] src/lib/customer_context.py merge helper + agent.py 5th parallel task + prompt.py source annotations + check_customer_account extension + pytest (JOBBER-04, JOBBER-05)
- [x] 56-07-PLAN.md — Skill sync (voice-call-architecture, auth-database-multitenancy, dashboard-crm-system) (JOBBER-01..05)

### Phase 57: Jobber schedule mirror (read-only) + Voco-as-overlay UX

**Goal:** Mirror Jobber visits into the existing `calendar_events` table so the AI's `check_availability` tool stays a single query across Google + Outlook + Jobber (zero added call-path latency), and introduce the Voco-as-overlay dashboard UX that respects Jobber as the source of truth until bidirectional push ships in Phase 999.3. Three architectural angles land together: (a) **bookable-user subset** — mirror only visits whose assignees intersect a per-tenant opt-in set of Jobber users (mirrors Jobber's own "bookable team members" pattern; avoids over-blocking multi-user accounts where office/seasonal staff shouldn't count toward availability); connect flow pulls users from Jobber, pre-selects users with ≥1 visit in the last 30 days, auto-skips if only one user exists, settings panel allows later edits and re-sync. (b) **Thin-overlay dashboard calendar** — Voco-booked appointments render first-class and editable; mirrored Jobber visits render muted with a "From Jobber" pill, not editable, click-through to the Jobber visit (matches Calendly/Acuity/Cal.com/Reclaim universal convention); same muted treatment applied consistently to existing Google/Outlook external events. (c) **Interim manual-copy UX** — because Voco→Jobber push is deferred to Phase 999.3, each Voco-only appointment gets a "Not in Jobber yet" badge, copy-to-clipboard action producing a paste-ready block (client/address/start/duration/notes), Jobber new-visit deep link, and an email fallback on booking with the same copy block; Voco booking ID (UUID) persisted on the appointment row as the idempotency key so 999.3 push can dedupe anything manually copied during the interim. Extends `calendar_events.provider` CHECK to include `'jobber'`; poll-fallback cron added to `/api/cron/renew-calendar-channels` for missed webhooks + subscription renewal; agent slot query unchanged.
**Depends on:** Phase 56 (Jobber OAuth, `accounting_credentials.provider='jobber'`, `JobberAdapter` contract, `/api/webhooks/jobber` HMAC handler, `fetchCustomerByPhone` pattern — Phase 57 extends the same adapter with schedule-side reads and the same webhook endpoint with visit/job/assignment events).
**Requirements:** JOBSCHED-01, JOBSCHED-02, JOBSCHED-03, JOBSCHED-04, JOBSCHED-05, JOBSCHED-06, JOBSCHED-07
**Pre-requisite user actions:** None beyond Phase 56 (same Jobber dev app + OAuth scopes cover visit reads and webhook events).
**Pre-research:** `.planning/phases/56-jobber-read-side-integration-customer-context-clients-jobs-invoices/57-PRERESEARCH.md` (answers bookable-user subset, overlay UX, and interim copy-flow open questions before discuss/planning).
**Plans:** 5/5 plans complete
- [x] 57-01-PLAN.md — Migration 055 (CHECK widen, bookable_user_ids, jobber_visit_id, partial unique index) + vercel.json cron schedule
- [x] 57-02-PLAN.md — Visit mapper + Jobber visits/users GraphQL fetchers + rebuildJobberMirror helper
- [x] 57-03-PLAN.md — Webhook extension for VISIT_*/ASSIGNMENT_*/JOB_UPDATE mirror routing
- [x] 57-04-PLAN.md — Poll cron + bookable-users API + resync endpoint + setup page + picker component
- [x] 57-05-PLAN.md — Calendar overlay retrofit + Not-in-Jobber pills + banner + flyout copy section + booking email + integrations card picker

### Phase 58: Setup checklist final wiring + skills + telemetry + UAT + Phase 51 polish absorption

**Goal:** Close out the v6.0 Jobber/Xero integration surface and ship the deferred v5.0 polish budget in one coordinated phase. Three concerns share the phase because they all land on the same dashboard pages and touch the same skill files: (a) **Setup checklist wiring** — make `connect_jobber` and `connect_xero` first-class items in the post-onboarding setup checklist (`/api/setup-checklist`) with completion auto-detected via `accounting_credentials` row presence; place the connection cards in `/dashboard/more/integrations` following the existing `CalendarSyncCard` pattern so the visual/interaction surface stays consistent across Google, Outlook, Jobber, and Xero. (b) **Telemetry + skill documentation** — instrument the integration read path with `last_context_fetch_at` on `accounting_credentials` plus lightweight `activity_log` rows capturing fetch duration and cache-hit/miss per tenant per provider, so we can validate the "parallel phone-based lookups fit the call-setup latency budget" assumption from v6.0 STATE; write a new skill file `integrations-jobber-xero` documenting OAuth flow, refresh logic, caching (Next.js 16 `"use cache"` + `revalidateTag`), agent-side injection via the Python adapter path, checklist entries, and webhook invalidation; update `voice-call-architecture` and `dashboard-crm-system` skills to cross-reference the new file; add the new skill to `CLAUDE.md`. (c) **End-to-end UAT + Phase 51 polish absorption** — run the full cross-provider UAT matrix (connect/disconnect/reconnect/token-refresh-failure for Jobber + Xero; caller-context fetch timing under real call flow; webhook invalidation hit/miss; checklist completion detection) and absorb the five deferred v5.0 polish items into the dashboard surfaces touched by v6.0 work: empty states (POLISH-01), loading skeletons (POLISH-02), focus rings (POLISH-03), inline error+retry (POLISH-04), async button pending states (POLISH-05).

**Why now:** Closes the v6.0 milestone. Phases 54-57 built the integration plumbing; Phase 58 productionizes it (checklist detection, telemetry to validate the call-path latency budget, skill documentation so future phases don't have to re-derive the integration contract) and reclaims the v5.0 polish debt that was explicitly deferred here per the v6.0 plan ("Phase 51 polish budget absorbed into Phase 58 tail rather than its own phase"). The polish items all hit dashboard pages that v6.0 already rewrote (integrations card, settings panels, leads/calls/calendar empty states touched by the Jobs-tab rename), so bundling saves a second design pass.

**Scope boundary:** No schema changes beyond a possible `accounting_credentials.last_context_fetch_at` column (confirm during discuss whether it exists yet or needs a migration). No changes to Python agent behavior — telemetry is recorded from the Next.js caching layer + webhook handler, not the livekit agent hot path. Polish items apply only to pages where a deferred POLISH-NN is explicitly listed; no broader refactor. Phase 999.x items stay in the backlog.

**Depends on:** Phase 57 (Jobber schedule mirror — UAT matrix needs the overlay UX working) and implicitly Phases 55-56 (Jobber/Xero read-side + caching). Must run after 57 completes because the checklist wiring and "From Jobber" overlay UAT both depend on 57-05 (Calendar overlay retrofit). Orthogonal to Phase 60-62 (prompt + address-validation work — those touch the agent, not the dashboard).

**Requirements:** CHECKLIST-01, CHECKLIST-02, CTX-01, CTX-02, CTX-03, POLISH-01, POLISH-02, POLISH-03, POLISH-04, POLISH-05

**Plans:** 7/7 plans complete

Plans:
- [x] 58-01-PLAN.md — Wave 0 test scaffolds + UAT + TELEMETRY-REPORT skeletons (nyquist)
- [x] 58-02-PLAN.md — Checklist wiring + red-dot variant (CHECKLIST-01, CHECKLIST-02)
- [x] 58-03-PLAN.md — Python telemetry instrumentation + Jobber last-synced (CTX-01)
- [x] 58-04-PLAN.md — Polish primitives (EmptyState/ErrorState/AsyncButton) + focus-visible token (POLISH-01/03/04/05)
- [x] 58-05-PLAN.md — 7-page polish sweep + BusinessIntegrationsClient AsyncButton migration
- [x] 58-06-PLAN.md — integrations-jobber-xero skill + voice-call / dashboard-crm rewrites + CLAUDE.md (CTX-02, CTX-03)
- [x] 58-07-PLAN.md — UAT execution + TELEMETRY-REPORT fill-in + refresh error_state tests (ship gate)

### Phase 60: Voice prompt polish — name-once rule + single-question address intake framing

**Goal:** Tighten the Gemini 3.1 Flash Live receptionist's conversational behavior on two specific points without any DB, API, or tool-signature changes: (1) stop the AI from re-addressing the caller by name throughout the call (the name is captured early, but because many callers have culturally diverse names that TTS mispronounces, repeated vocative use amplifies the error and erodes trust) — the AI should note the name silently and only read it back once at booking confirmation; (2) reframe ADDRESS intake from the current three-part "postal/zip + street + unit" enumeration into a single natural opener ("What's the address where you need the service?") with outcome-oriented collection that adapts to whatever structure the caller volunteers. Alongside these two primary changes, absorb a structural pass aligned to the pinned model/SDK realities: keep anti-hallucination CRITICAL RULE framing near the top of the prompt (long-context audio attention drops toward the end), keep tool-result strings state+directive (never speakable English that invites the parrot loop), trim any VAD-redundant "let caller finish" guidance that Gemini's server VAD already handles, and preserve persona (professional / friendly / local_expert) as guardrails-not-scripts.

**Why now:** Two specific owner-reported call-quality issues surfaced during the Phase 57 UAT flow and in live Railway calls — the repeated-name behavior especially is visible across every call. Both are pure prompt-surface problems (the SDK cannot force tool calls per turn; the prompt is the only enforcement surface for these classes of claims).

**Scope boundary:** Prompt file only — `livekit_agent/src/prompt.py` + optionally `messages/en.json` / `messages/es.json` templated strings. No changes to `agent.py`, tool signatures, DB schema, or Next.js surface. Ships independently; 61 and 62 do not depend on it.

**Depends on:** None blocking. Prompt-only change; orthogonal to Phase 57 and Phase 58.
**Requirements:** Captured as decisions (D-*) in `60-CONTEXT.md` during discuss (no REQ-IDs in REQUIREMENTS.md — CONTEXT decisions serve as the requirement set, same pattern as Phase 59).
**Plans:** 3/3 plans complete

Plans:
- [x] 60-01-PLAN.md — Wave 0 prereqs (cross-repo access, UAT personas, Sentry playbook) + prompt.py edits for name-vocative suppression (D-01..D-05), single-question address intake (D-06..D-08), booking readback + corrections (D-02, D-09, D-10), and D-15 light structural audit
- [x] 60-02-PLAN.md — Tool-return rewrites to STATE+DIRECTIVE format across all 5 tools (D-16) + capture_lead description single-question-intake parity with book_appointment (D-11, D-12)
- [x] 60-03-PLAN.md — Spanish mirror of D-01..D-12 in es.json / prompt.py locale='es' path (D-13), user-review gate (D-14), and voice-call-architecture/SKILL.md sync per CLAUDE.md

### Phase 61: Google Maps address validation + structured address storage

**Goal:** Replace the current "speak it, store the verbatim string" address flow with a background-validated, structured address capture. Caller speaks the address naturally; the agent extracts minimum fields during the normal info-gathering turn; a new `validate_address` helper (or integrated pre-check inside `book_appointment`) calls the Google Maps Platform Address Validation API in-process, returning a normalized `formatted_address`, `place_id`, `lat`/`lng`, and structured components. The normalized values land in `appointments` + `leads` alongside the existing `service_address` text column (kept for backward compatibility with the calendar UI, SMS templates, and Jobber push). Anti-hallucination rules from Phase 60 still govern speech: the agent may speak the address back to the caller for confirmation, but only actual tool-returned values are authoritative.

**Secondary benefit:** Storing `lat`/`lng` enables materially better travel-buffer zone matching in Phase 3's `calculate_available_slots` downstream (current matching is postal-code-based and misses geographically adjacent postal codes).

**Why now:** Directly enables the booking behavior improvement the user requested ("AI asks for the address, validates against Google Maps API in the background, then writes the confirmed structured record to the CRM and Jobber"). It's also the structural precondition for Phase 62's Jobber write-side, which benefits hugely from a normalized address (Jobber Client.properties expects structured fields, not a single freeform string).

**Scope boundary:** New Google Maps integration (env vars, client module, rate/cost controls, Sentry on failure); DB migration adding validated-address columns to `appointments` + `leads` (nullable; populated when validation succeeds); livekit_agent tool/prompt updates; optionally a tiny Next.js-side reader if the dashboard should surface the validated address. Geocoding strategy (Address Validation API vs. Places API vs. Geocoding API) picked during discuss.

**Depends on:** Phase 60 (the name-once + single-question framing is the conversational substrate this address flow sits on top of). Does not depend on Phase 62; can merge independently.
**Requirements:** Captured as decisions in `61-CONTEXT.md`.
**Pre-requisite user actions:** Create a Google Cloud project, enable the Address Validation API (and any backup APIs chosen during discuss), provision an API key restricted to the Railway + Vercel IP ranges, and fund the billing account (the Address Validation API is not free-tier; budget guardrails belong in discuss).
**Plans:** TBD (likely 3-4 plans: DB migration + GMaps client + livekit tool wiring + tests/UAT)

Plans:
- [ ] 61-XX-PLAN.md — TBD (generated after discuss + plan-phase)

### Phase 62: Jobber write-side — push booked customer + job into connected Jobber (promoted from Phase 999.3)

**Goal:** Close the Voco→Jobber loop. When a tenant has Jobber connected and a booking succeeds, the post-call pipeline (`livekit_agent/src/post_call.py`) creates or finds the Jobber Client (using the Phase 56 `fetchJobberCustomerByPhone` path for the find-side — no duplicate clients by phone), then creates a Jobber Visit/Request assigned per the Phase 57 `bookable_user_ids` opt-in subset, with the appointment's persisted `voco_booking_id` (JOBSCHED-07) used as the idempotency key so anything a tenant manually copy-pasted into Jobber during the Phase 57 interim period does not duplicate. On push success, the dashboard's "Not in Jobber yet" badge from Phase 57 flips to "In Jobber" with a click-through to the Jobber visit; on push failure (token expired, scope missing, network), the appointment stays in the interim copy-paste UX state with the existing email-fallback path and a Sentry flag.

**Why now:** Direct continuation of the user's request ("AI confirms the booking, writes to the CRM and the connected Jobber"). Phase 57 shipped the interim UX explicitly as a bridge to this phase; Phase 999.3 was backlogged pending Phase 57 completion and live-traffic validation of the assignee-selection pattern. With Phase 57 closing out (57-05 is the last pending plan) and the benefit of a structured Jobber-friendly address from Phase 61, this is the right moment to promote from backlog.

**Scope boundary:** Jobber integration extension only — new GraphQL mutations (`clientCreate`, `requestCreate` or `scheduledItemCreate` as chosen during discuss), OAuth scope audit (write scope likely requires user reconnect — UX flow designed in discuss), post-call trigger wiring with idempotency, retry policy, Sentry on failure, and dashboard pill/flyout flip from "Not in Jobber yet" to "In Jobber". No changes to the call-path surface (the push runs post-call, never adds in-call latency).

**Depends on:** Phase 57 (must be shipped — uses `appointments.voco_booking_id` + `tenants.bookable_user_ids`), Phase 61 (recommended — Jobber Client.properties writes cleanly from structured address; without it, push can fall back to freeform `service_address` but Jobber's normalization is weaker).
**Requirements:** Captured as decisions in `62-CONTEXT.md`.
**Pre-requisite user actions:** Confirm the Jobber dev app is configured for the required write scopes (likely `write_clients` + `write_requests`/`write_visits`); may require existing connected tenants to re-consent via the OAuth flow. Validate the assignee-selection pattern with the tenant during discuss.
**Plans:** TBD (likely 4-5 plans: Jobber write module + post-call trigger + dashboard flip + retry/observability + cross-repo UAT)

Plans:
- [ ] 62-XX-PLAN.md — TBD (generated after discuss + plan-phase)

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


## v1.1 Progress

**Execution Order:**
Phases execute in numeric order: 6 -> 7 -> 8 -> 9 -> 10
(Note: Phase 8 and Phase 10 may execute in parallel as they share no implementation dependencies)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 6. Public Marketing Pages | 4/4 | Complete   | 2026-03-22 |
| 7. Unified Signup and Onboarding Wizard | 4/4 | Complete   | 2026-03-22 |
| 8. Outlook Calendar Sync | 3/3 | Complete | 2026-03-26 |
| 10. Dashboard Guided Setup | 4/4 | Complete    | 2026-03-22 |

### v4.0 Phase Checklist

- [x] **Phase 30: Voice Agent Prompt Optimization** - Smart slot preference, repeat caller awareness, trade-specific questioning, post-booking recap (3/3 plans complete)
- [ ] **Phase 31: Voice Call Feature Showcase PDF** - Sales-ready PDF showcasing all voice call features (not yet planned)
- [x] **Phase 32: Landing Page Redesign — Conversion-Optimized Sections** - Hero copy, Features grid, How It Works expansion (2/3 plans, 32-03 visual checkpoint pending)
- [x] **Phase 33: Invoice Core** - Invoice CRUD, PDF generation, email/SMS send, settings, dashboard (completed 2026-03-31)
- [x] **Phase 34: Estimates, Reminders, and Recurring Invoices** - Estimates with tiers, payment log, automated reminders, late fees, recurring invoices (completed 2026-04-01)
- [x] **Phase 35: Invoice Integrations and AI** - QuickBooks/Xero/FreshBooks OAuth sync, AI line item descriptions, batch invoicing (completed 2026-04-02)
- [x] **Phase 36: Landing Page Section Redesign** - How It Works scroll steps, Features horizontal carousel (completed 2026-03-28)
- [x] **Phase 37: Dashboard AI Chatbot Assistant** - In-dashboard AI chatbot with RAG knowledge base that answers business owner questions about dashboard features and usage (completed 2026-04-03)
- [x] **Phase 38: Programmatic SEO and Content Engine** - Sitemap, robots, OG image generation, data-driven page templates (blog, personas, comparisons, integrations, glossary), JSON-LD schema markup, and internal linking hub architecture (7 plans) (completed 2026-04-06)
- [x] **Phase 39: Call Routing Webhook Foundation** - FastAPI webhook service on Railway, Twilio signature verification, schedule evaluator, outbound cap, 4 POST endpoints (completed 2026-04-10)
- [x] **Phase 40: Call Routing Provisioning Cutover** - Wire live schedule/cap composition, dial-status writeback, SMS forwarding, Twilio number reconfiguration
 (completed 2026-04-10)
- [x] **Phase 41: Call Routing Dashboard and Launch** - Dashboard UI for call forwarding schedule, pickup numbers, dial timeout (completed 2026-04-11)
- [ ] **Phase 42: Calendar Essentials — Time Blocks and Mark Complete** - Manual time blocks, mark-complete workflow, appointment flyout
- [ ] **Phase 43: Recurring Appointments — Maintenance Contracts** - Weekly/monthly/quarterly recurring appointments with daily materialization cron
- [x] **Phase 44: AI Voice Selection** - Voice picker UI with 6 Gemini voices, audio previews, tenant persistence, agent voice override (completed 2026-04-10)
- [ ] **Phase 45: In-Browser Voice Test** - Direct Gemini Live API WebSocket voice test in dashboard, sandbox mode, same system prompt

### Phase 38: Programmatic SEO and Content Engine

**Goal:** Build a complete programmatic SEO infrastructure — sitemap, robots, dynamic OG images, a static data layer powering five page template types (blog, personas, comparisons, integrations, glossary), JSON-LD structured data, and hub-and-spoke internal linking — so every page is crawlable, rich-snippet ready, and drives organic traffic to signup
**Depends on:** None (standalone, builds on existing public site layout)
**Requirements**: SEO-01 (sitemap + robots), SEO-02 (dynamic OG images), SEO-03 (data layer), SEO-04 (blog pages), SEO-05 (persona pages), SEO-06 (comparison pages), SEO-07 (integration pages), SEO-08 (glossary pages), SEO-09 (JSON-LD schema markup), SEO-10 (generateMetadata on all pages), SEO-11 (internal linking hubs)
**Success Criteria** (what must be TRUE):
  1. `src/app/sitemap.js` returns all static and dynamic routes; `src/app/robots.js` allows crawling and points to sitemap
  2. `/og?title=...&type=...` returns a valid branded OG image for any page type
  3. `generateStaticParams()` on every dynamic route generates pages from the data layer arrays — build produces all expected HTML files
  4. Every dynamic page uses `generateMetadata()` with title template `{PageName} | Voco`, description, canonical URL, and OG image — all using `await params` (Next.js 16 requirement)
  5. JSON-LD `<script type="application/ld+json">` renders correct schema (LocalBusiness, FAQPage, WebPage, SoftwareApplication) per page type
  6. Every programmatic page links to its hub, sibling pages, and a signup CTA — no orphan pages exist
  7. Blog listing at `/blog` and detail at `/blog/[slug]` render correctly with at least 2-3 seed posts
  8. Persona pages at `/for/[persona]` render trade-specific copy, pain points, and CTAs for at least 4 trades
  9. Comparison pages at `/compare/[comparison]` render pros/cons and verdict for at least 3 comparisons
  10. Integration pages at `/integrations/[tool]` render tool descriptions and use cases for at least 4 tools
  11. Glossary pages at `/glossary/[term]` render definitions with FAQ schema markup
**Plans**: 7 plans

Plans:
- [x] 38-01-PLAN.md — Data layer arrays, SchemaMarkup component, OG image route, sitemap, robots, Wave 0 tests
- [x] 38-02-PLAN.md — Blog hub + detail, Glossary hub + detail pages
- [x] 38-03-PLAN.md — Persona hub + detail, Comparison hub + detail pages
- [x] 38-04-PLAN.md — Integration hub + detail pages
- [x] 38-05-PLAN.md — Footer Resources column + visual verification checkpoint
- [x] 38-06-PLAN.md — Gap closure: add 2 blog posts + 3 personas (HVAC, electrician, handyman)
- [x] 38-07-PLAN.md — Gap closure: add 2 comparisons (vs-answering-service, vs-hire-receptionist) + 3 integrations (outlook-calendar, stripe, twilio)
**UI hint**: yes

### Phase 37: Dashboard AI Chatbot Assistant

**Goal:** Add an AI-powered chatbot assistant to the dashboard that can answer any question a business owner has about using the dashboard — leveraging a custom LLM API with a RAG knowledge base of all dashboard features, navigation, workflows, and terminology
**Depends on:** None (standalone feature)
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06
**Success Criteria** (what must be TRUE):
  1. A business owner can open the AI assistant from any dashboard page and ask questions about how to use the platform
  2. The assistant provides accurate, contextual answers about dashboard features, navigation, and workflows
  3. The UI placement is intuitive and non-obstructive on both desktop and mobile
  4. The assistant uses a RAG knowledge base covering all dashboard functionality
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 37-01-PLAN.md — Knowledge base markdown docs, RAG retrieval function, and Groq chat API route
- [x] 37-02-PLAN.md — Chat UI components (ChatbotSheet, ChatMessage, ChatNavLink, TypingIndicator)
- [x] 37-03-PLAN.md — Integration wiring (layout mount, sidebar trigger, More page trigger, human verification)

### Phase 30: Voice Agent Prompt Optimization

**Goal:** Holistic refinement of the AI receptionist system prompt and supporting tools to maximize booking conversion, improve caller experience, and close behavioral gaps — smart slot preference detection, repeat caller awareness, failed transfer recovery, prompt cleanup, trade-specific questioning, and post-booking recap flow
**Requirements**: PROMPT-01, PROMPT-02, PROMPT-03, PROMPT-04, PROMPT-05, PROMPT-06
**Depends on:** Phase 14
**Plans:** 7/7 plans complete

Plans:
- [x] 30-01-PLAN.md — DB migration + trade templates + check_caller_history webhook handler + handleInbound dynamic variables
- [x] 30-02-PLAN.md — Agent prompt restructure (all 6 decisions) + server.js new tool definition
- [x] 30-03-PLAN.md — Skill file update + prompt quality verification checkpoint

### Phase 31: Voice Call Feature Showcase PDF

**Goal:** Generate a non-technical, sales-ready PDF showcasing all voice call features and capabilities. Output to `docs/` directory. Covers: AI receptionist capabilities, booking flow, triage, transfer, recovery SMS, calendar sync, multi-language support, and all smart features from Phase 30.
**Requirements**: VOICE-SEL-01 through VOICE-SEL-08
**Depends on:** Phase 30
**Plans:** 3 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 31 to break down)

### Phase 32: Landing Page Redesign — Conversion-Optimized Sections

**Goal:** Redesign the landing page hero text, Features section, and How It Works section to be more conversion-focused — attacking direct pain points for home service business owners with clear messaging around 70+ language support, real-time calendar-aware booking, post-call SMS, call analytics, and full integration capabilities. Improve visual clarity and UX appeal across all landing sections.
**Requirements**: D-01 through D-20 (from 32-CONTEXT.md)
**Depends on:** Phase 29
**Plans:** 2/3 plans executed

Plans:
- [x] 32-01-PLAN.md — Hero copy update + HowItWorks 4-step expansion with folder-stack effect
- [x] 32-02-PLAN.md — FeaturesGrid full rewrite: 2-col grid, 70+ Languages hero card, 6 feature cards with micro visuals
- [ ] 32-03-PLAN.md — Page.js skeleton updates, ScrollLinePath verification, visual checkpoint

### Phase 33: Invoice Core

**Goal:** Business owners can generate professional white-labeled invoices from completed jobs, edit typed line items (labor, materials with markup, travel, flat-rate, discount), configure business identity and tax settings, send invoices to customers via email (PDF attachment) and SMS (summary), download PDFs for on-site hand-delivery, and track invoice status through a filterable dashboard — replacing manual revenue entry with a full invoicing workflow. Voco handles invoicing only — no payment processing, no payment links, no online payment collection.
**Depends on:** Phase 20 (Dashboard UX Overhaul — navigation structure)
**Requirements**: D-01 through D-17 (from 33-CONTEXT.md)
**Success Criteria** (what must be TRUE):
  1. An owner creates an invoice from a completed lead with pre-filled customer data, adds typed line items (labor, materials, travel, flat-rate, discount), and sees auto-calculated tax on taxable items
  2. The generated PDF is fully white-labeled — business name, logo, license number, and contact info appear; zero Voco branding, URLs, or references
  3. Sending an invoice delivers an email (Resend) with PDF attachment and an optional SMS (Twilio) summary from the business phone number — both white-labeled
  4. The Invoices tab shows summary cards (Total Outstanding, Overdue, Paid This Month), status filter tabs (All/Draft/Sent/Overdue/Paid), and a sortable invoice table
  5. Marking an invoice as Paid auto-updates the linked lead's revenue_amount and status to Paid; marking a lead as Paid auto-marks the linked invoice — bidirectional sync with no circular updates
  6. Invoice settings page allows configuring business identity (name, logo, address, phone, email, license), tax rate, default terms, invoice prefix, and next number display
**Plans**: 7 plans

Plans:
- [x] 33-01-PLAN.md — Foundation: DB schema, @react-pdf/renderer install, calculation functions + TDD tests
- [x] 33-02-PLAN.md — Invoice Settings: API route + settings page + More menu updates
- [x] 33-03-PLAN.md — Invoice CRUD API + navigation surgery (Invoices replaces Analytics)
- [x] 33-04-PLAN.md — Invoice List UI: summary cards, status filter tabs, invoice table
- [x] 33-05-PLAN.md — Invoice Editor: line item editor with typed fields, totals, lead pre-fill
- [x] 33-06-PLAN.md — PDF generation + invoice detail page with actions
- [x] 33-07-PLAN.md — Email/SMS delivery, bidirectional sync, LeadFlyout integration
**UI hint**: yes

### Phase 34: Estimates, Reminders, and Recurring Invoices

**Goal:** Extend the invoice system with pre-job estimates (optional good/better/best tiers), a simple payment log for partial payments, automated payment reminders on a fixed schedule, auto-calculated late fees, and recurring invoices for maintenance contracts
**Depends on:** Phase 33 (Invoice Core)
**Requirements**: D-01 through D-18 (from 34-CONTEXT.md)
**Success Criteria** (what must be TRUE):
  1. An owner creates an estimate with optional good/better/best tiers, sends it via email/SMS, and converts the approved tier to an invoice with one click
  2. An owner records partial payments against an invoice with amount, date, and note — balance auto-calculates and status becomes "Partially Paid"
  3. Automated payment reminders fire at -3, 0, +3, +7 days relative to due date via email and SMS with escalating tone — toggleable per invoice
  4. Late fees auto-calculate (flat or percentage) from invoice settings and appear as a line item on overdue invoices
  5. An owner sets up a recurring invoice schedule (weekly/monthly/quarterly/annually) and the system auto-generates draft invoices on schedule for owner review before sending
**Plans**: 7 plans
Plans:
- [x] 34-01-PLAN.md — Database migrations (estimates, payment log, reminders/recurring)
- [x] 34-02-PLAN.md — Estimate CRUD API + list page + status badge + summary cards
- [x] 34-03-PLAN.md — Payment log API + UI (record/delete payments, auto-status, balance)
- [x] 34-04-PLAN.md — Estimate editor with tier support + estimate PDF generation
- [x] 34-05-PLAN.md — Estimate detail view + send + convert-to-invoice + navigation
- [x] 34-06-PLAN.md — Automated reminders cron + late fee settings + application
- [x] 34-07-PLAN.md — Recurring invoices (setup, cron generation, badge, list integration)
**UI hint**: yes

### Phase 35: Invoice Integrations and AI

**Goal:** Extend the invoice system with accounting software sync (QuickBooks Online, Xero, FreshBooks) via OAuth, AI-generated line item descriptions from call transcripts using Gemini Flash, and batch invoice creation from multiple completed leads with review-then-send flow
**Depends on:** Phase 33 (Invoice Core)
**Requirements**: D-01 through D-11 (from 35-CONTEXT.md)
**Success Criteria** (what must be TRUE):
  1. An owner connects QuickBooks Online via OAuth from Settings > Integrations, and when they send an invoice it automatically appears in their QBO account
  2. The same OAuth + push-only sync works for Xero and FreshBooks via the adapter pattern — one shared interface, three platform-specific implementations
  3. An owner clicks "AI Describe" in the invoice editor and line item descriptions are generated from linked call transcript(s) via Gemini Flash — professional, trade-specific language
  4. An owner selects multiple completed leads, clicks "Create Invoices", reviews the batch of draft invoices, then sends all at once via "Send All"
  5. Accounting sync pushes invoice data on send and pushes status updates when invoices are marked paid or voided
**Plans**: 6/6 plans complete

Plans:
- [x] 35-01-PLAN.md — DB migration + adapter interface + factory + three platform adapters
- [x] 35-02-PLAN.md — AI line item descriptions (Gemini Flash + transcript access + editor UI)
- [x] 35-03-PLAN.md — Batch invoice creation from leads + review-then-send flow
- [x] 35-04-PLAN.md — Accounting OAuth routes + push-on-send sync hook
- [x] 35-05-PLAN.md — Integrations settings page + invoice sync status indicators
- [x] 35-06-PLAN.md — Edit mode for invoice editor + AI Describe button wiring (gap closure)
**UI hint**: yes

### Phase 36: Landing Page Section Redesign — How It Works Minimalism and Features Carousel

**Goal:** Both the How It Works and Features sections on the landing page are redesigned -- How It Works uses full-viewport scroll steps with staggered animations, Features uses a horizontal carousel with icon nav -- delivering an Apple-style professional feel
**Requirements**: HIW-01, HIW-02, HIW-03, HIW-04, HIW-05, FEAT-01, FEAT-02, FEAT-03, FEAT-04, FEAT-05, INTEG-01
**Depends on:** Phase 32
**Plans:** 6/6 plans complete

Plans:
- [x] 36-01-PLAN.md -- HowItWorksMinimal component and HowItWorksSection wrapper update
- [x] 36-02-PLAN.md -- FeaturesCarousel component and page.js import swap
- [ ] 36-03-PLAN.md -- Build verification, ScrollLinePath integration, visual checkpoint
**UI hint**: yes

### Phase 39: Call Routing Webhook Foundation

**Goal:** Build the backend infrastructure for conditional call routing (time-based AI vs owner pickup) as purely additive work that does not affect any existing tenant's current routing. Ships a new FastAPI webhook service alongside the LiveKit agent on Railway, a schedule evaluator, per-country soft caps, and the database schema to support per-day scheduling and parallel-ring pickup numbers.
**Depends on:** Phase 38 (latest completed phase — no hard dependency, but sequential in roadmap)
**Requirements**: ROUTE-01 through ROUTE-06 (to be added in REQUIREMENTS.md during planning)
**Success Criteria** (what must be TRUE):
  1. Migration adds `call_forwarding_schedule JSONB`, `pickup_numbers JSONB` (array supporting up to 5 entries with `{number, label, sms_forward}` shape), `dial_timeout_seconds INTEGER DEFAULT 15` columns on `tenants`; `routing_mode TEXT CHECK IN ('ai','owner_pickup','fallback_to_ai')` and `outbound_dial_duration_sec INTEGER` columns on `calls`
  2. A FastAPI server runs in the livekit-agent Railway process exposing `POST /twilio/incoming-call`, `POST /twilio/dial-status`, `POST /twilio/dial-fallback`, `POST /twilio/incoming-sms` — all four endpoints return valid responses to Twilio test requests
  3. All webhook endpoints verify `X-Twilio-Signature` header and reject unsigned or mis-signed requests with HTTP 403
  4. Pure-function `evaluate_schedule(tenant, current_utc)` returns `{mode, reason}` and passes unit tests covering: empty schedule (defaults to AI), per-day ranges in tenant timezone, DST spring-forward and fall-back transitions, overnight ranges (7pm-9am crossing midnight), day boundaries, and "all day owner pickup" mode
  5. `check_outbound_cap(tenant_id, country)` enforces per-country monthly limits (US/CA: 5000 min, SG: 2500 min) by summing `outbound_dial_duration_sec` from current calendar month
  6. Zero production traffic is routed through the new webhook — no existing Twilio numbers are reconfigured; the `incoming-call` endpoint returns a default "always-AI" TwiML as a compatibility baseline
**Plans:** 7/7 plans executed (completed 2026-04-10)

Plans:
- [x] 39-01-PLAN.md - Wave 0: REQUIREMENTS.md ROUTE-01..06 + pytest config + tests/webhook/ stub package
- [x] 39-02-PLAN.md - Wave 1: Migration 042 (tenants + calls schema additions + idx_calls_tenant_month)
- [x] 39-03-PLAN.md - Wave 1: src/webhook/schedule.py (evaluate_schedule pure function) + 17 unit tests
- [x] 39-04-PLAN.md - Wave 1: src/lib/phone.py extraction + src/webhook/caps.py (check_outbound_cap) + 8 unit tests
- [x] 39-05-PLAN.md - Wave 2: FastAPI app + security.py + twilio_routes.py (4 endpoints) + agent.py boot swap + delete health.py
- [x] 39-06-PLAN.md - Wave 2: Fill in test_routes.py (6 integration) + test_security.py (4 signature tests)
- [x] 39-07-PLAN.md - Wave 3: Update voice-call-architecture SKILL.md + final verification sweep

### Phase 40: Call Routing Provisioning Cutover

**Goal:** Switch Twilio phone number configuration from the current Elastic SIP Trunk direct routing to the new Railway webhook, implement the real routing logic (schedule evaluation, soft cap enforcement, parallel ring TwiML, SMS forwarding to pickup numbers with `sms_forward=true`), and migrate all existing tenant numbers to the webhook without breaking inbound calls. This is the architectural cutover phase.
**Depends on:** Phase 39 (webhook must be deployed and verified before cutover)
**Requirements**: ROUTE-07 through ROUTE-12 (to be added in REQUIREMENTS.md during planning)
**Success Criteria** (what must be TRUE):
  1. `provisionPhoneNumber` in `src/app/api/stripe/webhook/route.js` sets `voice_url`, `voice_fallback_url`, and `sms_url` on newly purchased Twilio numbers pointing at the Railway webhook — fallback URL returns static TwiML that dials SIP unconditionally as a safety net
  2. The incoming-call webhook evaluates the tenant's schedule and returns correct TwiML: `<Dial><Sip>` for AI mode, `<Dial timeout="{dial_timeout_seconds}" callerId="{original_caller}"><Number>...</Number>...</Dial>` for owner mode with ALL pickup_numbers ringing in parallel (up to 5), fallback to AI on timeout/no-answer
  3. Subscription gate is checked before routing — canceled/paused/incomplete tenants follow existing `BLOCKED_STATUSES` behavior
  4. Soft cap is checked per call — when exceeded, the webhook returns AI TwiML instead of owner TwiML and logs a cap-breach event
  5. Owner-pickup calls insert a `calls` row with `routing_mode='owner_pickup'` and a minimal metadata set; `increment_calls_used` does NOT fire for these calls (they don't count toward the AI quota)
  6. SMS forwarding: when a customer texts the Twilio number, the webhook forwards the message text to every `pickup_numbers` entry where `sms_forward=true`, prefixed with `"[Voco] From {original_sender}: {body}"`; MMS dropped with a `[Media attached]` note; forwarded messages logged to a new `sms_messages` table
  7. A migration script iterates every existing tenant's Twilio number and updates its voice/sms configuration to use the Railway webhook — dry-run mode verified first, then production run
  8. End-to-end test: real call to a test tenant's number with schedule=all-AI → hits LiveKit agent as before; schedule=all-owner → rings owner's pickup number(s); schedule=AI-after-hours + call during owner window → rings owner; owner no-answer → falls back to AI; all scenarios produce correct `calls` rows
  9. Twilio status callback fires on dial completion and writes `outbound_dial_duration_sec` to the corresponding `calls` row for cost tracking
**Plans:** 3/3 plans complete

Plans:
- [x] 40-01-PLAN.md — Migration 045 (sms_messages + call_sid) and incoming-call handler rewrite with live routing logic
- [x] 40-02-PLAN.md — Dial-status, dial-fallback, and SMS forwarding handlers
- [x] 40-03-PLAN.md — Provisioning update (webhook URLs on new numbers) and existing-tenant cutover script

### Phase 41: Call Routing Dashboard and Launch

**Goal:** Ship the user-facing surface for the call routing feature — a new dedicated dashboard page where tenants configure their per-day schedule, manage pickup numbers (up to 5), adjust the dial timeout, toggle SMS forwarding per number, and see their monthly outbound minute usage. Also surface owner-pickup calls in the existing dashboard calls page with a routing mode badge, so owners have a single view of all call activity regardless of routing.
**Depends on:** Phase 40 (webhook routing + provisioning must be live so the dashboard configures a feature that actually works)
**Requirements**: ROUTE-13, ROUTE-14, ROUTE-15, ROUTE-16, ROUTE-17, ROUTE-18
**Success Criteria** (what must be TRUE):
  1. A new dashboard page at `/dashboard/more/call-routing` lets tenants configure the feature with per-day schedule editing (one range per day), dial timeout slider (10-30s, default 15s), pickup number management (add/remove up to 5, edit label, toggle `sms_forward` per entry)
  2. `GET /api/call-routing` and `PUT /api/call-routing` API routes serve the schedule + pickup_numbers + dial_timeout state and validate updates (E.164 phone numbers, no duplicates, no self-reference to the Twilio number, 5-entry max, valid time ranges)
  3. The page shows a usage meter — "X of Y outbound minutes used this month" — based on `sum(outbound_dial_duration_sec)` for the current calendar month
  4. The existing dashboard calls page (`/dashboard/calls`) shows a routing mode badge on each call row: "AI", "You answered", "Missed → AI" — based on the `routing_mode` column
  5. Owner-pickup calls appear in the dashboard calls page (not hidden) with duration and any metadata available, even though they don't have transcripts or recordings
  6. Onboarding: the setup checklist includes an optional "Configure call routing" step that links to the new page; users can skip it and configure later
  7. Validation: submitting zero pickup numbers while the schedule is enabled shows a blocking warning "Add at least one pickup number to route calls to you"
  8. The AI Voice Settings page in `/dashboard/more/ai-voice-settings` links to the new Call Routing page
  9. End-to-end test: user configures schedule in the dashboard → call comes in during owner hours → correct pickup numbers ring in parallel → call appears in dashboard with `routing_mode='owner_pickup'` badge
**Plans:** 4/4 plans complete

Plans:
- [x] 41-01-PLAN.md — Call routing API routes (GET + PUT) with validation + extend calls API select
- [x] 41-02-PLAN.md — Call routing settings page (schedule editor, pickup numbers, usage meter, dial timeout)
- [x] 41-03-PLAN.md — Routing badges on calls page, More page link, AI voice settings link, setup checklist step
- [ ] 41-04-PLAN.md — Visual verification checkpoint

### Phase 42: Calendar Essentials — Time Blocks and Mark Complete

**Goal:** Add personal time blocks (lunch, vacation, errands) that render on the dashboard calendar and that the voice agent's check_availability tool respects as unavailable, plus a "mark complete" transition on appointments with a muted visual state for completed jobs. Cross-repo phase: changes both the Next.js main repo (new calendar_blocks table + UI) and the LiveKit Python agent repo (check_availability.py + slot_calculator.py). Intentionally scoped small — no drag/resize, no realtime, no technician assignment, no shared-drawer refactor.
**Depends on:** Phase 41 (call routing dashboard and launch)
**Requirements**: CAL-01, CAL-02, CAL-03, CAL-04, CAL-05, CAL-06, CAL-07, CAL-08, CAL-09, CAL-10, CAL-11
**Plans:** 5/5 plans complete

Plans:
- [x] 42-01-PLAN.md — DB migration (calendar_blocks table + completed_at) + CRUD API + mark-complete PATCH + available-slots integration
- [x] 42-02-PLAN.md — Time block UI (TimeBlockSheet, TimeBlockEvent rendering, calendar page state)
- [x] 42-03-PLAN.md — Mark complete UI (AppointmentFlyout, completed visual state, show-completed toggle)
- [x] 42-04-PLAN.md — Slot calculator integration (Python voice agent + JS test)
- [x] 42-05-PLAN.md — Visual verification + UI/UX overhaul (unified "+ New" popover, day view redesign, calendar sync, external event sheet, multi-day group delete)

### Phase 43: Recurring Appointments — Maintenance Contracts

**Goal:** Enable weekly / monthly / quarterly recurring appointments with a fixed end date, materialized into the appointments table by a daily cron job. Covers the core home service recurring-revenue stream (HVAC tune-ups, pest control, lawn care) without opening the full rrule complexity box — no exception dates, no arbitrary rules, just the three common frequencies with an end date. Where the recurrence management UI lives (AppointmentFlyout, new modal, or a dedicated Contracts surface) is a Phase 43 discussion decision. Cross-repo awareness required: recurring instances must respect the same slot/overlap rules as one-off bookings via book_appointment_atomic.
**Depends on:** Phase 42 (calendar essentials should ship first so the UI entry point for "make recurring" exists, and time blocks are respected by the recurring-spawn cron)
**Requirements**: TBD (to be added in REQUIREMENTS.md during planning)
**Plans:** 0 plans (run /gsd:plan-phase 43 to break down)

Plans:
- [ ] TBD (run /gsd:plan-phase 43 to break down)

### Phase 44: AI Voice Selection

**Goal:** Let business owners choose their AI receptionist's voice from a curated set of 6 Gemini voices in the AI & Voice Settings dashboard page. Voice picker UI with pre-recorded audio preview clips, grouped by gender. Selection persists to tenants table and the LiveKit agent reads it at call time. Backward-compatible — NULL defaults to existing tone-based voice mapping.
**Depends on:** None (independent of phases 40-43)
**Requirements**: VOICE-SEL-01 through VOICE-SEL-08
**Plans:** 3/3 plans complete

Plans:
- [x] 44-01-PLAN.md — DB migration, API route, unit tests, placeholder audio
- [x] 44-02-PLAN.md — VoicePickerSection UI, page integration, visual verification
- [x] 44-03-PLAN.md — Python agent voice override in livekit-agent

### Phase 45: In-Browser Voice Test

**Goal:** Business owners can talk to their AI directly in the browser from AI & Voice Settings — same system prompt, business name, working hours, tone, and personality as a real call, but powered by a direct Gemini Live API WebSocket session (no LiveKit/Railway). Sandbox mode: AI simulates the full conversation flow including booking confirmations but commits no real side effects (no DB writes, no SMS, no calendar events). Uses the owner's selected voice from Phase 44.
**Depends on:** Phase 44 (uses the selected voice)
**Requirements**: VOICE-SEL-01 through VOICE-SEL-08
**Plans:** 3 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 45 to break down)

### Phase 46: VIP Caller Direct Routing

**Goal:** Owner selects specific phone numbers or leads whose calls bypass AI and route directly to the owner's phone, regardless of schedule. Covers webhook routing logic (livekit-agent), tenant settings API, and dashboard UI.
**Requirements**: VIP-01, VIP-02, VIP-03, VIP-04, VIP-05, VIP-06, VIP-07, VIP-08, VIP-09, VIP-10, VIP-11, VIP-12, VIP-13
**Depends on:** Phase 41
**Plans:** 4/4 plans complete

Plans:
- [x] 46-01-PLAN.md -- Database migration (vip_numbers + is_vip) and API extensions (call-routing, leads)
- [x] 46-02-PLAN.md -- Webhook VIP check in livekit-agent (two-source lookup, routing bypass)
- [x] 46-03-PLAN.md -- Dashboard UI (VIP Callers section, LeadCard badge, LeadFlyout toggle)


---

## Milestone v5.0 Phases

**Milestone:** v5.0 — Trust & Polish
**Goal:** Harden Voco's visual and conversion surface and elevate day-to-day usefulness — address the 5 most common home-service-owner objections via new landing page sections, reposition Voco as a complementary full-stack AI workflow, redesign the dashboard home page into a daily-use hub, extend full dark mode coverage across the dashboard, and apply overall UI/UX polish across both the public site and dashboard.
**Phase range:** 47-49 (Phase 50 absorbed into Phase 49 Plan 05; Phase 51 deferred to v6.0)
**Requirements:** 42 v5.0 requirements (OBJ-01-09, REPOS-01-04, HOME-01-07, DARK-01-10, POLISH-01-12) — POLISH-01-07/09-10 deferred to v6.0

### v5.0 Phase Checklist

- [x] **Phase 47: Landing -- Objection-Busting, Repositioning, and Landing Polish** - Objection-busting sections (FAQ accordion, voice quality proof, cost-of-inaction stat, 5-min setup strip, trust badges, identity block, revenue calculator, before/after strip, trade proof), repositioning copy (hero, FinalCTA, workflow strip, owner-control callout), landing animation/responsive polish (completed 2026-04-14; superseded in part by Phase 48.1 revenue-recovery rewrite)
- [x] **Phase 48: Dashboard Home Redesign** - Daily-ops hub (appointments, calls, leads, usage), redesigned setup checklist with grouped progress and auto-detection, integrated AI chat panel sharing history with ChatbotSheet, Help & Discoverability section, 375px responsive layout (completed 2026-04-14)
- [x] **Phase 48.1: Landing Page Revenue-Recovery Repositioning (INSERTED)** - Hero rewrite to revenue-recovery framing, AudioDemoSection, IntegrationsStrip, CostOfSilenceBlock, YouStayInControlSection consolidation, Voco AI rebrand for SEO (completed 2026-04-15)
- [x] **Phase 49: Dark Mode Foundation and Token Migration** - ThemeProvider wiring, theme toggle in sidebar, design token audit across all dashboard components, typography consolidation, layout/sidebar/banners/flyouts/badges dark mode, AnalyticsCharts + CalendarView (Phase 50 absorbed into 49-05) (completed 2026-04-16)
- [~] **Phase 50: Dark Mode -- Charts and Calendar** — ABSORBED into Phase 49 Plan 05 (hex-audit gate required zero violations across full tree; AnalyticsCharts and CalendarView migrated as part of the same sweep)
- [~] **Phase 51: UI/UX Polish Pass** — DEFERRED to v6.0 (empty states, loading skeletons, focus rings, error retry, async button states; will land alongside v6.0 integration UI work)

### Phase 47: Landing -- Objection-Busting, Repositioning, and Landing Polish

**Goal**: Visitors encounter a landing page that proactively addresses every reason they might not sign up -- a FAQ, voice proof, pricing context, setup simplicity, trust signals, identity framing, and interactive revenue math -- while the hero and FinalCTA copy are reframed to complement-not-replacement language and every new section renders correctly at mobile breakpoints with reduced-motion compliance
**Depends on**: Phase 46 (last completed phase; no hard dependency for landing work)
**Requirements**: OBJ-01, OBJ-02, OBJ-03, OBJ-04, OBJ-05, OBJ-06, OBJ-07, OBJ-08, OBJ-09, REPOS-01, REPOS-02, REPOS-03, REPOS-04, POLISH-11, POLISH-12
**Success Criteria** (what must be TRUE):
  1. Visitor scrolling the landing page encounters an FAQ accordion (7+ questions) that answers every objection from PROBLEMS.md -- without headings reading as defensive or fear-planting
  2. Visitor sees a "cost of inaction" stat block ($260,400/year figure), a "5-minute setup" visual strip, voice-quality proof linking to the hero demo, a trust/hybrid-backup badge row, and an identity/change-aversion block -- all cohesive and above the FinalCTA
  3. Visitor can type their call volume into a revenue calculator and see real-time annual revenue-at-risk results without a page reload
  4. Visitor sees hero H1 and FinalCTA copy that uses complement-not-replacement language and a 5-icon full-stack workflow strip making the end-to-end workflow visible
  5. All new sections render single-column at 375px, use AnimatedSection wrappers with useReducedMotion compliance, and do not break the ScrollLinePath copper line
**Plans**: 5 plans

Plans:
- [x] 47-01-PLAN.md — Wave 0 foundation (install shadcn Accordion, scaffold smoke tests, document OBJ-02 audio source)
- [x] 47-02-PLAN.md — AfterTheCallStrip (REPOS-03) + IdentitySection (OBJ-06) + OwnerControlPullQuote (REPOS-04)
- [x] 47-03-PLAN.md — PracticalObjectionsGrid + AudioPlayerCard (OBJ-02/03/04/05/08/09)
- [x] 47-04-PLAN.md — FAQSection + FAQChatWidget (OBJ-01 + integrated AI chat panel)
- [x] 47-05-PLAN.md — page.js wiring, Hero/FinalCTA copy (REPOS-01/02), skill sync (completed 2026-04-14, commits a1bc795/31ebd95/9fedaa6/5fa612d; later superseded in part by Phase 48.1 revenue-recovery rewrite — see 47-05-SUMMARY.md retrospective)

**Scope note**: OBJ-07 (revenue calculator) excluded from Phase 47 per CONTEXT.md D-01 — already shipped on `/pricing` page (ROICalculator.jsx). 14 of 15 v5.0 landing requirements covered here.
**UI hint**: yes

### Phase 48: Dashboard Home Redesign

**Goal**: The dashboard home page is a daily-use command center that owners return to every morning -- a redesigned setup checklist with themed grouping and auto-detection of completed items, at-a-glance daily-ops cards (today's appointments, recent calls, hot leads, usage meter), an integrated AI chat panel where conversations persist across entry points via shared history with ChatbotSheet, a Help & Discoverability section for common task shortcuts, and a responsive layout that stacks cleanly at 375px
**Depends on**: Phase 47 (landing ships first; no technical dependency -- could parallelize, but landing is higher conversion priority)
**Requirements**: HOME-01, HOME-02, HOME-03, HOME-04, HOME-05, HOME-06, HOME-07
**Success Criteria** (what must be TRUE):
  1. A returning owner opens the dashboard home and sees today's appointments, calls from the last 24 hours, their newest/hottest leads, and their usage meter -- all without navigating away from the home page
  2. A newly onboarded owner sees a setup checklist with items grouped by theme (profile, voice, calendar, billing), each with a jump-to-page action, and the checklist auto-marks items complete as the owner finishes configuration elsewhere
  3. Owner can ask a question in the integrated AI chat panel on the home page and continue that conversation in the floating ChatbotSheet -- message history is shared, not reset on switch
  4. Owner sees a Help & Discoverability section with quick-links to common tasks that route directly to the correct dashboard page
  5. At 375px viewport the home page stacks all cards to a single column with no horizontal scrolling
**Plans:** 5/5 plans complete

Plans:
- [x] 48-01-schema-apis-test-scaffold-PLAN.md — Migration 050 (checklist_overrides JSONB) + blocking supabase db push + PATCH API extension (per-item mark_done/dismiss + themed items) + new GET /api/usage + 7 Wave-0 test scaffolds
- [x] 48-02-chat-provider-context-lift-PLAN.md — ChatProvider React Context + refactor ChatbotSheet to useChatContext + wrap dashboard layout with currentRoute threading (HOME-05 foundation)
- [x] 48-03-setup-checklist-refactor-PLAN.md — In-place refactor of SetupChecklist/ChecklistItem into 4 theme accordions (profile/voice/calendar/billing) with Dismiss / Mark done / Jump to page actions and window-focus refetch (HOME-01, HOME-03)
- [x] 48-04-daily-ops-hub-tiles-PLAN.md — DailyOpsHub bento grid + TodayAppointmentsTile (hero) + CallsTile (absorbs missed-calls alert) + HotLeadsTile + UsageTile with threshold color helper (HOME-02)
- [x] 48-05-page-wiring-chat-panel-help-PLAN.md — ChatPanel + HelpDiscoverabilityCard + page.js rewrite (deletes setupMode/invoices/inline missed-calls) + 375px mobile verify checkpoint (HOME-04, HOME-05, HOME-06, HOME-07)
**UI hint**: yes

### Phase 48.1: Landing Page Revenue-Recovery Repositioning (INSERTED)

**Goal:** Pivot the public landing page from a feature-platform framing to a revenue-recovery framing — a first-time visitor understands within 8 seconds that Voco captures revenue they're losing to missed calls, hears a real call within one scroll, quantifies their own loss in under 30 seconds via a Cost-of-Silence calculator, trusts that Voco plays nice with existing CRMs via a visible Integrations strip (Google/Outlook live + Jobber/Housecall Pro/ServiceTitan/Zapier coming soon), and clicks the primary CTA with the mental model of "hiring an AI dispatcher" rather than "adopting a SaaS platform." Driven by independent market feedback from 4 AI research reports converging on the same diagnosis: current page is overbuilt and feature-led, needs to be shorter, trust-led, and revenue-led.
**Depends on:** Phase 48 (dashboard home redesign ships first — this phase is pure public-facing landing work, no dashboard or backend changes)
**Requirements:** TBD (to be derived during plan phase)
**Success Criteria** (what must be TRUE):
  1. Landing page total section count drops from 10+ to 7 or fewer — dense trust/repetition sections consolidated, FeaturesCarousel trimmed from 8 features to 4 core pillars, repeated feature-card sections removed
  2. Hero subtitle names a dollar-value pain ("Stop losing $1,000+ every time you miss a call") and primary CTA is a low-friction "Hear Voco in Action" audio-demo anchor rather than "Start My 5-Minute Setup"
  3. A Cost-of-Silence stat block showing $260,400/year lost to missed calls renders above the first pricing section, with a 'Calculate yours →' link deep-linking to `/pricing#calculator` (scope override per phase 48.1 CONTEXT D-07 — the interactive calculator lives on the pricing page; the landing surface gets the static proof stat)
  4. Audio demo section is visible within one scroll from hero and presents real call samples (not only the existing input-driven HeroDemoBlock)
  5. Integrations strip appears above the fold or within first scroll, showing Google Calendar + Outlook Calendar as live integrations and Jobber + Housecall Pro + ServiceTitan + Zapier as "Coming Soon" — addresses the "I'll have to replace my CRM" objection pre-emptively
  6. Four trust-theme sections (IdentitySection, OwnerControlPullQuote, full PracticalObjectionsGrid, BeyondReceptionistSection) are consolidated into one "You Stay in Control" section; three strongest objection cards kept, others moved to an expandable disclosure
  7. All public-facing product mentions (page title, og:title, nav, footer, hero copy) use "Voco AI" consistently to disambiguate from Voco TV / Voco Studio / Voco Voice search results — codebase internal naming unchanged
  8. Landing page Lighthouse LCP remains under 2.5s; CLS under 0.1 (Phase 13 performance contract preserved)
  9. Zero dashboard changes, zero backend changes, zero new API routes — scope strictly limited to public landing surface + one client-side calculator widget
**Plans:** 4/4 plans complete

Plans:
- [x] 48.1-01-PLAN.md — Wave 0 prerequisites: update landing-sections test file for Phase 48.1 inventory, add id="calculator" anchor to pricing page, place stub audio files (completed 2026-04-15)
- [x] 48.1-02-PLAN.md — Create 4 new landing components (AudioDemoSection, IntegrationsStrip, CostOfSilenceBlock, YouStayInControlSection)
- [x] 48.1-03-PLAN.md — Modify HeroSection copy+CTAs, trim FeaturesCarousel to 4 pillars, update FAQSection, rebrand root metadata to Voco AI
- [x] 48.1-04-PLAN.md — Wave 2 integration: rewrite page.js composition, delete 12 legacy components, update skill docs, 375px + a11y + Lighthouse checkpoint
**UI hint**: yes

### Phase 49: Dark Mode Foundation and Token Migration

**Goal**: The dashboard renders correctly in both light and dark mode -- ThemeProvider is wired with no hydration flash, a theme toggle in the sidebar persists the user's preference, all dashboard component files replace hardcoded hex colors with dark-mode-aware semantic tokens, design-tokens.js exports semantic values, typography is consolidated to token color values, and every layout shell, flyout, modal, badge, and system banner responds correctly to the active theme
**Depends on**: Phase 48 (home redesign ships first, establishing a stable UI surface before the broad token migration pass)
**Requirements**: DARK-01, DARK-02, DARK-03, DARK-04, DARK-06, DARK-07, DARK-08, DARK-09, POLISH-08
**Success Criteria** (what must be TRUE):
  1. Owner toggles theme in the dashboard sidebar and the entire dashboard switches between light and dark mode within 150ms with no visible jank, no flash of light mode on hard reload, and no hydration warning in the browser console
  2. Every dashboard layout element -- sidebar, top bar, main content background, bottom tab bar, impersonation banner, trial countdown banner -- responds correctly to the theme toggle
  3. All flyouts and modals (LeadFlyout, AppointmentFlyout, QuickBookSheet, ChatbotSheet) render readable content in dark mode with no hardcoded white backgrounds or invisible text remaining
  4. Status badges, urgency pills, and LeadStatusPills maintain readable contrast and categorical meaning in dark mode
  5. Theme preference persists across browser sessions via localStorage; returning the next day shows the last-selected theme applied immediately
**Plans:** 5/5 plans complete

Plans:
- [x] 49-01-PLAN.md — Theme infrastructure: globals.css tokens + @custom-variant fix + 150ms body transition + ThemeProvider wiring + design-tokens.js CSS-var rewrite (POLISH-08) + sidebar binary toggle button + Wave 0 test scaffolds
- [x] 49-02-PLAN.md — Layout shell migration: dashboard/layout.js bg-background + BottomTabBar + 3 system banners (Impersonation/TrialCountdown/BillingWarning) + 2 secondary banners (Offline/ConflictAlert)
- [x] 49-03-PLAN.md — Flyouts and modals (DARK-06): LeadFlyout/AppointmentFlyout/QuickBookSheet/ChatbotSheet + ExternalEventSheet/TimeBlockSheet/RecordPaymentDialog/RecurringSetupDialog
- [x] 49-04-PLAN.md — Status pills and badges (DARK-07): LeadStatusPills/BookingStatusBadge/EstimateStatusBadge/InvoiceStatusBadge/RecurringBadge/LeadFilterBar with verbatim UI-SPEC category mapping
- [x] 49-05-PLAN.md — Bulk dashboard sweep (DARK-03 + POLISH-08): remaining ~50 components and ~28 pages, gated by Wave 0 hex-audit test
**UI hint**: yes

### Phase 50: Dark Mode -- Charts and Calendar

**Goal**: Analytics charts and the calendar urgency color system render correctly in dark mode -- because SVG inline styles cannot be driven by CSS variables, these components require useTheme() hook-based conditional color resolution at render time rather than CSS class migration, and must ship together as a coherent visual unit
**Depends on**: Phase 49 (ThemeProvider must be wired and verified before any useTheme() hook calls function correctly)
**Requirements**: DARK-05, DARK-10
**Success Criteria** (what must be TRUE):
  1. Owner switches to dark mode and views the Analytics page -- all Recharts axes, gridlines, tooltip backgrounds, and data fills are readable and on-brand in dark mode, not invisible or incorrectly rendering with light-mode colors
  2. Owner views the calendar in dark mode -- appointment urgency color blocks (emergency, routine, high-ticket) are visually distinct and readable on the dark calendar background
  3. Switching back to light mode restores all chart and calendar colors correctly without a page reload
**Plans**: TBD
**UI hint**: yes

### Phase 51: UI/UX Polish Pass

**Goal**: Every dashboard surface is polished to the standard of a paid SaaS product -- empty states replace blank pages across all list views, loading skeletons prevent layout shift during data fetches, all interactive elements have consistent focus rings using design-token colors, data-fetch errors surface with retry actions instead of frozen UI, async buttons show spinner + disabled state during operations, stat cards have hover depth micro-interactions, lead status transitions animate with AnimatePresence, CommandPalette covers all major destinations, and the week calendar and analytics charts render without overflow at 375px
**Depends on**: Phase 50 (dark mode must be fully stable before the polish pass so empty states and skeletons use correct token values in both modes)
**Requirements**: POLISH-01, POLISH-02, POLISH-03, POLISH-04, POLISH-05, POLISH-06, POLISH-07, POLISH-09, POLISH-10
**Success Criteria** (what must be TRUE):
  1. A new owner with no data opens the leads, calls, calendar, and analytics pages -- each shows a dedicated empty state with an icon, headline, and primary CTA explaining what to do next, not a blank page or frozen spinner
  2. Refreshing any dashboard data page shows layout-matching skeleton placeholders during the fetch with no visible layout shift (CLS = 0) when data arrives
  3. Pressing Tab through the dashboard highlights every interactive element (buttons, inputs, nav items, pill filters) with a consistent focus ring using the design-token focus color -- no keyboard-reachable element is visually invisible
  4. When a data fetch fails, the user sees an inline error state with a "Retry" button rather than a frozen spinner or empty content area
  5. Async action buttons (save settings, sync calendar, send invoice) show a spinner and disable during the pending operation -- double-submit is not possible
**Plans**: TBD
**UI hint**: yes

## v5.0 Progress

**Execution Order:**
Phases execute in order: 47 -> 48 -> 49 -> 50 -> 51
(Note: Phase 47 landing work is fully independent of Phases 48-51 and can run in parallel with a separate focus. Phases 49-51 are a strict sequence: dark mode foundation must precede charts/calendar dark mode which must precede the polish pass to ensure correct token values in empty states and skeletons.)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 47. Landing -- Objection-Busting, Repositioning, and Landing Polish | 5/5 | Complete | 2026-04-14 |
| 48. Dashboard Home Redesign | 5/5 | Complete | 2026-04-14 |
| 48.1. Landing Page Revenue-Recovery Repositioning | 4/4 | Complete | 2026-04-15 |
| 49. Dark Mode Foundation and Token Migration | 5/5 | Complete | 2026-04-16 |
| 50. Dark Mode -- Charts and Calendar | — | Absorbed into Phase 49 Plan 05 | 2026-04-16 |
| 51. UI/UX Polish Pass | — | Deferred to v6.0 | - |
| 52. Rename Leads Tab to Jobs and Restructure Status Pills | 5/5 | Complete    | 2026-04-16 |


### Phase 52: Rename Leads tab to Jobs and restructure status pills for home-service mental model

**Goal:** Reframe the dashboard's /dashboard/leads surface to /dashboard/jobs to match the home-service SME owner mental model — sidebar + bottom-tab nav labels become 'Jobs', canonical URL renames with a 308 permanent redirect for back-compat, status pill labels restructure to job-progression vernacular (New, Scheduled, Completed, Paid, Lost) with a visual gap separating the terminal-negative Lost pill from the active pipeline, and all user-facing 'Lead(s)' copy across LeadFlyout / LeadFilterBar / EmptyStateLeads / HotLeadsTile / search results / notification emails / chatbot knowledge reframes to 'Job(s)'. Pure frontend reframe — DB enum, /api/leads/* routes, voice agent, and component file names are all preserved unchanged per minimal-blast-radius rule.
**Requirements**: RENAME-01, RENAME-02, RENAME-03
**Depends on:** None blocking — pure UI copy + URL reframe of an existing surface (Phase 49 dark-mode pill palette is preserved verbatim, so no token-system dependency)
**Plans:** 5/5 plans complete

Plans:
- [x] 52-01-PLAN.md — Status pill restructure (LeadStatusPills + LeadCard label sync to Scheduled, Lost gap)
- [x] 52-02-PLAN.md — Page route move /dashboard/leads → /dashboard/jobs + H1 + 308 redirect in next.config.js
- [x] 52-03-PLAN.md — Chatbot knowledge corpus reframe (8 files: index.js + 7 markdown docs)
- [x] 52-04-PLAN.md — Copy reframe + internal href audit batch (16 files: flyout/filter/empty/hot/sidebar/bottom-tab + 10 internal-link files)
- [x] 52-05-PLAN.md — dashboard-crm-system skill update + final repo-wide grep verification + human checkpoint

### Phase 59: Customer/Job model separation — split leads into Customers (dedup by phone) and Jobs (one row per appointment), rewrite Jobs tab to query appointments, add Customer detail page, reattribute invoices per-job

**Goal:** Refactor the single `leads` table into Customers (phone-deduped per tenant), Jobs (1:1 with booked appointments), and Inquiries (unbooked calls). Rewrite Jobs tab + add Inquiries tab + add Customer detail page with Merge + 7-day undo. Update Python LiveKit agent post-call path to use `record_call_outcome` RPC. Reattribute `invoices.lead_id` → `invoices.job_id` and `activity_log.lead_id` → three FKs (customer_id NOT NULL, job_id, inquiry_id). Lockstep deploy with 053a (create + backfill, keep legacy) shipped before Python agent redeploy, then 053b (drop legacy) after.
**Requirements**: D-01..D-19 (locked decisions in 59-CONTEXT.md — no REQ-IDs in REQUIREMENTS.md; CONTEXT decisions serve as the requirement set)
**Depends on:** Phase 58 (v6.0 complete)
**Plans:** 4/8 plans executed

Plans:
- [x] 59-01-PLAN.md — Wave 0: phone E.164 util (libphonenumber-js) + Python parity fixture + pre-migration audit SQL + red-state test scaffolds for all Wave 1-3 [D-05]
- [x] 59-02-PLAN.md — Wave 1: migration 053a (create customers/jobs/inquiries/customer_calls/job_calls + RLS + Realtime + backfill from leads; keep legacy) + [BLOCKING] schema push [D-01, D-02, D-05, D-06, D-07, D-11, D-12, D-13, D-15, D-16]
- [x] 59-03-PLAN.md — Wave 1: record_call_outcome + merge_customer + unmerge_customer RPCs (SECURITY DEFINER, service_role-only) + [BLOCKING] schema push [D-10, D-14, D-16, D-19]
- [x] 59-04-PLAN.md — Wave 2: API routes /api/customers, /api/jobs, /api/inquiries (list/detail/patch + merge/unmerge/convert) [D-03, D-10, D-18, D-19]
- [ ] 59-05-PLAN.md — Wave 2: Python LiveKit agent lockstep — swap legacy leads/lead_calls writes to record_call_outcome RPC + Railway deploy gate [D-04, D-14, D-16]
- [ ] 59-06-PLAN.md — Wave 3: Jobs tab rewrite (query /api/jobs, Realtime on jobs table) + new Inquiries tab + JobStatusPills/InquiryStatusPills + sidebar/BottomTabBar nav + chatbot corpus split (customers.md, jobs.md, inquiries.md) [D-08, D-09, D-15]
- [ ] 59-07-PLAN.md — Wave 3: Customer detail page (sticky header + Activity/Jobs/Invoices tabs) + CustomerEditModal + CustomerMergeDialog + UnmergeBanner + InquiryFlyout + JobFlyout + human-verify checkpoint [D-10, D-17, D-18, D-19]
- [ ] 59-08-PLAN.md — Wave 4: migration 053b drop legacy leads/lead_calls + activity_log.customer_id NOT NULL + [BLOCKING] push with coverage survey + delete /api/leads + delete Lead* components + 4 skill files sync (auth-database-multitenancy, dashboard-crm-system, voice-call-architecture, payment-architecture) [D-01, D-03, D-11, D-12, D-14]

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
**Plans:** 7/7 plans complete

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
- [x] **Phase 27: Country-Aware Onboarding and Number Provisioning** - User info collection (name, phone, country), country-based Twilio provisioning, Singapore pre-purchased inventory, simplified plan selection UI
 (completed 2026-03-26)
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

## Backlog

### Phase 999.6: Phase 58 UAT + telemetry validation (deferred)

**Status:** Deferred 2026-04-20 to close out Phase 58 faster. The Phase 58
scope (setup-checklist red-dot error variant + integration telemetry +
skill consolidation + polish sweeps) all shipped; the ship-gate UAT was
set aside for post-launch validation.

**What was deferred:**
- **18 UAT scenarios** in `.planning/phases/58-.../58-UAT.md`:
  - 1–8: Xero + Jobber connect / disconnect / refresh-fail red-dot / reconnect flows
  - 9–10: Real test calls with Xero + Jobber customer context injection
  - 11: Pre-call fanout latency measurement (requires ≥20 staged calls for p95)
  - 12: Webhook-miss → Phase 57 poll fallback simulation
  - 13–17: POLISH-03 focus ring / POLISH-01 empty states / POLISH-02 loading
    skeletons / POLISH-04 error+retry / POLISH-05 AsyncButton spot-checks
  - 18: Skill documentation sanity check (`integrations-jobber-xero` +
    `voice-call-architecture` + `dashboard-crm-system` updated headers)
- **Real p50/p95/p99 latency numbers** in `.planning/phases/58-.../58-TELEMETRY-REPORT.md`
  (SQL queries already embedded; just needs ≥20 `integration_fetch_fanout`
  rows in staging `activity_log` to execute).
- **end_call playout-wait verification** — confirm the livekit-agents
  1.5.1 `SpeechHandle.wait_for_playout()` fix (shipped in sibling repo as
  `livekit_agent 728e7cc`) actually resolves the "farewell cuts off
  halfway" symptom end-to-end.

**Why deferred:** The Xero `summaryOnly=false` + `lead_calls` upsert +
`end_call` playout-wait fixes landed during the first Phase 58 test call
already cover the hottest real-world failure modes. Remaining UAT is
re-verification of already-implemented features plus multi-day latency
sampling; blocking the phase close on 2–3 hours of hands-on + 48h of
staged calls doesn't change the shipped behavior.

**Acceptance:** Mark all 18 UAT scenarios with pass/fail/skipped + notes,
fill TELEMETRY-REPORT percentile tables from staging activity_log, confirm
end_call farewell-complete behavior with one live call, flip both
artifacts' frontmatter `status` from `deferred` back to `resolved`.

### Phase 999.5: OAuth refresh race + false-banner fix (Jobber + Xero)

**Status:** Resolved 2026-04-19. Migration `058_oauth_refresh_locks.sql` adds a lease-based lock table + `try_acquire_oauth_refresh_lock` / `release_oauth_refresh_lock` RPCs. `refreshTokenIfNeeded` in `src/lib/integrations/adapter.js` now (a) clears `error_state: null` in the update payload on successful rotation (Issue 1), (b) acquires the lease before calling `adapter.refreshToken()` and releases it in a `finally` block (Issues 2 & 3), and (c) losers poll for up to 3s to read the winner's freshly-persisted tokens. Tests: `tests/integrations/refresh-lock.test.js` (3 new cases — 5-concurrent → 1 wire call, error_state cleared, release always fires). Prior investigation notes retained below.

---

**Original investigation (retained for reference):** Three distinct bugs in `src/lib/integrations/adapter.js` `refreshTokenIfNeeded`.

**Issue 1 — `error_state` never cleared on successful refresh (CONFIRMED REAL, trivial fix):**
adapter.js:108-111 updates `{access_token, refresh_token, expiry_date, scopes?}` only. If a prior race set `error_state='token_refresh_failed'`, subsequent successful refreshes leave the flag on — the Reconnect banner persists forever despite a healthy chain. The OAuth callback clears it; normal operation does not.

**Issue 2 — Concurrent refresh race (CONFIRMED POSSIBLE, impact depends on Jobber behavior):**
When two callers (webhook + poll cron, or webhook + voice call, or two webhooks in a burst) read the creds row within the 5-min-to-expiry window, both pass adapter.js:46 buffer check and call `adapter.refreshToken(R0)` concurrently. Outcomes:
- Jobber strict: second call 401s, caller throws, Issue 1 kicks in.
- Jobber permissive: both get new tokens (R1, R2), last-write-wins persists one, orphans the other. Chain survives; extra rotations occur.
Either way, compounds Issue 1.

**Issue 3 — DB write failure after Jobber-accepted refresh (CONFIRMED REAL PERMANENT BREAK, rare):**
adapter.js:108-123. If `adapter.refreshToken()` succeeds (Jobber rotates R0 → R1 server-side, R0 dies) but the Supabase `update()` fails (outage, RLS edge case, network blip) — we throw. DB still holds R0 (dead). Next refresh uses R0 → 401 → chain permanently broken until manual reconnect. The code comment at line 115 acknowledges this: "DB still holds the old, now-dead one".

**Caller count:** 7 call sites (`src/app/api/webhooks/jobber`, `src/app/api/webhooks/xero`, `src/app/api/cron/poll-jobber-visits`, `src/lib/integrations/jobber.js` getJobberGraphqlClient × 3, `src/lib/integrations/xero.js`, `src/lib/accounting/sync.js`, `src/app/api/appointments/route.js`'s after()). Cron runs every 15 min via `vercel.json`.

**Fix plan (incremental):**
1. **Trivial:** Add `error_state: null` to `updatePayload` in adapter.js:96. Also double-check OAuth callback clears it (likely already does in `src/app/api/integrations/[provider]/callback/route.js`).
2. **Mutex:** Wrap the refresh-path (adapter.js:50-123) in `pg_advisory_xact_lock(hashtext('oauth-refresh-' || provider || '-' || tenant_id))` via a short transaction. Losing concurrent callers block, wake up, re-read DB (now has fresh tokens), and short-circuit on the 5-min-buffer check at line 46. Use `pg_try_advisory_lock` with a timeout rather than blocking indefinitely — otherwise a slow Jobber API call holds unrelated queries.
3. **Release in finally:** lock must be released even on throw. If using `pg_advisory_xact_lock`, transaction commit/rollback releases it automatically — safer than session-level locks.
4. **DO NOT** mask Issue 3 by retrying inside adapter — surface the DB-write-fail as reconnect-required (current behavior). A retry could rotate tokens twice.

**Testing:**
- Unit: mock `adapter.refreshToken`, fire 5 concurrent `refreshTokenIfNeeded` calls — assert exactly one wire call.
- Integration: force a refresh window (set expiry_date to Date.now()+1000), hit the webhook endpoint 5× concurrently via `curl`, assert calendar_events rows appear and no `error_state` set.
- Regression: existing unit tests for refresh-success, refresh-fail (401), DB-write-fail all still pass.

**Gotchas:**
- Service role client in Next.js uses its own Postgres connection pool. An advisory lock held during a 500ms Jobber refresh briefly serializes refresh attempts for the same tenant — acceptable since refresh is rare. Unrelated queries on the same connection pool are unaffected (lock is keyed per tenant).
- Tests in `tests/notifications/jobber-refresh-email.test.js` (7 tests) assert notifier behavior on error. Must still pass unchanged.
- `error_state` clearing must only happen AFTER the DB update succeeds. Do not clear optimistically.

**Acceptance:** Under 20 concurrent webhooks in dev (token in expiry window), no false `error_state` writes, no calendar data gaps, `adapter.refreshToken` invoked exactly once per 60-min window per tenant. Banner never shows when the chain is actually healthy.

### Phase 999.4: Calendar realtime auto-refresh for webhook-driven external events

**Status:** Parked 2026-04-19. Intended as a UX polish for Phase 57 — when a Jobber / Google / Outlook webhook writes to `calendar_events`, the open `/dashboard/calendar` view should update within ~1s with no manual refresh.

**What's already in place:**
- `supabase_realtime` publication has `calendar_events` added (migration 057).
- `IntegrationReconnectBanner` polls `/api/integrations/status` every 30s and surfaces token-refresh failures.
- Client subscription exists at `src/app/dashboard/calendar/page.js` (filtered by `tenant_id`).

**Blocker:** Subscription reports `TIMED_OUT` / `CLOSED` in the browser — Supabase Realtime silently rejects because RLS evaluation on the old row needs `REPLICA IDENTITY FULL`. The migration was updated to set it, but in practice the subscribe still times out in this env. Needs deeper investigation: Dashboard Database → Replication toggle state, Realtime service restart, or alternative (polling / cache-tag revalidate on webhook).

**Acceptance:** Jobber / Google / Outlook push notifications auto-update the calendar view within 2 seconds with no refresh, on both desktop and mobile. Banner still surfaces token failures. Debug `[calendar-rt]` logs removed.

### Phase 999.3: Bidirectional Jobber sync — push Voco bookings into Jobber (PROMOTED → Phase 62)

**Status:** Promoted to Phase 62 on 2026-04-19 as part of the voice-intake polish batch at the v6.0 tail (see Phase 62 above). Carries forward the `voco_booking_id` idempotency-key rule, the Phase 57 bookable-user assignee mapping, and the copy-to-clipboard + email-fallback as the permanent degraded-mode path.

**Original goal (retained for reference):** When a tenant has Jobber connected, appointments booked by the Voco AI must automatically create a Jobber Visit assigned to the correct user, so Jobber remains the scheduling system-of-record and the tenant's crew sees Voco-booked jobs in their normal Jobber workflow. Phase 57 shipped read-only mirror (Jobber → Voco) plus interim copy-to-clipboard / email fallback UX. Phase 62 closes the loop (Voco → Jobber push) with loop-dedup via `external_event_id` and `voco_booking_id` as the idempotency key so any tenant who manually copied a Voco booking into Jobber during the interim period does not end up with duplicates.

### Resolved

- **999.1 Booking urgency constraint mismatch** — fixed 2026-04-18 (livekit_agent repo). `book_appointment` tool normalizes urgency to `emergency`/`urgent`/`routine` via `_normalize_urgency()` before calling `atomic_book_slot`; tool description enumerates allowed values.
- **999.2 LiveKit voice cutoff on tool calls** — fixed 2026-04-18 (livekit_agent repo). `google.realtime.RealtimeModel` now receives a `RealtimeInputConfig` with LOW VAD sensitivity + `prefix_padding_ms=400` / `silence_duration_ms=1000`, so Gemini server VAD stops cancelling in-flight tool calls on breaths/overlap (upstream: livekit/agents#4441).


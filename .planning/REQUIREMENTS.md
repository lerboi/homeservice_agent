# Requirements: HomeService AI Agent

**Defined:** 2026-03-18 (v1.0), 2026-03-22 (v1.1), 2026-03-24 (v2.0), 2026-03-26 (v3.0), 2026-04-13 (v5.0), 2026-04-16 (v6.0)
**Core Value:** Every inbound call is answered instantly and converted into a confirmed booking or qualified lead — no call goes to voicemail, no lead is lost to a competitor.

## v6.0 Requirements — Integrations & Focus

**Goal:** Refocus on Call System; invoicing becomes optional; native Jobber + Xero read-side integrations for caller context.

### Rename / UX (Phase 52)

- **RENAME-01:** The dashboard navigation labels "Leads" are renamed to "Jobs" across sidebar, bottom tab bar, and breadcrumbs to match home-service owner mental model
- **RENAME-02:** Lead status pills are restructured into a Jobs-oriented status flow (e.g. New → Quoted → Booked → In Progress → Completed → Paid) instead of CRM-pipeline language
- **RENAME-03:** All references to "lead(s)" in user-facing copy on `/dashboard/leads` and `LeadFlyout` are reframed as "job(s)"; component file names may stay as-is to limit blast radius

### Invoicing Toggle (Phase 53)

- **TOGGLE-01:** A new `tenants.features_enabled` JSONB column exists with default `{"invoicing": false}` for ALL tenants (existing + new), enabling owners to opt into invoicing in settings
- **TOGGLE-02:** When `features_enabled.invoicing = false`, all invoicing-related routes (`/dashboard/invoices/**`, `/dashboard/estimates/**`, `/dashboard/more/invoice-settings`, `/api/invoices/**`, `/api/estimates/**`, `/api/cron/invoice-reminders`, `/api/cron/recurring-invoices`, `/api/accounting/**`, `/api/invoice-settings`) return 404 / no-op for that tenant
- **TOGGLE-03:** When `features_enabled.invoicing = false`, sidebar/BottomTabBar do not render an Invoices entry, LeadFlyout does not render Create Invoice / Create Estimate buttons, and the More menu does not list invoice-settings or accounting integrations
- **TOGGLE-04:** Owners can toggle invoicing on/off from a settings panel; toggle is reversible with no data loss (existing invoice records preserved); cron jobs skip tenants with the flag off

### Integration Foundation (Phase 54)

- **INTFOUND-01:** A shared `src/lib/integrations/` module exposes a provider-agnostic interface (`getAuthUrl`, `exchangeCode`, `refreshTokenIfNeeded`, `fetchCustomerByPhone`, `revoke`) that Jobber and Xero adapters implement
- **INTFOUND-02:** `accounting_credentials.provider` CHECK constraint is extended to include `'jobber'` (Xero already supported); `scopes TEXT[]` and `last_context_fetch_at TIMESTAMPTZ` columns added for telemetry
- **INTFOUND-03:** `next.config.js` has `cacheComponents: true` enabled to support Next.js 16 `"use cache"` patterns for dashboard reads

### Xero Read-Side (Phase 55) ✅ COMPLETE

- [x] **XERO-01:** A tenant can connect Xero via OAuth from `/dashboard/more/integrations`; tokens are stored in `accounting_credentials` with `provider='xero'`; refresh-aware token getter handles expiry — Phase 55 Plans 01/03/05
- [x] **XERO-02:** `fetchCustomerByPhone(tenantId, phone)` returns `{ contact, outstandingBalance, lastInvoices, lastPaymentDate }` from Xero with `'use cache'` TTL — Phase 55 Plan 02 (module-level cached function — Next.js 16 forbids `'use cache'` on class methods)
- [x] **XERO-03:** `/api/webhooks/xero` invalidates tenant's customer-context cache on invoice/payment events via `revalidateTag` — Phase 55 Plan 04
- [x] **XERO-04:** During an inbound call, the LiveKit agent fetches Xero context pre-session (awaited with 2.5s budget), injects a non-empty `customer_context` section into the system prompt, and exposes `check_customer_account()` as a tool — Phase 55 Plans 06 + 07

### Jobber Read-Side (Phase 56)

- **JOBBER-01:** A tenant can connect Jobber via OAuth from `/dashboard/more/integrations`; tokens are stored in `accounting_credentials` with `provider='jobber'`
- **JOBBER-02:** `fetchCustomerByPhone(tenantId, phone)` returns `{ client, recentJobs, outstandingInvoices, lastVisitDate }` via Jobber GraphQL in <500ms p95 with 5-min cache
- **JOBBER-03:** `/api/webhooks/jobber` invalidates customer-context cache on client/job/invoice events
- **JOBBER-04:** LiveKit agent merges Jobber + Xero context into the system prompt (Jobber preferred for home-service trade context)
- **JOBBER-05:** `check_customer_account()` tool returns combined Jobber + Xero data when both providers connected

### Jobber Schedule Mirror (Phase 57)

- **JOBSCHED-01:** `calendar_events.provider` CHECK constraint includes `'jobber'`; Jobber visit/job webhook syncs into local `calendar_events` table
- **JOBSCHED-02:** Slot availability checks (`check_availability` tool) cover Google + Outlook + Jobber events through a single `calendar_events` query — zero added call-path latency
- **JOBSCHED-03:** A poll-fallback cron handles missed Jobber webhooks; subscription renewal is added to `/api/cron/renew-calendar-channels`
- **JOBSCHED-04:** Per-tenant "bookable users" set — mirror only syncs visits whose assignees intersect this set (mirrors Jobber's own "bookable team members" pattern, avoids over-blocking multi-user accounts). Stored on the Jobber connection row (new `jobber_connections` table or `jobber_bookable_user_ids text[]` on existing row — finalize during planning). Connect flow pulls Jobber users, pre-selects users with ≥1 visit in the last 30 days, auto-skips the picker if the Jobber account has only one user, and lets the owner confirm/deselect. Settings panel allows later edits; changing the set triggers a re-sync of `calendar_events` (add newly-mirrored user visits, delete de-selected user visits)
- **JOBSCHED-05:** Dashboard calendar uses "thin overlay" model — Voco-booked appointments render first-class (full colour, editable: status, cancel, notes); mirrored Jobber visits render muted with a "From Jobber" pill, are not editable in Voco, and click-through opens the specific visit in Jobber in a new tab (falls back to the Jobber schedule day-view if per-visit URL unavailable). Same visual treatment applied consistently to existing Google/Outlook external events
- **JOBSCHED-06:** Interim "Not in Jobber yet" UX for Voco-booked appointments (active until Phase 999.3 push ships) — each appointment surfaces a visible badge + "Copy details to clipboard" action producing a paste-ready block (client, address, start, duration, notes) + "Open Jobber" deep link to the new-visit screen; the existing booking-complete email (or a new template if absent — confirm during planning) includes the same copy block and Jobber link. Dashboard banner on the calendar page messages "Jobber push is coming soon — Voco bookings stay in Voco until then; click a booking to copy it into Jobber"
- **JOBSCHED-07:** Voco booking ID (UUID) persisted on the appointment row as the idempotency key for Phase 999.3 push — ensures visits manually copied into Jobber during the interim period are deduplicated when bidirectional push ships

### Setup Checklist + Skills + Telemetry (Phase 58)

- **CHECKLIST-01:** `connect_jobber` and `connect_xero` items appear in the post-onboarding setup checklist (`/api/setup-checklist`); completion auto-detected via `accounting_credentials` row presence
- **CHECKLIST-02:** Connection cards for both providers live in `/dashboard/more/integrations` and follow the existing CalendarSyncCard pattern
- **CTX-01:** Telemetry logged to `accounting_credentials.last_context_fetch_at` and (lightweight) activity_log for fetch duration + cache hit rate per tenant per provider
- **CTX-02:** New skill file `integrations-jobber-xero` documents OAuth flow, refresh logic, caching, agent-side injection, checklist entries, webhook invalidation
- **CTX-03:** `voice-call-architecture` and `dashboard-crm-system` skills updated; `CLAUDE.md` references new skill

### v5.0 Phase 51 Polish Absorbed (Phase 58 tail)

- **POLISH-01 (deferred from v5.0):** Empty states for leads, calls, calendar, analytics with icon + headline + primary CTA
- **POLISH-02 (deferred from v5.0):** Loading skeleton screens prevent CLS on dashboard data-fetch pages
- **POLISH-03 (deferred from v5.0):** Consistent focus rings on all interactive elements via design-token focus color
- **POLISH-04 (deferred from v5.0):** Inline error states with Retry button replace frozen spinners
- **POLISH-05 (deferred from v5.0):** Async action buttons show spinner + disabled state during pending operation

## v3.0 Requirements

### Billing Foundation

- [x] **BILL-01**: Stripe products and prices created for Starter ($99/mo, 40 calls), Growth ($249/mo, 120 calls), Scale ($599/mo, 400 calls) with Price IDs stored in env vars
- [x] **BILL-02**: Subscriptions database table with tenant_id, stripe_customer_id, stripe_subscription_id, status, plan_id, calls_limit, calls_used, trial_ends_at, current_period_start/end, cancel_at_period_end — RLS: SELECT for authenticated, INSERT/UPDATE only via service_role
- [x] **BILL-03**: Usage events table with call_id idempotency key (ON CONFLICT DO NOTHING) and stripe_webhook_events table with UNIQUE on event_id
- [x] **BILL-04**: Stripe webhook handler at /api/stripe/webhook with request.text() signature verification, idempotency check, and stripe_updated_at version protection for out-of-order events
- [x] **BILL-05**: All subscription lifecycle events synced to local DB (created, updated, deleted, paused, resumed, trial_will_end)
- [x] **BILL-06**: Trial auto-start at onboarding completion — creates Stripe customer + 14-day trial subscription with CC required, writes local subscriptions row synchronously

### Usage Tracking

- [x] **USAGE-01**: Per-call usage increment via atomic Postgres RPC (increment_calls_used) on call_ended webhook — minimum 10-second duration filter, test call exclusion
- [x] **USAGE-02**: Usage events row inserted per call with call_id as idempotency key — prevents double-counting from webhook retries
- [x] **USAGE-03**: Calls_used reset to 0 triggered by invoice.paid webhook with billing_reason = subscription_cycle — not a cron job

### Enforcement

- [x] **ENFORCE-01**: Subscription check added to handleInbound() as parallel Supabase query — zero net latency increase on call pickup
- [x] **ENFORCE-02**: Block call if subscription status is cancelled/paused/expired OR calls_used >= calls_limit — play graceful caller message via AI prompt dynamic variable
- [x] **ENFORCE-03**: Past_due status gets 3-day grace window before blocking — owner continues receiving calls while payment retries happen
- [x] **ENFORCE-04**: Subscription status middleware gates dashboard routes — cancelled/paused/expired redirects to /billing/upgrade

### Billing UI

- [x] **BILLUI-01**: Billing dashboard page at /dashboard/more/billing — current plan card, usage meter (X of Y calls), renewal/trial-end date, Stripe Customer Portal link
- [x] **BILLUI-02**: Trial countdown banner in dashboard layout — shows "X days left in trial" with upgrade CTA, visible across all dashboard pages
- [x] **BILLUI-03**: Post-trial paywall page at /billing/upgrade — plan comparison, Stripe Checkout links for each tier, shown to expired/cancelled tenants
- [x] **BILLUI-04**: Stripe Checkout flow — plan selection, Checkout Session in subscription mode with CC required, success redirect to dashboard
- [x] **BILLUI-05**: Stripe Customer Portal integration — plan changes, cancellation, invoice history, payment method update; linked from billing page

### Billing Notifications

- [x] **BILLNOTIF-01**: Failed payment SMS + email to owner on invoice.payment_failed with payment update link (Stripe Customer Portal URL)
- [x] **BILLNOTIF-02**: Trial reminder email at day 7 and day 12 via cron job + Resend template
- [x] **BILLNOTIF-03**: Trial-will-end notification triggered by customer.subscription.trial_will_end webhook (3 days before expiry)

### Billing Documentation

- [ ] **BILLDOC-01**: Billing/payment architecture skill file created — covers full Stripe integration, DB tables, webhook handling, enforcement logic, subscription lifecycle
- [ ] **BILLDOC-02**: CLAUDE.md updated to include billing-payment skill in the architecture skill files list with sync requirement

### Country-Aware Onboarding and Number Provisioning

- [x] **COUNTRY-01**: "Your Details" step collects full name, personal phone number, and country (SG/US/CA) — all three fields saved to tenants table with phone in E.164 format
- [x] **COUNTRY-02**: phone_inventory table with SG pre-purchased numbers, real-time availability count API, race-safe assign_sg_number RPC with FOR UPDATE SKIP LOCKED
- [x] **COUNTRY-03**: Singapore waitlist UI when zero numbers available — email capture + waitlist table, blocks onboarding progression
- [x] **COUNTRY-04**: Singapore number assigned from phone_inventory after checkout.session.completed webhook — atomic RPC prevents double-assignment
- [x] **COUNTRY-05**: US/Canada number provisioned via retell.phoneNumber.create({ country_code }) after checkout success — Retell handles Twilio internally
- [x] **COUNTRY-06**: Test call step removed from onboarding wizard, wizard shows 5 steps (Profile, Services, Your Details, Plan Selection, Checkout Success)
- [x] **COUNTRY-07**: Onboarding-flow skill file updated to reflect 5-step wizard, country-aware provisioning, new API routes, deprecated routes

### Hero Section Interactive Demo

- [x] **DEMO-01**: Hero section shows business name input field instead of CTA buttons — no eyebrow pill, no social proof, no Watch Demo button
- [x] **DEMO-02**: After entering business name and clicking "Listen to Your Demo", audio player replaces input bar in-place with waveform visualizer and play/pause controls
- [x] **DEMO-03**: Audio plays scripted HVAC conversation with visitor's business name dynamically inserted via ElevenLabs TTS
- [x] **DEMO-04**: Hero title is shorter than current version and RotatingText component adjusts width responsively to match cycling word length
- [x] **DEMO-05**: Demo audio loads and begins playing within 3 seconds of button click

### Future Requirements (Deferred)

- [ ] **BILLF-01**: 80% usage alert — SMS + email to owner when calls_used >= 0.8 * calls_limit with usage_alert_sent flag to prevent repeats
- [ ] **BILLF-02**: Per-call overage billing beyond plan limit via Stripe Billing Meters v2 — requires metered price configuration

### Call Routing Webhook Foundation (Phase 39)

- [x] **ROUTE-01**: Migration `042_call_routing_schema.sql` adds `call_forwarding_schedule JSONB NOT NULL DEFAULT '{"enabled":false,"days":{}}'::jsonb`, `pickup_numbers JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_array_length(pickup_numbers) <= 5)`, and `dial_timeout_seconds INTEGER NOT NULL DEFAULT 15` on `tenants`; `routing_mode TEXT CHECK (routing_mode IN ('ai','owner_pickup','fallback_to_ai'))` nullable and `outbound_dial_duration_sec INTEGER` nullable on `calls`; creates `idx_calls_tenant_month ON calls (tenant_id, created_at)`
- [x] **ROUTE-02**: FastAPI webhook service runs in the livekit-agent Railway process on port 8080, exposing `POST /twilio/incoming-call`, `POST /twilio/dial-status`, `POST /twilio/dial-fallback`, `POST /twilio/incoming-sms`, plus `GET /health` and `GET /health/db` ports of the deleted `src/health.py` routes; booted via `start_webhook_server()` daemon thread from `src/agent.py` before `cli.run_app(...)`
- [x] **ROUTE-03**: All `/twilio/*` endpoints verify `X-Twilio-Signature` via a router-level FastAPI dependency that reconstructs the URL using `x-forwarded-proto` + `host` headers; invalid/missing signature → HTTP 403; `ALLOW_UNSIGNED_WEBHOOKS=true` env var bypasses verification with a warning log (dev only; fail-closed default)
- [x] **ROUTE-04**: Pure function `evaluate_schedule(schedule: dict, tenant_timezone: str, now_utc: datetime) -> ScheduleDecision` in `src/webhook/schedule.py` correctly handles empty/missing schedule, `enabled:false`, per-day ranges in tenant timezone, overnight ranges encoded as `end < start`, DST spring-forward gaps, DST fall-back folds, and exact start/end boundary moments (start inclusive, end exclusive) — verified by unit tests in `tests/webhook/test_schedule.py`
- [x] **ROUTE-05**: Function `check_outbound_cap(tenant_id: str, country: str) -> bool` in `src/webhook/caps.py` enforces US/CA 5000-minute and SG 2500-minute monthly caps by summing `outbound_dial_duration_sec` from `calls` where `created_at >= date_trunc('month', now())` for the given tenant; returns True if under cap, False if at/over; unknown country falls back to US limit
- [x] **ROUTE-06**: Zero production Twilio numbers are reconfigured — `/twilio/incoming-call` performs a tenant lookup via `_normalize_phone(To)` but always returns a hardcoded "always-AI" `<Response><Dial><Sip>{LIVEKIT_SIP_URI}</Sip></Dial></Response>` TwiML regardless of result, exercising the full wiring path (signature → URL reconstruction → form parse → tenant lookup → TwiML render) so that Phase 40's diff is a one-line replacement of the hardcoded branch with `evaluate_schedule` + `check_outbound_cap` composition



### Call Routing Dashboard and Launch (Phase 41)

- [x] **ROUTE-13**: Dashboard page at `/dashboard/more/call-routing` with schedule editor (Mon-Sun day list, per-day enable toggle, start/end time pickers using native HTML time inputs), master ON/OFF toggle mapping to `call_forwarding_schedule.enabled`, "Copy from working hours" button that transforms `tenants.working_hours` (full day name keys) to routing schedule (3-letter keys), and dial timeout slider (10-30s, default 15s) using shadcn Slider component
- [x] **ROUTE-14**: `GET /api/call-routing` returns `call_forwarding_schedule`, `pickup_numbers`, `dial_timeout_seconds`, current month outbound minutes usage (`SUM(outbound_dial_duration_sec)` from calls table with null-safe coercion), and `working_hours` for copy feature; `PUT /api/call-routing` validates E.164 phone numbers, no duplicates, no self-reference to tenant Twilio number, max 5 entries, valid HH:MM time ranges (start != end), dial_timeout 10-30, and cross-field guard (enabled schedule + zero pickup numbers = 400)
- [x] **ROUTE-15**: Usage meter section showing "X of Y outbound minutes used this month" with horizontal progress bar, color thresholds (green <70%, amber 70-90%, red >90%), cap value displayed (US/CA 5000 min, SG 2500 min based on `tenants.country`), and "Resets on the 1st of each month" footnote
- [x] **ROUTE-16**: Routing mode badges on calls page: `ROUTING_STYLE` map with `ai` (stone "AI"), `owner_pickup` (blue "You answered"), `fallback_to_ai` (amber "Missed -> AI"); `routing_mode` and `outbound_dial_duration_sec` added to calls API select query; null routing_mode renders no badge
- [x] **ROUTE-17**: Owner-pickup call cards in calls page show caller phone + duration + "You handled this call directly" text + Call Back action; AI-specific expanded details (urgency, booking outcome, recording, language) hidden for owner-pickup; owner-pickup calls appear in same list as AI calls (no separate tab/filter)
- [x] **ROUTE-18**: Setup checklist includes optional "Configure call routing" step (`id: configure_call_routing`) that links to `/dashboard/more/call-routing` and is complete when `call_forwarding_schedule.enabled === true` AND `pickup_numbers.length >= 1`; call routing entry added to More page `MORE_ITEMS` array; AI Voice Settings page links to call routing page

### Calendar Essentials — Time Blocks and Mark Complete (Phase 42)

- [x] **CAL-01**: Migration `044_calendar_blocks_and_completed_at.sql` creates `calendar_blocks` table with `id uuid PK`, `tenant_id uuid NOT NULL REFERENCES tenants(id)`, `title text NOT NULL`, `start_time timestamptz NOT NULL`, `end_time timestamptz NOT NULL`, `is_all_day boolean NOT NULL DEFAULT false`, `note text`, `created_at timestamptz NOT NULL DEFAULT now()` — 4 RLS policies (SELECT, INSERT, UPDATE, DELETE) restricting to tenant owner, index on `(tenant_id, start_time, end_time)`
- [x] **CAL-02**: Same migration adds `completed_at timestamptz` nullable column to `appointments` table
- [x] **CAL-03**: CRUD API at `/api/calendar-blocks` (GET list with date range filter, POST create) and `/api/calendar-blocks/[id]` (PATCH update, DELETE) — all routes use `getTenantId()` + service-role Supabase with `.eq('tenant_id', tenantId)` guard
- [x] **CAL-04**: `PATCH /api/appointments/[id]` extended with `status: 'completed'` branch (sets `completed_at` timestamp, appends optional notes with `[Completed]` prefix) and `status: 'confirmed'` branch (undo — clears `completed_at`)
- [x] **CAL-05**: `TimeBlockSheet` component — Sheet (side=right) for creating and editing time blocks with title, date, start/end time, all-day toggle, optional note; single component handles create mode (selectedBlock=null) and edit mode (selectedBlock=object) with Delete button
- [x] **CAL-06**: `TimeBlockEvent` renders on calendar as full-width hatched/striped background (diagonal `repeating-linear-gradient` at 45deg, slate-100 background, slate-400 border-left) at z-index 1 behind appointment blocks (z-index 10) — does NOT participate in `layoutEventsInLanes`
- [x] **CAL-07**: "Mark Complete" two-step button in `AppointmentFlyout` — click reveals expandable `Textarea` for optional completion notes, then "Confirm Complete" sends PATCH; flyout closes; sonner toast with 5-second "Undo" action that PATCHes back to confirmed
- [x] **CAL-08**: Completed appointments render at `opacity-40` with a 16x16 green circle checkmark badge (`bg-green-100 text-green-700`) at bottom-right corner; urgency color tint preserved; block remains clickable; flyout shows "Completed" badge and timestamp
- [x] **CAL-09**: "Show completed jobs" `Switch` toggle above calendar grid, default ON, persisted in `localStorage` key `voco_calendar_show_completed` — filters completed appointments client-side (no API change)
- [x] **CAL-10**: `available-slots/route.js` extended to 5-way parallel fetch including `calendar_blocks` — merged into `externalBlocks` parameter of `calculateAvailableSlots`; appointments query also excludes `status = 'completed'`
- [x] **CAL-11**: Python `check_availability.py` extended to 5-way `asyncio.gather` including `calendar_blocks` query — merged into `external_blocks` parameter; appointments query excludes both `cancelled` and `completed` via chained `.neq()` calls
### VIP Caller Direct Routing (Phase 46)

- [x] **VIP-01**: Migration 049 adds vip_numbers JSONB NOT NULL DEFAULT [] to tenants (no array length cap) and is_vip BOOLEAN NOT NULL DEFAULT false to leads with partial index idx_leads_vip_lookup ON leads (tenant_id, from_number) WHERE is_vip = true
- [x] **VIP-02**: GET /api/call-routing returns vip_numbers in response alongside schedule, pickup_numbers, dial_timeout
- [x] **VIP-03**: PUT /api/call-routing validates vip_numbers (E.164 format, no duplicates, array type) and persists alongside existing fields; no array length cap
- [x] **VIP-04**: PATCH /api/leads/[id] accepts is_vip boolean and persists it
- [x] **VIP-05**: GET /api/leads list endpoint includes is_vip in explicit column select so LeadCard can render VIP badge
- [x] **VIP-06**: _is_vip_caller(tenant, from_number) function in twilio_routes.py checks both tenant vip_numbers JSONB array (in-memory) and leads table is_vip=true query (DB hit); returns True if either matches; fail-open on error
- [x] **VIP-07**: VIP check inserted in incoming_call routing AFTER subscription check and BEFORE evaluate_schedule; VIP match routes to _owner_pickup_twiml bypassing schedule and cap checks; VIP match with no pickup_numbers falls through to AI TwiML
- [x] **VIP-08**: Tenant lookup SELECT in twilio_routes.py includes vip_numbers field
- [x] **VIP-09**: VIP Callers section on /dashboard/more/call-routing rendered OUTSIDE AnimatePresence (always visible regardless of schedule toggle), with inline card list + add form pattern matching pickup numbers section
- [x] **VIP-10**: VIP numbers on call routing page support add, edit, delete with E.164 validation, duplicate detection, no length cap; saved via existing PUT alongside schedule/pickup/timeout
- [x] **VIP-11**: VIP badge (violet-100/violet-700, filled Star icon, VIP text) renders on LeadCard before urgency badge when lead.is_vip === true
- [x] **VIP-12**: VIP Caller toggle (Switch) in LeadFlyout between contact details and Pipeline Status PATCHes /api/leads/[id] with is_vip boolean; optimistic UI with revert on error; guarded by lead.from_number presence
- [x] **VIP-13**: VIP routing uses existing owner_pickup routing_mode (no new enum value); VIP calls appear with same blue You answered badge on calls page

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
- [x] **SETUP-02**: Every dashboard page with no data shows a helpful empty state with icon, description, and actionable CTA — not a blank page or generic "no data" message
- [x] **SETUP-03**: Owner can trigger a test voice call from dashboard settings and hear their AI receptionist answer without looking up the phone number
- [x] **SETUP-04**: Checklist progress persists across sessions via DB; checklist auto-dismisses on full completion or manual dismiss
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
| Payment processing / deposit collection | PCI compliance scope too large for v1; Stripe Checkout handles PCI in v3.0 |
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
| SETUP-02 | Phase 10 | Complete |
| SETUP-03 | Phase 10 | Complete |
| SETUP-04 | Phase 10 | Complete |
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
| BILL-01 | Phase 22 | Complete |
| BILL-02 | Phase 22 | Complete |
| BILL-03 | Phase 22 | Complete |
| BILL-04 | Phase 22 | Complete |
| BILL-05 | Phase 22 | Complete |
| BILL-06 | Phase 22 | Complete |
| USAGE-01 | Phase 23 | Complete |
| USAGE-02 | Phase 23 | Complete |
| USAGE-03 | Phase 23 | Complete |
| ENFORCE-03 | Phase 24 | Complete |
| ENFORCE-04 | Phase 24 | Complete |
| BILLNOTIF-01 | Phase 24 | Complete |
| BILLNOTIF-02 | Phase 24 | Complete |
| BILLNOTIF-03 | Phase 24 | Complete |
| ENFORCE-01 | Phase 25 | Complete |
| ENFORCE-02 | Phase 25 | Complete |
| BILLUI-01 | Phase 25 | Complete |
| BILLUI-02 | Phase 25 | Complete |
| BILLUI-03 | Phase 25 | Complete |
| BILLUI-04 | Phase 25 | Complete |
| BILLUI-05 | Phase 25 | Complete |
| BILLDOC-01 | Phase 26 | Pending |
| BILLDOC-02 | Phase 26 | Pending |

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

| COUNTRY-01 | Phase 27 | Complete |
| COUNTRY-02 | Phase 27 | Complete |
| COUNTRY-03 | Phase 27 | Complete |
| COUNTRY-04 | Phase 27 | Complete |
| COUNTRY-05 | Phase 27 | Complete |
| COUNTRY-06 | Phase 27 | Complete |
| COUNTRY-07 | Phase 27 | Complete |
n| DEMO-01 | Phase 29 | Complete |
| DEMO-02 | Phase 29 | Complete |
| DEMO-03 | Phase 29 | Complete |
| DEMO-04 | Phase 29 | Complete |
| DEMO-05 | Phase 29 | Complete |
| ROUTE-01 | Phase 39 | Complete |
| ROUTE-02 | Phase 39 | Complete |
| ROUTE-03 | Phase 39 | Complete |
| ROUTE-04 | Phase 39 | Complete |
| ROUTE-05 | Phase 39 | Complete |
| ROUTE-06 | Phase 39 | Complete |
| ROUTE-13 | Phase 41 | Complete |
| ROUTE-14 | Phase 41 | Complete |
| ROUTE-15 | Phase 41 | Complete |
| ROUTE-16 | Phase 41 | Complete |
| ROUTE-17 | Phase 41 | Complete |
| ROUTE-18 | Phase 41 | Complete |
| VIP-01 | Phase 46 | Complete |
| VIP-02 | Phase 46 | Complete |
| VIP-03 | Phase 46 | Complete |
| VIP-04 | Phase 46 | Complete |
| VIP-05 | Phase 46 | Complete |
| VIP-06 | Phase 46 | Complete |
| VIP-07 | Phase 46 | Complete |
| VIP-08 | Phase 46 | Complete |
| VIP-09 | Phase 46 | Complete |
| VIP-10 | Phase 46 | Complete |
| VIP-11 | Phase 46 | Complete |
| VIP-12 | Phase 46 | Complete |
| VIP-13 | Phase 46 | Complete |

**v3.0 Coverage:**
- v3.0 requirements: 35 total (BILL-01-06, USAGE-01-03, ENFORCE-01-04, BILLUI-01-05, BILLNOTIF-01-03, BILLDOC-01-02, COUNTRY-01-07, DEMO-01-05)
- Mapped to phases: 35
- Unmapped: 0

**v4.0+ Coverage (Phases 39-46):**
- ROUTE-01-06 | Phase 39 | Complete
- ROUTE-13-18 | Phase 41 | Complete
- VIP-01-13 | Phase 46 | Complete
- Mapped: 25
- Unmapped: 0

**v5.0 Coverage:**

| Requirement | Phase | Status |
|-------------|-------|--------|
| OBJ-01 | Phase 47 | Pending |
| OBJ-02 | Phase 47 | Pending |
| OBJ-03 | Phase 47 | Pending |
| OBJ-04 | Phase 47 | Pending |
| OBJ-05 | Phase 47 | Pending |
| OBJ-06 | Phase 47 | Pending |
| OBJ-07 | — | Addressed elsewhere (pricing page ROICalculator) |
| OBJ-08 | Phase 47 | Pending |
| OBJ-09 | Phase 47 | Pending |
| REPOS-01 | Phase 47 | Pending |
| REPOS-02 | Phase 47 | Pending |
| REPOS-03 | Phase 47 | Pending |
| REPOS-04 | Phase 47 | Pending |
| POLISH-11 | Phase 47 | Pending |
| POLISH-12 | Phase 47 | Pending |
| HOME-01 | Phase 48 | Complete |
| HOME-02 | Phase 48 | Complete |
| HOME-03 | Phase 48 | Complete |
| HOME-04 | Phase 48 | Complete |
| HOME-05 | Phase 48 | Complete |
| HOME-06 | Phase 48 | Complete |
| HOME-07 | Phase 48 | Complete |
| DARK-01 | Phase 49 | Pending |
| DARK-02 | Phase 49 | Pending |
| DARK-03 | Phase 49 | Complete |
| DARK-04 | Phase 49 | Pending |
| DARK-06 | Phase 49 | Pending |
| DARK-07 | Phase 49 | Pending |
| DARK-08 | Phase 49 | Pending |
| DARK-09 | Phase 49 | Pending |
| POLISH-08 | Phase 49 | Complete |
| DARK-05 | Phase 50 | Pending |
| DARK-10 | Phase 50 | Pending |
| POLISH-01 | Phase 51 | Pending |
| POLISH-02 | Phase 51 | Pending |
| POLISH-03 | Phase 51 | Pending |
| POLISH-04 | Phase 51 | Pending |
| POLISH-05 | Phase 51 | Pending |
| POLISH-06 | Phase 51 | Pending |
| POLISH-07 | Phase 51 | Pending |
| POLISH-09 | Phase 51 | Pending |
| POLISH-10 | Phase 51 | Pending |

- v5.0 requirements: 42 total (OBJ-01-09, REPOS-01-04, HOME-01-07, DARK-01-10, POLISH-01-12)
- Mapped to phases: 42
- Unmapped: 0

---

## v5.0 Requirements — Trust & Polish

### Objection-Busting Landing Sections

- [ ] **OBJ-01**: Visitor can read an FAQ accordion (≥7 questions) covering all 5 PROBLEMS.md objections + the identity/change-aversion objection, placed just above FinalCTASection
- [ ] **OBJ-02**: Visitor sees a "sounds robotic" counter section linking back to the live hero demo as proof, including the 85% blind-test stat
- [ ] **OBJ-03**: Visitor sees a "cost of inaction" stat block with the $260,400/year-lost-to-voicemail figure contextualized against Voco's starting price
- [ ] **OBJ-04**: Visitor sees a "5-minute setup" 3-step visual strip (forward number → set hours → live) countering the tech-savvy objection
- [ ] **OBJ-05**: Visitor sees a trust/hybrid-backup badge row highlighting human escalation, recorded + transcribed calls, and owner-controlled escalation chain
- [ ] **OBJ-06**: Visitor sees an identity/change-aversion block with emotional copy framing Voco as complement ("your voice, just always-on"), not replacement
- [~] **OBJ-07**: ~~Visitor can use an interactive revenue-loss calculator~~ — **Addressed elsewhere:** Already implemented on `/pricing` page (`src/app/(public)/pricing/ROICalculator.jsx`). Duplicating on landing deemed redundant during Phase 47 discuss-phase (2026-04-13). Moved out of Phase 47 scope; landing will instead anchor OBJ-03 cost-of-inaction stat with a link to pricing calculator.
- [ ] **OBJ-08**: Visitor sees a Before-vs-After workflow comparison strip showing miss-call-lose-lead vs every-call-answered outcome
- [ ] **OBJ-09**: Visitor sees a trade-specificity proof block demonstrating Voco's understanding of plumbing/HVAC/electrical terminology

### Landing Page Repositioning

- [ ] **REPOS-01**: Landing hero H1 and subtitle copy reframed to complement-not-replacement language ("answers when you can't", "you stay in charge")
- [ ] **REPOS-02**: FinalCTASection subtitle reinforces owner-control framing ("your rules, your schedule")
- [ ] **REPOS-03**: Visitor sees a 5-icon full-stack workflow positioning strip (answer → triage → book → notify → CRM) making whole-workflow positioning visible
- [ ] **REPOS-04**: Visitor sees an owner-control emphasis callout/pull-quote ("You set the rules. Voco follows them.")

### Dashboard Home Redesign

- [x] **HOME-01**: Dashboard home shows a redesigned setup checklist with a progress indicator, items grouped by theme (profile, voice, calendar, billing), each with dismiss / mark-done / jump-to-page actions
- [x] **HOME-02**: Dashboard home shows a daily-ops hub with at-a-glance cards: today's appointments, recent calls (last 24h), hot/new leads, usage meter
- [x] **HOME-03**: Setup checklist auto-detects completion of onboarding items (phone, services, hours, calendar, billing) and updates progress without user action
- [x] **HOME-04**: Dashboard home includes an integrated AI chat surface (card/panel, not just a floating button) where owners can ask questions and get dashboard navigation help from first paint
- [x] **HOME-05**: AI chat surface on home shares message history with the existing ChatbotSheet so conversations continue across entry points
- [x] **HOME-06**: Dashboard home includes a Help & Discoverability section with quick-links to common tasks ("how do I add a service", "where do I find invoices") that deep-link into the correct page
- [x] **HOME-07**: Dashboard home is fully responsive at 375px — card stacks reflow to single column without horizontal scroll

### Dashboard Dark Mode

- [ ] **DARK-01**: Theme provider (next-themes) is wired into root layout with `suppressHydrationWarning` on `<html>`, `defaultTheme=system`, `enableSystem=true`, and no hydration flash
- [ ] **DARK-02**: Owner can toggle between light/dark/system via a theme toggle button in the dashboard sidebar; preference persists across sessions via localStorage
- [x] **DARK-03**: All dashboard component files replace hardcoded hex color classes with dark-mode-aware equivalents (`dark:` prefix or CSS-variable-backed tokens)
- [ ] **DARK-04**: `design-tokens.js` exports dark variants for all tokens (card.base, glass.topBar, heading, body, focus, selected) so shared consumers theme consistently
- [ ] **DARK-05**: `AnalyticsCharts.jsx` reads the current theme via `useTheme()` and swaps Recharts stroke/fill/tooltip colors so charts remain readable and on-brand in dark mode
- [ ] **DARK-06**: All flyouts and modals (LeadFlyout, AppointmentFlyout, QuickBookSheet, ChatbotSheet, settings modals) render correctly in dark mode with readable content
- [ ] **DARK-07**: Status badges, urgency pills, and LeadStatusPills have dark-mode variants that preserve contrast and category meaning
- [ ] **DARK-08**: Dashboard layout background, sidebar, bottom tab bar, and system banners (impersonation, billing warning, trial countdown) all respond correctly to theme
- [ ] **DARK-09**: Body smoothly transitions background and text color (150ms) on theme switch without jank
- [ ] **DARK-10**: CalendarView urgency colors (dynamic class concatenation) render correctly in dark mode

### UI/UX Polish (Dashboard + Landing)

- [ ] **POLISH-01**: All dashboard list views (leads, calls, calendar, analytics) have dedicated empty states with icon + headline + primary CTA when no data exists
- [ ] **POLISH-02**: All dashboard pages show layout-matching loading skeletons during data fetch (not blank flashes), preventing CLS
- [ ] **POLISH-03**: All interactive elements (buttons, inputs, nav items, pill filters) have consistent `focus-visible` rings using the design-token focus color
- [ ] **POLISH-04**: All data-fetching pages show an error state with a retry action when fetches fail, instead of frozen UI
- [ ] **POLISH-05**: Async action buttons show spinner + disabled state during pending operations (save settings, send invoice, sync calendar)
- [ ] **POLISH-06**: DashboardHomeStats cards have a hover state (translate-y + shadow) with 200ms transition
- [ ] **POLISH-07**: Lead status changes in LeadFlyout animate in the list via AnimatePresence + layout prop for clear user feedback
- [x] **POLISH-08**: Dashboard typography consolidated to design-token color values (no lingering hardcoded hex text classes)
- [ ] **POLISH-09**: CommandPalette registers all major dashboard destinations; audit confirms no major page is missing
- [ ] **POLISH-10**: Dashboard page content renders correctly at 375px viewport (week calendar, analytics charts, invoice tables, settings forms)
- [ ] **POLISH-11**: All new objection and repositioning landing sections use the existing AnimatedSection wrapper with useReducedMotion compliance and match the established warm-neutral background rhythm
- [ ] **POLISH-12**: All new landing sections render single-column at 375px and grid/multi-column at md+ breakpoint

## v5.0 Future Requirements (Deferred)

- Cross-device theme sync via Supabase user preferences row (future milestone — localStorage sufficient for v5.0)
- Customizable dashboard home layout (drag-to-reorder widgets, show/hide cards) — deferred from v5.0 scoping as too high-effort for must-have value
- Anchor-linked landing-nav for new objection sections — low incremental conversion value
- Full mobile responsiveness deep audit beyond the 375px check — ongoing maintenance, not a milestone deliverable

## v5.0 Out of Scope

- Dark mode applied to public/landing pages (art-direction conflict; landing uses hardcoded hex as intentional brand)
- Video explainer embeds on landing (third-party cookie + LCP penalty; HeroDemoBlock already serves as interactive proof)
- Landing page competitor comparison tables (primes comparison-shopping in a trust-building context — frame vs voicemail, not vs competitors)
- Pop-up modal lead capture on landing (low-trust demographic; sticky CTA patterns serve the goal without "salesy" feel)
- Customer logo bar with enterprise logos (demographic mismatch — plumbers don't identify with enterprise brands)
- Storing theme preference in Supabase (localStorage via next-themes is sufficient for v5.0)
- Landing page chatbot (HeroDemoBlock already demonstrates product; adding chat creates mode confusion)

---
*Requirements defined: 2026-03-18 (v1.0), 2026-03-22 (v1.1), 2026-03-24 (v2.0), 2026-03-26 (v3.0), 2026-04-13 (v5.0)*
*Last updated: 2026-04-13 — v5.0 (Trust & Polish) requirements added: 42 requirements across 5 categories (OBJ, REPOS, HOME, DARK, POLISH)*

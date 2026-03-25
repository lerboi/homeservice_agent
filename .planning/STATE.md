---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Phases
status: Milestone complete
stopped_at: Phase 20 context gathered
last_updated: "2026-03-25T10:11:38.937Z"
progress:
  total_phases: 14
  completed_phases: 11
  total_plans: 51
  completed_plans: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-24)

**Core value:** Every inbound call is answered instantly and converted into a confirmed booking or qualified lead — no call goes to voicemail, no lead is lost to a competitor.
**Current focus:** Phase 18 — booking-first-hardening-and-qa

## Current Position

Phase: 18
Plan: Not started

### v2.0 Milestone Progress

```
Phase 14: Booking-First Agent Behavior      [ ] Not started
Phase 15: Call Processor + Triage Reclass    [ ] Not started
Phase 16: Notification Priority System       [ ] Not started
Phase 17: Recovery SMS Enhancement           [ ] Not started
Phase 18: Booking-First Hardening and QA     [ ] Not started
```

Progress: 0/5 v2.0 phases complete

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Vapi over raw Twilio+STT — faster to market, proven low-latency voice
- [Init]: Lead tracker only, not full CRM — avoid competing with ServiceTitan/Jobber
- [Init]: Voice-first, defer chat channels — calls are where leads are lost
- [Init]: Multi-language from day one — retrofitting is harder and more expensive
- [Research]: Local DB mirror is source of truth for availability — never query Google/Outlook in call hot path
- [Research]: Redis SET NX + Postgres SELECT FOR UPDATE double-lock for atomic slot reservation
- [Research]: Language abstraction layer must precede any language-specific content (Phase 1 gate)
- [Phase 01]: Use node jest-cli/bin/jest.js instead of .bin/jest shim for Windows bash compatibility
- [Phase 01]: Add type:module to package.json — next.config.js uses ES module syntax
- [Phase 01]: next-intl cookie-based locale without URL prefix routing for API-first multi-tenant app
- [Phase 01 P03]: Direct JSON import of translation files (not next-intl runtime) — buildSystemPrompt runs outside Next.js context
- [Phase 01 P03]: transfer_call function takes no parameters — call context (owner_phone) resolved server-side by webhook handler
- [Phase 01 P03]: Always capture caller info BEFORE invoking transfer_call — lead preserved even if transfer fails (locked product decision)
- [Phase 01-02]: Webhook defers heavy work via after() — returns 200 immediately, recording/transcript processing runs post-response
- [Phase 01-02]: Language barrier detection uses i18n/routing.js locales as single source of truth — any detected_language not in locales array triggers language_barrier=true
- [Phase 01-02]: transfer_call two-hop query (calls->tenants) for owner_phone lookup rather than embedding in dynamic_variables at call start
- [Phase 02-01]: Tone preset voice_speed values: professional=0.95, friendly=1.05, local_expert=0.90
- [Phase 02-01]: TRIAGE-AWARE BEHAVIOR section injected only when onboarding_complete=true to avoid confusing pre-onboarding AI
- [Phase 02-01]: TONE_LABELS fallback to professional preset for unknown/missing tone_preset values
- [Phase 02-02]: Routine patterns checked before emergency patterns — prevents "not urgent" false-positive on emergency keyword "urgent"
- [Phase 02-02]: Layer 3 applyOwnerRules returns { urgency, escalated } shape — lets classifier report layer:'layer3' accurately
- [Phase 02-02]: classifyCall returns early with routine/low/layer1 for empty or < 10 char transcripts — no LLM cost
- [Phase 02-02]: openai SDK installed as runtime dependency — GPT-4o-mini for Layer 2 cost-effective classification
- [Phase 02-05]: classifyCall called after recording upload and language barrier detection — triage does not block those operations
- [Phase 02-05]: tone_preset defaults to professional when tenant not found or field is null — consistent with Phase 02-01 tone preset system
- [Phase 02-03]: Tailwind v4 uses @import 'tailwindcss' in CSS + @tailwindcss/postcss plugin (no tailwind.config.js)
- [Phase 02-03]: OpenAI client in layer2-llm.js lazy-instantiated (getClient() pattern) to prevent build failure without OPENAI_API_KEY
- [Phase 02-03]: shadcn CLI v4 --style flag removed; components.json created manually with new-york style
- [Phase 02-06]: Soft-delete via is_active=false preserves call history and audit trail
- [Phase 02-06]: Working hours jsonb nullable stub satisfies ONBOARD-03; full UI in Phase 3
- [Phase 02-06]: Dashboard layout is single-column with breadcrumb — sidebar nav deferred to Phase 4
- [Phase 02-04]: onboarding_complete flag set atomically with test call trigger — not on Retell webhook callback
- [Phase 02-04]: Wizard Step 3 uses 3 internal sub-states (phone, otp, provisioning) in one page component — avoids route flicker
- [Phase 02-04]: Email collected alongside phone in sms-confirm — single round-trip saves owner_phone and owner_email
- [Phase 02.1-01]: Tailwind v4 landing tokens use hex values (not oklch) — updated palette: hero/footer #050505 (near-black), accent #F97316 (warm orange), light sections #F5F5F4, muted #475569, success #166534
- [Phase 02.1-01]: AnimatedSection useReducedMotion with initial={false} skips animation state entirely when prefers-reduced-motion OS setting is active — Framer Motion v12 pattern
- [Phase 02.1-02]: All section components are Server Components — no use client; client animation delegated to AnimatedSection from Plan 01 foundation
- [Phase 02.1-02]: FinalCTASection uses inverted button (bg-landing-dark on bg-landing-accent) for contrast — dark button on copper background per UI-SPEC intent
- [Phase 02.1-02]: All section components are Server Components — no use client; client animation delegated to AnimatedSection from Plan 01 foundation
- [Phase 02.1-02]: Post-checkpoint design rebuild: all 7 sections rebuilt with design-engineer quality (bento grid, metric badges, radial gradients) after user requested visual improvements
- [Phase 02.1-02]: AnimatedSection gained direction prop (up/left/right) and stagger/item variant system — required for polished directional animations across sections
- [Phase 03-02]: book_appointment only injected when onboarding_complete=true — consistent with TRIAGE-AWARE BEHAVIOR gate
- [Phase 03-02]: BOOKING FLOW prompt section replaces 'cannot book appointments yet' placeholder when onboarding complete
- [Phase 03-02]: Address read-back is a mandatory blocking step — AI must not invoke book_appointment until caller verbally confirms
- [Phase 03-01]: Used pg_try_advisory_xact_lock (non-blocking) for atomic slot booking — prevents queue buildup under concurrent load
- [Phase 03-01]: jest.unstable_mockModule for ESM supabase mock in booking tests — consistent with project ESM pattern
- [Phase 03-01]: Tests placed in tests/scheduling/ not src/lib/scheduling/__tests__/ — matches jest.config.js testMatch pattern
- [Phase 03-06]: handleInbound fetches all scheduling data in parallel (Promise.all) before slot calculation
- [Phase 03-06]: suggested_slots only calculated for routine AND unbooked calls — emergency calls book during the call
- [Phase 03-06]: Calendar push always async via after() — never in synchronous call hot path
- [Phase 04-crm-dashboard-and-notifications]: Short call filter at 15 seconds — calls under 15s return null (voicemails, mis-dials)
- [Phase 04-crm-dashboard-and-notifications]: Repeat caller merge uses .in('status', ['new','booked']) — completed/paid/lost leads trigger new lead creation
- [Phase 04-crm-dashboard-and-notifications]: getLeads excludes transcript_text from list queries — fetched separately on lead detail view
- [Phase 04-crm-dashboard-and-notifications]: REPLICA IDENTITY FULL on leads table required for Supabase Realtime row-level change events
- [Phase 04-03]: appointmentId lookup uses targeted select after appointmentExists boolean — avoids redundant query when no booking
- [Phase 04-03]: sendOwnerNotifications is fire-and-forget (.catch pattern) — failure never blocks call record persistence
- [Phase 04-03]: Recovery cron limits to 10 calls per invocation for Twilio rate limit safety
- [Phase 04-06]: Counter animation uses requestAnimationFrame + ease-out cubic for smooth 600ms count-up; prefers-reduced-motion skips animation entirely
- [Phase 04-06]: Supabase Realtime keyframe injected once into document.head via ensureSlideInKeyframe() — avoids CSS module complexity
- [Phase 04-06]: LeadFlyout rendered outside card stack in leads page to avoid Sheet overlay stacking context issues
- [Phase 06-01]: (public) route group layout wraps all public pages — LandingNav and LandingFooter not in page components
- [Phase 06-01]: isRoot pattern for anchor links — sub-pages prefix / to navigate back and scroll
- [Phase 06-01]: Wave 0 contact-api.test.js intentionally RED — stub for Plan 06-03 API route implementation
- [Phase 06-03]: ContactForm named export (not default) -- consistent with component authoring pattern across the project
- [Phase 06-03]: Resend instantiated per-request in API route handler -- correct for serverless/stateless execution per RESEARCH.md
- [Phase 06-03]: Honeypot field returns 200 silently on fill -- avoids bot fingerprinting
- [Phase 06]: [Phase 06-02]: @radix-ui/react-accordion is the correct import path — radix-ui/react-accordion subpath does not exist as a module
- [Phase 06]: Accordion animation registered via --animate-* convention in @theme inline block (Tailwind v4 auto-generates animate-accordion-down utility)
- [Phase 06]: height: var(--radix-accordion-content-height) for smooth accordion height transition — Radix sets this CSS variable automatically at runtime
- [Phase 07]: AUTH_REQUIRED_PATHS guards wizard sub-paths and dashboard; /onboarding itself is public (it is the auth step)
- [Phase 07]: Middleware only queries onboarding_complete on /onboarding paths, not /dashboard — avoids unnecessary DB latency on every dashboard page load
- [Phase 07]: useWizardSession uses gsd_onboarding_ prefix for sessionStorage key isolation; clearWizardSession bulk-removes all keys on wizard completion
- [Phase 07]: OAuth callback default changed to /onboarding/profile so Google OAuth users skip step 1 (auth already done via Google)
- [Phase 07-unified-signup-and-onboarding-wizard]: onboarding_complete timing: webhook sets flag on call completion, not at trigger time — removed premature DB set from test-call route
- [Phase 07-unified-signup-and-onboarding-wizard]: retell_llm_dynamic_variables keeps onboarding_complete: true for AI behavior during test call (separate concern from DB wizard completion flag)
- [Phase 07-02]: Step 1 OTP phase uses useState toggle (not router.push) — keeps user in wizard card, avoids layout re-mount and progress bar flicker
- [Phase 07-02]: shouldCreateUser: false on signInWithOtp prevents duplicate user creation when OTP sent post-signUp (Research Pitfall 2)
- [Phase 07-02]: Two sequential POST calls to /api/onboarding/start in Step 2: business_name+tone first creates tenant, then trade+services saved (depends on tenant existing)
- [Phase 07-04]: TestCallPanel polling starts from both 'calling' and 'in_progress' states so a fast-completing call is caught even if in_progress transition hasn't occurred
- [Phase 07-04]: CelebrationOverlay skips rendering radial pulse divs entirely (not just removes animation class) when prefers-reduced-motion is active — avoids layout artifacts
- [Phase 11]: Hero Spline URL kept as TODO — D-03 community model prod URL requires manual Spline UI extraction before update
- [Phase 11]: CTA animation uses CSS-only prefers-reduced-motion guard — FinalCTASection stays Server Component, no useReducedMotion hook
- [Phase 11]: HowItWorksTabs uses roving tabindex per WAI-ARIA Tabs pattern; AnimatePresence mode=wait with key=active for sequential transitions
- [Phase 11]: HowItWorksSection rebuilt as Server Component with dynamic import of HowItWorksTabs for bundle splitting; 5th bento card uses variant=default consistent with cards 2 and 3
- [Phase 12]: RLS policy on escalation_contacts uses tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()) matching services table pattern from 002 migration
- [Phase 12]: PATCH reorder includes tenant_id in every upsert row — RLS WITH CHECK requires it (Pitfall 3 from RESEARCH.md)
- [Phase 12-02]: @dnd-kit/sortable for drag-to-reorder (keyboard accessible); bulk tag bar shown at >=2 selected; patchServiceOrder guards against concurrent PATCH with isSavingOrder flag
- [Phase 12]: SortableContactWrapper wraps useSortable inside EscalationChainSection — ContactCard stays clean and testable
- [v2.0 Roadmap]: Booking-first pivot is behavioral, not infrastructure — no new dependencies except Zod (already planned)
- [v2.0 Roadmap]: Triage pipeline UNCHANGED — consumers change (notification priority), not the pipeline itself
- [v2.0 Roadmap]: Two additive schema columns only: booking_outcome and exception_reason on calls table
- [v2.0 Roadmap]: Phase 16 and 17 can be parallelized — notification priority and recovery SMS are independent subsystems
- [Phase 08]: Direct fetch to Graph /me for calendar display name in callback -- simpler than exporting graphFetch
- [Phase 08]: Stub outlook-calendar.js for Plan 02 import resolution while Plan 01 runs in parallel
- [Phase 08]: Direct fetch for Outlook token refresh instead of MSAL cache (serverless-safe)
- [Phase 08]: pushBookingToCalendar queries by is_primary=true for primary calendar push (D-02)
- [Phase 08]: Store full deltaLink URL as last_sync_token (Graph API anti-pattern avoidance)
- [Phase 08]: PROVIDER_CONFIG map centralizes auth endpoints, icon colors, popup names per provider
- [Phase 08]: Optimistic UI for make-primary badge swap: instant swap, revert on server error
- [Phase 13-01]: LandingNav backdrop-blur changed from backdrop-blur-xl to backdrop-blur-[12px] per D-08 spec — explicit value enforces design contract
- [Phase 13-frontend-public-pages-redesign]: Auth page: Three conditional render branches for structurally distinct signup (split), signin (compact), and OTP (centered dark card) layouts — no tab/pill toggle
- [Phase 13-frontend-public-pages-redesign]: OtpInput: focus:border-[#F97316] + focus:ring-[#F97316]/30 without ring-offset eliminates white gap on dark backgrounds (Pitfall 7 avoidance)
- [Phase 13]: HowItWorksSection mobile fallback uses inline mobileSteps data (same source as HowItWorksSticky) to avoid additional dynamic import complexity on mobile
- [Phase 13]: ContactForm focus glow uses focus:shadow-[0_0_0_3px_rgba(249,115,22,0.2)] arbitrary Tailwind value — avoids inline styles while expressing box-shadow correctly
- [Phase 14]: Snapshot tests use node --experimental-vm-modules (package.json type:module + jest ESM requirement)
- [Phase 14]: buildWhisperMessage placed in src/lib/ (not Railway repo) — consumed by main app transfer handler
- [Phase 14]: Booking-first prompt.test.js assertions are deliberately failing RED — Plan 02 makes them GREEN
- [Phase 13-06]: Auth signup left panel changed to bg-white per user override of D-31 — #334155 was dark-on-dark, not the intended contrast
- [Phase 13-06]: OtpInput digit boxes use bg-stone-50 + border-stone-300 for white card context — copper focus ring preserved
- [Phase 14]: agent-prompt.js section builders kept in single file per RESEARCH.md (no new files, avoids import complexity)
- [Phase 14]: DECLINE_HANDLING gated by onboarding_complete — only active when booking protocol is active (consistent with D-16)
- [Phase 13-05]: HowItWorksSection uses #F5F5F4 light background (user override of D-18 charcoal spec) — creates visual rhythm break between dark hero and dark features sections
- [Phase 13-05]: LandingFooter requires use client for back-to-top scrollTo; newsletter form is display-only (no API wired) — visual upgrade deferred wiring
- [Phase 16]: Emergency detection uses strict equality urgency === 'emergency' — high_ticket and undefined fall to routine path
- [Phase 14]: end_call handler in WebSocket bypasses Groq entirely — sends end_call:true directly to Retell without continuation
- [Phase 14]: capture_lead computes duration from start_timestamp to avoid 15s short-call filter mid-call (Pitfall 3)
- [Phase 14]: whisper_message passed to retell.call.transfer() using AI-provided tool arguments (D-08)
- [Phase 15]: sendCallerSMS uses locale === 'es' check, falls back to en for all unknown locales — matches existing project locale pattern
- [Phase 15]: booking-outcome.test.js 2 of 7 tests pass GREEN immediately because current code already satisfies guard constraints — expected and correct Wave 0 behavior
- [Phase 15]: [Phase 15-02]: shouldCalculateSlots = !appointmentExists && tenantId replaces isRoutineUnbooked — all unbooked calls get suggested_slots regardless of urgency
- [Phase 15]: [Phase 15-02]: booking_outcome written real-time via after() during live call (booked/attempted/declined), not_attempted set conditionally post-call with IS NULL guard
- [Phase 19-01]: scheduling-calendar-system SKILL.md created as complete architectural reference; follow voice-call-architecture template exactly for section structure and depth
- [Phase 19]: dashboard-crm-system skill covers all 25 source files across dashboard pages, CRM components, API routes, DB migrations, and design system
- [Phase 19]: onboarding-flow skill covers all 24 source files: actual 4-step wizard (not 7), auth at /auth/signin is Step 1 outside wizard layout
- [Phase 19]: auth-database-multitenancy skill covers all 3 Supabase clients, getTenantId, middleware, RLS two-pattern design, and all 8 migrations with actual SQL
- [Phase 19]: public-site-i18n skill covers all 25+ source files: landing sections, pricing, about, contact, i18n, email templates
- [Phase 19]: CLAUDE.md maintenance directive updated from vague example to explicit list of all 6 skills
- [Phase 17]: sendCallerRecoverySMS returns structured { success, sid, error } — Plan 02 webhook trigger writes recovery_sms_status based on this return
- [Phase 17]: Emergency urgency uses empathetic-urgency template; bookingLink accepted but unused (D-10 placeholder)
- [Phase 17]: Real-time recovery SMS uses args.urgency from AI tool invocation (not DB field) — processCallAnalyzed has not run yet during live call
- [Phase 17]: Cron Branch A filters by booking_outcome IN ['not_attempted'] only — attempted calls handled by webhook trigger, not cron
- [Phase 18-02]: Handle both advisory lock rejection and UNIQUE constraint violation as valid contention outcomes — RPC has no EXCEPTION handler for UNIQUE violations, so r.error != null is an accepted contention signal
- [Phase 18-02]: testPathIgnorePatterns excludes /tests/integration/ from default npm test run — prevents misleading 0-tests output in CI without Supabase credentials (Pitfall 4 avoidance)
- [Phase 18]: Auto-cancel fires in processCallEnded (call_ended event) — calendar clears immediately after test call, not minutes later
- [Phase 18]: Test call lead reset: status='new' + appointment_id=null prevents dashboard showing 'booked' lead with no active appointment (Pitfall 6 avoidance)
- [Phase 18-01]: @sentry/nextjs v10.45.0 installed for server-side only error monitoring; instrumentation.js hook + withSentryConfig wrapper; hidden POST /api/debug/test-error endpoint with flush(2000) for HARDEN-04

### Roadmap Evolution

- Phase 02.1 inserted after Phase 02: Public marketing landing page (INSERTED)
- Phases 6-9 added for milestone v1.1: Site Completeness & Launch Readiness (2026-03-22)
- Phase 10 added: Dashboard Guided Setup and First-Run Experience
- Phase 11 added: Landing Page UI/UX Redesign
- Phase 12 added: Dashboard-configurable triage and call escalation
- Phase 13 added: Frontend Public Pages Redesign — Premium Dark SaaS design overhaul for Home, Pricing, Contact, About, Nav, Footer with performance-first constraints
- Phases 14-18 added for milestone v2.0: Booking-First Digital Dispatcher (2026-03-24)
- Phase 19 added: Codebase skill files for full architectural reference — 5 new skill files covering scheduling/calendar, dashboard/CRM, onboarding, auth/database, and public site/i18n

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: Vapi current API shape (assistantOverrides schema, function-call event payload) needs verification against live Vapi docs before webhook handler implementation
- [Phase 3]: Microsoft Graph OAuth tenant consent flow is more complex than Google's — needs targeted research before calendar sync work begins
- [Phase 5]: TCPA compliance review required before any outbound SMS recovery is built (Phase 4 NOTIF-03 is inbound caller SMS, not outbound campaign — this is fine for v1)
- [Phase 8]: Outlook admin consent exact error shape should be verified against a live Azure AD response during Phase 8 research — UX error state is designed but trigger condition needs confirmation with a real Microsoft 365 Business account
- [Phase 8]: onboarding_complete backfill safety: verify count of tenants with partial onboarding (account created but business_name not set) before running backfill migration in production
- [Phase 9]: k6 availability in CI environment must be confirmed — k6 is a system binary (not npm); may require Docker-based CI step or local pre-merge gate if CI environment does not support it
- [Phase 14]: Prompt regression risk — old TRIAGE-AWARE BEHAVIOR section must be fully replaced, not partially patched; prompt snapshot tests needed before and after rewrite
- [Phase 14]: Intent detection effectiveness untested — if LLM consistently fails to distinguish booking vs info-only callers, a lightweight intent classifier may be needed (monitor during Phase 18 QA)
- [Phase 17]: TCPA compliance for recovery SMS to numbers without explicit opt-in — legal review needed before go-live

## Session Continuity

Last session: 2026-03-25T10:10:33.806Z
Stopped at: Phase 20 context gathered
Resume file: .planning/phases/20-dashboard-ux-overhaul/20-CONTEXT.md

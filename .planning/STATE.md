---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Phases
status: executing
stopped_at: Completed 07-02-PLAN.md
last_updated: "2026-03-22T10:44:03.643Z"
last_activity: 2026-03-22 — Completed Plan 07-03 (services page step 3, contact page step 4, test-call-status endpoint, timing bug fix)
progress:
  total_phases: 10
  completed_phases: 6
  total_plans: 31
  completed_plans: 30
  percent: 94
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Every inbound call is answered instantly and converted into a confirmed booking or qualified lead — no call goes to voicemail, no lead is lost to a competitor.
**Current focus:** Milestone v1.1 — Site Completeness & Launch Readiness

## Current Position

Phase: 7 — Unified Signup and Onboarding Wizard (3/4 plans complete)
Plan: 03 (complete)
Status: Phase 7 in progress — steps 3-4 migrated, test-call-status polling endpoint added, onboarding_complete timing fixed
Last activity: 2026-03-22 — Completed Plan 07-03 (services page step 3, contact page step 4, test-call-status endpoint, timing bug fix)

Progress: [█████████░] 94%

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
- [Phase 02.1-01]: Tailwind v4 landing tokens use hex values (not oklch) — matches UI-SPEC exactly: #F5F5F4, #0F172A, #C2410C, #475569, #166534
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

### Roadmap Evolution

- Phase 02.1 inserted after Phase 02: Public marketing landing page (INSERTED)
- Phases 6-9 added for milestone v1.1: Site Completeness & Launch Readiness (2026-03-22)

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: Vapi current API shape (assistantOverrides schema, function-call event payload) needs verification against live Vapi docs before webhook handler implementation
- [Phase 3]: Microsoft Graph OAuth tenant consent flow is more complex than Google's — needs targeted research before calendar sync work begins
- [Phase 5]: TCPA compliance review required before any outbound SMS recovery is built (Phase 4 NOTIF-03 is inbound caller SMS, not outbound campaign — this is fine for v1)
- [Phase 8]: Outlook admin consent exact error shape should be verified against a live Azure AD response during Phase 8 research — UX error state is designed but trigger condition needs confirmation with a real Microsoft 365 Business account
- [Phase 8]: onboarding_complete backfill safety: verify count of tenants with partial onboarding (account created but business_name not set) before running backfill migration in production
- [Phase 9]: k6 availability in CI environment must be confirmed — k6 is a system binary (not npm); may require Docker-based CI step or local pre-merge gate if CI environment does not support it

## Session Continuity

Last session: 2026-03-22T10:44:03.638Z
Stopped at: Completed 07-02-PLAN.md
Resume file: None

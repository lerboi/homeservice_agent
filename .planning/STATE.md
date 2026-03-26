---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Phases
status: Milestone complete
stopped_at: Phase 24 UI-SPEC approved
last_updated: "2026-03-26T21:06:42.293Z"
progress:
  total_phases: 14
  completed_phases: 11
  total_plans: 51
  completed_plans: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-26)

**Core value:** Every inbound call is answered instantly and converted into a confirmed booking or qualified lead — no call goes to voicemail, no lead is lost to a competitor.
**Current focus:** Phase 23 — usage-tracking

## Current Position

Phase: 23
Plan: Not started

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v3.0 Roadmap]: CC required for 14-day trial (payment_method_collection: always) — confirmed in instructions
- [v3.0 Roadmap]: Past_due grace period is 3 days, not 7 — confirmed in instructions
- [v3.0 Roadmap]: Enforcement reads only from local subscriptions table — never Stripe API on the call path (latency constraint)
- [v3.0 Roadmap]: Billing cycle reset on invoice.paid webhook only — never a cron job (accuracy constraint)
- [v3.0 Roadmap]: Stripe Customer Portal handles all self-serve management — no custom plan change UI
- [v3.0 Roadmap]: Per-call overage billing (BILLF-02) deferred to future milestone
- [Phase 21-pricing-page-redesign]: Volume-based differentiation: all paid tiers share same feature set; differentiation is call volume and support level only
- [Phase 22]: Minimal Stripe singleton — no client-side code in stripe.js
- [Phase 22]: Subscription write-protection via RLS — authenticated SELECT-only, all writes through service_role webhook handlers
- [Phase 22]: Return 500 on webhook handler errors so Stripe retries automatically
- [Phase 22]: tenant_id set on both Checkout Session metadata and subscription_data metadata for webhook reliability
- [Phase 22]: onboarding_complete no longer set by test-call flow — deferred to checkout.session.completed webhook
- [Phase 22]: Light-surface plan cards with negative margin breakout from wizard card for wider grid
- [Phase 27]: SECURITY DEFINER on assign_sg_number RPC for atomic race-safe SG number assignment via FOR UPDATE SKIP LOCKED
- [Phase 27]: provisioning_failed flag on tenants enables admin follow-up when SG inventory exhausted at checkout time
- [Phase 27]: Phone prefix shown as non-editable span inside the input row, user types local digits only
- [Phase 27]: Server-side 409 gate in sms-confirm prevents direct API bypass of waitlist when SG inventory is 0
- [Phase 27]: US/CA provisioning uses Twilio API direct purchase (not retell.phoneNumber.create) per D-12 — Twilio ownership enables future SMS access from tenant numbers
- [Phase 27]: Provisioning failure (provisioning_failed flag) allows subscription creation to succeed even when phone assignment fails — user always gets their subscription after paying
- [Phase 29]: Direct fetch() to ElevenLabs REST API over elevenlabs npm SDK for /api/demo-voice — simpler for single endpoint, no SDK overhead
- [Phase 29]: RotatingText measures current word width (not longest) via measureRef + getBoundingClientRect on each currentIndex change
- [Phase 29]: HeroSection stripped to minimum (h1/subtitle/placeholder) — eyebrow pill, CTA block, social proof removed to focus attention on demo input
- [Phase 29-hero-section-interactive-demo]: HeroDemoInput uses dynamic import of supabase-browser inside useEffect to avoid SSR; AudioContext created post-user-gesture to avoid autoplay policy
- [Phase 29]: HeroDemoBlock as intermediate wrapper keeps HeroSection a Server Component; single dynamic import for the entire demo experience
- [Phase 28-admin-dashboard]: Admin gate returns early from middleware after successful check — admins may not have a tenants row
- [Phase 28-admin-dashboard]: admin_users has no INSERT policies — all admin user management via service_role CLI/direct DB to prevent self-escalation
- [Phase 28-admin-dashboard]: Admin layout uses top-tab navigation (not sidebar) to visually differentiate admin from tenant context
- [Phase 28-admin-dashboard]: Duplicate number shows inline error text (not toast) per UI-SPEC copywriting contract
- [Phase 28-admin-dashboard]: Admin re-provisioning (POST /api/admin/tenants/[id]) does NOT call Retell/Twilio — only assigns SG number from inventory; Retell agent association is a separate operational step
- [Phase 28-admin-dashboard]: Tenant name passed via impersonate_name query param to dashboard layout to avoid an extra API call during impersonation
- [Phase 23]: Migration renumbered 012→013 (012_admin_users.sql already exists from Phase 28)
- [Phase 23]: No SECURITY DEFINER on increment_calls_used — service_role client bypasses RLS automatically

### Roadmap Evolution

- Phase 02.1 inserted after Phase 02: Public marketing landing page (INSERTED)
- Phases 6-9 added for milestone v1.1: Site Completeness & Launch Readiness (2026-03-22)
- Phase 10 added: Dashboard Guided Setup and First-Run Experience
- Phase 11 added: Landing Page UI/UX Redesign
- Phase 12 added: Dashboard-configurable triage and call escalation
- Phase 13 added: Frontend Public Pages Redesign
- Phases 14-18 added for milestone v2.0: Booking-First Digital Dispatcher (2026-03-24)
- Phase 19 added: Codebase skill files for full architectural reference
- Phase 20 added: Dashboard UX Overhaul
- Phase 21 added: Pricing Page Redesign
- Phases 22-26 added for milestone v3.0: Subscription Billing & Usage Enforcement (2026-03-26)
- Phase 27 added: Country-Aware Onboarding and Number Provisioning (2026-03-26)
- Phase 28 added: Admin Dashboard (2026-03-26)
- Phase 29 added: Hero Section Interactive Demo (2026-03-26)

### Pending Todos

None yet.

### Blockers/Concerns

- [v3.0 Research]: Plan pricing and call limits conflict between STACK.md and ARCHITECTURE.md — must confirm against live pricing page before Phase 22 begins
- [v3.0 Research]: call_ended vs call_analyzed for usage increment — must be documented explicitly in Phase 23 plan (recommendation: call_ended with call_id idempotency)
- [v3.0 Research]: Retell enforcement response format (booking_enabled: false + paywall_reason) needs validation against current Retell API contract before Phase 25 builds enforcement
- [v3.0 Research]: Dunning email copy and escalation timing not defined — flag for content review during Phase 24 planning

## Session Continuity

Last session: 2026-03-26T21:06:42.285Z
Stopped at: Phase 24 UI-SPEC approved
Resume file: .planning/phases/24-subscription-lifecycle-and-notifications/24-UI-SPEC.md

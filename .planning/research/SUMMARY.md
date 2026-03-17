# Project Research Summary

**Project:** AI Voice Receptionist + Home Service Booking CRM
**Domain:** AI telephony SaaS for home service SMEs (plumbers, HVAC, electricians)
**Researched:** 2026-03-18
**Confidence:** MEDIUM

## Executive Summary

This product is an AI voice receptionist that answers inbound calls for home service businesses, triages urgency, books appointments in real-time, and surfaces leads in a web CRM. The expert approach treats this as a real-time telephony system first and a web application second: the voice call path is the critical infrastructure, and every other component (CRM, dashboard, notifications) exists to support it. The recommended stack centers on Vapi for telephony orchestration, Supabase for data and multi-tenancy, Next.js for the dashboard, and a Redis-backed distributed lock for the atomic slot reservation that prevents double-bookings.

The core architectural recommendation is to never query external APIs (Google Calendar, Outlook) during a live call. All availability must be served from a local database mirror, updated asynchronously by background sync jobs. This design decision is non-negotiable — it is both the primary performance requirement (function-call responses must complete in under 800ms to avoid audible silence) and the primary reliability requirement (the platform cannot depend on Google Calendar uptime to answer calls). The platform's own Postgres database is the source of truth for availability; Google and Outlook calendars are bidirectional sync targets, not sources.

The two highest-risk components to build correctly are atomic slot locking (race condition between concurrent calls for the same slot) and triage accuracy (LLM-based emergency vs. routine classification that works on real-world indirect caller language, not idealized test inputs). Both must be addressed in early phases with explicit concurrency tests and realistic test suites, not deferred as optimizations. Multi-language support must be architected from day one via a translatable string layer — retrofitting language support into hardcoded English prompts, templates, and triage keyword lists is a documented path to expensive rework.

---

## Key Findings

### Recommended Stack

The stack is TypeScript throughout, using Vapi as the managed telephony layer (PSTN, STT, LLM orchestration, TTS), Next.js 14 App Router for the full-stack web application, and Supabase for Postgres, auth, real-time subscriptions, and storage. Supabase's row-level security enforces multi-tenant isolation per business with no application-layer code, and its Postgres advisory locks (combined with Redis distributed locks) provide the atomic slot reservation guarantee.

The LLM backbone is GPT-4o (configured via Vapi assistant settings) for reliable JSON-mode structured outputs needed by the triage engine. ElevenLabs provides high-quality TTS via Vapi; Deepgram Aura is the budget fallback. Calendar integrations use the googleapis and @microsoft/microsoft-graph-client SDKs, both server-side only. Resend handles transactional email; Twilio handles owner SMS notifications. All inbound webhook payloads are validated with Zod.

**Core technologies:**
- **Vapi**: Telephony layer (PSTN, STT, TTS, LLM session) — purpose-built for voice agents; eliminates months of infrastructure work vs raw Twilio+Deepgram+OpenAI
- **Next.js 14 (App Router)**: Full-stack framework — API routes and server components eliminate a separate Express server; Vercel deployment with zero config
- **Supabase**: Postgres + auth + real-time — RLS enforces multi-tenancy; real-time channels power live dashboard updates; built-in storage for recordings
- **GPT-4o (via Vapi)**: Triage and conversation intelligence — reliable function-calling for structured triage outputs; native multi-language
- **Redis (Upstash)**: Slot locking cache — distributed `SET NX` lock prevents double-booking race conditions
- **ElevenLabs (via Vapi)**: TTS — perceptually natural voice critical for caller trust; swappable to Deepgram Aura if cost outweighs quality
- **Google Calendar API + Microsoft Graph**: Bidirectional calendar sync — OAuth per business owner; background async only, never in call hot path
- **Twilio**: Owner SMS notifications — programmable SMS only, not voice (Vapi owns telephony)
- **Resend**: Transactional email — React Email templates; simpler DX than SendGrid for v1

**Alternatives assessed:**
- Retell AI is a viable Vapi alternative with comparable latency; use if Vapi function-calling reliability is problematic in testing
- Neon is a viable Supabase alternative if RLS and real-time are not needed and pure Postgres flexibility matters more

### Expected Features

The full feature dependency graph and prioritization matrix are in `.planning/research/FEATURES.md`. Summary:

**Must have (table stakes — v1 launch):**
- Instant call pickup with natural-sounding voice — core promise; caller hangs up in 6 seconds
- Three-layer triage (keyword + LLM urgency + owner rules) — emergency vs. routine classification
- Caller ID, job type, address capture with read-back confirmation
- Atomic slot locking with zero double-bookings
- Real-time Google Calendar + Outlook sync (bidirectional)
- Lead CRM pipeline: new → booked → completed with detail view
- Call recording and transcript stored per lead
- Owner SMS + email notifications on new leads and bookings
- Web dashboard (mobile-responsive): leads, calendar, settings
- Multi-language support with language detection on first utterance
- Business onboarding: greeting, service list, hours, owner contact

**Should have (differentiators, v1.x post-validation):**
- Urgency scoring visible on lead card (owner sees HIGH/MEDIUM/LOW without replaying recording)
- Lead conversion rate analytics (funnel: calls answered → leads → booked → completed)
- Duplicate lead detection and merge on phone number match
- Missed/abandoned call SMS recovery
- Travel time buffer and geographic zone grouping for dense urban markets
- Per-business custom voice persona selection

**Defer (v2+):**
- Native iOS/Android app — validate mobile-responsive web is insufficient first
- Outbound AI calling — TCPA compliance requires legal review
- SMS/chat/WhatsApp omnichannel — prove voice ROI before expanding channels
- Payment deposit collection at booking — PCI scope is disproportionate for v1
- Crew dispatch / full FSM — integrate with ServiceTitan/Jobber via webhook instead of competing

**Critical dependency:** Appointment booking requires calendar sync in the same phase. Triage requires the service list configuration to exist. Multi-language requires the language abstraction layer before any language-specific content is written.

### Architecture Approach

The system has four layers: Telephony (Vapi managed SaaS), Application (Next.js monolith with isolated service modules), Data (Postgres primary + Redis for locks + object storage for recordings), and External Integrations (Google Calendar, Microsoft Graph, Twilio, Resend). The full architecture diagram and component breakdown are in `.planning/research/ARCHITECTURE.md`.

The application layer is organized as a Next.js monolith with clearly bounded service modules: `lib/voice/` (webhook gateway, triage, prompts), `lib/scheduler/` (slot queries, Redis lock, booking), `lib/calendar/` (per-provider OAuth clients, sync coordinator), `lib/crm/` (lead state machine), and `lib/notifications/` (SMS, email, push). The webhook endpoint at `app/api/webhooks/voice/` is isolated from regular API routes to prevent accidental auth bypass. Anything that must not block the webhook response (notifications, transcript storage, calendar sync) runs as a background worker.

**Major components:**
1. **Voice Event Gateway** — Receives and validates Vapi webhooks; routes tool-call events synchronously during live calls; stores transcripts and recording URLs on call end
2. **Triage Engine** — Three-layer classification (keyword pre-filter → LLM urgency scoring → owner rules table); emits urgency label + reason stored on lead record
3. **Scheduler Service** — Queries available slots from local DB mirror; acquires Redis `SET NX` lock; writes booking inside Postgres transaction with `SELECT FOR UPDATE`
4. **Calendar Sync Service** — Bidirectional OAuth sync with Google/Outlook; updates local `calendar_blocks` table; runs on push webhook + polling fallback; never in hot path
5. **CRM Lead Pipeline** — State machine (new → contacted → booked → confirmed → completed); appends transitions to immutable event log
6. **Notification Service** — Async SMS/email/push to owner; fires after booking commit; must not block call confirmation
7. **Web Dashboard** — Next.js owner-facing SPA; leads pipeline, calendar view, call recordings, settings, onboarding wizard

**Key patterns:**
- Tool-call / function-calling for all real-time actions during calls (check_availability, book_appointment, classify_call)
- Redis `SET NX` + Postgres `SELECT FOR UPDATE` double-lock for atomic slot reservation
- Local DB mirror for availability (never query Google/Outlook in the call hot path)
- Lead state machine with event log for audit trail
- Per-business dynamic system prompt injection at call start via Vapi `assistantOverrides`

### Critical Pitfalls

The top pitfalls from `.planning/research/PITFALLS.md` and how to avoid them:

1. **Voice latency from synchronous external API calls** — Pre-load availability into Redis at call start; maintain a local calendar mirror updated by background sync; keep all function-call handlers under 800ms p95. Verify in load testing before connecting to booking logic. Applies from Phase 1 (Voice Infrastructure).

2. **Non-atomic slot locking causing double-bookings** — Redis `SET NX` lock before every booking write; `SELECT FOR UPDATE` inside Postgres transaction as belt-and-suspenders; write a concurrency test that fires 10 simultaneous attempts at one slot and asserts exactly 1 succeeds. Must be designed correctly from day one in the Scheduling phase — retrofitting locking is high risk.

3. **Triage logic that fails on real callers** — Use LLM for final triage classification (keywords are a pre-filter only); include a confidence threshold with a clarifying fallback question; test against 50+ realistic indirect caller descriptions before connecting to real calendar slots.

4. **Google Calendar treated as source of truth** — The platform's own DB is authoritative for availability; Google/Outlook are sync targets. Implement sync health monitoring and dashboard indicator; handle OAuth token expiry with proactive refresh and owner alerting.

5. **AI hallucinating business information** — Inject all business-specific facts (services, hours, service area, pricing) as structured data into the system prompt at call start; never rely on LLM training knowledge for specifics. System prompt must instruct: "if you don't know, say 'I'll have [owner] call you back.'"

6. **Multi-language retrofitting cost** — All user-facing text (prompts, notifications, UI labels) in translatable strings from day one; language abstraction layer must precede any language-specific content; triage keyword lists must be language-parameterized.

7. **Onboarding complexity killing activation** — Design a 30-second path: business name, phone, trade type, done — AI uses sensible defaults. Defer all advanced config to optional settings. Validate with real SME users (not developers) completing setup in under 5 minutes.

---

## Implications for Roadmap

Based on combined research, the natural build order follows component dependencies. The architecture research provides an explicit suggested phase order; pitfalls research maps specific prevention requirements to phases. The feature dependency graph confirms calendar sync must be in the same phase as booking (not deferred).

### Phase 1: Foundation and Voice Infrastructure

**Rationale:** All other components depend on the database schema, auth, and the Vapi webhook pipeline. The language abstraction layer and availability caching architecture must be established before any language-specific content or booking logic is built on top. Starting here surfaces Vapi integration unknowns early.

**Delivers:** Working Vapi webhook endpoint receiving call events; database schema (businesses, leads, bookings, slots, calendar_blocks, lead_events); auth with multi-tenant RLS; Redis slot cache architecture; language abstraction layer (translatable string keys); Vapi assistant configuration with per-business system prompt injection; webhook signature validation; call recording piped to object storage.

**Addresses:** Instant call pickup, call recording storage, multi-language foundation, onboarding configuration schema.

**Avoids:** Voice latency pitfall (cache architecture established before booking logic); multi-language retrofit pitfall (string abstraction before any content is written); webhook signature pitfall; recording storage pitfall.

**Research flag:** Needs phase research — Vapi webhook API details, assistant override patterns, and function-call event shapes should be verified against current Vapi docs before implementation.

---

### Phase 2: Scheduling Core and Calendar Integration

**Rationale:** Booking is the primary value delivery of the product. Calendar sync must be in the same phase as booking (FEATURES.md dependency note: "without real calendar integration, slot availability is fictional"). Atomic locking must be designed correctly from the start — retrofitting is high risk (PITFALLS.md). This phase also builds the triage engine, which requires the service list configuration from the onboarding phase.

**Delivers:** Business onboarding wizard (service list, hours, emergency keywords, owner contact); three-layer triage engine (keyword pre-filter + LLM urgency + owner rules table); atomic slot locking (Redis + Postgres); slot availability queries from local DB mirror; appointment booking with address and job-type capture; Google Calendar OAuth + bidirectional sync; Outlook/Microsoft Graph OAuth + bidirectional sync; calendar sync health monitoring.

**Addresses:** Three-layer triage, atomic slot locking, Google Calendar + Outlook sync, address/job-type capture, business onboarding configuration.

**Avoids:** Double-booking race condition (Redis + Postgres lock implemented with concurrency test); Google Calendar as source of truth (local mirror architecture); triage misclassification (LLM-based classification with confidence threshold and realistic test set).

**Research flag:** Needs phase research — Microsoft Graph OAuth consent flow is documented as more complex than Google's; calendar push notification subscription lifecycle (Google: 7-day expiry; Outlook: similar) should be verified before building sync service.

---

### Phase 3: Lead CRM, Dashboard, and Notifications

**Rationale:** Once calls create real bookings, the owner needs to see them and be alerted. The CRM state machine depends on bookings existing. Notifications depend on leads existing. The dashboard depends on both. Analytics are deferred until the pipeline has real data.

**Delivers:** Lead state machine (new → contacted → booked → confirmed → completed) with event log; lead pipeline view (kanban or list) in dashboard; lead detail view with call recording playback, transcript, extracted fields (job type, urgency, address, slot); owner SMS notifications via Twilio; owner email notifications via Resend; dashboard notification feed; mobile-responsive web dashboard; calendar view in dashboard.

**Addresses:** Lead CRM pipeline, call transcript display, owner notifications, web dashboard, call recording access.

**Avoids:** Dashboard notification without context (every notification includes caller name, job type, urgency, address, one-tap callback link); raw transcript display (extracted fields shown prominently; transcript is expandable secondary).

**Research flag:** Standard patterns — lead state machines, dashboard data tables, SMS/email notification APIs are all well-documented. Skip research-phase for this phase.

---

### Phase 4: Polish, Activation, and v1 Completion

**Rationale:** Multi-language support must be completed before launch (it was listed as a v1 requirement in FEATURES.md and its absence creates retrofit cost); onboarding UX must be validated with real SME users; and the "looks done but isn't" checklist items from PITFALLS.md must be addressed before first real customers.

**Delivers:** Complete multi-language support end-to-end (language detection on first utterance, per-language system prompts, multi-language TTS voice selection in Vapi, multi-language SMS/email templates); hardened onboarding wizard with default configurations by trade type (plumber/HVAC/electrician); human escalation escape hatch ("say operator to leave a voicemail"); confirmation SMS to caller after booking; AI hallucination guardrails and knowledge boundary testing; concurrency regression test suite; staging environment with Vapi webhook tunneling.

**Addresses:** Multi-language support, onboarding completion, caller confirmation, escalation path, quality assurance.

**Avoids:** Onboarding complexity killing activation (validated with real SMEs, not developers); AI hallucination (system prompt constraints + knowledge boundary test); barge-in handling; confirmation before slot is committed.

**Research flag:** Standard patterns for this phase. Vapi language detection and multi-language TTS provider configuration should be spot-checked against current Vapi docs.

---

### Phase 5: Post-Validation Enhancements (v1.x)

**Rationale:** Add after the core booking loop is proven and owners are retaining. These features address pain points that will emerge from real usage data.

**Delivers:** Urgency scoring visible on lead card; lead conversion rate analytics; duplicate lead detection and merge; missed/abandoned call SMS recovery (Twilio outbound); travel time buffer and geographic zone grouping; per-business custom voice persona selection.

**Addresses:** v1.x feature set from FEATURES.md (P2 priority items).

**Avoids:** Building analytics before there is data; building duplicate detection before seeing the actual duplicate pattern.

**Research flag:** Missed call SMS recovery requires TCPA compliance review before implementation. Travel time buffer requires geocoding API selection (Google Maps vs. alternatives). Both need targeted research when this phase is planned.

---

### Phase Ordering Rationale

- **Foundation before everything:** Database schema and auth are hard to change after other components depend on them. Schema migration with live data mid-project is expensive.
- **Voice pipeline before CRM:** The CRM has nothing to display until calls are processed. Building the dashboard before the webhook pipeline produces no demonstrable value.
- **Calendar sync with booking (not before, not after):** The FEATURES.md dependency graph is explicit: slot availability without real calendar integration is fictional. Deferring calendar sync to a later phase means booking logic must be rebuilt when sync is added.
- **Triage before booking connection:** Triage must be tested against 50+ realistic indirect caller phrases before it routes real callers to real calendar slots. Connecting untested triage to live bookings will produce misclassified emergency/routine calls in production.
- **Onboarding validation before customer launch:** The 30-second activation requirement (under 5 minutes for a non-technical user) must be validated with real SME users, not developers. This is a Phase 4 gate, not an afterthought.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Vapi webhook API — tool-call event shapes, `assistantOverrides` patterns, function-call configuration, and current SDK version should be verified against live Vapi docs before writing webhook handlers.
- **Phase 2:** Microsoft Graph OAuth — tenant consent flow complexity and change notification subscription lifecycle; Google Calendar push notification channel expiry (7-day) and re-registration pattern.
- **Phase 5:** TCPA compliance constraints for outbound SMS recovery; geocoding API selection and pricing for travel time buffer logic.

Phases with standard patterns (skip research-phase):
- **Phase 3:** Lead state machines, dashboard data tables, Twilio SMS API, Resend email API — all well-documented with high-confidence patterns.
- **Phase 4:** Language detection patterns, Zod schema validation, concurrency test patterns — standard TypeScript/Node.js patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core choices (Next.js 14, Supabase, Vapi) are HIGH confidence. Version numbers for Vapi SDK and ElevenLabs Vapi integration need verification against current npm/docs — web access was unavailable during research. Retell AI as fallback is MEDIUM confidence. |
| Features | MEDIUM | Feature landscape derived from training knowledge of Smith.ai, Housecall Pro, Jobber, ServiceTitan through Aug 2025. Competitor feature details should be spot-checked against live product pages before strategic decisions. Core v1 feature set is HIGH confidence based on domain logic. |
| Architecture | MEDIUM-HIGH | Redis distributed locking, Google Calendar push notification patterns, and voice AI latency constraints are HIGH confidence (stable, well-established). Vapi-specific webhook patterns and `assistantOverrides` API are MEDIUM — verify against current Vapi docs. |
| Pitfalls | HIGH | The critical pitfalls (latency, double-booking race condition, triage brittle on real inputs, OAuth token expiry, AI hallucination) are well-established patterns from comparable real-time booking and voice AI systems. Not Vapi-specific — general distributed systems and LLM production patterns. |

**Overall confidence:** MEDIUM — sufficient to begin planning and scaffolding. Vapi-specific API details should be verified against live docs before Phase 1 implementation begins.

### Gaps to Address

- **Vapi current API shape:** Version numbers, `assistantOverrides` exact schema, function-call event payload structure, and multi-language TTS provider list should be verified against current Vapi docs at phase planning time. Use `gsd:research-phase` for Phase 1 to confirm these specifics.
- **Microsoft Graph OAuth complexity:** The research flags Microsoft's tenant consent flow as more complex than Google's but does not provide implementation detail. Requires targeted research before Phase 2 calendar sync work begins.
- **Vapi vs Retell final selection:** Both are listed as viable. The final choice should be made in Phase 1 after reviewing current pricing, SDK stability, and community activity. The architecture is agnostic between the two (same webhook pattern).
- **Google Calendar push notification re-registration:** The 7-day channel expiry is a documented gotcha. The exact re-registration pattern (cron job vs. expiry webhook) needs implementation verification during Phase 2.
- **TCPA compliance for outbound SMS (Phase 5):** The research explicitly flags this as requiring legal review before outbound SMS recovery is built. Do not build this feature without a compliance check.

---

## Sources

### Primary (HIGH confidence)
- `F:/homeservice-agent/.planning/PROJECT.md` — project requirements and technology direction (authoritative)
- Redis documentation (Redlock pattern, `SET NX` distributed locking) — stable, well-established pattern
- Google Calendar API push notification behavior (7-day expiry, `410 Gone` on deleted events) — stable API
- General patterns: TOCTOU race conditions in booking systems, LLM hallucination mitigation, voice AI latency constraints

### Secondary (MEDIUM confidence)
- Vapi documentation and community (training knowledge through August 2025) — verify current SDK version and API shapes before implementation
- Retell AI documentation (training knowledge through August 2025) — verify current pricing and capabilities
- Next.js 14 App Router, Supabase JS client v2, shadcn/ui + Tailwind v3 — stable as of training cutoff; check for breaking changes before scaffolding
- Smith.ai, Housecall Pro, Jobber, ServiceTitan feature sets (training knowledge through August 2025) — spot-check competitor features against live products before strategic decisions

### Tertiary (LOW confidence)
- ElevenLabs Vapi integration current status — verify ElevenLabs remains a supported Vapi TTS provider and check current voice model availability
- GPT-4o as current Vapi recommended model — Vapi may default to a newer model by March 2026; verify in Vapi assistant configuration docs

---
*Research completed: 2026-03-18*
*Ready for roadmap: yes*

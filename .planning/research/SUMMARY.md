# Project Research Summary

**Project:** HomeService AI Agent -- v2.0 Booking-First Digital Dispatcher Pivot
**Domain:** Voice AI receptionist for home service SMEs
**Researched:** 2026-03-24
**Confidence:** HIGH

## Executive Summary

The v2.0 milestone pivots the AI voice receptionist from an escalation-first triage model (where emergencies are transferred to the owner and routine calls become passive leads) to a booking-first dispatcher model (where every call ends with a confirmed appointment or a recovery SMS). This is a behavioral pivot, not an infrastructure rebuild. The existing stack -- Next.js 16, Supabase, Retell voice, Groq/Llama 4 Scout via custom WebSocket LLM server, Google Calendar sync, Twilio SMS, Resend email -- remains unchanged. The only new dependency is Zod (already planned for v1.1) for validating structured LLM outputs during exception detection. The pivot is 90% prompt rewrite and call-flow logic, 10% notification formatting and recovery SMS expansion.

The recommended approach is to rewrite the agent prompt to make booking the default action for all calls, demote urgency classification from a routing decision to a notification priority tag, and restrict human transfer to exception-only states (AI confusion, explicit caller request). This aligns with industry leaders like Sameday (92% booking rate) and Dispatchly, but goes further by not escalating emergencies to the owner's phone -- instead booking them into the nearest available slot and sending high-priority notifications. This "exception-only escalation" model is genuinely novel in home service AI and is the product's core differentiator.

The key risks are prompt regression (old escalation language surviving the rewrite and causing unpredictable AI behavior), notification fatigue (owners getting SMS for every booking instead of just emergencies), calendar flooding (no guardrails on autonomous booking volume), and loss of human oversight for genuine emergencies (removing proactive transfer without adequately hardening the notification path). All are preventable with the measures outlined in the pitfalls research, and all must be addressed within the build phases rather than deferred.

## Key Findings

### Recommended Stack

No new core technologies are needed. The booking-first pivot is implemented entirely through modifications to existing code: agent prompt, WebSocket server tool definitions, notification formatting, call processor logic, and recovery SMS cron.

**Core technologies (unchanged):**
- **Next.js 16 / React 19 / Tailwind v4** -- existing frontend and API routes
- **Supabase (Postgres)** -- data persistence, advisory lock booking, existing schema
- **Retell voice + custom LLM WebSocket server (Groq / Llama 4 Scout)** -- voice AI backbone
- **Twilio SMS + Resend email** -- notification delivery (formatting changes only)
- **Google Calendar** -- bidirectional sync (more bookings = more pushes, already async)

**New dependency:**
- **Zod ^4.3.6** -- runtime validation of structured LLM outputs (exception state JSON). Already planned for v1.1 wizard forms. Zero marginal cost.

**Explicitly rejected:** BullMQ/Redis (unnecessary at single-tenant scale), LangChain (over-engineering for one prompt), Retell Conversation Flow (loses custom LLM control), separate booking intent classifier (adds latency, unnecessary when booking is the default).

See `.planning/research/STACK.md` for full version compatibility matrix and detailed alternatives analysis.

### Expected Features

**Must have (table stakes):**
- Universal booking default -- AI books every call, not just emergencies
- Emergency-to-nearest-slot routing -- urgent callers get same-day slots
- Caller SMS confirmation after booking -- proof of appointment
- Human transfer on explicit request -- "talk to a person" always honored
- Human transfer on AI confusion -- 2+ failed clarification attempts trigger escalation
- Context preservation on transfer -- Retell warm transfer with whisper messages
- Graceful fallback when no slots available -- recovery SMS with booking link
- Urgency tag retained on booking record -- drives notification priority

**Should have (differentiators):**
- Notification priority tiers driven by urgency -- emergency bookings get high-priority formatting; routine bookings get standard delivery
- No-dead-end guarantee via universal recovery SMS -- every failed booking path triggers recovery within 60 seconds
- Exception-only escalation model -- reduces owner interruptions by 70-80% vs competitors
- Dashboard urgency badges with booking-first semantics -- visual parity, meaning shift

**Defer (v2.x/v3+):**
- Repeated notification escalation cadence (v2.x -- add after base tiers validated)
- Booking conversion analytics by urgency tier (v2.x)
- Multi-technician dispatch / skill-based routing (v3+ -- FSM-level complexity)
- Outbound follow-up automation (v3+)
- Caller slot preference negotiation (v3+)

See `.planning/research/FEATURES.md` for full competitor analysis, anti-features list, and dependency graph.

### Architecture Approach

The pivot narrows code paths rather than widening them. All calls follow one booking flow; urgency only affects slot selection order and notification formatting. The triage pipeline is untouched -- it remains a pure classifier whose output is consumed differently. Two additive database columns (`booking_outcome` and `exception_reason` on the `calls` table) are the only schema changes. No new tables, no new services, no new deploy targets.

**Major components modified:**
1. **Agent Prompt (`agent-prompt.js`)** -- full rewrite to booking-first behavior; single flow, no triage fork
2. **WebSocket LLM Server (`retell-llm-ws.js`)** -- tool description updates, optional `flag_exception` tool, Zod validation
3. **Notification System (`notifications.js`)** -- priority-based formatting, escalation contacts for emergencies
4. **Call Processor (`call-processor.js`)** -- remove `isRoutineUnbooked` guard, add `booking_outcome` tracking
5. **Recovery SMS Cron (`send-recovery-sms/route.js`)** -- urgency-aware content, universal trigger
6. **Webhook Handler (`retell/route.js`)** -- increase slot count to 10 across 5 days, `flag_exception` handler

**Explicitly unchanged:** Triage pipeline (all 3 layers), slot calculator, atomic booking function, Google Calendar sync, lead creation system.

See `.planning/research/ARCHITECTURE.md` for component-by-component integration plan, data flow diagrams, and schema impact assessment.

### Critical Pitfalls

1. **Prompt regression** -- old escalation language surviving the rewrite causes the AI to still transfer emergencies instead of booking them. Avoid by deleting the entire `TRIAGE-AWARE BEHAVIOR` section, adding explicit negative instructions ("Never transfer unless..."), and writing prompt snapshot tests.

2. **Over-booking / ghost appointments** -- AI books callers who just want a price quote or information. Avoid by adding intent detection in the prompt before the booking flow ("First determine if the caller needs a service appointment") and requiring verbal confirmation before booking.

3. **Notification fatigue** -- every booking triggers an SMS, owner mutes notifications, misses the real emergency at 2 AM. Avoid by implementing priority tiers: emergency = immediate SMS/email, routine = standard or digest mode.

4. **Calendar flooding** -- no guardrails on autonomous booking volume; spam callers or busy days fill the calendar beyond what is physically serviceable. Avoid by adding max-bookings-per-day limits, per-phone-number rate limiting, and enforcing travel buffers as hard constraints.

5. **Loss of emergency oversight** -- removing proactive transfer without hardening the notification path means a gas leak gets a booking and an SMS that the owner might not see for 30 minutes. Avoid by implementing escalation contact chains, delivery confirmation polling, and acknowledgment flows for emergency notifications.

See `.planning/research/PITFALLS.md` for all 10 pitfalls with codebase line references, warning signs, recovery strategies, and phase-to-pitfall mapping.

## Implications for Roadmap

Based on research, the pivot decomposes into 6 build phases plus a hardening phase. The ordering is driven by dependency chains discovered in the architecture research and risk levels from the pitfalls research.

### Phase 1: Agent Prompt Rewrite + Test Foundation
**Rationale:** Everything depends on the AI actually booking first. The prompt is the keystone -- every other phase assumes the AI's behavior has changed. Tests must be written before the prompt changes (test-driven pivot) to prevent regression.
**Delivers:** Booking-first agent behavior; exception-only transfer; intent detection for non-booking callers; prompt snapshot tests; new test assertions replacing old escalation tests.
**Addresses:** Universal booking default, emergency-to-nearest-slot, human transfer on explicit request, human transfer on AI confusion, over-booking prevention (intent detection).
**Avoids:** Pitfall 1 (prompt regression), Pitfall 3 (over-booking), Pitfall 8 (test suite regression).

### Phase 2: WebSocket Server + Webhook Updates
**Rationale:** Tool definitions must be coherent with the new prompt. The webhook handler needs to supply more slots (10 across 5 days) and handle the new `flag_exception` tool.
**Delivers:** Updated tool descriptions restricting `transfer_call` to exceptions; `flag_exception` tool for AI confusion signaling; `reason` parameter on transfers; increased slot provisioning; Zod validation for structured LLM outputs.
**Uses:** Zod (from STACK.md) for exception state validation.
**Avoids:** Pitfall 10 (stale slot data -- more slots reduces staleness risk).

### Phase 3: Notification Priority System
**Rationale:** Can be parallelized with Phase 2 since it depends on data that already flows correctly (urgency tags on leads). Must ship before or with the prompt rewrite going live -- owners need to see emergency bookings surface with urgency to trust the new model.
**Delivers:** Priority-tiered SMS/email formatting; escalation contacts wired in for emergencies; emergency acknowledgment flow.
**Addresses:** Notification priority tiers (differentiator), emergency oversight.
**Avoids:** Pitfall 4 (notification fatigue), Pitfall 7 (loss of emergency oversight).

### Phase 4: Call Processor + Schema Migration
**Rationale:** Depends on notification system (Phase 3) for full effect. Removes the `isRoutineUnbooked` guard that is a live bug under the new model. Adds `booking_outcome` tracking for analytics and smarter recovery.
**Delivers:** `booking_outcome` and `exception_reason` columns on calls table; suggested slots calculated for ALL unbooked calls; booking outcome tracking (booked / attempted / not_attempted).
**Implements:** Schema migration (`007_booking_first.sql`), call processor updates.
**Avoids:** Pitfall 2 (triage logic leaking into booking decisions).

### Phase 5: Recovery SMS Enhancement + Booking Guardrails
**Rationale:** Recovery SMS is the universal safety net. Must be hardened before the booking-first flow goes live. Booking guardrails (max daily bookings, per-number rate limits) prevent calendar flooding.
**Delivers:** Urgency-aware recovery SMS content; delivery confirmation (not just API success); retry mechanism; max-bookings-per-day limit; per-phone-number rate limiting.
**Addresses:** No-dead-end guarantee (differentiator), calendar flooding prevention.
**Avoids:** Pitfall 5 (calendar flooding), Pitfall 6 (silent fallback chain failures).

### Phase 6: Dashboard Updates
**Rationale:** All backend changes must be deployed first. Dashboard is read-only over the new data model.
**Delivers:** Updated badge labels (urgency to booking priority semantics); booking rate metric in analytics; booking outcome indicator on lead cards.
**Addresses:** Dashboard visual parity (table stakes).
**Avoids:** Pitfall 9 (stale urgency semantics confusing owners).

### Phase 7: Hardening and QA
**Rationale:** End-to-end validation across all call scenarios. The booking-first model has a narrower code path but higher stakes per call (every call is a booking attempt). Must validate concurrency, multi-language, edge cases.
**Delivers:** E2E test coverage across full test matrix: emergency booking, routine booking, caller declines, exception transfer, concurrent bookings, non-English caller, no-slots-available, slot-taken recovery.
**Addresses:** Multi-language E2E validation (differentiator), concurrency QA, onboarding gate revalidation.

### Phase Ordering Rationale

- **Phase 1 first** because the prompt is the behavioral foundation. Architecture research confirms "Agent prompt rewrite is the keystone: everything flows from the behavioral change."
- **Phases 2 and 3 can overlap** because they have no mutual dependencies. WebSocket/webhook changes and notification formatting are independent subsystems.
- **Phase 4 after Phase 3** because the call processor's notification calls benefit from priority formatting already being in place.
- **Phase 5 before go-live** because recovery SMS is the last safety net. Pitfalls research flags silent fallback failures as HIGH recovery cost.
- **Phase 6 last among build phases** because the dashboard reads from data produced by all prior phases.
- **Phase 7 is a gate, not optional.** The pitfalls research identifies 10 specific "looks done but isn't" items that must be verified end-to-end.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Agent Prompt Rewrite):** Prompt engineering for booking-first voice agents needs careful scenario testing. The exact wording of intent detection, exception triggers, and negative instructions will require iteration. Consider `/gsd:research-phase` for prompt patterns.
- **Phase 3 (Notification Priority System):** Escalation contact chains and emergency acknowledgment flows are net-new features. The `escalation_contacts` table exists but is currently unused -- wiring it in needs API and delivery confirmation design.
- **Phase 5 (Booking Guardrails):** Max-bookings-per-day and per-number rate limiting are not in the current codebase. Need to decide where constraints live (application layer vs. database function) and how to expose configuration.

Phases with standard patterns (skip research-phase):
- **Phase 2 (WebSocket + Webhook):** Well-documented Retell protocol. Tool definition changes are JSON schema updates. Zod validation is straightforward.
- **Phase 4 (Call Processor + Migration):** Standard Supabase migration + conditional logic removal. No unknowns.
- **Phase 6 (Dashboard):** Read-only UI changes over existing data. Standard React component updates.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new infrastructure. Only dependency (Zod) is already validated. Sources include official Retell docs, npm packages, and direct codebase audit. |
| Features | HIGH | Table stakes validated against 5 named competitors (Sameday, Dispatchly, Avoca, Jobber, Newo). Differentiators are clearly articulated. Anti-features are well-reasoned. |
| Architecture | HIGH | Based on direct codebase audit of every affected file. Component boundaries are clean. Schema changes are minimal and additive. Build order is dependency-driven. |
| Pitfalls | HIGH | 10 specific pitfalls identified with codebase line-number references. Prevention strategies are concrete and phase-mapped. Recovery costs are honestly assessed. |

**Overall confidence:** HIGH

### Gaps to Address

- **Emergency notification delivery guarantee:** The escalation contact chain and acknowledgment flow are designed but not prototyped. Twilio delivery status polling adds complexity -- validate that polling latency is acceptable for a 2-minute acknowledgment window during Phase 3 planning.
- **Booking guardrail configuration UX:** Max-bookings-per-day and rate limits need an owner-facing settings interface. This was not deeply explored in any research file. Consider adding to Phase 6 (dashboard) or as a fast-follow.
- **Intent detection effectiveness:** The prompt-based approach to distinguishing booking callers from information seekers is untested. If the LLM consistently fails at this, a lightweight intent classifier may be needed. Monitor during Phase 7 QA.
- **TCPA compliance for recovery SMS:** The pitfalls research flags that recovery SMS to numbers without explicit opt-in may violate TCPA. Legal review needed before go-live. Not a technical gap but a compliance gate.
- **Refresh-slots mid-call tool:** The pitfalls research recommends a `refresh_slots` tool for mid-call slot refreshing when all pre-calculated slots are stale. This is not in the architecture's build plan. Should be evaluated during Phase 2 planning -- may be unnecessary if 10 pre-calculated slots across 5 days provides sufficient buffer.

## Sources

### Primary (HIGH confidence)
- [Retell AI LLM WebSocket docs](https://docs.retellai.com/api-references/llm-websocket) -- transfer_number field, end_call behavior, tool invocation protocol
- [Retell AI Function Calling docs](https://docs.retellai.com/integrate-llm/integrate-function-calling) -- tool definition schema, call function invocation
- [Zod v4.3.6](https://zod.dev/v4) -- runtime validation API, safeParse behavior
- Direct codebase audit -- all files in `src/lib/`, `src/server/`, `src/app/api/`, `src/components/dashboard/`, `tests/`, `supabase/migrations/`

### Secondary (MEDIUM confidence)
- [Sameday AI](https://www.gosameday.com/) -- booking-first patterns, 92% booking rate benchmark
- [Dispatchly AI](https://www.dispatchlyai.com/) -- competitor feature set, escalation model
- [Avoca AI](https://www.avoca.ai/) -- ServiceTitan integration patterns, AI workforce positioning
- [Jobber AI Receptionist](https://www.getjobber.com/features/ai-receptionist/) -- keyword-based transfer, message-taking fallback
- [Retell AI blog posts](https://www.retellai.com/blog/) -- warm transfer, prompt patterns, troubleshooting
- [Leaping AI guides](https://leapingai.com/blog/) -- voice AI for home services, dispatch automation patterns

### Tertiary (LOW confidence)
- Competitor implementation details (Sameday 92% rate, Dispatchly escalation model) -- marketing claims, not verified independently

---
*Research completed: 2026-03-24*
*Ready for roadmap: yes*

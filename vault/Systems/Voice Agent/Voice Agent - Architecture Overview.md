---
type: system
system: Voice Agent
status: current
description: "End-to-end flow and main components of Voice Agent. Covers: End-to-end call flow; Service boundaries; Related skills"
source: .claude/skills/voice-call-architecture/SKILL.md § Architecture Overview
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# Architecture Overview

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

Two separate services, one call:

| Service | Runtime | Deployment | Purpose |
|---------|---------|------------|---------|
| **Next.js App** | Node | Vercel | Dashboard, API routes, cron, Stripe webhooks, phone provisioning |
| **LiveKit Voice Agent** | Python 3.12 | Railway | Real-time AI voice via cascade (Deepgram STT → gpt-4.1-mini → ElevenLabs TTS) + FastAPI webhook service |

The agent is a **separate repo** (`lerboi/livekit_agent`) cloned locally at
`C:/Users/leheh/.Projects/livekit-agent/` — this sibling repo is
authoritative for the agent. (There is no `livekit-agent/` mirror inside this
monorepo; the user syncs the sibling repo → GitHub → Railway on redeploy.)

### End-to-end call flow

```
Caller dials Twilio number
  │
  ▼
Twilio voice_url → Railway webhook POST /twilio/incoming-call  (Phase 40)
  │   1. Tenant lookup by To-number (_normalize_phone → tenants.phone_number;
  │        subscriptions embed filtered to .eq("subscriptions.is_current", True))
  │   2. Subscription check via shared is_subscription_blocked() — blocked
  │        (incl. past_due beyond 3-day grace) → AI route (never owner-pickup);
  │        the agent-side gate then disconnects. Errors fail open → AI
  │   3. Priority (VIP) caller check (Phase 46): tenants.vip_numbers OR leads.is_vip
  │        match → direct owner-pickup, bypasses steps 4–5
  │   4. evaluate_schedule(call_forwarding_schedule, tz, now_utc)
  │   5. owner_pickup only: check_outbound_cap(tenant_id, country)
  │        breach → downgrade to AI
  │   6. Return TwiML:
  │        AI mode:         <Dial><Sip>{LIVEKIT_SIP_URI}</Sip></Dial>
  │        Owner pickup:    <Dial><Number>*</Number></Dial>  (up to 5 pickup numbers)
  │
  ├── AI path ──▶ LiveKit SIP dispatch rule creates room: "call-{uuid}"
  │                 │
  │                 ▼
  │           Agent entrypoint (src/agent.py)
  │             - Tenant lookup by to_number
  │             - Pre-session Xero + Jobber customer context fetch (Phase 55/56)
  │             - build_system_prompt(locale, customer_context, ...)
  │             - AgentSession(stt=deepgram, llm=gpt-4.1-mini, tts=elevenlabs,
  │               vad=silero, turn_detection=MultilingualModel) starts
  │             - Deterministic session.say() greeting (input-muted)
  │             - _run_db_queries background tasks (subscription + intake + call insert)
  │             - Egress recording starts after DB task completes
  │             - Cascade handles each turn: Deepgram STT → gpt-4.1-mini → ElevenLabs TTS
  │             - 6 in-process tools execute during the call
  │             - Session close → run_post_call_pipeline()
  │
  └── Owner pickup ──▶ Twilio dials up to 5 pickup numbers in parallel
                        │
                        ├── Answered → call connects; /twilio/dial-status writes duration + routing_mode=owner_pickup
                        └── No answer → voice_fallback_url fires /twilio/dial-fallback → AI SIP TwiML
                                          dial-status writes routing_mode=fallback_to_ai
```

### Service boundaries

- **Next.js (Vercel)** — writes calls/appointments/leads (via RLS), dashboard
  reads, Stripe webhook for phone provisioning (Twilio purchase + SIP trunk
  association), cron jobs (recovery SMS, calendar channel renewal).
- **Python agent + FastAPI webhook (Railway)** — single process, both the
  LiveKit agent worker AND a FastAPI daemon thread on port 8080. Twilio
  webhooks + health checks hit port 8080; LiveKit room joins are via the
  agents SDK.

### Related skills

- `integrations-jobber-xero` — Xero + Jobber OAuth, caching, webhook HMAC,
  pre-session customer context fetch, `check_customer_account` tool,
  Phase 58 telemetry helpers. **Read this skill for anything touching
  Xero/Jobber code paths on either runtime.**
- `scheduling-calendar-system` — `calendar_events`, slot calculation,
  Google/Outlook/Jobber schedule sync, travel buffers.
- `auth-database-multitenancy` — tenant lookup, service-role Supabase,
  RLS, migration catalog.
- `payment-architecture` — post-call `increment_calls_used` RPC, Stripe
  overage metering, subscription gate.

---

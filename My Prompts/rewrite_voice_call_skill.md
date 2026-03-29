# Task: Rewrite voice-call-architecture Skill File

## What To Do

Rewrite `.claude/skills/voice-call-architecture/SKILL.md` to reflect the current post-migration architecture. The existing skill file documents the old Retell + Groq system and is completely outdated.

## Context

The voice system was migrated from **Retell + Groq (Llama 4 Scout on Railway WebSocket)** to **Twilio SIP + LiveKit + Gemini 3.1 Flash Live**. The migration plan and architectural context are documented in:

- `My Prompts/Gemini_migration.txt` — original migration brief
- `My Prompts/Gemini_migration_plan.md` — 8-phase implementation plan
- `My Prompts/Gemini_migration_execute.txt` — execution rules and constraints

The LiveKit agent is a **separate repo** (`lerboi/livekit_agent`) deployed to Railway. It is NOT in this repo. The `livekit-agent/` folder in this repo is a leftover scaffold and should be ignored.

## What You Need Access To

You need to read both repos to write an accurate skill file:

1. **This repo (`homeservice_agent`)** — for:
   - The current outdated skill file: `.claude/skills/voice-call-architecture/SKILL.md`
   - Database schema: `supabase/DB` and `supabase/migrations/023_livekit_migration.sql`
   - Phone provisioning: `src/app/api/stripe/webhook/route.js`
   - Test call: `src/app/api/onboarding/test-call/route.js`
   - Notifications: `src/lib/notifications.js`
   - Triage: `src/lib/triage/`
   - Scheduling: `src/lib/scheduling/`
   - Leads: `src/lib/leads.js`
   - Subscription gate: `src/lib/subscription-gate.js`
   - All other skill files for cross-references

2. **The agent repo (`lerboi/livekit_agent`)** — for:
   - Agent entry point (agent.ts or similar)
   - System prompt builder (prompt.ts or similar)
   - All 6 tool implementations (book_appointment, check_availability, capture_lead, check_caller_history, transfer_call, end_call)
   - Post-call pipeline (post-call.ts or similar)
   - Supabase client setup
   - Package.json, Dockerfile, deployment config
   - Any other source files

## Requirements for the Rewritten Skill File

Follow the same structure and depth as the existing skill file, but updated for the new architecture. The skill file should serve as a **complete architectural reference** that someone can read to understand the entire voice system without looking at code. It must cover:

1. **Architecture overview** — Twilio SIP → LiveKit → Gemini Live flow diagram
2. **Agent service** — where it runs (Railway), how it connects to LiveKit, the JobContext lifecycle
3. **SIP configuration** — inbound trunk, outbound trunk, dispatch rules, how numbers route
4. **Gemini Live session** — model config, voice mapping (Kore/Aoede/Achird), VAD settings, context window compression, interruption handling
5. **System prompt** — all sections and behavioral rules (booking-first protocol, two-strike decline, transfer rules, intake questions, language switching, call duration limits, repeat caller awareness, slot preference detection, etc.)
6. **All 6 tools** — exact parameters, behavior, database writes, side effects for each
7. **Post-call pipeline** — call record finalization, triage (3-layer), lead creation/merging, owner notifications (SMS + email with preferences), caller SMS, calendar sync, recovery SMS, usage tracking, overage billing
8. **Recording & transcripts** — LiveKit Egress → Supabase Storage, transcript collection via Gemini
9. **Call transfer** — SIP REFER mechanism, whisper context, failure handling
10. **Subscription enforcement gate** — blocked statuses, grace period, fail-open behavior
11. **Test call flow** — LiveKit SIP outbound, room metadata, auto-cancel
12. **Phone provisioning** — US/CA Twilio purchase, SG inventory, SIP trunk association
13. **Database tables** — all tables with columns relevant to voice (calls, tenants, appointments, leads, etc.)
14. **End-to-end call flows** — booking flow, transfer flow, decline flow, language barrier flow, routine no-book flow
15. **Environment variables** — all env vars for both services (Railway agent + Vercel app)
16. **Key design decisions** — document architectural choices and rationale

## Important Notes

- Read the actual agent code in `lerboi/livekit_agent` — do NOT just copy from the migration plan. The implementation may differ from the plan.
- The business logic (scheduling, leads, triage, notifications) lives in THIS repo and is called by the agent. Document where each piece lives.
- Keep the skill file consistent with other skill files in `.claude/skills/` in terms of format and depth.
- After writing the skill file, update the CLAUDE.md table if the skill description needs updating.

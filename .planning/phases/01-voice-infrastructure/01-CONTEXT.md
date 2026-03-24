# Phase 1: Voice Infrastructure - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Retell webhook pipeline is live, every inbound call is answered within 1 second, call recordings and transcripts are stored per call, and the language abstraction layer is in place so no English-only content is hardcoded. Multi-tenant database schema established.

</domain>

<decisions>
## Implementation Decisions

### Language Support Scope
- English + Spanish supported from day one
- When language detection is uncertain, AI asks the caller: "Would you prefer English or Spanish?"
- Code-switching: AI mirrors the caller's language — responds in whatever language the caller just used
- Unsupported languages (e.g., Mandarin): AI detects the language and offers a polite apology in that language ("I'm sorry, I am still learning Mandarin. Let me get someone to help you."), attempts to gauge urgency from tone/keywords, then creates a lead card tagged with "LANGUAGE BARRIER: [Detected Language]" and escalates to owner with priority notification
- All user-facing strings keyed through a translation layer — no raw English strings hardcoded in application logic

### Recording & Transcript Handling
- Recordings stored indefinitely — no auto-delete, owner can manually delete
- Storage: Supabase Storage for call recordings
- Transcripts stored in both formats: structured (speaker turns, timestamps, speaker labels) for features like click-to-jump playback, and plain text rendering for display
- Always announce recording at start of every call: "This call may be recorded for quality purposes." Safest legal position across jurisdictions

### Default Call Behavior
- Generic professional greeting when business hasn't completed onboarding: "Hello, thank you for calling. How can I help you today?" — no business name, still captures caller info as a lead
- Warm professional default persona: friendly, calm, mid-pace voice — good for demos even before onboarding config exists
- When caller's request can't be handled yet (e.g., booking not built until Phase 3): capture caller info as a lead AND attempt to transfer call to owner's phone — lead is never lost even if transfer fails
- 10-minute soft call duration limit — AI wraps up after 10 minutes to prevent abuse and control costs

### Tech Stack & Framework
- Next.js with JavaScript (no TypeScript) — full-stack framework with API routes + React dashboard in one project
- Full Supabase stack: Postgres DB, Supabase Auth, Supabase Storage, Realtime subscriptions
- Deployment: Vercel — native Next.js hosting with serverless functions for API routes
- Multi-tenant: shared tables with tenant_id column, row-level security via Supabase RLS

### Claude's Discretion
- Retell webhook handler architecture and event processing
- Exact Retell voice selection for warm professional persona
- Database schema design details (table structure, indexes, relationships)
- Translation layer implementation approach (i18n library choice)
- Error handling and retry strategies for webhook processing

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs
- `.planning/PROJECT.md` — Core value prop, constraints (sub-second latency, Retell platform, zero double-bookings, multi-language from v1)
- `.planning/REQUIREMENTS.md` — VOICE-01, VOICE-05, VOICE-06, VOICE-08, VOICE-09 are the Phase 1 requirements
- `.planning/ROADMAP.md` — Phase 1 success criteria (5 test scenarios that must pass)

### External platform
- Retell AI documentation — webhook event schema, voice agent configuration, call recording API, language support capabilities

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None — patterns to be established in this phase will set precedent for all subsequent phases

### Integration Points
- Retell webhook endpoint (inbound) — receives call events from Retell platform
- Supabase client — database operations, storage uploads, auth
- Vercel serverless functions — API route handlers for webhooks

</code_context>

<specifics>
## Specific Ideas

- Unsupported language handling should be intelligent: detect language, apologize in that language, attempt to gauge urgency from tone/keywords, create a lead with "LANGUAGE BARRIER" tag, and escalate to owner — never just apologize and hang up
- The AI should feel like a real receptionist from Phase 1, even before business onboarding is configured
- Capture + transfer approach: always create the lead first so no caller info is lost, then attempt the transfer as a bonus

</specifics>

<deferred>
## Deferred Ideas

- WhatsApp alerts for language barrier escalation — mentioned during discussion, but notifications are Phase 4 (NOTIF-01, NOTIF-02)
- Per-business configurable recording consent toggle — always-announce is the v1 default, configurable consent could be a future enhancement
- Singlish language support — start with English + Spanish, expand later

</deferred>

---

*Phase: 01-voice-infrastructure*
*Context gathered: 2026-03-18*

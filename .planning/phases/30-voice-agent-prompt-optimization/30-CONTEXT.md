# Phase 30: Voice Agent Prompt Optimization - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Holistic refinement of the AI receptionist system prompt and supporting tools to maximize booking conversion, improve caller experience, and close behavioral gaps. Primarily prompt engineering in `agent-prompt.js` + new tools in `server.js` and webhook `route.js` + one lightweight DB migration. No dashboard UI changes — trade templates work out of the box.

</domain>

<decisions>
## Implementation Decisions

### Slot Offering Strategy
- **D-01:** Smart preference detection. AI listens for time cues (morning, afternoon, evening, weekend, specific day) from the caller's language and prioritizes matching slots from `check_availability` results. No cue detected = chronological next-available. No proactive "when do you prefer?" question — detect from natural conversation.

### Repeat Caller Handling
- **D-02:** Full caller awareness via new `check_caller_history` tool. Looks up `leads` + `appointments` by `from_number`. AI acknowledges existing appointments ("I see you have an appointment Thursday at 2 PM — is this about that, or something new?") and prior leads ("Welcome back, I have your information on file"). Prevents duplicate bookings and makes repeat callers feel recognized. Read-only tool — no DB writes.

### Failed Transfer Recovery
- **D-03:** Callback booking on failed transfer. When `transfer_call` fails (owner doesn't answer), AI offers to book a callback appointment: "They're not available right now. Would you like me to book a time for them to call you back?" Uses `check_availability` + `book_appointment` to schedule. If caller declines the callback, fall back to `capture_lead` with a callback note. Owner gets a calendar entry with the caller's context from the whisper message data.

### Prompt Structure Cleanup
- **D-04:** Full cleanup — remove all redundancies and resolve contradictions:
  - Remove `RECORDING_NOTICE` standalone section (already covered in OPENING LINE)
  - Remove `LANGUAGE_BARRIER_ESCALATION` section (already covered in LANGUAGE section)
  - Replace "Keep every response to 1-2 sentences" with "Keep it concise but never truncate booking confirmations, address recaps, or important details"
  - Consolidate into fewer, cleaner sections with zero contradicting instructions
  - Goal: every instruction gets full LLM attention weight, no ambiguity resolution needed

### Service-Specific Questioning
- **D-05:** Trade-type question templates. Hardcoded intake question sets per `trade_type` (plumber, electrician, HVAC, handyman) — 1-2 questions per trade. Uses existing `trade_type` field on tenants + existing `TRADE_TEMPLATES` in `trade-templates.js`. Questions injected into prompt via `call_inbound` dynamic variables. DB change: add `intake_questions` jsonb column to `services` table, populated from trade templates during onboarding. Owner-configurable overrides deferred to a future phase.

### Post-Booking and Post-Decline Flow
- **D-06:** Recap + wrap-up after booking. AI recaps date, time, and address: "Your appointment is confirmed for Thursday at 2 PM at 123 Main St. {business_name} will see you then. Is there anything else before I let you go?" If yes, continue. If no, warm farewell + `end_call`. After second decline (capture_lead → end_call), AI confirms info saved, offers one chance for questions, then farewell.

### Claude's Discretion
- Exact trade-specific question wording per trade — Claude can determine the most natural phrasing
- How aggressively to re-check availability mid-call vs. trusting recent results
- Exact farewell wording (Groq-generated, not hardcoded)
- How to handle edge case: repeat caller with both an existing appointment AND an open lead

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Voice Call System
- `.claude/skills/voice-call-architecture/skill.md` — Complete architectural reference for WebSocket server, webhooks, prompt, triage, booking, notifications
- `C:/Users/leheh/.Projects/Retell-ws-server/server.js` — WebSocket LLM server (Railway production)
- `C:/Users/leheh/.Projects/Retell-ws-server/agent-prompt.js` — Agent prompt builder (Railway production)
- `src/app/api/webhooks/retell/route.js` — All Retell webhook event handling including new `check_availability` handler

### Scheduling
- `.claude/skills/scheduling-calendar-system/skill.md` — Slot calculation, atomic booking, calendar sync
- `src/lib/scheduling/slot-calculator.js` — `calculateAvailableSlots()` pure function
- `src/lib/scheduling/booking.js` — `atomicBookSlot()` with advisory lock

### Trade Templates
- `src/lib/trade-templates.js` — `TRADE_TEMPLATES` with service lists per trade (plumber, hvac, electrician, general_handyman)

### Database
- `supabase/DB` — Current production schema (all tables)
- `supabase/migrations/002_onboarding_triage.sql` — services table, trade_type column
- `supabase/migrations/003_scheduling.sql` — appointments, calendar_events, book_appointment_atomic RPC

### Dashboard (read-only context — no UI changes in this phase)
- `.claude/skills/dashboard-crm-system/skill.md` — Dashboard architecture reference
- `src/app/dashboard/more/ai-voice-settings/page.js` — Currently minimal AI settings page (future expansion point)

### Dual-Repo Sync
- Memory: `reference_retell_ws_server.md` — Railway WS server at `C:/Users/leheh/.Projects/Retell-ws-server/` must stay in sync with main repo changes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `calculateAvailableSlots()` — Pure slot calculator, already reused by `handleInbound`, `handleBookAppointment` (slot-taken), and new `handleCheckAvailability`
- `formatSlotForSpeech()` / `toLocalDateString()` — Slot formatting helpers in webhook route
- `formatZonePairBuffers()` — Zone buffer formatter in webhook route
- `TRADE_TEMPLATES` in `trade-templates.js` — Existing trade→services mapping, extend with `intakeQuestions`
- `createOrMergeLead()` — Lead lookup by `from_number` + `tenant_id` (same pattern for `check_caller_history`)
- `buildWhisperMessage()` — Caller context builder (reusable for callback appointment notes)

### Established Patterns
- Tool call round-trip: WS server → Retell → webhook → DB → back. New tools (`check_caller_history`) follow identical pattern to `check_availability` and `book_appointment`
- `after()` for non-blocking async work (calendar sync, SMS, DB writes)
- Service role Supabase client for all webhook handlers (bypasses RLS)
- Dynamic variables via `call_inbound` → `retell_llm_dynamic_variables` → system prompt injection

### Integration Points
- `getTools()` in server.js — add `check_caller_history` tool definition
- `handleFunctionCall()` in route.js — add `check_caller_history` case
- `handleInbound()` in route.js — pass `trade_type` + intake questions in dynamic variables
- `buildSystemPrompt()` in agent-prompt.js — new sections for trade questions, repeat caller awareness, transfer recovery
- `server.js` call_details handler — inject intake questions from dynamic variables into prompt

### DB Migration Required
- New migration: add `intake_questions jsonb` to `services` table (nullable, no default)
- Populate from `TRADE_TEMPLATES` during onboarding (extend existing service creation in `/api/onboarding/start`)

</code_context>

<specifics>
## Specific Ideas

- Trade question examples: Plumber → "Is the water still running or have you been able to shut it off?"; Electrician → "Any burning smell or visible sparks?"; HVAC → "Is this heating or cooling?"
- Repeat caller greeting should feel natural, not robotic — "Welcome back" not "I have detected a previous interaction"
- Callback booking after failed transfer should use the same `book_appointment` flow — owner sees it as a regular appointment on their calendar with a note "Callback requested — caller wanted to speak with you"
- Smart preference detection keywords: "morning" / "AM" → before noon slots; "afternoon" → 12-5 PM; "evening" / "after work" → 4+ PM; "weekend" / "Saturday" / "Sunday" → those days; "next week" → Monday-Friday of following week

</specifics>

<deferred>
## Deferred Ideas

- **Owner-configurable intake questions** — Dashboard UI to customize trade questions per service. Belongs in a future "AI Settings Dashboard" phase.
- **Tone preset editing** — `tone_preset` is locked after onboarding. Add to AI Settings page. Separate phase.
- **Quote estimate ranges** — Owner configures price ranges per service, AI mentions during calls. Separate phase (needs dashboard UI + DB columns).
- **Peak hours / demand insights** — Track which slots get requested vs. declined, surface to owner. Dashboard analytics phase.
- **Multi-technician routing** — Assign appointments to specific techs based on zone/service. Separate phase (significant schema + UI work).

</deferred>

---

*Phase: 30-voice-agent-prompt-optimization*
*Context gathered: 2026-03-27*

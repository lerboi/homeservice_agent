# Stack Research

**Domain:** Booking-first digital dispatcher pivot (v2.0 milestone) for AI voice receptionist
**Researched:** 2026-03-24
**Confidence:** HIGH (primarily behavioral/prompt changes to existing stack; minimal new dependencies)

---

## Scope

This document covers ONLY the stack additions/changes needed for the v2.0 booking-first dispatcher pivot. The existing stack is validated and unchanged:

- Next.js 16 / React 19 / Tailwind v4
- Supabase (Postgres) with advisory lock booking
- Retell voice + custom LLM WebSocket server (Groq / Llama 4 Scout)
- Three-layer triage classifier (keywords, LLM, owner rules)
- Google Calendar bidirectional sync
- Twilio SMS + Resend email notifications
- Lead CRM with merge logic

**Critical finding: The booking-first pivot is 90% behavioral (prompt rewrite + call flow logic) and 10% stack. No major new infrastructure is needed.**

New capabilities required:

1. **Agent prompt rewrite** — booking-first dispatcher behavior (no new libraries)
2. **Triage reclassification** — urgency tags as notification priority (no new libraries)
3. **Notification priority dispatch** — urgency-driven SMS/email formatting and delivery timing
4. **Exception state detection** — AI recognizes confusion/caller-requests-human (prompt engineering)
5. **Universal recovery SMS** — extend existing cron to cover all failed bookings (no new libraries)
6. **Structured LLM output for exception detection** — reliable JSON extraction from Groq responses

---

## Recommended Stack -- New Additions

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| None required | -- | -- | The booking-first pivot is a behavioral change to the existing WebSocket LLM server, agent prompt, call processor, and notification service. No new core frameworks, databases, or infrastructure components are needed. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^4.3.6 | Runtime validation of structured LLM outputs (exception state JSON, booking intent JSON) | Already recommended in v1.1 STACK.md for wizard forms. Reuse here to validate the JSON objects that the Groq LLM returns when detecting exception states. Parse `{"exception": true, "reason": "caller_requests_human"}` safely instead of fragile string matching. |

**That is the only new dependency.** Zod was already planned for v1.1 (wizard forms). The booking-first pivot reuses it for a second purpose: validating structured outputs from the LLM in the WebSocket server.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| k6 (already in v1.1 plan) | Load test the booking-first flow under concurrent calls | Same tool, new test scripts: simulate 10+ simultaneous callers all attempting to book (not just emergencies). Validates that the atomic slot locking holds when every call is a booking attempt. |

---

## What Changes -- Existing Code, Not New Libraries

The pivot is implemented by modifying existing files, not adding new packages. Here is what changes and why no new library is needed for each:

### 1. Agent Prompt (`src/lib/agent-prompt.js`)

**Change:** Rewrite `buildSystemPrompt()` to make booking the default action for ALL calls. Remove the triage-based routing split ("For EMERGENCY calls... For ROUTINE calls..."). Replace with a single booking flow where urgency only affects slot selection strategy (emergency = earliest available, routine = next convenient).

**No new library because:** This is pure string construction. The prompt template is already parameterized with `business_name`, `locale`, `tone_preset`, and `available_slots`. The behavioral shift is in the instructions, not the technology.

**Key prompt engineering patterns for booking-first agents:**
- **Default-to-action framing:** "Your primary goal is to book an appointment for every caller" instead of "Determine if this is an emergency or routine call"
- **Slot selection by urgency:** "If the issue sounds urgent (flooding, gas leak, no heat), offer the earliest available slot first. For routine requests, offer the most convenient slots."
- **Exception detection instructions:** "If you cannot understand what service the caller needs after 2 clarification attempts, OR if the caller explicitly says 'I want to talk to a person' / 'let me speak to someone', invoke the `end_call_with_transfer` function"
- **Recovery guarantee:** "If booking fails for any reason, reassure the caller that someone will follow up within 15 minutes"

### 2. Exception State Detection (WebSocket server + prompt)

**Change:** Add a new tool definition `end_call_with_transfer` to the WebSocket server's tool list. The LLM decides when to invoke it based on prompt instructions (confusion detection, explicit human request). On invocation, the server uses Retell's `transfer_number` field in the WebSocket response to transfer the call.

**No new library because:** Retell's WebSocket protocol already supports `transfer_number` as a response field. The existing `transfer_call` tool already works. The change is:
- Rename/refine the tool semantics: transfer is now an exception-only action, not a triage-based routing decision
- Add `transfer_number` field to the WebSocket response (already supported by Retell, confirmed via docs)
- The LLM's prompt instructions define when to trigger the exception (not a separate detection library)

**Exception state taxonomy (prompt-defined, not library-defined):**

| Exception | Trigger | Action |
|-----------|---------|--------|
| AI confusion | 2+ failed clarification attempts | Transfer to owner + log `exception_type: 'ai_confusion'` |
| Caller requests human | Explicit verbal request ("talk to a person") | Transfer to owner + log `exception_type: 'caller_requested_human'` |
| Language barrier | Unsupported language detected | Already handled -- existing `LANGUAGE_BARRIER` tag system |
| Booking system failure | `atomicBookSlot` throws error (not slot_taken) | Recovery SMS fallback + verbal apology |

### 3. Notification Priority Dispatch (`src/lib/notifications.js`)

**Change:** Modify `sendOwnerNotifications()` to accept urgency and format notifications differently based on priority level. Emergency bookings get immediate, high-urgency SMS/email. Routine bookings get standard notifications.

**No new library because:** The existing Twilio and Resend clients already send synchronously within the call processor's `after()` block. Priority is implemented by:
- **SMS formatting:** Emergency: prefix with "[URGENT]", include "IMMEDIATE RESPONSE NEEDED". Routine: current format unchanged.
- **Email formatting:** Emergency: different React Email template with red urgency banner, subject prefix "[URGENT]". Routine: current template.
- **Delivery timing:** All notifications already fire immediately via `Promise.allSettled`. No queue needed -- Twilio delivers SMS within seconds at this volume (single-tenant, ~50 calls/day max). Twilio's Traffic Shaping (beta) could add carrier-level priority later but is unnecessary now.

**Why NOT add a queue (BullMQ, pg-boss):**
- Current volume: 1 business = ~10-50 calls/day. That is 10-50 SMS + 10-50 emails per day.
- Twilio API latency: ~200-500ms per SMS send. Already runs in `after()` (non-blocking background task).
- Adding Redis (BullMQ) or a Postgres job queue (pg-boss) adds operational complexity (Redis hosting, worker processes) for zero user-facing benefit at this scale.
- If the platform scales to 100+ tenants, revisit with pg-boss (Postgres-native, no Redis needed, uses SKIP LOCKED). But that is a v3+ concern.

### 4. Triage Reclassification (`src/lib/triage/classifier.js` + `src/lib/call-processor.js`)

**Change:** The three-layer triage classifier stays. Its output (`urgency: 'emergency' | 'routine' | 'high_ticket'`) no longer drives call routing (all calls are booked). Instead, the urgency tag is attached to the booking record and drives notification priority.

**No new library because:** The classifier already returns `{ urgency, confidence, layer }`. The call processor already stores this on the `calls` table. The change is semantic: downstream consumers (notifications, dashboard badges) interpret urgency as priority, not routing.

### 5. Universal Recovery SMS (`src/app/api/cron/send-recovery-sms/route.js`)

**Change:** The existing recovery SMS cron already sends SMS to callers who hung up without booking. In booking-first mode, every call is a booking attempt, so the cron's logic simplifies: any call without a confirmed appointment gets a recovery SMS (the "routine caller declines" path still exists but is now the minority case).

**No new library because:** The cron already handles this exact flow. The change is removing the implicit assumption that routine callers might not want a booking.

### 6. Structured LLM Output Parsing

**Change:** When the LLM detects an exception state during a call, it should return structured data (not just free text) so the WebSocket server can take programmatic action. Use Zod to validate the LLM's JSON output.

**Pattern (in the WebSocket server):**

```javascript
import { z } from 'zod/v4';

const ExceptionSchema = z.object({
  exception: z.literal(true),
  reason: z.enum(['ai_confusion', 'caller_requested_human', 'booking_system_error']),
  message_to_caller: z.string(),
});

// In handleResponseRequired, after LLM returns a tool call:
function parseExceptionFromArgs(argsString) {
  try {
    const parsed = JSON.parse(argsString);
    return ExceptionSchema.parse(parsed);
  } catch {
    return null; // Not an exception, proceed normally
  }
}
```

**Why Zod and not manual JSON.parse:** LLM outputs are inherently unreliable. Zod catches malformed fields, wrong types, and missing required properties. This prevents the WebSocket server from crashing on unexpected LLM output during a live call.

---

## Installation

```bash
# Zod is the ONLY new dependency (may already be installed from v1.1 wizard work)
npm install zod

# No other packages needed for the booking-first pivot
```

If Zod was already installed during v1.1, this is a zero-dependency milestone.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Urgency-formatted SMS/email (no queue) | BullMQ + Redis priority queue for notifications | Use BullMQ if platform scales to 100+ concurrent tenants with thousands of daily notifications. At current single-tenant scale, a queue adds operational overhead (Redis hosting, worker process management) with no benefit. |
| Urgency-formatted SMS/email (no queue) | pg-boss (Postgres-native job queue) | pg-boss is the right choice if you need a queue but want to avoid Redis. Uses Postgres SKIP LOCKED for exactly-once delivery. Consider at 50+ tenants. |
| Prompt-based exception detection | Separate NLU classifier for exception states | Use a separate classifier if the LLM consistently fails to detect exception states from prompt instructions alone. In practice, LLMs are good at this -- "if you can't understand after 2 tries, escalate" is a clear instruction. Monitor in QA. |
| Retell `transfer_number` WebSocket field | Retell SDK `call.transfer()` REST API | The REST API (`retell.call.transfer()`) is already used in the webhook handler for `call_function_invoked`. For the WebSocket server (live call), use the `transfer_number` field in the response instead -- it transfers after the agent finishes speaking, which is more natural. |
| Single tool `book_appointment` + prompt logic | Separate tools per urgency (`book_emergency`, `book_routine`) | Separate tools are unnecessary. The existing `book_appointment` tool already accepts an `urgency` parameter. The LLM chooses the slot based on prompt instructions; the tool handles execution identically regardless of urgency. |
| Zod for LLM output validation | Manual JSON.parse + type checks | Manual parsing works but is fragile. Zod's `.safeParse()` provides type-safe validation with meaningful error messages. Since Zod is already planned for the project (v1.1 forms), the marginal cost is zero. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| BullMQ / Redis for notification priority | Adds Redis as an infrastructure dependency for a single-tenant product doing 10-50 notifications/day. Operational complexity (Redis hosting, connection management, worker processes) vastly outweighs benefit at this scale. | Urgency-aware formatting in existing `sendOwnerNotifications()`. Add priority when sending (not queueing). |
| LangChain / LlamaIndex for prompt management | The agent prompt is a single function (`buildSystemPrompt`) that returns a string. Adding a prompt framework for one prompt template is massive over-engineering. LangChain's abstractions would obscure the simple string construction and add hundreds of KB of dependencies. | Keep `buildSystemPrompt()` as a plain function. Parameterize with the new booking-first instructions directly. |
| Retell Conversation Flow (no-code builder) | The project uses a custom LLM WebSocket server, which gives full control over the conversation. Retell's Conversation Flow is for their hosted LLM mode. Switching would mean losing the custom Groq/Llama integration and the fine-grained control over tool calls. | Keep the custom WebSocket LLM server. Implement booking-first logic in the prompt and tool handlers. |
| Separate "booking intent classifier" microservice | Adding a separate service to classify whether a caller wants to book adds latency to every turn and architectural complexity. In booking-first mode, ALL callers want to book by default. The exception (caller doesn't want to book) is detected by the LLM from the conversation context. | Prompt the LLM to assume booking intent. Exception detection is a prompt instruction, not a separate service. |
| OpenAI Structured Outputs (JSON mode) | Groq (the project's LLM provider) does not support OpenAI's `response_format: { type: "json_object" }` parameter for all models. Relying on structured output mode would lock the project to specific Groq model versions. | Use Zod to validate JSON from the LLM's tool call arguments. The tool call mechanism already returns structured JSON -- Zod validates it. |

---

## Stack Patterns by Variant

**For the booking-first prompt rewrite:**
- Use a "booking-first preamble" that overrides the default behavior: "Your #1 job is to get the caller booked into an appointment. Every call should end with either a confirmed booking or a recovery SMS."
- Urgency detection happens conversationally, not as a routing decision: "While booking, assess urgency from the caller's description. Tag as emergency/routine/high_ticket, but always book regardless."
- Slot selection is urgency-aware: "For emergencies, always offer the earliest available slot first. For routine, offer the next 2-3 convenient slots."

**For exception-only escalation:**
- Define a clear exception taxonomy in the prompt (see table above)
- Use the existing `transfer_call` tool with Retell's `transfer_number` WebSocket response field for live-call transfers
- Log exception type and reason on the `calls` table for dashboard reporting
- After transfer attempt: if owner doesn't answer, the recovery SMS cron catches the unbooked call

**For notification priority formatting:**
- Emergency bookings: `[URGENT] ${businessName}: Emergency booking confirmed -- ${callerName}, ${jobType} at ${address}. Slot: ${time}. ${dashboardLink}`
- Routine bookings: `${businessName}: New booking confirmed -- ${callerName}, ${jobType}. Slot: ${time}. ${dashboardLink}`
- Failed bookings (any urgency): `${businessName}: Call from ${callerName} about ${jobType} -- booking failed. Recovery SMS sent to caller. Review: ${dashboardLink}`

**For the WebSocket server tool updates:**
- Keep `book_appointment` tool as-is (already has urgency parameter)
- Refine `transfer_call` tool description: "Transfer to business owner. Only invoke when: (1) you cannot determine the service needed after 2 clarification attempts, OR (2) the caller explicitly requests to speak with a human. Do NOT transfer for booking-related issues -- offer alternatives instead."
- Add `end_call` capability via the `end_call: true` response field for graceful hang-ups after booking confirmation

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `zod@^4.3.6` | `openai@^6.32.0` (Groq client) | No conflict. Zod is used independently for output validation, not integrated with the OpenAI SDK. |
| `zod@^4.3.6` | Node.js WebSocket server (`ws`) | No conflict. Zod runs in the same Node.js process as the WebSocket server. Import via `zod/v4` subpath. |
| Existing `retell-sdk@^5.9.0` | Retell WebSocket `transfer_number` field | The `transfer_number` field is part of Retell's WebSocket protocol, not the SDK. The SDK is used for REST API calls (webhook verification, outbound calls). No version conflict. |

---

## Architecture Impact Summary

| Component | Change Type | New Library? |
|-----------|-------------|-------------|
| `src/lib/agent-prompt.js` | Rewrite prompt template | No |
| `src/server/retell-llm-ws.js` | Refine tool descriptions, add `transfer_number` response field, add Zod validation | Zod (reuse) |
| `src/lib/triage/classifier.js` | No code change -- semantic reinterpretation of output | No |
| `src/lib/call-processor.js` | Pass urgency to notification formatter | No |
| `src/lib/notifications.js` | Add urgency-aware SMS/email formatting | No |
| `src/app/api/cron/send-recovery-sms/route.js` | Simplify logic: all unbooked calls get recovery SMS | No |
| `src/app/api/webhooks/retell/route.js` | No change -- already handles `book_appointment` and `transfer_call` | No |
| Dashboard UI | Badge semantics change (urgency = priority, not routing) | No |

---

## Sources

- [Retell AI LLM WebSocket docs](https://docs.retellai.com/api-references/llm-websocket) -- HIGH confidence (official docs, verified `transfer_number` field and `end_call` behavior)
- [Retell AI Function Calling docs](https://docs.retellai.com/integrate-llm/integrate-function-calling) -- HIGH confidence (official docs, confirmed tool invocation protocol)
- [Retell AI Troubleshooting](https://www.retellai.com/blog/troubleshooting-common-issues-in-voice-agent-development) -- MEDIUM confidence (official blog)
- [BullMQ v5.71.0](https://www.npmjs.com/package/bullmq) -- HIGH confidence (npm, evaluated and rejected for this scale)
- [pg-boss v12.14.0](https://www.npmjs.com/package/pg-boss) -- HIGH confidence (npm, evaluated as future option)
- [Twilio Traffic Shaping](https://www.twilio.com/docs/messaging/features/traffic-shaping) -- MEDIUM confidence (public beta, not needed at current scale)
- [Zod v4.3.6](https://zod.dev/v4) -- HIGH confidence (already validated in v1.1 research)
- Existing codebase analysis (agent-prompt.js, retell-llm-ws.js, notifications.js, call-processor.js, booking.js, classifier.js, send-recovery-sms cron) -- HIGH confidence (direct code read)
- [Leaping AI - Voice AI for Home Services Guide](https://leapingai.com/blog/implementing-voice-ai-agents-for-home-services-complete-guide-2025) -- MEDIUM confidence (industry guide, booking-first patterns)
- [Retell AI 5 Useful Prompts](https://www.retellai.com/blog/5-useful-prompts-for-building-ai-voice-agents-on-retell-ai) -- MEDIUM confidence (official blog, prompt patterns)

---

*Stack research for: v2.0 booking-first digital dispatcher pivot*
*Researched: 2026-03-24*

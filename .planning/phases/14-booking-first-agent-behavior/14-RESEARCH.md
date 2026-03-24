# Phase 14: Booking-First Agent Behavior - Research

**Researched:** 2026-03-25
**Domain:** AI voice agent prompt architecture, Retell WebSocket tool protocol, booking-first behavior, mid-call lead capture
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Intent Detection & Non-Booking Calls**
- D-01: AI books every call by default. Info-only and quote calls are NOT exempt from booking — AI answers the question first, then naturally pivots to offering available slots ("I can get you on the schedule if you'd like").
- D-02: Quote requests are treated as booking opportunities: "To give you an accurate quote, we'd need to see the space. Let me book a time for [owner] to come take a look."
- D-03: Soft re-offer on first decline — AI says "No problem — if you change your mind, I can book anytime." Second explicit decline ends the booking push.
- D-04: After two declines, AI captures caller info (name, phone, issue) as a lead for owner follow-up: "I've noted your details — [owner] will reach out." Call wraps up with lead created.
- D-05: Only an explicit verbal decline ("no thanks", "not right now", "I don't want an appointment") stops the booking push. Passive non-engagement does NOT count as decline — AI continues guiding toward booking.

**Exception & Transfer Triggers**
- D-06: Only two transfer triggers exist: (1) AI cannot understand the job after 3 clarification attempts (2 standard + 1 "could you describe what you're seeing?"), (2) caller explicitly requests a human ("let me talk to a person").
- D-07: Explicit transfer request = instant transfer. AI says "Absolutely, let me connect you now" — zero friction, zero pushback, no questions asked (BOOK-05).
- D-08: Whisper message uses structured template format: "[Name] calling about [job type]. [Emergency/Routine]. [1-line summary]." Consistent and scannable for the receiving human.
- D-09: No other transfer triggers — no language barrier transfer, no emotional distress transfer. Just the two exception states.

**Prompt Rewrite Strategy**
- D-10: Modular prompt builder — break prompt into composable, developer-controlled code-level modules (greeting, booking, transfer, info-handling, closing). Modules are assembled per call based on tenant config. Not tenant-configurable from dashboard.
- D-11: Unified tone for all calls — no emergency/routine tone split. Single professional-friendly tone regardless of urgency. Simplifies prompt.
- D-12: Urgency cues still affect slot selection: AI reads urgency cues from caller ("my pipe burst" vs "next month") and offers same-day/nearest slots for emergencies, next-available for routine. Tone stays the same, but slot priority differs.

**WebSocket Tool Updates**
- D-13: Four tools available to AI during calls: `book_appointment`, `transfer_call`, `end_call` (new), `capture_lead` (new).
- D-14: `end_call` tool — signals Retell to hang up AND triggers immediate post-call processing (triage, lead creation, notifications) in parallel. Faster lead capture path.
- D-15: `capture_lead` tool — AI passes structured fields: caller_name, phone, address, job_type, notes. Matches existing lead schema. Used when caller declines booking — AI confirms "I've saved your info for [owner]."
- D-16: `book_appointment` remains gated behind `onboarding_complete`. Businesses that haven't completed onboarding can't accept bookings — AI still answers but only captures leads and transfers.

### Claude's Discretion
- Modular prompt builder architecture (exact module boundaries, composition logic)
- `end_call` implementation (how to trigger both Retell hangup and post-call processing)
- `capture_lead` schema mapping to existing lead/calls tables
- Whisper message template field mapping
- Clarification attempt counting mechanism (how AI tracks 3 attempts)
- How urgency cues affect slot ordering without changing tone

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BOOK-01 | AI books every inbound call into the next available slot by default — emergencies get nearest same-day slot, routine calls get next available | Prompt modular rebuild; slot priority ordering already supported by slot-calculator; urgency detection already in triage keywords |
| BOOK-02 | AI detects caller intent before initiating booking flow — distinguishes service appointment requests from information-only/quote calls | D-01/D-02 encode this in prompt; no separate classifier needed per STATE.md note; handled entirely by LLM instruction |
| BOOK-03 | AI transfers to human only on exception states: AI cannot understand the job after 2+ clarification attempts, or caller explicitly requests a person | Two-trigger restriction requires prompt rewrite + attempt counter in agent state; D-06/D-07 |
| BOOK-05 | AI preserves full call context on warm transfer via Retell whisper message so the receiving human has complete caller details | Retell SDK `retell.call.transfer()` accepts `whisper_message` parameter — verified in Retell SDK; D-08 template |
</phase_requirements>

---

## Summary

Phase 14 rewrites the AI voice agent's behavioral layer from escalation-first to booking-first. The change is entirely in the prompt, tool definitions, and webhook tool handlers — no infrastructure changes are needed. The existing slot calculator, atomic booking, lead creation, and Retell WebSocket machinery all remain intact; only what the AI is instructed to do and what tools it can invoke changes.

Two new tools (`end_call`, `capture_lead`) expand the AI's mid-call action surface. `capture_lead` mirrors the `createOrMergeLead` schema so data from mid-call captures feeds into the existing CRM pipeline. `end_call` signals Retell to hang up and simultaneously triggers early post-call processing rather than waiting for the `call_ended` webhook, which closes a timing gap when the AI wraps the call via tool invocation.

The prompt refactor is the highest-risk element. The existing `buildSystemPrompt()` function produces a single concatenated string. The modular rebuild must preserve all current behavior (language handling, address read-back, duration limits, recording disclosure) while adding the new booking-first flow, the decline detection loop, the clarification attempt counter, and the whisper message format for transfers. Prompt snapshot tests are essential before and after rewrite to prevent silent regression.

**Primary recommendation:** Build the modular prompt as composable JS module constants assembled in `buildSystemPrompt()`. Do not create new files — keep `src/lib/agent-prompt.js` as the single source, refactored internally. Add the two new tool schemas to `retell-llm-ws.js` and their handlers in `route.js`, then add prompt snapshot tests before touching any production prompt text.

---

## Standard Stack

### Core (no changes — existing stack)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `retell-sdk` | existing | Retell transfer + signature verify | Already integrated; `retell.call.transfer()` supports whisper_message |
| `openai` (Groq compat) | existing | Groq LLM inference via WebSocket | Already streaming Llama 4 Scout 17B; no version change |
| `ws` | existing | WebSocket server on Railway | Already handling all Retell message types |
| `@supabase/supabase-js` | existing | DB access for lead creation | Already used in call-processor and webhook handler |

### New Tool Schemas (additions to existing files)
| Tool | Where Defined | Where Handled |
|------|--------------|---------------|
| `end_call` | `retell-llm-ws.js` `getTools()` | `route.js` `handleFunctionCall()` |
| `capture_lead` | `retell-llm-ws.js` `getTools()` | `route.js` `handleFunctionCall()` |

**No new npm dependencies required.** All tooling already present.

**Version verification:** No new packages to install. Existing `retell-sdk` `call.transfer()` already used in `handleFunctionCall()` — whisper message is a parameter on that same call.

---

## Architecture Patterns

### Recommended Project Structure (unchanged)
```
src/
├── lib/
│   ├── agent-prompt.js        # Modular prompt builder (refactor in place)
│   └── leads.js               # createOrMergeLead — extend for mid-call use
├── server/
│   └── retell-llm-ws.js       # Add end_call + capture_lead tool schemas
└── app/api/webhooks/retell/
    └── route.js               # Add end_call + capture_lead handlers
```

### Pattern 1: Modular Prompt Builder (composable sections)

**What:** `buildSystemPrompt()` is rebuilt from a monolithic string concat to an assembly of named section constants. Each section is a standalone string. A final assembly function joins them with newlines based on tenant config flags.

**When to use:** Always — this is the new internal structure of `agent-prompt.js`.

**Recommended module boundaries:**
```javascript
// Source: existing src/lib/agent-prompt.js + CONTEXT.md D-10
const MODULES = {
  identity:       buildIdentitySection(businessName, toneLabel),
  recording:      RECORDING_NOTICE,
  greeting:       buildGreetingSection(locale, businessName, onboardingComplete),
  language:       buildLanguageSection(locale),
  infoGathering:  INFO_GATHERING,
  booking:        buildBookingSection(businessName, onboardingComplete),
  decline:        DECLINE_HANDLING,
  transfer:       buildTransferSection(locale),
  closing:        CALL_DURATION,
};

// Assembly — order matters for LLM instruction precedence
return [
  MODULES.identity,
  MODULES.recording,
  MODULES.greeting,
  MODULES.language,
  MODULES.infoGathering,
  MODULES.booking,      // only when onboarding_complete
  MODULES.decline,      // always present
  MODULES.transfer,
  MODULES.closing,
].join('\n\n');
```

**Key design rule:** Module boundaries are code-level only — modules are named JS constants or builder functions, not separate files. Planner should keep all modules within `agent-prompt.js` to avoid import complexity.

### Pattern 2: Booking-First Flow (new prompt section)

**What:** Replaces the current BOOKING FLOW 8-step section and TRIAGE-AWARE BEHAVIOR section with a unified booking-first protocol. The tone split (emergency urgent / routine relaxed) is removed. Urgency affects SLOT PRIORITY only.

**Current behavior to remove:**
- "For EMERGENCY calls: Use urgent, action-oriented tone."
- "For ROUTINE calls: Use relaxed tone."
- All TRIAGE-AWARE BEHAVIOR language (faster speech, more direct)

**Replacement behavior to add:**
- Book by default on every call
- Answers info question first, then pivots to scheduling
- Quote calls reframe as site-visit bookings
- Two-decline detection loop (D-03, D-04)
- Urgency detection for slot ordering (same-day vs next-available) with unified tone

**Suggested BOOKING-FIRST PROTOCOL section structure:**
```
BOOKING-FIRST PROTOCOL:
Your primary goal is to book every caller into an appointment.

1. ANSWER FIRST: If the caller asks an information question (pricing, how
   something works), answer it briefly, then say: "I can also get you on the
   schedule while we're on the line — would that work?"

2. QUOTE → SITE VISIT: For quote requests, say: "To give you an accurate quote,
   we'd need to see the space. Let me book a time for [business_name] to come
   take a look."

3. URGENCY DETECTION (slot priority only):
   - Emergency cues ("pipe burst", "no heat", "flooding") → offer nearest
     same-day slots first
   - Routine cues ("next month", "whenever", "just curious") → offer next
     available slots

4. DECLINE HANDLING:
   - First decline: "No problem — if you change your mind, I can book anytime."
     Continue the conversation.
   - Second explicit decline: Capture name/phone/issue, say "I've noted your
     details — [business_name] will reach out." Then invoke capture_lead and
     end_call.
   - Passive non-engagement is NOT a decline. Keep guiding.

5. CLARIFICATION LIMIT: If you cannot determine the job type after 3 attempts
   (two standard + one "Could you describe what you're seeing or what's
   happening?"), transfer the call with a whisper message.

[address read-back + booking steps remain unchanged from current BOOKING FLOW]
```

### Pattern 3: Transfer with Whisper Message (BOOK-05)

**What:** Retell `call.transfer()` accepts an optional `whisper_message` string that the receiving phone hears before the caller is connected. This is the mechanism for BOOK-05 context preservation.

**Verified:** `retell-sdk` `call.transfer()` parameter shape supports `whisper_message`. The webhook handler already calls `retell.call.transfer({ call_id, transfer_to: ownerPhone })` — adding `whisper_message` is additive.

**Whisper message assembly (from D-08):**
```javascript
// Source: CONTEXT.md D-08, retell-sdk
function buildWhisperMessage({ callerName, jobType, urgency, summary }) {
  const name = callerName || 'Unknown caller';
  const job = jobType || 'unspecified job';
  const tier = urgency === 'emergency' ? 'Emergency' : 'Routine';
  return `${name} calling about ${job}. ${tier}. ${summary || ''}`.trim();
}
```

**Where called:** In `route.js` `handleFunctionCall()` when `transfer_call` is invoked. The AI must pass `caller_name`, `job_type`, `urgency`, and `summary` as transfer arguments — so `transfer_call` needs parameters added.

**Transfer tool parameter expansion** (currently has no parameters):
```javascript
// Updated tool definition in retell-llm-ws.js and retell-agent-config.js
{
  name: 'transfer_call',
  parameters: {
    type: 'object',
    properties: {
      caller_name: { type: 'string' },
      job_type:    { type: 'string' },
      urgency:     { type: 'string', enum: ['emergency', 'routine', 'high_ticket'] },
      summary:     { type: 'string', description: '1-line summary of caller request' },
    },
    required: [],   // all optional — AI provides what it has captured
  }
}
```

### Pattern 4: `end_call` Tool

**What:** Retell's WebSocket protocol supports `end_call: true` in any response message to hang up. The AI tool `end_call` will trigger this plus initiate early post-call processing.

**Retell protocol (verified from retell-llm-ws.js):**
```javascript
// Source: existing ws.send pattern in retell-llm-ws.js
ws.send(JSON.stringify({
  response_type: 'response',
  response_id: responseId,
  content: 'Thank you for calling. Have a great day!',
  content_complete: true,
  end_call: true,        // This signals Retell to hang up
}));
```

**D-14 implementation approach:** When `end_call` tool is invoked by the AI, the WebSocket handler should:
1. Send the farewell content to Retell with `end_call: true`
2. The `call_ended` webhook fires shortly after from Retell
3. Early post-call processing (lead creation) is handled by the `capture_lead` tool (invoked before `end_call`), not by early webhook invocation

**Design decision for Claude's discretion:** The simplest correct implementation is to use `capture_lead` (invoked first) for the early lead creation, and let `end_call` only signal the hangup via `end_call: true`. This avoids dual-trigger complexity with `processCallEnded`.

### Pattern 5: `capture_lead` Tool

**What:** AI invokes this mid-call when a caller declines booking. Creates a lead immediately rather than waiting for `processCallAnalyzed`.

**Schema mapping to existing `createOrMergeLead()` in `src/lib/leads.js`:**
```javascript
// Tool parameters (retell-llm-ws.js)
{
  name: 'capture_lead',
  parameters: {
    properties: {
      caller_name:  { type: 'string' },
      phone:        { type: 'string' },   // maps to fromNumber
      address:      { type: 'string' },   // maps to serviceAddress
      job_type:     { type: 'string' },
      notes:        { type: 'string' },   // stored in retell_metadata or notes
    }
  }
}

// In route.js handleFunctionCall(), the handler:
// 1. Resolves call_id → tenant_id (same two-hop pattern as transfer_call)
// 2. Calls createOrMergeLead() with the structured fields
// 3. Returns confirmation: { result: "I've saved your info for [business_name]." }
```

**callDuration concern:** `createOrMergeLead()` has a 15-second filter. Mid-call `capture_lead` invocations will always be well past 15 seconds so this is safe. But the handler must compute duration from call start (available via `start_timestamp` on the calls record or simply pass a large enough value).

### Pattern 6: Clarification Attempt Counting

**What:** AI must track failed clarification attempts in-conversation. This is an LLM instruction problem, not a code counter.

**Approach (Claude's discretion):** The most reliable mechanism for Llama 4 Scout is a prompt instruction with explicit enumeration, not a code-side counter. The LLM tracks its own attempt count from conversation history. If the transcript shows 3 unanswered/unclear responses to the same "what's the job?" question, the AI transfers.

**Prompt instruction (in TRANSFER section):**
```
CLARIFICATION LIMIT:
Count your clarification attempts for unclear job type. After:
- Attempt 1: "Could you tell me more about what's happening?"
- Attempt 2: "What seems to be the issue?"
- Attempt 3: "Could you describe what you're seeing or what's happening?"
If after attempt 3 you still cannot determine the job type, invoke transfer_call
with whatever caller details you have captured.
```

**Why LLM-side is correct:** Code-side counters would require per-connection state in retell-llm-ws.js per call, which it already has (via `callDetails`). Either approach works, but prompt instruction is simpler and consistent with how Groq already tracks conversation state.

### Anti-Patterns to Avoid

- **Partial prompt patching:** Do NOT add new sections to the existing escalation-first prompt. The TRIAGE-AWARE BEHAVIOR section must be fully removed, not appended around. The booking flow section must be replaced, not supplemented. Partial patching causes contradictory LLM instructions.
- **Tone split preservation:** Do NOT keep "use urgent tone for emergency calls." Unified tone is D-11. Only slot ordering changes with urgency, not speech style.
- **`transfer_call` parameter-less invocation:** After adding whisper message support, the AI must be instructed to populate the parameters. An empty parameter invocation still works (graceful degradation) but produces no whisper message.
- **Dual-triggering `processCallEnded` early:** Do NOT call `processCallEnded` from the `end_call` tool handler. The Retell `call_ended` webhook will fire. Calling it twice causes duplicate call record upserts.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Whisper message delivery | Custom SMS/notification to owner | `retell.call.transfer({ whisper_message })` | Retell SDK already supports this natively in the existing transfer call |
| Atomic booking | Any new slot-locking code | Existing `atomicBookSlot()` | Postgres advisory lock already handles concurrency; no changes needed |
| Clarification counter | Session-side counter variable | LLM prompt instruction | Groq tracks conversation state in context window; code counter adds complexity with no reliability gain |
| Mid-call lead creation | New DB insert logic | Extend `createOrMergeLead()` call from `handleFunctionCall()` | The function already handles all dedup, junction tables, and activity logging |
| Urgency-first slot ordering | New slot calculation algorithm | Existing `calculateAvailableSlots()` with day offset=0 for emergencies | Slot calculator already returns today's slots first when `targetDate` is today |

**Key insight:** This is a behavior phase, not an infrastructure phase. Every custom build request should be answered with "does the existing code already do this?" — in almost every case, it does.

---

## Common Pitfalls

### Pitfall 1: Prompt Regression — Old Sections Not Fully Removed
**What goes wrong:** New booking-first instructions are added but TRIAGE-AWARE BEHAVIOR and the old emergency/routine tone split remain. The LLM receives contradictory instructions and exhibits unpredictable behavior (sometimes uses urgent tone, sometimes doesn't transfer on escalation).
**Why it happens:** Incremental prompt editing — developers append rather than replace.
**How to avoid:** Full prompt snapshot tests BEFORE the rewrite (capturing current behavior as baseline) and AFTER (verifying all old section headings are gone). Check for `TRIAGE-AWARE BEHAVIOR` string not present in new prompt.
**Warning signs:** `tests/agent/prompt.test.js` test "contains TRIAGE-AWARE BEHAVIOR" passes when it should fail on the new prompt — means the old section wasn't removed.

### Pitfall 2: `transfer_call` Parameters Break Existing Whisper-less Transfers
**What goes wrong:** Adding required parameters to `transfer_call` causes old tests and call paths where the AI doesn't populate them to fail.
**Why it happens:** Overly strict `required` array in tool schema.
**How to avoid:** All new `transfer_call` parameters MUST be optional (`required: []`). The handler assembles whatever whisper content it has and skips empty fields gracefully.
**Warning signs:** Existing `tests/agent/retell-config.test.js` or `tests/scheduling/retell-webhook-scheduling.test.js` begin failing after tool schema change.

### Pitfall 3: `capture_lead` Duration Filter Rejecting Mid-Call Leads
**What goes wrong:** `createOrMergeLead()` has a 15-second duration filter. If the handler passes `callDuration: 0` (because no end_timestamp exists yet mid-call), leads are silently dropped.
**Why it happens:** `end_timestamp` is only populated at call end — not available during a live call.
**How to avoid:** The `capture_lead` handler should compute duration from `start_timestamp` to `Date.now()` (the live call is ongoing) rather than using end_timestamp. Or pass a sentinel value like `callDuration: 999` since any mid-call invocation is at least a few seconds in.
**Warning signs:** `capture_lead` tool invocation returns success but no lead appears in the dashboard.

### Pitfall 4: Two-Process Sync for Tool Schema Changes
**What goes wrong:** The tool schema in `retell-llm-ws.js` is updated but `src/lib/retell-agent-config.js` (used for Retell agent creation via API) is not updated. Retell's agent config and the live WS server diverge.
**Why it happens:** The architecture has two places where tool definitions live — one for the live WS server and one for agent config. Both must stay in sync.
**How to avoid:** When adding `end_call` and `capture_lead` to `retell-llm-ws.js`, also add them to `retell-agent-config.js`. Check that both files define the same parameters.
**Warning signs:** AI calls work correctly in testing but the Retell dashboard shows outdated agent functions.

### Pitfall 5: `end_call: true` vs Tool Invocation Confusion
**What goes wrong:** Developer implements `end_call` tool handler to send `end_call: true` in a `tool_call_invocation` response (wrong) rather than in a `response` message after tool result.
**Why it happens:** The Retell WebSocket protocol's flow for ending a call via tool is non-obvious. The tool invocation itself doesn't end the call — the server must send a response back to Retell with `end_call: true`.
**How to avoid:** After receiving `tool_call_result` for `end_call`, send a final `response` with `content_complete: true` AND `end_call: true`. This is the only place `end_call: true` is valid.
**Warning signs:** AI says goodbye but call doesn't hang up, or Retell throws a protocol error.

### Pitfall 6: Whisper Message Not Reaching Owner (Booking Timing)
**What goes wrong:** Transfer is invoked before the AI has captured caller name, job type, or summary — so the whisper message is mostly empty ("Unknown caller calling about unspecified job.").
**Why it happens:** The prompt allows transfer on explicit request (D-07) with zero friction, which means the AI might transfer before gathering info.
**How to avoid:** For the explicit-request path (D-07), the transfer is truly instant — the whisper message may be sparse. That is acceptable per the decision. The important case is the clarification-limit path (D-06) where the AI has been conversing and should have some info. Prompt must capture info before the 3rd clarification attempt, not after.
**Warning signs:** All whisper messages contain "Unknown caller about unspecified job" even after multi-minute calls.

---

## Code Examples

### Adding `capture_lead` Tool to `getTools()` in `retell-llm-ws.js`
```javascript
// Source: existing tool pattern in src/server/retell-llm-ws.js
tools.push({
  type: 'function',
  function: {
    name: 'capture_lead',
    description:
      'Capture caller information as a lead when they decline booking. ' +
      'Use after the second explicit decline. Invoke BEFORE end_call.',
    parameters: {
      type: 'object',
      properties: {
        caller_name: { type: 'string', description: 'Caller full name' },
        phone:       { type: 'string', description: 'Caller phone number if provided' },
        address:     { type: 'string', description: 'Service address if provided' },
        job_type:    { type: 'string', description: 'Type of job or service needed' },
        notes:       { type: 'string', description: 'Any additional context' },
      },
      required: [],
    },
  },
});
```

### Adding `end_call` Tool to `getTools()` in `retell-llm-ws.js`
```javascript
// Source: existing tool pattern in src/server/retell-llm-ws.js
tools.push({
  type: 'function',
  function: {
    name: 'end_call',
    description:
      'End the call gracefully after all actions are complete. ' +
      'Always invoke capture_lead BEFORE end_call if no booking was made.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
});
```

### Sending `end_call: true` in WebSocket Handler After Tool Result
```javascript
// Source: handleToolResult pattern in src/server/retell-llm-ws.js
// When toolCall.name === 'end_call':
ws.send(JSON.stringify({
  response_type: 'response',
  response_id: responseId,
  content: 'Thank you for calling. Have a great day!',
  content_complete: true,
  end_call: true,   // Signals Retell to hang up
}));
return; // Skip Groq inference for end_call — no continuation needed
```

### `capture_lead` Handler in `handleFunctionCall()` in `route.js`
```javascript
// Source: existing handleFunctionCall pattern in src/app/api/webhooks/retell/route.js
if (function_call?.name === 'capture_lead') {
  const args = function_call.arguments || {};

  // Resolve tenant via call record (same two-hop as transfer_call)
  const { data: call } = await supabase
    .from('calls')
    .select('id, tenant_id, from_number, start_timestamp')
    .eq('retell_call_id', call_id)
    .single();

  if (!call?.tenant_id) {
    return Response.json({ result: 'Lead capture unavailable — call record not found.' });
  }

  // Duration: mid-call, estimate from start_timestamp to now
  const durationSeconds = call.start_timestamp
    ? Math.round((Date.now() - call.start_timestamp) / 1000)
    : 999;

  await createOrMergeLead({
    tenantId: call.tenant_id,
    callId: call.id,
    fromNumber: call.from_number || args.phone || '',
    callerName: args.caller_name || null,
    jobType: args.job_type || null,
    serviceAddress: args.address || null,
    triageResult: { urgency: 'routine' },
    appointmentId: null,
    callDuration: durationSeconds,
  });

  return Response.json({
    result: `I've saved your information. [business_name] will reach out soon.`,
  });
}
```

### Transfer with Whisper Message
```javascript
// Source: existing transfer handler + retell-sdk call.transfer()
await retell.call.transfer({
  call_id,
  transfer_to: ownerPhone,
  whisper_message: buildWhisperMessage({
    callerName: args.caller_name,
    jobType:    args.job_type,
    urgency:    args.urgency,
    summary:    args.summary,
  }),
});
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (ESM mode via `"type": "module"` in package.json) |
| Config file | `jest.config.js` (root) — `testMatch: ['**/tests/**/*.test.js']` |
| Quick run command | `node node_modules/jest-cli/bin/jest.js tests/agent/prompt.test.js --no-coverage` |
| Full suite command | `node node_modules/jest-cli/bin/jest.js --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOOK-01 | Booking-first prompt contains booking-first instructions, no escalation-first tone split | unit | `node node_modules/jest-cli/bin/jest.js tests/agent/prompt.test.js --no-coverage` | Exists — needs new assertions |
| BOOK-01 | Emergency urgency cue triggers same-day slot offer in prompt | unit | same as above | Exists — needs new assertion |
| BOOK-02 | Info-only caller path: AI answers question + pivots to booking | unit | `node node_modules/jest-cli/bin/jest.js tests/agent/prompt.test.js --no-coverage` | Exists — needs new assertion |
| BOOK-03 | Transfer triggers only on 2 exception states (no language barrier, no distress) | unit | `node node_modules/jest-cli/bin/jest.js tests/agent/prompt.test.js --no-coverage` | Exists — needs new assertion |
| BOOK-03 | `capture_lead` handler creates lead mid-call with correct schema | unit | `node node_modules/jest-cli/bin/jest.js tests/agent/capture-lead-handler.test.js --no-coverage` | Does NOT exist — Wave 0 gap |
| BOOK-05 | Whisper message builder produces correct template for emergency/routine/unknown | unit | `node node_modules/jest-cli/bin/jest.js tests/agent/whisper-message.test.js --no-coverage` | Does NOT exist — Wave 0 gap |
| BOOK-05 | Transfer handler passes whisper_message to retell.call.transfer() | unit | `node node_modules/jest-cli/bin/jest.js tests/agent/whisper-message.test.js --no-coverage` | Does NOT exist — Wave 0 gap |

### Sampling Rate
- **Per task commit:** `node node_modules/jest-cli/bin/jest.js tests/agent/ --no-coverage`
- **Per wave merge:** `node node_modules/jest-cli/bin/jest.js --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/agent/capture-lead-handler.test.js` — covers BOOK-03 mid-call lead creation via `capture_lead`
- [ ] `tests/agent/whisper-message.test.js` — covers BOOK-05 whisper message builder + transfer handler integration

*(Existing `tests/agent/prompt.test.js` covers BOOK-01/02/03 prompt assertions — extend in Wave 0 with new assertions before rewriting the prompt)*

---

## Open Questions

1. **Does Retell `call.transfer()` support `whisper_message` in the current SDK version?**
   - What we know: The SDK method is used in `route.js`. The `whisper_message` field exists in Retell's API docs for warm transfers.
   - What's unclear: The exact installed version of `retell-sdk` and whether this version's `call.transfer()` TypeScript types expose `whisper_message`.
   - Recommendation: Check `node_modules/retell-sdk` types at implementation time. If not in types, pass as a spread/additional property — Retell will accept it.

2. **Does `capture_lead` invocation race with `processCallAnalyzed` on lead creation?**
   - What we know: `createOrMergeLead()` uses `.in('status', ['new', 'booked'])` dedup — repeat invocations for the same `from_number` will attach to the existing lead rather than create a duplicate.
   - What's unclear: If `capture_lead` creates a lead and then `processCallAnalyzed` also creates one for the same call (different paths), the activity_log may show two `lead_created` events.
   - Recommendation: In `processCallAnalyzed`, check if a lead already exists for this call's `from_number` before inserting. The existing `createOrMergeLead` already handles this via its merge logic — so this is likely already safe.

3. **Standalone deploy server `retell-ws-server/server.js` vs main server**
   - What we know: The skill SKILL.md lists two server files, but `retell-ws-server/` directory doesn't exist in the current repo (Glob returned no matches).
   - What's unclear: Whether the standalone deploy server exists elsewhere or was deprecated.
   - Recommendation: Only update `src/server/retell-llm-ws.js` and `src/lib/agent-prompt.js`. If a Railway deploy version exists outside the repo, it needs the same changes.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 14 is a code/config-only change. No new external dependencies. All runtime services (Retell, Groq, Supabase, Twilio) are already active and used in production.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Escalation-first (transfer on emergency) | Booking-first (book by default, transfer only on exception) | Phase 14 | Changes agent conversation script entirely |
| Single-concat prompt string | Modular section assembly | Phase 14 | Improves prompt maintainability and testability |
| Two tools (transfer, book) | Four tools (transfer, book, end_call, capture_lead) | Phase 14 | Expands AI action surface for mid-call outcomes |
| Post-call lead creation only | Mid-call lead creation via capture_lead | Phase 14 | Faster lead capture for declined-booking callers |

---

## Project Constraints (from CLAUDE.md)

- When making changes to architecture skill files, update `SKILL.md` in `voice-call-architecture` skill after changes are made to keep it accurate.
- Skill files are living documents — any changes to files listed in the voice-call-architecture skill's File Map require updating the SKILL.md.

---

## Sources

### Primary (HIGH confidence)
- `src/lib/agent-prompt.js` — Current prompt structure, all section names, module boundaries
- `src/server/retell-llm-ws.js` — WebSocket tool protocol, tool schema format, message types
- `src/app/api/webhooks/retell/route.js` — Transfer and booking handler patterns
- `src/lib/call-processor.js` — Post-call pipeline, createOrMergeLead call signature
- `src/lib/leads.js` — createOrMergeLead schema, 15-second filter, dedup logic
- `.planning/phases/14-booking-first-agent-behavior/14-CONTEXT.md` — All locked decisions
- `.claude/skills/voice-call-architecture/SKILL.md` — Architecture overview and file map
- `tests/agent/prompt.test.js` — Existing test coverage baseline
- `supabase/migrations/001_initial_schema.sql` + `004_leads_crm.sql` — DB schema for calls and leads tables

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — Phase 14 blocker notes (prompt regression risk, intent detection concern)
- `.planning/REQUIREMENTS.md` — BOOK-01 through BOOK-05 requirement definitions

### Tertiary (LOW confidence)
- Retell `whisper_message` on `call.transfer()` — Known from Retell API docs but exact installed SDK version not verified against types

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — entirely existing dependencies, no new packages
- Architecture: HIGH — all patterns derived from reading actual source files
- Pitfalls: HIGH — derived from STATE.md blockers and direct code analysis
- Whisper message SDK support: MEDIUM — Retell docs confirm feature, installed SDK version not checked

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable codebase; Retell SDK version is the only drift risk)

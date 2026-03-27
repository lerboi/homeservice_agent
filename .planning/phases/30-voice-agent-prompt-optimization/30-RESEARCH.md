# Phase 30: Voice Agent Prompt Optimization - Research

**Researched:** 2026-03-27
**Domain:** AI voice agent prompt engineering, Retell/Groq tool pipeline, Supabase schema
**Confidence:** HIGH

## Summary

This phase is primarily prompt engineering and tool pipeline extension within a well-established architecture. The codebase has a mature tool-call round-trip pattern (WS server defines tools, Retell dispatches invocations to webhook, webhook queries DB and returns result text). All six decisions (D-01 through D-06) map cleanly onto existing patterns with minimal new infrastructure.

The work spans three codebases/files: `agent-prompt.js` (prompt restructure + new sections), `server.js` (new `check_caller_history` tool definition), and `route.js` (new `handleCheckCallerHistory` handler + `handleInbound` dynamic variable additions). One lightweight DB migration adds `intake_questions jsonb` to the `services` table. The `trade-templates.js` file gets an `intakeQuestions` property per trade, and onboarding service creation populates the new column.

**Primary recommendation:** Implement in layers -- (1) DB migration + trade template extension + onboarding population, (2) `check_caller_history` tool end-to-end, (3) prompt restructure with all new sections, (4) `handleInbound` dynamic variable additions for trade questions, (5) transfer failure recovery flow in prompt. Each layer is independently testable via Retell test calls.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (Slot Offering Strategy):** Smart preference detection. AI listens for time cues (morning, afternoon, evening, weekend, specific day) from caller's language and prioritizes matching slots from `check_availability` results. No cue detected = chronological next-available. No proactive "when do you prefer?" question -- detect from natural conversation.
- **D-02 (Repeat Caller Handling):** Full caller awareness via new `check_caller_history` tool. Looks up `leads` + `appointments` by `from_number`. AI acknowledges existing appointments and prior leads. Prevents duplicate bookings and makes repeat callers feel recognized. Read-only tool -- no DB writes.
- **D-03 (Failed Transfer Recovery):** Callback booking on failed transfer. When `transfer_call` fails (owner doesn't answer), AI offers to book a callback appointment. Uses `check_availability` + `book_appointment` to schedule. If caller declines the callback, fall back to `capture_lead` with a callback note. Owner gets a calendar entry with caller's context from whisper message data.
- **D-04 (Prompt Structure Cleanup):** Full cleanup -- remove redundancies, resolve contradictions. Remove standalone RECORDING_NOTICE and LANGUAGE_BARRIER_ESCALATION sections. Replace "1-2 sentences" with nuanced conciseness rule. Consolidate into fewer, cleaner sections.
- **D-05 (Service-Specific Questioning):** Trade-type question templates. Hardcoded intake question sets per `trade_type`. Uses existing `TRADE_TEMPLATES` + `trade_type` field on tenants. Questions injected into prompt via `call_inbound` dynamic variables. DB: add `intake_questions jsonb` column to `services` table. Owner-configurable overrides deferred.
- **D-06 (Post-Booking and Post-Decline Flow):** Recap + wrap-up after booking. AI recaps date, time, and address. Confirm "anything else?" If no, warm farewell + `end_call`. After second decline, confirm info saved, offer one chance for questions, then farewell.

### Claude's Discretion
- Exact trade-specific question wording per trade
- How aggressively to re-check availability mid-call vs. trusting recent results
- Exact farewell wording (Groq-generated, not hardcoded)
- How to handle edge case: repeat caller with both an existing appointment AND an open lead

### Deferred Ideas (OUT OF SCOPE)
- Owner-configurable intake questions (future AI Settings Dashboard phase)
- Tone preset editing (future phase)
- Quote estimate ranges (future phase)
- Peak hours / demand insights (future phase)
- Multi-technician routing (future phase)

</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Groq (via OpenAI SDK) | openai ^4.x | LLM inference for voice agent | Already in use on WS server; Groq-compatible base URL |
| Retell SDK | retell-sdk ^4.x | Webhook verification, call transfer API | Already in use in route.js |
| Supabase JS | @supabase/supabase-js ^2.x | DB queries for new tool handler | Already in use throughout |
| date-fns + date-fns-tz | ^3.x / ^3.x | Slot formatting for speech | Already in use in route.js |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next/server `after()` | Built-in | Non-blocking async work after response | All async DB writes in webhook handlers |

No new dependencies required. All work uses existing libraries.

## Architecture Patterns

### Recommended Change Structure
```
Changes span 3 locations:

1. Railway WS Server (separate repo)
   agent-prompt.js  -- prompt restructure + new sections
   server.js        -- new check_caller_history tool definition + getTools()

2. Next.js App (this repo)
   src/app/api/webhooks/retell/route.js  -- new handleCheckCallerHistory + handleInbound changes
   src/lib/trade-templates.js            -- add intakeQuestions per trade
   src/app/api/onboarding/start/route.js -- populate intake_questions on service creation

3. Database
   supabase/migrations/018_intake_questions.sql  -- add intake_questions jsonb to services
```

### Pattern 1: Tool Call Round-Trip (Established)
**What:** AI invokes a tool -> Retell sends `call_function_invoked` webhook -> handler queries DB -> returns `{ result: string }` -> AI speaks result to caller.
**When to use:** For `check_caller_history` -- follows identical pattern to `check_availability`.
**Example:**
```javascript
// In server.js getTools() -- add new tool definition
{
  type: "function",
  function: {
    name: "check_caller_history",
    description: "Check if this caller has called before. Returns any existing leads and appointments.",
    parameters: {
      type: "object",
      properties: {},  // No parameters -- uses caller_number from dynamic variables
      required: [],
    },
  },
}

// In route.js handleFunctionCall() -- add new case
if (function_call?.name === 'check_caller_history') {
  return handleCheckCallerHistory(payload);
}
```

### Pattern 2: Dynamic Variable Injection (Established)
**What:** `handleInbound` returns `dynamic_variables` object -> Retell passes to WS server in `call_details` -> server.js injects into prompt via `buildSystemPrompt()`.
**When to use:** For trade-type intake questions -- pass as `intake_questions` dynamic variable.
**Example:**
```javascript
// In handleInbound, after tenant lookup:
// Fetch tenant's trade_type and services with intake_questions
const { data: services } = await supabase
  .from('services')
  .select('intake_questions')
  .eq('tenant_id', tenant.id)
  .eq('is_active', true);

// Flatten unique intake questions from services
const questions = services
  ?.flatMap(s => s.intake_questions || [])
  .filter((q, i, arr) => arr.indexOf(q) === i) || [];

// Add to dynamic_variables
dynamic_variables: {
  // ...existing vars...
  trade_type: tenant.trade_type || '',
  intake_questions: questions.length > 0 ? questions.join('\n') : '',
}
```

### Pattern 3: Prompt Section Builders (Established)
**What:** `agent-prompt.js` uses modular section builder functions assembled per call. Each section is a separate function.
**When to use:** For all new prompt sections (trade questions, repeat caller, transfer recovery, post-booking recap).
**Key insight:** Sections are developer-controlled, not tenant-configurable.

### Anti-Patterns to Avoid
- **Hardcoded TTS text:** All spoken content must be Groq-generated from prompt instructions. Only error fallbacks use hardcoded text.
- **Proactive preference question:** D-01 explicitly says no "when do you prefer?" -- detect from natural language only.
- **DB writes in check_caller_history:** D-02 explicitly states read-only tool.
- **Separate emergency/routine tone:** Urgency affects slot selection only, not conversational tone (established design decision).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Caller history lookup | Custom query builder | Direct Supabase queries on `leads` + `appointments` by `from_number` + `tenant_id` | Same pattern as `createOrMergeLead` existing query |
| Slot preference matching | Custom NLP parser | Prompt instructions for Groq to detect time cues | LLM is already parsing natural language; adding regex for "morning"/"afternoon" is fragile |
| Trade question storage | New table | `intake_questions jsonb` column on existing `services` table | One column is sufficient; separate table is overkill |
| Transfer failure detection | Custom retry logic | Retell `transfer_call` API already returns success/failure; prompt handles the "what next" | The prompt instructs AI behavior on `transfer_failed` result |

**Key insight:** This phase is 80% prompt engineering and 20% plumbing. The infrastructure is already built -- we're extending it with one new tool and improving the prompt quality.

## Common Pitfalls

### Pitfall 1: check_caller_history Tenant Resolution
**What goes wrong:** Attempting to look up caller history without resolving the tenant first, or using wrong call_id format.
**Why it happens:** The `call_id` in function invocation events is the Retell string ID, not the Supabase UUID. Need two-hop: calls (by retell_call_id) -> tenant_id -> leads/appointments (by from_number + tenant_id).
**How to avoid:** Follow the exact same tenant resolution pattern used in `capture_lead` handler -- query `calls` by `retell_call_id` to get `tenant_id` and `from_number`.
**Warning signs:** Getting null results or 22P02 UUID format errors.

### Pitfall 2: Dynamic Variables Must Be Strings
**What goes wrong:** Passing arrays or objects as dynamic variables; Retell may stringify them unexpectedly.
**Why it happens:** `retell_llm_dynamic_variables` is a flat key-value map of strings.
**How to avoid:** Serialize intake questions as newline-separated string, not JSON array. In `buildSystemPrompt()`, split back if needed.
**Warning signs:** AI reads raw JSON to the caller instead of natural questions.

### Pitfall 3: Prompt Token Budget
**What goes wrong:** Adding too many new prompt sections bloats system prompt, reducing conversation context window for Groq.
**Why it happens:** Groq's Llama model has limited context; system prompt competes with conversation history.
**How to avoid:** D-04 cleanup (removing redundancies) should offset new section additions. Keep each new section concise -- behavioral instructions, not verbose examples. Target net-zero or net-negative prompt length change.
**Warning signs:** AI starts losing context of earlier conversation turns.

### Pitfall 4: Transfer Failure Flow Complexity
**What goes wrong:** The AI gets confused about which tools to call in sequence after a failed transfer.
**Why it happens:** D-03 requires a multi-step flow: transfer fails -> offer callback -> check_availability -> book_appointment (or capture_lead if declined). This is the longest tool chain in the system.
**How to avoid:** Clear, numbered prompt instructions for the failed-transfer recovery flow. Test with actual failed transfers (no owner phone configured = guaranteed failure path).
**Warning signs:** AI loops between tools or forgets to offer the callback.

### Pitfall 5: Dual-Repo Sync
**What goes wrong:** Changes to `agent-prompt.js` and `server.js` are in a separate Railway repo. If prompt changes deploy without matching tool definitions (or vice versa), calls break.
**Why it happens:** Two deployment targets (Vercel + Railway) with interdependent code.
**How to avoid:** Coordinate changes: (1) deploy webhook handler first (backward-compatible), (2) deploy WS server with new tool + prompt, (3) verify end-to-end.
**Warning signs:** `check_caller_history` tool defined in WS server but no handler in webhook route = Retell sends invocation, gets no response.

### Pitfall 6: Repeat Caller Edge Case - Appointment + Open Lead
**What goes wrong:** Caller has both an active appointment AND an open lead. AI greets with conflicting information.
**Why it happens:** A caller could have booked one appointment and then called again about a different issue, creating a new open lead.
**How to avoid:** check_caller_history returns BOTH appointments and leads. Prompt instructs AI to acknowledge the appointment first ("I see you have an appointment Thursday"), then ask if the new call is about that appointment or something new. This is in Claude's discretion per CONTEXT.md.
**Warning signs:** AI says "Welcome back, I have your info" but doesn't mention the upcoming appointment.

### Pitfall 7: Migration Numbering
**What goes wrong:** Migration number conflicts with existing migrations.
**Why it happens:** Multiple phases may have been planned concurrently.
**How to avoid:** Current highest migration is `017_overage_billing.sql`. Use `018_intake_questions.sql`.
**Warning signs:** Supabase migration runner fails on duplicate number.

### Pitfall 8: Intake Questions on Services vs. Tenant Level
**What goes wrong:** Querying intake questions from the wrong level -- per-service vs. per-tenant trade_type.
**Why it happens:** D-05 says `intake_questions jsonb` goes on `services` table, but trade_type is on `tenants`. The questions are populated per-service during onboarding from TRADE_TEMPLATES keyed by trade_type.
**How to avoid:** During onboarding, each service row gets the same set of intake questions for that trade_type. At call time, fetch all active services' intake questions, deduplicate, and inject into prompt.
**Warning signs:** Different services having different intake questions for the same trade (this is by design for future customization, but for now they should be identical per trade).

## Code Examples

### check_caller_history Handler (Route.js)
```javascript
// Source: Pattern derived from existing capture_lead + createOrMergeLead handlers
async function handleCheckCallerHistory(payload) {
  const { call_id } = payload;

  // Resolve tenant and caller number from call record
  const { data: call } = await supabase
    .from('calls')
    .select('tenant_id, from_number')
    .eq('retell_call_id', call_id)
    .single();

  if (!call?.tenant_id || !call?.from_number) {
    return Response.json({
      result: 'No caller history available.',
    });
  }

  // Parallel lookup: leads + appointments for this caller at this tenant
  const [leadsResult, appointmentsResult] = await Promise.all([
    supabase
      .from('leads')
      .select('id, caller_name, job_type, service_address, status, created_at')
      .eq('tenant_id', call.tenant_id)
      .eq('from_number', call.from_number)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('appointments')
      .select('start_time, end_time, service_address, status, caller_name')
      .eq('tenant_id', call.tenant_id)
      .eq('caller_phone', call.from_number)
      .neq('status', 'cancelled')
      .gte('end_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(3),
  ]);

  const leads = leadsResult.data || [];
  const appointments = appointmentsResult.data || [];

  if (leads.length === 0 && appointments.length === 0) {
    return Response.json({
      result: 'First-time caller. No prior history found.',
    });
  }

  // Build natural-language summary for the AI
  let summary = '';

  if (appointments.length > 0) {
    const apptLines = appointments.map(a => {
      const dateStr = formatSlotForSpeech(new Date(a.start_time), tenantTimezone);
      return `- ${dateStr} at ${a.service_address || 'address on file'} (${a.status})`;
    });
    summary += `Upcoming appointments:\n${apptLines.join('\n')}\n\n`;
  }

  if (leads.length > 0) {
    const leadLines = leads.map(l => {
      const name = l.caller_name || 'Unknown';
      const job = l.job_type || 'unspecified';
      return `- ${name}: ${job} (status: ${l.status})`;
    });
    summary += `Previous interactions:\n${leadLines.join('\n')}`;
  }

  return Response.json({
    result: `Returning caller. ${summary}\n\nAcknowledge their history naturally. If they have an upcoming appointment, ask if this call is about that appointment or something new.`,
  });
}
```

### Trade Template Extension (trade-templates.js)
```javascript
// Source: CONTEXT.md D-05 specific ideas
export const TRADE_TEMPLATES = {
  plumber: {
    label: 'Plumber',
    intakeQuestions: [
      'Is the water still running or have you been able to shut it off?',
      'How long has this been going on?',
    ],
    services: [ /* existing */ ],
  },
  hvac: {
    label: 'HVAC',
    intakeQuestions: [
      'Is this a heating or cooling issue?',
      'Is your system making any unusual noises or smells?',
    ],
    services: [ /* existing */ ],
  },
  electrician: {
    label: 'Electrician',
    intakeQuestions: [
      'Are there any burning smells or visible sparks?',
      'Is this affecting one area or your whole property?',
    ],
    services: [ /* existing */ ],
  },
  general_handyman: {
    label: 'General Handyman',
    intakeQuestions: [
      'Can you describe what needs to be fixed or installed?',
      'Is this something that needs to be done urgently?',
    ],
    services: [ /* existing */ ],
  },
};
```

### Prompt Preference Detection Instructions (agent-prompt.js)
```javascript
// Source: CONTEXT.md D-01 smart preference detection
// New section in buildSystemPrompt for BOOKING-FIRST PROTOCOL

`
SLOT PREFERENCE DETECTION:
Listen for time cues in the caller's language and prioritize matching slots:
- "morning" / "AM" / "before noon" -> offer slots before 12:00 PM first
- "afternoon" -> offer slots between 12:00 PM and 5:00 PM first
- "evening" / "after work" / "later" -> offer slots after 4:00 PM first
- "weekend" / "Saturday" / "Sunday" -> offer slots on those specific days
- "next week" / "Monday" / "Tuesday" (etc.) -> offer slots on the named day
- No time cue detected -> present slots in chronological next-available order

Never ask "When do you prefer?" — detect preference from the natural conversation.
If the caller mentions a preference and no matching slots are available, acknowledge it:
"I don't have any morning slots available, but I do have [next available]. Would that work?"
`
```

### Migration 018
```sql
-- 018_intake_questions.sql
-- Phase 30: Add intake questions to services table for trade-specific AI questioning

ALTER TABLE services
  ADD COLUMN intake_questions jsonb;

-- No default, no NOT NULL -- existing services get null (no questions)
-- Populated during onboarding from TRADE_TEMPLATES.intakeQuestions
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static slots from call_inbound only | Real-time `check_availability` tool mid-call | Phase 14 | AI can query live availability for any date |
| Hardcoded TTS greeting | Groq-generated greeting from prompt instructions | Phase 14 | All spoken content is AI-generated |
| Emergency/routine tone split | Unified tone, urgency affects slot priority only | Phase 14 | Simpler prompt, consistent caller experience |
| Post-call lead creation only | Mid-call `capture_lead` tool | Phase 14 | Declined callers get leads immediately |

**Current prompt state:** The prompt has accumulated sections across phases 1-18. D-04 cleanup will consolidate and remove contradictions -- this is the first holistic prompt refactoring since the system was built.

## Open Questions

1. **WS Server File Access**
   - What we know: The WS server lives at `C:/Users/leheh/.Projects/Retell-ws-server/` per skill docs, but that path is not accessible from the current working directory.
   - What's unclear: Whether the planner/implementer will have access to modify those files directly.
   - Recommendation: Implementation tasks should clearly note which changes go to the Railway repo vs. the main repo. The implementer needs access to both. If not accessible, copy the relevant files into this repo for editing and note the sync requirement.

2. **check_caller_history Auto-Invocation vs. Manual**
   - What we know: D-02 says the AI should acknowledge repeat callers. The tool is `check_caller_history`.
   - What's unclear: Should the AI call this tool at the start of every call, or only when it detects a repeat caller signal? The prompt could instruct "Always call check_caller_history before your first substantive response" or "Call check_caller_history if the caller says they've called before."
   - Recommendation: Auto-invoke at call start. The caller's number is already known from dynamic variables. A single read-only query adds minimal latency and ensures the AI always has context. The prompt should instruct: "After your greeting, invoke check_caller_history before asking your first question."

3. **Transfer Failure Signal**
   - What we know: D-03 says when `transfer_call` fails, AI should offer callback booking.
   - What's unclear: What exact result text does the webhook return on transfer failure? Currently the handler returns `{ result: 'transfer_failed', error: err.message }`. The AI needs to recognize this as a failure and trigger the recovery flow.
   - Recommendation: The existing `transfer_failed` result is sufficient. The prompt section for TRANSFER RECOVERY should explicitly reference this: "If transfer_call returns 'transfer_failed', offer to book a callback appointment."

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual testing via Retell test calls |
| Config file | None -- voice agent testing is end-to-end via live calls |
| Quick run command | Trigger test call from dashboard or Retell console |
| Full suite command | N/A -- no automated voice agent test suite |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | Smart slot preference detection | manual | Test call mentioning "morning" -- verify AI offers AM slots first | N/A |
| D-02 | Repeat caller recognition | manual | Call twice from same number -- verify AI acknowledges history on second call | N/A |
| D-03 | Callback booking on failed transfer | manual | Configure no owner_phone -- verify AI offers callback after transfer fails | N/A |
| D-04 | Prompt cleanup -- no contradictions | code review | Diff agent-prompt.js before/after -- verify no redundant sections | N/A |
| D-05 | Trade-specific questions asked | manual | Test call to plumber tenant -- verify AI asks water shutoff question | N/A |
| D-06 | Post-booking recap with address | manual | Complete booking -- verify AI recaps date/time/address before farewell | N/A |
| DB | intake_questions column exists | smoke | `SELECT intake_questions FROM services LIMIT 1` | N/A |

### Sampling Rate
- **Per task commit:** Code review of prompt changes + webhook handler logic
- **Per wave merge:** Retell test call covering the new behavior
- **Phase gate:** Full end-to-end test call exercising all 6 decisions

### Wave 0 Gaps
- None -- this phase has no automated test infrastructure (voice agent testing is inherently manual/E2E)

## Sources

### Primary (HIGH confidence)
- `src/app/api/webhooks/retell/route.js` -- Full webhook handler code reviewed (657 lines)
- `src/lib/leads.js` -- createOrMergeLead repeat-caller query pattern reviewed
- `src/lib/trade-templates.js` -- Current TRADE_TEMPLATES structure reviewed
- `src/app/api/onboarding/start/route.js` -- Service creation flow reviewed
- `.claude/skills/voice-call-architecture/skill.md` -- Complete architectural reference (597 lines)
- `supabase/migrations/002_onboarding_triage.sql` -- services table schema confirmed
- `supabase/migrations/003_scheduling.sql` -- appointments table schema confirmed
- `supabase/migrations/004_leads_crm.sql` -- leads table schema confirmed
- `.planning/phases/30-voice-agent-prompt-optimization/30-CONTEXT.md` -- All 6 decisions + canonical refs

### Secondary (MEDIUM confidence)
- Migration numbering: 17 existing migrations confirmed via directory listing; 018 is next available

### Tertiary (LOW confidence)
- WS server file contents (`agent-prompt.js`, `server.js`): Documented extensively in skill file but files were not directly readable from current path. Implementation relies on skill documentation accuracy.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing libraries
- Architecture: HIGH -- all patterns are established and documented in skill file
- Pitfalls: HIGH -- derived from direct code review of existing handlers
- Prompt engineering: MEDIUM -- prompt quality is subjective and requires iterative testing via live calls

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable -- no external dependency version concerns)

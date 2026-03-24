---
phase: 14-booking-first-agent-behavior
plan: 03
subsystem: voice-call-architecture
tags: [websocket, webhook, capture-lead, end-call, whisper-message, booking-first, skill-update]
dependency_graph:
  requires:
    - Plan 01 (src/lib/whisper-message.js)
    - Plan 01 (src/lib/leads.js createOrMergeLead)
    - Plan 02 (agent-prompt.js with capture_lead + end_call in DECLINE HANDLING)
  provides:
    - C:/Users/leheh/.Projects/Retell-ws-server/server.js (4-tool WebSocket server)
    - src/app/api/webhooks/retell/route.js (capture_lead handler + whisper transfer)
    - .claude/skills/voice-call-architecture/SKILL.md (booking-first architecture reference)
  affects:
    - Live call flows: decline path now creates lead mid-call instead of waiting for post-call
    - Transfer path: receiving human now gets structured whisper message
tech_stack:
  added: []
  patterns:
    - Mid-call lead creation via capture_lead tool + webhook handler
    - Whisper message built from AI-provided tool arguments on transfer
    - end_call bypasses Groq continuation — WebSocket sends end_call:true directly
    - Duration computed from start_timestamp to satisfy 15s short-call filter mid-call
key_files:
  created: []
  modified:
    - C:/Users/leheh/.Projects/Retell-ws-server/server.js
    - src/app/api/webhooks/retell/route.js
    - .claude/skills/voice-call-architecture/SKILL.md
decisions:
  - end_call handler in WebSocket bypasses Groq entirely — sends end_call:true directly to Retell without continuation
  - capture_lead computes duration from start_timestamp to avoid 15s short-call filter (Pitfall 3)
  - whisper_message passed to retell.call.transfer() using AI-provided arguments (caller_name, job_type, urgency, summary)
  - SKILL.md removes all references to deleted main-repo files (retell-llm-ws.js, agent-prompt.js, retell-agent-config.js)
metrics:
  duration: ~12 minutes
  completed: "2026-03-25"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 3
---

# Phase 14 Plan 03: WebSocket Tools + Webhook Handlers + Skill Update Summary

**One-liner:** Expanded Railway WebSocket server to 4 tools (capture_lead, end_call with end_call:true signaling), added mid-call lead creation and whisper-message transfer handlers to the main webhook route, and rewrote voice-call-architecture SKILL.md to reflect the complete booking-first system.

## What Was Built

### Task 1: 4-tool Railway WebSocket server (already committed in prior run)

`C:/Users/leheh/.Projects/Retell-ws-server/server.js` — already had all 4 tools implemented and committed as `b874b4b`. Verified:
- `transfer_call` — always available with optional whisper params (caller_name, job_type, urgency, summary), `required: []`
- `capture_lead` — always available, not gated by onboarding_complete; captures caller_name, phone, address, job_type, notes
- `end_call` — always available, no parameters; `handleToolResult()` sends `end_call: true` to Retell, skips Groq continuation
- `book_appointment` — gated by `onboarding_complete === true`; required params unchanged

Tool ordering: transfer_call, capture_lead, end_call, then conditionally book_appointment.

### Task 2: Webhook handlers for capture_lead + whisper transfer

**`src/app/api/webhooks/retell/route.js`** — added:

1. **Imports**: `createOrMergeLead` from `@/lib/leads` and `buildWhisperMessage` from `@/lib/whisper-message`

2. **`end_call` safety guard**: If the end_call event somehow reaches the webhook (it shouldn't — it's handled in the WebSocket server), the handler acknowledges with `{ result: 'Call ending.' }` and returns.

3. **`capture_lead` handler**:
   - Resolves tenant via two-hop: `calls.select('id, tenant_id, from_number, start_timestamp').eq('retell_call_id', call_id)`
   - Computes `durationSeconds` from `start_timestamp` to current time — critical for satisfying `createOrMergeLead`'s 15-second short-call filter during live calls
   - Calls `createOrMergeLead()` with all AI-provided fields (caller_name, phone, address, job_type, notes)
   - Fetches `business_name` for personalized confirmation: "I've saved your information. {bizName} will reach out soon."
   - Graceful error fallback: "I've noted your details and someone will follow up."

4. **`transfer_call` whisper message (D-08)**:
   - Builds whisper via `buildWhisperMessage({ callerName, jobType, urgency, summary })` from AI-provided `function_call.arguments`
   - Passes `whisper_message: whisperMsg` to `retell.call.transfer()`
   - Template output: "[Name] calling about [job type]. [Emergency/Routine]. [1-line summary]."

### Task 2 continued: SKILL.md update

**`.claude/skills/voice-call-architecture/SKILL.md`** — comprehensive update:

- **File Map**: Removed `src/server/retell-llm-ws.js`, `src/lib/agent-prompt.js`, `src/lib/retell-agent-config.js` (deleted from main repo). Added `C:/Users/leheh/.Projects/Retell-ws-server/server.js` and `C:/Users/leheh/.Projects/Retell-ws-server/agent-prompt.js` as production files. Added `src/lib/whisper-message.js`.
- **Section 1 (WebSocket)**: Documented all 4 tools with full parameter descriptions. Added end_call handler behavior.
- **Section 2 (Prompt)**: Replaced "Booking Flow" and "Triage-Aware Behavior" with BOOKING-FIRST PROTOCOL, URGENCY DETECTION (for slot priority, not tone), DECLINE HANDLING (two-strike pattern), and updated CALL TRANSFER (two exception triggers only).
- **Section 3 (new)**: Whisper Message Builder — `buildWhisperMessage()` spec with fallback behavior.
- **Section 4 (Webhook)**: Added `capture_lead` handler steps, `end_call` safety guard, whisper message on transfer.
- **Section 10 (Flows)**: Updated Flow B (whisper message), added Flow E (Decline → Lead Capture).
- **Section 13 (Decisions)**: Added booking-first, two-trigger transfer, unified tone, whisper, mid-call capture, end_call bypass decisions.

## Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| tests/agent/ (all 5 files) | 40 | GREEN |
| Full suite (excluding pre-existing failures) | 239/244 | 5 pre-existing failures (unrelated to this plan) |

Pre-existing failures (confirmed failing before this plan's changes):
- `tests/onboarding/services.test.js` — 3 failures (unrelated to call system)
- `tests/onboarding/test-call.test.js` — 1 failure (unrelated to call system)
- `tests/webhooks/retell-inbound.test.js` — 1 failure (pre-existing mock mismatch)

## Deviations from Plan

None — plan executed exactly as written. Task 1 was already committed from a prior agent run (`b874b4b`).

## Commits

| Hash | Repo | Message |
|------|------|---------|
| b874b4b | Retell-ws-server | feat(14-03): add end_call + capture_lead tools to Railway WebSocket server |
| 94fa47e | homeservice_agent | feat(14-03): add capture_lead and end_call handlers + whisper message on transfer |
| de21a9c | homeservice_agent | docs(14-03): update voice-call-architecture SKILL.md for booking-first 4-tool system |

## Known Stubs

None — all handlers are fully implemented. No hardcoded placeholder strings in the modified files.

## Self-Check: PASSED

- `C:/Users/leheh/.Projects/Retell-ws-server/server.js` — has capture_lead, end_call:true, transfer_call with whisper params: VERIFIED
- `src/app/api/webhooks/retell/route.js` — has createOrMergeLead import, buildWhisperMessage import, capture_lead handler, end_call guard, whisper_message on transfer: VERIFIED
- `.claude/skills/voice-call-architecture/SKILL.md` — has BOOKING-FIRST PROTOCOL, capture_lead, end_call, whisper_message; no deleted file references; Last updated 2026-03-25: VERIFIED
- Commits b874b4b, 94fa47e, de21a9c — exist: VERIFIED
- All 40 agent tests GREEN: VERIFIED

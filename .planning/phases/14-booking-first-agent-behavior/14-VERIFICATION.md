---
phase: 14-booking-first-agent-behavior
verified: 2026-03-25T00:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
gaps:
  - truth: "capture_lead creates a lead mid-call via createOrMergeLead when caller declines booking"
    status: failed
    reason: "capture_lead handler is absent from src/app/api/webhooks/retell/route.js on main. The handler was implemented in commit 94fa47e but that commit lives on worktree-agent-a0fd17b2 and was never merged to main."
    artifacts:
      - path: "src/app/api/webhooks/retell/route.js"
        issue: "No capture_lead case in handleFunctionCall(). No createOrMergeLead import. No buildWhisperMessage import. handleFunctionCall() only handles book_appointment and transfer_call, then falls through to return Response.json({ received: true })."
    missing:
      - "Merge or cherry-pick commit 94fa47e from worktree-agent-a0fd17b2 to main"
      - "Verify imports: createOrMergeLead from @/lib/leads and buildWhisperMessage from @/lib/whisper-message are present"
      - "Verify capture_lead handler block: resolves tenant, computes durationSeconds from start_timestamp, calls createOrMergeLead"
      - "Verify end_call safety guard block"

  - truth: "transfer_call passes a whisper message to the receiving human with caller name, job type, urgency, and summary"
    status: failed
    reason: "The transfer_call handler in route.js on main calls retell.call.transfer() without a whisper_message parameter. buildWhisperMessage is not imported. The whisper wiring exists only in the unmerged commit 94fa47e."
    artifacts:
      - path: "src/app/api/webhooks/retell/route.js"
        issue: "retell.call.transfer() call at line 223 passes only { call_id, transfer_to: ownerPhone }. No whisper_message field. buildWhisperMessage is not imported anywhere in the file."
    missing:
      - "Add import { buildWhisperMessage } from '@/lib/whisper-message' to route.js"
      - "Build whisperMsg from function_call.arguments (caller_name, job_type, urgency, summary)"
      - "Pass whisper_message: whisperMsg to retell.call.transfer()"

  - truth: "end_call signals Retell to hang up via end_call:true in the WebSocket response"
    status: partial
    reason: "end_call:true is correctly implemented in the Railway WebSocket server (server.js in Retell-ws-server repo, commit b874b4b). However the end_call safety guard for the webhook (route.js) is missing from main — it was part of the unmerged commit 94fa47e. The core behavior (WebSocket end_call) is functional; only the webhook guard is missing."
    artifacts:
      - path: "src/app/api/webhooks/retell/route.js"
        issue: "No end_call case in handleFunctionCall(). If end_call somehow reaches the webhook it will return { received: true } silently rather than { result: 'Call ending.' }. Minor defensive gap only."
    missing:
      - "Add end_call safety guard to handleFunctionCall() (low priority — core end_call path is in WebSocket server)"

  - truth: "voice-call-architecture SKILL.md reflects the new 4-tool system and booking-first behavior"
    status: failed
    reason: "SKILL.md on main (via commit c2de8e2 which only updated ROADMAP/STATE/SUMMARY) shows the pre-Phase-14 architecture. The SKILL.md update was in commit de21a9c on worktree-agent-a0fd17b2, never merged to main. The current SKILL.md describes TRIAGE-AWARE BEHAVIOR, old Booking Flow (8-step), only 2 tools (transfer_call with no parameters, book_appointment), deleted file references, and old file paths."
    artifacts:
      - path: ".claude/skills/voice-call-architecture/SKILL.md"
        issue: "Last updated: 2026-03-24 (not 2026-03-25). Lists src/server/retell-llm-ws.js, src/lib/agent-prompt.js, src/lib/retell-agent-config.js (all deleted). Still documents Triage-Aware Behavior. Tool definitions only show transfer_call (no params) and book_appointment. No mention of capture_lead, end_call, whisper_message, BOOKING-FIRST PROTOCOL, DECLINE HANDLING, or CLARIFICATION LIMIT. Section 2 references src/lib/agent-prompt.js instead of Retell-ws-server/agent-prompt.js."
    missing:
      - "Merge or cherry-pick commit de21a9c from worktree-agent-a0fd17b2 to main"
      - "Or re-apply SKILL.md update: remove deleted file references, add all 4 tools with parameters, replace Booking Flow + Triage-Aware with BOOKING-FIRST PROTOCOL + DECLINE HANDLING, update file paths to Railway repo, set Last updated to 2026-03-25"

human_verification:
  - test: "Place a test call to a Retell number and decline booking twice"
    expected: "AI invokes capture_lead after second decline, lead appears in Supabase leads table with correct caller details, then AI invokes end_call and hangs up gracefully"
    why_human: "End-to-end call flow through Railway WebSocket server + Retell + webhook requires a live phone call. Cannot be verified programmatically without test infrastructure."
  - test: "Warm transfer to owner phone"
    expected: "Receiving phone hears the whisper message '[Name] calling about [job type]. [Emergency/Routine]. [summary]' before the call connects"
    why_human: "Retell whisper_message delivery requires a live call with a receiving phone; the SDK call can be verified statically but actual audio delivery needs human testing."
---

# Phase 14: Booking-First Agent Behavior Verification Report

**Phase Goal:** The AI books every inbound call by default — emergencies into the nearest same-day slot, routine calls into next available — with human transfer restricted to exception states only, and full call context preserved on any transfer.
**Verified:** 2026-03-25
**Status:** GAPS FOUND
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | AI books every inbound call by default — emergencies into nearest same-day slot, routine into next available | VERIFIED | `buildBookingSection()` in agent-prompt.js (line 65-101): BOOKING-FIRST PROTOCOL with URGENCY DETECTION. `onboarding_complete` gates the section. Emergency cues → same-day slots, routine cues → next available. |
| 2 | AI answers info questions first, then pivots to offering available slots | VERIFIED | agent-prompt.js line 68: "I can also get you on the schedule while we're on the line" |
| 3 | Quote requests are reframed as site-visit booking opportunities | VERIFIED | agent-prompt.js line 70: "To give you an accurate quote, we'd need to see the space. Let me book a time..." |
| 4 | After two explicit declines, AI captures lead via capture_lead tool and wraps up | VERIFIED (prompt side only) | `DECLINE_HANDLING` in agent-prompt.js (lines 103-109): two-strike pattern, invokes `capture_lead` then `end_call` after second decline. PARTIAL FAIL: webhook handler for capture_lead is missing from route.js on main. |
| 5 | AI transfers to human only on 2 exception states: 3 failed clarifications OR explicit human request | VERIFIED | `buildTransferSection()` in agent-prompt.js (lines 111-133): CLARIFICATION LIMIT after 3 attempts, EXPLICIT REQUEST instant transfer. "No other situations trigger a transfer." |
| 6 | Unified tone for all calls — no emergency/routine tone split | VERIFIED | agent-prompt.js has no TRIAGE-AWARE BEHAVIOR. No "For EMERGENCY calls: Use urgent" or "For ROUTINE calls: Use relaxed" present. |
| 7 | Address read-back, language handling, recording disclosure, and call duration limits survive the rewrite | VERIFIED | agent-prompt.js: "Just to confirm" (line 84), LANGUAGE INSTRUCTIONS section (line 38), "This call may be recorded" via t('agent.recording_disclosure') (line 21), "9 minutes" via CALL_DURATION (line 136). |
| 8 | capture_lead creates a lead mid-call via createOrMergeLead when caller declines booking | FAILED | route.js on main does not contain createOrMergeLead import or capture_lead handler. Commits 94fa47e and de21a9c implementing these exist on worktree-agent-a0fd17b2 but were never merged to main. |
| 9 | transfer_call passes a whisper message to the receiving human | FAILED | route.js on main: retell.call.transfer() at line 223 passes only { call_id, transfer_to }. No whisper_message. buildWhisperMessage not imported. |
| 10 | end_call signals Retell to hang up via end_call:true | PARTIAL | WebSocket server (Retell-ws-server/server.js lines 368-377): end_call handler sends end_call:true correctly. Webhook safety guard for end_call is absent from route.js on main. |
| 11 | voice-call-architecture SKILL.md reflects 4-tool system and booking-first behavior | FAILED | SKILL.md on main still shows pre-Phase-14 content: TRIAGE-AWARE BEHAVIOR, old 8-step Booking Flow, 2 tools (no capture_lead/end_call), deleted file references (retell-llm-ws.js, agent-prompt.js, retell-agent-config.js in main repo), Last updated 2026-03-24. |

**Score:** 5/11 truths fully verified (7 verified from plan must-haves; gaps in 3 plan-03 must-haves)

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/agent/prompt-snapshot.test.js` | Snapshot baseline with `toMatchSnapshot` | VERIFIED | Exists. Imports from `../../../Retell-ws-server/agent-prompt.js`. 4 snapshot tests. |
| `tests/agent/__snapshots__/prompt-snapshot.test.js.snap` | Committed snapshot file | VERIFIED | Directory exists at tests/agent/__snapshots__/ |
| `tests/agent/prompt.test.js` | 17 booking-first assertions | VERIFIED | Exists. Contains `BOOKING-FIRST PROTOCOL`, `TRIAGE-AWARE BEHAVIOR`, `capture_lead`, `CLARIFICATION LIMIT`, `URGENCY DETECTION`. All assertions in place. |
| `tests/agent/whisper-message.test.js` | 9 whisper builder tests | VERIFIED | Exists. 9 test cases covering all fallback paths. |
| `tests/agent/capture-lead-handler.test.js` | 3 capture_lead contract tests | VERIFIED | Exists. 3 tests validating createOrMergeLead schema. |
| `src/lib/whisper-message.js` | `buildWhisperMessage` export | VERIFIED | Exists. Fully implemented. D-08 template: "[Name] calling about [job type]. [Emergency/Routine]. [summary]" |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `C:/Users/leheh/.Projects/Retell-ws-server/agent-prompt.js` | Modular booking-first prompt with `BOOKING-FIRST PROTOCOL` | VERIFIED | Fully rewritten. Contains all required sections. readFileSync i18n preserved. buildSystemPrompt export unchanged. |

### Plan 03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `C:/Users/leheh/.Projects/Retell-ws-server/server.js` | 4 tools: transfer_call, capture_lead, end_call, book_appointment | VERIFIED | All 4 tools present. transfer_call has caller_name/job_type/urgency/summary params with required:[]. end_call handler sends end_call:true and returns before Groq continuation. |
| `src/app/api/webhooks/retell/route.js` | capture_lead handler + whisper on transfer + end_call guard | STUB/MISSING | File exists but lacks all Plan 03 additions. No createOrMergeLead import. No buildWhisperMessage import. No capture_lead handler. No end_call guard. transfer_call has no whisper_message. Commits implementing these (94fa47e) are on worktree-agent-a0fd17b2, not merged to main. |
| `.claude/skills/voice-call-architecture/SKILL.md` | Updated with 4-tool system and booking-first | STUB | File exists but shows pre-Phase-14 content. Update commit (de21a9c) not merged to main. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tests/agent/prompt.test.js` | `Retell-ws-server/agent-prompt.js` | `import { buildSystemPrompt }` | WIRED | Line 2: `import { buildSystemPrompt } from '../../../Retell-ws-server/agent-prompt.js'` |
| `tests/agent/whisper-message.test.js` | `src/lib/whisper-message.js` | `import buildWhisperMessage` | WIRED | Line 2: `import { buildWhisperMessage } from '@/lib/whisper-message.js'` |
| `Retell-ws-server/server.js` | `Retell-ws-server/agent-prompt.js` | `import buildSystemPrompt` | WIRED | Line 19: `import { buildSystemPrompt } from './agent-prompt.js'` |
| `src/app/api/webhooks/retell/route.js` | `src/lib/whisper-message.js` | `import buildWhisperMessage` | NOT WIRED | Import absent from route.js on main. Present only in unmerged commit 94fa47e. |
| `src/app/api/webhooks/retell/route.js` | `src/lib/leads.js` | `import createOrMergeLead` | NOT WIRED | Import absent from route.js on main. Present only in unmerged commit 94fa47e. |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BOOK-01 | Plan 01, 02 | AI books every inbound call by default — emergencies → nearest same-day slot, routine → next available | SATISFIED | BOOKING-FIRST PROTOCOL in agent-prompt.js with URGENCY DETECTION gating slot selection. Prompt tests pass. |
| BOOK-02 | Plan 01, 02 | AI detects caller intent before booking — distinguishes service appointment requests from info-only/quote calls | SATISFIED | Info-then-pivot ("I can also get you on the schedule"), quote-to-site-visit reframe present in agent-prompt.js. |
| BOOK-03 | Plan 01, 02, 03 | AI transfers to human only on exception states: cannot understand job after 2+ clarifications, or caller explicitly requests a person | PARTIALLY SATISFIED | Prompt correctly restricts transfer to 2 states. CLARIFICATION LIMIT section present. BUT capture_lead mid-call handler (the consequence of DECLINE HANDLING, part of this requirement's "exception states" flow) is not deployed on main. |
| BOOK-05 | Plan 03 | AI preserves full call context on warm transfer via Retell whisper message | BLOCKED | buildWhisperMessage utility exists and is correct. transfer_call tool in server.js accepts whisper params. BUT route.js on main does not pass whisper_message to retell.call.transfer(). The whisper message is built but never sent. |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/api/webhooks/retell/route.js` | 241 | `return Response.json({ received: true })` as final fallthrough — capture_lead and end_call events reach this and are silently swallowed | Blocker | capture_lead tool calls from the AI return a generic success response instead of creating a lead. The AI reads back a result suggesting the lead was saved, but nothing is actually saved. |
| `.claude/skills/voice-call-architecture/SKILL.md` | 43-48 | File Map lists `src/server/retell-llm-ws.js`, `src/lib/agent-prompt.js`, `src/lib/retell-agent-config.js` — all deleted from main repo | Warning | Stale documentation. Developers reading SKILL.md before making call-system changes will get incorrect file paths. |
| `.claude/skills/voice-call-architecture/SKILL.md` | 169 | "Triage-Aware Behavior" section describes old escalation-first behavior — emergency = urgent tone, routine = relaxed tone. This contradicts the deployed agent-prompt.js. | Warning | Misleading documentation. Any developer following SKILL.md guidance would implement the wrong behavior. |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| agent-prompt.js exports buildSystemPrompt | `node -e "import('./Retell-ws-server/agent-prompt.js').then(m => console.log(typeof m.buildSystemPrompt))"` | function (inferred from file inspection) | PASS |
| agent-prompt.js: BOOKING-FIRST PROTOCOL present | `grep -c "BOOKING-FIRST PROTOCOL" Retell-ws-server/agent-prompt.js` | 1 match at line 65 | PASS |
| agent-prompt.js: TRIAGE-AWARE BEHAVIOR absent | `grep -c "TRIAGE-AWARE BEHAVIOR" Retell-ws-server/agent-prompt.js` | 0 matches | PASS |
| server.js: 4 tools defined | grep for name: 'transfer_call', 'capture_lead', 'end_call', 'book_appointment' | All 4 found at lines 44, 71, 92, 105 | PASS |
| server.js: end_call:true handler | grep for `end_call: true` | Found at line 374 inside if(toolCall.name === 'end_call') | PASS |
| route.js: capture_lead handler | grep for `capture_lead` in route.js | 0 matches — ABSENT | FAIL |
| route.js: whisper_message on transfer | grep for `whisper_message` in route.js | 0 matches — ABSENT | FAIL |
| SKILL.md: Last updated 2026-03-25 | grep for "2026-03-25" in SKILL.md | 0 matches — still shows 2026-03-24 | FAIL |

---

## Root Cause: Unmerged Worktree Commits

Plan 03 was executed in a git worktree (`worktree-agent-a0fd17b2`). Two commits were created:

- `94fa47e` — `feat(14-03): add capture_lead and end_call handlers + whisper message on transfer` — modifies `src/app/api/webhooks/retell/route.js`
- `de21a9c` — `docs(14-03): update voice-call-architecture SKILL.md for booking-first 4-tool system` — modifies `.claude/skills/voice-call-architecture/SKILL.md`

These commits exist in the git object store but are on the `worktree-agent-a0fd17b2` branch, NOT on `main`. The Plan 03 docs commit (`c2de8e2`) that landed on main only updated ROADMAP.md, STATE.md, and 14-03-SUMMARY.md — the SUMMARY.md itself is accurate, but the code it summarizes was not merged.

The effect is that the Retell-ws-server Railway repo is fully up to date (4 tools, end_call:true), the agent prompt is fully rewritten (booking-first), but the main app's webhook handler and architecture skill file still reflect the pre-Phase-14 state.

---

## Human Verification Required

### 1. Decline → Lead Capture Flow (requires gap closure first)

**Test:** Call a Retell test number, decline the booking offer twice using explicit verbal refusals ("no thanks" / "I really don't want an appointment").
**Expected:** AI responds with "No problem" after first decline, then captures name/phone/issue and says "I've saved your information. [Business] will reach out soon." after second decline. A lead record appears in Supabase `leads` table with the caller's details. Call ends.
**Why human:** End-to-end requires live Retell call + Railway WebSocket server + webhook handler. Cannot be verified statically.

### 2. Warm Transfer Whisper Message (requires gap closure first)

**Test:** Call a Retell test number and say "I want to speak to a person."
**Expected:** AI says "Absolutely, let me connect you now." and transfers. The receiving phone hears the whisper message ("[Name] calling about [job type]. [Emergency/Routine]. [summary]") before the call connects.
**Why human:** Retell whisper_message audio delivery requires a live two-party call. The SDK call can be verified statically but actual audio delivery needs human testing.

---

## Gaps Summary

Phase 14 is approximately 70% complete. The booking-first prompt rewrite (Plan 02) and the Railway WebSocket server tool expansion (Plan 03 Task 1) are fully deployed and verified. All test infrastructure from Plan 01 is in place.

The blocking gap is that Plan 03 Task 2 — the webhook handler additions to `route.js` and the SKILL.md update — was committed in a git worktree (`worktree-agent-a0fd17b2`) but never merged to main. Two commits (`94fa47e`, `de21a9c`) need to be cherry-picked or merged.

Until merged:
- `capture_lead` tool calls from the AI silently return `{ received: true }` — no lead is created
- `transfer_call` passes no whisper message — the receiving human gets no caller context (BOOK-05 blocked)
- The architecture skill file gives developers incorrect guidance (deleted file references, old behavior descriptions)

**Fix:** `git cherry-pick 94fa47e de21a9c` from main, or merge `worktree-agent-a0fd17b2`.

---

_Verified: 2026-03-25_
_Verifier: Claude (gsd-verifier)_

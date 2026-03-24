---
phase: 14-booking-first-agent-behavior
plan: 02
subsystem: agent-prompt
tags: [booking-first, prompt-rewrite, modular-architecture, tdd]
dependency_graph:
  requires:
    - Plan 01 (tests/agent/prompt.test.js RED assertions)
    - Plan 01 (tests/agent/prompt-snapshot.test.js baseline)
  provides:
    - C:/Users/leheh/.Projects/Retell-ws-server/agent-prompt.js (modular booking-first prompt)
    - tests/agent/__snapshots__/prompt-snapshot.test.js.snap (updated booking-first snapshots)
  affects:
    - Plan 03 (tool handlers for capture_lead, end_call — prompt now references these tools)
tech_stack:
  added: []
  patterns:
    - Modular section builder functions assembled in buildSystemPrompt()
    - onboarding_complete gates booking + decline sections
    - readFileSync i18n pattern preserved (not import with type json)
key_files:
  created: []
  modified:
    - C:/Users/leheh/.Projects/Retell-ws-server/agent-prompt.js
    - tests/agent/__snapshots__/prompt-snapshot.test.js.snap
decisions:
  - All section builder functions kept inside agent-prompt.js (no new files) per RESEARCH.md recommendation
  - DECLINE_HANDLING only injected when onboarding_complete=true (booking section gates it)
  - CALL TRANSFER section completely rewritten — now has CLARIFICATION LIMIT subsection and explicit-request instant transfer
  - Snapshot tests updated with -u flag after rewrite to capture new booking-first baseline
metrics:
  duration: ~8 minutes
  completed: "2026-03-25"
  tasks_completed: 1
  tasks_total: 1
  files_created: 0
  files_modified: 2
---

# Phase 14 Plan 02: Booking-First Prompt Rewrite Summary

**One-liner:** Rewrote agent-prompt.js from escalation-first monolith to modular booking-first architecture — 17 RED assertions turned GREEN, old TRIAGE-AWARE BEHAVIOR fully removed, unified tone with urgency-only slot priority.

## What Was Built

### Task 1: Modular prompt rewrite — booking-first protocol (TDD GREEN)

Rewrote `C:/Users/leheh/.Projects/Retell-ws-server/agent-prompt.js` from a monolithic string concat into a modular section builder architecture per D-10.

**New section functions:**
- `buildIdentitySection(businessName, toneLabel)` — identity + personality
- `RECORDING_NOTICE(t)` — recording disclosure
- `buildGreetingSection(locale, businessName, onboardingComplete, t)` — context-aware greeting
- `buildLanguageSection(t)` — language detection, switching, LANGUAGE_BARRIER tag
- `INFO_GATHERING(t)` — name, address, job type capture
- `buildBookingSection(businessName, onboardingComplete)` — gates on `onboarding_complete`; contains full BOOKING-FIRST PROTOCOL with URGENCY DETECTION
- `DECLINE_HANDLING(businessName)` — two-strike decline loop with `capture_lead`; gated by `onboarding_complete`
- `buildTransferSection(businessName, t)` — two exception states only: EXPLICIT REQUEST + CLARIFICATION LIMIT
- `CALL_DURATION(t)` — 9-minute wrap-up, 10-minute hard limit
- `LANGUAGE_BARRIER_ESCALATION(t)` — language barrier handling

**Removed sections (old escalation-first):**
- `TRIAGE-AWARE BEHAVIOR` — fully removed (D-11: unified tone)
- Old `BOOKING FLOW` — replaced by `BOOKING-FIRST PROTOCOL`
- "For EMERGENCY calls: Use urgent, action-oriented tone." — removed
- "For ROUTINE calls: Use relaxed tone." — removed

**New sections added:**
- `BOOKING-FIRST PROTOCOL` — book every caller by default; info-then-pivot; quote-to-site-visit; urgency detection for slot priority only (D-12)
- `DECLINE HANDLING` — two-strike: soft re-offer first, `capture_lead` on second (D-03/D-04)
- `CLARIFICATION LIMIT` inside CALL TRANSFER — 3 explicit attempts before transfer (D-06)
- `URGENCY DETECTION` — slot priority determination without tone change (D-12)

**Preserved behaviors:**
- `LANGUAGE INSTRUCTIONS` with `LANGUAGE_BARRIER` tag
- Address read-back ("Just to confirm")
- Recording disclosure ("This call may be recorded")
- 9-minute wrap-up and 10-minute hard limit
- `readFileSync` i18n pattern (NOT changed to import with type json)
- Function signature unchanged — no breaking changes to server.js consumer

## Test Results

| File | Tests | Result |
|------|-------|--------|
| tests/agent/prompt.test.js | 17 | GREEN (was 11 RED before rewrite) |
| tests/agent/prompt-snapshot.test.js | 4 | GREEN (snapshots updated) |

All 17 booking-first assertions now pass. All 4 snapshot tests pass with updated snapshots.

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Hash | Repo | Message |
|------|------|---------|
| 80cc88a | Retell-ws-server | feat(14-02): rewrite agent-prompt.js with booking-first modular architecture |
| 6a80e99 | homeservice_agent | test(14-02): update prompt snapshots to booking-first architecture |

## Known Stubs

None — `buildSystemPrompt()` is fully implemented. No hardcoded placeholder strings. All translation keys used via `t()` helper.

## Self-Check: PASSED

- `C:/Users/leheh/.Projects/Retell-ws-server/agent-prompt.js` — contains `BOOKING-FIRST PROTOCOL`: VERIFIED
- `C:/Users/leheh/.Projects/Retell-ws-server/agent-prompt.js` — does NOT contain `TRIAGE-AWARE BEHAVIOR`: VERIFIED
- `tests/agent/__snapshots__/prompt-snapshot.test.js.snap` — updated: VERIFIED
- Commits 80cc88a and 6a80e99 — exist: VERIFIED

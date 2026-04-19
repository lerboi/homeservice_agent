---
status: partial
phase: 60-voice-prompt-polish-name-once-and-single-question-address-intake
source: [60-VERIFICATION.md]
started: 2026-04-19T15:00:00Z
updated: 2026-04-19T15:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Persona 1 — Culturally diverse name + clear address (baseline)
expected: AI captures name silently (no 'Thanks, Jia En' or 'Okay Jia En' before readback); single-question address opener; reads back name+address in one utterance before book_appointment fires; zero vocative name use before readback
result: [pending]

### 2. Persona 2 — Casual one-breath address (SG-style lead)
expected: AI extracts street/block/unit/area from single utterance; asks exactly one targeted follow-up for missing piece; no three-part walkthrough
result: [pending]

### 3. Persona 3 — Mid-readback correction (US-style lead, two corrections)
expected: AI accepts each correction and re-reads the corrected full name+address; loops at least twice; each re-read contains full line
result: [pending]

### 4. Persona 4 — Caller invites name use ('you can call me Sam')
expected: AI uses name naturally for rest of call after invitation; readback still fires; no vocative use before invitation
result: [pending]

### 5. Persona 5 — Caller refuses name
expected: AI proceeds without blocking; readback contains only address; book_appointment fires; DB row has caller_name null/empty
result: [pending]

### 6. Persona 6 — Caller declines to book (decline path)
expected: Single-question intake still used; readback of name+address fires before capture_lead; capture_lead fires once
result: [pending]

### 7. Persona 7 — Spanish caller
expected: AI switches to Spanish on explicit request; single-question opener in Spanish ('¿Cuál es la dirección donde necesita el servicio?'); readback once in Spanish; all D-01..D-12 rules hold in Spanish; no English drift
result: [pending]

### 8. 24-hour Sentry regression check (post-deploy)
expected: Zero new tool_call_cancelled spikes attributable to Phase 60; zero parrot-loop matches (tool return text spoken verbatim by AI)
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps

### Hotfix 60.1 (2026-04-19) — regressions surfaced in first live call

Two issues were found in the first live UAT call and fixed under phase 60.1 (see `60.1-SUMMARY.md`):

- **Caller SMS wrong time.** Phase 60 regression — Gemini dropped the `+00:00` offset when re-emitting `slot_start` for `book_appointment`, and `_format_time_for_sms` silently treated naive ISO as system-local (UTC on Railway). Fixed with two-layer defense: `_ensure_utc_iso()` canonicalizes on entry, and `check_availability` STATE fields renamed to `slot_start_utc` / `slot_end_utc` with explicit "pass verbatim" directive. Re-test Persona 5 (no-name) and Persona 1 (baseline) to verify SMS shows the correct booked time.
- **Tool-call voice glitches.** 4 `server cancelled tool calls` in a single 237s call due to over-confirmation + short fillers. Fixed with: SCHEDULING "no time-confirm before check" rule, TOOL NARRATION ~3s filler examples, `check_availability` tenant-cache reuse (~100-200ms saved per call), and stripped 15 redundant "Do not repeat this message text on-air." trailers. Re-test all personas that exercise `check_availability` for smoother audio.

A third issue (~4s startup silence from customer_context fetch for tenants with no Jobber/Xero) was deferred at user request.

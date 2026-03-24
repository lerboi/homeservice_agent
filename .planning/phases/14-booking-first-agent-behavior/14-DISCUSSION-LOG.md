# Phase 14: Booking-First Agent Behavior - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 14-booking-first-agent-behavior
**Areas discussed:** Intent detection & non-booking calls, Exception & transfer triggers, Prompt rewrite strategy, WebSocket tool updates

---

## Intent Detection & Non-Booking Calls

### Info Call Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Answer then offer | AI answers question first, then pivots to booking offer | ✓ |
| Offer first, answer second | Lead with booking, answer question after | |
| Parallel: answer + offer | Weave both together in one response | |

**User's choice:** Answer then offer
**Notes:** User emphasized that all calls should convert to leads — non-booking should NOT be strict. Only explicit decline enforces no-booking.

### Decline Rules

| Option | Description | Selected |
|--------|-------------|----------|
| One clear decline ends it | Single "no thanks" stops booking push | |
| Soft re-offer once | First decline gets gentle re-offer, second decline = lead only | ✓ |
| Never fully back off | Always mention booking option but don't push | |

**User's choice:** Soft re-offer once

### Post-Decline Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Lead capture + closing | Capture caller info, create lead, wrap up | ✓ |
| Just end politely | Thank and end, save whatever was gathered | |
| Offer callback instead | Pivot to callback offer as third path | |

**User's choice:** Lead capture + closing

### Quote Call Treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Quote = booking opportunity | Quotes convert to site visit bookings | ✓ |
| Quote = info call | Ballpark pricing, booking as optional | |
| Quote = mandatory booking | No phone pricing, require on-site visit | |

**User's choice:** Quote = booking opportunity

---

## Exception & Transfer Triggers

### Transfer Immediacy

| Option | Description | Selected |
|--------|-------------|----------|
| Instant, no questions | Immediate transfer, zero friction | ✓ |
| Quick capture then transfer | Grab name/number first, 10-second delay | |
| Confirm then transfer | Brief summary confirmation, then transfer | |

**User's choice:** Instant, no questions

### Whisper Message Content

| Option | Description | Selected |
|--------|-------------|----------|
| Full summary | Everything: name, phone, address, issue, conversation summary, urgency | |
| Key details only | Name, issue type, urgency only | |
| Structured template | Fixed format: "[Name] calling about [job type]. [Urgency]. [1-line summary]." | ✓ |

**User's choice:** Structured template

### Clarification Failure Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Transfer after 2 attempts | Clean handoff after 2 failed clarifications | |
| Offer booking anyway | Try booking even without understanding issue | |
| Ask caller to describe differently | Third attempt with different approach before transfer | ✓ |

**User's choice:** Ask caller to describe differently (3 total attempts before transfer)

### Additional Transfer Triggers

| Option | Description | Selected |
|--------|-------------|----------|
| Just those two | 2 triggers only: failed clarification + explicit request | ✓ |
| Add: language barrier | Transfer on unsupported language detection | |
| Add: emotional distress | Offer human for extremely upset callers | |

**User's choice:** Just those two

---

## Prompt Rewrite Strategy

### Restructure Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Surgical edits | Minimal changes to existing prompt | |
| Full rewrite | Rebuild from scratch | |
| Modular prompt builder | Composable sections assembled per call | ✓ |

**User's choice:** Modular prompt builder

### Tone Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Keep tone split | Different tones for emergency vs routine | |
| Unified tone | Same professional-friendly tone for all calls | ✓ |
| Tone from triage tag | AI reads urgency cues naturally without explicit sections | |

**User's choice:** Unified tone

### Module Control

| Option | Description | Selected |
|--------|-------------|----------|
| Developer-controlled modules | Code-level building blocks, tenants use existing config | ✓ |
| Tenant-configurable modules | Owners toggle modules from dashboard | |
| Hybrid | Core developer-controlled, optional tenant-configurable | |

**User's choice:** Developer-controlled modules

### Urgency and Slot Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, urgency affects slots | Same tone but slot priority differs by urgency cues | ✓ |
| All calls get same slots | Next available regardless of urgency | |
| Caller chooses urgency | AI asks caller to self-select urgency | |

**User's choice:** Urgency affects slots (same tone, different slot priority)

---

## WebSocket Tool Updates

### Tool Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Keep existing two tools | book_appointment + transfer_call only | |
| Add end_call tool | Third tool for graceful call ending | |
| Add capture_lead tool | Third tool for mid-call lead creation | |
| Add both end_call + capture_lead | Four tools total | ✓ |

**User's choice:** Add both end_call + capture_lead

### Booking Gate

| Option | Description | Selected |
|--------|-------------|----------|
| Always available | Remove onboarding_complete gate | |
| Keep the gate | Booking requires completed onboarding | ✓ |
| New gate: has_availability | Gate on configured working hours + available slots | |

**User's choice:** Keep the gate

### end_call Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Signal end only | Just tells Retell to hang up | |
| End + immediate processing | Hangup + trigger post-call processing in parallel | ✓ |

**User's choice:** End + immediate processing

### capture_lead Data

| Option | Description | Selected |
|--------|-------------|----------|
| Structured fields | AI passes: caller_name, phone, address, job_type, notes | ✓ |
| Freeform summary | AI passes text summary, post-processor extracts fields | |
| Minimal + auto-extract | AI passes name/phone only, rest auto-extracted | |

**User's choice:** Structured fields

---

## Claude's Discretion

- Modular prompt builder architecture (module boundaries, composition logic)
- end_call implementation (Retell hangup + post-call processing trigger)
- capture_lead schema mapping to existing tables
- Whisper message template field mapping
- Clarification attempt counting mechanism
- Urgency cue detection for slot ordering

## Deferred Ideas

None — discussion stayed within phase scope

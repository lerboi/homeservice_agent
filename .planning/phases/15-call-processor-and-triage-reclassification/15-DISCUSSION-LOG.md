# Phase 15: Call Processor and Triage Reclassification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 15-call-processor-and-triage-reclassification
**Areas discussed:** booking_outcome tracking, isRoutineUnbooked removal, Caller SMS confirmation, Triage tag reclassification

---

## booking_outcome Tracking

### Q1: How should we classify a call where the caller declined booking?

| Option | Description | Selected |
|--------|-------------|----------|
| attempted | AI offered slots and caller declined — booking was attempted but not completed | |
| not_attempted | Reserve 'attempted' for technical failures only | |
| declined | Add a 4th outcome category: booked / attempted / declined / not_attempted | ✓ |

**User's choice:** declined — 4 outcome categories for more granular tracking
**Notes:** Distinguishes between technical failure (attempted) and caller choice (declined)

### Q2: Where should booking_outcome be determined?

| Option | Description | Selected |
|--------|-------------|----------|
| Real-time | Set as events happen during the live call | ✓ |
| Post-call only | Determine during processCallAnalyzed | |
| You decide | Claude's discretion | |

**User's choice:** Real-time — most accurate, no transcript parsing needed

### Q3: Should exception_reason also be set real-time?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, real-time | Set at moment transfer_call fires | ✓ |
| Post-call inference | Analyze transcript after call ends | |
| You decide | Claude's discretion | |

**User's choice:** Yes, real-time — consistent with booking_outcome approach

---

## isRoutineUnbooked Removal

### Q1: What should happen to suggested_slots logic?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep for all unbooked | Remove 'routine' restriction, calculate for any unbooked call | ✓ |
| Drop entirely | AI already offered slots during call | |
| Gate on 'declined' only | Only for booking_outcome = declined | |

**User's choice:** Keep for all unbooked — useful for owner follow-up on any unbooked call

---

## Caller SMS Confirmation

### Q1: Where should confirmation SMS be triggered?

| Option | Description | Selected |
|--------|-------------|----------|
| handleBookAppointment | Send immediately after atomicBookSlot succeeds | ✓ |
| Post-call processor | Send during processCallAnalyzed | |
| Separate async job | Queue independent SMS job | |

**User's choice:** handleBookAppointment — fastest path to <60s delivery

### Q2: Multi-language or English-only?

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-language | Use detected_language for en/es SMS | ✓ |
| English only | Ship English first, add languages in Phase 18 | |
| You decide | Claude's discretion | |

**User's choice:** Multi-language — aligns with HARDEN-01

### Q3: SMS content?

| Option | Description | Selected |
|--------|-------------|----------|
| Date + time + address + business name | Full confirmation matching AI read-aloud | ✓ |
| Minimal: date + time | Keep it short | |
| Rich: add cancel/reschedule link | Requires public booking management page | |

**User's choice:** Date + time + address + business name — clear, complete, professional

---

## Triage Tag Reclassification

### Q1: Should emergency console.warn stay?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep it | Useful debugging log, doesn't affect routing | ✓ |
| Remove it | Misleading in booking-first world | |
| Downgrade to console.log | Informational, not an alert | |

**User's choice:** Keep it — useful for debugging

### Q2: How should this phase hand off to Phase 16?

| Option | Description | Selected |
|--------|-------------|----------|
| urgency_classification on calls table | Already exists, Phase 16 reads it directly | |
| New notification_priority column | Separate column mapping urgency to notification tier | ✓ |
| You decide | Claude's discretion | |

**User's choice:** New notification_priority column — decouples triage from notifications

### Q3: Where should urgency-to-priority mapping happen?

| Option | Description | Selected |
|--------|-------------|----------|
| In call-processor | Map after triage runs, single write | ✓ |
| In notification service | Phase 16 derives at send-time | |
| You decide | Claude's discretion | |

**User's choice:** In call-processor — single place, single write

---

## Claude's Discretion

- Schema migration strategy
- Exact placement of real-time booking_outcome writes
- SMS function signature and error handling
- i18n approach for SMS templates
- Whether notification_priority goes on leads table too

## Deferred Ideas

None — discussion stayed within phase scope

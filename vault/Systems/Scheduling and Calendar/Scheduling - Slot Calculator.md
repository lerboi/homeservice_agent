---
type: system
system: Scheduling and Calendar
status: current
description: "Slot Calculator. Covers: Signature; Algorithm; All-Day Block Expansion (`expandAllDayInterval`); Travel Buffer Rules"
source: .claude/skills/scheduling-calendar-system/SKILL.md § 1. Slot Calculator
migrated: 2026-11-23
verified:
tags: [voco/system/scheduling-and-calendar]
---

# Slot Calculator

Part of [[Scheduling and Calendar]]. Migrated verbatim from the `scheduling-calendar-system` skill; check `verified` before trusting details.

**File**: `src/lib/scheduling/slot-calculator.js`

Pure function — no database access. Fully testable in isolation. All DB fetching happens in the calling layer (webhook handler, `processCallAnalyzed`, etc.) before `calculateAvailableSlots` is called.

### Signature

```js
export function calculateAvailableSlots({
  workingHours,        // object  — day-keyed config e.g. { monday: { enabled, open, close, lunchStart, lunchEnd } }
  slotDurationMins,    // number  — slot length in minutes (e.g. 60)
  existingBookings,    // Array   — [{ start_time, end_time, zone_id? }] ISO strings
  externalBlocks,      // Array   — [{ start_time, end_time, is_all_day? }] ISO strings (from calendar_events + calendar_blocks)
  zones,               // Array   — [{ id, name }] configured service zones
  zonePairBuffers,     // Array   — [{ zone_a_id, zone_b_id, buffer_mins }]
  targetDate,          // string  — "YYYY-MM-DD"
  tenantTimezone,      // string  — IANA timezone e.g. "America/Chicago"
  maxSlots,            // number  — max slots to return (default 10)
  candidateZoneId,     // string|null — zone ID for the candidate booking (for travel buffer calc)
  travelBufferMins,    // number  — owner-adjustable tenant-wide buffer (tenants.travel_buffer_mins, M16 P2; default 30)
})
// Returns: Array<{ start: string, end: string }> — ISO strings
```

### Algorithm

1. Derive day-of-week in tenant timezone from `targetDate`
2. Look up `workingHours[dayKey]` — if day is disabled or missing, return `[]`
3. Convert `open`/`close` times (HH:MM) to UTC Date objects via `fromZonedTime`
4. Convert `lunchStart`/`lunchEnd` similarly (if configured)
5. **Past-date guard**: if `windowEnd <= now`, return `[]` immediately (entire working window is in the past)
6. **Today adjustment**: if target date is today and `cursor < now`, advance cursor to `now` (skip past times)
7. Walk forward from `windowStart` (or `now` for today) in `slotDurationMins` steps until `windowEnd` or `maxSlots` reached
8. For each candidate slot, skip if:
   - Slot end exceeds `windowEnd`
   - Overlaps with lunch break
   - Overlaps any `existingBookings` interval
   - Overlaps any `externalBlocks` interval (Google/Outlook calendar events)
   - Violates the travel buffer from the most recent **prior** booking (backward), OR from the earliest **following** booking (forward) — the buffer is enforced on **both** sides (M16 P2; see travel buffer rules)
9. Accepted slots are returned as `{ start, end }` ISO strings

### All-Day Block Expansion (`expandAllDayInterval`)

External blocks with `is_all_day: true` are stored as date-only payloads that Postgres widens to **UTC-midnight timestamptz** — compared raw, they block the wrong local hours for any non-UTC tenant (e.g. 08:00→08:00-next-day for Asia/Singapore). Before overlap checks, `expandAllDayInterval(start, end, timezone)` rewrites them to `[00:00 tenant-local of the first day, 00:00 tenant-local of the day after the last day)`:

- The covered days come from the **UTC date portion** of the stored timestamps (the pure-date encoding).
- An end that lands exactly on a UTC midnight (after the start) follows the Google/Outlook **exclusive-end convention** — that midnight already IS the day-after boundary; any other end time means the event runs into that day, so the boundary becomes the following day.
- The Python twin (`livekit-agent/src/lib/slot_calculator.py` `_all_day_busy_bounds`) implements the same semantics (it steps the exclusive end back 1µs instead). Both the JS available-slots route and every Python calendar fetch site now SELECT `is_all_day` from `calendar_events` and `calendar_blocks`.

### Travel Buffer Rules

Implemented in `getTravelBufferMins(lastBookingZoneId, candidateZoneId, zones, zonePairBuffers, defaultBufferMins)` (Python twin: `_get_travel_buffer_mins(..., default_buffer_mins)`). `defaultBufferMins` is the **owner-adjustable** tenant-wide buffer — `tenants.travel_buffer_mins` (M16 P2, migration 075; `int NOT NULL DEFAULT 30`):

| Condition | Buffer |
|-----------|--------|
| No zones configured (`zones` is empty) | `defaultBufferMins` (the tenant's `travel_buffer_mins`, default 30) |
| One or both sides missing a zone ID | `defaultBufferMins` (cross-zone default) |
| Same zone (`lastBookingZoneId === candidateZoneId`) | 0 min |
| Different zones — matching pair in `zonePairBuffers` | `pair.buffer_mins` (dormant) |
| Different zones — no pair entry found | `defaultBufferMins` |

Because `zone_id` is always NULL today (the zone-differentiation rows are dormant), in practice every booking resolves to `defaultBufferMins`. The value is threaded into `calculateAvailableSlots({ ..., travelBufferMins })` exactly like `slotDurationMins`, so it applies automatically at **both** offer-time and book-time. **Default 30 = pre-P2 behavior (zero regression on the value).** A stored `0` disables buffering.

The buffer is enforced on **both sides** of every existing booking (M16 P2):
- **Backward** — the "last booking before this slot" is `parsedBookings` filtered to those ending at/before `slotStart`, picking the latest end; the slot must start ≥ `lastEnd + buffer`.
- **Forward** — the "earliest booking after this slot" is `parsedBookings` filtered to those starting at/after `slotEnd`, picking the earliest start; the slot must end ≤ `nextStart − buffer`.

Both sides consult `existingBookings` (appointments) only, not `externalBlocks`.

> **M16 P1/P2 — pairwise buffers dormant; flat buffer now owner-adjustable.** The multi-zone UI and the pairwise `zone_travel_buffers` matrix are retired (nothing populates `zone_travel_buffers`); the `_get_travel_buffer_mins` zone-differentiation branches stay dormant. P2 (migration 075) kept that flat default path but made it the owner-set `tenants.travel_buffer_mins` and added the forward adjacency case. The `zone_travel_buffers` table still exists (inert).

---

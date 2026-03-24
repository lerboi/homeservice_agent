# Phase 15: Call Processor and Triage Reclassification - Research

**Researched:** 2026-03-25
**Domain:** Call processing pipeline, Supabase schema migration, Twilio SMS, i18n
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Four booking_outcome values: `booked`, `attempted`, `declined`, `not_attempted`
- **D-02:** booking_outcome set real-time during live call — `booked` when `book_appointment` succeeds, `declined` when `capture_lead` fires after decline, `attempted` on `book_appointment` failure. Post-call processor fills `not_attempted` as default for calls with no booking activity recorded.
- **D-03:** exception_reason set real-time when `transfer_call` fires — values: `clarification_limit` or `caller_requested`
- **D-04:** Remove `isRoutineUnbooked` guard entirely from `call-processor.js` — the `triageResult.urgency === 'routine' && !appointmentExists` check no longer gates any logic
- **D-05:** Keep suggested_slots calculation — expand scope to ANY unbooked call (routine or emergency), gate on `!appointmentExists` only
- **D-06:** Trigger SMS from `handleBookAppointment` in webhook handler immediately after `atomicBookSlot` succeeds. Fire-and-forget (non-blocking) using existing Twilio infrastructure in `notifications.js`
- **D-07:** Multi-language from day one — use `detected_language` from call metadata to send SMS in caller's language (en/es)
- **D-08:** SMS content: "Your appointment with [Business Name] is confirmed for [Date] at [Time] at [Address]."
- **D-09:** Triage classifier (`classifyCall`) remains unchanged — urgency no longer gates routing
- **D-10:** Emergency console.warn in call-processor.js stays as-is
- **D-11:** New `notification_priority` column on calls table: `emergency`/`high_ticket` maps to `high`, `routine` maps to `standard`
- **D-12:** Phase 16 reads `notification_priority` from call/lead record — clean decoupling

### Claude's Discretion

- Schema migration strategy (Supabase migration file vs direct ALTER TABLE)
- Exact placement of real-time booking_outcome writes in webhook handler code
- SMS function signature and error handling pattern (following existing sendOwnerSMS pattern)
- i18n approach for SMS templates (translation files vs inline)
- Whether notification_priority should also be set on the leads table or only calls

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRIAGE-R01 | Urgency tags retained on booking records but no longer route call handling | D-04 removes isRoutineUnbooked guard; D-09 keeps classifier unchanged; urgency_classification column preserved on calls table |
| TRIAGE-R02 | Triage pipeline output drives notification priority tier, not booking vs lead-capture decision | D-11 adds notification_priority column; D-12 decouples from Phase 16; mapping computed after triage in processCallAnalyzed |
| BOOK-04 | Caller receives SMS confirmation after booking with date, time, and service address | D-06 fire-and-forget SMS from handleBookAppointment; D-07 multi-language; D-08 SMS content spec |
</phase_requirements>

---

## Summary

Phase 15 is a targeted behavioral refactor with three independent concerns: (1) flatten the call processing pipeline by removing the urgency-based routing fork, (2) add three schema columns to the calls table for analytics and Phase 16 handoff, and (3) add caller SMS confirmation after successful bookings. All three are additive or subtractive code changes against existing, well-understood infrastructure — no new dependencies are required.

The existing codebase provides exact patterns for every new capability needed. `sendOwnerSMS` in `notifications.js` is the direct template for `sendCallerSMS`. The `after()` fire-and-forget pattern used for calendar sync in `handleBookAppointment` applies identically for SMS dispatch. The Supabase upsert pattern with `onConflict: 'retell_call_id'` is already used throughout `call-processor.js` and needs only column additions. The `isRoutineUnbooked` guard is isolated to a single code path in `call-processor.js` (lines 172-174) with a clean removal boundary.

The highest risk areas are: (1) ensuring all three real-time booking_outcome write points are handled atomically with their respective webhook responses, (2) verifying the SMS caller phone number is available in `handleBookAppointment` (it is — via `payload.call?.from_number`), and (3) keeping translation key parity (en.json and es.json must have matching keys — enforced by existing test `tests/i18n/translation-keys.test.js`).

**Primary recommendation:** Execute as three clearly bounded tasks — schema migration first, then call-processor.js cleanup, then webhook SMS + booking_outcome writes — each independently testable.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| twilio | ^5.13.0 | Twilio SMS | Already installed, lazy-client pattern established |
| @supabase/supabase-js | (existing) | Schema migration + upserts | Project ORM, migration file pattern established |
| next/server `after()` | Next.js ^16.1.7 | Fire-and-forget post-response work | Already used in route.js for calendar sync |
| date-fns + date-fns-tz | (existing) | Date formatting for SMS content | Already used in route.js for formatSlotForSpeech |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| messages/en.json + es.json | (project) | SMS template strings | i18n approach (direct JSON import, no next-intl runtime) |

**No new npm installations required for this phase.**

---

## Architecture Patterns

### Recommended Project Structure

No new files/directories needed. All changes are modifications to existing files plus one new migration file.

```
supabase/migrations/
  └── 008_call_outcomes.sql   # New: adds booking_outcome, exception_reason, notification_priority

src/lib/
  ├── call-processor.js       # Modified: remove isRoutineUnbooked, expand suggested_slots, add notification_priority write
  └── notifications.js        # Modified: add sendCallerSMS()

src/app/api/webhooks/retell/
  └── route.js                # Modified: booking_outcome writes in handleFunctionCall, SMS in handleBookAppointment

messages/
  ├── en.json                 # Modified: add notifications.booking_confirmation key
  └── es.json                 # Modified: add notifications.booking_confirmation key (must stay in parity)

tests/
  ├── notifications/caller-sms.test.js           # New
  └── call-processor/booking-outcome.test.js     # New (or add to existing call-processor tests)
```

### Pattern 1: Real-Time booking_outcome Write (handleFunctionCall)

Each tool invocation in `handleFunctionCall` must update the calls record before returning. The call record is guaranteed to exist at this point (created by `processCallEnded` which fires on `call_ended` before function calls in the post-call flow — but NOTE: function calls happen DURING the call, not post-call).

**Critical insight:** During a live call, the call record may not yet exist in the DB when `book_appointment` fires (it is created by `processCallEnded` which fires on `call_ended`). The upsert in `handleBookAppointment` already resolves the call record via `retell_call_id` — this lookup is the resolution point.

The correct approach: upsert the calls record with `booking_outcome` at each write point using the same `onConflict: 'retell_call_id'` pattern.

```javascript
// Source: call-processor.js upsert pattern (already established)
// In handleBookAppointment — after atomicBookSlot succeeds:
await supabase.from('calls').upsert(
  { retell_call_id: call_id, booking_outcome: 'booked' },
  { onConflict: 'retell_call_id' }
);

// In handleBookAppointment — when result.success is false:
await supabase.from('calls').upsert(
  { retell_call_id: call_id, booking_outcome: 'attempted' },
  { onConflict: 'retell_call_id' }
);

// In handleFunctionCall for capture_lead (after successful lead creation):
await supabase.from('calls').upsert(
  { retell_call_id: call_id, booking_outcome: 'declined' },
  { onConflict: 'retell_call_id' }
);

// In handleFunctionCall for transfer_call (when transfer fires):
await supabase.from('calls').upsert(
  { retell_call_id: call_id, exception_reason: args.reason || 'caller_requested' },
  { onConflict: 'retell_call_id' }
);
```

### Pattern 2: sendCallerSMS — Following sendOwnerSMS Pattern

```javascript
// Source: src/lib/notifications.js — sendOwnerSMS pattern
export async function sendCallerSMS({
  to,           // caller's phone number
  businessName,
  date,         // human-readable date string
  time,         // human-readable time string
  address,      // service address
  locale,       // 'en' | 'es'
}) {
  const translations = locale === 'es' ? es : en;
  // Use translations.notifications.booking_confirmation template
  // Interpolate: {business_name}, {date}, {time}, {address}
  const body = interpolate(translations.notifications.booking_confirmation, {
    business_name: businessName,
    date,
    time,
    address,
  });

  try {
    const result = await getTwilioClient().messages.create({
      body,
      from: process.env.TWILIO_FROM_NUMBER,
      to,
    });
    console.log('[notifications] Caller SMS sent:', result.sid);
    return result;
  } catch (err) {
    console.error('[notifications] Caller SMS failed:', err?.message || err);
    // Non-throwing — consistent with sendOwnerSMS pattern
  }
}
```

### Pattern 3: Fire-and-Forget SMS in handleBookAppointment

```javascript
// Source: route.js — after() pattern already used for pushBookingToCalendar
// Add alongside existing calendar sync block after atomicBookSlot success:
after(async () => {
  await pushBookingToCalendar(call.tenant_id, result.appointment_id);
});

// Add new fire-and-forget SMS:
const callerPhone = payload.call?.from_number || null;
const callerLocale = /* lookup from call metadata or tenant default */ 'en';
if (callerPhone) {
  after(async () => {
    await sendCallerSMS({
      to: callerPhone,
      businessName: tenant?.business_name || 'Your service provider',
      date: format(toZonedTime(startTime, tenantTimezone), 'EEEE, MMMM do'),
      time: format(toZonedTime(startTime, tenantTimezone), 'h:mm a'),
      address: args.service_address,
      locale: callerLocale,
    });
  });
}
```

**Note on caller locale:** `detected_language` is stored in `retell_metadata` on the calls record. The call record may exist (from an earlier `call_ended` event) or may need a fallback to the tenant's `default_locale`. The planner should decide whether to do a DB lookup for `detected_language` or use the tenant's `default_locale` — both are available in `handleBookAppointment`.

### Pattern 4: notification_priority Mapping in processCallAnalyzed

```javascript
// In call-processor.js, after triage runs:
const notification_priority =
  triageResult.urgency === 'emergency' || triageResult.urgency === 'high_ticket'
    ? 'high'
    : 'standard';

// Include in the upsert:
await supabase.from('calls').upsert(
  {
    // ...existing columns...
    urgency_classification: triageResult.urgency,
    notification_priority,
    // ...
  },
  { onConflict: 'retell_call_id' }
);
```

### Pattern 5: isRoutineUnbooked Removal and suggested_slots Expansion

Current code (lines 172-174 of call-processor.js):
```javascript
const isRoutineUnbooked = triageResult.urgency === 'routine' && !appointmentExists;
if (isRoutineUnbooked && tenantId) { ... }
```

Replacement (D-04, D-05):
```javascript
const shouldCalculateSlots = !appointmentExists && tenantId;
if (shouldCalculateSlots) { ... }
```

The variable `isRoutineUnbooked` is only used as the conditional gate — it can be removed entirely and the gate replaced with `!appointmentExists && tenantId`.

### Pattern 6: not_attempted Default in processCallAnalyzed

After the upsert in `processCallAnalyzed`, the `booking_outcome` column for calls with no real-time write will be NULL (not `not_attempted`). The post-call processor should set `not_attempted` as the default:

```javascript
// In the calls upsert in processCallAnalyzed:
// Only set booking_outcome if it's not already set (real-time writes take precedence)
// Use a conditional upsert that doesn't overwrite existing booking_outcome values.
// Approach: fetch current booking_outcome first, only set 'not_attempted' if null.
```

**Important gotcha:** Standard Supabase upsert will overwrite ALL columns including those set real-time. To avoid overwriting `booking_outcome` written during the live call, `processCallAnalyzed` must either:
- (a) Fetch the current `booking_outcome` value first and only set `not_attempted` if it is NULL, or
- (b) Use a raw SQL UPDATE with `WHERE booking_outcome IS NULL` for that specific column

Option (b) is cleaner. Use a targeted update for `not_attempted` after the main upsert:

```javascript
// After the main upsert:
await supabase
  .from('calls')
  .update({ booking_outcome: 'not_attempted' })
  .eq('retell_call_id', call_id)
  .is('booking_outcome', null);
```

### Anti-Patterns to Avoid

- **Overwriting real-time booking_outcome in processCallAnalyzed upsert:** The main upsert must NOT include `booking_outcome` in its column set — it would clobber values written during the live call. Use a separate targeted UPDATE after the main upsert for `not_attempted` default.
- **Blocking webhook response on SMS:** SMS must use `after()` — blocking on Twilio API would add 200-500ms to the webhook response, risking Retell timeout.
- **Missing SMS translation key parity:** Adding `notifications.booking_confirmation` to `en.json` without adding it to `es.json` will fail the existing `tests/i18n/translation-keys.test.js` test.
- **Using payload.call.from_number without null check:** `payload.call` may not always be present in `call_function_invoked` events. Guard with `payload.call?.from_number`.
- **Hardcoding 'en' locale for SMS:** Must use `detected_language` from call metadata or fall back to `tenant.default_locale` — not hardcoded.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SMS delivery | Custom HTTP to Twilio API | `getTwilioClient().messages.create()` in notifications.js | Existing lazy client with proper error handling |
| Date formatting for SMS | Custom date string builder | `format(toZonedTime(...), ...)` from date-fns/date-fns-tz | Already imported in route.js; handles timezone correctly |
| Fire-and-forget async work | `Promise.resolve().then(...)` or detached async | `after()` from `next/server` | Project-established pattern for post-response async; handles Next.js lifecycle correctly |
| Schema migration | Direct Supabase dashboard ALTER | Numbered migration file in `supabase/migrations/` | Project uses migration files (001-007 exist); keeps schema in version control |
| i18n string interpolation | Custom regex replace | Simple `str.replace('{key}', value)` loop | No i18n runtime available outside Next.js context (same reason as buildSystemPrompt) |

---

## Common Pitfalls

### Pitfall 1: Upsert Overwrites Real-Time booking_outcome

**What goes wrong:** `processCallAnalyzed` runs after the call ends and does a full upsert of the calls record. If `booking_outcome` is included in that upsert, it will overwrite the value written real-time (e.g., `booked` becomes null or `not_attempted`).

**Why it happens:** Supabase upsert with `onConflict` replaces ALL provided columns, not just null ones.

**How to avoid:** Do NOT include `booking_outcome` in the main upsert column list. After the main upsert, run a separate UPDATE with `.is('booking_outcome', null)` to set `not_attempted` only for calls that had no booking activity.

**Warning signs:** Integration test shows `booking_outcome` is `not_attempted` even for calls that completed a booking.

### Pitfall 2: SMS Phone Number Not Available at Function Call Time

**What goes wrong:** During a live call, `payload.call` in a `call_function_invoked` event may not include `from_number` — the shape depends on Retell's event structure.

**Why it happens:** Retell's `call_function_invoked` event structure may differ from `call_inbound` — `from_number` may be nested differently.

**How to avoid:** Verify `payload.call?.from_number` is populated in `call_function_invoked` payloads. The current code at line 364 already uses `payload.call?.from_number || null` for `callerPhone` in `atomicBookSlot` — so it is available. Reuse the same access pattern for SMS.

**Warning signs:** `sendCallerSMS` logs show `to: null` — SMS sent to null number (Twilio will reject with error, caught by try/catch).

### Pitfall 3: notification_priority Not Written for emergency console.warn Calls

**What goes wrong:** The emergency `console.warn` block fires but if `notification_priority` mapping is added AFTER the upsert instead of BEFORE, it won't be included in the DB write.

**Why it happens:** Code ordering issue — computing `notification_priority` must happen before the upsert call.

**How to avoid:** Compute `notification_priority` immediately after `triageResult` is populated, before the upsert block.

### Pitfall 4: i18n Key Parity Test Failure

**What goes wrong:** Adding SMS confirmation template key to `en.json` but not `es.json` causes `tests/i18n/translation-keys.test.js` to fail.

**Why it happens:** The translation-keys test enforces strict parity between en and es key sets.

**How to avoid:** Always add new keys to both files simultaneously. The Spanish text can be a reasonable translation — the test checks key existence and placeholder parity, not translation quality.

### Pitfall 5: capture_lead booking_outcome Write Uses Wrong call_id

**What goes wrong:** In `handleFunctionCall` for `capture_lead`, the code queries `calls` by `retell_call_id` and gets back `call.id` (the UUID). The upsert for `booking_outcome` must use `retell_call_id` (text), not `call.id` (UUID) — since `retell_call_id` is the `onConflict` key.

**Why it happens:** The variable `call_id` in the webhook handler refers to `payload.call_id` (Retell's string ID), while `call.id` is the Supabase UUID primary key. Easy to confuse.

**How to avoid:** Always use `retell_call_id: call_id` (from `payload.call_id`) in upserts, not `id: call.id`.

---

## Code Examples

### Schema Migration Template

```sql
-- Source: supabase/migrations/004_leads_crm.sql pattern
-- 008_call_outcomes.sql

ALTER TABLE calls
  ADD COLUMN booking_outcome text
    CHECK (booking_outcome IN ('booked', 'attempted', 'declined', 'not_attempted')),
  ADD COLUMN exception_reason text
    CHECK (exception_reason IN ('clarification_limit', 'caller_requested')),
  ADD COLUMN notification_priority text
    CHECK (notification_priority IN ('high', 'standard'));

-- Indexes for analytics queries
CREATE INDEX idx_calls_booking_outcome ON calls(tenant_id, booking_outcome);
CREATE INDEX idx_calls_notification_priority ON calls(tenant_id, notification_priority);
```

### Supabase Conditional Update (not_attempted default)

```javascript
// Source: pattern from Supabase docs — conditional update
await supabase
  .from('calls')
  .update({ booking_outcome: 'not_attempted' })
  .eq('retell_call_id', call_id)
  .is('booking_outcome', null);
```

### i18n Template (messages/en.json addition)

```json
"notifications": {
  "new_lead": "New lead from {caller_name} - {job_type}",
  "language_barrier_alert": "LANGUAGE BARRIER: Caller spoke {language}. Needs follow-up.",
  "booking_confirmation": "Your appointment with {business_name} is confirmed for {date} at {time} at {address}."
}
```

Spanish equivalent (messages/es.json):
```json
"notifications": {
  "new_lead": "Nuevo cliente potencial de {caller_name} - {job_type}",
  "language_barrier_alert": "BARRERA DE IDIOMA: El cliente hablo {language}. Necesita seguimiento.",
  "booking_confirmation": "Su cita con {business_name} esta confirmada para el {date} a las {time} en {address}."
}
```

### Simple Interpolation Helper (inline, no library)

```javascript
// Inline — no i18n runtime available outside Next.js context
function interpolate(template, vars) {
  return Object.entries(vars).reduce(
    (str, [key, val]) => str.replace(`{${key}}`, val ?? ''),
    template
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Urgency drives routing (emergency → book, routine → lead) | Urgency tags retained but all calls follow booking path | Phase 15 | Simplifies call-processor; routine callers now get autonomous booking |
| suggested_slots only for routine+unbooked | suggested_slots for any unbooked call | Phase 15 | Useful for owner follow-up on declined/attempted bookings |
| No booking outcome analytics | booking_outcome column on calls table | Phase 15 | Queryable for conversion funnel analytics |
| Notification priority embedded in urgency | notification_priority decoupled to separate column | Phase 15 | Clean handoff to Phase 16 |

---

## Open Questions

1. **Where to get detected_language for SMS locale in handleBookAppointment**
   - What we know: `detected_language` is stored in `retell_metadata` on the calls record. The call record exists at `book_appointment` time (looked up at line 332 in route.js). The record has `retell_metadata` jsonb.
   - What's unclear: Should we fetch `detected_language` from the calls record (extra DB query) or use `tenant.default_locale` (already fetched)?
   - Recommendation: Add `detected_language` to the call select at line 334 (`select('id, tenant_id, detected_language')`). If null, fall back to `tenant.default_locale`. This is a single column addition to an existing query — no extra round trip.

2. **Should notification_priority be mirrored on the leads table?**
   - What we know: Phase 16 handoff contract says Phase 16 reads from call/lead record. CONTEXT.md D-12 mentions "call/lead record" — ambiguous.
   - What's unclear: Whether Phase 16 queries calls or leads table for notification_priority.
   - Recommendation: Add only to calls table for Phase 15 (per CONTEXT.md D-11 which says "column on calls table"). Phase 16 can join through `leads.primary_call_id` if needed. Avoid over-engineering.

3. **Transfer call exception_reason: who supplies the reason?**
   - What we know: D-03 defines values `clarification_limit` and `caller_requested`. The AI agent invokes `transfer_call` with function arguments.
   - What's unclear: Whether the agent currently passes a `reason` argument, or if the reason must be inferred from context.
   - Recommendation: Check Phase 14 transfer_call tool definition to see if `reason` is a declared parameter. If not, the webhook handler must determine reason from context (impossible in real-time without additional logic). The simpler path: add `reason` as a parameter to the transfer_call tool definition and have the AI pass it. This may be a Phase 14 gap that needs resolution before Phase 15.

---

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies — Twilio, Supabase, and date-fns are all existing installed packages)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 (ESM mode) |
| Config file | jest.config.js |
| Quick run command | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/notifications/caller-sms.test.js tests/call-processor/ -x` |
| Full suite command | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOOK-04 | sendCallerSMS sends correct SMS body with business name, date, time, address | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/notifications/caller-sms.test.js -x` | Wave 0 |
| BOOK-04 | sendCallerSMS sends Spanish SMS when locale is 'es' | unit | same file | Wave 0 |
| BOOK-04 | sendCallerSMS does not throw on Twilio error | unit | same file | Wave 0 |
| BOOK-04 | handleBookAppointment triggers SMS after successful booking | integration | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/call-processor/booking-outcome.test.js -x` | Wave 0 |
| TRIAGE-R01 | processCallAnalyzed does not gate suggested_slots on urgency === 'routine' | unit | same file | Wave 0 |
| TRIAGE-R01 | emergency call follows same processing path as routine call | unit | same file | Wave 0 |
| TRIAGE-R02 | notification_priority is 'high' for emergency calls | unit | same file | Wave 0 |
| TRIAGE-R02 | notification_priority is 'high' for high_ticket calls | unit | same file | Wave 0 |
| TRIAGE-R02 | notification_priority is 'standard' for routine calls | unit | same file | Wave 0 |
| D-02 | booking_outcome = 'booked' set on atomicBookSlot success | unit | same file | Wave 0 |
| D-02 | booking_outcome = 'attempted' set on atomicBookSlot failure | unit | same file | Wave 0 |
| D-02 | booking_outcome = 'declined' set when capture_lead fires | unit | same file | Wave 0 |
| D-02 | booking_outcome = 'not_attempted' set for calls with no booking activity (post-call) | unit | same file | Wave 0 |
| D-02 | real-time booking_outcome not overwritten by processCallAnalyzed upsert | unit | same file | Wave 0 |
| D-07 | SMS uses en translation when locale is 'en' | unit | caller-sms.test.js | Wave 0 |
| D-07 | SMS uses es translation when locale is 'es' | unit | caller-sms.test.js | Wave 0 |
| i18n parity | en.json and es.json have matching keys after adding booking_confirmation | existing | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/i18n/translation-keys.test.js` | Exists (enforces parity) |

### Sampling Rate
- **Per task commit:** `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/notifications/caller-sms.test.js tests/call-processor/ tests/i18n/ -x`
- **Per wave merge:** Full suite
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/notifications/caller-sms.test.js` — covers BOOK-04 and D-07
- [ ] `tests/call-processor/booking-outcome.test.js` — covers TRIAGE-R01, TRIAGE-R02, D-02 (all booking_outcome writes and notification_priority mapping)

*(Existing `tests/notifications/owner-sms.test.js` and `tests/i18n/translation-keys.test.js` already cover adjacent behaviors and serve as implementation templates)*

---

## Project Constraints (from CLAUDE.md)

- **Skill files:** No `.claude/skills/` or `.agents/skills/` directory exists in this project — no skill file constraints apply.
- **Code changes require skill file updates:** If any architecture skill files exist after implementation, they must be updated. None exist currently.

---

## Sources

### Primary (HIGH confidence)
- Direct code read: `src/lib/call-processor.js` — full function bodies, line numbers verified
- Direct code read: `src/app/api/webhooks/retell/route.js` — handleBookAppointment, handleFunctionCall complete
- Direct code read: `src/lib/notifications.js` — sendOwnerSMS pattern, lazy client pattern
- Direct code read: `src/lib/scheduling/booking.js` — atomicBookSlot return shape
- Direct migration reads: `supabase/migrations/001_initial_schema.sql`, `002_onboarding_triage.sql`, `004_leads_crm.sql` — calls table schema, existing columns
- Direct read: `messages/en.json`, `messages/es.json` — existing translation structure and parity requirement
- Direct read: `tests/notifications/owner-sms.test.js` — established test pattern for notifications
- Direct read: `tests/i18n/translation-keys.test.js` — enforced key parity test
- Direct read: `jest.config.js`, `package.json` — test runner command, existing dependency versions

### Secondary (MEDIUM confidence)
- None needed — all critical facts sourced directly from codebase

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, versions confirmed from package.json
- Architecture: HIGH — patterns sourced directly from existing working code
- Pitfalls: HIGH — identified from direct code analysis (upsert overwrite, missing guard removal scope)
- Schema migration: HIGH — pattern established from 7 existing migration files

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable codebase, no fast-moving dependencies)

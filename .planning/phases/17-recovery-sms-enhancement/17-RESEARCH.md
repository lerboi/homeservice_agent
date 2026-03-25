# Phase 17: Recovery SMS Enhancement - Research

**Researched:** 2026-03-25
**Domain:** Twilio SMS delivery, Supabase cron + schema migration, Next.js `after()`, i18n pattern
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Only `booking_outcome = 'attempted'` triggers recovery SMS from the new real-time path. Covers callers who tried to book but the slot was taken during the call.
- **D-02:** `declined` does NOT trigger recovery SMS — respects the caller's explicit choice not to book.
- **D-03:** `not_attempted` stays handled by the existing cron-based recovery SMS (Phase 4 infrastructure) — no change to that trigger logic.
- **D-04:** Real-time trigger fires from the webhook handler via `after()` immediately when `atomicBookSlot` fails and caller gets the "slot taken" response. Matches Phase 15 caller SMS pattern. Meets <60s delivery requirement.
- **D-05:** Existing cron-based recovery SMS (`/api/cron/send-recovery-sms`) is ALSO updated with urgency-aware content and delivery failure logging for consistency across both paths.
- **D-06:** Emergency recovery SMS uses empathetic urgency — warm and understanding, NOT alarm-bell tone. Example: "We understand your situation is time-sensitive" rather than "URGENT" or "EMERGENCY" prefix.
- **D-07:** Routine recovery SMS uses standard warm tone: "We're sorry we couldn't book your appointment. We'll be in touch shortly."
- **D-08:** Multi-language (en/es) matching Phase 15 pattern — uses `detected_language` from call record, defaults to `en`. i18n via JSON translation files consistent with `sendCallerSMS()`.
- **D-09:** Recovery SMS is empathy-first with NO booking link or callback number. Message acknowledges the failed booking and signals the business will follow up.
- **D-10:** SMS content function accepts an optional `bookingLink` parameter that's unused for now — placeholder for future upgrade.
- **D-11:** Exponential backoff retry — 3 attempts total at ~30s, ~2min, ~5min intervals.
- **D-12:** Retry logic lives in the database + cron, NOT in-process setTimeout. First attempt fires from webhook `after()` or existing cron. On failure, status is written to DB. Cron picks up failed records and retries with backoff counter.
- **D-13:** New `recovery_sms_status` tracking on calls table: status (pending/sent/failed/retrying), retry_count, last_error (Twilio error code + message), last_attempt_at.
- **D-14:** After 3 failed attempts, status is set to `failed` permanently. No further retries.

### Claude's Discretion

- Schema migration approach (new columns on calls table vs separate sms_log table)
- Exact backoff timing (approximate targets: 30s, 2min, 5min)
- Whether to extend the existing cron endpoint or create a new retry-specific cron
- i18n template structure (inline vs translation file entries)
- Emergency vs routine tone exact copy (within the "empathetic urgency, not alarm-bell" constraint)

### Deferred Ideas (OUT OF SCOPE)

- **SMS chatbot for booking via text** — Significant new capability: inbound SMS webhook, conversational state machine, text-based slot selection. Future phase.
- **Dashboard SMS log** — Business owners can see all outbound SMS in dashboard lead detail view. Must-have capability, do NEXT after Phase 17.
- **Public booking page** — Hosted booking page per tenant so recovery SMS can link to self-service booking. Future phase.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RECOVER-01 | Every call path where booking fails triggers recovery SMS with manual booking link within 60 seconds | D-04 real-time `after()` path delivers within the call response cycle. Verified: `after()` is already used in `handleBookAppointment` at lines 411-416 of route.js for the `attempted` outcome write. Adding SMS dispatch in the same `after()` block achieves <60s. |
| RECOVER-02 | Recovery SMS includes urgency-aware content (emergency recovery is more urgent in tone than routine) | D-06/D-07/D-08 define the content split. `urgency_classification` is already stored on `calls` table from `processCallAnalyzed`. For the real-time path, `args.urgency` is passed to `atomicBookSlot` and available in `handleBookAppointment` scope. For the cron path, join to calls/appointments gives urgency. |
| RECOVER-03 | Recovery SMS delivery failures are logged and retried, not silently swallowed | D-11 through D-14 define the retry schema and cron strategy. New columns on `calls` table + cron retry loop with backoff arithmetic replaces the current fire-and-forget catch block. |
</phase_requirements>

---

## Summary

Phase 17 is a targeted enhancement to an already-functional notification subsystem. The project already has `sendCallerRecoverySMS()` in `notifications.js`, a working cron endpoint at `/api/cron/send-recovery-sms/route.js`, and the `recovery_sms_sent_at` column on the calls table. The gap is threefold: (1) the real-time `attempted` booking path has no recovery SMS trigger at all — it only writes `booking_outcome: 'attempted'` and returns the slot-taken speech to the caller, (2) neither the existing function nor the cron are urgency-aware, and (3) SMS delivery failures are silently swallowed in a bare `catch` block with no retry.

The implementation splits into four well-scoped units: (a) a new `sendCallerRecoverySMS` overhaul in `notifications.js` that adds urgency-aware content branches, i18n support, and a structured return value; (b) a new schema migration adding four tracking columns to the `calls` table (`recovery_sms_status`, `recovery_sms_retry_count`, `recovery_sms_last_error`, `recovery_sms_last_attempt_at`); (c) injection of a recovery SMS `after()` call into the `handleBookAppointment` slot-taken failure branch in the webhook handler; and (d) update to the existing cron endpoint to use the new content function, write delivery status, and retry failed records with exponential backoff.

All patterns are established in the codebase. The `after()` non-blocking dispatch pattern is used throughout the webhook handler. The i18n `interpolate()` + JSON import pattern is established by `sendCallerSMS()`. The cron authorization pattern with `CRON_SECRET` is established. The Supabase `upsert` with `onConflict: 'retell_call_id'` pattern is pervasive. No new dependencies are needed.

**Primary recommendation:** Add four columns to `calls` table via migration 009, overhaul `sendCallerRecoverySMS` for urgency-aware i18n content with structured return, wire the real-time trigger into `handleBookAppointment`, and update the cron to handle both first-send (not_attempted path) and retry (retrying path) with backoff arithmetic.

---

## Standard Stack

### Core (all already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `twilio` | existing | SMS delivery via Twilio Messages API | Already used by all notification functions; `getTwilioClient()` lazy-init already present |
| `@supabase/supabase-js` | existing | DB reads/writes for retry tracking | All data access already via this client |
| `next/server` `after()` | Next.js 15 | Non-blocking async post-response execution | Established pattern in webhook handler for calendar push, booking outcome writes, and caller SMS |

### No New Dependencies

All libraries needed for this phase are already present in the project. The retry/backoff system uses only arithmetic and Supabase column writes — no external queue or job scheduler.

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure (changes only)

```
src/
├── lib/
│   └── notifications.js         # Overhaul sendCallerRecoverySMS — urgency-aware, i18n, returns { success, sid, error }
├── app/api/
│   └── cron/send-recovery-sms/
│       └── route.js             # Updated: urgency-aware content, delivery status write, retry loop
supabase/migrations/
└── 009_recovery_sms_tracking.sql  # Four new columns on calls table
messages/
├── en.json                      # Add notifications.recovery_sms_attempted_routine + recovery_sms_attempted_emergency
└── es.json                      # Same keys in Spanish
tests/notifications/
└── caller-recovery.test.js      # Expand: urgency branching, i18n, return value, retry status write
tests/call-processor/
└── recovery-sms-trigger.test.js # New: real-time trigger in handleBookAppointment slot-taken path
```

### Pattern 1: Urgency-Aware sendCallerRecoverySMS with Structured Return

The existing function is fire-and-forget with no return value. Phase 17 requires it to return a structured result so the cron can write delivery status.

**What:** Refactor `sendCallerRecoverySMS` to accept `urgency` and `locale`, use i18n templates for content, and return `{ success: boolean, sid?: string, error?: { code, message } }` instead of `result | undefined`.

**When to use:** Both the real-time webhook `after()` path and the cron path call this function. They both need the delivery result.

```javascript
// Source: established pattern from sendCallerSMS() in notifications.js (lines 162-187)
export async function sendCallerRecoverySMS({
  to,
  callerName,
  businessName,
  locale,        // NEW — 'en' | 'es', defaults to 'en'
  urgency,       // NEW — 'emergency' | 'routine' | 'high_ticket', defaults to 'routine'
  bookingLink,   // D-10: accepted but unused for now (placeholder for future upgrade)
}) {
  if (!to) {
    console.warn('[notifications] sendCallerRecoverySMS skipped: no phone number');
    return { success: false, error: { code: 'NO_PHONE', message: 'No phone number provided' } };
  }

  const translations = locale === 'es' ? es : en;
  const isEmergency = urgency === 'emergency';
  const firstName = callerName?.split(' ')[0] || 'there';

  // D-06: emergency = empathetic urgency (warm, time-sensitive acknowledgement)
  // D-07: routine = standard warm tone
  const templateKey = isEmergency
    ? 'recovery_sms_attempted_emergency'
    : 'recovery_sms_attempted_routine';

  const body = interpolate(translations.notifications[templateKey], {
    business_name: businessName || 'Your service provider',
    first_name: firstName,
  });

  try {
    const result = await getTwilioClient().messages.create({
      body,
      from: process.env.TWILIO_FROM_NUMBER,
      to,
    });
    console.log('[notifications] Caller recovery SMS sent:', result.sid);
    return { success: true, sid: result.sid };
  } catch (err) {
    const code = err?.code || 'UNKNOWN';
    const message = err?.message || String(err);
    console.error('[notifications] Caller recovery SMS failed:', message);
    return { success: false, error: { code, message } };
  }
}
```

### Pattern 2: i18n Template Keys for Recovery SMS

**What:** Add two template keys per language to `messages/en.json` and `messages/es.json` under the `notifications` section.

**When to use:** Both urgency content paths in `sendCallerRecoverySMS` need these.

```json
// messages/en.json — add to "notifications" section
"recovery_sms_attempted_routine": "Hi {first_name}, we're sorry we couldn't get your appointment booked with {business_name}. We'll be in touch to get you scheduled.",
"recovery_sms_attempted_emergency": "Hi {first_name}, we understand your situation is time-sensitive. The {business_name} team is aware and will reach out to you right away."

// messages/es.json — add to "notifications" section
"recovery_sms_attempted_routine": "Hola {first_name}, lamentamos no haber podido agendar tu cita con {business_name}. Nos pondremos en contacto para programarte.",
"recovery_sms_attempted_emergency": "Hola {first_name}, entendemos que tu situacion es urgente. El equipo de {business_name} esta al tanto y se comunicara contigo de inmediato."
```

### Pattern 3: Real-Time Recovery SMS Trigger via after()

**What:** In `handleBookAppointment`, the existing slot-taken branch already writes `booking_outcome: 'attempted'` via `after()` (lines 411-416 in route.js). Add a second `after()` call directly below to trigger the recovery SMS and write initial tracking state to DB.

**When to use:** Only when `atomicBookSlot` returns `{ success: false }`. The caller phone is `payload.call?.from_number`.

```javascript
// Source: established pattern from after() caller SMS at lines 445-454 in route.js
// Insert after the existing booking_outcome: 'attempted' after() block

after(async () => {
  // Fetch call details for locale and urgency context
  const { data: callRecord } = await supabase
    .from('calls')
    .select('detected_language, urgency_classification, from_number')
    .eq('retell_call_id', call_id)
    .maybeSingle();

  const locale = callRecord?.detected_language || tenant?.default_locale || 'en';
  const urgency = args.urgency || callRecord?.urgency_classification || 'routine';
  const callerPhone = payload.call?.from_number || callRecord?.from_number || null;

  // Write pending status before attempt
  await supabase.from('calls').upsert(
    {
      retell_call_id: call_id,
      recovery_sms_status: 'pending',
      recovery_sms_last_attempt_at: new Date().toISOString(),
    },
    { onConflict: 'retell_call_id' }
  );

  const deliveryResult = await sendCallerRecoverySMS({
    to: callerPhone,
    callerName: args.caller_name || null,
    businessName: tenant?.business_name || 'Your service provider',
    locale,
    urgency,
  });

  await supabase.from('calls').upsert(
    {
      retell_call_id: call_id,
      recovery_sms_status: deliveryResult.success ? 'sent' : 'retrying',
      recovery_sms_retry_count: deliveryResult.success ? 0 : 1,
      recovery_sms_last_error: deliveryResult.success
        ? null
        : `${deliveryResult.error.code}: ${deliveryResult.error.message}`,
      recovery_sms_last_attempt_at: new Date().toISOString(),
      recovery_sms_sent_at: deliveryResult.success ? new Date().toISOString() : null,
    },
    { onConflict: 'retell_call_id' }
  );
});
```

### Pattern 4: Schema — New Tracking Columns on calls Table

**What:** Migration 009 adds four columns to the `calls` table. Using columns on the existing `calls` table (not a new table) follows the project pattern established by 004 (`recovery_sms_sent_at`), 008 (`booking_outcome`, `notification_priority`).

**Discretion recommendation:** New columns on `calls` table (not a separate `sms_log` table). Rationale: the query pattern in the cron already selects from `calls`; adding a join to a new table adds complexity for no benefit at Phase 17 scale. A dedicated log table becomes appropriate when Phase 18+ adds the dashboard SMS log (deferred).

```sql
-- 009_recovery_sms_tracking.sql
ALTER TABLE calls
  ADD COLUMN recovery_sms_status text
    CHECK (recovery_sms_status IN ('pending', 'sent', 'failed', 'retrying')),
  ADD COLUMN recovery_sms_retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN recovery_sms_last_error text,
  ADD COLUMN recovery_sms_last_attempt_at timestamptz;

-- Index for cron query: find retrying records that are past their backoff window
CREATE INDEX idx_calls_recovery_sms_retry
  ON calls(tenant_id, recovery_sms_status, recovery_sms_last_attempt_at)
  WHERE recovery_sms_status = 'retrying';
```

### Pattern 5: Cron Retry Loop with Backoff

**What:** Update the existing cron at `/api/cron/send-recovery-sms/route.js` to handle two query branches: (A) the existing `not_attempted` first-send path, and (B) a new `retrying` path for records that need a retry with backoff.

**Discretion recommendation:** Extend the existing cron endpoint (not a new cron). A single cron file with two query branches is cleaner than two separate cron entries in `vercel.json`. Cron already runs every minute — sufficient for the ~30s backoff window.

**Backoff arithmetic (exact timings are Claude's discretion per D-11 target of ~30s, ~2min, ~5min):**

| Attempt | `retry_count` before attempt | Min elapsed since `last_attempt_at` |
|---------|------------------------------|--------------------------------------|
| 2nd     | 1                            | 30 seconds                           |
| 3rd     | 2                            | 120 seconds                          |
| Final failure | 3 (set to 'failed') | — |

```javascript
// Source: established cron pattern from send-recovery-sms/route.js
// Retry branch — append to existing cron handler

// Branch B: retry records that failed on first attempt
const BACKOFF_SECONDS = [30, 120]; // 30s before 2nd attempt, 2min before 3rd
const retryResults = await supabase
  .from('calls')
  .select('id, retell_call_id, from_number, tenant_id, detected_language, urgency_classification, recovery_sms_retry_count, recovery_sms_last_attempt_at, retell_metadata')
  .eq('recovery_sms_status', 'retrying')
  .lt('recovery_sms_retry_count', 3)  // D-14: max 3 total attempts
  .not('from_number', 'is', null)
  .limit(10);

for (const call of retryResults.data || []) {
  const retryCount = call.recovery_sms_retry_count || 1; // already attempted once
  const backoffSecs = BACKOFF_SECONDS[retryCount - 1] || 120;
  const lastAttempt = new Date(call.recovery_sms_last_attempt_at).getTime();
  const elapsedSecs = (Date.now() - lastAttempt) / 1000;

  if (elapsedSecs < backoffSecs) continue; // Not yet due

  const tenant = await getTenant(call.tenant_id);
  if (!tenant) continue;

  await supabase.from('calls')
    .update({ recovery_sms_last_attempt_at: new Date().toISOString() })
    .eq('id', call.id);

  const deliveryResult = await sendCallerRecoverySMS({ /* ... */ });
  const nextRetryCount = retryCount + 1;

  if (deliveryResult.success) {
    await supabase.from('calls').update({
      recovery_sms_status: 'sent',
      recovery_sms_sent_at: new Date().toISOString(),
      recovery_sms_last_error: null,
    }).eq('id', call.id);
  } else if (nextRetryCount >= 3) {
    // D-14: exhausted all attempts
    await supabase.from('calls').update({
      recovery_sms_status: 'failed',
      recovery_sms_retry_count: nextRetryCount,
      recovery_sms_last_error: `${deliveryResult.error.code}: ${deliveryResult.error.message}`,
    }).eq('id', call.id);
  } else {
    await supabase.from('calls').update({
      recovery_sms_status: 'retrying',
      recovery_sms_retry_count: nextRetryCount,
      recovery_sms_last_error: `${deliveryResult.error.code}: ${deliveryResult.error.message}`,
    }).eq('id', call.id);
  }
}
```

### Anti-Patterns to Avoid

- **Fire-and-forget with no return value:** The current `sendCallerRecoverySMS` swallows errors in a catch block. Phase 17 requires a structured return so callers can write delivery status to DB.
- **In-process setTimeout for retry:** D-12 explicitly prohibits this. Serverless functions can die between the first failed attempt and the next retry. Use the DB + cron pattern.
- **Overwriting real-time `booking_outcome`:** The `after()` block that writes tracking state must use `upsert` with `onConflict: 'retell_call_id'` and only write the new tracking columns — never touch `booking_outcome`.
- **Querying `calls.urgency_classification` from the real-time path:** During `handleBookAppointment`, `processCallAnalyzed` has not run yet so `urgency_classification` is likely null. Use `args.urgency` (passed by the AI to the `book_appointment` tool) as the authoritative source for the real-time path.
- **Triggering recovery SMS for `declined` outcome:** D-02 is locked — `declined` must never trigger recovery. The real-time path only fires in the slot-taken `!result.success` branch; the cron path gates on `not_attempted` and `retrying`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Retry persistence | In-process setTimeout or Redis TTL | DB column `recovery_sms_status` + cron | Serverless functions don't survive between invocations. DB state persists regardless of function lifecycle. |
| Backoff calculation | Custom scheduler / job queue (Bull, pg-boss) | Arithmetic on `last_attempt_at` in existing cron | Project already runs a every-minute Vercel cron. No new infrastructure justified for 3-attempt retry at this scale. |
| SMS status tracking | Separate `sms_log` table | New columns on existing `calls` table | Phase 17 scope only tracks recovery SMS for `attempted` calls. Cron query already selects from `calls`. Dashboard SMS log is explicitly deferred. |
| Multi-language content | New i18n framework | Existing `interpolate()` + JSON import pattern | Already established by `sendCallerSMS()`. All translation keys live in `messages/en.json` and `messages/es.json`. |

**Key insight:** The retry infrastructure is purely arithmetic state stored in Postgres — no queue library, no separate service. The same cron that already runs every minute to find missed calls can also check for failed recovery SMS records past their backoff window.

---

## Common Pitfalls

### Pitfall 1: Real-Time Path Has No urgency_classification Yet
**What goes wrong:** `handleBookAppointment` fires during the live call. `processCallAnalyzed` (which writes `urgency_classification` to the calls table) doesn't fire until minutes after the call ends. Querying `calls.urgency_classification` at this point returns `null`.
**Why it happens:** The webhook event order is: `call_function_invoked` (live) → `call_ended` → `call_analyzed`. The real-time path is triggered on `call_function_invoked`.
**How to avoid:** Use `args.urgency` from the AI's `book_appointment` tool invocation as the urgency source in `handleBookAppointment`. This is the value the AI already classified during the conversation and passed as a parameter.
**Warning signs:** Recovery SMS always uses routine tone even for emergency calls.

### Pitfall 2: Cron Urgency Lookup Requires Additional Join
**What goes wrong:** The existing cron does not select `urgency_classification` from the calls table in its initial query.
**Why it happens:** Phase 4 cron predates the `urgency_classification` column (added in Phase 15).
**How to avoid:** Add `urgency_classification, detected_language` to the cron `select()` query so no additional DB round-trip is needed inside the loop.
**Warning signs:** All recovery SMSes sent by cron use routine tone regardless of urgency.

### Pitfall 3: booking_outcome 'attempted' Written Separately from SMS Dispatch
**What goes wrong:** The `booking_outcome: 'attempted'` write and the recovery SMS `after()` are two separate `after()` blocks. The planner must keep them distinct — the outcome write is simple, the SMS dispatch needs tenant data and locale context that may require additional queries.
**Why it happens:** Natural tendency to merge both into one `after()` block, but the SMS dispatch requires tenant fields (`business_name`, `default_locale`) that require a separate query.
**How to avoid:** Keep the two `after()` blocks separate. The existing `booking_outcome` write at lines 411-416 is already correct — add a new `after()` block after it for SMS dispatch.
**Warning signs:** Linter or runtime error from undefined `tenant` in the outcome write block.

### Pitfall 4: Cron Processes Calls With booking_outcome Already Excluding 'attempted'
**What goes wrong:** The existing cron filters only by `status='analyzed'` and `recovery_sms_sent_at IS NULL`. After Phase 17, `attempted` calls will also have `recovery_sms_sent_at` set by the real-time path — but only when delivery succeeds. Failed real-time attempts set `recovery_sms_status='retrying'`, NOT `recovery_sms_sent_at`. The cron's existing query could accidentally pick up `attempted` calls with `recovery_sms_sent_at IS NULL` (failed first attempt) and try to send a second copy instead of using the retry path.
**Why it happens:** The existing cron was designed for `not_attempted` calls only (Phase 4). It has no awareness of `recovery_sms_status`.
**How to avoid:** The cron's first-send branch (for `not_attempted`) should add a filter: `booking_outcome = 'not_attempted'` (or `booking_outcome IS NULL` for legacy pre-Phase-15 records). The retry branch handles `retrying` status separately. This prevents double-processing of `attempted` calls with failed first SMS.
**Warning signs:** Duplicate recovery SMS sent to caller; cron processing `attempted` calls through the first-send path.

### Pitfall 5: Locale Query Ordering in Real-Time Path
**What goes wrong:** In `handleBookAppointment`, the caller's `detected_language` is not reliably set at the time the slot-taken branch fires. The call may not have been processed yet. Querying `calls.detected_language` at this point is unreliable.
**Why it happens:** `detected_language` is set during `processCallAnalyzed` which runs post-call.
**How to avoid:** Use `tenant.default_locale` as the locale source in the real-time path. The tenant is already fetched in `handleBookAppointment` at the top of the function. This is consistent with the `sendCallerSMS` call at line 443 which uses `callLang?.detected_language || tenant?.default_locale || 'en'`. The locale query in the real-time path should similarly fallback: `detected_language` from a quick calls lookup → `tenant.default_locale` → `'en'`.
**Warning signs:** All real-time recovery SMS sent in English regardless of tenant default locale.

### Pitfall 6: retry_count Semantics
**What goes wrong:** `retry_count` is used ambiguously — does it count "number of retries attempted" or "total attempts including the first"?
**Why it happens:** Naming ambiguity between "attempt count" and "retry count".
**How to avoid:** Use `retry_count` to mean "number of retry attempts after the first" (i.e., 0 = first attempt made, 1 = one retry made, 2 = two retries made, 3 = failed permanently). The backoff array index is `retry_count - 1` when reading from the DB because `retry_count` will be 1 when the first retry is due. Document this in the column definition.
**Warning signs:** Off-by-one error causing the 3rd attempt to be skipped or the 4th attempt to fire.

---

## Code Examples

### Existing `after()` Pattern for Async Post-Response Work

```javascript
// Source: src/app/api/webhooks/retell/route.js lines 411-416
// This is the exact location where the real-time recovery SMS trigger is inserted

// Real-time booking_outcome write — attempted (D-02)
after(async () => {
  await supabase.from('calls').upsert(
    { retell_call_id: call_id, booking_outcome: 'attempted' },
    { onConflict: 'retell_call_id' }
  );
});

// INSERT NEW after() BLOCK IMMEDIATELY BELOW THIS ONE
// (real-time recovery SMS trigger for Phase 17)
```

### Existing sendCallerSMS i18n Pattern (the template to follow)

```javascript
// Source: src/lib/notifications.js lines 162-187
// sendCallerSMS uses this exact pattern — sendCallerRecoverySMS should match it
export async function sendCallerSMS({ to, businessName, date, time, address, locale }) {
  const translations = locale === 'es' ? es : en;
  const body = interpolate(translations.notifications.booking_confirmation, {
    business_name: businessName || 'Your service provider',
    date: date || '',
    time: time || '',
    address: address || '',
  });
  // ...
}
```

### Existing Cron Authorization Pattern

```javascript
// Source: src/app/api/cron/send-recovery-sms/route.js lines 22-27
// All cron routes use this authorization pattern — must be preserved in updates
export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ...
}
```

### Existing Supabase Upsert with Conflict Key

```javascript
// Source: multiple locations in route.js — the standard update pattern
await supabase.from('calls').upsert(
  { retell_call_id: call_id, /* new fields */ },
  { onConflict: 'retell_call_id' }
);
```

### Existing Test Mock Pattern for notifications.js

```javascript
// Source: tests/notifications/caller-sms.test.js lines 11-16
// All notification tests use this same inline mock pattern
const mockCreate = jest.fn().mockResolvedValue({ sid: 'SM_test_123' });
jest.unstable_mockModule('twilio', () => ({
  default: jest.fn(() => ({
    messages: { create: mockCreate },
  })),
}));
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fire-and-forget recovery SMS (NOTIF-03) | Tracked delivery with retry state | Phase 17 | Recovery SMS failures become observable and retryable |
| Generic warm recovery tone | Urgency-aware empathetic content | Phase 17 | Emergency callers receive time-sensitive acknowledgement; routine callers receive standard warmth |
| Single recovery trigger (cron only) | Dual trigger: real-time `after()` for `attempted` + cron for `not_attempted` | Phase 17 | `attempted` callers receive SMS within seconds of the slot-taken response, not after 60+ second cron delay |
| `sendCallerRecoverySMS` no return value | Returns `{ success, sid, error }` | Phase 17 | Callers of the function can branch on delivery success/failure |

**Deprecated/outdated in this phase:**
- `sendCallerRecoverySMS` fire-and-forget pattern: replaced by structured-return version. Old test assertions against the current body content (booking link, callback phone) will break and must be updated — the new content has no link or phone per D-09.

---

## Open Questions

1. **Locale for real-time path**
   - What we know: `detected_language` is set post-call; `args.urgency` is available during live call.
   - What's unclear: Should the real-time path skip the `calls` locale query entirely and use only `tenant.default_locale`? Or do a fast `SELECT detected_language FROM calls WHERE retell_call_id=...` inside the `after()` block?
   - Recommendation: Do the fast `calls.detected_language` query inside the `after()` block (same pattern used for caller SMS confirmation at lines 440-443 in route.js). Fall back to `tenant.default_locale || 'en'` if null. The query is cheap and already exists in the codebase.

2. **Cron: one endpoint or two**
   - What we know: D-12 says retry logic lives in DB + cron. The existing cron runs every minute.
   - What's unclear: Should the retry branch be a second query in the existing cron, or a new `/api/cron/retry-recovery-sms` endpoint?
   - Recommendation: Extend the existing cron with a second query branch (Branch A: first-send for `not_attempted`, Branch B: retry for `retrying`). Adding a second Vercel cron entry for a closely related concern adds scheduling complexity for no benefit. One file, two branches, one cron schedule.

3. **TCPA compliance flag in STATE.md**
   - What we know: STATE.md blockers list: "TCPA compliance for recovery SMS to numbers without explicit opt-in — legal review needed before go-live."
   - What's unclear: Does this block Phase 17 implementation or only production deployment?
   - Recommendation: Implement the feature; flag in the PLAN as a "legal review required before production deployment" note. This is consistent with how Phase 5 TCPA concern was handled (noted, not blocking implementation).

---

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies — this phase uses only Twilio, Supabase, and `after()`, all of which are already integrated and verified in production).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (node --experimental-vm-modules) |
| Config file | `jest.config.js` at project root |
| Quick run command | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests tests/notifications/ tests/call-processor/` |
| Full suite command | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RECOVER-01 | Recovery SMS fires within `after()` when `atomicBookSlot` fails (slot_taken) | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/call-processor/recovery-sms-trigger.test.js -x` | ❌ Wave 0 |
| RECOVER-02 | Emergency urgency produces empathetic-urgency body; routine produces standard warm body | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/notifications/caller-recovery.test.js -x` | ✅ (requires expansion) |
| RECOVER-02 | Spanish locale produces Spanish body for both urgency branches | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/notifications/caller-recovery.test.js -x` | ✅ (requires expansion) |
| RECOVER-03 | Failed SMS delivery writes `recovery_sms_status: 'retrying'` and error to DB | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/notifications/caller-recovery.test.js -x` | ✅ (requires expansion) |
| RECOVER-03 | Cron retry branch skips records not yet past backoff window | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/cron/recovery-sms-retry.test.js -x` | ❌ Wave 0 |
| RECOVER-03 | After 3 failed attempts status is set to 'failed' permanently | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/cron/recovery-sms-retry.test.js -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/notifications/ -x --passWithNoTests`
- **Per wave merge:** `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/call-processor/recovery-sms-trigger.test.js` — covers RECOVER-01: verifies `after()` is called in slot-taken branch of `handleBookAppointment`
- [ ] `tests/cron/recovery-sms-retry.test.js` — covers RECOVER-03: verifies backoff window check, retry count increment, permanent failure after 3 attempts
- [ ] `tests/notifications/caller-recovery.test.js` — existing file needs expanded tests for: urgency branching, i18n, structured return value, null guard behavior

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies To |
|-----------|-----------|
| When making changes to any file in the voice-call-architecture File Map, update the `voice-call-architecture` SKILL.md to reflect new behavior | Phase 17 modifies `notifications.js`, `route.js` (webhook), `send-recovery-sms/route.js` — skill file must be updated after implementation |
| Skill files are living documents; keep them accurate and in sync with actual codebase | SKILL.md section 8 (Notification System) and the Flow D description need updating for urgency-aware recovery SMS |

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection: `src/lib/notifications.js` — existing `sendCallerRecoverySMS()`, `sendCallerSMS()` i18n pattern, `interpolate()` helper, `getTwilioClient()` lazy-init
- Direct code inspection: `src/app/api/webhooks/retell/route.js` — `handleBookAppointment()` slot-taken branch (lines 390-420), `after()` usage patterns, locale query at lines 440-443
- Direct code inspection: `src/app/api/cron/send-recovery-sms/route.js` — existing query structure, loop pattern, cron auth pattern
- Direct code inspection: `supabase/migrations/004_leads_crm.sql` — `recovery_sms_sent_at` column pattern
- Direct code inspection: `supabase/migrations/008_call_outcomes.sql` — migration style: `ALTER TABLE calls ADD COLUMN` with CHECK constraints and indexes
- Direct code inspection: `messages/en.json` + `messages/es.json` — existing `notifications.booking_confirmation` template key and `{placeholder}` interpolation style
- Direct code inspection: `tests/notifications/caller-recovery.test.js` — existing test structure for `sendCallerRecoverySMS`; `jest.unstable_mockModule` ESM mock pattern
- Direct code inspection: `src/lib/call-processor.js` — `processCallAnalyzed` pipeline; `booking_outcome` conditional update pattern
- Direct code inspection: `.claude/skills/voice-call-architecture/SKILL.md` — complete architectural reference; all integration points confirmed

### Secondary (MEDIUM confidence)

- `.planning/phases/17-recovery-sms-enhancement/17-CONTEXT.md` — all locked decisions and implementation specifics; cross-referenced against actual code

### Tertiary (LOW confidence)

- None. All findings are verified against actual codebase files.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; no new dependencies required
- Architecture patterns: HIGH — all patterns derived from existing code; no new paradigms
- Pitfalls: HIGH — identified from direct code inspection of integration points; not speculative

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable codebase; primary risk is unmerged changes to notifications.js or route.js from parallel work)

# Phase 18: Booking-First Hardening and QA - Research

**Researched:** 2026-03-25
**Domain:** QA / Integration Testing / Error Monitoring (Jest, Sentry, manual test scripts)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**E2E Validation (HARDEN-01)**
- D-01: Manual test script approach — detailed step-by-step checklist that a human reviewer follows. No automated E2E framework (Playwright/Cypress) introduced.
- D-02: Two test scripts — English baseline + Spanish multi-language. English validates the booking-first happy path, Spanish validates multi-language end-to-end per HARDEN-01.
- D-03: Each script covers the full flow: trigger Retell call → AI books appointment → caller receives SMS confirmation (in correct language) → owner receives notification. Pass/fail criteria for each step.

**Concurrency QA (HARDEN-02)**
- D-04: Jest integration test with real Supabase — fires 20 parallel `Promise.all` calls to `atomicBookSlot` against a real database. Asserts exactly 1 success + 19 `{ success: false, reason: 'slot_taken' }` results. Zero double-bookings.
- D-05: Separate `tests/integration/` directory — only runs when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars are set. Regular `npm test` skips it. Prevents CI failures without credentials.
- D-06: Test creates its own test tenant and time slot, runs contention, then cleans up. Self-contained, idempotent.

**Onboarding Gate Revalidation (HARDEN-03)**
- D-07: Test call AI attempts booking during the call — owner experiences the booking-first flow firsthand. The AI treats the owner as a real caller and tries to book an appointment.
- D-08: Auto-cancel test bookings — any booking created during a test call (identifiable by test_call flag or originating from test-call API route) is automatically cancelled after the call ends. Owner sees the flow but calendar stays clean.
- D-09: Manual test script — step-by-step checklist: create new account, complete wizard, trigger test call, verify AI attempts booking, verify under 5 minutes total. Human reviewer times it.

**Sentry Error Monitoring (HARDEN-04)**
- D-10: Next.js + API routes only — install `@sentry/nextjs`, configure for server-side API route error capture. No client-side error boundary for dashboard (internal tool). Catches unhandled exceptions in webhook handlers, cron jobs, and API routes.
- D-11: Hidden test error endpoint — `POST /api/debug/test-error` protected by secret header or non-production env check. Throws an unhandled error on demand. Used to verify Sentry captures within 60 seconds.
- D-12: No WebSocket server Sentry integration — the standalone Railway WebSocket server is out of scope for this phase. Only the Next.js app gets Sentry.

### Claude's Discretion
- Sentry DSN configuration approach (env var naming, `sentry.client.config.js` vs `sentry.server.config.js` structure)
- Test script file format and location (markdown in `.planning/` or in `tests/manual/`)
- Concurrency test cleanup strategy (DELETE test data after assertions)
- Auto-cancel mechanism for test bookings (webhook handler check vs post-call processor)
- Whether to add a `test:integration` script to package.json

### Deferred Ideas (OUT OF SCOPE)
- Client-side Sentry error boundary for dashboard — defer until dashboard is customer-facing
- WebSocket server Sentry integration — separate deployment, separate monitoring concern
- Automated E2E with Playwright — defer until test matrix grows beyond manual feasibility
- k6 load testing for sustained traffic simulation — defer until production traffic patterns known
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HARDEN-01 | Spanish-language caller books autonomously, receives Spanish confirmation SMS, owner gets notification — validated E2E | Manual test scripts covering full flow; `sendCallerSMS` locale path confirmed correct for `es`; `messages/es.json` booking_confirmation key verified present |
| HARDEN-02 | 20 simultaneous booking requests to same slot produce exactly 1 confirmed booking and 19 next-available offers | `atomicBookSlot` wraps `book_appointment_atomic` RPC (Postgres advisory lock); Jest `Promise.all` pattern confirmed; integration test isolation via `SUPABASE_URL` env guard |
| HARDEN-03 | Non-technical SME owner completes onboarding wizard and hears AI in under 5 minutes — revalidated for booking-first | `test-call/route.js` identified; `test_call: true` dynamic variable addition is the hook; auto-cancel logic targets webhook handler or call-processor post-call path |
| HARDEN-04 | Unhandled exceptions and API failures trigger Sentry alert with full stack trace within 60 seconds | `@sentry/nextjs` v9.47.1 confirmed; `instrumentation.ts` + `sentry.server.config.js` + `withSentryConfig` in `next.config.js`; hidden test endpoint pattern documented |
</phase_requirements>

---

## Summary

Phase 18 is a pure QA/hardening phase with four workstreams: manual E2E test scripts, Jest integration tests for concurrency, onboarding revalidation, and Sentry setup. No new product features are introduced — only validation artifacts, test infrastructure, and monitoring plumbing.

The codebase is well-positioned for this phase. The `atomicBookSlot` wrapper and Postgres advisory lock are confirmed working from Phase 3. Multi-language SMS uses `sendCallerSMS` with an `es`/`en` locale branch that reads from `messages/es.json` — the `booking_confirmation` key is present and correct. The onboarding test-call route needs a single `test_call: true` flag added to the Retell dynamic variables, then post-call auto-cancel hooks into either the webhook handler's `call_ended`/`call_analyzed` branch or `call-processor.js`. Sentry setup is the heaviest new dependency but is well-documented and follows a minimal three-file pattern.

**Primary recommendation:** Attack in order — Sentry first (it's additive, no existing code changes), then concurrency test (self-contained), then test scripts (documentation), then onboarding auto-cancel last (requires code change to live call path).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@sentry/nextjs` | 9.47.1 (latest stable) | Error monitoring for Next.js API routes | Official Sentry SDK for Next.js App Router; `onRequestError` hook captures unhandled exceptions from server components and API routes automatically |
| Jest 29 (existing) | 29.7.0 | Integration test runner for concurrency QA | Already installed; uses `--experimental-vm-modules` for ESM; pattern established across 50+ tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` (existing) | existing | Real Supabase client for integration tests | Integration test must use real DB — mock won't exercise advisory lock. Use `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` directly (not the `@/lib/supabase.js` module which uses anon key) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@sentry/nextjs` v9 | v8 | v9 is latest stable (10.45.0 on npm, v9 tag = 9.47.1). v9 required for `onRequestError` hook support. No reason to use v8. |
| Real Supabase in integration test | Supabase local dev stack | Local stack requires Docker and Supabase CLI. Real staging DB is simpler and tests the actual production RPC function. |
| Jest for integration test | Vitest | Jest is already the project test runner. No reason to introduce a second framework. |

**Installation:**
```bash
npm install @sentry/nextjs
```

**Version verification:** Confirmed via npm registry 2026-03-25:
- `@sentry/nextjs` latest stable: `9.47.1` (v9 dist-tag). `npm view @sentry/nextjs version` returns `10.45.0` (next/beta track). Use v9 (`9.47.1`) for stability.

```bash
npm install @sentry/nextjs@9
```

---

## Architecture Patterns

### Sentry Setup — Three Required Files

**Confirmed from official Sentry docs (manual-setup).**

**File 1: `sentry.server.config.js`** (project root)
```js
// Source: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions
  sendDefaultPii: false, // no PII in production
});
```

**File 2: `instrumentation.js`** (project root — Next.js App Router instrumentation hook)
```js
// Source: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
}

export { onRequestError } from '@sentry/nextjs';
```

**File 3: `next.config.js`** — wrap existing config with `withSentryConfig`
```js
// Source: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.js');
const nextConfig = {
  allowedDevOrigins: ['192.168.10.148'],
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true, // suppress source map upload noise in local dev
  disableLogger: true,
});
```

**Note on client config (D-10):** D-10 says no client-side Sentry. Do NOT create `instrumentation-client.js` or `sentry.client.config.js`. Server-side only.

### Hidden Test Error Endpoint (D-11)

**File: `src/app/api/debug/test-error/route.js`**

Pattern: guard by `NODE_ENV !== 'production'` OR secret header check. Secret header is more flexible (allows testing in staging/production without deploying code).

```js
export async function POST(request) {
  // Only allow in non-production OR with SENTRY_TEST_SECRET header
  const authHeader = request.headers.get('x-sentry-test-secret');
  const isNonProd = process.env.NODE_ENV !== 'production';

  if (!isNonProd && authHeader !== process.env.SENTRY_TEST_SECRET) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Throw to verify Sentry captures this
  throw new Error('Deliberate Sentry test error — Phase 18 HARDEN-04 validation');
}
```

Return the Sentry event ID via `Sentry.captureException` + `Sentry.flush()` before returning so the reviewer can search for it in the dashboard (per CONTEXT.md specifics).

### Concurrency Integration Test — `tests/integration/`

**New directory.** Separate from regular unit tests. Only executes when Supabase credentials are set.

**Pattern (D-04, D-05, D-06):**
```js
// tests/integration/atomic-booking-contention.test.js
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

// Skip entire file if credentials not set
const hasCredentials =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;

const describeFn = hasCredentials ? describe : describe.skip;

describeFn('atomicBookSlot contention test (requires real Supabase)', () => {
  let supabase;
  let testTenantId;
  let testSlotStart;
  let testSlotEnd;

  beforeAll(async () => {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    // Create test tenant + time slot
    // ...
  });

  afterAll(async () => {
    // Clean up: DELETE appointments WHERE tenant_id = testTenantId
    // DELETE leads WHERE tenant_id = testTenantId
    // DELETE tenants WHERE id = testTenantId
  });

  test('exactly 1 of 20 concurrent requests succeeds, 19 get slot_taken', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        supabase.rpc('book_appointment_atomic', {
          p_tenant_id: testTenantId,
          p_call_id: null,
          p_start_time: testSlotStart.toISOString(),
          p_end_time: testSlotEnd.toISOString(),
          p_service_address: '123 Test St',
          p_caller_name: `Contention Test`,
          p_caller_phone: '+15551234567',
          p_urgency: 'routine',
          p_zone_id: null,
        })
      )
    );

    const successes = results.filter(r => r.data?.success === true);
    const failures = results.filter(r => r.data?.success === false && r.data?.reason === 'slot_taken');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(19);

    // Verify exactly 1 row in DB for this slot (advisory lock + UNIQUE constraint)
    const { data: rows } = await supabase
      .from('appointments')
      .select('id')
      .eq('tenant_id', testTenantId)
      .eq('start_time', testSlotStart.toISOString());
    expect(rows).toHaveLength(1);
  });
});
```

**Critical:** Call `supabase.rpc()` directly — do NOT import `atomicBookSlot` from `@/lib/booking.js` because that module uses the shared client from `@/lib/supabase.js` which uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Integration tests need service role key to bypass RLS.

**Note on jest.config.js:** Regular `npm test` runs `tests/**/*.test.js`. The integration test lives in `tests/integration/` which matches this pattern. The `describe.skip` guard handles credential absence. Alternatively, add `testPathIgnorePatterns: ['tests/integration']` to jest.config.js and a separate `test:integration` npm script — this is cleaner and prevents unintentional runs.

### Auto-Cancel Test Bookings (D-07, D-08)

**Mechanism:** Add `test_call: true` to Retell dynamic variables in `test-call/route.js`. In `call-processor.js` `processCallEnded()` (or `processCallAnalyzed()`), check for a test_call flag and cancel the appointment.

**Where to hook:** `processCallEnded` is the lighter handler (no triage/recording). Auto-cancel can live here — look up the test_call flag from calls metadata or from a newly added column. However, the `test_call` signal needs to reach the database first.

**Recommended flow:**
1. `test-call/route.js`: pass `test_call: 'true'` as a Retell dynamic variable
2. `call_inbound` webhook: if `test_call === 'true'`, include it in returned dynamic_variables and write it to the calls row (or store in `retell_metadata`)
3. `processCallEnded`: after upserting the call record, check `retell_metadata.test_call === 'true'`; if so, cancel any appointment for this call_id and the associated lead

**Alternative:** Use `retell_llm_dynamic_variables` metadata — the call payload includes whatever dynamic vars were set. The `processCallAnalyzed` call already receives `call.metadata`. So `metadata.test_call = 'true'` is accessible without a DB write at inbound time.

**Recommended: post-call processor path** (`processCallEnded`). The `call_ended` event fires immediately, call_analyzed fires minutes later. Auto-cancel at `call_ended` means the test calendar clears quickly.

### Manual Test Script Location

**Recommendation (Claude's discretion):** `tests/manual/` directory with `.md` files. Reasons:
- Keeps all test artifacts under `tests/`
- Avoids polluting `.planning/` with operational artifacts
- Easy to find for a human reviewer

Files: `tests/manual/e2e-english-booking.md`, `tests/manual/e2e-spanish-booking.md`, `tests/manual/onboarding-gate-revalidation.md`

### Anti-Patterns to Avoid

- **Using anon key in integration test:** The `book_appointment_atomic` RPC inserts appointment rows that are RLS-protected. Use service role key to bypass RLS in the integration test.
- **Importing `@/lib/supabase.js` in integration tests:** That module uses env vars from Next.js build context (NEXT_PUBLIC_*). Use `createClient()` directly with service role key.
- **Sentry client-side init:** D-10 is explicit — no `instrumentation-client.js`. Creating it will instrument the browser bundle unnecessarily for an internal tool.
- **Throwing in Sentry test endpoint without flush:** Sentry batches events. Without `await Sentry.flush(2000)` before returning a response, the event may not reach Sentry within the 60-second window.
- **Auto-cancel running during live call:** Auto-cancel must fire post-call only (`call_ended` or `call_analyzed` events). If it were to run during the call, the appointment created by `book_appointment` would be immediately deleted while the caller is still on the line.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API route error capture | Custom try/catch in every route | `@sentry/nextjs` `onRequestError` hook | Hooks into Next.js request lifecycle; catches errors even from routes without try/catch; sends stack traces automatically |
| Concurrency testing | Custom HTTP load tool or shell script | Jest `Promise.all` against real Supabase RPC | Jest already runs in the project; `Promise.all` generates true simultaneous async calls; simpler than a separate tool |
| Advisory lock correctness | Re-implementing lock logic | Test the RPC directly | The Postgres function already has the advisory lock + UNIQUE constraint. The test just proves they work under load. |

**Key insight:** This phase has almost nothing to hand-roll. The hard engineering work (advisory locks, i18n SMS, booking flow) is already shipped. The work here is connecting monitoring (Sentry), writing test fixtures (Jest integration), and writing checklists (manual scripts).

---

## Common Pitfalls

### Pitfall 1: Integration test hits the UNIQUE constraint instead of the advisory lock
**What goes wrong:** Postgres `UNIQUE (tenant_id, start_time)` constraint fires as a constraint violation before the advisory lock can return `slot_taken`. The test gets unhandled exceptions instead of 19 clean `{ success: false, reason: 'slot_taken' }` results.
**Why it happens:** The `book_appointment_atomic` RPC uses `pg_try_advisory_xact_lock` which is non-blocking — if the lock is taken, it returns `{ success: false }` gracefully. But if 2 requests slip through simultaneously (lock acquired by both), the UNIQUE constraint fires as an error on the second INSERT.
**How to avoid:** The RPC function is designed to handle this. Verify the RPC returns `{ success: false, reason: 'slot_taken' }` for UNIQUE violations too — check the actual SQL in `supabase/migrations/003_scheduling.sql`. If not, add an exception handler in the RPC. The integration test should assert `results.every(r => !r.error)` — no transport errors, only structured `{ success: false }` returns.
**Warning signs:** Test assertions fail because `results` contains Supabase errors (`.error` field non-null) rather than `{ data: { success: false } }`.

### Pitfall 2: `test_call` flag lost between test-call trigger and call_analyzed
**What goes wrong:** `test_call: true` passed as a Retell dynamic variable disappears by the time `processCallEnded` runs because the call payload in `call_ended`/`call_analyzed` events doesn't echo back dynamic variables.
**Why it happens:** Retell webhook events include a `call` object with `metadata` from the call, but the `retell_llm_dynamic_variables` passed at call creation are not necessarily echoed back in all event payloads.
**How to avoid:** At the `call_inbound` response, write `test_call: true` to the calls table when the inbound payload shows a test call OR use the tenant's `test_call_completed` upsert as a proxy. Alternatively, use a DB flag: when `test-call/route.js` triggers the call, set `tenants.last_test_call_retell_id = call.call_id` (returned by `retell.call.createPhoneCall()`). Then `processCallEnded` can check if `call_id` matches `last_test_call_retell_id`.
**Warning signs:** Auto-cancel never fires; test bookings accumulate in the calendar.

### Pitfall 3: Sentry event doesn't arrive within 60 seconds because of batching
**What goes wrong:** The `POST /api/debug/test-error` throws, but Sentry queues the event and flushes it later. The human reviewer checks Sentry at 60 seconds and sees nothing.
**Why it happens:** Sentry SDK batches events by default for performance. In a serverless/serverless-like environment (Vercel), the function may terminate before the batch flushes.
**How to avoid:** Call `await Sentry.flush(2000)` before the route handler exits. But since the route throws, wrap with try/catch: catch the error, call `Sentry.captureException(error)`, flush, then re-throw or return the event ID in the response.
**Warning signs:** Sentry dashboard shows no event after test throw; or event arrives minutes later.

### Pitfall 4: `describe.skip` guard for integration test causes misleading "0 tests" CI output
**What goes wrong:** When `SUPABASE_URL` is not set, `describe.skip` causes the entire test suite to report 0 tests run for that file, which may not be obvious in CI output.
**How to avoid:** Use `testPathIgnorePatterns: ['tests/integration']` in jest.config.js for the default `npm test`, and add a separate `test:integration` npm script that overrides this. This way the integration tests never appear in regular CI.
**Warning signs:** Regular `npm test` output shows `0 tests` for integration files, confusing future contributors.

### Pitfall 5: `withSentryConfig` wrapping breaks `withNextIntl` plugin chain
**What goes wrong:** Wrapping `withNextIntl(nextConfig)` inside `withSentryConfig()` may cause the Sentry webpack plugin to not apply correctly, or `withNextIntl` to not see the Sentry config.
**Why it happens:** Next.js config plugin chaining order matters. Each wrapper must receive the fully-transformed config from the inner plugin.
**How to avoid:** Chain as: `withSentryConfig(withNextIntl(nextConfig), sentryOptions)`. The outer wrapper (Sentry) sees the result of the inner wrapper (NextIntl). This is the correct order for build-time plugin composition.
**Warning signs:** Source maps not uploaded; Sentry webpack instrumentation warnings in build output.

### Pitfall 6: Auto-cancel deletes lead but not appointment (or vice versa)
**What goes wrong:** Post-call auto-cancel sets `appointments.status = 'cancelled'` but leaves the lead in `status: 'booked'`, creating a mismatch visible in the dashboard.
**How to avoid:** Auto-cancel must: (1) `UPDATE appointments SET status='cancelled' WHERE retell_call_id = call_id`, AND (2) `UPDATE leads SET status='new' WHERE appointment_id = appointmentId` (downgrade from booked back to new). Also: delete/nullify the `lead_calls` appointment reference if the lead was created solely by this test call.
**Warning signs:** Dashboard shows "booked" leads with no calendar appointment.

---

## Code Examples

### Sentry init — `sentry.server.config.js`
```js
// Source: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});
```

### `instrumentation.js` — Next.js App Router hook
```js
// Source: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
}

export { onRequestError } from '@sentry/nextjs';
```

### Test error endpoint — capture + flush + return event ID
```js
// src/app/api/debug/test-error/route.js
import * as Sentry from '@sentry/nextjs';

export async function POST(request) {
  const authHeader = request.headers.get('x-sentry-test-secret');
  const isNonProd = process.env.NODE_ENV !== 'production';

  if (!isNonProd && authHeader !== process.env.SENTRY_TEST_SECRET) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const error = new Error('Deliberate Sentry test error — HARDEN-04 validation');
  const eventId = Sentry.captureException(error);
  await Sentry.flush(2000); // ensure delivery before serverless function exits

  return Response.json({
    message: 'Error captured. Search Sentry for this event ID.',
    sentry_event_id: eventId,
  });
}
```

### Concurrency test — `Promise.all` contention pattern
```js
// tests/integration/atomic-booking-contention.test.js
// 20 simultaneous calls to the same slot RPC
const slotStart = new Date('2099-01-01T10:00:00.000Z'); // far future to avoid real conflicts
const slotEnd   = new Date('2099-01-01T11:00:00.000Z');

const results = await Promise.all(
  Array.from({ length: 20 }, (_, i) =>
    supabase.rpc('book_appointment_atomic', {
      p_tenant_id:       testTenantId,
      p_call_id:         null,
      p_start_time:      slotStart.toISOString(),
      p_end_time:        slotEnd.toISOString(),
      p_service_address: '123 Test St',
      p_caller_name:     `Contention Caller ${i + 1}`,
      p_caller_phone:    '+15551234567',
      p_urgency:         'routine',
      p_zone_id:         null,
    })
  )
);
```

### `test-call/route.js` — add `test_call: true` flag
```js
// Modification to existing src/app/api/onboarding/test-call/route.js
const call = await retell.call.createPhoneCall({
  from_number: tenant.retell_phone_number,
  to_number: tenant.owner_phone,
  retell_llm_dynamic_variables: {
    business_name: tenant.business_name,
    onboarding_complete: true,
    tone_preset: tenant.tone_preset,
    test_call: 'true', // ADD THIS — triggers auto-cancel in post-call processor
  },
});
```

### Spanish confirmation SMS — verified template exists
```json
// messages/es.json (confirmed present)
"booking_confirmation": "Su cita con {business_name} esta confirmada para el {date} a las {time} en {address}."
```

`sendCallerSMS` with `locale: 'es'` will load this template. The E2E test script should tell the reviewer to expect this exact format on their Spanish-language phone.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sentry.server.config.ts` imported directly in `_app.tsx` (Pages Router) | `instrumentation.js` + `onRequestError` hook (App Router) | Sentry v8.28+ / Next.js 15 | Must use new hook pattern — old Pages Router approach won't capture App Router API route errors |
| Sentry init in every API route handler | Single `instrumentation.js` registration | App Router era | Automatic — no changes to individual route files needed |

**Deprecated/outdated:**
- `sentry.client.config.ts` for server-side errors: no longer the mechanism. Server errors use `instrumentation.js`.
- `pages/_error.tsx` Sentry boundary: Pages Router only. App Router uses `app/global-error.tsx` — but D-10 says no client boundary, so skip entirely.

---

## Open Questions

1. **Does `book_appointment_atomic` RPC return `{ success: false, reason: 'slot_taken' }` for UNIQUE constraint violations too?**
   - What we know: The RPC uses `pg_try_advisory_xact_lock`. The advisory lock is non-blocking and returns false gracefully. The UNIQUE constraint is a last-resort defense — if two transactions slip through the advisory lock, the second INSERT throws a unique violation.
   - What's unclear: Whether the RPC's exception handler wraps the UNIQUE violation into `{ success: false, reason: 'slot_taken' }` or lets it bubble up as a Postgres error.
   - Recommendation: Read `supabase/migrations/003_scheduling.sql` before writing the integration test assertion. If the RPC doesn't catch UNIQUE violations, the test must also handle `r.error !== null` as an acceptable "contention" signal.

2. **Which Retell payload fields carry dynamic variables back in `call_ended` / `call_analyzed`?**
   - What we know: `call_inbound` returns `dynamic_variables`; `call_analyzed` has `call.metadata` and `call.call_analysis`.
   - What's unclear: Whether `test_call: 'true'` set at call creation appears in the `call_ended` payload's `metadata` object or must be tracked via a separate DB write.
   - Recommendation: Check what the `call_ended` payload looks like in logs (or Retell docs). If `retell_llm_dynamic_variables` is not echoed back, the cleanest approach is: store `call_id` returned from `retell.call.createPhoneCall()` in `tenants.last_test_call_id` and compare in `processCallEnded`.

3. **`@sentry/nextjs` v9 vs v10 compatibility with Next.js 16?**
   - What we know: `package.json` shows `"next": "^16.1.7"`. `@sentry/nextjs` v9.47.1 targets Next.js 13-15. `npm view @sentry/nextjs version` returns `10.45.0` (latest) which may explicitly target Next.js 16.
   - What's unclear: Whether v9 has any known incompatibilities with Next.js 16.
   - Recommendation: Run `npm install @sentry/nextjs` (latest, v10) and verify the instrumentation hook still works. If it does, use v10. If there are issues, pin to v9. This can be determined at implementation time in under 5 minutes.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Jest integration tests | Yes | v22.16.0 | — |
| Jest 29 | HARDEN-02 concurrency test | Yes | 29.7.0 (in package.json) | — |
| Supabase (real DB) | HARDEN-02 integration test | Requires env vars | — | Skip test with `describe.skip` guard; D-05 explicitly planned for this |
| `@sentry/nextjs` | HARDEN-04 | Not installed | — | Must install — no fallback for this requirement |
| `SENTRY_DSN` env var | Sentry init | Unknown | — | Must be provisioned from Sentry project dashboard before implementation |
| `SENTRY_ORG` / `SENTRY_PROJECT` | `withSentryConfig` source map upload | Unknown | — | Can omit source map upload in initial install; add later |

**Missing dependencies with no fallback:**
- `@sentry/nextjs` package: must be installed before Sentry work can begin
- `SENTRY_DSN` environment variable: must be provisioned from Sentry project dashboard

**Missing dependencies with fallback:**
- Real Supabase DB credentials for integration test: `describe.skip` guard prevents CI failure

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 |
| Config file | `jest.config.js` (existing, project root) |
| Quick run command | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests` |
| Full suite command | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests` |
| Integration run command | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/integration/` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HARDEN-01 | Spanish caller books, receives Spanish SMS, owner notified | Manual | N/A — manual test script | ❌ Wave 0: `tests/manual/e2e-spanish-booking.md` |
| HARDEN-01 | English baseline booking flow | Manual | N/A — manual test script | ❌ Wave 0: `tests/manual/e2e-english-booking.md` |
| HARDEN-02 | 20 concurrent requests produce exactly 1 success + 19 slot_taken | Integration | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/integration/ 2>/dev/null` | ❌ Wave 0: `tests/integration/atomic-booking-contention.test.js` |
| HARDEN-03 | Onboarding wizard completes in under 5 minutes with booking-first AI | Manual | N/A — manual test script | ❌ Wave 0: `tests/manual/onboarding-gate-revalidation.md` |
| HARDEN-04 | Test throw endpoint triggers Sentry alert within 60 seconds | Manual smoke | N/A — manual: call endpoint, check Sentry dashboard | ❌ Wave 0: `src/app/api/debug/test-error/route.js` |

### Sampling Rate
- **Per task commit:** `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests` (existing unit suite)
- **Per wave merge:** Full suite + integration test (when credentials available)
- **Phase gate:** All four HARDEN requirements manually verified before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/integration/atomic-booking-contention.test.js` — covers HARDEN-02
- [ ] `tests/manual/e2e-english-booking.md` — covers HARDEN-01 (English path)
- [ ] `tests/manual/e2e-spanish-booking.md` — covers HARDEN-01 (Spanish path)
- [ ] `tests/manual/onboarding-gate-revalidation.md` — covers HARDEN-03
- [ ] `src/app/api/debug/test-error/route.js` — covers HARDEN-04 manual smoke

---

## Project Constraints (from CLAUDE.md)

**Directive:** When making changes to voice call architecture or any system with a skill file, read the skill file first, make the changes, then update the skill file to reflect the new state.

**Impact on Phase 18:**
- `test-call/route.js` modification (adding `test_call: true`) touches the voice call system.
- `call-processor.js` modification (auto-cancel logic) touches the call pipeline.
- Both are covered by the `voice-call-architecture` SKILL.md.
- The planner MUST include a task to update `voice-call-architecture` SKILL.md after the code changes for test-call and call-processor are made.
- The Sentry files (`sentry.server.config.js`, `instrumentation.js`, `next.config.js` update) are new additions not currently covered by any skill file — no skill update needed for those.

---

## Sources

### Primary (HIGH confidence)
- Sentry official docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/ — `instrumentation.js` hook pattern, `onRequestError`, `sentry.server.config.js` structure, `withSentryConfig` usage
- Project source files read directly — `booking.js`, `route.js` (webhook), `route.js` (test-call), `call-processor.js`, `notifications.js`, `messages/es.json`, `jest.config.js`, `package.json`, `next.config.js`
- `voice-call-architecture` SKILL.md — complete call system reference

### Secondary (MEDIUM confidence)
- npm registry: `npm view @sentry/nextjs version` → `10.45.0` (latest); `v9` dist-tag → `9.47.1` (verified 2026-03-25)
- Sentry docs state: `onRequestError` requires `@sentry/nextjs` >= 8.28.0 and Next.js >= 15

### Tertiary (LOW confidence)
- `@sentry/nextjs` v9 vs v10 compatibility with `"next": "^16.1.7"` — not verified against official compatibility matrix. Flag for validation at implementation time.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages verified on npm registry; Sentry docs read directly
- Architecture: HIGH — all source files read; integration points confirmed in code
- Pitfalls: HIGH — derived from direct code inspection + Sentry serverless batching is a known pattern

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (Sentry docs stable; Jest patterns unchanged)

---
phase: 18-booking-first-hardening-and-qa
verified: 2026-03-25T12:00:00Z
status: human_needed
score: 9/9 automated must-haves verified
re_verification: false
human_verification:
  - test: "POST /api/debug/test-error and confirm Sentry event arrives in dashboard within 60 seconds"
    expected: "Response contains sentry_event_id; Sentry dashboard shows matching event within 60s of the POST"
    why_human: "Requires SENTRY_DSN env var to be provisioned and a live Sentry project to exist — cannot verify externally"
  - test: "Run tests/manual/e2e-english-booking.md end-to-end against a live tenant"
    expected: "All 6 checkpoints pass: AI answers in English, booking-first behavior, address read-back, English SMS within 60s, owner notified, dashboard shows booked lead"
    why_human: "Requires a live Retell phone number, a real phone call, and SMS delivery — automated tooling cannot simulate voice interaction"
  - test: "Run tests/manual/e2e-spanish-booking.md end-to-end against the same tenant"
    expected: "All 6 checkpoints pass: AI detects Spanish, switches language, Spanish SMS matches messages/es.json template, owner notification in English"
    why_human: "Multi-language detection is a runtime Retell behavior; SMS locale routing cannot be verified without a live call"
  - test: "Run tests/manual/onboarding-gate-revalidation.md as a new account user"
    expected: "All 7 checkpoints pass: wizard completes in under 5 minutes, AI attempts booking during test call, test appointment is auto-cancelled with lead reset to 'new'"
    why_human: "Full wizard timing and test-call auto-cancel verification require a live environment with working Retell integration and Supabase access"
  - test: "Run npm run test:integration with real SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    expected: "Exactly 1 of 20 concurrent book_appointment_atomic calls succeeds; 19 are contention losses; DB contains exactly 1 appointment row for the slot"
    why_human: "Requires real Supabase credentials with the book_appointment_atomic RPC deployed — the test is credential-guarded and skips without them"
---

# Phase 18: Booking-First Hardening and QA Verification Report

**Phase Goal:** The booking-first dispatcher is validated end-to-end across all call scenarios — multi-language, concurrency, edge cases, and error monitoring — before any real customer traffic
**Verified:** 2026-03-25
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Unhandled exceptions in API routes are captured by Sentry automatically | ? HUMAN | `instrumentation.js` exports `onRequestError` from `@sentry/nextjs`, wired via `register()` — runtime capture requires live SENTRY_DSN |
| 2 | A deliberate test throw at POST /api/debug/test-error returns a Sentry event ID | ? HUMAN | Route exists, uses `captureException` + `flush(2000)`, returns `sentry_event_id` — Sentry project provisioning required |
| 3 | Sentry event arrives in dashboard within 60 seconds of the test throw | ? HUMAN | Code is correct; network delivery to Sentry dashboard cannot be verified without a live DSN |
| 4 | 20 simultaneous booking requests to the same slot produce exactly 1 confirmed booking | ? HUMAN | Integration test exists with correct `Promise.all` + assertions; requires real Supabase credentials to execute |
| 5 | The remaining 19 requests receive structured responses (not unhandled errors) | ? HUMAN | Test correctly handles both advisory lock rejection and UNIQUE constraint violation outcomes |
| 6 | The database contains exactly 1 appointment row for the contested slot after the test | ? HUMAN | Test queries `appointments` table and asserts `toHaveLength(1)` — needs live DB |
| 7 | Integration test is skipped automatically when Supabase credentials are absent | ✓ VERIFIED | `const describeFn = hasCredentials ? describe : describe.skip` at line 9 of contention test |
| 8 | Test call bookings are automatically cancelled after the call ends | ✓ VERIFIED | `processCallEnded` in `call-processor.js` lines 78-105: dual-path `isTestCall` check, `status: 'cancelled'` update |
| 9 | Test call leads are reset to 'new' status when booking is auto-cancelled | ✓ VERIFIED | `call-processor.js` lines 99-103: `leads.update({ status: 'new', appointment_id: null })` |
| 10 | A human reviewer can follow the English E2E script to validate the booking-first happy path | ✓ VERIFIED | `tests/manual/e2e-english-booking.md` exists, 8 steps, 6-checkpoint PASS/FAIL table, expected SMS content |
| 11 | A human reviewer can follow the Spanish E2E script to validate multi-language booking end-to-end | ✓ VERIFIED | `tests/manual/e2e-spanish-booking.md` exists, Spanish SMS template from `messages/es.json`, 6 checkpoints |
| 12 | A human reviewer can follow the onboarding script to validate wizard completes in under 5 minutes | ✓ VERIFIED | `tests/manual/onboarding-gate-revalidation.md` exists, explicit timer instructions, 7-checkpoint verdict table |

**Score:** 9/9 automated verifications passed (5 items require human/live-environment execution)

---

### Required Artifacts

#### Plan 18-01: Sentry Error Monitoring

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `sentry.server.config.js` | Sentry SDK initialization for server-side | ✓ VERIFIED | Contains `Sentry.init` with `dsn: process.env.SENTRY_DSN`, `tracesSampleRate`, `sendDefaultPii: false` |
| `instrumentation.js` | Next.js instrumentation hook that loads Sentry | ✓ VERIFIED | Exports `register()` with nodejs runtime guard; re-exports `onRequestError` from `@sentry/nextjs` |
| `src/app/api/debug/test-error/route.js` | Hidden test endpoint for Sentry validation | ✓ VERIFIED | POST-only handler; env/secret guard; `captureException` + `flush(2000)`; returns `sentry_event_id` |
| `next.config.js` | Wrapped with withSentryConfig | ✓ VERIFIED | `withSentryConfig(withNextIntl(nextConfig), { org, project, silent, disableLogger })` |
| `sentry.client.config.js` | Must NOT exist (D-10: server-side only) | ✓ VERIFIED | File does not exist |
| `instrumentation-client.js` | Must NOT exist (D-10: server-side only) | ✓ VERIFIED | File does not exist |
| `package.json` (`@sentry/nextjs`) | Dependency added | ✓ VERIFIED | `"@sentry/nextjs": "^10.45.0"` in dependencies |

#### Plan 18-02: Concurrency Integration Test

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/integration/atomic-booking-contention.test.js` | Concurrency contention test against real Supabase | ✓ VERIFIED | 20-way `Promise.all`, dual-outcome handling, `beforeAll`/`afterAll` self-contained setup |
| `jest.config.js` | Excludes integration tests from regular npm test | ✓ VERIFIED | `/tests/integration/` in `testPathIgnorePatterns` at line 4 |
| `package.json` (`test:integration` script) | On-demand integration test runner | ✓ VERIFIED | Script present, points to `tests/integration/` |

#### Plan 18-03: Manual E2E Scripts and Auto-Cancel

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/onboarding/test-call/route.js` | Passes test_call flag to Retell | ✓ VERIFIED | `test_call: 'true'` in `retell_llm_dynamic_variables` at line 27 |
| `src/lib/call-processor.js` | Auto-cancel logic for test bookings | ✓ VERIFIED | Lines 78-105: `isTestCall` detection, appointment cancel, lead reset |
| `tests/manual/e2e-english-booking.md` | English booking E2E test script | ✓ VERIFIED | 8 steps, PASS/FAIL per step, 6-checkpoint verdict table, expected SMS content |
| `tests/manual/e2e-spanish-booking.md` | Spanish booking E2E test script | ✓ VERIFIED | Spanish SMS template from `messages/es.json` quoted verbatim, 6 checkpoints |
| `tests/manual/onboarding-gate-revalidation.md` | Onboarding wizard timing test script | ✓ VERIFIED | Explicit `< 5 minutes` gate, auto-cancel verification step (Step 9), 7 checkpoints |
| `.claude/skills/voice-call-architecture/SKILL.md` | Updated with test_call documentation | ✓ VERIFIED | 4 occurrences of `test_call`; auto-cancel flow documented in File Map, processCallEnded section, and Key Design Decisions |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `instrumentation.js` | `sentry.server.config.js` | dynamic import in `register()` | ✓ WIRED | `await import('./sentry.server.config')` under nodejs runtime guard |
| `next.config.js` | `@sentry/nextjs` | `withSentryConfig` wrapper | ✓ WIRED | 2 occurrences: import and usage in `export default` |
| `src/app/api/onboarding/test-call/route.js` | `src/lib/call-processor.js` | `test_call` flag in `retell_llm_dynamic_variables` | ✓ WIRED | Route sets `test_call: 'true'`; processor reads `metadata?.test_call === 'true'` |
| `src/lib/call-processor.js` | `appointments` table | auto-cancel UPDATE on `test_call` detection | ✓ WIRED | `supabase.from('appointments').update({ status: 'cancelled' })` — 2 `cancelled` occurrences |
| `tests/integration/atomic-booking-contention.test.js` | `supabase.rpc('book_appointment_atomic')` | direct RPC call with service role key | ✓ WIRED | 1 direct `supabase.rpc('book_appointment_atomic', {...})` call inside `Promise.all` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/app/api/debug/test-error/route.js` | `eventId` | `Sentry.captureException(error)` | Yes — real Sentry event ID | ✓ FLOWING (when SENTRY_DSN is set) |
| `src/lib/call-processor.js` processCallEnded | `isTestCall` | `metadata?.test_call` from Retell webhook payload | Yes — from live Retell callback | ✓ FLOWING (runtime) |
| `tests/integration/atomic-booking-contention.test.js` | `results` | `Promise.all([...supabase.rpc()])` | Yes — real Supabase responses | ✓ FLOWING (when credentials are set) |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Integration test skips without credentials | `node -e "process.env.SUPABASE_URL=undefined" && grep 'describe.skip' tests/integration/atomic-booking-contention.test.js` | `describe.skip` guard present at line 9 | ✓ PASS (static check) |
| jest.config.js excludes integration/ | Read `jest.config.js` line 4 | `/tests/integration/` in `testPathIgnorePatterns` | ✓ PASS |
| No client-side Sentry files | `test -f sentry.client.config.js` | File absent | ✓ PASS |
| test:integration script exists | `grep test:integration package.json` | Script present | ✓ PASS |
| Sentry flush before serverless response | `grep 'Sentry.flush' test-error/route.js` | `await Sentry.flush(2000)` present at line 13 | ✓ PASS |
| Lead reset on auto-cancel | Read `call-processor.js` lines 99-103 | `status: 'new', appointment_id: null` | ✓ PASS |
| Live Sentry event delivery | Requires `curl -X POST .../api/debug/test-error` with live DSN | Cannot test without credentials | ? SKIP |
| 20-way concurrency produces 1 winner | Requires `npm run test:integration` with real Supabase | Cannot test without credentials | ? SKIP |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| HARDEN-01 | 18-03 | Spanish-language caller books autonomously, receives Spanish confirmation SMS, owner gets notification — validated E2E | ? HUMAN | English + Spanish manual test scripts created with explicit PASS/FAIL criteria; runtime execution required |
| HARDEN-02 | 18-02 | 20 simultaneous booking requests to same slot produce exactly 1 confirmed booking and 19 contention responses | ? HUMAN | Integration test exists and is structurally correct; Supabase credentials required to execute |
| HARDEN-03 | 18-03 | Non-technical SME owner completes onboarding wizard in under 5 minutes — revalidated for booking-first | ? HUMAN | `onboarding-gate-revalidation.md` exists with < 5-minute gate and auto-cancel verification; live run required |
| HARDEN-04 | 18-01 | Unhandled exceptions and API failures trigger Sentry alert with full stack trace within 60 seconds | ? HUMAN | Sentry config complete and correct; event delivery requires live SENTRY_DSN to confirm |

No orphaned requirements. All four HARDEN-01 through HARDEN-04 are claimed by plans 18-01, 18-02, and 18-03 respectively, and all four appear in REQUIREMENTS.md mapped to Phase 18.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | No TODO, FIXME, placeholder, empty handler, or hardcoded stub patterns detected in any phase-18 modified files |

---

### Human Verification Required

#### 1. HARDEN-04: Sentry Live Event Delivery

**Test:** With `SENTRY_DSN`, `SENTRY_ORG`, and `SENTRY_PROJECT` configured, run:
```bash
curl -X POST http://localhost:3000/api/debug/test-error
```
Check the JSON response for `sentry_event_id`. Then open the Sentry dashboard and search for that event ID.

**Expected:** Event appears in the Sentry dashboard within 60 seconds. The error message reads "Deliberate Sentry test error — HARDEN-04 validation".

**Why human:** Requires a live Sentry project and provisioned DSN. Cannot be verified from the codebase alone.

---

#### 2. HARDEN-01 (English): E2E English Booking

**Test:** Follow `tests/manual/e2e-english-booking.md` using a real Retell phone number and a test phone.

**Expected:** All 6 checkpoints pass — AI answers in English, offers booking-first slots, reads back address, English SMS arrives within 60s, owner is notified, dashboard shows the lead as booked.

**Why human:** Voice interaction and SMS delivery require a live Retell integration. Cannot be simulated programmatically.

---

#### 3. HARDEN-01 (Spanish): E2E Spanish Booking

**Test:** Follow `tests/manual/e2e-spanish-booking.md` against the same tenant. Speak Spanish from the first utterance.

**Expected:** All 6 checkpoints pass — AI detects Spanish and responds in Spanish, address read-back in Spanish, SMS matches `messages/es.json` template (`Su cita con {business_name} esta confirmada para el {date} a las {time} en {address}.`), owner notification in English.

**Why human:** Multi-language detection is a runtime Retell behavior. The locale routing for SMS (`sendCallerSMS` with `locale: 'es'`) is code-correct but end-to-end confirmation requires a live call.

---

#### 4. HARDEN-03: Onboarding Wizard Timing and Auto-Cancel

**Test:** Follow `tests/manual/onboarding-gate-revalidation.md` as a fresh account user. Use a real phone for the test call, complete a booking during the call, then verify the appointment is cancelled afterward.

**Expected:** Wizard completes in under 5 minutes; AI offers booking slots during test call; post-call, the test appointment has `status = 'cancelled'` and the lead is reset to `status = 'new'`.

**Why human:** Wizard timing and end-to-end auto-cancel verification require a live deployment with Retell + Supabase. The auto-cancel logic is verified as correct in the code; its production behavior needs a real test call to confirm.

---

#### 5. HARDEN-02: Concurrency Integration Test (Credentials Required)

**Test:**
```bash
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
npm run test:integration
```

**Expected:** Test suite passes with 1 passing test. Output confirms exactly 1 success and 19 contention losses. Test cleans up after itself.

**Why human:** Requires real Supabase credentials with the `book_appointment_atomic` RPC deployed in the database. The test is structurally complete and correct but cannot run in a credential-free environment.

---

### Gaps Summary

No automated gaps. All code artifacts are fully implemented, substantive, and wired. The 9 items that can be verified programmatically all pass.

The 5 human verification items are not gaps — they are external-dependency checks that require live infrastructure (Sentry project, Retell phone system, Supabase database) to execute. The phase goal states "validated end-to-end ... before any real customer traffic" — this validation can only be confirmed by a human running the three manual test scripts and the integration test against real services.

The phase is code-complete. Human execution of the five verification items is the remaining step before the phase goal can be marked fully achieved.

---

_Verified: 2026-03-25T12:00:00Z_
_Verifier: Claude (gsd-verifier)_

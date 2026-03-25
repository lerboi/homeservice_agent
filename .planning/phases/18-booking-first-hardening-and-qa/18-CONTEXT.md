# Phase 18: Booking-First Hardening and QA - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate the booking-first dispatcher end-to-end across all call scenarios before any real customer traffic. Four validation areas: (1) Spanish E2E validation with manual test scripts for both English and Spanish, (2) concurrency QA with 20 simultaneous requests via Jest + real Supabase, (3) onboarding gate revalidation with booking-first test call behavior and auto-cancel, (4) Sentry error monitoring setup for Next.js API routes with deliberate test throw endpoint.

This is a QA/hardening phase — no new features, only validation, monitoring, and test infrastructure.

</domain>

<decisions>
## Implementation Decisions

### E2E Validation (HARDEN-01)
- **D-01:** Manual test script approach — detailed step-by-step checklist that a human reviewer follows. No automated E2E framework (Playwright/Cypress) introduced.
- **D-02:** Two test scripts — English baseline + Spanish multi-language. English validates the booking-first happy path, Spanish validates multi-language end-to-end per HARDEN-01.
- **D-03:** Each script covers the full flow: trigger Retell call → AI books appointment → caller receives SMS confirmation (in correct language) → owner receives notification. Pass/fail criteria for each step.

### Concurrency QA (HARDEN-02)
- **D-04:** Jest integration test with real Supabase — fires 20 parallel `Promise.all` calls to `atomicBookSlot` against a real database. Asserts exactly 1 success + 19 `{ success: false, reason: 'slot_taken' }` results. Zero double-bookings.
- **D-05:** Separate `tests/integration/` directory — only runs when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars are set. Regular `npm test` skips it. Prevents CI failures without credentials.
- **D-06:** Test creates its own test tenant and time slot, runs contention, then cleans up. Self-contained, idempotent.

### Onboarding Gate Revalidation (HARDEN-03)
- **D-07:** Test call AI attempts booking during the call — owner experiences the booking-first flow firsthand. The AI treats the owner as a real caller and tries to book an appointment.
- **D-08:** Auto-cancel test bookings — any booking created during a test call (identifiable by test_call flag or originating from test-call API route) is automatically cancelled after the call ends. Owner sees the flow but calendar stays clean.
- **D-09:** Manual test script — step-by-step checklist: create new account, complete wizard, trigger test call, verify AI attempts booking, verify under 5 minutes total. Human reviewer times it.

### Sentry Error Monitoring (HARDEN-04)
- **D-10:** Next.js + API routes only — install `@sentry/nextjs`, configure for server-side API route error capture. No client-side error boundary for dashboard (internal tool). Catches unhandled exceptions in webhook handlers, cron jobs, and API routes.
- **D-11:** Hidden test error endpoint — `POST /api/debug/test-error` protected by secret header or non-production env check. Throws an unhandled error on demand. Used to verify Sentry captures within 60 seconds.
- **D-12:** No WebSocket server Sentry integration — the standalone Railway WebSocket server is out of scope for this phase. Only the Next.js app gets Sentry.

### Claude's Discretion
- Sentry DSN configuration approach (env var naming, `sentry.client.config.js` vs `sentry.server.config.js` structure)
- Test script file format and location (markdown in `.planning/` or in `tests/manual/`)
- Concurrency test cleanup strategy (DELETE test data after assertions)
- Auto-cancel mechanism for test bookings (webhook handler check vs post-call processor)
- Whether to add a `test:integration` script to package.json

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Booking & Scheduling
- `src/lib/scheduling/booking.js` — `atomicBookSlot()` with Postgres advisory lock RPC. Contention test target.
- `supabase/migrations/` — All migration files for test data setup/teardown schema understanding

### Webhook Handler
- `src/app/api/webhooks/retell/route.js` — `handleBookAppointment()` for booking flow, `end_call` handler for post-call processing. Test call auto-cancel logic may hook here.

### Onboarding Test Call
- `src/app/api/onboarding/test-call/route.js` — Current test call trigger. Passes `onboarding_complete: true` to Retell. May need `test_call: true` flag.
- `src/app/onboarding/test-call/page.js` — Test call UI page

### Notifications
- `src/lib/notifications.js` — `sendCallerSMS()` (multi-language confirmation), `sendOwnerNotifications()` for E2E validation scripts
- `messages/en.json`, `messages/es.json` — Translation files (144 lines each, parity confirmed)

### Call Processing
- `src/lib/call-processor.js` — Post-call pipeline. Auto-cancel logic may integrate here.

### Prior Phase Context
- `.planning/phases/14-booking-first-agent-behavior/14-CONTEXT.md` — Booking-first decisions, 4-tool system
- `.planning/phases/15-call-processor-and-triage-reclassification/15-CONTEXT.md` — booking_outcome tracking
- `.planning/phases/17-recovery-sms-enhancement/17-CONTEXT.md` — Recovery SMS decisions

### Requirements
- `.planning/REQUIREMENTS.md` — HARDEN-01, HARDEN-02, HARDEN-03, HARDEN-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Jest 29 with ESM support (`node --experimental-vm-modules`) — test runner for concurrency tests
- Twilio/Supabase/Resend mocks in `tests/__mocks__/` — for unit-level test scaffolding
- `atomicBookSlot()` RPC wrapper — direct target for concurrency test
- Retell `call.createPhoneCall()` pattern in test-call route — reference for E2E test script

### Established Patterns
- `after()` from `next/server` for non-blocking async work
- Fire-and-forget notification pattern with `.catch()`
- Supabase `onConflict: 'retell_call_id'` upsert pattern
- `jest.unstable_mockModule` for ESM mocking

### Integration Points
- `test-call/route.js`: Add `test_call: true` to Retell dynamic variables for auto-cancel detection
- `handleBookAppointment()` or `processCallAnalyzed()`: Check `test_call` flag → auto-cancel booking after call
- New `sentry.server.config.js`: Sentry init for Next.js server-side
- New `/api/debug/test-error`: Hidden endpoint for Sentry validation

</code_context>

<specifics>
## Specific Ideas

- Concurrency test should verify not just success count but also that the database has exactly 1 appointment record for the contested slot — proving the advisory lock prevents double-inserts
- E2E test scripts should include expected SMS content snippets so the human reviewer knows exactly what to look for on their phone
- Auto-cancel for test bookings should also clean up the associated lead record to avoid dashboard clutter
- Sentry test throw endpoint should return the Sentry event ID so the reviewer can search for it in the Sentry dashboard

</specifics>

<deferred>
## Deferred Ideas

- Client-side Sentry error boundary for dashboard — defer until dashboard is customer-facing
- WebSocket server Sentry integration — separate deployment, separate monitoring concern
- Automated E2E with Playwright — defer until test matrix grows beyond manual feasibility
- k6 load testing for sustained traffic simulation — defer until production traffic patterns known

</deferred>

---

*Phase: 18-booking-first-hardening-and-qa*
*Context gathered: 2026-03-25*

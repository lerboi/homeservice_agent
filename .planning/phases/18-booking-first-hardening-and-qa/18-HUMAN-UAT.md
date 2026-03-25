---
status: partial
phase: 18-booking-first-hardening-and-qa
source: [18-VERIFICATION.md]
started: 2026-03-25T22:00:00.000Z
updated: 2026-03-25T22:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Sentry alert within 60 seconds (HARDEN-04)
expected: POST /api/debug/test-error with SENTRY_DSN configured produces a Sentry event visible in the dashboard within 60 seconds
result: [pending]

### 2. English E2E booking flow (HARDEN-01)
expected: English caller books autonomously, receives English SMS confirmation, owner gets notification — follow tests/manual/e2e-english-booking.md
result: [pending]

### 3. Spanish E2E booking flow (HARDEN-01)
expected: Spanish caller books autonomously, receives Spanish SMS confirmation, owner gets notification — follow tests/manual/e2e-spanish-booking.md
result: [pending]

### 4. Onboarding gate revalidation (HARDEN-03)
expected: Non-technical owner completes wizard and hears booking-first AI in under 5 minutes, test booking auto-cancelled — follow tests/manual/onboarding-gate-revalidation.md
result: [pending]

### 5. Concurrency integration test (HARDEN-02)
expected: npm run test:integration with real SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY produces exactly 1 booking from 20 simultaneous requests
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

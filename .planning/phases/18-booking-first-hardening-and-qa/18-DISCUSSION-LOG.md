# Phase 18: Booking-First Hardening and QA - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 18-booking-first-hardening-and-qa
**Areas discussed:** E2E validation approach, Concurrency QA strategy, Onboarding gate revalidation, Sentry error monitoring

---

## E2E Validation Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Manual test script | Step-by-step checklist for human reviewer | ✓ |
| Semi-automated pipeline | Jest + Retell API + Supabase polling | |
| Fully manual, no script | Test ad hoc when ready | |

**User's choice:** Manual test script

### Coverage Sub-question

| Option | Description | Selected |
|--------|-------------|----------|
| Both English + Spanish | Two test scripts for baseline + multi-language | ✓ |
| Spanish only | Minimal, HARDEN-01 only | |

**User's choice:** Both English and Spanish

---

## Concurrency QA Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Jest + real Supabase | 20 parallel Promise.all calls, real DB | ✓ |
| k6 load test | HTTP-level load testing, requires k6 binary | |
| Manual test script | curl/Postman, human verifies | |

**User's choice:** Jest + real Supabase

### Test Scope Sub-question

| Option | Description | Selected |
|--------|-------------|----------|
| Separate integration suite | tests/integration/, skips without env vars | ✓ |
| Part of regular suite | Conditional skip in existing directories | |

**User's choice:** Separate integration suite

---

## Onboarding Gate Revalidation

| Option | Description | Selected |
|--------|-------------|----------|
| AI attempts booking | Owner experiences full booking flow | ✓ |
| AI mentions capability | Says it can book but doesn't try | |
| No change needed | Current setup already works | |

**User's choice:** AI attempts booking during test call

### Test Booking Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-cancel after test | Test bookings automatically cleaned up | ✓ |
| Keep as real booking | Owner cancels manually if wanted | |
| You decide | Claude picks | |

**User's choice:** Auto-cancel after test

### Validation Method

| Option | Description | Selected |
|--------|-------------|----------|
| Manual test script | Checklist with timing by human reviewer | ✓ |
| Automated timing test | Script measures elapsed time | |

**User's choice:** Manual test script

---

## Sentry Error Monitoring

| Option | Description | Selected |
|--------|-------------|----------|
| Next.js + API routes only | Server-side only, no client error boundary | ✓ |
| Full stack (server + client) | Both backend and frontend | |
| Server + WebSocket server | Next.js + Railway WebSocket | |

**User's choice:** Next.js + API routes only

### Test Throw Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden API endpoint | /api/debug/test-error with secret header protection | ✓ |
| Temporary code + revert | Add throw, deploy, verify, revert | |
| You decide | Claude picks | |

**User's choice:** Hidden API endpoint

---

## Claude's Discretion

- Sentry DSN config structure
- Test script file format and location
- Concurrency test cleanup strategy
- Auto-cancel mechanism implementation
- Package.json script additions

## Deferred Ideas

- Client-side Sentry error boundary (defer until dashboard is customer-facing)
- WebSocket server Sentry (separate deployment concern)
- Automated E2E with Playwright (defer until test matrix grows)
- k6 load testing (defer until production traffic patterns known)

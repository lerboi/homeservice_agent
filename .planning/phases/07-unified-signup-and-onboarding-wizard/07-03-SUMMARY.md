---
phase: 07-unified-signup-and-onboarding-wizard
plan: 03
subsystem: ui, api
tags: [next.js, react, supabase, retell, sessionStorage, onboarding, wizard]

# Dependency graph
requires:
  - phase: 07-01
    provides: useWizardSession hook, 5-step wizard layout, sessionStorage key isolation pattern

provides:
  - Step 3 services page: service list editing only (trade selection removed, reads trade from sessionStorage)
  - Step 4 contact page: required phone validation, useWizardSession persistence, navigates to /onboarding/test-call
  - /onboarding/verify redirect to /onboarding/contact (backward compat)
  - GET /api/onboarding/test-call-status polling endpoint returning { complete, retell_phone_number }
  - onboarding_complete timing fix in test-call route (webhook-based, not trigger-based)

affects:
  - 07-04 (Step 5 test call UI — consumes test-call-status polling endpoint)
  - retell-webhook handler (sets onboarding_complete=true on call completion — now the sole setter)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useWizardSession for cross-step sessionStorage persistence with gsd_onboarding_ prefix
    - Server component redirect pattern (no 'use client') for legacy URL backward compat
    - role="alert" inline field validation for required phone

key-files:
  created:
    - src/app/onboarding/contact/page.js
    - src/app/api/onboarding/test-call-status/route.js
  modified:
    - src/app/onboarding/services/page.js
    - src/app/onboarding/verify/page.js
    - src/app/api/onboarding/test-call/route.js

key-decisions:
  - "onboarding_complete timing: webhook sets flag when call completes, not at trigger time — user must hear their AI before wizard marks completion"
  - "retell_llm_dynamic_variables keeps onboarding_complete: true for test call AI behavior (separate concern from DB flag)"
  - "Phone is required on Step 4 contact page — validation with role=alert, no form submit without it"
  - "Services page reads trade from useWizardSession('trade') and seeds service list from TRADE_TEMPLATES — no duplicate trade selection UI"

patterns-established:
  - "Server-component redirect: import { redirect } from 'next/navigation'; export default function XRedirect() { redirect('/new-path'); }"
  - "Required field inline error: state variable + role=alert p element below input with aria-describedby link"
  - "Polling endpoint pattern: GET route with auth check + single row select + Response.json (no caching headers)"

requirements-completed: [WIZARD-05, WIZARD-06]

# Metrics
duration: 12min
completed: 2026-03-22
---

# Phase 7 Plan 03: Steps 3-4 Migration + Test-Call-Status Endpoint Summary

**Services page migrated to step 3 (services-only, no trade selection), contact page created as step 4 (required phone), and test-call-status polling endpoint added with onboarding_complete timing bug fixed**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-22T10:37:43Z
- **Completed:** 2026-03-22T10:49:30Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Services page refactored: trade selection UI removed, service list seeded from sessionStorage or TRADE_TEMPLATES[trade], navigation updated to /onboarding/profile (back) and /onboarding/contact (forward)
- Contact page created as new step 4 with required phone validation, useWizardSession persistence for phone and email, navigates to /onboarding/test-call
- Old /onboarding/verify path replaced with server-component redirect to /onboarding/contact (zero runtime cost, backward compat)
- GET /api/onboarding/test-call-status created for Step 5 polling, returns { complete, retell_phone_number }
- onboarding_complete timing bug fixed: removed premature DB flag set from test-call trigger, now exclusively set by Retell webhook on call completion

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate services page + create contact page + redirect verify path** - `0d4d7a5` (feat)
2. **Task 2: Create test-call-status polling endpoint + fix onboarding_complete timing** - `b7429e0` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `src/app/onboarding/services/page.js` - Step 3: service list editing only, reads trade from sessionStorage, navigates to /onboarding/contact
- `src/app/onboarding/contact/page.js` - Step 4: required phone + optional email, persisted via useWizardSession, POSTs to /api/onboarding/sms-confirm, navigates to /onboarding/test-call
- `src/app/onboarding/verify/page.js` - Replaced with server-component redirect to /onboarding/contact
- `src/app/api/onboarding/test-call-status/route.js` - GET polling endpoint: auth check + tenants query + { complete, retell_phone_number } response
- `src/app/api/onboarding/test-call/route.js` - Removed onboarding_complete: true from DB update (kept in retell_llm_dynamic_variables)

## Decisions Made
- onboarding_complete timing: webhook sets flag when call completes, not at trigger time. The RESEARCH.md pitfall was correct — wizard should only mark complete after the user actually hears their AI. The existing comment in the test-call route was wrong ("Per Pitfall 5 in RESEARCH.md: set flag here") — Pitfall 3 in RESEARCH.md is the correct reference and says the opposite.
- retell_llm_dynamic_variables keeps `onboarding_complete: true` so the AI behaves correctly during the test call (TRIAGE-AWARE BEHAVIOR injected). This is a separate concern from the DB flag that controls wizard completion state.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Steps 3 and 4 fully functional with updated navigation chain
- GET /api/onboarding/test-call-status ready for Step 5 polling (Plan 07-04)
- onboarding_complete flag exclusively controlled by Retell webhook — Step 5 can poll until complete=true
- Plan 07-04 (Step 5: test call + completion) can proceed immediately

## Self-Check: PASSED

- src/app/onboarding/services/page.js — FOUND
- src/app/onboarding/contact/page.js — FOUND
- src/app/onboarding/verify/page.js — FOUND
- src/app/api/onboarding/test-call-status/route.js — FOUND
- src/app/api/onboarding/test-call/route.js — FOUND
- commit 0d4d7a5 — FOUND
- commit b7429e0 — FOUND

---
*Phase: 07-unified-signup-and-onboarding-wizard*
*Completed: 2026-03-22*

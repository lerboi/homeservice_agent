---
phase: 02-onboarding-and-triage
plan: 04
subsystem: ui, api
tags: [retell, supabase, sms-otp, phone-provisioning, onboarding, react, shadcn, tdd]

# Dependency graph
requires:
  - phase: 02-onboarding-and-triage
    plan: 03
    provides: wizard Steps 1-2, supabase-server.js, shadcn components, translation keys
  - phase: 02-onboarding-and-triage
    plan: 01
    provides: retell.js client, tenants table schema

provides:
  - Wizard Step 3 at /onboarding/verify: phone + email entry, OTP confirm, number provisioning
  - POST /api/onboarding/sms-verify: sends Supabase OTP to phone number
  - POST /api/onboarding/sms-confirm: verifies OTP and saves owner_phone + owner_email to tenant
  - POST /api/onboarding/provision-number: provisions Retell phone number via SDK
  - Activation page at /onboarding/complete: displays AI number + Test your AI button
  - POST /api/onboarding/test-call: triggers Retell outbound call + sets onboarding_complete=true

affects: [02-05, phase-3, phase-4]

# Tech tracking
tech-stack:
  added:
    - "shadcn Skeleton component — loading state during Retell number provisioning"
  patterns:
    - "Wizard sub-states: phone | otp | provisioning within a single page component"
    - "TDD RED-GREEN: failing tests committed before implementation"
    - "Supabase signInWithOtp + verifyOtp for phone OTP flow"
    - "retell.phoneNumber.create() for phone number provisioning"
    - "retell.call.createPhoneCall() for outbound test call"
    - "onboarding_complete set atomically with test call trigger (not webhook callback)"

key-files:
  created:
    - src/app/onboarding/verify/page.js
    - src/app/onboarding/complete/page.js
    - src/app/api/onboarding/sms-verify/route.js
    - src/app/api/onboarding/sms-confirm/route.js
    - src/app/api/onboarding/provision-number/route.js
    - src/app/api/onboarding/test-call/route.js
    - tests/onboarding/test-call.test.js
    - src/components/ui/skeleton.jsx
  modified: []

key-decisions:
  - "onboarding_complete flag set atomically with test call trigger — not on Retell webhook callback — per RESEARCH.md Pitfall 5"
  - "Wizard Step 3 uses 3 sub-states (phone, otp, provisioning) within one page component — avoids route flicker during OTP flow"
  - "Email collected alongside phone in sms-confirm (not a separate API call) — single round-trip saves both fields"
  - "provision-number redirect passes number as URL search param — matches RESEARCH.md Pattern 1 (URL-param wizard state)"

requirements-completed: [ONBOARD-05, ONBOARD-06]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 2 Plan 04: Wizard Step 3 + Activation + Test Call Summary

**SMS OTP phone verification, email collection, Retell number provisioning, and activation page with outbound test call — completing the onboarding sprint**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-19T07:17:48Z
- **Completed:** 2026-03-19T07:21:14Z
- **Tasks:** 2
- **Files created:** 8

## Accomplishments

- Wizard Step 3 (`/onboarding/verify`): 3-state UI — phone + email entry, OTP confirmation, number provisioning — with full error handling and loading states per UI-SPEC
- 3 API routes: sms-verify (signInWithOtp), sms-confirm (verifyOtp + saves owner_phone + owner_email), provision-number (retell.phoneNumber.create)
- Activation page (`/onboarding/complete`): shows provisioned Retell number in Card, "Test your AI" button, success state with green CheckCircle, dashboard link
- Test call API route: reads tenant data, calls retell.call.createPhoneCall, sets onboarding_complete=true atomically
- TDD: 6 unit tests written in RED phase before implementation, all 6 pass in GREEN phase
- Full test suite: 110 tests passing across 10 suites — no regressions
- Build: all 15 routes compile cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Wizard Step 3 + 3 API routes + Skeleton component** - `b30f910` (feat)
2. **Task 2 RED: Failing test-call tests** - `eba008f` (test)
3. **Task 2 GREEN: test-call route + activation page** - `5dfc7d7` (feat)

## Files Created

- `src/app/onboarding/verify/page.js` - Wizard Step 3: phone/email entry → OTP → provisioning (3 sub-states)
- `src/app/onboarding/complete/page.js` - Activation page with Test your AI button and success state
- `src/app/api/onboarding/sms-verify/route.js` - Auth-guarded Supabase signInWithOtp
- `src/app/api/onboarding/sms-confirm/route.js` - Auth-guarded verifyOtp + saves owner_phone + owner_email
- `src/app/api/onboarding/provision-number/route.js` - Auth-guarded Retell phoneNumber.create + saves to tenant
- `src/app/api/onboarding/test-call/route.js` - Auth-guarded Retell call.createPhoneCall + sets flags
- `tests/onboarding/test-call.test.js` - 6 unit tests covering 401/400/500/happy-path/flag-setting
- `src/components/ui/skeleton.jsx` - shadcn Skeleton for provisioning loading state

## Decisions Made

- `onboarding_complete` flag set atomically at test call trigger time (not on Retell webhook callback) — per RESEARCH.md Pitfall 5
- Wizard Step 3 implemented as a single page with 3 internal sub-states rather than 3 separate routes — avoids navigation flicker during OTP sequence
- Email collected and saved in the same `sms-confirm` round-trip as phone verification — reduces API calls
- Provisioned number passed as URL search param to activation page — consistent with URL-param wizard state pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added shadcn Skeleton component**
- **Found during:** Task 1 implementation
- **Issue:** `src/components/ui/skeleton.jsx` was listed in UI-SPEC component inventory but not present in the codebase (Plan 03 added 8 of 12 components; Skeleton was not among them)
- **Fix:** `npx shadcn@latest add skeleton` — added the component needed for provisioning loading state
- **Files modified:** `src/components/ui/skeleton.jsx`
- **Commit:** b30f910 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (missing critical component)
**Impact on plan:** Zero scope creep — Skeleton was already in the UI-SPEC component inventory, just not yet installed.

## Issues Encountered

None — plan executed cleanly.

## User Setup Required

None — no new external service configuration. `RETELL_API_KEY` was already required and documented in `.env.example` from Phase 1.

## Next Phase Readiness

- Full 3-step onboarding sprint is complete: Step 1 (name + tone) → Step 2 (services) → Step 3 (phone + email + provisioning) → Activation (test call)
- `onboarding_complete=true` is now set on tenant after test call — Phase 2 Plan 05 (webhook triage) already guards on this flag
- Owner email saved to `tenants.owner_email` — available for Phase 4 notification routes
- Dashboard route `/dashboard/services` is the next destination — Phase 4 scope

---
*Phase: 02-onboarding-and-triage*
*Completed: 2026-03-19*

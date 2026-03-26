---
phase: 22-billing-foundation
plan: 03
subsystem: payments
tags: [stripe, checkout, onboarding, subscription, trial]

requires:
  - phase: 22-01
    provides: Stripe SDK singleton (src/lib/stripe.js)
provides:
  - Stripe Checkout Session API endpoint (POST /api/onboarding/checkout-session)
  - 6-step onboarding wizard layout (plan selection + checkout success)
  - Test-call page routing to plan selection instead of dashboard
affects: [22-04, 22-05, onboarding-flow]

tech-stack:
  added: []
  patterns:
    - "Checkout Session with tenant_id in both session and subscription_data metadata"
    - "Price map from env vars (STRIPE_PRICE_STARTER/GROWTH/SCALE)"

key-files:
  created:
    - src/app/api/onboarding/checkout-session/route.js
  modified:
    - src/app/onboarding/layout.js
    - src/app/onboarding/test-call/page.js
    - .claude/skills/onboarding-flow/SKILL.md

key-decisions:
  - "tenant_id set on both Checkout Session metadata and subscription_data metadata for webhook reliability"
  - "clearWizardSession removed from test-call page — session persists through plan selection and checkout"
  - "onboarding_complete no longer set by test-call flow — deferred to checkout.session.completed webhook"

patterns-established:
  - "Checkout Session creation pattern: auth user -> lookup tenant -> map plan to price -> create session"

requirements-completed: [BILL-06]

duration: 4min
completed: 2026-03-26
---

# Phase 22 Plan 03: Checkout Session & Onboarding Flow Summary

**Stripe Checkout Session API with 14-day trial + CC required, and 6-step onboarding wizard routing test-call completion to plan selection**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-26T05:59:40Z
- **Completed:** 2026-03-26T06:03:18Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- POST /api/onboarding/checkout-session creates Stripe Checkout Session with 14-day trial, CC required, and tenant_id in both session and subscription metadata
- Onboarding layout updated from 4 to 6 steps (plan=5, checkout-success=6)
- Test-call page routes to /onboarding/plan on complete and skip (no longer marks onboarding_complete or calls /api/onboarding/complete)
- Onboarding-flow skill file updated to reflect the new 6-step wizard architecture

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Checkout Session API endpoint** - `a57e862` (feat)
2. **Task 2: Update onboarding layout and test-call routing** - `26e963b` (feat)
3. **Skill update: onboarding-flow SKILL.md** - `ef79594` (docs)

## Files Created/Modified
- `src/app/api/onboarding/checkout-session/route.js` - Stripe Checkout Session creation with auth, tenant lookup, price mapping, 14-day trial
- `src/app/onboarding/layout.js` - TOTAL_STEPS=6, added /onboarding/plan (step 5) and /onboarding/checkout-success (step 6)
- `src/app/onboarding/test-call/page.js` - Routes to /onboarding/plan, removed clearWizardSession and completing state
- `.claude/skills/onboarding-flow/SKILL.md` - Updated to document 6-step wizard, checkout-session API, and billing flow

## Decisions Made
- tenant_id on both session and subscription_data metadata ensures webhook handler can always find the tenant regardless of which Stripe event fires first
- clearWizardSession removed from test-call page because wizard session should persist through plan selection and checkout — cleared only after checkout success
- Button label in noPhone fallback changed from "Go to Dashboard" to "Continue" since it now routes to plan selection (Rule 1 - misleading label)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed misleading button label in noPhone fallback**
- **Found during:** Task 2 (test-call page update)
- **Issue:** Button said "Go to Dashboard" but now routes to /onboarding/plan
- **Fix:** Changed label to "Continue"
- **Files modified:** src/app/onboarding/test-call/page.js
- **Verification:** Visual inspection of code
- **Committed in:** 26e963b (Task 2 commit)

**2. [Rule 2 - CLAUDE.md] Updated onboarding-flow skill file per project instructions**
- **Found during:** Post-task review
- **Issue:** CLAUDE.md requires skill files to be updated when architecture changes
- **Fix:** Updated SKILL.md with 6-step wizard, checkout-session API, env vars, updated flow diagram
- **Files modified:** .claude/skills/onboarding-flow/SKILL.md
- **Verification:** Skill file reflects current code state
- **Committed in:** ef79594

---

**Total deviations:** 2 auto-fixed (1 bug, 1 CLAUDE.md compliance)
**Impact on plan:** Both auto-fixes necessary for correctness and project compliance. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Stripe env vars (STRIPE_PRICE_STARTER, STRIPE_PRICE_GROWTH, STRIPE_PRICE_SCALE, NEXT_PUBLIC_APP_URL) must be set but were already documented in Plan 01.

## Known Stubs
None - all endpoints are fully wired. Plan selection page and checkout-success page are expected to be created in a subsequent plan.

## Next Phase Readiness
- Checkout Session endpoint ready for the plan selection page to call
- Layout supports 6 steps — plan selection and checkout-success pages can be built
- Webhook handler (Plan 02) processes checkout.session.completed events to set onboarding_complete

---
*Phase: 22-billing-foundation*
*Completed: 2026-03-26*

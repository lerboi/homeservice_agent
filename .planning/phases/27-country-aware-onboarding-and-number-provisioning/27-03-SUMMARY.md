---
phase: 27-country-aware-onboarding-and-number-provisioning
plan: 03
subsystem: payments, provisioning, docs
tags: [stripe, webhook, phone-provisioning, twilio, retell, singapore, skill-update]

# Dependency graph
requires:
  - phase: 27-01
    provides: assign_sg_number RPC, phone_inventory table, tenants.country column
  - phase: 22-billing-foundation
    provides: Stripe webhook handler skeleton, handleCheckoutCompleted injection point
provides:
  - Country-aware phone provisioning in handleCheckoutCompleted webhook
  - SG path: assign_sg_number RPC with race-safe FOR UPDATE SKIP LOCKED
  - US/CA path: Twilio incomingPhoneNumbers.create() + retell.phoneNumber.import() per D-12
  - provisioning_failed flag set on tenant when provisioning cannot complete
  - Accurate onboarding-flow skill file reflecting 5-step wizard and all Phase 27 changes
affects:
  - src/app/api/stripe/webhook/route.js (provisioning logic in handleCheckoutCompleted)
  - .claude/skills/onboarding-flow/SKILL.md (skill file now accurate for Phase 27)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy Twilio client getter pattern (getTwilioClient()) mirroring notifications.js"
    - "Twilio-direct number purchase (D-12) for future SMS access from tenant numbers"
    - "Retell phoneNumber.import() to wire Twilio-purchased number into Retell voice AI"
    - "Idempotent provisioning guard: skip if retell_phone_number already set"
    - "Provisioning failure flag (provisioning_failed) allows subscription creation to succeed even when phone assignment fails"

key-files:
  modified:
    - src/app/api/stripe/webhook/route.js
    - .claude/skills/onboarding-flow/SKILL.md

key-decisions:
  - "US/CA provisioning uses Twilio API direct purchase (not retell.phoneNumber.create) per D-12 — Twilio ownership enables future SMS access from tenant numbers"
  - "Retell import (phoneNumber.import) runs after Twilio purchase to wire number into Retell voice AI; import failure is logged but does not block number assignment"
  - "Provisioning runs after onboarding_complete update but before subscription sync — subscription creation is always guaranteed even if provisioning fails"
  - "Idempotent guard on retell_phone_number prevents double-provisioning on Stripe webhook retries"

requirements-completed:
  - COUNTRY-04
  - COUNTRY-05
  - COUNTRY-07

# Metrics
duration: 7min
completed: 2026-03-26
---

# Phase 27 Plan 03: Country-Aware Stripe Webhook Provisioning and Skill Update Summary

**Country-aware phone provisioning in Stripe checkout webhook: SG from phone_inventory via RPC, US/CA via Twilio API purchase + Retell import (D-12), with provisioning_failed fallback and complete onboarding-flow skill update for 5-step wizard**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-26T07:59:25Z
- **Completed:** 2026-03-26T08:06:38Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Modified `handleCheckoutCompleted` in the Stripe webhook handler to add country-aware phone provisioning: reads `tenant.country`, calls `provisionPhoneNumber(tenantId, country)` after `onboarding_complete` is set but before subscription sync
- `provisionPhoneNumber` implements three paths: SG uses `supabase.rpc('assign_sg_number')` for atomic race-safe inventory assignment; US/CA purchases via `twilio.incomingPhoneNumbers.create()` then imports into Retell via `retell.phoneNumber.import()` per D-12; fallback treats unknown countries as US
- Failure handling: `provisioning_failed = true` set on tenant when provisioning returns null — subscription creation proceeds regardless
- Updated onboarding-flow skill from 6-step to 5-step wizard, renamed Step 4 to "Your Details", removed test-call from step table and flow diagram, added Country-Aware Provisioning section, marked provision-number and test-call routes as DEPRECATED, added sg-availability and sg-waitlist to file map and API routes, updated database tables section with new columns and phone_inventory schema, updated env vars

## Task Commits

Each task was committed atomically:

1. **Task 1: Add country-aware provisioning to Stripe checkout webhook** - `55ef77f` (feat)
2. **Task 2: Update onboarding-flow skill file** - `e3c545e` (docs)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/app/api/stripe/webhook/route.js` - Added getTwilioClient(), provisionPhoneNumber() helper, and provisioning block in handleCheckoutCompleted
- `.claude/skills/onboarding-flow/SKILL.md` - Complete Phase 27 update: 5-step wizard, Your Details step, country-aware provisioning section, deprecated routes, new API routes, updated DB tables

## Decisions Made

- **Twilio-direct for US/CA (D-12):** The plan explicitly requires `twilio.incomingPhoneNumbers.create()` + `retell.phoneNumber.import()`, overriding the research recommendation of `retell.phoneNumber.create({ country_code })`. The plan's rationale (future SMS access from tenant numbers) is preserved in code comments.
- **Retell import failure is non-blocking:** If `retell.phoneNumber.import()` fails after Twilio purchase, the phone number is still returned and saved to the tenant. Retell import can be retried manually. The number is usable; only Retell voice routing would be affected until import is retried.
- **Lazy Twilio client:** Following the same pattern as `src/lib/notifications.js` — module-level `twilioClient = null` with `getTwilioClient()` getter. Prevents unnecessary Twilio SDK initialization when the checkout is for an SG tenant.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Created/Modified Files

- [x] `src/app/api/stripe/webhook/route.js` — FOUND
- [x] `.claude/skills/onboarding-flow/SKILL.md` — FOUND

### Commits

- [x] `55ef77f` — FOUND
- [x] `e3c545e` — FOUND

## Self-Check: PASSED

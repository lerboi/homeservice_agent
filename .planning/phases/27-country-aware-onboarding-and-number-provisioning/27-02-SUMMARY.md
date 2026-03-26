---
phase: 27-country-aware-onboarding-and-number-provisioning
plan: "02"
subsystem: onboarding
tags: [onboarding, country, phone, ui, api]
dependency_graph:
  requires: ["27-01"]
  provides: ["Your Details wizard step", "SG availability check UI", "SG waitlist UI", "sms-confirm country gate"]
  affects: ["onboarding wizard flow", "tenants table", "phone provisioning"]
tech_stack:
  added: []
  patterns: ["useWizardSession persistence", "E.164 phone formatting", "server-side availability gate (409)"]
key_files:
  created: []
  modified:
    - src/app/onboarding/contact/page.js
    - src/app/onboarding/layout.js
    - src/app/api/onboarding/sms-confirm/route.js
decisions:
  - "Phone prefix shown as non-editable span inside the input row, user types local digits only"
  - "SG availability check fires immediately on country select, not on form submit"
  - "Waitlist mode completely replaces form fields (name/phone/country/Continue hidden)"
  - "buildE164 constructs full E.164 from country config prefix + stripped local digits"
  - "Server-side 409 gate in sms-confirm prevents direct API bypass of waitlist when SG inventory is 0"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-03-26"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 27 Plan 02: Country-Aware Your Details Step Summary

Country-aware "Your Details" wizard step with SG availability check, waitlist flow, E.164 phone formatting, and server-side SG gate in sms-confirm API.

## What Was Built

### Task 1 — Replace contact page with "Your Details" step (d977f2e)

Completely rewrote `src/app/onboarding/contact/page.js` from a minimal single-phone-field form into a full "Your Details" step with three country-aware fields:

- Full name field (persisted via `useWizardSession('owner_name')`)
- Phone number field with non-editable country prefix (+65/+1 based on selection, persisted via `useWizardSession('phone')`)
- Country dropdown (SG/US/CA via shadcn Select, persisted via `useWizardSession('country')`)

Country-specific behavior:
- Selecting Singapore fires an immediate GET to `/api/onboarding/sg-availability`, shows Loader2 spinner, then displays count badge (`{N} Singapore numbers available` in copper `#C2410C`)
- When SG count = 0: waitlist UI replaces all form fields — email input + "Join waitlist" button, calls `/api/onboarding/sg-waitlist`
- After waitlist join: success state shows "You're on the list" with confirmation email display

`buildE164()` helper constructs E.164 phone from COUNTRY_CONFIG prefix + stripped local digits before API call.

Form now routes to `/onboarding/plan` (not `/onboarding/test-call`) on successful submit.

### Task 2 — Layout step mapping + sms-confirm API extension (9ed6d09)

**layout.js:**
- Removed `/onboarding/test-call` → step 4 mapping
- Added `/onboarding/plan` → step 4 mapping (TOTAL_STEPS unchanged at 5)
- Widened wizard card container from `max-w-lg` (512px) to `max-w-2xl` (672px)

**sms-confirm/route.js:**
- Extended request body destructuring to accept `owner_name` and `country`
- Added server-side SG availability gate BEFORE tenant update: queries `phone_inventory` table (country='SG', status='available'), returns 409 with message "No Singapore numbers are currently available. Please join the waitlist." when count = 0
- Saves `owner_name` to `tenants.owner_name` (if non-empty)
- Saves `country` to `tenants.country` with allowlist validation (`['SG', 'US', 'CA'].includes(country)`)

## Verification

- `npm run build` passes with no errors
- `/onboarding/contact` renders at correct wizard step (3 of 5)
- `/onboarding/plan` is now step 4 in progress bar
- sms-confirm API rejects SG requests when no inventory (409)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

Files exist:
- FOUND: src/app/onboarding/contact/page.js
- FOUND: src/app/onboarding/layout.js
- FOUND: src/app/api/onboarding/sms-confirm/route.js

Commits exist:
- FOUND: d977f2e feat(27-02): replace contact page with Your Details step
- FOUND: 9ed6d09 feat(27-02): update layout step mapping and extend sms-confirm with SG gate

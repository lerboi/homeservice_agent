---
status: partial
phase: 27-country-aware-onboarding-and-number-provisioning
source: [27-VERIFICATION.md]
started: 2026-03-26
updated: 2026-03-26
---

## Current Test

[awaiting human testing]

## Tests

### 1. SG availability badge updates on country select
expected: Selecting Singapore in the country dropdown immediately fires a fetch to /api/onboarding/sg-availability and shows the available count badge
result: [pending]

### 2. Phone prefix auto-switch on country change
expected: Switching between SG/US/CA updates the phone field prefix (+65 vs +1) and placeholder text
result: [pending]

### 3. End-to-end Stripe test checkout with provisioning
expected: Completing Stripe Checkout triggers provisionPhoneNumber in the webhook — SG assigns from inventory, US/CA purchases via Twilio + imports to Retell
result: [pending]

### 4. Server-side 409 gate with empty SG inventory
expected: When all SG numbers are assigned, POSTing to /api/onboarding/sms-confirm with country=SG returns 409 status
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

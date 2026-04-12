---
status: partial
phase: 46-vip-caller-direct-routing
source: [46-VERIFICATION.md]
started: 2026-04-12T00:00:00Z
updated: 2026-04-12T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Priority Callers section placement and persistence
expected: On `/dashboard/more/call-routing`, the "Priority Callers" card is the first card below the page header. Section remains visible when the master schedule toggle is OFF. After adding a number and clicking "Save changes", reloading the page shows the number persists.
result: [pending]

### 2. Inline validation errors
expected: Adding an invalid phone number (e.g. `abc123`) surfaces an inline validation error below the input. Adding a duplicate phone number shows "This number is already in your priority list."
result: [pending]

### 3. LeadFlyout toggle ON
expected: Opening a lead flyout, toggling "Priority Caller" ON shows a success toast "Caller marked as priority", the star icon turns violet, and the lead's card in the leads list shows a violet "Priority" badge with a filled star. State persists across flyout close/reopen.
result: [pending]

### 4. LeadFlyout toggle OFF
expected: Toggling "Priority Caller" OFF shows "Priority status removed" toast and the violet badge disappears from the lead card.
result: [pending]

### 5. Live priority call routing (staging smoke test)
expected: With the master schedule toggle in AI-only mode, placing a real phone call from a number that is either in `tenants.vip_numbers` OR is on a lead with `is_vip=true` routes the call directly to the owner's pickup phone, bypassing the AI and bypassing outbound cap checks. A non-priority call from the same environment still reaches the AI.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

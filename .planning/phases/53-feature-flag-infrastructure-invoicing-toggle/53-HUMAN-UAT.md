---
status: partial
phase: 53-feature-flag-infrastructure-invoicing-toggle
source: [53-VERIFICATION.md]
started: 2026-04-17T00:00:00Z
updated: 2026-04-17T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Toggle OFF → ON via /dashboard/more/features
expected: Switch flips ON silently (no dialog, no toast). Next navigation shows Invoices entry in sidebar, Invoice Settings + Integrations in More menu, mobile QUICK_ACCESS card visible, Create Invoice/Estimate buttons in LeadFlyout.
result: [pending]

### 2. Toggle ON → OFF with ≥1 invoice OR ≥1 estimate existing
expected: AlertDialog appears with title "Disable invoicing?", description interpolating actual counts, "Keep Invoicing" cancel button, orange "Disable" confirm button (NOT destructive red). Click Disable → Loader2 spinner, dialog closes, sonner toast "Invoicing disabled. Re-enable here anytime.", Switch shows OFF, next navigation hides all invoicing UI surfaces.
result: [pending]

### 3. Toggle ON → OFF with 0 invoices AND 0 estimates
expected: No dialog appears — silent PATCH. Toast "Invoicing disabled. Re-enable here anytime." appears. Switch shows OFF.
result: [pending]

### 4. Visit /dashboard/invoices, /dashboard/estimates, /dashboard/more/invoice-settings with invoicing=false
expected: Each path 302 redirects to /dashboard. /dashboard/more/features loads normally (not redirected).
result: [pending]

### 5. Curl /api/invoices, /api/estimates, /api/invoice-settings with auth cookie + invoicing=false
expected: HTTP/1.1 404 with empty body (no JSON, no error message). Same routes return 200 JSON when invoicing=true. Without auth → 401.
result: [pending]

### 6. Trigger invoice-reminders + recurring-invoices crons manually with invoicing=false on all tenants
expected: Both crons short-circuit with console.log "No tenants with invoicing enabled — skipping" and return {reminders_sent:0, late_fees_applied:0} or {generated:0} respectively. No reminder emails sent, no draft invoices created.
result: [pending]

### 7. PATCH /api/tenant/features with invalid inputs
expected: Non-boolean invoicing → 400 "Invalid: features.invoicing must be a boolean". Missing features object → 400 "Invalid: body.features must be an object". Malformed JSON → 400 "Invalid JSON body". No auth cookie → 401 "Unauthorized".
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps

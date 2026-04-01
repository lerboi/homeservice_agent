---
phase: 34-estimates-reminders-recurring
verified: 2026-04-02T14:30:00Z
status: passed
score: 7/7 must-have truth groups verified
re_verification: false
---

# Phase 34: Estimates, Reminders, and Recurring Invoices -- Verification Report

**Phase Goal:** Extend the invoice system with pre-job estimates (optional good/better/best tiers), a simple payment log for partial payments, automated payment reminders on a fixed schedule, auto-calculated late fees, and recurring invoices for maintenance contracts.
**Verified:** 2026-04-02T14:30:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Estimates exist as a separate document type with full CRUD + status flow | VERIFIED | `030_estimates_schema.sql` creates estimates, estimate_tiers, estimate_line_items tables with status CHECK (draft/sent/approved/declined/expired). API routes at `/api/estimates` and `/api/estimates/[id]` with full GET/POST/PATCH/DELETE. |
| 2 | Optional tier support (good/better/best) with separate line items per tier | VERIFIED | `estimate_tiers` table with FK to estimates. `TierEditor.jsx` (141 lines) component. Estimate editor page (`new/page.js`, 686 lines) supports both single-price and tiered modes. PDF generation handles both layouts (`estimate-pdf.jsx`, 361 lines). |
| 3 | Payment log with auto-status calculation | VERIFIED | `invoice_payments` table in `031_payment_log_schema.sql`. API at `/api/invoices/[id]/payments/route.js` (214 lines) imports and uses `calculatePaymentStatus`. `PaymentLog.jsx` (200 lines) and `RecordPaymentDialog.jsx` (127 lines) wired into invoice detail page. All 7 payment-log unit tests pass GREEN. |
| 4 | Automated payment reminders on fixed schedule | VERIFIED | Cron at `/api/cron/invoice-reminders/route.js` (284 lines) sends at -3, 0, +3, +7 days. Idempotency via `invoice_reminders` table with UNIQUE(invoice_id, reminder_type). 4 React Email templates in `InvoiceReminderEmail.jsx` (229 lines) with escalating tone. vercel.json has `"0 9 * * *"` schedule. `ReminderToggle.jsx` wired into invoice detail. |
| 5 | Auto-calculated late fees (flat or percentage) | VERIFIED | `late-fee-calculations.js` exports `calculateLateFee` and `shouldApplyLateFee`. Cron route imports and uses both. `invoice_settings` has `late_fee_enabled`, `late_fee_type`, `late_fee_amount` columns. Invoice settings page has full late fee configuration UI. `invoice_line_items` CHECK includes `late_fee`. All 9 late-fee unit tests pass GREEN. |
| 6 | Recurring invoices for maintenance contracts | VERIFIED | `invoices` table extended with `is_recurring_template`, `recurring_frequency`, `recurring_start_date`, `recurring_end_date`, `recurring_next_date`, `recurring_active`, `generated_from_id`. Cron at `/api/cron/recurring-invoices/route.js` (192 lines) generates draft invoices. `RecurringSetupDialog.jsx` (148 lines) and `RecurringBadge.jsx` (22 lines) wired into invoice list and detail pages. Invoice list has "Recurring" filter tab. All 6 recurring-schedule unit tests pass GREEN. |
| 7 | Estimate lifecycle: send, approve/decline, convert to invoice | VERIFIED | Send endpoint at `/api/estimates/[id]/send/route.js` (218 lines) uses Resend+Twilio. Convert endpoint at `/api/estimates/[id]/convert/route.js` (210 lines) creates draft invoice from approved estimate. Detail page (`[id]/page.js`, 858 lines) has status management actions, send button, and ConvertToInvoiceDialog. Sidebar and LeadFlyout both have estimate entry points. |

**Score:** 7/7 truths verified

### Required Artifacts

All 31 planned artifacts exist and are substantive:

| Category | Artifact | Lines | Status |
|----------|----------|-------|--------|
| Schema | `supabase/migrations/030_estimates_schema.sql` | 146 | VERIFIED |
| Schema | `supabase/migrations/031_payment_log_schema.sql` | 42 | VERIFIED |
| Schema | `supabase/migrations/032_reminders_recurring.sql` | 49 | VERIFIED |
| Lib | `src/lib/estimate-number.js` | 25 | VERIFIED |
| Lib | `src/lib/payment-calculations.js` | 35 | VERIFIED |
| Lib | `src/lib/late-fee-calculations.js` | 39 | VERIFIED |
| Lib | `src/lib/recurring-calculations.js` | 47 | VERIFIED |
| Lib | `src/lib/estimate-pdf.jsx` | 361 | VERIFIED |
| API | `src/app/api/estimates/route.js` | 399 | VERIFIED |
| API | `src/app/api/estimates/[id]/route.js` | 302 | VERIFIED |
| API | `src/app/api/estimates/[id]/send/route.js` | 218 | VERIFIED |
| API | `src/app/api/estimates/[id]/convert/route.js` | 210 | VERIFIED |
| API | `src/app/api/invoices/[id]/payments/route.js` | 214 | VERIFIED |
| API | `src/app/api/cron/invoice-reminders/route.js` | 284 | VERIFIED |
| API | `src/app/api/cron/recurring-invoices/route.js` | 192 | VERIFIED |
| Page | `src/app/dashboard/estimates/page.js` | 322 | VERIFIED |
| Page | `src/app/dashboard/estimates/new/page.js` | 686 | VERIFIED |
| Page | `src/app/dashboard/estimates/[id]/page.js` | 858 | VERIFIED |
| Component | `src/components/dashboard/EstimateStatusBadge.jsx` | 20 | VERIFIED |
| Component | `src/components/dashboard/EstimateSummaryCards.jsx` | 64 | VERIFIED |
| Component | `src/components/dashboard/TierEditor.jsx` | 141 | VERIFIED |
| Component | `src/components/dashboard/PaymentLog.jsx` | 200 | VERIFIED |
| Component | `src/components/dashboard/RecordPaymentDialog.jsx` | 127 | VERIFIED |
| Component | `src/components/dashboard/ReminderToggle.jsx` | 85 | VERIFIED |
| Component | `src/components/dashboard/RecurringSetupDialog.jsx` | 148 | VERIFIED |
| Component | `src/components/dashboard/RecurringBadge.jsx` | 22 | VERIFIED |
| Email | `src/emails/InvoiceReminderEmail.jsx` | 229 | VERIFIED |
| Test | `tests/unit/estimate-calculations.test.js` | 19 | VERIFIED |
| Test | `tests/unit/payment-log.test.js` | 87 | VERIFIED |
| Test | `tests/unit/late-fee.test.js` | 88 | VERIFIED |
| Test | `tests/unit/recurring-schedule.test.js` | 42 | VERIFIED |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `030_estimates_schema.sql` | tenants table | FK on tenant_id | WIRED | `REFERENCES tenants(id)` present |
| `031_payment_log_schema.sql` | invoices table | FK on invoice_id | WIRED | `REFERENCES invoices(id)` present |
| estimates/page.js | /api/estimates | fetch in useEffect | WIRED | `fetch(url)` with `/api/estimates` URL confirmed |
| estimates/route.js | estimates table | supabase query | WIRED | `.from('estimates')` confirmed |
| payments/route.js | invoice_payments table | supabase query | WIRED | `.from('invoice_payments')` confirmed |
| payments/route.js | payment-calculations.js | import | WIRED | `import { calculatePaymentStatus }` confirmed |
| cron/invoice-reminders | invoice_reminders table | idempotency check | WIRED | `.from('invoice_reminders')` + `.upsert()` confirmed |
| cron/invoice-reminders | late-fee-calculations.js | import | WIRED | `import { calculateLateFee, shouldApplyLateFee }` confirmed |
| cron/recurring-invoices | invoices table | is_recurring_template query | WIRED | `.eq('is_recurring_template', true)` confirmed |
| cron/recurring-invoices | recurring-calculations.js | import | WIRED | `import { calculateNextDate }` confirmed |
| estimates/[id]/send | Resend + Twilio | import notifications | WIRED | `import { getResendClient, getTwilioClient }` confirmed |
| estimates/[id]/convert | invoices table | creates invoice | WIRED | `.from('invoices')` confirmed |
| DashboardSidebar | /dashboard/estimates | nav item | WIRED | Estimates nav link confirmed |
| LeadFlyout | /dashboard/estimates/new | Create Estimate button | WIRED | `router.push('/dashboard/estimates/new?lead_id=...')` confirmed |
| PaymentLog + ReminderToggle | invoice detail page | import | WIRED | Imported and rendered in `invoices/[id]/page.js` |
| RecurringBadge + RecurringSetupDialog | invoice pages | import | WIRED | Both imported and used in invoice list and detail pages |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit tests pass | `NODE_OPTIONS='--experimental-vm-modules' npx jest --roots tests/` | 4 suites, 26 tests all PASS | PASS |
| Cron configs registered | grep vercel.json | `invoice-reminders` at `0 9 * * *`, `recurring-invoices` at `0 8 * * *` | PASS |
| Estimate number formatting | via test: `formatEstimateNumber('EST', 2026, 1) === 'EST-2026-0001'` | Test passes | PASS |
| Payment status auto-calc | via test: `calculatePaymentStatus({total:500, payments:500}) => paid` | Test passes | PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| D-01 | 00,01,02,04 | Estimates are separate document type from invoices | SATISFIED | Separate `estimates` table, separate API routes, separate pages |
| D-02 | 00,01,02,04 | Optional good/better/best tiers | SATISFIED | `estimate_tiers` table, `TierEditor.jsx`, tier support in editor and PDF |
| D-03 | 04,05 | Estimates sent via email (PDF) and optional SMS | SATISFIED | Send endpoint uses Resend + Twilio, `estimate-pdf.jsx` generates PDF |
| D-04 | 01,02,05 | Manual status management (Approved/Declined/Expired) | SATISFIED | Status CHECK constraint, PATCH endpoint, detail page actions |
| D-05 | 05 | Convert approved estimate to draft invoice | SATISFIED | `/api/estimates/[id]/convert` endpoint, ConvertToInvoiceDialog in detail page |
| D-06 | 02,04,05 | Two entry points: LeadFlyout + standalone | SATISFIED | LeadFlyout "Create Estimate" button, Estimates section in sidebar |
| D-07 | 00,01,02 | Estimate numbering with EST prefix | SATISFIED | `estimate_sequences` table, `get_next_estimate_number` RPC, `formatEstimateNumber` |
| D-08 | 00,01,03 | Simple payment log (amount, date, note) | SATISFIED | `invoice_payments` table, payments API, RecordPaymentDialog |
| D-09 | 00,01,03 | Auto-status: partially_paid / paid | SATISFIED | `calculatePaymentStatus` pure function, auto-status in payments API |
| D-10 | 01,03 | Payment history list display | SATISFIED | `PaymentLog.jsx` component wired into invoice detail |
| D-11 | 06 | Fixed reminder schedule (-3, 0, +3, +7 days) | SATISFIED | Cron queries by day offset, 4 reminder types defined |
| D-12 | 01,06 | Toggle reminders per invoice | SATISFIED | `reminders_enabled` column, `ReminderToggle.jsx` component |
| D-13 | 06 | Escalating tone templates | SATISFIED | `REMINDER_CONFIG` in InvoiceReminderEmail with 4 tones |
| D-14 | 00,01,06 | Auto-calculated late fees (flat or percentage) | SATISFIED | `calculateLateFee` + `shouldApplyLateFee`, cron applies fees |
| D-15 | 01,06 | Owner can disable late fees globally | SATISFIED | `late_fee_enabled` in invoice_settings, settings page UI |
| D-16 | 00,01,07 | Recurring invoices for maintenance contracts | SATISFIED | Recurring columns on invoices, `RecurringSetupDialog` |
| D-17 | 00,01,07 | Auto-generate draft invoices (not auto-sent) | SATISFIED | Cron creates with `status: 'draft'`, `is_recurring_template: false` |
| D-18 | 01,07 | Recurring badge and separate template view | SATISFIED | `RecurringBadge.jsx`, "Recurring" filter tab in invoice list |

**All 18 requirements (D-01 through D-18) satisfied. No orphaned requirements.**

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No anti-patterns detected |

No TODO/FIXME/PLACEHOLDER/stub patterns found in any production files. All "placeholder" grep matches are HTML input placeholder attributes (expected).

### Human Verification Required

### 1. Estimate Editor Visual Layout

**Test:** Create a new estimate, toggle tier mode on/off, add line items to multiple tiers
**Expected:** Tier cards render correctly with separate line item sections, totals calculate per tier, removing last tier reverts to single-price mode
**Why human:** Visual layout and interactive tier toggling behavior cannot be verified programmatically

### 2. Estimate PDF Rendering

**Test:** Send an estimate with tiers, download/view the PDF
**Expected:** PDF shows tiered columns with proper formatting, business branding, and totals
**Why human:** PDF visual layout requires manual inspection

### 3. Payment Reminder Email Tone

**Test:** Trigger reminders for invoices at various stages relative to due date
**Expected:** Emails show escalating tone: friendly (-3 days) to firm (+7 days overdue)
**Why human:** Tone and email rendering quality require subjective evaluation

### 4. Convert to Invoice Flow

**Test:** Approve a tiered estimate, click "Convert to Invoice", select a tier
**Expected:** New draft invoice created with correct line items from selected tier, customer info carried over
**Why human:** End-to-end flow across multiple pages requires interactive testing

### Gaps Summary

No gaps found. All 31 artifacts exist, are substantive (non-stub), and are properly wired. All 18 requirements have implementation evidence. All 26 unit tests pass GREEN. Cron jobs are registered in vercel.json. Navigation and integration points (sidebar, LeadFlyout, invoice detail page) are confirmed wired.

---

_Verified: 2026-04-02T14:30:00Z_
_Verifier: Claude (gsd-verifier)_

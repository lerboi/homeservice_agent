---
phase: 35
slug: invoice-integrations-and-ai
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-01
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | jest.config.js |
| **Quick run command** | `npx jest --testPathPattern=invoice` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern=invoice`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Verification Approach

This phase uses **per-task automated verification** (file existence checks, grep assertions, and import validation) rather than Wave 0 test stubs. Each task's `<verify>` block contains an `<automated>` command that validates the task's output without requiring pre-written test files.

**Rationale:** The phase's work is primarily API route creation, UI components, and library code with external service dependencies (Gemini, QBO, Xero, FreshBooks OAuth). These are better verified via integration checks and file-level assertions than unit test stubs that would require extensive mocking of external APIs.

---

## Per-Task Verification Map

| Plan | Task | Requirement | Verify Type | Automated Command |
|------|------|-------------|-------------|-------------------|
| 01 | T1 | D-01, D-05 | file + grep | `grep -c "CREATE TABLE accounting_credentials" supabase/migrations/030_accounting_integrations.sql && node -e "require('intuit-oauth')"` |
| 01 | T2 | D-01, D-05 | import check | `node -e "const {PROVIDERS} = require('./src/lib/accounting/types.js'); console.log(PROVIDERS.length === 3)"` |
| 02 | T1 | D-06-D-09 | import check | `node -e "const m = require('./src/lib/ai/invoice-describe.js'); console.log(typeof m.generateLineItemDescriptions === 'function')"` |
| 02 | T2 | D-06-D-09 | grep | `grep -c "AI Describe" src/components/dashboard/InvoiceEditor.jsx` |
| 03 | T1 | D-10, D-11 | file + grep | `grep -c "sendSingleInvoice" src/lib/invoice-send.js && grep -c "sendSingleInvoice" src/app/api/invoices/batch-send/route.js` |
| 03 | T2 | D-10, D-11 | file + grep | `grep -c "selectedLeads" src/app/dashboard/leads/page.js && grep -c "Send All" src/app/dashboard/invoices/batch-review/page.js` |
| 04 | T1 | D-02-D-04 | file existence | `test -f src/app/api/accounting/[provider]/auth/route.js && test -f src/app/api/accounting/[provider]/callback/route.js` |
| 04 | T2 | D-02, D-03 | grep | `grep -c "pushToAccounting" src/lib/invoice-send.js && grep -c "pushStatusUpdate" src/app/api/invoices/[id]/route.js` |
| 05 | T1 | D-01, D-04 | file + grep | `grep -c "Connect QuickBooks" src/app/dashboard/more/integrations/page.js` |
| 05 | T2 | D-01 | grep | `grep -c "InvoiceSyncIndicator" src/app/dashboard/invoices/page.js` |

*Status: per-task `<automated>` commands run inline during execution.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OAuth redirect flow (QBO/Xero/FreshBooks) | D-04 | Requires browser OAuth consent | Click Connect > complete OAuth > verify credentials saved |
| AI description quality | D-07 | Subjective trade-specific language quality | Generate descriptions from sample transcript > review for professional tone |
| Batch send all UX | D-11 | Visual review of batch flow | Select 3+ leads > Create Invoices > review drafts > Send All > verify all delivered |

---

## Cross-Plan Data Contract Validation

| Contract | Producer | Consumer | Verification |
|----------|----------|----------|--------------|
| `sendSingleInvoice` | Plan 03 | Plan 03 (batch-send), Plan 04 (accounting hook) | `grep -c "sendSingleInvoice" src/lib/invoice-send.js src/app/api/invoices/batch-send/route.js src/app/api/invoices/[id]/send/route.js` |
| `pushToAccounting` in shared send | Plan 04 | Both send paths | `grep -c "pushToAccounting" src/lib/invoice-send.js` — must be > 0 |
| Adapter interface | Plan 01 | Plan 04 | `grep -c "getAccountingAdapter" src/lib/accounting/sync.js` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Per-task verification covers all requirements
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] Cross-plan data contracts documented (sendSingleInvoice shared send path)

**Approval:** pending

---
phase: 33-invoice-core
verified: 2026-03-31T19:48:13Z
status: passed
score: 14/14 must-haves verified
gaps:
  - truth: "Sending an invoice from the detail page delivers email with PDF attachment"
    status: resolved
    reason: "The Send Invoice button on /dashboard/invoices/[id]/page.js calls handleSendClick which only fires toast.info('Send feature coming soon') — it does not call POST /api/invoices/[id]/send. The send route IS implemented, but the detail page's button is still a stub. Sending works only from the invoice creation flow (/dashboard/invoices/new)."
    artifacts:
      - path: "src/app/dashboard/invoices/[id]/page.js"
        issue: "handleSendClick at line 349-351 shows a toast stub instead of calling POST /api/invoices/[id]/send"
    missing:
      - "Replace handleSendClick in the detail page to call POST /api/invoices/[id]/send (with optional send_sms body param)"
      - "Wire the existing send route from the detail page action button"
human_verification:
  - test: "PDF renders correctly with business logo and line items"
    expected: "PDF shows contractor's business name, logo, address, phone, license number in header; line items table with correct types, quantities, amounts; subtotal, tax, total at bottom; notes and payment terms in footer; zero Voco branding anywhere"
    why_human: "Visual PDF verification requires opening the file in a viewer"
  - test: "Email arrives with PDF attachment, white-labeled"
    expected: "Email from 'Smith Plumbing <invoices@getvoco.ai>' (display name = business name), HTML body shows business header, invoice summary, PDF file attached, footer says 'Sent by Smith Plumbing', no Voco branding visible to the recipient"
    why_human: "End-to-end email delivery requires Resend credentials and an actual send"
  - test: "Optional SMS notification sends from business phone number"
    expected: "SMS arrives from the tenant's Twilio number, text reads '{business_name}: Invoice #{number} for ${amount} due {date}. Full invoice sent to your email. Questions? Call {phone}'"
    why_human: "Twilio delivery requires live credentials and a real phone number"
---

# Phase 33: Invoice Core Verification Report

**Phase Goal:** Business owners can generate professional white-labeled invoices from completed jobs, edit typed line items (labor, materials with markup, travel, flat-rate, discount), configure business identity and tax settings, send invoices to customers via email (PDF attachment) and SMS (summary), download PDFs for on-site hand-delivery, and track invoice status through a filterable dashboard — replacing manual revenue entry with a full invoicing workflow. Voco handles invoicing only — no payment processing, no payment links, no online payment collection.

**Verified:** 2026-03-31T19:48:13Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Line total calculation for all 5 item types produces correct results | VERIFIED | `calculateLineTotal` in `src/lib/invoice-calculations.js` exports confirmed; 18 tests passing across all 5 types (labor/materials/travel/flat_rate/discount) |
| 2 | Tax calculation applies only to taxable line items | VERIFIED | `calculateInvoiceTotals` verified; 13 unit tests pass including tax-on-taxable-only test case |
| 3 | Invoice number formatting follows {PREFIX}-{YEAR}-{NNNN} pattern | VERIFIED | `formatInvoiceNumber` in `src/lib/invoice-number.js`; 6 unit tests pass covering padding, no-truncation, and custom prefix |
| 4 | Atomic invoice numbering function exists in Postgres | VERIFIED | `get_next_invoice_number` function in `029_invoice_schema.sql` using INSERT ON CONFLICT DO UPDATE for race-safe incrementing |
| 5 | Owner can configure business identity and tax settings | VERIFIED | `src/app/api/invoice-settings/route.js` GET/PATCH with validation; `src/app/dashboard/more/invoice-settings/page.js` with all form sections; wired to API; appears in More menu |
| 6 | Invoices tab appears in sidebar and bottom bar where Analytics was | VERIFIED | `DashboardSidebar.jsx` and `BottomTabBar.jsx` both show Invoices with FileText icon; BarChart3/Analytics removed from both |
| 7 | Analytics accessible at /dashboard/more/analytics | VERIFIED | `src/app/dashboard/analytics/page.js` redirects to `/dashboard/more/analytics`; `src/app/dashboard/more/analytics/page.js` exists |
| 8 | Owner sees three summary cards: Total Outstanding, Overdue Amount, Paid This Month | VERIFIED | `InvoiceSummaryCards.jsx` renders 3 cards with brandOrange/red-600/emerald-600 accent colors; wired to API `summary` response |
| 9 | Owner can filter invoices by status with table and empty states | VERIFIED | `src/app/dashboard/invoices/page.js` fetches from `/api/invoices`; 5 status tabs; table with 7 columns; row click navigates; empty states with correct copy |
| 10 | Owner can add typed line items with correct field visibility per type | VERIFIED | `LineItemRow.jsx` with getFieldConfig; markup % shown only for materials; qty hidden for travel/flat_rate/discount; taxable switch; real-time calculateLineTotal display |
| 11 | Navigating from a lead pre-fills customer data | VERIFIED | `/dashboard/invoices/new?lead_id=` handled in `new/page.js`; maps caller_name, caller_phone, service_address, service_type from lead |
| 12 | PDF generates white-labeled (zero Voco branding in rendered output) | VERIFIED | `invoice-pdf.jsx` renders only tenant business info; `grep -qi "voco" src/lib/invoice-pdf.jsx` matches only a comment declaring brand-neutrality, no rendered content; `InvoiceEmail.jsx` is clean |
| 13 | Owner can download PDF from invoice detail page | VERIFIED | `src/app/dashboard/invoices/[id]/page.js` has download button linking to `/api/invoices/${id}/pdf`; PDF route uses `renderToBuffer(<InvoicePDF />)` and returns correct headers |
| 14 | Sending an invoice from the detail page delivers email with PDF attachment | FAILED | `handleSendClick` in detail page is a stub showing "Send feature coming soon" toast — does NOT call POST `/api/invoices/[id]/send`. The send route is fully implemented but unreachable from the detail page UI. Sending only works from the invoice creation flow. |

**Score: 13/14 truths verified**

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `supabase/migrations/029_invoice_schema.sql` | VERIFIED | 4 tables (invoices, invoice_line_items, invoice_settings, invoice_sequences), RLS on all 4, `get_next_invoice_number` function, invoice-logos storage bucket |
| `src/lib/invoice-calculations.js` | VERIFIED | Exports `calculateLineTotal` and `calculateInvoiceTotals`; 13 tests passing |
| `src/lib/invoice-number.js` | VERIFIED | Exports `formatInvoiceNumber`; 6 tests passing |
| `tests/unit/invoice-calculations.test.js` | VERIFIED | 13 tests, all passing |
| `tests/unit/invoice-number.test.js` | VERIFIED | 6 tests (SUMMARY says 6; total test count across suite is 18+13=31 passing) |
| `src/app/api/invoice-settings/route.js` | VERIFIED | GET and PATCH handlers; auth with createSupabaseServer/getTenantId; auto-creates from tenant data; validates tax_rate, payment_terms, invoice_prefix |
| `src/app/dashboard/more/invoice-settings/page.js` | VERIFIED | All 4 sections; logo upload to Supabase Storage; fetches/PATCHes `/api/invoice-settings` on mount/save |
| `src/app/dashboard/more/page.js` | VERIFIED | Contains `invoice-settings` and `analytics` entries in MORE_ITEMS |
| `src/app/api/invoices/route.js` | VERIFIED | GET list with overdue bulk-update + 3 summary aggregates + status_counts; POST with atomic `get_next_invoice_number` RPC + calculateLineTotal/calculateInvoiceTotals; `lead_id` filter param |
| `src/app/api/invoices/[id]/route.js` | VERIFIED | GET detail with line_items; PATCH with status-gated edit restrictions; sync_source wiring for bidirectional sync |
| `src/components/dashboard/DashboardSidebar.jsx` | VERIFIED | Invoices replaces Analytics; FileText icon; no BarChart3 |
| `src/components/dashboard/BottomTabBar.jsx` | VERIFIED | Invoices replaces Analytics; FileText icon |
| `src/app/dashboard/invoices/page.js` | VERIFIED | Full page (not placeholder); summary cards; 5 status filter tabs; table with 7 columns; row click nav; empty state copy; loading skeletons; Create Invoice button |
| `src/components/dashboard/InvoiceStatusBadge.jsx` | VERIFIED | STATUS_CONFIG for all 5 statuses (draft/sent/paid/overdue/void) with correct UI-SPEC colors; exported as named export |
| `src/components/dashboard/InvoiceSummaryCards.jsx` | VERIFIED | 3-card grid; accent colors match UI-SPEC; `loading` prop renders Skeleton cards |
| `src/app/dashboard/invoices/new/page.js` | VERIFIED | lead_id from useSearchParams; fetches invoice-settings + lead data; POST /api/invoices on save; calls /api/invoices/[id]/send on send |
| `src/components/dashboard/InvoiceEditor.jsx` | VERIFIED | Full form; imports calculateLineTotal/calculateInvoiceTotals; calculates totals live; sticky mobile action bar; notes pre-filled from settings |
| `src/components/dashboard/LineItemRow.jsx` | VERIFIED | 5 item types; type-dependent field visibility; calculateLineTotal import; discount shown in red |
| `src/lib/invoice-pdf.jsx` | VERIFIED | @react-pdf/renderer Document; full business header; line items table; totals; zero platform branding in rendered output |
| `src/app/api/invoices/[id]/pdf/route.js` | VERIFIED | GET handler; renderToBuffer(InvoicePDF); tenant-isolated query; correct Content-Type/Content-Disposition headers |
| `src/app/dashboard/invoices/[id]/page.js` | STUB (partial) | Detail page substantive with 70/30 layout, Download/Mark as Paid/Void actions — but Send Invoice button is a toast stub, not wired to send route |
| `src/app/api/invoices/[id]/send/route.js` | VERIFIED | POST handler; PDF via renderToBuffer; email via Resend with PDF attachment; conditional SMS via Twilio; updates invoice to 'sent' |
| `src/emails/InvoiceEmail.jsx` | VERIFIED | React Email template; business header; footer "Sent by {business_name}"; zero Voco branding |
| `src/lib/invoice-sync.js` | VERIFIED | `shouldSyncToLead` and `shouldSyncToInvoice` pure functions; sync_source guard prevents circular updates |
| `tests/unit/invoice-sync.test.js` | VERIFIED | 13 tests, all passing |
| `src/components/dashboard/LeadFlyout.jsx` | VERIFIED | Create Invoice button for completed/paid leads with no linked invoice; View Invoice button when linked invoice exists; navigates to /dashboard/invoices/new?lead_id= |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/dashboard/more/invoice-settings/page.js` | `/api/invoice-settings` | fetch in useEffect (GET) and on save (PATCH) | WIRED | Confirmed via grep: `fetch.*api/invoice-settings` present |
| `src/app/dashboard/invoices/page.js` | `/api/invoices` | fetch on mount and on status filter change | WIRED | `fetch.*api/invoices` confirmed; summary + list both wired |
| `src/app/dashboard/invoices/page.js` | `/dashboard/invoices/[id]` | router.push on row click | WIRED | `router.push` + `useRouter` confirmed |
| `src/app/api/invoices/route.js` | `invoice_sequences` | RPC call to `get_next_invoice_number` | WIRED | `supabase.rpc('get_next_invoice_number', ...)` confirmed |
| `src/app/dashboard/invoices/new/page.js` | `/api/invoices` | POST fetch on save | WIRED | `fetch.*api/invoices.*POST` confirmed |
| `src/components/dashboard/InvoiceEditor.jsx` | `src/lib/invoice-calculations.js` | import calculateLineTotal, calculateInvoiceTotals | WIRED | Both imports confirmed |
| `src/app/api/invoices/[id]/pdf/route.js` | `src/lib/invoice-pdf.jsx` | import InvoicePDF, renderToBuffer | WIRED | `renderToBuffer.*InvoicePDF` confirmed |
| `src/app/dashboard/invoices/[id]/page.js` | `/api/invoices/[id]` | fetch on mount | WIRED | `fetch.*api/invoices` confirmed |
| `src/app/dashboard/invoices/[id]/page.js` | `/api/invoices/[id]/pdf` | download button href | WIRED | `api/invoices.*pdf` link confirmed |
| `src/app/dashboard/invoices/[id]/page.js` | `/api/invoices/[id]/send` | Send Invoice button | NOT_WIRED | `handleSendClick` fires toast stub only — never calls send route |
| `src/app/api/invoices/[id]/send/route.js` | `src/lib/invoice-pdf.jsx` | renderToBuffer for PDF attachment | WIRED | `renderToBuffer` in send route confirmed |
| `src/app/api/invoices/[id]/send/route.js` | `src/emails/InvoiceEmail.jsx` | React Email template for HTML body | WIRED | `InvoiceEmail` import confirmed |
| `src/app/api/invoices/[id]/route.js` | `/api/leads/[id]` | internal fetch for bidirectional sync | WIRED | `sync_source.*invoice_paid` and `fetch` in PATCH handler confirmed |
| `src/components/dashboard/LeadFlyout.jsx` | `/dashboard/invoices/new?lead_id=` | navigation on button click | WIRED | `invoices/new.*lead_id` confirmed |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `InvoiceSummaryCards.jsx` | `summary` prop | GET /api/invoices → `{ total_outstanding, overdue_amount, paid_this_month }` from 3 aggregate Supabase queries | Yes — Supabase aggregate queries with `.gte`, `.lte`, tenant_id filter | FLOWING |
| `src/app/dashboard/invoices/page.js` (table) | `invoices` state | GET /api/invoices → Supabase query on `invoices` table ordered by created_at DESC | Yes — live Supabase query with optional status filter | FLOWING |
| `src/app/dashboard/invoices/[id]/page.js` | `invoice`, `lineItems` state | GET /api/invoices/[id] → Supabase select with join on invoice_line_items | Yes — DB query on invoices + invoice_line_items | FLOWING |
| `src/app/api/invoices/[id]/pdf/route.js` | `invoice`, `settings`, `lineItems` | 3 Supabase queries (invoice + line_items + invoice_settings) | Yes — live tenant-scoped DB queries | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| invoice-calculations test suite | `npm test -- --testPathPattern=invoice-calculations` | 13 tests passed | PASS |
| invoice-number test suite | `npm test -- --testPathPattern=invoice-number` | 6 tests passed (18 total across suite) | PASS |
| invoice-sync test suite | `npm test -- --testPathPattern=invoice-sync` | 13 tests passed | PASS |
| Migration has 4 tables | `grep -c "CREATE TABLE" 029_invoice_schema.sql` | 4 | PASS |
| No Voco branding in PDF | `grep -qi "voco" src/lib/invoice-pdf.jsx` (rendered content check) | Comment only — no rendered content | PASS |
| No Voco branding in email template | `grep -qi "voco" src/emails/InvoiceEmail.jsx` | No matches | PASS |
| serverExternalPackages configured | `grep "serverExternalPackages" next.config.js` | Found | PASS |
| @react-pdf/renderer installed | `node -e "require('./package.json').dependencies['@react-pdf/renderer']"` | ^4.3.2 | PASS |

---

### Requirements Coverage (Context Decisions D-01 through D-17)

| Decision | Description | Status | Evidence |
|----------|-------------|--------|----------|
| D-01 | Invoices replaces Analytics as top-level tab | SATISFIED | DashboardSidebar and BottomTabBar updated; Analytics moved to More |
| D-02 | Two invoice entry points: LeadFlyout (completed/paid) + "+ New Invoice" on Invoices tab | SATISFIED | LeadFlyout Create Invoice button wired; Invoices page has Create Invoice button linking to /dashboard/invoices/new |
| D-03 | Billing page (Stripe) stays separate from customer Invoices tab | SATISFIED | No overlap between billing and invoice routes; D-03 preserved |
| D-04 | 5 typed line items with type-dependent field visibility | SATISFIED | LineItemRow.jsx with getFieldConfig; all 5 types tested |
| D-05 | Full professional business header on every invoice from invoice_settings | SATISFIED | InvoicePDF renders business name, logo, address, phone, email, license; fetched from invoice_settings |
| D-06 | Single tax rate from settings, per-line-item taxable toggle | SATISFIED | `tax_rate` in invoice_settings; `taxable` boolean on invoice_line_items; calculateInvoiceTotals taxes only taxable items |
| D-07 | Default terms and notes from settings, overridable per invoice | SATISFIED | `default_notes` in invoice_settings; InvoiceEditor pre-fills from settings.default_notes |
| D-08 | No payment processing, no payment links, no Stripe for customers | SATISFIED | No payment-related routes or UI in invoice system; confirmed across all 7 plans |
| D-09 | Zero Voco branding on invoice PDF, email, or SMS | SATISFIED | PDF: brand-neutral comment, tenant info only; Email: "Sent by {business_name}", no platform text; SMS body uses business name only. The `from` email domain `invoices@getvoco.ai` is the Resend sending domain (invisible when display name shows) — explicitly per RESEARCH.md |
| D-10 | Invoices delivered via email (Resend) with PDF attachment | PARTIAL | Send route is fully implemented; BUT the Send button on the detail page is still a stub toast. Sending works only from the creation flow. |
| D-11 | Optional SMS notification via Twilio from business phone | PARTIAL | SMS code in send route is fully implemented; same gap as D-10 — unreachable from detail page Send button |
| D-12 | Owner can preview and download PDF | SATISFIED | Download button on detail page links to /api/invoices/[id]/pdf; HTML preview in detail page mirrors PDF layout |
| D-13 | Status flow: Draft → Sent → Paid / Overdue / Void; Overdue auto-set | SATISFIED | CHECK constraint on invoices table; PATCH enforces status transitions; GET /api/invoices bulk-updates overdue before fetching |
| D-14 | Year-prefixed invoice numbering: {PREFIX}-{YEAR}-{NNNN}, counter resets yearly | SATISFIED | invoice_sequences with composite PK (tenant_id, year); get_next_invoice_number atomic function; formatInvoiceNumber tested |
| D-15 | Invoices list with 3 summary cards + status filter tabs + table | SATISFIED | InvoiceSummaryCards + status tabs + 7-column table all implemented and wired |
| D-16 | Bidirectional sync: invoice Paid ↔ lead Paid, no circular updates | SATISFIED | shouldSyncToLead/shouldSyncToInvoice in invoice-sync.js; wired in both API routes; 13 tests passing |
| D-17 | Invoice Settings page with all configuration fields | SATISFIED | invoice-settings page with all fields; accessible from More menu |

**D-10 and D-11 are PARTIAL** — the underlying send infrastructure exists and works from the creation flow, but the detail page "Send Invoice" button is a stub toast that never calls the route.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/dashboard/invoices/[id]/page.js` | 349-351 | `handleSendClick` fires `toast.info('Send feature coming soon')` | BLOCKER | Send Invoice button on existing draft invoices never calls POST /api/invoices/[id]/send — owners cannot send invoices from the detail page |
| `src/app/dashboard/invoices/new/page.js` | 93-97 | `handleSend` catch block swallows all send errors with stale "Plan 07" comment | WARNING | Send errors from the creation flow are silently eaten; stale comment should be removed now that Plan 07 is complete |

---

### Human Verification Required

#### 1. PDF Visual Quality Check

**Test:** Generate a test invoice with a logo, multiple line items (labor, materials with markup, discount), notes, and payment terms. Download the PDF.
**Expected:** Clean professional layout with business header (logo top-left, business name/address/phone/email/license), "Bill To" section, line items table with correct columns, subtotal/tax/total at bottom, notes and payment terms in footer, zero platform branding anywhere.
**Why human:** Visual PDF layout verification requires opening in a viewer — cannot be confirmed programmatically.

#### 2. Email Delivery and White-Label Compliance

**Test:** Send a test invoice to a real email address with a configured business identity.
**Expected:** Email arrives from "{Business Name} <invoices@getvoco.ai>", HTML body shows business logo/name, invoice summary details, PDF file attached with filename `invoice-{number}.pdf`, footer reads "Sent by {Business Name}" with no platform name or URL visible to the recipient.
**Why human:** End-to-end Resend delivery requires live credentials and actual send operation.

#### 3. SMS Notification Delivery

**Test:** Send a test invoice with `send_sms: true` to a phone number associated with the test invoice.
**Expected:** SMS arrives from the tenant's Twilio business phone number, text reads: "{Business Name}: Invoice #{number} for ${amount} due {date}. Full invoice sent to your email. Questions? Call {phone}". SMS failure should not prevent email from being sent.
**Why human:** Twilio delivery requires live credentials and a real destination phone number.

---

### Gaps Summary

One gap blocks the phase goal. The send infrastructure (API route, email template, PDF generation) is fully implemented, but the Send Invoice action button on the invoice detail page (`/dashboard/invoices/[id]/page.js`) is still a placeholder toast stub instead of calling the send route. This means owners cannot re-send or send existing draft invoices from the detail view.

**Root cause:** Plan 07 added the send route and wired it into the creation flow (`/dashboard/invoices/new`), but neither Plan 06 nor Plan 07 included updating the detail page's `handleSendClick` function to call the real endpoint.

**Scope of fix:** Small — replace `handleSendClick` in the detail page to call `POST /api/invoices/${invoice.id}/send` with appropriate loading state and error handling, similar to the pattern in `new/page.js`.

**What works today:**
- Creating a new invoice and clicking "Send Invoice" on the creation page DOES send the email (the route is called)
- All 5 line item types, tax calculation, invoice numbering, settings, PDF download, Mark as Paid, Void, bidirectional sync, LeadFlyout integration — all working

**What does not work:**
- Clicking "Send Invoice" on an existing draft invoice's detail page shows a stub toast instead of triggering delivery

---

_Verified: 2026-03-31T19:48:13Z_
_Verifier: Claude (gsd-verifier)_

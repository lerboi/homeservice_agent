# Phase 33: Invoice Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 33-invoice-core
**Areas discussed:** Navigation & page placement, Invoice content & line items, Customer payment experience, Invoice lifecycle & status

---

## Navigation & Page Placement

| Option | Description | Selected |
|--------|-------------|----------|
| New top-level sidebar tab | Add 'Invoices' as a 6th tab. Invoicing is daily-use. Competitors make it top-level. | |
| Under More as config section | Add under /dashboard/more/invoicing. Keeps sidebar clean but buries daily-use feature. | |
| Replace Analytics tab | Swap Analytics to More, put Invoices in its place. Keeps 5 tabs. | ✓ |

**User's choice:** Replace Analytics tab
**Notes:** Keeps navigation at 5 tabs. Analytics is weekly/monthly; invoicing is daily. Analytics moves under More.

---

### Invoice creation trigger

| Option | Description | Selected |
|--------|-------------|----------|
| From LeadFlyout + Invoices tab | "Create Invoice" in LeadFlyout when Completed/Paid. Also standalone creation from Invoices tab. | ✓ |
| Auto-generate on status change | Draft auto-created when lead moves to Completed. | |
| Invoices tab only | All creation from Invoices tab. Manual entry. | |

**User's choice:** From LeadFlyout + Invoices tab
**Notes:** Pre-fills from lead data. Standalone creation also available for non-lead work.

---

### Billing vs Invoices relationship

| Option | Description | Selected |
|--------|-------------|----------|
| Keep separate | Billing = YOUR Voco subscription. Invoices = invoices YOU send to customers. | ✓ |
| Merge into one Billing hub | Combine subscription billing and customer invoicing. | |

**User's choice:** Keep separate
**Notes:** Completely different audiences and data.

---

## Invoice Content & Line Items

### Line item structure

| Option | Description | Selected |
|--------|-------------|----------|
| Typed line items with markup | Labor, Materials (with markup %), Travel, Flat Rate, Discount. Full home service billing. | ✓ |
| Simple description + amount | Just description and dollar amount. No types or markup. | |
| Flat rate only | Single line item per invoice. | |

**User's choice:** Typed line items with markup
**Notes:** Covers all home service billing models (T&M and flat rate).

---

### Business info on invoice

| Option | Description | Selected |
|--------|-------------|----------|
| Full professional header | Business name, logo, address, phone, email, license number. One-time setup in settings. | ✓ |
| Minimal header | Business name and phone only. | |
| You decide | Claude picks. | |

**User's choice:** Full professional header
**Notes:** Many states require license # on invoices. Logo upload via Supabase Storage.

---

### Tax handling

| Option | Description | Selected |
|--------|-------------|----------|
| Single tax rate in settings | One rate, per-line-item taxable toggle. Materials taxable, labor often exempt. | ✓ |
| No tax handling | Owner handles manually. | |
| You decide | Claude picks. | |

**User's choice:** Single tax rate in settings
**Notes:** Simple and covers the most common scenario.

---

## Customer Payment Experience

### CRITICAL CORRECTION — No payment processing

**User correction during discussion:** Voco handles invoicing ONLY. No payment processing, no payment links, no Stripe Checkout for customer payments, no online payment collection. The customer pays the contractor directly. This applies to the entire invoice system — Phase 33, 34, and 35.

### CRITICAL CORRECTION — No Voco branding

**User correction during discussion:** All invoices must be fully white-labeled. No Voco name, logo, links, or URLs anywhere on the invoice, email, or SMS. The customer sees only the contractor's business identity.

---

### Invoice delivery

| Option | Description | Selected |
|--------|-------------|----------|
| Email + SMS, white-labeled | Resend email with PDF + Twilio SMS with summary. All contractor branding. No Voco anywhere. | ✓ |
| Email only | Professional email with PDF. No SMS. | |
| You decide | Claude picks. | |

**User's choice:** Email + SMS, white-labeled
**Notes:** SMS says "check your email for the full invoice." No links in SMS.

---

### Online invoice view page

| Option | Description | Selected |
|--------|-------------|----------|
| PDF attachment only | Invoice as PDF attached to email. No online viewing page. | ✓ |
| PDF + online view page | PDF + browser-viewable page. Useful for SMS but requires public page. | |
| You decide | Claude picks. | |

**User's choice:** PDF attachment only
**Notes:** No public-facing pages. Fully white-labeled since no hosted URL.

---

### SMS content

| Option | Description | Selected |
|--------|-------------|----------|
| Summary + "check your email" | Brief summary + tells customer to check email for PDF. No links. | ✓ |
| Summary only | Just invoice summary. | |
| Skip SMS for invoices | Email only. | |

**User's choice:** Summary + "check your email"
**Notes:** No links in SMS. Business phone number as contact.

---

### PDF design

| Option | Description | Selected |
|--------|-------------|----------|
| Clean professional template | Standard contractor layout. Business header, customer info, line items table, totals, terms. | ✓ |
| You decide | Claude designs. | |

**User's choice:** Clean professional template

---

### PDF download from dashboard

| Option | Description | Selected |
|--------|-------------|----------|
| Download + preview in dashboard | Owner can preview and download PDF for records/printing/hand-delivery. | ✓ |
| Send only, no download | Only send to customer. | |

**User's choice:** Download + preview in dashboard
**Notes:** Essential for on-site jobs where contractor hands paper invoice to homeowner.

---

## Invoice Lifecycle & Status

### Status flow

| Option | Description | Selected |
|--------|-------------|----------|
| Draft → Sent → Paid + Overdue + Void | Simple 3-step with terminal states. Owner marks Paid manually. Overdue auto-set past due date. | ✓ |
| Draft → Sent → Viewed → Paid | Adds Viewed status via email tracking. More complex. | |
| You decide | Claude picks. | |

**User's choice:** Draft → Sent → Paid + Overdue + Void
**Notes:** No email open tracking needed. Owner marks Paid when payment received offline.

---

### Invoice numbering

| Option | Description | Selected |
|--------|-------------|----------|
| Prefix + auto-increment | INV-0001, INV-0002. Never resets. Customizable prefix. | |
| Year-prefixed numbering | INV-2026-0001. Resets each year. Customizable prefix. | ✓ |
| You decide | Claude picks. | |

**User's choice:** Year-prefixed numbering
**Notes:** Helps with annual bookkeeping. Resets to 0001 each January.

---

### List view design

| Option | Description | Selected |
|--------|-------------|----------|
| Filterable table with status tabs | Summary cards (Outstanding, Overdue, Paid) + status tabs + table rows. | ✓ |
| Simple list, no summary cards | Just table with filters. | |
| You decide | Claude designs. | |

**User's choice:** Filterable table with status tabs
**Notes:** Summary cards give at-a-glance receivables insight.

---

### Lead-invoice bidirectional sync

| Option | Description | Selected |
|--------|-------------|----------|
| Bidirectional sync | Invoice Paid → Lead Paid (with revenue). Lead Paid → Invoice Paid. | ✓ |
| Invoice → Lead only (one-way) | Invoice Paid updates lead. Not vice versa. | |
| No sync | Independent statuses. | |

**User's choice:** Bidirectional sync
**Notes:** Use a flag to prevent circular update loops.

---

## Claude's Discretion

- PDF generation library
- Email template design
- Invoice detail view layout (flyout vs full page)
- Summary card design
- Overdue status check mechanism
- Database schema design
- PDF storage strategy
- Invoice editor UX
- "Create Invoice" button placement in LeadFlyout

## Deferred Ideas

- Estimates/quotes (Phase 34)
- Automated payment reminders (Phase 34)
- Late fees (Phase 34)
- Deposit/partial payments (Phase 34)
- Digital signatures (Phase 34)
- Recurring invoices (Phase 34)
- QuickBooks/Xero sync (Phase 35)
- AI work descriptions from transcripts (Phase 35)
- Batch invoicing (Phase 35)
- Customer financing (Phase 35 — may be removed given no-payment constraint)
- Online invoice view page (deferred)
- Email open tracking / Viewed status (deferred)

# Phase 34: Estimates, Reminders, and Recurring Invoices - Research

**Researched:** 2026-04-01
**Domain:** Invoice system extension (estimates, payment tracking, automated reminders, recurring generation)
**Confidence:** HIGH

## Summary

Phase 34 extends the Phase 33 invoice core with four sub-systems: (1) estimates with optional good/better/best tiers, (2) a simple payment log for partial payments with auto-calculated balance, (3) automated payment reminders on a fixed schedule with late fee auto-application, and (4) recurring invoice templates that auto-generate draft invoices on a schedule.

The existing invoice infrastructure is mature and well-structured. The Phase 33 foundation provides reusable patterns for every sub-system: line item calculations (`invoice-calculations.js`), atomic numbering (`get_next_invoice_number` RPC), PDF generation (`@react-pdf/renderer`), email/SMS delivery (`getResendClient`/`getTwilioClient` from `notifications.js`), and status badge rendering (`STATUS_CONFIG` export). The cron infrastructure for reminders/recurring is already proven via `trial-reminders` (Vercel cron + CRON_SECRET auth + idempotency table pattern).

**Primary recommendation:** Build estimates as a parallel document type (own table, own sequences, own API routes) that reuses invoice-level components (InvoiceEditor for line items, invoice-calculations.js for totals, invoice-pdf.jsx pattern for PDF). Payment log, reminders, and recurring are extensions to existing invoice tables/routes. Use cron jobs for both reminder dispatch and recurring invoice generation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Estimates are a separate document type from invoices. An estimate is "here's what the job will cost" (before work). An invoice is "here's what you owe" (after work). Both share the same line item structure from Phase 33.
- **D-02:** Tiers (good/better/best) are OPTIONAL. Owner can create a simple single-price estimate OR add up to 3 tiers. Each tier has its own set of line items and total.
- **D-03:** Estimates are sent via email (Resend, PDF attachment) and optional SMS (Twilio, summary text) — same delivery infrastructure as Phase 33 invoices. Fully white-labeled.
- **D-04:** No online approval page. Owner manually marks an estimate as "Approved" in the dashboard after verbal/text/phone confirmation from the customer. Status flow: Draft -> Sent -> Approved / Declined / Expired.
- **D-05:** "Convert to Invoice" button on an approved estimate creates a new draft invoice pre-filled with the approved tier's line items and customer info. The estimate remains in history as a separate record. If single-price (no tiers), converts directly.
- **D-06:** Estimates are created from two entry points: (1) "Create Estimate" in LeadFlyout (pre-fills customer info from lead), (2) "+ New Estimate" on the Estimates section/tab for standalone quotes.
- **D-07:** Estimate numbering follows the same pattern as invoices: {PREFIX}-{YEAR}-{NNNN}. Default prefix "EST". Separate sequence counter from invoices.
- **D-08:** Simple payment log — no formal deposit system. "Record Payment" button on any invoice. Owner enters amount + date + optional note (e.g., "check #4521", "cash"). Balance auto-calculates (total minus sum of payments).
- **D-09:** Invoice status becomes "Partially Paid" when payments exist but balance > 0. Becomes "Paid" when balance reaches 0. Existing "Paid" manual toggle from Phase 33 still works as a quick-mark for full payment.
- **D-10:** Payment history displayed as a simple list on the invoice detail view — date, amount, note per entry.
- **D-11:** Fixed automated reminder schedule: 3 days before due date, on due date, 3 days overdue, 7 days overdue. Sent via email and SMS (same channels as original invoice delivery).
- **D-12:** Owner can toggle reminders on/off per invoice. Default is ON for sent invoices with a due date.
- **D-13:** Standard white-labeled reminder templates with escalating tone (friendly -> firm). Owner does NOT customize template text. Templates use business name, invoice number, amount due, and due date.
- **D-14:** Auto-calculated late fees configured in invoice settings: owner sets either a flat amount (e.g., $25) or percentage per month (e.g., 1.5%). When an invoice goes overdue, system auto-adds a late fee line item. Late fee appears on subsequent reminders.
- **D-15:** Owner can disable late fees globally in invoice settings (default: off). When enabled, applies to all overdue invoices unless manually removed from a specific invoice.
- **D-16:** Recurring invoices are for maintenance contracts (e.g., monthly HVAC filter service, quarterly pest control). Owner sets up a recurring schedule on an invoice: frequency (weekly/monthly/quarterly/annually) + start date + optional end date.
- **D-17:** System auto-generates a new draft invoice from the recurring template on each scheduled date. Owner reviews and sends (not auto-sent — owner stays in control).
- **D-18:** Recurring invoices appear in the invoice list with a recurring badge. The "parent" template is viewable separately from generated instances.

### Claude's Discretion
- Database schema for estimates table (reuse invoice_line_items or separate table)
- Whether estimates get their own tab or live as a sub-section of Invoices
- Cron job vs on-page-load approach for reminder scheduling and late fee application
- Recurring invoice generation mechanism (cron vs on-demand check)
- PDF layout for tiered estimates (column layout rendering)
- Reminder email template design (React Email or plain HTML)
- How late fee line items are visually distinguished from regular line items

### Deferred Ideas (OUT OF SCOPE)
- Online estimate approval page
- Digital signature capture on estimates
- Customer financing integration (Wisetack/Hearth)
- Customizable reminder templates
- Email open tracking / "Viewed" status
- Estimate expiry automation
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| D-01 | Estimates as separate document type | Separate `estimates` table with own columns; reuse `invoice_line_items`-pattern table as `estimate_line_items` |
| D-02 | Optional good/better/best tiers | `estimate_tiers` table with tier_label + own line items per tier; single-price = no tier rows |
| D-03 | Email + SMS delivery for estimates | Reuse `getResendClient`/`getTwilioClient` from `notifications.js`; same pattern as `invoices/[id]/send/route.js` |
| D-04 | Manual approval status flow | Estimate status CHECK constraint: draft/sent/approved/declined/expired; PATCH endpoint for status transitions |
| D-05 | Convert to Invoice button | API endpoint that reads estimate + selected tier line items, calls invoice POST to create draft invoice |
| D-06 | Two entry points for estimates | LeadFlyout button + `/dashboard/estimates/new` page; `?lead_id=` query param for pre-fill |
| D-07 | Estimate numbering (EST prefix) | Replicate `get_next_invoice_number` RPC as `get_next_estimate_number`; separate `estimate_sequences` table |
| D-08 | Simple payment log | `invoice_payments` table (invoice_id, amount, payment_date, note); balance = total - SUM(payments) |
| D-09 | Partially Paid status | Add `partially_paid` to invoices status CHECK; auto-compute on payment record/delete |
| D-10 | Payment history display | GET endpoint returns payments list; UI renders in invoice detail right column |
| D-11 | Fixed reminder schedule | Cron job at `0 9 * * *` checks all sent/overdue invoices against 4 reminder points; `invoice_reminders` table for idempotency |
| D-12 | Per-invoice reminder toggle | `reminders_enabled` boolean column on invoices table (default true) |
| D-13 | White-labeled reminder templates | React Email templates with escalating tone; copy from UI-SPEC copywriting contract |
| D-14 | Auto-calculated late fees | Cron job checks overdue invoices; inserts late fee line item; `late_fee_applied_at` column for idempotency |
| D-15 | Global late fee settings | Add `late_fee_enabled`, `late_fee_type`, `late_fee_amount` columns to `invoice_settings` |
| D-16 | Recurring invoice setup | `recurring_config` JSONB column on invoices (frequency, start_date, end_date, next_generate_date, active) |
| D-17 | Auto-generate draft invoices | Cron job checks `next_generate_date <= today` for active recurring; creates draft invoice; advances next date |
| D-18 | Recurring badge and template view | `is_recurring_template` boolean + `generated_from_id` UUID FK on invoices; filter tabs in invoice list |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @react-pdf/renderer | (in project) | Estimate PDF generation | Already used for invoice PDFs; extend for tiered layout |
| resend | (in project) | Reminder + estimate email delivery | Already configured with `getResendClient()` |
| twilio | (in project) | Reminder + estimate SMS delivery | Already configured with `getTwilioClient()` |
| date-fns | (in project) | Date arithmetic for reminders, recurring schedule | Standard for date calculations in JS |
| sonner | (in project) | Toast notifications for payment recorded, etc. | Already the project's toast library |
| lucide-react | (in project) | Icons (ClipboardList, Repeat, Trash2, etc.) | Already the project's icon library |

### No New Dependencies Required

This phase uses only existing project dependencies. No new packages need to be installed.

## Architecture Patterns

### Recommended Project Structure
```
supabase/migrations/
  030_estimates_schema.sql       # estimates, estimate_line_items, estimate_tiers, estimate_sequences, get_next_estimate_number RPC
  031_payment_log_schema.sql     # invoice_payments table, invoice status CHECK update (add partially_paid), reminders_enabled column
  032_reminders_recurring.sql    # invoice_reminders table, invoice_settings late fee columns, recurring columns on invoices

src/app/api/
  estimates/
    route.js                     # GET list + POST create (mirrors invoice route.js)
    [id]/
      route.js                   # GET detail + PATCH update (mirrors invoice [id]/route.js)
      send/route.js              # POST send estimate (mirrors invoice send)
      convert/route.js           # POST convert to draft invoice
  invoices/[id]/
    payments/route.js            # GET list + POST record + DELETE remove payment
  cron/
    invoice-reminders/route.js   # Daily cron: send reminders + apply late fees
    recurring-invoices/route.js  # Daily cron: generate recurring invoice drafts

src/app/dashboard/
  estimates/
    page.js                      # Estimate list page
    new/page.js                  # Estimate editor (create)
    [id]/page.js                 # Estimate detail view

src/components/dashboard/
  EstimateEditor.jsx             # Estimate editor with optional tier support
  EstimateStatusBadge.jsx        # Status badge for estimates
  EstimateSummaryCards.jsx       # Summary cards for estimates section
  TierEditor.jsx                 # Tier card component within estimate editor
  PaymentLog.jsx                 # Payment log section for invoice detail
  RecordPaymentDialog.jsx        # Dialog for recording a payment
  RecurringSetupDialog.jsx       # Dialog for setting up recurring invoice
  RecurringBadge.jsx             # Visual badge for recurring invoices
  ReminderToggle.jsx             # Per-invoice reminder switch

src/lib/
  estimate-pdf.jsx               # @react-pdf/renderer for estimate PDFs (single + tiered)

src/emails/
  EstimateEmail.jsx              # React Email template for estimate delivery
  InvoiceReminderEmail.jsx       # React Email template for payment reminders (4 tones)
```

### Pattern 1: Estimates as Parallel Document Type
**What:** Estimates mirror the invoice architecture — own table, own API routes, own pages — but reuse shared components (line item editor, calculation utilities, delivery infrastructure).
**When to use:** When building a document type that shares structure with invoices but has different status flow and lifecycle.

**Schema design (Claude's Discretion resolution):**
- Use a SEPARATE `estimate_line_items` table (not shared with `invoice_line_items`) because:
  - Estimates have tiers; each tier groups its own line items via `tier_id` FK
  - Estimate line items must survive independently of invoices (no cascade confusion)
  - Cleaner queries and RLS policies
- `estimate_tiers` table links tiers to estimates: `id`, `estimate_id`, `tier_label`, `sort_order`, `subtotal`, `tax_amount`, `total`
- Single-price estimates have zero rows in `estimate_tiers`; line items have `tier_id = NULL`

### Pattern 2: Payment Log with Auto-Status
**What:** `invoice_payments` table tracks individual payments. On every INSERT/DELETE, the API recalculates balance and auto-sets invoice status to `partially_paid`, `paid`, or back to `sent`/`overdue`.
**When to use:** For tracking partial payments without a formal deposit/escrow system.

**Key behavior:**
- Balance = `invoice.total` - `SUM(invoice_payments.amount)`
- If balance = 0: status = `paid`
- If balance > 0 and payments exist: status = `partially_paid`
- If no payments: retain current status

### Pattern 3: Cron-Based Reminders with Idempotency
**What:** Daily cron job (Vercel cron, same pattern as `trial-reminders`) checks all sent/overdue invoices with `reminders_enabled = true` and sends reminders at the 4 fixed intervals. An `invoice_reminders` table tracks sent reminders to prevent duplicates.
**When to use:** For time-based notifications that must fire reliably without user action.

**Claude's Discretion resolution — Cron vs on-page-load:**
Use cron. Rationale:
- On-page-load is unreliable (owner may not visit dashboard for days)
- Reminders must fire on specific dates regardless of dashboard activity
- Proven pattern exists (`trial-reminders` cron)
- Idempotency table prevents double-sends if cron fires twice

### Pattern 4: Cron-Based Recurring Invoice Generation
**What:** Daily cron job checks invoices where `is_recurring_template = true` AND `recurring_next_date <= today` AND `recurring_active = true`. For each match, creates a new draft invoice (cloning line items, customer info), then advances `recurring_next_date` to the next occurrence.
**When to use:** For auto-generating periodic invoices from a template.

**Claude's Discretion resolution — Cron vs on-demand:**
Use cron. Same rationale as reminders — must fire regardless of dashboard visits.

### Pattern 5: Late Fee as Auto-Inserted Line Item
**What:** The reminder cron job also handles late fees. When an invoice is overdue and tenant has late fees enabled, the cron inserts a `late_fee` line item into `invoice_line_items` with `item_type = 'late_fee'` (new type) and recalculates totals.
**When to use:** For auto-applying financial penalties on overdue invoices.

**Key design:**
- Add `late_fee` to the `invoice_line_items.item_type` CHECK constraint
- Late fee line items have `description = "Late fee -- {days} days overdue"` and `taxable = false`
- Track last late fee application date on the invoice (`late_fee_applied_at`) to prevent duplicate application per overdue period
- Late fee calculation: flat = `settings.late_fee_amount`; percentage = `invoice.total * settings.late_fee_amount / 100` (prorated monthly)

### Anti-Patterns to Avoid
- **Sharing `invoice_line_items` for estimate line items:** Creates coupling issues — tier grouping requires extra columns, CASCADE deletes become ambiguous, RLS queries get complex.
- **Auto-sending reminders without idempotency table:** Cron retries or overlapping executions would send duplicate reminders.
- **Auto-sending recurring invoices:** D-17 explicitly says owner reviews and sends. Generated invoices MUST be draft status only.
- **Modifying invoice total in-place for late fees:** Instead, add a late fee as a regular line item so it appears in the PDF and payment log calculations correctly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Custom HTML-to-PDF | `@react-pdf/renderer` (already in project) | Consistent with invoice PDFs, reliable rendering |
| Email templates | Raw HTML strings | React Email (already used for InvoiceEmail) | Component-based, testable, white-label consistent |
| Date arithmetic | Manual date math | `date-fns` (already in project) | addDays, addWeeks, addMonths, addYears, differenceInDays |
| Atomic sequence numbers | App-level locking | PostgreSQL RPC (like `get_next_invoice_number`) | Race-safe, proven pattern |
| Toast notifications | Custom notification system | `sonner` (already in project) | Consistent UX |

## Common Pitfalls

### Pitfall 1: Invoice Status CHECK Constraint Expansion
**What goes wrong:** Adding `partially_paid` to the invoices `status` CHECK constraint requires an ALTER TABLE that drops and recreates the constraint. If done incorrectly, existing data with valid statuses could be rejected.
**Why it happens:** PostgreSQL CHECK constraints cannot be modified in-place — must DROP then ADD.
**How to avoid:** Migration must: (1) DROP existing CHECK, (2) ADD new CHECK with all values including `partially_paid`. Wrap in a transaction.
**Warning signs:** Migration fails on deploy, or PATCH endpoint returns constraint violation.

### Pitfall 2: Late Fee Double-Application
**What goes wrong:** Cron runs twice in one day (Vercel cron guarantees at-least-once, not exactly-once), applying the late fee twice.
**Why it happens:** No idempotency guard on late fee insertion.
**How to avoid:** Track `late_fee_applied_at` timestamp on the invoice. Only apply if NULL or if enough time has passed for a new fee period (monthly for percentage, one-time for flat).
**Warning signs:** Invoice total keeps increasing unexpectedly.

### Pitfall 3: Recurring Invoice Next Date Drift
**What goes wrong:** Using simple addDays/addMonths without anchoring to the original start date causes date drift (e.g., Jan 31 + 1 month = Feb 28, + 1 month = Mar 28 instead of Mar 31).
**Why it happens:** Naive date arithmetic.
**How to avoid:** Always calculate next date from start_date + N*interval, not from current next_date + interval. Store the occurrence count or calculate from start date.
**Warning signs:** Monthly invoices gradually shift dates.

### Pitfall 4: Payment Log Balance vs Invoice Total Mismatch
**What goes wrong:** Late fee line items change the invoice total after payments were recorded, making the balance appear wrong.
**Why it happens:** Balance = total - payments, but total changed after late fee was added.
**How to avoid:** Always recalculate balance from current total (including late fees) minus sum of payments. Display the late fee line item clearly so the owner understands the new total.
**Warning signs:** Balance shows negative or unexpected values after late fee application.

### Pitfall 5: Estimate-to-Invoice Conversion Race Condition
**What goes wrong:** Double-clicking "Convert to Invoice" creates two draft invoices from the same estimate.
**Why it happens:** No deduplication guard on the conversion endpoint.
**How to avoid:** Track `converted_to_invoice_id` on the estimate. If already set, return the existing invoice instead of creating a new one. Use database-level constraint.
**Warning signs:** Duplicate invoices with identical line items.

### Pitfall 6: Reminder Cron Querying All Tenants
**What goes wrong:** As the platform scales, the reminder cron queries every invoice across all tenants, causing timeout.
**Why it happens:** No scoping or batching in the cron query.
**How to avoid:** Use service_role client (bypasses RLS), query with efficient WHERE clause (status IN ('sent', 'overdue'), reminders_enabled = true, due_date within reminder window). Batch processing with LIMIT + cursor if needed.
**Warning signs:** Cron timeouts in Vercel logs.

## Code Examples

### Estimate Table Schema
```sql
-- Source: Designed from invoice schema pattern (029_invoice_schema.sql)
CREATE TABLE estimates (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id               uuid REFERENCES leads(id) ON DELETE SET NULL,
  estimate_number       text NOT NULL,
  status                text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'approved', 'declined', 'expired')),
  customer_name         text,
  customer_phone        text,
  customer_email        text,
  customer_address      text,
  job_type              text,
  created_date          date NOT NULL DEFAULT CURRENT_DATE,
  valid_until           date,
  notes                 text,
  -- Single-price totals (NULL when tiered)
  subtotal              numeric(10,2),
  tax_amount            numeric(10,2),
  total                 numeric(10,2),
  -- Conversion tracking
  converted_to_invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  sent_at               timestamptz,
  approved_at           timestamptz,
  declined_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, estimate_number)
);
```

### Payment Log Table Schema
```sql
-- Source: Designed for D-08/D-09/D-10
CREATE TABLE invoice_payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount        numeric(10,2) NOT NULL,
  payment_date  date NOT NULL DEFAULT CURRENT_DATE,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

### Reminder Idempotency Table
```sql
-- Source: Pattern from billing_notifications table
CREATE TABLE invoice_reminders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('before_3', 'due_date', 'overdue_3', 'overdue_7')),
  sent_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, reminder_type)
);
```

### Recurring Invoice Columns (added to invoices table)
```sql
-- Source: Designed for D-16/D-17/D-18
ALTER TABLE invoices ADD COLUMN is_recurring_template boolean NOT NULL DEFAULT false;
ALTER TABLE invoices ADD COLUMN recurring_frequency text CHECK (recurring_frequency IN ('weekly', 'monthly', 'quarterly', 'annually'));
ALTER TABLE invoices ADD COLUMN recurring_start_date date;
ALTER TABLE invoices ADD COLUMN recurring_end_date date;
ALTER TABLE invoices ADD COLUMN recurring_next_date date;
ALTER TABLE invoices ADD COLUMN recurring_active boolean NOT NULL DEFAULT false;
ALTER TABLE invoices ADD COLUMN generated_from_id uuid REFERENCES invoices(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN reminders_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE invoices ADD COLUMN late_fee_applied_at timestamptz;
```

### Late Fee Settings Columns (added to invoice_settings)
```sql
-- Source: Designed for D-14/D-15
ALTER TABLE invoice_settings ADD COLUMN late_fee_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE invoice_settings ADD COLUMN late_fee_type text NOT NULL DEFAULT 'flat' CHECK (late_fee_type IN ('flat', 'percentage'));
ALTER TABLE invoice_settings ADD COLUMN late_fee_amount numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE invoice_settings ADD COLUMN estimate_prefix text NOT NULL DEFAULT 'EST';
```

### Reminder Cron Pattern
```javascript
// Source: Pattern from src/app/api/cron/trial-reminders/route.js
// Key differences: queries invoices (not subscriptions), 4 reminder points, sends both email + SMS

export async function GET(request) {
  // Auth check (CRON_SECRET)
  // Query all invoices WHERE status IN ('sent', 'overdue') AND reminders_enabled = true AND due_date IS NOT NULL
  // For each invoice, calculate which reminder points are due:
  //   today == due_date - 3 days -> 'before_3'
  //   today == due_date         -> 'due_date'
  //   today == due_date + 3     -> 'overdue_3'
  //   today == due_date + 7     -> 'overdue_7'
  // Check invoice_reminders for idempotency
  // Send email + SMS using getResendClient/getTwilioClient
  // Record in invoice_reminders table
  // Also: apply late fees to overdue invoices where tenant has late_fee_enabled
}
```

### Convert Estimate to Invoice Pattern
```javascript
// Source: POST /api/estimates/[id]/convert
// 1. Fetch estimate + line items (or selected tier's line items)
// 2. Check converted_to_invoice_id is NULL (prevent double conversion)
// 3. Call internal invoice creation logic (same as POST /api/invoices)
// 4. Update estimate.converted_to_invoice_id = new_invoice.id
// 5. Return new invoice
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Overdue detection via cron | Overdue detection on GET /api/invoices (bulk UPDATE before SELECT) | Phase 33 | List always current; same pattern should be used for late fee visibility |

**Deprecated/outdated:**
- None relevant. All Phase 33 patterns are current and should be extended.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (in project) |
| Config file | `jest.worktree.config.js` |
| Quick run command | `npx jest --config jest.worktree.config.js --testPathPattern=test_name -x` |
| Full suite command | `npx jest --config jest.worktree.config.js` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | Estimate CRUD separate from invoices | unit | `npx jest --config jest.worktree.config.js --testPathPattern=estimate -x` | Wave 0 |
| D-02 | Tiered estimate creation | unit | `npx jest --config jest.worktree.config.js --testPathPattern=estimate-tiers -x` | Wave 0 |
| D-05 | Convert estimate to invoice | unit | `npx jest --config jest.worktree.config.js --testPathPattern=estimate-convert -x` | Wave 0 |
| D-07 | Estimate numbering | unit | `npx jest --config jest.worktree.config.js --testPathPattern=estimate-number -x` | Wave 0 |
| D-08 | Payment log records and balance | unit | `npx jest --config jest.worktree.config.js --testPathPattern=payment-log -x` | Wave 0 |
| D-09 | Auto-status partially_paid/paid | unit | `npx jest --config jest.worktree.config.js --testPathPattern=payment-status -x` | Wave 0 |
| D-14 | Late fee calculation | unit | `npx jest --config jest.worktree.config.js --testPathPattern=late-fee -x` | Wave 0 |
| D-16 | Recurring next-date calculation | unit | `npx jest --config jest.worktree.config.js --testPathPattern=recurring -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** Quick run on changed module
- **Per wave merge:** Full suite
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/estimate-calculations.test.js` -- covers D-01, D-02, D-07
- [ ] `tests/payment-log.test.js` -- covers D-08, D-09
- [ ] `tests/late-fee.test.js` -- covers D-14
- [ ] `tests/recurring-schedule.test.js` -- covers D-16, D-17

## Open Questions

1. **Late fee recurrence for percentage type**
   - What we know: D-14 says "percentage per month." Flat fee is a one-time application.
   - What's unclear: For percentage, should the fee compound (apply to total including previous late fees) or only apply to the original invoice total? Should it re-apply monthly?
   - Recommendation: Apply to original total only (not compounding), re-apply monthly. Track last application date and only add new fee if 30+ days since last application. This is the standard in home service billing.

2. **Estimate tier storage when no tiers**
   - What we know: Single-price estimates have no tiers.
   - What's unclear: Store single-price totals on the estimate row directly, or always use a single "default" tier row?
   - Recommendation: Single-price estimates store subtotal/tax_amount/total directly on the estimate row with tier_id = NULL on line items. Tiered estimates store per-tier totals on `estimate_tiers` rows and estimate-level totals are NULL. This avoids unnecessary tier rows for simple estimates.

3. **Invoice status CHECK constraint migration safety**
   - What we know: Need to add `partially_paid` to the CHECK constraint.
   - What's unclear: Whether the DROP + ADD approach could fail on Supabase managed migrations.
   - Recommendation: Standard approach that works on Supabase: `ALTER TABLE invoices DROP CONSTRAINT invoices_status_check; ALTER TABLE invoices ADD CONSTRAINT invoices_status_check CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void', 'partially_paid'));` Also need to add `late_fee` to `invoice_line_items.item_type` CHECK.

## Project Constraints (from CLAUDE.md)

- **Brand name is Voco** -- all reminder emails use Voco sending domain (getvoco.ai) but display tenant business name (white-label)
- **Keep skills in sync** -- dashboard-crm-system skill must be updated after Phase 34 changes
- **Tech stack**: Next.js App Router, Supabase (Auth + Postgres + RLS), Twilio SMS, Resend email, Tailwind CSS, shadcn/ui
- **DB migrations** in `supabase/migrations/` -- next available is `030_*.sql`
- **RLS pattern**: `tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())` + service_role bypass
- **API pattern**: `createSupabaseServer()` + `getTenantId()` in route handlers
- **Cron pattern**: Vercel cron with `CRON_SECRET` Bearer auth + idempotency table
- **Email delivery**: `getResendClient()` from `notifications.js`, white-labeled (no platform branding)
- **SMS delivery**: `getTwilioClient()` from `notifications.js`, non-fatal failures (catch and log)

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/029_invoice_schema.sql` -- Invoice table schema, constraints, RLS policies
- `src/app/api/invoices/route.js` -- Invoice CRUD API pattern
- `src/app/api/invoices/[id]/route.js` -- Invoice detail/update pattern with status transitions
- `src/app/api/invoices/[id]/send/route.js` -- Email + SMS delivery pattern
- `src/app/api/cron/trial-reminders/route.js` -- Cron job pattern with idempotency
- `src/lib/invoice-calculations.js` -- Line item calculation utilities
- `src/lib/invoice-number.js` -- Number formatting utility
- `src/lib/invoice-pdf.jsx` -- @react-pdf/renderer PDF generation
- `src/components/dashboard/InvoiceStatusBadge.jsx` -- STATUS_CONFIG export pattern
- `vercel.json` -- Cron configuration pattern

### Secondary (MEDIUM confidence)
- `34-CONTEXT.md` -- All 18 implementation decisions
- `34-UI-SPEC.md` -- UI design contract (component inventory, copywriting, interaction patterns)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new dependencies
- Architecture: HIGH -- all patterns proven in Phase 33, direct extension
- Pitfalls: HIGH -- based on concrete analysis of existing schema and cron patterns
- Schema design: HIGH -- follows established RLS and migration patterns exactly

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable -- all dependencies are internal to the project)

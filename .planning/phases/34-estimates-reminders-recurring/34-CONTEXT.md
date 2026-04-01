# Phase 34: Estimates, Reminders, and Recurring Invoices - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the invoice system with pre-job estimates (optional good/better/best tiers), a simple payment log for partial payments, automated payment reminders on a fixed schedule, auto-calculated late fees, and recurring invoices for maintenance contracts. No online approval pages, no formal deposit system, no payment processing — Voco handles document generation and notifications only.

</domain>

<decisions>
## Implementation Decisions

### Estimates
- **D-01:** Estimates are a separate document type from invoices. An estimate is "here's what the job will cost" (before work). An invoice is "here's what you owe" (after work). Both share the same line item structure from Phase 33.
- **D-02:** Tiers (good/better/best) are OPTIONAL. Owner can create a simple single-price estimate OR add up to 3 tiers. Each tier has its own set of line items and total.
- **D-03:** Estimates are sent via email (Resend, PDF attachment) and optional SMS (Twilio, summary text) — same delivery infrastructure as Phase 33 invoices. Fully white-labeled.
- **D-04:** No online approval page. Owner manually marks an estimate as "Approved" in the dashboard after verbal/text/phone confirmation from the customer. Status flow: Draft → Sent → Approved / Declined / Expired.
- **D-05:** "Convert to Invoice" button on an approved estimate creates a new draft invoice pre-filled with the approved tier's line items and customer info. The estimate remains in history as a separate record. If single-price (no tiers), converts directly.
- **D-06:** Estimates are created from two entry points: (1) "Create Estimate" in LeadFlyout (pre-fills customer info from lead), (2) "+ New Estimate" on the Estimates section/tab for standalone quotes.
- **D-07:** Estimate numbering follows the same pattern as invoices: {PREFIX}-{YEAR}-{NNNN}. Default prefix "EST". Separate sequence counter from invoices.

### Deposits & Partial Payments
- **D-08:** Simple payment log — no formal deposit system. "Record Payment" button on any invoice. Owner enters amount + date + optional note (e.g., "check #4521", "cash"). Balance auto-calculates (total minus sum of payments).
- **D-09:** Invoice status becomes "Partially Paid" when payments exist but balance > 0. Becomes "Paid" when balance reaches 0. Existing "Paid" manual toggle from Phase 33 still works as a quick-mark for full payment.
- **D-10:** Payment history displayed as a simple list on the invoice detail view — date, amount, note per entry.

### Reminders & Late Fees
- **D-11:** Fixed automated reminder schedule: 3 days before due date, on due date, 3 days overdue, 7 days overdue. Sent via email and SMS (same channels as original invoice delivery).
- **D-12:** Owner can toggle reminders on/off per invoice. Default is ON for sent invoices with a due date.
- **D-13:** Standard white-labeled reminder templates with escalating tone (friendly → firm). Owner does NOT customize template text. Templates use business name, invoice number, amount due, and due date.
- **D-14:** Auto-calculated late fees configured in invoice settings: owner sets either a flat amount (e.g., $25) or percentage per month (e.g., 1.5%). When an invoice goes overdue, system auto-adds a late fee line item. Late fee appears on subsequent reminders.
- **D-15:** Owner can disable late fees globally in invoice settings (default: off). When enabled, applies to all overdue invoices unless manually removed from a specific invoice.

### Recurring Invoices
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Invoice Core (Phase 33 — foundation for this phase)
- `.planning/phases/33-invoice-core/33-CONTEXT.md` — All 17 invoice decisions: line item types, delivery channels, status flow, numbering, settings, bidirectional lead sync, white-labeling rules
- `supabase/migrations/029_invoice_schema.sql` — Invoice tables: invoices, invoice_line_items, invoice_settings, invoice_sequences, get_next_invoice_number RPC, invoice-logos storage bucket
- `src/app/api/invoices/route.js` — Invoice CRUD API pattern (GET list, POST create)
- `src/app/api/invoices/[id]/route.js` — Invoice detail API (GET, PATCH, DELETE)
- `src/components/dashboard/InvoiceEditor.jsx` — Line item editor component (reusable for estimates)
- `src/components/dashboard/InvoiceStatusBadge.jsx` — Status badge pattern + STATUS_CONFIG export
- `src/components/dashboard/InvoiceSummaryCards.jsx` — Summary cards pattern

### Lead Integration
- `src/components/dashboard/LeadFlyout.jsx` — "Create Invoice" button pattern (add "Create Estimate" similarly)
- `src/app/api/leads/[id]/route.js` — Lead PATCH endpoint for bidirectional sync

### Email & SMS Infrastructure
- Resend for email delivery (existing invoice send pattern)
- Twilio for SMS delivery (existing invoice SMS pattern)
- `src/app/api/invoices/[id]/send/route.js` — Invoice send endpoint (reference for estimate send + reminder send)

### Cron Infrastructure
- `src/app/api/cron/trial-reminders/route.js` — Existing cron job pattern for scheduled notifications (reference for payment reminder cron)

### Design System
- `src/lib/design-tokens.js` — Card, button, color tokens
- `src/components/ui/` — shadcn components (Badge, Table, Sheet, etc.)

### Database Migrations
- `supabase/migrations/` — 29 existing migrations. New tables follow same RLS pattern (tenant_own + service_role_all)

### Skills (update after changes)
- `.claude/skills/dashboard-crm-system/` — Must be updated to reflect estimates, payment log, reminders, recurring invoices

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **InvoiceEditor.jsx**: Line item editor with typed fields — reusable for estimate line items (same 5 types: labor, materials, travel, flat_rate, discount)
- **InvoiceStatusBadge.jsx**: STATUS_CONFIG pattern — extend with estimate statuses (Draft/Sent/Approved/Declined/Expired)
- **InvoiceSummaryCards.jsx**: Summary card pattern — reuse for estimates section summary
- **Invoice send API route**: Email + SMS delivery pattern — reuse for estimate delivery and payment reminders
- **get_next_invoice_number RPC**: Atomic counter pattern — replicate for estimate numbering
- **Invoice PDF generation**: @react-pdf/renderer setup — extend for estimate PDF with optional tier columns
- **Trial reminders cron**: Scheduled notification pattern — reference for payment reminder cron job

### Established Patterns
- API routes: `src/app/api/[feature]/route.js` with createSupabaseServer() + getTenantId()
- RLS: `tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())`
- Client-side fetching: useEffect + fetch + loading/error states
- Status badge config: Object mapping status → className + label
- Cron jobs: Vercel cron with idempotency checks

### Integration Points
- **LeadFlyout**: Add "Create Estimate" button alongside existing "Create Invoice" button
- **Invoice detail view**: Add "Record Payment" button and payment history list
- **Invoice settings page**: Add late fee configuration (flat/percentage, enable/disable)
- **Navigation**: Estimates may need their own sub-section or filter within Invoices tab
- **Activity log**: Log estimate_created, estimate_sent, estimate_approved, payment_recorded events

</code_context>

<specifics>
## Specific Ideas

- Estimates should feel like a natural extension of the invoice system — same editor, same delivery, same white-labeling. Not a separate product.
- The "Convert to Invoice" flow should be one click — not a multi-step wizard.
- Payment log should be dead simple: amount, date, optional note. No formal deposit concept.
- Reminder tone escalation: first reminder is friendly ("Just a reminder..."), later reminders are firmer ("Your payment is now X days overdue...").
- Recurring invoices generate drafts, not auto-send — the owner stays in control of what goes out.

</specifics>

<deferred>
## Deferred Ideas

- **Online estimate approval page** — Deferred; owner marks approved manually after verbal confirmation
- **Digital signature capture on estimates** — Deferred; adds complexity, most approvals are verbal for home service
- **Customer financing integration (Wisetack/Hearth)** — Deferred to Phase 35 or removed (conflicts with no-payment-processing constraint)
- **Customizable reminder templates** — Deferred; standard templates sufficient for now
- **Email open tracking / "Viewed" status** — Deferred from Phase 33; tracking pixels add complexity
- **Estimate expiry automation** — Deferred; owner can manually mark as Expired

</deferred>

---

*Phase: 34-estimates-reminders-recurring*
*Context gathered: 2026-04-01*

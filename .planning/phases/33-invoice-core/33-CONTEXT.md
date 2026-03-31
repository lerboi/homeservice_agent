# Phase 33: Invoice Core - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Business owners can generate professional white-labeled invoices from completed jobs, edit typed line items (labor, materials with markup, travel, flat-rate, discount), configure business identity and tax settings, send invoices to customers via email (PDF attachment) and SMS (summary), download PDFs for on-site hand-delivery, and track invoice status through a filterable dashboard — replacing the current manual revenue entry with a full invoicing workflow. Voco handles invoicing only — no payment processing, no payment links, no online payment collection.

</domain>

<decisions>
## Implementation Decisions

### Navigation & Page Placement
- **D-01:** Invoices replaces Analytics as a top-level sidebar/bottom-bar tab. Navigation stays at 5 tabs: Home, Leads, Calendar, **Invoices**, More. Analytics moves to a sub-page under More.
- **D-02:** Invoice creation has two entry points: (1) "Create Invoice" button in LeadFlyout when lead status is Completed/Paid — pre-fills customer name, phone, address, job type from lead data. (2) "+ New Invoice" button on the Invoices tab for standalone invoices (walk-in jobs or non-lead work).
- **D-03:** Billing page (Stripe subscription invoices) stays separate under More. Billing = YOUR Voco subscription. Invoices tab = invoices YOU send to YOUR customers. Completely different audiences and data.

### Invoice Content & Line Items
- **D-04:** Typed line items with 5 types: Labor (hourly rate × hours), Materials (cost × quantity × markup %), Travel/Trip Charge (flat fee), Flat Rate (single amount), Discount (negative amount). Each line item has: type, description, quantity, unit price, markup % (materials only), taxable toggle, and calculated total.
- **D-05:** Full professional business header on every invoice: business name, logo (uploaded to Supabase Storage), address, phone, email, and license number. Configured once in invoice settings.
- **D-06:** Single tax rate configured in invoice settings (e.g., 8.25%). Per-line-item taxable toggle — materials typically taxable, labor often exempt. Tax auto-calculated on taxable line items.
- **D-07:** Default terms and notes configurable in invoice settings (e.g., "Net 30", "Thank you for your business!"). Can be overridden per invoice.

### Customer Delivery & Payment
- **D-08:** CRITICAL — Voco handles invoicing ONLY. No payment processing, no payment links, no Stripe Checkout for customer payments, no online payment collection. The customer pays the contractor directly via their own arrangement (cash, check, bank transfer, etc.).
- **D-09:** CRITICAL — All invoices are fully white-labeled. NO Voco branding, NO Voco links, NO Voco URLs anywhere on the invoice PDF, email, or SMS. The customer sees only the contractor's business identity.
- **D-10:** Invoices delivered via email (Resend) with PDF attachment + professional HTML body summarizing the invoice. Email "from" name uses the contractor's business name.
- **D-11:** Optional SMS notification via Twilio from the business phone number. SMS contains: business name, invoice #, total, due date, and "Full invoice sent to your email. Questions? Call [business phone]". No links.
- **D-12:** Owner can preview the invoice in the dashboard and download the PDF for their own records, printing, or hand-delivery to on-site customers.

### Invoice Lifecycle & Status
- **D-13:** Status flow: Draft → Sent → Paid (or Overdue or Void). Draft = created but not sent. Sent = delivered to customer. Overdue = auto-set when past due date (checked on page load or cron). Paid = owner manually marks when payment received. Void = cancelled invoice.
- **D-14:** Year-prefixed invoice numbering: {PREFIX}-{YEAR}-{NNNN}. Default prefix "INV". Counter resets to 0001 each year. Owner can customize prefix in settings (e.g., "SP" for Smith Plumbing). Current year auto-detected.
- **D-15:** Invoices tab list view: summary cards at top (Total Outstanding, Overdue Amount, Paid This Month), status filter tabs (All / Draft / Sent / Overdue / Paid), table rows with invoice #, customer name, job type, amount, issued date, due date, status badge. Click row to open detail view.
- **D-16:** Bidirectional sync between invoices and leads: marking an invoice as Paid auto-updates linked lead to "Paid" with revenue_amount = invoice total. Marking a lead as Paid auto-marks the linked invoice as Paid. No circular updates — use a flag to prevent loops.

### Invoice Settings Page
- **D-17:** New settings page under More (or accessible from Invoices tab gear icon): business info (name, address, phone, email, logo upload, license number), tax rate, default payment terms (Net 15/30/45/60), default notes, invoice prefix, and next invoice number display.

### Claude's Discretion
- PDF generation library choice (e.g., @react-pdf/renderer, jsPDF, puppeteer-based)
- Email template design (React Email or plain HTML)
- Invoice detail view layout (flyout panel vs full page)
- Summary card design and exact metrics
- How overdue status is checked (page-load check vs background cron vs both)
- Database schema design (columns, indexes, RLS policies)
- Whether to store PDFs in Supabase Storage or generate on-demand
- How the "Create Invoice" button appears in LeadFlyout (inline button vs dropdown action)
- Invoice editor UX (inline editing vs modal vs full page form)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Dashboard Navigation & Layout
- `src/app/dashboard/more/page.js` — MORE_ITEMS array, current 8-item config hub layout. Analytics needs to be added here.
- `src/components/dashboard/DashboardSidebar.jsx` — Sidebar nav items. Must replace Analytics with Invoices.
- `src/app/dashboard/layout.js` — Dashboard layout wrapper with bottom tab bar on mobile.

### Lead Integration Points
- `src/components/dashboard/LeadFlyout.jsx` — Lead detail flyout panel. "Create Invoice" button added here when status = completed/paid. Lines 83-85: `showsRevenueInput()` function. Lines 142-145: revenue_amount pre-fill pattern.
- `src/app/api/leads/[id]/route.js` — Lead PATCH endpoint for status + revenue_amount updates. Bidirectional sync triggers here.
- `src/app/dashboard/leads/page.js` — Leads page for navigation context.

### Existing Billing Infrastructure (reference only — NOT reused for customer invoicing)
- `src/app/api/billing/invoices/route.js` — Stripe subscription invoice fetching. Different from customer invoices but shows the API route pattern.
- `src/app/dashboard/more/billing/page.js` — Stripe billing dashboard. Reference for card/table patterns.

### Email & SMS Infrastructure
- Resend is used for transactional email (existing notification system).
- Twilio is used for SMS (existing caller recovery and notification system).

### Design System
- `src/lib/design-tokens.js` — `card.base`, `btn.primary`, `colors`, `heading`, `body` tokens.
- `src/components/ui/` — shadcn components: Badge, Table, Skeleton, Sheet, etc.

### Database Migrations
- `supabase/migrations/` — 28 existing migrations. New invoice tables follow same RLS pattern (tenant_own + service_role_all).
- `supabase/migrations/004_leads_pipeline.sql` — Leads table schema with `revenue_amount` column (the field invoice total will sync to).

### Prior Phase Context
- `.planning/phases/22-billing-foundation/22-CONTEXT.md` — Stripe integration patterns, webhook handler design.
- `.planning/phases/25-enforcement-gate-and-billing-dashboard/25-CONTEXT.md` — Billing dashboard UI patterns, UsageRingGauge, inline invoice table.
- `.planning/phases/20-dashboard-ux-overhaul/20-CONTEXT.md` — Dashboard navigation structure (D-01: 5 tabs), More menu design (D-03), mobile bottom bar (D-02).
- `.planning/phases/04-crm-dashboard-and-notifications/04-CONTEXT.md` — Lead data model, pipeline statuses, revenue tracking (manual amount entry).

### Skills (update after changes)
- `.claude/skills/dashboard-crm-system/` — Must be updated to reflect new Invoices tab and Analytics relocation.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Design tokens** (`design-tokens.js`): `card.base`, `btn.primary`, `colors`, `heading`, `body` — use for all invoice UI components.
- **shadcn Table** (`components/ui/table`): Already used in billing page for Stripe invoice list. Reuse for invoice list view.
- **Badge component** (`components/ui/badge`): Status badges (Paid/Sent/Overdue/Draft) follow same pattern as billing status badges.
- **Skeleton component** (`components/ui/skeleton`): Loading states follow billing page pattern.
- **Sheet component** (`components/ui/sheet`): If using flyout for invoice detail (same pattern as LeadFlyout).
- **LeadFlyout pattern** (`LeadFlyout.jsx`): Flyout detail panel with fetch-on-open, status dropdowns, inline editing.
- **UsageRingGauge** (`components/dashboard/UsageRingGauge.js`): Reference for summary card visual patterns.
- **Resend email infrastructure**: Already configured for billing notifications and caller alerts.
- **Twilio SMS infrastructure**: Already configured for caller recovery SMS and owner notifications.

### Established Patterns
- **API route structure**: `src/app/api/[feature]/route.js` with `createSupabaseServer()` for auth, `getTenantId()` for tenant isolation.
- **Client-side data fetching**: `useEffect` + `fetch('/api/...')` + loading/error states (see billing page pattern).
- **RLS policies**: All tables use `tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())`.
- **Migration naming**: Sequential `NNN_feature_name.sql` with `timestamptz DEFAULT now()`.
- **Status badge config**: Object mapping status → className + label (see billing page lines 196-208).

### Integration Points
- **DashboardSidebar NAV_ITEMS**: Replace Analytics entry with Invoices. Add Analytics to MORE_ITEMS array.
- **LeadFlyout**: Add "Create Invoice" button that navigates to invoice creation with lead data pre-filled.
- **Lead PATCH API**: Add bidirectional sync — when invoice marked Paid, update lead; when lead marked Paid, update linked invoice.
- **Activity log**: Log invoice_created, invoice_sent, invoice_paid events (existing activity_log table).

</code_context>

<specifics>
## Specific Ideas

- Invoices are fully white-labeled — the customer should feel like they're dealing directly with "Smith Plumbing", not with a software platform.
- The contractor checking their phone between jobs should be able to glance at the Invoices tab and immediately see: how much is outstanding, what's overdue, and what's been paid this month.
- PDF should look like something a professional contractor would hand to a homeowner — clean, readable, with the business logo and all the important details.
- The "Create Invoice" button in LeadFlyout should feel like a natural next step after completing a job — not an afterthought buried in a menu.
- SMS is a nudge that says "check your email for the invoice", not a replacement for the full invoice document.

</specifics>

<deferred>
## Deferred Ideas

- **Estimates/quotes with good/better/best pricing** — Phase 34
- **Automated payment reminders at configurable intervals** — Phase 34
- **Late fee auto-calculation** — Phase 34
- **Deposit/partial payment tracking** — Phase 34
- **Digital signature capture** — Phase 34
- **Recurring invoices for maintenance contracts** — Phase 34
- **QuickBooks/Xero sync** — Phase 35
- **AI-generated work descriptions from call transcripts** — Phase 35
- **Batch invoicing** — Phase 35
- **Customer financing integration (Wisetack/Hearth)** — Phase 35 (or removed entirely given no-payment-processing constraint)
- **Online invoice viewing page (public URL)** — Deferred; PDF-only for now
- **Email open tracking / "Viewed" status** — Deferred; adds complexity with tracking pixels

</deferred>

---

*Phase: 33-invoice-core*
*Context gathered: 2026-03-31*

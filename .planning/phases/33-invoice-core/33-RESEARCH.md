# Phase 33: Invoice Core - Research

**Researched:** 2026-04-01
**Domain:** Invoice generation, PDF rendering, email delivery, Supabase schema, Next.js App Router integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Invoices replaces Analytics as a top-level sidebar/bottom-bar tab. Navigation stays at 5 tabs: Home, Leads, Calendar, **Invoices**, More. Analytics moves to a sub-page under More.
- **D-02:** Invoice creation has two entry points: (1) "Create Invoice" button in LeadFlyout when lead status is Completed/Paid — pre-fills customer name, phone, address, job type from lead data. (2) "+ New Invoice" button on the Invoices tab for standalone invoices.
- **D-03:** Billing page (Stripe subscription invoices) stays separate under More. Completely different audiences and data.
- **D-04:** Typed line items with 5 types: Labor, Materials (with markup %), Travel/Trip Charge, Flat Rate, Discount. Each line item has: type, description, quantity, unit price, markup % (materials only), taxable toggle, and calculated total.
- **D-05:** Full professional business header on every invoice: business name, logo, address, phone, email, license number. Configured once in invoice settings.
- **D-06:** Single tax rate in invoice settings. Per-line-item taxable toggle. Tax auto-calculated on taxable items.
- **D-07:** Default terms and notes configurable in invoice settings. Can be overridden per invoice.
- **D-08:** CRITICAL — No payment processing, no payment links, no Stripe Checkout for customer payments. Customer pays contractor directly.
- **D-09:** CRITICAL — All invoices fully white-labeled. NO Voco branding anywhere on invoice PDF, email, or SMS.
- **D-10:** Email delivery via Resend with PDF attachment + professional HTML body. Email "from" name uses contractor's business name.
- **D-11:** Optional SMS via Twilio from business phone number. Content: business name, invoice #, total, due date, "Full invoice sent to your email. Questions? Call [business phone]". No links.
- **D-12:** Owner can preview invoice in dashboard and download PDF.
- **D-13:** Status flow: Draft → Sent → Paid (or Overdue or Void). Overdue auto-set on page load or cron. Paid = manually marked.
- **D-14:** Year-prefixed invoice numbering: {PREFIX}-{YEAR}-{NNNN}. Default prefix "INV". Counter resets to 0001 each year. Owner can customize prefix.
- **D-15:** Invoices tab list view: summary cards (Total Outstanding, Overdue Amount, Paid This Month), status filter tabs, table rows with invoice #, customer name, job type, amount, issued/due date, status badge.
- **D-16:** Bidirectional sync: invoice Paid → lead "Paid" + revenue_amount = invoice total. Lead Paid → linked invoice Paid. Use a flag to prevent circular updates.
- **D-17:** New settings page under More (or gear icon): business info, tax rate, default payment terms, default notes, invoice prefix, next invoice number display.

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

### Deferred Ideas (OUT OF SCOPE)

- Estimates/quotes with good/better/best pricing — Phase 34
- Automated payment reminders at configurable intervals — Phase 34
- Late fee auto-calculation — Phase 34
- Deposit/partial payment tracking — Phase 34
- Digital signature capture — Phase 34
- Recurring invoices for maintenance contracts — Phase 34
- QuickBooks/Xero sync — Phase 35
- AI-generated work descriptions from call transcripts — Phase 35
- Batch invoicing — Phase 35
- Customer financing integration — Phase 35
- Online invoice viewing page (public URL) — Deferred; PDF-only for now
- Email open tracking / "Viewed" status — Deferred
</user_constraints>

---

## Summary

Phase 33 adds a full invoicing workflow to the Voco dashboard — the most complex feature built so far. It spans five technical domains: (1) database schema for invoices, line items, invoice settings, and invoice numbering; (2) PDF generation inside a Next.js API route; (3) white-labeled email delivery with PDF attachment via Resend; (4) SMS notification via Twilio; and (5) dashboard UI covering navigation changes, a new Invoices tab, an invoice editor, and a settings page.

The PDF generation decision is the highest-stakes technical choice in this phase. `@react-pdf/renderer` v4.3.2 supports React 19 and runs server-side in Next.js API routes, but requires `@react-pdf/renderer` to be added to `serverExternalPackages` in `next.config.js` to avoid the "PDFDocument is not a constructor" error that affects Next.js bundling of this library. The pattern is: define a `<Document>` component in `src/lib/invoice-pdf.jsx`, call `renderToBuffer()` in an API route, return the buffer as a PDF response for download or pass it as `attachments[0].content` to Resend. This is the recommended approach — it generates PDFs on-demand (no storage cost, always current) and avoids Supabase Storage complexity for a new file type.

The database requires two new tables (`invoices` and `invoice_line_items`) plus a separate `invoice_settings` table (one row per tenant) and an `invoice_sequences` table for year-scoped numbering with atomic counter increments. Navigation surgery is straightforward — swap Analytics for Invoices in both `DashboardSidebar.jsx` and `BottomTabBar.jsx`, add Analytics to the `MORE_ITEMS` array in `more/page.js`, and create a new `/dashboard/analytics` redirect or move the page to `/dashboard/more/analytics`.

**Primary recommendation:** Use `@react-pdf/renderer` v4.3.2 for on-demand server-side PDF generation, `@react-email/components` (already installed) for the invoice email body, and generate PDFs on-demand rather than storing them.

---

## Project Constraints (from CLAUDE.md)

- Brand is **Voco** — never "HomeService AI". Invoice PDFs and emails are white-labeled (contractor branding only per D-09) — the internal codebase still uses the Voco brand in any internal notifications.
- Read the `dashboard-crm-system` skill before modifying dashboard navigation or lead-related components.
- Update the `dashboard-crm-system` skill after making changes to reflect the new Invoices tab and Analytics relocation.
- All API routes must use `createSupabaseServer()` + `getTenantId()` for auth and tenant isolation.
- All new DB tables must follow the established RLS pattern: `tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())` plus a `service_role_all_*` policy.
- Migration naming is sequential: next available is `029_*.sql` (current last is `028_calls_tenant_cascade.sql`).
- Design tokens from `src/lib/design-tokens.js` must be used for all new UI.
- Use `sonner` for toasts (already installed).
- Email sends use `Resend` with lazy-instantiated client (`getResendClient()` pattern).
- SMS sends use `twilio` with lazy-instantiated client (`getTwilioClient()` pattern).

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@react-pdf/renderer` | 4.3.2 | Server-side PDF generation | Supports React 19, runs in Node.js API routes via `renderToBuffer`, declarative JSX layout |
| `@react-email/components` | 1.0.10 (installed) | Invoice email HTML body | Already used for all transactional email in this project |
| `resend` | 6.9.4 (installed) | Email delivery with PDF attachment | Already configured; supports `attachments: [{content: Buffer, filename: string}]` |
| `twilio` | 5.13.0 (installed) | SMS notification | Already configured with lazy-init client |
| `@supabase/supabase-js` | 2.99.2 (installed) | DB operations + RLS | Project standard |
| `date-fns` | 4.1.0 (installed) | Date formatting on invoices and in UI | Already used across dashboard |
| `lucide-react` | 0.577.0 (installed) | Icons (FileText, Receipt, Download, Send) | Project icon standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sonner` | 2.0.7 (installed) | Toast notifications | On invoice send success/error, status changes |
| shadcn `Table` | (installed) | Invoice list table | Same pattern as billing page invoice table |
| shadcn `Sheet` | (installed) | Invoice detail flyout (if flyout layout chosen) | Same pattern as LeadFlyout |
| shadcn `Badge` | (installed) | Status badges (Draft/Sent/Overdue/Paid/Void) | Same pattern as billing status badges |
| shadcn `Skeleton` | (installed) | Loading states | Same pattern as billing page |
| `framer-motion` | 12.38.0 (installed) | Staggered list animations | Same pattern as more/page.js |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@react-pdf/renderer` | `jsPDF` (4.2.1) | jsPDF is imperative canvas-based code; `@react-pdf/renderer` is JSX-based and much cleaner for structured documents with images/fonts |
| `@react-pdf/renderer` | Puppeteer/Chromium | `@sparticuz/chromium` is 43MB+; massive Lambda cold start; overkill for invoice PDFs |
| On-demand PDF generation | Store PDFs in Supabase Storage | Storage adds cost, stale-PDF risk when invoice is edited; on-demand is always current |
| React Email template | Plain HTML string | React Email already used for all templates; consistency matters |

**Installation (new package only):**
```bash
npm install @react-pdf/renderer
```

**Version verified:** `@react-pdf/renderer` 4.3.2 published 2025-12-29.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── invoices/
│   │       ├── route.js              # GET list, POST create
│   │       └── [id]/
│   │           ├── route.js          # GET detail, PATCH update, DELETE
│   │           ├── pdf/route.js      # GET — returns PDF buffer for download/preview
│   │           └── send/route.js     # POST — send email + SMS to customer
│   │   └── invoice-settings/
│   │       └── route.js              # GET/PATCH invoice_settings for tenant
│   └── dashboard/
│       ├── invoices/
│       │   └── page.js               # Invoices tab: summary cards + filter tabs + table
│       └── more/
│           ├── analytics/page.js     # Analytics moved here (from /dashboard/analytics)
│           └── invoice-settings/page.js  # Invoice settings under More
├── components/
│   └── dashboard/
│       ├── InvoiceList.jsx           # Table with filter tabs and summary cards
│       ├── InvoiceEditor.jsx         # Line item editor (new or edit)
│       ├── InvoiceStatusBadge.jsx    # Status badge with status-to-style map
│       └── InvoiceDetailFlyout.jsx   # (if flyout layout chosen)
├── lib/
│   └── invoice-pdf.jsx               # @react-pdf/renderer Document component
└── emails/
    └── InvoiceEmail.jsx              # React Email template (invoice summary body)
```

### Pattern 1: Server-side PDF Generation via renderToBuffer

**What:** Define the invoice PDF as a React component tree using `@react-pdf/renderer` primitives (`Document`, `Page`, `View`, `Text`, `Image`). Call `renderToBuffer(element)` inside an API route to produce a `Buffer`, then return it as a response or pass to Resend.

**When to use:** GET `/api/invoices/[id]/pdf` for download, POST `/api/invoices/[id]/send` for email attachment.

**Critical: next.config.js must include:**
```javascript
const nextConfig = {
  serverExternalPackages: ['@react-pdf/renderer'],
  // ...existing config
};
```
Without this, Next.js 15/16 bundling resolves React with the "react-server" condition, breaking `@react-pdf/renderer`. React 19 (used in this project) resolves the underlying issue but the `serverExternalPackages` config is still recommended as defensive practice.

**Example:**
```javascript
// src/lib/invoice-pdf.jsx
// Source: @react-pdf/renderer official docs + react-pdf.org
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  businessName: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  lineRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
});

export function InvoicePDF({ invoice, settings, lineItems }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {settings.logo_url && <Image src={settings.logo_url} style={{ height: 48, marginBottom: 8 }} />}
            <Text style={styles.businessName}>{settings.business_name}</Text>
            <Text>{settings.address}</Text>
            <Text>{settings.phone} | {settings.email}</Text>
            {settings.license_number && <Text>License: {settings.license_number}</Text>}
          </View>
          <View style={{ textAlign: 'right' }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#0F172A' }}>INVOICE</Text>
            <Text>#{invoice.invoice_number}</Text>
            <Text>Issued: {invoice.issued_date}</Text>
            <Text>Due: {invoice.due_date}</Text>
          </View>
        </View>
        {/* Line items table, totals, notes — omitted for brevity */}
      </Page>
    </Document>
  );
}
```

```javascript
// src/app/api/invoices/[id]/pdf/route.js
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePDF } from '@/lib/invoice-pdf';

export async function GET(request, { params }) {
  const tenantId = await getTenantId();
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  // ... fetch invoice, lineItems, settings from Supabase

  const buffer = await renderToBuffer(
    <InvoicePDF invoice={invoice} settings={settings} lineItems={lineItems} />
  );

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
    },
  });
}
```

### Pattern 2: PDF Attachment in Resend Email

**What:** After `renderToBuffer()`, pass the resulting Buffer directly to Resend's `attachments` field.

**Example:**
```javascript
// src/app/api/invoices/[id]/send/route.js
const pdfBuffer = await renderToBuffer(
  <InvoicePDF invoice={invoice} settings={settings} lineItems={lineItems} />
);

await getResendClient().emails.send({
  from: `${settings.business_name} <invoices@getvoco.ai>`,  // MUST use verified getvoco.ai domain
  to: invoice.customer_email,
  subject: `Invoice ${invoice.invoice_number} from ${settings.business_name}`,
  react: InvoiceEmail({ invoice, settings, lineItems }),  // HTML body (no Voco branding per D-09)
  attachments: [
    {
      content: pdfBuffer,
      filename: `invoice-${invoice.invoice_number}.pdf`,
    }
  ],
});
```

**CRITICAL WHITE-LABEL CONSTRAINT (D-09):** The email template (`InvoiceEmail.jsx`) must contain zero Voco branding. The footer must say something like "Sent by {business_name}" — not "Sent by Voco". The `from` field uses the verified sending domain (`getvoco.ai`) but the display name is the contractor's business name.

### Pattern 3: Invoice Numbering with Atomic Counter

**What:** A dedicated `invoice_sequences` table with a Postgres function to atomically increment and return the next number. Prevents race conditions when two invoices are created simultaneously.

**Example:**
```sql
-- 029_invoice_schema.sql
CREATE TABLE invoice_sequences (
  tenant_id   uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  year        int NOT NULL,
  next_number int NOT NULL DEFAULT 1
);

CREATE OR REPLACE FUNCTION get_next_invoice_number(p_tenant_id uuid, p_year int)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_next int;
BEGIN
  INSERT INTO invoice_sequences (tenant_id, year, next_number)
  VALUES (p_tenant_id, p_year, 2)
  ON CONFLICT (tenant_id) DO UPDATE
    SET next_number = CASE
      WHEN invoice_sequences.year = p_year THEN invoice_sequences.next_number + 1
      ELSE 2  -- year rolled over, reset to 2 (returning 1 for this call)
    END,
    year = p_year
  RETURNING
    CASE WHEN invoice_sequences.year = p_year
      THEN invoice_sequences.next_number - 1
      ELSE 1
    END INTO v_next;
  RETURN v_next;
END;
$$;
```

The API layer then formats: `${prefix}-${year}-${String(nextNum).padStart(4, '0')}`.

### Pattern 4: Bidirectional Sync Without Circular Updates (D-16)

**What:** Use a `sync_source` field or a boolean `_syncing` flag in the PATCH body to identify which system initiated the update and skip the reverse propagation.

**Recommended approach:** Add a `sync_source` string to the PATCH request body. When the invoice PATCH sets `sync_source: 'invoice_paid'`, the lead PATCH handler skips firing the invoice sync, and vice versa.

```javascript
// In PATCH /api/invoices/[id]/route.js — when status changes to 'paid':
if (status === 'paid' && invoice.lead_id) {
  await fetch(`/api/leads/${invoice.lead_id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'paid',
      revenue_amount: invoice.total,
      sync_source: 'invoice_paid',  // prevents circular update
    }),
  });
}

// In PATCH /api/leads/[id]/route.js — only sync if NOT from invoice:
if (status === 'paid' && body.sync_source !== 'invoice_paid') {
  // find linked invoice and mark it paid
}
```

### Pattern 5: Overdue Detection on Page Load

**Recommendation:** Check on page load in the Invoices tab page (client-side, on `useEffect` mount). No cron required for MVP — bulk-update `status = 'overdue'` for all `sent` invoices where `due_date < today` belonging to the tenant. This is a simple `supabase.from('invoices').update({status: 'overdue'}).eq('tenant_id', tenantId).eq('status', 'sent').lt('due_date', today)` call.

This is fast (tenant-scoped), deterministic, and deferred until the user actually visits the page. A background cron can be added in Phase 34 if needed.

### Pattern 6: Logo Upload to Supabase Storage

**What:** Logo is uploaded client-side to a `invoice-logos` bucket in Supabase Storage. The public URL is stored in `invoice_settings.logo_url`. The bucket must be created with public read access so `@react-pdf/renderer` can fetch the image URL during PDF generation on the server.

**Example upload pattern:**
```javascript
const { data, error } = await supabase.storage
  .from('invoice-logos')
  .upload(`${tenantId}/logo.${ext}`, file, { upsert: true, contentType: file.type });

const { data: { publicUrl } } = supabase.storage
  .from('invoice-logos')
  .getPublicUrl(`${tenantId}/logo.${ext}`);

// Save publicUrl to invoice_settings.logo_url
```

### Anti-Patterns to Avoid

- **Generating PDF client-side:** `PDFDownloadLink` and `PDFViewer` are browser components. Use `renderToBuffer` server-side for email attachments and download routes.
- **Using `@react-pdf/renderer` without `serverExternalPackages`:** Next.js bundler will break PDF generation silently. Always add to `next.config.js`.
- **Storing PDF files in Supabase Storage:** On-demand generation is simpler, cheaper, always current. Only store if Phase 34 audit trail requirements arise.
- **Bidirectional sync without a guard:** Without a `sync_source` marker, marking invoice as Paid triggers lead Paid which triggers invoice Paid again — infinite loop risk.
- **Blocking the invoice PATCH with sync errors:** Wrap the bidirectional sync in try/catch and log failures; never let cross-sync errors cause the main status update to return 500.
- **Hardcoding tax into line items:** Tax is a calculated view on top of taxable line items. Store `taxable` boolean per line item and calculate tax at read time using `invoice_settings.tax_rate`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF layout with images, tables, page breaks | Custom HTML→PDF converters | `@react-pdf/renderer` | Font embedding, image handling, page overflow, text wrapping are all solved |
| Email HTML that renders in Gmail/Outlook | Raw HTML strings | `@react-email/components` | Already installed; CSS-in-JS that inlines styles correctly for email clients |
| Atomic counter with year rollover | Custom lock with transactions | Postgres `INSERT ... ON CONFLICT DO UPDATE` returning | Built-in atomic semantics, no deadlock risk |
| Status badge styling | Per-component switch | Object map pattern (same as `billing/page.js` lines 196-208) | Consistent with existing codebase patterns |
| Invoice number formatting | Custom string builder | `String(n).padStart(4, '0')` + template literal | One-liner, no library needed |

**Key insight:** PDF generation is deceptively hard when you need font embedding (for special characters in business names), image loading (logo), and predictable page layout. `@react-pdf/renderer` abstracts all of this into a React component tree.

---

## Common Pitfalls

### Pitfall 1: @react-pdf/renderer Breaks in Next.js Without serverExternalPackages

**What goes wrong:** `TypeError: PDFDocument is not a constructor` or `React Error #31` when calling `renderToBuffer` inside an App Router API route.

**Why it happens:** Next.js 15/16 bundles API routes with the "react-server" export condition, which gives a trimmed React subset missing internal APIs that `@react-pdf/renderer` needs for its reconciler.

**How to avoid:** Add to `next.config.js`:
```javascript
const nextConfig = {
  serverExternalPackages: ['@react-pdf/renderer'],
  // ...existing
};
```

**Warning signs:** Any PDF test returning a 500 with the above error messages.

### Pitfall 2: White-Label Email Leaking Voco Branding

**What goes wrong:** Invoice email contains "Powered by Voco", a `getvoco.ai` URL in the body, or any Voco-identifiable text visible to the customer.

**Why it happens:** Copying the `NewLeadEmail.jsx` footer pattern which says "Sent by Voco".

**How to avoid:** `InvoiceEmail.jsx` footer must say only the contractor's business name. Code review checklist item: grep the email template for "Voco", "voco", "getvoco" before shipping.

**Warning signs:** Any literal "Voco" or "getvoco.ai" in the rendered email HTML output.

### Pitfall 3: Invoice Numbering Race Condition

**What goes wrong:** Two invoices created within milliseconds of each other get the same invoice number.

**Why it happens:** Fetching the current max number from the `invoices` table and incrementing in application code — two requests can read the same value before either writes.

**How to avoid:** Use the `get_next_invoice_number` Postgres function which uses `INSERT ... ON CONFLICT DO UPDATE` for atomic increment. Never read-modify-write in application code.

### Pitfall 4: Circular Bidirectional Sync

**What goes wrong:** Marking invoice Paid → updates lead to Paid → lead PATCH handler finds linked invoice and marks it Paid → triggers invoice PATCH → updates lead again → infinite loop.

**Why it happens:** Both sync paths fire without checking who initiated the update.

**How to avoid:** Pass `sync_source` in the PATCH body. Each sync handler checks `sync_source` and skips the reverse propagation if it originated from the other side.

### Pitfall 5: Logo Image Failing in Server-side PDF

**What goes wrong:** Logo does not appear in the PDF when `@react-pdf/renderer` tries to fetch it during `renderToBuffer` on the server.

**Why it happens:** (a) Logo stored in a private Supabase Storage bucket, so the server can't fetch it without auth; or (b) logo URL is a relative path, which doesn't resolve in a Node.js context.

**How to avoid:** Logo bucket must be **public read**. `logo_url` must be an absolute public URL (Supabase Storage public URL). Validate URL absoluteness before rendering.

### Pitfall 6: `from` Email Display Name vs Sending Domain

**What goes wrong:** Resend rejects the send or emails go to spam because the `from` name doesn't match the verified domain.

**Why it happens:** D-09 requires the display name to be the contractor's business name, but Resend requires the domain to be a verified sending domain.

**How to avoid:** Use the pattern `from: \`${settings.business_name} <invoices@getvoco.ai>\`` — the display name is the business name (visible to customer), the sending address is the verified Voco domain (invisible to customer once display name shows). This satisfies both D-09 (customer sees business name) and Resend authentication.

### Pitfall 7: DashboardSidebar Has 6 Nav Items (Not 5)

**What goes wrong:** D-01 says 5 tabs (Home, Leads, Calendar, Invoices, More). But the current sidebar has **6 items** (Home, Leads, Calendar, Calls, Analytics, More). `BottomTabBar` also has 6 items in the `TABS` array.

**Why it happens:** The sidebar includes Calls as a separate nav item. D-01 lists 5 tabs but doesn't say what to do with Calls.

**How to handle:** The nav item to **replace with Invoices is Analytics** (D-01 explicitly says Analytics moves under More). The **Calls tab stays**. The resulting sidebar becomes: Home, Leads, Calendar, Calls, Invoices, More — still 6 items. The BottomTabBar (mobile) replaces its Analytics entry with Invoices.

---

## Database Schema Design

### New Tables Required

```sql
-- 029_invoice_schema.sql

-- ── invoice_settings (one row per tenant, created on first save) ────────────
CREATE TABLE invoice_settings (
  tenant_id          uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  business_name      text,           -- overrides tenants.business_name for invoices
  address            text,
  phone              text,
  email              text,
  logo_url           text,           -- public Supabase Storage URL
  license_number     text,
  tax_rate           numeric(5,4) NOT NULL DEFAULT 0,  -- e.g., 0.0825 for 8.25%
  payment_terms      text NOT NULL DEFAULT 'Net 30',   -- 'Net 15'|'Net 30'|'Net 45'|'Net 60'
  default_notes      text,
  invoice_prefix     text NOT NULL DEFAULT 'INV',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ── invoice_sequences (atomic year-scoped counter) ──────────────────────────
CREATE TABLE invoice_sequences (
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year        int  NOT NULL,
  next_number int  NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, year)
);

-- ── invoices ────────────────────────────────────────────────────────────────
CREATE TABLE invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id          uuid REFERENCES leads(id) ON DELETE SET NULL,  -- nullable for standalone
  invoice_number   text NOT NULL,          -- e.g., 'INV-2026-0001'
  status           text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void')),
  customer_name    text,
  customer_phone   text,
  customer_email   text,
  customer_address text,
  job_type         text,
  issued_date      date NOT NULL DEFAULT CURRENT_DATE,
  due_date         date,
  notes            text,
  payment_terms    text,
  subtotal         numeric(10,2) NOT NULL DEFAULT 0,
  tax_amount       numeric(10,2) NOT NULL DEFAULT 0,
  total            numeric(10,2) NOT NULL DEFAULT 0,
  sent_at          timestamptz,
  paid_at          timestamptz,
  voided_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, invoice_number)
);

CREATE INDEX idx_invoices_tenant_status  ON invoices(tenant_id, status);
CREATE INDEX idx_invoices_tenant_created ON invoices(tenant_id, created_at DESC);
CREATE INDEX idx_invoices_lead_id        ON invoices(lead_id);

-- ── invoice_line_items ──────────────────────────────────────────────────────
CREATE TABLE invoice_line_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sort_order   int NOT NULL DEFAULT 0,
  item_type    text NOT NULL
    CHECK (item_type IN ('labor', 'materials', 'travel', 'flat_rate', 'discount')),
  description  text NOT NULL DEFAULT '',
  quantity     numeric(10,3) NOT NULL DEFAULT 1,
  unit_price   numeric(10,2) NOT NULL DEFAULT 0,
  markup_pct   numeric(5,4) NOT NULL DEFAULT 0,  -- materials only; e.g., 0.20 for 20%
  taxable      boolean NOT NULL DEFAULT true,
  line_total   numeric(10,2) NOT NULL DEFAULT 0,  -- calculated: stored for query perf
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);
```

**RLS pattern (same as all other tables):**
```sql
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_tenant_own" ON invoices
  FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));
CREATE POLICY "service_role_all_invoices" ON invoices
  FOR ALL USING (auth.role() = 'service_role');
-- (same structure for invoice_settings, invoice_sequences, invoice_line_items)
```

### Line Total Calculation Rules

| Type | Formula |
|------|---------|
| labor | `quantity × unit_price` |
| materials | `quantity × unit_price × (1 + markup_pct)` |
| travel | `unit_price` (quantity ignored) |
| flat_rate | `unit_price` |
| discount | `-abs(unit_price)` (always negative) |

`subtotal` = sum of all `line_total` values
`tax_amount` = sum of `line_total` for all taxable items × `invoice_settings.tax_rate`
`total` = `subtotal` + `tax_amount`

---

## Code Examples

### Resend Email with PDF Attachment

```javascript
// Source: https://resend.com/docs/api-reference/emails/send-email (verified 2026-04-01)
await getResendClient().emails.send({
  from: `${settings.business_name} <invoices@getvoco.ai>`,
  to: invoice.customer_email,
  subject: `Invoice ${invoice.invoice_number} from ${settings.business_name}`,
  react: InvoiceEmail({ invoice, settings, lineItems }),
  attachments: [
    {
      content: pdfBuffer,           // Buffer from renderToBuffer()
      filename: `invoice-${invoice.invoice_number}.pdf`,
    },
  ],
});
```

### Twilio Invoice SMS (D-11)

```javascript
// Source: existing pattern in src/lib/notifications.js
await getTwilioClient().messages.create({
  body: `${settings.business_name}: Invoice ${invoice.invoice_number} for $${invoice.total.toFixed(2)} due ${invoice.due_date}. Full invoice sent to your email. Questions? Call ${settings.phone}`,
  from: tenant.retell_phone_number,   // business phone number per D-11
  to: invoice.customer_phone,
});
```

### Overdue Status Bulk Update (page-load check)

```javascript
// In Invoices tab page useEffect — runs once on mount
const today = new Date().toISOString().split('T')[0];
await supabase
  .from('invoices')
  .update({ status: 'overdue', updated_at: new Date().toISOString() })
  .eq('tenant_id', tenantId)
  .eq('status', 'sent')
  .lt('due_date', today);
```

### Status Badge Config (matches existing billing page pattern)

```javascript
// Source: existing pattern in src/app/dashboard/more/billing/page.js lines 196-208
const INVOICE_STATUS_CONFIG = {
  draft:   { label: 'Draft',   className: 'bg-stone-100 text-stone-600' },
  sent:    { label: 'Sent',    className: 'bg-blue-100 text-blue-700' },
  overdue: { label: 'Overdue', className: 'bg-red-100 text-red-700' },
  paid:    { label: 'Paid',    className: 'bg-green-100 text-green-700' },
  void:    { label: 'Void',    className: 'bg-stone-100 text-stone-400 line-through' },
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `experimental.serverComponentsExternalPackages` | `serverExternalPackages` (stable) | Next.js 14.1 | `experimental` prefix dropped; use the stable key |
| `@react-pdf/renderer` React 18 only | Supports React 16–19 | v4.x | No version pinning needed; works with project's React 19 |
| Resend v1–v5 attachment format | Same format in v6 (`content` + `filename`) | v6.x | No breaking change for attachments |

**Deprecated / outdated:**
- `PDFDownloadLink` and `PDFViewer`: Browser-only components. Use `renderToBuffer` in API routes for server-side PDF generation.
- `experimental.serverComponentsExternalPackages`: Replaced by `serverExternalPackages` at the top level of `nextConfig`.

---

## Open Questions

1. **Analytics page relocation path**
   - What we know: D-01 says Analytics moves to a sub-page under More.
   - What's unclear: Should the existing `/dashboard/analytics` route redirect to `/dashboard/more/analytics`, or should the page file be physically moved? The existing `analytics/page.js` is a client component.
   - Recommendation: Move the file to `src/app/dashboard/more/analytics/page.js` and add a redirect at the old path (`src/app/dashboard/analytics/page.js` → `redirect('/dashboard/more/analytics')`). This preserves any bookmarked URLs.

2. **Invoice settings pre-population**
   - What we know: `invoice_settings` is a new table; the tenant already has `business_name`, `owner_phone`, `owner_email` in the `tenants` table. The settings table has address, phone, email, logo, license.
   - What's unclear: Should the first GET to `/api/invoice-settings` auto-create a row seeded from `tenants` data?
   - Recommendation: Yes. If no row exists, create it with `business_name` and `owner_email` pre-populated from `tenants`. This gives the contractor a useful starting point without a required setup step.

3. **SMS from number**
   - What we know: D-11 says SMS comes "from the business phone number" (`tenant.retell_phone_number` — the Twilio number provisioned during onboarding).
   - What's unclear: Singapore numbers (SG tenants) were provisioned from `phone_inventory` and may have SMS capability; US/CA numbers were purchased via Twilio API. Whether all provisioned numbers have SMS enabled needs validation.
   - Recommendation: Attempt the SMS send. If Twilio returns a capability error, catch it and log a warning. Do not fail the invoice send operation if SMS fails.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `resend` npm package | Email delivery | Yes (installed) | 6.9.4 | — |
| `twilio` npm package | SMS delivery | Yes (installed) | 5.13.0 | — |
| `@react-pdf/renderer` | PDF generation | Not installed yet | 4.3.2 on npm | — |
| `@react-email/components` | Invoice email body | Yes (installed) | 1.0.10 | — |
| `date-fns` | Date formatting | Yes (installed) | 4.1.0 | — |
| Supabase Storage | Logo upload | Available (Supabase configured) | — | Skip logo; leave logo_url null |
| RESEND_API_KEY env var | Email delivery | Assumed set (used by existing notifications) | — | — |
| TWILIO_ACCOUNT_SID / AUTH_TOKEN env vars | SMS delivery | Assumed set (used by existing notifications) | — | — |

**Missing dependencies with no fallback:**
- `@react-pdf/renderer` — must be installed (`npm install @react-pdf/renderer`). Wave 0 install step required.
- `serverExternalPackages: ['@react-pdf/renderer']` in `next.config.js` — must be added before any PDF generation. Without it, every PDF request will 500.

**Missing dependencies with fallback:**
- Supabase Storage `invoice-logos` bucket — if not created, logo upload will fail but invoice creation and delivery still works (logo_url stays null, PDF renders without logo).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 |
| Config file | `jest.config.js` (root) |
| Quick run command | `npm test -- --testPathPattern=invoices` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INV-01 | Line total calculation for all 5 item types | unit | `npm test -- --testPathPattern=invoice-calculations` | No — Wave 0 |
| INV-02 | Tax calculation on taxable-only items | unit | `npm test -- --testPathPattern=invoice-calculations` | No — Wave 0 |
| INV-03 | Invoice number formatting (INV-2026-0001) | unit | `npm test -- --testPathPattern=invoice-number` | No — Wave 0 |
| INV-04 | Bidirectional sync: invoice Paid → lead Paid | unit (mocked Supabase) | `npm test -- --testPathPattern=invoice-sync` | No — Wave 0 |
| INV-05 | Overdue bulk update query correctness | unit | `npm test -- --testPathPattern=invoice-overdue` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- --testPathPattern=invoice --passWithNoTests`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/invoice-calculations.test.js` — covers INV-01, INV-02 (pure functions, no DB)
- [ ] `tests/unit/invoice-number.test.js` — covers INV-03 (formatting pure function)
- [ ] `tests/unit/invoice-sync.test.js` — covers INV-04 (mocked fetch/supabase)

---

## Sources

### Primary (HIGH confidence)

- `@react-pdf/renderer` npm registry — version 4.3.2, published 2025-12-29, React 19 compatible
- [react-pdf.org/compatibility](https://react-pdf.org/compatibility) — `serverExternalPackages` config requirement
- [resend.com/docs/api-reference/emails/send-email](https://resend.com/docs/api-reference/emails/send-email) — attachment format: `{content: Buffer, filename: string}`
- Codebase: `src/lib/notifications.js` — Twilio SMS and Resend email patterns (lazy-init, try/catch)
- Codebase: `src/emails/NewLeadEmail.jsx` — React Email template pattern with inline styles
- Codebase: `src/app/dashboard/more/billing/page.js` — Table, Badge, Skeleton, status badge config patterns
- Codebase: `supabase/migrations/004_leads_crm.sql` — leads table schema, RLS pattern
- Codebase: `src/components/dashboard/DashboardSidebar.jsx` — current NAV_ITEMS (6 items, not 5)
- Codebase: `src/components/dashboard/BottomTabBar.jsx` — current TABS (6 items)
- Codebase: `next.config.js` — no `serverExternalPackages` currently set

### Secondary (MEDIUM confidence)

- [GitHub issue #3074](https://github.com/diegomura/react-pdf/issues/3074) — "renderToBuffer not working with Next 15": `serverExternalPackages` + React 19 resolves the issue (multiple community confirmations)

### Tertiary (LOW confidence)

- WebSearch results on `@react-pdf/renderer` + Next.js App Router — patterns are consistent across multiple sources but not from official Next.js docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against npm registry and existing codebase
- Architecture: HIGH — derived from verified existing codebase patterns + official library docs
- Pitfalls: HIGH — Pitfall 1-4 confirmed by GitHub issues and codebase inspection; Pitfall 5-7 derived from domain knowledge

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable libraries; @react-pdf/renderer is actively maintained but API is stable in v4.x)

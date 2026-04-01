# Phase 35: Invoice Integrations and AI - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the existing invoice system (Phase 33) with three capabilities: (1) push-only sync to QuickBooks Online, Xero, and FreshBooks via OAuth, (2) AI-generated line item descriptions from call transcripts using Gemini Flash, and (3) batch invoice creation from multiple completed leads with review-then-send flow. Customer financing integration (Wisetack/Hearth) is deferred — out of scope for this phase.

</domain>

<decisions>
## Implementation Decisions

### Accounting Software Sync
- **D-01:** Support three platforms: QuickBooks Online, Xero, and FreshBooks. Build an adapter pattern (shared interface, three platform-specific implementations) so each platform follows the same shape.
- **D-02:** Push-only sync direction. Voco pushes invoices to accounting software — no pull-back of status updates or changes from the accounting side. Voco is the source of truth for invoice creation. Can add bidirectional sync in a future phase.
- **D-03:** Push triggers on send. When owner sends an invoice, Voco automatically pushes it to the connected accounting software. Draft invoices stay local. Status updates (paid, voided) are also pushed. Zero extra steps for the contractor.
- **D-04:** OAuth connection via Settings page. New "Integrations" section under More/Settings. Owner clicks "Connect QuickBooks" (or Xero/FreshBooks), completes OAuth flow, done. Same pattern as existing Google/Outlook Calendar OAuth flows.
- **D-05:** Adapter pattern architecture. One shared integration interface with platform-specific adapters for QBO, Xero, FreshBooks. Adding a new platform = writing a new adapter. Shared: OAuth token management, sync status tracking, error handling. Platform-specific: API client, data mapping, invoice field translation.

### AI Work Descriptions
- **D-06:** Manual trigger via "AI Describe" button in the invoice editor. Owner clicks the button to generate professional line item descriptions from linked call transcript(s). Not auto-generated on create — owner initiates when they want it.
- **D-07:** AI generates line item descriptions only — professional text for each line item based on what was discussed on the call (e.g., "Replaced 40-gallon gas water heater" instead of blank or generic text). Does NOT suggest pricing, labor hours, or materials quantities.
- **D-08:** Use Gemini Flash for generation. Same vendor as the voice agent — one API key, one billing relationship. Fast and cheap for summarization/extraction tasks.
- **D-09:** Transcript access via lead_calls junction table. When generating descriptions, fetch transcript_text from the linked call(s) through lead_id → lead_calls → calls. Handle multiple calls per lead (repeat callers) by combining transcripts.

### Batch Invoicing
- **D-10:** Multi-select from leads. Owner selects multiple completed leads (from Leads page or Invoices page), clicks "Create Invoices". Each selected lead becomes a separate draft invoice with pre-filled customer data from the lead.
- **D-11:** Review then batch send. Batch-created invoices start as drafts. Owner sees a review list, can edit any individual invoice, then hits "Send All" to deliver them all at once. Safe workflow that catches errors before sending.

### Claude's Discretion
- Integration settings UI layout and design
- OAuth token storage schema (new table or extend existing calendar_credentials pattern)
- Error handling for failed pushes (retry strategy, error display)
- AI prompt engineering for description generation
- Batch creation progress UX (loading states, success/failure per invoice)
- Whether to show sync status badges on invoices (synced/pending/failed)
- Data mapping details per accounting platform (chart of accounts, tax handling)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Invoice System (Phase 33 — foundation this builds on)
- `.planning/phases/33-invoice-core/33-CONTEXT.md` — All 17 decisions for the base invoice system, including white-label constraint (D-08/D-09), status lifecycle (D-13), and invoice settings (D-17)
- `supabase/migrations/029_invoice_schema.sql` — Invoice tables: invoices, invoice_line_items, invoice_settings, invoice_sequences
- `src/lib/invoice-calculations.js` — Pure calculation functions for line items and totals
- `src/lib/invoice-pdf.jsx` — React PDF Document component
- `src/app/api/invoices/route.js` — GET (list + aggregates), POST (create with atomic sequencing)
- `src/app/api/invoices/[id]/route.js` — GET, PATCH (with bidirectional lead sync)
- `src/app/api/invoices/[id]/send/route.js` — POST send via Resend email + Twilio SMS

### OAuth Patterns (reuse for accounting integrations)
- `src/app/api/calendar-sync/` — Google/Outlook Calendar OAuth flow pattern (connect, callback, disconnect)
- `supabase/migrations/` — calendar_credentials table schema (OAuth token storage pattern)

### Transcript Access
- `supabase/migrations/001_initial_schema.sql` — calls table with transcript_text and transcript_structured columns
- `src/app/api/calls/route.js` — Call data access pattern
- Lead-call relationship via lead_calls junction table (lead_id, call_id composite PK)

### Lead Integration
- `src/components/dashboard/LeadFlyout.jsx` — Lead detail flyout, existing "Create Invoice" button
- `src/app/api/leads/[id]/route.js` — Lead PATCH endpoint

### Design System
- `src/lib/design-tokens.js` — card.base, btn.primary, colors tokens
- `src/components/ui/` — shadcn components

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Calendar OAuth pattern** (`src/app/api/calendar-sync/`): Google and Outlook Calendar use OAuth connect/callback/disconnect flows. Accounting integrations follow the same shape — reuse the token management pattern.
- **Invoice send route** (`src/app/api/invoices/[id]/send/route.js`): Already handles email + SMS delivery. Batch send can call this route per invoice or extract shared logic.
- **LeadFlyout** (`src/components/dashboard/LeadFlyout.jsx`): Already has "Create Invoice" button for single lead → invoice. Batch extends this with multi-select.
- **Resend/Twilio clients** (`src/lib/notifications.js`): getResendClient and getTwilioClient exported for reuse.

### Established Patterns
- **API route structure**: `src/app/api/[feature]/route.js` with createSupabaseServer() + getTenantId() — follow for new integration routes.
- **RLS policies**: All tables use tenant_id-based isolation. New integration tables follow same pattern.
- **Cron jobs**: Vercel cron at `src/app/api/cron/` for scheduled tasks (token refresh, etc).
- **Webhook handling**: Stripe webhook pattern at `/api/stripe/webhook` — reference for potential accounting webhook receivers.

### Integration Points
- **Invoice send flow**: Hook accounting sync into the existing send flow — after email/SMS delivery, push to connected accounting software.
- **Invoice status updates**: PATCH route already handles paid/voided transitions — add accounting sync push on status change.
- **Invoice editor UI**: Add "AI Describe" button to the existing line item editor.
- **Leads page**: Add multi-select capability for batch invoice creation.
- **More/Settings page**: Add "Integrations" section with OAuth connect buttons.

</code_context>

<specifics>
## Specific Ideas

- Adapter pattern for accounting software — shared interface so adding platforms is just writing a new adapter, not rearchitecting.
- AI descriptions should sound professional and trade-specific (plumbing, HVAC, electrical terminology), not generic.
- Batch flow should feel efficient — the contractor completed 5 jobs today and wants to invoice them all in under 2 minutes.

</specifics>

<deferred>
## Deferred Ideas

- **Customer financing integration (Wisetack/Hearth)** — Discussed but deferred. Conflicts with the no-payment-processing constraint (D-08 from Phase 33). Would need its own phase to figure out how financing links work without Voco processing payments.
- **Bidirectional accounting sync** — Pull payment status from QBO/Xero/FreshBooks back to Voco. Future enhancement once push-only is solid.
- **Auto-generate descriptions on invoice create** — Discussed, owner preferred manual trigger. Could revisit as a user setting later.
- **Full invoice draft generation from AI** — AI suggesting pricing, labor hours, materials quantities from transcript. Too risky for accuracy — deferred.
- **Estimates/quotes (good/better/best)** — Phase 34
- **Automated payment reminders** — Phase 34
- **Recurring invoices** — Phase 34

</deferred>

---

*Phase: 35-invoice-integrations-and-ai*
*Context gathered: 2026-04-01*

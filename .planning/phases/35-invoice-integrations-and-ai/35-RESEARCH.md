# Phase 35: Invoice Integrations and AI - Research

**Researched:** 2026-04-01
**Domain:** Accounting software OAuth integration, AI text generation, batch operations
**Confidence:** HIGH

## Summary

Phase 35 extends the Phase 33 invoice system with three capabilities: push-only sync to QuickBooks Online/Xero/FreshBooks, AI-generated line item descriptions from call transcripts, and batch invoice creation from multiple leads. The codebase already has a mature OAuth pattern (Google/Outlook Calendar in `src/app/api/google-calendar/` and `src/app/api/outlook-calendar/`) that uses HMAC-signed state, token upsert to `calendar_credentials`, and redirect-based callback flows. The accounting integrations follow the exact same shape.

The invoice schema (migration 029) supports `lead_id` linkage, and the `lead_calls` junction table plus `calls.transcript_text` provide the data path for AI description generation. The adapter pattern decision (D-05) maps cleanly to a shared interface with platform-specific implementations. All three accounting APIs use OAuth 2.0 Authorization Code flow with refresh tokens, making the pattern highly reusable.

**Primary recommendation:** Build an `accounting_credentials` table modeled on `calendar_credentials`, a shared adapter interface in `src/lib/accounting/`, and hook sync into the existing invoice send and status-change flows. Use `@google/genai` for Gemini Flash transcript summarization since the project already has a Gemini API key for the voice agent.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Support three platforms: QuickBooks Online, Xero, and FreshBooks. Build an adapter pattern (shared interface, three platform-specific implementations) so each platform follows the same shape.
- **D-02:** Push-only sync direction. Voco pushes invoices to accounting software -- no pull-back of status updates or changes from the accounting side. Voco is the source of truth for invoice creation. Can add bidirectional sync in a future phase.
- **D-03:** Push triggers on send. When owner sends an invoice, Voco automatically pushes it to the connected accounting software. Draft invoices stay local. Status updates (paid, voided) are also pushed. Zero extra steps for the contractor.
- **D-04:** OAuth connection via Settings page. New "Integrations" section under More/Settings. Owner clicks "Connect QuickBooks" (or Xero/FreshBooks), completes OAuth flow, done. Same pattern as existing Google/Outlook Calendar OAuth flows.
- **D-05:** Adapter pattern architecture. One shared integration interface with platform-specific adapters for QBO, Xero, FreshBooks. Adding a new platform = writing a new adapter. Shared: OAuth token management, sync status tracking, error handling. Platform-specific: API client, data mapping, invoice field translation.
- **D-06:** Manual trigger via "AI Describe" button in the invoice editor. Owner clicks the button to generate professional line item descriptions from linked call transcript(s). Not auto-generated on create -- owner initiates when they want it.
- **D-07:** AI generates line item descriptions only -- professional text for each line item based on what was discussed on the call (e.g., "Replaced 40-gallon gas water heater" instead of blank or generic text). Does NOT suggest pricing, labor hours, or materials quantities.
- **D-08:** Use Gemini Flash for generation. Same vendor as the voice agent -- one API key, one billing relationship. Fast and cheap for summarization/extraction tasks.
- **D-09:** Transcript access via lead_calls junction table. When generating descriptions, fetch transcript_text from the linked call(s) through lead_id -> lead_calls -> calls. Handle multiple calls per lead (repeat callers) by combining transcripts.
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

### Deferred Ideas (OUT OF SCOPE)
- Customer financing integration (Wisetack/Hearth) -- conflicts with no-payment-processing constraint
- Bidirectional accounting sync -- pull payment status from QBO/Xero/FreshBooks back to Voco
- Auto-generate descriptions on invoice create -- owner preferred manual trigger
- Full invoice draft generation from AI -- AI suggesting pricing, labor hours, materials quantities
- Estimates/quotes (good/better/best) -- Phase 34
- Automated payment reminders -- Phase 34
- Recurring invoices -- Phase 34
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| D-01 | Three platforms: QBO, Xero, FreshBooks with adapter pattern | Standard Stack section covers SDKs; Architecture Patterns covers adapter interface |
| D-02 | Push-only sync direction | Architecture Patterns covers push-on-send hook and status-change propagation |
| D-03 | Push triggers on send and status change | Code Examples show hook into existing send route; Common Pitfalls covers fire-and-forget |
| D-04 | OAuth via Settings page | Existing calendar OAuth pattern documented; new Integrations page in More menu |
| D-05 | Adapter pattern with shared interface | Architecture Patterns covers interface shape, per-platform adapters |
| D-06 | Manual "AI Describe" button | Gemini Flash API pattern in Code Examples; UI is Claude's discretion |
| D-07 | AI line item descriptions only (no pricing) | Prompt engineering guidance in Code Examples |
| D-08 | Gemini Flash for generation | Standard Stack covers @google/genai SDK |
| D-09 | Transcript access via lead_calls | Data access pattern documented in Code Examples |
| D-10 | Multi-select leads for batch creation | Batch API pattern in Architecture Patterns |
| D-11 | Review-then-batch-send flow | Architecture Patterns covers batch send mechanics |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Brand name is Voco** -- not HomeService AI. Fallback email domain: `getvoco.ai`.
- **Keep skills in sync** -- read relevant skill before changes, update after.
- **Tech stack**: Next.js App Router, Supabase (Auth + Postgres + RLS), Tailwind CSS, shadcn/ui.
- **API route pattern**: `createSupabaseServer()` + `getTenantId()` in every route handler.
- **RLS everywhere**: All tables use `tenant_id`-based isolation with owner-check policies.
- **White-label invoice constraint** (Phase 33 D-08/D-09): Invoice emails from `getvoco.ai` domain, zero platform branding in templates.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `intuit-oauth` | 4.2.2 | QuickBooks OAuth 2.0 token management | Official Intuit SDK for OAuth flows |
| `node-quickbooks` | 2.0.50 | QuickBooks API client (invoice CRUD) | Most popular Node.js QBO client, full v3 API support |
| `xero-node` | 14.0.0 | Xero OAuth 2.0 + API client | Official Xero Node.js SDK, handles token refresh |
| `@freshbooks/api` | 4.1.0 | FreshBooks OAuth 2.0 + API client | Official FreshBooks Node.js SDK |
| `@google/genai` | 1.47.0 | Gemini Flash text generation | Latest Google GenAI SDK (replaces @google/generative-ai); same vendor as voice agent |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `googleapis` | 171.4.0 | Already in project | Not needed for accounting -- use dedicated SDKs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node-quickbooks` | Direct REST calls | More boilerplate but no dependency; SDK handles pagination/errors |
| `@google/genai` | `@google/generative-ai` (0.24.1) | Older SDK, won't get Gemini 2.0+ features; use newer `@google/genai` |
| Separate SDKs per platform | Unified accounting API (Merge, Apideck) | Third-party dependency + cost; direct SDKs give full control |

**Installation:**
```bash
npm install intuit-oauth node-quickbooks xero-node @freshbooks/api @google/genai
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    accounting/
      types.js              # Shared interface/type definitions
      adapter.js            # Adapter factory + shared token management
      quickbooks.js         # QBO adapter implementation
      xero.js               # Xero adapter implementation
      freshbooks.js         # FreshBooks adapter implementation
      sync.js               # Push-on-send orchestration logic
    ai/
      invoice-describe.js   # Gemini Flash transcript -> line item descriptions
  app/
    api/
      accounting/
        [provider]/
          auth/route.js     # OAuth initiation (GET -> redirect URL)
          callback/route.js # OAuth callback (GET -> token exchange + store)
        disconnect/route.js # Disconnect integration (POST)
        status/route.js     # Get connection status (GET)
        sync/route.js       # Manual re-sync trigger (POST)
      invoices/
        batch/route.js      # POST batch create from lead IDs
        batch-send/route.js # POST batch send multiple drafts
        [id]/
          ai-describe/route.js  # POST generate AI descriptions
    dashboard/
      more/
        integrations/page.js    # New "Integrations" settings page
```

### Pattern 1: Accounting Adapter Interface

**What:** Shared interface that all three accounting adapters implement.
**When to use:** Every accounting API interaction goes through the adapter.

```javascript
// src/lib/accounting/types.js

/**
 * @typedef {Object} AccountingAdapter
 * @property {(invoice, lineItems, settings) => Promise<{externalId: string}>} pushInvoice
 * @property {(externalId, status) => Promise<void>} updateInvoiceStatus
 * @property {(tenantId) => Promise<string>} getAuthUrl
 * @property {(code, tenantId) => Promise<TokenSet>} exchangeCode
 * @property {(tokenSet) => Promise<TokenSet>} refreshToken
 */

/**
 * Shared shape for data mapped to external invoice format.
 * Each adapter maps FROM this shape TO platform-specific fields.
 * @typedef {Object} ExternalInvoice
 * @property {string} customerName
 * @property {string} customerEmail
 * @property {Array<{description: string, quantity: number, unitPrice: number, taxable: boolean}>} lineItems
 * @property {string} invoiceNumber
 * @property {string} issuedDate
 * @property {string} dueDate
 * @property {number} taxRate
 */
```

### Pattern 2: OAuth Flow (Reuse Calendar Pattern)

**What:** Same HMAC-signed state + redirect flow as Google/Outlook Calendar OAuth.
**When to use:** Connecting accounting software.

The existing pattern uses:
1. `GET /api/google-calendar/auth` -- returns OAuth consent URL with HMAC-signed state
2. `GET /api/google-calendar/callback` -- exchanges code, upserts credentials, redirects to dashboard
3. `signOAuthState(tenantId)` / `verifyOAuthState(state)` -- CSRF protection via HMAC

Accounting OAuth routes follow the same shape with `[provider]` dynamic route:
- `GET /api/accounting/[provider]/auth` -- initiate OAuth for qbo/xero/freshbooks
- `GET /api/accounting/[provider]/callback` -- handle redirect, store tokens

### Pattern 3: Push-on-Send Hook

**What:** After invoice send succeeds, fire accounting sync as non-fatal side effect.
**When to use:** D-03 -- automatic push when invoice is sent or status changes.

```javascript
// In the existing send route, AFTER email delivery + status update:
// src/app/api/invoices/[id]/send/route.js (modified)

// ... existing send logic ...

// ── Push to accounting (non-fatal) ──
try {
  const { pushToAccounting } = await import('@/lib/accounting/sync.js');
  await pushToAccounting(tenantId, updatedInvoice, lineItems, settings);
} catch (err) {
  console.warn('[accounting-sync] Push failed (non-fatal):', err?.message || err);
  // Log sync failure to accounting_sync_log table for retry/display
}
```

### Pattern 4: Batch Invoice Creation

**What:** Accept array of lead IDs, create one draft invoice per lead.
**When to use:** D-10 -- multi-select leads for batch creation.

```javascript
// POST /api/invoices/batch
// Body: { lead_ids: ['uuid1', 'uuid2', ...] }
// Returns: { invoices: [...], errors: [{lead_id, error}] }
// Each lead becomes a separate draft with pre-filled customer data.
// Uses the existing POST /api/invoices logic internally (per-invoice).
```

### Anti-Patterns to Avoid
- **Synchronous accounting push in send flow:** NEVER block the send response waiting for QBO/Xero API. Push must be fire-and-forget with error logging.
- **Shared calendar_credentials table:** Calendar and accounting serve different purposes with different providers. Use a separate `accounting_credentials` table to avoid schema conflicts.
- **Auto-creating customers in accounting software:** For push-only, create or find the customer inline during invoice push. Don't build a separate customer sync system.
- **Storing accounting platform IDs on the invoice table directly:** Use a separate `accounting_sync_log` table to track sync status per invoice, keeping the invoices table clean.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QBO OAuth token refresh | Custom refresh logic | `intuit-oauth` SDK `refreshUsingToken()` | Handles edge cases (expired refresh tokens, token rotation) |
| Xero OAuth + multi-tenant | Custom OAuth flow | `xero-node` XeroClient | Handles tenant selection (Xero requires selecting organization after OAuth) |
| FreshBooks API client | Custom REST wrapper | `@freshbooks/api` Client | Token refresh, pagination, error formatting built in |
| Gemini API call | Custom HTTP to Gemini REST | `@google/genai` generateContent | Model selection, safety settings, response parsing |
| HMAC state signing | New implementation | `signOAuthState` / `verifyOAuthState` from `src/app/api/google-calendar/auth/route.js` | Already exists and tested |

**Key insight:** Each accounting platform has its own quirks (Xero's tenant/organization model, QBO's realm ID, FreshBooks's account ID). The official SDKs handle these. Rolling custom REST clients would require re-implementing error handling, token refresh, and data serialization that the SDKs already solve.

## Common Pitfalls

### Pitfall 1: Xero Tenant Selection
**What goes wrong:** Xero OAuth returns an access token, but you can't make API calls until you select which organization (tenant) to use. Xero users can have multiple organizations.
**Why it happens:** Xero's OAuth flow requires a separate step to list connected tenants and select one.
**How to avoid:** After OAuth callback, call the Xero Connections endpoint to list available tenants. If only one, auto-select. If multiple, show a selection UI before storing credentials.
**Warning signs:** API calls return 403 after seemingly successful OAuth.

### Pitfall 2: QuickBooks Realm ID
**What goes wrong:** QBO API calls fail because the realm ID (company ID) wasn't captured during OAuth.
**Why it happens:** The realm ID is returned as a query parameter in the OAuth callback URL, not in the token response.
**How to avoid:** Extract `realmId` from the callback URL query params and store it alongside tokens in `accounting_credentials`.
**Warning signs:** 401/404 errors on QBO API calls despite valid access token.

### Pitfall 3: Token Expiry Handling
**What goes wrong:** Accounting sync fails because access token expired between connect and first invoice send (could be days/weeks later).
**Why it happens:** QBO access tokens expire in 1 hour, Xero in 30 minutes, FreshBooks in variable time.
**How to avoid:** Always refresh the access token before making an API call. Each SDK provides a refresh method. Check `expiry_date` and refresh proactively if within 5 minutes of expiry.
**Warning signs:** Sporadic 401 errors on sync attempts.

### Pitfall 4: Customer Matching in Accounting Software
**What goes wrong:** Invoice push fails because the customer doesn't exist in QBO/Xero/FreshBooks.
**Why it happens:** Voco's invoice has a customer name/email but no corresponding customer record in the accounting software.
**How to avoid:** On push, search for existing customer by email first. If not found, create the customer, then create the invoice referencing the new customer ID.
**Warning signs:** Invoice creation API returns "customer not found" or similar.

### Pitfall 5: Fire-and-Forget Without Logging
**What goes wrong:** Accounting sync silently fails and the owner has no visibility into what synced and what didn't.
**Why it happens:** Push is non-fatal (correct) but errors are only logged to console (bad for UX).
**How to avoid:** Create an `accounting_sync_log` table tracking sync attempts, status (pending/synced/failed), external ID, error message. Show sync status badges on invoices in the UI.
**Warning signs:** Owner expects invoices in QBO but can't find them; no error visible in Voco.

### Pitfall 6: Gemini Hallucinating Line Items
**What goes wrong:** AI generates descriptions for services not discussed in the transcript, or invents specific part numbers/brands.
**Why it happens:** LLMs fill in gaps and can be overconfident about details.
**How to avoid:** Prompt must explicitly instruct: "Only describe work explicitly mentioned in the transcript. Do not invent specific brands, model numbers, or part numbers unless the caller stated them." Owner reviews before saving (D-06 -- manual trigger).
**Warning signs:** Generated descriptions contain specific details not in the transcript.

## Code Examples

### Transcript Fetch for AI Description (D-09)

```javascript
// src/lib/ai/invoice-describe.js
// Fetches transcripts via lead_id -> lead_calls -> calls

async function getTranscriptsForLead(supabase, leadId, tenantId) {
  const { data: leadCalls } = await supabase
    .from('lead_calls')
    .select('call_id')
    .eq('lead_id', leadId);

  if (!leadCalls || leadCalls.length === 0) return null;

  const callIds = leadCalls.map(lc => lc.call_id);

  const { data: calls } = await supabase
    .from('calls')
    .select('transcript_text, created_at')
    .in('id', callIds)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  // Combine transcripts from multiple calls (repeat callers)
  return (calls || [])
    .filter(c => c.transcript_text)
    .map(c => c.transcript_text)
    .join('\n\n---\n\n');
}
```

### Gemini Flash Prompt for Line Item Descriptions (D-07, D-08)

```javascript
// src/lib/ai/invoice-describe.js
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateLineItemDescriptions(transcript, existingLineItems) {
  const prompt = `You are helping a home service contractor write professional invoice line item descriptions.

Given the call transcript below, generate a clear, professional description for each line item on this invoice.

RULES:
- Describe ONLY work explicitly discussed in the transcript
- Use professional trade terminology (plumbing, HVAC, electrical)
- Do NOT suggest pricing, labor hours, or materials quantities
- Do NOT invent brand names, model numbers, or part numbers unless the caller stated them
- Keep each description to 1-2 sentences
- If the transcript doesn't mention relevant work for a line item, return the existing description unchanged

EXISTING LINE ITEMS:
${existingLineItems.map((item, i) => `${i + 1}. [${item.item_type}] ${item.description || '(empty)'}`).join('\n')}

CALL TRANSCRIPT:
${transcript}

Return a JSON array of strings, one description per line item, in the same order.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  });

  return JSON.parse(response.text);
}
```

### Accounting Credentials Schema (New Migration 030)

```sql
-- 030_accounting_integrations.sql

CREATE TABLE accounting_credentials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider        text NOT NULL
    CHECK (provider IN ('quickbooks', 'xero', 'freshbooks')),
  access_token    text NOT NULL,
  refresh_token   text NOT NULL,
  expiry_date     bigint,
  -- Platform-specific identifiers
  realm_id        text,          -- QBO company/realm ID
  xero_tenant_id  text,          -- Xero organization ID
  account_id      text,          -- FreshBooks account ID
  display_name    text,          -- Company name from accounting software
  connected_at    timestamptz NOT NULL DEFAULT now(),
  last_synced_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

ALTER TABLE accounting_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounting_credentials_tenant_own" ON accounting_credentials
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_accounting_credentials" ON accounting_credentials
  FOR ALL USING (auth.role() = 'service_role');

-- Sync log: track push status per invoice
CREATE TABLE accounting_sync_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id      uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  provider        text NOT NULL,
  external_id     text,            -- ID in accounting software
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'synced', 'failed')),
  error_message   text,
  attempted_at    timestamptz NOT NULL DEFAULT now(),
  synced_at       timestamptz,
  UNIQUE (invoice_id, provider)    -- one sync record per invoice per provider
);

ALTER TABLE accounting_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounting_sync_log_tenant_own" ON accounting_sync_log
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_accounting_sync_log" ON accounting_sync_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_accounting_sync_log_invoice ON accounting_sync_log(invoice_id);
CREATE INDEX idx_accounting_sync_log_tenant ON accounting_sync_log(tenant_id, status);
```

### QBO Invoice Push Example

```javascript
// src/lib/accounting/quickbooks.js
// Key fields for QBO invoice creation API:
// POST https://quickbooks.api.intuit.com/v3/company/{realmId}/invoice
// (sandbox: https://sandbox-quickbooks.api.intuit.com/v3/company/{realmId}/invoice)

const qboInvoicePayload = {
  CustomerRef: { value: customerId },  // Must find/create customer first
  Line: lineItems.map(item => ({
    DetailType: 'SalesItemLineDetail',
    Amount: item.line_total,
    Description: item.description,
    SalesItemLineDetail: {
      Qty: item.quantity,
      UnitPrice: item.unit_price,
    },
  })),
  DueDate: invoice.due_date,
  DocNumber: invoice.invoice_number,
};
```

### Xero Invoice Push Example

```javascript
// src/lib/accounting/xero.js
// Xero requires xero-tenant-id header on every API call
// Invoice type ACCREC = accounts receivable (customer invoice)

const xeroInvoicePayload = {
  Type: 'ACCREC',
  Contact: { Name: invoice.customer_name, EmailAddress: invoice.customer_email },
  LineItems: lineItems.map(item => ({
    Description: item.description,
    Quantity: item.quantity,
    UnitAmount: item.unit_price,
    AccountCode: '200',  // Default sales account -- may need to be configurable
  })),
  DueDate: invoice.due_date,
  InvoiceNumber: invoice.invoice_number,
  Status: 'AUTHORISED',  // Xero uses AUTHORISED for sent invoices
};
```

### FreshBooks Invoice Push Example

```javascript
// src/lib/accounting/freshbooks.js
// FreshBooks uses account_id in URL and customer_id for client

const fbInvoicePayload = {
  invoice: {
    customerid: clientId,  // Must find/create client first
    create_date: invoice.issued_date,
    due_offset_days: 30,
    lines: lineItems.map(item => ({
      type: 0,  // 0 = normal line
      name: item.item_type,
      description: item.description,
      qty: item.quantity,
      unit_cost: { amount: item.unit_price, code: 'USD' },
      taxName1: item.taxable ? 'Tax' : null,
    })),
  },
};
```

### Hook Into Existing Send Flow

```javascript
// Modification point: src/app/api/invoices/[id]/send/route.js
// AFTER the status update to 'sent' succeeds (line ~158),
// add accounting push as non-fatal side effect:

// Check if tenant has connected accounting software
const { data: accountingCred } = await supabase
  .from('accounting_credentials')
  .select('provider, access_token, refresh_token, expiry_date, realm_id, xero_tenant_id, account_id')
  .eq('tenant_id', tenantId)
  .maybeSingle();

if (accountingCred) {
  // Fire async -- don't await in the response path
  pushToAccountingSoftware(accountingCred, updatedInvoice, lineItems, settings, tenantId)
    .catch(err => console.warn('[accounting-sync] Non-fatal push error:', err?.message));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@google/generative-ai` | `@google/genai` | 2025 | New SDK is the official path forward for Gemini 2.0+ |
| QBO XML API | QBO JSON REST v3 | 2019+ | JSON is the blessed format; all SDKs use it |
| Xero OAuth 1.0a | Xero OAuth 2.0 | 2020 | OAuth 1.0a fully deprecated; only OAuth 2.0 supported |
| FreshBooks Classic API | FreshBooks API v2 | 2018 | Classic API deprecated; @freshbooks/api targets v2 |

**Deprecated/outdated:**
- `@google/generative-ai` -- still works but new `@google/genai` is recommended for new projects
- Xero OAuth 1.0a -- fully removed; only OAuth 2.0 works
- QBO API v2 -- only v3 supported

## Open Questions

1. **Gemini Model Availability**
   - What we know: `gemini-2.0-flash` is the current fast model. The voice agent uses Gemini on Railway (Python).
   - What's unclear: Whether the same API key is used for both or if a separate key is needed for the Next.js app.
   - Recommendation: Check if `GEMINI_API_KEY` or `GOOGLE_AI_API_KEY` env var already exists. If not, create one. The key works across SDKs.

2. **Accounting Platform Developer Account Setup**
   - What we know: QBO, Xero, and FreshBooks all require developer app registration for OAuth client ID/secret.
   - What's unclear: Whether sandbox/test accounts are already set up.
   - Recommendation: Phase plan should include a prerequisite step for developer account registration on all three platforms. QBO has sandbox companies; Xero has Demo Company; FreshBooks has test accounts.

3. **Tax Handling Across Platforms**
   - What we know: Voco invoices have a single `tax_rate` on `invoice_settings`. QBO/Xero/FreshBooks have different tax models (tax codes, tax rates, tax names).
   - What's unclear: How to map Voco's simple percentage to each platform's tax system.
   - Recommendation: For MVP push-only, send line items with amounts calculated (tax-inclusive total) rather than trying to map tax codes. Let the accounting software's default tax settings handle it, or make tax mapping optional/configurable later.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | Yes | (project already running) | -- |
| npm | Package install | Yes | (project already running) | -- |
| Supabase | DB migrations | Yes | (project already running) | -- |
| QBO Developer Account | QBO adapter | Unknown | -- | Sandbox provided by Intuit |
| Xero Developer Account | Xero adapter | Unknown | -- | Demo company provided by Xero |
| FreshBooks Developer Account | FB adapter | Unknown | -- | Test account from FreshBooks |
| Gemini API Key | AI descriptions | Likely (voice agent uses Gemini) | -- | Create new key in Google AI Studio |

**Missing dependencies with no fallback:**
- None -- all are obtainable services

**Missing dependencies with fallback:**
- Developer accounts for accounting platforms can be created during implementation

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 with --experimental-vm-modules |
| Config file | `jest.config.js` (root) |
| Quick run command | `npm test -- --testPathPattern="accounting\|invoice.*batch\|ai-describe" --passWithNoTests` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | Adapter factory returns correct adapter for each provider | unit | `npm test -- tests/unit/accounting-adapter.test.js -x` | Wave 0 |
| D-02 | Push-only: adapter pushInvoice creates external invoice | unit | `npm test -- tests/unit/accounting-push.test.js -x` | Wave 0 |
| D-03 | Send route triggers accounting push when connected | integration | `npm test -- tests/integration/invoice-send-accounting.test.js -x` | Wave 0 |
| D-05 | Shared interface shape enforced across adapters | unit | `npm test -- tests/unit/accounting-adapter.test.js -x` | Wave 0 |
| D-06 | AI describe endpoint returns descriptions for line items | unit | `npm test -- tests/unit/ai-describe.test.js -x` | Wave 0 |
| D-07 | AI output contains descriptions only (no pricing) | unit | `npm test -- tests/unit/ai-describe.test.js -x` | Wave 0 |
| D-09 | Transcript fetched via lead_calls junction | unit | `npm test -- tests/unit/transcript-fetch.test.js -x` | Wave 0 |
| D-10 | Batch create produces one draft per lead | integration | `npm test -- tests/integration/invoice-batch.test.js -x` | Wave 0 |
| D-11 | Batch send delivers all drafts | integration | `npm test -- tests/integration/invoice-batch-send.test.js -x` | Wave 0 |
| D-04 | OAuth flow stores credentials | manual-only | Manual: click Connect, complete OAuth, verify DB row | -- |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="accounting\|invoice.*batch\|ai-describe" --passWithNoTests`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/accounting-adapter.test.js` -- covers D-01, D-05
- [ ] `tests/unit/accounting-push.test.js` -- covers D-02, D-03 (mocked SDK calls)
- [ ] `tests/unit/ai-describe.test.js` -- covers D-06, D-07 (mocked Gemini)
- [ ] `tests/unit/transcript-fetch.test.js` -- covers D-09
- [ ] `tests/integration/invoice-batch.test.js` -- covers D-10
- [ ] `tests/integration/invoice-batch-send.test.js` -- covers D-11

## Sources

### Primary (HIGH confidence)
- Codebase: `src/app/api/google-calendar/auth/route.js` -- OAuth HMAC state pattern
- Codebase: `src/app/api/google-calendar/callback/route.js` -- OAuth callback + credential upsert pattern
- Codebase: `src/app/api/invoices/[id]/send/route.js` -- Invoice send flow (hook point)
- Codebase: `src/app/api/invoices/[id]/route.js` -- Invoice PATCH with status transitions
- Codebase: `supabase/migrations/029_invoice_schema.sql` -- Invoice table schema
- Codebase: `supabase/migrations/003_scheduling.sql` -- calendar_credentials schema (OAuth token storage pattern)
- Codebase: `supabase/migrations/004_leads_crm.sql` -- lead_calls junction table
- npm registry: `intuit-oauth@4.2.2`, `node-quickbooks@2.0.50`, `xero-node@14.0.0`, `@freshbooks/api@4.1.0`, `@google/genai@1.47.0`

### Secondary (MEDIUM confidence)
- [Intuit Developer Docs](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0) -- QBO OAuth 2.0 flow
- [Xero Developer Docs](https://developer.xero.com/documentation/api/accounting/invoices) -- Xero invoice API
- [FreshBooks API Docs](https://www.freshbooks.com/api/invoices) -- FreshBooks invoice creation
- [Google GenAI SDK](https://github.com/googleapis/js-genai) -- @google/genai usage patterns
- [Intuit Sandbox Docs](https://developer.intuit.com/app/developer/qbo/docs/develop/sandboxes) -- QBO sandbox testing

### Tertiary (LOW confidence)
- Xero tenant selection flow details -- based on training data, needs validation during implementation
- FreshBooks tax handling specifics -- requires testing with actual API responses

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- npm versions verified, SDKs are official/well-maintained
- Architecture: HIGH -- adapter pattern maps directly to existing calendar OAuth patterns in codebase
- Pitfalls: MEDIUM -- based on documented common issues and training data; some details need validation during implementation
- AI prompt: MEDIUM -- prompt engineering will need iteration with real transcripts

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (30 days -- SDKs are stable, accounting APIs change slowly)

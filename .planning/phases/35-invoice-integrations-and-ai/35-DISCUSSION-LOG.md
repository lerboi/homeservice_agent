# Phase 35: Invoice Integrations and AI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 35-invoice-integrations-and-ai
**Areas discussed:** Accounting sync, AI descriptions, Batch invoicing

---

## Accounting Sync

### Platform Selection

| Option | Description | Selected |
|--------|-------------|----------|
| QuickBooks Online only | Most US home service businesses use QBO. Ship one integration well, add Xero later. | |
| QuickBooks + Xero | Both platforms from day one. Broader market coverage. | |
| QuickBooks + Xero + FreshBooks | Three integrations. Covers most of the SMB accounting market. | ✓ |

**User's choice:** QuickBooks + Xero + FreshBooks
**Notes:** User wanted broad market coverage from the start. Adapter pattern recommended to make adding platforms manageable.

### Sync Direction

| Option | Description | Selected |
|--------|-------------|----------|
| Push-only | Voco pushes invoices to accounting software. No pull-back. Simple, no conflicts. | ✓ |
| Bidirectional sync | Changes in either system propagate. Needs conflict resolution and webhook listeners. | |
| Push + status pull | Voco pushes invoices out, periodically pulls back payment status updates. | |

**User's choice:** Push-only
**Notes:** User asked for guidance — recommended push-only as simplest and most realistic. Covers the real use case (invoices appear in bookkeeper's software). Bidirectional deferred.

### Push Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| On send only | Invoice pushed when owner hits Send. Drafts stay local. Status updates also pushed. | ✓ |
| On create (including drafts) | Every invoice appears in accounting software immediately, even drafts. | |
| Manual sync button | Owner explicitly chooses which invoices to push. | |

**User's choice:** On send only
**Notes:** User asked which was most realistic and best across all platforms — recommended on-send as it works identically across QBO/Xero/FreshBooks and avoids cluttering bookkeeper's view with drafts.

### Connection Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Settings page with OAuth | New Integrations section in Settings/More. Same pattern as Calendar OAuth. | ✓ |
| Onboarding wizard step | Optional step during signup. | |

**User's choice:** Settings page with OAuth
**Notes:** None

---

## AI Descriptions

### Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| On invoice create | Auto-fill when creating invoice from lead. | |
| Manual 'Generate' button | Owner clicks 'AI Describe' button in invoice editor. | ✓ |
| Both options | Auto-fill on create + regenerate button. | |

**User's choice:** Manual 'Generate' button
**Notes:** Owner initiates when they want it — more control.

### Output Type

| Option | Description | Selected |
|--------|-------------|----------|
| Line item descriptions only | Professional text for each line item from transcript. | ✓ |
| Full invoice draft | AI suggests line items + descriptions + estimated pricing. | |
| Job summary paragraph | Single work summary for invoice notes section. | |

**User's choice:** Line item descriptions only
**Notes:** None

### AI Model

| Option | Description | Selected |
|--------|-------------|----------|
| Gemini Flash | Same vendor as voice agent. Fast, cheap, one API key. | ✓ |
| Claude Haiku | Anthropic's fast model. Better at nuanced professional tone. | |
| OpenAI GPT-4o-mini | Fast and affordable. Adds third AI vendor. | |

**User's choice:** Gemini Flash
**Notes:** None

---

## Batch Invoicing

### Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-select from leads | Select multiple completed leads, click Create Invoices. Each becomes a separate draft. | ✓ |
| Batch from Invoices tab | Dedicated Batch Create button with lead picker. | |
| End-of-day summary | Automated prompt showing uninvoiced completed leads. | |

**User's choice:** Multi-select from leads
**Notes:** None

### Send Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Review then batch send | Created as drafts, review list, edit any, then Send All. | ✓ |
| Send immediately | All sent automatically after creation. | |
| Individual send only | Batch creates drafts but must send each individually. | |

**User's choice:** Review then batch send
**Notes:** None

---

## Claude's Discretion

- Integration settings UI layout and design
- OAuth token storage schema
- Error handling for failed pushes
- AI prompt engineering for description generation
- Batch creation progress UX
- Sync status badges on invoices
- Data mapping details per accounting platform

## Deferred Ideas

- Customer financing integration (Wisetack/Hearth) — conflicts with no-payment-processing constraint
- Bidirectional accounting sync — future enhancement
- Auto-generate descriptions on invoice create — owner preferred manual trigger
- Full invoice draft generation from AI — too risky for accuracy

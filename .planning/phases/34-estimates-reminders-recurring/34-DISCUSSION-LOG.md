# Phase 34: Estimates, Reminders, and Recurring Invoices - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 34-estimates-reminders-recurring
**Areas discussed:** Estimates model, Deposits & partial payments, Reminders & late fees

---

## Estimates Model

### Tier structure

| Option | Description | Selected |
|--------|-------------|----------|
| Tiered columns | Single estimate with 3 side-by-side columns (Good/Better/Best) | ✓ |
| Separate estimates | 3 independent estimate documents sent together | |
| Single + optional add-ons | One base estimate with optional upgrade line items | |

**User's choice:** Tiered columns
**Notes:** User initially unfamiliar with estimates concept. After research showing it's standard in US home service (used by Housecall Pro, Jobber, ServiceTitan) and a differentiator in Singapore market, decided to include it.

### Customer approval flow

| Option | Description | Selected |
|--------|-------------|----------|
| Email link to approval page | Customer clicks link, sees tiers, selects one online | |
| Reply-based approval | Customer replies to email/SMS with choice | |
| PDF only, verbal approval | Send PDF, owner marks approved after verbal confirmation | ✓ |

**User's choice:** No online approval page — owner marks approved manually
**Notes:** After researching actual contractor workflows, discovered most home service jobs are quoted verbally on-site. Online approval pages are over-engineering for the typical use case. Estimates still valuable for larger jobs sent via email/SMS.

### Tiers required or optional

| Option | Description | Selected |
|--------|-------------|----------|
| Optional | Single-price or up to 3 tiers | ✓ |
| Always 3 tiers | Every estimate requires Good/Better/Best | |

**User's choice:** Optional

### Estimate-to-invoice conversion

| Option | Description | Selected |
|--------|-------------|----------|
| Convert button | Manual "Convert to Invoice" button on approved estimate | ✓ |
| Auto-convert on approval | Auto-creates draft invoice when marked approved | |

**User's choice:** Convert button (manual)

---

## Deposits & Partial Payments

| Option | Description | Selected |
|--------|-------------|----------|
| Deposit on estimate | Formal deposit percentage/amount tied to estimates | |
| Standalone deposit tracking | Deposits tracked independently from estimates | |
| Simple payment log | "Record Payment" button, amount + date, balance auto-calculates | ✓ |

**User's choice:** Simple payment log
**Notes:** User felt formal deposit system was over-engineering. Simple payment log covers both full payments and the rare partial payment scenario without adding new concepts.

---

## Reminders & Late Fees

### Reminder schedule

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed schedule | -3 days, due date, +3 days, +7 days overdue | ✓ |
| Owner-configured intervals | Custom reminder intervals in settings | |
| Manual only | Owner clicks "Send Reminder" button manually | |

**User's choice:** Fixed schedule

### Late fee approach

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-calculated | Owner sets flat or percentage in settings, auto-applied when overdue | ✓ |
| Manual line item | Owner manually adds late fee line item | |
| Skip late fees | Don't build late fee functionality | |

**User's choice:** Auto-calculated

### Reminder message customization

| Option | Description | Selected |
|--------|-------------|----------|
| Standard template | Pre-written white-labeled templates with escalating tone | ✓ |
| Customizable templates | Owner edits reminder text in settings | |

**User's choice:** Standard template

---

## Claude's Discretion

- Database schema design for estimates
- Estimates tab placement (sub-section of Invoices or separate)
- Cron vs on-load for reminders and late fees
- Recurring invoice generation mechanism
- PDF layout for tiered estimates
- Reminder email template design
- Late fee line item visual distinction

## Deferred Ideas

- Online estimate approval page — most approvals are verbal on-site
- Digital signature capture — adds complexity, verbal approval sufficient
- Customer financing integration — conflicts with no-payment-processing constraint
- Customizable reminder templates — standard templates sufficient
- Email open tracking — tracking pixels add complexity
- Estimate expiry automation — owner can manually mark expired

---
type: system
system: Dashboard and CRM
status: legacy-app
description: "Status tabs, summary metrics, search. Uses shared useDocumentList Covers: Invoice list — `src/app/dashboard/invoices/page.js`; Invoice detail — `src/app/dashboard/invoices/[id]/page.js`; Batch review — `src/app/dashboard/invoices/batch-review/page.js`; Estimates; Recurring (invoice-only)"
source: .claude/skills/dashboard-crm-system/SKILL.md § 8. Invoices + Estimates
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Invoices + Estimates

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

### Invoice list — `src/app/dashboard/invoices/page.js`

Status tabs, summary metrics, search. Uses shared `useDocumentList`
hook + `DocumentListShell` primitives.

**Pagination (2026-06-12)**: `useDocumentList` now paginates — `limit`
starts at 50 and grows in 50-row steps via a **"Load more"** button up to
500; `hasMore` is derived from the API's `total_count`; switching status
tabs resets the limit back to 50. Previously the hook hard-capped at 50
rows with no affordance — invoices/estimates beyond the first 50 were
silently invisible. Applies to both invoices and estimates lists.

**Mobile create-FABs (2026-06-12)**: the floating create buttons on the
invoices and estimates pages moved `bottom-6` → `bottom-20` so they no
longer cover the `BottomTabBar` on mobile.

### Invoice detail — `src/app/dashboard/invoices/[id]/page.js`

HTML preview + Send button. Status transitions (`sent_at`, `paid_at`).

### Batch review — `src/app/dashboard/invoices/batch-review/page.js`

`?ids=id1,id2,...` pattern. Per-invoice edit/remove. "Send All" with
AlertDialog → `POST /api/invoices/batch-send` with `{ invoice_ids }`.
Progress bar + per-invoice success/failure results.

### Estimates

Full list (tabs: draft/sent/approved/declined/expired), summary cards,
mobile cards. Tiered estimates (`estimate_tiers` + `estimate_line_items`)
with `TierEditor`. Single-price ⇄ tiered mode transition. Tax rate from
`invoice_settings`.

Estimate detail (70/30 split): `EstimatePreview` + actions card. Convert
to invoice — idempotent via `converted_to_invoice_id`; tiered requires
`tier_id` in POST.

### Recurring (invoice-only)

`RecurringSetupDialog.jsx` + `RecurringBadge.jsx` wired in
`/dashboard/invoices/*` only. Migration 032 columns
`is_recurring_template` + `recurring_*`. Cron handles generation.
**No recurring support for appointments.**

---

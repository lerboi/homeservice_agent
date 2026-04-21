---
phase: 59-customer-job-model-separation-split-leads-into-customers-ded
plan: "07"
subsystem: dashboard-ui
status: checkpoint — awaiting human-verify (Task 4)
tasks_complete: 3
tasks_total: 4
tags: [phase-59, wave-3, customer-detail, merge, flyouts, admin-merges-view, checkpoint]

dependency_graph:
  requires:
    - phase: 59-customer-job-model-separation-split-leads-into-customers-ded
      plan: "04"
      provides: "/api/customers, /api/jobs, /api/inquiries, merge/unmerge/convert routes"
    - phase: 59-customer-job-model-separation-split-leads-into-customers-ded
      plan: "06"
      provides: "JobCard, InquiryCard, JobFilterBar, JobStatusPills, Jobs/Inquiries pages"
  provides:
    - "/dashboard/customers/[id] — D-17 sticky header + 3 tabs (Activity | Jobs | Invoices)"
    - "CustomerDetailHeader — name/phone/address/stats/Jobber+Xero badges/VIP/Edit CTA/overflow"
    - "CustomerEditModal — D-18 full CRUD; phone read-only with help text"
    - "CustomerMergeDialog — D-19 2-step (Command typeahead → AlertDialog destructive confirm)"
    - "UnmergeBanner — 7-day undo window, 410 handling, localStorage dismiss"
    - "InquiryFlyout — D-10 offline Convert to Job + Mark as Lost + 5s Undo toast"
    - "JobFlyout — replaces LeadFlyout; all Phase 33-49 affordances preserved"
    - "GET /api/admin/merges — tenant-scoped, ?active=1, ?focus=<id>, ?count_only=1"
    - "GET /api/customers/[id]/merge-preview — preflight counts, T-59-07-03"
    - "/dashboard/admin/merges — D-19 expanded permanent audit surface"
    - "MergesTable — 7 columns, retained-forever, compact row_counts + tooltip"
  affects:
    - "59-08 (cleanup: Plan 08 deletes LeadFlyout after confirming no other referrers)"

tech-stack:
  added:
    - "shadcn tabs (Radix Tabs)"
    - "shadcn command (Radix Command — typeahead picker)"
    - "shadcn dropdown-menu (Radix Dropdown)"
  patterns:
    - "Activity approach A: getCustomerActivity() inline in GET /api/customers/[id]?include_activity=1 (≤50 rows)"
    - "Merge preview: preflight route /api/customers/[id]/merge-preview?target_id= (not client-side compute)"
    - "merged_by_email: null in V1 — UUID shown in MergesTable tooltip; email resolution follow-up"
    - "UnmergeBanner: localStorage per-audit-id dismiss key; fetches /api/admin/merges?focus=<id>&active=1"
    - "CustomerDetailHeader: preflight /api/admin/merges?focus=<id>&count_only=1 gates 'View merge history'"
    - "Admin page: server component fetching /api/admin/merges via forwarded cookies"

key-files:
  created:
    - "src/app/dashboard/customers/[id]/page.js"
    - "src/components/dashboard/customers/CustomerDetailHeader.jsx"
    - "src/components/dashboard/customers/CustomerEditModal.jsx"
    - "src/components/dashboard/customers/CustomerMergeDialog.jsx"
    - "src/components/dashboard/customers/CustomerActivityTimeline.jsx"
    - "src/components/dashboard/customers/CustomerJobsList.jsx"
    - "src/components/dashboard/customers/CustomerInvoicesList.jsx"
    - "src/components/dashboard/customers/UnmergeBanner.jsx"
    - "src/components/dashboard/InquiryFlyout.jsx"
    - "src/components/dashboard/JobFlyout.jsx"
    - "src/components/dashboard/admin/MergesTable.jsx"
    - "src/app/dashboard/admin/merges/page.js"
    - "src/app/api/admin/merges/route.js"
    - "src/app/api/customers/[id]/merge-preview/route.js"
    - "src/components/ui/tabs.jsx"
    - "src/components/ui/command.jsx"
    - "src/components/ui/dropdown-menu.jsx"
  modified:
    - "src/lib/customers.js — added getCustomerActivity() (approach A inline activity)"
    - "src/app/api/customers/[id]/route.js — extended GET to support ?include_activity=1"
    - "src/app/dashboard/jobs/page.js — LeadFlyout → JobFlyout swap"
    - "src/app/dashboard/inquiries/page.js — InquiryFlyout wired (replaces Plan 06 stub)"

key-decisions:
  - "Activity timeline data: approach A (inline in /api/customers/[id]?include_activity=1). ≤50 rows fits V1 use case; avoids separate route. Will add pagination if owners report long timelines."
  - "Merge preview counts: preflight GET /api/customers/[id]/merge-preview?target_id= (not client-side compute). Chosen per T-59-07-03 — client-side counting could overclaim if cross-tenant edge exists."
  - "merged_by_email: null in V1. Supabase auth.admin.listUsers is N+1 on list load. UUID shown in tooltip. Follow-up: cache user emails or add /api/admin/user-email helper."
  - "Soft-deleted source customer names: service-role client bypasses RLS so merged (hidden) customer names resolve in admin audit table. T-59-07-08 accepted — same-tenant PII, intentional for full history."
  - "Admin Merges page: server component using cookies() forwarding; not linked from sidebar/BottomTabBar."

metrics:
  duration: "~1 session"
  completed: "2026-04-21"
  tasks_completed: 3
  tasks_pending: 1 (checkpoint — human-verify)
  files_created: 17
  files_modified: 4
---

# Phase 59 Plan 07: Customer Detail Page + Merge UX + Flyouts + Admin Merges View Summary

Customer detail page (D-17 sticky header + 3 tabs), Edit modal (D-18), Merge + 7-day Undo (D-19), InquiryFlyout with offline Convert to Job (D-10), JobFlyout replacing LeadFlyout, and Admin Merges view surfacing customer_merge_audit retained-forever rows (D-19 expanded). Paused at Task 4 checkpoint awaiting human visual verification of the destructive merge UX and new Customer detail surface.

## Status: Paused at Checkpoint (Task 4)

Tasks 1–3 complete and committed. Task 4 is a `checkpoint:human-verify` gate requiring live smoke-test of:
- Customer detail page layout (sticky header, 3 tabs, URL persistence, dark mode)
- Edit modal phone read-only + unsaved-changes AlertDialog
- Merge + Unmerge flow end-to-end (including 7-day expiry + 410 toast)
- Admin Merges view audit table
- InquiryFlyout Convert to Job / Mark as Lost
- JobFlyout parity with LeadFlyout

**Push-deferred context:** Migrations 053a + 054 not yet pushed. API routes + RPCs exist as code but will fail at runtime against live DB. E2E live testing blocked until Plan 08's batched push. Code is ship-complete; checkpoint verification gates on Plan 08 DB push.

## Performance

- **Duration:** ~1 session
- **Completed:** 2026-04-21
- **Tasks complete:** 3 of 4
- **Files created:** 17
- **Files modified:** 4

## What Was Built

### Task 1: Customer Detail Page + Header + Edit Modal + Activity + Lists

| File | Purpose |
|------|---------|
| `src/app/dashboard/customers/[id]/page.js` | D-17 sticky header + 3 tabs + 3 Realtime subscriptions (D-15) + 404/error states |
| `CustomerDetailHeader.jsx` | Name/phone (mono)/address/stats/badges/VIP/Edit CTA/overflow menu |
| `CustomerEditModal.jsx` | D-18 full CRUD; phone readOnly + "To change phone, use Merge"; unsaved-changes AlertDialog |
| `CustomerActivityTimeline.jsx` | Chronological flat list; day separators; icon per event type; approach A inline |
| `CustomerJobsList.jsx` | JobCard list scoped to customer; UI-SPEC empty state |
| `CustomerInvoicesList.jsx` | Gated by `features_enabled.invoicing`; both empty states per UI-SPEC |

**Activity approach chosen:** A (inline in `/api/customers/[id]?include_activity=1`). Extended `getCustomerWithStats` to call new `getCustomerActivity()` lib function. ≤50 most-recent rows. No separate route needed for Phase 59 V1.

**D-19 expanded gateway:** CustomerDetailHeader fetches `/api/admin/merges?focus=<id>&count_only=1` on mount. "View merge history" overflow item only renders when `count > 0`.

### Task 2: CustomerMergeDialog + UnmergeBanner + InquiryFlyout + JobFlyout

| File | Purpose |
|------|---------|
| `CustomerMergeDialog.jsx` | D-19 2-step: Command typeahead → AlertDialog destructive confirm; audit_id propagation |
| `UnmergeBanner.jsx` | Border-l-4 brand accent; 7-day check; 410 toast with admin link; localStorage dismiss |
| `InquiryFlyout.jsx` | D-10 offline: Convert to Job (QuickBookSheet) + Mark as Lost + 5s sonner Undo |
| `JobFlyout.jsx` | All Phase 33-49 affordances: status/revenue/audio/transcript/invoice/VIP toggle |
| `merge-preview/route.js` | Preflight counts; T-59-07-03 tenant validation before counting |

**Merge preview approach chosen:** Preflight GET `/api/customers/[id]/merge-preview?target_id=`. Not client-side compute — server validates tenant ownership before counting child rows (T-59-07-03). Added as new thin route module sibling to the existing merge route.

**Jobs page LeadFlyout → JobFlyout swap:** Complete. `LeadFlyout` import removed from `jobs/page.js`; `JobFlyout` substituted with same prop shape. LeadFlyout.jsx preserved for Plan 08 deletion.

**Inquiries page stub → InquiryFlyout:** Plan 06 `console.debug` stub replaced with real flyout state (`selectedInquiryId`, `flyoutOpen`) and `InquiryFlyout` component render.

### Task 3: Admin Merges View (D-19 expanded)

| File | Purpose |
|------|---------|
| `src/app/api/admin/merges/route.js` | GET; tenant-scoped via getTenantId(); ?active=1/?focus=<id>/?count_only=1 |
| `src/app/dashboard/admin/merges/page.js` | Server component; ?focus= breadcrumb; retained-forever subtitle |
| `src/components/dashboard/admin/MergesTable.jsx` | 7-column table; Status green-dot/muted; records compact+tooltip; View source/target |

**merged_by_email resolution:** `null` in V1. Rationale: `supabase.auth.admin` list call is N+1 on a 100-row result set. UUID shown truncated in MergesTable tooltip. Follow-up item: add a cached `/api/admin/user-email?id=<uuid>` helper or batch-fetch on page load.

**Soft-deleted source names:** Service-role client used deliberately so soft-deleted (merged) customer rows still resolve their names in the audit join. Scoped to caller's tenant (T-59-07-08 accepted).

## Deviations from Plan

### [Rule 2 - Missing] getCustomerActivity() lib function not in Plan 04

- **Found during:** Task 1 (activity timeline implementation)
- **Issue:** Plan 04 created `getCustomerWithStats` but did not include activity fetching. Plan 07 chose approach A (inline), requiring a new `getCustomerActivity()` export and a `?include_activity=1` param on the GET route.
- **Fix:** Added `getCustomerActivity()` to `src/lib/customers.js`; extended `GET /api/customers/[id]/route.js` to call it when `?include_activity=1`. Non-breaking addition.
- **Files modified:** `src/lib/customers.js`, `src/app/api/customers/[id]/route.js`
- **Commit:** `02bc1a6`

### [Rule 2 - Missing] merge-preview preflight route not in Plan 04 scope

- **Found during:** Task 2 (CustomerMergeDialog preview counts)
- **Issue:** Plan 07 deliberated between client-side compute vs preflight. Preflight was the correct choice (T-59-07-03 cross-tenant edge). Route not added retroactively to Plan 04 — added as sibling in same directory.
- **Fix:** Created `src/app/api/customers/[id]/merge-preview/route.js`.
- **Files modified:** New file
- **Commit:** `4523725`

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `merged_by_email: null` | `src/app/api/admin/merges/route.js` | N+1 problem on list load; UUID shown in tooltip. Follow-up: batch user-email resolution. |
| Integration credentials endpoint `/api/accounting/credentials` | `CustomerDetailHeader.jsx` | Route may not exist yet. Header gracefully renders no badges if fetch fails. Verify in Plan 08. |

## Threat Surface Scan

New network endpoints introduced:
- `GET /api/admin/merges` — tenant-scoped (getTenantId() + .eq('tenant_id', tenantId)). RLS belt+suspenders (T-59-07-07).
- `GET /api/customers/[id]/merge-preview` — tenant ownership check before counting (T-59-07-03).

Both endpoints authenticated. No new unauthenticated surface. Admin merges page uses server-side cookie forwarding (no client-side auth bypass). No new file access patterns.

All plan `<threat_model>` mitigations applied:

| Threat ID | Mitigation Status |
|-----------|-------------------|
| T-59-07-01 | GET /api/customers search uses RLS + explicit tenant filter (Plan 04); merge RPC re-validates |
| T-59-07-02 | 2-step flow + preview counts + destructive red button per UI-SPEC |
| T-59-07-03 | merge-preview route validates tenant ownership before counting |
| T-59-07-04 | Accepted — localStorage banner-dismiss is UX-only |
| T-59-07-05 | Accepted — dev console logs OK; no new client-side telemetry |
| T-59-07-06 | Convert route requires valid appointment_id in tenant (Plan 04 Task 2) |
| T-59-07-07 | /api/admin/merges filters by tenantId + RLS double enforcement |
| T-59-07-08 | Accepted — soft-deleted names are same-tenant PII; intentional for audit |
| T-59-07-09 | Accepted — V1 no sub-tenant role; any tenant owner sees own merge history |

## Self-Check: PASSED (partial — checkpoint not yet verified)

Files verified:
- FOUND: `src/app/dashboard/customers/[id]/page.js`
- FOUND: `src/app/dashboard/admin/merges/page.js`
- FOUND: `src/app/api/admin/merges/route.js`
- FOUND: `src/components/dashboard/customers/CustomerDetailHeader.jsx`
- FOUND: `src/components/dashboard/customers/CustomerEditModal.jsx`
- FOUND: `src/components/dashboard/customers/CustomerMergeDialog.jsx`
- FOUND: `src/components/dashboard/customers/CustomerActivityTimeline.jsx`
- FOUND: `src/components/dashboard/customers/CustomerJobsList.jsx`
- FOUND: `src/components/dashboard/customers/CustomerInvoicesList.jsx`
- FOUND: `src/components/dashboard/customers/UnmergeBanner.jsx`
- FOUND: `src/components/dashboard/admin/MergesTable.jsx`
- FOUND: `src/components/dashboard/InquiryFlyout.jsx`
- FOUND: `src/components/dashboard/JobFlyout.jsx`

Commits verified:
- FOUND: `02bc1a6` — Task 1
- FOUND: `4523725` — Task 2
- FOUND: `0ec2a21` — Task 3

Grep checks:
- "Merge Customer" in CustomerMergeDialog: PASS
- "To change phone, use Merge" in CustomerEditModal: PASS
- "View merge history" in CustomerDetailHeader: PASS
- "Undo merge" in UnmergeBanner: PASS
- "Convert to Job" in InquiryFlyout: PASS
- JobFlyout in jobs/page.js: PASS
- InquiryFlyout in inquiries/page.js: PASS
- customer_merge_audit in admin route: PASS
- "Merge history" in admin page: PASS
- row_counts in MergesTable: PASS
- Sidebar/BottomTabBar NOT linked to admin merges: PASS

---
*Phase: 59-customer-job-model-separation-split-leads-into-customers-ded*
*Plan 07 status: checkpoint — awaiting human-verify (Task 4)*
*Last updated: 2026-04-21*

---
type: system
system: Dashboard and CRM
status: legacy-app
description: "API Route Index (Dashboard and CRM)"
source: .claude/skills/dashboard-crm-system/SKILL.md § 16. API Route Index
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# API Route Index

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

| Route | File | Purpose |
|-------|------|---------|
| `GET /api/leads` | **DELETED** (Phase 59) | Replaced by /api/jobs + /api/inquiries |
| `GET/PATCH /api/leads/[id]` | **DELETED** (Phase 59) | Replaced by /api/jobs/[id] + /api/inquiries/[id] |
| `GET /api/customers` | `src/app/api/customers/route.js` | Filtered + paginated customer list |
| `GET/PATCH /api/customers/[id]` | `src/app/api/customers/[id]/route.js` | Customer detail + update |
| `POST /api/customers/[id]/merge` | same dir | Calls merge_customer RPC; returns audit_id |
| `POST /api/customers/[id]/unmerge` | same dir | Calls unmerge_customer RPC (7-day window) |
| `GET /api/jobs` | `src/app/api/jobs/route.js` | Filtered + paginated; NO transcript_text. Filters: status, urgency, customer_id, search (customer name\|phone), date_from/date_to (YYYY-MM-DD). job_type NOT supported — no column (UI removed 2026-06-12, see Section 5) |
| `GET/PATCH /api/jobs/[id]` | `src/app/api/jobs/[id]/route.js` | Full job WITH transcript — `getJob` selects `recording_storage_path` + `transcript_text` + `transcript_structured` since 2026-06-12 (previously omitted, so the flyout transcript was always empty); status/revenue update |
| `GET /api/inquiries` | `src/app/api/inquiries/route.js` | Filtered + paginated; default status=open. Filters: status, urgency, job_type (partial), search (customer name\|phone), date_from/date_to (YYYY-MM-DD) |
| `GET/PATCH /api/inquiries/[id]` | `src/app/api/inquiries/[id]/route.js` | Inquiry detail + status update |
| `POST /api/inquiries/[id]/convert` | same dir | Convert inquiry to job (manual offline flow) |
| `GET /api/admin/merges` | `src/app/api/admin/merges/route.js` | Tenant-scoped customer_merge_audit rows (admin-only) |
| `GET /api/search` | `src/app/api/search/route.js` | Command-palette grouped search (customers/calls/invoices/appointments/estimates) |
| `GET /api/dashboard/stats` | `src/app/api/dashboard/stats/route.js` | Home tiles + nav badges: "new" = open inquiries count+preview, invoice money snapshot (`invoiceOutstandingAmount`, `invoiceOverdueCount`+`invoiceOverdueAmount`, `paidThisMonth`), `missedCallsToday` (calls with `booking_outcome='not_attempted'` AND `duration_seconds>=15` created today — <15s = hangups/misdials) |
| `GET /api/calls` | `src/app/api/calls/route.js` | Filtered (date, urgency, outcome, search by caller name OR phone — tenant-scoped customers name lookup, 50-name cap); selects `transcript_text` + `transcript_structured` |
| `GET/PATCH /api/escalation-contacts` | `src/app/api/escalation-contacts/route.js` | CRUD + reorder |
| `GET/PATCH /api/setup-checklist` | `src/app/api/setup-checklist/route.js` | Derived items + dismiss/mark-done |
| `GET/POST /api/estimates` | `src/app/api/estimates/route.js` | List + create (single/tiered) |
| `GET/PATCH/DELETE /api/estimates/[id]` | same dir | Detail + update + delete-draft |
| `POST /api/estimates/[id]/send` | same dir | PDF via Resend + optional SMS |
| `POST /api/estimates/[id]/convert` | same dir | Idempotent convert to invoice |
| `GET/PATCH /api/invoice-settings` | same pattern | Business identity, tax, numbering |
| `POST /api/chat` | `src/app/api/chat/route.js` | RAG + Groq chat |
| `GET/PATCH /api/account` | `src/app/api/account/route.js` | Tenant profile |
| `GET/PATCH /api/notification-settings` | same pattern | `notification_preferences` JSONB |
| `PUT /api/working-hours` | same pattern | `working_hours` + `slot_duration_mins` + `travel_buffer_mins` (M16 P2, int 0–240) + `tenant_timezone` |
| `GET/PATCH /api/call-routing` | same pattern | Schedule + pickup + dial_timeout + `vip_numbers` |

---

---
type: system
system: Dashboard and CRM
status: legacy-app
description: "Full migration catalog lives in auth-database-multitenancy."
source: .claude/skills/dashboard-crm-system/SKILL.md § 17. Migrations (CRM-specific)
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Migrations (CRM-specific)

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

| Migration | Purpose |
|-----------|---------|
| `004_leads_crm.sql` | `leads`, `lead_calls`, `activity_log` tables + Realtime — **SUPERSEDED by 059+061** |
| `005_setup_checklist.sql` | `tenants.setup_checklist_dismissed` column |
| `006_escalation_contacts.sql` | `escalation_contacts` + `services.sort_order` |
| `032_recurring_invoices.sql` | Invoice recurrence columns |
| `041_calls_realtime.sql` | Calls table in Realtime with `REPLICA IDENTITY FULL` |
| `042_call_routing_schema.sql` | Phase 39 — call_forwarding_schedule, pickup_numbers |
| `045_sms_messages_and_call_sid.sql` | Phase 40 — sms_messages table, calls.call_sid |
| `049_vip_caller_routing.sql` | Phase 46 — tenants.vip_numbers JSONB + leads.is_vip + sparse idx |
| `050_checklist_overrides.sql` | Phase 48 — `tenants.checklist_overrides` JSONB |
| `051_features_enabled.sql` | Phase 53 — per-tenant feature flags |
| `052_integrations_schema.sql` | Phase 54 — accounting_credentials |
| `053_xero_error_state.sql` | Phase 55 — error_state column |
| `054_external_account_id.sql` | Phase 56 — webhook tenant resolution |
| `055_jobber_schedule_mirror.sql` | Phase 57 — calendar_events provider='jobber' |
| `057_calendar_events_realtime.sql` | Phase 57 — calendar_events in Realtime publication |
| `058_oauth_refresh_locks.sql` | Phase 55 — OAuth refresh race elimination |
| `059_customers_jobs_inquiries.sql` | Phase 59 — CREATE customers/jobs/inquiries/customer_calls/job_calls/customer_merge_audit + backfill |
| `060_phase59_rpcs.sql` | Phase 59 — record_call_outcome + merge_customer + unmerge_customer RPCs |
| `061_drop_legacy_leads.sql` | Phase 59 — DROP TABLE leads/lead_calls + activity_event_type enum + DROP COLUMN lead_id |

Full migration catalog lives in `auth-database-multitenancy`.

---

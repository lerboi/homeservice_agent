---
type: system-index
system: Auth and Database
status: current
repo: "homeservice_agent (supabase/migrations, src/lib/supabase*.js, src/proxy.js)"
description: Complete architectural reference for authentication, database schema, and multi-tenant isolation — Supabase Auth, proxy auth guards, three Supabase client types, RLS policies, all 75 migrations with table definitions, getTenantId pattern, t…
source_skills: [auth-database-multitenancy]
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# Auth and Database

Up: [[Home]] · [[Systems]]

> **How to use:** read this index, then open only the notes the task needs. After changing code in this system, update the matching note and set its `verified:` date.

**Status (2026-11-23):** current system, not re-verified. The migration notes cover migrations through 075; the live database is the source of truth, so query it with the `supabase-voco` MCP server ([[Environment and MCP servers]]) when a column or policy matters.

## Notes (from `auth-database-multitenancy`)

| Note | Lines | Status | What is in it |
|---|---|---|---|
| [[Auth-DB - Architecture Overview]] | 47 | current | End-to-end flow and main components of Auth and Database. |
| [[Auth-DB - File Map]] | 82 | current | Which files implement Auth and Database and what each one is responsible for. |
| [[Auth-DB - Three Supabase Clients]] | 62 | current | The codebase uses exactly three Supabase clients, each with a distinct purpose. Using the wrong client is a common bug source. Covers: `src/lib/supabase.js` — Service Role Client; `src/lib/supabase-server.js` — SSR Cookie-Based Client; `src/lib/supabase-browser.js` — Browser Client |
| [[Auth-DB - getTenantId Pattern]] | 61 | current | getTenantId Pattern. Covers: Signature; Resolution Flow; `src/lib/features.js` — getTenantFeatures(tenantId) (added Phase 53); `tenants.features_enabled` column (added Phase 53, migration 051) |
| [[Auth-DB - Middleware]] | 81 | current | Middleware. Covers: AUTH_REQUIRED_PATHS; Client Used in Middleware; Auth Check Flow; Admin Gate (added Phase 28-01); Matcher Config |
| [[Auth-DB - RLS Policy Patterns]] | 49 | current | Row Level Security enforces tenant isolation at the database level. Every table uses one of two patterns. Covers: Pattern 1: Direct Owner (tenants table only); Pattern 2: Tenant Child (all data tables); Pattern 3: Service Role Bypass |
| [[Auth-DB - Migration Trail 001 to 011]] | 249 | current | Migrations apply sequentially; the highest migration is 076, with 068–076 PENDING manual apply. FK dependencies require this order. Migrations 001–017 and 01… Covers: 001_initial_schema.sql — Foundation; 002_onboarding_triage.sql — Onboarding + Triage; 003_scheduling.sql — Scheduling + Calendar; 004_leads_crm.sql — CRM + Realtime (SUPERSEDED by Phase 59); 005_setup_checklist.sql — Checklist Dismiss; 006_escalation_contacts.sql — Escalation Chain; 007_outlook_calendar.sql — Dual Provider Calendar; 008_call_outcomes.sql — Call Outcome Tracking; 009_recovery_sms_tracking.sql — Recovery SMS Delivery Tracking; 010_billing_schema.sql — Billing Foundation (Subscriptions + Webhook Events); 011_country_provisioning.sql — Country-Aware Provisioning |
| [[Auth-DB - Migration Trail 012 to 037]] | 249 | current | Migration Trail 012 to 037. Covers: 012_admin_users.sql — Admin Dashboard Auth Gate (Phase 28-01); 013_usage_events.sql — Per-Call Usage Tracking (Phase 23-01); 017_overage_billing.sql — Overage Metered Billing; 019_appointments_exclusion_constraint.sql — Overlap Prevention; 024_schema_hardening.sql — Indexes, Constraints, Trigger; 025_fix_book_appointment_atomic.sql — RPC Fix; 026_address_fields.sql — Structured Address Columns; 027_lock_rpc_functions.sql — SECURITY DEFINER Lockdown; 028_calls_tenant_cascade.sql — FK Cascade Fix; 029_invoice_schema.sql — Invoice Data Foundation; 030_accounting_integrations.sql — Accounting Provider OAuth; 030_estimates_schema.sql — Estimates Data Foundation; 031_payment_log_schema.sql — Invoice Payments + Status Expansion; 032_reminders_recurring.sql — Invoice Reminders + Late Fees + Recurring … |
| [[Auth-DB - Migration Trail 038 onward]] | 175 | current | Two unrelated hardening items grouped in one migration: Covers: 038_schema_hardening_2.sql — Stripe Index + Atomic Primary-Calendar Swap; 044_ai_voice_column.sql — AI Voice Selection (Phase 44); 042_call_routing_schema.sql — Call Routing Foundation (Phase 39); 045_sms_messages_and_call_sid.sql — SMS Audit Log + Call SID (Phase 40); 046_calendar_blocks_and_completed_at.sql — Time Blocks + Mark-Complete (Phase 42); 049_vip_caller_routing.sql — Priority (VIP) Caller Direct Routing (Phase 46); 050_checklist_overrides.sql — Setup Checklist Per-Item Overrides (Phase 48) |
| [[Auth-DB - Complete Table Reference]] | 108 | current | Tenant columns added across migrations (all on tenants table): |
| [[Auth-DB - Environment Variables]] | 14 | current | Environment variables Auth and Database reads, and where they are set. |
| [[Auth-DB - Key Design Decisions]] | 26 | current | Three clients with distinct purposes: Service role bypasses RLS for webhooks (cross-tenant access needed); server client reads session cookie for authenticat… |
| [[Auth-DB - Phase 55 Migration 053 + accounting_credentials.error_state + Python write-back]] | 33 | current | Adds accounting_credentials.error_state TEXT NULL: Covers: Migration 053 — `supabase/migrations/053_xero_error_state.sql`; Python service-role write-back pattern (cross-repo); `expiry_date` column semantics |
| [[Auth-DB - Migration 054 - external_account_id column (Phase 56)]] | 18 | current | Shipped: 2026-04-18 |
| [[Auth-DB - Migration 058 - oauth_refresh_locks table + RPCs (Phase 999.5)]] | 37 | current | Shipped: 2026-04-19 |
| [[Auth-DB - Phase 59 New Tables (Migration 059)]] | 113 | current | Six new tables added by 059_customers_jobs_inquiries.sql. Backfilled from legacy leads/lead_calls data. All use the tenant_id child RLS pattern + service_rol… Covers: `customers`; `jobs`; `inquiries`; `customer_calls`; `job_calls`; `customer_merge_audit` |
| [[Auth-DB - Phase 59 RPCs (Migration 060)]] | 82 | current | Three SECURITY DEFINER functions in 060_phase59_rpcs.sql. All follow the pattern from 027_lock_rpc_functions.sql: REVOKE EXECUTE FROM PUBLIC; GRANT EXECUTE T… Covers: `record_call_outcome` (D-14 / D-10 / D-16); `merge_customer` (D-19 + D-19 expanded audit); `unmerge_customer` (D-19 7-day undo) |
| [[Auth-DB - Phase 59 Enums (Migration 061)]] | 19 | current | Strict enum created by 061_drop_legacy_leads.sql (D-12a). The activity_log.event_type column was coerced to this type using a CASE mapping; unknown legacy va… Covers: `activity_event_type` |
| [[Auth-DB - Phase 59 Migration Entries (059 060 061)]] | 17 | current | D-01 same-day gate: 059 and 061 shipped same PR/same day after Python agent verified writing via record_call_outcome (live test call gate). |
| [[Auth-DB - Prod-Readiness 2026-06 Migrations (063 064 065 066 068)]] | 45 | current | Four additive, forward-fix-only migrations landed on branch fix/prod-readiness-2026-06; migration 068 followed as the 2026-06 audit's billing/security harden… Covers: Rate-limited routes added 2026-06-10 (on the 065 infrastructure); `rate_limit_hits` table + `increment_rate_limit` RPC (Migration 065) |
| [[Auth-DB - 2026-06-12 Audit Migrations (069 070 071)]] | 18 | current | Three forward-fix-only migrations from the 2026-06-12 audit wave 1. PENDING manual application along with 068 — apply in order. Full file-map entries above. Covers: 069_rpc_and_token_lockdown.sql — RPC + OAuth-token lockdown; 070_ai_voice_labels.sql — ai_voice label CHECK; 071_meter_event_outbox.sql — meter-failure outbox + enum values |
| [[Auth-DB - 2026-06-12 Audit (cont.) Migrations (072 073) - quick-win wave 2026-06-20]] | 12 | current | Two forward-fix-only migrations. PENDING manual application (apply in order; additive + behavior-preserving). Covers: 072_calendar_blocks_provider.sql — M15 calendar_blocks provider attribution; 073_book_appointment_atomic_slot_taken.sql — LOW-26 clean slot_taken on exclusion race |
| [[Auth-DB - M16 P1 Migration 074 - Service-Area Gate (Capability A)]] | 12 | current | Written 2026-06-20, PENDING manual application (additive, no table rewrites; apply after 068–073). File-map entry above; the three column additions are detai… |
| [[Auth-DB - M16 P2 Migration 075 - Owner-Adjustable Travel Buffer]] | 12 | current | Written 2026-06-20, PENDING manual application (additive, no table rewrite; apply after 068–074). File-map entry above. |
| [[Auth-DB - Scope and change history]] | 34 | record | The former auth-database-multitenancy skill's scope statement, preamble and running 'last updated' change history. Read only when you need to know when or why something changed. |

## Short sections

### Cross-Domain References

- For booking, calendar sync, and slot calculation using these DB tables, see **scheduling-calendar-system skill**
- For how the dashboard Realtime subscription uses the browser client, see **dashboard-crm-system skill**
- For middleware onboarding redirect details and wizard session patterns, see **onboarding-flow skill**
- For how webhook handlers use the service role client during call processing, see **voice-call-architecture skill**

---


### Important: Keeping This Document Updated

When adding new migrations or modifying RLS policies, update the Migration Trail and RLS Policy Patterns sections. When adding new source files that use Supabase clients, add them to the File Map. When new tables are created, add them to the Complete Table Reference and verify they have both a tenant_id child RLS policy and a service_role bypass policy.

Key areas to keep current:
- Migration Trail — add new migration entry with tables created/altered, key columns, RLS policies
- Complete Table Reference — add new tables with their migration, purpose, and RLS pattern
- Three Supabase Clients — if new client patterns are introduced (they shouldn't be)
- Environment Variables — if new Supabase-related env vars are added

---
name: auth-database-multitenancy
description: "Complete architectural reference for authentication, database schema, and multi-tenant isolation — Supabase Auth, proxy auth guards, three Supabase client types, RLS policies, all 75 migrations with table definitions, getTenantId pattern, tenant data isolation, Phase 59 new tables (customers, jobs, inquiries, customer_calls, job_calls, customer_merge_audit), Phase 59 RPCs (record_call_outcome, merge_customer, unmerge_customer), Phase 61 validated-address columns on appointments + inquiries + gmaps_validate_events sibling table + extended RPC overloads, activity_event_type strict enum with 18 values (071 added integration_fetch + integration_fetch_fanout), prod-readiness 2026-06 migrations (estimates.customer_id, stripe_webhook_events.processed flag, rate_limit_hits table + increment_rate_limit RPC, calls.call_sid UNIQUE constraint), migration 068 billing/security hardening (subscriptions one-current partial unique index + dedupe, oauth_refresh_locks RLS lockdown + lock-RPC EXECUTE revoke, hot-path indexes, stripe_webhook_events.processing_started_at), and 2026-06-12 audit migrations 069–071 (SECURITY DEFINER RPC anon/authenticated EXECUTE revoke + search_path pinning, accounting_credentials/calendar_credentials client-role privilege revoke, ai_voice label CHECK, stripe_meter_failures outbox), and M16 P1 migration 074 (service-area columns: service_zones.cities, tenants.out_of_area_action + out_of_area_referral_note, inquiries.out_of_area — PENDING manual apply alongside 072/073), and M16 P2 migration 075 (`tenants.travel_buffer_mins int NOT NULL DEFAULT 30` — owner-adjustable travel buffer, also PENDING). Use this skill whenever making changes to auth proxy, RLS policies, database migrations, Supabase client usage, tenant isolation, or adding new tables. Also use when the user asks about how auth works, wants to add a new migration, or needs to debug RLS or tenant access issues."
---

# auth-database-multitenancy (moved to the vault)

The architecture reference that used to be in this file now lives in the Obsidian vault as small linked notes.

1. Read the index: `vault/Systems/Auth and Database/Auth and Database.md`. It lists every note with a one-line description.
2. Open only the notes the task needs (same folder).
3. Notes with an empty `verified:` field were migrated verbatim on 2026-11-23 and not re-checked: confirm specifics against the code.
4. After changing code in this system, update the matching vault note and set its `verified:` date. Do not add documentation back into this file.

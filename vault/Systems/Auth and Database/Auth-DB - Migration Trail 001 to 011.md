---
type: system
system: Auth and Database
status: current
description: "Migrations apply sequentially; the highest migration is 076, with 068–076 PENDING manual apply. FK dependencies require this order. Migrations 001–017 and 01… Covers: 001_initial_schema.sql — Foundation; 002_onboarding_triage.sql — Onboarding + Triage; 003_scheduling.sql — Scheduling + Calendar; 004"
source: .claude/skills/auth-database-multitenancy/SKILL.md § 5. Migration Trail
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# Migration Trail (part 1 of 3)

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

Migrations apply sequentially; the highest migration is 076, with 068–076 PENDING manual apply. FK dependencies require this order. Migrations 001–017 and 019 documented in detail below; 018, 020–036 documented in the file map above with key migrations also detailed below; 052/058–076 documented in the file map above (Phase 54+, Phase 59, Phase 61, prod-readiness 2026-06, Phase 65 voice CHECK swap, 068 billing/security hardening, 069–071 2026-06-12 audit: RPC/token lockdown, ai_voice labels, meter-event outbox; 072/073 quick-win wave; 074 M16 P1 service-area columns; 075 M16 P2 travel buffer; 076 LK-B2 owner-notification outbox) with Phase 59 RPCs/enums detailed in their dedicated sections.

### 001_initial_schema.sql — Foundation

**Tables created**: `tenants`, `calls`

**tenants columns**:
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | gen_random_uuid() |
| `owner_id` | uuid UNIQUE | Supabase auth user ID |
| `business_name` | text | nullable |
| `phone_number` | text UNIQUE | nullable (renamed from retell_phone_number in migration 023) |
| `owner_phone` | text | nullable |
| `owner_email` | text | nullable |
| `default_locale` | text | NOT NULL DEFAULT 'en' |
| `onboarding_complete` | boolean | NOT NULL DEFAULT false |
| `created_at`, `updated_at` | timestamptz | |

**calls columns**: `id`, `tenant_id` (FK), `call_id` UNIQUE (renamed from retell_call_id in migration 023), `from_number`, `to_number`, `direction`, `status`, `disconnection_reason`, `start_timestamp`, `end_timestamp`, `duration_seconds` (GENERATED STORED), `recording_url`, `recording_storage_path`, `transcript_text`, `transcript_structured` (jsonb), `detected_language`, `language_barrier`, `barrier_language`, `call_metadata` (jsonb, renamed from retell_metadata in migration 023), `call_provider` (text, 'retell'|'livekit', DEFAULT 'livekit'), `egress_id` (text)

**RLS**: Both tables have full RLS. Tenants: direct owner pattern. Calls: tenant_id child pattern. Both have service_role bypass.

---

### 002_onboarding_triage.sql — Onboarding + Triage

**Extends tenants**: `tone_preset` (CHECK 'professional'|'friendly'|'local_expert', DEFAULT 'professional'), `trade_type` (text), `test_call_completed` (boolean DEFAULT false), `working_hours` (jsonb, nullable)

**Tables created**: `services`

**services columns**:
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid | FK → tenants(id) ON DELETE CASCADE |
| `name` | text | NOT NULL |
| `urgency_tag` | text | CHECK 'emergency'|'routine'|'urgent', DEFAULT 'routine' |
| `is_active` | boolean | NOT NULL DEFAULT true |
| `created_at` | timestamptz | |

**RLS**: services uses tenant_id child pattern + service_role bypass.

**Extends calls**: `urgency_classification`, `urgency_confidence`, `triage_layer_used` — all with CHECK constraints.

---

### 003_scheduling.sql — Scheduling + Calendar

**Extends tenants**: `tenant_timezone` (NOT NULL DEFAULT 'America/Chicago'), `slot_duration_mins` (int NOT NULL DEFAULT 60)

**Extends calls**: `suggested_slots` (jsonb)

**Tables created**: `appointments`, `service_zones`, `zone_travel_buffers`, `calendar_credentials`, `calendar_events`

Key table details:

**appointments**: `id`, `tenant_id` (FK), `call_id` (FK → calls SET NULL), `start_time`, `end_time`, `service_address`, `caller_name`, `caller_phone`, `urgency` (CHECK emergency|routine|urgent), `zone_id` (FK → service_zones SET NULL), `status` (CHECK confirmed|cancelled|completed DEFAULT confirmed), `booked_via` (CHECK ai_call|manual DEFAULT ai_call), `google_event_id` (text, renamed in 007), `notes`. Constraint: GiST exclusion `appointments_no_overlap` (see migration 019 below — replaced the original `UNIQUE (tenant_id, start_time)`).

**calendar_credentials**: `id`, `tenant_id` (FK), `provider` (CHECK google|outlook DEFAULT google), `access_token`, `refresh_token`, `expiry_date` (bigint), `calendar_id` (DEFAULT 'primary'), `calendar_name`, `watch_channel_id`, `watch_resource_id`, `watch_expiration` (bigint), `last_sync_token`, `last_synced_at`. Constraint: `UNIQUE (tenant_id, provider)`.

**`book_appointment_atomic` RPC function** (SECURITY DEFINER):
```sql
-- Acquires non-blocking advisory lock: abs(hashtext(tenant_id || epoch(start_time)))
-- Checks tsrange overlap on non-cancelled appointments
-- Returns: jsonb { success: true, appointment_id: uuid }
--       or: jsonb { success: false, reason: 'slot_taken' }
-- Secondary defense: GiST exclusion constraint `appointments_no_overlap` (added in migration 019)
--   prevents overlapping [start_time, end_time) ranges per tenant for non-cancelled appointments
```

All 5 tables use tenant_id child RLS pattern + service_role bypass.

Cross-domain: See scheduling-calendar-system skill for full slot calculator, booking, and calendar sync details.

---

### 004_leads_crm.sql — CRM + Realtime (SUPERSEDED by Phase 59)

**SUPERSEDED**: Tables `leads` and `lead_calls` were dropped by migration 061 (Phase 59 Plan 08). The `activity_log` table remains but `lead_id` column was dropped by 061. New write path: `record_call_outcome` RPC (migration 060). See **Phase 59 section** below.

**Tables created**: `leads` *(dropped in 061)*, `lead_calls` *(dropped in 061)*, `activity_log`

**leads columns** *(historical — table no longer exists)*:
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid | FK → tenants CASCADE |
| `from_number` | text | NOT NULL |
| `caller_name` | text | nullable |
| `job_type` | text | nullable |
| `service_address` | text | nullable |
| `urgency` | text | CHECK emergency|routine|urgent |
| `status` | text | CHECK new|booked|completed|paid|lost |
| `revenue_amount` | numeric(10,2) | nullable |
| `primary_call_id` | uuid | FK → calls SET NULL |
| `appointment_id` | uuid | FK → appointments SET NULL |
| `created_at`, `updated_at` | timestamptz | |

**Realtime** (CRITICAL — leads was; customers/jobs/inquiries now):
```sql
-- 004 original (leads — now dropped):
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER TABLE leads REPLICA IDENTITY FULL;
-- 059 replacement (customers/jobs/inquiries):
ALTER PUBLICATION supabase_realtime ADD TABLE customers, jobs, inquiries;
ALTER TABLE customers REPLICA IDENTITY FULL;
ALTER TABLE jobs REPLICA IDENTITY FULL;
ALTER TABLE inquiries REPLICA IDENTITY FULL;
```

`REPLICA IDENTITY FULL` is required so Supabase Realtime emits row-level change events with full old+new row data, enabling tenant_id filter at the subscription level.

**lead_calls**: Junction table. PK: `(lead_id, call_id)`. *(Dropped in migration 061 — replaced by customer_calls + job_calls in 059.)*

**activity_log**: `id`, `tenant_id` (FK), `event_type` *(now type `activity_event_type` enum — see Phase 59 Enums section)*, `customer_id` (FK customers, NULLABLE — system events have no customer context), `job_id` (FK jobs, NULLABLE), `inquiry_id` (FK inquiries, NULLABLE), `metadata` (jsonb), `created_at`. `lead_id` column dropped in 061 after backfill. RLS: tenant_id child pattern.

**Extends calls**: `recovery_sms_sent_at` (timestamptz)

---

### 005_setup_checklist.sql — Checklist Dismiss

**Extends tenants**: `setup_checklist_dismissed` (boolean DEFAULT false)

No new tables. Checklist state is derived at read time from existing tenant columns — not stored as separate rows.

---

### 006_escalation_contacts.sql — Escalation Chain

**Tables created**: `escalation_contacts`

**escalation_contacts columns**:
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid | FK → tenants CASCADE |
| `name` | text | NOT NULL |
| `role` | text | nullable |
| `phone` | text | nullable |
| `email` | text | nullable |
| `notification_pref` | text | CHECK sms|email|both DEFAULT 'both' |
| `timeout_seconds` | int | CHECK 15|30|45|60 DEFAULT 30 |
| `sort_order` | int | NOT NULL DEFAULT 0 |
| `is_active` | boolean | NOT NULL DEFAULT true |
| `created_at`, `updated_at` | timestamptz | |

RLS: Uses `TO service_role` syntax variant (still service_role bypass, different syntax from 001-004).

**Extends services**: `sort_order` (int NOT NULL DEFAULT 0). Backfilled via `ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at)`.

---

### 007_outlook_calendar.sql — Dual Provider Calendar

**Extends calendar_credentials**: `is_primary` (boolean NOT NULL DEFAULT false). Backfill: existing Google credentials set to `is_primary = true`.

**Renames appointments column**: `google_event_id` → `external_event_id`

**Extends appointments**: `external_event_provider` (CHECK google|outlook)

---

### 008_call_outcomes.sql — Call Outcome Tracking

**Extends calls**:
| Column | Type | Notes |
|--------|------|-------|
| `booking_outcome` | text | CHECK booked|attempted|declined|not_attempted |
| `exception_reason` | text | CHECK clarification_limit|caller_requested |
| `notification_priority` | text | CHECK high|standard |

**Indexes added**: `(tenant_id, booking_outcome)`, `(tenant_id, notification_priority)` — for analytics queries and Phase 16 notification routing.

---

### 009_recovery_sms_tracking.sql — Recovery SMS Delivery Tracking

**Extends calls**:
| Column | Type | Notes |
|--------|------|-------|
| `recovery_sms_status` | text | CHECK pending|sent|failed|retrying |
| `recovery_sms_retry_count` | integer | NOT NULL DEFAULT 0 |
| `recovery_sms_last_error` | text | nullable |
| `recovery_sms_last_attempt_at` | timestamptz | nullable |

**Indexes added**: Partial index `idx_calls_recovery_sms_retry` on `(tenant_id, recovery_sms_status, recovery_sms_last_attempt_at)` WHERE `recovery_sms_status = 'retrying'` — for cron retry queries.

---

### 010_billing_schema.sql — Billing Foundation (Subscriptions + Webhook Events)

**Tables created**: `subscriptions`, `stripe_webhook_events`

**subscriptions columns**:
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | gen_random_uuid() |
| `tenant_id` | uuid | FK → tenants CASCADE |
| `stripe_customer_id` | text | NOT NULL |
| `stripe_subscription_id` | text | NOT NULL |
| `stripe_price_id` | text | nullable |
| `plan_id` | text | CHECK starter|growth|scale |
| `status` | text | CHECK trialing|active|past_due|canceled|paused|incomplete |
| `calls_limit` | int | NOT NULL |
| `calls_used` | int | NOT NULL DEFAULT 0 |
| `trial_ends_at` | timestamptz | nullable |
| `current_period_start` | timestamptz | nullable |
| `current_period_end` | timestamptz | nullable |
| `cancel_at_period_end` | boolean | NOT NULL DEFAULT false |
| `stripe_updated_at` | timestamptz | For out-of-order webhook protection |
| `is_current` | boolean | NOT NULL DEFAULT true — active row lookup |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

**Indexes**: `idx_subscriptions_tenant_current (tenant_id, is_current)`, `idx_subscriptions_stripe_sub_id (stripe_subscription_id)`

**stripe_webhook_events columns**:
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | gen_random_uuid() |
| `event_id` | text | UNIQUE NOT NULL — idempotency key |
| `event_type` | text | NOT NULL |
| `processed_at` | timestamptz | NOT NULL DEFAULT now() |

**RLS**: Both tables have RLS enabled.
- `subscriptions`: authenticated SELECT-own (via tenants.owner_id), service_role ALL
- `stripe_webhook_events`: service_role ALL only (no authenticated access)

**Key design**: Authenticated users can only read subscriptions (no INSERT/UPDATE) — all writes go through service_role via webhook handlers. This is intentional write-protection.

---

### 011_country_provisioning.sql — Country-Aware Provisioning

**Extends tenants**: `owner_name` (text nullable), `country` (text nullable), `provisioning_failed` (boolean DEFAULT false)

**Tables created**: `phone_inventory`, `phone_inventory_waitlist`

**phone_inventory columns**: `id` (uuid PK), `phone_number` (text UNIQUE NOT NULL), `country` (text NOT NULL DEFAULT 'SG'), `status` (CHECK available|assigned|retired DEFAULT available), `assigned_tenant_id` (FK → tenants nullable), `created_at`

**phone_inventory_waitlist columns**: `id`, `email` (text NOT NULL), `country` (text NOT NULL DEFAULT 'SG'), `created_at`, `notified_at` (timestamptz nullable)

**`assign_sg_number` RPC** (SECURITY DEFINER): Atomically assigns a Singapore phone number to a tenant using `FOR UPDATE SKIP LOCKED` for race-safety. Returns `phone_number` or empty if no inventory.

**RLS**: phone_inventory: RLS enabled, no authenticated policies (all access via service_role or SECURITY DEFINER RPC). phone_inventory_waitlist: INSERT allowed for anon+authenticated (anyone can join). Index: `idx_phone_inventory_available` on (country, status) WHERE status = 'available'.

---

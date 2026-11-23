---
type: system
system: Auth and Database
status: current
description: "Migration Trail 012 to 037. Covers: 012_admin_users.sql — Admin Dashboard Auth Gate (Phase 28-01); 013_usage_events.sql — Per-Call Usage Tracking (Phase 23-01); 017_overage_billing.sql — Overage Metered Billing; 019_appointments_exclusion_constraint.sql — Overlap Prevention; 024_schema_hardening.sql"
source: .claude/skills/auth-database-multitenancy/SKILL.md § 5. Migration Trail
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# Migration Trail (part 2 of 3)

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

### 012_admin_users.sql — Admin Dashboard Auth Gate (Phase 28-01)

**Tables created**: `admin_users`

**admin_users columns**:
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | gen_random_uuid() |
| `user_id` | uuid UNIQUE | FK → auth.users(id) |
| `role` | text | NOT NULL DEFAULT 'admin' |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

**RLS**: Enabled. Single SELECT policy: "Authenticated can read own admin row" — `auth.uid() = user_id`. Authenticated users can only read their own admin status row. No INSERT/UPDATE/DELETE policies — admin user management is exclusively via service_role (Supabase CLI or direct DB insert). No service_role bypass policy needed because service_role bypasses RLS by default.

**Bootstrap**: To make a user an admin, insert directly via Supabase CLI:
```sql
INSERT INTO admin_users (user_id, role) VALUES ('<auth.users UUID>', 'admin');
```

---

### 013_usage_events.sql — Per-Call Usage Tracking (Phase 23-01)

**Tables created**: `usage_events`

**usage_events columns**:
| Column | Type | Notes |
|--------|------|-------|
| `call_id` | text PK | Call ID (LiveKit room name or legacy Retell ID) — idempotency key, prevents double-counting |
| `tenant_id` | uuid | FK → tenants(id) ON DELETE CASCADE |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

**Index**: `idx_usage_events_tenant_id` on `(tenant_id)`

**RLS**: Enabled. `service_role_all_usage_events` — service_role ALL (no authenticated user access). Webhook handlers write via service_role client.

**`increment_calls_used(p_tenant_id uuid, p_call_id text)` RPC**:
- Returns `TABLE(success boolean, calls_used int, calls_limit int, limit_exceeded boolean)`
- Idempotency: `INSERT INTO usage_events ... ON CONFLICT (call_id) DO NOTHING` — if FOUND is false (duplicate), returns current state without incrementing
- Atomic increment: `UPDATE subscriptions SET calls_used = calls_used + 1 WHERE tenant_id = p_tenant_id AND is_current = true` — Postgres atomicity guarantees no race conditions
- No active subscription: returns `(false, 0, 0, false)`
- No SECURITY DEFINER — service_role client bypasses RLS automatically

---

### 017_overage_billing.sql — Overage Metered Billing

**Extends subscriptions**: `overage_stripe_item_id` (text, nullable) — Stripe subscription item ID for the metered overage price component. Used by `call-processor.js` to report per-call usage when `calls_used > calls_limit`.

No new tables. No RLS changes (existing subscriptions policies cover all columns).

---

### 019_appointments_exclusion_constraint.sql — Overlap Prevention

Replaces the original `UNIQUE (tenant_id, start_time)` constraint from migration 003 with a GiST exclusion constraint that prevents overlapping time ranges.

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_tenant_id_start_time_key;

ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    tenant_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (status <> 'cancelled');
```

**Key properties**:
- Prevents overlapping time ranges (not just identical start times) — two appointments for the same tenant cannot have overlapping `[start_time, end_time)` intervals
- Only applies to non-cancelled appointments (`WHERE status <> 'cancelled'`) — cancelled slots can be rebooked
- Uses `btree_gist` extension for GiST index support on scalar types (required for `tenant_id WITH =` in the exclusion)
- The existing `idx_appointments_tenant_start` index from migration 003 is kept for query performance

No new tables. No RLS changes.

---

### 024_schema_hardening.sql — Indexes, Constraints, Trigger

**Function created**: `set_updated_at()` — generic trigger function that sets `NEW.updated_at = now()`.

**Trigger**: `trg_leads_updated_at` BEFORE UPDATE on leads — auto-maintains `leads.updated_at`.

**Constraint**: `admin_users_role_check` — CHECK (role IN ('admin', 'super_admin')).

**Indexes added**: `idx_waitlist_email` on phone_inventory_waitlist(email), `idx_zone_travel_buffers_tenant` on zone_travel_buffers(tenant_id).

No new tables. No RLS changes.

---

### 025_fix_book_appointment_atomic.sql — RPC Fix

Re-creates `book_appointment_atomic` to fix "column scheduled does not exist" error caused by a manual DB modification. Restores the correct version from migration 003 (advisory lock + overlap check + insert pattern).

No new tables. No schema changes.

---

### 026_address_fields.sql — Structured Address Columns

**Extends appointments**: `postal_code` (text), `street_name` (text)

**Extends leads**: `postal_code` (text), `street_name` (text)

**Updates book_appointment_atomic**: Drops all overloads dynamically, re-creates with `p_postal_code` and `p_street_name` params (DEFAULT NULL for backward compat). Inserts postal_code + street_name into appointments.

No new tables. No RLS changes.

---

### 027_lock_rpc_functions.sql — SECURITY DEFINER Lockdown

Revokes PUBLIC execute on `book_appointment_atomic` and `assign_sg_number` SECURITY DEFINER functions, grants to `service_role` only. Prevents anonymous/authenticated callers from invoking these RPC functions directly via PostgREST.

No new tables. No schema changes.

---

### 028_calls_tenant_cascade.sql — FK Cascade Fix

Replaces `calls.tenant_id` FK constraint (was RESTRICT, blocking tenant deletion) with ON DELETE CASCADE.

No new tables. No RLS changes.

---

### 029_invoice_schema.sql — Invoice Data Foundation

**Tables created**: `invoice_settings`, `invoice_sequences`, `invoices`, `invoice_line_items`

**invoice_settings columns**: `tenant_id` (uuid PK, FK tenants CASCADE), `business_name`, `address`, `phone`, `email`, `logo_url`, `license_number`, `tax_rate` (numeric(5,4) DEFAULT 0), `payment_terms` (DEFAULT 'Net 30'), `default_notes`, `invoice_prefix` (DEFAULT 'INV'), `created_at`, `updated_at`

**invoice_sequences**: Composite PK `(tenant_id, year)`, `next_number` (int DEFAULT 1). Atomic counter for invoice numbering.

**invoices columns**: `id` (uuid PK), `tenant_id` (FK CASCADE), `lead_id` (FK leads SET NULL), `invoice_number` (text NOT NULL), `status` (CHECK draft|sent|paid|overdue|void|partially_paid, DEFAULT 'draft'), `customer_name`, `customer_phone`, `customer_email`, `customer_address`, `job_type`, `issued_date`, `due_date`, `notes`, `payment_terms`, `subtotal`, `tax_amount`, `total`, `sent_at`, `paid_at`, `voided_at`, `created_at`, `updated_at`. Constraint: UNIQUE(tenant_id, invoice_number).

**invoice_line_items columns**: `id` (uuid PK), `invoice_id` (FK invoices CASCADE), `tenant_id` (FK CASCADE), `sort_order`, `item_type` (CHECK labor|materials|travel|flat_rate|discount|late_fee), `description`, `quantity`, `unit_price`, `markup_pct`, `taxable`, `line_total`, `created_at`.

**RPC**: `get_next_invoice_number(p_tenant_id uuid, p_year int)` — atomic UPSERT on invoice_sequences, returns next number.

**Storage**: `invoice-logos` bucket (public) with tenant-scoped upload policy.

**RLS**: All 4 tables use tenant_id child pattern + service_role bypass.

---

### 030_accounting_integrations.sql — Accounting Provider OAuth

**Tables created**: `accounting_credentials`, `accounting_sync_log`

**accounting_credentials columns**: `id` (uuid PK), `tenant_id` (FK CASCADE), `provider` (CHECK quickbooks|xero|freshbooks), `access_token`, `refresh_token`, `expiry_date` (bigint), `realm_id` (QBO), `xero_tenant_id`, `account_id` (FreshBooks), `display_name`, `connected_at`, `last_synced_at`, `created_at`. Constraint: UNIQUE(tenant_id, provider).

**accounting_sync_log columns**: `id` (uuid PK), `tenant_id` (FK CASCADE), `invoice_id` (FK invoices CASCADE), `provider`, `external_id`, `status` (CHECK pending|synced|failed, DEFAULT 'pending'), `error_message`, `attempted_at`, `synced_at`. Constraint: UNIQUE(invoice_id, provider).

**RLS**: Both tables use tenant_id child pattern + service_role bypass.

---

### 030_estimates_schema.sql — Estimates Data Foundation

**Tables created**: `estimate_sequences`, `estimates`, `estimate_tiers`, `estimate_line_items`

**estimate_sequences**: Composite PK `(tenant_id, year)`, `next_number` (int DEFAULT 1). Same pattern as invoice_sequences.

**estimates columns**: `id` (uuid PK), `tenant_id` (FK CASCADE), `lead_id` (FK leads SET NULL), `estimate_number` (text NOT NULL), `status` (CHECK draft|sent|approved|declined|expired, DEFAULT 'draft'), `customer_name`, `customer_phone`, `customer_email`, `customer_address`, `job_type`, `created_date`, `valid_until`, `notes`, `subtotal`, `tax_amount`, `total`, `converted_to_invoice_id` (FK invoices SET NULL), `sent_at`, `approved_at`, `declined_at`, `created_at`, `updated_at`. Constraint: UNIQUE(tenant_id, estimate_number).

**estimate_tiers columns**: `id` (uuid PK), `estimate_id` (FK estimates CASCADE), `tenant_id` (FK CASCADE), `tier_label` (DEFAULT 'Good'), `sort_order`, `subtotal`, `tax_amount`, `total`, `created_at`. Good/Better/Best tiering.

**estimate_line_items columns**: `id` (uuid PK), `estimate_id` (FK estimates CASCADE), `tier_id` (FK estimate_tiers CASCADE, nullable), `tenant_id` (FK CASCADE), `sort_order`, `item_type` (CHECK labor|materials|travel|flat_rate|discount), `description`, `quantity`, `unit_price`, `markup_pct`, `taxable`, `line_total`, `created_at`.

**RPC**: `get_next_estimate_number(p_tenant_id uuid, p_year int)` — same atomic UPSERT pattern as invoice counter.

**Extends invoice_settings**: `estimate_prefix` (text NOT NULL DEFAULT 'EST').

**RLS**: All 4 tables use tenant_id child pattern + service_role bypass.

---

### 031_payment_log_schema.sql — Invoice Payments + Status Expansion

**Tables created**: `invoice_payments`

**invoice_payments columns**: `id` (uuid PK), `invoice_id` (FK invoices CASCADE), `tenant_id` (FK CASCADE), `amount` (numeric(10,2) NOT NULL), `payment_date` (date DEFAULT CURRENT_DATE), `note`, `created_at`.

**Expands invoices.status CHECK**: Adds 'partially_paid' to allowed values.

**Expands invoice_line_items.item_type CHECK**: Adds 'late_fee' to allowed values.

**RLS**: invoice_payments uses tenant_id child pattern + service_role bypass.

---

### 032_reminders_recurring.sql — Invoice Reminders + Late Fees + Recurring

**Tables created**: `invoice_reminders`

**invoice_reminders columns**: `id` (uuid PK), `invoice_id` (FK invoices CASCADE), `tenant_id` (FK CASCADE), `reminder_type` (CHECK before_3|due_date|overdue_3|overdue_7), `sent_at`. Constraint: UNIQUE(invoice_id, reminder_type) — idempotency.

**Extends invoice_settings**: `late_fee_enabled` (boolean DEFAULT false), `late_fee_type` (CHECK flat|percentage, DEFAULT 'flat'), `late_fee_amount` (numeric(10,2) DEFAULT 0).

**Extends invoices**: `reminders_enabled` (boolean DEFAULT true), `late_fee_applied_at`, `is_recurring_template` (boolean DEFAULT false), `recurring_frequency` (CHECK weekly|monthly|quarterly|annually), `recurring_start_date`, `recurring_end_date`, `recurring_next_date`, `recurring_active` (boolean DEFAULT false), `generated_from_id` (FK invoices SET NULL).

**RLS**: invoice_reminders uses tenant_id child pattern + service_role bypass.

---

### 033_lock_counter_functions.sql — Counter Function Lockdown

Revokes PUBLIC execute on `get_next_invoice_number` and `get_next_estimate_number`, grants to both `service_role` and `authenticated`. Unlike 027 (service_role only), these counters need authenticated access because they are called from API routes using the session client.

No new tables. No schema changes.

---

### 034_add_skipped_sms_status.sql — Recovery SMS Status Expansion

Expands `calls.recovery_sms_status` CHECK to add 'skipped' value (for short calls <15s and booked callers where SMS is intentionally not sent). New allowed values: pending|sent|failed|retrying|skipped.

No new tables. No schema changes.

---

### 035_lead_email_and_invoice_title.sql — Lead Email + Invoice Title

**Extends leads**: `email` (text) — collected manually by owner after initial call.

**Extends invoices**: `title` (text) — friendly invoice name alongside auto-generated invoice_number.

No new tables. No RLS changes.

---

### 036_rename_high_ticket_to_urgent.sql — Urgency Tier Rename

Renames urgency tier 'high_ticket' to 'urgent' across all four tables that carry urgency columns. Includes data migration (UPDATE SET) and CHECK constraint rebuild for each:

- `calls.urgency_classification`: CHECK emergency|routine|urgent
- `leads.urgency`: CHECK emergency|routine|urgent
- `appointments.urgency`: CHECK emergency|routine|urgent
- `services.urgency_tag`: CHECK emergency|routine|urgent

No new tables. No RLS changes.

---

---
type: system
system: Onboarding
status: legacy-app
description: "Pre-purchased SG phone numbers managed by admin. Covers: `tenants` table (onboarding-relevant columns); `phone_inventory` table; `phone_inventory_waitlist` table; `services` table"
source: .claude/skills/onboarding-flow/SKILL.md § 10. Database Tables — Onboarding-Relevant Columns
migrated: 2026-11-23
verified:
tags: [voco/system/onboarding]
---

# Database Tables - Onboarding-Relevant Columns

Part of [[Onboarding]]. Migrated verbatim from the `onboarding-flow` skill; check `verified` before trusting details.

### `tenants` table (onboarding-relevant columns)

| Column | Type | Notes |
|--------|------|-------|
| `owner_id` | uuid | Supabase auth user ID (unique, conflict target for upsert) |
| `owner_email` | text | Saved in sms-confirm route from `user.email` |
| `owner_name` | text | Saved in sms-confirm route from Your Details step (Phase 27) |
| `owner_phone` | text | Saved in sms-confirm route from wizard input (E.164 format) |
| `country` | text | 'SG' | 'US' | 'CA' — saved in sms-confirm route, read by checkout webhook for provisioning (Phase 27) |
| `business_name` | text | Required for AI prompt — set in Step 1 |
| `trade_type` | text | Set in Step 1 via /start route |
| `tone_preset` | text | Default 'professional', set in Step 1 |
| `phone_number` | text | Provisioned number — set by checkout webhook after Stripe payment (Phase 27) |
| `onboarding_complete` | boolean | Set by checkout.session.completed webhook after Stripe payment |
| `provisioning_failed` | boolean | Set by checkout webhook when phone provisioning fails (admin follow-up needed) (Phase 27) |
| `test_call_completed` | boolean | "Test call ever connected" — set by the LiveKit `/api/webhooks/livekit` participant_joined webhook on a genuine connect (no longer at trigger time). Gates the setup checklist's `make_test_call` item |
| `test_call_status` | text | Live state of the current test attempt: none\|calling\|connected\|failed (migration 077). `/api/onboarding/test-call` sets `calling`; the LiveKit webhook sets `connected` |
| `test_call_last_at` | timestamptz | Timestamp of the last test call that actually connected (migration 077) |

### `phone_inventory` table

Pre-purchased SG phone numbers managed by admin.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `phone_number` | text | E.164 format, unique |
| `country` | text | 'SG' (only SG numbers in inventory; US/CA provisioned on-demand) |
| `status` | text | 'available' | 'assigned' | 'retired' |
| `assigned_tenant_id` | uuid | FK to tenants.id; NULL when status='available' |
| `created_at` | timestamptz | For ordering (FIFO assignment) |

**Assignment is race-safe:** `assign_sg_number(p_tenant_id uuid)` RPC uses `SELECT ... FOR UPDATE SKIP LOCKED` inside an UPDATE, preventing double-assignment on concurrent checkouts.

### `phone_inventory_waitlist` table

SG waitlist signups when inventory is exhausted.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `email` | text | Waitlist email address |
| `country` | text | Always 'SG' |
| `created_at` | timestamptz | Signup timestamp |
| `notified_at` | timestamptz | NULL until admin notifies; enables future automated notification |

### `services` table

Populated during Step 1 (profile) and optionally modified in Step 2 (services). Each service: `{ tenant_id, name, urgency_tag }`. Pre-populated from TRADE_TEMPLATES.

---

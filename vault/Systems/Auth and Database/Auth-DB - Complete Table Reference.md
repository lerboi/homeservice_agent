---
type: system
system: Auth and Database
status: current
description: "Tenant columns added across migrations (all on tenants table):"
source: .claude/skills/auth-database-multitenancy/SKILL.md § 6. Complete Table Reference
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# Complete Table Reference

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

| Table | Migration | Purpose | RLS Pattern |
|-------|-----------|---------|------------|
| `tenants` | 001 | Business config: name, phone, locale, timezone, hours, tone | Direct owner (`owner_id = auth.uid()`) |
| `calls` | 001 | Full call record: metadata, transcript, recording, triage, booking_outcome | Tenant child |
| `services` | 002 | Service catalog with urgency tags | Tenant child |
| `appointments` | 003 | Bookings with calendar event references | Tenant child |
| `service_zones` | 003 | Geographic zones for travel buffers. 074: `cities text[] NOT NULL DEFAULT '{}'` — town/city half of the Service-Area coverage (alongside the existing `postal_codes[]` ZIP half). | Tenant child |
| `zone_travel_buffers` | 003 | Travel time between zone pairs | Tenant child |
| `calendar_credentials` | 003 | Google + Outlook OAuth tokens and sync state. 069: client-role table privileges REVOKED (plaintext tokens were owner-browser-readable) — effectively service-role only; tenant-own RLS policies remain but are unreachable for client roles | Tenant child (069: client privileges revoked) |
| `calendar_events` | 003 | Local mirror of Google/Outlook events | Tenant child |
| `calendar_blocks` | 046 | Personal time blocks (lunch, vacation, errands). Columns: id, tenant_id, title, start_time, end_time, is_all_day, note, external_event_id (047), group_id (048), created_at. 4 RLS policies. Syncs to Google/Outlook. Multi-day blocks share a group_id for bulk delete. | Tenant child |
| `leads` | 004 | **DROPPED in 061** — CRM records (superseded by customers/jobs/inquiries) | — |
| `lead_calls` | 004 | **DROPPED in 061** — Junction: many calls → one lead (superseded by customer_calls/job_calls) | — |
| `activity_log` | 004 | Dashboard event feed — event_type now `activity_event_type` enum; customer_id/job_id/inquiry_id FKs; lead_id dropped. 068: partial index `idx_activity_log_customer (customer_id) WHERE customer_id IS NOT NULL` (customer Activity tab + merge/unmerge repointing). | Tenant child |
| `customers` | 059 | One row per (tenant_id, phone_e164). UNIQUE(tenant_id, phone_e164). Soft-delete via merged_into. Realtime FULL. | Tenant child |
| `jobs` | 059 | One row per booked appointment. appointment_id NOT NULL UNIQUE (1:1 with appointments). Realtime FULL. | Tenant child |
| `inquiries` | 059 | Unbooked calls. status: open/converted/lost. No cron/auto-timeout (D-07a). 074: `out_of_area boolean NOT NULL DEFAULT false` (set by capture_lead via a follow-up service-role UPDATE). Realtime FULL. | Tenant child |
| `customer_calls` | 059 | Junction: call → customer (always). Composite PK (customer_id, call_id). NOT in Realtime publication. | Via customers.tenant_id |
| `job_calls` | 059 | Junction: call → job (only on job path). Composite PK (job_id, call_id). NOT in Realtime publication. | Via jobs.tenant_id |
| `customer_merge_audit` | 059 | Permanent audit of all merges/unmerges. Retained forever. row_counts JSONB per-table. unmerged_at marks reversal without deleting row. | Tenant child |
| `escalation_contacts` | 006 | Owner-configured escalation chain | Tenant child |
| `subscriptions` | 010 | Stripe subscription state per tenant. 068: partial UNIQUE `idx_subscriptions_one_current (tenant_id) WHERE is_current` — at most one current row per tenant (after dedupe). | Tenant child (SELECT-own only) |
| `stripe_webhook_events` | 010 | Webhook idempotency (UNIQUE event_id) + `processed` flag (064) + `processing_started_at` atomic claim (068) | Service role only |
| `phone_inventory` | 011 | Singapore phone number pool for tenant assignment | Service role only (no authenticated policies) |
| `phone_inventory_waitlist` | 011 | Email waitlist for SG number availability | INSERT for anon+authenticated |
| `admin_users` | 012 | Platform admin users — gates /admin/* routes | Authenticated SELECT-own only (user_id = auth.uid()) |
| `usage_events` | 013 | Per-call idempotency guard for usage counting (call_id PK) | Service role only |
| `billing_notifications` | 016 | Idempotent billing notification tracking (trial_will_end, payment_failed) | Service role only |
| `invoice_settings` | 029 | Per-tenant invoice/estimate config: business info, tax rate, payment terms, late fees, prefixes | Tenant child |
| `invoice_sequences` | 029 | Atomic invoice number counter (composite PK: tenant_id + year) | Tenant child |
| `invoices` | 029 | Invoice records with status lifecycle, recurring support, and reminder tracking. 068: `idx_invoices_job_id (job_id)` (customer Invoices tab JOIN). | Tenant child |
| `invoice_line_items` | 029 | Line items per invoice: labor, materials, travel, flat_rate, discount, late_fee | Tenant child |
| `accounting_credentials` | 030 | OAuth tokens per tenant (provider CHECK narrowed to xero/jobber by 052). 069: client-role table privileges REVOKED (plaintext tokens were owner-browser-readable) — effectively service-role only | Tenant child (069: client privileges revoked) |
| `accounting_sync_log` | 030 | Per-invoice sync status to accounting providers | Tenant child |
| `estimate_sequences` | 030 | Atomic estimate number counter (composite PK: tenant_id + year) | Tenant child |
| `estimates` | 030 | Estimate records with Good/Better/Best tiering and convert-to-invoice support | Tenant child |
| `estimate_tiers` | 030 | Good/Better/Best pricing tiers per estimate | Tenant child |
| `estimate_line_items` | 030 | Line items per estimate tier | Tenant child |
| `invoice_payments` | 031 | Payment log entries per invoice (partial payment support) | Tenant child |
| `invoice_reminders` | 032 | Idempotent reminder tracking per invoice (UNIQUE invoice_id + reminder_type) | Tenant child |
| `sms_messages` | 045 | Audit log of inbound SMS + forwarded copies to tenant's `pickup_numbers` with `sms_forward=true`. Columns: id, tenant_id, from_number, to_number, body, direction (CHECK IN 'inbound','forwarded'), created_at. Index on (tenant_id, created_at). RLS: SELECT-own only via tenants.owner_id. | Tenant child (SELECT-own only) |
| `rate_limit_hits` | 065 | Durable fixed-window rate-limit counters (replaces in-memory Maps). Buckets in use: `/api/public-chat`, `/api/demo-voice`, `contact-ip` (`/api/contact`, per-IP 5/hr), `sms-verify-user` (`/api/onboarding/sms-verify`, per-user 5/hr). Columns: bucket, key, window_start, count (PK `(bucket, key, window_start)`). Index on (window_start) for cleanup cron. Incremented via `increment_rate_limit` RPC; pruned daily by `/api/cron/cleanup-rate-limits`. NOT tenant-scoped (no tenant_id). | Service role only (`service_role_all_rate_limit_hits`) |
| `stripe_meter_failures` | 071 | Durable outbox for failed Stripe Billing Meter overage posts. Written by the Python agent (upsert on call_id), drained by `/api/cron/retry-meter-events` (re-post with `overage_{call_id}` identifier, delete on success, Sentry alert at 10 attempts). Columns: id, tenant_id FK, call_id UNIQUE, stripe_customer_id, failure_reason, attempts, last_attempt_at, created_at. | Service role only (RLS on, no policies, client privileges revoked) |
| `owner_notification_failures` | 076 | LK-B2 durable outbox for failed owner missed-job SMS/email ALERTS (mirrors `stripe_meter_failures`). Written by the Python agent's post-call pipeline (upsert on `notification_key` = `'{call_id}:{channel}'`, best-effort/fail-open on a 3s send timeout/failure), drained by `/api/cron/retry-owner-notifications` (every 5 min — re-send stored payload, delete on success, Sentry alert at 10 attempts). At-least-once (no provider dedupe). Columns: id, tenant_id FK, notification_key UNIQUE, channel (CHECK sms\|email), recipient, payload jsonb, failure_reason, attempts, last_attempt_at, created_at. | Service role only (RLS on, no policies, client privileges revoked) |

**Tenant columns added across migrations** (all on `tenants` table):
- 002: `tone_preset`, `trade_type`, `test_call_completed`, `working_hours`
- 003: `tenant_timezone`, `slot_duration_mins`
- 005: `setup_checklist_dismissed`
- 011: `owner_name`, `country`, `provisioning_failed`
- 015: `notification_preferences` (JSONB, per-outcome SMS/email toggles)
- 023: `phone_number` (renamed from `retell_phone_number`)
- 039: `call_forwarding_schedule` (JSONB), `pickup_numbers` (JSONB), `dial_timeout_seconds` (INTEGER)
- 044: `ai_voice` (TEXT, nullable) — voice override; NULL = tone-based fallback. **Phase 65 / migration 067** replaced the CHECK with the OpenAI voice set and cleared all values to NULL; **migration 070 (2026-06-12)** replaced that with the 3 stable labels (IN 'professional','friendly','local_expert') — the agent maps labels → ElevenLabs voice ids.
- 049: `vip_numbers` (JSONB NOT NULL DEFAULT '[]') — standalone Priority-caller phone numbers (unlimited, no CHECK). Webhook reads this for direct-routing check before evaluating schedule/caps.
- 050: `checklist_overrides` (JSONB NOT NULL DEFAULT '{}') — per-item user actions (dismiss, mark-done) on the dashboard setup checklist. Keyed by checklist item id; values carry `status` + timestamp. Consumed by `/api/setup-checklist` GET/PATCH. Auto-detected completions are NOT stored here (they're derived live).
- 051: `features_enabled` (JSONB NOT NULL DEFAULT `'{"invoicing": false}'::jsonb`) — per-tenant feature flags (shape `{ invoicing: boolean, ... }`). Default ships invoicing OFF for v6.0; owners opt in at `/dashboard/more/features`. Read via `getTenantFeatures(tenantId)` in `src/lib/features.js`; extended in `src/proxy.js` tenant SELECT alongside `onboarding_complete`. JSONB filter for crons: `.eq('features_enabled->>invoicing', 'true')` — value is the string `'true'`, not the boolean.
- 074: `out_of_area_action` (text NOT NULL DEFAULT 'callback', CHECK IN 'callback'|'decline_referral'|'trip_fee') + `out_of_area_referral_note` (text, nullable) — M16 P1 Service-Area gate; what the AI does when a caller's address falls outside coverage. The CHECK-enum mirrors the `tone_preset` style. No RLS change (existing `tenants` direct-owner policy covers the new columns).
- 075: `travel_buffer_mins` (int NOT NULL DEFAULT 30) — M16 P2 owner-adjustable travel buffer. The slot calculator's default buffer path reads it (threaded through `calculate_available_slots`/`calculateAvailableSlots` like `slot_duration_mins`), enforced forward + backward of every booking. DEFAULT 30 = pre-P2 behavior; 0 disables. No RLS change. Owner-set via `PUT /api/working-hours`.

**Appointments columns added across migrations** (all on `appointments` table):
- 007: `external_event_id` (renamed from google_event_id), `external_event_provider`
- 026: `postal_code`, `street_name`
- 046: `completed_at` (timestamptz, nullable) — set when owner marks the job done from the dashboard.

**Calls columns added across migrations** (all on `calls` table):
- 008: `booking_outcome`, `exception_reason`, `notification_priority`
- 009: `recovery_sms_status`, `recovery_sms_retry_count`, `recovery_sms_last_error`, `recovery_sms_last_attempt_at`
- 023: `call_provider` ('retell'|'livekit'), `egress_id`; renames: `retell_call_id`→`call_id`, `retell_metadata`→`call_metadata`
- 034: `recovery_sms_status` CHECK expanded to add 'skipped'
- 036: `urgency_classification` CHECK updated: 'high_ticket'→'urgent'
- 042: `routing_mode` (TEXT, nullable, CHECK IN 'ai'|'owner_pickup'|'fallback_to_ai'), `outbound_dial_duration_sec` (INTEGER) — set by the Twilio dial-status webhook
- 045: `call_sid` (TEXT, nullable) — Twilio CallSid. Populated by webhook routing to link owner-pickup call records to dial-status callbacks. Sparse index `idx_calls_call_sid WHERE call_sid IS NOT NULL`.
- 066: `call_sid` UNIQUE constraint `calls_call_sid_unique` — replaces the 045 non-unique partial index (`DROP INDEX idx_calls_call_sid`). Only owner-pickup rows carry a non-NULL call_sid; NULLs are DISTINCT so AI/LiveKit rows are unconstrained. Migration de-dupes existing duplicate-call_sid rows first. Pairs with the livekit-agent owner-pickup `upsert(on_conflict="call_sid")` (full UNIQUE constraint is required for ON CONFLICT inference; a partial unique index would not match).

**Leads columns added across migrations** (all on `leads` table — TABLE DROPPED IN 061):
- 026: `postal_code`, `street_name`
- 035: `email`
- 036: `urgency` CHECK updated: 'high_ticket'→'urgent'
- 049: `is_vip` (BOOLEAN NOT NULL DEFAULT false) — marks existing customers as Priority/VIP callers. Sparse partial index on (tenant_id, from_number) WHERE is_vip=true supports fast lookup at webhook routing time.

**Services columns added**:
- 018: `intake_questions` (jsonb)
- 036: `urgency_tag` CHECK updated: 'high_ticket'→'urgent'

**Invoices columns added across migrations** (all on `invoices` table):
- 031: `status` CHECK expanded to add 'partially_paid'
- 032: `reminders_enabled`, `late_fee_applied_at`, `is_recurring_template`, `recurring_frequency`, `recurring_start_date`, `recurring_end_date`, `recurring_next_date`, `recurring_active`, `generated_from_id`
- 035: `title`
- 059: `job_id` (uuid FK → jobs ON DELETE SET NULL, NULLABLE) — Phase 59 reattribution; customer derivable via job.customer_id. Invoice attribution is now via jobs, not leads.
- 061: `lead_id` column **DROPPED** — backfilled to job_id in 059; NOT NULL flip left conditional (ad-hoc invoices without a job remain possible per D-11).

**Invoice_settings columns added across migrations**:
- 030: `estimate_prefix`
- 032: `late_fee_enabled`, `late_fee_type`, `late_fee_amount`

**Invoice_line_items columns added across migrations**:
- 031: `item_type` CHECK expanded to add 'late_fee'

**Estimates columns added across migrations** (all on `estimates` table):
- 061: `lead_id` column **DROPPED** (legacy `leads` table dropped in 061).
- 063: `customer_id` (uuid FK → customers ON DELETE SET NULL, NULLABLE) — re-links estimates to customers after 061 dropped `leads`/`estimates.lead_id`. No backfill (dropped leads gone; existing rows keep their denormalized customer_name/phone/email/address snapshot). Composite index `idx_estimates_tenant_customer (tenant_id, customer_id)`.

**Stripe_webhook_events columns added across migrations**:
- 064: `processed` (boolean NOT NULL DEFAULT false) — atomic webhook idempotency. Handler sets `processed=true` only AFTER the side-effecting block succeeds; a duplicate delivery with `processed=false` re-runs (handlers are idempotent), instead of being silently swallowed by the UNIQUE(event_id) 23505. No backfill (existing rows default false; their delivery windows are closed).

---

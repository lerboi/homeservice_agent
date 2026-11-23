---
type: system
system: Auth and Database
status: current
description: "Two unrelated hardening items grouped in one migration: Covers: 038_schema_hardening_2.sql — Stripe Index + Atomic Primary-Calendar Swap; 044_ai_voice_column.sql — AI Voice Selection (Phase 44); 042_call_routing_schema.sql — Call Routing Foundation (Phase 39); 045_sms_messages_and_call_sid.sql — SMS"
source: .claude/skills/auth-database-multitenancy/SKILL.md § 5. Migration Trail
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# Migration Trail (part 3 of 3)

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

### 038_schema_hardening_2.sql — Stripe Index + Atomic Primary-Calendar Swap

Two unrelated hardening items grouped in one migration:

1. **Index** `idx_subscriptions_stripe_customer_id` on `subscriptions(stripe_customer_id)` — speeds up Stripe webhook handler customer lookups.

2. **`set_primary_calendar(p_tenant_id uuid, p_provider text)` RPC** (SECURITY DEFINER, returns void):

```sql
UPDATE calendar_credentials
SET is_primary = (provider = p_provider)
WHERE tenant_id = p_tenant_id;
```

Single-statement atomic swap so two providers cannot both be marked primary during a race window. Called by the calendar OAuth callback when the user (re)connects a provider and elects it as primary.

**Lockdown:** `REVOKE ALL ON FUNCTION set_primary_calendar FROM PUBLIC; GRANT EXECUTE ... TO service_role;` — intent: only service-role clients (server routes via `src/lib/supabase.js`) can invoke. **In practice this was ineffective until migration 069**: Supabase grants EXECUTE to anon/authenticated explicitly, so the PUBLIC-only revoke left the function anon-callable; 069's catalog-driven lockdown revoked those grants and pinned its `search_path`.

No new tables. No RLS changes.

---

### 044_ai_voice_column.sql — AI Voice Selection (Phase 44)

> **Superseded twice:** migration 067 (Phase 65) replaced the CHECK below with the OpenAI gpt-realtime voice set and cleared all values to NULL; migration **070** (2026-06-12) then replaced 067's CHECK with the 3 stable **labels** — `professional`, `friendly`, `local_expert` (NULL allowed). The agent maps labels → ElevenLabs voice ids; the dashboard picker (`VALID_VOICES` in `src/lib/ai-voice-validation.js`) now validates against the labels. The text below documents the original Phase 44 state.

**Extends tenants**: `ai_voice` (TEXT, nullable) — The chosen voice for the AI receptionist. NULL means fall back to `VOICE_MAP[tone_preset]` in the LiveKit agent.

```sql
ALTER TABLE tenants
  ADD COLUMN ai_voice TEXT CHECK (
    ai_voice IS NULL OR ai_voice IN ('Aoede', 'Erinome', 'Sulafat', 'Zephyr', 'Achird', 'Charon')
  );
```

**Key properties**:
- Nullable — existing tenants keep NULL (backward compatible, D-17)
- CHECK constraint is case-sensitive — 'aoede' would be rejected
- 6 allowed values (curated Gemini voices): Aoede, Erinome, Sulafat (female); Zephyr, Achird, Charon (male)
- No migration backfill — tenants choose explicitly via `PATCH /api/ai-voice-settings`

**API route**: `PATCH /api/ai-voice-settings` — tenant-scoped, uses `getTenantId()` + service role client. Validates against `VALID_VOICES` allowlist in `src/lib/ai-voice-validation.js`.

No new tables. No RLS changes (existing tenants RLS covers new column).

---

### 042_call_routing_schema.sql — Call Routing Foundation (Phase 39)

**Extends tenants** with three JSONB/INTEGER columns that drive the Twilio webhook routing decision:

```sql
ALTER TABLE tenants
  ADD COLUMN call_forwarding_schedule JSONB NOT NULL DEFAULT '{"enabled":false,"days":{}}'::jsonb,
  ADD COLUMN pickup_numbers JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_array_length(pickup_numbers) <= 5),
  ADD COLUMN dial_timeout_seconds INTEGER NOT NULL DEFAULT 15;

ALTER TABLE calls
  ADD COLUMN routing_mode TEXT CHECK (routing_mode IN ('ai','owner_pickup','fallback_to_ai')),
  ADD COLUMN outbound_dial_duration_sec INTEGER;

CREATE INDEX IF NOT EXISTS idx_calls_tenant_month ON calls (tenant_id, created_at);
```

- `call_forwarding_schedule` — shape `{enabled: bool, days: {mon..sun: [{start, end}]}}`, consumed by `webhook/schedule.py::evaluate_schedule` (pure function, no DB access).
- `pickup_numbers` — JSONB array of `{number, label, sms_forward}` objects, capped at 5 (CHECK). These are the parallel-ring targets for `owner_pickup` routing.
- `dial_timeout_seconds` — how long Twilio should ring the pickup numbers before falling through to AI.
- `routing_mode` on calls — populated by the `/twilio/dial-status` callback: `'owner_pickup'` if any pickup answered, `'fallback_to_ai'` if all missed.
- `outbound_dial_duration_sec` — populated same callback; feeds `webhook/caps.py::check_outbound_cap` for monthly minute caps (US/CA: 5000, SG: 2500).
- `idx_calls_tenant_month` powers the monthly SUM query inside `check_outbound_cap`.

No RLS changes (existing tenant/calls policies cover the new columns).

---

### 045_sms_messages_and_call_sid.sql — SMS Audit Log + Call SID (Phase 40)

**New table** `sms_messages` (audit trail for inbound SMS forwarded to pickup numbers via `/twilio/incoming-sms`):

```sql
CREATE TABLE sms_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_number TEXT NOT NULL,
  to_number   TEXT NOT NULL,
  body        TEXT NOT NULL,
  direction   TEXT NOT NULL CHECK (direction IN ('inbound', 'forwarded')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sms_messages_tenant_created ON sms_messages (tenant_id, created_at);
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_select_sms" ON sms_messages
  FOR SELECT USING (tenant_id = (SELECT id FROM tenants WHERE owner_id = auth.uid()));
```

Only a SELECT policy is defined — writes happen exclusively from the service-role Twilio webhook handler (`webhook/twilio_routes.py::incoming_sms`). One row per inbound SMS (`direction='inbound'`) plus one row per forward target (`direction='forwarded'`).

**Also**: `ALTER TABLE calls ADD COLUMN call_sid TEXT` + sparse index `idx_calls_call_sid WHERE call_sid IS NOT NULL`. The webhook stamps `call_sid` on owner-pickup call rows so the `/twilio/dial-status` callback can match back to the correct call record (AI-SIP calls use `call_id` instead; both columns coexist).

---

### 046_calendar_blocks_and_completed_at.sql — Time Blocks + Mark-Complete (Phase 42)

**New table** `calendar_blocks` — personal/unavailable time blocks (lunch, vacation, errands) distinct from appointments:

```sql
CREATE TABLE calendar_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title       text NOT NULL,
  start_time  timestamptz NOT NULL,
  end_time    timestamptz NOT NULL,
  is_all_day  boolean NOT NULL DEFAULT false,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE calendar_blocks ENABLE ROW LEVEL SECURITY;
-- 4 tenant policies (SELECT/INSERT/UPDATE/DELETE) — same shape as other tenant-child tables
CREATE INDEX idx_calendar_blocks_tenant_time ON calendar_blocks (tenant_id, start_time, end_time);

ALTER TABLE appointments ADD COLUMN completed_at timestamptz;
```

Blocks are respected by the slot calculator (`livekit-agent/src/lib/slot_calculator.py`) — the AI won't offer slots that overlap a block. Migration 047 adds `external_event_id` for syncing blocks to Google/Outlook; migration 048 adds `group_id` for bulk-delete of multi-day blocks.

`appointments.completed_at` is set when the owner clicks "Mark complete" on an appointment — used by the invoicing/Kanban flows to know the job is done.

---

### 049_vip_caller_routing.sql — Priority (VIP) Caller Direct Routing (Phase 46)

```sql
SET search_path TO public;

ALTER TABLE public.tenants
  ADD COLUMN vip_numbers JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.leads
  ADD COLUMN is_vip BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_leads_vip_lookup
  ON public.leads (tenant_id, from_number)
  WHERE is_vip = true;
```

Two-source priority lookup consumed by `webhook/twilio_routes.py::_is_vip_caller`:
1. **Standalone numbers** — `tenants.vip_numbers` JSONB array of `{number, label}` (unlimited, no CHECK per D-09). No DB hit — already loaded with the tenant row.
2. **Lead-based** — `leads.is_vip=true` for the caller's `from_number`. Sparse partial index so the lookup is fast even as the leads table grows (only VIP rows are indexed).

If either source matches, the webhook bypasses the schedule/cap evaluator and goes straight to owner-pickup parallel-ring. User-facing branding is "Priority" (the "VIP" name is DB-only, preserved for column continuity).

### 050_checklist_overrides.sql — Setup Checklist Per-Item Overrides (Phase 48)

```sql
SET search_path TO public;

ALTER TABLE public.tenants
  ADD COLUMN checklist_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;
```

Stores per-item user actions (dismiss, mark-done) on the dashboard setup checklist as a single JSONB map keyed by item id — avoids a row-per-item `checklist_item_state` table. Consumed by `src/app/api/setup-checklist/route.js` PATCH handler: incoming `{ item_id, action }` pairs are merged into the existing map, then written back whole. No new RLS policies needed — tenant-level isolation already enforced by the existing `tenants` direct-owner policy.

Shape of the JSONB value (example):

```json
{
  "setup_profile": { "status": "done", "done_at": "2026-04-14T12:34:56Z", "method": "manual" },
  "configure_call_routing": { "status": "dismissed", "dismissed_at": "2026-04-14T12:35:12Z" }
}
```

Auto-detected completions (test-call succeeded, calendar connected, etc.) are NOT stored here — those derive from the live tenant/appointments/calendar state on every GET. This column only holds actions the user took explicitly.

---

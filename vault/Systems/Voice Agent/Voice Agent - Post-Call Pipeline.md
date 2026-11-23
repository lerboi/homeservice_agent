---
type: system
system: Voice Agent
status: current
description: "Post-Call Pipeline. Covers: Transcript field extraction fallback"
source: .claude/skills/voice-call-architecture/SKILL.md § 6. Post-Call Pipeline
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# Post-Call Pipeline

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

**File**: `src/post_call.py`

Runs in-process immediately on AgentSession close.

`run_post_call_pipeline(params)` steps:

1. Build transcript — `transcript_text` (string) + `transcript_structured`
   (JSON list). **2026-09-04 P0.2:** each entry is `{role, content,
   timestamp}` — `timestamp` is the ms epoch `agent.py` stamped in
   `on_conversation_item`, so caller-turn-end → agent-turn-start gaps are
   computable per call via SQL (`jsonb_array_elements … with ordinality`,
   query kept in the Phase 0+1 brief). Additive: every main-repo consumer
   reads `role`/`content` only.
2. Update call record — `status='analyzed'`, transcript, recording path,
   disconnection_reason.
2b. **Booking reconciliation (Phase 46)** — if
    `booking_succeeded`, force `calls.booking_outcome='booked'`
    unconditionally; backfill `appointments.call_id = call_uuid` for the
    returned `booked_appointment_id` with `.is_("call_id", "null")`
    guard. Closes race where mid-call update matched zero rows because
    the `_run_db_queries` task hadn't inserted the calls row yet.
3. Test-call auto-cancel — cancel appointment + reset lead if
   `is_test_call` (benefits from the backfill too).
4. Usage tracking — `increment_calls_used` RPC; resolve the Stripe customer if
   over limit. **LK-B2 (2026-06-21): the slow Stripe meter POST was MOVED OUT of
   §4 into §7.5 (after owner notifications)** so billing can never starve the
   owner alert in the 8s budget. §4 now only runs the fast local `increment_calls_used`
   + the `subscriptions` customer lookup, carrying `overage_customer_id` forward
   (None = nothing to bill). See §7.5 for the deferred meter post + outbox.
5. Language detection — multi-language regex: CJK→zh, Tamil→ta,
   Vietnamese→vi, Spanish→es (keyword ≥2), Malay→ms (≥2), default en.
6. Triage classification — `classify_call()` three-layer pipeline.
6.5. **Phase 59 — Record call outcome via RPC** — if duration ≥ 15s and
   `call_uuid` exists, calls `record_outcome()` from
   `src/lib/write_outcome.py`. Single `record_call_outcome` RPC call that
   atomically upserts customer + creates job (booked) or inquiry (unbooked)
   + links call junctions (D-14/D-16). Replaces prior
   `create_or_merge_lead()` + `lead_calls` insert. D-02a: NO fallback to
   legacy `leads`/`lead_calls`. D-02b: on `RecordOutcomeError`, log call_id
   + tenant_id and continue — do NOT re-raise or insert into legacy schema.
   2026-06-10: the RPC `.execute()` inside `record_outcome()` now runs via
   `asyncio.to_thread` — it was the only synchronous DB call left, and when
   `capture_lead` invoked it mid-call it blocked the audio loop.
   `caller_name`/`job_type` extraction now happens OUTSIDE the `call_uuid`
   gate (booked_caller_name preferred over the regex fallback) so step 7 can
   use them even when the calls-row insert or the RPC failed.
7. **Owner notifications (moved up + decoupled, 2026-06-10)** — run
   IMMEDIATELY after triage + the record_outcome attempt, BEFORE the slower
   optional steps (suggested slots, hallucination detection), so the 8s
   post-call budget can never starve the owner alert. Notifications **no
   longer require the `record_call_outcome` RPC to have succeeded** — they
   fire whenever tenant info exists. The `lead` dict only enriches the
   message; when it is None the notify dict degrades to call metadata
   (caller-ID + transcript-derived name/job, no CRM ids/address) and the
   log line carries `degraded=true` — a transient DB error can never
   silently drop an EMERGENCY alert. The notify dict now also carries
   `urgency` (`send_owner_email` reads urgency off the lead dict —
   previously absent, so emergency emails rendered "routine"). Uses the
   in-memory `booking_outcome` instead of re-querying the calls row.
   SMS/email per outcome preferences; emergency always sends both.
   `send_owner_sms(from_number=to_number)` (Phase 46 per-tenant from-number
   fix; `TWILIO_FROM_NUMBER` retained only as dev fallback).
   **M16 P1 (2026-06-20):** `run_post_call_pipeline` extracts
   `params.get("service_area")` (the `agent.py` post-call dict now passes
   `"service_area": deps.get("_service_area")`) → `is_out_of_area`, sets
   `notify_lead["out_of_area"]`, and passes `out_of_area=is_out_of_area` to
   `send_owner_sms`. `send_owner_sms` (signature gained `out_of_area: bool =
   False`) appends "(OUTSIDE your area — confirm reachability)" to the SMS body;
   `send_owner_email` reads `lead.get("out_of_area")` and inserts a highlighted
   red warning block before the dashboard link. Tests:
   `tests/test_notifications_out_of_area.py`.
   **LK-B2 (2026-06-21) — per-send timeout + durable outbox:** notifications.py
   was split into PURE builders (`build_owner_sms_body` / `build_owner_email_content`)
   + low-level RAISING senders (`send_owner_sms_body` / `send_owner_email_content`);
   the legacy `send_owner_sms`/`send_owner_email` wrappers still swallow→None for
   external callers (out-of-area test unaffected). §7 now renders the body, then
   sends each channel under `asyncio.wait_for(..., OWNER_NOTIFY_TIMEOUT_S=3.0)`; on
   timeout/failure `_enqueue_owner_notification_failure` upserts a durable row
   (best-effort/fail-open) into the main-repo `owner_notification_failures` table
   (migration 076), keyed `notification_key='{call_id}:{channel}'` so SMS+email
   retry independently. The main-repo cron `/api/cron/retry-owner-notifications`
   (every 5 min) re-sends the stored payload and deletes on success. At-least-once
   (no Stripe-style provider dedupe) → a rare duplicate alert is acceptable vs a miss.
7.5. **Deferred Stripe overage meter POST (LK-B2, 2026-06-21)** — runs AFTER §7
   so a slow Stripe call can never starve the owner alert. If `overage_customer_id`
   (set in §4), posts `billing.meter_events.create` (`identifier=overage_{call_id}`)
   capped at **3s** via `asyncio.wait_for`; on failure upserts an outbox row (on
   `call_id`) into `stripe_meter_failures` (migration 071) for
   `/api/cron/retry-meter-events` to re-post with the same idempotent identifier
   (Stripe dedupes by identifier → no double-bill). Replay is otherwise impossible
   (`increment_calls_used` already consumed the call_id).
8. Suggested slots — unbooked calls get up to 3 slots across next 3 days.
   2026-06-10: the `calendar_events` fetch in
   `_calculate_suggested_slots` now selects `is_all_day` (feeds the
   all-day busy expansion in `slot_calculator`).
9. Update call with triage + NULL fallback → `booking_outcome='not_attempted'`
   only where still NULL. (9b: silent hallucination detection follows.)

### Transcript field extraction fallback

`_extract_field_from_transcript(turns, field)` — regex ONLY when the
tool wasn't invoked. Name branch uses explicit trigger alternation +
post-match `name[0].isupper()` check + blocklist. Do not reintroduce
`[A-Z]` inside the capture group — keep the post-match guard.

---

# Phase 40: Call Routing Provisioning Cutover - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Switch Twilio phone number configuration from the current Elastic SIP Trunk direct routing to the new Railway webhook, implement the real routing logic, and update all existing tenant numbers. This is the architectural cutover phase.

Ships:

1. **Provisioning update** — `provisionPhoneNumber` in `src/app/api/stripe/webhook/route.js` sets `voice_url`, `voice_fallback_url`, and `sms_url` on newly purchased Twilio numbers pointing at the Railway webhook.
2. **Live routing logic** — `/twilio/incoming-call` replaces the hardcoded AI TwiML with `evaluate_schedule` + `check_outbound_cap` composition, returning correct TwiML for AI mode vs owner-pickup mode (parallel ring across up to 5 pickup numbers).
3. **Subscription gate** — Blocked tenants (canceled/paused/incomplete) are handled fail-open, routing to AI where the existing agent-side gate applies.
4. **Soft cap enforcement** — Cap-breach downgrades owner_pickup to AI and logs the event.
5. **Owner-pickup call records** — Minimal `calls` row with `routing_mode='owner_pickup'`, no post-call pipeline.
6. **Dial-status writeback** — `/twilio/dial-status` writes `outbound_dial_duration_sec` and `routing_mode` to the calls row.
7. **Dial-fallback** — `/twilio/dial-fallback` returns AI TwiML so unanswered owner calls fall back to the standard AI experience (same greeting, no fallback-aware behavior).
8. **SMS forwarding** — `/twilio/incoming-sms` forwards messages to `pickup_numbers` entries with `sms_forward=true`, logged to a new `sms_messages` table.
9. **Existing tenant update** — Directly update all existing tenant Twilio numbers to use webhook routing (no migration script — app is in development).

**Not in scope (Phase 41):** Dashboard UI at `/dashboard/more/call-routing`, `GET/PUT /api/call-routing` routes, routing mode badges on calls page, usage meter, onboarding checklist entry.

</domain>

<decisions>
## Implementation Decisions

### Webhook Routing Behavior

- **D-01:** Fail-open for all calls — blocked tenants (canceled/paused/incomplete) and unknown numbers (no tenant match) are routed to AI. This maintains behavior parity with the current SIP trunk setup where every call reaches the AI agent. The agent's existing subscription gate (`BLOCKED_STATUSES` in `src/agent.py:52`) handles blocked tenants after the AI session starts. No call is ever rejected or given a busy signal at the webhook layer.
- **D-02:** The incoming-call handler composition is: tenant lookup → subscription check (fail-open) → `evaluate_schedule` → `check_outbound_cap` (only if owner_pickup) → return appropriate TwiML. If any step fails, default to AI TwiML.
- **D-03:** For `owner_pickup` mode, the TwiML is `<Dial timeout="{dial_timeout_seconds}" callerId="{original_caller}" action="/twilio/dial-status"><Number>{pickup_number_1}</Number><Number>{pickup_number_2}</Number>...</Dial>`. All pickup numbers ring simultaneously (parallel ring). `callerId` is set to the original caller's number so the owner sees who's calling.
- **D-04:** The `action` URL on `<Dial>` points to `/twilio/dial-status` so Twilio fires the status callback when the dial completes (answered, no-answer, busy, failed). The `voice_fallback_url` on the Twilio number points to `/twilio/dial-fallback`.

### Fallback-to-AI Behavior

- **D-05:** When owner doesn't answer and dial-fallback fires, the AI receives a standard call — **same greeting as any AI call**. No fallback-aware greeting, no special context. The caller gets a consistent experience regardless of routing path. The `calls` row is updated with `routing_mode='fallback_to_ai'` by the dial-status handler.
- **D-06:** The dial-fallback endpoint returns `<Dial><Sip>{LIVEKIT_SIP_URI}</Sip></Dial>` — the same AI TwiML as the direct AI path.

### Owner-Pickup Call Lifecycle

- **D-07:** Owner-pickup calls get a minimal `calls` row: `tenant_id`, `from_number` (caller), `to_number` (Twilio number), `routing_mode='owner_pickup'`, `created_at`. No transcript, no recording, no triage, no lead creation, no notifications.
- **D-08:** `increment_calls_used` does NOT fire for owner-pickup calls — they don't count toward the AI quota.
- **D-09:** The dial-status callback writes `outbound_dial_duration_sec` to the calls row for cost tracking and dashboard display.
- **D-10:** The post-call pipeline (`run_post_call_pipeline`) does not run for owner-pickup calls. It only runs when the AI agent session closes.

### Soft Cap Enforcement

- **D-11:** When `check_outbound_cap` returns `False` (at/over cap), the webhook downgrades `owner_pickup` to AI and logs a cap-breach warning. The cap only gates the outbound dial leg — AI calls are always allowed regardless of cap status.
- **D-12:** Cap-breach events are logged via `logger.warning` with tenant_id and current usage. No dedicated cap-breach event table in Phase 40 — revisit if needed for billing visibility.

### SMS Forwarding

- **D-13:** When a customer texts the Twilio number, the webhook forwards the message text to every `pickup_numbers` entry where `sms_forward=true`. Format: `[Voco] From {original_sender}: {body}`.
- **D-14:** MMS is not forwarded — a `[Media attached - view in Twilio console]` note is appended instead. Forwarding only sends SMS via Twilio's Messages API.
- **D-15:** Forwarded messages are logged to a new `sms_messages` table (migration 045). Schema: `id`, `tenant_id`, `from_number`, `to_number`, `body`, `direction` ('inbound'|'forwarded'), `created_at`. One row for the inbound message, one row per forwarded copy.
- **D-16:** SMS forwarding failures are non-fatal per recipient — if forwarding to one number fails, others still proceed. Errors are logged but not surfaced to the original sender.

### Provisioning Update

- **D-17:** `provisionPhoneNumber` in `src/app/api/stripe/webhook/route.js` is updated to set `voice_url`, `voice_fallback_url`, and `sms_url` on newly purchased Twilio numbers pointing at the Railway webhook URL. SIP trunk association is kept intact as a rollback safety net — Twilio prioritizes `voice_url` over SIP trunk for inbound routing, so if `voice_url` is cleared, SIP trunk routing automatically resumes.
- **D-18:** For US/CA numbers (purchased via Twilio API), set the URLs at purchase time via `client.incomingPhoneNumbers.create({ ..., voiceUrl, voiceFallbackUrl, smsUrl })`. For SG numbers (pre-purchased inventory), update the number's configuration after assignment via `client.incomingPhoneNumbers(numberSid).update({ voiceUrl, voiceFallbackUrl, smsUrl })`.
- **D-19:** The webhook URL is constructed from a `RAILWAY_WEBHOOK_URL` env var (e.g., `https://livekit-agent-production.up.railway.app`). Paths: `voice_url` = `{base}/twilio/incoming-call`, `voice_fallback_url` = `{base}/twilio/dial-fallback`, `sms_url` = `{base}/twilio/incoming-sms`.

### Existing Tenant Number Update

- **D-20:** No migration script or gradual rollout — the app is in development. Directly update all existing tenant Twilio numbers to use webhook routing. This can be a simple script or admin endpoint that iterates tenants with `phone_number IS NOT NULL`, looks up each number's SID from Twilio, and sets `voice_url`/`voice_fallback_url`/`sms_url`.
- **D-21:** SIP trunk associations are preserved (not removed) as a rollback safety net. If webhook routing needs to be disabled for any reason, clearing `voice_url` on the Twilio number restores SIP trunk routing.

### Calls Row Insert Timing

- **D-22:** The webhook inserts the `calls` row (for owner-pickup calls) BEFORE returning the TwiML to Twilio. This ensures the row exists before the dial-status callback fires. The row is created with `routing_mode='owner_pickup'`, `tenant_id`, `from_number`, `to_number`, `created_at`. The dial-status callback updates the same row with `outbound_dial_duration_sec`.
- **D-23:** For AI-mode calls, the webhook does NOT insert a calls row — the AI agent creates its own call record as it does today (using `ctx.room.name` as the call ID). No change to the existing AI call lifecycle.

### Claude's Discretion

- How the calls row is identified by the dial-status callback (e.g., by Twilio's CallSid passed through, or by from_number + to_number + timestamp window)
- Whether the existing-tenant update is a standalone Python script, a Node.js script, or an admin API endpoint
- Exact `sms_messages` table indexes
- Whether the subscription check in the webhook is a direct Supabase query or imports from a shared module
- Test organization for new Phase 40 tests (extend existing `tests/webhook/` or add new files)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### LiveKit Agent Repo (`C:/Users/leheh/.Projects/livekit-agent/`)
- `src/webhook/twilio_routes.py` — Phase 39's hardcoded handlers. Phase 40 replaces `incoming_call()` with live routing, fills in `dial_status()`, `dial_fallback()`, `incoming_sms()`.
- `src/webhook/schedule.py` — `evaluate_schedule()` and `ScheduleDecision` dataclass. Called by the incoming-call handler.
- `src/webhook/caps.py` — `check_outbound_cap()`. Called when schedule returns `owner_pickup`.
- `src/webhook/security.py` — `verify_twilio_signature` dependency. Already applied at router level, no changes needed.
- `src/webhook/app.py` — FastAPI app. May need new routes or middleware for the calls row insert.
- `src/lib/phone.py` — `_normalize_phone()`. Used by the incoming-call handler.
- `src/agent.py` lines 50-54 — `BLOCKED_STATUSES` constant. Webhook subscription check should use the same list.
- `src/supabase_client.py` — `get_supabase_admin()` singleton. Used for DB queries in webhook handlers.
- `pyproject.toml` — Dependencies. May need additions for SMS sending (twilio SDK already present).
- `tests/webhook/` — Existing test infrastructure (35 tests). Phase 40 extends with new tests.

### Main Repo (`C:/Users/leheh/.Projects/homeservice_agent/`)
- `src/app/api/stripe/webhook/route.js` lines 34-109 — `provisionPhoneNumber()`. Phase 40 modifies this to set `voice_url`/`voice_fallback_url`/`sms_url`.
- `supabase/migrations/042_call_routing_schema.sql` — Phase 39 migration. Phase 40 adds migration 043 for `sms_messages` table.
- `.claude/skills/voice-call-architecture/SKILL.md` — Must be updated after Phase 40 to reflect live routing behavior.

### Phase 39 Context
- `.planning/phases/39-call-routing-webhook-foundation/39-CONTEXT.md` — All Phase 39 decisions (D-01 through D-20). Phase 40 builds directly on these.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`evaluate_schedule()`** in `src/webhook/schedule.py` — Pure function, 17 tests. Ready for live composition.
- **`check_outbound_cap()`** in `src/webhook/caps.py` — Async function, 8 tests. Ready for live composition.
- **`_normalize_phone()`** in `src/lib/phone.py` — Already used by incoming-call handler.
- **`get_supabase_admin()`** in `src/supabase_client.py` — Singleton client for all DB operations.
- **`BLOCKED_STATUSES`** in `src/agent.py:52` — `["canceled", "paused", "incomplete"]`. Reuse in webhook subscription check.
- **`_ai_sip_twiml()`** in `src/webhook/twilio_routes.py:40` — Existing AI TwiML builder. Reuse for AI mode and fallback paths.
- **`_xml_response()`** in `src/webhook/twilio_routes.py:59` — TwiML response helper.
- **`getTwilioClient()`** in `src/lib/notifications.js` — Twilio client for the main repo. Used by SMS forwarding in the Python repo via the twilio SDK directly.

### Established Patterns
- **`asyncio.to_thread` for sync DB calls** — All Supabase operations in webhook handlers wrapped in `asyncio.to_thread()`.
- **Lazy imports inside handlers** — `from src.supabase_client import get_supabase_admin` imported inside the handler function (Phase 39 pattern for testability).
- **Fail-open error handling** — Phase 39's tenant lookup catches exceptions and returns AI TwiML anyway.
- **Router-level signature dependency** — All `/twilio/*` endpoints are signature-gated.

### Integration Points
- **`provisionPhoneNumber()` in stripe webhook** — Add `voiceUrl`, `voiceFallbackUrl`, `smsUrl` to Twilio API calls.
- **`RAILWAY_WEBHOOK_URL` env var** — New env var needed in main repo (Vercel) for provisioning to know the webhook base URL.
- **`src/webhook/twilio_routes.py`** — Primary file modified: replace 4 stub handlers with live logic.
- **New migration `043_sms_messages.sql`** — `sms_messages` table for SMS forwarding audit log.

</code_context>

<specifics>
## Specific Ideas

- **Same AI greeting for all paths** — Whether a call goes directly to AI or falls back after owner no-answer, the caller gets the identical greeting. No fallback-aware behavior. Simple and consistent.
- **No migration ceremony** — App is in development. Update existing tenant numbers directly. No dry-run/gradual rollout/migration script complexity.
- **SIP trunk as rollback safety net** — Keep SIP trunk associations intact. Twilio prioritizes `voice_url` over SIP trunk, so clearing `voice_url` instantly restores SIP trunk routing. Belt-and-suspenders reliability.
- **Owner-pickup calls are lightweight** — Minimal row, no AI pipeline. The owner talked to the customer directly — they don't need triage, transcripts, or notifications for their own conversation.

</specifics>

<deferred>
## Deferred Ideas

- **Fallback-aware AI greeting** — Considered and explicitly rejected (D-05). All AI calls get the same greeting regardless of routing path.
- **Cap-breach event table** — Warning log only in Phase 40 (D-12). Revisit if billing visibility needs improve.
- **MMS forwarding** — Only SMS text forwarded; MMS gets a `[Media attached]` note (D-14). Full MMS forwarding could be a future enhancement.
- **Per-recipient SMS forwarding retry** — Failures are logged but not retried (D-16). Retry logic deferred.
- **Dashboard UI, routing mode badges, usage meter** — Phase 41.

</deferred>

---

*Phase: 40-call-routing-provisioning-cutover*
*Context gathered: 2026-04-11*

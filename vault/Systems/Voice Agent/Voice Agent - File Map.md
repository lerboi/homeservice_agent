---
type: system
system: Voice Agent
status: current
description: "Which files implement Voice Agent and what each one is responsible for. Covers: Agent Repo (`lerboi/livekit_agent`, deployed to Railway); Main Repo (`homeservice_agent`, deployed to Vercel)"
source: .claude/skills/voice-call-architecture/SKILL.md § File Map
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# File Map

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

### Agent Repo (`lerboi/livekit_agent`, deployed to Railway)

| File | Role |
|------|------|
| `src/agent.py` | Entrypoint: tenant lookup, Phase 66 cascade session (Deepgram STT + Silero VAD + MultilingualModel + gpt-4.1-mini + ElevenLabs TTS), deterministic `session.say()` greeting, call-duration watchdog (2026-06-10), Egress, post-call trigger. Phase 58: `fetch_customer_context_with_fanout_telemetry` wrapper. Phase 59: `_persist_call_outcome()` calls `record_call_outcome` RPC (D-14) |
| `src/prompt.py` | System prompt builder — modular section builders, Phase 60 STATE+DIRECTIVE format. **Single-language ENGLISH prompt (2026-06-11 collapse)** — `locale` selects only the LANGUAGE section's tenant-default-language line |
| `src/post_call.py` | Post-call pipeline — triage, notifications, booking reconciliation. **Phase 59:** step 9 replaced `create_or_merge_lead()` with `record_outcome()` RPC call |
| `src/lib/write_outcome.py` | Phase 59 D-14: `record_outcome()` async helper — normalizes phone, calls `record_call_outcome` RPC, raises `RecordOutcomeError`; D-02a (no dual-write), D-02b (forward-fix only). 2026-06-10: the RPC `.execute()` now runs via `asyncio.to_thread` (was the only sync DB call — blocked the audio loop when invoked mid-call from capture_lead). (Path corrected — `src/post_call/` package never landed; post_call is the single module `src/post_call.py`) |
| `src/supabase_client.py` | Singleton service-role Supabase client. **2026-09-04 P1.10:** built on a keep-alive `httpx.Client` (HTTP/2, 10 s request cap, `keepalive_expiry=None`) via `SyncClientOptions(httpx_client=…)`; `warm_supabase_connection()` is the never-raising prewarm ping. `VOCO_SUPABASE_KEEPALIVE=false` restores plain `create_client()` |
| `src/utils.py` | Date/speech formatting helpers (`format_slot_for_speech`, `to_local_date_string`, `format_zone_pair_buffers`). 2026-08-20: `calculate_initial_slots` deleted — dead code, zero callers (Node-era `handleInbound` leftover) |
| `src/webhook/__init__.py` | Webhook subpackage + `start_webhook_server` daemon thread |
| `src/webhook/app.py` | FastAPI app — `GET /health`, `GET /health/db`, mounts `/twilio/*` router |
| `src/webhook/twilio_routes.py` | 4 signature-gated POST endpoints + `_is_vip_caller` priority caller check. 2026-06-12: tenants query filters the subscriptions embed with `.eq("subscriptions.is_current", True)` (previously read an arbitrary history row) and gates via shared `is_subscription_blocked` |
| `src/webhook/security.py` | `verify_twilio_signature` FastAPI dep + URL reconstruction from proxy headers. 2026-06-12 fail-closed: empty `TWILIO_AUTH_TOKEN` → 503; `ALLOW_UNSIGNED_WEBHOOKS` ignored when `PYTHON_ENV` is production or unset |
| `src/lib/subscription_gate.py` | NEW 2026-06-12 (audit H1): shared `is_subscription_blocked(status, current_period_end)` + `BLOCKED_STATUSES` — single source of truth for call blocking (canceled/paused/incomplete always; past_due after 3-day grace anchored to `current_period_end`). Used by `agent.py` + `twilio_routes.py`; mirrors the main repo's `subscription-gate.js` semantics |
| `src/webhook/schedule.py` | Pure-function `evaluate_schedule()` + frozen `ScheduleDecision` dataclass |
| `src/webhook/caps.py` | Async `check_outbound_cap()` — monthly outbound-minute cap |
| `src/lib/phone.py` | `_normalize_phone()` module-level helper |
| `src/lib/background.py` | NEW 2026-08-19: `create_background_task()` — strong-reference holder for fire-and-forget asyncio tasks (asyncio keeps only weak refs; a GC'd task silently drops the work). Used by agent.py, end_call.py, book_appointment.py |
| `src/lib/telemetry.py` | Phase 58: `emit_integration_fetch` + `emit_integration_fetch_fanout` helpers (see `integrations-jobber-xero` skill) |
| `src/tools/__init__.py` | Tool registry — conditional registration based on onboarding |
| `src/tools/book_appointment.py` | Atomic slot booking (slot_token-resolved) + address validation + calendar sync + SMS. (Phase 65: the Gemini-era `mute_input_during_tool` / `_last_tool_state` cascade-recovery plumbing was removed — gpt-realtime-2 async function calling makes it unnecessary.) |
| `src/tools/check_slot.py` | Verify a specific (date, time) is bookable; registers a `slot_token`. (Replaces the date+time branch of the former monolithic `check_availability`.) |
| `src/tools/check_day.py` | List open slots for a whole day; registers `slot_token`s. (Former day-listing branch of `check_availability`.) **2026-09-04 P1.2:** pops `deps["_last_offered_token"]` on entry so a stale check_slot offer can never be booked by book_appointment's recovery branch after the caller switched days |
| `src/tools/next_available_days.py` | Find the next N days with any availability; registers `slot_token`s. (Former next-available branch of `check_availability`.) |
| `src/tools/capture_lead.py` | Mid-call lead capture on decline. M16 P1 (2026-06-20): re-classifies the service area from its own `validation_result` and stamps `inquiries.out_of_area=true` when out of area (best-effort follow-up UPDATE) |
| `src/tools/validate_address.py` | Early mid-call address validation (2026-06-10) — wraps `validate_address_bounded`, caches result on `deps["_validated_address"]`, exports `get_cached_validation` reused by book_appointment/capture_lead. Always-on. M16 P1 (2026-06-20): runs the Service-Area gate (`classify_service_area`) on a confirmed address → `deps["_service_area"]`, overrides to `STATE:address_out_of_area` when out of area. **2026-09-04:** P1.3 code-level address-loop cap (`_validate_attempts`; 2nd unconfirmed same street / 3rd in call → `address_noted`) + P1.4 Singapore postal-first via `onemap.lookup_postal` ahead of Google (`VOCO_SG_ONEMAP`); tool description no longer quotes a literal filler |
| `src/tools/check_caller_history.py` | Silent context repeat-caller lookup |
| `src/tools/check_customer_account.py` | Re-serve pre-session Xero/Jobber context |
| `src/tools/transfer_call.py` | SIP REFER transfer to owner phone |
| `src/tools/end_call.py` | Graceful SIP participant disconnect |
| `src/integrations/xero.py` | Xero adapter (Python) — see `integrations-jobber-xero` skill |
| `src/integrations/jobber.py` | Jobber adapter (Python) — see `integrations-jobber-xero` skill |
| `src/integrations/onemap.py` | NEW 2026-09-04 (P1.4): Singapore Land Authority OneMap postal-code lookup — `lookup_postal(postal)` → first result dict (`BLK_NO`, `ROAD_NAME`, `BUILDING`, `POSTAL`, lat/lng) or None; 6-digit guard, per-call `httpx.AsyncClient`, 1.5 s, never raises, no auth |
| `src/lib/booking.py` | Atomic slot booking via Supabase RPC |
| `src/lib/slot_calculator.py` | Available slot calculation — 2026-06-10: `_all_day_busy_bounds()` expands `is_all_day` busy rows to tenant-local day bounds. **M16 P2 (2026-06-20):** adjacency is now **forward + backward**, and the default buffer is the owner-set `tenants.travel_buffer_mins` (migration 075) passed in via the `travel_buffer_mins` kwarg (default 30, 0 disables) — NOT a hardcoded 30. The coordinate/drive-time "Capability B" stays deferred (not built). |
| `src/lib/service_area.py` | NEW M16 P1 (2026-06-20): pure `classify_service_area(*, zones, postal_code, locality)` → `{verdict, matched_on}`. Unions `postal_codes[]` + `cities[]` across the tenant's `service_zones` rows (normalized; CA/UK postal spaces ignored); biased HARD to false-ACCEPT — only `out_of_area` with a coverage list AND a non-matching trusted postal/town signal; empty coverage → `unconfigured` (gate off). No DB/network — fed `zones = deps["_slot_cache"]["service_zones"]` |
| `src/lib/leads.py` | Lead creation/merge logic — **Phase 59:** `create_or_merge_lead()` replaced by `record_outcome()` in post-call step 9; file retained until Plan 08 drops legacy `leads` table |
| `src/lib/notifications.py` | SMS (Twilio) + Email (Resend) dispatch. M16 P1 (2026-06-20): `send_owner_sms(out_of_area=…)` appends an out-of-area SMS suffix; `send_owner_email` reads `lead.out_of_area` and renders a red out-of-area warning block |
| `src/lib/google_calendar.py` | Google Calendar push (`_to_naive_local_iso` helper shared with the Outlook push) |
| `src/lib/outlook_calendar.py` | Outlook Calendar push — 2026-06-10: start/end sent as **naive tenant-local ISO** via `google_calendar._to_naive_local_iso` with `timeZone` authoritative; Graph ignores the UTC offset in `dateTime` when `timeZone` is set, so the raw offset-suffixed ISO double-shifted events (e.g. +8h for SG) |
| `src/lib/whisper_message.py` | Whisper message for warm transfers |
| `src/lib/triage/classifier.py` | Three-layer triage orchestrator |
| `src/lib/triage/layer1_keywords.py` | Regex urgency detection |
| `src/lib/triage/layer2_llm.py` | LLM urgency classification — **OpenAI `gpt-4.1-nano` since 2026-09-04 (P1.1)** on `OPENAI_API_KEY`; was Groq/Llama 4 Scout (retired by Groq 2026-07-17; silent routine/low fallback since) |
| `src/lib/triage/layer3_rules.py` | Owner service-tag escalation — transcript word-boundary matches `services.name` to find the call's service, raises urgency to its `urgency_tag` only on a genuine match (prod-readiness 2026-06: now actually wired; previously inert) |
| `src/messages/en.json`, `src/messages/es.json` | Agent utterances + notification templates. **2026-09-04 P1.9:** greetings cut to one clause each (disclosure kept), ES `agent.*` strings carry diacritics/inverted punctuation, `recovery_error` reworded (no 'take your details' promise) |
| `pyproject.toml`, `Dockerfile`, `livekit.toml`, `sip-*.json` | Build + deploy config |
| `docs/PLAN-2026-09-02-phase0-phase1.md`, `docs/INFRA-REGIONS.md` | 2026-09-02 execution brief for Phase 0+1 of the call-experience plan (verified anchors, pinned test literals, decisions) + P0.3 region record (Supabase Tokyo verified; Railway/LiveKit regions TO-FILL) |

### Main Repo (`homeservice_agent`, deployed to Vercel)

| File | Role |
|------|------|
| `src/app/api/stripe/webhook/route.js` | Phone provisioning (Twilio purchase / SG inventory) + `configureNumberRouting` (set webhook voice/SMS URLs + remove from SIP trunk; trunk-only fallback when `RAILWAY_WEBHOOK_URL` unset) |
| `scripts/cutover-existing-numbers.js` | One-time migration of existing tenant numbers to webhook routing (sets URLs + disassociates the trunk) |
| `src/app/api/onboarding/test-call/route.js` | LiveKit SIP outbound test-call trigger (room `test-call-<tenantId>-<ts>`; sets `tenants.test_call_status='calling'`) |
| `src/app/api/webhooks/livekit/route.js` | LiveKit webhook (`WebhookReceiver` signature verify). On `participant_joined` for a `test-call-*` room by the owner's SIP leg (`caller-*` identity / kind SIP), sets `test_call_completed=true` + `test_call_status='connected'` + `test_call_last_at`. **Must be registered in the LiveKit project** (Cloud: Settings→Webhooks; self-hosted: `webhook.urls`) → `https://<domain>/api/webhooks/livekit` |
| `src/lib/subscription-gate.js` | JS reference gate — live enforcement moved to the agent repo's shared `src/lib/subscription_gate.py` (2026-06-12), which also blocks past_due after the 3-day grace |
| `src/app/api/cron/send-recovery-sms/route.js` | Recovery SMS cron |
| `src/app/api/notification-settings/route.js` | GET/PATCH `notification_preferences` JSONB |

---

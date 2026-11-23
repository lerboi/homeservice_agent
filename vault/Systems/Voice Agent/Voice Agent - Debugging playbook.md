---
type: system
system: Voice Agent
status: current
description: "Symptoms, likely causes and where to look when Voice Agent misbehaves."
source: .claude/skills/voice-call-architecture/SKILL.md § 13. Debugging playbook
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# Debugging playbook

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

> (rows referencing `generate_reply`, SemanticVad, `AudioTranscription`, or
> OpenAI voices/migration 067 are stale — superseded by the Phase 66 cascade,
> see agent.py. Greeting issues now trace to `session.say()` + the input-mute
> block; voice issues to `ELEVENLABS_VOICE_MAP` / ElevenLabs "My Voices".)

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Greeting never plays / agent silent until caller speaks | `generate_reply` greeting failed, or model id rejected at handshake | Check `[agent] greeting generate_reply failed` log; verify `OPENAI_REALTIME_MODEL` + `OPENAI_API_KEY` (model 404s on the first call if invalid) |
| Greeting cuts off mid-sentence | SIP echo/noise tripping server VAD during the opening | Confirm the greeting input-mute is intact: `set_audio_enabled(False)` before `generate_reply` + `wait_for_playout()` unmute (agent `1a300d2`) |
| `Invalid value: 'Zephyr'` / session error on every call for a tenant | stale Gemini `ai_voice` + migration 067 not applied to prod | Apply migrations 067 + **070** (070 is the current label CHECK — professional/friendly/local_expert); the `_resolve_voice` guard (agent `35238f7`) already falls back to the tone default |
| Empty/garbled post-call transcript or degraded triage | `input_audio_transcription` not a typed `AudioTranscription` | Confirm `AudioTranscription(model="gpt-4o-mini-transcribe")` is passed (a plain dict is silently dropped) |
| Over- or under-eager turn-taking on SIP | `SemanticVad` eagerness mismatch | Try the `ServerVad(...)` fixed-timer fallback (migration §7.5) |
| Post-call pipeline never runs | `close_complete` event missing | Check `entrypoint` awaits event + `done_callback` sets it |
| Every unclear call triaged `routine / low` | Layer-2 classifier failing silently (was the Groq model retirement, 2026-07 → 2026-09) | Check Railway for `[triage] layer2 failed` / `layer2 timeout` (a healthy call logs `[triage] layer2 ok … elapsed_ms=`); the fallback dict is `reason="timeout or error"`. Since P1.1 it runs on OpenAI `gpt-4.1-nano` — verify `OPENAI_API_KEY`, confirm `VOCO_TRIAGE_LAYER2_WARM` is on, and only then consider raising `VOCO_TRIAGE_LAYER2_TIMEOUT_S` |
| Agent confirms one day aloud but the appointment lands on the previous day | Stale `_last_offered_token` reused by book_appointment's malformed-token recovery | Fixed 2026-09-04 P1.2 — `check_day` clears the key on entry. If it recurs, look for a new tool path that offers times without touching `_last_offered_token` |
| Agent re-asks the same address piece 3+ times | Address loop uncapped | Since P1.3 the tool returns `address_noted` on the 2nd unconfirmed for the same street / 3rd in the call — grep `[validate_address] unconfirmed cap reached`; if absent, the model is calling with a different `street` string each time AND fewer than 3 attempts |
| SG address never resolves though the caller gave a postal code | OneMap not consulted | grep `[validate_address] onemap hit`; confirm `tenants.country == 'SG'`, the postal arrived as 6 digits in the tool args, and `VOCO_SG_ONEMAP` is not `false` |
| First tool query of a call is ~300 ms slower than later ones | Supabase TLS re-handshake (Tokyo) | P1.10: confirm `[agent] prewarm: supabase connection warmed` appears in the job-process logs and `VOCO_SUPABASE_KEEPALIVE` is not `false` |
| 2–5 s of dead air before the greeting on a fresh call | No warm job process | P1.11: check for "no warmed process available for job"; raise `VOCO_NUM_IDLE_PROCESSES` |
| Greeting starts 6-7 s after the agent joins, in the OpenAI voice; `greeting playout wait timed out at 10.0s` warnings | `ELEVEN_API_KEY` is the ElevenLabs key ID, not the `sk_` secret (or the key was rotated) — the FallbackAdapter burns ~5 s retrying ElevenLabs before OpenAI TTS | grep `[agent] ELEVEN_API_KEY rejected` (prewarm) / `ElevenLabs key rejected at prewarm` (per call); paste the `sk_…` secret into Railway `ELEVEN_API_KEY`. Since 2026-09-04 the preflight already routes such calls straight to OpenAI TTS (greeting ~2.8 s) |
| Admin test console: "Microphone access was denied" and the browser offers no way to allow it | `Permissions-Policy` header disables the microphone for the origin (`next.config.js` `headers()` sent `microphone=()` from 2026-06-03 until 2026-09-05) — getUserMedia rejects with NotAllowedError, identical to a user denial | Keep `microphone=(self)` in `next.config.js` (camera/geolocation stay `()`); the console also checks `document.permissionsPolicy.allowsFeature('microphone')` and names a policy block. Verify with `curl -sD - https://www.voco.live/admin/test-agent \| grep -i permissions-policy` |
| Web test call ends by itself / "immediately stops" in the admin console | The console flips to *ended* on `RoomEvent.Disconnected`; the SDK deletes the room whenever the AgentSession closes (`RoomInputOptions.delete_room_on_close` default) — so any early session close (error recovery after 3 errors, no-input net after 2 strikes, watchdog) or a deploy-window dispatch with no registered worker looks the same from the browser | Check `calls` for the room (`test-web-…`): no row = the agent never reached `_run_db_queries` (never joined / died pre-session); a row with `disconnection_reason` tells which net fired. Reproduce without a browser via the LiveKit API (create room with the session route's metadata, join a participant, `create_dispatch`) — the 2026-09-04 scratch scripts did exactly this and the deployed agent passed |
| Admin says "I can't talk" / the test call greets then ends with `disconnection_reason='no_input'` and `transcript_structured` has 0 user turns | The console captured a **silent or wrong microphone** — `getUserMedia` succeeded but the OS-default device produces no audio (a virtual/streaming capture device, a muted mic). The agent greets, hears nothing, runs the no-input net, and ends. The `calls` row exists and the recording has agent audio but no caller audio | Fixed 2026-09-05 (`page.js`): the setup card has a **mic device picker + live level meter + silent-device probe**, and the in-call card shows the live input meter ("your mic → agent"). Tell the admin: pick the right device under "4. Microphone", confirm the green bar moves when they speak. A flat bar = that device is what the agent hears (nothing). Confirm via the room-composite recording (`ffprobe`/RMS: caller channel flat = silent mic, not a pipeline fault) |
| Need per-stage latency for a call | — | grep `[agent] turn_metrics call=<id>` (eot_delay = endpointing wait, llm_ttft, tts_ttfb) and `[agent] llm_metrics` (cached_tokens); gaps from `transcript_structured[].timestamp` via the SQL in the Phase 0+1 brief |
| Recording missing | `recording_storage_path` not written at egress start | Check egress start awaits `db_task` |
| Test call not auto-cancelled | Booking-reconciliation backfill missed | Verify `booked_appointment_id` forwarded from `deps` |
| Webhook 403 on every request | Signature verification failing | Check `TWILIO_AUTH_TOKEN` env; confirm `proxy_headers=True` on uvicorn |
| Webhook 503 on every request | `TWILIO_AUTH_TOKEN` empty/missing (2026-06-12 fail-closed) | Set the token on Railway — empty-key HMAC validation would accept forgeries, so the dep rejects instead |
| Agent container exits at boot with `Missing required env vars` | Boot preflight (2026-06-12) — `OPENAI_API_KEY` / `DEEPGRAM_API_KEY` / `ELEVEN_API_KEY` unset | Set the missing keys on Railway; this is intentional (previously every call connected then died silently) |
| Every call crashes at `MultilingualModel()` with `Could not find file "languages.json"` | Turn-detector model files not baked into the image — `download-files` was skipped during the Docker build | Fixed 2026-06-26 by gating the `__main__` preflight/webhook to `start`/`dev` so build-time `download-files` reaches `cli.run_app()`, + removing `\|\| true` from the Dockerfile. If it recurs, confirm the build log shows the model actually downloading and that no `HF_HOME`/volume diverts the cache path between build and runtime |
| VIP caller routing to AI | Missing `pickup_numbers` OR `is_vip=false` | Check `tenants.vip_numbers` JSONB + `leads.is_vip` + `pickup_numbers` populated |
| `customer_context` empty despite connected Xero | `error_state` set on row OR 2.5s timeout | Check `accounting_credentials.error_state`; query `activity_log WHERE event_type='integration_fetch'` |
| No `integration_fetch_fanout` rows in activity_log | Railway not redeployed after Phase 58 | Sync Voco worktree → sibling repo → GitHub → Railway |
| Goodbye cut off before "Thank you for calling" completes | #5096-class race (mid-word truncation) — diagnosed Phase 60.3 Stream A | Check `[goodbye_race]` log: `text_done=false` + mid-call `_SegmentSynchronizerImpl` warnings → Phase 60.3 Branch P CRITICAL RULE is live; if still reproducing, re-evaluate Branch G (`wait_for_playout` pre-guard in `end_call.py`) |
| Goodbye completes but agent never invokes `end_call` (16+ s idle, caller manually hangs up) | Phase 60.3 cumulative UAT regression — Branch P "separate turn with no additional speech" over-corrected | Check `[goodbye_race]` log for `last_text_token_at` → `end_call_invoked_at` delta > 2s with complete farewell in `transcript_tail`; tracked for Phase 60.4 call-teardown follow-up |

---

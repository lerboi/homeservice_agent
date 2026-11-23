---
type: system
system: Voice Agent
status: current
description: "Environment variables Voice Agent reads, and where they are set. Covers: Agent service (Railway); Main repo (Vercel)"
source: .claude/skills/voice-call-architecture/SKILL.md § 11. Environment Variables
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# Environment Variables

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

### Agent service (Railway)

| Variable | Purpose |
|---|---|
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | LiveKit Cloud auth |
| `OPENAI_API_KEY` | gpt-4.1-mini LLM (Phase 66 cascade; was gpt-realtime-2). **Required at boot** — the `__main__` preflight refuses to start without it |
| `DEEPGRAM_API_KEY` | Deepgram nova-3 STT (Phase 66) — pending on Railway at time of writing. **Required at boot** (preflight) |
| `ELEVEN_API_KEY` | ElevenLabs eleven_flash_v2_5 TTS (Phase 66). **Required at boot** (presence preflight). **Must be the `sk_…` secret, not the key ID** — 2026-09-04 found the key ID in use (ElevenLabs answers `api_key_id_used_as_api_key`); `prewarm()` now verifies it against `/v1/user` (`VOCO_TTS_KEY_PREFLIGHT`, default on) and builds calls on OpenAI TTS directly when rejected, logging `[agent] ELEVEN_API_KEY rejected by ElevenLabs …` |
| `VOCO_WRAP_UP_CALL_SECONDS`, `VOCO_MAX_CALL_SECONDS` | Call-duration watchdog overrides (defaults 540 / 600 — see §1) |
| `VOCO_PREEMPTIVE_GENERATION` | P8.1 (2026-06-12): `AgentSession(preemptive_generation=…)` — speculative LLM+TTS on interim transcripts. Default ON; set `false` to revert |
| `VOCO_LLM_CACHE_WARM`, `VOCO_LLM_CACHE_WARM_TIMEOUT_S` | 2026-09-01 prompt caching: background warm request during the greeting (default **on** / **6**s cap) that writes the call's exact system prompt + tool schemas into OpenAI's prompt cache so turn 1 reads a cached prefix instead of cold-prefilling ~9k tokens. `false` disables without a deploy. Cache hits are visible in the `[agent] llm_metrics … cached_tokens=` log lines (see §1 step 11) |
| `VOCO_MIN_ENDPOINTING_DELAY_S`, `VOCO_MAX_ENDPOINTING_DELAY_S` | **P1.5 (pending, 2026-09-04): set `VOCO_MAX_ENDPOINTING_DELAY_S=1.2` on Railway (1.4 if the agent talks over address reads); change the code default only after a few days without talk-over; never lower the min below 0.4.** 2026-08-25 latency pass: post-speech endpointing waits passed to `AgentSession` (defaults **0.4 / 2.0**; SDK defaults were 0.5 / 3.0 — the max applies whenever the semantic turn detector judges the caller unfinished, so it WAS up to 3s of pre-LLM dead air). Env-overridable for instant tuning/rollback |
| `VOCO_TTS_SPEED`, `VOCO_TTS_STABILITY`, `VOCO_TTS_SIMILARITY` | 2026-08-25 pace fix: explicit `elevenlabs.VoiceSettings` on the TTS (defaults **1.08 / 0.5 / 0.75**) — previously no voice_settings were passed, so pace was the voice recording's default cadence (read sluggish). `VOCO_TTS_SPEED=1.0` restores the old pace; construction fails open to the no-settings form. Same commit re-worded the `professional` tone label ("measured and formal" → "polished, warm, and efficient" — "measured" was a slow-delivery instruction in the prompt's first sentence) and de-paced the identity line ("never rush through" → "be clear on") |
| `VOCO_STT_KEYTERMS` | P8.2 (2026-06-12): Deepgram nova-3 `keyterm` prompting with business + service names. Default OFF (keyterm + `language="multi"` unverified against Deepgram's API — enable on a UAT deploy first) |
| `SUPABASE_S3_*` (4 vars) | Supabase Storage S3 |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | SMS auth (FROM is dev-fallback only) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Transactional email |
| `GROQ_API_KEY` | **Unused since 2026-09 (P1.1)** — layer-2 triage moved to OpenAI `gpt-4.1-nano` on `OPENAI_API_KEY`. Leave the Railway var in place for now; safe to delete later |
| `VOCO_TTS_KEY_PREFLIGHT` | 2026-09-04: per-job-process ElevenLabs key check in `prewarm()`; on an explicit auth rejection the call uses OpenAI TTS directly instead of paying ~5 s of FallbackAdapter retries on its first line. Default **on**; `false` restores the always-ElevenLabs-first construction |
| `VOCO_TRIAGE_LAYER2_WARM`, `VOCO_TRIAGE_LAYER2_TIMEOUT_S` | 2026-09-04 P1.1: background `warm_client()` at call start so the post-call gpt-4.1-nano classification is not a cold TLS handshake (default **on**), and the layer-2 `asyncio.wait_for` cap (default **2.5** s — raise only if Railway shows `[triage] layer2 timeout`) |
| `VOCO_SG_ONEMAP` | 2026-09-04 P1.4: Singapore postal-first address resolution via OneMap ahead of Google for SG tenants with a 6-digit postal. Default **on**; `false` restores the Google-only path |
| `VOCO_SUPABASE_KEEPALIVE`, `VOCO_SUPABASE_TIMEOUT_S`, `VOCO_SUPABASE_PREWARM` | 2026-09-04 P1.10: keep-alive HTTP/2 `httpx.Client` under the Supabase client (default **on**; request cap default **10** s — postgrest's own default is 120 s) + the `prewarm()` ping that opens the Tokyo TLS session per idle job process (default **on**). `false` on either restores the previous behaviour without a deploy |
| `VOCO_NUM_IDLE_PROCESSES` | 2026-09-04 P1.11: `WorkerOptions(num_idle_processes=…)`, default **2** (SDK default was `min(ceil(cpu), 4)`). Raise if Railway logs show "no warmed process available for job" |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Calendar OAuth |
| `STRIPE_SECRET_KEY` | Overage billing |
| `NEXT_PUBLIC_APP_URL` | Dashboard links in notifications |
| `SENTRY_DSN` | Error tracking |
| `ALLOW_UNSIGNED_WEBHOOKS` | Dev-only signature bypass — IGNORED when `PYTHON_ENV` is production or unset (2026-06-12) |
| `PYTHON_ENV` | Environment name; unset defaults to `production` (fail closed — gates the unsigned-webhook bypass + Sentry init) |
| `LIVEKIT_SIP_URI` | SIP URI in AI TwiML |
| `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET` | Xero OAuth (see integrations-jobber-xero) |
| `JOBBER_CLIENT_ID`, `JOBBER_CLIENT_SECRET` | Jobber OAuth + webhook HMAC key |

### Main repo (Vercel)

| Variable | Purpose |
|---|---|
| `RAILWAY_WEBHOOK_URL` | Base URL for `voice_url`, `voice_fallback_url`, `sms_url` on provisioned Twilio numbers |
| `XERO_WEBHOOK_KEY` | Xero webhook HMAC key (distinct from client_secret) |

---

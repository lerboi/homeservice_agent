# Voco — Full Audit of the Live-Call Path

**Date:** 2026-06-04
**Branch audited:** `fix/prod-readiness-2026-06` (both repos)
**Scope:** Every tool/feature involved in an actual inbound phone call, across both codebases:
- **livekit-agent** (`C:/Users/leheh/.Projects/livekit-agent`) — Python, `livekit-agents==1.5.7`, `gemini-3.1-flash-live-preview`, Railway.
- **homeservice_agent** (`C:/Users/leheh/.Projects/homeservice_agent`) — Next.js 16.2 / React 19.2 / Supabase dashboard.

**Method:** Seven specialist passes, each (a) researching the **official docs** of the tool it covers (LiveKit Agents SDK, Gemini Live API, Twilio, Google Calendar / Microsoft Graph, Google Address Validation, Groq, Stripe Billing Meters, Supabase Realtime) and (b) auditing the real code with `file:line` evidence. Each feature gets an **Approach verdict** (optimal / acceptable / suboptimal, with the better alternative) and severity-tagged findings.

> **How to read this.** This is a findings report only — **nothing here has been implemented.** Items already fixed in the `fix/prod-readiness-2026-06` work are deliberately excluded. A few findings depend on live infrastructure (Railway env vars, live Groq model availability, prod DB contents) that can't be confirmed from code alone — those are marked **VERIFY**. Each detailed section (1–7) follows the executive summary.

---

## Executive Summary

The call architecture is **fundamentally sound** — the Twilio→LiveKit→Gemini topology, the 3-layer atomic booking defense, the slot-token registry, the cascade mute/replay machinery, the verdict-driven address validation, and the post-call shutdown design are all well-reasoned and, in several cases, best-practice. The issues below are concentrated in three areas: **(1)** workarounds forced by Gemini 3.1's preview limitations that are now worth revisiting, **(2)** a cluster of **calendar-sync and token-persistence bugs that silently stop working in production**, and **(3)** an **outdated triage LLM** plus dead triage configuration.

> **Verification & fix status (updated 2026-06-04).** A follow-up deep-verification pass examined **C-2, C-3, H-1, H-3**:
> - **C-2 (Outlook day-3 death)** and **C-3 (slot-calculator timezone)** are **FALSE POSITIVES** — the original audit cited the wrong Graph subscription cap and mis-modeled `fromZonedTime` (empirically host-TZ-independent). Both downgraded below; neither causes the failure described.
> - **H-1 (token persistence)** and **H-3 (Layer-3 service detection)** were **confirmed real and FIXED** in commit `bc4467a` (livekit-agent, branch `fix/prod-readiness-2026-06`).
>
> The other Critical/High items below have **not** yet been independently verified — treat them as findings to confirm, especially the ones tagged **VERIFY** (live infra).

### Critical — silent production failures (fix first)

| ID | Finding | Where | § |
|----|---------|-------|---|
| C-1 | **Groq triage model `llama-4-scout-17b-16e-instruct` reportedly EOL'd 2026-04-15** — Layer-2 fails open to `routine/low` on every ambiguous call, collapsing the middle triage tier and mis-triaging keyword-less emergencies. **VERIFY** against Groq's live model list; migrate to a current slug (e.g. `openai/gpt-oss-120b`). | `layer2_llm.py:36` | 5 |
| ~~C-2~~ | ❌ **FALSE POSITIVE — verified 2026-06-04.** Graph's cap for the subscribed `/me/events` (Outlook *event*) resource is **7 days / 10,080 min** ([docs](https://learn.microsoft.com/en-us/graph/api/resources/subscription)) — exactly what the code requests; the ~4230-min cap is for *other* resources (callRecord, todoTask, …). The daily 24h-lookahead cron renews the 7-day subscription in time. **No day-3 death.** *Residual (Low/hygiene):* store Graph's returned `expirationDateTime` instead of the self-computed value. | `outlook-calendar.js:215,360` | 4 |
| ~~C-3~~ | ❌ **FALSE POSITIVE on the stated mechanism — verified 2026-06-04.** `fromZonedTime` reads the Date's wall-clock fields, so output is **host-TZ-independent** — empirically identical UTC across UTC / LA / Singapore / Kiribati hosts for all normal business hours (the existing tests pass on a non-UTC host). *Residual (near-zero):* a working-hour configured exactly inside a host-zone DST spring-forward gap on a non-UTC DST host; never on UTC prod. Trivial behavior-preserving hardening only. | `slot-calculator.js:24` | 4 |

### High — correctness, security, or revenue impact

| ID | Finding | Where | § |
|----|---------|-------|---|
| H-1 | ✅ **FIXED 2026-06-04 (commit `bc4467a`).** Confirmed real: `expiry_date` is BIGINT epoch-ms but the Python writers sent an ISO string (rejected text→bigint, swallowed) so agent refreshes never persisted. Now writes int epoch-ms **and** participates in the `try_acquire_oauth_refresh_lock` lease (mirrors `adapter.js` + migration 058), closing the Jobber single-use-rotation race the epoch-ms fix would otherwise activate. | `xero.py`, `jobber.py`, `_refresh_lock.py` | 6 |
| H-2 | **Gemini Live context-window compression not enabled** — audio-only sessions hard-cap at **15 min** and the server terminates the call. The plugin supports `context_window_compression` and forwards it; the agent never sets it. (Session resumption, already on, does **not** cover this.) | `agent.py` RealtimeModel | 2 |
| H-3 | ✅ **FIXED 2026-06-04 (commit `bc4467a`).** Confirmed real: `detected_service` was never wired, so Layer-3 never fired. Now derived in `apply_owner_rules` via a word-boundary match of `services.name` against the transcript (min-length guard); can only **raise** urgency on a real match — layer1/layer2 remain the emergency floor, so the removed single-service auto-escalation is not reintroduced. | `layer3_rules.py`, `classifier.py` | 5 |
| H-4 | **Google calendar push webhook is unauthenticated** — trusts attacker-settable `X-Goog-Channel-Token` (tenantId), no shared secret. Lets anyone force syncs / burn quota for a guessed tenant UUID. (Outlook validates `clientState`; Google was left without.) | `google-calendar-push.js:18` | 4 |
| H-5 | **Google calendar sync never follows `nextPageToken`** — events past page 1 are dropped from the local mirror, so the AI can double-book over real calendar events. | `google-calendar.js:199` | 4 |
| H-6 | **Minimum-notice (1h) enforced only in `check_slot`, never in `book_appointment`/the RPC** — the 600s token TTL + a long call can book a slot with far less than configured notice (even slightly in the past). No DB-level past-time invariant. | `check_slot.py:143` | 4 |
| H-7 | **TwiML/XML injection** — caller `From` is interpolated unescaped into `callerId`/`<Number>`, and `_normalize_phone` doesn't strip `<>&"`. Crafted SIP `From` can rewrite the owner-pickup dial plan (toll-fraud surface). Build TwiML via the Twilio SDK + validate E.164. | `twilio_routes.py:66`, `phone.py` | 1 |
| H-8 | **STATE-string format proliferation (7 grammars)** the model must treat as "machine, don't speak," with speakable address/time embedded in `[...]`. On Gemini 3.1 Live under load this is the leading `verdict=…`-token-leak risk. Collapse to one grammar. | `tools/*`, `prompt.py` | 3 |
| H-9 | **`capture_lead` never logs to `_tool_call_log`** — successful lead captures are invisible to the post-call hallucination-detection / reconciliation pipeline (every other data tool logs). | `capture_lead.py` | 3 |
| H-10 | **Triage Groq call runs before `record_outcome` inside the 8s budget** — a slow 5s LLM call re-exposes the 2026-04-21 inquiry-row-loss regression the reorder was meant to fix. | `post_call.py:199` | 5 |

### Strategic — Gemini 3.1 vs the workarounds it forces

| ID | Finding | § |
|----|---------|---|
| S-1 | **`silence_duration_ms=2500` is above Google's doc-warned ceiling** (>2000ms increases latency; server default ~800ms). It taxes every caller with up to 2.5s of post-utterance dead air and cripples barge-in for emergency interruptions. It's the correct mitigation for the server-cancellation cascade — but the cascade, the separate-TTS greeting, and the tool-result-replay hacks **all stem from 3.1's sync-only function calling + the plugin's `"3.1" not in model` mutability gate**. **Recommendation: A/B test `gemini-2.5-flash-native-audio`** (async `NON_BLOCKING` function calling + mutable context would retire most of the workaround stack). Don't hot-swap. | 1, 2, 3 |
| S-2 | The installed-but-unused **`livekit-plugins-turn-detector`** is the most promising lever to lower `silence_duration_ms` safely; and **`prewarm_fnc` / `num_idle_processes`** are unset, so cold-start cost lands on first-call answer latency. | 1 |

### Medium / Low (representative — full lists in the sections)

- **Calls page Realtime INSERT ignores active filters** (injects non-matching rows into filtered views) — the one Realtime guard never added; Jobs/Inquiries already have it. (§7, F-1)
- **Calls page has no transcript view** despite the empty-state promising one; drops `triage_layer_used`/`urgency_confidence` it already fetches. (§7, F-2)
- **`book_appointment` slot_taken recompute omits `calendar_blocks`** → "next available" can land inside an owner's lunch/vacation block. (§3/§4)
- **`transfer_call` is the one blocking tool with no mute and no replay-state** — fully exposed to the VAD cascade. (§3)
- **`capture_lead` has no idempotency latch + hardcodes `urgency="routine"`** → duplicate inquiries on double-fire; lost emergency signal. (§3)
- **Pervasive bare `print()`** in `post_call.py` + swallowed notification failures → owner-notification delivery is unobservable; `RecordOutcomeError`/overage failures never reach Sentry. (§5)
- **Jobber refresh has no expiry buffer** (Xero refreshes 5 min early). *(The "agent refresh ignores the Next.js refresh-lock" race noted here was closed 2026-06-04 as part of the H-1 fix — the agent now acquires the lease.)* (§6)
- **Greeting runs a live TTS synth (>6s observed) on the latency-critical first turn** — it's static per tenant+locale; pre-synthesize and cache. (§1)
- **`intake_questions` has no post-onboarding editor** — services added after onboarding get no intake questions. (§7)
- **Skill docs drift**: scheduling skill still cites the dropped `UNIQUE(tenant_id,start_time)` (migration 019 replaced it with a partial GiST exclusion constraint); priority-caller skills still say `leads.is_vip`. (§4/§7)

### Known test-debt (not re-litigated)
The `check_availability → check_slot/check_day/next_available_days` split left orphaned tests importing the deleted module (`test_slot_token_handoff`, `test_check_availability_slot_cache`, `test_tenant_timezone_fallback`) — these fail at collection and leave the **timezone/slot_token safety net unguarded**. Recommend rewriting them against the split tools.

---

## Detailed Findings

The seven sections below contain the full per-feature analysis (code `file:line`, doc citations + URLs, Approach verdicts, and complete severity-tagged finding lists).



---

# Telephony & LiveKit SDK Audit

**Scope:** Twilio SIP → LiveKit inbound trunk → agent dispatch; the FastAPI Twilio webhook service; LiveKit Agents Python SDK usage in `src/agent.py` (entrypoint, session lifecycle, RealtimeModel, worker/process model, egress, shutdown); the separate-TTS greeting + structural input-mute workaround.

**Versions audited:**
- `livekit-agents==1.5.7`, `livekit-plugins-google==1.5.7`, `livekit-plugins-silero==1.5.7`, `livekit-plugins-turn-detector==1.5.7`, `livekit-plugins-noise-cancellation>=0.2,<1` (`pyproject.toml`).
- Model: `gemini-3.1-flash-live-preview` (native audio-to-audio RealtimeModel).
- Greeting TTS: `gemini-2.5-flash-preview-tts`.
- Runtime: Python 3.12-slim, Railway, `CMD ["python","-m","src.agent","start"]` (`Dockerfile`).

**Prior-fix context honored (NOT re-reported as new):** `book_appointment` input-mute, `session_resumption=handle=None`, `call_sid` insert→upsert, deps `country` fix.

---

## 1. Telephony & LiveKit SDK

### 1.1 Topology — Twilio TwiML `Dial<Sip>` vs LiveKit native SIP trunk

**What the code does:** Inbound PSTN calls hit Twilio, which POSTs to the FastAPI `/twilio/incoming-call` webhook on Railway. The webhook returns hardcoded TwiML `<Response><Dial><Sip>{LIVEKIT_SIP_URI}</Sip></Dial></Response>` (`twilio_routes.py:43-54`, `_ai_sip_twiml`). LiveKit's inbound SIP trunk + dispatch rule then creates a room and dispatches the agent (`agent.py:210` `entrypoint`). So there are **two transport hops**: Twilio Programmable Voice → TwiML → LiveKit SIP. The webhook hop exists because routing decisions (schedule, owner-pickup parallel-ring, VIP, subscription gate, soft-cap) must run *before* deciding AI-vs-human, and only Twilio `<Dial><Number>` can do parallel-ring to the owner's cell.

**What the docs/best-practice say:** LiveKit supports native SIP trunks directly with Twilio/Telnyx/Plivo; the recommended minimal inbound path is *Twilio Elastic SIP Trunk → LiveKit inbound trunk → dispatch rule*, with no application TwiML webhook in the media path (https://docs.livekit.io/agents/start/telephony/, https://docs.livekit.io/sip/). Twilio's `answerOnBridge="true"` on a first-verb `<Dial>` keeps the inbound leg ringing (180/183) until the bridged leg answers, avoiding early-media billing and "dead air after answer" (https://www.twilio.com/docs/voice/twiml/dial).

**Approach verdict: Acceptable (justified divergence).** The TwiML-webhook hop is *not* what LiveKit recommends for a pure AI agent, but it is the correct choice here because owner-pickup parallel-ring (`_owner_pickup_twiml`, `twilio_routes.py:66-79`) genuinely requires Twilio `<Dial><Number>` semantics that a native LiveKit SIP trunk cannot provide. The better-of-both alternative — keep the webhook only for owner-pickup/VIP branches, and reconfigure the trunk so AI-bound calls route via the *native* Twilio→LiveKit SIP trunk (skipping the webhook entirely for the common AI path) — would shave one HTTP round-trip + TwiML parse (~100-300ms) off every AI call and remove the webhook as a single point of failure for AI answering. Worth evaluating but not urgent.

**Findings:**
- **[Medium] `LIVEKIT_SIP_URI` defaults to a placeholder.** `_ai_sip_twiml` falls back to `"sip:voco@sip.livekit.cloud"` when the env var is unset (`twilio_routes.py:50`). If the env var is ever missing in prod, *every* AI call silently dials a non-routable URI and fails after answer. There is no startup assertion that `LIVEKIT_SIP_URI` is set. Add a fail-fast env check at webhook boot (`__init__.py` / `app.py` startup) rather than a per-request placeholder.
- **[Medium] No `answerOnBridge` on the owner-pickup `<Dial>`.** `_owner_pickup_twiml` omits `answerOnBridge="true"` (`twilio_routes.py:75-79`). Without it, Twilio answers the inbound leg immediately and the caller is billed/connected from ring start; the caller may hear silence or ringback inconsistently while the owner's phones ring. Add `answerOnBridge="true"` for cleaner UX and billing.
- **[Low] AI-path TwiML is static** — fine, but it means the AI `<Dial><Sip>` has no `action`/`statusCallback`, so Twilio→LiveKit SIP bridge failures (e.g. LiveKit SIP down) produce no fallback. Consider a `<Dial action=...>` on the AI SIP leg routing to `/twilio/dial-fallback` (which already exists, `twilio_routes.py:315`) so a failed SIP bridge degrades to voicemail/owner instead of dead air.

### 1.2 TwiML construction — XML injection via unescaped caller/number interpolation

**What the code does:** `_owner_pickup_twiml` builds TwiML with f-string interpolation of caller-controlled values without XML-escaping:
```python
f'<Response><Dial timeout="{timeout}" callerId="{caller}" action="{action_url}">{number_elements}</Dial></Response>'
```
where `number_elements = "".join(f"<Number>{n}</Number>" for n in pickup_numbers[:5])` and `caller` is the inbound `From` number (`twilio_routes.py:66-79`, called at `:216` and `:272-273`). `caller`/`from_number` is `_normalize_phone(form_data["From"])`. `_normalize_phone` (`src/lib/phone.py:10-35`) strips `sip:`/`tel:`/`@domain` and prepends `+`, but does **not** strip or escape `<`, `>`, `&`, `"`. `pickup_numbers` come from `tenant.pickup_numbers` (tenant-controlled, lower risk) but are likewise un-escaped.

**What best-practice says:** Twilio explicitly warns that applications generating TwiML dynamically from request data must XML-entity-escape all interpolated values to prevent injection; the official SDK `twilio.twiml.VoiceResponse` builder does this automatically (https://www.twilio.com/docs/voice/twiml, https://www.twilio.com/docs/voice/twiml/dial). Hand-rolled f-string TwiML defeats that protection.

**Approach verdict: Suboptimal.** Use `twilio.twiml.voice_response.VoiceResponse`/`Dial`/`Number` to build all TwiML (the SDK is already a dependency, `twilio>=9.0`). It auto-escapes and removes an entire class of bugs.

**Findings:**
- **[High] TwiML/XML injection through the `From` number.** A crafted SIP `From` such as `+1555"><Hangup/><Dial><Number>+1900...` survives `_normalize_phone` (it only acts on prefixes/`@`/leading-digit) and lands unescaped inside `callerId="..."` and the `<Number>` body. Because `From` originates on the PSTN/SIP side it is attacker-influencable. Twilio signature verification gates the *webhook caller* (Twilio) but does **not** sanitize the `From` field Twilio relays. Impact: an attacker could rewrite the dial plan (e.g. inject a premium-rate `<Number>`, toll-fraud) on owner-pickup/VIP calls. Mitigation: build TwiML via the Twilio SDK (auto-escape) **and** validate `From` against an E.164 regex before use. Both `_empty_twiml`/`_ai_sip_twiml` are constant and safe; only the owner-pickup/VIP paths are exposed.
- **[Low] `timeout` is interpolated as an int** from `tenant.dial_timeout_seconds` (`twilio_routes.py:215,271`) — tenant-controlled and coerced via `.get(...,15)`, but it is not type-validated; a non-int JSONB value would render malformed XML. Low risk; SDK builder also fixes this.

### 1.3 Twilio webhook signature verification & header trust

**What the code does:** Router-level dependency `verify_twilio_signature` (`security.py:28-59`) reconstructs the signed URL as `f"{proto}://{host}{request.url.path}"` from `x-forwarded-proto` (default `https`) and `host` headers, reads the form once, and validates with `twilio.request_validator.RequestValidator`. `ALLOW_UNSIGNED_WEBHOOKS=true` bypasses (warn-logged). uvicorn is started with `proxy_headers=True, forwarded_allow_ips="*"` (`__init__.py:39-41`).

**What best-practice says:** Twilio requires validating against the *exact* URL Twilio used to reach you, including any query string, plus all POST params and the `X-Twilio-Signature` header; use the SDK validator (don't hand-roll) (https://www.twilio.com/docs/usage/webhooks/webhooks-security). Behind a proxy, the original scheme/host must be reconstructed from forwarded headers — which the code does.

**Approach verdict: Acceptable, with hardening gaps.**

**Findings:**
- **[Medium] Query string dropped from URL reconstruction.** The reconstructed URL uses `request.url.path` only — it omits `request.url.query`. If any Twilio webhook URL configured in the console carries a query string (common for multi-tenant routing, e.g. `?env=prod`), Twilio signs the *full* URL including the query, and validation will fail (403) — or, worse, if you later add query params, every call breaks. Use `request.url.path` + (`"?" + request.url.query` if present). Currently the configured URLs appear path-only so it works, but it's a latent trap.
- **[Medium] `forwarded_allow_ips="*"` trusts `X-Forwarded-*` from any source.** Combined with `host`/`x-forwarded-proto` being attacker-spoofable if the app is ever reachable directly (not only via Railway's edge), an attacker who can reach the container could set `host` to a value matching a signature they computed. On Railway the container is only reachable via the edge proxy, so this is contained — but it is defense-relevant. Pin `forwarded_allow_ips` to Railway's proxy CIDR if/when stable, or validate `host` against an allowlist of known tenant webhook hostnames.
- **[Medium] No idempotency / replay handling.** Twilio retries webhooks on timeout/5xx, and `X-Twilio-Signature` is replayable (HMAC over URL+params, no nonce/timestamp). `/dial-status` does an idempotent `update`, but `/incoming-call` and `/incoming-sms` perform side effects: `_insert_owner_pickup_call` is an `upsert on_conflict=call_sid` (idempotent — good), but `incoming-sms` **re-forwards SMS and re-inserts `sms_messages`** on every retry with no dedup key (`twilio_routes.py:354-419`). A Twilio retry double-sends the forwarded SMS to the owner. Dedup on `MessageSid` (insert-if-not-exists) before forwarding.
- **[Low] `ALLOW_UNSIGNED_WEBHOOKS` bypass exists.** Fail-closed by default (good), but ensure it is provably unset in prod (no startup assertion). Add a boot check that refuses to start if `ALLOW_UNSIGNED_WEBHOOKS=true` and `PYTHON_ENV=production`.
- **[Low] No `Content-Length`/body-size guard** on the form parse; FastAPI/uvicorn defaults apply. Acceptable.

### 1.4 SIP participant wait & tenant resolution

**What the code does:** `await ctx.connect()` then `await asyncio.wait_for(ctx.wait_for_participant(), timeout=30)` (`agent.py:213-221`). Phone numbers are pulled from SIP attributes `sip.trunkPhoneNumber`/`sip.phoneNumber` with `sip.to`/`sip.from` fallbacks (`:226-229`), normalized, then tenant looked up by `phone_number` (`:259-267`).

**What the docs say:** `wait_for_participant()` is the documented pattern; SIP attributes (`sip.phoneNumber`, `sip.trunkPhoneNumber`) are the canonical source (https://docs.livekit.io/sip/). 30s is a reasonable bound.

**Approach verdict: Optimal.**

**Findings:**
- **[Low] 30s participant timeout raises an unhandled `asyncio.TimeoutError`** that propagates to the outer `except` at `:1097`, logs, captures to Sentry, and re-raises — which is fine, but the SIP caller hears nothing and the call just drops. Since the SIP participant is created essentially synchronously with dispatch, a 30s wait that fails almost always means a dispatch/trunk misconfig; consider a much shorter timeout (e.g. 8-10s) so failures surface faster and don't hold a worker process.
- **[Low] `wait_for_participant()` is not filtered by participant kind.** If any non-SIP participant (e.g. an egress/observer) ever joins first, it would be returned. In practice only the SIP participant joins, but passing `kind=ParticipantKind.PARTICIPANT_KIND_SIP` would be more robust.

### 1.5 Worker / process model — prewarm, idle processes, drain, shutdown timeout

**What the code does:** `WorkerOptions(entrypoint_fnc=entrypoint, agent_name="voco-voice-agent")` — that's it (`agent.py:1112-1117`). No `prewarm_fnc`, no `num_idle_processes`, no `load_threshold`, no `drain_timeout`, no `shutdown_process_timeout`. ML models (Silero VAD, turn-detector) are pre-downloaded at image build (`Dockerfile` `python -m src.agent download-files`).

**What the docs say:** LiveKit runs each job in its own process; the `prewarm`/`setup_fnc` pattern preloads expensive resources into `proc.userdata` once per process so per-job startup is fast, and `num_idle_processes` keeps warm processes ready to eliminate cold-start latency (https://docs.livekit.io/agents/server/options/, https://docs.livekit.io/agents/build/anatomy/). Defaults: `load_threshold=0.7`, `drain_timeout≈30min`; `num_idle_processes` defaults low (effectively 0 warm beyond the running set in many configs).

**Approach verdict: Suboptimal.** The code under-uses the worker/process model in two ways:

**Findings:**
- **[Medium] No `prewarm_fnc` / `num_idle_processes` → cold-start latency on the first turn.** Because nothing warms a process ahead of dispatch, the first call assigned to a fresh process pays Python import + plugin init + (potentially) model load cost inside the dispatch path, adding to first-greeting latency. The greeting is TTS-driven and the code goes to lengths to hide first-turn latency (pre-fetched context during greeting playout) — a `prewarm_fnc` that imports the Gemini/TTS plugins and warms Silero, plus `num_idle_processes>=1-2`, would directly cut perceived answer latency. This is the single highest-value SDK under-use.
- **[Low] No explicit `shutdown_process_timeout`.** The code comments (`agent.py:740,745`) assume the SDK default is 10s and build the 8s post-call budget against it. That coupling is implicit and undocumented in `WorkerOptions`. Set `shutdown_process_timeout` explicitly in `WorkerOptions` so the 8s post-call timeout (`:771`) has a guaranteed, version-stable headroom rather than depending on an internal default that a future SDK bump could change. (Residual follow-up to the existing 8s safety-belt design.)
- **[Low] No `drain_timeout` / graceful-drain consideration for Railway deploys.** On deploy, Railway SIGTERMs the container; in-flight calls are subject to the SDK drain. Default drain is generous (~30min) which is fine, but the webhook daemon thread (`__init__.py`, `daemon=True`) is killed abruptly on process exit — acceptable since it's stateless, but a deploy mid-call relies entirely on the SDK drain to finish the post-call pipeline. Confirm Railway's stop-grace-period is long enough to cover drain; otherwise active calls' post-call writes are lost on deploy.

### 1.6 Greeting via separate Gemini TTS + `session.say()`

**What the code does:** Because `gemini-3.1-flash-live-preview` capability-gates `generate_reply`/agent-first turns closed (`mutable_chat_context=False`; documented at `agent.py:558-570`, corroborated by user MEMORY refs `reference_livekit_generate_reply_gemini31`, `reference_livekit_session_say_no_tts`), the code attaches a **second** model — `GeminiTTS(model="gemini-2.5-flash-preview-tts")` — as `AgentSession(llm=model, tts=greeting_tts)` purely so `session.say(greeting_text)` works for the opening line (`:571-585`, `:1016`). The greeting text is templated per-tenant/locale with a recording disclosure (`:980-1001`). Voice names are matched 1:1 between Live and TTS so there's no audible switch.

**What the docs say:** For RealtimeModels, LiveKit recommends `generate_reply(instructions=...)` for the first turn; `say()` "requires a TTS plugin" (https://docs.livekit.io/agents/build/audio/). The code cannot use `generate_reply` on this specific model build, so it falls back to the *also-documented* `say()` + TTS path.

**Approach verdict: Acceptable (forced by the model).** This is a genuine SDK/model limitation, not a misuse — the workaround is the only confirmed working path on 3.1 Live, and matching voices is a thoughtful touch. The cost is a second model dependency and a second synthesis pipeline on the hot path.

**Findings:**
- **[Medium] Greeting is a separate TTS round-trip on the latency-critical first turn.** `gemini-2.5-flash-preview-tts` synthesis of the ~114-char branded greeting was observed exceeding 6s end-to-end (the unmute cap was raised 6s→10s, `:1024-1031`). That's slow for a greeting. Mitigations: (a) **pre-synthesize and cache** the per-tenant greeting audio (it's static per tenant+locale) and play cached audio via `say(audio=...)` — docs explicitly recommend caching TTS for fixed greetings; this removes the synth latency entirely. (b) Re-test `generate_reply` after each SDK/model bump (1.5.7 notes mention a "realtime reply-after-interruption fix") — if 3.1 ever ungates it, the whole second-pipeline workaround can be deleted.
- **[Low] Greeting text duplication risk.** The TTS greeting (`:983-1001`) must stay byte-aligned with the prompt's OPENING guidance or Gemini's follow-ups feel inconsistent. This is maintained by convention only (two sources of truth). Consider generating the greeting string from a single shared template used by both the prompt builder and the TTS call.

### 1.7 Structural input-mute during greeting

**What the code does:** Before `session.say()`, input audio is disabled `session.input.set_audio_enabled(False)`; a background task awaits `greeting_handle.wait_for_playout()` (10s cap) then re-enables it; on any failure it force-unmutes (`agent.py:1014-1053`). Rationale: SIP acoustic echo of the TTS feeding back as user audio would trip Gemini's server VAD and cause self-interruption, and it prevents premature barge-in before the caller hears the question.

**What the docs say:** Echo-driven false barge-in is exactly what noise-cancellation/turn-detection are meant to handle; muting input during a known agent-only window is a legitimate pattern but a blunt instrument. The code already applies `BVCTelephony()` noise cancellation for SIP participants (`:944-949`), which targets this. The docs note Krisp/BVC + turn detection are the primary mechanisms (https://docs.livekit.io/agents/start/telephony/, https://docs.livekit.io/agents/build/audio/).

**Approach verdict: Acceptable (defensive), but blunt.** Hard-muting input for the entire greeting means a caller who genuinely wants to barge in during the 4-10s greeting *cannot* — they're talking to a deaf agent until unmute. For a receptionist this is mostly fine (callers expect to hear the greeting), but it trades one failure mode (echo self-interrupt) for another (no early barge-in). Combined with the VERY high VAD thresholds (§1.8) this compounds into an agent that is hard to interrupt.

**Findings:**
- **[Medium] Force-unmute depends on a single timer; a hung playout signal leaves input muted up to 10s.** The 10s cap (`:1031`) is a safety net, but if `wait_for_playout()` neither completes nor times out cleanly, the `finally` still runs — so it's covered. The residual concern is the *10s* worst case itself: a caller saying "hello?" 3s into a stalled greeting waits up to 10s before being heard. Tie unmute to the actual first audio-frame-done signal rather than a fixed cap, or lower the cap now that greetings are templated and length-bounded.
- **[Low] Mute/unmute is not coordinated with the egress recording window** — fine functionally, but the protected window means the caller's earliest speech (if echo-suppressed by mute) isn't captured; acceptable since they're muted, not dropped.

### 1.8 RealtimeModel construction, VAD thresholds, interruptions

**What the code does:** `RealtimeModel(model="gemini-3.1-flash-live-preview", voice=..., language=_locale_to_bcp47(locale), instructions=system_prompt, realtime_input_config=..., thinking_config=ThinkingConfig(thinking_level="low"), session_resumption=SessionResumptionConfig(handle=None))` (`agent.py:533-554`). VAD is tuned to `START_SENSITIVITY_LOW`/`END_SENSITIVITY_LOW`, `prefix_padding_ms=400`, `silence_duration_ms=2500` (raised 1000→1500→2500 across phases) (`:496-512`). Default temperature (1.0, per Gemini-3 guidance, `:520-525`). `activity_handling=NO_INTERRUPTION` was tried and reverted (`:489-495`).

**What the docs/best-practice say:** Lowering VAD sensitivity reduces false barge-in on breaths; LiveKit/Gemini guidance (livekit/agents#4441/#4486) supports raising silence thresholds for telephony. But `silence_duration_ms=2500` is **very** high — it means the model requires 2.5s of continuous caller speech before treating it as an interrupt. Default Gemini Live is ~tens-to-few-hundred ms.

**Approach verdict: Suboptimal-but-justified (a known-bad tradeoff forced by a real cascade bug).** Per user MEMORY (`project_phase_61_cascade_failure_mode`), the real failure is Gemini-server cancellation cascade, and high thresholds are the only known mitigation. So 2500ms is a deliberate, evidence-backed compromise, not an accident. The cost — documented honestly in the comments — is degraded interruptibility: a caller must speak a full 2.5s sentence to barge in, and short acknowledgments ("yes", "no", "stop") during agent speech are ignored. This is a **UX regression** that should be tracked as tech-debt against the upstream fix, not accepted as steady-state.

**Findings:**
- **[Medium] `silence_duration_ms=2500` severely degrades barge-in.** Real callers interject with short words; at 2.5s those never register as interrupts, so the agent talks over corrections. This is the right *temporary* mitigation for the cascade but should be paired with: (a) tracking livekit/agents#4441/#4486 + Gemini-Live server-cancellation fixes for a revert, (b) considering allowing interruptions only at semantic points, (c) re-testing lower values after each SDK bump. Tag as a known regression, not a fix.
- **[Low] `language=_locale_to_bcp47(locale)` is best-effort on native-audio** (comment at `:536`) — acceptable; defense-in-depth with the prompt-side anti-hallucination directive.
- **[Low] `session_resumption=handle=None`** (prior-fix) is correct for this plugin version; the comment correctly notes `.transparent` is dropped by the plugin's connect path. No action. (Residual follow-up: re-verify on next plugin bump that the resumption-handle threading still holds.)
- **[Low] No `turn_detection` model wired despite `livekit-plugins-turn-detector` being a dependency.** The session relies on Gemini server-side VAD only; the turn-detector plugin is installed and pre-downloaded but apparently unused for the realtime path. Either use it (semantic turn detection could let you *lower* `silence_duration_ms` safely) or drop the dependency + its image-build download to slim the container. The turn-detector is the most promising lever to escape the 2500ms tradeoff.

### 1.9 Egress (recording) start/stop lifecycle

**What the code does:** Egress is started fire-and-forget after `session.start()` via `_start_egress()` (`agent.py:1056-1095`): waits for `db_task` (call_uuid), then `start_room_composite_egress(audio_only=True, OGG, S3→Supabase)`, stores `egress_id` + path on the row. Stop happens in `_on_close_async` (`:730-742`): `stop_egress(egress_id)`, no S3-upload polling (deliberate, to protect the shutdown budget).

**What the docs say:** Room-composite egress with async S3 upload is standard; LiveKit uploads after stop on its own infra. Not polling for upload completion is the correct choice under a tight shutdown budget.

**Approach verdict: Optimal.**

**Findings:**
- **[Low] Egress start races the greeting/conversation.** `_start_egress` awaits `db_task` before starting, so the first ~0.5-2s of audio (including part of the greeting) may not be captured if egress starts late. If full-greeting capture matters (QA/compliance for the recording disclosure), start egress *before* awaiting `db_task` (it only needs `room_name`, not `call_uuid`; write `egress_id` to the row in a follow-up update). Currently `call_uuid` gates egress unnecessarily.
- **[Low] `stop_egress` failure is logged but the recording path was already written at start** — so the dashboard still finds the file. Good. But if `start_room_composite_egress` itself fails, `recording_storage_path` was written speculatively as `recording_path if egress_id else None` in post-call (`:760`) — `egress_id` is None on failure, so it's correctly nulled. Consistent. No action.
- **[Low] S3 credentials read from env at call time** (`:1071-1076`) with `""` defaults — a missing credential silently produces a broken egress (caught by the broad `except`). Add a boot-time assertion that S3 env vars are present.

### 1.10 Shutdown callback & 8s post-call timeout

**What the code does:** Post-call work is registered as a `JobContext` shutdown callback `ctx.add_shutdown_callback(_on_close_async)` (`agent.py:797`), replacing an earlier `session.on("close")+create_task` pattern that raced executor teardown. `_on_close_async` flushes the goodbye-race diagnostic first, awaits `db_task`, stops egress, then runs `run_post_call_pipeline` under `asyncio.wait_for(..., timeout=8.0)` (`:748-784`).

**What the docs say:** Shutdown callbacks are the canonical place for post-call cleanup with I/O; the SDK awaits them before tearing down the process executor (https://docs.livekit.io/agents/build/anatomy/). The code's reasoning (`:786-796`, `:1102-1107`) is accurate and matches SDK internals.

**Approach verdict: Optimal.** This is a correct, well-reasoned use of the SDK lifecycle — among the strongest parts of the file.

**Findings:**
- **[Low] The 8s timeout is hardcoded against an *assumed* 10s `shutdown_process_timeout`.** See §1.5 — make `shutdown_process_timeout` explicit in `WorkerOptions` so this coupling is stable. (Residual follow-up.)
- **[Low] `await db_task` inside the shutdown path has no timeout** (`:726`). If the DB insert hangs, it eats into the 8s budget before the pipeline even starts. Wrap with a short `wait_for`.

### 1.11 Event handlers, logging handler hygiene, observability

**What the code does:** Extensive per-call logging handlers are attached to `livekit.agents` and `livekit.plugins.google[.realtime]` loggers (`_GoodbyeDiagHandler`, `_ServerCancelHandler`) and removed in `_flush_goodbye_diag`'s `finally` (`agent.py:82-196`, `412-421`). Many session events are instrumented (`conversation_item_added`, `close`, `error`, `agent_state_changed`, `function_tools_executed`, etc.). `session.output.audio.capture_frame` is monkeypatched post-start to stamp frame timestamps (`:959-967`).

**Approach verdict: Acceptable.** The observability is thorough and the handler removal is correctly in `finally` blocks (avoids per-call handler accumulation, a real leak risk that was clearly considered).

**Findings:**
- **[Medium] Process-global logger handlers attached per-call with shared mutable state.** `_GoodbyeDiagHandler`/`_ServerCancelHandler` are added to *process-global* loggers (`logging.getLogger("livekit.agents")`) but each is bound to one call's `diag_record`. Each job runs in its own process (LiveKit one-process-per-job), so concurrency within a process isn't expected — **but** if the SDK is ever run with multiple jobs per process, or a process handles a second job after reuse, stale handlers from a prior call could write into the wrong `diag_record` until removed. The removal in `finally` mitigates this for the normal path; an entrypoint exception *before* the `finally`-bearing close path (e.g. failure between `addHandler` at `:413` and registering `_on_close_async`) would leak a handler. Low likelihood given one-process-per-job, but the pattern is fragile — prefer a `logging.Filter`/contextvar scoped to the job, or attach handlers only within a try/finally that spans the whole entrypoint.
- **[Low] Monkeypatching `session.output.audio.capture_frame`** (`:961-967`) is a private-API dependency; a future SDK refactor of `RoomOutput` could break it silently (it's `try/except`-wrapped, so it degrades to "no frame timestamps" rather than crashing — acceptable, but flag as SDK-version-fragile).
- **[Low] Subscription-block disconnect path** (`:911-924`) removes the participant but does not call `ctx.shutdown()`, relying on `participant_disconnected` to cascade session close. Verify this reliably triggers the post-call pipeline for blocked callers (it should via room-empty close, but it's an untested edge vs. the `end_call` path which explicitly calls `ctx.shutdown()`).

---

## Top findings by severity (consolidated)

- **[High] §1.2** TwiML/XML injection via unescaped `From`/pickup numbers in `_owner_pickup_twiml`; `_normalize_phone` doesn't strip `<>&"`. Use Twilio SDK builder + E.164 validation.
- **[Medium] §1.5** No `prewarm_fnc`/`num_idle_processes` — avoidable cold-start latency on first turn; highest-value SDK under-use.
- **[Medium] §1.8** `silence_duration_ms=2500` cripples barge-in (justified cascade mitigation, but a tracked UX regression, not a steady-state fix).
- **[Medium] §1.6** Greeting goes through a live `gemini-2.5-flash-preview-tts` synth (observed >6s) on the latency-critical first turn; pre-synthesize/cache the static per-tenant greeting.
- **[Medium] §1.3** SMS forwarding has no idempotency key — Twilio retries double-send to the owner; URL reconstruction drops query string (latent 403 trap).
- **[Medium] §1.1** `LIVEKIT_SIP_URI` placeholder fallback + missing `answerOnBridge` on owner-pickup `<Dial>`.
- **[Medium] §1.11** Per-call diagnostic handlers on process-global loggers with shared mutable state — fragile if process reuse/multi-job ever occurs.
- **[Low] §1.10/§1.5** 8s post-call timeout is coupled to an *implicit* `shutdown_process_timeout` default; make it explicit in `WorkerOptions`.
- **[Low] §1.8** `livekit-plugins-turn-detector` is installed + image-baked but unused on the realtime path — either use it to escape the 2500ms tradeoff or drop it.
- **[Low] §1.9** Egress start gated on `call_uuid`/`db_task`, risking loss of the first seconds (incl. recording disclosure) — start it earlier.

## Sources
- LiveKit Telephony: https://docs.livekit.io/agents/start/telephony/
- LiveKit SIP: https://docs.livekit.io/sip/
- LiveKit Server/Worker options: https://docs.livekit.io/agents/server/options/
- LiveKit Anatomy of an Agent (lifecycle/shutdown/prewarm): https://docs.livekit.io/agents/build/anatomy/
- LiveKit Audio / agent-first turns & say vs generate_reply: https://docs.livekit.io/agents/build/audio/
- LiveKit worker.py source: https://github.com/livekit/agents/blob/main/livekit-agents/livekit/agents/worker.py
- Twilio webhook security: https://www.twilio.com/docs/usage/webhooks/webhooks-security
- Twilio TwiML <Dial> (answerOnBridge, escaping): https://www.twilio.com/docs/voice/twiml/dial
- Twilio TwiML <Sip>: https://www.twilio.com/docs/voice/twiml/sip
- Twilio TwiML overview: https://www.twilio.com/docs/voice/twiml


---

# Gemini 3.1 Flash Live — Realtime Model Configuration Audit

**Scope:** `gemini-3.1-flash-live-preview` via `livekit-plugins-google==1.5.7`, as configured in `src/agent.py` (repo `C:/Users/leheh/.Projects/livekit-agent`).
**Audited:** 2026-06-04. Model card last updated March 2026 (still **Preview**, not GA).

**Sources (official docs, fetched 2026-06):**
- Model card: https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview
- Live API capabilities: https://ai.google.dev/gemini-api/docs/live-api/capabilities
- Live API best practices: https://ai.google.dev/gemini-api/docs/live-api/best-practices
- Session management: https://ai.google.dev/gemini-api/docs/live-api/session-management
- DeepMind model card: https://deepmind.google/models/model-cards/gemini-3-1-flash-audio/
- Plugin source (installed): `livekit/plugins/google/realtime/realtime_api.py` (v1.5.7)

**Prior fixes (NOT re-reported here):** `session_resumption=handle=None` enabled; `book_appointment` mute added; the `generate_reply`/`update_chat_ctx`/`send_client_content` 1.5.x incompatibility on 3.1 is a documented model limitation, not a bug.

---

## 2. Gemini 3.1 Flash Live Model

### Model facts (from card)
- **Status:** Preview (March 2026). No GA date published as of mid-2026.
- **Context window:** input **131,072** tokens, output **65,536** tokens. (Note: native-audio tokens accrue at ~25 tok/sec of audio per best-practices.)
- **Knowledge cutoff:** January 2025.
- **Function calling:** **synchronous only.** "The model will not start responding until you've sent the tool response." Async / `NON_BLOCKING` is **not supported** on 3.1.
- **Not supported on 3.1:** async function calling, proactive audio, affective dialogue, batch, caching, code execution, image gen, structured outputs.
- **Supported:** thinking (`thinkingLevel`), search grounding, audio output, session resumption, context window compression, configurable VAD.

---

### 2.1 — VAD / `realtime_input_config` (silence_duration_ms=2500, sensitivities LOW, prefix_padding_ms=400)

**Code:** `src/agent.py:496-512`
```python
realtime_input_config = genai_types.RealtimeInputConfig(
    automatic_activity_detection=genai_types.AutomaticActivityDetection(
        start_of_speech_sensitivity=StartSensitivity.START_SENSITIVITY_LOW,
        end_of_speech_sensitivity=EndSensitivity.END_SENSITIVITY_LOW,
        prefix_padding_ms=400,
        silence_duration_ms=2500,   # raised 1500 -> 2500 in 63.1-11
    ),
)
```
Forwarded by plugin at `realtime_api.py:1107-1108` (`conf.realtime_input_config = ...`). ✅ wired correctly.

**Doc-backed best setting:** Best-practices (capabilities URL) explicitly warns: `silenceDurationMs` **"under 200ms risks fragmenting speech, while over 2000ms increases latency."** Server default is **~800ms**; recommended quality band is **500–800ms**. `prefix_padding_ms` example in docs is `20`; the field is "look-back" audio and does not need to be large.

**Approach verdict:** The 2500ms value is **outside the doc-recommended ceiling (>2000ms = added latency)** and is a symptom-driven workaround, not a tuned setting. The real problem it papers over is the **server-cancellation cascade** (brief "mhm"/"hello" firing VAD mid-tool-call → `server cancelled tool calls`). That cascade is the native-audio + sync-function-calling interaction, and the prior team already documented it as the true failure mode (MEMORY: `project_phase_61_cascade_failure_mode`). Pushing `silence_duration_ms` to 2500 trades end-of-turn responsiveness (caller finishes speaking → up to 2.5s dead air before the agent responds) to suppress false barge-ins. For an emergency-triaging receptionist, 2.5s of post-utterance silence on **every** turn is a noticeable, degraded UX.

`prefix_padding_ms=400` is 20× the doc example. It is not harmful (more look-back = slightly safer onset capture) but it is not load-bearing either; it predates the cascade work.

**Recommendations:**
- **[High]** Lower `silence_duration_ms` toward the **800–1500ms** band and instead suppress acoustic-echo / self-interrupt at the source (see 2.6 — the greeting already mutes input; the same structural-mute pattern, not a global VAD ceiling, is the documented mitigation for the cascade). 2500ms is a per-turn latency tax on all callers to fix an edge case.
- **[Medium]** Reduce `prefix_padding_ms` to ~100–200ms; 400ms is unjustified vs the doc example (`20`) and adds nothing once `START_SENSITIVITY_LOW` is set.
- **[Low]** `END_SENSITIVITY_LOW` already biases toward "wait longer before declaring end-of-speech," so it partially duplicates the high `silence_duration_ms`. Pick one lever, don't stack both at max.

---

### 2.2 — `thinking_config` (thinking_level="low", include_thoughts=False)

**Code:** `src/agent.py:539-542`
```python
thinking_config=genai_types.ThinkingConfig(
    thinking_level="low",
    include_thoughts=False,
)
```
Forwarded at `realtime_api.py:1082-1084` into `generation_config.thinking_config`. ✅ wired.

**Doc-backed best setting:** 3.1 uses `thinkingLevel` ∈ {`minimal`, `low`, `medium`, `high`}; **default `minimal`** to "optimize for lowest latency." Docs say for tool-using agents `minimal` or `low` both "preserve responsiveness."

**Approach verdict:** **Correct, and well-reasoned.** The inline rationale (lines 526-532) matches reality: `minimal` short-circuits the tool-vs-speak decision and the model pattern-matches to a fluent continuation (i.e. it fabricates a booking confirmation instead of calling `book_appointment`). `low` is the right floor for a tool-deliberation-sensitive receptionist that must reliably *choose to call a tool*. `include_thoughts=False` is correct (thoughts aren't needed in audio output and would cost tokens/latency). This is the one knob the team got right per the docs.

**Recommendations:**
- **[Low]** Keep `low`. Only consider `medium` if you still see tool-skipping after the VAD/cascade fixes — but `medium` adds latency, so treat it as a fallback, not a default.

---

### 2.3 — `language` STT pin (`_locale_to_bcp47(locale)` → speech_config.language_code)

**Code:** `src/agent.py:536`, helper `:65-74`. Forwarded at `realtime_api.py:1093` as `speech_config.language_code`.

**Doc-backed finding (the important one):** `language_code` lives on **`speech_config`** — it governs **output/TTS** language, not STT input recognition. Native-audio models **"automatically choose the appropriate language"** and per the capabilities doc **do not support explicitly setting the [input] language code**; multilingual input is auto-detected. Input transcription is a *separate* feature (`input_audio_transcription`). The code comments at `:59-68` and `:536` call this an "STT pin" / "input-language hint" — that's a **mislabel**. It is at best a weak output-language nudge, and the native-audio model may ignore it.

**Approach verdict:** **Mis-tuned by misunderstanding.** Two issues: (a) it's documented as an output-language field, not the STT pin the comments claim; (b) `_LOCALE_TO_BCP47` collapses everything except `es` to `en-US`, so a Spanish-locale tenant gets `es-US` but the model's own auto-detect is what actually drives recognition. The real multilingual control surface on 3.1 is the **system prompt** ("RESPOND IN {LANGUAGE}…" per best-practices), which the codebase already does via `_build_language_section` — that's the load-bearing mechanism, not this kwarg. Passing `language_code` is harmless defense-in-depth but the comments overstate its effect and could mislead future tuning.

**Recommendations:**
- **[Medium]** Fix the comments (`:59-68`, `:536`, the `[60.4 Stream B]` log) to state this is an **output-language nudge on `speech_config`, auto-detect still governs input** — not an STT pin. The misframing risks a future engineer "fixing latency" by removing it, or trusting it for recognition it doesn't provide.
- **[Low]** If you want real per-language input transcripts, wire `input_audio_transcription` with an explicit language; today STT language correctness rides entirely on prompt + auto-detect.

---

### 2.4 — `voice` / `VOICE_MAP` / temperature

**Code:** voice resolution `src/agent.py:475-480`, `VOICE_MAP :50-54`, default fallback `"Kore"`. Temperature: **deliberately omitted** (deleted; rationale `:520-525`).

**Doc-backed best setting:** Gemini 3 guidance: leave temperature at default (1.0); custom values "risk looping or degraded performance." Voice via `voiceConfig.prebuiltVoiceConfig.voiceName` (e.g. `Kore`). All voice names are shared across Gemini Live and Gemini TTS.

**Approach verdict:** **Correct.** Removing the old `temperature=0.3` carryover is exactly right and matches the Gemini 3 looping/fabrication guidance — this directly addressed the filler-loop symptom. VOICE_MAP is fine; the `"Kore"` fallback is a valid prebuilt voice. Greeting-voice / live-voice identity is preserved (same `voice_name` passed to both, see 2.6).

**Recommendations:**
- **[Low]** Note `VOICE_MAP` has only 3 presets while tenants can pick `ai_voice` freely (`:475`); ensure the dashboard voice picker is constrained to actual prebuilt Gemini voice names or an invalid value will fail the connect. (Validation belongs in the Next.js settings panel, not here.)

---

### 2.5 — `session_resumption`, modalities, media_resolution

**Code:** `session_resumption=SessionResumptionConfig(handle=None)` `:553`. No `response_modalities` set (plugin default). No `media_resolution` set.

**Doc-backed finding:** Session resumption keeps one logical session alive across the ~10-min WebSocket reset; tokens valid 2h; server emits `GoAway` with `timeLeft` before termination. The plugin stores `new_handle` from each `session_resumption_update` (`realtime_api.py:1024-1031`) and re-sends it on reconnect (`:1098-1100`). `media_resolution` (`MEDIA_RESOLUTION_LOW`) only matters for video/image input — **irrelevant for an audio-only phone agent**.

**Approach verdict:** **Correct and complete for this use case.** `handle=None` is the right call (the prior-fix note explains `transparent=True` would be dropped by `_build_connect_config`, which only threads `.handle`). Audio-only modality is implicit and fine. Skipping `media_resolution` is correct — no video.

**Recommendations:**
- **[Low]** No action. Optionally listen for `GoAway`/`timeLeft` to proactively warn on very long calls, but resumption already covers the reconnect.

---

### 2.6 — Agent-first greeting workaround + 3.1 mutability gating

**Code:** separate `GeminiTTS` greeting `:571-585`, `session.say()` + input-mute window `:1002-1053`. Plugin gate: `realtime_api.py:289` `mutable = "3.1" not in model` → `mutable_chat_context/instructions=False` for 3.1.

**Doc-backed finding:** Confirmed at the plugin level — on any `"3.1"` model the capability flags are forced false, so `generate_reply` / `update_chat_ctx` / `update_instructions` are gated closed; the agent cannot speak first or mutate context via the realtime channel. This is the documented `send_client_content` restriction surfacing as a LiveKit capability guard. The separate-TTS greeting (`gemini-2.5-flash-preview-tts`, same `voice_name`) is the **only confirmed agent-first path** on this SDK+model combo.

**Approach verdict:** **Sound workaround, given the model limitation.** Using a sibling `gemini-2.5-flash-preview-tts` with matching voice = no audible switch; muting input during playout = clean protected window; 10s safety cap prevents permanent mute. This is the correct engineering response to a real, documented gate. The tool-result-replay via `update_chat_ctx` (MEMORY: `reference_livekit_update_chat_ctx_tool_results`) exploits that `update_chat_ctx` tool-result sends are unconditional on 3.1 even with `mutable_chat_context=False` — a legitimate, if fragile, escape hatch.

**Recommendations:**
- **[Medium]** This entire workaround stack (separate TTS, input-mute timing, cascade replay) exists *because of* the 3.1 model gate. It is the single strongest argument for the model-choice reconsideration below (2.8). Track the 3.1 SDK gate — if a future `livekit-plugins-google` relaxes `mutable = "3.1" not in model`, the greeting could move back onto the realtime channel and delete ~80 lines of timing-sensitive code.
- **[Low]** The hardcoded 10s unmute cap (`:1031`) is tuned to the ~114-char branded greeting; if greeting text grows (longer business names), revisit.

---

### 2.7 — Context window compression (MISSING — long-call cost & cutoff risk)

**Code:** **not set.** Plugin fully supports it: param `realtime_api.py:212`, forwarded `:1109-1110`.

**Doc-backed finding:** Without compression, **audio-only sessions hard-cap at 15 minutes**, then terminate. Native-audio tokens accrue at **~25 tok/sec**, so a 15-min call ≈ 22.5k tokens of audio alone — approaching practical context pressure and billed in full every turn. `ContextWindowCompressionConfig(sliding_window=SlidingWindow(), trigger_tokens=...)` extends sessions to "unlimited" time **and** caps per-turn billing to retained-window + new tokens. It is **orthogonal to** session resumption (resumption = reconnect across WS resets; compression = bound the live context).

**Approach verdict:** **Gap.** Session resumption is enabled (handles the 10-min WS reset) but **the 15-minute audio session cap is NOT addressed.** A long triage/booking call that runs past 15 min will be terminated by the server mid-conversation. Even short calls pay rising per-turn token cost as audio history accumulates with no sliding window. For a receptionist that occasionally handles long, detail-heavy emergency calls, this is a real cutoff and cost exposure.

**Recommendations:**
- **[High]** Add `context_window_compression=types.ContextWindowCompressionConfig(sliding_window=types.SlidingWindow(), trigger_tokens=...)`. Start with the doc default sliding window; pick `trigger_tokens` (~16k–25k) to keep the live window small. Removes the 15-min hard cutoff and bounds per-turn audio-token billing on every call. This is the highest-value missing knob.

---

### 2.8 — Model choice: `gemini-3.1-flash-live-preview` vs `gemini-2.5-flash-native-audio`

**Current:** `gemini-3.1-flash-live-preview` (`:534`).

**Trade matrix (from model cards + capabilities):**

| Dimension (phone receptionist) | 3.1-flash-live | 2.5-flash-native-audio |
|---|---|---|
| Function calling | **Sync only** — blocks until tool result returns | **Async (`NON_BLOCKING`)** — model can keep talking while a tool runs |
| Thinking | `thinkingLevel` (cleaner latency tiers) | `thinkingBudget` (token-based) |
| Proactive audio / affective dialog | ❌ | ✅ |
| Agent-first / context mutation in LiveKit plugin | ❌ gated (`mutable = "3.1" not in model`) → needs the 2.6 workaround | ✅ mutable (generate_reply/update_chat_ctx work) |
| Server-cancellation cascade | Present (drives the 2500ms VAD + replay hacks) | Async FC + mutable context reduce exposure to the same cascade |
| Knowledge cutoff | Jan 2025 | (model-specific) |
| Context window | 131k in / 65k out | 128k (native audio) |

**Recommendation — [High], with a measured rollout:** For *this* use case — a latency-sensitive phone receptionist that **triages emergencies and relies heavily on tools** — the two pain points dominating the codebase (the server-cancellation cascade forcing `silence_duration_ms=2500`, and the agent-first gate forcing the separate-TTS greeting + tool-result-replay machinery) **both stem from 3.1's sync-only function calling + the plugin's 3.1 mutability gate.** `gemini-2.5-flash-native-audio` directly relaxes both: async (`NON_BLOCKING`) function calling means a caller speaking during a tool call no longer cancels an in-flight generation, and the plugin treats 2.5 as `mutable`, restoring `generate_reply`/`update_chat_ctx` so the greeting and recovery paths stop needing workarounds.

The honest counterweight: 3.1 is the newer model Google markets as "recommended for all Live API use cases," likely has better raw reasoning, and is the team's current battle-tested target with substantial cascade-mitigation already shipped. Switching is **not free** — it changes thinking config (`thinkingBudget` not `thinkingLevel`), re-opens prompt-tuning, and the team explicitly tried `NO_INTERRUPTION` and reverted (`:489-495`).

**Verdict:** Do **not** hot-swap. **Run a parallel A/B on `gemini-2.5-flash-native-audio`** measuring (1) tool-call cancellation rate, (2) end-of-turn latency at a *normal* `silence_duration_ms` (~800ms), and (3) ability to drop the separate-TTS greeting. If 2.5 cuts the cascade and lets VAD return to the doc-recommended band, it is the better fit for this receptionist workload despite being the "older" model — because async FC + mutable context are architecturally aligned with a tool-heavy, agent-first phone agent. Re-evaluate if/when 3.1 gains async function calling and the plugin un-gates 3.1 mutability (then 3.1 becomes the clear winner).

---

## Summary of tagged recommendations

| Tag | Item | Section |
|---|---|---|
| **High** | Add `context_window_compression` — removes 15-min audio cutoff, bounds per-turn token cost | 2.7 |
| **High** | A/B `gemini-2.5-flash-native-audio` — async FC + mutable context target the cascade & greeting-gate root causes | 2.8 |
| **High** | Lower `silence_duration_ms` from 2500 (>2000ms = doc-warned latency) toward 800–1500ms; fix cascade at source | 2.1 |
| **Medium** | Correct the `language`/`language_code` "STT pin" mislabel — it's an output nudge on speech_config; auto-detect governs input | 2.3 |
| **Medium** | Reduce `prefix_padding_ms` 400 → ~100–200ms (doc example is 20) | 2.1 |
| **Medium** | Track the 3.1 mutability gate; greeting workaround stack can be deleted if plugin un-gates | 2.6 |
| **Low** | `thinking_level="low"` is correct — keep; `medium` only as a tool-skip fallback | 2.2 |
| **Low** | Temperature-default (omitted) is correct per Gemini 3 looping guidance | 2.4 |
| **Low** | `session_resumption=handle=None` + audio-only modality + no media_resolution all correct | 2.5 |
| **Low** | Validate tenant `ai_voice` against real prebuilt voice names (in dashboard) | 2.4 |


---

# 3. Agent Tools, Cascade Machinery & System Prompt

Deep audit of the Voco LiveKit voice agent (`C:/Users/leheh/.Projects/livekit-agent`),
running `gemini-3.1-flash-live-preview`. Scope: the in-process function tools in
`src/tools/`, the cascade mute/replay machinery in `src/tools/_availability_lib.py`,
and the system-prompt builder in `src/prompt.py`.

Severity legend: **[CRITICAL]** correctness/safety risk · **[HIGH]** likely
production failure or strong improvement · **[MEDIUM]** quality/maintainability ·
**[LOW]** nit / future-proofing · **[OK]** validated-good, keep.

## Research baseline (cited best practices)

- **Gemini 3.1 Flash Live function calling is blocking.** "Function calling executes
  sequentially by default, meaning execution pauses until the results of each function
  call are available." Non-blocking is opt-in per-declaration via `"behavior":
  "NON_BLOCKING"` + a `scheduling` enum (`INTERRUPT` / `WHEN_IDLE` / `SILENT`).
  ([Gemini Live tools](https://ai.google.dev/gemini-api/docs/live-api/tools))
- **VAD cancels in-flight generation AND discards pending function calls.** "When VAD
  detects an interruption, the ongoing generation is canceled and discarded... the
  Gemini server then discards any pending function calls and sends a
  BidiGenerateContentServerContent message with the IDs of the canceled calls."
  ([Live capabilities guide](https://ai.google.dev/gemini-api/docs/live-api/capabilities))
  — This is the root cause the `mute_input_during_tool` machinery mitigates; the agent's
  header comment is accurate.
- **The Live API does not auto-handle tool responses** — "you must handle tool responses
  manually in your client code." ([tools](https://ai.google.dev/gemini-api/docs/live-api/tools))
  LiveKit's `@function_tool` does this for you; the private-accessor replay path bypasses it.
- **Tool definitions must state invocation conditions explicitly.** "Be sure to tell
  Gemini under what conditions a tool call should be invoked," with the canonical example
  `create_client_profile`: "Invoke this tool *only after* the client has provided their
  full name, date of birth, AND state."
  ([Live best practices](https://ai.google.dev/gemini-api/docs/live-api/best-practices))
- **System instructions ordered persona → conversational rules → guardrails**, and
  "Delineate between one-time elements of the conversation and conversational loops."
  ([Live best practices](https://ai.google.dev/gemini-api/docs/live-api/best-practices))
- **Schema hygiene:** "The API may reject very large or deeply nested schemas... try
  simplifying... by shortening property names, reducing nesting, or limiting the number of
  function declarations." Schemas use the OpenAPI subset (type/nullable/required/format/
  description/properties/items/enum).
  ([Function calling](https://ai.google.dev/gemini-api/docs/function-calling))
- **Tool hygiene for voice:** "limit max_tool_steps, consolidat[e] external API calls, and
  us[e] a 'thinking' sound so users aren't waiting in silence"; keep context small, avoid
  tool overload. Latency budget: first syllable <300ms human, 300-600ms acceptable, >600ms
  callers "start tapping keys."
  ([LiveKit agent latency](https://livekit.com/blog/understand-and-improve-agent-latency))

The system as built is unusually well-aligned with these: blocking-mode awareness, the
input-mute, the verbal-filler "thinking sound" contract, the raw_schema pattern, and the
explicit invocation conditions in every tool description are all best-practice. The
findings below are about the seams.

---

## 3.1 `__init__.py` — tool registry

`src/tools/__init__.py:17-43`. Conditional registration: 5 always-on tools + 4
availability tools gated on `deps["onboarding_complete"]`.

- **[OK]** Conditional gating keeps the function-declaration count low for un-onboarded
  tenants (best-practice: "limiting the number of function declarations"). Clean factory
  (`create_*_tool(deps)`) closure pattern, parity with the legacy JS `createTools(deps)`.
- **[LOW]** 9 declarations when onboarded. Within Gemini's tolerance, but each tool
  description is large (book_appointment's is ~900 chars). Total tool-schema payload is a
  fixed per-turn ingestion cost on a latency-sensitive model. No action needed now; flag
  if the declaration set grows.
- **[LOW]** No `end_call`-style "speak first" reminder is enforced structurally — relies
  entirely on prose. Acceptable given 3.1's API constraints (see 3.10).

**Approach verdict:** Correct and idiomatic. Keep.

---

## 3.2 `check_slot` — verify a concrete (date, time)

`src/tools/check_slot.py`. raw_schema with `required:[date,time]`, regex patterns for
`YYYY-MM-DD` and `HH:MM`, optional `urgency` enum (`check_slot.py:37-66`).

- **[OK]** **raw_schema is the right call here.** Moving the date/time shape and the
  required-fields contract into the OpenAPI schema (vs. prose) is exactly what Google's
  function-calling guide prescribes, and the module header (`check_slot.py:5-8`) correctly
  attributes the Phase 63.1-08/09/10 bug-class elimination to it. The serializer enforces
  structure before invocation.
- **[OK]** `mute_input_during_tool(deps)` called at entry (`:80`) before any await —
  correct ordering so the BLOCKING wait is covered from the first instant.
- **[OK]** Short STATE strings, `[63.1-DIAG]` entry/exit/exception logging with elapsed_ms
  and preview — strong observability per the LiveKit observability guidance.
- **[MEDIUM]** **Three STATE shapes coexist within this one tool.** Common path emits
  `STATE:slot_ok token=… speech=… | DIRECTIVE:…`; alternatives path emits a third pipe
  segment `… | ALTS: 1.<speech> token=…; 2.… | DIRECTIVE:…` (`:239-243`). The `ALTS:`
  sub-grammar is bespoke and only this tool produces it. The model must parse a numbered,
  semicolon-delimited, token-bearing list mid-string and map the caller's "the second one"
  back to the right `token=`. This is the most parse-fragile return in the codebase and a
  plausible source of wrong-token-to-book_appointment errors. **Rec:** consider returning
  at most 2 alternatives and labeling them as distinct `ALT1_token=`/`ALT2_token=` keys, or
  flattening to one offer at a time.
- **[LOW]** `urgency` is accepted but never used in `_impl` (it is read at `:76` and never
  passed downward). Dead parameter inflating the schema surface. **Rec:** remove from
  check_slot schema (urgency belongs on book_appointment, where it is used).
- **[LOW]** `requested_end` is computed then immediately `del`-ed (`:159-160`) — dead code
  kept "for readability." Remove.
- **[OK]** `register_slot_token` + `deps["_last_offered_token"]` stash (`:174-176`) is the
  defense-in-depth that book_appointment relies on. Sound.

**Approach verdict:** Strong. The `ALTS:` grammar is the one real risk.

---

## 3.3 `check_day` — yes/no for a date

`src/tools/check_day.py`. Single `date` arg, regex-validated; returns `day_has_slots` /
`day_empty`, never specific times (`:120-133`).

- **[OK]** Deliberately never returns times — the "caller must name an hour, then
  check_slot verifies" funnel is a clean way to prevent the model from reciting a slot list
  (which the prompt also forbids). Good division of responsibility.
- **[OK]** STATE format is the canonical `STATE:… | DIRECTIVE:…` pipe form. Consistent.
- **[LOW]** `_impl` re-validates `tenant_id`/`date` even though the wrapper already
  stripped them and the schema enforces presence — harmless belt-and-braces, matches the
  pattern across the file.

**Approach verdict:** Correct. Keep.

---

## 3.4 `next_available_days` — yes/no for the next 3 days

`src/tools/next_available_days.py`. No-arg tool, empty `properties:{}` schema (`:35-39`).

- **[OK]** No-args, no-times design is the right shape for the "whenever works" caller. The
  description's invocation condition ("Use only when the caller is vague about when") is
  exactly the explicit-condition best practice.
- **[MEDIUM]** **Hardcoded "next 3 days" is invisible to the tenant and the model.**
  `next_n_local_dates(3, …)` is a literal (`:88`). A business with sparse availability will
  frequently hit `no_near_availability` and route callers to capture_lead even when day 4-5
  is open. **Rec:** make the horizon a tenant config value (or at least a named constant
  with a comment on the tradeoff), and consider 7 days.
- **[LOW]** STATE has no machine fields beyond the verb (`STATE:has_near_availability`) —
  fine, since there's nothing to pass forward.

**Approach verdict:** Correct shape; the 3-day window is an arbitrary product constant
worth surfacing.

---

## 3.5 `book_appointment` — atomic booking (the heaviest tool)

`src/tools/book_appointment.py` (735 lines). Validates address (bounded HTTP), resolves
slot_token → authoritative UTC, atomic RPC, fire-and-forget calendar+SMS, verdict-driven
return.

- **[OK]** **slot_token resolution is the correct pattern** (`:316-372`). Treating the
  token as authoritative and *ignoring* any Gemini-reconstructed ISO is the right inversion
  of trust given the documented drift (8h-off naive-ISO bug). The token→UTC registry on
  `deps` is server-authoritative state the model cannot corrupt. This is materially better
  than trusting the model to echo ISO verbatim.
- **[OK]** `mute_input_during_tool` now called (`:274`) — prior-fix context confirms this
  was added; correct, since this is the longest-blocking tool.
- **[OK]** Idempotency is genuinely well done. The `_slot_key` cache (`:419-428`), the
  *synchronous* set-before-await of `_last_booked_slot_response` (`:639-644`, comment at
  `:605-610`), the late-duplicate guard (`:502-515`), and the once-per-call recovery-SMS
  latch (`:580-584`) collectively close the duplicate-side-effect window that voice
  double-invocation creates. This is the strongest idempotency in the codebase.
- **[OK]** Urgency normalization (`_normalize_urgency`, `:46-52`) is defense-in-depth
  against the documented CHECK-constraint violation even though the schema enum should
  prevent it. Belt-and-braces is justified here because Gemini has been observed bypassing
  enums.
- **[HIGH]** **`BOOKED [verdict=…]:` is a fourth, structurally distinct return format**
  (`:618-637`) — not `STATE:…|DIRECTIVE:…`, not the newline `STATE:\nDIRECTIVE:` form, but
  a bracketed-verb-with-embedded-`[verdict=…]` grammar. The prompt's ADDRESS VALIDATION
  CRITICAL RULE (`prompt.py:219-251`) keys speech behavior off the *substring*
  `verdict=validated` / `verdict=validated_with_corrections` / `verdict=unvalidated`. So the
  contract is: tool emits `verdict=validated`, prompt greps for `verdict=validated`. That
  coupling is load-bearing and **brittle**: the success message also embeds the
  human-readable address and time inside `[...]`, which the model is told NOT to read
  aloud verbatim but IS told to "relay." A model that reads the bracket contents verbatim
  leaks `[verdict=validated]` style tokens. See 3.11 for the cross-cutting recommendation.
- **[MEDIUM]** **Dead `slot_start`/`slot_end` fallback path retained** (`:255-261`,
  `:374-403`, `:391-403`). The raw_schema dropped these fields from the Gemini surface, so
  they are always `""` and the `_ensure_utc_iso` branch is unreachable. The wrapper comment
  admits it's dead and "can be removed in the next cycle." It is a large block of
  misleading code (with its own tz-coercion warnings) gated behind `if not _token_resolved`,
  which is now effectively `if token-was-invalid` — meaning the *only* time it runs is the
  expired/invalid-token error case, where slot_start is `""` and it returns
  `booking_invalid` anyway. **Rec:** delete the fallback; on invalid/expired token, return
  the `booking_invalid` STATE directly. Removing it eliminates a whole class of confusing
  "Gemini-supplied slot_start" log lines that can no longer occur.
- **[MEDIUM]** **Address validation HTTP (1.5s timeout) runs inside the blocking tool
  wait, serially before the atomic RPC** (`:298-307`). With mute active this is safe from
  VAD, but it adds up to 1.5s to a tool that also does the RPC + tenant fetch. Best-practice
  is to "consolidate external API calls." The validation is correctly placed *outside* the
  slot-lock window (good, per the D-B2 comment), but consider whether it can run
  concurrently with the tenant-config fetch (`:431-437`) via `asyncio.gather` to shave
  latency.
- **[OK]** Calendar push and confirmation SMS are truly fire-and-forget
  (`asyncio.create_task`, `:704-731`) with the explicit rationale that a slow awaited tool
  goes silent and invites duplicate invocation. Correct and well-reasoned.
- **[LOW]** `_tool_call_log` is written on both success and slot_taken (`:586-593`,
  `:662-669`) — good for post-call hallucination detection. Note this is the model that
  capture_lead should follow (see 3.6).

**Approach verdict:** The token registry and idempotency are best-in-class. The dead
fallback block and the `BOOKED`-format divergence are the cleanup/risk items.

---

## 3.6 `capture_lead` — lead/inquiry capture on decline

`src/tools/capture_lead.py`. Named-arg tool (not raw_schema), address validation,
`record_outcome` → inquiry, verdict-driven `LEAD CAPTURED [verdict=…]:` return.

- **[HIGH]** **capture_lead never writes to `_tool_call_log` — confirmed real gap.** Every
  other data-affecting tool logs (check_slot/day via `log_tool_call`, book_appointment
  inline). capture_lead's success and failure paths set `_last_tool_state` and return, but
  never `deps.setdefault("_tool_call_log", []).append(...)`. The post-call pipeline uses
  `_tool_call_log` for "silent hallucination detection" (`_availability_lib.py:559-563`).
  Consequence: a successful lead capture is invisible to post-call reconciliation/audit —
  if the model later claims "I've passed your details on" the audit cannot corroborate it,
  and a capture that the model narrates but the DB write silently failed cannot be
  cross-checked. **Rec:** append a `{"name":"capture_lead","success":bool,...}` entry on
  both branches, mirroring book_appointment.
- **[HIGH]** **A fifth STATE format** (`LEAD CAPTURED [verdict=…]:`, `:152-176`) — parallel
  to book_appointment's `BOOKED [verdict=…]:` but on the *failure* paths it switches BACK to
  `STATE:lead_capture_failed … | DIRECTIVE:…` pipe form (`:61-66, :108-114, :180-186`). So
  one tool emits two different grammars depending on success vs failure. This is the
  clearest case of the format-proliferation risk: the model sees `LEAD CAPTURED [verdict=…]`
  on success and `STATE:…|DIRECTIVE:…` on failure from the same call site.
- **[OK]** `mute_input_during_tool` at entry (`:55`) — correct, covers the validation HTTP +
  Supabase writes.
- **[MEDIUM]** **No idempotency guard.** Unlike book_appointment, a double-invocation of
  capture_lead (which voice double-firing makes likely) creates two inquiry rows / two
  `record_outcome` upserts. `record_outcome` may upsert the customer idempotently, but the
  inquiry insert is not guarded here. **Rec:** latch on `deps` (e.g.
  `_lead_captured_for_phone`) like the recovery-SMS latch.
- **[MEDIUM]** **`urgency="routine"` is hardcoded** in the `record_outcome` call (`:127`).
  An emergency caller who then declines to book is recorded as routine, losing the triage
  signal on the inquiry. **Rec:** thread inferred urgency through (the model already infers
  it for book_appointment).
- **[LOW]** Named-arg signature (not raw_schema) means no regex/required enforcement on
  `postal_code`/`phone`. Lower stakes than booking, but inconsistent with the availability
  tools. Acceptable.

**Approach verdict:** Functionally correct but the missing `_tool_call_log` write and the
missing idempotency latch are real gaps that book_appointment already solved — port those
patterns over.

---

## 3.7 `check_caller_history` — repeat-caller awareness

`src/tools/check_caller_history.py`. Pre-session fetch (`fetch_caller_history`) +
`format_caller_history_state` shared with the prompt; tool retained for mid-call queries.

- **[OK]** **Pre-fetching into the prompt and demoting the tool to on-demand is the right
  fix** for the documented 3-5s first-turn silent gap (Phase 62). This directly follows the
  "keep context small / avoid tool overload / don't block the first turn" guidance. The
  shared formatter (`format_caller_history_state`) keeps prompt-injection and tool-return
  byte-identical — excellent DRY.
- **[OK]** Three-state contract (`None`→failed, `{}`→first-time, dict→repeat) is clean and
  the directive correctly instructs "ask every question as if first time" + "do not recite
  history" — strong privacy posture.
- **[MEDIUM]** **The repeat-caller STATE uses the newline `STATE:…\nCONTEXT:…\n |
  DIRECTIVE:…` form** (`:190-201`) — a *sixth* shape, with an embedded multi-line
  `CONTEXT:` block of human-readable appointment/interaction lines. The model is told not to
  recite it, but the block literally contains spoken-style English ("- Tuesday, March 4th at
  123 Main St (confirmed)"), which is exactly the kind of content a realtime model is prone
  to read aloud. Putting human prose inside a "do not speak" block is the riskiest framing
  pattern in the prompt surface.
- **[OK]** `mute_input_during_tool` on the mid-call path (`:220`). Correct.
- **[LOW]** `jobs` interactions render `job_type` as "unspecified" because the jobs query
  doesn't select it (it doesn't exist on that table — noted in-code at `:104-107`). Honest,
  documented limitation.

**Approach verdict:** The pre-fetch architecture is exemplary. The human-prose-inside-a-
silent-block is a framing risk worth tightening.

---

## 3.8 `check_customer_account` — merged Jobber/Xero context

`src/tools/check_customer_account.py`. Re-serves pre-fetched `deps["customer_context"]`,
never re-fetches; privacy-first directive.

- **[OK]** Pre-fetch-then-re-serve (never fetch in-tool) is the correct latency design and
  matches caller-history. The `NO_MATCH_RESPONSE` locked string + per-field `_sources`
  provenance is clean.
- **[HIGH]** **A seventh STATE format** — this tool uses `STATE: <text>.\nDIRECTIVE: <text>`
  (newline-separated, space-after-colon, `:26-29, :95-102`), which differs from the
  availability tools' `STATE:foo | DIRECTIVE:bar` (pipe, no space). Two different
  STATE/DIRECTIVE punctuations in the same agent. A model trained-in-context on one
  delimiter may mis-segment the other.
- **[OK]** `mute_input_during_tool` (`:121`) and `_last_tool_state` capture for replay
  (`:131-132`) present. Correct.
- **[OK]** Strong privacy directive ("NEVER mention outstanding balance unprompted"). Good
  for a financial-data tool.

**Approach verdict:** Correct architecture; punctuation divergence feeds the format-
proliferation problem.

---

## 3.9 `transfer_call` — SIP REFER

`src/tools/transfer_call.py`. Named args, writes `exception_reason`, SIP transfer via
LiveKit API.

- **[OK]** Clear two-condition invocation rule in the description (explicit-human-request OR
  3 failed clarifications) — matches the best-practice example.
- **[MEDIUM]** **No `mute_input_during_tool`.** transfer_call awaits a DB update *and* a
  LiveKit API round-trip (`LiveKitAPI()` construction + `transfer_sip_participant`,
  `:54-81`) — a blocking, potentially multi-hundred-ms tool with no input mute. It is thus
  exposed to the same VAD-cancellation cascade the other tools guard against. Lower
  frequency than booking, but the failure mode is identical. **Rec:** add the mute.
- **[MEDIUM]** **No `_last_tool_state` set and no `_tool_call_log` entry.** If a transfer
  generation is server-cancelled, the replay machinery has nothing to replay (it reads
  `_last_tool_state`). **Rec:** set `deps["_last_tool_state"]` on each return.
- **[OK]** STATE returns use the pipe form, consistent with availability tools.
- **[LOW]** `api.LiveKitAPI()` is constructed per-call and `aclose()`d; fine, but a shared
  client would shave construction latency.

**Approach verdict:** Functionally fine but it is the one data/transfer tool left out of
both the mute and the replay-state contracts. Bring it into line.

---

## 3.10 `end_call` — graceful teardown

`src/tools/end_call.py`. Sets `call_end_reason`, schedules `_delayed_disconnect`, returns a
`STATE:call_ending | DIRECTIVE:…`.

- **[OK]** `_delayed_disconnect` using native `SpeechHandle.wait_for_playout()` (capped 20s)
  instead of a fixed sleep is the correct, version-native way to avoid cutting off the
  farewell — directly addresses the documented goodbye-truncation failure mode. Sentry
  breadcrumb + diag timestamp are good ops hooks.
- **[OK]** Handles the "participant already left" 404 as info-not-error (`:50-53`). Correct.
- **[OK]** `ctx.shutdown()` to trigger the post-call pipeline, with the explicit comment on
  why it's load-bearing (`:58-67`). Good — easy to accidentally omit.
- **[MEDIUM]** **The "speak farewell THEN call end_call in a separate turn" contract is
  prose-only** (description `:73-79` + the dedicated CRITICAL RULE in `prompt.py:1386-1410`).
  Because 3.1 gates `generate_reply`/`say`/`update_chat_ctx` closed (per the greeting
  section), there's no structural enforcement available — so prose is the only lever and
  the team knows it. This is an accepted constraint, not a defect; noted because it's the
  single most fragile spoken-behavior dependency in the whole agent and is worth a UAT
  guard.
- **[LOW]** No `mute_input_during_tool` — defensible, since the goal post-end_call is to let
  the farewell play and disconnect, not to converse.

**Approach verdict:** Best available given 3.1's API limits. Keep.

---

## 3.11 Cross-cutting: the STATE-string format proliferation

Across the tools, the agent now emits **at least seven distinct return grammars** that the
model must interpret as "machine directive, do not read aloud":

| Form | Example | Used by |
|------|---------|---------|
| `STATE:verb k=v \| DIRECTIVE:…` (pipe, no space) | `check_slot.py:185` | check_slot/day, next_available_days, book failures, transfer |
| `STATE:… \| ALTS: 1.<sp> token=…; … \| DIRECTIVE:…` | `check_slot.py:239` | check_slot alternatives |
| `STATE:repeat_caller …\nCONTEXT:\n<prose>\n \| DIRECTIVE:…` | `check_caller_history.py:190` | caller history (repeat) |
| `STATE: text.\nDIRECTIVE: text` (newline, space) | `check_customer_account.py:95` | customer account |
| `BOOKED [verdict=validated]: <imperative w/ [brackets]>` | `book_appointment.py:618` | book success |
| `LEAD CAPTURED [verdict=…]: …` | `capture_lead.py:152` | lead success |
| `STATE:lead_capture_failed … \| DIRECTIVE:…` | `capture_lead.py:61` | lead failures |

- **[HIGH]** This is a real risk, not a stylistic nit. The prompt's anti-recitation rules
  ("This tool's return is a state+directive string — do not read it aloud") were written for
  the `STATE:…|DIRECTIVE:…` shape. The `BOOKED [verdict=…]:` and `LEAD CAPTURED [verdict=…]:`
  shapes embed **human-readable, speakable** address/time inside `[...]` and instruct the
  model to "relay" them — straddling the do-not-read line. The `CONTEXT:` block embeds
  fully-formed spoken English. A realtime audio model under load (which Gemini 3.1 Flash
  Live demonstrably is, per the cascade history) is exactly the class of model most likely
  to leak `verdict=validated` or read a `CONTEXT:` line verbatim.
- **Rec (consolidate):** Pick ONE machine grammar — `STATE:<verb> <k=v>… | DIRECTIVE:<imperative>`
  — and convert all seven to it. Move human-readable values into named machine fields the
  DIRECTIVE *references by key* rather than embedding spoken prose: e.g.
  `STATE:booked verdict=validated addr_norm="…" speech="…" | DIRECTIVE:relay addr_norm and
  speech as confirmed; ask if anything else`. The verdict-substring coupling that
  `prompt._build_address_validation_section` depends on is preserved (still grep-able), but
  the model gets one consistent delimiter and a uniform "never speak the STATE half" rule.
  This is the single highest-leverage robustness change in this audit.

---

## 3.12 Cascade machinery — `mute_input_during_tool` + tool-result replay

`src/tools/_availability_lib.py:29-307`.

### `mute_input_during_tool` (`:56-204`)

- **[OK]** **This is the correct mitigation given the documented constraint.** Google's own
  capabilities guide confirms VAD cancels generation *and discards pending function calls*;
  3.1 has no async function calling to avoid the block. Client-side input detachment
  (`session.input.set_audio_enabled(False)`) is a legitimate, SDK-supported lever that
  needs no session-config mutation — so it works despite `mutable_chat_context=False`. There
  is no cleaner SDK-native path on 3.1 short of `behavior:NON_BLOCKING`, which 3.1 does not
  support. The header's reasoning is accurate and well-cited.
- **[OK]** Event-based unmute (wait for a *fresh* `*→speaking` then `speaking→listening`)
  rather than a fixed timer is the right design — the documented 10-14s readback would blow
  a fixed timer. The `thinking→speaking` fix (`:120`, comment `:116-119`) and the
  `_tool_mute_id` counter to prevent stale-unmute races are both sound.
- **[OK]** `_on_tools_executed` resetting `saw_fresh_speaking` on a recovery generation
  (`:134-156`) correctly distinguishes the cancelled cycle from the retry cycle.
- **[MEDIUM]** **The 25s fallback is a hard cap on caller mute.** If the event never fires
  and a stall isn't confirmed, the caller is muted up to 25s — an eternity on a phone call.
  The replay path mitigates the common case, but a non-stall hang (e.g. Gemini speaking past
  25s on a long readback, the exact scenario that pushed 15→25s) will clip the caller's
  input mid-conversation. This is an inherent tension of the approach; **Rec:** add a diag
  counter for "fallback fired with `saw_fresh_speaking=True`" (agent WAS speaking, we muted
  anyway) to quantify how often the cap harms live conversations.
- **[LOW]** Two listeners are registered per tool call and removed in `_unmute_logic`; under
  rapid sequential tool calls the supersede logic handles IDs, but listener accumulation on
  the session emitter is worth a periodic assert in tests.

### `_attempt_tool_result_replay` (`:207-307`)

- **[OK]** **The unconditional-`tool_results`-send insight is genuinely clever and correct.**
  The memory note and the in-code comment (`:222-227`) establish that `update_chat_ctx`'s
  tool_results path at `realtime_api.py:637-638` sends *unconditionally*, not gated on
  `mutable_chat_context` — so replaying a synthetic `FunctionCallOutput` re-injects the
  cancelled tool's result on 3.1 where normal chat-ctx mutation is blocked. This is the only
  known recovery from the cascade and it is a legitimate use of the private accessor.
- **[HIGH]** **It depends on private SDK internals: `session._activity.realtime_llm_session`
  and the `realtime_api.py:637-638` send behavior.** This is explicitly acknowledged in code,
  but it is a fragility CRITICAL to flag for upgrade-safety: any livekit-agents bump can
  rename `_activity`, change `realtime_llm_session`, or gate the tool_results send on
  `mutable_chat_context` — and the failure would be *silent* (the `except` at `:300-307` just
  increments a counter and logs a warning; the caller hears the cascade again). **Rec:**
  pin `livekit-agents` exactly, add a startup assertion that the accessor chain and the
  `update_chat_ctx` signature exist, and add a contract test that fails loudly on SDK drift.
  Track upstream for a public API (e.g. a supported `session.inject_tool_result`).
- **[OK]** The dual stall-confirmation (`saw_fresh_speaking` flag AND audio-frame quiescence
  with a 250ms grace, `:240-254`) correctly fixes the documented false-negative
  (residual-filler frames stamping `last_audio_frame_at` 15ms after mute). The state-flag-
  as-truth-source amendment is the right call.
- **[MEDIUM]** Replay sends the result but cannot *force* a new generation on 3.1 (which
  gates `generate_reply`). It relies on the unmuted caller's next utterance — or the
  server's own resumption — to trigger speech. So replay re-arms the context but recovery
  still hinges on conversational luck. This is an inherent 3.1 limitation; documented, but
  worth stating as a known ceiling.

**Approach verdict on the machinery:** Best available on 3.1. The two MEDIUM/HIGH items are
about *durability* (private-accessor drift, mute-cap harm), not correctness.

### `slot_token` registry + TTL (`:317-335`)

- **[OK]** **The right pattern, and better than the alternatives.** A 32-bit opaque token
  bound server-side to `(slot_start_utc, slot_end_utc)` with a 600s TTL solves the exact
  documented failure: the model reconstructing naive ISO from spoken wall-clock and shifting
  the booking by the tz offset. Alternatives are worse: (a) trusting the model to echo ISO
  verbatim — already proven to fail; (b) a stateful "current slot" with no token — breaks on
  the alternatives branch where the caller picks among several; (c) re-deriving the slot in
  book_appointment from date/time — re-introduces the parse/tz risk the token removes. The
  token + `_last_offered_token` fallback is the correct minimal design.
- **[LOW]** Token TTL (600s) vs slot-cache TTL (30s) are independent constants; a token can
  outlive the cache that minted it, but book_appointment re-validates via the atomic RPC, so
  a stale token simply fails the booking cleanly. Acceptable.
- **[LOW]** `secrets.token_hex(4)` = 32 bits; collision-proof for ~10 tokens/call as the
  comment states. Fine. (Tokens are per-call in-memory, not cross-call, so no enumeration
  concern.)

---

## 3.13 `prompt.py` — `build_system_prompt` assembly & philosophy

`src/prompt.py:1416-1491`. 16 section builders, locale-aware (en/es), assembled with
`"\n\n".join`, empties filtered.

- **[OK]** **Section ordering matches Google's persona→rules→guardrails guidance.** Identity
  (persona) → voice/corrections/address-validation/outcome-words (guardrails) →
  call-duration/tool-narration (operational rules) → working-hours/greeting/language →
  context injections → info-gathering → booking → decline → transfer. The deliberate move of
  call_duration "up into the CRITICAL RULE attention zone" (`:1466`) reflects real
  attention-budget tuning for a realtime model.
- **[OK]** **STATE+DIRECTIVE philosophy is sound and explicitly outcome-based** (module
  docstring `:1-8`: "describe desired outcomes, not exact scripts"). This is the correct
  posture for realtime audio per both Google's best-practices and the project's own
  hard-won memory (directive prompts + silence license → deadlock). The "UNMISTAKABLE
  INVARIANT" anti-fabrication clause in identity (`:61-65`) and the OUTCOME WORDS section
  with the concrete 3pm failure-mode example (`:338-347`) are textbook realtime anti-
  hallucination framing.
- **[OK]** **name-once policy** (`:939-961`) is precise and outcome-framed: capture silently,
  speak only at the booking readback, explicit forbidden-vocative list, explicit opt-in
  override. Strong.
- **[OK]** **single-question address intake** (`:962-971`) correctly frames "ask one natural
  question, loop one targeted follow-up at a time, never recite a field list" — matches the
  "delineate one-time elements vs loops" guidance.
- **[OK]** **booking readback** (`:1254-1267`) name-then-address-in-one-utterance, correction
  loop, name-optional — the single authoritative verification moment. Well-designed.
- **[OK]** **intake_questions injection framing** (`:1031-1041`) — the delimited
  `<<<INTAKE_TOPICS … >>>END_INTAKE_TOPICS` "topics not instructions" frame is a correct
  prompt-injection mitigation for tenant-authored text (prior-fix context confirms this was
  just added). Good. **[LOW]** the delimiters are guessable; a tenant who literally types
  `>>>END_INTAKE_TOPICS` could break out. Low risk, but consider a random per-call nonce in
  the fence.
- **[MEDIUM]** **The prompt is very large and heavily negated.** Multiple CRITICAL-RULE
  blocks (corrections, address-validation, outcome-words, tool-narration, customer-context,
  no-double-booking, ending-the-call) each repeat NEVER/DO-NOT invariants. The in-code audit
  comments themselves flag "heavy negation usage" and "D6 token economy ✗ deferred"
  repeatedly. On a realtime model, prompt length is a per-turn ingestion cost and competing-
  instruction risk. The team has consciously chosen safety over brevity (defensible given
  the fabrication stakes), but this is the standing tension. **Rec:** the format-
  consolidation in 3.11 would let several "do not read the tool string aloud" repetitions
  collapse into one rule, reclaiming budget without weakening guardrails.
- **[MEDIUM]** **outcome-words / silence handling is correct but rests entirely on prose.**
  "Silence between your filler phrase and the tool result is acceptable. A fabricated
  confirmation is not." (`:335-336`) plus the tool-narration "filler is a contract" rule are
  the *only* things preventing the model from speaking machine tokens or fabricating — there
  is no structural backstop (3.1 won't allow one). The mute machinery protects the tool from
  VAD, but nothing protects the *caller's ears* from the model reading a STATE string except
  these prose rules. This raises the stakes of 3.11 (fewer, cleaner formats = the prose rule
  is easier for the model to obey).
- **[LOW]** **Locale parity is carried by hand-mirrored ES branches in every builder.** This
  is correct today but doubles the surface for every prompt change and is a standing
  drift risk (the in-code comments already note ES register inconsistency — TÚ vs USTED —
  across `_build_outcome_words_section` vs others, `:269-277`). Test coverage exists for
  parity shape; the register inconsistency is acknowledged tech-debt.
- **[OK]** `_build_greeting_section` (`:596-618`) correctly encodes that the branded greeting
  is played by a separate TTS pipeline (because 3.1 gates all "speak first" APIs) and tells
  the model not to re-greet — a non-obvious but necessary instruction given
  `mutable_chat_context=False`. Good.

**Approach verdict:** The prompt philosophy is right and well-executed for a realtime audio
model. Its two systemic risks are length/negation density and total reliance on prose to
prevent token-leakage — both of which the 3.11 format consolidation would materially ease.

---

## 3.14 Test debt (noted, not re-litigated)

Per the task's prior-fix context: `test_slot_token_handoff`,
`test_check_availability_slot_cache`, and `test_tenant_timezone_fallback` are known-broken
from the `check_availability` → check_slot/check_day/next_available_days split. These should
be rewritten against the three new tools (the slot_token handoff and slot_cache behaviors
still exist, just relocated to `_availability_lib` + `check_slot`). Flagging as test-debt;
the underlying behaviors are covered by the live code paths audited above.

---

## Top recommendations (priority order)

1. **[HIGH] Consolidate the 7 STATE-string grammars into one** (`STATE:<verb> k=v… |
   DIRECTIVE:…`), moving all human-readable/speakable values into named machine fields the
   DIRECTIVE references by key. Eliminates the `BOOKED [verdict=…]` / `LEAD CAPTURED` /
   `CONTEXT:`-prose token-leak surface and lets the prompt collapse repeated "don't read the
   tool string" rules. Preserve the `verdict=…` substring so the address-validation rule
   still matches. (§3.11, §3.5, §3.6, §3.7, §3.8)
2. **[HIGH] Add `_tool_call_log` writes to capture_lead** on both success and failure, to
   restore post-call hallucination-detection/reconciliation parity with book_appointment.
   (§3.6)
3. **[HIGH] Harden the private-accessor replay path against SDK drift**: pin
   livekit-agents, add a startup assertion on `session._activity.realtime_llm_session` +
   `update_chat_ctx`, and a contract test that fails loudly. The failure mode today is
   silent (caller re-hears the cascade). (§3.12)
4. **[MEDIUM] Delete book_appointment's dead `slot_start`/`slot_end` fallback block**;
   return `booking_invalid` directly on invalid/expired token. Removes a misleading,
   unreachable tz-coercion path and its phantom log lines. (§3.5)
5. **[MEDIUM] Bring transfer_call into the mute + replay contract**: add
   `mute_input_during_tool` and set `_last_tool_state` on every return. It is the only
   blocking data tool exposed to the VAD cascade with no protection. (§3.9)
6. **[MEDIUM] Add idempotency latch + real urgency to capture_lead** (double-invocation
   creates duplicate inquiries; urgency is hardcoded `routine`, losing triage signal). (§3.6)
7. **[MEDIUM] Surface the `next_available_days` 3-day horizon as tenant config** (currently
   an invisible literal that routes callers to capture_lead prematurely). (§3.4)
8. **[MEDIUM] Reduce the check_slot `ALTS:` grammar to ≤2 distinctly-keyed alternatives** to
   cut the wrong-token-to-book risk. (§3.2)
9. **[LOW] Drop the unused `urgency` arg from check_slot and the `requested_end` dead var.**
   (§3.2)
10. **[LOW] Rewrite the 3 split-orphaned tests** against the new availability tools. (§3.14)

## Sources

- [Gemini Live API — Tool use](https://ai.google.dev/gemini-api/docs/live-api/tools)
- [Gemini Live API — Capabilities (VAD/interruption)](https://ai.google.dev/gemini-api/docs/live-api/capabilities)
- [Gemini Live API — Best practices](https://ai.google.dev/gemini-api/docs/live-api/best-practices)
- [Gemini API — Function calling](https://ai.google.dev/gemini-api/docs/function-calling)
- [Vertex AI — Live API best practices](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api/best-practices)
- [LiveKit — Understand and Improve Voice Agent Latency](https://livekit.com/blog/understand-and-improve-agent-latency)
- [LiveKit Agents — GitHub](https://github.com/livekit/agents)


---

# 4. Scheduling, Booking & Calendar

Deep audit of the path that turns a Voco call into a confirmed appointment, across both repos:

- **agent** = `C:/Users/leheh/.Projects/livekit-agent` (Python — slot math, booking RPC call, tz handling)
- **dashboard** = `C:/Users/leheh/.Projects/homeservice_agent` (Next.js — slot-calculator, `book_appointment_atomic` RPC, Google/Outlook OAuth/sync/webhooks, travel buffers, zones, cron)

Scope notes honored: region short-circuit + deps country (address validation) are **already fixed** elsewhere and are not re-reported. Phase 60.4 timezone work is **paused/known** — but its root cause (server-local-parse fragility) is documented here because it materially affects correctness and the dual-implementation analysis below.

---

## Severity legend

- **[CRITICAL]** — silent wrong bookings or silent sync death in production-plausible configs.
- **[HIGH]** — data loss / missed events / security gap under realistic conditions.
- **[MEDIUM]** — divergence, latent bug, or correctness gap behind a guard.
- **[LOW]** — hygiene / doc drift.

---

## 4.1 Dual slot-math implementations — JS vs Python divergence

**Code**
- JS: `src/lib/scheduling/slot-calculator.js` (`calculateAvailableSlots`, `localTimeToUTC` line 21-26).
- Python: `livekit-agent/src/lib/slot_calculator.py` (`calculate_available_slots`, `_local_time_to_utc` line 24-32).

There are **two hand-ported implementations of the same algorithm**. The agent (the path that actually books calls) runs the **Python** one (`_availability_lib.calc_slots_for_dates` → `calculate_available_slots`). The JS one runs only in dashboard server routes (`/api/appointments` conflict/buffer view) and any JS-side recompute. They are line-for-line "ported … same behavior" by intent — but they are **not** behaviorally identical, and they can silently drift.

### 4.1a [CRITICAL] JS timezone construction is server-locale-dependent; Python is correct

The Python builder is correct:

```python
# slot_calculator.py:31-32
local_dt = datetime(year, month, day, hours, minutes, 0, tzinfo=ZoneInfo(tz))
return local_dt.astimezone(timezone.utc)
```

The JS builder is **double-converting through the server's local timezone**:

```js
// slot-calculator.js:24-25
const localDatetime = new Date(`${dateStr}T${hh}:${mm}:00`);   // parsed in SERVER-LOCAL tz
return fromZonedTime(localDatetime, timezone);                 // re-interprets wall-clock as tenant tz
```

`new Date("2026-06-10T09:00:00")` (no offset, no `Z`) is parsed in the **Node process's local timezone**, producing a `Date` whose UTC instant depends on `TZ`. `fromZonedTime(date, tz)` then reads back the **local wall-clock fields of that Date** and treats them as `tz`. The net result is correct **only when the server's local tz is UTC** (because then the wall-clock fields survive the first parse unchanged). On any host where `TZ` is not UTC, every offered slot is shifted by the server's UTC offset.

- Best-practice: store/compute in UTC, but construct instants from an explicit IANA zone — never parse an offset-less string and rely on ambient locale. The "double conversion" pitfall is exactly the loss of the original zone identifier ([tinybird](https://www.tinybird.co/blog/database-timestamps-timezones), [CodeOpinion](https://codeopinion.com/just-store-utc-not-so-fast-handling-time-zones-is-complicated/), [IANA tz db](https://www.iana.org/time-zones)).
- **Approach verdict: Broken-but-masked.** Today it is masked because the dashboard runs on Vercel/Railway where `TZ=UTC`. It is a latent correctness landmine: any move to a non-UTC runtime, a local dev box, or a future edge runtime silently shifts every JS-computed slot. This is the same server-local-parse fragility the paused Phase 60.4 was chartered to fix — confirming that work is still needed.
- **Recommendation [CRITICAL]:** rewrite `localTimeToUTC` to mirror Python — build the instant directly from the zone (e.g. `fromZonedTime(\`${dateStr}T${time}:00\`, timezone)` passing the **string** so date-fns-tz interprets the wall-clock in `timezone`, not via an intermediate locale-parsed `Date`). Add a unit test pinned under `TZ=America/Chicago` to prove parity with the Python output.

### 4.1b [HIGH] Two implementations, no shared contract, no parity test

The only thing keeping these two in sync is developer discipline ("ported … same behavior" headers in both files). There is no golden-vector test asserting `calculateAvailableSlots(JS) === calculate_available_slots(PY)` for a fixed fixture. They have **already diverged** (4.1a). Any future change to buffer rules, lunch handling, or the "today" cursor must be made twice.

- **Approach verdict: Acceptable-but-fragile.** Re-implementing in two languages is sometimes unavoidable (the agent can't call a JS module cheaply mid-call), but there is no guardrail.
- **Recommendation [HIGH]:** add a shared JSON fixture (inputs → expected slots) checked into both repos, with a test on each side that loads it and asserts equality. Treat the fixture as the contract.

### 4.1c [MEDIUM] `book_appointment`'s slot_taken recompute omits `calendar_blocks`

**Code:** `livekit-agent/src/tools/book_appointment.py:520-561`. When `atomic_book_slot` returns `slot_taken`, the tool recomputes the next available slot by re-fetching `appointments`, `calendar_events`, `service_zones`, `zone_travel_buffers` — but **not** `calendar_blocks`:

```python
# book_appointment.py:551-561
next_slots = calculate_available_slots(
    ...,
    external_blocks=current_events.data or [],   # calendar_events only — calendar_blocks MISSING
    ...
)
```

Contrast the primary availability path `_availability_lib.calc_slots_for_dates` (line 532) which correctly passes `external_blocks=sched["calendar_events"] + sched["calendar_blocks"]`. So the "next available" suggested after a race **can land inside an owner's lunch/vacation block** that the normal `check_slot` would have excluded. It is only a *suggestion* string (the caller must then `check_slot` it, which would reject it), so it is contained — but it produces a confusing "how about 12:30?" when 12:30 is blocked.

- **Approach verdict: Inconsistent.** The recompute is a second, partial copy of the fetch logic that has already drifted from the canonical `fetch_scheduling_data`.
- **Recommendation [MEDIUM]:** reuse `fetch_scheduling_data(deps)` (it already unions blocks and is cache-aware) instead of the bespoke 4-table `asyncio.gather`. Removes the omission and the duplicate query.

---

## 4.2 Atomic booking RPC — 3-layer concurrency defense

**Code:** `supabase/migrations/062_phase61_address_validation.sql:136-200` (current 17-arg RPC), `025_fix_book_appointment_atomic.sql` (prior body), `019_appointments_exclusion_constraint.sql` (the GiST exclusion constraint). JS wrapper `src/lib/scheduling/booking.js`; Python wrapper `livekit-agent/src/lib/booking.py`.

The defense is genuinely 3-layer and the **layering is sound and best-practice**:

1. **Advisory xact lock** — `pg_try_advisory_xact_lock(hashtext(tenant || epoch(start)))` (non-blocking → immediate `slot_taken` under contention, no queue buildup).
2. **In-RPC `tstzrange && tstzrange` overlap count** on non-cancelled rows.
3. **GiST exclusion constraint** `appointments_no_overlap EXCLUDE USING gist (tenant_id WITH =, tstzrange(start_time,end_time,'[)') WITH &&) WHERE (status <> 'cancelled')` — the DB-level catch-all.

- Best-practice: a GiST exclusion constraint over a `tstzrange` is *the* canonical Postgres answer to double-booking; it is atomic regardless of how many concurrent txns run and protects code paths you haven't thought of ([PostgreSQL range types docs](https://www.postgresql.org/docs/current/rangetypes.html), [amitavroy](https://amitavroy.com/articles/postgresql-gist-exclusion-constraintthe-database-evel-answer-to-double-bookings), [Citus — constraints as last line of defense](https://www.citusdata.com/blog/2018/03/19/postgres-database-constraints/)).
- **Approach verdict: Best-practice.** Migration 019 correctly *replaced* the old `UNIQUE(tenant_id, start_time)` with the partial exclusion constraint — this fixed two real bugs the skill doc still misstates (see 4.7): the UNIQUE only blocked identical start times and **blocked re-booking a cancelled slot**.

### 4.2a [MEDIUM] Advisory-lock key only collides on identical start instants

`v_lock_key := hashtext(tenant || epoch(start))`. Two **overlapping but differently-aligned** slots (09:00–10:00 vs 09:30–10:30, e.g. variable slot durations or a manual 30-min appt) hash to **different** keys, so the advisory lock provides **zero** mutual exclusion for them. They fall through to layers 2+3. Layer 2 (the count) is *not* itself a lock — two txns can both read count=0 before either inserts — so for non-identical overlaps the **only** true guarantee is layer 3 (the exclusion constraint).

That's still safe (layer 3 is bulletproof), but it means layer 1 is doing less than the design implies, and a layer-3 violation surfaces to the Python agent as a raw exception → `STATE:booking_failed reason=rpc_error` (book_appointment.py:483-492), i.e. a generic apology rather than the nicer `slot_taken` + next-available flow.

- **Recommendation [MEDIUM]:** either (a) catch SQLSTATE `23P01` (exclusion_violation) inside the RPC and return `{success:false, reason:'slot_taken'}` so the agent runs the graceful path, or (b) accept layer 1 as best-effort and document that overlapping-non-identical races degrade to a generic failure. (a) is preferred — it makes the agent UX correct for every overlap shape.

### 4.2b [MEDIUM] In-call idempotency is solid; cross-call/retry idempotency is absent

In-call duplicate protection is good: `deps["_last_booked_slot_key"]` + `_last_booked_slot_response` (book_appointment.py:419-428, 502-515, 639-644) returns the cached confirmation on a re-invocation of the same slot and prevents a spurious second recovery SMS. This is set **synchronously before any await**, which correctly closes the prior ~100-200ms race window (noted in the in-code comment at 605-610).

However there is **no idempotency key persisted at the RPC/DB level**. If the same logical booking is retried across a process restart, a reconnected session, or the post-call reconciliation path, the only thing preventing a second row is the exclusion constraint (which would reject the *same* slot, good) — but the agent would interpret that rejection as `slot_taken` for a slot the *same caller* already holds. The late-duplicate guard (502-515) only fires when `_last_booked_slot_key` is still in memory.

- Best-practice for reservation systems: carry a client-supplied idempotency key into the reservation insert so retries are first-class, not inferred.
- **Recommendation [MEDIUM]:** add a nullable `booking_idempotency_key` (e.g. `call_id|slot_start`) with a partial unique index, and have the RPC `ON CONFLICT DO NOTHING … RETURNING` the existing row's id as success. Makes retries safe across memory loss.

### 4.2c [LOW] `extract(epoch …)` float in the lock key

`extract(epoch from p_start_time)::text` yields a float string; fine for hashing but brittle if sub-second precision ever varies between two callers for "the same" slot. Slots are minute-aligned today so this is theoretical. Low.

---

## 4.3 Lead-time / min-notice enforcement

**Code:** `livekit-agent/src/tools/check_slot.py:142-150` — a 1-hour minimum-notice guard:

```python
if requested_utc < now_utc + timedelta(hours=1) and date == today_local:
    return "STATE:too_soon … min_notice=1h …"
```

### 4.3a [HIGH] Min-notice is enforced **only** in `check_slot`, not in `book_appointment` or the RPC

`book_appointment` trusts the `slot_token` and never re-checks min-notice or even that the slot is still in the future. A `slot_token` lives **600s** (`SLOT_TOKEN_TTL_S`, `_availability_lib.py:318`). A caller can `check_slot` a 9:00 slot at 8:45 (passes — >1h? no; but a slot offered earlier in the call), keep talking, and `book_appointment` at 8:58 still books it. More concretely: the token TTL (10 min) plus a long booking conversation means a slot can be booked with **well under** the 1h notice the business configured, or even slightly in the past, because the only forward-time guards (`window_end <= now`, "today cursor") live in the **slot calculator**, not in the booking tool.

- **Approach verdict: Gap.** The business rule (1h notice) is a `check_slot`-only UX nicety, not an invariant. The DB has no min-notice or no-past-time constraint at all.
- **Recommendation [HIGH]:** re-validate `slot_start >= now + min_notice` inside `book_appointment` right after token resolution (cheap, no fetch), returning the same `too_soon` STATE. Optionally add a DB CHECK that `start_time > created_at`. Also consider shortening `SLOT_TOKEN_TTL_S` — 10 min is long for a live call.

### 4.3b [LOW] Min-notice is hard-coded to 1h, not tenant-configurable

The 1h is a literal in `check_slot.py:143`. Emergency plumbers may want 0; others may want same-day cutoff. No `min_notice_mins` column exists. Low — but worth a backlog note since working_hours is already tenant-configurable.

---

## 4.4 Google Calendar OAuth / sync / webhook

**Code:** `src/lib/scheduling/google-calendar.js`, `src/lib/webhooks/google-calendar-push.js`.

### 4.4a [HIGH] Google push webhook is unauthenticated — tenantId is attacker-controllable

```js
// google-calendar-push.js:16-28
const tenantId = request.headers.get('X-Goog-Channel-Token');   // attacker-settable
if (state === 'exists' && tenantId) { await syncCalendarEvents(tenantId); }
```

The handler trusts `X-Goog-Channel-Token` (the tenantId we set at watch time) **without verifying it against the stored channel**. Unlike the Outlook handler — which validates `clientState === OUTLOOK_WEBHOOK_SECRET` (outlook-calendar-push.js:24) — the Google handler has **no shared secret and no channel-id lookup**. Anyone who can reach `/api/webhooks/google-calendar` and guess/enumerate a tenant UUID can force unauthenticated calendar syncs for that tenant (resource exhaustion / forced Google-API quota burn; not direct data exfiltration since it only pulls into the tenant's own mirror).

- Best-practice: Google push carries no payload; you must bind notifications to your channel. The standard pattern is to set `token` to an unguessable secret (or `tenantId:hmac`) and verify it, and/or look up the row by `X-Goog-Channel-ID`/`X-Goog-Resource-ID` ([Google push notifications guide](https://developers.google.com/workspace/calendar/api/guides/push), [Nango real-time integration](https://nango.dev/blog/how-to-build-a-real-time-google-calendar-api-integration/)).
- **Approach verdict: Insecure.** The dashboard already HMAC-signs Google OAuth *state* (`signOAuthState`) — the same primitive should protect the watch token.
- **Recommendation [HIGH]:** set the watch `token` to `signOAuthState(tenantId)` (or look up the credential row by `X-Goog-Channel-ID` header = stored `watch_channel_id`) and reject notifications that don't verify. Cheap, mirrors Outlook's clientState model.

### 4.4b [HIGH] Google sync does not page — events beyond one page are silently dropped

```js
// google-calendar.js:199-228 — single events.list call, no nextPageToken loop
const response = await calendar.events.list({ syncToken: ... });
items = response.data.items || [];
nextSyncToken = response.data.nextSyncToken;
```

Neither the incremental nor the full-sync branch follows `response.data.nextPageToken`. Google paginates `events.list`; when there are more results, Google returns a `nextPageToken` and **withholds `nextSyncToken` until the last page**. Consequences:
1. A busy calendar (>1 page of changes, or full-sync >2500 events) has later pages **dropped from the mirror** — those events never block slots, so the AI can double-book over a real calendar event.
2. Because `nextSyncToken` is only present on the final page, a multi-page response may yield **no sync token**, so the next run can't go incremental and silently re-full-syncs (or, given the `!nextSyncToken && items.length===0` gate at line 216, behaves unpredictably).

- Best-practice: loop on `nextPageToken` until absent, then persist `nextSyncToken` from the final page; combine push notifications with periodic incremental sync because push is explicitly *not 100% reliable* ([Google push guide](https://developers.google.com/workspace/calendar/api/guides/push), [ensolvers sync walkthrough](https://www.ensolvers.com/post/implementing-calendar-synchronization-with-google-calendar-api)).
- **Approach verdict: Incomplete.** Outlook's sync **does** page correctly (`while (url) { … url = data['@odata.nextLink'] }`, outlook-calendar.js:283-290) — Google was left half-implemented.
- **Recommendation [HIGH]:** add the `nextPageToken` loop in both branches; only persist `nextSyncToken` after the loop terminates.

### 4.4c [MEDIUM] `singleEvents:true` on full sync but not on incremental → recurring-event drift

Full sync passes `singleEvents:true` (line 224) so recurrence expands to instances. The incremental branch (line 199-202) does **not** pass `singleEvents`. After the first token-based incremental run, a changed recurring series can come back as a master/recurrence object whose `start.dateTime` is the *series* start, mirrored as a single bogus `calendar_events` row. Recurring events are an edge case for this user base (contractors), but a recurring personal block on the owner's calendar is plausible.

- **Recommendation [MEDIUM]:** pass `singleEvents:true` consistently; the syncToken must be obtained with the same `singleEvents` setting it will be used with (Google requires parameter stability across a sync-token session).

### 4.4d [LOW] No reconciliation poll; push-drop = silent gap until next change

There is no periodic incremental sync — the mirror only updates on a push (and pushes are "not 100% reliable") or on the next booking's fetch. A dropped push means a deleted external event keeps blocking a slot (or a new one fails to block) until the *next* push fires. The `renew-calendar-channels` cron only renews watches; it doesn't sync.

- **Recommendation [LOW→MEDIUM]:** add a cheap periodic `syncCalendarEvents`/`syncOutlookCalendarEvents` sweep (hourly) for credentials with stale `last_synced_at`. This is the documented hybrid (webhook + poll) pattern.

---

## 4.5 Outlook Calendar OAuth / delta sync / subscription

**Code:** `src/lib/scheduling/outlook-calendar.js`, `src/lib/webhooks/outlook-calendar-push.js`.

Strengths: delta sync **pages correctly** (4.4b contrast); token refresh uses a **direct POST** to the token endpoint rather than MSAL's in-memory cache (correct for serverless — MSAL `acquireTokenSilent` would miss on cold starts, outlook-calendar.js:108-129); webhook validates `clientState` (outlook-calendar-push.js:24).

### 4.5a [CRITICAL] Subscription expiry set to 7 days, but Graph caps calendar events at ~3 days → silent sync death

```js
// outlook-calendar.js:215 (create) and :360 (renew)
const expirationDateTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
```

Microsoft Graph's **maximum subscription length for `/me/events` is ~4230 minutes (≈ 2.94 days)**, not 7 days ([subscription resource type](https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0), [Outlook change-notifications overview](https://learn.microsoft.com/en-us/graph/outlook-change-notifications-overview), [Voitanos best practices](https://www.voitanos.io/blog/microsoft-graph-webhook-delta-query/)). Two failure modes, both bad:
1. Graph **rejects** the create/renew with 400 (expiration too far in the future) → subscription never created/renewed → **no Outlook push notifications at all**, and the create path's error isn't surfaced to the user.
2. Even if Graph clamps, the code **writes 7-day `watch_expiration` to the DB** (line 233, 371). The renewal cron only renews credentials where `watch_expiration < now + 24h` (renew-calendar-channels/route.js:27-36). Believing the sub lives 7 days, the cron won't renew until day 6 — but the real subscription **died at ~day 3**. Result: **Outlook calendar sync silently stops after ~3 days** for every tenant, with no error.

- **Approach verdict: Broken.** This is the single highest-impact calendar bug found. It's invisible because the DB's expiry tracking is internally consistent — just wrong relative to Graph.
- **Recommendation [CRITICAL]:** set expiration to `< 4230 min` (use the documented max minus a margin, e.g. 4000 min ≈ 2.78 days), **read back the actual `expirationDateTime` Graph returns** and store *that* (not the requested value), and make the renewal cron run with a lookahead that covers a ~3-day TTL (it already runs daily, which is fine **once the stored expiry is truthful**). Surface create/renew 400s to the user as a reconnect prompt.

### 4.5b [MEDIUM] No Graph lifecycle-notification handling (`reauthorizationRequired` / `subscriptionRemoved`)

Graph sends **lifecycle notifications** (separate from change notifications) when a subscription needs reauthorization or was removed (token expiry, tenant policy, missed renewals). The subscription is created without a `lifecycleNotificationUrl`, and the webhook handler only processes `body.value[].clientState` change notifications. So when Graph proactively signals "renew me / reauth me," Voco never hears it and the sub lapses.

- Best-practice: subscribe a `lifecycleNotificationUrl` and handle `reauthorizationRequired`/`subscriptionRemoved` ([Voitanos webhooks + delta best practices](https://www.voitanos.io/blog/microsoft-graph-webhook-delta-query/), [MS Q&A — maintaining subscriptions](https://learn.microsoft.com/en-us/answers/questions/5571246/best-practices-for-maintaining-calendar-mail-subsc)).
- **Recommendation [MEDIUM]:** add `lifecycleNotificationUrl` and handle the two lifecycle events (renew on `reauthorizationRequired`, flag-for-reconnect on `subscriptionRemoved`).

### 4.5c [MEDIUM] Outlook delta start/end times may arrive in non-tenant tz without a `Prefer` header

`calendarView/delta` (outlook-calendar.js:276) is called without `Prefer: outlook.timezone="UTC"` (or the tenant tz). Graph returns `start.dateTime`/`end.dateTime` in the **user's default mailbox timezone** with `start.timeZone` indicating which — but the mirror upsert (line 300-301) stores `evt.start.dateTime` **dropping `start.timeZone`**, then the slot calculator parses it as if UTC (`_parse_iso`). If the mailbox default isn't UTC, mirrored external blocks are offset → wrong slots blocked/freed.

- **Recommendation [MEDIUM]:** send `Prefer: outlook.timezone="UTC"` on the delta request (Graph then returns UTC dateTimes), or persist `start.timeZone` and convert. Pairs with the Google all-day handling.

### 4.5d [LOW] All-day event time handling differs Google vs Outlook

Google mirror uses `evt.start?.dateTime || evt.start?.date` + `is_all_day: !evt.start?.dateTime` (google-calendar.js:239-241); Outlook uses `evt.start?.dateTime || evt.start?.date` + `is_all_day: evt.isAllDay` (outlook-calendar.js:300-302). For all-day events `start.date` is a bare `YYYY-MM-DD`; `_parse_iso("2026-06-10")` → midnight **UTC**, which for a tenant west of UTC means the all-day block covers the wrong local day boundary. Low frequency but a real off-by-one for all-day blocks.

---

## 4.6 Cron — channel/subscription renewal

**Code:** `src/app/api/cron/renew-calendar-channels/route.js`. Auth via `Bearer CRON_SECRET` (correct). Runs daily 02:00 UTC (per `vercel.json`/skill).

- **Approach verdict: Correct in structure, undermined by 4.5a.** The 24h-lookahead daily cadence is fine **for a truthful 7-day Google TTL** and **would be fine for a 3-day Outlook TTL** — *if* the stored `watch_expiration` reflected reality. Because Outlook stores a fictional 7-day expiry (4.5a), the cutoff filter (`watch_expiration < now+24h`) won't select dead-but-DB-says-alive Outlook subs until day 6. **Fixing 4.5a fixes the cron's correctness too.**
- [LOW] The query has no `tenant`/error isolation beyond per-row try/catch (good), but a single tenant's repeated `registerWatch` failure (e.g. revoked Google token) just logs and retries daily forever with no dead-lettering. Recommendation [LOW]: after N consecutive renew failures, mark the credential `needs_reconnect` and surface in the dashboard (the Reconnect banner already exists per the integrations skill).

---

## 4.7 Booking readback + validated-address columns onto appointments

**Code:** `book_appointment.py:298-314` (validate → conditional overwrite), `:611-644` (verdict-driven STATE), migration `062_phase61_address_validation.sql:35-48` (6 nullable cols on `appointments`), `atomic_book_slot` passthrough (`booking.py:43-49`, RPC INSERT `062:182-196`).

This part is **well-built**:
- Address validation runs **before** `atomic_book_slot` and **outside** the slot-lock window (correct — no external HTTP inside the contention path), with a 1.5s bounded timeout, and **every verdict proceeds to booking** (booking never blocks on Google).
- `service_address` is overwritten with the normalized form **only** on `confirmed`/`confirmed_with_changes` (`:309-314`) — unverified addresses keep the caller's spoken string. Good.
- The return is a **verdict-driven STATE+DIRECTIVE** (`:618-637`) that tells the agent exactly what claim it may make ("validated" vs "as caller spoke it") — this correctly prevents the AI from over-claiming verification. Strong prompt-surface design.
- New columns (`formatted_address`, `place_id`, `latitude`, `longitude`, `address_components`, `address_validation_verdict`) flow `validate → atomic_book_slot kwargs → RPC INSERT` with NULLABLE backward-compat. The drop-all-overloads + REVOKE/GRANT-exact-signature migration pattern is correct (Postgres treats arities as distinct functions).

### 4.7a [LOW] `appointment.timezone` referenced in calendar push but column doesn't exist

`createCalendarEvent`/`createOutlookCalendarEvent` use `timeZone: appointment.timezone || 'UTC'` (google-calendar.js:89,93; outlook-calendar.js:179,183). The `appointments` table has **no `timezone` column** (migrations 003/007/026/046/062), so this is always `'UTC'`. It happens to be harmless because `start_time`/`end_time` are stored as UTC `timestamptz` and serialized with a `Z`/offset, so Google/Outlook get an absolute instant. But the `|| 'UTC'` fallback is dead-code intent — a reader could think tenant tz flows here. Low.

### 4.7b [LOW] `caller_phone` for the appointment is `deps["from_number"]`, address parts joined client-side

`atomic_book_slot(..., caller_phone=deps.get("from_number",""))` (book_appointment.py:470). Fine. The pre-validation `service_address` is a naive comma-join of `[street, unit, postal]` (`:280-281`); on unverified verdicts this raw join is what persists. Acceptable given the verdict gating, noted for completeness.

---

## 4.8 Skill-doc drift (documentation correctness)

**[LOW] `scheduling-calendar-system` skill is stale on the concurrency model.** It still documents `UNIQUE (tenant_id, start_time)` as the "secondary defense" (section 2, Key Design Decisions) — but migration **019 dropped that UNIQUE and replaced it with the `appointments_no_overlap` GiST exclusion constraint**. The skill's claim that UNIQUE is the final guard is wrong (UNIQUE only caught identical starts and blocked cancelled-slot rebooking — the exact bugs 019 fixed). The skill also doesn't mention migration 019 at all, nor the dual JS/Python slot-math implementations, nor the 062 17-arg RPC. **Recommendation:** update the skill to reflect the exclusion constraint as the real layer-3 defense, add migration 019/062 to the file map, and document that the agent runs the **Python** slot calculator (the JS one is dashboard-only).

---

## Top findings (severity-ranked)

1. **[CRITICAL] Outlook subscription expiry hard-set to 7 days; Graph caps `/me/events` at ~3 days (4230 min)** → subscriptions die silently at ~day 3 while the DB claims 7, and the renewal cron won't fire in time. Outlook calendar sync silently stops for every tenant. (4.5a)
2. **[CRITICAL] JS slot-calculator timezone construction is server-locale-dependent** (`new Date("…T09:00:00")` parsed in process-local tz, then re-zoned) — correct only when `TZ=UTC`; every JS-computed slot shifts on any non-UTC host. This is the live face of the paused Phase 60.4 fragility. (4.1a)
3. **[HIGH] Google push webhook is unauthenticated** — trusts attacker-settable `X-Goog-Channel-Token`; no shared secret or channel-id verification, unlike Outlook's `clientState`. (4.4a)
4. **[HIGH] Google calendar sync never follows `nextPageToken`** — events beyond one page silently dropped from the mirror (AI can double-book over them); `nextSyncToken` may be missing on multi-page responses. Outlook pages correctly; Google was left half-done. (4.4b)
5. **[HIGH] Min-notice (1h) enforced only in `check_slot`, never in `book_appointment`/RPC** — a 600s slot_token + long call lets a slot be booked with far less than the configured notice (even slightly in the past). The DB has no past-time/min-notice invariant. (4.3a)
6. **[HIGH] Two hand-ported slot-math implementations (JS + Python) with no parity test** — already diverged (4.1a); future changes must be made twice with nothing catching drift. (4.1b)
7. **[MEDIUM] Advisory-lock key collides only on identical start instants** — overlapping-non-identical slots rely solely on the GiST exclusion constraint, whose violation surfaces to the agent as a generic `booking_failed` instead of the graceful `slot_taken` flow. (4.2a)
8. **[MEDIUM] `book_appointment`'s slot_taken recompute omits `calendar_blocks`** — the "next available" suggestion can land inside an owner's lunch/vacation block. (4.1c)
9. **[MEDIUM] No Graph lifecycle-notification handling + Outlook/Google tz-on-mirror gaps** — `reauthorizationRequired`/`subscriptionRemoved` ignored (4.5b); delta/all-day times mirrored without their source tz (4.5c/d). (4.5)
10. **[LOW] Skill doc stale** — still cites the dropped `UNIQUE(tenant_id,start_time)` as the secondary defense; doesn't mention migration 019's exclusion constraint, the dual slot-math, or the 062 RPC. (4.8)

**What's genuinely solid (keep):** the 3-layer atomic-booking design with the GiST exclusion constraint (best-practice); the Python slot calculator's tz construction; the verdict-driven address-validation flow that runs outside the lock window and gates the "validated" claim; in-call booking idempotency set synchronously before awaits; Outlook's serverless-safe direct-POST token refresh and correctly-paged delta sync.


---

# 5. Post-Call Pipeline, Triage, Notifications & Billing

**Audit date:** 2026-06-04
**Agent repo:** `C:/Users/leheh/.Projects/livekit-agent` (Python)
**Dashboard repo:** `C:/Users/leheh/.Projects/homeservice_agent` (Next.js)
**Scope:** recording/transcript, triage, notifications, usage/overage billing, recovery SMS.

Prior fixes already landed (NOT re-reported as new): overage now uses `billing.meter_events.create` (was `create_usage_record`); 15s billable threshold aligned across agent + cron; layer3 single-service over-escalation fixed (tag only on real `detected_service` match).

---

## 5.1 Post-call sequence (`src/post_call.py`)

The pipeline (`run_post_call_pipeline`, `post_call.py:29`) runs as a JobContext shutdown callback wrapped in `asyncio.wait_for(..., timeout=8.0)` (`agent.py:748-772`), a deliberate safety belt against the SDK's `shutdown_process_timeout=10s` SIGKILL. Sequence:

1. Build transcript text + structured (`post_call.py:46-55`)
2. Update `calls` row with transcript/recording/status (`:57-79`)
3. Booking reconciliation — backfill `booking_outcome='booked'` + `appointment.call_id` (`:81-109`)
4. Test-call auto-cancel (`:111-134`)
5. Usage tracking + overage report (`:136-185`)
6. Language-barrier detection (`:192-194`)
7. Triage classification (`:196-201`)
8. **6.5** `record_outcome` RPC — customer/job/inquiry (`:211-280`) — deliberately moved BEFORE slot calc
9. Suggested-slots for unbooked (`:282-290`)
10. Triage + language update on `calls` (`:292-322`)
11. Hallucination detector (observability only) (`:324-394`)
12. Owner notifications SMS+email (`:399-473`)

**Recording / egress** (`agent.py:1055-1095`): `start_room_composite_egress`, `audio_only=True`, OGG, `disable_manifest=True`, S3 → Supabase `call-recordings` bucket. `recording_storage_path` is written to the row at egress START (`:1086-1091`), and `stop_egress` is fire-and-forget with no S3-upload poll (`:730-742`) — correct, avoids burning the shutdown budget. Matches LiveKit best practice (audio-only composite → OGG/Opus, manifest disabled for simple file output) — [LiveKit RoomComposite egress docs](https://docs.livekit.io/home/egress/room-composite/).

**Approach verdict: SOUND.** Ordering is well-reasoned (record_outcome before slot-calc is a documented fix for inquiry-row loss under the 8s budget). Egress + 8s belt are best-practice.

### Findings

- **[HIGH] `record_outcome` is the LAST thing gated behind the 8s budget but runs in the MIDDLE; the cumulative work before it (3 sequential `calls` updates + triage incl. a 5s Groq call) can itself exceed the budget.** Section 6.5 (`post_call.py:211`) only runs after Section 6 triage (`:199`), which calls `run_llm_scorer` with `TIMEOUT_S = 5.0` (`layer2_llm.py:19`). A slow Groq turn alone can consume 5 of the 8 seconds before the customer/inquiry write even starts. The 2026-04-21 inquiry-loss regression this reorder fixed can recur whenever layer2 is hit. **Rec:** drop the Groq timeout to ~2.5s for the post-call path, OR run triage AFTER `record_outcome` (record with a provisional `routine` urgency, then UPDATE), OR move `record_outcome` to fire before triage.

- **[MEDIUM] Pervasive `print()` instead of `logger`.** `post_call.py` uses bare `print()` for ~20 operational/error lines (`:76, :109, :134, :153, :181, :183, :185, :189, :201, :278, :280, :290, :314, :322, :373, :387, :471, :475`) while a module `logger` is defined and used only in `_calculate_suggested_slots` (`:624`). On Railway these still hit stdout, but they bypass level filtering, Sentry breadcrumb capture, and structured fields. **Rec:** convert all `print()` → `logger.{info,warning,error}`.

- **[MEDIUM] `record_outcome` failure is swallowed with no recovery and no Sentry.** On `RecordOutcomeError` the code only `print()`s (`:276-280`) — by design (D-02a: no legacy fallback), but unlike the post-call timeout path it does NOT emit to Sentry. A systemic RPC break (e.g. migration drift) would silently drop every customer/job/inquiry with only Railway stdout as evidence. **Rec:** add `sentry_sdk.capture_exception` in the `RecordOutcomeError` branch.

- **[LOW] Transcript redaction is absent.** Full `transcript_text` + `transcript_structured` are written verbatim to `calls` (`:60-67`); the only PII discipline is in error logs (T-59-05-04 omits phone/name). Caller PII (address, phone spoken aloud, names) lands unredacted in the DB. Acceptable if RLS + at-rest encryption cover it, but there is no field-level redaction layer. **Rec:** confirm this is an accepted decision; if regulated, add redaction before persist.

---

## 5.2 Triage (`src/lib/triage/`)

3-layer cascade (`classifier.py:17`): layer1 keyword regex → (if not confident) layer2 Groq LLM → layer3 owner-service rules. Fail-open: layer2 returns `routine/low` on any exception incl. timeout (`layer2_llm.py:48-49`); layer3 returns `base_urgency, escalated:False` on DB error (`layer3_rules.py:23-24`). Cascade can only RAISE urgency (`layer3_rules.py:49`), never lower it — a sane safety posture for an emergency-triage system.

**Approach verdict: keyword→LLM→rules is a GOOD design** — cheap deterministic floor (free, instant) for the unambiguous emergency/routine keywords, LLM only for the ambiguous middle, owner rules as a final business-specific escalation. This is the right cost/latency/safety tradeoff. The two material problems are the model slug and a dead layer3 path.

### Findings

- **[CRITICAL] The Groq model `meta-llama/llama-4-scout-17b-16e-instruct` was DEPRECATED on 2026-04-15 and is no longer supported — today is 2026-06-04, so this is already past EOL.** (`layer2_llm.py:36`). Groq's recommended replacement is `openai/gpt-oss-120b`. Layer2 calls will (or soon will) hard-fail → fail-open to `routine/low` on EVERY ambiguous call, silently collapsing the middle tier of triage to "routine." Emergencies with no layer1 keyword match would be mis-triaged as routine. **Rec (urgent):** switch the slug to a current Groq production model (`openai/gpt-oss-120b`, or `meta-llama/llama-4-maverick-17b-128e-instruct`), make it an env var, and verify in Groq dashboard. [Groq deprecations](https://console.groq.com/docs/deprecations) · [Groq supported models](https://console.groq.com/docs/models).

- **[HIGH] `detected_service` is never wired, so layer3 service-tag escalation NEVER fires.** `classifier.py` accepts `detected_service` (`:22`) and forwards it to `apply_owner_rules` (`:31, :43`), but `post_call.py:199` calls `classify_call(supabase, transcript=..., tenant_id=...)` with NO `detected_service`. Inside `apply_owner_rules`, `if detected_service:` is always false (`layer3_rules.py:31`), so `matched_tag` falls back to `base_urgency` (`:39-44`) and `tag_severity > base_severity` can never be true → `escalated` is always False → `triage_layer_used` is never `layer3`. The owner's per-service `urgency_tag` configuration is effectively dead. **Rec:** pass a detected service into `classify_call`. The `job_type` already derived at `post_call.py:238` (`_extract_field_from_transcript(..., "job")`) is a ready candidate to thread through.

- **[LOW] Layer2 uses Groq `response_format={"type":"json_object"}` (JSON mode), not strict structured outputs / schema.** (`layer2_llm.py:41`). JSON mode does not guarantee the enum is one of the three valid values; `_sanitize_urgency` (`classifier.py:10`) defensively coerces, which is adequate. Groq now supports stricter structured outputs on newer models — worth adopting when the slug is updated, but not load-bearing given the sanitizer. [Stripe-unrelated; Groq models doc above.]

- **[LOW] Layer1 emergency keyword `\b(...|urgent)\b` (`layer1_keywords.py:11`) marks "urgent" as `emergency`,** collapsing the `urgent` tier whenever the caller literally says "urgent." The DB enum has a distinct `urgent` level used elsewhere (notifications treat `urgent` as high-priority, `post_call.py:294`). Minor mis-bucketing; consider mapping the bare word "urgent" to the `urgent` tier rather than `emergency`.

---

## 5.3 Notifications (`src/lib/notifications.py` + recovery cron)

Owner SMS via Twilio `messages.create`, email via Resend. Recovery SMS to the caller has its own translated templates (`send_caller_recovery_sms`, `:188`). Owner notifications run as `asyncio.gather(..., return_exceptions=True)` (`post_call.py:466`).

**Approach verdict: ADEQUATE but failure-swallowing is systemic.** Templating via `_interpolate` is fine. The recovery cron's retry design is genuinely good.

### Findings

- **[MEDIUM] Owner SMS/email failures are swallowed and return `None` with no Sentry, no DB status.** `send_owner_sms` (`notifications.py:119-120`) and `send_owner_email` (`:181-182`) catch every exception, `logger.error`, and return `None`. The pipeline's `gather` logs "fulfilled/rejected" (`post_call.py:466-471`) but a function that swallows its own exception always looks "fulfilled" even when the SMS never sent. Owner notification delivery is effectively unobservable — a Twilio outage or bad `owner_phone` is invisible. **Rec:** let these raise (so `gather` records `rejected`) or capture to Sentry, and persist an owner-notification delivery status the way recovery SMS does.

- **[LOW] No E.164 validation on owner SMS in the Python path.** The JS `notifications.js` guards every send with `isValidE164` (`notifications.js:126, 215, 280`), but the Python `send_owner_sms` (`notifications.py:111`) passes `to` straight to Twilio. Invalid owner numbers fail at Twilio (error 21211) and are swallowed per the above. **Rec:** mirror the JS `isValidE164` guard.

- **[LOW] Email HTML is unescaped f-string interpolation** (`notifications.py:156-164`). `caller_name`, `job_type`, `service_address` come from the transcript and are injected into HTML without escaping → HTML/markup injection into the owner's inbox (low impact, owner-only, but a caller could inject markup). **Rec:** `html.escape()` the interpolated fields.

### Recovery SMS cron (`src/app/api/cron/send-recovery-sms/route.js`) — GOOD

Runs every minute. Branch A first-send (`route.js:60-171`): only `booking_outcome='not_attempted'`, dedup via `recovery_sms_status IS NULL`, batch tenant/appointment fetch (no N+1), 15s short-call skip (`:98`) — aligned with the agent's `MIN_BILLABLE_DURATION_SEC=15`. Branch B retry (`:175-263`): exponential backoff `[30s,120s]`, `MAX_ATTEMPTS=3`, permanent Twilio error codes (21211/21610/21408/...) short-circuit retries (`:24-32`). This matches Twilio messaging retry best practice (distinguish permanent vs transient failures, bounded retries, backoff).

- **[LOW] Branch A duration uses `new Date(end_timestamp) - new Date(start_timestamp)` (`route.js:94-96`) but the columns are bigint epoch-ms** (the cutoff at `:58` correctly treats `end_timestamp` as raw ms). `new Date(<bigint ms>)` does parse ms correctly, so the math is right, but it's inconsistent with the cutoff's raw-ms handling and brittle if the column type ever shifts. Cosmetic. **Rec:** compute `(end_timestamp - start_timestamp)/1000` on raw numbers for consistency.

---

## 5.4 Usage tracking + Stripe overage

`increment_calls_used` RPC (`migrations/037_fix_overage_off_by_one.sql`) is idempotent via `INSERT INTO usage_events ... ON CONFLICT (call_id) DO NOTHING` (`:30-32`) — duplicate `call_id` returns current state without incrementing. Off-by-one fixed (strict `>` so only call #41 on a 40-call plan is overage, `:42/:60`). Locked to `service_role` (`migration 039`). Overage path (`post_call.py:155-183`): on `limit_exceeded`, look up `stripe_customer_id`, call `client.billing.meter_events.create` with `event_name="voco_calls"`, `payload={"value":"1","stripe_customer_id": customer_id}`, `identifier=f"overage_{call_id}"`. Billable gate is `duration_seconds >= 15` (`post_call.py:137`).

**Approach verdict: CORRECT and matches current Stripe API.** Payload shape (customer-mapping key + `value`) and the `identifier` idempotency key align with [Stripe Create meter event](https://docs.stripe.com/api/billing/meter-event/create). RPC idempotency is well-designed.

### Findings

- **[MEDIUM] Stripe `identifier` idempotency only protects a rolling ~24h window; the recovery/re-processing model can replay overage outside it.** Stripe enforces `identifier` uniqueness for "a rolling period of at least 24 hours" only ([Stripe meter event create docs](https://docs.stripe.com/api/billing/meter-event/create)). The RPC's `usage_events` table is the real durable idempotency guard — but the overage `meter_events.create` fires INSIDE the `if success and limit_exceeded` block (`post_call.py:155`), where `success=True` ONLY when the row was freshly inserted (not a duplicate), so a true duplicate `call_id` does NOT re-report. Good. **Residual risk:** if a call is reprocessed after the row is somehow deleted/expired, the `overage_{call_id}` key could fall outside Stripe's 24h window and double-bill. Low likelihood given `usage_events` is durable. **Rec:** confirm `usage_events` rows are never pruned within a billing period; otherwise the Stripe-side guard is insufficient.

- **[LOW] Overage report is best-effort and non-fatal but only `print()`-logged (`post_call.py:182-183`),** so a sustained Stripe meter outage silently under-bills overage with no alert. **Rec:** Sentry-capture the overage-report exception (revenue-impacting).

- **[LOW] `MIN_BILLABLE_DURATION_SEC=15` is duplicated as a magic literal in two repos** (agent `post_call.py:26` and cron `route.js:98`). Already aligned per prior fix, but drift-prone. **Rec:** note the cross-repo coupling in the `voice-call-architecture` / `payment-architecture` skills so future changes update both.

---

## Top recommendations (tagged)

1. **[CRITICAL]** Replace deprecated Groq model `meta-llama/llama-4-scout-17b-16e-instruct` (EOL 2026-04-15) with a current slug (`openai/gpt-oss-120b`); make it env-configurable. `layer2_llm.py:36`.
2. **[HIGH]** Wire `detected_service` into `classify_call` so layer3 owner service-tag escalation actually runs (currently dead). `post_call.py:199`, `classifier.py:22`.
3. **[HIGH]** Triage's 5s Groq call runs before `record_outcome` inside the 8s budget — tighten the post-call Groq timeout or reorder so the customer/inquiry write can't be starved. `layer2_llm.py:19`, `post_call.py:199-254`.
4. **[MEDIUM]** Stop swallowing owner SMS/email failures silently; raise or Sentry-capture + persist delivery status. `notifications.py:119, 181`.
5. **[MEDIUM]** Convert all `print()` → `logger` across `post_call.py`; add Sentry to `RecordOutcomeError` and overage-report failures.
6. **[MEDIUM]** Verify `usage_events` is never pruned within a billing period — it is the real overage idempotency guard; Stripe's `identifier` only covers ~24h.
7. **[LOW]** Add `isValidE164` guard + `html.escape()` to the Python owner notification path. `notifications.py:111, 156`.

## Sources

- [Groq model deprecations](https://console.groq.com/docs/deprecations)
- [Groq supported models](https://console.groq.com/docs/models)
- [Stripe — Create a billing meter event](https://docs.stripe.com/api/billing/meter-event/create)
- [Stripe — Meter event object](https://docs.stripe.com/api/billing/meter-event/object)
- [LiveKit — RoomComposite & web egress](https://docs.livekit.io/home/egress/room-composite/)


---

# Audit 06 — Address Validation & CRM Integrations (live-call path)

> Scope: the Google Address Validation usage in `book_appointment`/`capture_lead`, the
> pre-session Jobber+Xero customer-context fan-out, the agent-side token refresh vs the
> Next.js refresh-locks, and the `check_customer_account` tool's reliance on that data.
> Agent repo: `C:/Users/leheh/.Projects/livekit-agent` (Python). Dashboard repo:
> `C:/Users/leheh/.Projects/homeservice_agent` (Next.js owns OAuth + refresh-locks).
>
> Prior-fix context (already landed, NOT re-reported as new): region short-circuit to
> `skipped` for non-US/CA/SG; `deps['country']` now set so `region_code` uses the real
> tenant country; Jobber webhook version unified to `2025-04-16`; reconnect-email column
> fix.

---

## 6. Address Validation & CRM Integrations

### 6.1 Google Address Validation — Approach

**Code:** `src/integrations/google_maps.py`

- Endpoint: `POST https://addressvalidation.googleapis.com/v1:validateAddress?key=…`
  (`google_maps.py:73`, `:331`). Correct GA endpoint.
- Request shape (`:311-320`): `{ address: { regionCode, addressLines[], postalCode?, locality? } }`.
- Region gate (`:285-287`): non-`{US,CA,SG}` short-circuits to `verdict='skipped'` **before**
  the HTTP call (prior fix). `region_code` is sourced from `deps['country']`
  (`book_appointment.py:291`, prior fix) so non-US tenants no longer mis-default to `US`.
- Verdict mapping (`:99-129`): Google `verdict.possibleNextAction` → Voco 6-state
  (`ACCEPT→confirmed`, `CONFIRM/CONFIRM_ADD_SUBPREMISES→confirmed_with_changes`,
  `FIX→unconfirmed`). Out-of-band states (`unsupported_region`, `error`, `skipped`) set at the
  HTTP layer.
- Timeout: hard 1.5s socket timeout (`:76`, `:325`) **and** a task-level `asyncio.wait_for`
  in the bounded wrapper (`:480-488`). Belt-and-suspenders, no internal retry loop.
- Telemetry: one `gmaps_validate_events` row per attempt; Sentry capture **only** on
  `verdict='error'` (`:511-529`). Cost stamped at 1700 micro-cents
  (`COST_MICRO_CENTS_PER_VALIDATE`, `:87`).
- `country_code` correctly read from `postalAddress.regionCode`, not `addressComponents`
  (`:169-172`, "Pitfall 4").

**Best-practice fit (cite):**

- **Right tool.** Address Validation API (not Geocoding/Places Autocomplete) is the correct
  product for verifying a caller-spoken delivery/service address; it returns a
  deliverability-oriented verdict. US/CA are fully covered (with residential/commercial
  metadata); **SG is supported for validation only — metadata columns are not populated**
  (`coverage`). So `address_components` for SG will carry street/postal but never
  residential/commercial classification. Matches Voco's needs (we don't use that metadata).
  — https://developers.google.com/maps/documentation/address-validation/coverage
- **Cost figure is accurate.** $0.017/request up to 100k/mo ⇒ the hard-coded 1700
  micro-cents is correct for the current tier (drops to $0.0136 above 100k).
  — https://developers.google.com/maps/documentation/address-validation/usage-and-billing
- **Verdict model — partially optimal.** Google explicitly says `possibleNextAction` is a
  *convenience summary*, and recommends building custom logic on `verdict.addressComplete`
  + `verdict.validationGranularity` (`PREMISE`/`SUB_PREMISE` ⇒ deliverable) for
  deliverability-sensitive flows. Voco maps **only** `possibleNextAction` and ignores
  `addressComplete` and `validationGranularity`.
  — https://developers.google.com/maps/documentation/address-validation/build-validation-logic
  — https://developers.google.com/maps/documentation/address-validation/understand-response
- **`regionCode` always sent** — good; Google "strongly recommends" it (required-grade for
  preview regions). https://developers.google.com/maps/documentation/address-validation/coverage

**Verdict on the Google approach: SOUND.** Correct product, correct endpoint, correct
region/cost/telemetry posture, graceful degradation that never blocks booking. The one
real gap is reliance on the coarse `possibleNextAction` enum instead of the finer
`validationGranularity`/`addressComplete` signals — acceptable for a triage receptionist,
but it means a `confirmed` verdict can still be a low-granularity (e.g. `ROUTE`-level) match
that isn't truly deliverable.

### 6.2 Pre-session customer-context fan-out — Approach

**Code:** `src/lib/customer_context.py`, `src/integrations/xero.py`, `src/integrations/jobber.py`,
wired in `src/agent.py:300-347` and re-served by `src/tools/check_customer_account.py`.

- Fan-out: `fetch_merged_customer_context_bounded` creates **both** provider tasks before
  awaiting (`customer_context.py:199-217`) — genuinely concurrent. Each side is wrapped in
  `_fetch_with_bounds` (per-provider `asyncio.wait_for`, silent-skip + Sentry on
  timeout/error, `phone_hash` only, no raw PII — `:121-178`). When both miss → `None`, and
  the prompt block is omitted (`prompt.py:777-778`, D-11).
- **Budget:** `agent.py:327-332` calls it with `timeout_seconds=2.5` (overriding the 0.8
  default), in parallel with `fetch_caller_history`, during greeting playout — so
  caller-perceived latency ≈ 0. Reasonable.
- Merge (`:42-115`): Jobber wins client/jobs/lastVisitDate; Xero wins
  balance/lastPayment/invoices; `_sources` provenance preserved. Snake→camel normalization
  for Xero. Clean.
- Injection: `prompt.py:_build_customer_account_section` (`:760-816`) renders the merged dict
  as a STATE+DIRECTIVE block via the shared `format_customer_context_state`
  (`check_customer_account.py:32-102`). The tool re-serves the *same* pre-fetched
  `deps['customer_context']` — never re-fetches mid-call. Privacy DIRECTIVE forbids
  volunteering balances. Good design.

**Best-practice fit (cite):**

- **Xero token refresh (agent side).** `xero.py:169-218` refreshes on a 5-min buffer, persists
  the rotated `refresh_token` back, and clears `error_state`. Xero documents a **30-minute
  retry window** on the *old* refresh token, so the agent racing the Next.js refresh-lock is
  low-risk — but both writers persist independently (no lock held by the Python side).
  Xero rate limits: 60/min, 5000/day, **5 concurrent/org**.
  — https://developer.xero.com/documentation/guides/oauth2/limits/
- **Jobber token refresh (agent side).** `jobber.py:229-296` enforces mandatory rotation
  (rejects a refresh missing the new `refresh_token`), sends the required
  `X-JOBBER-GRAPHQL-VERSION: 2025-04-16` header (`:44`, `:302-308`), and does reactive
  refresh+single-retry on 401 (`:450-455`). Jobber rate-limits via query-cost (leaky bucket)
  + 2500 req/5min DDoS guard — the single small query here is well under budget.
  — https://developer.getjobber.com/docs/using_jobbers_api/api_rate_limits/
- **PII discipline.** Phones never logged raw (hash-only in `customer_context.py`/Sentry tags);
  Jobber deliberately logs exception *type* only, never the message, to avoid echoing bodies
  (`jobber.py:258`, `:323`). Good.

**Verdict on the integrations approach: MOSTLY SOUND, two residual contract risks below.**

---

### Residual findings

#### [HIGH] R1 — `expiry_date` ISO-string write into a BIGINT column (agent refresh write-back is silently rejected)

- **Contract:** `accounting_credentials.expiry_date` is **BIGINT** (epoch-ms).
  `supabase/migrations/030_accounting_integrations.sql:16`. The Next.js writers store a
  number: `src/lib/integrations/xero.js:254` (`expires_at * 1000`),
  `jobber.js:254` (`parseJwtExpiryMs(...)`), `types.js:12` ("Unix timestamp in milliseconds").
- **Bug:** the agent-side Xero refresh writes an **ISO 8601 string**:
  `xero.py:209` builds `(...).isoformat()` and `:120` stores it into `expiry_date`.
  Jobber does the same: `jobber.py:282-288` stores `expiry_iso` (an ISO string) into
  `expiry_date`.
- **Impact:** Postgres rejects an ISO string into a `bigint` column (`invalid input syntax for
  type bigint`). That UPDATE is wrapped in a bare `except` that only `logger.warning`s and
  swallows (`xero.py:127-130`, `jobber.py:188-192`). So **every agent-side token refresh fails
  to persist** — access/refresh token rotation is lost. Next consequence: on Jobber (mandatory
  rotation) the *old* refresh token is now invalid on Jobber's side but still in the row ⇒ the
  next refresh 400s ⇒ `error_state='token_refresh_failed'` ⇒ context fetch dies until the user
  reconnects. On Xero the rotated refresh token is similarly dropped.
- **Mitigating factor:** the read-side parser `_expiry_to_epoch` (`xero.py:54-74`,
  `jobber.py:122-136`) tolerates *both* int-ms and ISO, so a read never crashes — which is
  exactly why this has stayed invisible. The failure is on the **write**.
- **Fix direction:** the Python adapters must persist `expiry_date` as **epoch-ms int** to
  match the column + the Next.js writers, e.g. `int((now+expires_in)*1000)` for Xero and the
  already-decoded `expiry_ms` for Jobber (Jobber computes `expiry_ms` at `jobber.py:281` then
  throws it away in favor of the ISO string). [REQUIRED]

> NOTE: confirm against prod — if a DB trigger or implicit cast were silently coercing the
> string this would not surface, but no such cast exists for text→bigint in Postgres, so the
> write is rejected. Worth a one-line prod log check on `accounting_credentials` UPDATE
> warnings before scheduling the fix.

#### [MED] R2 — Jobber refresh has NO expiry buffer (refresh fires only after token already dead)

- `jobber.py:440-445`: proactive refresh triggers only when
  `expiry_epoch <= now` (already expired). Xero uses a 5-min buffer (`REFRESH_BUFFER_SECONDS`,
  `xero.py:46`, `:172`). Jobber is bufferless and additionally `_refresh_token` here writes a
  broken `expiry_date` (see R1), so the proactive path is doubly unreliable; the system leans
  on the **reactive 401 retry** (`:450-455`) to recover. That reactive path costs an extra
  round-trip inside the 2.5s budget on a cold/expired token and can tip a slow call into the
  timeout → silent skip.
- **Best-practice:** symmetric ~5-min buffer (Jobber access tokens are ~60-min JWTs; refreshing
  5 min early is free). — https://developer.getjobber.com/docs/build_with_jobber/
- **Fix direction:** add the same `REFRESH_BUFFER_SECONDS` guard to the Jobber proactive
  branch. [RECOMMENDED]

#### [MED] R3 — Agent-side refresh does NOT hold the Next.js refresh-lock (cross-writer race)

- The `integrations-jobber-xero` skill documents Next.js refresh-**locks** (advisory rows) to
  serialize refreshes. The Python adapters (`xero.py:_refresh_if_needed`,
  `jobber.py:_refresh_token`) refresh and write back **without acquiring that lock**. Two
  refreshers (a dashboard read + a live call) can race the rotation. Xero's 30-min old-token
  grace window makes this survivable for Xero; **Jobber's strict single-use rotation makes it
  fragile** — if Next.js rotates while the agent is mid-refresh, one side persists a token the
  other already invalidated.
- This is latent today because R1 means the agent never successfully *persists* a refresh — so
  fixing R1 will **expose** R3. Treat R1 and R3 as a pair.
- **Fix direction:** either (a) have the Python adapter participate in the same refresh-lock
  primitive before POSTing the refresh grant, or (b) keep the agent refresh-on-401-only and let
  Next.js own all proactive refreshes. [RECOMMENDED — sequence after R1]

#### [LOW] R4 — Xero contact lookup is unpaginated (first 100 contacts only)

- `xero.py:229-296` fetches Xero's default Contacts page (≤100) and matches by digit-suffix in
  Python. Orgs with >100 contacts whose match sits past page 1 silently no-match. Already
  flagged in-code as "deferred to P58". Acceptable for SMB tenants; revisit if a contractor
  reports "you don't recognize me" with a large Xero org. The digits-only last-10/last-7 match
  is a reasonable cross-country heuristic but can **false-positive** on two customers sharing a
  7-digit suffix (SG local). [OPTIONAL]

#### [LOW] R5 — `validationGranularity` / `addressComplete` unused (see 6.1)

- Voco maps only `possibleNextAction`. A `confirmed` verdict can still be a coarse
  (`ROUTE`/`GEOMETRIC_CENTER`) match. For a triage receptionist that reads the address back
  to the caller this is acceptable, but adding a granularity floor (treat
  `< PREMISE/SUB_PREMISE` as `confirmed_with_changes`) would catch "right street, wrong/no
  house number" cases. [OPTIONAL]
  — https://developers.google.com/maps/documentation/address-validation/build-validation-logic

#### [INFO] O1 — `GOOGLE_MAPS_API_KEY` is a hard operational dependency

- `google_maps.py:276-283`: missing key ⇒ `verdict='skipped'` immediately, booking proceeds
  unblocked, **no Sentry page** (by design, D-A3). This is graceful, but it means **if the key
  is not set on Railway, address validation is silently 100% dead** and only visible via a
  `gmaps_validate_events` aggregation showing all-`skipped`. Operational, not a code bug — but
  worth a deploy-time assertion / dashboard alert that `skipped`-rate ≈ 100% indicates a
  missing key, not unsupported regions. Also recommend an API-key restriction (HTTP referrer
  N/A for server-side; use **API restriction → Address Validation API only** + IP allowlist for
  Railway egress). [INFO / operational]

#### [INFO] O2 — `locality` always omitted in validation request

- `book_appointment.py:304` passes `locality=None` ("not captured by current single-question
  intake"). Google tolerates this (city is inferable from postal+region in US/CA/SG), so this
  is fine; noted only because the optional `locality` field exists and could marginally improve
  match confidence for ambiguous postal codes. No action needed. [INFO]

---

### Summary table

| ID | Sev | Area | One-liner |
|----|-----|------|-----------|
| R1 | HIGH | Xero+Jobber refresh | ISO string written into BIGINT `expiry_date` ⇒ agent token write-back silently rejected |
| R2 | MED | Jobber refresh | No expiry buffer; refreshes only after token already dead |
| R3 | MED | Both refresh | Agent refresh ignores Next.js refresh-lock; fragile for Jobber's strict rotation (exposed once R1 fixed) |
| R4 | LOW | Xero lookup | Contacts unpaginated (≤100); 7-digit suffix match can false-positive |
| R5 | LOW | Google verdict | Only `possibleNextAction` used; `validationGranularity`/`addressComplete` ignored |
| O1 | INFO | Google ops | Missing `GOOGLE_MAPS_API_KEY` ⇒ validation silently 100% `skipped`, no page |
| O2 | INFO | Google req | `locality` always `None` in request (acceptable) |

### Sources

- Google Address Validation — coverage: https://developers.google.com/maps/documentation/address-validation/coverage
- Google Address Validation — build validation logic: https://developers.google.com/maps/documentation/address-validation/build-validation-logic
- Google Address Validation — understand response: https://developers.google.com/maps/documentation/address-validation/understand-response
- Google Address Validation — usage & billing: https://developers.google.com/maps/documentation/address-validation/usage-and-billing
- Xero OAuth 2.0 API limits: https://developer.xero.com/documentation/guides/oauth2/limits/
- Jobber GraphQL rate limits: https://developer.getjobber.com/docs/using_jobbers_api/api_rate_limits/


---

# Audit 07 — Dashboard Call-Configuration & Display Surfaces

> Scope: the dashboard surfaces that **configure** the live call (call-routing,
> escalation/notifications, services/intake, working-hours, AI/voice) and the
> surfaces that **display** the call result (`/dashboard/calls`, jobs, inquiries,
> customer detail). Focus on Supabase Realtime correctness, read/write-model
> alignment with the post-call pipeline, and Next.js 16 client-component patterns.
> Code-only audit; no edits applied.
>
> The Python LiveKit agent is **not in this repo** (separate `lerboi/livekit_agent`,
> deployed to Railway). Agent-side reads are assessed against the
> `voice-call-architecture` skill contract and the `tenants` / `services` /
> `escalation_contacts` columns the dashboard writes.

---

## 7. Dashboard Call-Configuration & Display Surfaces

### 7.1 Config → Agent wiring matrix

| UI surface | Writes to | Agent reads (per skill) | Verdict |
|---|---|---|---|
| `more/call-routing` schedule + pickup_numbers + dial_timeout | `tenants.call_forwarding_schedule`, `pickup_numbers`, `dial_timeout_seconds` | FastAPI webhook (incoming-call routing / dial-status / dial-fallback) | **OK** — consumed webhook-side, not agent-side |
| `more/call-routing` Priority Callers (standalone) | `tenants.vip_numbers` | webhook priority-caller check | **OK** |
| `more/call-routing` Priority Callers (job-sourced) | `jobs.is_vip` via `PATCH /api/jobs/[id]` | webhook priority-caller check (`leads.is_vip` per skill text) | **GAP** — see 7.3 (F-5) |
| `more/escalation-contacts` | `escalation_contacts` (name/phone/email/pref/timeout/sort_order) | post-call notification fan-out | **OK** |
| `more/notifications` | `tenants.notification_preferences` (4 outcomes × sms/email) | post-call pipeline notify | **OK** |
| `more/working-hours` | `tenants.working_hours`, `slot_duration_mins`, `tenant_timezone` | agent availability / booking | **OK** |
| `more/ai-voice-settings` | `tenants.ai_voice` | agent session voice | **OK** |
| services + `intake_questions` | `services.intake_questions` (jsonb, migration 018) | agent prompt builder (trade-specific questioning) | **OK** but see 7.3 (F-6) |

The configuration plumbing is, on the whole, **correctly wired** — every panel
writes a `tenants`/`services`/`escalation_contacts` column the agent or webhook
is documented to read. The substantive issues are concentrated in the **Realtime
display layer** and a few **read/write-model display gaps**.

---

### 7.2 Realtime — approach verdict

**Current approach: Postgres Changes (`postgres_changes`) with a `tenant_id=eq.`
server-side filter, one channel per call-related page.** Tables `calls`, `jobs`,
`inquiries`, `customers`, `calendar_events` are in the `supabase_realtime`
publication with `REPLICA IDENTITY FULL`.

**Verdict: Postgres Changes is the right call _for this product today_, and the
filtering is done correctly (server-side, not client-side).** Supabase's own
guidance is to filter at the subscription level via DB-level filters rather than
receiving all rows and filtering in the client — which these pages do
([Postgres Changes docs](https://supabase.com/docs/guides/realtime/postgres-changes)).
This is a low-fanout, single-tenant-per-connection dashboard (one owner watching
their own rows), so the documented Postgres-Changes scaling cliff — "100 users
subscribed to a table ⇒ 100 RLS reads per insert, processed on a single thread"
([Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes),
[Benchmarks](https://supabase.com/docs/guides/realtime/benchmarks)) — does **not**
bite here: fanout per tenant is ~1. **Do not migrate to Broadcast yet** — Broadcast
is the right answer only once a single insert must reach many subscribers
(team seats, an ops/admin wallboard watching all tenants). Flag for re-evaluation
if/when multi-seat tenants ship.

One genuine RLS concern worth noting: Postgres-Changes RLS is evaluated per
subscriber per change, so the `calls` / `jobs` / `inquiries` RLS policies must be
index-backed on `tenant_id` and avoid joins
([RLS perf](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv),
[Realtime RLS](https://supabase.com/blog/realtime-row-level-security-in-postgresql)).
That is an `auth-database-multitenancy` follow-up, not fixable on these pages.

---

### 7.3 Findings (severity-tagged)

#### [MEDIUM] F-1 — Calls page Realtime INSERT ignores all active filters
`src/app/dashboard/calls/page.js:469-471`

```js
(payload) => {
  setCalls((prev) => [payload.new, ...prev]);   // unconditional prepend
}
```

The INSERT handler prepends **every** new `calls` row for the tenant, regardless
of the active `urgency` / `bookingOutcome` / `dateRange` / `search` filters held in
`filters`. The server-side `filter: tenant_id=eq.${tenantId}` is correct for
tenant isolation, but Supabase Postgres-Changes filters are tenant-scoped only —
they cannot express the UI's compound filter. So a filtered Calls view (e.g.
"Emergencies" or "Booked") will have **non-matching rows injected live** at the
top, contradicting the visible filter state until the next manual refetch. This is
exactly the known "realtime injects non-matching rows into filtered views" issue.
Contrast `jobs/page.js:251-258` and `inquiries/page.js:197-205`, which **do**
re-check `urgency`/`jobType`/`search` against `filtersRef.current` before
prepending. The Calls page never adopted that guard. *(Note: status is applied
server-side on Calls via refetch, but urgency/outcome/date/search are not
re-checked on the live INSERT.)*
**Rec:** mirror the Jobs/Inquiries `filtersRef` + `matchesFilters` guard before
`setCalls(prev => [payload.new, ...prev])`. Re-derive `created_at`/date-range and
`from_number` search against the new row.

---

#### [MEDIUM] F-2 — Calls page never renders transcript or triage internals it fetches
`src/app/api/calls/route.js:20-29` selects `triage_layer_used`,
`urgency_confidence`; `src/app/dashboard/calls/page.js` (CallCard) renders neither,
and **no transcript at all**.

The API returns `urgency_confidence` and `triage_layer_used`, but the call card
shows only the urgency *label* and booking outcome — the confidence and which
triage layer fired are dropped on the floor. More importantly, the empty-state copy
promises *"they'll appear here with transcript and recording"*
(`calls/page.js:367`) yet the expanded card renders the **recording** (AudioPlayer)
but **no transcript** — there is no `TranscriptViewer` on this page. The transcript
lives only behind the Job/Inquiry flyouts. For a call that produced neither a job
nor an inquiry (e.g. owner_pickup, too-short, declined), the transcript is
effectively unreachable from the call log.
**Rec:** either (a) add a transcript section to the expanded CallCard (the Job/
Inquiry flyouts already have `TranscriptViewer`), or (b) soften the empty-state copy
to "recording" only. Surface `urgency_confidence` in the Urgency `DetailItem` and
optionally `triage_layer_used` as a muted sub-label so the displayed triage matches
what post-call wrote.

---

#### [LOW] F-3 — Duplicated tenant-id bootstrap across 4 call pages (and a non-namespaced channel)
`calls/page.js:443-453`, `jobs/page.js:158-171`, `inquiries/page.js:129-141`,
plus the customer-detail page.

The identical block — `supabase.auth.getUser()` → `tenants.select('id').eq('owner_id', user.id).single()`
→ `setTenantId(...)` — is copy-pasted into every call-related page. Each page pays a
second round-trip (`getUser` then `tenants`) on mount before it can even open its
Realtime channel, and the logic drifts independently (Jobs/Inquiries null-guard
the catch; Calls swallows silently). Separately, the channel **names** are
inconsistent: Jobs/Inquiries/Calls use **static** names (`'calls-realtime'`,
`'jobs-realtime'`, `'inquiries-realtime'`) while Calendar and Customer-detail use
**tenant/id-namespaced** template names (`` `calendar-events-${tenantId}` ``,
`` `customer-detail-${customerId}` ``). Static channel names risk cross-instance
collisions if two of these pages ever mount simultaneously (e.g. a future split
view, or React 18 StrictMode double-mount) since Supabase keys channels by name.
The data is still correctly tenant-scoped via the `filter`, so this is hygiene, not
a leak.
**Rec:** extract a `useTenantId()` hook (single source) and a
`useTenantChannel(table, onEvent)` helper; namespace every channel name with
`${tenantId}` as Calendar/Customer-detail already do.

---

#### [LOW] F-4 — Jobs/Inquiries live INSERT re-check is shallower than the server query
`jobs/page.js:253-257`, `inquiries/page.js:198-202`

The live-INSERT guard re-checks `urgency`, `jobType`, and a `caller_name`
substring for `search`. But the server route (`/api/jobs`, `/api/inquiries`) also
filters on `date_from`/`date_to`, and `search` server-side likely also matches
phone — so a live INSERT can still slip a row past (or wrongly drop a row that the
server *would* have matched on phone). It is strictly better than the Calls page
(F-1), but the guard and the server WHERE clause have **diverged**. Also note the
Inquiries page default filter is `status=open` applied **client-side** only
(`displayedInquiries`), so a newly-inserted `converted`/`lost` inquiry is added to
the in-memory list and merely hidden — correct, but means counts on the pill strip
update from rows the user can't see (intended, just worth confirming).
**Rec:** factor a shared `rowMatchesFilters(row, filters)` used by both the INSERT
guard and (conceptually) the server query so they cannot drift; include date-range
and phone in the client guard.

---

#### [LOW] F-5 — Priority-caller skill drift: UI writes `jobs.is_vip`, skill text still says `leads.is_vip`
`call-routing/page.js:320-340` + `api/call-routing/route.js:49-66`

The UI correctly migrated to Phase 59: priority "leads" are now **jobs** marked
`is_vip`, fetched via `jobs … is_vip=true` and mutated via `PATCH /api/jobs/[id]`
with `{ is_vip: false }`. The `dashboard-crm-system` skill §14 and the
`voice-call-architecture` webhook description still describe `leads.is_vip=true`.
This is a **documentation/contract** drift, not a code bug — but the webhook
priority-caller check (in the other repo) must be reading `jobs.is_vip`, not the
dropped `leads` table, for job-sourced priority callers to actually ring through.
**Rec:** verify the Railway webhook reads `jobs.is_vip` (or `vip_numbers`); update
both skills to say `jobs.is_vip`. The internal variable is still named `vipLeads`
in the route + page — harmless but confusing.

---

#### [LOW] F-6 — `intake_questions` is set per-service but there is no first-class editor surface
`supabase/migrations/018_intake_questions.sql` (`services.intake_questions jsonb`)
is populated **only at onboarding** from `TRADE_TEMPLATES.intakeQuestions`
(`api/onboarding/start/route.js`). No dashboard panel (services-pricing or
ai-voice-settings) exposes editing `intake_questions` after onboarding.

So the agent's trade-specific intake questions are frozen to the onboarding trade
template; an owner who adds a new service post-onboarding gets `null`
intake_questions for it ("no questions asked"), and cannot tune existing ones from
the UI. This is config the agent reads that the UI **cannot set** post-onboarding —
the inverse of a phantom setting.
**Rec:** confirm whether this is intentional (V1 scope). If owner-tunable intake is
desired, add an `intake_questions` editor to the services-pricing panel. At minimum
document the gap so it isn't mistaken for a bug.

---

#### [INFO] F-7 — Read/write model alignment with post-call pipeline: confirmed consistent
`record_call_outcome` RPC (`migrations/060_phase59_rpcs.sql:40-107`).

The post-call write model matches the dashboard read models:
- RPC UPSERTs `customers (tenant_id, phone_e164, name, default_address)` →
  Customers list/detail read these. **OK.**
- `appointment_id` present ⇒ INSERT `jobs (tenant_id, customer_id, appointment_id,
  urgency)`; absent ⇒ INSERT `inquiries (… job_type, service_address, urgency)`.
  Jobs tab reads `jobs`, Inquiries tab reads `inquiries`. **OK** — the branch
  matches "booked ⇒ job, unbooked ⇒ inquiry".
- `customer_calls` / `job_calls` link rows written; these are **NOT** in the
  Realtime publication (per skill §13) — correct, they're join/audit only and the
  dashboard reads them via REST joins, not live.
- The `calls` row itself is written/updated by a **separate** post-call pipeline
  (recording/transcript/triage/outcome), which is what drives the Calls page
  UPDATE handler (`calls/page.js:473-486`). The UPDATE handler correctly maps by
  `id`. **OK.**

One subtlety: the Jobs/Inquiries pages rely on Realtime INSERT to animate the new
row, but `record_call_outcome` runs as `service_role` (SECURITY DEFINER). Inserts
by service_role **do** broadcast on Postgres Changes (Realtime authorization is
checked against the *subscriber's* RLS, not the writer's), so the live row should
arrive — consistent with the skill's documented data flow. No action.

---

#### [INFO] F-8 — `activity_log` feed freshness (residual)
The dashboard home `RecentActivityFeed` reads `activity_log`, which is **not** in
the Realtime publication (skill §13 lists only customers/jobs/inquiries/calls/
appointments/calendar_events). So the activity feed is **fetch-on-mount only** and
will not update live as calls land — a row added by the post-call pipeline appears
only on navigation/refresh. This is a known residual (pre-flagged), not a
regression. If a live activity feed is desired, add `activity_log` to the
publication and subscribe; otherwise leave as-is (a polled feed is a reasonable
product choice and avoids extra Realtime fanout).

---

### 7.4 Recommendation summary

| ID | Sev | Area | Action |
|---|---|---|---|
| F-1 | MEDIUM | Calls Realtime | Add filter guard to INSERT handler (mirror Jobs/Inquiries) |
| F-2 | MEDIUM | Calls display | Render transcript + surface `urgency_confidence`/`triage_layer_used`, or fix copy |
| F-3 | LOW | Realtime hygiene | Extract `useTenantId()` + namespaced-channel helper across 4 pages |
| F-4 | LOW | Jobs/Inquiries Realtime | Share `rowMatchesFilters`; add date+phone to client guard |
| F-5 | LOW | Priority callers | Confirm webhook reads `jobs.is_vip`; fix skill docs (`leads`→`jobs`) |
| F-6 | LOW | intake_questions | Decide if owner-tunable; add editor or document onboarding-only |
| F-7 | INFO | Write/read model | Confirmed consistent — no action |
| F-8 | INFO | activity_log | Polled-only by design; publish+subscribe only if live feed wanted |

**Approach verdict:** Postgres Changes + server-side `tenant_id` filter is the
correct Realtime architecture for this single-tenant-per-connection dashboard; keep
it and **do not** move to Broadcast until multi-seat / cross-tenant wallboard
fanout appears. The real defects are (a) the Calls page not re-checking compound
filters on live INSERT (F-1) and (b) the Calls display dropping transcript + triage
detail it already fetches (F-2); everything else is hygiene/doc drift.

#### Sources
- [Supabase — Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Supabase — Realtime Benchmarks](https://supabase.com/docs/guides/realtime/benchmarks)
- [Supabase — Broadcast](https://supabase.com/docs/guides/realtime/broadcast)
- [Supabase — Realtime Authorization (RLS)](https://supabase.com/docs/guides/realtime/authorization)
- [Supabase — Realtime RLS announcement](https://supabase.com/blog/realtime-row-level-security-in-postgresql)
- [Supabase — RLS Performance & Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase — Using Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs)

---
type: system
system: Voice Agent
status: current
description: "Browser-based testing of the LIVE production agent — no phone call, no Twilio. Covers: Room + dispatch contract; Sandbox gates (`deps['is_test_call']` / `params['is_test_call']`); Tenant-surface filters (main repo); Admin console files (main repo); Deployment order"
source: ".claude/skills/voice-call-architecture/SKILL.md § Test Calls & Admin Web Test Console (2026-08-25)"
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# Test Calls and Admin Web Test Console (2026-08-25)

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

Browser-based testing of the LIVE production agent — no phone call, no Twilio.
An admin talks to the agent over a LiveKit WebRTC room from `/admin/test-agent`;
the same Railway worker, prompt, tools, and post-call pipeline run, but every
real-world side effect is sandboxed.

### Room + dispatch contract

- Rooms are named **`test-web-{tenantId}-{ts}`** — deliberately NOT `call-*`
  (SIP dispatch rule) and NOT `test-call-*` (the LiveKit webhook flips
  `tenants.test_call_status` for those). The main-repo LiveKit webhook ignores
  `test-web-*` rooms entirely.
- Room **metadata is server-set** by `POST /api/admin/test-agent/session`
  (verifyAdmin): `{ test_call: true, web_test: true, tenant_id, to_number:
  tenant.phone_number, from_number? }`. The browser token has join/publish/
  subscribe grants only — it cannot alter metadata. `from_number` is an
  optional simulated caller-ID (exercises the repeat-caller/caller-history
  path, read-only); `agent.py` honors it only on test calls and only when the
  participant has no SIP caller-ID.
- **The worker registers `agent_name="voco-voice-agent"`, which DISABLES
  automatic dispatch.** The console connects the browser mic first, then
  `POST /api/admin/test-agent/dispatch` runs
  `AgentDispatchClient.createDispatch(roomName, 'voco-voice-agent')` — so
  `wait_for_participant` resolves instantly (no 30s race). The SAME fix was
  applied to `/api/onboarding/test-call` (phone test): it previously created
  the room + dialed the owner but never dispatched the agent → the owner
  connected to an agent-less room.

### Sandbox gates (`deps["is_test_call"]` / `params["is_test_call"]`)

A test call's ONLY durable footprint: its flagged `calls` row, its MP4
recording, and transient appointment rows that post_call auto-cancels.

| Site | Test-call behavior |
|---|---|
| `agent.py` calls upsert | writes `is_test_call: true` (migration **079**) — the key is included ONLY for test calls, so production inserts never reference the column (fail-open if 079 lags the agent deploy) |
| `agent.py` subscription gate | bypassed (admin can test canceled/past-due tenants; test calls never bill) |
| `agent.py` egress | audio-only **MP4** (`EncodedFileType.MP4`, path `{tenant_id}/{call_id}.mp4`) instead of OGG — directly downloadable from the console |
| `book_appointment` success | appointment row still created (realistic; briefly occupies the real slot) but **no Google/Outlook calendar push, no caller confirmation SMS** |
| `book_appointment` slot-taken | **no recovery SMS** |
| `capture_lead` | **skips the `record_call_outcome` RPC** (no customer/inquiry writes — a simulated number matching a real customer must never merge); verdict-driven return strings unchanged so the conversation is identical |
| `post_call` §3 auto-cancel | cancels **ALL** appointments the call created (union of the `call_id` FK lookup + `tool_call_log` appointment_ids; the old `limit(1)` leaked multi-booking tests) |
| `post_call` §4 usage | already skipped (pre-existing) |
| `post_call` §6.5 record_outcome | **skipped** — no CRM rows at all for test calls |
| `post_call` §7 owner notifications | **skipped** — no owner SMS/email |
| `transfer_call` | not gated: SIP REFER on a web participant fails fast → exercises the transfer-failure recovery path (documented in the console UI) |
| `agent.py` voice override | test calls only: metadata `voice_override` (an ElevenLabs voice_id) replaces the resolved `voice_id` AFTER normal `_resolve_voice` resolution, guarded by an `[A-Za-z0-9]{10,40}` shape check. The value comes exclusively from the session route's curated `VOICE_OPTIONS` allowlist (server-set metadata); production voice resolution (`tenants.ai_voice` → `ELEVENLABS_VOICE_MAP`) is untouched |

Still live on test calls (intentionally): full cascade pipeline, all tools,
real slot math, triage (incl. the layer-2 LLM call — OpenAI gpt-4.1-nano since 2026-09-04), transcript, recording,
hallucination detection, `gmaps_validate_events` telemetry rows (ops-only).

Locked by `livekit_agent/tests/test_test_call_sandbox.py` (source-grep
invariants, 12 tests).

### Tenant-surface filters (main repo)

`calls.is_test_call` (migration 079, NOT NULL DEFAULT false) is filtered with
`.eq('is_test_call', false)` in: `/api/calls`, `/api/dashboard/stats`
(missed-calls-today), `/api/search` (calls group), and the recovery-SMS cron
Branch A (**a simulated caller number is never texted**; Branch B is covered
transitively). The calls page Realtime INSERT/UPDATE handlers skip
`payload.new.is_test_call` client-side. NOT filtered (by design):
`cleanup-orphaned-calls` (should clean test rooms too), `customer-timeline` /
`invoice-describe` (test calls create no junction rows).

### Admin console files (main repo)

> **2026-09-05:** the console needs the browser microphone, so the site-wide
> `Permissions-Policy` in `next.config.js` must keep `microphone=(self)`.
> The page requests the mic FIRST (inside the click gesture), publishes the
> granted track, keeps error banners visible on failed steps (`abortCall`),
> shows the LiveKit `DisconnectReason` on genuine ends, and offers a
> tap-to-enable-audio button when autoplay is blocked (commits `ffdad13`, `d7f2654`).


| File | Role |
|---|---|
| `src/app/admin/test-agent/page.js` | Console UI: tenant picker, simulated caller number, voice override, **mic device picker + live input-level meter + silent-device probe** (`checkMic`/`startMeter`/`MicMeter`, Web Audio `AnalyserNode`; getUserMedia honors the selected `deviceId`), mic connect (livekit-client), live captions via `lk.transcription` text streams, in-call input meter ("your mic → agent"), mute/hang-up, 10-min timer, post-call results + MP4 player/download |
| `src/app/api/admin/test-agent/session/route.js` | verifyAdmin → createRoom (server-set sandbox metadata, emptyTimeout 600) + AccessToken (30m, join/publish/subscribe only). Holds the curated `VOICE_OPTIONS` allowlist (grouped by accent; GET serves it to the picker, POST validates `voice_override` against it — 400 on anything else). Voice IDs must be usable by the Voco ElevenLabs account (premade defaults are; Voice Library picks must be saved to "My Voices" first — an Asian-accented-English slot is stubbed in the list awaiting a chosen library voice ID) |
| `src/app/api/admin/test-agent/dispatch/route.js` | verifyAdmin → `createDispatch` — refuses non-`test-web-*` rooms |
| `src/app/api/admin/test-agent/result/route.js` | verifyAdmin → flagged calls row + **service-role** signed URL for the MP4 (dashboard flyouts sign with the user's own RLS-scoped session; an admin needs the service-role path). Refuses rows where `is_test_call` is false |

New dependency: `livekit-client`. Tests: `tests/api/admin-test-agent.test.js`,
dispatch assertion added to `tests/onboarding/test-call.test.js`, Branch A
chain updated in `tests/cron/recovery-sms-retry.test.js`.

### Deployment order

1. Apply migration **079** (manual, Supabase) — the main-repo filters 400
   without the column.
2. Deploy the main repo (filters are inert until a test call exists).
3. Deploy the agent (its writes are test-call-only, so it is safe in any
   order relative to the main repo — but after 079).

---

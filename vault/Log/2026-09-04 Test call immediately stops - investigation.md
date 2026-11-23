---
type: log
date: 2026-09-04
status: record
description: "2026-09-04/05 investigation of 'admin web test call immediately stops': agent side fine (scripted LiveKit-API call passes); ELEVEN_API_KEY is the key ID not the sk_ secret → preflight fix (livekit-agent 50708be); console page masked mic/dispatch errors as 'Call ended' → fixed main repo ffdad13 (mic-first, abortCall, DisconnectReason, audio-unblock); ROOT CAUSE = site-wide Permissions-Policy microphone=() header from the 2026-06-03 hardening → fixed d7f2654 (microphone=(self)), live-verified"
source: "Claude memory note project_2026_09_04_test_call_investigation.md"
migrated: 2026-11-23
tags: [voco/log]
---

# 2026-09-04 Test call immediately stops - investigation
**Report (2026-09-04, after the Phase 0+1 push):** "admin → Test Agent → Start test call: it
immediately stops, I'm not able to talk."

**What was verified:**
- Scripted reproduction WITHOUT a browser (scratch scripts, pattern worth reusing): create a
  `test-web-<tenant>-<ts>` room with the session route's metadata (`test_call, web_test,
  tenant_id, to_number`), join a participant via `livekit.rtc` publishing a mic track (silence or
  OpenAI-TTS-synthesized caller lines), then `agent_dispatch.create_dispatch(agent_name=
  "voco-voice-agent")`, and watch `lk.agent.state` attributes + `lk.transcription` text streams.
  The DEPLOYED agent passed: greeting, LLM reply, validate_address (OneMap hit → out-of-area gate),
  post-call `calls` row with timestamps. Railway `/health` + `/health/db` OK.
- No `calls` rows and no LiveKit egress records exist for the user's attempts → their sessions never
  reached `_run_db_queries` (agent never joined, or died pre-session). Most likely cause: they
  tested inside the Railway redeploy window (two back-to-back deploys ~09:25–09:50 UTC). NOT proven.
- Mechanism for the browser symptom: the console flips to *ended* on `RoomEvent.Disconnected`, and
  the SDK deletes the room whenever the AgentSession closes (`delete_room_on_close` default) — any
  early session close looks like "immediately stops" from the browser.

**Real defect found and fixed (livekit-agent `50708be`, skill sync `b3f65c4`):** `ELEVEN_API_KEY`
(local `.env` for sure — starts with "1e1"; Railway almost certainly, same timing signature) is the
ElevenLabs key *ID*, not the `sk_…` secret → ElevenLabs rejects it (`api_key_id_used_as_api_key`),
the TTS FallbackAdapter retries twice (~4-5 s) then uses OpenAI TTS → every call opened with ~6-7 s
of dead air, in the OpenAI voice, and the 10 s greeting-mute cap fired mid-greeting. Fix:
`_check_elevenlabs_key()` in `prewarm()` (`VOCO_TTS_KEY_PREFLIGHT`, default on) → on explicit
rejection `_build_tts()` uses OpenAI TTS directly (greeting 2.8 s after session start locally, was
7.5 s). **The user must still paste the `sk_` secret into Railway `ELEVEN_API_KEY`** to get
ElevenLabs voices/latency back.

**Round 2 (2026-09-05, user: "Connecting… then instantly ends"):** the deployed agent still never
saw their room (no `calls` row), and the dashboard's own SDK path (createRoom → token →
createDispatch, run from Node with the repo's livekit-server-sdk 2.15) works and the agent joins in
<4 s. Root cause found in the CONSOLE PAGE: any failure after `room.connect()` (mic permission /
device error, dispatch request error) set phase='error' then called `room.disconnect()`, whose
`Disconnected` event ran `handleEnded` → phase 'ended' — and the error banner only renders in phase
'error', so the real error was hidden behind "Call ended — results". Fixed in main repo `ffdad13`
(Vercel prod Ready 2026-09-04 16:44 UTC): getUserMedia FIRST inside the click gesture (clear
NotAllowed/NotFound/NotReadable messages; fixes mobile Safari too), publishTrack of the granted
track, `abortCall()` detaches the Disconnected listener on error paths, DisconnectReason name shown
on genuine ends, "Tap to enable audio" for autoplay-blocked browsers. The user's retry showed "Microphone access was denied … and I can't allow it" → **ROOT CAUSE:**
`next.config.js` `headers()` sent `Permissions-Policy: camera=(), microphone=(), geolocation=()`
site-wide since the 2026-06-03 security-headers commit; `microphone=()` makes getUserMedia reject
with NotAllowedError and the browser offers no grant UI. Fixed main repo `d7f2654`
(`microphone=(self)`, site-wide because the policy binds to the loaded document and App Router
navigation is client-side; console names a policy block via `document.permissionsPolicy`).
Live header verified `microphone=(self)` 2026-09-05.

**Local debugging harness gotchas (Windows):** `cli.run_app(... "dev")` runs the worker in a child
process — killing the runner script leaves the worker + inference executor ORPHANED and still
registered (served a later dispatch with stale code and logged nowhere). Kill every non-MCP
`python.exe` before restarting. Run `download-files` once locally (turn-detector `model_q8.onnx`),
and use a private `agent_name` so production SIP dispatches can never land on the local worker.
Local turn-detector inference failed (`_EUORunnerMultilingual has no _tokenizer`) — local-only.

**Why:** avoid re-deriving the reproduction path and the env-var diagnosis next time a test call
"doesn't work". **How to apply:** if the report recurs after the user has retried on the stable
deploy, get the browser console output + which tenant/voice was picked, and check `calls` for the
room name first. Related: [[2026-09-04 Call-experience Phase 0 and 1 executed]].

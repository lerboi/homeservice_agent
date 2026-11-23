---
type: log
date: 2026-09-05
status: record
description: "2026-09-05 'admin test call doesn't work / I can't talk': proven NOT a pipeline fault (a scripted real-Chromium call on prod passed end to end); real cause = console captured the OS-default mic blindly with no picker/feedback and this machine has several inputs incl. silent virtual devices → agent greets, hears nothing, no_input end. Fix = mic device picker + live level meter + silent-mic probe in page.js, committed f20d770 + pushed to main"
source: "Claude memory note project_2026_09_05_test_call_mic_picker.md"
migrated: 2026-11-23
tags: [voco/log]
---

# 2026-09-05 Test console mic picker
**Report (2026-09-05):** "look at the admin test call feature … it doesn't work. Fix it."

**Verified NOT broken:** a scripted real-Chromium test call against `www.voco.live`
(Playwright, `--use-file-for-fake-audio-capture`, admin session minted via Supabase
`admin.generateLink` → `verifyOtp` → `@supabase/ssr` cookie jar) passed the whole flow:
session route → mic publish → dispatch → agent joins → deterministic greeting →
Deepgram STT transcribed the synthesized caller line → gpt-4.1-mini reply → no-input
recovery → `calls` row `analyzed` + downloadable MP4. Railway `/health` + `/health/db`
OK. So agent, routes, Permissions-Policy (`microphone=(self)`), and CSP are all healthy.

**Real cause:** the console did `getUserMedia({audio:true})` (OS default) with NO device
picker and NO input feedback. This owner's Windows machine exposes 5+ audio inputs incl.
virtual streaming-capture devices (PicoStreamingMicrophone, Pico Streaming Speaker array)
that emit no audio unless an app drives them. When the default is a silent device the
agent greets, hears nothing, the no-input net fires, call ends — `disconnection_reason=
'no_input'`, 0 user turns. The owner's 01:50 SGT attempt (call `…1788544207977`) was
exactly this: greeting only in the transcript; room-composite MP4 RMS analysis showed
agent audio 1-5s then flat -118 dB (no caller channel). Distinguish the owner's REAL
attempts (0 user turns) from the PREVIOUS session's scripted repros in the `calls` table
(those carry synthesized "kitchen sink is leaking" caller turns).

**Fix (main repo `src/app/admin/test-agent/page.js`, commit `f20d770`, pushed to main;
Vercel deploys from main):** "4. Microphone" device picker (`enumerateDevices`;
`getUserMedia` honors selected `deviceId` via `micConstraint`), a live input-level meter
(`MicMeter` + Web Audio `AnalyserNode` in `startMeter`/`stopMeter`) in the setup card
("Check microphone"/"Re-check") and during the call ("your mic → agent"), and a
silent-device probe (~1.8s listen → "No sound detected" warning). Permissions-Policy
guard extracted to `micPolicyBlockedMessage()`, reused by preview + call paths. No agent
repo / route / header change.

**Verification harness (reusable, in scratchpad):** `ui-verify2.py` reads the meter fill
`div` width via a stable class selector; a `tone.wav` (immediate 440Hz) makes the meter
track and lists devices, a `silent.wav` flat-lines it and fires the warning. Test the
CLEAN build with `npx next start -p 3009` (not the user's long-running `next dev` on 3000
— Next 16 blocks a 2nd `dev` instance AND its stale HMR bundle gave a false flat-meter
reading; the primitives probe confirmed getUserMedia/AnalyserNode/rAF all work). Cookies
are host-only for `localhost` so one jar works across ports.

**Why:** avoid re-deriving that this feature's failures are environmental, not pipeline.
**How to apply:** if "test call doesn't work" recurs, FIRST check `calls` for the room —
a row with `no_input` + 0 user turns = silent/wrong mic (now self-diagnosing via the
in-console meter), not the agent. Related: [[2026-09-04 Test call immediately stops - investigation]],
[[LiveKit agent repo and Railway deployment]].

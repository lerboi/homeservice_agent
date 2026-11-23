---
type: log
date: 2026-09-05
status: record
description: "2026-09-05 'voice super slow & unnatural' diagnosis: NOT speech rate (~166 wpm fine) and NOT turn latency (true dead air ~1.4s median; the ~6s transcript gaps include the agent's own speaking time) — it's the VOICE TIMBRE = OpenAI alloy fallback because ELEVEN_API_KEY is still the key ID not the sk_ secret (ElevenLabs /v1/user → invalid_api_key). Fix: valid sk_ key on Railway (OWNER-only) + save chosen voice to My Voices. Shipped code: conversational voice map (Alexandra/Eryn/Cassidy), stability 0.5→0.45, endpointing 2.0→1.2, prompt ellipsis fix, admin picker refresh — livekit-agent main 166c3ad + homeservice_agent main f919aaa"
source: "Claude memory note project_2026_09_05_voice_quality_fix.md"
migrated: 2026-11-23
tags: [voco/log]
---

# 2026-09-05 Voice quality fix (ElevenLabs key, conversational voices)
**Report:** "voice sounds super slow and unnatural... unnaturally slow speaking style... replies not natural sounding." Referred to most recent test call.

**Measured from the live recording (test call `test-web-…-1788591978428`, 15:06 SGT):**
- Speech RATE ~166 wpm (greeting) — FINE, slightly fast, not slow.
- True inter-turn DEAD AIR: median 1.4s, mean 1.9s (50ms-frame silence-gap analysis
  of the room-composite mp4) — acceptable. The "6.2s gaps" from transcript
  `conversation_item_added` timestamps are misleading: that timestamp fires at/after
  the agent's OWN playout, so it includes speaking time. One 10.4s outlier = the
  validate_address/postal-confusion tool turn.
- Agent replies were SHORT and CLEAN (no ellipses, no "speak slowly") → the prompt
  refactor is NOT the cause.

**Root cause (voice timbre):** the agent is speaking in OpenAI `alloy` (flat/monotone
= reads as "slow/unnatural/unpleasant"), NOT ElevenLabs. `ELEVEN_API_KEY` (local .env,
almost certainly Railway too) is the ElevenLabs key **ID** ("1e12…", 64 chars, no sk_
prefix); ElevenLabs `/v1/user` returns `invalid_api_key: API key ID used as API key`.
Preflight then builds OpenAI TTS directly (greeting had no pre-greeting failover gap,
confirming OpenAI-direct, not per-turn failover). This is the SAME unfixed key issue
from [[2026-09-04 Test call immediately stops - investigation]].

**#1 FIX — OWNER-ONLY (I can't handle the secret):** set Railway `ELEVEN_API_KEY` to
the `sk_…` SECRET (ElevenLabs dashboard → API Keys). That alone flips alloy → real
ElevenLabs. Also SAVE the chosen voice(s) to the account's "My Voices" or the plugin
hard-fails back to alloy.

**Research (subagent, URLs in transcript):** model `eleven_flash_v2_5` is correct
(~75ms TTFB; `eleven_v3` NOT real-time; `eleven_v3_conversational` ~280ms optional
premium; `eleven_turbo_v2_5` deprecated). Best conversational voices (ElevenLabs' own
voice-agent guide): **Alexandra `kdmDKE6EkgrWrrykO9Qt`** (chatty young female — my pick),
Eryn `dj3G1R1ilKoFKhBnWOzG`, Hope `OYTbf65OHHFELVut7v2H`, Cassidy `56AoDkrOh6qfVPDXZ7Pt`,
Angela `PT4nqlKZfc06VW1BuClj`; male Mark `1SM7GgM6IMuvQlz2BwM3`, Stuart, Archer. Settings
for lively: stability 0.40-0.50 (higher trends monotonous), similarity 0.75, style 0,
speaker_boost OFF, speed 1.0-1.10 (1.08 fine; <1.0 sounds sluggish). Spanish: any voice
speaks ES on Flash but with an English accent — swap to a native-Spanish voice_id +
language="es" for authentic ES (deferred). Telephony: request 8kHz μ-law to skip a
resample (deferred — not the main issue).

**Shipped (both repos, pushed to main):**
- livekit-agent main `166c3ad`: ELEVENLABS_VOICE_MAP → Alexandra/Eryn/Cassidy;
  VOCO_TTS_STABILITY 0.5→0.45; VOCO_MAX_ENDPOINTING_DELAY_S 2.0→1.2; prompt.py VOICE
  section now forbids ellipses/dashes (Flash renders them as halting pauses). 634 tests
  green / 1 pre-existing VIP fail.
- homeservice_agent main `f919aaa`: admin console VOICE_OPTIONS refreshed with the
  conversational picks for auditioning + skill changelog.

**Pending (owner):** (1) set sk_ key on Railway; (2) save Alexandra/Eryn/Cassidy to My
Voices; (3) audition via the admin console voice picker (now fixed,
[[2026-09-05 Test console mic picker]]) and confirm the pin (Alexandra is my
recommendation). Voice map change is neutral-or-better since prod is currently alloy.
To pinpoint any residual turn latency, fetch Railway `[agent] turn_metrics`/`llm_metrics`
logs (railway CLI was logged out this session).

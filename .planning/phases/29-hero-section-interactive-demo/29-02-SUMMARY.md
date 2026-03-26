---
phase: 29-hero-section-interactive-demo
plan: 02
subsystem: api
tags: [elevenlabs, tts, audio, mp3, rate-limiting, nextjs-api-route, nodejs-script]

# Dependency graph
requires:
  - phase: 29-01
    provides: Hero section component foundation and context for the interactive demo
provides:
  - POST /api/demo-voice — ElevenLabs TTS route that accepts a business name and returns audio/mpeg
  - scripts/generate-demo-audio.js — one-time pre-render script for static demo MP3 segments
  - public/audio/ directory tracked in git for demo-intro.mp3, demo-mid.mp3, demo-outro.mp3
affects:
  - 29-03 (HeroDemoInput component uses /api/demo-voice endpoint)
  - 29-04 (HeroDemoPlayer stitches static segments from public/audio/)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct fetch() to ElevenLabs REST API (no SDK) for server-side TTS generation"
    - "Module-level Map for IP-based rate limiting in Next.js API routes"
    - "Buffer.concat for multi-voice MP3 stitching (frame-based MP3 is concatenation-safe)"

key-files:
  created:
    - src/app/api/demo-voice/route.js
    - scripts/generate-demo-audio.js
    - public/audio/.gitkeep
  modified: []

key-decisions:
  - "Direct fetch() to ElevenLabs REST API over elevenlabs npm SDK — simpler for a single endpoint, no package overhead"
  - "IP-based rate limiting via module-level Map (10s cooldown per IP, 60s TTL cleanup) — prevents TTS abuse without Redis dependency"
  - "Buffer.concat for multi-voice MP3 stitching — MP3 is frame-based so concatenation is valid without re-encoding"
  - "demo-mid generated as 4 sequential TTS calls (AI + caller + AI + caller) concatenated — achieves D-06 two-voice requirement"

patterns-established:
  - "Pattern: ElevenLabs TTS via xi-api-key header, eleven_multilingual_v2 model, mp3_44100_128 output format"
  - "Pattern: Return raw audio/mpeg binary from Next.js route (new Response(buffer, { headers: { Content-Type: audio/mpeg } }))"
  - "Pattern: Pre-render script loads .env.local via dotenv, loops over segments, logs progress and byte size"

requirements-completed:
  - DEMO-03
  - DEMO-05

# Metrics
duration: 2min
completed: 2026-03-26
---

# Phase 29 Plan 02: Audio Pipeline Summary

**ElevenLabs TTS API route (/api/demo-voice) with IP rate limiting plus pre-render script generating three static demo MP3 segments (intro/mid/outro) using two distinct voices**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-26T09:11:14Z
- **Completed:** 2026-03-26T09:12:59Z
- **Tasks:** 2 of 3 completed (Task 3 is a human-action checkpoint — awaiting ElevenLabs setup)
- **Files modified:** 3 created

## Accomplishments

- POST /api/demo-voice accepts a business name, validates input (2-100 chars), applies IP-based rate limiting (10s cooldown, 60s TTL cleanup), calls ElevenLabs TTS, and returns raw audio/mpeg binary
- Returns proper HTTP status codes: 400 for invalid input, 429 for rate-limited, 502 for ElevenLabs failure, 500 for unexpected errors
- Pre-render script generates demo-intro.mp3 (caller voice), demo-mid.mp3 (4-part AI+caller interleaved, concatenated), demo-outro.mp3 (AI voice) — run once after credentials are configured

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /api/demo-voice TTS route with rate limiting** - `04b9c6a` (feat)
2. **Task 2: Create pre-render script and generate static demo audio files** - `8954b67` (feat)
3. **Task 3: User sets up ElevenLabs API key and runs pre-render script** - CHECKPOINT (human-action, pending)

## Files Created/Modified

- `src/app/api/demo-voice/route.js` - POST handler with ElevenLabs TTS call, IP rate limiting, audio/mpeg response
- `scripts/generate-demo-audio.js` - Node.js pre-render script for static demo segments (3 segments, 4 TTS calls for demo-mid)
- `public/audio/.gitkeep` - Tracks the public/audio/ directory in git ahead of MP3 file generation

## Decisions Made

- Used direct `fetch()` to ElevenLabs REST API instead of the `elevenlabs` npm SDK — simpler for a single endpoint, zero additional package dependency
- IP rate limiting via module-level `Map` — avoids Redis dependency while preventing TTS abuse, sufficient for landing page traffic
- `demo-mid` uses 4 sequential TTS calls (AI asks address, caller replies, AI offers slot, caller confirms) then `Buffer.concat()` — achieves two distinct voices per D-06 without audio stitching infrastructure
- `dotenv` loaded with `try/catch` so the script degrades gracefully if dotenv is not installed (falls back to environment variables)

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

**External service requires manual configuration before audio files can be generated.**

1. Create ElevenLabs account at https://elevenlabs.io (Starter plan $5/mo recommended)
2. Get API key from https://elevenlabs.io/app/settings/api-keys
3. Browse voices at https://elevenlabs.io/app/voice-library and select:
   - AI receptionist voice (female, professional — e.g., "Rachel") — copy Voice ID
   - Caller voice (male, casual — e.g., "Adam") — copy Voice ID
4. Add to `.env.local`:
   ```
   ELEVENLABS_API_KEY=your_api_key_here
   ELEVENLABS_VOICE_ID_AI=voice_id_for_ai_receptionist
   ELEVENLABS_VOICE_ID_CALLER=voice_id_for_caller
   ```
5. Run: `node scripts/generate-demo-audio.js`
6. Verify three MP3 files exist in `public/audio/` and sound correct
7. Test API route: `curl -X POST http://localhost:3000/api/demo-voice -H "Content-Type: application/json" -d '{"businessName":"Smith Plumbing"}' --output test.mp3`
8. Type "done" to resume plan 03

## Next Phase Readiness

- /api/demo-voice route is ready for plan 03 (HeroDemoInput component will call it)
- public/audio/ directory exists and is tracked; MP3 files will be added after user runs pre-render script
- Plan 03 (HeroDemoInput) and plan 04 (HeroDemoPlayer) both depend on these artifacts

---
*Phase: 29-hero-section-interactive-demo*
*Completed: 2026-03-26 (paused at Task 3 checkpoint)*

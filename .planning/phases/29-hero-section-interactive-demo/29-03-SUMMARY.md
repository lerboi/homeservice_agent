---
phase: 29-hero-section-interactive-demo
plan: 03
subsystem: ui
tags: [react, web-audio-api, elevenlabs, lucide, sonner, next-js]

# Dependency graph
requires:
  - phase: 29-02
    provides: /api/demo-voice POST endpoint that returns audio/mpeg ArrayBuffer for dynamic name TTS
provides:
  - HeroDemoInput client component — input/loading state machine with parallel audio fetching and auth-aware skip link
  - HeroDemoPlayer client component — Web Audio API stitching, waveform visualization, play/pause/replay, post-play CTA
affects:
  - 29-04 (HeroSection wiring — these components are consumed in Plan 04)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Web Audio API buffer stitching via decodeAudioData + getChannelData set into a single AudioBuffer
    - requestAnimationFrame progress tracking synchronized against AudioContext.currentTime
    - Deterministic waveform amplitude envelope using sine-wave formula (no Math.random)
    - Dynamic supabase-browser import inside useEffect to avoid SSR issues with auth check

key-files:
  created:
    - src/app/components/landing/HeroDemoInput.jsx
    - src/app/components/landing/HeroDemoPlayer.jsx
  modified: []

key-decisions:
  - "HeroDemoInput uses dynamic import('@/lib/supabase-browser') inside useEffect to avoid SSR issues while still performing auth check for skip link"
  - "HeroDemoPlayer created inside component mount (not module level) so AudioContext is created post-user-gesture — avoids autoplay policy block"
  - "ArrayBuffers passed to decodeAudioData with .slice() to prevent detachment errors when decode consumes the buffer"
  - "pausedAtRef tracks pause position; source.onended checks !pausedAtRef.current to distinguish natural end from pause-triggered stop"

patterns-established:
  - "Pattern: Web Audio stitching — decode each segment with .slice(), concatenate via getChannelData set at offset into a combined AudioBuffer"
  - "Pattern: Waveform bars — 40 bars desktop / 28 mobile, 3px wide, 4px gap, progress fraction drives active vs inactive coloring"

requirements-completed:
  - DEMO-02

# Metrics
duration: 15min
completed: 2026-03-26
---

# Phase 29 Plan 03: Hero Demo Components Summary

**HeroDemoInput (input/loading state machine + parallel audio fetch) and HeroDemoPlayer (Web Audio API stitching + waveform visualization) built as 'use client' components ready for HeroSection wiring.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-26T09:40:00Z
- **Completed:** 2026-03-26T09:55:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- HeroDemoInput handles idle/loading state machine, parallel fetch of /api/demo-voice + 3 static MP3s, error recovery via sonner toast, button disabled < 2 chars, auth-aware skip link, and mobile-responsive flex-col sm:flex-row layout
- HeroDemoPlayer stitches 4 ArrayBuffers into a single AudioBuffer via Web Audio API, plays with requestAnimationFrame progress tracking, 40-bar deterministic waveform, play/pause/replay, and post-play Start Your Free Trial CTA
- npm run build passes with no SSR issues — both components are client-only ('use client') and use no browser APIs at module scope

## Task Commits

Each task was committed atomically:

1. **Task 1: Build HeroDemoInput client component** - `8cc706a` (feat)
2. **Task 2: Build HeroDemoPlayer with Web Audio API** - `8a275a7` (feat)

## Files Created/Modified

- `src/app/components/landing/HeroDemoInput.jsx` - Input + button pill with idle/loading state machine, parallel audio fetch, auth-aware skip link
- `src/app/components/landing/HeroDemoPlayer.jsx` - Web Audio API buffer stitching, waveform bars, play/pause/replay, post-play CTA

## Decisions Made

- Dynamic import of supabase-browser inside useEffect — avoids SSR issues while still running auth check in the browser
- AudioContext created inside component mount effect, not at module scope — ensures it's created after user gesture (the "Listen to Your Demo" click), avoiding autoplay policy blocks
- `.slice()` on ArrayBuffers before `decodeAudioData` — prevents `DOMException: The buffer passed to decodeAudioData has been detached`
- `pausedAtRef.current` sentinel distinguishes natural audio end from pause-triggered `onended` event — only transitions to 'ended' state on natural completion

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. ElevenLabs credentials were established in Plan 02.

## Next Phase Readiness

Both components are ready to be wired into HeroSection.jsx in Plan 04. HeroDemoInput takes `onAudioReady` prop, HeroDemoPlayer takes `audioBuffers` prop. The parent component (HeroSection or a wrapper) needs to manage the state transition from input to player.

---
*Phase: 29-hero-section-interactive-demo*
*Completed: 2026-03-26*

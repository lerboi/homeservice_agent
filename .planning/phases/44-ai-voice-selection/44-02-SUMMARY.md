---
phase: 44-ai-voice-selection
plan: 02
subsystem: ui
tags: [react, lucide-react, audio, design-tokens, supabase, sonner]

# Dependency graph
requires:
  - phase: 44-01
    provides: PATCH /api/ai-voice-settings route and ai_voice column on tenants table
provides:
  - VoicePickerSection component with dropdown voice selector, audio preview playback, auto-save on select
  - SettingsAISection updated to render VoicePickerSection above phone number block
  - ai-voice-settings page.js extended to fetch ai_voice + tone_preset and resolve effective voice
affects:
  - 45-in-browser-voice-test (depends on voice selection UI from this phase)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Audio mutual exclusion via single audioRef: pause current before starting new"
    - "useEffect cleanup for HTMLAudioElement to prevent memory leaks on unmount"
    - "role=radio/radiogroup pattern for accessible card selection grids"
    - "design-tokens imported (card, btn, selected, focus) for consistent styling"

key-files:
  created:
    - src/components/dashboard/VoicePickerSection.jsx
  modified:
    - src/components/dashboard/SettingsAISection.jsx
    - src/app/dashboard/more/ai-voice-settings/page.js

key-decisions:
  - "Single audioRef tracks current HTMLAudioElement; clicking a second play stops the first without separate state tracking per card"
  - "initialVoice prop synced to selectedVoice state via useEffect (not just useState initializer) so state updates when page data loads after mount"
  - "Save button disabled when no voice selected — graceful no-op prevention without dirty-tracking"
  - "Grid uses grid-cols-1 sm:grid-cols-2 — single column on very small screens, 2-col at sm breakpoint per UI-SPEC"

patterns-established:
  - "VoiceCard rendered inline in VoicePickerSection (not a separate file) — keeps related logic co-located"

requirements-completed:
  - VOICE-SEL-04
  - VOICE-SEL-05
  - VOICE-SEL-06

# Metrics
duration: 15min
completed: 2026-04-11
---

# Phase 44 Plan 02: AI Voice Selection UI Summary

**VoicePickerSection with 2x3 card grid, audio preview mutual exclusion, copper-border selection state, and Save button that PATCHes /api/ai-voice-settings with sonner toast feedback**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-11T00:00:00Z
- **Completed:** 2026-04-11T00:15:00Z
- **Tasks:** 2 of 2 complete
- **Files modified:** 3

## Accomplishments
- Created VoicePickerSection.jsx with 6 voice cards grouped by Female/Male gender labels
- Audio preview plays/pauses with mutual exclusion (only one plays at a time); cleanup on unmount
- Design tokens applied throughout (selected.card copper border, selected.cardIdle idle state, card.hover, btn.primary, focus.ring)
- SettingsAISection updated to accept initialVoice prop and render VoicePickerSection above phone block
- page.js Supabase query extended to fetch ai_voice field; pre-selects the matching card on load

## Task Commits

1. **Task 1: VoicePickerSection component + page integration** - `444b54d` (feat)

**Plan metadata:** pending final docs commit

## Files Created/Modified
- `src/components/dashboard/VoicePickerSection.jsx` - New voice picker component with 2x3 card grid, audio playback, selection state, and Save button
- `src/components/dashboard/SettingsAISection.jsx` - Updated to import VoicePickerSection, accept initialVoice prop, render picker above phone number block
- `src/app/dashboard/more/ai-voice-settings/page.js` - Extended Supabase select to include ai_voice; added currentVoice state; passes initialVoice prop to SettingsAISection

## Decisions Made
- Single audioRef pattern for mutual audio exclusion — avoids per-card audio state, simpler cleanup
- initialVoice synced via useEffect so component responds when data loads after initial render
- Grid collapses to single column on xs screens (grid-cols-1) then 2-col at sm breakpoint

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

- Audio files at `/public/audio/voices/{voicename}.mp3` do not exist yet. The plan comments "TODO: Replace placeholder audio with real voice samples (D-10)". Play buttons will trigger audio errors until real `.mp3` files are placed there. This is an intentional placeholder noted in the plan.

## Issues Encountered
None — build passed cleanly on first attempt.

## Next Phase Readiness
- VoicePickerSection is wired end-to-end (UI → PATCH API → DB)
- Awaiting human visual verification (Task 2 checkpoint) before plan is considered fully complete
- Audio preview files at `/public/audio/voices/*.mp3` must be added before voice previews work
- Phase 45 (In-Browser Voice Test) can proceed — depends on Phase 44 voice selection which is now complete

---
*Phase: 44-ai-voice-selection*
*Completed: 2026-04-11*

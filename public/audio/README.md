# Landing Page Audio Assets

## Files

- `demo-intro.mp3` — Hero demo intro line (caller opening). Also used by Phase 47 OBJ-02 inline mini-player in PracticalObjectionsGrid (AudioPlayerCard.jsx). Per 47-RESEARCH.md Open Question #1, this file is the approved fallback for the OBJ-02 player until a dedicated short AI voice sample is produced.
- `demo-mid.mp3` — Hero demo mid section.
- `demo-outro.mp3` — Hero demo closing section.

## Phase 47 — OBJ-02 Player

The `AudioPlayerCard.jsx` component (Plan 03) uses `/audio/demo-intro.mp3` as its `src`. If a dedicated short sample (~8–12 seconds) is produced later, swap the path.

The single-play coordination rule (UI-SPEC Pitfall 6): only one audio source per page plays at a time. AudioPlayerCard must pause HeroDemoBlock audio (and vice versa) via the `window.vocoAudioRef` singleton pattern introduced in Plan 03.

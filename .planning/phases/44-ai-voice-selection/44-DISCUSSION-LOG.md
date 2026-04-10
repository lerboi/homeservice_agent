# Phase 44: AI Voice Selection - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 44-ai-voice-selection
**Areas discussed:** Voice picker layout, Audio preview interaction, Selection persistence, Voice-to-tone relationship

---

## Voice Picker Layout

| Option | Description | Selected |
|--------|-------------|----------|
| 2x3 grid | Two columns, three rows. Compact, all visible at once. Gender groups stacked | ✓ |
| 3x2 grid | Three columns, two rows. Wider cards, more horizontal | |
| Single column list | Full-width cards stacked vertically. More room per card | |

**User's choice:** 2x3 grid (accepted Claude's recommendation)
**Notes:** Gender-grouped — female top row (Aoede, Erinome, Sulafat), male bottom row (Zephyr, Achird, Charon). Responsive collapse to 2-col or 1-col on mobile.

---

## Audio Preview Interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Play icon on card | Small play/pause button in card corner, auto-stops others | ✓ |
| Play on card click | Card click plays audio, separate select action for choosing | |
| Dedicated play button | Card for selection only, separate button underneath for preview | |

**User's choice:** Play icon on card

| Option | Description | Selected |
|--------|-------------|----------|
| `/public/audio/voices/` | Static files deployed with app. Simplest, zero latency | ✓ |
| Supabase Storage | Uploaded to bucket, fetched via signed URL | |

**User's choice:** Static files in `/public/audio/voices/`
**Notes:** Owner will provide the pre-recorded audio sample files.

---

## Selection Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-save on click | Immediately persists to DB on card selection | |
| Explicit Save button | Owner picks voice, then clicks Save to persist | ✓ |
| Auto-save with undo | Saves immediately, shows toast with Undo for 5 seconds | |

**User's choice:** Explicit Save button
**Notes:** Toast confirmation on save.

---

## Voice-to-Tone Relationship

| Option | Description | Selected |
|--------|-------------|----------|
| Voice fully decouples from tone | ai_voice and tone_preset are independent | |
| Voice overrides tone's voice only | ai_voice overrides VOICE_MAP when set, NULL falls back to tone mapping | ✓ |
| Selecting voice also sets tone | Each voice maps to a tone preset | |

**User's choice:** Voice overrides tone's voice only (option 2)
**Notes:** tone_preset continues to control prompt personality independently. No migration backfill — existing tenants stay NULL until they actively choose.

---

## Claude's Discretion

- Card dimensions, spacing, and exact responsive breakpoints
- Play button icon style and positioning
- Toast duration and styling
- Save button placement
- Loading/disabled states during save

## Deferred Ideas

None — discussion stayed within phase scope

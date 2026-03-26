# Phase 29: Hero Section Interactive Demo - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 29-hero-section-interactive-demo
**Areas discussed:** Voice demo approach, Audio player UI, Hero title/copy, Input bar design, Responsive rotating text
**Mode:** --auto (all areas auto-selected, recommended defaults chosen)

---

## Voice Demo Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-rendered + dynamic name splice | Static audio segments + runtime TTS for business name only | ✓ |
| Fully dynamic TTS | Generate entire conversation via API on each play | |
| ElevenLabs conversational | Use ElevenLabs' conversational API for real-time two-voice generation | |

**User's choice:** Pre-rendered + dynamic name splice (auto-selected: recommended for instant playback + minimal cost)
**Notes:** User suggested this approach in pre-discussion. OpenAI TTS at $15/1M chars for the name segment. Pre-rendered segments stored as static files.

---

## Audio Player UI

| Option | Description | Selected |
|--------|-------------|----------|
| Waveform visualizer | Visual waveform with play/pause, replacing input bar in-place | ✓ |
| Simple play/pause | Minimal button with progress bar | |
| Full audio card | Separate card below input with album-art style layout | |

**User's choice:** Waveform visualizer (auto-selected: visually engaging, matches dark hero)
**Notes:** Player replaces the input bar in the same position. "Try another name" link to return to input.

---

## Hero Title/Copy

| Option | Description | Selected |
|--------|-------------|----------|
| Claude's Discretion | Shorten title while keeping rotating text pattern | ✓ |
| User-specified | User provides exact wording | |

**User's choice:** Claude's Discretion (auto-selected: user requested "slightly shorter" without specific wording)
**Notes:** User said "make the main title slightly shorter." Subtitle changes to direct user to input bar.

---

## Input Bar Design

| Option | Description | Selected |
|--------|-------------|----------|
| Inline input + CTA | Single input with button on right side, replacing both current buttons | ✓ |
| Stacked input + button | Input on one line, button below | |
| Two-step (input then button) | Input auto-focuses, enter key triggers demo | |

**User's choice:** Inline input + CTA (auto-selected: clean conversion-focused design)
**Notes:** Dark hero styling. "Start Free Trial" text link below for skip-to-onboarding path.

---

## Responsive Rotating Text

| Option | Description | Selected |
|--------|-------------|----------|
| CSS width transition | Transition width to match current word, replace invisible sizer | ✓ |
| Fixed width per word | Pre-calculate widths, set explicitly | |
| Keep longest-word sizer | Current behavior (no change) | |

**User's choice:** CSS width transition (auto-selected: smooth reflow as words cycle)
**Notes:** User specifically requested "make the text responsive and move according to the length of the text that is being cycled."

---

## Claude's Discretion

- Exact hero title wording
- Demo script dialogue content
- OpenAI TTS voice selection
- Waveform visualizer implementation
- Web Audio API stitching approach
- Transition animations
- Mobile layout adjustments

## Deferred Ideas

- ElevenLabs conversational API for fully dynamic demos
- Customizable demo scenarios
- Shareable demo audio URLs
- A/B testing demo scripts

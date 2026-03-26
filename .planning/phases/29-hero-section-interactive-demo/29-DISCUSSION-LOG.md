# Phase 29: Hero Section Interactive Demo - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 29-hero-section-interactive-demo
**Areas discussed:** Voice demo approach, Demo script & scenario, Input bar & player UI, Hero title & copy
**Mode:** Interactive (user-selected all 4 areas)

---

## Voice Demo Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-rendered + name splice | Static audio segments + runtime TTS for business name only | ✓ |
| Fully dynamic generation | Generate entire conversation via TTS API on each play | |
| Pre-rendered only (no dynamic name) | Generic placeholder, zero API cost | |

**User's choice:** Pre-rendered + name splice

### TTS Service

| Option | Description | Selected |
|--------|-------------|----------|
| OpenAI TTS | $15/1M chars, ~0.5s latency, 6 voices | |
| ElevenLabs | $5/mo for 30k chars, best-in-class quality | ✓ |
| Google Cloud TTS | Free tier 4M chars/mo, slightly robotic | |

**User's choice:** ElevenLabs

### Pre-render Service

| Option | Description | Selected |
|--------|-------------|----------|
| ElevenLabs for everything | Same voice consistency, generate static once | ✓ |
| OpenAI for static, ElevenLabs for name | Cheaper but potential voice mismatch | |

**User's choice:** ElevenLabs for everything

---

## Demo Script & Scenario

| Option | Description | Selected |
|--------|-------------|----------|
| Plumbing emergency | Burst pipe, urgency triage, same-day booking | |
| HVAC routine maintenance | AC service before summer, next-available slot | ✓ |
| General/mixed | Generic scenario for any trade | |

**User's choice:** HVAC routine maintenance

### Duration

| Option | Description | Selected |
|--------|-------------|----------|
| 20-25 seconds | Short and punchy | ✓ |
| 35-45 seconds | Longer, more capabilities shown | |
| Under 15 seconds | Ultra-short | |

**User's choice:** 20-25 seconds

### Voices

| Option | Description | Selected |
|--------|-------------|----------|
| Two voices | AI receptionist + caller | ✓ |
| AI voice only | Only AI speaks, caller lines as text | |

**User's choice:** Two voices

---

## Input Bar & Player UI

### Input Bar

| Option | Description | Selected |
|--------|-------------|----------|
| Input with inline button | Search-bar style, button flush right | ✓ |
| Input above, button below | Full-width input, CTA centered below | |
| Floating pill input | Rounded pill with integrated button | |

**User's choice:** Input with inline button

### Player

| Option | Description | Selected |
|--------|-------------|----------|
| Waveform bars + play/pause | Animated CSS bars, replaces input in-place | ✓ |
| Simple progress bar + play/pause | Thin bar, minimal | |
| Transcript + audio | Scrolling text synced to audio | |

**User's choice:** Waveform bars + play/pause

### Post-Play

| Option | Description | Selected |
|--------|-------------|----------|
| Player stays, CTA appears below | Replay available, signup CTA below | ✓ (modified) |
| Auto-transition to CTA | Player fades, CTA takes its place | |
| Player stays, no extra CTA | Just replay, minimal | |

**User's choice:** Player stays, CTA appears below — but WITHOUT the "Try another name" link. Once they've heard the demo, keep them moving toward signup.

---

## Hero Title & Copy

### Title

| Option | Description | Selected |
|--------|-------------|----------|
| Claude's discretion | Shorter, punchier, keep rotating text | ✓ |
| Keep current title | No change | |
| User-specified wording | User provides exact text | |

**User's choice:** Claude's discretion

### Subtitle

| Option | Description | Selected |
|--------|-------------|----------|
| Direct to input | Guide user to enter business name | ✓ |
| Keep current subtitle | No change | |
| Hybrid | Value prop + call-to-action | |

**User's choice:** Direct to input

### Eyebrow + Social Proof

| Option | Description | Selected |
|--------|-------------|----------|
| Keep both | Eyebrow pill and social proof stay | |
| Keep eyebrow, remove social proof | Social proof may clash with input | |
| Remove both | Let demo input be sole focus | ✓ |

**User's choice:** Remove both

---

## Claude's Discretion

- Exact hero title wording
- Demo script dialogue content (HVAC routine scenario)
- ElevenLabs voice selection for both speakers
- Waveform visualizer implementation
- Web Audio API stitching approach
- Transition animations
- Mobile layout adjustments
- Post-play CTA styling

## Deferred Ideas

- ElevenLabs conversational API for fully dynamic demos
- Customizable demo scenarios
- Shareable demo audio URLs
- A/B testing demo scripts

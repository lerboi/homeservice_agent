# Phase 47: Landing — Objection-Busting, Repositioning, and Landing Polish — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 47-landing-objection-busting-repositioning-and-landing-polish
**Areas discussed:** Revenue calculator (OBJ-07), Section architecture + ordering, FAQ content, Visual style + media

---

## Revenue Calculator (OBJ-07)

User flagged that an ROI calculator already exists on the pricing page (`src/app/(public)/pricing/ROICalculator.jsx`).

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse ROICalculator on landing | Import existing component | |
| Link-only: landing stat → pricing calculator | Cost-of-inaction stat on landing, CTA scrolls to pricing calculator | |
| Drop OBJ-07 from Phase 47 | Pricing calculator already serves the objection; remove from landing scope | ✓ |
| Build a mini version on landing | Simpler 1-input variant + link to full calculator | |

**User's choice:** Drop OBJ-07 from Phase 47.
**Notes:** REQUIREMENTS.md updated to mark OBJ-07 as "addressed elsewhere (pricing page)".

---

## Section Architecture + Ordering

### Q1 — Objection counter organization

| Option | Description | Selected |
|--------|-------------|----------|
| One consolidated "Why Voco" section | Grid of 5-6 counter cards in a single section | |
| Scattered individual sections | Each objection gets own full section break | |
| Two sections: identity + practical | OBJ-06 standalone emotional; OBJ-02/03/04/05/08/09 in practical grid | ✓ |

**User's choice:** Two sections (identity + practical split).

### Q2 — FAQ placement + integrated chat

| Option | Description | Selected |
|--------|-------------|----------|
| Just above FinalCTA | Classic last-mile doubt catcher | |
| After objection counters, before SocialProof | Groups all objection handling first | |
| Collapsed by default at bottom | Low-key placement post-CTA | |
| **User-added via clarification:** FAQ above FinalCTA + integrated AI chat widget | User asked for chat widget added to FAQ section | ✓ |

**User's choice:** FAQ above FinalCTA + integrated AI chat panel (right side, reuses `/api/chat`).
**Notes:** User asked for a "smartly nicely integrated chat section where the user can ask anything to the already existing AI chatbot in the landing page". Clarified that no text chatbot existed on landing previously (HeroDemoBlock is voice). Decision: reuse `/api/chat` route from Phase 37 dashboard ChatbotSheet, surface a right-side chat panel beside FAQ accordion.

### Q3 — Workflow strip (REPOS-03) placement

User flagged this felt redundant with HowItWorks.

| Option | Description | Selected |
|--------|-------------|----------|
| Between Hero and HowItWorks | Pre-HowItWorks framing | |
| Inside HowItWorksSection header | Tucked above existing flow | |
| After FeaturesCarousel as "zoom-out" | Summary bookend | |
| **Pivot: "Voco replaces these 5 tools"** | Comparison angle (replaces apps, not flow) | |
| **Pivot: "What happens after the call"** | Extension angle — CRM, notifications, follow-ups, analytics | ✓ |
| Drop REPOS-03 entirely | Accept HowItWorks covers it | |
| Merge into HowItWorks header as one-line | Framing banner, no new section | |

**User's choice:** Pivot to "what happens after the call" extension strip (following Claude's recommendation).
**Notes:** Keeps REPOS-03 but adds new information rather than repeating HowItWorks.

### Q4 — Pull-quote (REPOS-04) placement

User asked for UI/UX-best-for-conversion recommendation.

| Option | Description | Selected |
|--------|-------------|----------|
| Inside OBJ-06 identity section | Co-locate emotional pieces | |
| Standalone between SocialProof and FAQ | Breathing-room pause before CTA | ✓ |
| Overlay on hero as subtitle | Boldest prominence, risks overcrowding | |

**User's choice:** Standalone between SocialProof and FAQ (Claude's recommendation).

---

## FAQ Content

### Q1 — FAQ question set

| Option | Description | Selected |
|--------|-------------|----------|
| Full 10 questions | Broad coverage including edge cases | |
| Core 7 only (Q1-7) | Tighter scope | |
| Core 7 + let me add/remove | Start from core 7, user adjusts freeform | ✓ |

**User's choice:** Core 7 + adjust. Change Q1 wording from "Will my customers know they're talking to AI?" to "Does Voco sound robotic?" (confident, direct phrasing). Kept the other 6 as drafted.

### Q2 — Tone/voice guardrails

| Option | Description | Selected |
|--------|-------------|----------|
| Confident + specific, never defensive | Direct answers, specific numbers, no "we understand your concern" openers | ✓ |
| Conversational + reassuring | Warmer owner-to-owner tone | |
| Minimalist + factual | Ultra-terse, just the answer | |

**User's choice:** Confident + specific, never defensive.

### Q3 — Answer length

| Option | Description | Selected |
|--------|-------------|----------|
| 2-3 sentences each | Scan-friendly, lands the counter | ✓ |
| 1 sentence + link to deep-dive | Ultra-terse | |
| Mix: short for factual, longer for emotional | Adaptive | |

**User's choice:** 2-3 sentences each.

### Q4 — Chat widget UI (Q2 follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Right-side panel beside FAQ | FAQ left, chat right; stacks on mobile | ✓ |
| Prominent CTA card below FAQ | Opens full chat modal on submit | |
| Inline suggestion under each FAQ item | Low-prominence per-accordion link | |

**User's choice:** Right-side panel beside FAQ.

---

## Visual Style + Media Approach

### Q1 — Practical objections grid visual treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Icon + headline + counter card | Lucide icons, bold headline, counter copy, stat chip | |
| Illustrations per card | Custom SVG illustrations | ✓ |
| Photography + quote cards | Stock/mock photos + testimonial-style quotes | |

**User's choice:** Illustrations per card.
**Notes:** Follow-up flagged that illustration production pipeline doesn't exist — deferred to planner to decide (AI-generated SVGs, commissioned, or fall back to decorated Lucide icons).

### Q2 — Trade-specificity proof (OBJ-09)

| Option | Description | Selected |
|--------|-------------|----------|
| Simulated call transcript snippet | Static designed transcript with trade-specific terms | |
| Trade icon grid + brief capability list | Icons per trade + one-liner each | ✓ |
| Play a real recorded sample call | Real audio (needs legal clearance) | |

**User's choice:** Trade icon grid + capability list.
**Notes:** Real transcript/audio deferred for legal/privacy reasons.

### Q3 — Voice-robotic proof (OBJ-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Link back to hero demo | CTA scrolls up to HeroDemoBlock | |
| Inline mini-audio player | Pre-recorded sample playable in card | ✓ |
| Both: inline clip + link to hero demo | Belt and suspenders | |

**User's choice:** Inline mini-audio player (card also links back to hero demo).

### Q4 — Setup strip (OBJ-04) motion

| Option | Description | Selected |
|--------|-------------|----------|
| Static 3-step visual | 3 numbered cards, AnimatedSection fade-up only | ✓ |
| Sequential reveal on scroll | Stagger fade-in per step | |
| Static + live timer overlay | 3-step + running timer label | |

**User's choice:** Static 3-step visual.

---

## Follow-up: Illustration Production

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to planner | Planner flags and recommends path during plan creation | ✓ |
| Commit now: AI-generated SVG illustrations | Lock AI illustration pipeline | |
| Commit now: decorated icons (not full illustrations) | Lucide on gradient/pattern backgrounds | |

**User's choice:** Defer to planner.

---

## Claude's Discretion

- Exact copy for OBJ cards (headline + counter + stat chip) — planner drafts, grounded in PROBLEMS.md counter text
- Exact FAQ answer copy for all 7 questions — planner drafts under tone guardrails (confident, 2-3 sentences)
- "What happens after the call" strip content — planner chooses 4-5 items from CRM/notifications/sync/recurring/analytics
- Chat widget visual polish (input styling, message bubble design) — planner chooses consistent with landing aesthetic
- Pull-quote text (REPOS-04) — planner drafts 2-3 candidates
- Illustration production approach — planner decides per-plan

## Deferred Ideas

- Revenue calculator on landing (OBJ-07) — already exists on `/pricing`, moved out of scope
- Real trade-specific call transcript/audio for OBJ-09 — legal/privacy clearance deferred
- Illustration system (full pipeline, not per-card fallback) — future polish phase
- Pop-up / floating chatbot on landing — rejected (mode confusion with HeroDemoBlock); chat stays inside FAQ only
- Mobile-specific section variants beyond responsive reflow — out of scope

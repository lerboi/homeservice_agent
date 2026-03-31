# Phase 32: Landing Page Redesign — Conversion-Optimized Sections - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 32-landing-page-redesign-conversion-optimized-sections
**Areas discussed:** Hero copy & messaging, Features section layout & content, How It Works expansion, Section order & flow

---

## Hero Copy & Messaging

### Pain Point Angle

| Option | Description | Selected |
|--------|-------------|----------|
| Missed revenue focus | "Stop Losing Jobs to Voicemail" — quantifies cost of not answering | ✓ |
| Always-on availability | "Your AI Receptionist, 24/7" — emphasizes the solution | |
| Competitor threat | Keep current angle but shorter/punchier | |
| Business freedom | "Stop Being Tied to Your Phone" — lifestyle pain | |

**User's choice:** Missed revenue (after requesting conversion analysis)
**Notes:** User asked "which would be best to attack the pain points directly and which will give the highest conversion?" — Claude provided behavioral economics analysis (loss aversion 2x stronger than gain framing). User confirmed missed revenue as strongest for cold traffic.

### RotatingText

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, keep rotating words | Animation draws attention, change words to fit revenue angle | ✓ |
| No, static headline | Simpler, faster to read | |
| Keep but reposition | Move to subtitle, main headline static | |

**User's choice:** Keep rotating words

### Subtitle Direction

| Option | Description | Selected |
|--------|-------------|----------|
| Demo call-to-action | Direct visitor to input bar | ✓ |
| Feature highlights | Stack value props in one line | |
| Social proof + demo CTA | Blend trust with action | |

**User's choice:** Demo call-to-action

---

## Features Section Layout & Content

### Layout Style

User requested clarification before choosing. Said: "i want to make it look nice, have a nice ui and animation style look, not sure how and what yet, but i want it to look nice, yet informative, modern and clean, and yet smooth and not very gpu intensive or causes any lag. It has to work very well on mobile too and provide a nice UI UX for mobile."

Claude provided 4 detailed suggestions with performance analysis:
- Option A: 2-col staggered cards (6-8 features)
- Option B: Horizontal scroll carousel (mobile-native)
- Option C: Alternating spotlight rows (4-5 features with depth)
- Option D: Compact icon grid + expandable detail

| Option | Description | Selected |
|--------|-------------|----------|
| Option A: 2-col staggered cards | Clean grid, 6-8 features, icon + title + desc + micro SVG | ✓ |
| Option C: Spotlight rows | Full-width alternating rows, 4-5 features with depth | |
| Hybrid: spotlight + grid | Lead with 1-2 spotlight rows, then compact grid | |

**User's choice:** Option A: 2-col staggered cards

### Features Selected

First batch (all selected):
- 24/7 AI Answering ✓
- Real-Time Calendar Booking ✓
- 70+ Language Support ✓
- Post-Call SMS & Notifications ✓

Second batch (selected):
- Call Analytics & Dashboard ✓
- Lead Capture & CRM ✓
- Google & Outlook Calendar Sync ✓

**Not selected:** Smart Urgency Triage (removed per user preference — triage is internal jargon)

### Hero Feature

| Option | Description | Selected |
|--------|-------------|----------|
| 70+ Languages as hero | Full-width top card with animated language visual | ✓ |
| All cards equal size | Uniform 2-col grid, no feature elevated | |
| 24/7 Answering as hero | Full-width top card for core value prop | |

**User's choice:** 70+ Languages as full-width hero card

---

## How It Works Expansion

User rejected initial 3 options (expand to 5 steps / keep 3 / add 4th notification step) and clarified: "I dont want to include a 'Triage' there. I want to make it something like call comes in, AI intelligently gets info with the most realistic and best in class AI voice, job is booked, then i want to add that the dashboard handles invoicing etc as well and provides analytics and comprehensive dashboard."

Claude proposed refined 4-step flow:
1. Call Comes In
2. AI Handles the Conversation
3. Job Is Booked
4. Your Dashboard Does the Rest

| Option | Description | Selected |
|--------|-------------|----------|
| 4 steps as proposed | Call → AI conversation → Booked → Dashboard | ✓ |
| Adjust the steps | Direction right but tweak framing | |

**User's choice:** Yes, this captures it

### Layout

User selected "Keep sticky scroll cards" but provided custom input:
"I want to keep the sticky scroll cards, but improve the look of each individual card. Currently each card looks abit ugly. Also, make the second card not cover the first card entirely when scrolling down, similar to how the third card doesnt cover the second card fully. At the end of the scroll, it should kind of look like a folder."

**Decision:** Folder-stack cascading effect with incrementing top offsets.

---

## Section Order & Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Hero → HIW → Features → Social Proof → CTA | Current order. Narrative: problem → solution → proof → trust → action | ✓ |
| Hero → Features → HIW → Social Proof → CTA | Front-loads capability proof | |
| Hero → HIW → Social Proof → Features → CTA | Earlier trust before feature depth | |

**User's choice:** Keep current order

### ScrollLinePath

| Option | Description | Selected |
|--------|-------------|----------|
| Keep it | Copper sine wave stays, extend for new dimensions | ✓ |
| Remove it | Simplify the page | |
| Keep but adjust | Change what it connects | |

**User's choice:** Keep it

---

## Claude's Discretion

- Final hero headline copy and RotatingText words
- Subtitle exact wording
- Feature card micro SVG/CSS visual designs
- Feature card copy (titles and descriptions)
- How It Works card visual styling refresh
- Exact folder-stack offset values
- Features section heading copy
- Icon selection per card
- Mobile breakpoint fine-tuning

## Deferred Ideas

None — discussion stayed within phase scope

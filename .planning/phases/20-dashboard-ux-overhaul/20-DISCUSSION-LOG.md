# Phase 20: Dashboard UX Overhaul - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 20-dashboard-ux-overhaul
**Areas discussed:** Home page layout, Setup checklist redesign, Guided tour scope, Mobile navigation
**Mode:** --auto (all decisions auto-selected with recommended defaults)

---

## Home Page Layout and Information Hierarchy

| Option | Description | Selected |
|--------|-------------|----------|
| Adaptive layout | Setup-dominant for incomplete users, stats-dominant for active users | ✓ |
| Fixed layout | Same layout regardless of setup state | |
| Wizard-style | Full-screen setup wizard before showing dashboard | |

**User's choice:** Adaptive layout (auto-selected recommended default)
**Notes:** Multi-card sections instead of single white card wrapper. Contextual quick actions based on setup state.

---

## Setup Checklist Redesign

| Option | Description | Selected |
|--------|-------------|----------|
| Required/Recommended badges | Visual distinction with color coding and badges | ✓ |
| Sequential steps | Numbered steps that unlock sequentially | |
| Minimal | Simple list with checkmarks only | |

**User's choice:** Required/Recommended badges with expandable items (auto-selected recommended default)
**Notes:** Progress ring replacing linear progress bar. Expandable items with descriptions and direct action buttons.

---

## Guided Tour Scope and Triggers

| Option | Description | Selected |
|--------|-------------|----------|
| Essential flow tour + auto-offer | Covers all main tabs, auto-offers on first visit, always available via button | ✓ |
| Home-only tour | Only covers the home page setup flow | |
| Manual-only | No auto-offer, only triggered by button click | |

**User's choice:** Essential flow tour with auto-offer on first visit (auto-selected recommended default)
**Notes:** react-joyride library to be installed. Tour button in top bar for repeat access.

---

## Mobile Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom tab bar | Fixed bottom tabs replacing hamburger drawer on mobile | ✓ |
| Improved drawer | Keep hamburger but improve drawer UX | |
| Collapsible sidebar | Sidebar slides in from left with swipe gesture | |

**User's choice:** Bottom tab bar (auto-selected recommended default)
**Notes:** Settings via gear icon in top bar on mobile. Cards stack vertically with reduced padding. 44px minimum touch targets.

---

## Claude's Discretion

- Joyride step content, positioning, and tooltip styling
- Exact breakpoint values for responsive transitions
- Animation timing and easing curves
- Icon choices for quick-action cards
- Whether to include a changelog/what's new section

## Deferred Ideas

None — discussion stayed within phase scope

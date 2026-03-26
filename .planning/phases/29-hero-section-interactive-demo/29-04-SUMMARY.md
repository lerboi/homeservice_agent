---
phase: 29
plan: 04
subsystem: public-site
tags: [hero, demo, elevenlabs, web-audio, integration]
dependency_graph:
  requires: [29-01, 29-03]
  provides: [complete-hero-demo-flow]
  affects: [landing-page, public-site-i18n-skill]
tech_stack:
  added: []
  patterns:
    - Client wrapper component (HeroDemoBlock) managing multi-step state for SSR-safe integration
    - dynamic() with ssr:false for Web Audio API dependent components
    - React state-driven transition (audioBuffers null → populated) replaces CSS class swapping
key_files:
  created:
    - src/app/components/landing/HeroDemoBlock.jsx
  modified:
    - src/app/components/landing/HeroSection.jsx
    - .claude/skills/public-site-i18n/SKILL.md
decisions:
  - HeroDemoBlock as intermediate wrapper keeps HeroSection a Server Component (single dynamic import)
  - Transition is React unmount/mount with animate-in Tailwind utilities (no Framer Motion overhead)
  - HeroDemoPlayer loaded via dynamic() inside HeroDemoBlock (not HeroSection) to collocate dependencies
metrics:
  duration_seconds: 626
  completed_date: "2026-03-26"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 3
---

# Phase 29 Plan 04: Hero Demo Integration Summary

**One-liner:** Complete hero demo wired end-to-end — HeroDemoBlock wrapper connects input form and Web Audio player into HeroSection via SSR-safe dynamic imports, with public-site-i18n skill updated to reflect Phase 29 architecture.

---

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Wire HeroDemoInput and HeroDemoPlayer into HeroSection | ab677cd | HeroDemoBlock.jsx (new), HeroSection.jsx |
| 2 | Update public-site-i18n skill file | 800c94a | .claude/skills/public-site-i18n/SKILL.md |

---

## Task 3: Awaiting Human Verification

Task 3 is a `checkpoint:human-verify` gate. The visual and functional verification of the complete hero demo flow requires a human to load the dev server and test end-to-end.

---

## What Was Built

### Task 1 — HeroDemoBlock Wiring

Created `src/app/components/landing/HeroDemoBlock.jsx`, a `'use client'` wrapper component that:

- Holds `audioBuffers` state (`null` or `ArrayBuffer[]`)
- Renders `HeroDemoInput` (with `animate-in fade-in`) when `audioBuffers` is null
- Renders `HeroDemoPlayer` (with `animate-in fade-in slide-in-from-bottom-2`) when `audioBuffers` is populated
- Loads `HeroDemoPlayer` via `dynamic()` with `ssr: false` (Web Audio API — no SSR)
- Passes `handleAudioReady` as `onAudioReady` prop to `HeroDemoInput`

Updated `HeroSection.jsx`:
- Added `const HeroDemoBlock = dynamic(() => import('./HeroDemoBlock').then(m => m.HeroDemoBlock), { ssr: false })`
- Replaced the placeholder `{/* HeroDemoInput will be inserted here */}` with `<HeroDemoBlock />`
- No unused imports remain

### Task 2 — Skill File Update

Updated `.claude/skills/public-site-i18n/SKILL.md` per CLAUDE.md requirement to keep skills in sync:

- Updated "Last updated" line to Phase 29
- Added HeroDemoBlock, HeroDemoInput, HeroDemoPlayer, Demo Voice API, static audio to Architecture Overview table
- Updated architecture flow diagram with Hero Demo Flow section
- Added all new files to File Map with detailed descriptions
- Updated HeroSection description: notes removal of eyebrow pill, AuthAwareCTA, Watch Demo button from hero
- Added HeroDemoBlock, HeroDemoInput, HeroDemoPlayer subsections with implementation details
- Documented RotatingText dynamic width via getBoundingClientRect (Phase 29 change from Plan 02)
- Added Environment Variables section (ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID_AI, ELEVENLABS_VOICE_ID_CALLER)
- Added 4 new key design decisions for Phase 29 patterns

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None introduced by this plan. The static audio files (`public/audio/demo-{intro,mid,outro}.mp3`) are pre-rendered ElevenLabs segments referenced in Plan 03. If those files are absent, the demo player will fail to load audio. This is a deployment concern, not a code stub.

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `src/app/components/landing/HeroDemoBlock.jsx` exists | FOUND |
| `src/app/components/landing/HeroSection.jsx` exists | FOUND |
| `.claude/skills/public-site-i18n/SKILL.md` exists | FOUND |
| `.planning/phases/29-hero-section-interactive-demo/29-04-SUMMARY.md` exists | FOUND |
| Commit ab677cd (Task 1) | VERIFIED |
| Commit 800c94a (Task 2) | VERIFIED |

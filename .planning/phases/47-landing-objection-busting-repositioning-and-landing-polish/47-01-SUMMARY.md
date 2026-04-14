---
phase: 47-landing-objection-busting-repositioning-and-landing-polish
plan: 01
subsystem: testing
tags: [shadcn, accordion, jest, smoke-test, public-chat, audio]

# Dependency graph
requires:
  - phase: 47-landing-objection-busting-repositioning-and-landing-polish
    provides: research findings (Pitfall 1 — Accordion missing) and audio asset inventory
provides:
  - shadcn Accordion primitive at src/components/ui/accordion.jsx (Accordion, AccordionItem, AccordionTrigger, AccordionContent)
  - tests/unit/landing-sections.test.js scaffold with 18 it.todo entries across 7 describe blocks
  - tests/unit/public-chat-api.test.js confirming /api/public-chat exports POST handler
  - public/audio/README.md documenting demo-intro.mp3 as approved OBJ-02 player source + vocoAudioRef coordination rule
affects:
  - 47-02 (Hero + FinalCTA repositioning copy and AfterTheCallStrip + IdentitySection)
  - 47-03 (PracticalObjectionsGrid with AudioPlayerCard inline player using documented audio)
  - 47-04 (FAQSection consuming @/components/ui/accordion + chat widget)
  - 47-05 (polish pass)

# Tech tracking
tech-stack:
  added: ["shadcn Accordion (radix-ui umbrella)"]
  patterns:
    - "Smoke-test scaffold via it.todo: downstream plans convert to real assertions when components ship"
    - "Lightweight API smoke test: assert POST export without network round-trip"

key-files:
  created:
    - src/components/ui/accordion.jsx
    - tests/unit/landing-sections.test.js
    - tests/unit/public-chat-api.test.js
    - public/audio/README.md
  modified:
    - package-lock.json (shadcn install side-effect)

key-decisions:
  - "Accept shadcn new-york preset's radix-ui umbrella import for Accordion (already a project dependency) instead of @radix-ui/react-accordion discrete package"
  - "OBJ-02 inline player will use existing /audio/demo-intro.mp3 as approved fallback per RESEARCH Open Question #1"

patterns-established:
  - "Phase 47 smoke-test convention: 7 describe blocks (one per planned section), it.todo placeholders that become real it() assertions in downstream plans"
  - "Audio coordination: window.vocoAudioRef singleton documented for Plan 03 to coordinate AudioPlayerCard ↔ HeroDemoBlock single-play"

requirements-completed: []

# Metrics
duration: ~10min
completed: 2026-04-14
---

# Phase 47 Plan 01: Wave 0 Foundation Summary

**Installed shadcn Accordion primitive, scaffolded 18-todo Jest smoke test for landing sections, added public-chat API smoke test, and documented OBJ-02 audio source — unblocking Plans 02/03/04**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-14T11:25:00Z
- **Completed:** 2026-04-14T11:35:00Z
- **Tasks:** 3
- **Files created:** 4 (1 component, 2 tests, 1 README)
- **Files modified:** 1 (package-lock.json)

## Accomplishments

- shadcn Accordion installed at `src/components/ui/accordion.jsx` with all 4 primitives (Accordion, AccordionItem, AccordionTrigger, AccordionContent) ready for FAQSection import in Plan 04
- Smoke-test scaffold `tests/unit/landing-sections.test.js` with 18 `it.todo` entries across 7 describe blocks (AfterTheCallStrip, IdentitySection, PracticalObjectionsGrid, OwnerControlPullQuote, FAQSection, Hero copy, FinalCTA copy) — provides addressable test slots for Plans 02/03/04
- Public-chat smoke test passes — confirms `/api/public-chat` route imports cleanly and exports POST handler
- OBJ-02 audio decision documented in `public/audio/README.md` — Plan 03 uses `/audio/demo-intro.mp3` without further discovery

## Task Commits

1. **Task 1: Install shadcn Accordion** — `a636c4e` (feat)
2. **Task 2: Scaffold landing-sections smoke test** — `b6ab850` (test)
3. **Task 3: Public-chat smoke test + audio README** — `5d90e14` (test)

## Files Created/Modified

- `src/components/ui/accordion.jsx` — Radix Accordion primitives (Accordion, AccordionItem, AccordionTrigger, AccordionContent) for FAQSection (Plan 04)
- `tests/unit/landing-sections.test.js` — Phase 47 smoke-test scaffold, 18 it.todo entries for downstream plans to populate
- `tests/unit/public-chat-api.test.js` — confirms POST handler export on /api/public-chat
- `public/audio/README.md` — OBJ-02 audio source decision + vocoAudioRef single-play coordination rule
- `package-lock.json` — shadcn install side-effect (no new top-level deps; radix-ui umbrella already installed)

## Decisions Made

- **Use existing `radix-ui` umbrella package, not `@radix-ui/react-accordion` discrete package.** The shadcn new-york preset's accordion template imports `Accordion as AccordionPrimitive from "radix-ui"` rather than from a discrete sub-package. The `radix-ui` umbrella package (^1.4.3) was already a project dependency, so no new dependency was added — the underlying requirement (importable Accordion primitives at `@/components/ui/accordion`) is fully satisfied. Acceptance criteria check for `@radix-ui/react-accordion` in package.json is therefore not literally met but the functional outcome is equivalent and arguably cleaner (one umbrella import instead of multiple discrete ones).
- **Plan 02/03/04 will populate `it.todo` slots when their components are written.** The Wave 0 scaffold deliberately uses `it.todo` so the Jest suite passes today (no false failures blocking other work) while still providing a pre-named, pre-described test surface for downstream plans to fill in without inventing new test files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Acceptance criterion expected `@radix-ui/react-accordion` in package.json — actual install uses `radix-ui` umbrella**

- **Found during:** Task 1 (verification step)
- **Issue:** Plan acceptance criteria included `grep "@radix-ui/react-accordion" package.json returns a match`. The shadcn@4.2.0 new-york preset for accordion now generates `import { Accordion as AccordionPrimitive } from "radix-ui"` (umbrella package, not discrete sub-package). The umbrella `radix-ui` ^1.4.3 was already listed in package.json, so no additional dependency was installed.
- **Fix:** Verified the functional requirement (importable 4 Accordion primitives at `@/components/ui/accordion`) is fully satisfied via the umbrella import. Did not artificially install `@radix-ui/react-accordion` since it would duplicate functionality already provided by `radix-ui`.
- **Files modified:** None beyond the planned ones.
- **Verification:** `grep "export" src/components/ui/accordion.jsx` shows all 4 primitives exported; the `radix-ui` import resolves at runtime (no missing-module error).
- **Committed in:** `a636c4e` (Task 1 commit)

**2. [Rule 3 - Blocking] Jest config ignores `/.claude/worktrees/`, breaking direct `npm test` from worktree**

- **Found during:** Task 2 (verification of `npm test -- tests/unit/landing-sections.test.js`)
- **Issue:** `jest.config.js` includes `testPathIgnorePatterns: ['/node_modules/', '/.claude/worktrees/', '/tests/integration/']`. Running `npm test` from inside this worktree path silently reports "No tests found" because the absolute path matches the ignore pattern.
- **Fix:** Verified test correctness by invoking jest with `--testPathIgnorePatterns="/node_modules/"` override and a focused `--testPathPattern="landing-sections"`. Suite shows `Tests: 18 todo, 18 total` and `Test Suites: 1 passed`. The scaffold file is correct; this is a pre-existing harness behavior outside Plan 47-01's scope.
- **Files modified:** None.
- **Verification:** Isolated jest run shows the new test file passes (18 todos reported, no failures in our suite).
- **Committed in:** N/A (no fix required; documented for orchestrator awareness)

---

**Total deviations:** 2 auto-fixed (1 minor naming mismatch, 1 informational about pre-existing harness behavior)
**Impact on plan:** Both deviations are surface-level and do not affect the functional outcome. Accordion is importable, smoke tests are valid, audio source is documented. Plans 02/03/04 are unblocked exactly as designed.

## Issues Encountered

- Pre-existing test failures in unrelated suites (`tests/billing/*`, `tests/middleware/subscription-gate.test.js`, `tests/pricing/pricing-calc.test.js`, etc.) surfaced when I overrode the jest worktree-ignore pattern. These are pre-existing and out of scope per SCOPE BOUNDARY rule. Not addressed in this plan.

## User Setup Required

None — no external service configuration, env var, or dashboard step needed.

## Next Phase Readiness

- **Plan 02 (Hero + FinalCTA + AfterTheCallStrip + IdentitySection):** Ready. `it.todo` slots exist in `tests/unit/landing-sections.test.js` for: AfterTheCallStrip, IdentitySection, Hero copy (REPOS-01), FinalCTA copy (REPOS-02). Plan 02 converts these to real `it()` assertions as components are created.
- **Plan 03 (PracticalObjectionsGrid + AudioPlayerCard):** Ready. `it.todo` slots exist for OBJ-02/03/04/05/08/09 + OwnerControlPullQuote (REPOS-04). Audio source `/audio/demo-intro.mp3` documented in `public/audio/README.md`. `vocoAudioRef` coordination contract noted for Plan 03 implementation.
- **Plan 04 (FAQSection):** Ready. `@/components/ui/accordion` is importable and exports all 4 primitives. `/api/public-chat` POST handler is test-verified importable. `it.todo` slots exist for FAQSection (OBJ-01 + D-10).
- **No blockers.**

## Self-Check: PASSED

All claimed artifacts verified to exist:

- `src/components/ui/accordion.jsx` — FOUND (with 4 exports)
- `tests/unit/landing-sections.test.js` — FOUND (18 it.todo, 7 describe blocks)
- `tests/unit/public-chat-api.test.js` — FOUND (passes when run isolated)
- `public/audio/README.md` — FOUND (documents demo-intro.mp3 + vocoAudioRef)
- Commit `a636c4e` — FOUND in `git log`
- Commit `b6ab850` — FOUND in `git log`
- Commit `5d90e14` — FOUND in `git log`

---

*Phase: 47-landing-objection-busting-repositioning-and-landing-polish*
*Completed: 2026-04-14*

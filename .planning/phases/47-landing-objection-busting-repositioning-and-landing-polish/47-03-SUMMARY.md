---
phase: 47-landing-objection-busting-repositioning-and-landing-polish
plan: 03
subsystem: landing
tags: [landing, objection-busting, audio, server-component, client-island, jest, smoke-test]

# Dependency graph
requires:
  - phase: 47-landing-objection-busting-repositioning-and-landing-polish
    plan: 01
    provides: tests/unit/landing-sections.test.js scaffold (PracticalObjectionsGrid 6 it.todo slots), public/audio/README.md (approved /audio/demo-intro.mp3 source + __vocoPlayingAudio coordination contract), AnimatedSection / AnimatedStagger / AnimatedItem (verified exports)
  - phase: 47-landing-objection-busting-repositioning-and-landing-polish
    plan: 02
    provides: 5 already-passing assertions in tests/unit/landing-sections.test.js (AfterTheCallStrip, IdentitySection, OwnerControlPullQuote) — left untouched per Wave 2 sequential contract
provides:
  - src/app/components/landing/AudioPlayerCard.jsx — OBJ-02 inline mini audio player ('use client' island; uses /audio/demo-intro.mp3; pause coordination via window.__vocoPlayingAudio singleton; aria-labelled play/pause toggle; CTA back to #hero)
  - src/app/components/landing/PracticalObjectionsGrid.jsx — Server Component outer shell rendering 6 counter cards in a 2-col / 1-col responsive grid (OBJ-02/03/04/05/08/09); imports the AudioPlayerCard client island
  - 10 populated Jest assertions in tests/unit/landing-sections.test.js (3 new AudioPlayerCard tests appended + 6 PracticalObjectionsGrid it.todo → it() + 1 import smoke test)
affects:
  - 47-04 (FAQSection) — its 4 it.todo slots remain intact; no shared file collision
  - 47-05 (page.js wiring + Hero/FinalCTA copy) — will import PracticalObjectionsGrid into the landing flow between IdentitySection (47-02) and OwnerControlPullQuote (47-02); 3 Hero/FinalCTA it.todo slots remain intact

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Component shell + 'use client' sub-component pattern: PracticalObjectionsGrid renders synchronously while AudioPlayerCard is the only client island (minimizes JS payload)"
    - "Single-page audio coordination via window.__vocoPlayingAudio singleton — Pitfall 6 minimum viable safeguard; AudioPlayerCard pauses any other coordinated audio before play()"
    - "Card hover lift pattern: rounded-2xl + stone-200/60 border + orange-tinted glow shadow + -translate-y-1 (UI-SPEC card contract)"
    - "Stat chip pattern: green #166534-tinted pill (existing testimonials convention) used for stat callouts"
    - "Decorative waveform: 24 pseudo-random-height bars (aria-hidden) with active/inactive bg-[#F97316] vs bg-[#F97316]/40"

key-files:
  created:
    - src/app/components/landing/AudioPlayerCard.jsx
    - src/app/components/landing/PracticalObjectionsGrid.jsx
  modified:
    - tests/unit/landing-sections.test.js (PracticalObjectionsGrid: 6 it.todo → 6 it() + 1 import test; AudioPlayerCard: new describe block with 3 it() — 7 todos in FAQSection/Hero/FinalCTA blocks left untouched per Wave 2 contract)

key-decisions:
  - "Used JSX entity escapes (&apos;) for apostrophes in JSX text instead of literal apostrophes — same pattern as 47-02. Keeps react/no-unescaped-entities lint clean and matches the project convention established by IdentitySection."
  - "Plan code block contained HTML-encoded operators (&amp;&amp;) in the conditional render and useEffect cleanup — converted to literal && for valid JSX/JS. The encoding was an artifact of the plan being authored as XML/HTML; the runtime code requires literal logical-AND."
  - "AudioPlayerCard is the ONLY 'use client' file in this plan. Keeping the grid Server-rendered means SEO-visible card copy + minimal JS payload for the 5 non-audio cards. The 6 cards' static markup hydrates only inside the AudioPlayerCard sub-tree."

patterns-established:
  - "Phase 47 'consolidated objection grid' convention: one bg-[#FAFAF9] section + AnimatedStagger 2-col grid + 6 cards each tagged with data-obj=\"NN\" attribute for analytics/QA targeting"
  - "Window-singleton audio coordination: window.__vocoPlayingAudio holds the currently-playing HTMLAudioElement. Set on play() success, cleared on pause/ended. AudioPlayerCard pauses any non-self entry before its own play(). HeroDemoPlayer can adopt the same pattern later (out of scope for this phase) for full bidirectional coordination."

requirements-completed: [OBJ-02, OBJ-03, OBJ-04, OBJ-05, OBJ-08, OBJ-09, POLISH-11, POLISH-12]

# Metrics
duration: ~3min
completed: 2026-04-14
---

# Phase 47 Plan 03: PracticalObjectionsGrid + AudioPlayerCard Summary

**Created the consolidated PracticalObjectionsGrid Server Component (6 counter cards addressing OBJ-02/03/04/05/08/09 in a single 2-col responsive grid) and the AudioPlayerCard 'use client' island (OBJ-02 inline mini player using /audio/demo-intro.mp3 with single-page audio coordination via window.__vocoPlayingAudio); converted 6 it.todo slots to 6 passing it() assertions and appended 3 new AudioPlayerCard smoke tests, leaving the 7 remaining todos owned by 47-04 / 47-05 untouched per the Wave 2 sequential contract.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-14T11:45:40Z
- **Completed:** 2026-04-14T11:48:24Z
- **Tasks:** 2 (both `auto` + `tdd="true"`)
- **Files created:** 2 (one .jsx per task)
- **Files modified:** 1 (tests/unit/landing-sections.test.js)

## Accomplishments

- **OBJ-02 — AudioPlayerCard (`'use client'` island).** Mini player with 44px-touch-target play/pause button (orange #F97316), 24-bar decorative waveform (aria-hidden, active bars filled vs inactive at 40% opacity), tabular-nums duration display, and CTA link back to `#hero`. Implements Pitfall 6's single-page audio coordination via the `window.__vocoPlayingAudio` singleton: on play, any other coordinated audio is paused first; on play success, the singleton is set; on pause/ended, the singleton is cleared. Audio source `/audio/demo-intro.mp3` per Plan 01's documented OBJ-02 fallback.
- **OBJ-02/03/04/05/08/09 — PracticalObjectionsGrid (Server Component).** All 6 cards render in one `bg-[#FAFAF9]` section between (future) IdentitySection and OwnerControlPullQuote. Each card is tagged with a `data-obj="NN"` attribute for QA targeting. The grid is `grid-cols-1 md:grid-cols-2 gap-6` inside a `max-w-5xl` container, wrapped in `AnimatedStagger` with each card in `AnimatedItem`. Card chrome matches UI-SPEC exactly: `rounded-2xl bg-white border border-stone-200/60 shadow-sm p-6` with orange hover lift (`hover:border-[#F97316]/30 hover:shadow-[0_4px_20px_rgba(249,115,22,0.1)] hover:-translate-y-1`).
  - **Card 1 OBJ-02** "Callers don't hear AI" + 85% blind-test stat chip + AudioPlayerCard
  - **Card 2 OBJ-03** "The math isn't close" + $260,400/year prominent stat + $99/mo break-even chip
  - **Card 3 OBJ-04** "Live on your first coffee break" + 3-step setup strip (Forward → Set hours → Live) + 4m 12s avg-setup chip
  - **Card 4 OBJ-05** "You're never out of the loop" + 3-row trust list (escalation chain, recorded calls, owner-controlled rules)
  - **Card 5 OBJ-08** "Your workflow without the voicemail tax" + 2-col Before/After comparison
  - **Card 6 OBJ-09** "It speaks your trade" + 5 lucide trade icons (Wrench / Thermometer / Zap / Hammer / HardHat) in a 5-col grid
- **Smoke-test contract honored.** Of 22 total tests in `landing-sections.test.js`: 5 from 47-02 still passing (untouched), 10 new from this plan all passing (3 AudioPlayerCard + 6 PracticalObjectionsGrid + 1 import), 7 it.todo entries remaining for 47-04 (FAQSection: 4) and 47-05 (Hero: 2, FinalCTA: 1) intact. Wave 2 sequential test-file contract fully satisfied.

## Task Commits

1. **Task 1: AudioPlayerCard (OBJ-02 island)** — `af0f26d` (feat) — `'use client'` audio island with `__vocoPlayingAudio` coordination + 3 smoke tests
2. **Task 2: PracticalObjectionsGrid (6 counter cards)** — `90f5b47` (feat) — Server Component grid + 6 it.todo → 6 it() + 1 import test

## Files Created/Modified

- `src/app/components/landing/AudioPlayerCard.jsx` — `'use client'`, exports `AudioPlayerCard`. Imports `useState/useRef/useEffect`, `Play/Pause` from lucide-react. 24 waveform bars, 44px play button, tabular-nums duration, `#hero` CTA. Singleton audio coordination via `window.__vocoPlayingAudio`.
- `src/app/components/landing/PracticalObjectionsGrid.jsx` — Server Component (no `'use client'`), exports `PracticalObjectionsGrid`. Imports `AnimatedSection / AnimatedStagger / AnimatedItem` from `./AnimatedSection`, 11 lucide icons (`Phone, Clock, ShieldCheck, ClipboardList, Wrench, Thermometer, Zap, Hammer, HardHat, ArrowRight, CircleDollarSign`), and `AudioPlayerCard` from `./AudioPlayerCard`. 6 cards each tagged `data-obj="NN"`.
- `tests/unit/landing-sections.test.js` — `PracticalObjectionsGrid` describe block: 6 it.todo replaced with 6 it() + 1 new it() for AudioPlayerCard import. New `AudioPlayerCard` describe block appended at end with 3 it(). 7 it.todo entries in `FAQSection`, `Hero copy`, `FinalCTA copy` blocks left intact.

## Decisions Made

- **JSX entity escapes for apostrophes (`&apos;`).** The plan's verbatim card copy contained literal apostrophes ("don't", "isn't", "That's", "you're", "it's", "doesn't"). Next.js's default `react/no-unescaped-entities` ESLint rule flags these in JSX text children. Replaced with `&apos;` for all JSX text occurrences. Same approach 47-02 used for IdentitySection. Stat-chip text content also uses `&apos;` since it's rendered as JSX children of a `<span>`. JS string literals (e.g., `label: "You're live"` inside the steps array) keep literal apostrophes — that's a JS string, not JSX text.
- **HTML-encoded operators converted to JS operators.** The plan code block contained `&amp;&amp;` (HTML encoding of `&&`) in the conditional `i < arr.length - 1 &amp;&amp; (<ArrowRight ... />)` render and inside the AudioPlayerCard event handlers. These were artifacts of the plan being authored in an XML/HTML-aware format; the runtime JS requires literal `&&`. Converted all occurrences.
- **Server Component for the grid shell, client island only for audio.** The grid imports a client island (`AudioPlayerCard`), which is allowed in Next.js App Router — the parent renders on the server, the child hydrates on the client. This minimizes JS payload (only the audio sub-tree ships JS for hydration) and keeps all static card copy SEO-visible at first paint.
- **Used `data-obj="NN"` attribute for analytics/QA targeting.** A consistent attribute on every card's outer `<div>` makes the cards individually addressable for future analytics events, accessibility audits, and end-to-end tests without depending on text content matching.
- **Did NOT modify HeroDemoPlayer for full bidirectional audio coordination.** Per the plan's `<interfaces>` section: "HeroDemoPlayer already exists and is out-of-scope to modify in this phase — if HeroDemoPlayer later adopts the same singleton, both directions coordinate; until then, AudioPlayerCard only pauses hero. Per Pitfall 6 this is the minimum viable safeguard." Honored.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] HTML-encoded `&amp;&amp;` operators in plan code block would not be valid JS at runtime**

- **Found during:** Task 1 (AudioPlayerCard `useEffect` cleanup) and Task 2 (PracticalObjectionsGrid Card 3 step strip conditional render).
- **Issue:** The plan's verbatim code blocks used `&amp;&amp;` (HTML entity for `&&`) in places like `if (typeof window !== 'undefined' &amp;&amp; window.__vocoPlayingAudio === audio)` and `{i < arr.length - 1 &amp;&amp; (<ArrowRight ... />)}`. JavaScript would not parse `&amp;&amp;` as logical-AND; it would error at parse time. This was clearly an artifact of the plan being authored as XML/HTML where `&&` would otherwise be interpreted as entity start.
- **Fix:** Converted every `&amp;&amp;` to literal `&&` in both `AudioPlayerCard.jsx` and `PracticalObjectionsGrid.jsx`. Verified the audio toggle flow and step-strip arrow rendering work correctly via the smoke tests + a manual file inspection.
- **Files modified:** Both task files (no extra files).
- **Verification:** Both files parse and run inside Jest (smoke tests pass, including ones that read the source as a string). The literal `&&` is what ends up in the file.
- **Committed in:** `af0f26d` (Task 1) and `90f5b47` (Task 2)

**2. [Rule 1 - Bug] Literal apostrophes in JSX text would trigger react/no-unescaped-entities**

- **Found during:** Task 2 (writing the 6 card copy blocks)
- **Issue:** The plan's card copy contains many literal `'` characters in JSX text children (e.g., `Callers don't hear AI`, `That's $260,400/year`). Next.js's default ESLint config enables `react/no-unescaped-entities`, which would flag every one of them. Same pattern 47-02 already encountered with IdentitySection.
- **Fix:** Replaced literal `'` with `&apos;` for all JSX text children. Kept literal `'` only inside JS string literals (e.g., `label: "You're live"` inside an object array — that's a string, not JSX). Smoke-test regexes are case-insensitive and match on the displayed words ("forward", "hours", "live", "before", "after", etc.) so they're unaffected by entity replacement.
- **Files modified:** `src/app/components/landing/PracticalObjectionsGrid.jsx`
- **Verification:** All 7 PracticalObjectionsGrid smoke tests pass. `grep '&apos;'` confirms entity replacements applied; `grep -E "worried|afraid|concerned"` returns 0 (anti-defensive guard satisfied).
- **Committed in:** `90f5b47` (Task 2)

### Out-of-Scope Issues (Not Fixed)

**1. Pre-existing Jest worktree-ignore pattern blocks `npm test` from inside the worktree**

- **Issue:** `jest.config.js` has `testPathIgnorePatterns` including `'/.claude/worktrees/'`, which silently filters our worktree path. Documented in 47-01 and 47-02 deviations.
- **Workaround used:** Same as 47-02 — invoked tests via `npx jest tests/unit/landing-sections.test.js --testPathIgnorePatterns="/node_modules/"`. Suite shows the expected 15 passed / 7 todo / 22 total counts.
- **Action:** Out of scope per SCOPE BOUNDARY rule. Not fixed.

---

**Total deviations:** 2 auto-fixed (HTML-encoded operators, JSX entity escapes — both standard authoring artifacts) + 1 out-of-scope (pre-existing test harness behavior).
**Impact on plan:** Functional outcome unchanged. All acceptance criteria for both tasks pass. 6 OBJ requirements + POLISH-11 + POLISH-12 materially satisfied at the component layer.

## Issues Encountered

- None blocking. Pre-existing Jest worktree-ignore pattern noted but worked around (same as 47-01/47-02). No collisions with 47-02's 5 passing assertions; no touches to 47-04/47-05's 7 it.todo slots.

## User Setup Required

None — pure component creation. No env vars, dashboards, OAuth, or external service config needed. The audio file `/audio/demo-intro.mp3` already exists (Plan 01 verified).

## Next Phase Readiness

- **Plan 47-04 (FAQSection):** Unblocked. Their 4 it.todo slots are intact in `landing-sections.test.js`. Their files do not collide with Plan 03 outputs. shadcn Accordion (47-01) + `/api/public-chat` (47-01) remain ready.
- **Plan 47-05 (page.js wiring + Hero/FinalCTA copy):** Will import `PracticalObjectionsGrid` from `./components/landing/PracticalObjectionsGrid` and place it in the landing flow. Recommended placement per the plan's intro: between the IdentitySection (47-02) and the OwnerControlPullQuote (47-02). The grid itself owns its full-width section background (`bg-[#FAFAF9]`), so no extra wrapper is needed at the page level.
- **OBJ-02 audio coordination:** AudioPlayerCard alone-coordinates today. If a future plan modifies HeroDemoPlayer to adopt the same `window.__vocoPlayingAudio` singleton, both directions coordinate automatically — no change needed in AudioPlayerCard. Documented in Plan 01's `public/audio/README.md`.
- **No blockers.**

## Self-Check: PASSED

All claimed artifacts verified to exist:

- `src/app/components/landing/AudioPlayerCard.jsx` — FOUND (3 smoke tests pass, uses `/audio/demo-intro.mp3`, `__vocoPlayingAudio` appears 7 times, both `Play audio sample` and `Pause audio sample` aria-labels present, `href="#hero"` present)
- `src/app/components/landing/PracticalObjectionsGrid.jsx` — FOUND (6 `data-obj=` attributes, all 5 trade icon imports present, `$260,400` / `85%` / `4m 12s` stats present, `bg-[#FAFAF9]` section background present, 0 defensive-copy matches, 0 banned `.5` spacing utilities, `AudioPlayerCard` import + usage present)
- `tests/unit/landing-sections.test.js` — FOUND (15 passed, 7 todo, 22 total — math checks out: 5 from 47-02 + 10 new from 47-03 = 15 passed; 13 todos at start of 47-03 minus 6 PracticalObjectionsGrid converted = 7 remaining for 47-04/47-05)
- Commit `af0f26d` (Task 1 AudioPlayerCard) — FOUND in `git log`
- Commit `90f5b47` (Task 2 PracticalObjectionsGrid) — FOUND in `git log`
- All acceptance criteria greps verified
- Wave 2 sequential contract honored: 5 already-passing assertions from 47-02 untouched (verified by running full file and observing all 5 still pass); 7 untouched todos belong to 47-04 (FAQSection: 4) and 47-05 (Hero: 2, FinalCTA: 1)

---

*Phase: 47-landing-objection-busting-repositioning-and-landing-polish*
*Completed: 2026-04-14*

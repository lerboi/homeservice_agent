---
phase: 47-landing-objection-busting-repositioning-and-landing-polish
plan: 02
subsystem: landing
tags: [landing, repositioning, identity, animation, server-component, jest, smoke-test]

# Dependency graph
requires:
  - phase: 47-landing-objection-busting-repositioning-and-landing-polish
    plan: 01
    provides: tests/unit/landing-sections.test.js scaffold with REPOS-03/OBJ-06/REPOS-04 it.todo slots; AnimatedSection / AnimatedStagger / AnimatedItem confirmed as importable wrappers
provides:
  - src/app/components/landing/AfterTheCallStrip.jsx — REPOS-03 5-item post-call workflow strip Server Component (id="after-call", AnimatedSection + AnimatedStagger)
  - src/app/components/landing/IdentitySection.jsx — OBJ-06 identity/change-aversion section with complement-framing copy (Server Component, max-w-[720px], bg-white)
  - src/app/components/landing/OwnerControlPullQuote.jsx — REPOS-04 dark pull-quote Server Component (bg-[#1C1412] + orange radial-gradient overlay, D-21 locked quote)
  - 5 populated Jest assertions in tests/unit/landing-sections.test.js for REPOS-03 / OBJ-06 / REPOS-04 (replacing 5 it.todo entries)
affects:
  - 47-05 (page.js wiring will import all 3 new components and place them: AfterTheCallStrip inside ScrollLinePath, IdentitySection between SocialProof and PracticalObjectionsGrid, OwnerControlPullQuote between SocialProof and FAQ)
  - 47-03 / 47-04 (share landing-sections.test.js — sequential wave; my 5 tests + 31 untouched todos = 36 total)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Components for landing sections (no 'use client') so they render synchronously before ScrollLinePath measures (Pitfall 5)"
    - "Inner div with relative z-[1] above absolute SVG; section element stays non-relative (Pitfall 5 / Pattern 7)"
    - "AnimatedStagger + AnimatedItem map pattern for grid items (POLISH-11 with useReducedMotion)"
    - "Dark warm base + radial-gradient orange glow overlay using two absolute inset-0 layers (FinalCTA mood, less intensity)"
    - "JSX entity escapes (&apos;, &ldquo;, &rdquo;) to keep complement-framing copy lint-clean and typographically correct"

key-files:
  created:
    - src/app/components/landing/AfterTheCallStrip.jsx
    - src/app/components/landing/IdentitySection.jsx
    - src/app/components/landing/OwnerControlPullQuote.jsx
  modified:
    - tests/unit/landing-sections.test.js (3 describe blocks populated; 5 it.todo → 5 it() with assertions; 31 todos in other plans' blocks left untouched)

key-decisions:
  - "AfterTheCallStrip uses id='after-call' (UI-SPEC-suggested neutral id) — never #features or #testimonials, both of which are ScrollLinePath measurement anchors that would skew the copper SVG path geometry (Pitfall 2)"
  - "IdentitySection skips the optional supporting visual mentioned in UI-SPEC OBJ-06 — content-only is cleaner and matches the planner's recommendation in the action block"
  - "OwnerControlPullQuote uses max-w-[640px] for exact UI-SPEC alignment instead of max-w-2xl (672px) — both were acceptable per the planner's note"
  - "Used JSX entity escapes (&apos;, &ldquo;, &rdquo;) instead of literal apostrophes/curly quotes — keeps the file lint-clean (react/no-unescaped-entities) and renders typographically correct quotation marks for the dark pull-quote"

patterns-established:
  - "Phase 47 landing-section convention: Server Component (no 'use client'), AnimatedSection wrapper, eyebrow/H2/body stack mirroring SocialProofSection's Tailwind tokens (text-[#F97316], text-[#0F172A], text-[#475569])"
  - "Smoke test convention extension: read source-file string with fs.readFileSync and assert on regex patterns (label count, anti-defensive-language lint, color tokens). No DOM render needed for these copy/structure smoke tests."

requirements-completed: [REPOS-03, OBJ-06, REPOS-04, POLISH-11, POLISH-12]

# Metrics
duration: ~3min
completed: 2026-04-14
---

# Phase 47 Plan 02: Three Autonomous Landing Sections Summary

**Created AfterTheCallStrip (REPOS-03), IdentitySection (OBJ-06), and OwnerControlPullQuote (REPOS-04) as pure Server Components with AnimatedSection wrappers and 375px-compliant responsive layouts; populated 5 Jest smoke-test assertions from the Wave 0 scaffold without disturbing 31 todos owned by sibling plans 47-03/47-04/47-05.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-14T11:38:49Z
- **Completed:** 2026-04-14T11:41:29Z
- **Tasks:** 3 (all `auto` + `tdd="true"`)
- **Files created:** 3 (one .jsx per task)
- **Files modified:** 1 (tests/unit/landing-sections.test.js — 5 it.todo → 5 passing it())

## Accomplishments

- **REPOS-03 — AfterTheCallStrip:** 5-item post-call workflow grid (CRM lead created, SMS+email sent, calendar synced, recurring slot reserved, analytics updated) built as a Server Component with `id="after-call"` so it can safely become the 3rd ScrollLinePath child in Plan 05 without breaking the copper SVG measurement (Pitfall 2). Uses `relative z-[1]` only on the inner div (Pitfall 5). AnimatedSection + AnimatedStagger + AnimatedItem wrappers satisfy POLISH-11; `grid-cols-1 md:grid-cols-5` satisfies POLISH-12 single-column-at-375px contract.
- **OBJ-06 — IdentitySection:** Emotional complement-framing section that disarms the identity/change-aversion objection by leading with what Voco is NOT ("doesn't show up on your truck. It doesn't meet your customers"), then reframing it as a complement that fills gaps when the owner is on the roof / asleep. Anti-defensive-language lint passes (no "worried", "don't worry", "replace you"); positive-framing tokens present 9 times.
- **REPOS-04 — OwnerControlPullQuote:** Dark `#1C1412` pull-quote section with orange radial glow overlay, rendering the D-21 locked quote "You set the rules. Voco follows them." at 24px mobile / 30px md+ semibold white. Mirrors FinalCTA's dark-section radial-glow pattern but at lower orange intensity.
- **5 smoke tests converted from `it.todo` to passing `it()` assertions** without touching the 13 todos belonging to plans 47-03 (PracticalObjectionsGrid, 6 todos), 47-04 (FAQSection, 4 todos), and 47-05 (Hero / FinalCTA copy, 3 todos). Sequential wave-2 contract honored.

## Task Commits

1. **Task 1: AfterTheCallStrip (REPOS-03)** — `982c461` (feat) — 5-item post-call workflow strip Server Component + 2 smoke-test assertions
2. **Task 2: IdentitySection (OBJ-06)** — `d4882ae` (feat) — complement-framing emotional section + anti-defensive-language smoke test
3. **Task 3: OwnerControlPullQuote (REPOS-04)** — `a4c00aa` (feat) — dark D-21 pull-quote section + 2 smoke-test assertions

## Files Created/Modified

- `src/app/components/landing/AfterTheCallStrip.jsx` — REPOS-03 (Server Component, 5 ITEMS array, AnimatedStagger grid, lucide icons UserPlus/MessageSquare/CalendarCheck/Repeat/BarChart3, `id="after-call"`)
- `src/app/components/landing/IdentitySection.jsx` — OBJ-06 (Server Component, max-w-[720px] centered, eyebrow + H2 + 3-paragraph stack, AnimatedSection wrapper)
- `src/app/components/landing/OwnerControlPullQuote.jsx` — REPOS-04 (Server Component, bg-[#1C1412] + radial-gradient orange glow, D-21 quote with `&ldquo;`/`&rdquo;`, max-w-[640px])
- `tests/unit/landing-sections.test.js` — 3 describe blocks populated (AfterTheCallStrip, IdentitySection, OwnerControlPullQuote); 31 it.todo entries belonging to plans 47-03/47-04/47-05 left intact

## Decisions Made

- **AfterTheCallStrip uses `id="after-call"` (UI-SPEC-suggested neutral id).** Never `#features` or `#testimonials`, both of which are ScrollLinePath measurement anchors per the existing landing-page geometry. Inserting the strip with either of those ids would shift the copper-line endpoints and cause the SVG to mis-align (Pitfall 2 from RESEARCH).
- **All three sections are Server Components (no `'use client'`).** They import the AnimatedSection wrapper (which IS a client component), but the section components themselves render synchronously, which is required so that ScrollLinePath's 100ms / 1000ms re-measure callbacks see them in the DOM (Pitfall 5 / Pattern 7).
- **IdentitySection skips the optional supporting visual.** UI-SPEC OBJ-06 mentions an optional photo/illustration; the planner's action note recommended content-only as cleaner. Adopted that recommendation.
- **OwnerControlPullQuote uses `max-w-[640px]` instead of `max-w-2xl`.** The planner explicitly offered both as acceptable; chose the exact UI-SPEC alignment value.
- **JSX entity escapes for apostrophes and curly quotes.** Used `&apos;` for "you're" / "don't" and `&ldquo;`/`&rdquo;` for the pull-quote. Two reasons: (1) keeps `react/no-unescaped-entities` lint clean, (2) renders typographically correct curly quotes in the dark pull-quote without depending on font-feature-settings.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JSX `react/no-unescaped-entities` would fire on literal apostrophes in IdentitySection copy**

- **Found during:** Task 2 (writing IdentitySection — copy contains "You're", "doesn't", "Voco's" patterns from the plan's verbatim code block)
- **Issue:** The plan's verbatim Task 2 code block uses literal `'` characters (e.g., `You're still the boss`, `Voco doesn't show up`). Next.js / ESLint's `react/no-unescaped-entities` rule (default in Next.js projects) flags these in JSX text. Plan 47-01's CLAUDE.md context indicates the project uses Next.js + ESLint defaults.
- **Fix:** Replaced literal apostrophes with `&apos;` JSX entities throughout IdentitySection.jsx. The smoke test regex `/your|you'?re|still/i` still matches because `your` appears multiple times outside quoted strings.
- **Files modified:** `src/app/components/landing/IdentitySection.jsx`
- **Verification:** `npx jest -t "IdentitySection"` passes; `grep "&apos;"` confirms entity replacements applied.
- **Committed in:** `d4882ae` (Task 2 commit)

### Out-of-Scope Issues (Not Fixed)

**1. Pre-existing Jest worktree-ignore pattern blocks `npm test` from inside the worktree**

- **Issue:** `jest.config.js` has `testPathIgnorePatterns: ['/node_modules/', '/.claude/worktrees/', '/tests/integration/']`, which silently filters our worktree path. Documented and worked around in plan 47-01's deviations.
- **Workaround used:** Invoked tests via `npx jest tests/unit/landing-sections.test.js --testPathIgnorePatterns="/node_modules/"` (overrides the worktree ignore but keeps node_modules ignored). Same approach as 47-01.
- **Action:** Out of scope per SCOPE BOUNDARY rule. Not fixed.

**2. `jest-haste-map: duplicate manual mock found` warnings (twilio, supabase)**

- **Issue:** Worktree path duplicates the mocks at `tests/__mocks__/`. Pre-existing harness behavior — not introduced by this plan.
- **Action:** Out of scope. Not fixed.

---

**Total deviations:** 1 auto-fixed (JSX entity escapes for lint compliance), 2 out-of-scope (pre-existing test harness behavior).
**Impact on plan:** Functional outcome unchanged. All acceptance criteria for all 3 tasks pass; smoke tests pass (5 passed, 31 todos for sibling plans).

## Issues Encountered

- Initial worktree base reset showed Wave 1 deliverables (47-01-SUMMARY.md, accordion.jsx, scaffold test files, audio README) as "deleted" because the worktree files had drifted from HEAD before the agent started. Restored them via `git checkout HEAD -- ...` to baseline matching the Wave 1 commit. No data loss.
- Pre-existing test failures in other suites surfaced earlier in 47-01; not addressed here per scope rules.

## User Setup Required

None — pure component creation. No env vars, dashboards, OAuth, or external service config needed.

## Next Phase Readiness

- **Plan 47-03 (PracticalObjectionsGrid + AudioPlayerCard):** Unblocked. Their 6 it.todo slots are intact in landing-sections.test.js. Their files do not collide with Plan 02 outputs.
- **Plan 47-04 (FAQSection):** Unblocked. Their 4 it.todo slots are intact. Their files do not collide with Plan 02 outputs.
- **Plan 47-05 (page.js wiring + Hero/FinalCTA copy):** Will import the 3 new Server Components from `./components/landing/{AfterTheCallStrip,IdentitySection,OwnerControlPullQuote}`. Recommended placement (per the plan's intro and CONTEXT.md):
  - `<AfterTheCallStrip />` inserted as the 3rd child of `<ScrollLinePath>` (between FeaturesCarousel and SocialProofSection)
  - `<IdentitySection />` between SocialProof and PracticalObjectionsGrid (warm-neutral white between bg-[#F5F5F4] and bg-[#FAFAF9])
  - `<OwnerControlPullQuote />` between SocialProofSection (or its successor in the new flow) and FAQSection
- **No blockers.**

## Self-Check: PASSED

All claimed artifacts verified to exist:

- `src/app/components/landing/AfterTheCallStrip.jsx` — FOUND
- `src/app/components/landing/IdentitySection.jsx` — FOUND
- `src/app/components/landing/OwnerControlPullQuote.jsx` — FOUND
- `tests/unit/landing-sections.test.js` — FOUND (5 passing tests + 31 untouched todos for sibling plans = 36 total)
- Commit `982c461` (Task 1 AfterTheCallStrip) — FOUND in `git log`
- Commit `d4882ae` (Task 2 IdentitySection) — FOUND in `git log`
- Commit `a4c00aa` (Task 3 OwnerControlPullQuote) — FOUND in `git log`
- All acceptance criteria greps verified (export, no use-client, no #features/#testimonials, after-call id, label count >= 5, bg-[#1C1412], radial-gradient, rules+follow regex)
- Final `npx jest tests/unit/landing-sections.test.js` shows `5 passed, 31 todo, 36 total`. Jest discovers the file twice (canonical path + worktree path — pre-existing harness behavior), but within the canonical file: 5 passing assertions added by this plan + 13 it.todo entries belonging to sibling plans 47-03/47-04/47-05 (PracticalObjectionsGrid: 6, FAQSection: 4, Hero: 2, FinalCTA: 1). Verified directly via `grep -c "it\.todo" tests/unit/landing-sections.test.js` → 13, `grep -c "it("` → 5. Wave 2 contract honored — 13 untouched todos confirmed in the canonical file.

---

*Phase: 47-landing-objection-busting-repositioning-and-landing-polish*
*Completed: 2026-04-14*

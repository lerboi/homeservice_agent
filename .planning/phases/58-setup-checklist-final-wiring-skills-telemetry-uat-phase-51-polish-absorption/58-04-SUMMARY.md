---
phase: 58-setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption
plan: 04
subsystem: ui-primitives
tags: [ui, primitives, polish, design-tokens, focus-visible, jest, jsx, rtl]

requires:
  - phase: 58
    plan: 01
    provides: "Wave 0 primitive test scaffolds (EmptyState/ErrorState/AsyncButton.test.jsx) as red targets"
provides:
  - "<EmptyState>, <ErrorState>, <AsyncButton> shared UI primitives with 58-UI-SPEC §4 locked prop contracts"
  - "Thin-wrapper EmptyStateLeads / EmptyStateCalendar that preserve existing import paths + props (zero caller-side regression)"
  - "focus.ring design token migrated to focus-visible: with dark-mode-aware offset (POLISH-03)"
  - "JSX Jest infra: babel-jest transform for .jsx, extensionsToTreatAsEsm, @testing-library/react + jest-environment-jsdom + @testing-library/jest-dom wired — so every future .test.jsx under tests/components/ runs without further setup"
affects: [58-05]

tech-stack:
  added:
    - "@testing-library/react (RTL) — dev dep"
    - "@testing-library/jest-dom — dev dep (global toBeInTheDocument / toBeDisabled / toHaveAttribute matchers)"
    - "jest-environment-jsdom — dev dep"
    - "@babel/preset-env — dev dep (Jest-only, modules: false)"
    - "@babel/preset-react — dev dep (runtime: automatic, Jest-only)"
  patterns:
    - "Jest-only babel config at babel.jest.config.cjs referenced via jest.config.js `transform` — keeps Next.js SWC pipeline untouched (no root babel.config.js)"
    - "Locked prop APIs on shared UI primitives: consumers author once, planner enforces across 7 dashboard pages in Plan 58-05"
    - "Thin-wrapper refactor: replace hardcoded markup with a primitive call while preserving the wrapper file name + named export so every caller continues compiling"

key-files:
  created:
    - "src/components/ui/empty-state.jsx (POLISH-01 generic primitive — icon + headline + optional description + optional CTA with ctaHref|ctaOnClick mutual exclusion)"
    - "src/components/ui/error-state.jsx (POLISH-04 generic primitive — role=alert + AlertTriangle + fixed 'Something went wrong' headline + default 'We couldn't load this. Please try again.' + optional Retry button)"
    - "src/components/ui/async-button.jsx (POLISH-05 wrapper — Loader2 animate-spin + pendingLabel swap; pending || disabled both gate)"
    - "babel.jest.config.cjs (Jest-only babel presets, modules: false preserves ESM)"
    - "jest.setup.jsx.js (registers @testing-library/jest-dom matchers via setupFilesAfterEnv)"
  modified:
    - "src/components/dashboard/EmptyStateLeads.jsx (hardcoded 19 lines → 17-line wrapper delegating to <EmptyState icon={Users} ... />; named export preserved)"
    - "src/components/dashboard/EmptyStateCalendar.jsx (hardcoded → wrapper delegating to <EmptyState icon={Calendar} ... />; padding + onConnect props preserved so existing callers at /dashboard/calendar/page.js:925 keep working unchanged)"
    - "src/lib/design-tokens.js (focus.ring: `focus:` → `focus-visible:` with ring-offset-[var(--background)] for dark-mode offset blend)"
    - "jest.config.js (testMatch adds .test.jsx; extensionsToTreatAsEsm: ['.jsx']; transform wires babel-jest for .jsx; setupFilesAfterEnv loads jest-dom; transformIgnorePatterns allows lucide-react through)"
    - "package.json + package-lock.json (added 5 dev deps)"

key-decisions:
  - "Jest-only babel config file (babel.jest.config.cjs) — NOT a root babel.config.js — so Next.js keeps using SWC. Referenced explicitly via jest.config.js transform.configFile."
  - "babel preset-env modules: false + jest extensionsToTreatAsEsm: ['.jsx'] — preserves ESM end-to-end so existing `.test.js` tests that use `jest.unstable_mockModule` continue to work. Only .jsx gets transformed (for JSX syntax), never its module system."
  - "EmptyStateLeads + EmptyStateCalendar retain NAMED exports (plan sample suggested default). The real source files ship named exports; both current callers (/dashboard/jobs/page.js:23, /dashboard/calendar/page.js:6) import named. Switching to default would have broken both callers — Rule 1 correction."
  - "EmptyStateCalendar wrapper retains its `padding` + `onConnect` props. The current caller passes `padding='py-6' onConnect={() => {}}`. The generic <EmptyState> fixes py-16; wrapper wraps it in an outer padding-override div ONLY when padding !== 'py-16' to preserve the shipped behavior. onConnect maps to ctaOnClick."
  - "EmptyStateCalendar copy kept as current shipped ('No appointments yet' / 'When your AI books jobs…' / 'Connect Calendar' CTA) rather than UI-SPEC §10.1 locked copy ('Add a time block' wired to TimeBlockSheet). The copy change is a behavior change that belongs to Plan 58-05's dashboard page sweep — the current caller passes a no-op `onConnect` handler, so changing the label to 'Add a time block' without wiring TimeBlockSheet would mislead users. Plan 58-05 owns the page-level wiring."
  - "`jest.config.js` `setupFilesAfterEnv` is the correct option name (not `setupFilesAfterEach`) — verified by inspecting `jest-config` defaults at runtime."

patterns-established:
  - "Shared UI primitive authoring convention: under src/components/ui/; 'use client'; named export; locked prop API in a JSDoc block; Tailwind classes use semantic tokens only (no hardcoded colors) except for the documented red-dot exception in UI-SPEC §11"
  - "Thin wrapper preservation: when refactoring a hardcoded component to consume a new primitive, keep the wrapper's file name + export shape + prop interface, even if the primitive doesn't natively expose those props. Internal wrappers (padding override div) are acceptable."

requirements-completed: [POLISH-01, POLISH-03, POLISH-04, POLISH-05]

duration: ~40min
completed: 2026-04-20
---

# Phase 58 Plan 04: POLISH Primitives + Focus-Visible Migration Summary

**Ships 3 shared UI primitives (`<EmptyState>`, `<ErrorState>`, `<AsyncButton>`) under `src/components/ui/` with the 58-UI-SPEC §4 locked prop contracts, refactors `EmptyStateLeads`/`EmptyStateCalendar` to thin wrappers (zero caller-side regression), migrates the `focus.ring` design token to `focus-visible:` with a dark-mode-aware offset, and wires RTL+jsdom+babel-jest so every future `.test.jsx` under `tests/components/` runs — all 15 Wave 0 primitive test cases green.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-04-20T11:05Z
- **Completed:** 2026-04-20T11:45Z
- **Tasks:** 2 / 2
- **Files created:** 5 (3 primitives + babel.jest.config.cjs + jest.setup.jsx.js)
- **Files modified:** 6 (2 wrapper refactors + design-tokens.js + jest.config.js + package.json + package-lock.json)

## Accomplishments

- **POLISH-01 `<EmptyState>`** shipped: icon + headline required; description / ctaLabel / ctaHref / ctaOnClick optional; `ctaHref` renders `asChild Button Link`, `ctaOnClick` renders `Button` with handler, no CTA without `ctaLabel`. Icon carries `aria-hidden="true"`. Tailwind classes match UI-SPEC §4.1 layout contract verbatim.
- **POLISH-04 `<ErrorState>`** shipped: `role="alert"` outer container; `AlertTriangle` icon with `h-8 w-8 text-destructive/70`; fixed `Something went wrong` headline; default copy `We couldn't load this. Please try again.` (Unicode apostrophe preserved); retry button only when `onRetry` provided, `retryLabel` defaults to `Try again`.
- **POLISH-05 `<AsyncButton>`** shipped: wraps shadcn `<Button>`; `pending || disabled` both disable; when pending renders `Loader2 animate-spin` + swaps label to `pendingLabel ?? children`; all Button props spread through (variant, size, onClick, type, className, asChild).
- **`EmptyStateLeads` refactored** from 19 hardcoded lines to a 17-line wrapper delegating to `<EmptyState icon={Users} headline="No jobs yet" description="..." ctaLabel="Make a Test Call" ctaHref="/dashboard/more/ai-voice-settings" />`. Named export preserved. Caller at `/dashboard/jobs/page.js:23` unchanged.
- **`EmptyStateCalendar` refactored** to delegate to `<EmptyState icon={Calendar} ...>` while preserving the existing `padding` + `onConnect` props — the generic primitive hardcodes `py-16`, so the wrapper applies an outer padding-override div only when `padding !== 'py-16'`. `onConnect` maps to `ctaOnClick` via the `'Connect Calendar'` CTA label. Caller at `/dashboard/calendar/page.js:925` (`<EmptyStateCalendar padding="py-6" onConnect={() => {}} />`) unchanged.
- **POLISH-03 focus token migrated:** `src/lib/design-tokens.js` `focus.ring` export rewritten from `focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1` → `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--background)]`. Every consumer that imports `{ focus }` from `@/lib/design-tokens` now picks up keyboard-only reveal + dark-mode offset blending. Hardcoded `focus:` literal sweeps across dashboard pages are Plan 58-05's scope.
- **JSX Jest infra wired** so Wave 0 scaffolds at `tests/components/*.test.jsx` now execute:
  - `@testing-library/react` + `@testing-library/jest-dom` + `jest-environment-jsdom` + `@babel/preset-env` + `@babel/preset-react` installed as dev deps.
  - `babel.jest.config.cjs` — Jest-only babel (NOT a root `babel.config.js`) with `modules: false` to preserve ESM.
  - `jest.config.js` extended: `testMatch` adds `.test.jsx`, `extensionsToTreatAsEsm: ['.jsx']`, `transform` wires babel-jest with Jest-only config, `setupFilesAfterEnv` loads `jest.setup.jsx.js` for jest-dom matchers, `transformIgnorePatterns` allows `lucide-react` (ESM-only) through.
  - `jest.setup.jsx.js` registers `@testing-library/jest-dom` globally via `setupFilesAfterEnv`.
- **All 3 Wave 0 primitive test files green:** `tests/components/EmptyState.test.jsx` + `ErrorState.test.jsx` + `AsyncButton.test.jsx` → 15 / 15 test cases pass.
- **No regression on existing tests:** spot-checked `tests/lib/*.test.js` (13 pass) and `tests/api/setup-checklist-*.test.js` (xero + jobber suites pass; the error-state suite fails as designed — it's Plan 58-02's red target, not ours).

## Task Commits

1. **Task 1: POLISH-01/04/05 primitives + wrapper refactors + JSX Jest infra** — `cbbefd8` (feat)
2. **Task 2: POLISH-03 focus.ring token → focus-visible:** — `a53a1d9` (refactor)

## Files Created/Modified

### Created

- `src/components/ui/empty-state.jsx` (38 lines) — POLISH-01 generic primitive.
- `src/components/ui/error-state.jsx` (36 lines) — POLISH-04 generic primitive with `role="alert"`.
- `src/components/ui/async-button.jsx` (31 lines) — POLISH-05 pending-wrapper.
- `babel.jest.config.cjs` (14 lines) — Jest-only babel presets (`@babel/preset-env { modules: false }` + `@babel/preset-react { runtime: 'automatic' }`). Not read by Next.js SWC pipeline.
- `jest.setup.jsx.js` (5 lines) — `import '@testing-library/jest-dom'` registers global matchers.

### Modified

- `src/components/dashboard/EmptyStateLeads.jsx` — 19 hardcoded lines → 17-line wrapper. Named export preserved.
- `src/components/dashboard/EmptyStateCalendar.jsx` — hardcoded → wrapper with `padding` + `onConnect` props preserved for backward compat (padding override div applied only when non-default).
- `src/lib/design-tokens.js` — `focus.ring` migrated to `focus-visible:` + `ring-offset-[var(--background)]`. All other exports untouched.
- `jest.config.js` — testMatch + extensionsToTreatAsEsm + transform + setupFilesAfterEnv + transformIgnorePatterns.
- `package.json` + `package-lock.json` — 5 new devDependencies.

## Decisions Made

- **Named exports over default exports for wrappers** — the existing source shipped named exports (`export function EmptyStateLeads()` and `export function EmptyStateCalendar(...)`); both current callers import named. Plan sample (Step 4 + 5) suggested `export default` — would have broken both callers at the import statement. Applied Rule 1 (bug) correction: kept named exports.
- **EmptyStateCalendar retains its `padding` + `onConnect` props** — the caller passes `padding="py-6" onConnect={() => {}}`. Generic `<EmptyState>` hardcodes `py-16`. Wrapper applies an outer padding-override div only when `padding !== 'py-16'` to preserve shipped behavior without mutating the primitive.
- **EmptyStateCalendar copy stays as current shipped** — UI-SPEC §10.1 locks future copy (`'No appointments yet'` / `'Bookings from your AI receptionist will appear here. You can also add a time block to hold time off.'` / `'Add a time block'` → TimeBlockSheet), but Plan 58-04 only ships primitives. The page-level behavior change (wiring TimeBlockSheet, swapping copy) belongs to Plan 58-05. The current caller passes a no-op `onConnect` handler, so changing copy now without wiring the action would mislead users.
- **Jest-only babel config file (`babel.jest.config.cjs`), NOT a root `babel.config.js`** — Next.js reads a root `babel.config.js` and forces itself off SWC, which would regress the whole build pipeline. A Jest-only config file referenced explicitly via `transform.configFile` keeps Next on SWC.
- **`modules: false` + `extensionsToTreatAsEsm: ['.jsx']`** — preserves ESM end-to-end. Existing `.test.js` tests (e.g. `tests/api/*`) that use `jest.unstable_mockModule` must receive native ESM — any babel-jest output that converts to CJS would break them. Transforming only JSX syntax (not modules) + declaring `.jsx` as ESM at the Jest level keeps both worlds working.
- **`setupFilesAfterEnv` is the correct Jest option name** (not `setupFilesAfterEach` — that's not a Jest option). Verified at runtime via `Object.keys(require('jest-config').defaults).filter(...)`.
- **`transformIgnorePatterns` allows `lucide-react`** — `lucide-react` ships ESM-only and is imported by the test files. Without the `!(lucide-react)/` escape, Jest's default ignore pattern skips transform and Node's ESM loader rejects the `export` keyword.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserve named exports on wrapper files**
- **Found during:** Task 1 Step 4 + Step 5
- **Issue:** Plan Step 4 code sample uses `export default function EmptyStateLeads()`, but the existing source at `src/components/dashboard/EmptyStateLeads.jsx:5` ships `export function EmptyStateLeads()` (named). Same for `EmptyStateCalendar`. The two callers (`src/app/dashboard/jobs/page.js:23` and `src/app/dashboard/calendar/page.js:6`) import via named-import syntax (`import { EmptyStateLeads } from '@/components/dashboard/EmptyStateLeads'`). Switching to default export would crash both pages.
- **Fix:** Kept `export function` (named) in both refactored wrappers.
- **Files modified:** `src/components/dashboard/EmptyStateLeads.jsx`, `src/components/dashboard/EmptyStateCalendar.jsx`
- **Verification:** `grep -c "from '@/components/ui/empty-state'"` returns 1 in each file; `grep "export function"` returns 1 in each file; callers unchanged.
- **Committed in:** cbbefd8

**2. [Rule 3 - Blocking] Installed JSX Jest infra + wired babel-jest so Wave 0 tests can run**
- **Found during:** Task 1 (running `npm test` for the primitive tests)
- **Issue:** Wave 0 (58-01) explicitly deferred this to Plan 58-04 per its SUMMARY "Deferred Issues" section: `jest.config.js testMatch` was `.test.js` only, `@testing-library/react` + `jest-environment-jsdom` + babel/presets were uninstalled, no JSX transform configured. Without this infra, every Wave 0 primitive test fails to load, and the plan's acceptance criterion "3 Wave 0 primitive tests green" cannot be satisfied.
- **Fix:**
  - `npm install --save-dev @testing-library/react @testing-library/jest-dom jest-environment-jsdom @babel/preset-env @babel/preset-react`
  - Created `babel.jest.config.cjs` (CJS extension required because `package.json` has `"type": "module"`).
  - Extended `jest.config.js`: added `.test.jsx` to `testMatch`; `extensionsToTreatAsEsm: ['.jsx']`; `transform: { '^.+\\.jsx$': ['babel-jest', { configFile: './babel.jest.config.cjs' }] }`; `setupFilesAfterEnv: ['<rootDir>/jest.setup.jsx.js']`; `transformIgnorePatterns` allows `lucide-react`.
  - Created `jest.setup.jsx.js` importing `@testing-library/jest-dom`.
- **Files modified:** `package.json`, `package-lock.json`, `jest.config.js`, `babel.jest.config.cjs` (new), `jest.setup.jsx.js` (new)
- **Verification:** `npm test -- --testPathPattern="components/(EmptyState|ErrorState|AsyncButton)"` → `Tests: 15 passed, 15 total` across 3 suites.
- **Committed in:** cbbefd8

**3. [Rule 3 - Blocking] Iterated babel + jest config four times to get ESM + JSX interop right**
- **Found during:** Task 1 (first three `npm test` runs failed)
- **Issue sequence:**
  - Attempt 1: `babel.jest.config.js` (ESM `.js`, `package.json` has `"type": "module"`) → crashed with `ReferenceError: module is not defined` (babel-jest `require()`s the config file, expected CJS).
  - Attempt 2: renamed to `.cjs` → next error: `Must use import to load ES Module: src/lib/utils.js` (babel-jest transformed the `.jsx` file to CJS, then tried to `require()` an ESM `.js`).
  - Attempt 3: set `preset-env modules: false` → next error: `SyntaxError: Cannot use import statement outside a module` (Jest didn't know `.jsx` was ESM).
  - Attempt 4: added `extensionsToTreatAsEsm: ['.jsx']` → **all tests pass**.
- **Fix:** Final config preserves ESM end-to-end; babel transforms only JSX syntax, not the module system.
- **Files modified:** `babel.jest.config.cjs`, `jest.config.js`
- **Verification:** 15 / 15 primitive tests green; `tests/lib/*.test.js` spot-check still passes (13 / 13) — no regression on existing ESM test flow.
- **Committed in:** cbbefd8

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking). Zero architectural changes. All three corrections were mechanical fixes needed to bridge the plan's assumption gap between "Wave 0 scaffolded the tests" and "the infra to run them does not exist yet" — which Wave 0's own SUMMARY flagged as deferred to this plan.

**Impact on plan:** Zero scope creep. Primitives + wrappers + token migration exactly as planned. The extra infra work was a documented Wave 0 deferral that Plan 58-04 was expected to absorb.

## Issues Encountered

- **Worktree stale base on Windows** — caught by the mandatory `worktree_branch_check`. Expected base `b2f7e87`, actual `3c9bed31`. Reset soft → hard resolved cleanly before any work began. Matches the known-issue feedback in `memory/feedback_gsd_worktree_stale_base_windows.md`.
- **Pre-existing working-tree noise from other worktrees** — `git status` showed `livekit-agent/tests/integrations/test_*.py` and `.planning/ROADMAP.md` as modified (line-ending drift from other agents). NOT mine; not staged. Plan 58-03 owns the Python files; the ROADMAP drift is pre-existing.
- **`tests/api/setup-checklist-error-state.test.js` fails** — this is the Wave 0 red target for Plan 58-02 (CHECKLIST-01). Expected. Not my scope.

## Deferred Issues

None from this plan. All Wave 0 deferred items (test infra + testMatch) are now resolved.

**Downstream work for Plan 58-05 (expected):**
- Sweep hardcoded `focus:` literals across `src/components/dashboard/ChecklistItem.jsx`, `BusinessIntegrationsClient.jsx`, and the 7 dashboard pages → replace with `focus-visible:` or import the `focus` design token.
- Wire the new primitives into the 7 dashboard pages per UI-SPEC §8 matrix.
- If the calendar page UX team wants the UI-SPEC §10.1 locked copy (`'No appointments yet'` / `'Add a time block'` → TimeBlockSheet), update the `EmptyStateCalendar` wrapper to accept an `onAddBlock` prop and wire it in `/dashboard/calendar/page.js`.

## User Setup Required

None — this plan is a pure code change (no env vars, no external services).

## Next Phase Readiness

- **Plan 58-05** (the dashboard page sweep) can now `import { EmptyState, ErrorState, AsyncButton } from '@/components/ui/*'` across all seven dashboard pages with the locked prop contracts already baked in — no further primitive authoring required.
- **Plan 58-05's focus ring consumer sweep** can either (a) replace hardcoded `focus:` literals with `focus-visible:` in-place OR (b) import `{ focus }` from `@/lib/design-tokens` and spread `focus.ring` on elements — both satisfy POLISH-03.
- **Any future `tests/components/*.test.jsx`** now runs without config changes. Jest picks up `.test.jsx`, babel-jest transforms JSX, jsdom environment is available via `@jest-environment jsdom` pragma, `@testing-library/react` + `jest-dom` matchers are pre-registered.

## Self-Check: PASSED

File existence (all 5 created + 5 modified):
- FOUND: src/components/ui/empty-state.jsx
- FOUND: src/components/ui/error-state.jsx
- FOUND: src/components/ui/async-button.jsx
- FOUND: babel.jest.config.cjs
- FOUND: jest.setup.jsx.js
- FOUND (modified): src/components/dashboard/EmptyStateLeads.jsx (grep: "from '@/components/ui/empty-state'" = 1)
- FOUND (modified): src/components/dashboard/EmptyStateCalendar.jsx (grep: "from '@/components/ui/empty-state'" = 1)
- FOUND (modified): src/lib/design-tokens.js (grep: `focus-visible:ring-offset-\[var\(--background\)\]` = 1; grep: `ring: 'focus:` = 0)
- FOUND (modified): jest.config.js (grep: `testMatch.*\.test\.jsx` = 1)
- FOUND (modified): package.json (grep: `@testing-library/react` = 1)

Commit existence:
- FOUND: cbbefd8 (Task 1: primitives + wrappers + JSX Jest infra)
- FOUND: a53a1d9 (Task 2: focus.ring → focus-visible)

Test run:
- `npm test -- --testPathPattern="components/(EmptyState|ErrorState|AsyncButton)"` → Test Suites: 3 passed, 3 total / Tests: 15 passed, 15 total
- Spot-checked `tests/lib/*.test.js` → 13 passed (no regression from ESM config changes)

Acceptance-criteria greps (all passed):
- `export function EmptyState` in empty-state.jsx = 1
- `export function ErrorState` in error-state.jsx = 1
- `export function AsyncButton` in async-button.jsx = 1
- `role="alert"` in error-state.jsx = 2 (literal + JSDoc mention)
- `animate-spin` in async-button.jsx = 2 (implementation + JSDoc)
- `from '@/components/ui/empty-state'` in EmptyStateLeads.jsx = 1
- `from '@/components/ui/empty-state'` in EmptyStateCalendar.jsx = 1
- `focus-visible:outline-none` in design-tokens.js = 1
- `focus-visible:ring-offset-[var(--background)]` in design-tokens.js = 1
- No `ring: 'focus:` literal remaining in design-tokens.js

---
*Phase: 58-setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption*
*Plan: 04*
*Completed: 2026-04-20*

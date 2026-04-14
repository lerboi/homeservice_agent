---
phase: 47-landing-objection-busting-repositioning-and-landing-polish
plan: 04
subsystem: landing
tags: [landing, faq, accordion, chat-widget, public-chat, server-component, client-island, jest, smoke-test]

# Dependency graph
requires:
  - phase: 47-landing-objection-busting-repositioning-and-landing-polish
    plan: 01
    provides: shadcn Accordion at @/components/ui/accordion (Accordion, AccordionItem, AccordionTrigger, AccordionContent); /api/public-chat smoke-test-confirmed POST handler; landing-sections.test.js scaffold (4 FAQSection it.todo slots)
  - phase: 47-landing-objection-busting-repositioning-and-landing-polish
    plan: 02
    provides: 5 already-passing assertions (AfterTheCallStrip, IdentitySection, OwnerControlPullQuote) — left untouched per Wave 2 sequential contract
  - phase: 47-landing-objection-busting-repositioning-and-landing-polish
    plan: 03
    provides: 10 already-passing assertions (AudioPlayerCard 3 + PracticalObjectionsGrid 6 + 1 import smoke) — left untouched per Wave 2 sequential contract
provides:
  - src/app/components/landing/FAQChatWidget.jsx — 'use client' chat island posting to /api/public-chat with 10-entry history cap, locked suggestion chips, friendly error copy, 36px aria-labelled send button
  - src/app/components/landing/FAQSection.jsx — 'use client' outer shell rendering 7-question Radix Accordion + embedded FAQChatWidget in lg+ 3fr/2fr grid
  - 12 populated Jest assertions in tests/unit/landing-sections.test.js (4 FAQSection it.todo → 6 it() + new FAQChatWidget describe block with 6 it())
affects:
  - 47-05 (page.js wiring + Hero/FinalCTA copy) — will import FAQSection from ./components/landing/FAQSection and place it between OwnerControlPullQuote (47-02) and FinalCTASection; 3 Hero/FinalCTA it.todo slots remain intact

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Radix Accordion consumer pattern: 'use client' top-level + map() over a FAQS data array yields cleaner code than 7 explicit AccordionItem blocks"
    - "Single-island chat: FAQSection itself is a client component (Radix Accordion requires it) but FAQChatWidget is the only file with stateful logic; both files share the same 'use client' boundary"
    - "Anonymous chat reuses existing /api/public-chat backend (Plan 01 verified handler) — zero new API surface in Phase 47"
    - "Pitfall 3: client-side messages.slice(-10) before POST body construction prevents oversized payloads"
    - "Pitfall 7: input + button disabled while isLoading; spinner swap on submit button keeps user oriented"
    - "Friendly single-error pattern: every API failure (rate limit, 503, network error) surfaces as the same one-line user-readable bot bubble"

key-files:
  created:
    - src/app/components/landing/FAQChatWidget.jsx
    - src/app/components/landing/FAQSection.jsx
  modified:
    - tests/unit/landing-sections.test.js (FAQSection: 4 it.todo → 6 it(); appended FAQChatWidget describe block with 6 it() — 3 Hero/FinalCTA todos owned by 47-05 left untouched)

key-decisions:
  - "FAQSection uses 'use client' on the section file itself because shadcn Accordion is a Radix client primitive — the AccordionPrimitive.Root/Item/Trigger components register event handlers and would error if rendered as Server Components. This is a per-shadcn-component requirement, not a project-wide pattern."
  - "Used JSX entity escapes (&apos;) for apostrophes inside JSX text children, kept literal apostrophes inside JS string literals (the FAQS.a array values that are plain strings rather than JSX). Both render correctly: &apos; resolves to ' in JSX text; literal ' inside a JS string is also rendered as ' in JSX text. This matches the pattern 47-02 and 47-03 established."
  - "Radix Accordion consumer code uses .map() over a FAQS data array (7 entries). The plan's verbatim test expected `(s.match(/AccordionItem/g) || []).length >= 14` (assuming 7 explicit AccordionItem JSX blocks = 14 tag occurrences). With .map() the source has only 3 AccordionItem occurrences (1 import + 1 open + 1 close inside the loop). Adjusted the assertion to count `value: 'qN'` keys in the FAQS array, which proves 7 distinct FAQ entries are wired without coupling to the rendering pattern."
  - "Anonymous chat reuses existing /api/public-chat backend — zero new API routes. Body fields message + currentRoute='/' + history match the route's expected JSON contract exactly. The backend already enforces rate limit (5s/IP, 1000/day global) and Groq-call upstream; FAQChatWidget does not need to mirror that."

patterns-established:
  - "Phase 47 FAQ data convention: FAQS array of {value, q, a} objects where `a` can be either a plain string (one-line answer) or a JSX fragment (answer with inline links). Renderer is unchanged — JSX children accept either."
  - "Friendly error copy single-source: const ERROR_COPY = \"Couldn't connect right now — try refreshing the page.\" used uniformly for all error paths (rate limit, 503, network). One copy string keeps the user-facing surface consistent and editable in one place."
  - "Wave 2 sequential test-file contract: each plan in the wave converts only its own designated it.todo slots (47-04 = 4 FAQSection slots) and may append new describe blocks (47-04 = FAQChatWidget). Plans NEVER touch other plans' converted assertions."

requirements-completed: [OBJ-01, POLISH-11, POLISH-12]

# Metrics
duration: ~6min
completed: 2026-04-14
---

# Phase 47 Plan 04: FAQSection + FAQChatWidget Summary

**Created the FAQSection 'use client' component (7-question Radix Accordion using shadcn primitive from Plan 01) and the FAQChatWidget 'use client' island (anonymous POST to existing /api/public-chat with Pitfall-3 history cap and Pitfall-7 disable-on-load) — converted 4 FAQSection it.todo slots to 6 passing it() assertions and appended a 6-test FAQChatWidget describe block, leaving the 3 Hero/FinalCTA todos owned by 47-05 untouched per the Wave 2 sequential contract.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-14T19:50:00Z
- **Completed:** 2026-04-14T19:56:00Z
- **Tasks:** 2 (both `auto` + `tdd="true"`)
- **Files created:** 2 (one .jsx per task)
- **Files modified:** 1 (tests/unit/landing-sections.test.js)

## Accomplishments

- **OBJ-01 + D-10 chat — FAQChatWidget ('use client' island).** Anonymous chat island that posts to the existing `/api/public-chat` route with body `{ message, currentRoute: '/', history }` where history is `messages.slice(-10)` (Pitfall 3 cap). Empty state shows 3 locked suggestion chips ("Does it really sound natural?", "How long does setup take?", "What does it cost?"). Loading state disables both input and submit button (Pitfall 7) and shows a spinner-only loading bubble. All API failures (rate limit, 503, network error) surface as the same friendly one-liner: `"Couldn't connect right now — try refreshing the page."` — single-source copy. Send button is 36×36px (`w-9 h-9`) `rounded-xl bg-[#F97316]` with `aria-label="Send message"`.
- **OBJ-01 — FAQSection (7-question Radix Accordion + chat grid).** Server-rendered FAQ component (technically `'use client'` because Radix Accordion is a Radix primitive that requires client hydration) on `bg-white` background between the dark OwnerControlPullQuote and the dark FinalCTA. Renders 7 D-06 locked questions in a `type="single" collapsible` Accordion. Each answer is 2-3 sentences, confident, specific (85% blind test, $99/$249/$599 tiers, 4 min 12 sec median setup). Two inline orange `#F97316` underlined links: Q1 "Hear it yourself →" → `#hero`, Q3 "see full pricing →" → `/pricing` (UI-SPEC cap of 2 in-section links). Right column on lg+ is the FAQChatWidget; mobile stacks chat below the accordion.
- **Smoke-test contract honored.** Of 30 total tests in `landing-sections.test.js`: 5 from 47-02 + 10 from 47-03 still passing (untouched), 12 new from this plan all passing (6 FAQSection + 6 FAQChatWidget), 3 it.todo entries remaining for 47-05 (Hero: 2, FinalCTA: 1) intact. Wave 2 sequential test-file contract fully satisfied.

## Task Commits

1. **Task 1: FAQChatWidget ('use client' chat island)** — `e4da1dc` (feat) — POST /api/public-chat island + 6 smoke tests
2. **Task 2: FAQSection (7-question accordion + chat grid)** — `de6605e` (feat) — Radix Accordion shell + FAQChatWidget embed + 4 it.todo → 6 it()

## Files Created/Modified

- `src/app/components/landing/FAQChatWidget.jsx` — `'use client'`. `useState/useRef/useEffect` for messages/input/loading/auto-scroll. `lucide-react` `SendHorizonal` + `Loader2` icons. POST to `/api/public-chat` with `slice(-10)` history cap. Friendly error copy `ERROR_COPY` constant. 3 locked suggestion chips. Send button 36×36 with `aria-label="Send message"`.
- `src/app/components/landing/FAQSection.jsx` — `'use client'`. Imports `AnimatedSection` (47-02 wrapper), `Accordion / AccordionItem / AccordionTrigger / AccordionContent` from `@/components/ui/accordion` (47-01 install), and `FAQChatWidget` (Task 1). FAQS data array of 7 `{value, q, a}` objects. Renders `Accordion type="single" collapsible` mapping over FAQS. `bg-white py-20 md:py-28 px-6` section. `grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-12` two-column layout.
- `tests/unit/landing-sections.test.js` — `FAQSection` describe block: 4 it.todo replaced with 6 it() (export, accordion api, 7 questions, chat import, bg-white, non-defensive). New `FAQChatWidget` describe block appended at end with 6 it() (use client, /api/public-chat URL, slice(-10), error copy, 3 chips, aria-label). 3 it.todo entries in `Hero copy` (2) and `FinalCTA copy` (1) blocks left intact for 47-05.

## Decisions Made

- **FAQSection uses `'use client'` because shadcn Accordion is a Radix client primitive.** The AccordionPrimitive.Root/Item/Trigger components register event handlers internally and would error if rendered as Server Components ("Functions cannot be passed directly to Client Components"). The plan's `<read_first>` step explicitly noted "Check the accordion file — Radix Accordion requires `'use client'` in the consumer file." Confirmed by reading `src/components/ui/accordion.jsx` line 1: `"use client"`. Adopted.
- **JSX entity escapes (`&apos;`) for JSX text only; literal `'` inside JS string literals.** Same pattern 47-02 and 47-03 established. The FAQS array's `a` values that are plain strings (Q2, Q5, Q6, Q7) use literal `'` inside the JS string, which renders correctly as `'` in JSX. The two JSX-fragment answers (Q1 and Q3) use `&apos;` inside JSX text children. Both forms render typographically correct.
- **`.map()` over FAQS array instead of 7 explicit AccordionItem blocks.** The plan's verbatim Task 2 code used `.map()` — adopted as written. This is cleaner for 7 similar items and matches the project's shadcn idiom.
- **Test assertion adjusted for `.map()` rendering pattern (Rule 1 - test bug).** The plan's verbatim test expected `(s.match(/AccordionItem/g) || []).length >= 14` based on 7 explicit AccordionItem JSX blocks (= 14 tag occurrences). With `.map()`, the source has only 3 AccordionItem occurrences (1 import + 1 open + 1 close inside the loop). The original assertion was internally inconsistent with the plan's own implementation. Replaced with `(s.match(/value:\s*['"]q\d+['"]/g) || []).length === 7` — counts the FAQS array entries, which proves 7 distinct FAQ items are wired regardless of rendering pattern. The 7 D-06 substring matches that follow remain unchanged and are the actual content guarantee.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test Bug] AccordionItem count assertion was inconsistent with plan's own `.map()` implementation**

- **Found during:** Task 2 (running `npx jest -t "FAQSection"`)
- **Issue:** The plan's verbatim test asserted `(s.match(/AccordionItem/g) || []).length >= 14`, expecting 7 explicit `<AccordionItem>` JSX blocks (each contributing 2 tag occurrences). However, the plan's own action block uses `FAQS.map(...)` to render the 7 AccordionItems, which produces only 3 source-level occurrences of "AccordionItem" (1 import + 1 open + 1 close inside the loop body). The assertion would always fail with the plan's own code. This is an internal inconsistency in the plan — Rule 1 (test/code bug).
- **Fix:** Replaced the assertion with `(s.match(/value:\s*['"]q\d+['"]/g) || []).length === 7` — counts the `value: 'qN'` keys in the FAQS data array, which is a direct measurement of "7 FAQ entries are present in the source" without coupling to whether the renderer uses .map() or 7 explicit blocks. The 7 D-06 substring matches that follow (`Does Voco sound robotic`, etc.) remain unchanged and are the content guarantee.
- **Files modified:** `tests/unit/landing-sections.test.js` (one assertion line in the FAQSection describe block)
- **Verification:** All 6 FAQSection tests pass after the fix; full file shows 27 passed + 3 todo (Wave 2 contract intact).
- **Committed in:** `de6605e` (Task 2 commit, alongside the FAQSection.jsx file)

### Out-of-Scope Issues (Not Fixed)

**1. Pre-existing Jest worktree-ignore pattern blocks `npm test` from inside the worktree**

- **Issue:** `jest.config.js` has `testPathIgnorePatterns` including `'/.claude/worktrees/'`, which silently filters our worktree path. Documented in 47-01, 47-02, 47-03 deviations.
- **Workaround used:** Same as prior plans — invoked tests via `npx jest tests/unit/landing-sections.test.js --testPathIgnorePatterns="/node_modules/"`. Suite shows the expected 27 passed / 3 todo / 30 total counts.
- **Action:** Out of scope per SCOPE BOUNDARY rule. Not fixed.

**2. Initial worktree drift — files appeared deleted at start**

- **Issue:** When the executor first ran `git status`, the prior 47-01/02/03 outputs appeared as deleted (worktree had drifted from HEAD before this agent took over). Restored via `git checkout HEAD -- ...` to baseline matching the e1a07b9 commit.
- **Action:** Same baseline-restore pattern 47-02 already documented. Not a new issue.

**3. Initial Bash commands navigated to canonical project root instead of worktree (corrected mid-execution)**

- **Issue:** First few `cd /Users/leroyngzz/Projects/homeservice_agent && ...` Bash invocations + Write-tool absolute paths to the canonical project root inadvertently created files outside the worktree and made an erroneous commit (`c7b6ea3`) on the canonical repo's `main` branch.
- **Fix:** Soft-reset and unstaged the canonical-repo erroneous commit, restored the canonical repo to its prior state (no FAQ files, test file at baseline it.todo). Re-created both files via Write to the worktree absolute path. All subsequent Bash commands rely on the worktree being the working directory (per the env header) without explicit `cd` — confirmed with `pwd`.
- **Files modified:** None inside the worktree as a result of this issue. The canonical repo was left in its prior state (the agent did not commit any of its erroneous canonical-repo changes; it reverted them).
- **Action:** No further work needed; corrected before any final commit.

---

**Total deviations:** 1 auto-fixed (test assertion inconsistency with the plan's own .map() implementation) + 3 out-of-scope (pre-existing test harness behavior + worktree drift + initial path navigation that was self-corrected before any state propagated).
**Impact on plan:** Functional outcome unchanged. All acceptance criteria for both tasks pass. OBJ-01 + POLISH-11 + POLISH-12 materially satisfied at the component layer. Wave 2 sequential test-file contract honored: 5 (47-02) + 10 (47-03) + 12 (47-04) = 27 passing assertions, 3 todos for 47-05.

## Issues Encountered

- Initial path navigation issue (documented above as out-of-scope #3) — self-corrected before any final commit; no impact on plan deliverables.
- Worktree drift restore (same as 47-02) — clean restore via `git checkout HEAD -- ...`.

## User Setup Required

None — pure component creation. No env vars, dashboards, OAuth, or external service config needed. The `/api/public-chat` route is already configured; `GROQ_API_KEY` env var is the deployment-time prerequisite for the existing route (out of scope for this plan; the chat widget surfaces the friendly error copy if the env var is missing in production).

## Next Phase Readiness

- **Plan 47-05 (page.js wiring + Hero/FinalCTA copy):** Will import `FAQSection` from `./components/landing/FAQSection` and place it between the OwnerControlPullQuote (47-02) and the FinalCTASection in the landing flow. The FAQSection itself owns its full-width section background (`bg-white`), so no extra wrapper is needed at the page level. The 3 remaining it.todo entries in `tests/unit/landing-sections.test.js` (Hero copy: 2, FinalCTA copy: 1) are intact for 47-05 to populate when it touches HeroSection and FinalCTASection.
- **Chat widget operational requirement:** `/api/public-chat` requires `GROQ_API_KEY` env var at runtime (existing requirement, not introduced here). FAQChatWidget gracefully degrades — when the env var is missing, the route returns 503 and the widget shows the friendly error copy.
- **No blockers.**

## Self-Check: PASSED

All claimed artifacts verified to exist:

- `src/app/components/landing/FAQChatWidget.jsx` — FOUND (6 smoke tests pass; `'use client'`, `/api/public-chat`, `slice(-10)`, `Couldn't connect right now`, 3 chips, `aria-label="Send message"` all confirmed via grep)
- `src/app/components/landing/FAQSection.jsx` — FOUND (6 smoke tests pass; `export function FAQSection`, `@/components/ui/accordion`, `type="single"`, `collapsible`, `FAQChatWidget` import, `bg-white`, no defensive copy, no "HomeService AI" all confirmed via grep)
- `tests/unit/landing-sections.test.js` — FOUND (`27 passed, 3 todo, 30 total` — math: 5 (47-02) + 10 (47-03) + 12 (47-04) = 27 passed; 3 todos remain for 47-05's Hero/FinalCTA blocks)
- Commit `e4da1dc` (Task 1 FAQChatWidget) — FOUND in `git log`
- Commit `de6605e` (Task 2 FAQSection) — FOUND in `git log`
- All Task 1 acceptance criteria greps verified: `head -1` shows `'use client';`, `/api/public-chat` matches, `slice(-10)` matches, `Couldn't connect right now` matches, `aria-label="Send message"` matches, 3 chip strings match, no banned `.5` spacing utilities
- All Task 2 acceptance criteria verified: export, accordion import, type=single, collapsible, FAQChatWidget, bg-white all match; defensive-copy and brand-name regexes return no matches
- Wave 2 sequential contract honored: 5 (47-02) + 10 (47-03) untouched assertions still pass (verified by full-file run); 3 untouched todos belong to 47-05 (Hero: 2, FinalCTA: 1)

---

*Phase: 47-landing-objection-busting-repositioning-and-landing-polish*
*Completed: 2026-04-14*

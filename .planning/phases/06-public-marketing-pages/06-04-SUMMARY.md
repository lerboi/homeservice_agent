---
phase: 06-public-marketing-pages
plan: "04"
subsystem: public-marketing
tags: [gap-closure, accessibility, animation, css, pricing]
dependency_graph:
  requires: []
  provides: [accordion-animation, single-main-landmark]
  affects: [src/app/(public)/pricing/page.js, src/app/globals.css]
tech_stack:
  added: []
  patterns: [tailwind-v4-animate-theme, radix-accordion-css-variable]
key_files:
  created: []
  modified:
    - src/app/globals.css
    - src/app/(public)/pricing/page.js
decisions:
  - "Accordion animation registered via --animate-* convention in @theme inline block — Tailwind v4 pattern that auto-generates animate-accordion-down utility class"
  - "height: var(--radix-accordion-content-height) used for smooth height transition — Radix Accordion sets this CSS variable automatically on the content element"
metrics:
  duration: "8 minutes"
  completed: "2026-03-22"
  tasks_completed: 2
  files_modified: 2
---

# Phase 6 Plan 04: Gap Closure — Accordion Animation and Nested Main Summary

One-liner: Tailwind v4 accordion keyframes + Radix CSS variable height animation added to globals.css; nested `<main>` removed from pricing page replacing it with a React fragment.

## What Was Built

Two targeted fixes closing the two verification gaps found after Phase 6 execution:

1. **Accordion animation keyframes** — Added `--animate-accordion-down` and `--animate-accordion-up` to the `@theme inline` block in `globals.css`, plus the corresponding `@keyframes` definitions using `var(--radix-accordion-content-height)` for smooth height transitions. FAQSection.jsx already had the correct class names and required no changes.

2. **Nested main element removal** — Replaced `<main>` / `</main>` in `src/app/(public)/pricing/page.js` with React fragment `<>` / `</>`. The public layout already wraps page children in `<main>`, so pricing page was producing a double `<main>` landmark — an accessibility violation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add accordion animation keyframes to globals.css | 7ebe35f | src/app/globals.css |
| 2 | Remove nested main element from pricing page | e96e86e | src/app/(public)/pricing/page.js |

## Verification Results

- `grep -c "@keyframes accordion" src/app/globals.css` → **2** (pass)
- `grep -c "<main>" src/app/(public)/pricing/page.js` → **0** (pass)
- `npm run build` → **pass** (all routes compiled, no errors)

## Decisions Made

- Accordion animation registered via `--animate-*` convention in `@theme inline` block — this is the Tailwind v4 pattern that auto-generates the `animate-accordion-down` Tailwind utility class used by FAQSection.
- `height: var(--radix-accordion-content-height)` used for smooth height transition — Radix Accordion sets this CSS variable automatically on the content element at runtime; no JavaScript measurement needed.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `src/app/globals.css` contains `@keyframes accordion-down` and `@keyframes accordion-up`
- [x] `src/app/(public)/pricing/page.js` contains no `<main>` tags
- [x] Commit 7ebe35f exists (Task 1)
- [x] Commit e96e86e exists (Task 2)
- [x] Build passes

## Self-Check: PASSED

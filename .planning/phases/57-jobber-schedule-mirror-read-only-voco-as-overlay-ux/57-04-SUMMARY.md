---
phase: 57
plan: 04
status: complete
date: 2026-04-19
---

# 57-04 — Cron + Picker + Resync

## What Built

- `src/app/api/cron/poll-jobber-visits/route.js` (new) — CRON_SECRET-gated GET, iterates `provider='jobber'` accounting_credentials, delta-fetches via `fetchJobberVisits` with `updatedAfter` cursor, dispatches each visit through `applyJobberVisit`. Cursor is the dedicated `jobber_last_schedule_poll_at` column (NOT `last_context_fetch_at` — B2 fix). Cursor advances ONLY after every visit in the page-loop has landed (Pitfall 4 ordering). Per-tenant try/catch isolates failures.
- `src/app/api/integrations/jobber/bookable-users/route.js` (new) — GET returns `{users, selected}`, PATCH validates `userIds: string[]` (array, all strings, max 200), persists selection, then SYNCHRONOUSLY runs `rebuildJobberMirror` before responding (D-04 nuke-and-repave).
- `src/app/api/integrations/jobber/resync/route.js` (new) — POST endpoint for manual "force resync" affordance; same diff-sync semantics.
- `src/app/dashboard/integrations/jobber/setup/page.js` (new) — server component for the post-OAuth picker step. Solo-auto-skip (D-02): if `users.length === 1`, writes the single user, runs `rebuildJobberMirror` inline, redirects to `/dashboard/more/integrations?jobber=connected`. Otherwise renders the picker.
- `src/components/dashboard/BookableUsersPicker.jsx` (new) — fieldset+legend (UI-SPEC §6 accessibility), checkbox list with avatar initials + Active emerald badge for `hasRecentActivity`, save button PATCHes `/api/integrations/jobber/bookable-users`. All UI-SPEC §5 locked copy verbatim.
- `src/components/dashboard/BookableUsersPicker.helpers.js` (new) — extracted pure `computeDefaultSelected` so it's unit-testable without a JSX parser.
- `tests/api/cron/poll-jobber-visits.test.js` — 7 cases (auth, zero-tenant, two-visit upsert, COMPLETED delete, Pitfall-4 cursor ordering + B2 column guard, per-tenant error isolation).
- `tests/api/integrations/jobber-bookable-users.test.js` — 9 cases (GET 401/404/200 shapes, PATCH validation, synchronous rebuild via setTimeout-delayed mock, resync 401 + invocation).
- `tests/components/BookableUsersPicker.test.js` — 21 cases (5 pure-function heuristic + 11 static-grep UI-SPEC copy/accessibility + 5 setup-page solo-skip assertions).

## Key Files

- created: 6 source files + 3 test files

## Tests

- 7/7 cron tests pass
- 9/9 bookable-users + resync tests pass
- 21/21 picker + setup-page tests pass
- Total **37/37** pass for plan 57-04. No regressions in prior suites.

## Deviations

- **`getTenantId` import path.** Plan referenced `@/lib/auth`; actual project helper is `@/lib/get-tenant-id` (`getTenantId()` in `src/lib/get-tenant-id.js`). All three new routes use the real path.
- **Test file extensions.** Plan called for `.test.ts`/`.test.tsx`; project's jest `testMatch` is `**/tests/**/*.test.js` and JSX babel preset is not configured. Wrote `.test.js`. JSX-rendering tests (RTL) are not viable here — same constraint that blocks `notifyXeroRefreshFailure.test.js` from importing `JobberReconnectEmail.jsx` (pre-existing).
- **No React Testing Library.** Project precedent is `BusinessIntegrationsClient.static.test.js` (pure static-grep). Followed that pattern: extracted `computeDefaultSelected` to a `.js` helper file for real unit tests, then static-grep'd the `.jsx` source for every UI-SPEC §5 locked copy string + structural accessibility (fieldset/legend) + PATCH wiring. Visual UAT belongs to Plan 57-05's human-checkpoint.
- **Setup page imports `rebuildJobberMirror` at top of file.** Plan suggested dynamic `await import(...)` inside the solo branch. With Next.js 16 + Turbopack the static import is simpler and still tree-shakable; route is server-only.

## Self-Check: PASSED

- [x] Cron CRON_SECRET-gated, delta-poll pattern, B2 column (`jobber_last_schedule_poll_at`) read+written, `last_context_fetch_at` NEVER touched on cron path
- [x] PATCH validates array + per-element string + max-200, runs synchronous `rebuildJobberMirror` before responding
- [x] POST `/resync` works for caller's tenant
- [x] Setup page solo-auto-skip (`users.length === 1` branch) writes single user + rebuilds + redirects
- [x] BookableUsersPicker: all UI-SPEC §5 locked copy verbatim, fieldset+legend, Active badge brand emerald
- [x] Pre-select heuristic: active users when any present, ALL users if none active (D-03 fallback)
- [x] All 37 tests pass
- [x] No `console.log(cred)` / token leak — only `{scope, tenant_id, status}` structured log on cron error path

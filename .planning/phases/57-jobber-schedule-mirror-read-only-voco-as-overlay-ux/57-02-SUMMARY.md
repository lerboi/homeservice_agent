---
phase: 57
plan: 02
status: complete
date: 2026-04-19
---

# 57-02 — Jobber Schedule Mirror Lib Layer

## What Built

- `src/lib/scheduling/jobber-schedule-mirror.js` (new) — pure mapper `jobberVisitToCalendarEvent` (status filter, bookable-set intersect with unassigned-pass D-05, "Jobber: <client> — <assignee>" title), upsert/delete dispatcher `applyJobberVisit` (uses `onConflict: 'tenant_id,provider,external_id'`), and nuke-and-repave `rebuildJobberMirror` for the bookable-users PATCH and resync paths. No Next.js imports — pure lib.
- `src/lib/integrations/jobber.js` (extended) — appended `fetchJobberVisits`, `fetchJobberVisitById`, `fetchJobberUsersWithRecentActivity`, plus internal `getJobberGraphqlClient` helper. Four GraphQL query strings (`VISITS_DELTA_QUERY`, `USERS_QUERY`, `RECENT_VISITS_FOR_ACTIVITY_QUERY`, `VISIT_BY_ID_QUERY`). All P56 exports (`fetchJobberCustomerByPhone`, `JobberAdapter`) preserved.
- `tests/integrations/jobber/visit-mapper.test.js` — 14 cases covering all mapper + dispatcher behaviors enumerated in plan.
- `tests/lib/slot-calculator-jobber.test.js` — 4 cases proving JOBSCHED-02 contract (slot occluded by jobber row, google parity, no provider filter in route).

## Key Files

- created: `src/lib/scheduling/jobber-schedule-mirror.js`, `tests/integrations/jobber/visit-mapper.test.js`, `tests/lib/slot-calculator-jobber.test.js`
- modified: `src/lib/integrations/jobber.js`

## Tests

- 14/14 mapper + dispatcher tests pass
- 4/4 slot-calculator + route-inspection tests pass
- Full `tests/integrations/` regression: 51/51 pass — no fallout in P56 jobber adapter / cache / fetch / phone-match / refresh suites.

## Deviations

- **Test runner.** Plan called for `vitest` `.test.ts` files. Project's jest config (`testMatch: '**/tests/**/*.test.js'`) silently ignores `.ts` files, so wrote `.test.js` with `@jest/globals` imports. Same paths/coverage; the plan's grep verifications would have falsely passed on a `.ts` file that never ran.
- **No `getJobberClient` factory was pre-existing.** Plan assumed one; actual P56 code instantiates `new GraphQLClient` inline inside `fetchJobberCustomerByPhone`. Created a private `getJobberGraphqlClient(admin, cred)` helper to dedupe auth setup across the three new fetchers — kept private (not exported) to avoid leaking the construction pattern outside the module.
- **JSDoc fix.** First version of mirror.js comment contained `*/` inside a JSDoc block (literal "VISIT_*/ASSIGNMENT_*/JOB_UPDATE"), which broke babel parsing. Rewrote as `VISIT_x, ASSIGNMENT_x, JOB_UPDATE branch`.

## Self-Check: PASSED

- [x] All three new exports from mirror.js present
- [x] All three new exports + four query strings from jobber.js present
- [x] No P56 jobber.js export removed/renamed
- [x] Mapper tests cover all 14 plan-listed behaviors
- [x] Slot test confirms provider-agnostic externalBlocks contract
- [x] All prior jobber tests still green (51/51)
- [x] `onConflict: 'tenant_id,provider,external_id'` present in mirror.js
- [x] `next/*` not imported by mirror.js (pure lib)

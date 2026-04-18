---
phase: 57
plan: 03
status: complete
date: 2026-04-19
---

# 57-03 — Jobber Webhook → Mirror Branch

## What Built

- `src/app/api/webhooks/jobber/route.js` — added `JOBBER_VISIT_TOPICS` constant (`VISIT_CREATE/UPDATE/DESTROY/COMPLETE`, `ASSIGNMENT_CREATE/UPDATE/DESTROY`), imported `applyJobberVisit` and `fetchJobberVisitById`, added a sibling mirror branch that runs AFTER the existing P56 `revalidateTag` flow (does NOT replace or merge with it). Direct deletes for `VISIT_DESTROY`/`VISIT_COMPLETE`; re-fetch + dispatch through `applyJobberVisit` for the other five topics. Structured-only error log (no token/cred exposure); silent-200 on every error (Jobber retries idempotent against the calendar_events UNIQUE constraint).
- `tests/api/webhooks/jobber-visits.test.js` — 9 cases: VISIT_CREATE upsert, VISIT_UPDATE refresh, VISIT_DESTROY direct delete, VISIT_UPDATE mapper-null delete (COMPLETED), ASSIGNMENT_CREATE re-fetch + bookable filter, invalid HMAC 401, unknown account silent-200, CLIENT_UPDATE P56 regression check, bookable-set exclusion delete.

## Key Files

- modified: `src/app/api/webhooks/jobber/route.js`
- created: `tests/api/webhooks/jobber-visits.test.js`

## Tests

- 9/9 new mirror-branch tests pass
- 11/11 prior P56 webhook tests still pass (no customer-context regression)

## Deviations

- **JOB_UPDATE → mirror reconciliation not implemented.** Plan's `<truths>` and `<objective>` mention "JOB_UPDATE webhook ... AND additionally reconciles visits", but plan's actual Step 4 code does NOT include `JOB_UPDATE` in `JOBBER_VISIT_TOPICS` and no test covers the reconciliation. JOB_UPDATE itemId is a job id (not a visit id) so calling `fetchJobberVisitById` on it would return null. Implementing job-level visit re-fetch would require a new GraphQL query (`job(id) { visits { nodes { ... } } }`) — out of scope for this plan as specified. The 15-min poll cron (Plan 57-04) reconciles the gap. Future plan can add explicit JOB_UPDATE → bulk-visit-resync if measured drift is unacceptable.
- **`getJobberClient` import removed from plan code.** Plan Step 3 imports `getJobberClient` alongside `fetchJobberVisitById`, but `src/lib/integrations/jobber.js` does not export `getJobberClient` (the helper is private — `getJobberGraphqlClient`, internal to that module). The mirror branch only needs `fetchJobberVisitById`, so dropped the unused import.

## Self-Check: PASSED

- [x] `JOBBER_VISIT_TOPICS` Set defined at file top with all 7 documented topics
- [x] Imports `applyJobberVisit` and `fetchJobberVisitById`
- [x] Mirror branch placed AFTER existing CLIENT_/JOB_/INVOICE_ routing (line 168 onward)
- [x] HMAC `timingSafeEqual` verification unchanged
- [x] `revalidateTag` pipeline unchanged
- [x] All 9 new tests pass
- [x] 11/11 P56 webhook tests still green
- [x] No `console.log(cred)` / token leak — only `{scope, tenant_id, topic, status}` structured log

---
phase: 57
slug: jobber-schedule-mirror-read-only-voco-as-overlay-ux
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 57 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (to be confirmed — Wave 0 audits) |
| **Config file** | vitest.config.ts (or Wave 0 scaffolds) |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run && npm run lint && npm run typecheck` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run <changed file glob>`
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

*Populated by gsd-planner during plan generation. Each task derives a row from its `<acceptance_criteria>` and `<automated>` blocks.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 57-01-01 | 01 | 1 | JOBSCHED-02 | — | calendar_events CHECK admits 'jobber' provider | unit (sql) | `npm run test -- --run tests/db/migration-055.test.ts` | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `tests/db/migration-055.test.ts` — asserts CHECK widen, `accounting_credentials.jobber_bookable_user_ids TEXT[]` column, `appointments.jobber_visit_id TEXT` + partial unique index
- [ ] `tests/integrations/jobber/visit-mapper.test.ts` — `jobberVisitToCalendarEvent` mapper stubs (JOBSCHED-01)
- [ ] `tests/api/webhooks/jobber-visits.test.ts` — HMAC + visit/job/assignment topic routing stubs (JOBSCHED-03)
- [ ] `tests/api/cron/poll-jobber-visits.test.ts` — differential poll stubs (JOBSCHED-04)
- [ ] `tests/ui/calendar-overlay.test.tsx` — ExternalEventBlock muted + "From Jobber" pill + click-through (JOBSCHED-05, JOBSCHED-06)
- [ ] `tests/ui/copy-to-jobber.test.tsx` — paste-block shape + deep-link builder (JOBSCHED-07)
- [ ] `tests/conftest`/shared fixtures — mock Jobber GraphQL client, HMAC signer, tenant factory with Jobber creds

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GraphiQL verification of Visit/User/Assignment query shapes | JOBSCHED-01 | Jobber GraphQL schema field names not publicly enumerable; validated once per Plan 02 | Paste finalized query into Jobber developer center GraphiQL; confirm 200 + non-null fields |
| `WebHookTopicEnum` value locking | JOBSCHED-03 | Enum values require live app-settings check | Introspect `__type(name: "WebHookTopicEnum")` in GraphiQL; record in Plan 03 |
| Bookable-users picker end-to-end (connect → pre-select → save → re-sync) | JOBSCHED-04 | Requires real Jobber sandbox tenant | UAT script in Plan 04 |
| Copy-to-clipboard paste fidelity across Jobber web app | JOBSCHED-07 | Jobber new-visit form parses clipboard heuristically | Manual paste test recorded in Plan 05 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

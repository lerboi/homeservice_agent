---
phase: 57
slug: jobber-schedule-mirror-read-only-voco-as-overlay-ux
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-19
revised: 2026-04-19
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

One row per task in Plans 01–05. Each task's `<automated>` command is cited verbatim from the plan. Manual-only checkpoints are cross-referenced to Wave 0 test files that exercise the same requirement automatically.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 57-01-01 | 01 | 1 | JOBSCHED-01, JOBSCHED-04, JOBSCHED-07 | T-57-01-01, T-57-01-03 | Migration 055 DDL idempotent + adds jobber provider / bookable_user_ids / jobber_last_schedule_poll_at / jobber_visit_id + partial unique idx | unit (sql grep) | `grep -q "'jobber'" && grep -q "jobber_bookable_user_ids" && grep -q "jobber_last_schedule_poll_at" && grep -q "idx_appointments_jobber_visit_id_unique" supabase/migrations/055_jobber_schedule_mirror.sql` | ❌ W0 | ⬜ pending |
| 57-01-02 | 01 | 1 | JOBSCHED-01..07 | T-57-01-01 | Migration applied to live Supabase; 5 SQL verifications pass | manual (checkpoint:human-action) | MANUAL — covered by `tests/db/migration-055.test.ts` (57-01-03) which asserts the three DDL surfaces against live Supabase | ❌ W0 | ⬜ pending |
| 57-01-03 | 01 | 1 | JOBSCHED-03, JOBSCHED-04, JOBSCHED-07 | T-57-01-02 | vercel.json registers poll-jobber-visits at */15; migration test asserts all four columns | unit (db) | `npm run test -- --run tests/db/migration-055.test.ts` | ❌ W0 | ⬜ pending |
| 57-02-01 | 02 | 2 | JOBSCHED-01, JOBSCHED-04 | T-57-02-01, T-57-02-03 | Pure mapper `jobberVisitToCalendarEvent` + bookable-set filter (14 behaviors) | unit | `npm run test -- --run tests/integrations/jobber/visit-mapper.test.ts` | ❌ W0 | ⬜ pending |
| 57-02-02 | 02 | 2 | JOBSCHED-01, JOBSCHED-02 | T-57-02-02, T-57-02-04 | GraphQL fetchers added; provider='jobber' row occludes returned slots | integration | `npm run test -- --run tests/lib/slot-calculator-jobber.test.ts` | ❌ W0 | ⬜ pending |
| 57-03-01 | 03 | 3 | JOBSCHED-01 | T-57-03-01, T-57-03-02, T-57-03-03 | Webhook VISIT_* / ASSIGNMENT_* / VISIT_DESTROY routed through mirror branch; HMAC preserved; silent 200 on unknown accountId | integration | `npm run test -- --run tests/api/webhooks/jobber-visits.test.ts` | ❌ W0 | ⬜ pending |
| 57-04-01 | 04 | 3 | JOBSCHED-03 | T-57-04-01, T-57-04-04 | CRON_SECRET-gated poll endpoint; delta via jobber_last_schedule_poll_at ONLY (NOT last_context_fetch_at); per-tenant try/catch | integration | `npm run test -- --run tests/api/cron/poll-jobber-visits.test.ts` | ❌ W0 | ⬜ pending |
| 57-04-02 | 04 | 3 | JOBSCHED-04 | T-57-04-02, T-57-04-03, T-57-04-05 | GET/PATCH /bookable-users + POST /resync; synchronous rebuild; array validation | integration | `npm run test -- --run tests/api/integrations/jobber-bookable-users.test.ts` | ❌ W0 | ⬜ pending |
| 57-04-03 | 04 | 3 | JOBSCHED-04 | T-57-04-06 | BookableUsersPicker with pre-select heuristic + solo auto-skip server-side (W3: inline rebuildJobberMirror only) | component | `npm run test -- --run tests/components/BookableUsersPicker.test.tsx` | ❌ W0 | ⬜ pending |
| 57-05-01 | 05 | 4 | JOBSCHED-05, JOBSCHED-07 | T-57-05-04, T-57-05-05 | ExternalEventBlock muted-slate retrofit (Google/Outlook/Jobber pills); AppointmentBlock 'Not in Jobber' pill when jobberConnected && jobber_visit_id IS NULL; connection-status endpoint | ui | `npm run test -- --run tests/ui/calendar-overlay.test.tsx` | ❌ W0 | ⬜ pending |
| 57-05-02 | 05 | 4 | JOBSCHED-06 | T-57-05-01, T-57-05-03 | CopyToJobberSection paste block + clipboard toast; JobberCopyBanner dismissible via localStorage; AppointmentFlyout 'Not in Jobber yet' pill | ui | `npm run test -- --run tests/ui/copy-to-jobber.test.tsx tests/components/JobberCopyBanner.test.tsx` | ❌ W0 | ⬜ pending |
| 57-05-03 | 05 | 4 | JOBSCHED-06 | T-57-05-02, T-57-05-06, T-57-05-07 | BookingCopyToJobberEmail template + notifyBookingCopyToJobber (gates on Jobber connected AND jobber_visit_id IS NULL); post-booking hook; integrations-card picker section | integration | `npm run test -- --run tests/notifications/booking-copy-to-jobber.test.ts` | ❌ W0 | ⬜ pending |
| 57-05-04 | 05 | 4 | JOBSCHED-05, JOBSCHED-06, JOBSCHED-07 | — | 13-step end-to-end overlay UX validation (dark mode, mobile 375px, webhook live test, post-booking email) | manual (checkpoint:human-verify) | MANUAL — covered by `tests/ui/calendar-overlay.test.tsx` + `tests/ui/copy-to-jobber.test.tsx` + `tests/components/JobberCopyBanner.test.tsx` + `tests/notifications/booking-copy-to-jobber.test.ts` (57-05-01..03); human-verify catches dark-mode / responsive / live-webhook interactions the unit tests cannot | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `tests/db/migration-055.test.ts` — asserts CHECK widen, `accounting_credentials.jobber_bookable_user_ids TEXT[]`, `accounting_credentials.jobber_last_schedule_poll_at TIMESTAMPTZ` (B2), `appointments.jobber_visit_id TEXT` + partial unique index
- [ ] `tests/integrations/jobber/visit-mapper.test.ts` — `jobberVisitToCalendarEvent` mapper (14 behaviors) + `applyJobberVisit` upsert/delete branches (JOBSCHED-01)
- [ ] `tests/lib/slot-calculator-jobber.test.ts` — provider-agnostic slot-query integration test (JOBSCHED-02)
- [ ] `tests/api/webhooks/jobber-visits.test.ts` — HMAC + visit/job/assignment topic routing (JOBSCHED-01)
- [ ] `tests/api/cron/poll-jobber-visits.test.ts` — differential poll using `jobber_last_schedule_poll_at`; anti-assertion that `last_context_fetch_at` is NOT written (B2) (JOBSCHED-03)
- [ ] `tests/api/integrations/jobber-bookable-users.test.ts` — GET/PATCH + synchronous rebuildJobberMirror (JOBSCHED-04)
- [ ] `tests/components/BookableUsersPicker.test.tsx` — pre-select heuristic + empty state (JOBSCHED-04)
- [ ] `tests/ui/calendar-overlay.test.tsx` — ExternalEventBlock muted + provider pills + 'Not in Jobber' conditional (JOBSCHED-05, JOBSCHED-07)
- [ ] `tests/ui/copy-to-jobber.test.tsx` — paste-block shape + clipboard toasts (JOBSCHED-06)
- [ ] `tests/components/JobberCopyBanner.test.tsx` — dismissible banner + localStorage persistence (JOBSCHED-06)
- [ ] `tests/notifications/booking-copy-to-jobber.test.ts` — email gate on jobber_visit_id IS NULL (JOBSCHED-06)
- [ ] `tests/conftest`/shared fixtures — mock Jobber GraphQL client, HMAC signer, tenant factory with Jobber creds

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Wave 0 Cross-Reference |
|----------|-------------|------------|------------------------|
| GraphiQL verification of Visit/User/Assignment query shapes | JOBSCHED-01 | Jobber GraphQL schema field names not publicly enumerable; validated once per Plan 02 | `tests/integrations/jobber/visit-mapper.test.ts` exercises the mapped shape against fixture payloads matching the verified query |
| `WebHookTopicEnum` value locking | JOBSCHED-01 | Enum values require live app-settings check | `tests/api/webhooks/jobber-visits.test.ts` fixtures use the locked enum values; any drift surfaces in the unit layer first |
| Migration 055 applied to live Supabase (57-01-02) | JOBSCHED-01..07 | `supabase db push` mutates production schema — gated | `tests/db/migration-055.test.ts` asserts the three DDL surfaces against live Supabase immediately after push |
| Bookable-users picker end-to-end (connect → pre-select → save → re-sync) | JOBSCHED-04 | Requires real Jobber sandbox tenant | `tests/api/integrations/jobber-bookable-users.test.ts` + `tests/components/BookableUsersPicker.test.tsx` exercise the API + UI logic automatically; human-verify (57-05-04 Step 1) confirms the live OAuth → redirect → save flow |
| Copy-to-clipboard paste fidelity across Jobber web app | JOBSCHED-06 | Jobber new-visit form parses clipboard heuristically | `tests/ui/copy-to-jobber.test.tsx` asserts paste-block byte-shape; live paste verified in 57-05-04 Step 8 |
| Full overlay UX (57-05-04 — dark mode, 375px, live webhook, post-booking email) | JOBSCHED-05, JOBSCHED-06, JOBSCHED-07 | Visual + live-integration checks | `tests/ui/calendar-overlay.test.tsx`, `tests/ui/copy-to-jobber.test.tsx`, `tests/components/JobberCopyBanner.test.tsx`, `tests/notifications/booking-copy-to-jobber.test.ts` cover the testable subset |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (Wave 0 scaffold execution — executor responsibility)

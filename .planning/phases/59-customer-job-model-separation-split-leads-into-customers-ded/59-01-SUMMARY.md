---
phase: 59-customer-job-model-separation
plan: "01"
subsystem: phone-normalization, test-scaffolds, db-audit
tags: [phase-59, wave-0, phone, e164, test-scaffolds, libphonenumber-js]
dependency_graph:
  requires: []
  provides:
    - src/lib/phone/normalize.js (normalizeE164/isValidE164/formatInternational)
    - supabase/migrations/053_pre_audit.sql (read-only audit before 053a)
    - tests/phone/fixtures/python_parity.json (Python parity sample set)
    - tests/db/test_jobs_constraints.sql (D-06 scaffold)
    - tests/db/test_record_call_outcome.py (D-05/D-10/D-14 scaffold)
    - tests/db/test_merge_customer.py (D-19 scaffold)
    - tests/migrations/test_053_backfill.py (D-05/D-11/D-12/D-13 scaffold)
    - tests/api/customers.test.js (D-05/D-18/D-19 scaffold)
    - tests/api/jobs-list.test.js (D-06 scaffold)
    - tests/api/inquiries-list.test.js (D-10 scaffold)
    - tests/realtime/jobs.test.js (D-15 scaffold)
  affects: []
tech_stack:
  added: []
  patterns:
    - "isPossiblePhoneNumber (not isValid) to match Python phonenumbers.is_possible_number()"
    - "it.skip / pytest.skip red-state scaffolds for Nyquist compliance"
key_files:
  created:
    - src/lib/phone/normalize.js
    - src/lib/phone/normalize.test.js
    - supabase/migrations/053_pre_audit.sql
    - tests/phone/cross_validation.test.js
    - tests/phone/fixtures/python_parity.json
    - tests/db/test_jobs_constraints.sql
    - tests/db/test_record_call_outcome.py
    - tests/db/test_merge_customer.py
    - tests/migrations/test_053_backfill.py
    - tests/api/customers.test.js
    - tests/api/jobs-list.test.js
    - tests/api/inquiries-list.test.js
    - tests/realtime/jobs.test.js
  modified: []
decisions:
  - "Use isPossiblePhoneNumber (not isValid) to match Python phonenumbers.is_possible_number() — allows 555-range US synthetic test numbers"
  - "Leading-zero SG (06591234567) throws phone_invalid — parsePhoneNumber produces incorrect +6506591234567 (double country code); matches Python None return"
  - "libphonenumber-js already installed at ^1.12.41 — no additional npm install needed"
  - "Test fixtures use synthetic +15555550100 / +14165550123 ranges (US/CA reserved) — no real caller PII per T-59-01-03"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-21T06:03:29Z"
  tasks_completed: 3
  files_created: 13
  files_modified: 0
---

# Phase 59 Plan 01: Wave 0 Scaffolding — Phone Normalizer + Pre-audit SQL + Test Scaffolds Summary

E.164 normalizer matching Python phonenumbers library behavior installed; pre-migration audit SQL and all Wave 1-3 red-state test scaffolds committed so downstream plans reference real file paths.

## What Was Built

### Task 1: E.164 Phone Normalizer (TDD)

`src/lib/phone/normalize.js` exports three functions:
- `normalizeE164(raw, countryHint?)` — parses any phone string to E.164, throws `phone_required` or `phone_invalid`
- `isValidE164(s)` — regex check only (`/^\+[1-9]\d{6,14}$/`)
- `formatInternational(e164)` — human-readable international format

Uses `isPossiblePhoneNumber` (not `isValid`) to match Python's `phonenumbers.is_possible_number()` — this accepts syntactically-valid 555-range US numbers used in tests.

Python parity cross-validation: `tests/phone/cross_validation.test.js` loads 8 rows from `tests/phone/fixtures/python_parity.json` (all synthetic numbers) and asserts identical output. 22 tests passing.

### Task 2: Pre-migration Audit SQL

`supabase/migrations/053_pre_audit.sql` is a read-only SELECT file (NOT a supabase migration) that the operator runs via psql before Plan 02's 053a DDL. Contains:
- `non_e164_phones` count + offender sample (Pitfall 2)
- `invoices_for_unbooked_leads` count (Pitfall 1)
- `invoices_without_lead` count
- `expected_customers`, `expected_jobs`, `expected_inquiries` projections

### Task 3: Wave 1-3 Red-State Test Scaffolds

8 test files created as intentional red/skipped scaffolds:

| File | Plan | Decision IDs |
|------|------|-------------|
| tests/db/test_jobs_constraints.sql | 02 | D-06 |
| tests/db/test_record_call_outcome.py | 03 | D-05, D-10, D-14 |
| tests/db/test_merge_customer.py | 03 | D-19 |
| tests/migrations/test_053_backfill.py | 02 | D-05, D-11, D-12, D-13 |
| tests/api/customers.test.js | 04 | D-05, D-18, D-19 |
| tests/api/jobs-list.test.js | 04 | D-06 |
| tests/api/inquiries-list.test.js | 04 | D-10 |
| tests/realtime/jobs.test.js | 06 | D-15 |

All JS scaffolds run with `npx vitest run` and report 10 skipped (exit 0).

## Deviations from Plan

### Auto-resolved Issues

**1. [Rule 1 - Bug] libphonenumber-js isValid() vs isPossiblePhoneNumber() mismatch**
- **Found during:** Task 1 GREEN phase
- **Issue:** `parsePhoneNumber('+15551234567').isValid()` returns `false` because 555-XXXX is a reserved/fictional US range. This caused 3 of 14 tests to fail.
- **Fix:** Switched to `isPossiblePhoneNumber(raw, countryHint)` which matches Python's `is_possible_number()` semantics — syntactically-correct numbers are accepted regardless of real-world validity.
- **Files modified:** `src/lib/phone/normalize.js`
- **Commit:** 86ebe60

**2. [Rule 2 - Deviation: no npm install needed] libphonenumber-js already in package.json**
- **Found during:** Task 1 pre-check
- **Issue:** Plan Action step 1 said "Run `npm install libphonenumber-js`". Already present at `^1.12.41` (added in Phase 56 Plan 03 for Jobber webhook phone normalization).
- **Fix:** Skipped install step, noted in decisions.
- **No files modified**

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The audit SQL file is operator-local psql only. Fixture file uses synthetic numbers only (T-59-01-03 mitigated).

## Known Stubs

None — Wave 0 is scaffolding only. All Wave 1-3 test files are intentionally skipped with `Plan 0N:` references marking when they activate.

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| 4044454 | test | RED state: normalize.test.js scaffold |
| 86ebe60 | feat | GREEN: normalize.js + cross_validation + fixture |
| 6fcd8e1 | chore | 053_pre_audit.sql |
| 0326777 | test | Wave 1-3 red-state scaffolds (8 files) |

## Self-Check: PASSED

Files verified:
- FOUND: src/lib/phone/normalize.js
- FOUND: src/lib/phone/normalize.test.js
- FOUND: supabase/migrations/053_pre_audit.sql
- FOUND: tests/phone/cross_validation.test.js
- FOUND: tests/phone/fixtures/python_parity.json
- FOUND: tests/db/test_jobs_constraints.sql
- FOUND: tests/db/test_record_call_outcome.py
- FOUND: tests/db/test_merge_customer.py
- FOUND: tests/migrations/test_053_backfill.py
- FOUND: tests/api/customers.test.js
- FOUND: tests/api/jobs-list.test.js
- FOUND: tests/api/inquiries-list.test.js
- FOUND: tests/realtime/jobs.test.js

Commits verified: 4044454, 86ebe60, 6fcd8e1, 0326777 all present in git log.

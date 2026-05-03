---
phase: 61
plan: 01
subsystem: db-schema
tags: [migration, supabase, address-validation, gmaps, rpc-overload]
dependency_graph:
  requires:
    - "supabase/migrations/059_customers_jobs_inquiries.sql (inquiries table shape)"
    - "supabase/migrations/060_phase59_rpcs.sql (record_call_outcome 8-arg signature)"
    - "supabase/migrations/026_address_fields.sql (book_appointment_atomic 11-arg signature)"
    - "supabase/migrations/001_initial_schema.sql (calls.id uuid type)"
  provides:
    - "appointments + inquiries: 6 nullable validated-address columns + verdict CHECK"
    - "gmaps_validate_events sibling table with tenant-scoped RLS"
    - "book_appointment_atomic 17-arg overload (additive, backward-compat)"
    - "record_call_outcome 14-arg overload (additive, backward-compat)"
    - "Plans 02 and 03 unblocked once migration is pushed to remote"
  affects:
    - "livekit-agent: capture_lead and book_appointment tools (Plans 02/03 will write new cols)"
    - "Next.js dashboard read-side: existing reads unchanged (new cols nullable)"
tech_stack:
  added: []
  patterns:
    - "drop-loop pg_proc overload eviction (mirrored from migration 026)"
    - "REVOKE PUBLIC + GRANT service_role on new RPC arity (mirrored from 027)"
    - "tenant-scoped RLS sibling table (mirrored from usage_events / customer_merge_audit)"
key_files:
  created:
    - "supabase/migrations/062_phase61_address_validation.sql"
  modified: []
decisions:
  - "Plan <interfaces> claimed record_call_outcome was 5-arg; ground truth from 060 is 8-arg. Used the actual current signature; final overloaded arity is 14, not 12."
  - "Plan claimed gmaps_validate_events.call_id should be text; calls.id is actually uuid (per 001_initial_schema.sql). Fixed call_id to uuid with FK to calls(id) ON DELETE SET NULL."
  - "Added explicit service_role policy on gmaps_validate_events for parity with migration 059's 'service_role_all_*' pattern (defensive — service-role already bypasses RLS, but the explicit policy mirrors how the rest of Phase 59 tables document the trust boundary)."
metrics:
  duration: "~10 minutes"
  completed_date: "2026-05-03"
---

# Phase 61 Plan 01: Migration 062 — Phase 61 Address Validation Schema Summary

Ships migration 062: 6 validated-address columns on appointments + inquiries, gmaps_validate_events sibling telemetry table, and backward-compatible RPC overloads (book_appointment_atomic 17-arg, record_call_outcome 14-arg) — establishing the persistent storage and RPC contracts that Plans 02/03 will write to.

## What Was Built

### Task 1: Migration file 062_phase61_address_validation.sql ✅ COMPLETE

Single 335-line migration containing 7 sections wrapped in BEGIN/COMMIT:

1. **Section 1 — appointments columns (D-F1'):** ADD COLUMN formatted_address text, place_id text, latitude numeric(10,7), longitude numeric(10,7), address_components jsonb, address_validation_verdict text. CHECK constraint `appointments_address_validation_verdict_check` enforcing 6-state enum (`confirmed | confirmed_with_changes | unconfirmed | error | skipped | unsupported_region`) with NULL allowed.
2. **Section 2 — inquiries columns (D-F1'):** Identical 6 columns + identical CHECK constraint named `inquiries_address_validation_verdict_check`.
3. **Section 3 — partial indexes:** `idx_appointments_place_id` and `idx_inquiries_place_id`, both `WHERE place_id IS NOT NULL` for future dedup queries.
4. **Section 4 — gmaps_validate_events table (D-C2'):** New sibling table with id/tenant_id/call_id/verdict/latency_ms/cost_micro_cents/region_code/created_at columns, `idx_gmaps_validate_events_tenant_created` index, RLS enabled, two policies (`gmaps_validate_events_select_own` + `service_role_all_gmaps_validate_events`).
5. **Section 5 — book_appointment_atomic RPC overload:** drop-loop evicts all existing overloads, then CREATE OR REPLACE the new 17-arg signature (11 original + 6 new defaulted-NULL). Body preserves slot-collision check, advisory lock, INSERT extended to write all 17 columns into appointments.
6. **Section 6 — REVOKE/GRANT book_appointment_atomic:** Type list `(uuid, uuid, timestamptz, timestamptz, text, text, text, text, uuid, text, text, text, text, numeric, numeric, jsonb, text)` to service_role only.
7. **Section 7 — record_call_outcome RPC overload + REVOKE/GRANT:** drop-loop, CREATE OR REPLACE 14-arg signature (8 from 060 + 6 new defaulted-NULL), inquiry-path INSERT extended to write the 6 new columns. Job-path INSERT unchanged (validated address goes onto the appointment row via book_appointment_atomic, not the job row). REVOKE/GRANT type list `(uuid, text, text, text, uuid, text, uuid, text, text, text, numeric, numeric, jsonb, text)` to service_role only.

Verification grep checks all pass: address_validation_verdict appears 12 times (≥6), default null appears 16 times (≥12), inquiries ALTER + gmaps_validate_events CREATE TABLE + RPC GRANT lines all present.

Commit: `3dbc263` — `feat(61-01): add migration 062 phase61 address validation schema`

### Task 2: supabase db push ⛔ BLOCKED — auth gate

`supabase db push` requires a Supabase Personal Access Token (PAT) and DB password. The plan's `user_setup` block claimed `SUPABASE_ACCESS_TOKEN` was already configured locally per the auth-database-multitenancy skill, but neither the project's `.env.local`, the user's process environment, the User-scope or Machine-scope Windows env vars, nor `~/.supabase/access-token` contains one. `npx supabase link --project-ref exbzhmparzjlpkryeiso` exits with `Access token not provided`.

This matches the historical pattern documented in `.claude/worktrees/agent-aab026c09dcb73096/.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-01-SUMMARY.md` — every Phase 53/54/55/56/57/59 migration plan has surfaced the same auth gate, and each was resolved by the human pasting the PAT into the shell or running `supabase login` interactively.

Per the executor's `<authentication_gates>` protocol, this is a gate, not a failure. The migration file itself is committed and ready; the only step left is the human-mediated push.

## How to resume Task 2

Run from the repo root in a TTY-capable shell:

```bash
# Option A — set env var inline:
SUPABASE_ACCESS_TOKEN=<paste-from-supabase-dashboard-account-tokens> \
  npx supabase link --project-ref exbzhmparzjlpkryeiso
SUPABASE_ACCESS_TOKEN=<same-token> npx supabase db push

# Option B — interactive login + push:
npx supabase login
npx supabase link --project-ref exbzhmparzjlpkryeiso
npx supabase db push
```

Expected output on success:
```
Applying migration 062_phase61_address_validation.sql...
NOTICE:  ...
Finished supabase db push.
```

Verification:
```bash
npx supabase migration list 2>&1 | grep 062_phase61_address_validation
```

If it shows the row marked applied (or two columns matching local↔remote), the push succeeded. Plans 02 and 03 are then unblocked.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Plan `<interfaces>` block had wrong record_call_outcome signature**

- **Found during:** Task 1, while reading 060_phase59_rpcs.sql (per `<read_first>`).
- **Issue:** Plan's interfaces block (61-01-PLAN.md lines 124-134) showed `record_call_outcome` as a 5-arg function with signature `(p_tenant_id uuid, p_phone_e164 text, p_caller_name text, p_job_type text, p_service_address text, p_urgency text DEFAULT 'routine')`. The actual current signature in 060 is **8 arguments** in different order: `(p_tenant_id uuid, p_phone_e164 text, p_caller_name text, p_service_address text, p_appointment_id uuid, p_urgency text, p_call_id uuid, p_job_type text DEFAULT NULL)`.
- **Fix:** Wrote the new RPC overload extending the **actual** 8-arg signature with 6 new defaulted-NULL params (final arity 14), not the imaginary 5-arg signature. The new INSERT INTO inquiries section preserves all the 060 semantics (tenant existence guard, customer UPSERT, job-vs-inquiry branch on appointment_id, customer_calls + job_calls junction inserts, jsonb return). REVOKE/GRANT type list updated accordingly: `(uuid, text, text, text, uuid, text, uuid, text, text, text, numeric, numeric, jsonb, text)`.
- **Files modified:** `supabase/migrations/062_phase61_address_validation.sql` only.
- **Commit:** `3dbc263`

**2. [Rule 1 — Bug] Plan claimed calls.id is text-typed**

- **Found during:** Task 1, while drafting Section 4 gmaps_validate_events table definition.
- **Issue:** Plan's Section 4 column comment said `call_id text, -- nullable; matches calls.id text shape`. The actual `calls.id` column in `001_initial_schema.sql` is `uuid PRIMARY KEY DEFAULT gen_random_uuid()`. Storing call ids as text would have prevented FK enforcement and required casts at every join.
- **Fix:** Changed `call_id text` to `call_id uuid references calls(id) on delete set null`. Adds an FK + cascade clause so orphaned events get null'd if the call row is deleted, while still allowing nullable rows for early-flow events that fire before the call row is created.
- **Files modified:** `supabase/migrations/062_phase61_address_validation.sql` only.
- **Commit:** `3dbc263`

**3. [Rule 2 — Critical functionality] Added explicit service_role policy on gmaps_validate_events**

- **Found during:** Task 1, while drafting Section 4 RLS.
- **Issue:** Plan's RLS spec only added a SELECT policy and relied on service-role bypassing RLS for INSERTs. While that is functionally correct (service-role does bypass RLS by default), every Phase 59-onwards table in the codebase (see 059_customers_jobs_inquiries.sql lines 147, 155, 163, 177, 191, 199) carries an explicit `service_role_all_*` policy as documentation of the trust boundary.
- **Fix:** Added `create policy service_role_all_gmaps_validate_events on gmaps_validate_events for all using (auth.role() = 'service_role')` for parity. Defensive but consistent with the codebase pattern.
- **Files modified:** `supabase/migrations/062_phase61_address_validation.sql` only.
- **Commit:** `3dbc263`

### Authentication Gates

**Task 2 — supabase db push:**
- **What was needed:** A Supabase Personal Access Token in `SUPABASE_ACCESS_TOKEN` env var.
- **Why it could not be automated:** No PAT exists in the worktree's `.env.local`, in the user's process or machine environment variables, or in `~/.supabase/`. Acquiring a PAT requires the human to log into the Supabase dashboard, generate a token, and paste it.
- **Outcome:** Task 1 (the migration file) is committed; Task 2 (the push) is pending human resume per the "How to resume Task 2" section above. This matches the historical pattern from Phase 53/54/55/56/57/59 plans — every migration plan in this repo has hit the same gate.

## Threat Surface Scan

No new threat surface beyond what Plan 01's `<threat_model>` already enumerates. The migration is purely additive schema + additive RPC overloads; no new network endpoints, no new auth paths, no new file-access patterns. The threat register (T-61-01 through T-61-07) remains accurate.

## Output Artifacts

- `supabase/migrations/062_phase61_address_validation.sql` (335 lines, includes header comment + 7 sections wrapped in BEGIN/COMMIT)
- `.planning/phases/61-google-maps-address-validation-and-structured-address-storage/61-01-SUMMARY.md` (this file)

## Self-Check: PASSED

Verified the following exist on disk:

- `supabase/migrations/062_phase61_address_validation.sql` — FOUND
- Commit `3dbc263` — FOUND in `git log --all`
- All grep acceptance-criteria assertions pass (address_validation_verdict ≥6 occurrences = 12 actual; default null ≥12 = 16 actual; ALTER TABLE inquiries present; gmaps_validate_events present; GRANT EXECUTE on record_call_outcome present; drop-loop pattern appears twice).

Migration is ready for human-mediated `supabase db push` to unblock Plans 02 and 03.

-- ============================================================
-- 066_calls_call_sid_unique.sql
-- Prod-readiness 2026-06: enforce one calls row per Twilio CallSid.
-- ============================================================
--
-- PROBLEM: Twilio retries the voice webhook (/twilio/incoming-call) on 5xx /
-- timeout. The owner-pickup insert (_insert_owner_pickup_call) had no unique
-- guard (migration 045 created only a NON-unique partial index on call_sid),
-- so each retry inserted a duplicate `calls` row. Then /twilio/dial-status does
-- `UPDATE ... WHERE call_sid = ...` (multi-row) and caps.py sums
-- outbound_dial_duration_sec across rows, double-counting the call against the
-- monthly cap.
--
-- CARDINALITY (verified): only owner-pickup rows carry a non-NULL call_sid. The
-- AI/LiveKit call row is keyed on call_id (room name) and leaves call_sid NULL.
-- The design expects exactly ONE row per CallSid. So a plain UNIQUE(call_sid) is
-- correct: Postgres treats NULLs as DISTINCT, so the many NULL-call_sid AI rows
-- are unconstrained, while non-NULL CallSids get true uniqueness.
--
-- WHY A FULL UNIQUE CONSTRAINT (not a partial unique index): the agent's
-- companion fix changes the insert to upsert(on_conflict="call_sid"), which
-- emits `ON CONFLICT (call_sid)`. Postgres ON CONFLICT inference CANNOT match a
-- partial unique index (it would need the WHERE predicate, which PostgREST upsert
-- can't supply). A full UNIQUE constraint is inferable and behaves identically
-- here because all the rows we constrain are non-NULL.
--
-- DEPLOY ORDER: apply this migration BEFORE deploying the agent upsert. The
-- dedupe below is baked in (idempotent) so the constraint can be added without a
-- separate manual cleanup. Duplicates are duplicate inserts of the SAME physical
-- call (dial-status wrote the same duration to each), so we KEEP one row and
-- DELETE the rest — we do NOT sum durations (that would inflate the cap).

BEGIN;

-- 1. De-duplicate existing rows: per call_sid keep the most-complete row
--    (highest outbound_dial_duration_sec — i.e. the one dial-status populated;
--    NULLs last), tie-break to the earliest insert. Delete the rest.
DELETE FROM calls c
USING (
  SELECT id,
         row_number() OVER (
           PARTITION BY call_sid
           ORDER BY outbound_dial_duration_sec DESC NULLS LAST, created_at ASC, id ASC
         ) AS rn
  FROM calls
  WHERE call_sid IS NOT NULL
) d
WHERE c.id = d.id
  AND d.rn > 1;

-- 2. Replace the non-unique partial index (045) with a UNIQUE constraint.
--    The constraint creates its own unique index, so the lookup path used by
--    dial-status (WHERE call_sid = ...) stays indexed.
DROP INDEX IF EXISTS idx_calls_call_sid;
ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_call_sid_unique;
ALTER TABLE calls ADD CONSTRAINT calls_call_sid_unique UNIQUE (call_sid);

COMMIT;

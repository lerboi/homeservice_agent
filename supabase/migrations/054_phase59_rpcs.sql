-- ============================================================
-- 054_phase59_rpcs.sql
-- Phase 59 Plan 03: Three atomic RPCs for the customer/job model.
-- ============================================================
--
-- RPCs created:
--   1. record_call_outcome  — D-14 / D-10 / D-16
--      Upserts customer by (tenant_id, phone_e164), creates job OR inquiry,
--      links call via customer_calls (+job_calls). Single round-trip for Python agent.
--
--   2. merge_customer       — D-19 + D-19 expanded audit
--      Repoints all children from source → target, stashes undo snapshot in
--      customers.merge_snapshot, INSERTs one row into customer_merge_audit with
--      per-table row_counts JSONB. Retained forever.
--
--   3. unmerge_customer     — D-19 7-day undo + audit mark
--      Reverses merge within 7-day window using snapshot (specific IDs only —
--      not blanket WHERE). UPDATEs customer_merge_audit.unmerged_at. Never deletes.
--
-- Security: ALL THREE are SECURITY DEFINER + REVOKE FROM PUBLIC + GRANT TO service_role.
--   Pattern mirrors supabase/migrations/027_lock_rpc_functions.sql exactly.
--   ASVS V4: T-59-03-01, T-59-03-02. Python agent calls via service-role key on Railway.
--   Dashboard never calls these directly — all calls route through service-role API routes.
--
-- NOTE: Tables (customers, jobs, inquiries, customer_calls, job_calls, customer_merge_audit)
--   are created by 053a_customers_jobs_inquiries.sql. This migration depends on 053a being
--   applied first. Live push batched to pre-Plan-08 slot (per Plan 02/03 SUMMARY).
-- ============================================================

BEGIN;

-- ============================================================
-- 1. record_call_outcome (D-14 / D-10 / D-16)
-- ============================================================
-- Atomic: upsert customer + insert job OR inquiry + link call junctions.
-- Called by Python LiveKit agent after every call session.
-- Returns: {customer_id, job_id, inquiry_id} — job_id null on inquiry path;
--          inquiry_id null on job path.

CREATE OR REPLACE FUNCTION record_call_outcome(
  p_tenant_id      uuid,
  p_phone_e164     text,
  p_caller_name    text,
  p_service_address text,
  p_appointment_id uuid,
  p_urgency        text,
  p_call_id        uuid,
  p_job_type       text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id  uuid;
  v_job_id       uuid;
  v_inquiry_id   uuid;
BEGIN
  -- Defense-in-depth: verify tenant exists before any write.
  -- Prevents crafted service-role calls with garbage tenant_id from inserting orphan rows.
  -- (T-59-03-01: SECURITY DEFINER bypasses RLS, so we guard explicitly.)
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'tenant_not_found' USING ERRCODE = 'no_data_found';
  END IF;

  -- D-05: UPSERT customer by (tenant_id, phone_e164).
  --   ON CONFLICT: update name/address only when the new value is not null
  --   (COALESCE preserves existing data if caller provides no name on repeat call).
  INSERT INTO customers (tenant_id, phone_e164, name, default_address)
  VALUES (p_tenant_id, p_phone_e164, p_caller_name, p_service_address)
  ON CONFLICT (tenant_id, phone_e164) DO UPDATE
    SET name            = COALESCE(EXCLUDED.name, customers.name),
        default_address = COALESCE(EXCLUDED.default_address, customers.default_address),
        updated_at      = now()
  RETURNING id INTO v_customer_id;

  -- D-10: auto-convert branch.
  --   appointment_id present  → job path  (booked work)
  --   appointment_id absent   → inquiry path (unbooked call)
  IF p_appointment_id IS NOT NULL THEN
    INSERT INTO jobs (tenant_id, customer_id, appointment_id, urgency)
    VALUES (p_tenant_id, v_customer_id, p_appointment_id, p_urgency)
    RETURNING id INTO v_job_id;
  ELSE
    INSERT INTO inquiries (tenant_id, customer_id, job_type, service_address, urgency)
    VALUES (p_tenant_id, v_customer_id, p_job_type, p_service_address, p_urgency)
    RETURNING id INTO v_inquiry_id;
  END IF;

  -- D-16: always link call → customer.
  INSERT INTO customer_calls (customer_id, call_id)
  VALUES (v_customer_id, p_call_id)
  ON CONFLICT DO NOTHING;

  -- D-16: link call → job only when job path was taken.
  IF v_job_id IS NOT NULL THEN
    INSERT INTO job_calls (job_id, call_id)
    VALUES (v_job_id, p_call_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'customer_id', v_customer_id,
    'job_id',      v_job_id,
    'inquiry_id',  v_inquiry_id
  );
END;
$$;

-- Lock down: service_role only. Mirror of 027_lock_rpc_functions.sql pattern.
REVOKE EXECUTE ON FUNCTION record_call_outcome(uuid, text, text, text, uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_call_outcome(uuid, text, text, text, uuid, text, uuid, text) TO service_role;


-- ============================================================
-- 2. merge_customer (D-19 + D-19 expanded audit)
-- ============================================================
-- Repoints all children from source → target in a single transaction.
-- Stashes exact child IDs in source.merge_snapshot for snapshot-based undo (T-59-03-03).
-- INSERTs exactly ONE row into customer_merge_audit with per-table row_counts JSONB (T-59-03-06).
-- Returns: {source_id, target_id, audit_id, moved_counts: {...}}

CREATE OR REPLACE FUNCTION merge_customer(
  p_tenant_id  uuid,
  p_source_id  uuid,
  p_target_id  uuid,
  p_merged_by  uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_snapshot              jsonb;
  v_source_updated_at     timestamptz;
  v_target_updated_at     timestamptz;
  v_jobs_count            int;
  v_inquiries_count       int;
  v_invoices_count        int;
  v_activity_count        int;
  v_customer_calls_count  int;
  v_job_calls_count       int;
  v_audit_id              uuid;
BEGIN
  -- -------------------------------------------------------
  -- 1. Validation (T-59-03-02, T-59-03-05)
  -- -------------------------------------------------------

  -- No self-merge.
  IF p_source_id = p_target_id THEN
    RAISE EXCEPTION 'self_merge_forbidden';
  END IF;

  -- Source must belong to this tenant AND not already be merged.
  PERFORM 1 FROM customers
  WHERE id = p_source_id
    AND tenant_id = p_tenant_id
    AND merged_into IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'source_invalid';
  END IF;

  -- Target must belong to this tenant AND not already be merged.
  PERFORM 1 FROM customers
  WHERE id = p_target_id
    AND tenant_id = p_tenant_id
    AND merged_into IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'target_invalid';
  END IF;

  -- -------------------------------------------------------
  -- 2. Count per-table rows that will move (for audit row_counts)
  -- -------------------------------------------------------
  SELECT COUNT(*) INTO v_jobs_count
    FROM jobs WHERE customer_id = p_source_id;

  SELECT COUNT(*) INTO v_inquiries_count
    FROM inquiries WHERE customer_id = p_source_id;

  SELECT COUNT(*) INTO v_invoices_count
    FROM invoices i
    WHERE i.job_id IN (SELECT id FROM jobs WHERE customer_id = p_source_id);

  SELECT COUNT(*) INTO v_activity_count
    FROM activity_log WHERE customer_id = p_source_id;

  SELECT COUNT(*) INTO v_customer_calls_count
    FROM customer_calls WHERE customer_id = p_source_id;

  SELECT COUNT(*) INTO v_job_calls_count
    FROM job_calls
    WHERE job_id IN (SELECT id FROM jobs WHERE customer_id = p_source_id);

  -- -------------------------------------------------------
  -- 3. Build merge_snapshot — exact child IDs for undo (T-59-03-03)
  --    Stored in source.merge_snapshot so unmerge_customer knows which rows to reverse.
  -- -------------------------------------------------------
  v_snapshot := jsonb_build_object(
    'jobs',           COALESCE((SELECT jsonb_agg(id)      FROM jobs           WHERE customer_id = p_source_id), '[]'::jsonb),
    'inquiries',      COALESCE((SELECT jsonb_agg(id)      FROM inquiries      WHERE customer_id = p_source_id), '[]'::jsonb),
    'activity_log',   COALESCE((SELECT jsonb_agg(id)      FROM activity_log   WHERE customer_id = p_source_id), '[]'::jsonb),
    'customer_calls', COALESCE((SELECT jsonb_agg(call_id) FROM customer_calls WHERE customer_id = p_source_id), '[]'::jsonb)
  );

  -- -------------------------------------------------------
  -- 4. Target-wins field merge using latest updated_at (D-19)
  --    If source was updated more recently than target, apply source fields
  --    to target only where target has no value (COALESCE — target wins on ties).
  -- -------------------------------------------------------
  SELECT updated_at INTO v_source_updated_at FROM customers WHERE id = p_source_id;
  SELECT updated_at INTO v_target_updated_at FROM customers WHERE id = p_target_id;

  IF v_source_updated_at > v_target_updated_at THEN
    UPDATE customers t
    SET
      name            = COALESCE(t.name, s.name),
      default_address = COALESCE(t.default_address, s.default_address),
      email           = COALESCE(t.email, s.email),
      notes           = COALESCE(t.notes, s.notes),
      tags            = CASE WHEN array_length(t.tags, 1) IS NULL THEN s.tags ELSE t.tags END,
      updated_at      = now()
    FROM customers s
    WHERE t.id = p_target_id AND s.id = p_source_id;
  END IF;

  -- -------------------------------------------------------
  -- 5. Repoint children source → target
  -- -------------------------------------------------------

  -- Direct customer_id FK tables
  UPDATE jobs        SET customer_id = p_target_id WHERE customer_id = p_source_id;
  UPDATE inquiries   SET customer_id = p_target_id WHERE customer_id = p_source_id;
  UPDATE activity_log SET customer_id = p_target_id WHERE customer_id = p_source_id;

  -- customer_calls: composite PK (customer_id, call_id) — use INSERT + ON CONFLICT to avoid
  -- duplicate PK errors when target already has the same call linked.
  INSERT INTO customer_calls (customer_id, call_id)
    SELECT p_target_id, call_id
    FROM customer_calls
    WHERE customer_id = p_source_id
  ON CONFLICT DO NOTHING;
  DELETE FROM customer_calls WHERE customer_id = p_source_id;

  -- job_calls: already repointed via jobs.customer_id; no direct customer reference to change.
  -- invoices: repoint via jobs (jobs.customer_id already moved above); no direct customer FK.

  -- -------------------------------------------------------
  -- 6. Soft-delete source + stash snapshot (D-19)
  -- -------------------------------------------------------
  UPDATE customers
  SET
    merged_into    = p_target_id,
    merged_at      = now(),
    merge_snapshot = v_snapshot
  WHERE id = p_source_id;

  -- -------------------------------------------------------
  -- 7. D-19 expanded: INSERT permanent audit row (T-59-03-06)
  --    Retained FOREVER. unmerge_customer only marks unmerged_at — never deletes.
  -- -------------------------------------------------------
  INSERT INTO customer_merge_audit (
    tenant_id,
    source_customer_id,
    target_customer_id,
    merged_by,
    merged_at,
    row_counts
  ) VALUES (
    p_tenant_id,
    p_source_id,
    p_target_id,
    p_merged_by,
    now(),
    jsonb_build_object(
      'jobs',           v_jobs_count,
      'inquiries',      v_inquiries_count,
      'invoices',       v_invoices_count,
      'activity_log',   v_activity_count,
      'customer_calls', v_customer_calls_count,
      'job_calls',      v_job_calls_count
    )
  )
  RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object(
    'source_id',    p_source_id,
    'target_id',    p_target_id,
    'audit_id',     v_audit_id,
    'moved_counts', jsonb_build_object(
      'jobs',           v_jobs_count,
      'inquiries',      v_inquiries_count,
      'invoices',       v_invoices_count,
      'activity_log',   v_activity_count,
      'customer_calls', v_customer_calls_count,
      'job_calls',      v_job_calls_count
    )
  );
END;
$$;

-- Lock down: service_role only.
REVOKE EXECUTE ON FUNCTION merge_customer(uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION merge_customer(uuid, uuid, uuid, uuid) TO service_role;


-- ============================================================
-- 3. unmerge_customer (D-19 7-day undo + D-19 expanded audit mark)
-- ============================================================
-- Reverses a merge within 7 days using the snapshot stored in source.merge_snapshot.
-- Moves ONLY the specific IDs captured at merge time (T-59-03-03 — no blanket UPDATE
-- that would clobber children added to the target after the merge).
-- UPDATEs customer_merge_audit.unmerged_at. Row is NEVER deleted (retained forever).
-- Returns: {source_id, restored_from, audit_id}

CREATE OR REPLACE FUNCTION unmerge_customer(
  p_tenant_id  uuid,
  p_source_id  uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_snapshot   jsonb;
  v_target     uuid;
  v_merged_at  timestamptz;
  v_audit_id   uuid;
BEGIN
  -- -------------------------------------------------------
  -- 1. Read source state — must be merged and within 7-day window
  -- -------------------------------------------------------
  SELECT merged_into, merged_at, merge_snapshot
    INTO v_target, v_merged_at, v_snapshot
  FROM customers
  WHERE id = p_source_id AND tenant_id = p_tenant_id;

  IF v_target IS NULL THEN
    RAISE EXCEPTION 'not_merged';
  END IF;

  IF v_merged_at < now() - interval '7 days' THEN
    RAISE EXCEPTION 'merge_window_expired';
  END IF;

  -- -------------------------------------------------------
  -- 2. Reverse-repoint using snapshot IDs only (T-59-03-03)
  --    Cast jsonb text elements to uuid[] for efficient ANY(...) matching.
  -- -------------------------------------------------------

  -- jobs
  UPDATE jobs SET customer_id = p_source_id
  WHERE id = ANY(
    ARRAY(SELECT jsonb_array_elements_text(v_snapshot->'jobs'))::uuid[]
  );

  -- inquiries
  UPDATE inquiries SET customer_id = p_source_id
  WHERE id = ANY(
    ARRAY(SELECT jsonb_array_elements_text(v_snapshot->'inquiries'))::uuid[]
  );

  -- activity_log
  UPDATE activity_log SET customer_id = p_source_id
  WHERE id = ANY(
    ARRAY(SELECT jsonb_array_elements_text(v_snapshot->'activity_log'))::uuid[]
  );

  -- customer_calls: restore source rows; remove from target (only the ones we moved)
  INSERT INTO customer_calls (customer_id, call_id)
    SELECT p_source_id, j.call_id::uuid
    FROM jsonb_array_elements_text(v_snapshot->'customer_calls') AS j(call_id)
  ON CONFLICT DO NOTHING;

  DELETE FROM customer_calls cc
  WHERE cc.customer_id = v_target
    AND cc.call_id = ANY(
      ARRAY(SELECT jsonb_array_elements_text(v_snapshot->'customer_calls'))::uuid[]
    );

  -- -------------------------------------------------------
  -- 3. Restore source customer row
  -- -------------------------------------------------------
  UPDATE customers
  SET
    merged_into    = NULL,
    merged_at      = NULL,
    merge_snapshot = NULL
  WHERE id = p_source_id;

  -- -------------------------------------------------------
  -- 4. D-19 expanded: mark the matching audit row as reversed (never delete it).
  --    Match on (source_customer_id, tenant_id, unmerged_at IS NULL).
  --    ORDER BY merged_at DESC LIMIT 1 is defensive for the (impossible in current design
  --    but guarded-against) case of multiple historical audit rows for the same source.
  -- -------------------------------------------------------
  UPDATE customer_merge_audit
     SET unmerged_at = now()
   WHERE id = (
     SELECT id
     FROM customer_merge_audit
     WHERE source_customer_id = p_source_id
       AND tenant_id           = p_tenant_id
       AND unmerged_at         IS NULL
     ORDER BY merged_at DESC
     LIMIT 1
   )
  RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object(
    'source_id',     p_source_id,
    'restored_from', v_target,
    'audit_id',      v_audit_id
  );
END;
$$;

-- Lock down: service_role only.
REVOKE EXECUTE ON FUNCTION unmerge_customer(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION unmerge_customer(uuid, uuid) TO service_role;

COMMIT;

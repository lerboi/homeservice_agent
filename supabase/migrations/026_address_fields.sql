-- 026_address_fields.sql
-- Add structured address columns (postal_code, street_name) to appointments and leads.
-- Keeps service_address as a combined field for backward compatibility.

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS street_name text;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS street_name text;

-- Recreate book_appointment_atomic with new address params (defaults to NULL for backward compat)
-- Drop ALL overloads dynamically (unknown signatures from manual edits)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS func_sig
    FROM pg_proc
    WHERE proname = 'book_appointment_atomic'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_sig;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION book_appointment_atomic(
  p_tenant_id      uuid,
  p_call_id        uuid,
  p_start_time     timestamptz,
  p_end_time       timestamptz,
  p_service_address text,
  p_caller_name    text,
  p_caller_phone   text,
  p_urgency        text,
  p_zone_id        uuid DEFAULT NULL,
  p_postal_code    text DEFAULT NULL,
  p_street_name    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lock_key    bigint;
  v_lock_ok     boolean;
  v_overlap_cnt int;
  v_new_id      uuid;
BEGIN
  v_lock_key := abs(hashtext(p_tenant_id::text || extract(epoch FROM p_start_time)::text));
  v_lock_ok := pg_try_advisory_xact_lock(v_lock_key);

  IF NOT v_lock_ok THEN
    RETURN jsonb_build_object('success', false, 'reason', 'slot_taken');
  END IF;

  SELECT COUNT(*) INTO v_overlap_cnt
  FROM appointments
  WHERE tenant_id = p_tenant_id
    AND status    <> 'cancelled'
    AND tstzrange(start_time, end_time, '[)') && tstzrange(p_start_time, p_end_time, '[)');

  IF v_overlap_cnt > 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'slot_taken');
  END IF;

  INSERT INTO appointments (
    tenant_id, call_id, start_time, end_time,
    service_address, caller_name, caller_phone,
    urgency, zone_id, postal_code, street_name
  )
  VALUES (
    p_tenant_id, p_call_id, p_start_time, p_end_time,
    p_service_address, p_caller_name, p_caller_phone,
    p_urgency, p_zone_id, p_postal_code, p_street_name
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'appointment_id', v_new_id);
END;
$$;

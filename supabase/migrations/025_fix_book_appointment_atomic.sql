-- 025_fix_book_appointment_atomic.sql
-- Re-create book_appointment_atomic to fix "column scheduled does not exist" error.
-- The live function was manually modified; this restores the correct version from 003.

DROP FUNCTION IF EXISTS book_appointment_atomic(uuid,uuid,timestamptz,timestamptz,text,text,text,text,uuid);

CREATE OR REPLACE FUNCTION book_appointment_atomic(
  p_tenant_id      uuid,
  p_call_id        uuid,
  p_start_time     timestamptz,
  p_end_time       timestamptz,
  p_service_address text,
  p_caller_name    text,
  p_caller_phone   text,
  p_urgency        text,
  p_zone_id        uuid DEFAULT NULL
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
  -- Derive a deterministic 63-bit advisory lock key from tenant + slot start
  v_lock_key := abs(hashtext(p_tenant_id::text || extract(epoch FROM p_start_time)::text));

  -- Non-blocking try-lock; if another transaction holds this key, bail immediately
  v_lock_ok := pg_try_advisory_xact_lock(v_lock_key);

  IF NOT v_lock_ok THEN
    RETURN jsonb_build_object('success', false, 'reason', 'slot_taken');
  END IF;

  -- Check for any non-cancelled appointment that overlaps the requested window
  SELECT COUNT(*) INTO v_overlap_cnt
  FROM appointments
  WHERE tenant_id = p_tenant_id
    AND status    <> 'cancelled'
    AND tstzrange(start_time, end_time, '[)') && tstzrange(p_start_time, p_end_time, '[)');

  IF v_overlap_cnt > 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'slot_taken');
  END IF;

  -- Safe to insert
  INSERT INTO appointments (
    tenant_id,
    call_id,
    start_time,
    end_time,
    service_address,
    caller_name,
    caller_phone,
    urgency,
    zone_id
  )
  VALUES (
    p_tenant_id,
    p_call_id,
    p_start_time,
    p_end_time,
    p_service_address,
    p_caller_name,
    p_caller_phone,
    p_urgency,
    p_zone_id
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'appointment_id', v_new_id);
END;
$$;

-- 073: LOW-26 — book_appointment_atomic returns slot_taken instead of a raw 500
--
-- The advisory lock is keyed per (tenant_id, exact start_time), and the
-- pre-check only COUNTs overlaps. A concurrent booking for an OVERLAPPING but
-- DIFFERENT start time (e.g. 2:00-3:00 vs 2:30-3:30) takes a different lock key,
-- can pass the COUNT pre-check before the other commits, and then loses the race
-- at the appointments_no_overlap GiST exclusion constraint on INSERT. That
-- raised a raw exclusion_violation (SQLSTATE 23P01) which the dashboard route
-- surfaced as a 500 and the voice agent as a generic rpc_error apology/transfer.
--
-- Fix: wrap ONLY the INSERT in a sub-block that maps exclusion_violation (and,
-- defensively, unique_violation) to the existing {success:false,
-- reason:'slot_taken'} contract — the same result the pre-checks already return.
-- The advisory lock is taken in the OUTER block, so the inner subtransaction
-- rollback does not release it. CREATE OR REPLACE preserves the existing ACL
-- (the 069 anon/authenticated EXECUTE revoke stays in place) and search_path pin.

CREATE OR REPLACE FUNCTION public.book_appointment_atomic(
  p_tenant_id uuid,
  p_call_id uuid,
  p_start_time timestamp with time zone,
  p_end_time timestamp with time zone,
  p_service_address text,
  p_caller_name text,
  p_caller_phone text,
  p_urgency text,
  p_zone_id uuid DEFAULT NULL::uuid,
  p_postal_code text DEFAULT NULL::text,
  p_street_name text DEFAULT NULL::text,
  p_formatted_address text DEFAULT NULL::text,
  p_place_id text DEFAULT NULL::text,
  p_latitude numeric DEFAULT NULL::numeric,
  p_longitude numeric DEFAULT NULL::numeric,
  p_address_components jsonb DEFAULT NULL::jsonb,
  p_address_validation_verdict text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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

  BEGIN
    INSERT INTO appointments (
      tenant_id, call_id, start_time, end_time,
      service_address, caller_name, caller_phone,
      urgency, zone_id, postal_code, street_name,
      formatted_address, place_id, latitude, longitude,
      address_components, address_validation_verdict
    )
    VALUES (
      p_tenant_id, p_call_id, p_start_time, p_end_time,
      p_service_address, p_caller_name, p_caller_phone,
      p_urgency, p_zone_id, p_postal_code, p_street_name,
      p_formatted_address, p_place_id, p_latitude, p_longitude,
      p_address_components, p_address_validation_verdict
    )
    RETURNING id INTO v_new_id;
  EXCEPTION
    WHEN exclusion_violation OR unique_violation THEN
      -- Lost the GiST race for an overlapping-but-different start. Return the
      -- same clean contract as the pre-checks instead of bubbling a 23P01.
      RETURN jsonb_build_object('success', false, 'reason', 'slot_taken');
  END;

  RETURN jsonb_build_object('success', true, 'appointment_id', v_new_id);
END;
$function$;

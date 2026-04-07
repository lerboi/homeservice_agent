-- 039_lock_increment_calls_used.sql
-- Lock down increment_calls_used RPC — should only be callable by service_role.
--
-- This function was missed in 027_lock_rpc_functions.sql which locked
-- book_appointment_atomic and assign_sg_number but not this one.
-- Signature matches 037_fix_overage_off_by_one.sql: increment_calls_used(uuid, text)
--
-- Without this, any anonymous or authenticated PostgREST caller could invoke
-- the RPC to inflate a tenant's calls_used counter or generate spurious
-- usage_events rows.

REVOKE EXECUTE ON FUNCTION public.increment_calls_used(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_calls_used(uuid, text) TO service_role;

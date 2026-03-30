-- 027_lock_rpc_functions.sql
-- Lock down SECURITY DEFINER functions that should only be callable by service_role.
--
-- book_appointment_atomic: called from webhook handlers and Python agent only.
-- assign_sg_number: called from Stripe checkout webhook only.
--
-- By default, Postgres grants EXECUTE on new functions to PUBLIC. These
-- SECURITY DEFINER functions bypass RLS, so anonymous/authenticated callers
-- should not be able to invoke them directly via PostgREST RPC.

-- Revoke public access and grant only to service_role
-- Signature from 026_address_fields.sql (updated with postal_code + street_name):
--   book_appointment_atomic(uuid, uuid, timestamptz, timestamptz, text, text, text, text, uuid, text, text)
REVOKE EXECUTE ON FUNCTION public.book_appointment_atomic(uuid, uuid, timestamptz, timestamptz, text, text, text, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_appointment_atomic(uuid, uuid, timestamptz, timestamptz, text, text, text, text, uuid, text, text) TO service_role;

-- Signature from 011_country_provisioning.sql:
--   assign_sg_number(uuid)
REVOKE EXECUTE ON FUNCTION public.assign_sg_number(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_sg_number(uuid) TO service_role;

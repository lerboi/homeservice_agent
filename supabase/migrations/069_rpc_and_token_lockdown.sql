-- ============================================================
-- 069_rpc_and_token_lockdown.sql
-- Security lockdown (2026-06-12 audit follow-up). Three sections:
--
-- Section 1: SECURITY DEFINER RPC lockdown.
--   Supabase grants EXECUTE on every new public function to anon and
--   authenticated EXPLICITLY, so the `REVOKE ... FROM PUBLIC` in migrations
--   027/033/062/065 was a no-op against those grants. Verified live
--   (2026-06-12): all 7 SECURITY DEFINER functions — book_appointment_atomic,
--   record_call_outcome, merge_customer, unmerge_customer,
--   set_primary_calendar, assign_sg_number, increment_rate_limit — were
--   executable by the anon role via /rest/v1/rpc/* with the public anon key
--   (cross-tenant appointment injection, SG inventory drain, CRM corruption,
--   rate-limiter poisoning). Every caller in both repos uses the service-role
--   client (verified: src/lib/supabase.js + livekit-agent supabase_client.py),
--   so revoking anon/authenticated breaks nothing.
--   Also pins search_path on each (SECURITY DEFINER hardening — all 7 had a
--   role-mutable search_path per the Supabase advisor).
--   Uses a catalog-driven DO block so exact signatures are always correct and
--   the migration is idempotent.
--
-- Section 2: search_path pinning for the remaining advisor-flagged functions
--   (SECURITY INVOKER — no privilege changes, zero break risk).
--   increment_calls_used additionally gets the anon/authenticated REVOKE: its
--   only caller is the Python agent's service-role client.
--
-- Section 3: OAuth token tables locked to service_role.
--   accounting_credentials (Xero/Jobber) and calendar_credentials
--   (Google/Outlook) store access_token + refresh_token as plaintext and had
--   tenant-own RLS policies FOR ALL + authenticated table grants — a logged-in
--   owner's browser session (or any XSS in it) could SELECT live OAuth tokens
--   via PostgREST. Verified (2026-06-12): no browser-side code reads either
--   table (all reads go through API routes / server components using the
--   service-role client), so revoking client-role privileges breaks nothing.
--   The tenant-own RLS policies are left in place but become unreachable for
--   client roles (no table privileges to exercise them).
--
-- Idempotent: REVOKE/GRANT/ALTER FUNCTION SET are safely re-runnable.
-- ============================================================

BEGIN;

-- ============================================================
-- Section 1: SECURITY DEFINER RPC lockdown (privileges + search_path)
-- ============================================================

DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn.sig);
  END LOOP;
END $$;

-- ============================================================
-- Section 2: search_path pinning for advisor-flagged SECURITY INVOKER
-- functions; increment_calls_used also gets the privilege lockdown
-- ============================================================

DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'set_updated_at',
        'increment_calls_used',
        'get_next_invoice_number',
        'get_next_estimate_number',
        'try_acquire_oauth_refresh_lock',
        'release_oauth_refresh_lock'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn.sig);
    IF fn.proname = 'increment_calls_used' THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- Section 3: OAuth token tables — service_role only
-- ============================================================

REVOKE ALL ON TABLE public.accounting_credentials FROM anon, authenticated;
REVOKE ALL ON TABLE public.calendar_credentials FROM anon, authenticated;

COMMIT;

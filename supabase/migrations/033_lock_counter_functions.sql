-- Lock invoice/estimate counter functions.
-- These are called from API routes using BOTH service_role (cron) and
-- authenticated (regular API routes via supabase-server). Must grant to both.
--
-- Callers:
--   src/app/api/invoices/route.js (supabase-server = authenticated)
--   src/app/api/invoices/batch/route.js (supabase-server = authenticated)
--   src/app/api/estimates/[id]/convert/route.js (supabase-server = authenticated)
--   src/app/api/cron/recurring-invoices/route.js (@/lib/supabase = service_role)

REVOKE EXECUTE ON FUNCTION public.get_next_invoice_number(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_invoice_number(uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_next_invoice_number(uuid, int) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_next_estimate_number(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_estimate_number(uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_next_estimate_number(uuid, int) TO authenticated;

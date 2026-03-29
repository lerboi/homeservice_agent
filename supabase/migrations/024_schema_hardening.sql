-- 024_schema_hardening.sql
-- Adds missing indexes, CHECK constraint, and updated_at trigger

-- L15: Auto-maintain leads.updated_at on row modification
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- L16: Restrict admin_users.role to known values
ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('admin', 'super_admin'));

-- L17: Index on phone_inventory_waitlist.email for lookup queries
CREATE INDEX idx_waitlist_email ON public.phone_inventory_waitlist(email);

-- L18: Index on zone_travel_buffers.tenant_id (used by RLS on every scheduling query)
CREATE INDEX idx_zone_travel_buffers_tenant ON public.zone_travel_buffers(tenant_id);

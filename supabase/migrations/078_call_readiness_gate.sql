-- 078_call_readiness_gate.sql
--
-- Call-readiness hardening: until a tenant has finished essential setup AND
-- verified a test call, the inbound Twilio webhook forwards live callers to the
-- owner instead of exposing them to a half-configured AI (twilio_routes.py
-- ::_is_call_ready). This function is the SINGLE SOURCE OF TRUTH for "is this
-- tenant ready to take live AI calls?" — it mirrors the dashboard's ESSENTIAL
-- checklist tier so the meter the owner sees and the gate the webhook enforces
-- can never drift apart:
--
--   setup_profile      → business_name present
--   configure_services → >= 1 active service
--   configure_hours    → working_hours configured
--   setup_billing      → a current active/trialing/past_due subscription
--   make_test_call     → a test call actually connected (test_call_completed)
--
-- Deploy order (safe either way): the webhook calls this via RPC and FAILS OPEN
-- (any error → normal AI/owner routing), so deploying the agent BEFORE this
-- migration simply leaves the gate inert; applying the migration activates it.

create or replace function public.is_tenant_call_ready(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(btrim(t.business_name), '') <> ''
    and t.working_hours is not null
    and t.working_hours::text not in ('null', '{}')
    and coalesce(t.test_call_completed, false)
    and exists (
      select 1 from public.services s
      where s.tenant_id = t.id and s.is_active = true
    )
    and exists (
      select 1 from public.subscriptions sub
      where sub.tenant_id = t.id
        and sub.is_current = true
        and sub.status in ('active', 'trialing', 'past_due')
    )
  from public.tenants t
  where t.id = p_tenant_id;
$$;

comment on function public.is_tenant_call_ready(uuid) is
  'True once a tenant has finished essential setup (profile, >=1 active service, working hours, active/trial/past_due billing) AND a test call has connected. The inbound Twilio webhook forwards callers to the owner until this is true. Mirrors the dashboard ESSENTIAL checklist tier (single source of truth).';

-- Lock EXECUTE down to service-role only (mirrors migration 069 RPC hardening) —
-- only the agent/webhook should evaluate routing readiness.
revoke all on function public.is_tenant_call_ready(uuid) from public;
revoke all on function public.is_tenant_call_ready(uuid) from anon;
revoke all on function public.is_tenant_call_ready(uuid) from authenticated;
grant execute on function public.is_tenant_call_ready(uuid) to service_role;

-- ── Regression-safe backfill ────────────────────────────────────────────────
-- Tenants that ALREADY have real call history have demonstrably-working routing.
-- Mark their test call complete so activating this gate does not retroactively
-- start forwarding their live inbound calls to the owner. New tenants (no call
-- history) must still complete a test call before the AI goes live.
update public.tenants t
set test_call_completed = true
where coalesce(t.test_call_completed, false) = false
  and exists (select 1 from public.calls c where c.tenant_id = t.id);

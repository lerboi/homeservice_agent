import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/onboarding/state — saved wizard progress for the signed-in user.
 *
 * The wizard keeps in-flight state in sessionStorage (per-tab, per-device).
 * Steps 1–3 persist to the DB on Continue, so a user who returns in a new
 * session/device has real saved data the UI used to ignore — pages call this
 * on mount to rehydrate instead of making the user re-enter everything.
 */
export async function GET() {
  const serverSupabase = await createSupabaseServer();
  const { data: { user } } = await serverSupabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, business_name, trade_type, owner_name, owner_phone, country')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (tenantError) {
    console.error('500: onboarding state lookup failed:', tenantError.message);
    return Response.json({ error: 'Failed to load onboarding state' }, { status: 500 });
  }

  if (!tenant) {
    // Brand-new user — nothing saved yet, wizard starts fresh.
    return Response.json({ exists: false });
  }

  const { data: services } = await supabase
    .from('services')
    .select('name, urgency_tag')
    .eq('tenant_id', tenant.id);

  return Response.json({
    exists: true,
    business_name: tenant.business_name || null,
    trade_type: tenant.trade_type || null,
    owner_name: tenant.owner_name || null,
    owner_phone: tenant.owner_phone || null,
    country: tenant.country || null,
    services: services || [],
  });
}

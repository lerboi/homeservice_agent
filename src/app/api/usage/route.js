import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';
import { PRICING_TIERS } from '@/app/(public)/pricing/pricingData';

/**
 * GET /api/usage
 *
 * Returns the current cycle's call usage snapshot for the authenticated tenant.
 *
 * Response shape:
 *   { callsUsed: number, callsIncluded: number, cycleDaysLeft: number, overageDollars: number }
 *
 * Behavior:
 *   - 401 when no authenticated user
 *   - 404 when tenant has no `is_current = true` subscription row
 *   - overageDollars = max(0, callsUsed - callsIncluded) * overageRate (from PRICING_TIERS)
 *   - cycleDaysLeft = ceil((current_period_end - now) / 1 day), clamped to >= 0, uses server UTC clock
 */
export async function GET() {
  const serverSupabase = await createSupabaseServer();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Tenant lookup via session client — RLS enforces owner-only read
  const { data: tenant } = await serverSupabase
    .from('tenants')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!tenant) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('calls_used, calls_limit, current_period_end, plan_id')
    .eq('tenant_id', tenant.id)
    .eq('is_current', true)
    .maybeSingle();

  if (subError) {
    return Response.json({ error: subError.message }, { status: 500 });
  }

  if (!subscription) {
    return Response.json({ error: 'No active subscription' }, { status: 404 });
  }

  const callsUsed = Number(subscription.calls_used ?? 0);
  const callsIncluded = Number(subscription.calls_limit ?? 0);

  // Overage math — rate sourced from PRICING_TIERS (Starter $2.48, Growth $2.08, Scale $1.50)
  const planTier = PRICING_TIERS.find((t) => t.id === subscription.plan_id);
  const overageRate = planTier?.overageRate ?? 0;
  const overageCalls = Math.max(0, callsUsed - callsIncluded);
  const overageDollarsRaw = overageCalls * overageRate;
  // Round to 2 decimal places for stable display / comparison
  const overageDollars = Math.round(overageDollarsRaw * 100) / 100;

  // cycleDaysLeft — uses server UTC clock, never trusts client (threat model T-48-06)
  let cycleDaysLeft = 0;
  if (subscription.current_period_end) {
    const end = new Date(subscription.current_period_end).getTime();
    const now = Date.now();
    const diffMs = end - now;
    cycleDaysLeft = Math.max(0, Math.ceil(diffMs / 86400000));
  }

  return Response.json({
    callsUsed,
    callsIncluded,
    cycleDaysLeft,
    overageDollars,
  });
}

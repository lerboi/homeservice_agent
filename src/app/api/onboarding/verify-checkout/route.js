import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase as adminSupabase } from '@/lib/supabase';

export async function GET() {
  const supabaseServer = await createSupabaseServer();
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: tenant } = await adminSupabase
    .from('tenants')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!tenant) {
    return Response.json({ verified: false });
  }

  const { data: subscription } = await adminSupabase
    .from('subscriptions')
    .select('plan_id, trial_ends_at, status')
    .eq('tenant_id', tenant.id)
    .eq('is_current', true)
    .maybeSingle();

  if (!subscription || subscription.status !== 'trialing') {
    return Response.json({ verified: false });
  }

  const planNames = { starter: 'Starter', growth: 'Growth', scale: 'Scale' };

  return Response.json({
    verified: true,
    planName: planNames[subscription.plan_id] || subscription.plan_id,
    trialEndDate: subscription.trial_ends_at,
  });
}

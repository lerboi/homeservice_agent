import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase as adminSupabase } from '@/lib/supabase';

export async function POST() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify a subscription exists before marking onboarding complete
  // Prevents bypass via direct API call without payment
  const { data: tenant } = await adminSupabase
    .from('tenants')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!tenant) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const { data: sub } = await adminSupabase
    .from('subscriptions')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('is_current', true)
    .maybeSingle();

  if (!sub) {
    return Response.json({ error: 'No active subscription found' }, { status: 403 });
  }

  await adminSupabase
    .from('tenants')
    .update({ onboarding_complete: true })
    .eq('owner_id', user.id);

  return Response.json({ complete: true });
}

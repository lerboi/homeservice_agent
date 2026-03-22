import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const serverSupabase = await createSupabaseServer();
  const { data: { user } } = await serverSupabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('onboarding_complete, retell_phone_number')
    .eq('owner_id', user.id)
    .single();

  if (!tenant) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  return Response.json({
    complete: tenant.onboarding_complete ?? false,
    retell_phone_number: tenant.retell_phone_number ?? null,
  });
}

import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const serverSupabase = await createSupabaseServer();
  const { data: { user } } = await serverSupabase.auth.getUser();
  if (!user) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('test_call_status, test_call_completed, phone_number')
    .eq('owner_id', user.id)
    .single();

  if (!tenant) {
    console.log('404: Not found');
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  // `complete` reflects the CURRENT attempt connecting — set to 'connected' by
  // the LiveKit participant_joined webhook (/api/webhooks/livekit). The trigger
  // route resets it to 'calling' at the start of each attempt, so a prior
  // success doesn't make a fresh attempt look instantly done. test_call_completed
  // is the durable "ever connected" flag the setup checklist reads.
  return Response.json({
    complete: tenant.test_call_status === 'connected',
    status: tenant.test_call_status ?? 'none',
    ever_completed: tenant.test_call_completed ?? false,
    phone_number: tenant.phone_number ?? null,
  });
}

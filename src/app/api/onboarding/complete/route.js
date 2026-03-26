import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase as adminSupabase } from '@/lib/supabase';

export async function POST() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await adminSupabase
    .from('tenants')
    .update({ onboarding_complete: true })
    .eq('owner_id', user.id);

  return Response.json({ complete: true });
}

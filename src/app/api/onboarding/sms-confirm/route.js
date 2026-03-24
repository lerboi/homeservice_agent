import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase as adminSupabase } from '@/lib/supabase';

export async function POST(request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { phone } = await request.json();

  // Always save the user's auth email; phone is optional
  const updateFields = { owner_email: user.email };
  if (phone?.trim()) updateFields.owner_phone = phone.trim();

  await adminSupabase
    .from('tenants')
    .update(updateFields)
    .eq('owner_id', user.id);

  return Response.json({ saved: true });
}

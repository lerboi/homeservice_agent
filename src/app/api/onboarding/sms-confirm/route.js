import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase as adminSupabase } from '@/lib/supabase';

export async function POST(request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { phone, email } = await request.json();

  // Save phone and email directly to tenant row (no OTP verification for now)
  const updateFields = {};
  if (phone?.trim()) updateFields.owner_phone = phone.trim();
  if (email?.trim()) updateFields.owner_email = email.trim();

  if (Object.keys(updateFields).length > 0) {
    await adminSupabase
      .from('tenants')
      .update(updateFields)
      .eq('owner_id', user.id);
  }

  return Response.json({ saved: true });
}

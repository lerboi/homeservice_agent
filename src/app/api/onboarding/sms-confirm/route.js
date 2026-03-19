import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase as adminSupabase } from '@/lib/supabase';

export async function POST(request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { phone, token, email } = await request.json();
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });

  if (error) return Response.json({ error: error.message }, { status: 400 });

  // Save verified phone AND email to tenant row (using service role for cross-RLS write)
  // owner_email column already exists in 001_initial_schema.sql
  const tenantId = user.user_metadata?.tenant_id;
  if (tenantId) {
    const updateFields = { owner_phone: phone };
    if (email?.trim()) {
      updateFields.owner_email = email.trim();
    }
    await adminSupabase
      .from('tenants')
      .update(updateFields)
      .eq('id', tenantId);
  }

  return Response.json({ verified: true });
}

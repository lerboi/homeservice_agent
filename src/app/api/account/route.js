import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const serverSupabase = await createSupabaseServer();
  const { data: { user } } = await serverSupabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, business_name, owner_name, owner_email, owner_phone, trade_type, country, created_at')
    .eq('owner_id', user.id)
    .single();

  if (error || !tenant) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  return Response.json({
    email: user.email,
    business_name: tenant.business_name,
    owner_name: tenant.owner_name,
    owner_email: tenant.owner_email,
    owner_phone: tenant.owner_phone,
    trade_type: tenant.trade_type,
    country: tenant.country,
    created_at: tenant.created_at,
  });
}

const ALLOWED_FIELDS = ['business_name', 'owner_name', 'owner_email', 'owner_phone'];

export async function PATCH(request) {
  const serverSupabase = await createSupabaseServer();
  const { data: { user } } = await serverSupabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  // Only allow updating known fields
  const updates = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      const value = typeof body[field] === 'string' ? body[field].trim() : body[field];
      updates[field] = value || null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // business_name is required — don't allow clearing it
  if ('business_name' in updates && !updates.business_name) {
    return Response.json({ error: 'Business name is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('tenants')
    .update(updates)
    .eq('owner_id', user.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}

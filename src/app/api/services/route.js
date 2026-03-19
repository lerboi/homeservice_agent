import { supabase } from '@/lib/supabase';
import { createSupabaseServer } from '@/lib/supabase-server';

const VALID_TAGS = ['emergency', 'routine', 'high_ticket'];

async function getTenantId() {
  const serverSupabase = await createSupabaseServer();
  const { data: { user } } = await serverSupabase.auth.getUser();
  if (!user) return null;
  return user.user_metadata?.tenant_id || null;
}

export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('services')
    .select('id, name, urgency_tag, created_at')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ services: data });
}

export async function POST(request) {
  const tenantId = await getTenantId();
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, urgency_tag = 'routine' } = await request.json();
  if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 });

  if (!VALID_TAGS.includes(urgency_tag)) {
    return Response.json({ error: 'Invalid urgency_tag' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('services')
    .insert({ tenant_id: tenantId, name: name.trim(), urgency_tag })
    .select('id, name, urgency_tag, created_at')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ service: data }, { status: 201 });
}

export async function PUT(request) {
  const tenantId = await getTenantId();
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, urgency_tag } = await request.json();
  if (!VALID_TAGS.includes(urgency_tag)) {
    return Response.json({ error: 'Invalid urgency_tag' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('services')
    .update({ urgency_tag })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('id, name, urgency_tag')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ service: data });
}

export async function DELETE(request) {
  const tenantId = await getTenantId();
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  const { error } = await supabase
    .from('services')
    .update({ is_active: false })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ deleted: true });
}

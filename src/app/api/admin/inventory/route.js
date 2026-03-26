import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 25;

export async function GET(request) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '0', 10);
  const search = searchParams.get('search') || '';

  let query = supabase
    .from('phone_inventory')
    .select('*, assigned_tenant:tenants(business_name, owner_name)', { count: 'exact' });

  if (search) {
    query = query.ilike('phone_number', '%' + search + '%');
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, total: count, page, pageSize: PAGE_SIZE });
}

export async function POST(request) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { phone_number } = body;

  if (!phone_number) {
    return NextResponse.json({ error: 'phone_number is required' }, { status: 400 });
  }

  // Normalize: prepend +65 if not already present
  const normalized = phone_number.startsWith('+65')
    ? phone_number
    : '+65' + phone_number;

  // Validate: must match +65 followed by exactly 8 digits
  if (!/^\+65\d{8}$/.test(normalized)) {
    return NextResponse.json(
      { error: 'Invalid SG number format. Expected 8 digits.' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('phone_inventory')
    .insert({ phone_number: normalized, country: 'SG', status: 'available' })
    .select()
    .single();

  if (error) {
    // Unique violation
    if (error.code === '23505') {
      return NextResponse.json({ error: 'duplicate' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}

export async function PATCH(request) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { id, action } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  if (!['retire', 'reactivate'].includes(action)) {
    return NextResponse.json(
      { error: 'action must be "retire" or "reactivate"' },
      { status: 400 }
    );
  }

  const updatePayload =
    action === 'retire'
      ? { status: 'retired', assigned_tenant_id: null }
      : { status: 'available', assigned_tenant_id: null };

  const { data, error } = await supabase
    .from('phone_inventory')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

import { supabase } from '@/lib/supabase';
import { getTenantId } from '@/lib/get-tenant-id';

const VALID_NOTIFICATION_PREFS = ['sms', 'email', 'both'];
const VALID_TIMEOUTS = [15, 30, 45, 60];
const MAX_ACTIVE_CONTACTS = 5;

/**
 * Validate contact body fields.
 * Returns { valid: true } or { valid: false, error: string, status: number }
 */
function validateContactBody({ name, phone, email, notification_pref, timeout_seconds }) {
  if (!name?.trim()) {
    return { valid: false, error: 'Name is required', status: 400 };
  }

  const pref = notification_pref ?? 'both';
  if (!VALID_NOTIFICATION_PREFS.includes(pref)) {
    return { valid: false, error: `notification_pref must be one of: ${VALID_NOTIFICATION_PREFS.join(', ')}`, status: 400 };
  }

  if (timeout_seconds !== undefined && !VALID_TIMEOUTS.includes(timeout_seconds)) {
    return { valid: false, error: `timeout_seconds must be one of: ${VALID_TIMEOUTS.join(', ')}`, status: 400 };
  }

  // At least one of phone or email required
  if (!phone && !email) {
    return { valid: false, error: 'At least one of phone or email is required', status: 400 };
  }

  // Phone required for SMS-based prefs
  if (['sms', 'both'].includes(pref) && !phone) {
    return { valid: false, error: 'Phone is required for SMS notification preference', status: 400 };
  }

  // Email required for email-based prefs
  if (['email', 'both'].includes(pref) && !email) {
    return { valid: false, error: 'Email is required for email notification preference', status: 400 };
  }

  return { valid: true };
}

export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) {
    console.log('401: Unauthorized (GET)');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('escalation_contacts')
    .select('id, name, role, phone, email, notification_pref, timeout_seconds, sort_order, is_active, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.log('500:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ contacts: data });
}

export async function POST(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    console.log('401: Unauthorized (POST)');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, role, phone, email, notification_pref = 'both', timeout_seconds = 30 } = body;

  const validation = validateContactBody({ name, phone, email, notification_pref, timeout_seconds });
  if (!validation.valid) {
    console.log('' + validation.status + ':', validation.error);
    return Response.json({ error: validation.error }, { status: validation.status });
  }

  // Enforce max 5 active contacts per tenant
  const { count, error: countError } = await supabase
    .from('escalation_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (countError) {
    console.log('500:', countError.message);
    return Response.json({ error: countError.message }, { status: 500 });
  }
  if (count >= MAX_ACTIVE_CONTACTS) {
    console.log('400: Maximum 5 escalation contacts allowed');
    return Response.json({ error: 'Maximum 5 escalation contacts allowed' }, { status: 400 });
  }

  // Compute sort_order: max existing sort_order + 1
  const { data: maxRow } = await supabase
    .from('escalation_contacts')
    .select('sort_order')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sort_order = maxRow ? maxRow.sort_order + 1 : 0;

  const { data, error } = await supabase
    .from('escalation_contacts')
    .insert({
      tenant_id: tenantId,
      name: name.trim(),
      role: role?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      notification_pref,
      timeout_seconds,
      sort_order,
    })
    .select('id, name, role, phone, email, notification_pref, timeout_seconds, sort_order, is_active, created_at, updated_at')
    .single();

  if (error) {
    console.log('500:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ contact: data }, { status: 201 });
}

export async function PUT(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    console.log('401: Unauthorized (PUT)');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { id, name, role, phone, email, notification_pref = 'both', timeout_seconds = 30 } = body;

  if (!id) {
    console.log('400: id is required (PUT)');
    return Response.json({ error: 'id is required' }, { status: 400 });
  }

  const validation = validateContactBody({ name, phone, email, notification_pref, timeout_seconds });
  if (!validation.valid) {
    console.log('' + validation.status + ':', validation.error);
    return Response.json({ error: validation.error }, { status: validation.status });
  }

  const { data, error } = await supabase
    .from('escalation_contacts')
    .update({
      name: name.trim(),
      role: role?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      notification_pref,
      timeout_seconds,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('id, name, role, phone, email, notification_pref, timeout_seconds, sort_order, is_active, created_at, updated_at')
    .single();

  if (error) {
    console.log('500:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ contact: data });
}

export async function DELETE(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    console.log('401: Unauthorized (DELETE)');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await request.json();
  if (!id) {
    console.log('400: id is required (DELETE)');
    return Response.json({ error: 'id is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('escalation_contacts')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) {
    console.log('500:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ deleted: true });
}

export async function PATCH(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    console.log('401: Unauthorized (PATCH)');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { order } = await request.json();
  if (!Array.isArray(order)) {
    console.log('400: order must be an array');
    return Response.json({ error: 'order must be an array of { id, sort_order }' }, { status: 400 });
  }

  // CRITICAL: Include tenant_id in every upsert row — required by RLS WITH CHECK
  const { error } = await supabase
    .from('escalation_contacts')
    .upsert(
      order.map(({ id, sort_order }) => ({ id, tenant_id: tenantId, sort_order })),
      { onConflict: 'id' }
    );

  if (error) {
    console.log('500:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}

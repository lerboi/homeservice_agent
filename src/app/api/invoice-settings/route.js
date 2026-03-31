import { createSupabaseServer } from '@/lib/supabase-server';
import { getTenantId } from '@/lib/get-tenant-id';

/**
 * GET /api/invoice-settings
 * Returns the invoice_settings row for the current tenant.
 * Auto-creates a row seeded from tenants.business_name and tenants.owner_email
 * if none exists yet (first-time setup).
 */
export async function GET() {
  const supabase = await createSupabaseServer();
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Try to fetch existing settings
  const { data: existing, error: fetchError } = await supabase
    .from('invoice_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (fetchError) {
    console.error('[invoice-settings GET] fetch error:', fetchError.message);
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  if (existing) {
    return Response.json({ settings: existing });
  }

  // No row yet — auto-create from tenant data
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('business_name, owner_email')
    .eq('id', tenantId)
    .single();

  if (tenantError) {
    console.error('[invoice-settings GET] tenant fetch error:', tenantError.message);
    return Response.json({ error: tenantError.message }, { status: 500 });
  }

  const { data: created, error: insertError } = await supabase
    .from('invoice_settings')
    .insert({
      tenant_id: tenantId,
      business_name: tenant.business_name ?? null,
      email: tenant.owner_email ?? null,
      tax_rate: 0,
      payment_terms: 'Net 30',
      invoice_prefix: 'INV',
    })
    .select()
    .single();

  if (insertError) {
    console.error('[invoice-settings GET] insert error:', insertError.message);
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  return Response.json({ settings: created });
}

/**
 * PATCH /api/invoice-settings
 * Updates invoice_settings for the current tenant.
 *
 * Allowed fields: business_name, address, phone, email, logo_url,
 *   license_number, tax_rate, payment_terms, default_notes, invoice_prefix
 *
 * Validations:
 *   - tax_rate: number 0–1 (e.g. 0.0825 = 8.25%)
 *   - payment_terms: one of 'Net 15' | 'Net 30' | 'Net 45' | 'Net 60'
 *   - invoice_prefix: 1–10 alphanumeric characters
 */
export async function PATCH(request) {
  const supabase = await createSupabaseServer();
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const ALLOWED_FIELDS = [
    'business_name',
    'address',
    'phone',
    'email',
    'logo_url',
    'license_number',
    'tax_rate',
    'payment_terms',
    'default_notes',
    'invoice_prefix',
  ];

  const VALID_PAYMENT_TERMS = ['Net 15', 'Net 30', 'Net 45', 'Net 60'];

  // Validate tax_rate
  if (body.tax_rate !== undefined) {
    const rate = Number(body.tax_rate);
    if (isNaN(rate) || rate < 0 || rate > 1) {
      return Response.json(
        { error: 'tax_rate must be a number between 0 and 1 (e.g. 0.0825 for 8.25%)' },
        { status: 400 }
      );
    }
  }

  // Validate payment_terms
  if (body.payment_terms !== undefined) {
    if (!VALID_PAYMENT_TERMS.includes(body.payment_terms)) {
      return Response.json(
        { error: `payment_terms must be one of: ${VALID_PAYMENT_TERMS.join(', ')}` },
        { status: 400 }
      );
    }
  }

  // Validate invoice_prefix
  if (body.invoice_prefix !== undefined) {
    if (!/^[a-zA-Z0-9]{1,10}$/.test(body.invoice_prefix)) {
      return Response.json(
        { error: 'invoice_prefix must be 1–10 alphanumeric characters' },
        { status: 400 }
      );
    }
  }

  // Build update payload from allowed fields only
  const updateData = { updated_at: new Date().toISOString() };
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('invoice_settings')
    .update(updateData)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (updateError) {
    console.error('[invoice-settings PATCH] update error:', updateError.message);
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ settings: updated });
}

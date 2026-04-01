import { createSupabaseServer } from '@/lib/supabase-server';
import { getTenantId } from '@/lib/get-tenant-id';
import { calculateLineTotal, calculateInvoiceTotals } from '@/lib/invoice-calculations';

/**
 * GET /api/estimates/[id]
 * Returns a single estimate with its line items and tiers.
 */
export async function GET(request, { params }) {
  const supabase = await createSupabaseServer();
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const { data: estimate, error: estimateError } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (estimateError || !estimate) {
    return Response.json({ error: 'Estimate not found' }, { status: 404 });
  }

  // Fetch tiers ordered by sort_order
  const { data: tiers } = await supabase
    .from('estimate_tiers')
    .select('*')
    .eq('estimate_id', id)
    .order('sort_order', { ascending: true });

  // Fetch line items ordered by sort_order
  const { data: lineItems } = await supabase
    .from('estimate_line_items')
    .select('*')
    .eq('estimate_id', id)
    .order('sort_order', { ascending: true });

  return Response.json({
    estimate,
    tiers: tiers || [],
    line_items: lineItems || [],
  });
}

/**
 * PATCH /api/estimates/[id]
 * Update an estimate. Handles status transitions and line item/tier replacement.
 *
 * Status transitions:
 *   - Set sent_at when status changes to 'sent'
 *   - Set approved_at when status changes to 'approved'
 *   - Set declined_at when status changes to 'declined'
 */
export async function PATCH(request, { params }) {
  const supabase = await createSupabaseServer();
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Fetch current estimate to verify ownership
  const { data: current, error: fetchError } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (fetchError || !current) {
    return Response.json({ error: 'Estimate not found' }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const updateData = { updated_at: new Date().toISOString() };

  // Editable fields
  const editableFields = [
    'customer_name', 'customer_phone', 'customer_email', 'customer_address',
    'job_type', 'valid_until', 'notes',
  ];
  for (const field of editableFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  // Status transitions
  if (body.status !== undefined) {
    updateData.status = body.status;
    if (body.status === 'sent' && !current.sent_at) {
      updateData.sent_at = new Date().toISOString();
    }
    if (body.status === 'approved') {
      updateData.approved_at = new Date().toISOString();
    }
    if (body.status === 'declined') {
      updateData.declined_at = new Date().toISOString();
    }
  }

  // Fetch tax rate for recalculations
  const { data: settingsRow } = await supabase
    .from('invoice_settings')
    .select('tax_rate')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const taxRate = Number(settingsRow?.tax_rate) || 0;

  // Handle tiers replacement
  if (Array.isArray(body.tiers)) {
    // Delete existing tiers and line items (cascade deletes line items via FK)
    await supabase.from('estimate_tiers').delete().eq('estimate_id', id);
    // Also delete any orphaned line items (with null tier_id)
    await supabase.from('estimate_line_items').delete().eq('estimate_id', id);

    // Set estimate-level totals to NULL for tiered
    updateData.subtotal = null;
    updateData.tax_amount = null;
    updateData.total = null;

    for (let i = 0; i < body.tiers.length; i++) {
      const tier = body.tiers[i];
      const tierLineItems = tier.line_items || [];
      const tierTotals = calculateInvoiceTotals(tierLineItems, taxRate);

      const { data: tierRow, error: tierError } = await supabase
        .from('estimate_tiers')
        .insert({
          estimate_id: id,
          tenant_id: tenantId,
          tier_label: tier.tier_label || `Tier ${i + 1}`,
          sort_order: i,
          subtotal: tierTotals.subtotal,
          tax_amount: tierTotals.tax_amount,
          total: tierTotals.total,
        })
        .select()
        .single();

      if (tierError) {
        return Response.json({ error: 'Failed to update tier: ' + tierError.message }, { status: 500 });
      }

      if (tierLineItems.length > 0) {
        const lineItemRows = tierLineItems.map((item, idx) => ({
          estimate_id: id,
          tier_id: tierRow.id,
          tenant_id: tenantId,
          sort_order: item.sort_order ?? idx,
          item_type: item.item_type,
          description: item.description || '',
          quantity: item.quantity ?? 1,
          unit_price: item.unit_price ?? 0,
          markup_pct: item.markup_pct ?? 0,
          taxable: item.taxable !== false,
          line_total: calculateLineTotal(item.item_type, {
            quantity: item.quantity,
            unit_price: item.unit_price,
            markup_pct: item.markup_pct,
          }),
        }));

        const { error: liError } = await supabase
          .from('estimate_line_items')
          .insert(lineItemRows);

        if (liError) {
          return Response.json({ error: 'Failed to insert tier line items: ' + liError.message }, { status: 500 });
        }
      }
    }
  } else if (Array.isArray(body.line_items)) {
    // Single-price line items replacement
    // Delete existing line items and tiers
    await supabase.from('estimate_tiers').delete().eq('estimate_id', id);
    await supabase.from('estimate_line_items').delete().eq('estimate_id', id);

    const { subtotal, tax_amount, total } = calculateInvoiceTotals(body.line_items, taxRate);
    updateData.subtotal = subtotal;
    updateData.tax_amount = tax_amount;
    updateData.total = total;

    if (body.line_items.length > 0) {
      const lineItemRows = body.line_items.map((item, idx) => ({
        estimate_id: id,
        tier_id: null,
        tenant_id: tenantId,
        sort_order: item.sort_order ?? idx,
        item_type: item.item_type,
        description: item.description || '',
        quantity: item.quantity ?? 1,
        unit_price: item.unit_price ?? 0,
        markup_pct: item.markup_pct ?? 0,
        taxable: item.taxable !== false,
        line_total: calculateLineTotal(item.item_type, {
          quantity: item.quantity,
          unit_price: item.unit_price,
          markup_pct: item.markup_pct,
        }),
      }));

      const { error: liError } = await supabase
        .from('estimate_line_items')
        .insert(lineItemRows);

      if (liError) {
        return Response.json({ error: 'Failed to insert line items: ' + liError.message }, { status: 500 });
      }
    }
  }

  // Apply the update
  const { data: updatedEstimate, error: updateError } = await supabase
    .from('estimates')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  // Fetch updated tiers and line items
  const { data: tiers } = await supabase
    .from('estimate_tiers')
    .select('*')
    .eq('estimate_id', id)
    .order('sort_order', { ascending: true });

  const { data: lineItems } = await supabase
    .from('estimate_line_items')
    .select('*')
    .eq('estimate_id', id)
    .order('sort_order', { ascending: true });

  return Response.json({
    estimate: updatedEstimate,
    tiers: tiers || [],
    line_items: lineItems || [],
  });
}

/**
 * DELETE /api/estimates/[id]
 * Delete an estimate. Only allowed when status is 'draft'.
 * Cascades to line items and tiers via FK ON DELETE CASCADE.
 */
export async function DELETE(request, { params }) {
  const supabase = await createSupabaseServer();
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Fetch current estimate to check status
  const { data: current, error: fetchError } = await supabase
    .from('estimates')
    .select('id, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (fetchError || !current) {
    return Response.json({ error: 'Estimate not found' }, { status: 404 });
  }

  if (current.status !== 'draft') {
    return Response.json(
      { error: `Cannot delete estimate with status '${current.status}'. Only draft estimates can be deleted.` },
      { status: 400 }
    );
  }

  const { error: deleteError } = await supabase
    .from('estimates')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (deleteError) {
    return Response.json({ error: deleteError.message }, { status: 500 });
  }

  return Response.json({ success: true });
}

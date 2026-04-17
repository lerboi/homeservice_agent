import { createSupabaseServer } from '@/lib/supabase-server';
import { getTenantId } from '@/lib/get-tenant-id';
import { getTenantFeatures } from '@/lib/features';
import { formatInvoiceNumber } from '@/lib/invoice-number';

/**
 * POST /api/estimates/[id]/convert
 *
 * Convert an approved estimate to a draft invoice.
 * Idempotent: if already converted, returns existing invoice ID.
 *
 * Body (optional): { tier_id } -- required for tiered estimates to select
 * which tier to convert.
 *
 * Per D-05: Creates a new draft invoice copying customer info,
 * selected line items, and calculated totals from the estimate.
 */
export async function POST(request, { params }) {
  const supabase = await createSupabaseServer();
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const features = await getTenantFeatures(tenantId);
  if (!features.invoicing) {
    return new Response(null, { status: 404 });
  }

  const { id } = await params;

  // Parse optional body
  let body = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional for single-price estimates
  }

  const { tier_id } = body;

  // ── Fetch estimate with tenant guard ──────────────────────────────────────

  const { data: estimate, error: estimateError } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (estimateError || !estimate) {
    return Response.json({ error: 'Estimate not found' }, { status: 404 });
  }

  // ── Idempotency check: prevent double conversion (Research pitfall 5) ─────

  if (estimate.converted_to_invoice_id) {
    return Response.json({
      invoice_id: estimate.converted_to_invoice_id,
      already_converted: true,
    });
  }

  // ── Fetch tiers to determine if tiered ────────────────────────────────────

  const { data: tiers } = await supabase
    .from('estimate_tiers')
    .select('*')
    .eq('estimate_id', id)
    .order('sort_order', { ascending: true });

  const isTiered = tiers && tiers.length > 0;

  // ── Determine line items to use ───────────────────────────────────────────

  let selectedLineItems;
  let invoiceSubtotal, invoiceTaxAmount, invoiceTotal;

  if (isTiered) {
    // Tiered estimate -- tier_id is required
    if (!tier_id) {
      return Response.json(
        { error: 'tier_id required for tiered estimates' },
        { status: 400 }
      );
    }

    const selectedTier = tiers.find((t) => t.id === tier_id);
    if (!selectedTier) {
      return Response.json({ error: 'Invalid tier_id' }, { status: 400 });
    }

    // Fetch line items for selected tier
    const { data: tierLineItems } = await supabase
      .from('estimate_line_items')
      .select('*')
      .eq('estimate_id', id)
      .eq('tier_id', tier_id)
      .order('sort_order', { ascending: true });

    selectedLineItems = tierLineItems || [];
    invoiceSubtotal = selectedTier.subtotal;
    invoiceTaxAmount = selectedTier.tax_amount;
    invoiceTotal = selectedTier.total;
  } else {
    // Single-price estimate -- use all line items
    const { data: allLineItems } = await supabase
      .from('estimate_line_items')
      .select('*')
      .eq('estimate_id', id)
      .order('sort_order', { ascending: true });

    selectedLineItems = allLineItems || [];
    invoiceSubtotal = estimate.subtotal;
    invoiceTaxAmount = estimate.tax_amount;
    invoiceTotal = estimate.total;
  }

  // ── Get next invoice number via RPC ───────────────────────────────────────

  const currentYear = new Date().getFullYear();

  // Fetch invoice prefix from settings
  const { data: settingsRow } = await supabase
    .from('invoice_settings')
    .select('invoice_prefix')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const invoicePrefix = settingsRow?.invoice_prefix || 'INV';

  const { data: seqData, error: seqError } = await supabase.rpc('get_next_invoice_number', {
    p_tenant_id: tenantId,
    p_year: currentYear,
  });

  if (seqError) {
    return Response.json(
      { error: 'Failed to generate invoice number: ' + seqError.message },
      { status: 500 }
    );
  }

  const invoiceNumber = formatInvoiceNumber(invoicePrefix, currentYear, seqData);

  // ── Insert new draft invoice ──────────────────────────────────────────────

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      tenant_id: tenantId,
      lead_id: estimate.lead_id || null,
      invoice_number: invoiceNumber,
      status: 'draft',
      customer_name: estimate.customer_name,
      customer_phone: estimate.customer_phone,
      customer_email: estimate.customer_email,
      customer_address: estimate.customer_address,
      job_type: estimate.job_type,
      issued_date: new Date().toISOString().split('T')[0],
      subtotal: invoiceSubtotal,
      tax_amount: invoiceTaxAmount,
      total: invoiceTotal,
    })
    .select()
    .single();

  if (invoiceError) {
    return Response.json(
      { error: 'Failed to create invoice: ' + invoiceError.message },
      { status: 500 }
    );
  }

  // ── Insert line items into invoice_line_items ─────────────────────────────

  if (selectedLineItems.length > 0) {
    const invoiceLineItems = selectedLineItems.map((item) => ({
      invoice_id: invoice.id,
      tenant_id: tenantId,
      sort_order: item.sort_order,
      item_type: item.item_type,
      description: item.description || '',
      quantity: item.quantity,
      unit_price: item.unit_price,
      markup_pct: item.markup_pct,
      taxable: item.taxable,
      line_total: item.line_total,
    }));

    const { error: liError } = await supabase
      .from('invoice_line_items')
      .insert(invoiceLineItems);

    if (liError) {
      console.error('[estimate-convert] Failed to insert invoice line items:', liError.message);
      // Invoice was created -- continue and update reference
    }
  }

  // ── Update estimate with converted_to_invoice_id ──────────────────────────

  await supabase
    .from('estimates')
    .update({
      converted_to_invoice_id: invoice.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  return Response.json({
    invoice_id: invoice.id,
    invoice_number: invoiceNumber,
  });
}

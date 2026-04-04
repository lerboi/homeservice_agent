import { createSupabaseServer } from '@/lib/supabase-server';
import { getTenantId } from '@/lib/get-tenant-id';
import { formatInvoiceNumber } from '@/lib/invoice-number';
import { calculateLineTotal, calculateInvoiceTotals } from '@/lib/invoice-calculations';

const VALID_STATUSES = ['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'void'];

/**
 * GET /api/invoices
 * Returns paginated invoice list with summary aggregates and status counts.
 *
 * Query params:
 *   status  — filter by invoice status (one of VALID_STATUSES)
 *   search  — filter by customer_name or invoice_number (case-insensitive substring)
 *
 * Before listing, bulk-updates sent invoices past their due_date to 'overdue'.
 *
 * Returns: { invoices, summary: { total_outstanding, overdue_amount, paid_this_month }, status_counts }
 */
export async function GET(request) {
  const supabase = await createSupabaseServer();
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');
  const search = searchParams.get('search');
  const leadId = searchParams.get('lead_id');

  // Bulk-update overdue invoices (sent + past due_date → overdue)
  const today = new Date().toISOString().split('T')[0];
  await supabase
    .from('invoices')
    .update({ status: 'overdue', updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('status', 'sent')
    .lt('due_date', today);

  // Pagination
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 500);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  // Build list query
  let query = supabase
    .from('invoices')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (statusFilter === 'recurring') {
    // Special filter: show recurring templates regardless of status
    query = query.eq('is_recurring_template', true);
  } else if (statusFilter && VALID_STATUSES.includes(statusFilter)) {
    query = query.eq('status', statusFilter);
  }

  if (search) {
    query = query.or(`customer_name.ilike.%${search}%,invoice_number.ilike.%${search}%`);
  }

  if (leadId) {
    query = query.eq('lead_id', leadId);
  }

  const leadIds = searchParams.get('lead_ids');
  if (leadIds) {
    query = query.in('lead_id', leadIds.split(',').filter(Boolean));
  }

  query = query.range(offset, offset + limit - 1);

  const { data: invoices, error: listError, count: totalCount } = await query;
  if (listError) {
    return Response.json({ error: listError.message }, { status: 500 });
  }

  // Single aggregate query — replaces 4 separate queries
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { data: allInvoices } = await supabase
    .from('invoices')
    .select('status, total, paid_at')
    .eq('tenant_id', tenantId);

  const status_counts = {};
  for (const status of VALID_STATUSES) {
    status_counts[status] = 0;
  }

  let total_outstanding = 0;
  let overdue_amount = 0;
  let paid_this_month = 0;

  for (const inv of allInvoices || []) {
    const total = Number(inv.total) || 0;
    if (status_counts[inv.status] !== undefined) {
      status_counts[inv.status]++;
    }
    if (inv.status === 'sent' || inv.status === 'overdue') {
      total_outstanding += total;
    }
    if (inv.status === 'overdue') {
      overdue_amount += total;
    }
    if (inv.status === 'paid' && inv.paid_at && inv.paid_at >= firstOfMonth) {
      paid_this_month += total;
    }
  }

  return Response.json({
    invoices: invoices || [],
    total_count: totalCount ?? (invoices || []).length,
    limit,
    offset,
    summary: {
      total_outstanding: Number(total_outstanding.toFixed(2)),
      overdue_amount: Number(overdue_amount.toFixed(2)),
      paid_this_month: Number(paid_this_month.toFixed(2)),
    },
    status_counts,
  });
}

/**
 * POST /api/invoices
 * Create a new invoice with atomic sequential invoice number.
 *
 * Body: {
 *   lead_id?, customer_name, customer_phone, customer_email, customer_address,
 *   job_type, issued_date, due_date, notes, payment_terms,
 *   line_items: [{ item_type, description, quantity, unit_price, markup_pct, taxable, sort_order }]
 * }
 */
export async function POST(request) {
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

  const {
    lead_id,
    title,
    customer_name,
    customer_phone,
    customer_email,
    customer_address,
    job_type,
    issued_date,
    due_date,
    notes,
    payment_terms,
    line_items = [],
  } = body;

  // Fetch invoice settings for this tenant (use defaults if none configured)
  const { data: settingsRow } = await supabase
    .from('invoice_settings')
    .select('invoice_prefix, tax_rate, payment_terms')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const settings = settingsRow || { invoice_prefix: 'INV', tax_rate: 0, payment_terms: 'Net 30' };

  // Atomically get the next invoice sequence number
  const currentYear = new Date().getFullYear();
  const { data: seqData, error: seqError } = await supabase.rpc('get_next_invoice_number', {
    p_tenant_id: tenantId,
    p_year: currentYear,
  });

  if (seqError) {
    return Response.json({ error: 'Failed to generate invoice number: ' + seqError.message }, { status: 500 });
  }

  const invoiceNumber = formatInvoiceNumber(settings.invoice_prefix || 'INV', currentYear, seqData);

  // Calculate totals from line items
  const taxRate = Number(settings.tax_rate) || 0;
  const { subtotal, tax_amount, total } = calculateInvoiceTotals(line_items, taxRate);

  // Insert the invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      tenant_id: tenantId,
      lead_id: lead_id || null,
      title: title || null,
      invoice_number: invoiceNumber,
      status: 'draft',
      customer_name: customer_name || null,
      customer_phone: customer_phone || null,
      customer_email: customer_email || null,
      customer_address: customer_address || null,
      job_type: job_type || null,
      issued_date: issued_date || new Date().toISOString().split('T')[0],
      due_date: due_date || null,
      notes: notes || null,
      payment_terms: payment_terms || settings.payment_terms || 'Net 30',
      subtotal,
      tax_amount,
      total,
    })
    .select()
    .single();

  if (invoiceError) {
    return Response.json({ error: invoiceError.message }, { status: 500 });
  }

  // Insert line items
  let insertedLineItems = [];
  if (line_items.length > 0) {
    const lineItemRows = line_items.map((item, idx) => ({
      invoice_id: invoice.id,
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

    const { data: li, error: liError } = await supabase
      .from('invoice_line_items')
      .insert(lineItemRows)
      .select();

    if (liError) {
      return Response.json({ error: 'Failed to insert line items: ' + liError.message }, { status: 500 });
    }
    insertedLineItems = li || [];
  }

  return Response.json({ invoice, line_items: insertedLineItems }, { status: 201 });
}

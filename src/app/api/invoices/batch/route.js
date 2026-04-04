import { createSupabaseServer } from '@/lib/supabase-server';
import { getTenantId } from '@/lib/get-tenant-id';
import { formatInvoiceNumber } from '@/lib/invoice-number';

/**
 * POST /api/invoices/batch
 *
 * Create draft invoices in batch from multiple completed leads.
 * Each lead produces a separate draft invoice with pre-filled customer data.
 * No line items are created — owner adds them during review.
 *
 * Body: { lead_ids: string[] }
 * Returns: 201 { invoices: [...], errors: [{ lead_id, reason }] }
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

  const { lead_ids } = body;

  // ── Validate lead_ids ──────────────────────────────────────────────────────

  if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
    return Response.json({ error: 'lead_ids must be a non-empty array' }, { status: 400 });
  }

  if (lead_ids.length > 50) {
    return Response.json({ error: 'Maximum 50 leads per batch' }, { status: 400 });
  }

  // ── Fetch all leads ────────────────────────────────────────────────────────

  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('*')
    .in('id', lead_ids)
    .eq('tenant_id', tenantId);

  if (leadsError) {
    return Response.json({ error: leadsError.message }, { status: 500 });
  }

  // Validate all requested leads were found (RLS handles tenant isolation)
  if (!leads || leads.length === 0) {
    return Response.json({ error: 'No matching leads found' }, { status: 404 });
  }

  // ── Check which leads already have invoices ────────────────────────────────

  const { data: existingInvoices } = await supabase
    .from('invoices')
    .select('lead_id')
    .in('lead_id', lead_ids)
    .eq('tenant_id', tenantId);

  const existingInvoiceLeadIds = new Set((existingInvoices || []).map((inv) => inv.lead_id));

  // ── Fetch invoice settings ─────────────────────────────────────────────────

  const { data: settingsRow } = await supabase
    .from('invoice_settings')
    .select('invoice_prefix, tax_rate, payment_terms')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const settings = settingsRow || { invoice_prefix: 'INV', tax_rate: 0, payment_terms: 'Net 30' };

  // ── Create draft invoices ──────────────────────────────────────────────────

  const invoices = [];
  const errors = [];
  const currentYear = new Date().getFullYear();
  const today = new Date().toISOString().split('T')[0];

  for (const lead of leads) {
    // Skip non-completed leads
    if (lead.status !== 'completed') {
      errors.push({ lead_id: lead.id, reason: `Lead status is '${lead.status}', expected 'completed'` });
      continue;
    }

    // Skip leads that already have an invoice
    if (existingInvoiceLeadIds.has(lead.id)) {
      errors.push({ lead_id: lead.id, reason: 'Lead already has an invoice' });
      continue;
    }

    // Get next invoice number atomically
    const { data: seqData, error: seqError } = await supabase.rpc('get_next_invoice_number', {
      p_tenant_id: tenantId,
      p_year: currentYear,
    });

    if (seqError) {
      errors.push({ lead_id: lead.id, reason: 'Failed to generate invoice number: ' + seqError.message });
      continue;
    }

    const invoiceNumber = formatInvoiceNumber(settings.invoice_prefix || 'INV', currentYear, seqData);

    // Insert draft invoice with customer data from lead
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        tenant_id: tenantId,
        lead_id: lead.id,
        invoice_number: invoiceNumber,
        status: 'draft',
        customer_name: lead.caller_name || null,
        customer_phone: lead.from_number || null,
        customer_email: lead.email || null,
        customer_address: lead.service_address || null,
        job_type: lead.job_type || null,
        title: lead.job_type ? lead.job_type.charAt(0).toUpperCase() + lead.job_type.slice(1) : null,
        issued_date: today,
        due_date: null,
        payment_terms: settings.payment_terms || 'Net 30',
        subtotal: 0,
        tax_amount: 0,
        total: 0,
      })
      .select()
      .single();

    if (invoiceError) {
      errors.push({ lead_id: lead.id, reason: invoiceError.message });
      continue;
    }

    invoices.push(invoice);
  }

  // Also report lead_ids that were requested but not found
  const foundLeadIds = new Set(leads.map((l) => l.id));
  for (const requestedId of lead_ids) {
    if (!foundLeadIds.has(requestedId)) {
      errors.push({ lead_id: requestedId, reason: 'Lead not found' });
    }
  }

  return Response.json({ invoices, errors }, { status: 201 });
}

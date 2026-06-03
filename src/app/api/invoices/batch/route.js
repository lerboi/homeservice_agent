import { createSupabaseServer } from '@/lib/supabase-server';
import { getTenantId } from '@/lib/get-tenant-id';
import { getTenantFeatures } from '@/lib/features';
import { formatInvoiceNumber } from '@/lib/invoice-number';

/**
 * POST /api/invoices/batch
 *
 * Create draft invoices in batch from multiple completed jobs.
 * Each job produces a separate draft invoice with pre-filled customer data
 * (name/phone/email from the linked customer, service address from the
 * linked appointment). No line items are created — owner adds them during review.
 *
 * Body: { job_ids: string[] }
 * Returns: 201 { invoices: [...], errors: [{ job_id, reason }] }
 */
export async function POST(request) {
  const supabase = await createSupabaseServer();
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const features = await getTenantFeatures(tenantId);
  if (!features.invoicing) {
    return new Response(null, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { job_ids } = body;

  // ── Validate job_ids ──────────────────────────────────────────────────────

  if (!Array.isArray(job_ids) || job_ids.length === 0) {
    return Response.json({ error: 'job_ids must be a non-empty array' }, { status: 400 });
  }

  if (job_ids.length > 50) {
    return Response.json({ error: 'Maximum 50 jobs per batch' }, { status: 400 });
  }

  // ── Fetch all jobs (with customer + appointment for pre-fill) ──────────────

  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, status, customer:customers!inner(name, phone_e164, email), appointment:appointments!inner(service_address)')
    .in('id', job_ids)
    .eq('tenant_id', tenantId);

  if (jobsError) {
    return Response.json({ error: jobsError.message }, { status: 500 });
  }

  // Validate all requested jobs were found (RLS handles tenant isolation)
  if (!jobs || jobs.length === 0) {
    return Response.json({ error: 'No matching jobs found' }, { status: 404 });
  }

  // ── Check which jobs already have invoices ─────────────────────────────────

  const { data: existingInvoices } = await supabase
    .from('invoices')
    .select('job_id')
    .in('job_id', job_ids)
    .eq('tenant_id', tenantId);

  const existingInvoiceJobIds = new Set((existingInvoices || []).map((inv) => inv.job_id));

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

  for (const job of jobs) {
    // Skip non-completed jobs
    if (job.status !== 'completed') {
      errors.push({ job_id: job.id, reason: `Job status is '${job.status}', expected 'completed'` });
      continue;
    }

    // Skip jobs that already have an invoice
    if (existingInvoiceJobIds.has(job.id)) {
      errors.push({ job_id: job.id, reason: 'Job already has an invoice' });
      continue;
    }

    // Get next invoice number atomically
    const { data: seqData, error: seqError } = await supabase.rpc('get_next_invoice_number', {
      p_tenant_id: tenantId,
      p_year: currentYear,
    });

    if (seqError) {
      errors.push({ job_id: job.id, reason: 'Failed to generate invoice number: ' + seqError.message });
      continue;
    }

    const invoiceNumber = formatInvoiceNumber(settings.invoice_prefix || 'INV', currentYear, seqData);

    // Insert draft invoice with customer data (name/phone/email from customer,
    // service address from the linked appointment).
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        tenant_id: tenantId,
        job_id: job.id,
        invoice_number: invoiceNumber,
        status: 'draft',
        customer_name: job.customer?.name || null,
        customer_phone: job.customer?.phone_e164 || null,
        customer_email: job.customer?.email || null,
        customer_address: job.appointment?.service_address || null,
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
      errors.push({ job_id: job.id, reason: invoiceError.message });
      continue;
    }

    invoices.push(invoice);
  }

  // Also report job_ids that were requested but not found
  const foundJobIds = new Set(jobs.map((j) => j.id));
  for (const requestedId of job_ids) {
    if (!foundJobIds.has(requestedId)) {
      errors.push({ job_id: requestedId, reason: 'Job not found' });
    }
  }

  return Response.json({ invoices, errors }, { status: 201 });
}

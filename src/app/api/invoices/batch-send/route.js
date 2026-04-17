import { createSupabaseServer } from '@/lib/supabase-server';
import { getTenantId } from '@/lib/get-tenant-id';
import { getTenantFeatures } from '@/lib/features';
import { sendSingleInvoice } from '@/lib/invoice-send';

/**
 * POST /api/invoices/batch-send
 *
 * Send multiple invoices in batch. Calls sendSingleInvoice for each invoice
 * sequentially, collecting per-invoice results. Does NOT stop on first failure.
 *
 * By using sendSingleInvoice, batch-send automatically inherits any hooks
 * that Plan 04 adds to the shared send function (e.g., accounting push).
 *
 * Body: { invoice_ids: string[] }
 * Returns: { results: [{ invoice_id, status, error? }], summary: { sent, failed } }
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

  const { invoice_ids } = body;

  // ── Validate invoice_ids ───────────────────────────────────────────────────

  if (!Array.isArray(invoice_ids) || invoice_ids.length === 0) {
    return Response.json({ error: 'invoice_ids must be a non-empty array' }, { status: 400 });
  }

  if (invoice_ids.length > 50) {
    return Response.json({ error: 'Maximum 50 invoices per batch' }, { status: 400 });
  }

  // ── Send each invoice sequentially ─────────────────────────────────────────

  const results = [];
  let sent = 0;
  let failed = 0;

  for (const invoiceId of invoice_ids) {
    try {
      await sendSingleInvoice(supabase, tenantId, invoiceId);
      results.push({ invoice_id: invoiceId, status: 'sent' });
      sent++;
    } catch (err) {
      results.push({ invoice_id: invoiceId, status: 'failed', error: err.message });
      failed++;
    }
  }

  return Response.json({
    results,
    summary: { sent, failed },
  });
}

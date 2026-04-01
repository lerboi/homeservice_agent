import { createSupabaseServer } from '@/lib/supabase-server';
import { getTenantId } from '@/lib/get-tenant-id';
import { sendSingleInvoice } from '@/lib/invoice-send';

/**
 * POST /api/invoices/[id]/send
 *
 * Thin wrapper around sendSingleInvoice — delegates all send logic
 * to the shared function in src/lib/invoice-send.js.
 *
 * Body: { send_sms?: boolean }
 * Returns: { invoice } with updated status.
 */
export async function POST(request, { params }) {
  const supabase = await createSupabaseServer();
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Parse optional request body
  let body = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional — default to no SMS
  }

  try {
    const result = await sendSingleInvoice(supabase, tenantId, id, {
      send_sms: body.send_sms,
    });
    return Response.json({ invoice: result.invoice });
  } catch (err) {
    const status = err.message === 'Invoice not found' ? 404 : 400;
    return Response.json({ error: err.message }, { status });
  }
}

import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePDF } from '@/lib/invoice-pdf';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getTenantId } from '@/lib/get-tenant-id';
import { getTenantFeatures } from '@/lib/features';

/**
 * GET /api/invoices/[id]/pdf
 *
 * Returns a PDF buffer for the requested invoice.
 * Tenant-isolated: only the invoice owner can download.
 * Content-Type: application/pdf
 * Content-Disposition: attachment; filename="invoice-{number}.pdf"
 */
export async function GET(request, { params }) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const features = await getTenantFeatures(tenantId);
  if (!features.invoicing) {
    return new Response(null, { status: 404 });
  }

  const { id } = await params;
  const supabase = await createSupabaseServer();

  // Fetch invoice (RLS ensures tenant isolation)
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (invoiceError || !invoice) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // Fetch line items sorted by sort_order
  const { data: lineItems } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', id)
    .order('sort_order', { ascending: true });

  // Fetch invoice settings (business header info)
  const { data: settings } = await supabase
    .from('invoice_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  const buffer = await renderToBuffer(
    <InvoicePDF
      invoice={invoice}
      settings={settings || {}}
      lineItems={lineItems || []}
    />
  );

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
    },
  });
}

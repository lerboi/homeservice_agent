import { createSupabaseServer } from '@/lib/supabase-server';
import { getTenantId } from '@/lib/get-tenant-id';
import { getTenantFeatures } from '@/lib/features';
import { getTranscriptsForLead, generateLineItemDescriptions } from '@/lib/ai/invoice-describe';

/**
 * POST /api/invoices/[id]/ai-describe
 * Generate AI line item descriptions from the linked lead's call transcript(s).
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

  // Fetch invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (invoiceError || !invoice) {
    return Response.json({ error: 'Invoice not found' }, { status: 404 });
  }

  // Validate invoice has a linked lead
  if (!invoice.lead_id) {
    return Response.json({ error: 'No lead linked to this invoice' }, { status: 400 });
  }

  // Fetch line items
  const { data: lineItems, error: liError } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', id)
    .order('sort_order', { ascending: true });

  if (liError) {
    return Response.json({ error: liError.message }, { status: 500 });
  }

  if (!lineItems || lineItems.length === 0) {
    return Response.json({ error: 'Add line items before generating descriptions' }, { status: 400 });
  }

  // Fetch transcripts via lead_calls junction
  const transcript = await getTranscriptsForLead(supabase, invoice.lead_id, tenantId);

  if (!transcript) {
    return Response.json({ error: 'No call transcripts found for the linked lead' }, { status: 400 });
  }

  // Generate AI descriptions
  try {
    const descriptions = await generateLineItemDescriptions(transcript, lineItems);
    return Response.json({ descriptions });
  } catch (err) {
    console.error('[ai-describe] Generation failed:', err?.message || err);
    return Response.json({ error: 'Failed to generate descriptions' }, { status: 500 });
  }
}

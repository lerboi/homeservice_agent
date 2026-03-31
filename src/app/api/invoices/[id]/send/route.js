import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePDF } from '@/lib/invoice-pdf';
import InvoiceEmail from '@/emails/InvoiceEmail';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getTenantId } from '@/lib/get-tenant-id';
import { getResendClient, getTwilioClient } from '@/lib/notifications';

/**
 * POST /api/invoices/[id]/send
 *
 * Sends the invoice to the customer via:
 *   1. Resend email with PDF attachment (always)
 *   2. Optional SMS notification from tenant's business phone (if send_sms=true)
 *
 * After successful delivery, updates invoice status to 'sent' and sets sent_at.
 *
 * Body: { send_sms?: boolean }
 *
 * Returns: { invoice } with updated status.
 *
 * White-label (D-09): email from address uses getvoco.ai sending domain
 * (required for deliverability), but display name is the business name only.
 * The InvoiceEmail template contains zero platform branding.
 */
export async function POST(request, { params }) {
  const supabase = await createSupabaseServer();
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // ── Fetch invoice ──────────────────────────────────────────────────────────

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (invoiceError || !invoice) {
    return Response.json({ error: 'Invoice not found' }, { status: 404 });
  }

  // ── Validate: customer_email required ─────────────────────────────────────

  if (!invoice.customer_email) {
    return Response.json({ error: 'Customer email required' }, { status: 400 });
  }

  // ── Fetch line items ───────────────────────────────────────────────────────

  const { data: lineItems } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', id)
    .order('sort_order', { ascending: true });

  // ── Fetch invoice settings for white-labeled sender display name ───────────

  const { data: settingsRow } = await supabase
    .from('invoice_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const settings = settingsRow || {};

  // ── Parse request body ─────────────────────────────────────────────────────

  let body = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional — default to no SMS
  }
  const { send_sms = false } = body;

  // ── Generate PDF buffer ────────────────────────────────────────────────────

  let pdfBuffer;
  try {
    pdfBuffer = await renderToBuffer(
      <InvoicePDF invoice={invoice} settings={settings} lineItems={lineItems || []} />
    );
  } catch (err) {
    console.error('[invoice-send] PDF generation failed:', err?.message || err);
    return Response.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }

  // ── Send email via Resend ──────────────────────────────────────────────────

  try {
    await getResendClient().emails.send({
      from: `${settings.business_name || 'Invoice'} <invoices@getvoco.ai>`,
      to: invoice.customer_email,
      subject: `Invoice ${invoice.invoice_number} from ${settings.business_name || 'Your Service Provider'}`,
      react: InvoiceEmail({ invoice, settings, lineItems: lineItems || [] }),
      attachments: [
        {
          content: pdfBuffer,
          filename: `invoice-${invoice.invoice_number}.pdf`,
        },
      ],
    });
    console.log('[invoice-send] Email sent to:', invoice.customer_email);
  } catch (err) {
    console.error('[invoice-send] Email send failed:', err?.message || err);
    return Response.json({ error: 'Failed to send email' }, { status: 500 });
  }

  // ── Optional SMS via Twilio ────────────────────────────────────────────────

  if (send_sms && invoice.customer_phone) {
    try {
      // Fetch tenant's provisioned business phone number
      const { data: tenant } = await supabase
        .from('tenants')
        .select('retell_phone_number')
        .eq('id', tenantId)
        .maybeSingle();

      if (tenant?.retell_phone_number) {
        const smsBody =
          `${settings.business_name || 'Your service provider'}: Invoice #${invoice.invoice_number} ` +
          `for $${Number(invoice.total).toFixed(2)} due ${invoice.due_date || 'upon receipt'}. ` +
          `Full invoice sent to your email. Questions? Call ${settings.phone || tenant.retell_phone_number}`;

        await getTwilioClient().messages.create({
          body: smsBody,
          from: tenant.retell_phone_number,
          to: invoice.customer_phone,
        });
        console.log('[invoice-send] SMS sent to:', invoice.customer_phone);
      } else {
        console.warn('[invoice-send] SMS requested but tenant has no retell_phone_number');
      }
    } catch (err) {
      // SMS failure must NOT fail the send — email already delivered
      console.warn('[invoice-send] SMS failed (non-fatal):', err?.message || err);
    }
  }

  // ── Update invoice status to 'sent' ───────────────────────────────────────

  const { data: updatedInvoice, error: updateError } = await supabase
    .from('invoices')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (updateError) {
    console.error('[invoice-send] Status update failed:', updateError.message);
    // Email was already sent — return success with original invoice
    return Response.json({ invoice });
  }

  return Response.json({ invoice: updatedInvoice });
}

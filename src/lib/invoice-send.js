/**
 * Shared single-invoice send function.
 *
 * This is the SINGLE source of truth for invoice delivery logic.
 * Both the single-send route (/api/invoices/[id]/send) and the
 * batch-send route (/api/invoices/batch-send) call this function.
 *
 * Any hooks added here (e.g., accounting sync in Plan 04) automatically
 * apply to both send paths.
 */

import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePDF } from '@/lib/invoice-pdf';
import InvoiceEmail from '@/emails/InvoiceEmail';
import { getResendClient, getTwilioClient } from '@/lib/notifications';

/**
 * Send a single invoice: generate PDF, email it, optionally SMS, update status.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Authenticated Supabase client
 * @param {string} tenantId - Tenant ID for RLS scoping
 * @param {string} invoiceId - Invoice UUID to send
 * @param {{ send_sms?: boolean }} options - Optional flags
 * @returns {Promise<{ invoice: object, lineItems: Array, settings: object }>}
 * @throws {Error} If invoice not found, no customer email, PDF generation fails, or email fails
 */
export async function sendSingleInvoice(supabase, tenantId, invoiceId, options = {}) {
  const { send_sms = false } = options;

  // ── Fetch invoice ──────────────────────────────────────────────────────────

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (invoiceError || !invoice) {
    throw new Error('Invoice not found');
  }

  // ── Validate: customer_email required ─────────────────────────────────────

  if (!invoice.customer_email) {
    throw new Error('No customer email');
  }

  // ── Fetch line items ───────────────────────────────────────────────────────

  const { data: lineItems } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('sort_order', { ascending: true });

  // ── Fetch invoice settings for white-labeled sender display name ───────────

  const { data: settingsRow } = await supabase
    .from('invoice_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const settings = settingsRow || {};

  // ── Generate PDF buffer ────────────────────────────────────────────────────

  let pdfBuffer;
  try {
    pdfBuffer = await renderToBuffer(
      <InvoicePDF invoice={invoice} settings={settings} lineItems={lineItems || []} />
    );
  } catch (err) {
    console.error('[invoice-send] PDF generation failed:', err?.message || err);
    throw new Error('Failed to generate PDF');
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
    throw new Error('Failed to send email');
  }

  // ── Optional SMS via Twilio ────────────────────────────────────────────────

  if (send_sms && invoice.customer_phone) {
    try {
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
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (updateError) {
    console.error('[invoice-send] Status update failed:', updateError.message);
    // Email was already sent — return original invoice
    return { invoice, lineItems: lineItems || [], settings };
  }

  return { invoice: updatedInvoice, lineItems: lineItems || [], settings };
}

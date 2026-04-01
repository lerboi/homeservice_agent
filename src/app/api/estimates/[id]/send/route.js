import { createSupabaseServer } from '@/lib/supabase-server';
import { getTenantId } from '@/lib/get-tenant-id';
import { generateEstimatePDF } from '@/lib/estimate-pdf';
import { getResendClient, getTwilioClient } from '@/lib/notifications';

/**
 * POST /api/estimates/[id]/send
 *
 * Send an estimate via email (PDF attachment) and optional SMS.
 * Mirrors the invoice send pattern from src/lib/invoice-send.js.
 *
 * Updates estimate status to 'sent' and sets sent_at timestamp.
 * SMS failure is non-fatal -- email is the primary delivery channel.
 */
export async function POST(request, { params }) {
  const supabase = await createSupabaseServer();
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // ── Fetch estimate ────────────────────────────────────────────────────────

  const { data: estimate, error: estimateError } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (estimateError || !estimate) {
    return Response.json({ error: 'Estimate not found' }, { status: 404 });
  }

  if (!estimate.customer_email) {
    return Response.json({ error: 'No customer email on estimate' }, { status: 400 });
  }

  // ── Fetch line items ──────────────────────────────────────────────────────

  const { data: lineItems } = await supabase
    .from('estimate_line_items')
    .select('*')
    .eq('estimate_id', id)
    .order('sort_order', { ascending: true });

  // ── Fetch tiers ───────────────────────────────────────────────────────────

  const { data: tiers } = await supabase
    .from('estimate_tiers')
    .select('*')
    .eq('estimate_id', id)
    .order('sort_order', { ascending: true });

  // Attach line items to tiers for PDF generation
  const tiersWithItems = (tiers || []).map((tier) => ({
    ...tier,
    line_items: (lineItems || []).filter((li) => li.tier_id === tier.id),
  }));

  // Single-price line items (no tier_id)
  const singleLineItems = (lineItems || []).filter((li) => !li.tier_id);

  // ── Fetch invoice settings (business info + tax rate) ─────────────────────

  const { data: settingsRow } = await supabase
    .from('invoice_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const settings = settingsRow || {};

  // ── Generate PDF ──────────────────────────────────────────────────────────

  let pdfBuffer;
  try {
    pdfBuffer = await generateEstimatePDF(
      estimate,
      singleLineItems,
      tiersWithItems,
      settings
    );
  } catch (err) {
    console.error('[estimate-send] PDF generation failed:', err?.message || err);
    return Response.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }

  // ── Send email via Resend ─────────────────────────────────────────────────

  try {
    await getResendClient().emails.send({
      from: `${settings.business_name || 'Estimate'} <noreply@getvoco.ai>`,
      to: estimate.customer_email,
      subject: `Estimate ${estimate.estimate_number} from ${settings.business_name || 'Your Service Provider'}`,
      html: buildEstimateEmailHtml(estimate, settings, tiersWithItems),
      attachments: [
        {
          content: pdfBuffer,
          filename: `${estimate.estimate_number}.pdf`,
        },
      ],
    });
    console.log('[estimate-send] Email sent to:', estimate.customer_email);
  } catch (err) {
    console.error('[estimate-send] Email send failed:', err?.message || err);
    return Response.json({ error: 'Failed to send email' }, { status: 500 });
  }

  // ── Optional SMS via Twilio ───────────────────────────────────────────────

  if (estimate.customer_phone) {
    try {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('retell_phone_number')
        .eq('id', tenantId)
        .maybeSingle();

      if (tenant?.retell_phone_number) {
        const isTiered = tiersWithItems.length > 0;
        let smsBody;

        if (isTiered) {
          const totals = tiersWithItems.map((t) => Number(t.total || 0));
          const min = Math.min(...totals);
          const max = Math.max(...totals);
          smsBody =
            `${settings.business_name || 'Your service provider'}: Estimate #${estimate.estimate_number} ` +
            `with options from $${min.toFixed(2)} to $${max.toFixed(2)}. ` +
            `Full estimate sent to your email. Questions? Call ${settings.phone || tenant.retell_phone_number}`;
        } else {
          smsBody =
            `${settings.business_name || 'Your service provider'}: Estimate #${estimate.estimate_number} ` +
            `for $${Number(estimate.total || 0).toFixed(2)}. ` +
            `Full estimate sent to your email. Questions? Call ${settings.phone || tenant.retell_phone_number}`;
        }

        await getTwilioClient().messages.create({
          body: smsBody,
          from: tenant.retell_phone_number,
          to: estimate.customer_phone,
        });
        console.log('[estimate-send] SMS sent to:', estimate.customer_phone);
      } else {
        console.warn('[estimate-send] SMS skipped: tenant has no retell_phone_number');
      }
    } catch (err) {
      // SMS failure is non-fatal -- email already delivered
      console.warn('[estimate-send] SMS failed (non-fatal):', err?.message || err);
    }
  }

  // ── Update estimate status to 'sent' ──────────────────────────────────────

  const { data: updatedEstimate, error: updateError } = await supabase
    .from('estimates')
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
    console.error('[estimate-send] Status update failed:', updateError.message);
    // Email was already sent -- return success anyway
  }

  return Response.json({ success: true, estimate: updatedEstimate || estimate });
}

// ── HTML email body builder ──────────────────────────────────────────────────

function buildEstimateEmailHtml(estimate, settings, tiers) {
  const businessName = settings.business_name || 'Your Service Provider';
  const isTiered = tiers && tiers.length > 0;

  let summaryText;
  if (isTiered) {
    const totals = tiers.map((t) => Number(t.total || 0));
    const min = Math.min(...totals).toFixed(2);
    const max = Math.max(...totals).toFixed(2);
    summaryText = `We've prepared an estimate with ${tiers.length} options ranging from $${min} to $${max}.`;
  } else {
    summaryText = `We've prepared an estimate for $${Number(estimate.total || 0).toFixed(2)}.`;
  }

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="color: #0F172A; margin-bottom: 8px;">Estimate ${estimate.estimate_number}</h2>
      <p style="color: #57534E; font-size: 14px; line-height: 1.6;">
        Hi ${estimate.customer_name || 'there'},
      </p>
      <p style="color: #57534E; font-size: 14px; line-height: 1.6;">
        ${summaryText} Please find the detailed estimate attached as a PDF.
      </p>
      ${estimate.valid_until ? `
        <p style="color: #57534E; font-size: 14px; line-height: 1.6;">
          This estimate is valid until ${estimate.valid_until}.
        </p>
      ` : ''}
      <p style="color: #57534E; font-size: 14px; line-height: 1.6;">
        If you have any questions, please don't hesitate to reach out.
      </p>
      <p style="color: #57534E; font-size: 14px; line-height: 1.6; margin-top: 24px;">
        Best regards,<br/>
        <strong>${businessName}</strong>
        ${settings.phone ? `<br/>${settings.phone}` : ''}
      </p>
    </div>
  `.trim();
}

/**
 * Vercel Cron — Recurring Invoice Generation (D-16, D-17, D-18)
 *
 * Schedule: daily at 08:00 UTC (0 8 * * *)
 * Finds active recurring templates whose next_date <= today,
 * generates draft invoices, and advances the next_date without drift.
 *
 * Generated invoices are always draft status (D-17) — owner reviews and sends manually.
 */

import { supabase } from '@/lib/supabase';
import { calculateNextDate } from '@/lib/recurring-calculations';
import { formatInvoiceNumber } from '@/lib/invoice-number';
import { calculateLineTotal, calculateInvoiceTotals } from '@/lib/invoice-calculations';

export async function GET(request) {
  // CRON_SECRET Bearer auth check
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Phase 53 — feature flag pre-filter ──────────────────────────────────
  // Skip every tenant with features_enabled.invoicing = false. PostgREST `->>`
  // returns TEXT, so the literal value MUST be the string 'true' (not boolean
  // true). Wrong syntax silently matches zero tenants and disables the cron
  // for everyone. Verified against live DB during Plan 05 Task 3.
  const { data: enabledTenants, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .eq('features_enabled->>invoicing', 'true');

  if (tenantError) {
    console.error('[recurring-invoices] Failed to fetch enabled tenants:', tenantError);
    return Response.json({ error: 'Tenant filter failed' }, { status: 500 });
  }

  const enabledTenantIds = (enabledTenants || []).map((t) => t.id);

  if (enabledTenantIds.length === 0) {
    console.log('[recurring-invoices] No tenants with invoicing enabled — skipping');
    return Response.json({ generated: 0 });
  }

  const today = new Date().toISOString().split('T')[0];

  // Query recurring templates that are due
  const { data: templates, error: queryError } = await supabase
    .from('invoices')
    .select('*')
    .eq('is_recurring_template', true)
    .eq('recurring_active', true)
    .in('tenant_id', enabledTenantIds)             // ← Phase 53 filter
    .lte('recurring_next_date', today)
    .or('recurring_end_date.is.null,recurring_end_date.gte.' + today);

  if (queryError) {
    console.error('[recurring-invoices] Failed to query templates:', queryError);
    return Response.json({ error: 'Query failed' }, { status: 500 });
  }

  if (!templates?.length) {
    return Response.json({ generated: 0 });
  }

  let generated = 0;

  for (const template of templates) {
    try {
      // Fetch template's line items
      const { data: lineItems } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', template.id)
        .order('sort_order', { ascending: true });

      // Fetch invoice_settings for the tenant (prefix, tax_rate)
      const { data: settingsRow } = await supabase
        .from('invoice_settings')
        .select('invoice_prefix, tax_rate, payment_terms')
        .eq('tenant_id', template.tenant_id)
        .maybeSingle();

      const settings = settingsRow || { invoice_prefix: 'INV', tax_rate: 0, payment_terms: 'Net 30' };

      // Get next invoice number via RPC
      const currentYear = new Date().getFullYear();
      const { data: seqData, error: seqError } = await supabase.rpc('get_next_invoice_number', {
        p_tenant_id: template.tenant_id,
        p_year: currentYear,
      });

      if (seqError) {
        console.error(`[recurring-invoices] Failed to get invoice number for tenant ${template.tenant_id}:`, seqError);
        continue;
      }

      const invoiceNumber = formatInvoiceNumber(settings.invoice_prefix || 'INV', currentYear, seqData);

      // Calculate due date from payment_terms if available
      let dueDate = null;
      const terms = template.payment_terms || settings.payment_terms;
      if (terms) {
        const netMatch = terms.match(/Net\s*(\d+)/i);
        if (netMatch) {
          const netDays = parseInt(netMatch[1], 10);
          const due = new Date();
          due.setDate(due.getDate() + netDays);
          dueDate = due.toISOString().split('T')[0];
        }
      }

      // Calculate totals from line items
      const taxRate = Number(settings.tax_rate) || 0;
      const itemsForCalc = (lineItems || []).map(li => ({
        item_type: li.item_type,
        quantity: li.quantity,
        unit_price: li.unit_price,
        markup_pct: li.markup_pct,
        taxable: li.taxable,
      }));
      const { subtotal, tax_amount, total } = calculateInvoiceTotals(itemsForCalc, taxRate);

      // Create new draft invoice
      const { data: newInvoice, error: insertError } = await supabase
        .from('invoices')
        .insert({
          tenant_id: template.tenant_id,
          lead_id: template.lead_id || null,
          invoice_number: invoiceNumber,
          status: 'draft',
          customer_name: template.customer_name,
          customer_phone: template.customer_phone,
          customer_email: template.customer_email,
          customer_address: template.customer_address,
          job_type: template.job_type,
          notes: template.notes,
          payment_terms: template.payment_terms,
          issued_date: today,
          due_date: dueDate,
          subtotal,
          tax_amount,
          total,
          generated_from_id: template.id,
          is_recurring_template: false,
        })
        .select()
        .single();

      if (insertError) {
        console.error(`[recurring-invoices] Failed to create invoice from template ${template.id}:`, insertError);
        continue;
      }

      // Copy all line items to new invoice
      if (lineItems?.length > 0) {
        const newLineItems = lineItems.map((li, idx) => ({
          invoice_id: newInvoice.id,
          tenant_id: template.tenant_id,
          sort_order: li.sort_order ?? idx,
          item_type: li.item_type,
          description: li.description || '',
          quantity: li.quantity ?? 1,
          unit_price: li.unit_price ?? 0,
          markup_pct: li.markup_pct ?? 0,
          taxable: li.taxable !== false,
          line_total: calculateLineTotal(li.item_type, {
            quantity: li.quantity,
            unit_price: li.unit_price,
            markup_pct: li.markup_pct,
          }),
        }));

        const { error: liError } = await supabase
          .from('invoice_line_items')
          .insert(newLineItems);

        if (liError) {
          console.error(`[recurring-invoices] Failed to copy line items for template ${template.id}:`, liError);
          // Rollback: delete the empty invoice to prevent orphans
          await supabase.from('invoices').delete().eq('id', newInvoice.id);
          continue;
        }
      }

      // Calculate next date without drift
      const nextDate = calculateNextDate(
        template.recurring_start_date,
        template.recurring_frequency,
        template.recurring_next_date
      );

      // Update template: advance next_date, deactivate if past end_date
      const templateUpdate = { recurring_next_date: nextDate };
      if (template.recurring_end_date && nextDate > template.recurring_end_date) {
        templateUpdate.recurring_active = false;
      }

      await supabase
        .from('invoices')
        .update(templateUpdate)
        .eq('id', template.id);

      generated++;
      console.log(`[recurring-invoices] Generated invoice ${invoiceNumber} from template ${template.id}`);
    } catch (err) {
      console.error(`[recurring-invoices] Error processing template ${template.id}:`, err?.message || err);
    }
  }

  return Response.json({ generated });
}

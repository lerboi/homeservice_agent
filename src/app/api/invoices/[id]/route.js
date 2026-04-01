import { createSupabaseServer } from '@/lib/supabase-server';
import { getTenantId } from '@/lib/get-tenant-id';
import { calculateLineTotal, calculateInvoiceTotals } from '@/lib/invoice-calculations';
import { shouldSyncToLead } from '@/lib/invoice-sync';

/**
 * GET /api/invoices/[id]
 * Returns a single invoice with its line items.
 */
export async function GET(request, { params }) {
  const supabase = await createSupabaseServer();
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (invoiceError || !invoice) {
    return Response.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const { data: lineItems, error: liError } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', id)
    .order('sort_order', { ascending: true });

  if (liError) {
    return Response.json({ error: liError.message }, { status: 500 });
  }

  return Response.json({ invoice, line_items: lineItems || [] });
}

/**
 * PATCH /api/invoices/[id]
 * Update an invoice. Allowed changes depend on current status:
 *   draft   — all fields editable (customer info, dates, notes, terms, line_items, status)
 *   sent / overdue — only status change allowed (to 'paid' or 'void')
 *   paid / void   — no edits allowed (returns 400)
 */
export async function PATCH(request, { params }) {
  const supabase = await createSupabaseServer();
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Fetch current invoice to verify ownership and check status
  const { data: current, error: fetchError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (fetchError || !current) {
    return Response.json({ error: 'Invoice not found' }, { status: 404 });
  }

  if (current.status === 'paid' || current.status === 'void') {
    return Response.json(
      { error: `Invoice is ${current.status} and cannot be edited` },
      { status: 400 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const updateData = { updated_at: new Date().toISOString() };

  // Recurring fields can be updated on any non-paid/void status
  const recurringFields = [
    'is_recurring_template', 'recurring_frequency', 'recurring_start_date',
    'recurring_end_date', 'recurring_next_date', 'recurring_active',
  ];
  for (const field of recurringFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  if (current.status === 'sent' || current.status === 'overdue') {
    // Only status change is permitted; only 'paid' or 'void' are valid transitions
    if (body.status && body.status !== 'paid' && body.status !== 'void') {
      return Response.json(
        { error: `Cannot change status from '${current.status}' to '${body.status}'. Only 'paid' or 'void' allowed.` },
        { status: 400 }
      );
    }
    if (body.status) {
      updateData.status = body.status;
      if (body.status === 'paid') {
        updateData.paid_at = new Date().toISOString();
      } else if (body.status === 'void') {
        updateData.voided_at = new Date().toISOString();
      }
    }
  } else {
    // draft — all fields editable
    const editableFields = [
      'customer_name', 'customer_phone', 'customer_email', 'customer_address',
      'job_type', 'issued_date', 'due_date', 'notes', 'payment_terms',
      'reminders_enabled',
      'is_recurring_template', 'recurring_frequency', 'recurring_start_date',
      'recurring_end_date', 'recurring_next_date', 'recurring_active',
    ];
    for (const field of editableFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Status change for draft (e.g., draft → sent)
    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === 'sent') {
        updateData.sent_at = new Date().toISOString();
      } else if (body.status === 'paid') {
        updateData.paid_at = new Date().toISOString();
      } else if (body.status === 'void') {
        updateData.voided_at = new Date().toISOString();
      }
    }

    // If line_items provided, delete existing and re-insert + recalculate totals
    if (Array.isArray(body.line_items)) {
      const { error: deleteError } = await supabase
        .from('invoice_line_items')
        .delete()
        .eq('invoice_id', id);

      if (deleteError) {
        return Response.json({ error: 'Failed to update line items: ' + deleteError.message }, { status: 500 });
      }

      // Fetch settings for tax rate
      const { data: settingsRow } = await supabase
        .from('invoice_settings')
        .select('tax_rate')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const taxRate = Number(settingsRow?.tax_rate) || 0;
      const { subtotal, tax_amount, total } = calculateInvoiceTotals(body.line_items, taxRate);

      if (body.line_items.length > 0) {
        const lineItemRows = body.line_items.map((item, idx) => ({
          invoice_id: id,
          tenant_id: tenantId,
          sort_order: item.sort_order ?? idx,
          item_type: item.item_type,
          description: item.description || '',
          quantity: item.quantity ?? 1,
          unit_price: item.unit_price ?? 0,
          markup_pct: item.markup_pct ?? 0,
          taxable: item.taxable !== false,
          line_total: calculateLineTotal(item.item_type, {
            quantity: item.quantity,
            unit_price: item.unit_price,
            markup_pct: item.markup_pct,
          }),
        }));

        const { error: liError } = await supabase
          .from('invoice_line_items')
          .insert(lineItemRows);

        if (liError) {
          return Response.json({ error: 'Failed to insert line items: ' + liError.message }, { status: 500 });
        }
      }

      updateData.subtotal = subtotal;
      updateData.tax_amount = tax_amount;
      updateData.total = total;
    }
  }

  // Apply the update
  const { data: updatedInvoice, error: updateError } = await supabase
    .from('invoices')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  // Fetch updated line items
  const { data: lineItems } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', id)
    .order('sort_order', { ascending: true });

  // ── Bidirectional sync: invoice Paid → lead Paid ───────────────────────────
  // When invoice is marked Paid and has a linked lead, propagate status to lead.
  // sync_source='invoice_paid' prevents the lead route from triggering a reverse sync.
  if (shouldSyncToLead(body.status, current.lead_id, body.sync_source)) {
    try {
      const { origin } = new URL(request.url);
      await fetch(`${origin}/api/leads/${current.lead_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          cookie: request.headers.get('cookie') || '',
        },
        body: JSON.stringify({
          status: 'paid',
          revenue_amount: updatedInvoice.total,
          sync_source: 'invoice_paid',
        }),
      });
      console.log('[invoice-sync] Propagated paid status to lead:', current.lead_id);
    } catch (err) {
      // Sync failure must NOT fail the invoice update — invoice is already saved
      console.error('[invoice-sync] Lead sync failed (non-fatal):', err?.message || err);
    }
  }

  // ── Push status update to accounting (non-fatal) ─────────────────────
  if (body.status === 'paid' || body.status === 'void') {
    try {
      const { pushStatusUpdate } = await import('@/lib/accounting/sync.js');
      await pushStatusUpdate(supabase, tenantId, id, body.status);
    } catch (err) {
      console.warn('[accounting-sync] Status push failed (non-fatal):', err?.message || err);
    }
  }

  return Response.json({ invoice: updatedInvoice, line_items: lineItems || [] });
}

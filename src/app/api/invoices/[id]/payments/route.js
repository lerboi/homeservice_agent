import { createSupabaseServer } from '@/lib/supabase-server';
import { getTenantId } from '@/lib/get-tenant-id';
import { getTenantFeatures } from '@/lib/features';
import { calculatePaymentStatus } from '@/lib/payment-calculations';

/**
 * Recalculate invoice status after a payment change.
 * Fetches all payments for the invoice, computes new status via pure function,
 * and updates the invoice record if status changed.
 */
async function recalculateInvoiceStatus(supabase, invoiceId, tenantId) {
  // Fetch invoice
  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .select('total, status, due_date')
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId)
    .single();

  if (invError || !invoice) {
    throw new Error('Invoice not found');
  }

  // Fetch all payments for this invoice
  const { data: payments, error: payError } = await supabase
    .from('invoice_payments')
    .select('amount')
    .eq('invoice_id', invoiceId)
    .eq('tenant_id', tenantId);

  if (payError) {
    throw new Error('Failed to fetch payments');
  }

  const paymentsSum = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
  const today = new Date().toISOString().split('T')[0];

  const { balance, newStatus } = calculatePaymentStatus({
    invoiceTotal: Number(invoice.total),
    paymentsSum,
    currentStatus: invoice.status,
    dueDate: invoice.due_date,
    today,
  });

  // Update invoice status if changed
  if (newStatus !== invoice.status) {
    const updateData = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'paid') {
      updateData.paid_at = new Date().toISOString();
    }
    await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId);
  }

  return { paymentsSum, balance, status: newStatus };
}

/**
 * GET /api/invoices/[id]/payments
 * List all payments for an invoice with balance calculation.
 */
export async function GET(request, { params }) {
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

  // Verify invoice belongs to tenant
  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .select('total')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (invError || !invoice) {
    return Response.json({ error: 'Invoice not found' }, { status: 404 });
  }

  // Fetch payments ordered by date DESC
  const { data: payments, error: payError } = await supabase
    .from('invoice_payments')
    .select('*')
    .eq('invoice_id', id)
    .eq('tenant_id', tenantId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (payError) {
    return Response.json({ error: payError.message }, { status: 500 });
  }

  const invoiceTotal = Number(invoice.total);
  const paymentsSum = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Math.max(0, invoiceTotal - paymentsSum);

  return Response.json({
    payments: payments || [],
    payments_sum: paymentsSum,
    balance,
    invoice_total: invoiceTotal,
  });
}

/**
 * POST /api/invoices/[id]/payments
 * Record a payment against an invoice. Auto-updates invoice status.
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

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { amount, payment_date, note } = body;

  // Validate amount
  if (!amount || Number(amount) <= 0) {
    return Response.json({ error: 'Amount must be greater than 0' }, { status: 400 });
  }

  // Validate payment_date
  if (!payment_date || isNaN(Date.parse(payment_date))) {
    return Response.json({ error: 'Valid payment_date is required' }, { status: 400 });
  }

  // Verify invoice belongs to tenant
  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (invError || !invoice) {
    return Response.json({ error: 'Invoice not found' }, { status: 404 });
  }

  // Insert payment
  const { data: payment, error: insertError } = await supabase
    .from('invoice_payments')
    .insert({
      invoice_id: id,
      tenant_id: tenantId,
      amount: Number(amount),
      payment_date,
      note: note || null,
    })
    .select()
    .single();

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  // Recalculate invoice status
  const { paymentsSum, balance, status } = await recalculateInvoiceStatus(supabase, id, tenantId);

  return Response.json({ payment, payments_sum: paymentsSum, balance, status });
}

/**
 * DELETE /api/invoices/[id]/payments
 * Remove a payment record. Auto-updates invoice status.
 * Query param: ?payment_id=uuid
 */
export async function DELETE(request, { params }) {
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
  const { searchParams } = new URL(request.url);
  const paymentId = searchParams.get('payment_id');

  if (!paymentId) {
    return Response.json({ error: 'payment_id query parameter is required' }, { status: 400 });
  }

  // Delete the payment (tenant_id guard ensures ownership)
  const { error: deleteError } = await supabase
    .from('invoice_payments')
    .delete()
    .eq('id', paymentId)
    .eq('invoice_id', id)
    .eq('tenant_id', tenantId);

  if (deleteError) {
    return Response.json({ error: deleteError.message }, { status: 500 });
  }

  // Recalculate invoice status
  const { paymentsSum, balance, status } = await recalculateInvoiceStatus(supabase, id, tenantId);

  return Response.json({ success: true, payments_sum: paymentsSum, balance, status });
}

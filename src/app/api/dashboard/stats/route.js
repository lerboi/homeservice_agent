import { supabase } from '@/lib/supabase';
import { getTenantId } from '@/lib/get-tenant-id';

/**
 * GET /api/dashboard/stats
 * Returns dashboard stats: new lead count + preview, invoice snapshot, and overall totals.
 */
export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = today.slice(0, 8) + '01';

  const [
    newLeadsCountRes,
    newLeadsPreviewRes,
    invoiceOutstandingRes,
    invoiceOverdueRes,
    invoicePaidMonthRes,
  ] = await Promise.all([
    // Count of all new leads
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'new'),
    // Preview: up to 3 newest new leads with name + job type
    supabase
      .from('leads')
      .select('id, caller_name, job_type, from_number, created_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(3),
    // Invoice outstanding: sent + overdue
    supabase
      .from('invoices')
      .select('total')
      .eq('tenant_id', tenantId)
      .in('status', ['sent', 'overdue']),
    // Invoice overdue count
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'overdue'),
    // Paid this month
    supabase
      .from('invoices')
      .select('total')
      .eq('tenant_id', tenantId)
      .eq('status', 'paid')
      .gte('paid_at', firstOfMonth),
  ]);

  const outstandingInvoices = invoiceOutstandingRes.data || [];
  const invoiceOutstandingCount = outstandingInvoices.length;
  const invoiceOutstandingAmount = outstandingInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);
  const invoiceOverdueCount = invoiceOverdueRes.count ?? 0;

  const paidInvoices = invoicePaidMonthRes.data || [];
  const paidThisMonth = paidInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);

  return Response.json({
    newLeadsCount: newLeadsCountRes.count ?? 0,
    newLeadsPreview: newLeadsPreviewRes.data || [],
    invoiceOutstandingCount,
    invoiceOutstandingAmount,
    invoiceOverdueCount,
    paidThisMonth,
  });
}

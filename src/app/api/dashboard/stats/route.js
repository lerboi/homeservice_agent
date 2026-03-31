import { supabase } from '@/lib/supabase';
import { getTenantId } from '@/lib/get-tenant-id';

/**
 * GET /api/dashboard/stats
 * Returns aggregated dashboard stats via COUNT queries — no row data transferred.
 * Replaces the client-side filtering of /api/leads (which was capped at 100 rows).
 */
export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString();

  const [newTodayRes, allTodayRes, weekRes, weekBookedRes, invoiceOutstandingRes, invoiceOverdueRes] = await Promise.all([
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'new')
      .gte('created_at', today),
    supabase
      .from('calls')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', today),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', sevenDaysAgoIso),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', sevenDaysAgoIso)
      .in('status', ['booked', 'completed', 'paid']),
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
  ]);

  const weekLeads = weekRes.count ?? 0;
  const weekBooked = weekBookedRes.count ?? 0;

  // Calculate invoice totals
  const outstandingInvoices = invoiceOutstandingRes.data || [];
  const invoiceOutstandingCount = outstandingInvoices.length;
  const invoiceOutstandingAmount = outstandingInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);
  const invoiceOverdueCount = invoiceOverdueRes.count ?? 0;

  return Response.json({
    newLeadsToday: newTodayRes.count ?? 0,
    callsToday: allTodayRes.count ?? 0,
    weekLeads,
    weekBooked,
    conversionRate: weekLeads > 0 ? Math.round((weekBooked / weekLeads) * 100) : 0,
    invoiceOutstandingCount,
    invoiceOutstandingAmount,
    invoiceOverdueCount,
  });
}

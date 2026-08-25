import { supabase } from '@/lib/supabase';
import { getTenantId } from '@/lib/get-tenant-id';
import { tenantDayBoundaries } from '@/lib/tenant-time';

/**
 * GET /api/dashboard/stats
 * Returns dashboard stats: open-inquiry count + preview, invoice money snapshot
 * (outstanding / overdue / paid this month), and missed-calls-today count.
 */
export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Compute "today" / "first of month" in the TENANT's timezone, not UTC, so
  // late-afternoon US tenants aren't counted against tomorrow (2026-06-12 audit M18).
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('tenant_timezone')
    .eq('id', tenantId)
    .maybeSingle();
  const { todayStartISO, monthStartISO } = tenantDayBoundaries(tenantRow?.tenant_timezone);

  const [
    newLeadsCountRes,
    newLeadsPreviewRes,
    invoiceOutstandingRes,
    invoiceOverdueRes,
    invoicePaidMonthRes,
    missedCallsTodayRes,
  ] = await Promise.all([
    // Count of open inquiries (Phase 59: "new" work = unbooked open inquiries)
    supabase
      .from('inquiries')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'open'),
    // Preview: up to 5 most recent open inquiries, joined to customers for name/phone
    supabase
      .from('inquiries')
      .select('id, job_type, created_at, status, customer:customers!inner(name, phone_e164)')
      .eq('tenant_id', tenantId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(5),
    // Invoice outstanding: sent + overdue
    supabase
      .from('invoices')
      .select('total')
      .eq('tenant_id', tenantId)
      .in('status', ['sent', 'overdue']),
    // Invoice overdue: totals so both count and amount can be derived
    supabase
      .from('invoices')
      .select('total')
      .eq('tenant_id', tenantId)
      .eq('status', 'overdue'),
    // Paid this month
    supabase
      .from('invoices')
      .select('total')
      .eq('tenant_id', tenantId)
      .eq('status', 'paid')
      .gte('paid_at', monthStartISO),
    // Missed calls today: no booking attempt, 15s+ duration (same triage as
    // CallsTile — shorter calls are usually hangups/misdials, not losses)
    supabase
      .from('calls')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      // Test calls (migration 079) are never "missed" work
      .eq('is_test_call', false)
      .eq('booking_outcome', 'not_attempted')
      .gte('duration_seconds', 15)
      .gte('created_at', todayStartISO),
  ]);

  const outstandingInvoices = invoiceOutstandingRes.data || [];
  const invoiceOutstandingCount = outstandingInvoices.length;
  const invoiceOutstandingAmount = outstandingInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);

  const overdueInvoices = invoiceOverdueRes.data || [];
  const invoiceOverdueCount = overdueInvoices.length;
  const invoiceOverdueAmount = overdueInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);

  const paidInvoices = invoicePaidMonthRes.data || [];
  const paidThisMonth = paidInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);

  // Flatten the joined customer into legacy field names the dashboard tile reads.
  const newLeadsPreview = (newLeadsPreviewRes.data || []).map((inq) => ({
    id: inq.id,
    caller_name: inq.customer?.name || null,
    from_number: inq.customer?.phone_e164 || null,
    job_type: inq.job_type,
    created_at: inq.created_at,
    status: inq.status,
  }));

  return Response.json({
    newLeadsCount: newLeadsCountRes.count ?? 0,
    newLeadsPreview,
    invoiceOutstandingCount,
    invoiceOutstandingAmount,
    invoiceOverdueCount,
    invoiceOverdueAmount,
    paidThisMonth,
    missedCallsToday: missedCallsTodayRes.count ?? 0,
  });
}

import { supabase } from '@/lib/supabase';
import { getTenantId } from '@/lib/get-tenant-id';

/**
 * GET /api/search?q=<query>
 * Searches leads, calls, invoices, and appointments by name/phone/number.
 * Returns grouped results for the command palette.
 */
export async function GET(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q || q.length < 2) {
    return Response.json({ results: [] });
  }

  const pattern = `%${q}%`;

  const [leadsRes, callsRes, invoicesRes, appointmentsRes, estimatesRes] = await Promise.all([
    supabase
      .from('leads')
      .select('id, caller_name, from_number, job_type, status')
      .eq('tenant_id', tenantId)
      .or(`caller_name.ilike.${pattern},from_number.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('calls')
      .select('id, from_number, booking_outcome, urgency_classification, created_at')
      .eq('tenant_id', tenantId)
      .ilike('from_number', pattern)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('invoices')
      .select('id, invoice_number, customer_name, total, status')
      .eq('tenant_id', tenantId)
      .or(`invoice_number.ilike.${pattern},customer_name.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('appointments')
      .select('id, caller_name, start_time, status')
      .eq('tenant_id', tenantId)
      .ilike('caller_name', pattern)
      .order('start_time', { ascending: false })
      .limit(5),
    supabase
      .from('estimates')
      .select('id, estimate_number, customer_name, total, status')
      .eq('tenant_id', tenantId)
      .or(`estimate_number.ilike.${pattern},customer_name.ilike.${pattern}`)
      .limit(5),
  ]);

  const results = [];

  if (leadsRes.data?.length) {
    results.push({
      type: 'leads',
      label: 'Leads',
      items: leadsRes.data.map((l) => ({
        id: l.id,
        title: l.caller_name || l.from_number || 'Unknown',
        subtitle: l.job_type || l.status,
        href: `/dashboard/leads?open=${l.id}`,
      })),
    });
  }

  if (callsRes.data?.length) {
    results.push({
      type: 'calls',
      label: 'Calls',
      items: callsRes.data.map((c) => ({
        id: c.id,
        title: c.from_number || 'Unknown',
        subtitle: c.booking_outcome || 'N/A',
        href: '/dashboard/calls',
      })),
    });
  }

  if (invoicesRes.data?.length) {
    results.push({
      type: 'invoices',
      label: 'Invoices',
      items: invoicesRes.data.map((inv) => ({
        id: inv.id,
        title: inv.invoice_number,
        subtitle: inv.customer_name,
        href: `/dashboard/invoices/${inv.id}`,
      })),
    });
  }

  if (appointmentsRes.data?.length) {
    results.push({
      type: 'appointments',
      label: 'Appointments',
      items: appointmentsRes.data.map((a) => ({
        id: a.id,
        title: a.caller_name || 'Customer',
        subtitle: a.start_time
          ? new Date(a.start_time).toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
          : '',
        href: '/dashboard/calendar',
      })),
    });
  }

  if (estimatesRes.data?.length) {
    results.push({
      type: 'estimates',
      label: 'Estimates',
      items: estimatesRes.data.map((est) => ({
        id: est.id,
        title: est.estimate_number,
        subtitle: est.customer_name || '',
        href: `/dashboard/estimates/${est.id}`,
      })),
    });
  }

  return Response.json({ results });
}

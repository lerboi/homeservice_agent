import { supabase } from '@/lib/supabase';
import { getTenantId } from '@/lib/get-tenant-id';
import { escapeOrTerm } from '@/lib/search-filter';

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

  const pattern = `%${escapeOrTerm(q)}%`;

  const [leadsRes, callsRes, invoicesRes, appointmentsRes, estimatesRes] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, phone_e164')
      .eq('tenant_id', tenantId)
      .or(`name.ilike.${pattern},phone_e164.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('calls')
      .select('id, from_number, booking_outcome, urgency_classification, created_at')
      .eq('tenant_id', tenantId)
      // Test calls (migration 079) stay out of global search
      .eq('is_test_call', false)
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
      type: 'customers',
      label: 'Customers',
      items: leadsRes.data.map((c) => ({
        id: c.id,
        title: c.name || c.phone_e164 || 'Unknown',
        subtitle: c.phone_e164 || '',
        href: `/dashboard/customers/${c.id}`,
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

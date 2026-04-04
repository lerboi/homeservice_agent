import { supabase } from '@/lib/supabase';
import { getTenantId } from '@/lib/get-tenant-id';

/**
 * GET /api/customer-timeline?phone=<number>&lead_id=<uuid>
 * Returns chronological timeline of all interactions with a customer.
 */
export async function GET(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone');
  const leadId = searchParams.get('lead_id');

  if (!phone && !leadId) {
    return Response.json({ error: 'phone or lead_id required' }, { status: 400 });
  }

  const events = [];

  // Fetch all related data in parallel
  const queries = [];

  // Calls by phone number
  if (phone) {
    queries.push(
      supabase
        .from('calls')
        .select('id, from_number, duration_seconds, booking_outcome, urgency_classification, created_at')
        .eq('tenant_id', tenantId)
        .eq('from_number', phone)
        .order('created_at', { ascending: true })
        .limit(20)
    );
  } else {
    queries.push(Promise.resolve({ data: [] }));
  }

  // Appointments by caller phone or lead linkage
  if (phone) {
    queries.push(
      supabase
        .from('appointments')
        .select('id, caller_name, start_time, status, job_type, created_at')
        .eq('tenant_id', tenantId)
        .eq('caller_phone', phone)
        .order('created_at', { ascending: true })
        .limit(10)
    );
  } else {
    queries.push(Promise.resolve({ data: [] }));
  }

  // Invoices linked to this lead
  if (leadId) {
    queries.push(
      supabase
        .from('invoices')
        .select('id, invoice_number, customer_name, total, status, created_at')
        .eq('tenant_id', tenantId)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true })
        .limit(10)
    );
  } else {
    queries.push(Promise.resolve({ data: [] }));
  }

  // Estimates linked to this lead
  if (leadId) {
    queries.push(
      supabase
        .from('estimates')
        .select('id, estimate_number, customer_name, total, status, created_at')
        .eq('tenant_id', tenantId)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true })
        .limit(10)
    );
  } else {
    queries.push(Promise.resolve({ data: [] }));
  }

  const [callsRes, appointmentsRes, invoicesRes, estimatesRes] = await Promise.all(queries);

  // Build timeline events
  for (const call of callsRes.data || []) {
    events.push({
      type: 'call',
      timestamp: call.created_at,
      title: `Call received`,
      subtitle: call.duration_seconds > 0
        ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
        : 'Missed',
      status: call.booking_outcome,
      id: call.id,
    });
  }

  for (const appt of appointmentsRes.data || []) {
    events.push({
      type: 'appointment',
      timestamp: appt.created_at,
      title: `Appointment ${appt.status === 'cancelled' ? 'cancelled' : 'booked'}`,
      subtitle: appt.start_time
        ? new Date(appt.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : '',
      status: appt.status,
      id: appt.id,
    });
  }

  for (const inv of invoicesRes.data || []) {
    events.push({
      type: 'invoice',
      timestamp: inv.created_at,
      title: `Invoice ${inv.invoice_number}`,
      subtitle: `$${Number(inv.total || 0).toFixed(2)}`,
      status: inv.status,
      id: inv.id,
      href: `/dashboard/invoices/${inv.id}`,
    });
  }

  for (const est of estimatesRes.data || []) {
    events.push({
      type: 'estimate',
      timestamp: est.created_at,
      title: `Estimate ${est.estimate_number}`,
      subtitle: `$${Number(est.total || 0).toFixed(2)}`,
      status: est.status,
      id: est.id,
      href: `/dashboard/estimates/${est.id}`,
    });
  }

  // Sort chronologically
  events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return Response.json({ events });
}

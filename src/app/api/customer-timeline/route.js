import { supabase } from '@/lib/supabase';
import { getTenantId } from '@/lib/get-tenant-id';

/**
 * GET /api/customer-timeline?phone=<number>&customer_id=<uuid>&job_id=<uuid>
 * Returns chronological timeline of all interactions with a customer.
 *
 * Phase 59: estimates link to a customer (customer_id), invoices link to a job (job_id).
 * phone is still used to pull calls + appointments (denormalized caller_phone).
 */
export async function GET(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone');
  const customerId = searchParams.get('customer_id');
  const jobId = searchParams.get('job_id');

  if (!phone && !customerId && !jobId) {
    return Response.json({ error: 'phone, customer_id, or job_id required' }, { status: 400 });
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

  // Invoices linked to this job
  if (jobId) {
    queries.push(
      supabase
        .from('invoices')
        .select('id, invoice_number, customer_name, total, status, created_at')
        .eq('tenant_id', tenantId)
        .eq('job_id', jobId)
        .order('created_at', { ascending: true })
        .limit(10)
    );
  } else {
    queries.push(Promise.resolve({ data: [] }));
  }

  // Estimates linked to this customer
  if (customerId) {
    queries.push(
      supabase
        .from('estimates')
        .select('id, estimate_number, customer_name, total, status, created_at')
        .eq('tenant_id', tenantId)
        .eq('customer_id', customerId)
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

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { calculateAvailableSlots } from '@/lib/scheduling/slot-calculator';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

/**
 * GET /api/appointments/available-slots
 *
 * Returns available booking slots for the authenticated tenant's dashboard.
 * Used for the scheduling dashboard — NOT in the call hot path.
 *
 * Query params:
 *   date  - ISO date string (YYYY-MM-DD), defaults to today in tenant timezone
 *   days  - Number of days to calculate slots for (default: 3, max: 14)
 *
 * Response: { slots: [{ start: string, end: string, label: string }] }
 */
export async function GET(request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component context — ignore
          }
        },
      },
    }
  );

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Load tenant for the authenticated owner
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, working_hours, slot_duration_mins, tenant_timezone')
    .eq('owner_id', user.id)
    .single();

  if (tenantError || !tenant) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const tenantTimezone = tenant.tenant_timezone || 'America/Chicago';

  // Parse query params
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date'); // YYYY-MM-DD in tenant timezone
  const daysParam = parseInt(searchParams.get('days') || '3', 10);
  const daysToCheck = Math.min(Math.max(daysParam, 1), 14);

  // Determine start date
  let startDate;
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    startDate = dateParam;
  } else {
    // Default to today in tenant timezone
    const now = toZonedTime(new Date(), tenantTimezone);
    startDate = format(now, 'yyyy-MM-dd');
  }

  // Load scheduling data in parallel
  const now = new Date();
  const [appointmentsResult, eventsResult, zonesResult, buffersResult] = await Promise.all([
    supabase
      .from('appointments')
      .select('start_time, end_time, zone_id')
      .eq('tenant_id', tenant.id)
      .neq('status', 'cancelled')
      .gte('end_time', now.toISOString()),
    supabase
      .from('calendar_events')
      .select('start_time, end_time')
      .eq('tenant_id', tenant.id)
      .gte('end_time', now.toISOString()),
    supabase
      .from('service_zones')
      .select('id, name, postal_codes')
      .eq('tenant_id', tenant.id),
    supabase
      .from('zone_travel_buffers')
      .select('zone_a_id, zone_b_id, buffer_mins')
      .eq('tenant_id', tenant.id),
  ]);

  // Calculate slots for each day in range
  const allSlots = [];

  for (let dayOffset = 0; dayOffset < daysToCheck; dayOffset++) {
    // Compute target date string by offsetting from startDate
    const [year, month, day] = startDate.split('-').map(Number);
    const targetDateObj = new Date(year, month - 1, day + dayOffset);
    const targetDateStr = format(targetDateObj, 'yyyy-MM-dd');

    const daySlots = calculateAvailableSlots({
      workingHours: tenant.working_hours || {},
      slotDurationMins: tenant.slot_duration_mins || 60,
      existingBookings: appointmentsResult.data || [],
      externalBlocks: eventsResult.data || [],
      zones: zonesResult.data || [],
      zonePairBuffers: buffersResult.data || [],
      targetDate: targetDateStr,
      tenantTimezone,
      maxSlots: 20, // generous per-day limit for dashboard
    });

    // Add human-readable label for each slot
    const labeledSlots = daySlots.map((slot) => {
      const zonedStart = toZonedTime(new Date(slot.start), tenantTimezone);
      return {
        start: slot.start,
        end: slot.end,
        label: format(zonedStart, "EEEE MMMM do 'at' h:mm a"),
      };
    });

    allSlots.push(...labeledSlots);
  }

  return Response.json({ slots: allSlots });
}

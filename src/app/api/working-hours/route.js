import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

function isValidTimeZone(tz) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      console.log('401: Unauthorized');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('tenants')
      .select('working_hours, slot_duration_mins, travel_buffer_mins, tenant_timezone')
      .eq('id', tenantId)
      .single();

    if (error) {
      console.log('500:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      working_hours: data.working_hours,
      slot_duration_mins: data.slot_duration_mins,
      travel_buffer_mins: data.travel_buffer_mins,
      tenant_timezone: data.tenant_timezone,
    });
  } catch (err) {
    console.log('500:', err.message, err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      console.log('401: Unauthorized');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { working_hours, slot_duration_mins, travel_buffer_mins, tenant_timezone } = await request.json();

    const updates = {};
    if (working_hours !== undefined) {
      // Defense-in-depth (DASH-1): the enforced call-readiness gate (migration 078)
      // treats working_hours in ('null','{}') as NOT set, and the setup checklist
      // mirrors that. Reject an empty/non-object payload so a crafted PUT can't
      // create the {}-divergence where the checklist shows complete but the gate
      // fails. The WorkingHoursEditor always sends a full 7-day object.
      if (
        typeof working_hours !== 'object' ||
        working_hours === null ||
        Array.isArray(working_hours) ||
        Object.keys(working_hours).length === 0
      ) {
        return Response.json(
          { error: 'working_hours must be a non-empty object' },
          { status: 400 },
        );
      }
      updates.working_hours = working_hours;
    }
    // Reject slot_duration_mins <= 0 (the slot calculators step by this value, so
    // 0/negative is a non-terminating loop) and invalid timezones (2026-06-12 audit LOW-27).
    if (slot_duration_mins !== undefined) {
      const n = Number(slot_duration_mins);
      if (!Number.isInteger(n) || n < 5 || n > 480) {
        return Response.json(
          { error: 'slot_duration_mins must be an integer between 5 and 480' },
          { status: 400 },
        );
      }
      updates.slot_duration_mins = n;
    }
    // Travel buffer (M16 P2): minutes the slot calculator leaves between back-to-back
    // jobs. 0 disables buffering; cap at 240 (4h) — generous, still bounded.
    if (travel_buffer_mins !== undefined) {
      const n = Number(travel_buffer_mins);
      if (!Number.isInteger(n) || n < 0 || n > 240) {
        return Response.json(
          { error: 'travel_buffer_mins must be an integer between 0 and 240' },
          { status: 400 },
        );
      }
      updates.travel_buffer_mins = n;
    }
    if (tenant_timezone !== undefined) {
      if (typeof tenant_timezone !== 'string' || !isValidTimeZone(tenant_timezone)) {
        return Response.json(
          { error: 'tenant_timezone must be a valid IANA timezone' },
          { status: 400 },
        );
      }
      updates.tenant_timezone = tenant_timezone;
    }

    const { data, error } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', tenantId)
      .select('working_hours, slot_duration_mins, travel_buffer_mins, tenant_timezone')
      .single();

    if (error) {
      console.log('500:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      working_hours: data.working_hours,
      slot_duration_mins: data.slot_duration_mins,
      travel_buffer_mins: data.travel_buffer_mins,
      tenant_timezone: data.tenant_timezone,
    });
  } catch (err) {
    console.log('500:', err.message, err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

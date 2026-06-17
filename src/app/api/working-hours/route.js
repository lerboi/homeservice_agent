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
      .select('working_hours, slot_duration_mins, tenant_timezone')
      .eq('id', tenantId)
      .single();

    if (error) {
      console.log('500:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      working_hours: data.working_hours,
      slot_duration_mins: data.slot_duration_mins,
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

    const { working_hours, slot_duration_mins, tenant_timezone } = await request.json();

    const updates = {};
    if (working_hours !== undefined) updates.working_hours = working_hours;
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
      .select('working_hours, slot_duration_mins, tenant_timezone')
      .single();

    if (error) {
      console.log('500:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      working_hours: data.working_hours,
      slot_duration_mins: data.slot_duration_mins,
      tenant_timezone: data.tenant_timezone,
    });
  } catch (err) {
    console.log('500:', err.message, err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

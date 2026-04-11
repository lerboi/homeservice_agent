import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

const E164_RE = /^\+[1-9]\d{1,14}$/;
const VALID_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('call_forwarding_schedule, pickup_numbers, dial_timeout_seconds, working_hours, phone_number, country')
      .eq('id', tenantId)
      .single();

    if (tenantError) {
      console.log('500:', tenantError.message);
      return Response.json({ error: tenantError.message }, { status: 500 });
    }

    // Compute monthly outbound usage
    const now = new Date();
    const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`;

    const { data: usageRows, error: usageError } = await supabase
      .from('calls')
      .select('outbound_dial_duration_sec')
      .eq('tenant_id', tenantId)
      .gte('created_at', monthStart);

    if (usageError) {
      console.log('500:', usageError.message);
      return Response.json({ error: usageError.message }, { status: 500 });
    }

    const usedSeconds = (usageRows || []).reduce(
      (sum, r) => sum + (r.outbound_dial_duration_sec || 0),
      0
    );
    const capMinutes = tenant.country === 'SG' ? 2500 : 5000;

    return Response.json({
      call_forwarding_schedule: tenant.call_forwarding_schedule,
      pickup_numbers: tenant.pickup_numbers,
      dial_timeout_seconds: tenant.dial_timeout_seconds,
      usage: {
        used_seconds: usedSeconds,
        used_minutes: Math.floor(usedSeconds / 60),
        cap_minutes: capMinutes,
        country: tenant.country,
      },
      working_hours: tenant.working_hours,
    });
  } catch (err) {
    console.log('500:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { call_forwarding_schedule, pickup_numbers, dial_timeout_seconds } =
      await request.json();

    // Fetch tenant's phone_number for self-reference check
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('phone_number')
      .eq('id', tenantId)
      .single();

    if (tenantError) {
      console.log('500:', tenantError.message);
      return Response.json({ error: tenantError.message }, { status: 500 });
    }

    // ── Validate dial_timeout_seconds ──────────────────────────────────────

    if (
      !Number.isInteger(dial_timeout_seconds) ||
      dial_timeout_seconds < 10 ||
      dial_timeout_seconds > 30
    ) {
      return Response.json(
        { error: 'Dial timeout must be between 10 and 30 seconds (dial_timeout)' },
        { status: 400 }
      );
    }

    // ── Validate call_forwarding_schedule ──────────────────────────────────

    if (!call_forwarding_schedule || typeof call_forwarding_schedule !== 'object') {
      return Response.json(
        { error: 'Invalid schedule: schedule is required' },
        { status: 400 }
      );
    }

    if (typeof call_forwarding_schedule.enabled !== 'boolean') {
      return Response.json(
        { error: 'Invalid schedule: enabled must be a boolean' },
        { status: 400 }
      );
    }

    if (!call_forwarding_schedule.days || typeof call_forwarding_schedule.days !== 'object') {
      return Response.json(
        { error: 'Invalid schedule: days is required' },
        { status: 400 }
      );
    }

    for (const [day, ranges] of Object.entries(call_forwarding_schedule.days)) {
      if (!VALID_DAYS.includes(day)) {
        return Response.json(
          { error: `Invalid schedule: unknown day "${day}"` },
          { status: 400 }
        );
      }

      if (!Array.isArray(ranges)) {
        return Response.json(
          { error: `Invalid schedule: day "${day}" must be an array` },
          { status: 400 }
        );
      }

      for (const range of ranges) {
        if (!range.start || !range.end) {
          return Response.json(
            { error: `Invalid schedule: each time range must have start and end` },
            { status: 400 }
          );
        }

        if (!TIME_RE.test(range.start) || !TIME_RE.test(range.end)) {
          return Response.json(
            { error: `Invalid schedule: time format must be HH:MM (invalid time format)` },
            { status: 400 }
          );
        }

        if (range.start === range.end) {
          return Response.json(
            { error: `Invalid schedule: start equals end time for ${day}` },
            { status: 400 }
          );
        }
      }
    }

    // ── Validate pickup_numbers ────────────────────────────────────────────

    if (!Array.isArray(pickup_numbers)) {
      return Response.json(
        { error: 'pickup_numbers must be an array' },
        { status: 400 }
      );
    }

    if (pickup_numbers.length > 5) {
      return Response.json(
        { error: 'Maximum 5 pickup numbers allowed' },
        { status: 400 }
      );
    }

    const seenNumbers = new Set();
    for (const item of pickup_numbers) {
      if (!item.number || typeof item.number !== 'string') {
        return Response.json(
          { error: 'Each pickup number must have a number field' },
          { status: 400 }
        );
      }

      if (!E164_RE.test(item.number)) {
        return Response.json(
          { error: `Invalid phone number format: ${item.number}` },
          { status: 400 }
        );
      }

      if (seenNumbers.has(item.number)) {
        return Response.json(
          { error: `Duplicate phone number: ${item.number}` },
          { status: 400 }
        );
      }
      seenNumbers.add(item.number);

      if (item.number === tenant.phone_number) {
        return Response.json(
          { error: 'Cannot forward to your own Voco business number' },
          { status: 400 }
        );
      }
    }

    // ── Cross-field validation ─────────────────────────────────────────────

    if (call_forwarding_schedule.enabled && pickup_numbers.length === 0) {
      return Response.json(
        { error: 'Add at least one pickup number to route calls to you' },
        { status: 400 }
      );
    }

    // ── Persist ────────────────────────────────────────────────────────────

    const { data: updated, error: updateError } = await supabase
      .from('tenants')
      .update({ call_forwarding_schedule, pickup_numbers, dial_timeout_seconds })
      .eq('id', tenantId)
      .select('call_forwarding_schedule, pickup_numbers, dial_timeout_seconds')
      .single();

    if (updateError) {
      console.log('500:', updateError.message);
      return Response.json({ error: updateError.message }, { status: 500 });
    }

    return Response.json({
      call_forwarding_schedule: updated.call_forwarding_schedule,
      pickup_numbers: updated.pickup_numbers,
      dial_timeout_seconds: updated.dial_timeout_seconds,
    });
  } catch (err) {
    console.log('500:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

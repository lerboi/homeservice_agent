import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

const VALID_OUTCOMES = ['booked', 'declined', 'not_attempted', 'attempted'];

const DEFAULT_PREFERENCES = {
  booked: { sms: true, email: true },
  declined: { sms: false, email: false },
  not_attempted: { sms: false, email: false },
  attempted: { sms: false, email: false },
};

function validatePreferences(prefs) {
  if (!prefs || typeof prefs !== 'object') return false;
  for (const key of VALID_OUTCOMES) {
    if (!prefs[key] || typeof prefs[key] !== 'object') return false;
    if (typeof prefs[key].sms !== 'boolean' || typeof prefs[key].email !== 'boolean') return false;
  }
  return true;
}

export async function GET() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('tenants')
      .select('notification_preferences')
      .eq('id', tenantId)
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      notification_preferences: data.notification_preferences || DEFAULT_PREFERENCES,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { notification_preferences } = await request.json();

    if (!validatePreferences(notification_preferences)) {
      return Response.json(
        { error: 'Invalid preferences. Each outcome (booked, declined, not_attempted, attempted) must have { sms: boolean, email: boolean }.' },
        { status: 400 }
      );
    }

    // Only store the 4 known outcomes (strip any extra keys)
    const cleaned = {};
    for (const key of VALID_OUTCOMES) {
      cleaned[key] = {
        sms: notification_preferences[key].sms,
        email: notification_preferences[key].email,
      };
    }

    const { data, error } = await supabase
      .from('tenants')
      .update({ notification_preferences: cleaned })
      .eq('id', tenantId)
      .select('notification_preferences')
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ notification_preferences: data.notification_preferences });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

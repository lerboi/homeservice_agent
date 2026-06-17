import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase as adminSupabase } from '@/lib/supabase';

// Single-timezone countries are pinned server-side; multi-timezone countries
// (US/CA) trust the browser-detected IANA zone sent by the contact step.
const COUNTRY_TIMEZONE = {
  SG: 'Asia/Singapore',
};

// E.164: '+' followed by 7-15 digits. The client builds this from a country
// prefix + local digits; reject anything else (a bare '+65' once slipped
// through and broke SMS notifications + test calls downstream).
const E164_RE = /^\+\d{7,15}$/;

function isValidIanaTimezone(tz) {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function POST(request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { phone, owner_name, country, timezone } = await request.json();

  // Server-side enforcement: block SG onboarding if no numbers available (COUNTRY-03)
  if (country === 'SG') {
    const { count, error: countError } = await adminSupabase
      .from('phone_inventory')
      .select('*', { count: 'exact', head: true })
      .eq('country', 'SG')
      .eq('status', 'available');

    if (countError) {
      // Transient DB error is NOT the same as "sold out" — don't push the
      // user onto the waitlist over a hiccup.
      console.error('500: SG availability check failed:', countError.message);
      return Response.json(
        { error: "We couldn't check number availability. Please try again." },
        { status: 503 }
      );
    }

    if ((count ?? 0) === 0) {
      return Response.json(
        { error: 'No Singapore numbers are currently available. Please join the waitlist.' },
        { status: 409 }
      );
    }
  }

  // Always save the user's auth email; phone, owner_name, country are optional
  const updateFields = { owner_email: user.email };
  if (phone?.trim()) {
    const trimmed = phone.trim();
    if (!E164_RE.test(trimmed)) {
      return Response.json(
        { error: "That phone number doesn't look right. Check the format and try again." },
        { status: 400 }
      );
    }
    updateFields.owner_phone = trimmed;
  }
  if (owner_name?.trim()) updateFields.owner_name = owner_name.trim();
  if (country && ['SG', 'US', 'CA'].includes(country)) {
    updateFields.country = country;
    // Set the tenant timezone here — the only point in onboarding where we
    // learn location. Without this, every tenant keeps the DB default
    // (America/Chicago) and slot calculation runs in the wrong timezone.
    const pinned = COUNTRY_TIMEZONE[country];
    if (pinned) {
      updateFields.tenant_timezone = pinned;
    } else if (isValidIanaTimezone(timezone)) {
      updateFields.tenant_timezone = timezone;
    }
  }

  const { data: updated, error: updateError } = await adminSupabase
    .from('tenants')
    .update(updateFields)
    .eq('owner_id', user.id)
    .select('id');

  if (updateError) {
    console.error('500: sms-confirm tenant update failed:', updateError.message);
    return Response.json(
      { error: 'Something went wrong saving your details. Please try again.' },
      { status: 500 }
    );
  }

  if (!updated || updated.length === 0) {
    // No tenant row yet — user reached this step without completing step 1
    // (e.g. direct URL in a fresh session). Previously this returned
    // saved:true while saving nothing, and the checkout webhook later failed
    // provisioning on country=NULL.
    return Response.json(
      { error: 'Tenant not found. Complete step 1 first.' },
      { status: 400 }
    );
  }

  return Response.json({ saved: true });
}

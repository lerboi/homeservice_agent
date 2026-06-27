import { connection } from 'next/server';
import { supabase } from '@/lib/supabase';

// Public GET endpoint — no auth required per D-07.
// Fires on country dropdown change before the user has completed the step,
// so it must work without a session. Uses service_role client since
// phone_inventory has no authenticated SELECT policy.
export async function GET() {
  // Live inventory count — it must never be prerendered/frozen at build under
  // cacheComponents. connection() opts this route into per-request execution
  // (the cacheComponents-safe replacement for `export const dynamic`).
  await connection();

  const { count, error } = await supabase
    .from('phone_inventory')
    .select('*', { count: 'exact', head: true })
    .eq('country', 'SG')
    .eq('status', 'available');

  if (error) {
    console.error('[sg-availability] Error checking availability:', error);
    // A transient DB error is NOT sold-out. Return null (not 0) + 503 so the
    // client treats availability as UNKNOWN — it must not flip to the waitlist
    // panel or disable Continue on a DB hiccup. Mirrors sms-confirm's 503-vs-409
    // distinction; the authoritative sold-out gate runs at sms-confirm time.
    return Response.json({ available_count: null, error: 'check_failed' }, { status: 503 });
  }

  return Response.json({ available_count: count ?? 0 });
}

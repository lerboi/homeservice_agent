import { supabase } from '@/lib/supabase';

// Public GET endpoint — no auth required per D-07.
// Fires on country dropdown change before the user has completed the step,
// so it must work without a session. Uses service_role client since
// phone_inventory has no authenticated SELECT policy.
export async function GET() {
  const { count, error } = await supabase
    .from('phone_inventory')
    .select('*', { count: 'exact', head: true })
    .eq('country', 'SG')
    .eq('status', 'available');

  if (error) {
    console.error('[sg-availability] Error checking availability:', error);
    return Response.json({ available_count: 0 });
  }

  return Response.json({ available_count: count ?? 0 });
}

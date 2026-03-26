import { supabase } from '@/lib/supabase';

// POST endpoint for joining the SG waitlist.
// No auth required — user may be in a blocked state (all SG numbers assigned)
// before completing auth steps. Uses service_role client for insert since
// phone_inventory_waitlist RLS only allows INSERT for anon/authenticated.
export async function POST(request) {
  const { email } = await request.json();

  if (!email || !email.includes('@')) {
    return Response.json({ error: 'Valid email required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('phone_inventory_waitlist')
    .insert({ email: email.trim().toLowerCase(), country: 'SG' });

  if (error) {
    console.error('[sg-waitlist] Error joining waitlist:', error);
    return Response.json({ error: 'Failed to join waitlist' }, { status: 500 });
  }

  return Response.json({ joined: true });
}

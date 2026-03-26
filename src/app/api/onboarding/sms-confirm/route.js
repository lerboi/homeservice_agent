import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase as adminSupabase } from '@/lib/supabase';

export async function POST(request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { phone, owner_name, country } = await request.json();

  // Server-side enforcement: block SG onboarding if no numbers available (COUNTRY-03)
  if (country === 'SG') {
    const { count, error: countError } = await adminSupabase
      .from('phone_inventory')
      .select('*', { count: 'exact', head: true })
      .eq('country', 'SG')
      .eq('status', 'available');

    if (countError || (count ?? 0) === 0) {
      return Response.json(
        { error: 'No Singapore numbers are currently available. Please join the waitlist.' },
        { status: 409 }
      );
    }
  }

  // Always save the user's auth email; phone, owner_name, country are optional
  const updateFields = { owner_email: user.email };
  if (phone?.trim()) updateFields.owner_phone = phone.trim();
  if (owner_name?.trim()) updateFields.owner_name = owner_name.trim();
  if (country && ['SG', 'US', 'CA'].includes(country)) updateFields.country = country;

  await adminSupabase
    .from('tenants')
    .update(updateFields)
    .eq('owner_id', user.id);

  return Response.json({ saved: true });
}

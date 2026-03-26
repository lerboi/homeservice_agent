import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase'; // service-role

/**
 * Verify the current request is from an admin user.
 * Uses the session client for auth, then service-role to check admin_users.
 * Returns the user object if admin, null otherwise.
 */
export async function verifyAdmin() {
  const supabaseUser = await createSupabaseServer();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('admin_users')
    .select('id, role')
    .eq('user_id', user.id)
    .single();

  return data ? user : null;
}

import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { phone } = await request.json();
  const { error } = await supabase.auth.signInWithOtp({ phone });

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ sent: true });
}

import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { phone } = await request.json();
  const { error } = await supabase.auth.signInWithOtp({ phone });

  if (error) {
    console.log('400:', error.message);
    return Response.json({ error: error.message }, { status: 400 });
  }
  return Response.json({ sent: true });
}

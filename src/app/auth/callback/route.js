import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  // Validate redirect target — only allow relative paths to prevent open redirect
  const rawNext = searchParams.get('next') || '/onboarding';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/onboarding';

  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL('/auth/signin?error=auth_failed', request.url));
    }
  }
  return NextResponse.redirect(new URL(next, request.url));
}

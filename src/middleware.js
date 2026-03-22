import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// All onboarding and dashboard paths require authentication.
// Auth pages (/auth/signin) are public.
const AUTH_REQUIRED_PATHS = [
  '/onboarding',
  '/dashboard',
];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRequired = AUTH_REQUIRED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  // Unauthenticated user trying to access protected paths → send to sign in
  if (!user && isAuthRequired) {
    return NextResponse.redirect(new URL('/auth/signin', request.url));
  }

  // Authenticated user on /auth/signin — allow through.
  // The page handles post-auth navigation itself. Redirecting here would
  // break the OTP flow (signInWithOtp sets cookies before OTP is verified).
  if (user && pathname.startsWith('/auth/signin')) {
    return response;
  }

  // Authenticated user on onboarding paths → check if already complete
  if (user && pathname.startsWith('/onboarding')) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('onboarding_complete')
      .eq('owner_id', user.id)
      .single();

    if (tenant?.onboarding_complete === true) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return response;
  }

  return response;
}

export const config = {
  matcher: ['/onboarding/:path*', '/onboarding', '/dashboard/:path*', '/dashboard', '/auth/signin'],
};

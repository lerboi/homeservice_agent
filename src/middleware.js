import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// Step 1 (/onboarding) is PUBLIC — it is the auth step itself.
// Steps 2-5 and /dashboard require authentication.
const AUTH_REQUIRED_PATHS = [
  '/onboarding/profile',
  '/onboarding/services',
  '/onboarding/contact',
  '/onboarding/test-call',
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

  // Unauthenticated user trying to access protected paths → send to step 1
  if (!user && isAuthRequired) {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  // Authenticated user on /onboarding (step 1) → check if already complete
  if (user && pathname === '/onboarding') {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('onboarding_complete')
      .eq('owner_id', user.id)
      .single();

    if (tenant?.onboarding_complete === true) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Not complete (or no tenant yet) → allow through step 1
    return response;
  }

  // Authenticated user on onboarding sub-paths → check if already complete
  if (
    user &&
    (pathname.startsWith('/onboarding/profile') ||
      pathname.startsWith('/onboarding/services') ||
      pathname.startsWith('/onboarding/contact') ||
      pathname.startsWith('/onboarding/test-call'))
  ) {
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

  // /dashboard paths → auth already verified above (isAuthRequired check)
  // No DB query needed for onboarding_complete on dashboard paths (avoid latency)
  return response;
}

export const config = {
  matcher: ['/onboarding/:path*', '/dashboard/:path*'],
};

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// All onboarding, dashboard, and admin paths require authentication.
// Auth pages (/auth/signin) are public.
const AUTH_REQUIRED_PATHS = [
  '/onboarding',
  '/dashboard',
  '/admin',
];

export async function proxy(request) {
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

  // Admin route gate — per D-03: middleware checks /admin/* by querying admin_users
  const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/');

  if (isAdminPath) {
    if (!user) {
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
      return NextResponse.redirect(signInUrl);
    }
    // Check admin_users table — uses anon key client (user's own session)
    const { data: adminRecord } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!adminRecord) {
      // Rewrite to forbidden page — URL stays at attempted path (better UX)
      return NextResponse.rewrite(new URL('/admin/forbidden', request.url));
    }
    // Admin verified — continue to requested admin page
    return response;
  }

  const isAuthRequired = AUTH_REQUIRED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  // Unauthenticated user trying to access protected paths → send to sign in
  // Preserve the original URL so we can redirect back after auth
  if (!user && isAuthRequired) {
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  // Authenticated user on a matched path → check onboarding status once
  if (user) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('onboarding_complete, id')
      .eq('owner_id', user.id)
      .single();

    const onboarded = tenant?.onboarding_complete === true;

    // Already signed in → route away from auth page
    if (pathname.startsWith('/auth/signin')) {
      return NextResponse.redirect(
        new URL(onboarded ? '/dashboard' : '/onboarding', request.url)
      );
    }

    // Finished onboarding → skip wizard, go to dashboard
    // Exception: allow /onboarding/checkout with session_id (returning from Stripe to show celebration)
    if (pathname.startsWith('/onboarding') && onboarded) {
      const isCheckoutReturn = pathname === '/onboarding/checkout' && request.nextUrl.searchParams.has('session_id');
      if (!isCheckoutReturn) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    // Haven't onboarded yet → can't access dashboard
    if (pathname.startsWith('/dashboard') && !onboarded) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    // ── Subscription gate (ENFORCE-04, D-09, D-10) ────────────────────────────
    // Check subscription status for dashboard routes. /billing/* is NOT in the
    // matcher config, so those paths are automatically exempt per D-10.
    const isDashboardPath = pathname === '/dashboard' || pathname.startsWith('/dashboard/');

    if (isDashboardPath && tenant) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status, stripe_updated_at')
        .eq('tenant_id', tenant.id)
        .eq('is_current', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const blockedStatuses = ['canceled', 'paused', 'incomplete'];
      if (sub && blockedStatuses.includes(sub.status)) {
        return NextResponse.redirect(new URL('/billing/upgrade', request.url));
      }

      // Block past_due tenants after 3-day grace period expires
      if (sub?.status === 'past_due' && sub.stripe_updated_at) {
        const gracePeriodMs = 3 * 24 * 60 * 60 * 1000;
        const elapsed = Date.now() - new Date(sub.stripe_updated_at).getTime();
        if (elapsed > gracePeriodMs) {
          return NextResponse.redirect(new URL('/billing/upgrade', request.url));
        }
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/onboarding/:path*', '/onboarding', '/dashboard/:path*', '/dashboard', '/admin/:path*', '/admin', '/auth/signin'],
};

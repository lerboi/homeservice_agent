import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
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
      .select('onboarding_complete, id, features_enabled')
      .eq('owner_id', user.id)
      .single();

    const onboarded = tenant?.onboarding_complete === true;

    // Already signed in → route away from auth page (honor validated ?redirect)
    if (pathname.startsWith('/auth/signin')) {
      const fallback = onboarded ? '/dashboard' : '/onboarding';
      const raw = request.nextUrl.searchParams.get('redirect');
      let safe = fallback;
      if (raw) {
        try {
          // Validate against the RESOLVED origin, not string prefixes — a
          // prefix check is bypassable (a backslash like "/\\host" parses to
          // an external origin). Require the redirect to stay on this origin
          // and not loop back to the signin page.
          const dest = new URL(raw, request.nextUrl.origin);
          if (dest.origin === request.nextUrl.origin && !dest.pathname.startsWith('/auth/signin')) {
            safe = dest.pathname + dest.search + dest.hash;
          }
        } catch {
          // Malformed redirect — keep the fallback.
        }
      }
      return NextResponse.redirect(new URL(safe, request.url));
    }

    // Finished onboarding → skip wizard, go to dashboard
    // Exception: allow /onboarding/checkout with session_id (returning from Stripe to show celebration)
    if (pathname.startsWith('/onboarding') && onboarded) {
      const isCheckoutReturn = pathname === '/onboarding/checkout' && request.nextUrl.searchParams.has('session_id');
      if (!isCheckoutReturn) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    // Haven't onboarded yet → can't access dashboard.
    // Rescue path (2026-06-12 onboarding audit C5): a customer whose
    // checkout.session.completed webhook was delayed past the checkout page's
    // polling window has PAID (subscription row exists) but still has
    // onboarding_complete=false — bouncing them to wizard step 1 strands a
    // paying customer. If a current subscription exists, repair the flag and
    // let them through. This branch only runs for non-onboarded users hitting
    // /dashboard (a rare, already-broken cohort), so the extra service-role
    // query is off the hot path.
    if (pathname.startsWith('/dashboard') && !onboarded) {
      if (tenant?.id && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const serviceClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          { auth: { persistSession: false } }
        );
        const { data: liveSub } = await serviceClient
          .from('subscriptions')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('is_current', true)
          .in('status', ['active', 'trialing', 'past_due'])
          .maybeSingle();

        if (liveSub) {
          await serviceClient
            .from('tenants')
            .update({ onboarding_complete: true })
            .eq('id', tenant.id);
          console.warn(`[proxy] Repaired onboarding_complete for paid tenant ${tenant.id} (webhook lag rescue)`);
          return response;
        }
      }
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    // ── Subscription gate (ENFORCE-04, D-09, D-10) ────────────────────────────
    // Deliberate: subscription status does NOT block dashboard access. The
    // BillingWarningBanner shows persistent warnings, and call-side enforcement
    // (the part that costs money) lives in the LiveKit agent's gate, which
    // blocks canceled/paused/incomplete and past_due beyond the 3-day grace.
    // The previous status query here was dead code — it fetched the row and
    // ignored it, costing a service-role round trip on every dashboard
    // navigation — so it was removed (2026-06-12 audit H1).

    // ── Feature flag gate (TOGGLE-02 pages, D-01) ────────────────────────────
    // Redirect to /dashboard when a tenant tries to visit an invoicing page with
    // features_enabled.invoicing = false. Reads from the EXISTING tenant fetch
    // above — DO NOT add a second supabase.from('tenants') call here (Pitfall 3).
    //
    // /dashboard/more/features is intentionally NOT in this list — it is the
    // panel where owners re-enable invoicing, and must remain accessible when
    // the flag is off (Pitfall 6).
    const INVOICING_GATED_PATHS = [
      '/dashboard/invoices',
      '/dashboard/estimates',
      '/dashboard/more/invoice-settings',
    ];

    const isInvoicingGatedPath = INVOICING_GATED_PATHS.some(
      (p) => pathname === p || pathname.startsWith(p + '/')
    );

    if (isInvoicingGatedPath && tenant) {
      const invoicingEnabled = tenant.features_enabled?.invoicing === true;
      if (!invoicingEnabled) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/onboarding/:path*', '/onboarding', '/dashboard/:path*', '/dashboard', '/admin/:path*', '/admin', '/auth/signin'],
};

import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.js');

// Build a Sentry CSP report endpoint from the DSN (all public values) so
// Report-Only violations are actually collected. Null if no DSN configured.
function sentryCspReportUri() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, '');
    return `${u.protocol}//${u.host}/api/${projectId}/security/?sentry_key=${u.username}`;
  } catch {
    return null;
  }
}

// CSP ships Report-Only first (2026-06-12 audit M23): violations are reported
// but nothing is blocked, so we can validate coverage of Stripe / Supabase /
// Sentry / LiveKit / Google Maps before flipping to an enforcing policy.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://maps.googleapis.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.us.sentry.io https://api.stripe.com https://maps.googleapis.com wss://*.livekit.cloud https://*.livekit.cloud",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  ...(sentryCspReportUri() ? [`report-uri ${sentryCspReportUri()}`] : []),
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) || [],
  serverExternalPackages: ['@react-pdf/renderer'],
  // Next.js 16 — opts the app into the 'use cache' + cacheTag + revalidateTag pipeline.
  // Phase 54 INTFOUND-03. Smoke test: src/lib/integrations/status.js getIntegrationStatus.
  cacheComponents: true,
  async headers() {
    // Static security headers applied to every route. CSP ships Report-Only
    // first (2026-06-12 audit M23) to surface violations before enforcing.
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy-Report-Only',
            value: CSP_REPORT_ONLY,
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            // microphone=(self): the admin test console (/admin/test-agent)
            // captures the browser mic to talk to the AI receptionist.
            // `()` (2026-06-03 hardening) made getUserMedia reject with
            // NotAllowedError and the browser offered no way to grant it.
            // Site-wide on purpose: Permissions-Policy binds to the loaded
            // document, and App Router navigations are client-side, so a
            // route-scoped header would not cover a user who reached the
            // console via the admin tabs or the sign-in redirect. `self`
            // still limits it to our own origin and to a user grant.
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/dashboard/leads',
        destination: '/dashboard/jobs',
        permanent: true,
      },
      {
        source: '/dashboard/leads/:path*',
        destination: '/dashboard/jobs/:path*',
        permanent: true,
      },
    ];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});

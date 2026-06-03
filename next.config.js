import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.js');
/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) || [],
  serverExternalPackages: ['@react-pdf/renderer'],
  // Next.js 16 — opts the app into the 'use cache' + cacheTag + revalidateTag pipeline.
  // Phase 54 INTFOUND-03. Smoke test: src/lib/integrations/status.js getIntegrationStatus.
  cacheComponents: true,
  async headers() {
    // Static security headers applied to every route. CSP is intentionally
    // deferred to a later Report-Only rollout (Stripe / Spline-WASM risk).
    return [
      {
        source: '/:path*',
        headers: [
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
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
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

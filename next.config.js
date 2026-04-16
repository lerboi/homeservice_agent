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

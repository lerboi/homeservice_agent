import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.js');
/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) || [],
  serverExternalPackages: ['@react-pdf/renderer'],
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

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  sendDefaultPii: false,
});

// Required by Next.js 16 / @sentry/nextjs to capture client-side router
// navigation transitions for tracing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

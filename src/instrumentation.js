import * as Sentry from '@sentry/nextjs';
import { validateEnv } from './lib/env';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Validate required env vars once at server boot. Wrapped so a bad env
    // never crashes dev (validateEnv only throws in production).
    try {
      validateEnv();
    } catch (err) {
      // In production validateEnv throws — re-throw so boot fails loudly.
      if (process.env.NODE_ENV === 'production') throw err;
      console.warn('[env] validateEnv error:', err);
    }
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.server.config');
  }
}

export const onRequestError = Sentry.captureRequestError;

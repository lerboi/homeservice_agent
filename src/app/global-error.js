'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

// Global error boundary — catches errors in the root layout itself.
// Renders its own <html>/<body> because it replaces the root layout when it
// fires, so Tailwind / app CSS are not available. Inline styles only.
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          backgroundColor: '#0a0a0a',
          color: '#ededed',
          padding: '1.5rem',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: '0.875rem',
              opacity: 0.7,
              marginBottom: '1.5rem',
              lineHeight: 1.5,
            }}
          >
            An unexpected error occurred. Our team has been notified. Please try again.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#0a0a0a',
              backgroundColor: '#ededed',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

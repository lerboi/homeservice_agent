// Environment variable validation.
//
// REQUIRED vars are the minimum set the app needs to boot and serve core
// flows (auth, billing, voice, notifications, cron). In production a missing
// REQUIRED var throws so the deploy fails loudly; in any other environment we
// only warn so local dev keeps working with a partial .env.
//
// Optional integrations (Stripe price IDs, ElevenLabs, Xero/Jobber,
// Google/Outlook calendars, Gemini/Groq, Sentry, contact emails) are NOT
// hard-required — their absence degrades a single feature, not the whole app.

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_APP_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'LIVEKIT_URL',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'RESEND_API_KEY',
  'CRON_SECRET',
];

/**
 * Validate that all REQUIRED env vars are present.
 * - In production: throws an Error listing the missing vars.
 * - Otherwise: logs a console.warn and returns the missing list.
 *
 * @returns {string[]} the list of missing required vars (empty if all present)
 */
export function validateEnv() {
  const missing = REQUIRED.filter((key) => {
    const value = process.env[key];
    return value === undefined || value === '';
  });

  if (missing.length === 0) {
    return [];
  }

  const message =
    `[env] Missing required environment variable(s): ${missing.join(', ')}`;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(message);
  }

  console.warn(`${message} (non-production — continuing)`);
  return missing;
}

export { REQUIRED };

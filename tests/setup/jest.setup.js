// Jest setup — provides fallback env vars so modules that eagerly construct
// Supabase / Stripe clients at import time don't throw during unit tests.
// Tests that actually exercise those clients mock them via jest.unstable_mockModule.

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
process.env.STRIPE_SECRET_KEY ||= 'sk_test_placeholder';
process.env.STRIPE_WEBHOOK_SECRET ||= 'whsec_test_placeholder';

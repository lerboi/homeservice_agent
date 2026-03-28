/**
 * Tests for billing checkout session (upgrade context — no trial).
 * Phase 25-01: BILLUI-04
 *
 * POST /api/billing/checkout-session creates a Stripe Checkout Session
 * for plan upgrades/reactivation. Key differences from onboarding checkout:
 * - No trial_period_days (immediate billing for reactivation)
 * - success_url → /dashboard?upgraded=true
 * - cancel_url → /billing/upgrade
 * - Uses existing stripe_customer_id when available
 *
 * Test 1: POST returns { url } for valid plan (growth)
 * Test 2: POST does NOT include trial_period_days in session config
 * Test 3: POST uses existing stripe_customer_id (not customer_email) when available
 * Test 4: POST sets success_url to /dashboard?upgraded=true
 * Test 5: POST sets cancel_url to /billing/upgrade
 * Test 6: POST returns 400 for invalid plan
 * Test 7: POST returns 401 when unauthenticated
 */

import { jest } from '@jest/globals';

// ─── Module-level mock state ───────────────────────────────────────────────────

let mockUser = { id: 'user-1', email: 'owner@test.com' };
let mockTenant = {
  id: 'tenant-1',
  owner_email: 'owner@test.com',
  business_name: 'Test Plumbing',
};
let mockSubscription = { stripe_customer_id: 'cus_existing123' };
let mockCheckoutUrl = 'https://checkout.stripe.com/session/test123';

// Capture create call args for assertion
let capturedSessionConfig = null;

const mockStripeCheckout = jest.fn().mockImplementation((config) => {
  capturedSessionConfig = config;
  return Promise.resolve({ url: mockCheckoutUrl });
});

// ─── Supabase mock ─────────────────────────────────────────────────────────────

const mockServerSupabase = {
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
  },
  from: jest.fn((table) => {
    if (table === 'tenants') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockTenant, error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockTenant, error: null }),
      };
    }
    if (table === 'subscriptions') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockSubscription, error: null }),
      };
    }
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
  }),
};

const mockAdminSupabase = {
  from: jest.fn((table) => {
    if (table === 'tenants') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockTenant, error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockTenant, error: null }),
      };
    }
    if (table === 'subscriptions') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockSubscription, error: null }),
      };
    }
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
  }),
};

// ─── Module mocking ────────────────────────────────────────────────────────────

jest.unstable_mockModule('@/lib/supabase-server', () => ({
  createSupabaseServer: jest.fn().mockResolvedValue(mockServerSupabase),
}));

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: mockAdminSupabase,
}));

jest.unstable_mockModule('@/lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: mockStripeCheckout,
      },
    },
  },
}));

// ─── Set env vars ─────────────────────────────────────────────────────────────

process.env.NEXT_PUBLIC_APP_URL = 'https://app.getvoco.ai';
process.env.STRIPE_PRICE_STARTER = 'price_starter_monthly';
process.env.STRIPE_PRICE_GROWTH = 'price_growth_monthly';
process.env.STRIPE_PRICE_SCALE = 'price_scale_monthly';
process.env.STRIPE_PRICE_STARTER_ANNUAL = 'price_starter_annual';
process.env.STRIPE_PRICE_GROWTH_ANNUAL = 'price_growth_annual';
process.env.STRIPE_PRICE_SCALE_ANNUAL = 'price_scale_annual';
process.env.STRIPE_PRICE_STARTER_OVERAGE = 'price_starter_overage';
process.env.STRIPE_PRICE_GROWTH_OVERAGE = 'price_growth_overage';
process.env.STRIPE_PRICE_SCALE_OVERAGE = 'price_scale_overage';

// ─── Import after mocking ──────────────────────────────────────────────────────

const { POST } = await import('@/app/api/billing/checkout-session/route.js');

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body) {
  return {
    json: jest.fn().mockResolvedValue(body),
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  capturedSessionConfig = null;
  mockStripeCheckout.mockClear();
  mockServerSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
  mockSubscription = { stripe_customer_id: 'cus_existing123' };
});

describe('POST /api/billing/checkout-session', () => {
  it('Test 1: returns { url } for valid plan (growth)', async () => {
    const req = makeRequest({ plan: 'growth', interval: 'monthly' });
    const response = await POST(req);
    const body = await response.json();
    expect(body.url).toBe(mockCheckoutUrl);
  });

  it('Test 2: does NOT include trial_period_days in session config', async () => {
    const req = makeRequest({ plan: 'growth', interval: 'monthly' });
    await POST(req);
    expect(capturedSessionConfig).not.toBeNull();
    // trial_period_days must NOT be present at top level or in subscription_data
    expect(capturedSessionConfig.trial_period_days).toBeUndefined();
    expect(capturedSessionConfig.subscription_data?.trial_period_days).toBeUndefined();
  });

  it('Test 3: uses existing stripe_customer_id when available', async () => {
    const req = makeRequest({ plan: 'growth', interval: 'monthly' });
    await POST(req);
    expect(capturedSessionConfig).not.toBeNull();
    // Should use customer: (existing ID), not customer_email:
    expect(capturedSessionConfig.customer).toBe('cus_existing123');
    expect(capturedSessionConfig.customer_email).toBeUndefined();
  });

  it('Test 4: sets success_url to /dashboard?upgraded=true', async () => {
    const req = makeRequest({ plan: 'growth', interval: 'monthly' });
    await POST(req);
    expect(capturedSessionConfig.success_url).toContain('/dashboard?upgraded=true');
  });

  it('Test 5: sets cancel_url to /billing/upgrade', async () => {
    const req = makeRequest({ plan: 'growth', interval: 'monthly' });
    await POST(req);
    expect(capturedSessionConfig.cancel_url).toContain('/billing/upgrade');
  });

  it('Test 6: returns 400 for invalid plan', async () => {
    const req = makeRequest({ plan: 'enterprise', interval: 'monthly' });
    const response = await POST(req);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  it('Test 7: returns 401 when unauthenticated', async () => {
    mockServerSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const req = makeRequest({ plan: 'growth', interval: 'monthly' });
    const response = await POST(req);
    expect(response.status).toBe(401);
  });
});

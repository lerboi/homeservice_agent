/**
 * Tests for billing portal return URL parameter.
 * Phase 25-01: BILLUI-05
 *
 * GET /api/billing/portal accepts an optional return_url query parameter.
 * Defaults to /dashboard/more/billing when not provided.
 *
 * Test 1: GET with ?return_url=/dashboard/more/billing uses that return_url
 * Test 2: GET without query param defaults to /dashboard/more/billing
 */

import { jest } from '@jest/globals';

// ─── Module-level mock state ───────────────────────────────────────────────────

let mockUser = { id: 'user-1' };
let mockTenant = { id: 'tenant-1' };
let mockSub = { stripe_customer_id: 'cus_portal123' };
let mockPortalUrl = 'https://billing.stripe.com/session/portal123';

let capturedPortalConfig = null;

const mockCreatePortal = jest.fn().mockImplementation((config) => {
  capturedPortalConfig = config;
  return Promise.resolve({ url: mockPortalUrl });
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
        maybeSingle: jest.fn().mockResolvedValue({ data: mockTenant, error: null }),
      };
    }
    if (table === 'subscriptions') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockSub, error: null }),
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

jest.unstable_mockModule('@/lib/stripe', () => ({
  stripe: {
    billingPortal: {
      sessions: {
        create: mockCreatePortal,
      },
    },
  },
}));

// ─── Set env vars ─────────────────────────────────────────────────────────────

process.env.NEXT_PUBLIC_APP_URL = 'https://app.getvoco.ai';

// ─── Import after mocking ──────────────────────────────────────────────────────

const { GET } = await import('@/app/api/billing/portal/route.js');

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(queryString = '') {
  const url = `https://app.getvoco.ai/api/billing/portal${queryString}`;
  return new Request(url);
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  capturedPortalConfig = null;
  mockCreatePortal.mockClear();
  mockServerSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
});

describe('GET /api/billing/portal return_url', () => {
  it('Test 1: GET with ?return_url=/dashboard/more/billing uses that return_url', async () => {
    const req = makeRequest('?return_url=/dashboard/more/billing');
    await GET(req);
    expect(capturedPortalConfig).not.toBeNull();
    expect(capturedPortalConfig.return_url).toContain('/dashboard/more/billing');
  });

  it('Test 2: GET without query param defaults to /dashboard/more/billing', async () => {
    const req = makeRequest(); // no query string
    await GET(req);
    expect(capturedPortalConfig).not.toBeNull();
    expect(capturedPortalConfig.return_url).toContain('/dashboard/more/billing');
  });
});

/**
 * Tests for subscription status gate in middleware.
 * Phase 24: ENFORCE-04 — blocked statuses redirect to /billing/upgrade
 *
 * Test 1: status='canceled' on /dashboard -> redirect to /billing/upgrade
 * Test 2: status='paused' on /dashboard -> redirect to /billing/upgrade
 * Test 3: status='incomplete' on /dashboard -> redirect to /billing/upgrade
 * Test 4: status='active' on /dashboard -> no redirect
 * Test 5: status='trialing' on /dashboard -> no redirect
 * Test 6: status='past_due' on /dashboard -> no redirect (grace period, banner handles it)
 * Test 7: No subscription row on /dashboard -> redirect to /billing/upgrade
 * Test 8: User on /billing/upgrade -> no subscription check (exempt path)
 */

import { jest } from '@jest/globals';

// ── Mock next/server ──────────────────────────────────────────────────────────

let mockRedirectUrl = null;
let mockNextCalled = false;

const mockResponse = { cookies: { set: jest.fn(), getAll: jest.fn(() => []) } };
const mockRedirectResponse = { type: 'redirect', cookies: { set: jest.fn() } };

jest.unstable_mockModule('next/server', () => ({
  NextResponse: {
    next: jest.fn(() => {
      mockNextCalled = true;
      return mockResponse;
    }),
    redirect: jest.fn((url) => {
      mockRedirectUrl = url.toString();
      return mockRedirectResponse;
    }),
    rewrite: jest.fn(() => mockResponse),
  },
}));

// ── Mock @supabase/ssr ────────────────────────────────────────────────────────

let mockGetUser;
let mockFrom;

function buildSupabaseMock(userResult, tenantResult, subResult) {
  mockGetUser = jest.fn().mockResolvedValue({
    data: { user: userResult },
  });

  // SSR client handles auth + tenants (RLS-scoped)
  mockFrom = jest.fn((table) => {
    if (table === 'tenants') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: tenantResult, error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: tenantResult, error: null }),
      };
    }
    if (table === 'admin_users') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      };
    }
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  // Admin client handles subscriptions (service role, bypasses RLS)
  currentMockAdminSupabase = {
    from: jest.fn((table) => {
      if (table === 'subscriptions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: subResult, error: null }),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  };

  return {
    auth: { getUser: mockGetUser },
    from: mockFrom,
    cookies: {
      getAll: jest.fn(() => []),
      set: jest.fn(),
    },
  };
}

jest.unstable_mockModule('@supabase/ssr', () => ({
  createServerClient: jest.fn((url, key, opts) => {
    return currentMockSupabase;
  }),
}));

jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => currentMockAdminSupabase),
}));

let currentMockSupabase;
let currentMockAdminSupabase;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(pathname, origin = 'http://localhost:3000') {
  const url = new URL(pathname, origin);
  return {
    nextUrl: {
      pathname,
      search: '',
      toString: () => url.toString(),
    },
    url: url.toString(),
    cookies: {
      getAll: jest.fn(() => []),
      set: jest.fn(),
    },
  };
}

let middleware;
let middlewareConfig;

beforeAll(async () => {
  const mod = await import('../../src/proxy.js');
  middleware = mod.proxy;
  middlewareConfig = mod.config;
});

beforeEach(() => {
  mockRedirectUrl = null;
  mockNextCalled = false;
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Subscription gate — blocked statuses redirect to /billing/upgrade', () => {
  it('Test 1: status=canceled on /dashboard redirects to /billing/upgrade', async () => {
    const user = { id: 'user-001' };
    const tenant = { id: 'tenant-001', onboarding_complete: true };
    const sub = { status: 'canceled' };

    currentMockSupabase = buildSupabaseMock(user, tenant, sub);

    const req = makeRequest('/dashboard');
    const result = await middleware(req);

    expect(mockRedirectUrl).toContain('/billing/upgrade');
  });

  it('Test 2: status=paused on /dashboard redirects to /billing/upgrade', async () => {
    const user = { id: 'user-002' };
    const tenant = { id: 'tenant-002', onboarding_complete: true };
    const sub = { status: 'paused' };

    currentMockSupabase = buildSupabaseMock(user, tenant, sub);

    const req = makeRequest('/dashboard');
    const result = await middleware(req);

    expect(mockRedirectUrl).toContain('/billing/upgrade');
  });

  it('Test 3: status=incomplete on /dashboard redirects to /billing/upgrade', async () => {
    const user = { id: 'user-003' };
    const tenant = { id: 'tenant-003', onboarding_complete: true };
    const sub = { status: 'incomplete' };

    currentMockSupabase = buildSupabaseMock(user, tenant, sub);

    const req = makeRequest('/dashboard');
    const result = await middleware(req);

    expect(mockRedirectUrl).toContain('/billing/upgrade');
  });
});

describe('Subscription gate — allowed statuses pass through without redirect', () => {
  it('Test 4: status=active on /dashboard does NOT redirect', async () => {
    const user = { id: 'user-004' };
    const tenant = { id: 'tenant-004', onboarding_complete: true };
    const sub = { status: 'active' };

    currentMockSupabase = buildSupabaseMock(user, tenant, sub);

    const req = makeRequest('/dashboard');
    const result = await middleware(req);

    expect(mockRedirectUrl).toBeNull();
  });

  it('Test 5: status=trialing on /dashboard does NOT redirect', async () => {
    const user = { id: 'user-005' };
    const tenant = { id: 'tenant-005', onboarding_complete: true };
    const sub = { status: 'trialing' };

    currentMockSupabase = buildSupabaseMock(user, tenant, sub);

    const req = makeRequest('/dashboard');
    const result = await middleware(req);

    expect(mockRedirectUrl).toBeNull();
  });

  it('Test 6: status=past_due on /dashboard does NOT redirect (grace period)', async () => {
    const user = { id: 'user-006' };
    const tenant = { id: 'tenant-006', onboarding_complete: true };
    const sub = { status: 'past_due' };

    currentMockSupabase = buildSupabaseMock(user, tenant, sub);

    const req = makeRequest('/dashboard');
    const result = await middleware(req);

    expect(mockRedirectUrl).toBeNull();
  });

  it('Test 7: No subscription row (sub=null) on /dashboard redirects to /billing/upgrade', async () => {
    const user = { id: 'user-007' };
    const tenant = { id: 'tenant-007', onboarding_complete: true };
    const sub = null;

    currentMockSupabase = buildSupabaseMock(user, tenant, sub);

    const req = makeRequest('/dashboard');
    const result = await middleware(req);

    expect(mockRedirectUrl).toContain('/billing/upgrade');
  });
});

describe('Subscription gate — exempt paths', () => {
  it('Test 8: /billing/upgrade is not in the middleware matcher so gate never runs', () => {
    // The middleware matcher only includes /dashboard/:path*, /onboarding, /admin, /auth/signin
    // /billing/* is NOT in the matcher — it is exempt automatically per D-10
    // Verify by inspecting the exported config from the beforeAll import
    const matcherStr = JSON.stringify(middlewareConfig.matcher);
    expect(matcherStr).not.toContain('/billing');
  });
});

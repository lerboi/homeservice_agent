/**
 * Unit tests for the Xero OAuth routes (Phase 55 Plan 03).
 * - /api/integrations/[provider]/auth — signed state + consent URL
 * - /api/integrations/[provider]/callback — upsert with error_state:null + two revalidateTags
 */

import { jest } from '@jest/globals';

// ─── Shared mocks ────────────────────────────────────────────────────────────

const mockGetUser = jest.fn();
const mockTenantSelect = jest.fn();
const mockUpsert = jest.fn();
const mockRevalidateTag = jest.fn();
const mockExchangeCode = jest.fn();
const mockGetAuthUrl = jest.fn();
const mockVerifyOAuthState = jest.fn();
const mockSignOAuthState = jest.fn();
const mockFrom = jest.fn();

jest.unstable_mockModule('next/cache', () => ({
  revalidateTag: (...args) => mockRevalidateTag(...args),
  cacheTag: jest.fn(),
}));

jest.unstable_mockModule('@/lib/supabase-server', () => ({
  createSupabaseServer: jest.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}));

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}));

jest.unstable_mockModule('@/lib/integrations/adapter', () => ({
  getIntegrationAdapter: jest.fn(async () => ({
    getAuthUrl: mockGetAuthUrl,
    exchangeCode: mockExchangeCode,
    revoke: jest.fn(),
  })),
}));

jest.unstable_mockModule('@/app/api/google-calendar/auth/route', () => ({
  signOAuthState: (...args) => mockSignOAuthState(...args),
  verifyOAuthState: (...args) => mockVerifyOAuthState(...args),
}));

// ─── Load routes after mocks ─────────────────────────────────────────────────

let authGET, callbackGET;

beforeAll(async () => {
  authGET = (await import('@/app/api/integrations/[provider]/auth/route')).GET;
  callbackGET = (await import('@/app/api/integrations/[provider]/callback/route')).GET;
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setupAuthHappy() {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  mockFrom.mockReturnValue({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: { id: 'tenant-1' } }),
      }),
    }),
  });
  mockSignOAuthState.mockReturnValue('signed-state-abc');
  mockGetAuthUrl.mockResolvedValue('https://login.xero.com/consent?state=signed-state-abc');
}

function setupCallbackHappy() {
  mockVerifyOAuthState.mockReturnValue('tenant-1');
  mockExchangeCode.mockResolvedValue({
    access_token: 'at', refresh_token: 'rt', expiry_date: Date.now() + 1800000,
    xero_tenant_id: 'org-1', display_name: 'Acme Co', scopes: ['accounting.contacts'],
  });
  // Supabase chain: upsert path + tenants select path + tenants update path
  mockFrom.mockImplementation((table) => {
    if (table === 'accounting_credentials') {
      return { upsert: (...args) => (mockUpsert(...args), Promise.resolve({ error: null })) };
    }
    if (table === 'tenants') {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: { features_enabled: { invoicing: true } } }),
          }),
        }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      };
    }
    return {};
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/integrations/[provider]/auth', () => {
  it('returns JSON { url } pointing at xero consent with signed state', async () => {
    setupAuthHappy();
    const req = new Request('http://localhost/api/integrations/xero/auth');
    const res = await authGET(req, { params: Promise.resolve({ provider: 'xero' }) });
    const body = await res.json();
    expect(body.url).toMatch(/login\.xero\.com|identity\.xero\.com/);
    expect(body.url).toContain('signed-state-abc');
    expect(mockSignOAuthState).toHaveBeenCalledWith('tenant-1');
  });

  it('rejects unsupported provider', async () => {
    const req = new Request('http://localhost/api/integrations/bogus/auth');
    const res = await authGET(req, { params: Promise.resolve({ provider: 'bogus' }) });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/integrations/[provider]/callback (xero)', () => {
  it('upserts credentials with error_state: null + scopes + xero_tenant_id', async () => {
    setupCallbackHappy();
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.voco';
    const req = new Request('https://test.voco/api/integrations/xero/callback?code=abc&state=ok');
    await callbackGET(req, { params: Promise.resolve({ provider: 'xero' }) });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [row] = mockUpsert.mock.calls[0];
    expect(row.error_state).toBeNull();
    expect(row.xero_tenant_id).toBe('org-1');
    expect(row.scopes).toEqual(['accounting.contacts']);
  });

  it('calls revalidateTag(integration-status-${tenantId}) AND revalidateTag(xero-context-${tenantId})', async () => {
    setupCallbackHappy();
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.voco';
    const req = new Request('https://test.voco/api/integrations/xero/callback?code=abc&state=ok');
    await callbackGET(req, { params: Promise.resolve({ provider: 'xero' }) });

    const calls = mockRevalidateTag.mock.calls.map((c) => c[0]);
    expect(calls).toContain('integration-status-tenant-1');
    expect(calls).toContain('xero-context-tenant-1');
  });

  it('rejects bad state (CSRF) — redirects with error=invalid_state', async () => {
    mockVerifyOAuthState.mockReturnValue(null);
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.voco';
    const req = new Request('https://test.voco/api/integrations/xero/callback?code=abc&state=bad');
    const res = await callbackGET(req, { params: Promise.resolve({ provider: 'xero' }) });
    const location = res.headers.get('location') || res.headers.get('Location');
    expect(location).toContain('error=invalid_state');
  });
});

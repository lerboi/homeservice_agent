/**
 * Integration tests for /api/integrations/[provider]/callback — Jobber-only
 * account-id probe (Phase 56 Plan 03 Task 3).
 *
 * Covers:
 *   T-CB-1: happy path — tokens persist AND external_account_id UPDATE fires
 *   T-CB-2: probe returns malformed JSON — tokens persist but no UPDATE,
 *           redirect contains error=account_probe_failed
 *   T-CB-3: probe returns 401 — tokens persist but no UPDATE
 *   T-CB-4: Xero path unchanged — no probe, no Jobber-only UPDATE
 */

import { jest } from '@jest/globals';

// ─── Supabase chain mocks ────────────────────────────────────────────────
const mockUpsert = jest.fn(async () => ({ error: null }));
const mockUpdateEqEq = jest.fn(async () => ({ error: null }));
const mockUpdateEq = jest.fn(() => ({ eq: mockUpdateEqEq }));
const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }));

const mockTenantSingle = jest.fn(async () => ({
  data: { features_enabled: { invoicing: true } },
}));
const mockTenantEq = jest.fn(() => ({ single: mockTenantSingle }));
const mockTenantSelect = jest.fn(() => ({ eq: mockTenantEq }));

const mockTenantUpdateEq = jest.fn(async () => ({ error: null }));
const mockTenantUpdate = jest.fn(() => ({ eq: mockTenantUpdateEq }));

const mockFrom = jest.fn((table) => {
  if (table === 'accounting_credentials') {
    return { upsert: mockUpsert, update: mockUpdate };
  }
  if (table === 'tenants') {
    return { select: mockTenantSelect, update: mockTenantUpdate };
  }
  return {};
});

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}));

// ─── OAuth state mock ────────────────────────────────────────────────────
const mockVerifyState = jest.fn(() => 'tenant-1');
jest.unstable_mockModule('@/app/api/google-calendar/auth/route', () => ({
  signOAuthState: jest.fn(),
  verifyOAuthState: (...args) => mockVerifyState(...args),
}));

// ─── Adapter mock ────────────────────────────────────────────────────────
const mockExchangeCode = jest.fn(async () => ({
  access_token: 'jobber-at',
  refresh_token: 'jobber-rt',
  expiry_date: Date.now() + 3600_000,
  scopes: null,
}));
jest.unstable_mockModule('@/lib/integrations/adapter', () => ({
  getIntegrationAdapter: jest.fn(async () => ({
    exchangeCode: mockExchangeCode,
  })),
}));

// ─── next/cache ──────────────────────────────────────────────────────────
jest.unstable_mockModule('next/cache', () => ({
  revalidateTag: jest.fn(),
  cacheTag: jest.fn(),
}));

// ─── fetch mock ──────────────────────────────────────────────────────────
const mockFetch = jest.fn();
global.fetch = mockFetch;

process.env.NEXT_PUBLIC_APP_URL = 'https://test.voco.live';

let GET;
beforeAll(async () => {
  GET = (await import('@/app/api/integrations/[provider]/callback/route')).GET;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyState.mockReturnValue('tenant-1');
  mockTenantSingle.mockResolvedValue({
    data: { features_enabled: { invoicing: true } },
  });
});

function makeReq(provider = 'jobber') {
  return new Request(
    `https://test.voco.live/api/integrations/${provider}/callback?code=c&state=s`,
  );
}

describe('OAuth callback — Jobber account-id probe (P56 Plan 03 Task 3)', () => {
  it('T-CB-1: happy path — tokens persist AND external_account_id UPDATE fires with account.id', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { account: { id: 'jobber-acct-xyz' } } }),
    });
    const resp = await GET(makeReq('jobber'), {
      params: Promise.resolve({ provider: 'jobber' }),
    });
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      external_account_id: 'jobber-acct-xyz',
    });
    const loc = resp.headers.get('location');
    expect(loc).toContain('connected=jobber');
    expect(loc).not.toContain('account_probe_failed');
  });

  it('T-CB-2: probe returns malformed JSON — tokens persist but no external_account_id UPDATE; redirect has account_probe_failed', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: null }),
    });
    const resp = await GET(makeReq('jobber'), {
      params: Promise.resolve({ provider: 'jobber' }),
    });
    expect(mockUpsert).toHaveBeenCalledTimes(1); // tokens persisted
    expect(mockUpdate).not.toHaveBeenCalled();
    const loc = resp.headers.get('location');
    expect(loc).toContain('error=account_probe_failed');
    expect(loc).toContain('provider=jobber');
  });

  it('T-CB-3: probe returns 401 — tokens persist but no external_account_id UPDATE', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    });
    const resp = await GET(makeReq('jobber'), {
      params: Promise.resolve({ provider: 'jobber' }),
    });
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(resp.headers.get('location')).toContain('error=account_probe_failed');
  });

  it('T-CB-4: Xero path unchanged — no probe attempted, no Jobber-only UPDATE', async () => {
    const resp = await GET(makeReq('xero'), {
      params: Promise.resolve({ provider: 'xero' }),
    });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(resp.headers.get('location')).toContain('connected=xero');
  });
});

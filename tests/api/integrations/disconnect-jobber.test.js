/**
 * Phase 56 Plan 04 — Disconnect route: Jobber branch.
 * Mirrors tests/api/integrations/disconnect.test.js for Jobber provider.
 *
 * DC1: POST /api/integrations/disconnect with {provider:'jobber'} deletes
 *      the accounting_credentials row and calls revalidateTag('jobber-context-${tenantId}')
 * DC2: Jobber adapter.revoke is a no-op (resolves void) — disconnect MUST NOT fail
 */

import { jest } from '@jest/globals';

const mockGetTenantId = jest.fn();
const mockMaybeSingle = jest.fn();
const mockDelete = jest.fn();
const mockRevalidateTag = jest.fn();
const mockRevoke = jest.fn();

jest.unstable_mockModule('next/cache', () => ({
  revalidateTag: (...args) => mockRevalidateTag(...args),
  cacheTag: jest.fn(),
}));

jest.unstable_mockModule('@/lib/get-tenant-id', () => ({
  getTenantId: (...args) => mockGetTenantId(...args),
}));

const accCredsChain = {
  select: () => accCredsChain,
  eq: () => accCredsChain,
  maybeSingle: () => mockMaybeSingle(),
  delete: () => accCredsChainDelete,
};
const accCredsChainDelete = {
  eq: () => accCredsChainDelete,
  then: (resolve) => resolve(mockDelete()),
};

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: { from: jest.fn(() => accCredsChain) },
}));

jest.unstable_mockModule('@/lib/integrations/adapter', () => ({
  getIntegrationAdapter: jest.fn(async () => ({ revoke: mockRevoke })),
}));

let POST;
beforeAll(async () => {
  POST = (await import('@/app/api/integrations/disconnect/route')).POST;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetTenantId.mockResolvedValue('tenant-jobber-1');
  mockMaybeSingle.mockResolvedValue({
    data: {
      access_token: 'jobber_at',
      refresh_token: 'jobber_rt_xyz',
      expiry_date: 1_777_000_000_000,
      xero_tenant_id: null,
    },
  });
  mockDelete.mockResolvedValue({ error: null });
  mockRevoke.mockResolvedValue(undefined); // Jobber revoke is a no-op per Plan 01
});

function makeReq(body) {
  return new Request('http://localhost/api/integrations/disconnect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/integrations/disconnect — Jobber branch', () => {
  it('DC1a: calls JobberAdapter.revoke with the stored token set', async () => {
    await POST(makeReq({ provider: 'jobber' }));
    expect(mockRevoke).toHaveBeenCalledTimes(1);
    const [tokenSet] = mockRevoke.mock.calls[0];
    expect(tokenSet.refresh_token).toBe('jobber_rt_xyz');
  });

  it('DC1b: deletes the accounting_credentials row', async () => {
    await POST(makeReq({ provider: 'jobber' }));
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('DC1c: calls revalidateTag for integration-status AND jobber-context', async () => {
    const res = await POST(makeReq({ provider: 'jobber' }));
    expect(res.status).toBe(200);
    const calls = mockRevalidateTag.mock.calls.map((c) => c[0]);
    expect(calls).toContain('integration-status-tenant-jobber-1');
    expect(calls).toContain('jobber-context-tenant-jobber-1');
  });

  it('DC2: Jobber revoke no-op (Plan 01 contract) does NOT cause disconnect to fail', async () => {
    // Jobber has no public revoke endpoint — Plan 01's revoke is a resolved void
    mockRevoke.mockResolvedValueOnce(undefined);
    const res = await POST(makeReq({ provider: 'jobber' }));
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('DC2b: even if revoke throws (defensive), still deletes + revalidates', async () => {
    mockRevoke.mockRejectedValueOnce(new Error('unexpected'));
    const res = await POST(makeReq({ provider: 'jobber' }));
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    const calls = mockRevalidateTag.mock.calls.map((c) => c[0]);
    expect(calls).toContain('jobber-context-tenant-jobber-1');
  });
});

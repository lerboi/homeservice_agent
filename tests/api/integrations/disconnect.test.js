/**
 * Unit tests for /api/integrations/disconnect (Phase 55 Plan 03).
 * Covers revoke call, row delete, and dual revalidateTag (status + xero-context).
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
  mockGetTenantId.mockResolvedValue('tenant-1');
  mockMaybeSingle.mockResolvedValue({
    data: {
      access_token: 'at', refresh_token: 'xero_rt_abc', expiry_date: 1_000_000, xero_tenant_id: 'org-1',
    },
  });
  mockDelete.mockResolvedValue({ error: null });
  mockRevoke.mockResolvedValue(undefined);
});

function makeReq(body) {
  return new Request('http://localhost/api/integrations/disconnect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/integrations/disconnect', () => {
  it('calls XeroAdapter.revoke with the stored token set', async () => {
    await POST(makeReq({ provider: 'xero' }));
    expect(mockRevoke).toHaveBeenCalledTimes(1);
    const [tokenSet] = mockRevoke.mock.calls[0];
    expect(tokenSet.refresh_token).toBe('xero_rt_abc');
  });

  it('deletes the accounting_credentials row', async () => {
    await POST(makeReq({ provider: 'xero' }));
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('calls revalidateTag for integration-status AND xero-context', async () => {
    await POST(makeReq({ provider: 'xero' }));
    const calls = mockRevalidateTag.mock.calls.map((c) => c[0]);
    expect(calls).toContain('integration-status-tenant-1');
    expect(calls).toContain('xero-context-tenant-1');
  });

  it('still deletes + revalidates when revoke throws', async () => {
    mockRevoke.mockRejectedValueOnce(new Error('upstream 403'));
    const res = await POST(makeReq({ provider: 'xero' }));
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    const calls = mockRevalidateTag.mock.calls.map((c) => c[0]);
    expect(calls).toContain('xero-context-tenant-1');
  });
});

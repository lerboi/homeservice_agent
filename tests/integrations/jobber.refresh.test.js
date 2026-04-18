/**
 * Unit tests for JobberAdapter.refreshToken rotation behavior (Phase 56 Plan 01).
 * Jobber mandates refresh-token rotation — every refresh returns a NEW refresh_token.
 */

import { jest } from '@jest/globals';

function mockJobberJwt(expSeconds) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString('base64url');
  return `${header}.${payload}.signature`;
}

jest.unstable_mockModule('next/cache', () => ({
  cacheTag: jest.fn(),
  revalidateTag: jest.fn(),
}));
jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({}) }),
}));
jest.unstable_mockModule('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({ request: jest.fn() })),
  gql: (strings) => strings[0],
}));
jest.unstable_mockModule('@/lib/integrations/adapter', () => ({
  refreshTokenIfNeeded: jest.fn(async (_admin, cred) => cred),
  getIntegrationAdapter: jest.fn(),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

process.env.JOBBER_CLIENT_ID = 'test-client-id';
process.env.JOBBER_CLIENT_SECRET = 'test-client-secret';

let JobberAdapter;
beforeAll(async () => {
  ({ JobberAdapter } = await import('@/lib/integrations/jobber'));
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('JobberAdapter.refreshToken (rotation)', () => {
  it('R1: returns NEW refresh_token from rotation response', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: mockJobberJwt(exp), refresh_token: 'rt-new-rotated' }),
    });
    const adapter = new JobberAdapter();
    const tokens = await adapter.refreshToken('rt-old');
    expect(tokens.refresh_token).toBe('rt-new-rotated');
    expect(tokens.refresh_token).not.toBe('rt-old');
    expect(tokens.expiry_date).toBe(exp * 1000);

    // Confirm correct grant type + rotated refresh_token in the form body
    const call = mockFetch.mock.calls[0];
    const body = new URLSearchParams(call[1].body);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('rt-old');
  });

  it('R2: throws when response omits refresh_token (rotation mandatory)', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: mockJobberJwt(exp) }),
    });
    const adapter = new JobberAdapter();
    await expect(adapter.refreshToken('rt-old')).rejects.toThrow(/refresh_token/i);
  });
});

/**
 * Unit tests for JobberAdapter OAuth (Phase 56 Plan 01).
 * Covers getAuthUrl (no scope param), exchangeCode (JWT expiry parsing), revoke (no-op).
 */

import { jest } from '@jest/globals';

function mockJobberJwt(expSeconds) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString('base64url');
  return `${header}.${payload}.signature`;
}

// Stub next/cache so the module can import at test time.
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

describe('JobberAdapter OAuth', () => {
  it('A1: getAuthUrl returns correct URL with no scope param', () => {
    const adapter = new JobberAdapter();
    const url = new URL(adapter.getAuthUrl('state-abc', 'http://cb'));
    expect(url.searchParams.get('client_id')).toBe('test-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe('http://cb');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('state-abc');
    expect(url.searchParams.get('scope')).toBeNull();
  });

  it('A2: exchangeCode posts correct form and parses JWT expiry', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const jwt = mockJobberJwt(exp);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: jwt, refresh_token: 'rt-new' }),
    });
    const adapter = new JobberAdapter();
    const tokens = await adapter.exchangeCode('code-xyz', 'http://cb');
    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe('https://api.getjobber.com/api/oauth/token');
    const body = new URLSearchParams(call[1].body);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('client_id')).toBe('test-client-id');
    expect(body.get('client_secret')).toBe('test-client-secret');
    expect(body.get('code')).toBe('code-xyz');
    expect(body.get('redirect_uri')).toBe('http://cb');
    expect(tokens.access_token).toBe(jwt);
    expect(tokens.refresh_token).toBe('rt-new');
    expect(tokens.expiry_date).toBe(exp * 1000);
  });

  it('A3: revoke is no-op (Jobber has no public revoke endpoint)', async () => {
    const adapter = new JobberAdapter();
    await expect(adapter.revoke({ access_token: 'a', refresh_token: 'r' })).resolves.toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

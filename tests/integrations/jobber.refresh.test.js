/**
 * Unit tests for JobberAdapter.refreshToken rotation behavior (Phase 56 Plan 01)
 * AND the refreshTokenIfNeeded error_state write/clear contract (Phase 58 Plan 07 / D-13a).
 *
 * Two describe blocks:
 *
 *   - `JobberAdapter.refreshToken (rotation)` — covers Phase 56's rotation
 *     contract at the adapter level (adapter.refreshToken directly).
 *   - `refreshTokenIfNeeded (provider=jobber) — error_state write/clear` —
 *     covers Phase 58 D-13a: the per-provider error_state behavior of the
 *     adapter-layer `refreshTokenIfNeeded` wrapper in `src/lib/integrations/adapter.js`:
 *       J1: clears `error_state: null` in the persisted update on successful refresh
 *       J2: invokes `notifyJobberRefreshFailure` (→ writes error_state='token_refresh_failed')
 *           when wire refresh throws
 *       J3: does NOT touch error_state when no refresh is required (early return)
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

// Notifier mocks — used to assert error_state write path in the J-suite.
// The R-suite doesn't invoke notifications, but the mock is harmless there.
const mockNotifyJobber = jest.fn().mockResolvedValue(undefined);
const mockNotifyXero = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule('@/lib/notifications', () => ({
  notifyJobberRefreshFailure: mockNotifyJobber,
  notifyXeroRefreshFailure: mockNotifyXero,
}));

// Adapter factories for the J-suite — adapter.js's `getIntegrationAdapter`
// dynamically imports these; mocking them lets `refreshTokenIfNeeded` call
// `adapter.refreshToken` via our controllable mock without spinning up
// xero-node / jobber HTTP fetches. The R-suite uses `new JobberAdapter()`
// directly via the REAL jobber.js import (which wouldn't resolve to the mock
// because the R-suite imports JobberAdapter via beforeAll below — the mock
// only intercepts the dynamic import inside adapter.js's switch statement).
const mockAdapterRefresh = jest.fn();
jest.unstable_mockModule('@/lib/integrations/xero', () => ({
  XeroAdapter: jest.fn().mockImplementation(() => ({
    refreshToken: mockAdapterRefresh,
  })),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

process.env.JOBBER_CLIENT_ID = 'test-client-id';
process.env.JOBBER_CLIENT_SECRET = 'test-client-secret';

let JobberAdapter;
let refreshTokenIfNeeded;
beforeAll(async () => {
  ({ JobberAdapter } = await import('@/lib/integrations/jobber'));
  ({ refreshTokenIfNeeded } = await import('@/lib/integrations/adapter'));
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

// ─── Phase 58 Plan 07 / D-13a — error_state write/clear contract ──────────────

describe('refreshTokenIfNeeded (provider=jobber) — error_state write/clear (D-13a)', () => {
  // Uses the REAL adapter.js refreshTokenIfNeeded imported at top-level
  // beforeAll. adapter.js's `getIntegrationAdapter('jobber')` dynamically
  // imports `./jobber.js` and instantiates the REAL `JobberAdapter` — whose
  // `refreshToken(refreshTokenValue)` hits Jobber's token endpoint via
  // global.fetch (which is mockFetch). We drive the wire behavior through
  // mockFetch: ok:true for happy path, ok:false/reject for failure path.

  function buildFakeSupabase(initialCred) {
    const state = {
      cred: { ...initialCred },
      updatePayloads: [],
      lockHolder: null,
      lockExpiresAt: 0,
      rpcCalls: [],
    };

    const rpc = jest.fn(async (name, args) => {
      state.rpcCalls.push({ name, args });
      if (name === 'try_acquire_oauth_refresh_lock') {
        const now = Date.now();
        if (state.lockHolder && state.lockExpiresAt > now) {
          return { data: null, error: null };
        }
        state.lockHolder = `holder-${Math.random().toString(36).slice(2, 10)}`;
        state.lockExpiresAt = now + (args.p_ttl_ms || 30_000);
        return { data: state.lockHolder, error: null };
      }
      if (name === 'release_oauth_refresh_lock') {
        if (state.lockHolder === args.p_holder_id) {
          state.lockHolder = null;
          state.lockExpiresAt = 0;
        }
        return { data: null, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });

    const from = jest.fn((table) => {
      if (table === 'accounting_credentials') {
        return {
          update: (payload) => {
            state.updatePayloads.push(payload);
            state.cred = { ...state.cred, ...payload };
            return { eq: async () => ({ error: null }) };
          },
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: state.cred, error: null }),
            }),
          }),
        };
      }
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { email: 'owner@example.com' },
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    return { client: { rpc, from }, state };
  }

  function buildStaleJobberCredential(overrides = {}) {
    return {
      id: 'cred-jobber-1',
      tenant_id: 'tenant-1',
      provider: 'jobber',
      access_token: 'at-old',
      refresh_token: 'rt-old',
      expiry_date: Date.now() + 60_000, // inside 5-min buffer
      error_state: 'token_refresh_failed', // prior failure
      ...overrides,
    };
  }

  beforeEach(() => {
    mockFetch.mockReset();
    mockNotifyJobber.mockClear();
    mockNotifyXero.mockClear();
  });

  it('J1: clears error_state (null) in the persisted update on successful refresh', async () => {
    const { client, state } = buildFakeSupabase(buildStaleJobberCredential());
    const exp = Math.floor(Date.now() / 1000) + 3600;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: mockJobberJwt(exp),
        refresh_token: 'rt-new-rotated',
      }),
    });

    await refreshTokenIfNeeded(client, buildStaleJobberCredential());

    expect(state.updatePayloads).toContainEqual(
      expect.objectContaining({ error_state: null }),
    );
    expect(state.cred.error_state).toBeNull();
    expect(state.cred.refresh_token).toBe('rt-new-rotated');
  });

  it('J2: calls notifyJobberRefreshFailure (which writes error_state="token_refresh_failed") when wire refresh returns 4xx', async () => {
    const { client } = buildFakeSupabase(
      buildStaleJobberCredential({ error_state: null }),
    );
    // Jobber returns ok:false → JobberAdapter.refreshToken throws
    // `Jobber refreshToken failed: <status>` which adapter.js's catch branch
    // routes through notifyJobberRefreshFailure before rethrowing.
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'invalid_grant' }),
    });

    await expect(
      refreshTokenIfNeeded(
        client,
        buildStaleJobberCredential({ error_state: null }),
      ),
    ).rejects.toThrow(/Jobber refreshToken failed: 401/);

    // The single writer of error_state='token_refresh_failed' is
    // notifyJobberRefreshFailure (see src/lib/notifications.js). adapter.js
    // invokes it from the refresh-fail catch branch — we assert the
    // invocation here; the actual row-level write is covered in the
    // notifications suite. Xero notifier must NOT fire on jobber failure.
    expect(mockNotifyJobber).toHaveBeenCalledTimes(1);
    expect(mockNotifyJobber).toHaveBeenCalledWith('tenant-1', 'owner@example.com');
    expect(mockNotifyXero).not.toHaveBeenCalled();
  });

  it('J3: does NOT touch error_state (no update at all) when credentials are not near expiry', async () => {
    const fresh = buildStaleJobberCredential({
      expiry_date: Date.now() + 2 * 60 * 60 * 1000,
      error_state: 'token_refresh_failed',
    });
    const { client, state } = buildFakeSupabase(fresh);

    const result = await refreshTokenIfNeeded(client, fresh);

    expect(state.updatePayloads).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
    // Stale flag preserved — no spurious clear.
    expect(result.error_state).toBe('token_refresh_failed');
  });
});

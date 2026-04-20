/**
 * Unit tests for the Xero refresh-aware token rotation path (Phase 58 Plan 07 / D-13a).
 *
 * Covers three assertions at the `refreshTokenIfNeeded(supabase, credentials)`
 * layer for the `provider='xero'` branch, plus the OAuth-callback clear:
 *
 *   X1: On successful refresh, the persisted `accounting_credentials` update
 *       payload includes `error_state: null` (clears any prior
 *       `'token_refresh_failed'` flag from a past failure).
 *   X2: When the underlying Xero wire-refresh throws (simulating a revoked
 *       refresh_token / 4xx response), the refresh helper invokes
 *       `notifyXeroRefreshFailure`, which is the single code path that writes
 *       `error_state: 'token_refresh_failed'` to the row (see
 *       `src/lib/notifications.js :: notifyXeroRefreshFailure`).
 *   X3: When the credentials are NOT near expiry (happy path, no refresh
 *       needed), `refreshTokenIfNeeded` returns early and performs ZERO
 *       updates to `accounting_credentials` — `error_state` is not touched
 *       and unrelated prior flags are preserved.
 *
 * D-13a closure: Phase 55 shipped error_state column + partial index;
 * Phase 58 needs automated proof that the refresh flow both WRITES the flag
 * on failure and CLEARS it on success (success = either a successful
 * background refresh OR a fresh OAuth callback upsert — the callback path is
 * exercised by the existing Phase 56 callback-route tests, while this file
 * covers the background-refresh write+clear contract).
 */

import { jest } from '@jest/globals';

jest.unstable_mockModule('next/cache', () => ({
  cacheTag: jest.fn(),
  revalidateTag: jest.fn(),
}));

// Capture notifier calls to assert error_state-write behavior on refresh fail.
const mockNotifyXero = jest.fn().mockResolvedValue(undefined);
const mockNotifyJobber = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule('@/lib/notifications', () => ({
  notifyXeroRefreshFailure: mockNotifyXero,
  notifyJobberRefreshFailure: mockNotifyJobber,
}));

// Stub the Xero adapter. The test drives adapter.refreshToken via this mock
// so we don't pull xero-node / HTTP deps into a unit test.
const mockXeroRefresh = jest.fn();
jest.unstable_mockModule('@/lib/integrations/xero', () => ({
  XeroAdapter: jest.fn().mockImplementation(() => ({
    refreshToken: mockXeroRefresh,
  })),
}));
// Keep the jobber side inert so module resolution succeeds.
jest.unstable_mockModule('@/lib/integrations/jobber', () => ({
  JobberAdapter: jest.fn().mockImplementation(() => ({
    refreshToken: jest.fn(),
  })),
}));

let refreshTokenIfNeeded;
beforeAll(async () => {
  ({ refreshTokenIfNeeded } = await import('@/lib/integrations/adapter'));
});

beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * Build a fake service-role Supabase client for the Xero branch. Captures
 * every `accounting_credentials.update(payload)` call in `state.updatePayloads`
 * so tests can assert the exact shape of the persisted row-level update.
 */
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
          return {
            eq: async () => ({ error: null }),
          };
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

function buildStaleXeroCredential(overrides = {}) {
  return {
    id: 'cred-xero-1',
    tenant_id: 'tenant-1',
    provider: 'xero',
    access_token: 'at-old',
    refresh_token: 'rt-old',
    expiry_date: Date.now() + 60_000, // 1 min → inside 5-minute buffer
    xero_tenant_id: 'xt-1',
    error_state: 'token_refresh_failed', // prior failure — must clear on success
    ...overrides,
  };
}

describe('refreshTokenIfNeeded (provider=xero) — error_state write/clear (D-13a)', () => {
  it('X1: clears error_state (null) in the persisted update on successful refresh', async () => {
    const { client, state } = buildFakeSupabase(buildStaleXeroCredential());
    mockXeroRefresh.mockResolvedValue({
      access_token: 'at-new',
      refresh_token: 'rt-new',
      expiry_date: Date.now() + 60 * 60 * 1000,
      scopes: ['accounting.transactions.read'],
    });

    await refreshTokenIfNeeded(client, buildStaleXeroCredential());

    expect(state.updatePayloads).toContainEqual(
      expect.objectContaining({ error_state: null }),
    );
    expect(state.cred.error_state).toBeNull();
    expect(state.cred.access_token).toBe('at-new');
  });

  it('X2: calls notifyXeroRefreshFailure (which writes error_state="token_refresh_failed") when the wire refresh throws', async () => {
    const { client } = buildFakeSupabase(
      buildStaleXeroCredential({ error_state: null }), // row starts clean
    );
    mockXeroRefresh.mockRejectedValue(new Error('Xero 400 invalid_grant'));

    await expect(
      refreshTokenIfNeeded(client, buildStaleXeroCredential({ error_state: null })),
    ).rejects.toThrow(/invalid_grant/);

    // The single path that writes error_state='token_refresh_failed' is
    // notifyXeroRefreshFailure (see src/lib/notifications.js). Adapter.js
    // invokes it from the refresh-fail catch branch; we assert the invocation
    // here and cover the actual error_state write in the notifications suite.
    expect(mockNotifyXero).toHaveBeenCalledTimes(1);
    expect(mockNotifyXero).toHaveBeenCalledWith('tenant-1', 'owner@example.com');
    expect(mockNotifyJobber).not.toHaveBeenCalled();
  });

  it('X3: does NOT touch error_state (no update at all) when credentials are not near expiry', async () => {
    // Token valid for 2 hours — well outside the 5-minute buffer.
    const fresh = buildStaleXeroCredential({
      expiry_date: Date.now() + 2 * 60 * 60 * 1000,
      error_state: 'token_refresh_failed', // stale flag from prior fail
    });
    const { client, state } = buildFakeSupabase(fresh);

    const result = await refreshTokenIfNeeded(client, fresh);

    expect(state.updatePayloads).toHaveLength(0);
    expect(mockXeroRefresh).not.toHaveBeenCalled();
    // error_state untouched on the returned row — spurious clears would mask
    // an unresolved reconnect state.
    expect(result.error_state).toBe('token_refresh_failed');
  });
});

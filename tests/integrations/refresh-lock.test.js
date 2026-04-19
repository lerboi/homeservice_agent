/**
 * Phase 999.5 — refreshTokenIfNeeded concurrency guard.
 *
 * Validates the lease-based lock (try_acquire_oauth_refresh_lock /
 * release_oauth_refresh_lock RPCs) serializes concurrent refreshers:
 *
 *   L1: Under 5 concurrent callers with a stale token, adapter.refreshToken
 *       fires exactly once (winner), and the losers return the winner's
 *       freshly-persisted credentials — never call adapter.refreshToken
 *       themselves.
 *   L2: error_state is cleared on the successful DB update (Issue 1 fix).
 *   L3: Release RPC is always invoked for the winner, even when the wire
 *       refresh throws (finally-release contract).
 */

import { jest } from '@jest/globals';

jest.unstable_mockModule('next/cache', () => ({
  cacheTag: jest.fn(),
  revalidateTag: jest.fn(),
}));

// Capture notifier calls so we can assert behavior on the refresh-fail path.
const mockNotifyJobber = jest.fn().mockResolvedValue(undefined);
const mockNotifyXero = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule('@/lib/notifications', () => ({
  notifyJobberRefreshFailure: mockNotifyJobber,
  notifyXeroRefreshFailure: mockNotifyXero,
}));

// Stub the Jobber adapter so importing './jobber.js' doesn't pull GraphQL /
// Supabase deps. The test directly controls refreshToken via the mock.
const mockAdapterRefresh = jest.fn();
jest.unstable_mockModule('@/lib/integrations/jobber', () => ({
  JobberAdapter: jest.fn().mockImplementation(() => ({
    refreshToken: mockAdapterRefresh,
  })),
}));
jest.unstable_mockModule('@/lib/integrations/xero', () => ({
  XeroAdapter: jest.fn().mockImplementation(() => ({
    refreshToken: mockAdapterRefresh,
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
 * Build a fake service-role Supabase client. Holds an in-memory copy of the
 * accounting_credentials row and simulates the advisory-lock semantics of
 * the two RPCs we added in migration 058.
 */
function buildFakeSupabase(initialCred) {
  const state = {
    cred: { ...initialCred },
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
        update: (payload) => ({
          eq: async (_col, _id) => {
            state.cred = { ...state.cred, ...payload };
            return { error: null };
          },
        }),
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

function buildStaleCredential() {
  return {
    id: 'cred-1',
    tenant_id: 'tenant-1',
    provider: 'jobber',
    access_token: 'at-old',
    refresh_token: 'rt-old',
    expiry_date: Date.now() + 60_000, // 1 minute → inside 5-minute buffer
    error_state: 'token_refresh_failed',
  };
}

describe('refreshTokenIfNeeded — concurrency guard', () => {
  it('L1: 5 concurrent callers → adapter.refreshToken invoked exactly once', async () => {
    const { client, state } = buildFakeSupabase(buildStaleCredential());

    mockAdapterRefresh.mockImplementation(async () => {
      // Simulate a ~50ms Jobber round-trip so concurrent callers actually
      // race: without this delay the first call completes synchronously and
      // the others see fresh tokens immediately.
      await new Promise((r) => setTimeout(r, 50));
      return {
        access_token: 'at-new',
        refresh_token: 'rt-new',
        expiry_date: Date.now() + 60 * 60 * 1000,
      };
    });

    const baseCred = buildStaleCredential();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => refreshTokenIfNeeded(client, baseCred)),
    );

    expect(mockAdapterRefresh).toHaveBeenCalledTimes(1);
    for (const r of results) {
      expect(r.access_token).toBe('at-new');
      expect(r.refresh_token).toBe('rt-new');
    }
    // Every caller acquired-or-lost the lock once; winner also released.
    const rpcNames = state.rpcCalls.map((c) => c.name);
    expect(rpcNames.filter((n) => n === 'try_acquire_oauth_refresh_lock')).toHaveLength(5);
    expect(rpcNames.filter((n) => n === 'release_oauth_refresh_lock')).toHaveLength(1);
  });

  it('L2: clears error_state in the persisted update payload', async () => {
    const { client, state } = buildFakeSupabase(buildStaleCredential());
    mockAdapterRefresh.mockResolvedValue({
      access_token: 'at-new',
      refresh_token: 'rt-new',
      expiry_date: Date.now() + 60 * 60 * 1000,
    });

    await refreshTokenIfNeeded(client, buildStaleCredential());

    // error_state must now be null in persisted state.
    expect(state.cred.error_state).toBeNull();
    expect(state.cred.access_token).toBe('at-new');
  });

  it('L3: release RPC fires even when wire refresh throws', async () => {
    const { client, state } = buildFakeSupabase(buildStaleCredential());
    mockAdapterRefresh.mockRejectedValue(new Error('Jobber 401'));

    await expect(
      refreshTokenIfNeeded(client, buildStaleCredential()),
    ).rejects.toThrow(/Jobber 401/);

    const rpcNames = state.rpcCalls.map((c) => c.name);
    expect(rpcNames).toContain('release_oauth_refresh_lock');
    expect(state.lockHolder).toBeNull();
  });
});

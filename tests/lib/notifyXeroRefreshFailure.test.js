/**
 * Tests for notifyXeroRefreshFailure (Phase 55 Plan 05 D-14).
 * - Writes error_state
 * - Invalidates integration-status tag
 * - Sends Resend email with locked subject + body
 * - Tolerates missing ownerEmail / send failure
 */

import { jest } from '@jest/globals';

const mockUpdate = jest.fn();
const mockRevalidateTag = jest.fn();
const mockEmailsSend = jest.fn();

const credChain = {
  update: (payload) => {
    mockUpdate(payload);
    return credChain;
  },
  eq: () => credChain,
  then: (resolve) => resolve({ error: null }),
};

jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => credChain }),
}));

jest.unstable_mockModule('next/cache', () => ({
  revalidateTag: (...args) => mockRevalidateTag(...args),
  cacheTag: jest.fn(),
}));

jest.unstable_mockModule('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: (...args) => mockEmailsSend(...args) },
  })),
}));

jest.unstable_mockModule('twilio', () => ({
  default: jest.fn(() => ({})),
}));

// Stub JSX email components so Jest doesn't try to parse JSX in src/emails/*.jsx
jest.unstable_mockModule('@/emails/XeroReconnectEmail', () => ({
  XeroReconnectEmail: jest.fn(({ reconnectUrl }) => ({
    _type: 'XeroReconnectEmail',
    reconnectUrl,
  })),
  default: jest.fn(),
}));
jest.unstable_mockModule('@/emails/NewLeadEmail', () => ({
  NewLeadEmail: jest.fn(),
}));

let notifyXeroRefreshFailure;
beforeAll(async () => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://test.voco';
  process.env.RESEND_API_KEY = 'test';
  ({ notifyXeroRefreshFailure } = await import('@/lib/notifications'));
});

beforeEach(() => {
  jest.clearAllMocks();
  mockEmailsSend.mockResolvedValue({ data: { id: 'em_1' } });
});

describe('notifyXeroRefreshFailure', () => {
  it('writes error_state=token_refresh_failed on accounting_credentials', async () => {
    await notifyXeroRefreshFailure('tenant-1', 'owner@example.com');
    expect(mockUpdate).toHaveBeenCalledWith({
      error_state: 'token_refresh_failed',
    });
  });

  it('invalidates integration-status cache tag', async () => {
    await notifyXeroRefreshFailure('tenant-1', 'owner@example.com');
    expect(mockRevalidateTag).toHaveBeenCalledWith('integration-status-tenant-1');
  });

  it('sends Resend email with locked subject', async () => {
    await notifyXeroRefreshFailure('tenant-1', 'owner@example.com');
    expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    const [payload] = mockEmailsSend.mock.calls[0];
    expect(payload.to).toBe('owner@example.com');
    expect(payload.subject).toBe('Your Xero connection needs attention');
    expect(payload.from).toContain('voco.live');
    expect(payload.react).toBeDefined();
  });

  it('skips email when ownerEmail is null but still writes error_state', async () => {
    await notifyXeroRefreshFailure('tenant-1', null);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockEmailsSend).not.toHaveBeenCalled();
  });

  it('tolerates Resend send failure without throwing', async () => {
    mockEmailsSend.mockRejectedValueOnce(new Error('Resend 500'));
    await expect(
      notifyXeroRefreshFailure('tenant-1', 'owner@example.com'),
    ).resolves.not.toThrow();
  });

  it('no-ops when tenantId is missing', async () => {
    await notifyXeroRefreshFailure(null, 'x@y.com');
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockEmailsSend).not.toHaveBeenCalled();
  });
});

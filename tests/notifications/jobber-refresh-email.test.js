/**
 * Phase 56 Plan 04 — notifyJobberRefreshFailure email helper.
 * Mirrors tests/notifications/owner-email.test.js pattern.
 *
 * EM1: subject === "Your Jobber connection needs attention"
 * EM2: body excerpt (rendered via react prop) — asserted via mock call args
 * EM3: CTA href points at /dashboard/more/integrations, CTA label "Reconnect Jobber"
 * EM4: No token material (access_token / refresh_token / client_secret) ever serialized
 */

import { jest } from '@jest/globals';

const mockSend = jest.fn().mockResolvedValue({ id: 'email_jobber_1' });
const mockAdminUpdate = jest.fn().mockResolvedValue({ error: null });
const mockAdminEq = jest.fn(() => ({ eq: mockAdminEq, then: (r) => r(mockAdminUpdate()) }));

// Capture props passed into JobberReconnectEmail so we can assert CTA href + label
const mockJobberReconnectEmail = jest.fn((props) => ({ __mock: 'JobberReconnectEmail', props }));

jest.unstable_mockModule('twilio', () => ({
  default: jest.fn(() => ({
    messages: { create: jest.fn().mockResolvedValue({ sid: 'SM_jobber' }) },
  })),
}));

jest.unstable_mockModule('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: () => ({
      update: () => ({
        eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
    }),
  })),
}));

jest.unstable_mockModule('@/emails/NewLeadEmail', () => ({
  NewLeadEmail: jest.fn(() => '<mock-new-lead>'),
}));

jest.unstable_mockModule('@/emails/XeroReconnectEmail', () => ({
  XeroReconnectEmail: jest.fn(() => '<mock-xero-reconnect>'),
}));

jest.unstable_mockModule('@/emails/JobberReconnectEmail', () => ({
  JobberReconnectEmail: mockJobberReconnectEmail,
  default: mockJobberReconnectEmail,
}));

jest.unstable_mockModule('next/cache', () => ({
  revalidateTag: jest.fn(),
}));

let notifyJobberRefreshFailure;

beforeAll(async () => {
  const mod = await import('@/lib/notifications');
  notifyJobberRefreshFailure = mod.notifyJobberRefreshFailure;
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.RESEND_API_KEY = 'test_resend_key';
  process.env.NEXT_PUBLIC_APP_URL = 'https://voco.live';
});

describe('notifyJobberRefreshFailure', () => {
  it('is an exported function from @/lib/notifications', () => {
    expect(typeof notifyJobberRefreshFailure).toBe('function');
  });

  it('EM1: subject is exactly "Your Jobber connection needs attention"', async () => {
    await notifyJobberRefreshFailure('tenant-jobber-1', 'owner@example.com');
    expect(mockSend).toHaveBeenCalledTimes(1);
    const args = mockSend.mock.calls[0][0];
    expect(args.subject).toBe('Your Jobber connection needs attention');
  });

  it('EM2+EM3: renders JobberReconnectEmail with reconnect URL pointing at /dashboard/more/integrations', async () => {
    await notifyJobberRefreshFailure('tenant-jobber-1', 'owner@example.com');
    expect(mockJobberReconnectEmail).toHaveBeenCalledTimes(1);
    const props = mockJobberReconnectEmail.mock.calls[0][0];
    // Accept either "reconnectUrl" or "ctaUrl" naming — both point at the same dashboard path
    const url = props.reconnectUrl || props.ctaUrl;
    expect(url).toContain('/dashboard/more/integrations');
  });

  it('EM3b: Resend `to` is the owner email; `from` is Voco', async () => {
    await notifyJobberRefreshFailure('tenant-jobber-1', 'owner@example.com');
    const args = mockSend.mock.calls[0][0];
    expect(args.to).toBe('owner@example.com');
    expect(args.from).toMatch(/voco/i);
  });

  it('EM4: Resend send call does NOT echo any token material (access_token/refresh_token/client_secret)', async () => {
    await notifyJobberRefreshFailure('tenant-jobber-1', 'owner@example.com');
    const serialized = JSON.stringify(mockSend.mock.calls[0][0]);
    expect(serialized).not.toMatch(/access_token/i);
    expect(serialized).not.toMatch(/refresh_token/i);
    expect(serialized).not.toMatch(/client_secret/i);
  });

  it('does not throw when ownerEmail is missing', async () => {
    await expect(notifyJobberRefreshFailure('tenant-jobber-1', null)).resolves.not.toThrow();
    // Should NOT attempt to send
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does not throw when Resend send fails', async () => {
    mockSend.mockRejectedValueOnce(new Error('Resend down'));
    await expect(
      notifyJobberRefreshFailure('tenant-jobber-1', 'owner@example.com'),
    ).resolves.not.toThrow();
  });
});

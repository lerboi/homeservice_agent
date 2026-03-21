/**
 * Tests for sendCallerRecoverySMS — warm recovery SMS to caller who hung up.
 * Verifies recipient, tone, first-name extraction, fallback, and error resilience.
 */

import { jest } from '@jest/globals';

// ─── Mocks (inline — avoids loading real twilio/resend packages) ─────────────

const mockCreate = jest.fn().mockResolvedValue({ sid: 'SM_test_123' });

jest.unstable_mockModule('twilio', () => ({
  default: jest.fn(() => ({
    messages: { create: mockCreate },
  })),
}));

jest.unstable_mockModule('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ id: 'email_test_123' }) },
  })),
}));

jest.unstable_mockModule('@/emails/NewLeadEmail', () => ({
  NewLeadEmail: jest.fn(() => null),
}));

// ─── Module import ────────────────────────────────────────────────────────────

let sendCallerRecoverySMS;

beforeAll(async () => {
  const mod = await import('@/lib/notifications');
  sendCallerRecoverySMS = mod.sendCallerRecoverySMS;
});

// ─── Environment setup ────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TWILIO_ACCOUNT_SID = 'AC_test_sid';
  process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
  process.env.TWILIO_FROM_NUMBER = '+15550001111';
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('sendCallerRecoverySMS', () => {
  it("sends to caller's number (not owner's number)", async () => {
    await sendCallerRecoverySMS({
      to: '+15551234567',
      callerName: 'Jane Doe',
      businessName: 'Acme Plumbing',
      bookingLink: 'https://book.acme.com',
      ownerPhone: '+15559998888',
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].to).toBe('+15551234567');
    expect(mockCreate.mock.calls[0][0].from).toBe('+15550001111');
  });

  it('SMS body starts with "Hi Jane" extracting first name from full name', async () => {
    await sendCallerRecoverySMS({
      to: '+15551234567',
      callerName: 'Jane Doe',
      businessName: 'Acme Plumbing',
      bookingLink: 'https://book.acme.com',
      ownerPhone: '+15559998888',
    });

    const body = mockCreate.mock.calls[0][0].body;
    expect(body).toMatch(/^Hi Jane,/);
  });

  it('SMS body contains "thanks for calling" and business name', async () => {
    await sendCallerRecoverySMS({
      to: '+15551234567',
      callerName: 'Jane Doe',
      businessName: 'Acme Plumbing',
      bookingLink: 'https://book.acme.com',
      ownerPhone: '+15559998888',
    });

    const body = mockCreate.mock.calls[0][0].body;
    expect(body).toContain('thanks for calling');
    expect(body).toContain('Acme Plumbing');
  });

  it('SMS body contains "book online at" and the booking link', async () => {
    await sendCallerRecoverySMS({
      to: '+15551234567',
      callerName: 'Jane Doe',
      businessName: 'Acme Plumbing',
      bookingLink: 'https://book.acme.com',
      ownerPhone: '+15559998888',
    });

    const body = mockCreate.mock.calls[0][0].body;
    expect(body).toContain('book online at');
    expect(body).toContain('https://book.acme.com');
  });

  it('uses "there" as fallback greeting when callerName is null', async () => {
    await sendCallerRecoverySMS({
      to: '+15551234567',
      callerName: null,
      businessName: 'Acme Plumbing',
      bookingLink: 'https://book.acme.com',
      ownerPhone: '+15559998888',
    });

    const body = mockCreate.mock.calls[0][0].body;
    expect(body).toMatch(/^Hi there,/);
  });

  it('does not throw when Twilio returns an error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Twilio network error'));

    await expect(
      sendCallerRecoverySMS({
        to: '+15551234567',
        callerName: 'Jane Doe',
        businessName: 'Acme Plumbing',
        bookingLink: 'https://book.acme.com',
        ownerPhone: '+15559998888',
      })
    ).resolves.not.toThrow();
  });
});

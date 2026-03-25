/**
 * Tests for sendCallerRecoverySMS — urgency-aware i18n recovery SMS to caller.
 * Verifies new function signature (locale, urgency), structured return value,
 * urgency branching, i18n content, null guards, and bookingLink placeholder.
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
  it("sends to caller's number with new signature (locale, urgency)", async () => {
    await sendCallerRecoverySMS({
      to: '+15551234567',
      callerName: 'Jane Doe',
      businessName: 'Acme Plumbing',
      locale: 'en',
      urgency: 'routine',
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].to).toBe('+15551234567');
  });

  it('returns { success: true, sid } on successful delivery', async () => {
    const result = await sendCallerRecoverySMS({
      to: '+15551234567',
      callerName: 'Jane Doe',
      businessName: 'Acme Plumbing',
      locale: 'en',
      urgency: 'routine',
    });

    expect(result).toEqual({ success: true, sid: 'SM_test_123' });
  });

  it('returns { success: false, error } when Twilio fails (not throws)', async () => {
    mockCreate.mockRejectedValueOnce({ code: 21211, message: 'Invalid phone' });

    const result = await sendCallerRecoverySMS({
      to: '+15551234567',
      callerName: 'Jane Doe',
      businessName: 'Acme Plumbing',
      locale: 'en',
      urgency: 'routine',
    });

    expect(result).toEqual({
      success: false,
      error: { code: 21211, message: 'Invalid phone' },
    });
  });

  it('returns { success: false, error: { code: "NO_PHONE" } } when to is null', async () => {
    const result = await sendCallerRecoverySMS({
      to: null,
      callerName: 'Jane Doe',
      businessName: 'Acme Plumbing',
      locale: 'en',
      urgency: 'routine',
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      error: { code: 'NO_PHONE', message: expect.any(String) },
    });
  });

  it("routine urgency produces body containing \"sorry we couldn't get your appointment booked\"", async () => {
    await sendCallerRecoverySMS({
      to: '+15551234567',
      callerName: 'Jane Doe',
      businessName: 'Acme Plumbing',
      locale: 'en',
      urgency: 'routine',
    });

    const body = mockCreate.mock.calls[0][0].body;
    expect(body).toContain("sorry we couldn't get your appointment booked");
  });

  it("emergency urgency produces body containing 'your situation is time-sensitive'", async () => {
    await sendCallerRecoverySMS({
      to: '+15551234567',
      callerName: 'Jane Doe',
      businessName: 'Acme Plumbing',
      locale: 'en',
      urgency: 'emergency',
    });

    const body = mockCreate.mock.calls[0][0].body;
    expect(body).toContain('your situation is time-sensitive');
  });

  it('Spanish locale produces Spanish body for routine', async () => {
    await sendCallerRecoverySMS({
      to: '+15551234567',
      callerName: 'Jane Doe',
      businessName: 'Acme Plumbing',
      locale: 'es',
      urgency: 'routine',
    });

    const body = mockCreate.mock.calls[0][0].body;
    expect(body).toContain('lamentamos');
  });

  it('Spanish locale produces Spanish body for emergency', async () => {
    await sendCallerRecoverySMS({
      to: '+15551234567',
      callerName: 'Jane Doe',
      businessName: 'Acme Plumbing',
      locale: 'es',
      urgency: 'emergency',
    });

    const body = mockCreate.mock.calls[0][0].body;
    expect(body).toContain('entendemos que tu situacion');
  });

  it('uses "there" as fallback greeting when callerName is null', async () => {
    await sendCallerRecoverySMS({
      to: '+15551234567',
      callerName: null,
      businessName: 'Acme Plumbing',
      locale: 'en',
      urgency: 'routine',
    });

    const body = mockCreate.mock.calls[0][0].body;
    expect(body).toMatch(/^Hi there/);
  });

  it('bookingLink parameter is accepted but not included in SMS body', async () => {
    await sendCallerRecoverySMS({
      to: '+15551234567',
      callerName: 'Jane Doe',
      businessName: 'Acme Plumbing',
      locale: 'en',
      urgency: 'routine',
      bookingLink: 'https://book.example.com',
    });

    const body = mockCreate.mock.calls[0][0].body;
    expect(body).not.toContain('https://book.example.com');
  });
});

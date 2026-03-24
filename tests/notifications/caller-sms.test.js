/**
 * Tests for sendCallerSMS — booking confirmation SMS to caller in their language.
 * Verifies i18n interpolation (en/es), Twilio call args, error resilience, null guard.
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

// ─── Module import (after mocks) ──────────────────────────────────────────────

let sendCallerSMS;

beforeAll(async () => {
  const mod = await import('@/lib/notifications');
  sendCallerSMS = mod.sendCallerSMS;
});

// ─── Environment setup ────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TWILIO_ACCOUNT_SID = 'AC_test_sid';
  process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
  process.env.TWILIO_FROM_NUMBER = '+15550001111';
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('sendCallerSMS', () => {
  test('sends English SMS with correct body interpolation', async () => {
    await sendCallerSMS({
      to: '+15551234567',
      businessName: 'Acme Plumbing',
      date: 'Monday, March 23rd',
      time: '10:00 AM',
      address: '123 Main St',
      locale: 'en',
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const { body, from, to } = mockCreate.mock.calls[0][0];
    expect(body).toContain('Your appointment with Acme Plumbing is confirmed for Monday, March 23rd at 10:00 AM at 123 Main St.');
    expect(from).toBe('+15550001111');
    expect(to).toBe('+15551234567');
  });

  test('sends Spanish SMS when locale is es', async () => {
    await sendCallerSMS({
      to: '+15551234567',
      businessName: 'Acme Plumbing',
      date: 'lunes, 23 de marzo',
      time: '10:00 AM',
      address: '123 Main St',
      locale: 'es',
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const { body } = mockCreate.mock.calls[0][0];
    expect(body).toContain('Su cita con Acme Plumbing');
    expect(body).toContain('confirmada');
  });

  test('does not throw on Twilio error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Twilio down'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      sendCallerSMS({
        to: '+15551234567',
        businessName: 'Acme Plumbing',
        date: 'Monday, March 23rd',
        time: '10:00 AM',
        address: '123 Main St',
        locale: 'en',
      })
    ).resolves.not.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Caller SMS failed'),
      expect.any(String)
    );

    consoleSpy.mockRestore();
  });

  test('returns Twilio result on success', async () => {
    const result = await sendCallerSMS({
      to: '+15551234567',
      businessName: 'Acme Plumbing',
      date: 'Monday, March 23rd',
      time: '10:00 AM',
      address: '123 Main St',
      locale: 'en',
    });

    expect(result).toEqual({ sid: 'SM_test_123' });
  });

  test('skips sending when to is null', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await sendCallerSMS({
      to: null,
      businessName: 'Acme Plumbing',
      date: 'Monday, March 23rd',
      time: '10:00 AM',
      address: '123 Main St',
      locale: 'en',
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(result).toBeUndefined();

    warnSpy.mockRestore();
  });

  test('defaults to English when locale is unknown', async () => {
    await sendCallerSMS({
      to: '+15551234567',
      businessName: 'Acme Plumbing',
      date: 'Monday, March 23rd',
      time: '10:00 AM',
      address: '123 Main St',
      locale: 'fr',
    });

    const { body } = mockCreate.mock.calls[0][0];
    expect(body).toContain('Your appointment with');
  });
});

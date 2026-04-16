/**
 * Tests for sendOwnerSMS — Twilio SMS delivery to business owner.
 * Verifies message content, correct from/to, and error resilience.
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

let sendOwnerSMS;

beforeAll(async () => {
  const mod = await import('@/lib/notifications');
  sendOwnerSMS = mod.sendOwnerSMS;
});

// ─── Environment setup ────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TWILIO_ACCOUNT_SID = 'AC_test_sid';
  process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
  process.env.TWILIO_FROM_NUMBER = '+15550001111';
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('sendOwnerSMS', () => {
  it('calls messages.create with correct from and to numbers', async () => {
    await sendOwnerSMS({
      to: '+15559998888',
      businessName: 'Acme Plumbing',
      callerName: 'Jane Doe',
      jobType: 'Pipe repair',
      urgency: 'routine',
      address: '123 Main St',
      callbackLink: 'tel:+15551234567',
      dashboardLink: 'https://app.homeservice.ai/dashboard/jobs',
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const [args] = mockCreate.mock.calls;
    expect(args[0].from).toBe('+15550001111');
    expect(args[0].to).toBe('+15559998888');
  });

  it('SMS body contains business name, EMERGENCY prefix, caller name, job type, and address', async () => {
    await sendOwnerSMS({
      to: '+15559998888',
      businessName: 'Acme Plumbing',
      callerName: 'Jane Doe',
      jobType: 'Pipe repair',
      urgency: 'emergency',
      address: '123 Main St, Springfield',
      callbackLink: 'tel:+15551234567',
      dashboardLink: 'https://app.homeservice.ai/dashboard/jobs',
    });

    const body = mockCreate.mock.calls[0][0].body;
    expect(body).toContain('Acme Plumbing');
    expect(body).toMatch(/^EMERGENCY:/);
    expect(body).toContain('Jane Doe');
    expect(body).toContain('Pipe repair');
    expect(body).toContain('123 Main St, Springfield');
  });

  it('SMS body contains callback link and dashboard link', async () => {
    await sendOwnerSMS({
      to: '+15559998888',
      businessName: 'Acme Plumbing',
      callbackLink: 'tel:+15551234567',
      dashboardLink: 'https://app.homeservice.ai/dashboard/jobs',
    });

    const body = mockCreate.mock.calls[0][0].body;
    expect(body).toContain('tel:+15551234567');
    expect(body).toContain('https://app.homeservice.ai/dashboard/jobs');
  });

  it('uses fallback values when callerName, jobType, and address are omitted', async () => {
    await sendOwnerSMS({
      to: '+15559998888',
      businessName: 'Acme Plumbing',
      callbackLink: 'tel:+15551234567',
      dashboardLink: 'https://app.homeservice.ai/dashboard/jobs',
    });

    const body = mockCreate.mock.calls[0][0].body;
    expect(body).toContain('Unknown');
    expect(body).toContain('General inquiry');
    expect(body).toContain('No address');
  });

  it('does not throw when Twilio returns an error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Twilio network error'));

    await expect(
      sendOwnerSMS({
        to: '+15559998888',
        businessName: 'Acme Plumbing',
        callbackLink: 'tel:+1',
        dashboardLink: 'https://example.com',
      })
    ).resolves.not.toThrow();
  });
});

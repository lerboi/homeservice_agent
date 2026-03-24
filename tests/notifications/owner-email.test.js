/**
 * Tests for sendOwnerEmail — Resend email delivery to business owner.
 * Verifies from/to/subject, email content, and error resilience.
 */

import { jest } from '@jest/globals';

// ─── Mocks (inline — avoids loading real twilio/resend packages) ─────────────

const mockSend = jest.fn().mockResolvedValue({ id: 'email_test_123' });

jest.unstable_mockModule('twilio', () => ({
  default: jest.fn(() => ({
    messages: { create: jest.fn().mockResolvedValue({ sid: 'SM_test_123' }) },
  })),
}));

jest.unstable_mockModule('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

jest.unstable_mockModule('@/emails/NewLeadEmail', () => ({
  NewLeadEmail: jest.fn(({ lead }) => `<mock-email-for-${lead?.caller_name}>`),
}));

// ─── Module import ────────────────────────────────────────────────────────────

let sendOwnerEmail;

beforeAll(async () => {
  const mod = await import('@/lib/notifications');
  sendOwnerEmail = mod.sendOwnerEmail;
});

// ─── Environment setup ────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  process.env.RESEND_API_KEY = 'test_resend_key';
  process.env.RESEND_FROM_EMAIL = 'alerts@example.com';
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('sendOwnerEmail', () => {
  it('calls resend.emails.send with correct from and to', async () => {
    await sendOwnerEmail({
      to: 'owner@example.com',
      lead: { caller_name: 'Jane Doe', urgency: 'routine' },
      businessName: 'Acme Plumbing',
      dashboardUrl: 'https://app.homeservice.ai/dashboard/leads',
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const [args] = mockSend.mock.calls;
    expect(args[0].from).toBe('alerts@example.com');
    expect(args[0].to).toBe('owner@example.com');
  });

  it('email subject contains urgency and caller name', async () => {
    await sendOwnerEmail({
      to: 'owner@example.com',
      lead: { caller_name: 'John Smith', urgency: 'emergency' },
      businessName: 'Acme Plumbing',
      dashboardUrl: 'https://app.homeservice.ai/dashboard/leads',
    });

    const subject = mockSend.mock.calls[0][0].subject;
    expect(subject).toContain('emergency');
    expect(subject).toContain('John Smith');
  });

  it('email uses react property with NewLeadEmail component', async () => {
    const lead = { caller_name: 'Alice Brown', urgency: 'routine' };
    await sendOwnerEmail({
      to: 'owner@example.com',
      lead,
      businessName: 'Acme Plumbing',
      dashboardUrl: 'https://app.homeservice.ai/dashboard/leads',
    });

    const args = mockSend.mock.calls[0][0];
    expect(args.react).toBeDefined();
  });

  it('falls back to default from address when RESEND_FROM_EMAIL is not set', async () => {
    delete process.env.RESEND_FROM_EMAIL;

    await sendOwnerEmail({
      to: 'owner@example.com',
      lead: { caller_name: 'Jane Doe', urgency: 'routine' },
      businessName: 'Acme Plumbing',
      dashboardUrl: 'https://app.homeservice.ai/dashboard/leads',
    });

    const from = mockSend.mock.calls[0][0].from;
    expect(from).toBe('alerts@homeservice.ai');
  });

  it('does not throw when Resend returns an error', async () => {
    mockSend.mockRejectedValueOnce(new Error('Resend API error'));

    await expect(
      sendOwnerEmail({
        to: 'owner@example.com',
        lead: { caller_name: 'Jane Doe', urgency: 'routine' },
        businessName: 'Acme Plumbing',
        dashboardUrl: 'https://app.homeservice.ai/dashboard/leads',
      })
    ).resolves.not.toThrow();
  });
});

/**
 * Priority formatting tests for NOTIF-P01 and NOTIF-P02.
 * Verifies emergency vs routine formatting split in SMS and email.
 */

import { jest } from '@jest/globals';

const mockCreate = jest.fn().mockResolvedValue({ sid: 'SM_test_123' });
const mockEmailSend = jest.fn().mockResolvedValue({ id: 'email_test_123' });

jest.unstable_mockModule('twilio', () => ({
  default: jest.fn(() => ({
    messages: { create: mockCreate },
  })),
}));

jest.unstable_mockModule('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockEmailSend },
  })),
}));

jest.unstable_mockModule('@/emails/NewLeadEmail', () => ({
  NewLeadEmail: jest.fn(() => null),
}));

let sendOwnerSMS;
let sendOwnerEmail;

beforeAll(async () => {
  const mod = await import('@/lib/notifications');
  sendOwnerSMS = mod.sendOwnerSMS;
  sendOwnerEmail = mod.sendOwnerEmail;
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TWILIO_ACCOUNT_SID = 'AC_test';
  process.env.TWILIO_AUTH_TOKEN = 'token_test';
  process.env.TWILIO_FROM_NUMBER = '+15550001111';
  process.env.RESEND_API_KEY = 'resend_test';
  process.env.RESEND_FROM_EMAIL = 'alerts@homeservice.ai';
});

// ─── SMS priority formatting ───────────────────────────────────────────────────

describe('sendOwnerSMS — emergency formatting (NOTIF-P01)', () => {
  it('emergency SMS starts with EMERGENCY: prefix', async () => {
    await sendOwnerSMS({
      to: '+15559998888',
      businessName: 'Acme Plumbing',
      callerName: 'Jane Doe',
      jobType: 'Pipe burst',
      urgency: 'emergency',
      address: '123 Main St',
      callbackLink: 'tel:+15551234567',
      dashboardLink: 'https://example.com/dashboard',
    });

    const body = mockCreate.mock.calls[0][0].body;
    expect(body).toMatch(/^EMERGENCY:/);
  });

  it('emergency SMS contains "Call NOW" (urgent CTA)', async () => {
    await sendOwnerSMS({
      to: '+15559998888',
      businessName: 'Acme Plumbing',
      callerName: 'Jane Doe',
      jobType: 'Pipe burst',
      urgency: 'emergency',
      address: '123 Main St',
      callbackLink: 'tel:+15551234567',
      dashboardLink: 'https://example.com/dashboard',
    });

    const body = mockCreate.mock.calls[0][0].body;
    expect(body).toContain('Call NOW');
  });

  it('emergency SMS contains caller name, job type, and address', async () => {
    await sendOwnerSMS({
      to: '+15559998888',
      businessName: 'Acme Plumbing',
      callerName: 'Jane Doe',
      jobType: 'Pipe burst',
      urgency: 'emergency',
      address: '123 Main St',
      callbackLink: 'tel:+15551234567',
      dashboardLink: 'https://example.com/dashboard',
    });

    const body = mockCreate.mock.calls[0][0].body;
    expect(body).toContain('Jane Doe');
    expect(body).toContain('Pipe burst');
    expect(body).toContain('123 Main St');
  });
});

describe('sendOwnerSMS — routine formatting (NOTIF-P02)', () => {
  it('routine SMS does NOT start with EMERGENCY:', async () => {
    await sendOwnerSMS({
      to: '+15559998888',
      businessName: 'Acme Plumbing',
      callerName: 'John Smith',
      jobType: 'Boiler service',
      urgency: 'routine',
      address: '456 Oak Ave',
      callbackLink: 'tel:+15551234567',
      dashboardLink: 'https://example.com/dashboard',
    });

    const body = mockCreate.mock.calls[0][0].body;
    expect(body).not.toMatch(/^EMERGENCY:/);
  });

  it('routine SMS does NOT contain "Call NOW"', async () => {
    await sendOwnerSMS({
      to: '+15559998888',
      businessName: 'Acme Plumbing',
      urgency: 'routine',
      callbackLink: 'tel:+1',
      dashboardLink: 'https://example.com',
    });

    const body = mockCreate.mock.calls[0][0].body;
    expect(body).not.toContain('Call NOW');
  });

  it('high_ticket SMS does NOT start with EMERGENCY:', async () => {
    await sendOwnerSMS({
      to: '+15559998888',
      businessName: 'Acme Plumbing',
      urgency: 'high_ticket',
      callbackLink: 'tel:+1',
      dashboardLink: 'https://example.com',
    });

    const body = mockCreate.mock.calls[0][0].body;
    expect(body).not.toMatch(/^EMERGENCY:/);
  });

  it('undefined urgency SMS does NOT start with EMERGENCY:', async () => {
    await sendOwnerSMS({
      to: '+15559998888',
      businessName: 'Acme Plumbing',
      callbackLink: 'tel:+1',
      dashboardLink: 'https://example.com',
    });

    const body = mockCreate.mock.calls[0][0].body;
    expect(body).not.toMatch(/^EMERGENCY:/);
  });
});

// ─── Email priority formatting ─────────────────────────────────────────────────

describe('sendOwnerEmail — emergency formatting (NOTIF-P01)', () => {
  it('emergency email subject starts with EMERGENCY:', async () => {
    await sendOwnerEmail({
      to: 'owner@acme.com',
      lead: { caller_name: 'Jane Doe', urgency: 'emergency', urgency_classification: 'emergency' },
      businessName: 'Acme Plumbing',
      dashboardUrl: 'https://example.com/dashboard',
    });

    const callArgs = mockEmailSend.mock.calls[0][0];
    expect(callArgs.subject).toMatch(/^EMERGENCY:/);
  });

  it('emergency email subject contains caller name', async () => {
    await sendOwnerEmail({
      to: 'owner@acme.com',
      lead: { caller_name: 'Jane Doe', urgency: 'emergency' },
      businessName: 'Acme Plumbing',
      dashboardUrl: 'https://example.com/dashboard',
    });

    const callArgs = mockEmailSend.mock.calls[0][0];
    expect(callArgs.subject).toContain('Jane Doe');
  });
});

describe('sendOwnerEmail — routine formatting (NOTIF-P02)', () => {
  it('routine email subject does NOT start with EMERGENCY:', async () => {
    await sendOwnerEmail({
      to: 'owner@acme.com',
      lead: { caller_name: 'John Smith', urgency: 'routine' },
      businessName: 'Acme Plumbing',
      dashboardUrl: 'https://example.com/dashboard',
    });

    const callArgs = mockEmailSend.mock.calls[0][0];
    expect(callArgs.subject).not.toMatch(/^EMERGENCY:/);
  });

  it('routine email subject contains "New booking"', async () => {
    await sendOwnerEmail({
      to: 'owner@acme.com',
      lead: { caller_name: 'John Smith', urgency: 'routine' },
      businessName: 'Acme Plumbing',
      dashboardUrl: 'https://example.com/dashboard',
    });

    const callArgs = mockEmailSend.mock.calls[0][0];
    expect(callArgs.subject).toContain('New booking');
  });

  it('high_ticket email subject does NOT start with EMERGENCY:', async () => {
    await sendOwnerEmail({
      to: 'owner@acme.com',
      lead: { caller_name: 'John Smith', urgency: 'high_ticket' },
      businessName: 'Acme Plumbing',
      dashboardUrl: 'https://example.com/dashboard',
    });

    const callArgs = mockEmailSend.mock.calls[0][0];
    expect(callArgs.subject).not.toMatch(/^EMERGENCY:/);
  });
});

// ─── Priority driven by urgency tag, not routing path (NOTIF-P01) ──────────────

describe('notification priority driven by urgency tag only', () => {
  it('same emergency urgency produces EMERGENCY prefix regardless of other fields', async () => {
    await sendOwnerSMS({
      to: '+15559998888',
      businessName: 'Biz',
      urgency: 'emergency',
      callbackLink: 'tel:+1',
      dashboardLink: 'https://example.com',
    });

    await sendOwnerSMS({
      to: '+15559998888',
      businessName: 'Biz',
      urgency: 'emergency',
      callbackLink: 'tel:+1',
      dashboardLink: 'https://example.com',
    });

    const body1 = mockCreate.mock.calls[0][0].body;
    const body2 = mockCreate.mock.calls[1][0].body;
    expect(body1).toMatch(/^EMERGENCY:/);
    expect(body2).toMatch(/^EMERGENCY:/);
  });
});

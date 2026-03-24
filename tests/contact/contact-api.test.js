/**
 * Wave 0 test scaffold for the contact API route.
 * These tests are RED until src/app/api/contact/route.js is implemented in Plan 06-03.
 *
 * Tests cover:
 * - Honeypot spam protection (returns 200 silently)
 * - Required field validation (returns 400)
 * - Inquiry type routing (Resend sent to correct address per inquiryType)
 * - replyTo set to submitter's email
 */

import { describe, test, expect, jest, beforeAll, beforeEach } from '@jest/globals';

// ─── Environment setup ────────────────────────────────────────────────────────

process.env.RESEND_API_KEY = 'test-resend-key';
process.env.RESEND_FROM_EMAIL = 'noreply@homeservice.ai';
process.env.CONTACT_EMAIL_SALES = 'sales@test.com';
process.env.CONTACT_EMAIL_SUPPORT = 'support@test.com';
process.env.CONTACT_EMAIL_PARTNERSHIPS = 'partners@test.com';
process.env.CONTACT_EMAIL_FALLBACK = 'hello@test.com';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSend = jest.fn().mockResolvedValue({ id: 'email_test_456' });

jest.unstable_mockModule('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

// ─── Module import (after mocks) ──────────────────────────────────────────────

let POST;

beforeAll(async () => {
  const mod = await import('../../src/app/api/contact/route.js');
  POST = mod.POST;
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body) {
  return new Request('http://localhost:3000/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/contact — honeypot spam protection', () => {
  test('returns 200 silently when honeypot field is filled', async () => {
    const req = makeRequest({
      name: 'Spammer',
      email: 'spam@example.com',
      inquiryType: 'sales',
      message: 'Buy my stuff',
      _honeypot: 'filled-by-bot',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('POST /api/contact — required field validation', () => {
  test('returns 400 when name is missing', async () => {
    const req = makeRequest({
      email: 'test@example.com',
      inquiryType: 'sales',
      message: 'Hello',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test('returns 400 when email is missing', async () => {
    const req = makeRequest({
      name: 'John Doe',
      inquiryType: 'sales',
      message: 'Hello',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/contact — inquiry type routing', () => {
  test('routes sales inquiry to CONTACT_EMAIL_SALES', async () => {
    const req = makeRequest({
      name: 'John Doe',
      email: 'john@example.com',
      inquiryType: 'sales',
      message: 'I want to learn more',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'sales@test.com',
        replyTo: 'john@example.com',
      })
    );
  });

  test('routes support inquiry to CONTACT_EMAIL_SUPPORT', async () => {
    const req = makeRequest({
      name: 'Jane Smith',
      email: 'jane@example.com',
      inquiryType: 'support',
      message: 'I need help',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'support@test.com',
        replyTo: 'jane@example.com',
      })
    );
  });

  test('routes partnerships inquiry to CONTACT_EMAIL_PARTNERSHIPS', async () => {
    const req = makeRequest({
      name: 'Partner Corp',
      email: 'partner@corp.com',
      inquiryType: 'partnerships',
      message: 'Let us work together',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'partners@test.com',
        replyTo: 'partner@corp.com',
      })
    );
  });

  test('sets replyTo to the submitter email address', async () => {
    const req = makeRequest({
      name: 'Reply Test',
      email: 'replytest@example.com',
      inquiryType: 'sales',
      message: 'Testing reply-to',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        replyTo: 'replytest@example.com',
      })
    );
  });

  test('sales inquiry subject contains [sales]', async () => {
    const req = makeRequest({
      name: 'Sales Test',
      email: 'sales-test@example.com',
      inquiryType: 'sales',
      message: 'Testing sales subject',
    });
    await POST(req);
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.subject).toMatch(/\[sales\]/i);
  });
});

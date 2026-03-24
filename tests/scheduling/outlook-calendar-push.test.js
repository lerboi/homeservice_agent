import { jest } from '@jest/globals';

// Mock supabase with chainable API
const mockSingle = jest.fn();
const mockEqInner = jest.fn(() => ({ single: mockSingle }));
const mockEqOuter = jest.fn(() => ({ eq: mockEqInner }));
const mockSelect = jest.fn(() => ({ eq: mockEqOuter }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.unstable_mockModule('@/lib/supabase.js', () => ({
  supabase: { from: mockFrom },
}));

// Mock syncOutlookCalendarEvents
const mockSync = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule('@/lib/scheduling/outlook-calendar.js', () => ({
  syncOutlookCalendarEvents: mockSync,
}));

// Mock next/server after() -- capture callbacks without executing them
const capturedAfterCallbacks = [];
const mockAfter = jest.fn((fn) => { capturedAfterCallbacks.push(fn); });
jest.unstable_mockModule('next/server', () => ({
  after: mockAfter,
}));

const WEBHOOK_SECRET = 'test-webhook-secret';
const originalEnv = process.env;

beforeAll(() => {
  process.env = { ...originalEnv, OUTLOOK_WEBHOOK_SECRET: WEBHOOK_SECRET };
});

afterAll(() => {
  process.env = originalEnv;
});

beforeEach(() => {
  jest.clearAllMocks();
  capturedAfterCallbacks.length = 0;

  // Reset chainable mocks
  mockFrom.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ eq: mockEqOuter });
  mockEqOuter.mockReturnValue({ eq: mockEqInner });
  mockEqInner.mockReturnValue({ single: mockSingle });
  mockSingle.mockResolvedValue({ data: null });
});

describe('Outlook Calendar Webhook Route', () => {
  let POST;

  beforeEach(async () => {
    const mod = await import('../../src/app/api/webhooks/outlook-calendar/route.js');
    POST = mod.POST;
  });

  test('POST with ?validationToken=abc returns 200 with plain text "abc"', async () => {
    const request = new Request('http://localhost/api/webhooks/outlook-calendar?validationToken=abc');

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/plain');
    const text = await response.text();
    expect(text).toBe('abc');
  });

  test('POST with URL-encoded validationToken decodes correctly', async () => {
    const encoded = encodeURIComponent('token with spaces & special=chars');
    const request = new Request(`http://localhost/api/webhooks/outlook-calendar?validationToken=${encoded}`);

    const response = await POST(request);

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe('token with spaces & special=chars');
  });

  test('POST with notification body returns 202', async () => {
    const request = new Request('http://localhost/api/webhooks/outlook-calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        value: [
          {
            subscriptionId: 'sub-123',
            clientState: WEBHOOK_SECRET,
            changeType: 'updated',
          },
        ],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(202);
    // Verify after() was called with the handler
    expect(mockAfter).toHaveBeenCalledTimes(1);
  });
});

describe('handleOutlookCalendarPush', () => {
  let handleOutlookCalendarPush;

  beforeEach(async () => {
    const mod = await import('../../src/lib/webhooks/outlook-calendar-push.js');
    handleOutlookCalendarPush = mod.handleOutlookCalendarPush;
  });

  test('calls syncOutlookCalendarEvents for valid notification with correct clientState', async () => {
    mockSingle.mockResolvedValue({ data: { tenant_id: 'tenant-abc' } });

    const body = {
      value: [
        {
          subscriptionId: 'sub-123',
          clientState: WEBHOOK_SECRET,
          changeType: 'updated',
        },
      ],
    };

    await handleOutlookCalendarPush(body);

    expect(mockFrom).toHaveBeenCalledWith('calendar_credentials');
    expect(mockSync).toHaveBeenCalledWith('tenant-abc');
  });

  test('skips notification with invalid clientState', async () => {
    const body = {
      value: [
        {
          subscriptionId: 'sub-123',
          clientState: 'wrong-secret',
          changeType: 'updated',
        },
      ],
    };

    await handleOutlookCalendarPush(body);

    expect(mockSync).not.toHaveBeenCalled();
  });

  test('handles empty body gracefully', async () => {
    const result = await handleOutlookCalendarPush(null);
    expect(result).toEqual({ ok: true });

    const result2 = await handleOutlookCalendarPush({});
    expect(result2).toEqual({ ok: true });
  });

  test('skips notification when no credentials found for subscription', async () => {
    mockSingle.mockResolvedValue({ data: null });

    const body = {
      value: [
        {
          subscriptionId: 'unknown-sub',
          clientState: WEBHOOK_SECRET,
          changeType: 'updated',
        },
      ],
    };

    await handleOutlookCalendarPush(body);

    expect(mockSync).not.toHaveBeenCalled();
  });
});

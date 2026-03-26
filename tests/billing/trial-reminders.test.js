/**
 * Tests for trial-reminders cron job.
 * Phase 24-03: BILLNOTIF-02
 *
 * Test 1: Unauthorized request (missing/wrong CRON_SECRET) returns 401
 * Test 2: Tenant at day 7 with no prior notification -> email sent + billing_notifications row inserted
 * Test 3: Tenant at day 7 with existing 'trial_reminder_day_7' notification -> email NOT sent (idempotency)
 * Test 4: Tenant at day 12 with no prior notification -> email sent with type 'trial_reminder_day_12'
 * Test 5: Tenant at day 12 with existing 'trial_reminder_day_12' notification -> email NOT sent
 * Test 6: Tenant at day 5 -> no email sent (too early)
 * Test 7: Response shape has sent_day_7, sent_day_12, skipped keys
 * Test 8: Non-trialing subscription (status='active') -> no email sent (returns empty trialSubs)
 */

import { jest } from '@jest/globals';

// ─── Module-level mock state (mutated per-test) ────────────────────────────────

let mockEmailSend = jest.fn().mockResolvedValue({ id: 'email_test_id' });

// Supabase query chains — module-level so the mock factory can reference them
let mockSubscriptionsResult = { data: [], error: null };
let mockBillingNotifsExisting = null; // null = no prior send
let mockBillingNotifsInsert = jest.fn().mockResolvedValue({ data: null, error: null });
let mockTenantData = { business_name: 'Test HVAC Co', owner_email: 'owner@testhvac.com' };

// Build the supabase mock object (module-level, mutated per test)
const mockSupabase = {
  from: jest.fn((table) => {
    if (table === 'subscriptions') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockResolvedValue(mockSubscriptionsResult),
      };
    }
    if (table === 'billing_notifications') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockBillingNotifsExisting, error: null }),
        insert: mockBillingNotifsInsert,
      };
    }
    if (table === 'tenants') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockTenantData, error: null }),
      };
    }
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      not: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
  }),
};

// ─── Module mocking ─────────────────────────────────────────────────────────────

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

jest.unstable_mockModule('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: (...args) => mockEmailSend(...args) },
  })),
}));

jest.unstable_mockModule('@/emails/TrialReminderEmail', () => ({
  TrialReminderEmail: jest.fn().mockReturnValue('<MockTrialReminderEmail />'),
}));

// ─── Import GET handler ──────────────────────────────────────────────────────────

let GET;

beforeAll(async () => {
  process.env.CRON_SECRET = 'test-secret-abc';
  process.env.RESEND_API_KEY = 'test-resend-key';
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.test';
  const mod = await import('@/app/api/cron/trial-reminders/route.js');
  GET = mod.GET;
});

beforeEach(() => {
  jest.clearAllMocks();
  // Reset to defaults
  mockEmailSend = jest.fn().mockResolvedValue({ id: 'email_test_id' });
  mockBillingNotifsExisting = null;
  mockBillingNotifsInsert = jest.fn().mockResolvedValue({ data: null, error: null });
  mockSubscriptionsResult = { data: [], error: null };
  mockTenantData = { business_name: 'Test HVAC Co', owner_email: 'owner@testhvac.com' };
});

// ─── Helper to rebuild from mock after state changes ────────────────────────────

// The mock.from is a jest.fn() that returns fresh query objects each call.
// We need to rebuild it to pick up new state. Use a factory approach.
function resetFromMock() {
  mockSupabase.from.mockImplementation((table) => {
    if (table === 'subscriptions') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockResolvedValue(mockSubscriptionsResult),
      };
    }
    if (table === 'billing_notifications') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockBillingNotifsExisting, error: null }),
        insert: mockBillingNotifsInsert,
      };
    }
    if (table === 'tenants') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockTenantData, error: null }),
      };
    }
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      not: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
  });
}

// ─── Helper to build mock Request ───────────────────────────────────────────────

function makeRequest(authHeader) {
  return {
    headers: {
      get: (name) => (name === 'authorization' ? authHeader : null),
    },
  };
}

// ─── Helper to create trial subscription fixtures ────────────────────────────────

const NOW = Date.now();

function trialStartAt(daysAgo) {
  return new Date(NOW - daysAgo * 86_400_000).toISOString();
}

function makeTrialSub(daysAgo, tenantId = 'tenant-uuid-001') {
  return {
    tenant_id: tenantId,
    trial_ends_at: new Date(NOW + (14 - daysAgo) * 86_400_000).toISOString(),
    current_period_start: trialStartAt(daysAgo),
    calls_used: 5,
    calls_limit: 40,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────────

describe('trial-reminders cron — auth', () => {
  it('Test 1: Returns 401 when authorization header is missing', async () => {
    resetFromMock();
    const req = makeRequest(null);
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('Test 1b: Returns 401 when authorization header has wrong secret', async () => {
    resetFromMock();
    const req = makeRequest('Bearer wrong-secret');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });
});

describe('trial-reminders cron — day 7 reminder', () => {
  it('Test 2: Tenant at day 7 with no prior notification -> sends email and inserts billing_notifications', async () => {
    mockSubscriptionsResult = { data: [makeTrialSub(7)], error: null };
    mockBillingNotifsExisting = null;
    resetFromMock();

    const req = makeRequest('Bearer test-secret-abc');
    const res = await GET(req);
    const body = await res.json();

    expect(body.sent_day_7).toBeGreaterThanOrEqual(1);

    // Verify email was sent
    expect(mockEmailSend).toHaveBeenCalledTimes(1);
    const emailCall = mockEmailSend.mock.calls[0][0];
    expect(emailCall.from).toBe('Voco <notifications@getvoco.ai>');
    expect(emailCall.to).toBe('owner@testhvac.com');
    expect(emailCall.subject).toContain('7 days');

    // Verify billing_notifications insert was called with day_7 type
    expect(mockBillingNotifsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-uuid-001',
        notification_type: 'trial_reminder_day_7',
      })
    );
  });

  it('Test 3: Tenant at day 7 with existing trial_reminder_day_7 -> email NOT sent (idempotency)', async () => {
    mockSubscriptionsResult = { data: [makeTrialSub(7)], error: null };
    mockBillingNotifsExisting = { id: 'existing-notif-id' }; // Already sent
    resetFromMock();

    const req = makeRequest('Bearer test-secret-abc');
    const res = await GET(req);
    const body = await res.json();

    expect(body.sent_day_7).toBe(0);
    expect(mockEmailSend).not.toHaveBeenCalled();
  });
});

describe('trial-reminders cron — day 12 reminder', () => {
  it('Test 4: Tenant at day 12 with no prior notification -> sends day_12 email', async () => {
    mockSubscriptionsResult = { data: [makeTrialSub(12)], error: null };
    mockBillingNotifsExisting = null;
    resetFromMock();

    const req = makeRequest('Bearer test-secret-abc');
    const res = await GET(req);
    const body = await res.json();

    expect(body.sent_day_12).toBeGreaterThanOrEqual(1);

    // Verify at least one email with "2 days" subject was sent (day 12 email)
    const emailCalls = mockEmailSend.mock.calls.map((c) => c[0]);
    const day12Call = emailCalls.find((c) => c.subject && c.subject.includes('2 days'));
    expect(day12Call).toBeDefined();
    expect(day12Call.from).toBe('Voco <notifications@getvoco.ai>');

    // Verify billing_notifications insert for day_12
    expect(mockBillingNotifsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        notification_type: 'trial_reminder_day_12',
      })
    );
  });

  it('Test 5: Tenant at day 12 with existing trial_reminder_day_12 -> day_12 email NOT sent', async () => {
    mockSubscriptionsResult = { data: [makeTrialSub(12)], error: null };
    mockBillingNotifsExisting = { id: 'existing-notif-day12' }; // Already sent for any type
    resetFromMock();

    const req = makeRequest('Bearer test-secret-abc');
    const res = await GET(req);
    const body = await res.json();

    expect(body.sent_day_12).toBe(0);
    expect(body.sent_day_7).toBe(0);
    expect(mockEmailSend).not.toHaveBeenCalled();
  });
});

describe('trial-reminders cron — early trial (day 5)', () => {
  it('Test 6: Tenant at day 5 -> no email sent (too early, < 7 days)', async () => {
    mockSubscriptionsResult = { data: [makeTrialSub(5)], error: null };
    mockBillingNotifsExisting = null;
    resetFromMock();

    const req = makeRequest('Bearer test-secret-abc');
    const res = await GET(req);
    const body = await res.json();

    expect(body.sent_day_7).toBe(0);
    expect(body.sent_day_12).toBe(0);
    expect(mockEmailSend).not.toHaveBeenCalled();
  });
});

describe('trial-reminders cron — non-trialing subscription', () => {
  it('Test 8: No trialing subscriptions -> no email sent', async () => {
    // Non-trialing subscriptions are filtered out by .eq('status', 'trialing') at DB level.
    // We simulate that by returning an empty array.
    mockSubscriptionsResult = { data: [], error: null };
    resetFromMock();

    const req = makeRequest('Bearer test-secret-abc');
    const res = await GET(req);
    const body = await res.json();

    expect(body.sent_day_7).toBe(0);
    expect(body.sent_day_12).toBe(0);
    expect(mockEmailSend).not.toHaveBeenCalled();
  });
});

describe('trial-reminders cron — response shape', () => {
  it('Test 7: Response includes sent_day_7, sent_day_12, and skipped keys', async () => {
    mockSubscriptionsResult = { data: [makeTrialSub(7, 'tenant-a'), makeTrialSub(12, 'tenant-b')], error: null };
    mockBillingNotifsExisting = null;
    resetFromMock();

    const req = makeRequest('Bearer test-secret-abc');
    const res = await GET(req);
    const body = await res.json();

    expect(body).toHaveProperty('sent_day_7');
    expect(body).toHaveProperty('sent_day_12');
    expect(body).toHaveProperty('skipped');
    expect(typeof body.sent_day_7).toBe('number');
    expect(typeof body.sent_day_12).toBe('number');
    expect(typeof body.skipped).toBe('number');
  });
});

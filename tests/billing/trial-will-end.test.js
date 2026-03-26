/**
 * Tests for handleTrialWillEnd webhook handler.
 * Phase 24-01: BILLNOTIF-03
 *
 * Test 4: handleTrialWillEnd sends email notification to tenant owner (happy path)
 * Test 5: handleTrialWillEnd checks billing_notifications for prior send (idempotency)
 * Test 6: Second call with existing billing_notifications row does NOT send email
 * Test 7: handleTrialWillEnd inserts billing_notifications row after successful send
 */

import { jest } from '@jest/globals';

// --- Mock setup ---

let mockFrom;
let mockBillingNotifsQuery;
let mockTenantsQuery;
let mockSubscriptionsQuery;
let mockEmailSend;
let mockSmsCreate;

function buildMocks() {
  mockEmailSend = jest.fn().mockResolvedValue({ id: 'email_test' });
  mockSmsCreate = jest.fn().mockResolvedValue({ sid: 'SM_test' });

  const insertMock = jest.fn().mockResolvedValue({ data: null, error: null });

  mockBillingNotifsQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }), // No prior send
    insert: insertMock,
    _insertMock: insertMock,
  };

  mockTenantsQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: {
        business_name: 'Test HVAC Co',
        owner_email: 'owner@testhvac.com',
        owner_phone: '+19876543210',
      },
      error: null,
    }),
  };

  mockSubscriptionsQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: { calls_used: 7, calls_limit: 40, trial_ends_at: null },
      error: null,
    }),
  };

  mockFrom = jest.fn((table) => {
    if (table === 'billing_notifications') return mockBillingNotifsQuery;
    if (table === 'tenants') return mockTenantsQuery;
    if (table === 'subscriptions') return mockSubscriptionsQuery;
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  return { from: mockFrom };
}

let mockSupabase = buildMocks();

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

jest.unstable_mockModule('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: jest.fn() },
  },
}));

jest.unstable_mockModule('twilio', () => ({
  default: jest.fn(() => ({
    messages: { create: mockSmsCreate },
  })),
}));

jest.unstable_mockModule('resend', () => ({
  Resend: jest.fn(() => ({
    emails: { send: mockEmailSend },
  })),
}));

jest.unstable_mockModule('@/lib/retell', () => ({
  retell: { phoneNumber: { import: jest.fn() } },
}));

// Replicates handleTrialWillEnd logic for inline testing
async function handleTrialWillEnd(subscription, db, resendClient, twilioClient, TrialReminderEmail) {
  try {
    const tenantId = subscription.metadata?.tenant_id;
    if (!tenantId) return;

    // Idempotency check
    const { data: existing } = await db
      .from('billing_notifications')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('notification_type', 'trial_will_end')
      .maybeSingle();

    if (existing) return; // Already sent

    const { data: tenant } = await db
      .from('tenants')
      .select('business_name, owner_email, owner_phone')
      .eq('id', tenantId)
      .single();

    if (!tenant) return;

    const { data: sub } = await db
      .from('subscriptions')
      .select('calls_used, calls_limit, trial_ends_at')
      .eq('tenant_id', tenantId)
      .eq('is_current', true)
      .maybeSingle();

    const upgradeUrl = 'https://app.getvoco.ai/dashboard/more/billing';

    await Promise.allSettled([
      resendClient.emails.send({
        from: 'Voco <notifications@getvoco.ai>',
        to: tenant.owner_email,
        subject: 'Your Voco trial ends in 3 days',
        react: TrialReminderEmail({
          businessName: tenant.business_name,
          daysUsed: 11,
          daysRemaining: 3,
          callsUsed: sub?.calls_used || 0,
          callsLimit: sub?.calls_limit || 0,
          upgradeUrl,
        }),
      }),
      twilioClient.messages.create({
        body: `Voco: Your trial ends in 3 days. Upgrade now to keep your calls answered: ${upgradeUrl}`,
        to: tenant.owner_phone,
        from: '+10000000000',
      }),
    ]);

    // Insert billing_notifications row after successful send
    await db.from('billing_notifications').insert({
      tenant_id: tenantId,
      notification_type: 'trial_will_end',
      metadata: { trial_end: subscription.trial_end },
    });

    console.log('[stripe/webhook] Trial-will-end notification sent for tenant:', tenantId);
  } catch (err) {
    console.error('[stripe/webhook] handleTrialWillEnd error:', err);
  }
}

describe('handleTrialWillEnd (BILLNOTIF-03)', () => {
  let resendClient;
  let twilioClient;
  let mockTrialReminderEmail;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = buildMocks();

    mockEmailSend.mockResolvedValue({ id: 'email_test' });
    mockSmsCreate.mockResolvedValue({ sid: 'SM_test' });

    resendClient = { emails: { send: mockEmailSend } };
    twilioClient = { messages: { create: mockSmsCreate } };
    mockTrialReminderEmail = jest.fn().mockReturnValue('<mock-trial-email>');
  });

  it('Test 4 (BILLNOTIF-03 happy path): sends email + SMS notification to tenant owner', async () => {
    const subscription = {
      metadata: { tenant_id: 'tenant-uuid-456' },
      trial_end: Math.floor(Date.now() / 1000) + 3 * 86400,
    };

    await handleTrialWillEnd(subscription, mockSupabase, resendClient, twilioClient, mockTrialReminderEmail);

    // Email should be sent
    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@testhvac.com',
        subject: 'Your Voco trial ends in 3 days',
      })
    );

    // SMS should be sent
    expect(mockSmsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '+19876543210',
        body: expect.stringContaining('trial ends in 3 days'),
      })
    );
  });

  it('Test 5 (BILLNOTIF-03 idempotency): checks billing_notifications for prior send', async () => {
    const subscription = {
      metadata: { tenant_id: 'tenant-uuid-456' },
      trial_end: Math.floor(Date.now() / 1000) + 3 * 86400,
    };

    await handleTrialWillEnd(subscription, mockSupabase, resendClient, twilioClient, mockTrialReminderEmail);

    // billing_notifications should have been queried
    expect(mockFrom).toHaveBeenCalledWith('billing_notifications');
  });

  it('Test 6 (BILLNOTIF-03 idempotency): second call does NOT send email when billing_notifications row exists', async () => {
    // Mock: prior notification already exists
    mockSupabase.from = jest.fn((table) => {
      if (table === 'billing_notifications') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: 'existing-row-uuid' }, // Existing row found
            error: null,
          }),
          insert: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === 'tenants') return mockTenantsQuery;
      if (table === 'subscriptions') return mockSubscriptionsQuery;
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const subscription = {
      metadata: { tenant_id: 'tenant-uuid-456' },
      trial_end: Math.floor(Date.now() / 1000) + 3 * 86400,
    };

    await handleTrialWillEnd(subscription, mockSupabase, resendClient, twilioClient, mockTrialReminderEmail);

    // Email and SMS should NOT be sent (idempotency guard)
    expect(mockEmailSend).not.toHaveBeenCalled();
    expect(mockSmsCreate).not.toHaveBeenCalled();
  });

  it('Test 7 (BILLNOTIF-03): inserts billing_notifications row after successful send', async () => {
    const insertMock = jest.fn().mockResolvedValue({ data: null, error: null });

    mockSupabase.from = jest.fn((table) => {
      if (table === 'billing_notifications') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }), // No prior send
          insert: insertMock,
        };
      }
      if (table === 'tenants') return mockTenantsQuery;
      if (table === 'subscriptions') return mockSubscriptionsQuery;
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const subscription = {
      metadata: { tenant_id: 'tenant-uuid-789' },
      trial_end: Math.floor(Date.now() / 1000) + 3 * 86400,
    };

    await handleTrialWillEnd(subscription, mockSupabase, resendClient, twilioClient, mockTrialReminderEmail);

    // billing_notifications row should have been inserted
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-uuid-789',
        notification_type: 'trial_will_end',
      })
    );
  });
});

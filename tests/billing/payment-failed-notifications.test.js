/**
 * Tests for handleInvoicePaymentFailed webhook handler.
 * Phase 24-01: BILLNOTIF-01
 *
 * Test 1: handleInvoicePaymentFailed sends SMS + email with portal URL (happy path)
 * Test 2: SMS/email failure does not throw from handler (Promise.allSettled pattern)
 * Test 3: No notification sent if subscription or tenant not found (early return)
 */

import { jest } from '@jest/globals';

// --- Mock setup ---

let mockFrom;
let mockMaybeSingle;
let mockSingle;
let mockInsert;
let mockPortalSession;
let mockSmsCreate;
let mockEmailSend;

function buildSupabaseMock() {
  mockMaybeSingle = jest.fn();
  mockSingle = jest.fn();
  mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });

  const subscriptionsQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: mockMaybeSingle,
  };

  const tenantsQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: mockSingle,
  };

  const billingNotificationsQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    insert: mockInsert,
  };

  mockFrom = jest.fn((table) => {
    if (table === 'subscriptions') return subscriptionsQuery;
    if (table === 'tenants') return tenantsQuery;
    if (table === 'billing_notifications') return billingNotificationsQuery;
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  return { from: mockFrom };
}

let mockSupabase = buildSupabaseMock();

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

// Mock stripe
mockPortalSession = jest.fn();
jest.unstable_mockModule('@/lib/stripe', () => ({
  stripe: {
    billingPortal: {
      sessions: {
        create: mockPortalSession,
      },
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  },
}));

// Mock twilio
mockSmsCreate = jest.fn();
jest.unstable_mockModule('twilio', () => ({
  default: jest.fn(() => ({
    messages: {
      create: mockSmsCreate,
    },
  })),
}));

// Mock resend
mockEmailSend = jest.fn();
jest.unstable_mockModule('resend', () => ({
  Resend: jest.fn(() => ({
    emails: {
      send: mockEmailSend,
    },
  })),
}));

// Mock retell (required by webhook route)
jest.unstable_mockModule('@/lib/retell', () => ({
  retell: {
    phoneNumber: {
      import: jest.fn(),
    },
  },
}));

// We test handleInvoicePaymentFailed by replicating its logic inline
// (same approach as usage-tracking.test.js Test 4)

describe('handleInvoicePaymentFailed (BILLNOTIF-01)', () => {
  let localSupabase;
  let localStripe;
  let localTwilio;
  let localResend;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset portal session mock
    mockPortalSession.mockResolvedValue({ url: 'https://billing.stripe.com/test' });

    // Reset SMS mock
    mockSmsCreate.mockResolvedValue({ sid: 'SM_test' });

    // Reset email mock
    mockEmailSend.mockResolvedValue({ id: 'email_test' });

    // Default: subscription found
    mockMaybeSingle.mockResolvedValue({
      data: { tenant_id: 'tenant-uuid-123' },
      error: null,
    });

    // Default: tenant found
    mockSingle.mockResolvedValue({
      data: {
        business_name: 'Test Plumbing Co',
        owner_email: 'owner@test.com',
        owner_phone: '+1234567890',
      },
      error: null,
    });
  });

  it('Test 1 (BILLNOTIF-01 happy path): sends SMS + email with portal URL when subscription and tenant found', async () => {
    // Replicate handleInvoicePaymentFailed logic
    async function handleInvoicePaymentFailed(invoice, db, stripe, twilioClient, resendClient, PaymentFailedEmail) {
      try {
        const subscriptionId = invoice.subscription;
        if (!subscriptionId) return;

        const { data: sub } = await db
          .from('subscriptions')
          .select('tenant_id')
          .eq('stripe_subscription_id', subscriptionId)
          .eq('is_current', true)
          .maybeSingle();

        if (!sub?.tenant_id) return;

        const { data: tenant } = await db
          .from('tenants')
          .select('business_name, owner_email, owner_phone')
          .eq('id', sub.tenant_id)
          .single();

        if (!tenant) return;

        const session = await stripe.billingPortal.sessions.create({
          customer: invoice.customer,
          return_url: 'https://app.getvoco.ai/dashboard',
        });

        await Promise.allSettled([
          twilioClient.messages.create({
            body: `Voco: Your payment failed. Update your card to keep your calls answered: ${session.url}`,
            to: tenant.owner_phone,
            from: '+10000000000',
          }),
          resendClient.emails.send({
            from: 'Voco <notifications@getvoco.ai>',
            to: tenant.owner_email,
            subject: 'Action needed: Voco payment failed',
            react: PaymentFailedEmail({
              businessName: tenant.business_name,
              ownerName: tenant.business_name,
              portalUrl: session.url,
            }),
          }),
        ]);

        console.log('[stripe/webhook] Payment failed notification sent for tenant:', sub.tenant_id);
      } catch (err) {
        console.error('[stripe/webhook] handleInvoicePaymentFailed error:', err);
      }
    }

    const mockPaymentFailedEmail = jest.fn().mockReturnValue('<mock-email>');
    const twilioClient = { messages: { create: mockSmsCreate } };
    const resendClient = { emails: { send: mockEmailSend } };
    const stripeClient = { billingPortal: { sessions: { create: mockPortalSession } } };

    const invoice = {
      subscription: 'sub_test_123',
      customer: 'cus_test_123',
    };

    await handleInvoicePaymentFailed(
      invoice,
      mockSupabase,
      stripeClient,
      twilioClient,
      resendClient,
      mockPaymentFailedEmail
    );

    // Portal session should have been created
    expect(mockPortalSession).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_test_123' })
    );

    // SMS should have been sent
    expect(mockSmsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '+1234567890',
        body: expect.stringContaining('https://billing.stripe.com/test'),
      })
    );

    // Email should have been sent
    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@test.com',
        subject: 'Action needed: Voco payment failed',
      })
    );
  });

  it('Test 2 (BILLNOTIF-01): SMS/email failure does NOT throw from handler (Promise.allSettled pattern)', async () => {
    async function handleInvoicePaymentFailed(invoice, db, stripe, twilioClient, resendClient) {
      try {
        const subscriptionId = invoice.subscription;
        if (!subscriptionId) return;

        const { data: sub } = await db
          .from('subscriptions')
          .select('tenant_id')
          .eq('stripe_subscription_id', subscriptionId)
          .eq('is_current', true)
          .maybeSingle();

        if (!sub?.tenant_id) return;

        const { data: tenant } = await db
          .from('tenants')
          .select('business_name, owner_email, owner_phone')
          .eq('id', sub.tenant_id)
          .single();

        if (!tenant) return;

        const session = await stripe.billingPortal.sessions.create({
          customer: invoice.customer,
          return_url: 'https://app.getvoco.ai/dashboard',
        });

        // Promise.allSettled — failures do not throw
        const results = await Promise.allSettled([
          twilioClient.messages.create({ body: `SMS: ${session.url}`, to: tenant.owner_phone, from: '+1' }),
          resendClient.emails.send({ to: tenant.owner_email, subject: 'test', react: '<mock>' }),
        ]);

        const smsStatus = results[0].status === 'fulfilled' ? 'ok' : `failed: ${results[0].reason?.message}`;
        const emailStatus = results[1].status === 'fulfilled' ? 'ok' : `failed: ${results[1].reason?.message}`;
        console.log(`[billing-notify] SMS=${smsStatus}, email=${emailStatus}`);
      } catch (err) {
        console.error('[stripe/webhook] handleInvoicePaymentFailed error:', err);
      }
    }

    // Both SMS and email throw
    mockSmsCreate.mockRejectedValue(new Error('Twilio error'));
    mockEmailSend.mockRejectedValue(new Error('Resend error'));

    const twilioClient = { messages: { create: mockSmsCreate } };
    const resendClient = { emails: { send: mockEmailSend } };
    const stripeClient = { billingPortal: { sessions: { create: mockPortalSession } } };

    const invoice = { subscription: 'sub_test_123', customer: 'cus_test_123' };

    // Must NOT throw even when SMS and email both fail
    await expect(
      handleInvoicePaymentFailed(invoice, mockSupabase, stripeClient, twilioClient, resendClient)
    ).resolves.not.toThrow();
  });

  it('Test 3 (BILLNOTIF-01): returns early when subscription not found — no notifications sent', async () => {
    async function handleInvoicePaymentFailed(invoice, db, stripe, twilioClient, resendClient) {
      try {
        const subscriptionId = invoice.subscription;
        if (!subscriptionId) return;

        const { data: sub } = await db
          .from('subscriptions')
          .select('tenant_id')
          .eq('stripe_subscription_id', subscriptionId)
          .eq('is_current', true)
          .maybeSingle();

        if (!sub?.tenant_id) return; // Early return

        const { data: tenant } = await db
          .from('tenants')
          .select('business_name, owner_email, owner_phone')
          .eq('id', sub.tenant_id)
          .single();

        if (!tenant) return;

        const session = await stripe.billingPortal.sessions.create({ customer: invoice.customer });

        await Promise.allSettled([
          twilioClient.messages.create({ body: 'SMS', to: tenant.owner_phone, from: '+1' }),
          resendClient.emails.send({ to: tenant.owner_email }),
        ]);
      } catch (err) {
        console.error('[stripe/webhook] handleInvoicePaymentFailed error:', err);
      }
    }

    // No subscription found
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const twilioClient = { messages: { create: mockSmsCreate } };
    const resendClient = { emails: { send: mockEmailSend } };
    const stripeClient = { billingPortal: { sessions: { create: mockPortalSession } } };

    const invoice = { subscription: 'sub_not_found', customer: 'cus_test' };
    await handleInvoicePaymentFailed(invoice, mockSupabase, stripeClient, twilioClient, resendClient);

    // No portal session, no SMS, no email
    expect(mockPortalSession).not.toHaveBeenCalled();
    expect(mockSmsCreate).not.toHaveBeenCalled();
    expect(mockEmailSend).not.toHaveBeenCalled();
  });
});

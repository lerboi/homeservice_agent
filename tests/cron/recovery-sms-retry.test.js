/**
 * Tests for Recovery SMS cron endpoint — Branch A (first-send) and Branch B (retry logic)
 * Phase 17 RECOVER-01/02/03
 */

import { jest } from '@jest/globals';

// ─── Tests ────────────────────────────────────────────────────────────────────

/**
 * Build a from() mock for the 'calls' table.
 * Branch A uses: .select().eq().is().is().lt().not().not().in().limit()
 * Branch B uses: .select().eq().lt().not().limit()
 *
 * branchAData: data returned by Branch A query (firstSendCalls)
 * branchBData: data returned by Branch B query (retryCalls)
 */
function makeCallsFrom({ branchAData = [], branchBData = [], updates = [] } = {}) {
  return jest.fn((table) => {
    if (table !== 'calls') return null; // caller handles non-calls tables

    return {
      select: () => ({
        // Branch A chain: eq -> is -> is -> lt -> not -> not -> in -> limit
        eq: () => ({
          is: () => ({
            is: () => ({
              lt: () => ({
                not: () => ({
                  not: () => ({
                    'in': () => ({
                      limit: () => Promise.resolve({ data: branchAData, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          }),
          // Branch B chain: eq -> lt -> not -> limit
          lt: () => ({
            not: () => ({
              limit: () => Promise.resolve({ data: branchBData, error: null }),
            }),
          }),
        }),
      }),
      update: (data) => {
        updates.push(data);
        return { eq: () => Promise.resolve({ data: null, error: null }) };
      },
    };
  });
}

describe('Recovery SMS cron — Branch A (first-send) and Branch B (retry)', () => {
  beforeEach(async () => {
    jest.resetModules();
  });

  test('returns 401 without CRON_SECRET', async () => {
    const sendCallerRecoverySMSMock = jest.fn().mockResolvedValue({ success: true, sid: 'SM123' });
    const callsFrom = makeCallsFrom();

    const fromMock = jest.fn((table) => {
      const callsResult = callsFrom(table);
      if (callsResult) return callsResult;
      return {
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }), single: () => Promise.resolve({ data: null, error: null }) }) }),
        update: (d) => ({ eq: () => Promise.resolve({}) }),
      };
    });

    jest.unstable_mockModule('@/lib/supabase', () => ({ supabase: { from: fromMock } }));
    jest.unstable_mockModule('@/lib/notifications', () => ({
      sendCallerRecoverySMS: sendCallerRecoverySMSMock,
    }));

    const mod = await import('../../src/app/api/cron/send-recovery-sms/route.js');
    const GET = mod.GET;

    process.env.CRON_SECRET = 'correct-secret';
    const request = { headers: { get: () => 'Bearer wrong-secret' } };

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  test('Branch A: sends urgency-aware recovery SMS for not_attempted calls', async () => {
    const now = Date.now();
    const emergencyCall = {
      id: 'call-1',
      retell_call_id: 'retell-1',
      from_number: '+15551234567',
      tenant_id: 'tenant-1',
      start_timestamp: new Date(now - 120_000).toISOString(),
      end_timestamp: new Date(now - 90_000).toISOString(), // 30s duration
      booking_outcome: 'not_attempted',
      urgency_classification: 'emergency',
      detected_language: 'es',
      retell_metadata: { caller_name: 'Maria Garcia' },
    };

    const sendCallerRecoverySMSMock = jest.fn().mockResolvedValue({ success: true, sid: 'SM_A1' });
    const updates = [];
    const callsFrom = makeCallsFrom({ branchAData: [emergencyCall], branchBData: [], updates });

    const fromMock = jest.fn((table) => {
      if (table === 'calls') return callsFrom(table);
      if (table === 'appointments') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { business_name: 'Test Plumbing', default_locale: 'en' },
                error: null,
              }),
            }),
          }),
        };
      }
      return { update: (d) => ({ eq: () => Promise.resolve({}) }) };
    });

    jest.resetModules();
    jest.unstable_mockModule('@/lib/supabase', () => ({ supabase: { from: fromMock } }));
    jest.unstable_mockModule('@/lib/notifications', () => ({
      sendCallerRecoverySMS: sendCallerRecoverySMSMock,
    }));

    const mod = await import('../../src/app/api/cron/send-recovery-sms/route.js');
    const GET = mod.GET;

    process.env.CRON_SECRET = 'test-secret';
    const request = { headers: { get: () => 'Bearer test-secret' } };

    await GET(request);

    expect(sendCallerRecoverySMSMock).toHaveBeenCalledWith(
      expect.objectContaining({
        urgency: 'emergency',
        locale: 'es',
        to: '+15551234567',
      })
    );

    const sentUpdate = updates.find((u) => u.recovery_sms_status === 'sent');
    expect(sentUpdate).toBeDefined();
  });

  test('Branch A: skips calls with duration < 15 seconds', async () => {
    const now = Date.now();
    const shortCall = {
      id: 'call-short',
      retell_call_id: 'retell-short',
      from_number: '+15551111111',
      tenant_id: 'tenant-1',
      start_timestamp: new Date(now - 80_000).toISOString(),
      end_timestamp: new Date(now - 70_000).toISOString(), // 10 seconds duration
      booking_outcome: 'not_attempted',
      urgency_classification: 'routine',
      detected_language: 'en',
      retell_metadata: {},
    };

    const sendCallerRecoverySMSMock = jest.fn().mockResolvedValue({ success: true, sid: 'SM_skip' });
    const updates = [];
    const callsFrom = makeCallsFrom({ branchAData: [shortCall], branchBData: [], updates });

    const fromMock = jest.fn((table) => {
      if (table === 'calls') return callsFrom(table);
      return { update: (d) => ({ eq: () => Promise.resolve({}) }) };
    });

    jest.resetModules();
    jest.unstable_mockModule('@/lib/supabase', () => ({ supabase: { from: fromMock } }));
    jest.unstable_mockModule('@/lib/notifications', () => ({
      sendCallerRecoverySMS: sendCallerRecoverySMSMock,
    }));

    const mod = await import('../../src/app/api/cron/send-recovery-sms/route.js');
    const GET = mod.GET;

    process.env.CRON_SECRET = 'test-secret';
    const request = { headers: { get: () => 'Bearer test-secret' } };

    await GET(request);

    expect(sendCallerRecoverySMSMock).not.toHaveBeenCalled();
  });

  test('Branch A: skips calls with existing appointments', async () => {
    const now = Date.now();
    const bookedCall = {
      id: 'call-booked',
      retell_call_id: 'retell-booked',
      from_number: '+15552222222',
      tenant_id: 'tenant-1',
      start_timestamp: new Date(now - 120_000).toISOString(),
      end_timestamp: new Date(now - 90_000).toISOString(), // 30s duration
      booking_outcome: 'not_attempted',
      urgency_classification: 'routine',
      detected_language: 'en',
      retell_metadata: {},
    };

    const sendCallerRecoverySMSMock = jest.fn().mockResolvedValue({ success: true, sid: 'SM_booked' });
    const updates = [];
    const callsFrom = makeCallsFrom({ branchAData: [bookedCall], branchBData: [], updates });

    const fromMock = jest.fn((table) => {
      if (table === 'calls') return callsFrom(table);
      if (table === 'appointments') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: 'appt-1' }, error: null }),
            }),
          }),
        };
      }
      return { update: (d) => ({ eq: () => Promise.resolve({}) }) };
    });

    jest.resetModules();
    jest.unstable_mockModule('@/lib/supabase', () => ({ supabase: { from: fromMock } }));
    jest.unstable_mockModule('@/lib/notifications', () => ({
      sendCallerRecoverySMS: sendCallerRecoverySMSMock,
    }));

    const mod = await import('../../src/app/api/cron/send-recovery-sms/route.js');
    const GET = mod.GET;

    process.env.CRON_SECRET = 'test-secret';
    const request = { headers: { get: () => 'Bearer test-secret' } };

    await GET(request);

    expect(sendCallerRecoverySMSMock).not.toHaveBeenCalled();
  });

  test('Branch B: retries failed SMS after backoff window elapsed', async () => {
    const now = Date.now();
    const retryCall = {
      id: 'call-retry',
      retell_call_id: 'retell-retry',
      from_number: '+15553333333',
      tenant_id: 'tenant-1',
      detected_language: 'en',
      urgency_classification: 'routine',
      recovery_sms_retry_count: 1,
      recovery_sms_last_attempt_at: new Date(now - 60_000).toISOString(), // 60s ago, past 30s backoff
      retell_metadata: {},
    };

    const sendCallerRecoverySMSMock = jest.fn().mockResolvedValue({ success: true, sid: 'SM_retry' });
    const updates = [];
    const callsFrom = makeCallsFrom({ branchAData: [], branchBData: [retryCall], updates });

    const fromMock = jest.fn((table) => {
      if (table === 'calls') return callsFrom(table);
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { business_name: 'Test Co', default_locale: 'en' },
                error: null,
              }),
            }),
          }),
        };
      }
      return { update: (d) => ({ eq: () => Promise.resolve({}) }) };
    });

    jest.resetModules();
    jest.unstable_mockModule('@/lib/supabase', () => ({ supabase: { from: fromMock } }));
    jest.unstable_mockModule('@/lib/notifications', () => ({
      sendCallerRecoverySMS: sendCallerRecoverySMSMock,
    }));

    const mod = await import('../../src/app/api/cron/send-recovery-sms/route.js');
    const GET = mod.GET;

    process.env.CRON_SECRET = 'test-secret';
    const request = { headers: { get: () => 'Bearer test-secret' } };

    await GET(request);

    expect(sendCallerRecoverySMSMock).toHaveBeenCalled();
  });

  test('Branch B: skips retry when backoff window not elapsed', async () => {
    const now = Date.now();
    const tooEarlyCall = {
      id: 'call-too-early',
      retell_call_id: 'retell-too-early',
      from_number: '+15554444444',
      tenant_id: 'tenant-1',
      detected_language: 'en',
      urgency_classification: 'routine',
      recovery_sms_retry_count: 1,
      recovery_sms_last_attempt_at: new Date(now - 10_000).toISOString(), // Only 10s ago — within 30s backoff
      retell_metadata: {},
    };

    const sendCallerRecoverySMSMock = jest.fn().mockResolvedValue({ success: true, sid: 'SM_skip' });
    const callsFrom = makeCallsFrom({ branchAData: [], branchBData: [tooEarlyCall] });

    const fromMock = jest.fn((table) => {
      if (table === 'calls') return callsFrom(table);
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { business_name: 'Test Co', default_locale: 'en' },
                error: null,
              }),
            }),
          }),
        };
      }
      return { update: (d) => ({ eq: () => Promise.resolve({}) }) };
    });

    jest.resetModules();
    jest.unstable_mockModule('@/lib/supabase', () => ({ supabase: { from: fromMock } }));
    jest.unstable_mockModule('@/lib/notifications', () => ({
      sendCallerRecoverySMS: sendCallerRecoverySMSMock,
    }));

    const mod = await import('../../src/app/api/cron/send-recovery-sms/route.js');
    const GET = mod.GET;

    process.env.CRON_SECRET = 'test-secret';
    const request = { headers: { get: () => 'Bearer test-secret' } };

    await GET(request);

    expect(sendCallerRecoverySMSMock).not.toHaveBeenCalled();
  });

  test('Branch B: marks status as failed after 3 total attempts (D-14)', async () => {
    const now = Date.now();
    const exhaustedCall = {
      id: 'call-exhausted',
      retell_call_id: 'retell-exhausted',
      from_number: '+15555555555',
      tenant_id: 'tenant-1',
      detected_language: 'en',
      urgency_classification: 'routine',
      recovery_sms_retry_count: 2,
      recovery_sms_last_attempt_at: new Date(now - 200_000).toISOString(), // 200s ago, past 120s backoff
      retell_metadata: {},
    };

    const sendCallerRecoverySMSMock = jest.fn().mockResolvedValue({
      success: false,
      error: { code: 21211, message: 'Invalid To phone number' },
    });

    const updates = [];
    const callsFrom = makeCallsFrom({ branchAData: [], branchBData: [exhaustedCall], updates });

    const fromMock = jest.fn((table) => {
      if (table === 'calls') return callsFrom(table);
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { business_name: 'Test Co', default_locale: 'en' },
                error: null,
              }),
            }),
          }),
        };
      }
      return { update: (d) => ({ eq: () => Promise.resolve({}) }) };
    });

    jest.resetModules();
    jest.unstable_mockModule('@/lib/supabase', () => ({ supabase: { from: fromMock } }));
    jest.unstable_mockModule('@/lib/notifications', () => ({
      sendCallerRecoverySMS: sendCallerRecoverySMSMock,
    }));

    const mod = await import('../../src/app/api/cron/send-recovery-sms/route.js');
    const GET = mod.GET;

    process.env.CRON_SECRET = 'test-secret';
    const request = { headers: { get: () => 'Bearer test-secret' } };

    await GET(request);

    // Should have been attempted (backoff elapsed)
    expect(sendCallerRecoverySMSMock).toHaveBeenCalled();

    // Should write failed status with count=3
    const failedUpdate = updates.find((u) => u.recovery_sms_status === 'failed');
    expect(failedUpdate).toBeDefined();
    expect(failedUpdate.recovery_sms_retry_count).toBe(3);
  });
});

/**
 * Tests for the owner-notification retry cron (LK-B2).
 *
 * Mirrors the stripe_meter_failures / retry-meter-events pattern: drains the
 * owner_notification_failures outbox, re-sends the stored payload (SMS via
 * Twilio, email via Resend), deletes the row on success, increments attempts
 * on failure, and Sentry-alerts once at MAX_ATTEMPTS.
 */

import { jest } from '@jest/globals';

/**
 * Build a supabase.from('owner_notification_failures') mock.
 * Select chain: .select().lt().order().limit() -> { data, error }
 * Also supports .delete().eq() and .update().eq().
 */
function makeOutboxFrom({ rows = [], deletes = [], updates = [] } = {}) {
  return jest.fn((table) => {
    if (table !== 'owner_notification_failures') return null;
    return {
      select: () => ({
        lt: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: rows, error: null }),
          }),
        }),
      }),
      delete: () => ({
        eq: (_c, id) => {
          deletes.push(id);
          return Promise.resolve({ error: null });
        },
      }),
      update: (data) => ({
        eq: (_c, id) => {
          updates.push({ id, data });
          return Promise.resolve({ error: null });
        },
      }),
    };
  });
}

async function loadRoute({ fromMock, twilioCreate, resendSend, sentryCapture }) {
  jest.resetModules();
  jest.unstable_mockModule('@/lib/supabase', () => ({ supabase: { from: fromMock } }));
  jest.unstable_mockModule('@/lib/notifications', () => ({
    getTwilioClient: () => ({ messages: { create: twilioCreate } }),
    getResendClient: () => ({ emails: { send: resendSend } }),
  }));
  jest.unstable_mockModule('@sentry/nextjs', () => ({ captureMessage: sentryCapture }));
  const mod = await import('../../src/app/api/cron/retry-owner-notifications/route.js');
  return mod.GET;
}

describe('retry-owner-notifications cron (LK-B2)', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.CRON_SECRET = 'correct-secret';
  });

  test('returns 401 with wrong CRON_SECRET', async () => {
    const GET = await loadRoute({
      fromMock: makeOutboxFrom(),
      twilioCreate: jest.fn(),
      resendSend: jest.fn(),
      sentryCapture: jest.fn(),
    });
    const res = await GET({ headers: { get: () => 'Bearer wrong' } });
    expect(res.status).toBe(401);
  });

  test('SMS row: re-sends via Twilio and deletes the row on success', async () => {
    const deletes = [];
    const rows = [{
      id: 'r-sms', tenant_id: 't1', notification_key: 'call1:sms', channel: 'sms',
      recipient: '+15550000000', payload: { from_number: '+15551112222', body: 'EMERGENCY: ...' }, attempts: 0,
    }];
    const twilioCreate = jest.fn().mockResolvedValue({ sid: 'SM1' });
    const resendSend = jest.fn();
    const GET = await loadRoute({
      fromMock: makeOutboxFrom({ rows, deletes }),
      twilioCreate, resendSend, sentryCapture: jest.fn(),
    });
    const res = await GET({ headers: { get: () => 'Bearer correct-secret' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(twilioCreate).toHaveBeenCalledWith({
      body: 'EMERGENCY: ...', from: '+15551112222', to: '+15550000000',
    });
    expect(resendSend).not.toHaveBeenCalled();
    expect(deletes).toEqual(['r-sms']);
    expect(body).toMatchObject({ ok: true, retried: 1, succeeded: 1, failed: 0 });
  });

  test('email row: re-sends via Resend and deletes the row on success', async () => {
    const deletes = [];
    const rows = [{
      id: 'r-email', tenant_id: 't1', notification_key: 'call1:email', channel: 'email',
      recipient: 'owner@a.test', payload: { subject: 'New inquiry', html: '<h2>x</h2>' }, attempts: 0,
    }];
    const resendSend = jest.fn().mockResolvedValue({ data: { id: 'em1' }, error: null });
    const twilioCreate = jest.fn();
    const GET = await loadRoute({
      fromMock: makeOutboxFrom({ rows, deletes }),
      twilioCreate, resendSend, sentryCapture: jest.fn(),
    });
    const res = await GET({ headers: { get: () => 'Bearer correct-secret' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(resendSend).toHaveBeenCalledWith(expect.objectContaining({
      to: 'owner@a.test', subject: 'New inquiry', html: '<h2>x</h2>',
    }));
    expect(deletes).toEqual(['r-email']);
    expect(body).toMatchObject({ ok: true, succeeded: 1, failed: 0 });
  });

  test('send failure: increments attempts, does NOT delete', async () => {
    const deletes = [];
    const updates = [];
    const rows = [{
      id: 'r-fail', tenant_id: 't1', notification_key: 'call1:sms', channel: 'sms',
      recipient: '+15550000000', payload: { from_number: '+1', body: 'x' }, attempts: 2,
    }];
    const twilioCreate = jest.fn().mockRejectedValue(new Error('twilio down'));
    const GET = await loadRoute({
      fromMock: makeOutboxFrom({ rows, deletes, updates }),
      twilioCreate, resendSend: jest.fn(), sentryCapture: jest.fn(),
    });
    const res = await GET({ headers: { get: () => 'Bearer correct-secret' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(deletes).toEqual([]); // never deleted on failure
    expect(updates).toHaveLength(1);
    expect(updates[0].data.attempts).toBe(3);
    expect(updates[0].data.failure_reason).toContain('twilio down');
    expect(body).toMatchObject({ retried: 1, succeeded: 0, failed: 1 });
  });

  test('Sentry alert fires exactly when attempts crosses MAX_ATTEMPTS (10)', async () => {
    const rows = [{
      id: 'r-exhaust', tenant_id: 't1', notification_key: 'call1:email', channel: 'email',
      recipient: 'o@a.test', payload: { subject: 's', html: 'h' }, attempts: 9,
    }];
    const sentryCapture = jest.fn();
    const resendSend = jest.fn().mockRejectedValue(new Error('resend down'));
    const GET = await loadRoute({
      fromMock: makeOutboxFrom({ rows }),
      twilioCreate: jest.fn(), resendSend, sentryCapture,
    });
    await GET({ headers: { get: () => 'Bearer correct-secret' } });
    expect(sentryCapture).toHaveBeenCalledTimes(1);
    expect(sentryCapture.mock.calls[0][1]).toBe('error');
  });

  test('Resend {error} response is treated as a failure (not deleted)', async () => {
    const deletes = [];
    const updates = [];
    const rows = [{
      id: 'r-resend-err', tenant_id: 't1', notification_key: 'call1:email', channel: 'email',
      recipient: 'o@a.test', payload: { subject: 's', html: 'h' }, attempts: 0,
    }];
    const resendSend = jest.fn().mockResolvedValue({ data: null, error: { message: 'bad recipient' } });
    const GET = await loadRoute({
      fromMock: makeOutboxFrom({ rows, deletes, updates }),
      twilioCreate: jest.fn(), resendSend, sentryCapture: jest.fn(),
    });
    const res = await GET({ headers: { get: () => 'Bearer correct-secret' } });
    const body = await res.json();
    expect(deletes).toEqual([]);
    expect(updates[0].data.failure_reason).toContain('bad recipient');
    expect(body).toMatchObject({ failed: 1, succeeded: 0 });
  });
});

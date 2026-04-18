/**
 * Phase 57 Plan 05 — notifyBookingCopyToJobber email helper.
 * Mirrors tests/notifications/jobber-refresh-email.test.js mock pattern.
 *
 * Gates on BOTH jobber-connected AND appointment.jobber_visit_id IS NULL,
 * never throws, and rendered email body contains the locked UI-SPEC §Copywriting copy.
 */

import { jest } from '@jest/globals';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
process.env.RESEND_API_KEY = 'rs_test';

const mockSend = jest.fn().mockResolvedValue({ id: 'email_jobber_booking_1' });

// Per-table mock returns: tests override these by name.
const mockCredMaybeSingle = jest.fn();
const mockApptMaybeSingle = jest.fn();
const mockTenantMaybeSingle = jest.fn();

function makeFrom(table) {
  if (table === 'accounting_credentials') {
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: () => mockCredMaybeSingle() }),
        }),
      }),
    };
  }
  if (table === 'appointments') {
    return {
      select: () => ({
        eq: () => ({ maybeSingle: () => mockApptMaybeSingle() }),
      }),
    };
  }
  if (table === 'tenants') {
    return {
      select: () => ({
        eq: () => ({ maybeSingle: () => mockTenantMaybeSingle() }),
      }),
    };
  }
  return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) };
}

jest.unstable_mockModule('twilio', () => ({
  default: jest.fn(() => ({ messages: { create: jest.fn() } })),
}));

jest.unstable_mockModule('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: makeFrom })),
}));

jest.unstable_mockModule('@/emails/NewLeadEmail', () => ({ NewLeadEmail: jest.fn() }));
jest.unstable_mockModule('@/emails/XeroReconnectEmail', () => ({ XeroReconnectEmail: jest.fn() }));
jest.unstable_mockModule('@/emails/JobberReconnectEmail', () => ({
  JobberReconnectEmail: jest.fn(),
  default: jest.fn(),
}));

const mockBookingCopyEmail = jest.fn((props) => ({ __mock: 'BookingCopyToJobberEmail', props }));
jest.unstable_mockModule('@/emails/BookingCopyToJobberEmail', () => ({
  BookingCopyToJobberEmail: mockBookingCopyEmail,
  default: mockBookingCopyEmail,
}));

jest.unstable_mockModule('next/cache', () => ({ revalidateTag: jest.fn() }));

let notifyBookingCopyToJobber;
beforeAll(async () => {
  ({ notifyBookingCopyToJobber } = await import('@/lib/notifications'));
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCredMaybeSingle.mockResolvedValue({ data: null });
  mockApptMaybeSingle.mockResolvedValue({ data: null });
  mockTenantMaybeSingle.mockResolvedValue({ data: null });
});

const APPT_OK = {
  id: 'appt-1',
  start_time: '2026-05-01T14:00:00.000Z',
  end_time: '2026-05-01T15:00:00.000Z',
  service_address: '123 Main St',
  caller_name: 'Jane Doe',
  caller_phone: '+15558675309',
  notes: 'Backflow',
  jobber_visit_id: null,
};

describe('notifyBookingCopyToJobber', () => {
  test('1. no Jobber cred → no email sent, returns reason jobber_not_connected', async () => {
    mockCredMaybeSingle.mockResolvedValue({ data: null });
    const r = await notifyBookingCopyToJobber({ tenantId: 't1', appointmentId: 'a1' });
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('jobber_not_connected');
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('2. Jobber cred + appointment with jobber_visit_id=null → email sent with locked subject', async () => {
    mockCredMaybeSingle.mockResolvedValue({ data: { id: 'cred-1' } });
    mockApptMaybeSingle.mockResolvedValue({ data: APPT_OK });
    mockTenantMaybeSingle.mockResolvedValue({ data: { email: 'owner@biz.com' } });
    const r = await notifyBookingCopyToJobber({ tenantId: 't1', appointmentId: 'appt-1' });
    expect(r.sent).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].subject).toBe("Don't forget to add this to Jobber");
  });

  test('3. Jobber cred + appointment.jobber_visit_id set → no email sent (already pushed)', async () => {
    mockCredMaybeSingle.mockResolvedValue({ data: { id: 'cred-1' } });
    mockApptMaybeSingle.mockResolvedValue({ data: { ...APPT_OK, jobber_visit_id: 'jv-9' } });
    mockTenantMaybeSingle.mockResolvedValue({ data: { email: 'owner@biz.com' } });
    const r = await notifyBookingCopyToJobber({ tenantId: 't1', appointmentId: 'appt-1' });
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('already_pushed');
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('4. recipient = tenant business_email > email > personal_email fallback', async () => {
    mockCredMaybeSingle.mockResolvedValue({ data: { id: 'cred-1' } });
    mockApptMaybeSingle.mockResolvedValue({ data: APPT_OK });
    mockTenantMaybeSingle.mockResolvedValue({
      data: { email: 'fallback@x', business_email: 'biz@x', personal_email: 'me@x' },
    });
    await notifyBookingCopyToJobber({ tenantId: 't1', appointmentId: 'appt-1' });
    expect(mockSend.mock.calls[0][0].to).toBe('biz@x');
  });

  test('5. from header uses Voco brand and noreply@voco.live', async () => {
    mockCredMaybeSingle.mockResolvedValue({ data: { id: 'cred-1' } });
    mockApptMaybeSingle.mockResolvedValue({ data: APPT_OK });
    mockTenantMaybeSingle.mockResolvedValue({ data: { email: 'owner@biz.com' } });
    await notifyBookingCopyToJobber({ tenantId: 't1', appointmentId: 'appt-1' });
    expect(mockSend.mock.calls[0][0].from).toMatch(/Voco <noreply@voco\.live>/);
  });

  test('6. paste block passed to email contains all 6 labelled lines', async () => {
    mockCredMaybeSingle.mockResolvedValue({ data: { id: 'cred-1' } });
    mockApptMaybeSingle.mockResolvedValue({ data: APPT_OK });
    mockTenantMaybeSingle.mockResolvedValue({ data: { email: 'owner@biz.com' } });
    await notifyBookingCopyToJobber({ tenantId: 't1', appointmentId: 'appt-1' });
    const props = mockBookingCopyEmail.mock.calls[0][0];
    expect(props.pasteBlock).toMatch(/Client: Jane Doe/);
    expect(props.pasteBlock).toMatch(/Phone: \+15558675309/);
    expect(props.pasteBlock).toMatch(/Address: 123 Main St/);
    expect(props.pasteBlock).toMatch(/Start: /);
    expect(props.pasteBlock).toMatch(/Duration: 60 min/);
    expect(props.pasteBlock).toMatch(/Notes: Backflow/);
  });

  test('7. tenant has no resolvable email → no email sent', async () => {
    mockCredMaybeSingle.mockResolvedValue({ data: { id: 'cred-1' } });
    mockApptMaybeSingle.mockResolvedValue({ data: APPT_OK });
    mockTenantMaybeSingle.mockResolvedValue({ data: { email: null, personal_email: null } });
    const r = await notifyBookingCopyToJobber({ tenantId: 't1', appointmentId: 'appt-1' });
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('no_owner_email');
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('8. send error → returns reason send_failed (does not throw)', async () => {
    mockCredMaybeSingle.mockResolvedValue({ data: { id: 'cred-1' } });
    mockApptMaybeSingle.mockResolvedValue({ data: APPT_OK });
    mockTenantMaybeSingle.mockResolvedValue({ data: { email: 'owner@biz.com' } });
    mockSend.mockRejectedValueOnce(new Error('resend down'));
    const r = await notifyBookingCopyToJobber({ tenantId: 't1', appointmentId: 'appt-1' });
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('send_failed');
  });

  test('9. missing args → returns missing_args without DB hits', async () => {
    const r = await notifyBookingCopyToJobber({ tenantId: null, appointmentId: 'a1' });
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('missing_args');
    expect(mockCredMaybeSingle).not.toHaveBeenCalled();
  });
});

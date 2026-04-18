import { describe, test, expect, jest } from '@jest/globals';
import {
  jobberVisitToCalendarEvent,
  applyJobberVisit,
} from '@/lib/scheduling/jobber-schedule-mirror.js';

const TENANT = '00000000-0000-0000-0000-000000000001';

function makeVisit(overrides = {}) {
  return {
    id: 'visit-1',
    startAt: '2026-05-01T14:00:00.000Z',
    endAt: '2026-05-01T15:00:00.000Z',
    visitStatus: 'SCHEDULED',
    assignedUsers: { nodes: [{ id: 'u1', name: { full: 'John Smith' } }] },
    job: { client: { name: { full: 'Jane Doe' } } },
    ...overrides,
  };
}

describe('jobberVisitToCalendarEvent — pure mapper', () => {
  test('1. returns null when startAt is missing', () => {
    expect(jobberVisitToCalendarEvent({
      tenantId: TENANT,
      visit: makeVisit({ startAt: null }),
      bookableUserIds: null,
      clientName: 'Jane Doe',
    })).toBeNull();
  });

  test('2. returns null when endAt is missing', () => {
    expect(jobberVisitToCalendarEvent({
      tenantId: TENANT,
      visit: makeVisit({ endAt: null }),
      bookableUserIds: null,
      clientName: 'Jane Doe',
    })).toBeNull();
  });

  test('3. returns null for COMPLETED or CANCELLED status', () => {
    expect(jobberVisitToCalendarEvent({
      tenantId: TENANT,
      visit: makeVisit({ visitStatus: 'COMPLETED' }),
      bookableUserIds: null,
      clientName: 'Jane Doe',
    })).toBeNull();
    expect(jobberVisitToCalendarEvent({
      tenantId: TENANT,
      visit: makeVisit({ visitStatus: 'CANCELLED' }),
      bookableUserIds: null,
      clientName: 'Jane Doe',
    })).toBeNull();
  });

  test('4. returns row for SCHEDULED with all fields; title prefixed "Jobber: "', () => {
    const row = jobberVisitToCalendarEvent({
      tenantId: TENANT,
      visit: makeVisit(),
      bookableUserIds: null,
      clientName: 'Jane Doe',
    });
    expect(row).toMatchObject({
      tenant_id: TENANT,
      provider: 'jobber',
      external_id: 'visit-1',
      start_time: '2026-05-01T14:00:00.000Z',
      end_time: '2026-05-01T15:00:00.000Z',
      is_all_day: false,
      appointment_id: null,
      conflict_dismissed: false,
    });
    expect(row.title).toMatch(/^Jobber: /);
  });

  test('5. returns row for IN_PROGRESS', () => {
    const row = jobberVisitToCalendarEvent({
      tenantId: TENANT,
      visit: makeVisit({ visitStatus: 'IN_PROGRESS' }),
      bookableUserIds: null,
      clientName: 'Jane Doe',
    });
    expect(row).not.toBeNull();
    expect(row.provider).toBe('jobber');
  });

  test('6. bookable filter: assignee u1, set ["u2"] → null', () => {
    expect(jobberVisitToCalendarEvent({
      tenantId: TENANT,
      visit: makeVisit(),
      bookableUserIds: ['u2'],
      clientName: 'Jane Doe',
    })).toBeNull();
  });

  test('7. bookable filter: assignee u1, set ["u1","u2"] → row', () => {
    const row = jobberVisitToCalendarEvent({
      tenantId: TENANT,
      visit: makeVisit(),
      bookableUserIds: ['u1', 'u2'],
      clientName: 'Jane Doe',
    });
    expect(row).not.toBeNull();
  });

  test('8. unassigned visit ALWAYS passes (D-05) even with non-empty bookable set', () => {
    const row = jobberVisitToCalendarEvent({
      tenantId: TENANT,
      visit: makeVisit({ assignedUsers: { nodes: [] } }),
      bookableUserIds: ['u1'],
      clientName: 'Jane Doe',
    });
    expect(row).not.toBeNull();
    expect(row.title).toContain('Unassigned');
  });

  test('9. bookableUserIds=null → always mirrors regardless of assignee', () => {
    const row = jobberVisitToCalendarEvent({
      tenantId: TENANT,
      visit: makeVisit(),
      bookableUserIds: null,
      clientName: 'Jane Doe',
    });
    expect(row).not.toBeNull();
  });

  test('10. bookableUserIds=[] (explicit empty): unassigned passes, assigned does NOT', () => {
    expect(jobberVisitToCalendarEvent({
      tenantId: TENANT,
      visit: makeVisit({ assignedUsers: { nodes: [] } }),
      bookableUserIds: [],
      clientName: 'Jane Doe',
    })).not.toBeNull();
    expect(jobberVisitToCalendarEvent({
      tenantId: TENANT,
      visit: makeVisit(),
      bookableUserIds: [],
      clientName: 'Jane Doe',
    })).toBeNull();
  });

  test('11. title format: "Jobber: <client> — <first assignee>"', () => {
    const row = jobberVisitToCalendarEvent({
      tenantId: TENANT,
      visit: makeVisit(),
      bookableUserIds: null,
      clientName: 'Jane Doe',
    });
    expect(row.title).toBe('Jobber: Jane Doe — John Smith');
  });

  test('12. title falls back to "Unassigned" when no assignees', () => {
    const row = jobberVisitToCalendarEvent({
      tenantId: TENANT,
      visit: makeVisit({ assignedUsers: { nodes: [] } }),
      bookableUserIds: null,
      clientName: 'Jane Doe',
    });
    expect(row.title).toBe('Jobber: Jane Doe — Unassigned');
  });
});

describe('applyJobberVisit — upsert/delete helper', () => {
  function makeAdmin({ upsertError = null } = {}) {
    const upsert = jest.fn().mockResolvedValue({ error: upsertError });
    const eq3 = jest.fn().mockResolvedValue({ error: null });
    const eq2 = jest.fn().mockReturnValue({ eq: eq3 });
    const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
    const del = jest.fn().mockReturnValue({ eq: eq1 });
    const from = jest.fn().mockReturnValue({ upsert, delete: del });
    return { client: { from }, upsert, del, eq1, eq2, eq3, from };
  }

  test('13. valid visit → calls upsert with onConflict and returns {action:"upserted"}', async () => {
    const a = makeAdmin();
    const res = await applyJobberVisit({
      admin: a.client,
      tenantId: TENANT,
      visit: makeVisit(),
      bookableUserIds: null,
      clientName: 'Jane Doe',
    });
    expect(res).toEqual({ action: 'upserted' });
    expect(a.from).toHaveBeenCalledWith('calendar_events');
    expect(a.upsert).toHaveBeenCalledTimes(1);
    expect(a.upsert.mock.calls[0][1]).toEqual({ onConflict: 'tenant_id,provider,external_id' });
  });

  test('14. mapper-null visit → calls delete with matching filters and returns {action:"deleted"}', async () => {
    const a = makeAdmin();
    const res = await applyJobberVisit({
      admin: a.client,
      tenantId: TENANT,
      visit: makeVisit({ visitStatus: 'CANCELLED' }),
      bookableUserIds: null,
      clientName: 'Jane Doe',
    });
    expect(res).toEqual({ action: 'deleted' });
    expect(a.del).toHaveBeenCalledTimes(1);
    expect(a.eq1).toHaveBeenCalledWith('tenant_id', TENANT);
    expect(a.eq2).toHaveBeenCalledWith('provider', 'jobber');
    expect(a.eq3).toHaveBeenCalledWith('external_id', 'visit-1');
  });
});

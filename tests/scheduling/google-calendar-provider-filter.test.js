import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// --- Mock googleapis ---
const mockEventsWatch = jest.fn();
const mockEventsList = jest.fn();
const mockEventsInsert = jest.fn();
const mockChannelsStop = jest.fn();
const mockSetCredentials = jest.fn();
const mockRevokeToken = jest.fn();

jest.unstable_mockModule('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: jest.fn(),
        getToken: jest.fn(),
        revokeToken: mockRevokeToken,
        setCredentials: mockSetCredentials,
      })),
    },
    calendar: jest.fn().mockReturnValue({
      events: {
        watch: mockEventsWatch,
        list: mockEventsList,
        insert: mockEventsInsert,
      },
      channels: {
        stop: mockChannelsStop,
      },
      calendarList: {
        get: jest.fn(),
      },
    }),
  },
}));

// --- Mock supabase with call tracking ---
const supabaseCalls = [];

function createTrackedChain(tableName) {
  const chain = {};
  const methods = ['select', 'eq', 'single', 'upsert', 'update', 'delete', 'lt'];

  for (const method of methods) {
    chain[method] = jest.fn((...args) => {
      supabaseCalls.push({ table: tableName, method, args });
      if (method === 'single') {
        return Promise.resolve({ data: null, error: { message: 'not found' } });
      }
      return chain;
    });
  }

  return chain;
}

let mockFromImpl;

jest.unstable_mockModule('@/lib/supabase.js', () => ({
  supabase: {
    from: jest.fn((...args) => {
      if (mockFromImpl) return mockFromImpl(...args);
      return createTrackedChain(args[0]);
    }),
  },
}));

// Dynamic imports after mocks
const { syncCalendarEvents, pushBookingToCalendar, revokeAndDisconnect } =
  await import('@/lib/scheduling/google-calendar.js');

const { supabase } = await import('@/lib/supabase.js');

beforeEach(() => {
  jest.clearAllMocks();
  supabaseCalls.length = 0;
  mockFromImpl = null;
});

describe('Google Calendar provider filter (D-08)', () => {
  describe('syncCalendarEvents', () => {
    test('queries calendar_credentials with .eq("provider", "google")', async () => {
      const credChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            access_token: 'acc',
            refresh_token: 'ref',
            expiry_date: 9999999999999,
            calendar_id: 'primary',
            last_sync_token: 'tok',
          },
          error: null,
        }),
      };

      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      let callCount = 0;
      mockFromImpl = (table) => {
        if (table === 'calendar_credentials') {
          callCount++;
          if (callCount === 1) return credChain;
          return updateChain;
        }
        if (table === 'calendar_events') {
          return { upsert: jest.fn().mockResolvedValue({ error: null }) };
        }
        return createTrackedChain(table);
      };

      mockEventsList.mockResolvedValue({
        data: { items: [], nextSyncToken: 'new' },
      });

      await syncCalendarEvents('tenant-1');

      // Verify the credentials query includes provider filter
      expect(credChain.eq).toHaveBeenCalledWith('provider', 'google');
      expect(credChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    });
  });

  describe('revokeAndDisconnect', () => {
    test('queries credentials with .eq("provider", "google")', async () => {
      const credChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null }),
      };

      const deleteChain = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      let credCallCount = 0;
      mockFromImpl = (table) => {
        if (table === 'calendar_credentials') {
          credCallCount++;
          if (credCallCount === 1) return credChain;
          return deleteChain;
        }
        if (table === 'calendar_events') return deleteChain;
        return createTrackedChain(table);
      };

      await revokeAndDisconnect('tenant-2');

      // Verify both tenant_id and provider filter on credentials query
      expect(credChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-2');
      expect(credChain.eq).toHaveBeenCalledWith('provider', 'google');
    });

    test('deletes only Google calendar events (not Outlook events)', async () => {
      const credChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            access_token: 'acc',
            refresh_token: 'ref',
            watch_channel_id: null,
          },
        }),
      };

      const credDeleteChain = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      const eventsDeleteChain = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      let credCallCount = 0;
      mockFromImpl = (table) => {
        if (table === 'calendar_credentials') {
          credCallCount++;
          if (credCallCount === 1) return credChain;
          return credDeleteChain;
        }
        if (table === 'calendar_events') return eventsDeleteChain;
        return createTrackedChain(table);
      };

      mockRevokeToken.mockResolvedValue();

      await revokeAndDisconnect('tenant-3');

      // Verify credentials delete includes provider filter
      expect(credDeleteChain.eq).toHaveBeenCalledWith('provider', 'google');

      // Verify events delete includes provider filter
      expect(eventsDeleteChain.eq).toHaveBeenCalledWith('provider', 'google');
    });
  });

  describe('pushBookingToCalendar', () => {
    test('queries credentials with .eq("is_primary", true)', async () => {
      const apptChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'appt-1',
            tenant_id: 'tenant-4',
            start_time: '2026-03-23T14:00:00Z',
            end_time: '2026-03-23T15:00:00Z',
            service_address: '123 Main St',
            caller_name: 'Jane',
            urgency: 'routine',
          },
          error: null,
        }),
      };

      const credChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      };

      mockFromImpl = (table) => {
        if (table === 'appointments') return apptChain;
        if (table === 'calendar_credentials') return credChain;
        return createTrackedChain(table);
      };

      await pushBookingToCalendar('tenant-4', 'appt-1');

      // Verify is_primary filter (D-02)
      expect(credChain.eq).toHaveBeenCalledWith('is_primary', true);
    });

    test('updates appointment with external_event_id (not google_event_id)', async () => {
      const apptSelectChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'appt-2',
            tenant_id: 'tenant-5',
            start_time: '2026-03-23T14:00:00Z',
            end_time: '2026-03-23T15:00:00Z',
            service_address: '456 Oak Ave',
            caller_name: 'John',
            urgency: 'routine',
          },
          error: null,
        }),
      };

      const credChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            access_token: 'acc',
            refresh_token: 'ref',
            expiry_date: 9999999999999,
            provider: 'google',
          },
          error: null,
        }),
      };

      const apptUpdateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      let apptCallCount = 0;
      mockFromImpl = (table) => {
        if (table === 'appointments') {
          apptCallCount++;
          if (apptCallCount === 1) return apptSelectChain;
          return apptUpdateChain;
        }
        if (table === 'calendar_credentials') return credChain;
        return createTrackedChain(table);
      };

      mockEventsInsert.mockResolvedValue({
        data: { id: 'google-evt-123' },
      });

      await pushBookingToCalendar('tenant-5', 'appt-2');

      // Verify update uses external_event_id, not google_event_id
      expect(apptUpdateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          external_event_id: 'google-evt-123',
          external_event_provider: 'google',
        })
      );
    });
  });
});

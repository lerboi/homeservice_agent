import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// --- Mock @azure/msal-node ---
// Only getAuthCodeUrl goes through MSAL — the code exchange POSTs to the
// token endpoint directly because AuthenticationResult never exposes the
// refresh token (the old acquireTokenByCode path silently dropped it).
const mockGetAuthCodeUrl = jest.fn();

jest.unstable_mockModule('@azure/msal-node', () => ({
  ConfidentialClientApplication: jest.fn().mockImplementation(() => ({
    getAuthCodeUrl: mockGetAuthCodeUrl,
  })),
}));

// --- Mock the Google auth route (verifyOAuthState) used by the Outlook callback ---
const mockVerifyOAuthState = jest.fn();

jest.unstable_mockModule('@/app/api/google-calendar/auth/route.js', () => ({
  verifyOAuthState: mockVerifyOAuthState,
}));

// --- Mock supabase ---
function createChain(finalResult = { data: null, error: null }) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(finalResult),
    upsert: jest.fn().mockResolvedValue({ error: null }),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
  };
  return chain;
}

let mockFromImpl;

jest.unstable_mockModule('@/lib/supabase.js', () => ({
  supabase: {
    from: jest.fn((...args) => {
      if (mockFromImpl) return mockFromImpl(...args);
      return createChain();
    }),
  },
}));

// --- Mock global fetch ---
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Dynamic imports after mocks
const {
  getOutlookAuthUrl,
  exchangeCodeForTokens,
  refreshOutlookAccessToken,
  createOutlookCalendarEvent,
  createOutlookSubscription,
  syncOutlookCalendarEvents,
  revokeAndDisconnectOutlook,
} = await import('@/lib/scheduling/outlook-calendar.js');

const { GET: outlookCallbackGET } = await import('@/app/api/outlook-calendar/callback/route.js');

beforeEach(() => {
  jest.clearAllMocks();
  mockFromImpl = null;
  process.env.MICROSOFT_CLIENT_ID = 'test-client-id';
  process.env.MICROSOFT_CLIENT_SECRET = 'test-client-secret';
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  process.env.OUTLOOK_WEBHOOK_SECRET = 'test-webhook-secret';
});

describe('Outlook Calendar Module', () => {
  describe('getOutlookAuthUrl', () => {
    test('returns a URL starting with https://login.microsoftonline.com', async () => {
      mockGetAuthCodeUrl.mockResolvedValue(
        'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=test'
      );

      const url = await getOutlookAuthUrl('tenant-1');

      expect(url).toMatch(/^https:\/\/login\.microsoftonline\.com/);
      expect(mockGetAuthCodeUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          scopes: expect.arrayContaining(['https://graph.microsoft.com/Calendars.ReadWrite']),
          redirectUri: 'https://example.com/api/outlook-calendar/callback',
          state: 'tenant-1',
        })
      );
    });
  });

  describe('exchangeCodeForTokens', () => {
    test('POSTs the authorization code to the token endpoint and returns raw token fields', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'access-tok',
          refresh_token: 'refresh-tok',
          expires_in: 3600,
        }),
      });

      const result = await exchangeCodeForTokens('auth-code-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        expect.objectContaining({ method: 'POST' })
      );
      const body = mockFetch.mock.calls[0][1].body;
      expect(body).toContain('grant_type=authorization_code');
      expect(body).toContain('code=auth-code-123');
      expect(body).toContain(
        `redirect_uri=${encodeURIComponent('https://example.com/api/outlook-calendar/callback')}`
      );
      // The real token endpoint returns snake_case — refresh_token MUST be present
      expect(result).toEqual({
        access_token: 'access-tok',
        refresh_token: 'refresh-tok',
        expires_in: 3600,
      });
    });

    test('throws a formatted error when the token endpoint rejects the code', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({
          error: 'invalid_grant',
          error_description: 'AADSTS70008: The provided authorization code has expired.',
        }),
      });

      await expect(exchangeCodeForTokens('stale-code')).rejects.toThrow(
        'Token exchange failed: AADSTS70008: The provided authorization code has expired.'
      );
    });
  });

  describe('refreshOutlookAccessToken', () => {
    test('POSTs to /common/oauth2/v2.0/token with refresh_token grant', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 3600,
        }),
      });

      const result = await refreshOutlookAccessToken('old-refresh-token');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result).toHaveProperty('access_token', 'new-access');
      expect(result).toHaveProperty('refresh_token', 'new-refresh');
    });
  });

  describe('createOutlookCalendarEvent', () => {
    test('calls graphFetch with POST /me/events and returns event id', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'outlook-evt-123' }),
      });

      const creds = {
        access_token: 'valid-token',
        refresh_token: 'ref',
        expiry_date: Date.now() + 3600000,
      };
      const appointment = {
        id: 'appt-1',
        tenant_id: 'tenant-1',
        start_time: '2026-03-25T10:00:00Z',
        end_time: '2026-03-25T11:00:00Z',
        service_address: '789 Elm St',
        caller_name: 'Bob',
        urgency: 'routine',
        job_type: 'Plumbing',
        timezone: 'UTC',
      };

      const eventId = await createOutlookCalendarEvent({ credentials: creds, appointment });

      expect(eventId).toBe('outlook-evt-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me/events',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('createOutlookSubscription', () => {
    test('calls graphFetch with POST /subscriptions and updates calendar_credentials', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'sub-456', expirationDateTime: '2026-03-31T10:00:00Z' }),
      });

      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      mockFromImpl = (table) => {
        if (table === 'calendar_credentials') return updateChain;
        return createChain();
      };

      await createOutlookSubscription('tenant-1', 'valid-token');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/subscriptions',
        expect.objectContaining({ method: 'POST' })
      );

      // Verify the body includes OUTLOOK_WEBHOOK_SECRET
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.clientState).toBe('test-webhook-secret');

      // Verify DB update
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          watch_channel_id: 'sub-456',
        })
      );
      expect(updateChain.eq).toHaveBeenCalledWith('provider', 'outlook');
    });
  });

  describe('syncOutlookCalendarEvents', () => {
    test('uses deltaLink for incremental sync when stored', async () => {
      const credChain = createChain({
        data: {
          access_token: 'acc',
          refresh_token: 'ref',
          expiry_date: Date.now() + 3600000,
          last_sync_token: 'https://graph.microsoft.com/v1.0/me/calendarView/delta?$deltatoken=abc123',
        },
        error: null,
      });

      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      const eventsChain = {
        upsert: jest.fn().mockResolvedValue({ error: null }),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      let credCallCount = 0;
      mockFromImpl = (table) => {
        if (table === 'calendar_credentials') {
          credCallCount++;
          if (credCallCount === 1) return credChain;
          return updateChain;
        }
        if (table === 'calendar_events') return eventsChain;
        return createChain();
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          value: [
            { id: 'evt-1', subject: 'Meeting', start: { dateTime: '2026-03-25T10:00:00' }, end: { dateTime: '2026-03-25T11:00:00' } },
          ],
          '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/calendarView/delta?$deltatoken=new456',
        }),
      });

      await syncOutlookCalendarEvents('tenant-1');

      // Should use stored deltaLink URL
      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me/calendarView/delta?$deltatoken=abc123',
        expect.anything()
      );

      // Verify credentials query uses provider filter
      expect(credChain.eq).toHaveBeenCalledWith('provider', 'outlook');
    });

    test('uses /me/calendarView/delta with date range when no stored deltaLink', async () => {
      const credChain = createChain({
        data: {
          access_token: 'acc',
          refresh_token: 'ref',
          expiry_date: Date.now() + 3600000,
          last_sync_token: null,
        },
        error: null,
      });

      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      const eventsChain = {
        upsert: jest.fn().mockResolvedValue({ error: null }),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      let credCallCount = 0;
      mockFromImpl = (table) => {
        if (table === 'calendar_credentials') {
          credCallCount++;
          if (credCallCount === 1) return credChain;
          return updateChain;
        }
        if (table === 'calendar_events') return eventsChain;
        return createChain();
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          value: [],
          '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/calendarView/delta?$deltatoken=initial',
        }),
      });

      await syncOutlookCalendarEvents('tenant-1');

      // Should use calendarView/delta with date parameters
      const fetchUrl = mockFetch.mock.calls[0][0];
      expect(fetchUrl).toContain('/me/calendarView/delta');
      expect(fetchUrl).toContain('startDateTime=');
      expect(fetchUrl).toContain('endDateTime=');
    });
  });

  describe('revokeAndDisconnectOutlook', () => {
    test('deletes subscription, credentials row, and mirrored events', async () => {
      const credChain = createChain({
        data: {
          access_token: 'acc',
          refresh_token: 'ref',
          expiry_date: Date.now() + 3600000,
          watch_channel_id: 'sub-789',
        },
        error: null,
      });

      const credDeleteChain = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      const eventsDeleteChain = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      // DELETE subscription returns 204
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
      });

      let credCallCount = 0;
      mockFromImpl = (table) => {
        if (table === 'calendar_credentials') {
          credCallCount++;
          if (credCallCount === 1) return credChain;
          return credDeleteChain;
        }
        if (table === 'calendar_events') return eventsDeleteChain;
        return createChain();
      };

      await revokeAndDisconnectOutlook('tenant-1');

      // Verify subscription DELETE call
      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/subscriptions/sub-789',
        expect.objectContaining({ method: 'DELETE' })
      );

      // Verify credentials query with provider filter
      expect(credChain.eq).toHaveBeenCalledWith('provider', 'outlook');

      // Verify credentials delete with provider filter
      expect(credDeleteChain.eq).toHaveBeenCalledWith('provider', 'outlook');

      // Verify events delete with provider filter
      expect(eventsDeleteChain.eq).toHaveBeenCalledWith('provider', 'outlook');
    });
  });
});

describe('Outlook OAuth callback route', () => {
  // Chain where every builder method returns itself and awaiting it (or
  // calling .single()) resolves the configured result — covers the count
  // query, upsert, update, and select().single() shapes in one helper.
  function flexChain(result = { data: null, error: null, count: 0 }) {
    const chain = {
      select: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      update: jest.fn(() => chain),
      upsert: jest.fn(() => chain),
      delete: jest.fn(() => chain),
      in: jest.fn(() => chain),
      single: jest.fn(() => Promise.resolve(result)),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return chain;
  }

  test('persists refresh_token and a real expiry_date from the token endpoint response', async () => {
    mockVerifyOAuthState.mockReturnValue('tenant-1');

    // Route fetch traffic in call order: token exchange → /me profile →
    // subscription create → initial delta sync.
    mockFetch.mockImplementation((url) => {
      if (url.includes('/oauth2/v2.0/token')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'access-tok',
            refresh_token: 'refresh-tok',
            expires_in: 3600,
          }),
        });
      }
      if (url === 'https://graph.microsoft.com/v1.0/me') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ mail: 'owner@example.com' }),
        });
      }
      if (url.includes('/subscriptions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'sub-1' }),
        });
      }
      if (url.includes('/calendarView/delta')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            value: [],
            '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/calendarView/delta?$deltatoken=init',
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });

    // calendar_credentials access order in the callback flow:
    // 1. is_primary count query  2. credentials upsert
    // 3. subscription update     4. sync creds select  5. sync token update
    const credChains = [];
    mockFromImpl = (table) => {
      if (table === 'calendar_credentials') {
        const idx = credChains.length;
        let chain;
        if (idx === 0) {
          chain = flexChain({ count: 0, data: null, error: null });
        } else if (idx === 3) {
          chain = flexChain({
            data: {
              tenant_id: 'tenant-1',
              access_token: 'access-tok',
              refresh_token: 'refresh-tok',
              expiry_date: Date.now() + 3600000,
              last_sync_token: null,
            },
            error: null,
          });
        } else {
          chain = flexChain({ data: null, error: null });
        }
        credChains.push(chain);
        return chain;
      }
      return flexChain({ data: [], error: null });
    };

    const before = Date.now();
    const res = await outlookCallbackGET({
      url: 'https://example.com/api/outlook-calendar/callback?code=auth-code-123&state=signed-state',
    });
    const after = Date.now();

    // The credential upsert must persist the real refresh token and a
    // numeric expiry derived from expires_in (the msal path produced
    // refresh_token: undefined and expiry_date: NaN).
    const upsertChain = credChains[1];
    expect(upsertChain.upsert).toHaveBeenCalledTimes(1);
    const payload = upsertChain.upsert.mock.calls[0][0];
    expect(payload.refresh_token).toBe('refresh-tok');
    expect(payload.access_token).toBe('access-tok');
    expect(payload.is_primary).toBe(true);
    expect(Number.isFinite(payload.expiry_date)).toBe(true);
    expect(payload.expiry_date).toBeGreaterThanOrEqual(before + 3600 * 1000);
    expect(payload.expiry_date).toBeLessThanOrEqual(after + 3600 * 1000);

    // Success redirect — no error=true
    expect(res.headers.get('location')).toBe(
      'https://example.com/auth/calendar-connected?provider=outlook'
    );
  });
});

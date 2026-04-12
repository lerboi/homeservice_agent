/**
 * Tests for the call-routing API (GET + PUT).
 * Wave 0 stubs — defines the validation contract before implementation.
 * Covers: dial_timeout range, E.164 validation, duplicate numbers, max 5 entries,
 * self-reference guard, zero pickup numbers when enabled, time format, start equals end,
 * and GET usage null guard.
 *
 * Uses jest.mock (via jest.unstable_mockModule for ESM) pattern for getTenantId and supabase.
 */

import { jest } from '@jest/globals';

// ─── Mock getTenantId ─────────────────────────────────────────────────────────

const mockGetTenantId = jest.fn().mockResolvedValue('tenant-abc');

jest.unstable_mockModule('@/lib/get-tenant-id', () => ({
  getTenantId: mockGetTenantId,
}));

// ─── Mock supabase ────────────────────────────────────────────────────────────

const mockSingle = jest.fn();
const mockSelect = jest.fn().mockReturnThis();
const mockEq = jest.fn().mockReturnThis();
const mockGte = jest.fn().mockReturnThis();
const mockUpdate = jest.fn().mockReturnThis();

const mockTenantsQuery = {
  select: mockSelect,
  eq: mockEq,
  gte: mockGte,
  single: mockSingle,
  update: mockUpdate,
};

const mockSupabase = {
  from: jest.fn().mockReturnValue(mockTenantsQuery),
};

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

// ─── Import route handlers after mocks ───────────────────────────────────────

let GET, PUT;

beforeAll(async () => {
  const mod = await import('@/app/api/call-routing/route');
  GET = mod.GET;
  PUT = mod.PUT;
});

beforeEach(() => {
  jest.clearAllMocks();

  // Restore chainable mocks
  mockSelect.mockReturnThis();
  mockEq.mockReturnThis();
  mockGte.mockReturnThis();
  mockUpdate.mockReturnThis();
  mockSupabase.from.mockReturnValue(mockTenantsQuery);

  // Authenticated by default
  mockGetTenantId.mockResolvedValue('tenant-abc');
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePutRequest(body) {
  return new Request('http://localhost/api/call-routing', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function validSchedule(enabled = false) {
  return {
    enabled,
    days: {
      mon: [{ start: '09:00', end: '17:00' }],
      tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
    },
  };
}

function validPickupNumbers(numbers = ['+15551234567']) {
  return numbers.map((n, i) => ({
    number: n,
    label: `Phone ${i + 1}`,
    sms_forward: true,
  }));
}

/**
 * Sets up mock chain for tenant lookup.
 * The PUT handler fetches tenant phone_number for self-reference check.
 */
function mockTenantLookup(phoneNumber = '+18005550000') {
  // The route does two from() calls for PUT:
  // 1) from('tenants').select('phone_number').eq('id', ...).single() -> tenant phone
  // 2) from('tenants').update({...}).eq('id', ...).select(...).single() -> updated data
  const singleForPhone = jest.fn().mockResolvedValue({
    data: { phone_number: phoneNumber },
    error: null,
  });
  const singleForUpdate = jest.fn().mockResolvedValue({
    data: {
      call_forwarding_schedule: validSchedule(),
      pickup_numbers: [],
      dial_timeout_seconds: 15,
    },
    error: null,
  });

  let callCount = 0;
  mockSupabase.from.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // First call: phone_number lookup
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: singleForPhone,
          }),
        }),
      };
    }
    // Second call: update
    return {
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: singleForUpdate,
          }),
        }),
      }),
    };
  });
}

// ─── PUT validation tests ────────────────────────────────────────────────────

describe('PUT /api/call-routing', () => {
  test('PUT rejects dial_timeout below 10', async () => {
    mockTenantLookup();
    const req = makePutRequest({
      call_forwarding_schedule: validSchedule(),
      pickup_numbers: validPickupNumbers(),
      dial_timeout_seconds: 5,
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('dial_timeout');
  });

  test('PUT rejects dial_timeout above 30', async () => {
    mockTenantLookup();
    const req = makePutRequest({
      call_forwarding_schedule: validSchedule(),
      pickup_numbers: validPickupNumbers(),
      dial_timeout_seconds: 45,
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('dial_timeout');
  });

  test('PUT rejects invalid E.164 phone number', async () => {
    mockTenantLookup();
    const req = makePutRequest({
      call_forwarding_schedule: validSchedule(),
      pickup_numbers: [{ number: '5551234567', label: 'Cell', sms_forward: true }],
      dial_timeout_seconds: 15,
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid phone number format');
  });

  test('PUT rejects duplicate phone numbers', async () => {
    mockTenantLookup();
    const req = makePutRequest({
      call_forwarding_schedule: validSchedule(),
      pickup_numbers: [
        { number: '+15551234567', label: 'Cell', sms_forward: true },
        { number: '+15551234567', label: 'Cell 2', sms_forward: false },
      ],
      dial_timeout_seconds: 15,
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Duplicate');
  });

  test('PUT rejects more than 5 pickup numbers', async () => {
    mockTenantLookup();
    const numbers = ['+15551111111', '+15552222222', '+15553333333', '+15554444444', '+15555555555', '+15556666666'];
    const req = makePutRequest({
      call_forwarding_schedule: validSchedule(),
      pickup_numbers: validPickupNumbers(numbers),
      dial_timeout_seconds: 15,
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Maximum 5');
  });

  test('PUT rejects self-reference to Twilio number', async () => {
    mockTenantLookup('+18005550000');
    const req = makePutRequest({
      call_forwarding_schedule: validSchedule(),
      pickup_numbers: [{ number: '+18005550000', label: 'My Voco', sms_forward: true }],
      dial_timeout_seconds: 15,
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('own Voco business number');
  });

  test('PUT rejects zero pickup numbers when schedule enabled', async () => {
    mockTenantLookup();
    const req = makePutRequest({
      call_forwarding_schedule: validSchedule(true),
      pickup_numbers: [],
      dial_timeout_seconds: 15,
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Add at least one pickup number');
  });

  test('PUT rejects invalid time format', async () => {
    mockTenantLookup();
    const req = makePutRequest({
      call_forwarding_schedule: {
        enabled: false,
        days: {
          mon: [{ start: '9:00', end: '17:00' }],
          tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
        },
      },
      pickup_numbers: validPickupNumbers(),
      dial_timeout_seconds: 15,
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  test('PUT rejects start equals end time', async () => {
    mockTenantLookup();
    const req = makePutRequest({
      call_forwarding_schedule: {
        enabled: false,
        days: {
          mon: [{ start: '09:00', end: '09:00' }],
          tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
        },
      },
      pickup_numbers: validPickupNumbers(),
      dial_timeout_seconds: 15,
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});

// ─── PUT VIP numbers validation tests ────────────────────────────────────────

describe('PUT /api/call-routing — VIP numbers', () => {
  test('PUT with valid vip_numbers saves successfully', async () => {
    const singleForPhone = jest.fn().mockResolvedValue({
      data: { phone_number: '+18005550000' },
      error: null,
    });
    const singleForUpdate = jest.fn().mockResolvedValue({
      data: {
        call_forwarding_schedule: validSchedule(),
        pickup_numbers: [],
        dial_timeout_seconds: 15,
        vip_numbers: [{ number: '+15551112222', label: 'Best customer' }],
      },
      error: null,
    });

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: singleForPhone,
            }),
          }),
        };
      }
      return {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: singleForUpdate,
            }),
          }),
        }),
      };
    });

    const req = makePutRequest({
      call_forwarding_schedule: validSchedule(),
      pickup_numbers: validPickupNumbers(),
      dial_timeout_seconds: 15,
      vip_numbers: [{ number: '+15551112222', label: 'Best customer' }],
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vip_numbers).toBeDefined();
  });

  test('PUT with invalid VIP number format returns 400', async () => {
    mockTenantLookup();
    const req = makePutRequest({
      call_forwarding_schedule: validSchedule(),
      pickup_numbers: validPickupNumbers(),
      dial_timeout_seconds: 15,
      vip_numbers: [{ number: 'not-a-phone' }],
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid VIP phone number format');
  });

  test('PUT with duplicate VIP numbers returns 400', async () => {
    mockTenantLookup();
    const req = makePutRequest({
      call_forwarding_schedule: validSchedule(),
      pickup_numbers: validPickupNumbers(),
      dial_timeout_seconds: 15,
      vip_numbers: [{ number: '+15551112222' }, { number: '+15551112222' }],
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Duplicate VIP phone number');
  });

  test('PUT with vip_numbers not an array returns 400', async () => {
    mockTenantLookup();
    const req = makePutRequest({
      call_forwarding_schedule: validSchedule(),
      pickup_numbers: validPickupNumbers(),
      dial_timeout_seconds: 15,
      vip_numbers: 'not-array',
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('vip_numbers must be an array');
  });

  test('PUT with VIP number missing number field returns 400', async () => {
    mockTenantLookup();
    const req = makePutRequest({
      call_forwarding_schedule: validSchedule(),
      pickup_numbers: validPickupNumbers(),
      dial_timeout_seconds: 15,
      vip_numbers: [{ label: 'no number' }],
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Each VIP number must have a number field');
  });
});

// ─── GET tests ───────────────────────────────────────────────────────────────

describe('GET /api/call-routing', () => {
  test('GET returns usage with null guard', async () => {
    // Mock tenant data
    const tenantData = {
      call_forwarding_schedule: validSchedule(),
      pickup_numbers: [],
      dial_timeout_seconds: 15,
      working_hours: {},
      phone_number: '+18005550000',
      country: 'US',
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation((table) => {
      callCount++;
      if (table === 'tenants') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: tenantData, error: null }),
            }),
          }),
        };
      }
      // calls table — return empty array (no calls exist)
      if (table === 'calls') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === 'leads') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
    });

    const req = new Request('http://localhost/api/call-routing');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.usage.used_minutes).toBe(0);
    expect(body.usage.used_seconds).toBe(0);
    // Ensure not null or NaN
    expect(body.usage.used_minutes).not.toBeNull();
    expect(body.usage.used_minutes).not.toBeNaN();
  });

  test('GET returns vip_numbers in response', async () => {
    const tenantData = {
      call_forwarding_schedule: validSchedule(),
      pickup_numbers: [],
      dial_timeout_seconds: 15,
      vip_numbers: [{ number: '+15551112222', label: 'VIP' }],
      working_hours: {},
      phone_number: '+18005550000',
      country: 'US',
    };

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'tenants') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: tenantData, error: null }),
            }),
          }),
        };
      }
      if (table === 'calls') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === 'leads') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
    });

    const req = new Request('http://localhost/api/call-routing');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.vip_numbers)).toBe(true);
    expect(body.vip_numbers).toHaveLength(1);
    expect(body.vip_numbers[0].number).toBe('+15551112222');
  });

  test('GET returns vip_leads scoped to current tenant', async () => {
    const tenantData = {
      call_forwarding_schedule: validSchedule(),
      pickup_numbers: [],
      dial_timeout_seconds: 15,
      vip_numbers: [],
      working_hours: {},
      phone_number: '+18005550000',
      country: 'US',
    };

    const mockLeadsEq2 = jest.fn().mockResolvedValue({
      data: [
        { id: 'lead-1', caller_name: 'Jane Best', from_number: '+15551119999' },
        { id: 'lead-2', caller_name: null, from_number: '+15552228888' },
      ],
      error: null,
    });
    const mockLeadsEq1 = jest.fn().mockReturnValue({ eq: mockLeadsEq2 });

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'tenants') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: tenantData, error: null }),
            }),
          }),
        };
      }
      if (table === 'calls') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === 'leads') {
        return {
          select: jest.fn().mockReturnValue({ eq: mockLeadsEq1 }),
        };
      }
    });

    const req = new Request('http://localhost/api/call-routing');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.vip_leads)).toBe(true);
    expect(body.vip_leads).toHaveLength(2);
    expect(body.vip_leads[0]).toEqual({ id: 'lead-1', caller_name: 'Jane Best', from_number: '+15551119999' });
    // Assert tenant scoping: tenant_id filter applied first, then is_vip filter
    expect(mockLeadsEq1).toHaveBeenCalledWith('tenant_id', 'tenant-abc');
    expect(mockLeadsEq2).toHaveBeenCalledWith('is_vip', true);
  });
});

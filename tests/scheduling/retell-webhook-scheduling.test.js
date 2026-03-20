/**
 * Tests for scheduling integration in the Retell webhook handler.
 *
 * Covers:
 * - handleInbound passes available_slots and booking_enabled in dynamic_variables
 * - handleFunctionCall dispatches book_appointment to handleBookAppointment
 * - handleBookAppointment confirms booking and returns speech string
 * - handleBookAppointment handles slot_taken and returns next-slot alternative
 * - No synchronous Google Calendar API calls in the call hot path
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// --- Supabase mock ---
const mockFrom = jest.fn();
const mockSupabase = { from: mockFrom };

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

// --- Retell SDK mock ---
jest.unstable_mockModule('retell-sdk', () => ({
  default: class MockRetell {
    static verify() { return true; }
    call = { transfer: jest.fn() };
  },
}));

// --- Retell client mock ---
jest.unstable_mockModule('@/lib/retell', () => ({
  retell: { call: { transfer: jest.fn() } },
}));

// --- Call processor mock ---
jest.unstable_mockModule('@/lib/call-processor', () => ({
  processCallAnalyzed: jest.fn(),
  processCallEnded: jest.fn(),
}));

// --- Slot calculator mock ---
const mockCalculateAvailableSlots = jest.fn();
jest.unstable_mockModule('@/lib/scheduling/slot-calculator', () => ({
  calculateAvailableSlots: mockCalculateAvailableSlots,
}));

// --- Booking mock ---
const mockAtomicBookSlot = jest.fn();
jest.unstable_mockModule('@/lib/scheduling/booking', () => ({
  atomicBookSlot: mockAtomicBookSlot,
}));

// --- Google calendar mock ---
const mockPushBookingToCalendar = jest.fn();
jest.unstable_mockModule('@/lib/scheduling/google-calendar', () => ({
  pushBookingToCalendar: mockPushBookingToCalendar,
}));

// --- next/server mock ---
const mockAfter = jest.fn((fn) => fn());
jest.unstable_mockModule('next/server', () => ({
  after: mockAfter,
}));

// Helper to build a mock Supabase chain
function buildChain(result) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    update: jest.fn().mockReturnThis(),
  };
  return chain;
}

// Helper to create a Request-like object
function makeRequest(body, headers = {}) {
  return {
    text: async () => JSON.stringify(body),
    headers: {
      get: (key) => headers[key] ?? null,
    },
  };
}

describe('Retell webhook — scheduling integration', () => {
  let POST;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockAfter.mockImplementation((fn) => fn());
    mockCalculateAvailableSlots.mockReturnValue([]);
    mockAtomicBookSlot.mockResolvedValue({ success: true, appointment_id: 'appt-uuid-123' });
    mockPushBookingToCalendar.mockResolvedValue(undefined);

    // Re-import each time after resetting mocks
    const mod = await import('@/app/api/webhooks/retell/route.js?bust=' + Date.now());
    POST = mod.POST;
  });

  // ----------------------------------------------------------------
  // handleInbound — available_slots
  // ----------------------------------------------------------------

  describe('handleInbound — available_slots in dynamic_variables', () => {
    test('passes available_slots string in dynamic_variables', async () => {
      // Tenant query
      const tenantChain = buildChain({
        data: {
          id: 'tenant-1',
          business_name: 'HVAC Pros',
          default_locale: 'en',
          onboarding_complete: true,
          owner_phone: '+15551234567',
          tone_preset: 'professional',
          working_hours: { monday: { enabled: true, open: '08:00', close: '17:00' } },
          slot_duration_mins: 60,
          tenant_timezone: 'America/Chicago',
        },
      });

      // Scheduling data queries (Promise.all of 4 queries)
      const appointmentsChain = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), neq: jest.fn().mockReturnThis(), gte: jest.fn().mockResolvedValue({ data: [] }) };
      const eventsChain = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), gte: jest.fn().mockResolvedValue({ data: [] }) };
      const zonesChain = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [] }) };
      const buffersChain = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [] }) };

      let callCount = 0;
      mockFrom.mockImplementation((table) => {
        if (table === 'tenants') return tenantChain;
        if (table === 'appointments') return appointmentsChain;
        if (table === 'calendar_events') return eventsChain;
        if (table === 'service_zones') return zonesChain;
        if (table === 'zone_travel_buffers') return buffersChain;
        return buildChain({ data: null });
      });

      // Slot calculator returns 2 slots
      mockCalculateAvailableSlots.mockReturnValue([
        { start: '2026-03-23T14:00:00.000Z', end: '2026-03-23T15:00:00.000Z' },
        { start: '2026-03-23T16:00:00.000Z', end: '2026-03-23T17:00:00.000Z' },
      ]);

      const req = makeRequest({
        event: 'call_inbound',
        from_number: '+15559876543',
        to_number: '+15551111111',
      });

      const res = await POST(req);
      const body = await res.json();

      expect(body.dynamic_variables).toBeDefined();
      expect(body.dynamic_variables.available_slots).toBeDefined();
      expect(typeof body.dynamic_variables.available_slots).toBe('string');
      // Should contain numbered slots
      expect(body.dynamic_variables.available_slots).toMatch(/1\./);
    });

    test('passes booking_enabled=true when slots are available', async () => {
      const tenantChain = buildChain({
        data: {
          id: 'tenant-1', business_name: 'Plumbing Co', default_locale: 'en',
          onboarding_complete: true, owner_phone: '+15551234567', tone_preset: 'professional',
          working_hours: { monday: { enabled: true, open: '08:00', close: '17:00' } },
          slot_duration_mins: 60, tenant_timezone: 'America/Chicago',
        },
      });

      const emptyChain = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), neq: jest.fn().mockReturnThis(), gte: jest.fn().mockResolvedValue({ data: [] }) };

      mockFrom.mockImplementation((table) => {
        if (table === 'tenants') return tenantChain;
        return emptyChain;
      });

      mockCalculateAvailableSlots.mockReturnValue([
        { start: '2026-03-23T14:00:00.000Z', end: '2026-03-23T15:00:00.000Z' },
      ]);

      const req = makeRequest({ event: 'call_inbound', from_number: '+1555', to_number: '+1444' });
      const res = await POST(req);
      const body = await res.json();

      expect(body.dynamic_variables.booking_enabled).toBe('true');
    });

    test('passes booking_enabled=false when no slots available', async () => {
      const tenantChain = buildChain({
        data: {
          id: 'tenant-1', business_name: 'Electricians', default_locale: 'en',
          onboarding_complete: true, owner_phone: '+15551234567', tone_preset: 'professional',
          working_hours: {}, slot_duration_mins: 60, tenant_timezone: 'America/Chicago',
        },
      });

      const emptyChain = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), neq: jest.fn().mockReturnThis(), gte: jest.fn().mockResolvedValue({ data: [] }) };

      mockFrom.mockImplementation((table) => {
        if (table === 'tenants') return tenantChain;
        return emptyChain;
      });

      mockCalculateAvailableSlots.mockReturnValue([]);

      const req = makeRequest({ event: 'call_inbound', from_number: '+1555', to_number: '+1444' });
      const res = await POST(req);
      const body = await res.json();

      expect(body.dynamic_variables.booking_enabled).toBe('false');
    });
  });

  // ----------------------------------------------------------------
  // handleFunctionCall — book_appointment dispatch
  // ----------------------------------------------------------------

  describe('handleFunctionCall — book_appointment dispatch', () => {
    test('dispatches book_appointment function call to handleBookAppointment', async () => {
      // call record
      const callChain = buildChain({ data: { id: 'call-uuid-1', tenant_id: 'tenant-1' } });
      const tenantChain = buildChain({
        data: {
          id: 'tenant-1', tenant_timezone: 'America/Chicago',
          working_hours: {}, slot_duration_mins: 60,
        },
      });

      mockFrom.mockImplementation((table) => {
        if (table === 'calls') return callChain;
        if (table === 'tenants') return tenantChain;
        return buildChain({ data: null });
      });

      mockAtomicBookSlot.mockResolvedValue({ success: true, appointment_id: 'appt-1' });

      const req = makeRequest({
        event: 'call_function_invoked',
        call_id: 'retell-call-id-1',
        function_call: {
          name: 'book_appointment',
          arguments: {
            slot_start: '2026-03-23T14:00:00.000Z',
            slot_end: '2026-03-23T15:00:00.000Z',
            service_address: '123 Main St, Dallas TX',
            caller_name: 'John Smith',
            urgency: 'routine',
          },
        },
        call: { from_number: '+15559998888' },
      });

      const res = await POST(req);
      const body = await res.json();

      expect(mockAtomicBookSlot).toHaveBeenCalledTimes(1);
      expect(body.result).toBeDefined();
    });

    test('successful booking returns confirmation speech string', async () => {
      const callChain = buildChain({ data: { id: 'call-uuid-1', tenant_id: 'tenant-1' } });
      const tenantChain = buildChain({
        data: { tenant_timezone: 'America/Chicago', working_hours: {}, slot_duration_mins: 60 },
      });

      mockFrom.mockImplementation((table) => {
        if (table === 'calls') return callChain;
        if (table === 'tenants') return tenantChain;
        return buildChain({ data: null });
      });

      mockAtomicBookSlot.mockResolvedValue({ success: true, appointment_id: 'appt-success' });

      const req = makeRequest({
        event: 'call_function_invoked',
        call_id: 'retell-call-1',
        function_call: {
          name: 'book_appointment',
          arguments: {
            slot_start: '2026-03-23T14:00:00.000Z',
            slot_end: '2026-03-23T15:00:00.000Z',
            service_address: '456 Oak Ave',
            caller_name: 'Jane Doe',
            urgency: 'emergency',
          },
        },
        call: { from_number: '+15551112222' },
      });

      const res = await POST(req);
      const body = await res.json();

      expect(body.result).toMatch(/confirmed/i);
    });

    test('triggers pushBookingToCalendar asynchronously via after() on success', async () => {
      const callChain = buildChain({ data: { id: 'call-uuid-2', tenant_id: 'tenant-1' } });
      const tenantChain = buildChain({
        data: { tenant_timezone: 'America/Chicago', working_hours: {}, slot_duration_mins: 60 },
      });

      mockFrom.mockImplementation((table) => {
        if (table === 'calls') return callChain;
        if (table === 'tenants') return tenantChain;
        return buildChain({ data: null });
      });

      mockAtomicBookSlot.mockResolvedValue({ success: true, appointment_id: 'appt-async' });

      const req = makeRequest({
        event: 'call_function_invoked',
        call_id: 'retell-call-2',
        function_call: {
          name: 'book_appointment',
          arguments: {
            slot_start: '2026-03-23T16:00:00.000Z',
            slot_end: '2026-03-23T17:00:00.000Z',
            service_address: '789 Elm Rd',
            caller_name: 'Bob Jones',
            urgency: 'routine',
          },
        },
      });

      await POST(req);

      expect(mockAfter).toHaveBeenCalled();
      expect(mockPushBookingToCalendar).toHaveBeenCalledWith('tenant-1', 'appt-async');
    });

    test('slot_taken returns alternative slot speech string', async () => {
      const callChain = buildChain({ data: { id: 'call-uuid-3', tenant_id: 'tenant-1' } });
      const tenantChain = buildChain({
        data: { tenant_timezone: 'America/Chicago', working_hours: {}, slot_duration_mins: 60 },
      });

      mockFrom.mockImplementation((table) => {
        if (table === 'calls') return callChain;
        if (table === 'tenants') return tenantChain;
        return buildChain({ data: null });
      });

      mockAtomicBookSlot.mockResolvedValue({ success: false, reason: 'slot_taken' });
      mockCalculateAvailableSlots.mockReturnValue([
        { start: '2026-03-23T18:00:00.000Z', end: '2026-03-23T19:00:00.000Z' },
      ]);

      const req = makeRequest({
        event: 'call_function_invoked',
        call_id: 'retell-call-3',
        function_call: {
          name: 'book_appointment',
          arguments: {
            slot_start: '2026-03-23T14:00:00.000Z',
            slot_end: '2026-03-23T15:00:00.000Z',
            service_address: '999 Pine Blvd',
            caller_name: 'Alice Cooper',
            urgency: 'routine',
          },
        },
      });

      const res = await POST(req);
      const body = await res.json();

      expect(body.result).toMatch(/slot was just taken/i);
    });

    test('slot_taken does NOT call pushBookingToCalendar', async () => {
      const callChain = buildChain({ data: { id: 'call-uuid-4', tenant_id: 'tenant-1' } });
      const tenantChain = buildChain({
        data: { tenant_timezone: 'America/Chicago', working_hours: {}, slot_duration_mins: 60 },
      });

      mockFrom.mockImplementation((table) => {
        if (table === 'calls') return callChain;
        if (table === 'tenants') return tenantChain;
        return buildChain({ data: null });
      });

      mockAtomicBookSlot.mockResolvedValue({ success: false, reason: 'slot_taken' });
      mockCalculateAvailableSlots.mockReturnValue([]);

      const req = makeRequest({
        event: 'call_function_invoked',
        call_id: 'retell-call-4',
        function_call: {
          name: 'book_appointment',
          arguments: {
            slot_start: '2026-03-23T14:00:00.000Z',
            slot_end: '2026-03-23T15:00:00.000Z',
            service_address: '111 Cedar Lane',
            caller_name: 'Dave Brown',
            urgency: 'emergency',
          },
        },
      });

      await POST(req);

      expect(mockPushBookingToCalendar).not.toHaveBeenCalled();
    });
  });
});

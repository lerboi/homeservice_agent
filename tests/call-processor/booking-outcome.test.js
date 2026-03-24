/**
 * Tests for processCallAnalyzed — booking_outcome and notification_priority behaviors.
 *
 * All tests in this file are intentionally RED — Plan 02 will make them GREEN.
 * These tests describe the expected behaviors that call-processor must implement
 * in Phase 15 Plan 02 per D-01, D-02, D-05, and D-11 from 15-CONTEXT.md.
 */

import { jest } from '@jest/globals';

// ─── Supabase mock ─────────────────────────────────────────────────────────────

const mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null });
const mockIs = jest.fn().mockResolvedValue({ data: null, error: null });
const mockUpdateEq = jest.fn().mockReturnValue({ is: mockIs });
const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq });

// Build a chainable mock for .select().eq().eq().single()/.maybeSingle()
// Handles multi-chained .eq() calls (e.g., .eq('tenant_id', x).eq('retell_call_id', y))
function makeSelectChain(singleResult, maybeSingleResult) {
  const leaf = {
    single: jest.fn().mockResolvedValue(singleResult),
    maybeSingle: jest.fn().mockResolvedValue(maybeSingleResult),
    data: [],
  };
  // Allow arbitrary .eq()/.neq() chaining and resolve with empty data array for non-terminal calls
  leaf.eq = jest.fn().mockReturnValue(leaf);
  leaf.neq = jest.fn().mockReturnValue({ ...leaf, then: (resolve) => resolve({ data: [] }) });
  // Make the chain itself thenable (Promise-like) for Promise.all usage
  leaf.then = (resolve) => resolve({ data: [] });
  const firstEq = jest.fn().mockReturnValue(leaf);
  return {
    eq: firstEq,
    single: leaf.single,
    maybeSingle: leaf.maybeSingle,
    then: leaf.then,
  };
}

const mockFrom = jest.fn().mockReturnValue({
  upsert: mockUpsert,
  update: mockUpdate,
  select: jest.fn().mockReturnValue(
    makeSelectChain({ data: { id: 'tenant-1' } }, { data: null })
  ),
});

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

// ─── Classifier mock ──────────────────────────────────────────────────────────

const mockClassifyCall = jest.fn().mockResolvedValue({
  urgency: 'routine',
  confidence: 'high',
  layer: 'layer1',
});

jest.unstable_mockModule('@/lib/triage/classifier', () => ({
  classifyCall: mockClassifyCall,
}));

// ─── Slot calculator mock ─────────────────────────────────────────────────────

const mockCalculateAvailableSlots = jest.fn().mockReturnValue([]);

jest.unstable_mockModule('@/lib/scheduling/slot-calculator', () => ({
  calculateAvailableSlots: mockCalculateAvailableSlots,
}));

// ─── Leads mock ───────────────────────────────────────────────────────────────

jest.unstable_mockModule('@/lib/leads', () => ({
  createOrMergeLead: jest.fn().mockResolvedValue({ id: 'lead-1' }),
}));

// ─── Notifications mock ───────────────────────────────────────────────────────

jest.unstable_mockModule('@/lib/notifications', () => ({
  sendOwnerNotifications: jest.fn().mockResolvedValue(undefined),
  sendCallerSMS: jest.fn().mockResolvedValue({ sid: 'SM_test_123' }),
}));

// ─── Module import (after mocks) ──────────────────────────────────────────────

let processCallAnalyzed;

beforeAll(async () => {
  const mod = await import('@/lib/call-processor');
  processCallAnalyzed = mod.processCallAnalyzed;
});

// ─── Test data factory ────────────────────────────────────────────────────────

function makeCall(overrides = {}) {
  return {
    call_id: 'call-test-001',
    from_number: '+15551234567',
    to_number: '+15559990000',
    direction: 'inbound',
    disconnection_reason: 'user_hangup',
    start_timestamp: '2026-03-24T10:00:00Z',
    end_timestamp: '2026-03-24T10:05:00Z',
    recording_url: null,
    transcript: 'My pipe is leaking',
    transcript_object: null,
    call_analysis: null,
    metadata: { detected_language: 'en' },
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('processCallAnalyzed — booking_outcome and notification_priority', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: tenant found, no appointment for this call
    mockFrom.mockReturnValue({
      upsert: mockUpsert,
      update: mockUpdate,
      select: jest.fn().mockReturnValue(
        makeSelectChain({ data: { id: 'tenant-1' } }, { data: null })
      ),
    });

    mockClassifyCall.mockResolvedValue({
      urgency: 'routine',
      confidence: 'high',
      layer: 'layer1',
    });

    mockCalculateAvailableSlots.mockReturnValue([]);
  });

  // RED — Plan 02 will implement this behavior
  test('does NOT include booking_outcome in main upsert column set', async () => {
    // WHY: prevents overwriting real-time booking_outcome set during live call (Pitfall 1)
    // The main upsert handles analyzed data; booking_outcome is set separately via conditional update
    await processCallAnalyzed(makeCall());

    const upsertCalls = mockUpsert.mock.calls;
    expect(upsertCalls.length).toBeGreaterThan(0);

    // The main upsert data object should NOT have booking_outcome key
    const mainUpsertData = upsertCalls[0][0];
    expect(mainUpsertData).not.toHaveProperty('booking_outcome');
  });

  // RED — Plan 02 will implement this behavior
  test('sets booking_outcome to not_attempted for calls with null booking_outcome', async () => {
    // Per D-02: post-call processor fills not_attempted as default when booking didn't happen
    // Uses conditional update: .update({ booking_outcome: 'not_attempted' }).eq('retell_call_id', ...).is('booking_outcome', null)
    await processCallAnalyzed(makeCall());

    const updateCalls = mockUpdate.mock.calls;
    expect(updateCalls.length).toBeGreaterThan(0);

    const updateData = updateCalls[0][0];
    expect(updateData).toHaveProperty('booking_outcome', 'not_attempted');
  });

  // RED — Plan 02 will implement this behavior
  test('computes notification_priority as high for emergency urgency', async () => {
    // Per D-11: emergency and high_ticket urgency → notification_priority: 'high'
    mockClassifyCall.mockResolvedValue({ urgency: 'emergency', confidence: 'high', layer: 'layer1' });

    await processCallAnalyzed(makeCall());

    const upsertCalls = mockUpsert.mock.calls;
    const mainUpsertData = upsertCalls[0][0];
    expect(mainUpsertData).toHaveProperty('notification_priority', 'high');
  });

  // RED — Plan 02 will implement this behavior
  test('computes notification_priority as high for high_ticket urgency', async () => {
    // Per D-11: high_ticket also maps to 'high' notification priority
    mockClassifyCall.mockResolvedValue({ urgency: 'high_ticket', confidence: 'high', layer: 'layer3' });

    await processCallAnalyzed(makeCall());

    const upsertCalls = mockUpsert.mock.calls;
    const mainUpsertData = upsertCalls[0][0];
    expect(mainUpsertData).toHaveProperty('notification_priority', 'high');
  });

  // RED — Plan 02 will implement this behavior
  test('computes notification_priority as standard for routine urgency', async () => {
    // Per D-11: routine urgency → notification_priority: 'standard'
    mockClassifyCall.mockResolvedValue({ urgency: 'routine', confidence: 'high', layer: 'layer1' });

    await processCallAnalyzed(makeCall());

    const upsertCalls = mockUpsert.mock.calls;
    const mainUpsertData = upsertCalls[0][0];
    expect(mainUpsertData).toHaveProperty('notification_priority', 'standard');
  });

  // RED — Plan 02 will implement this behavior
  test('calculates suggested_slots for ANY unbooked call, not just routine', async () => {
    // Per D-05: expand scope from isRoutineUnbooked to any unbooked call
    // Emergency calls that weren't booked during the call should also get suggested slots
    mockClassifyCall.mockResolvedValue({ urgency: 'emergency', confidence: 'high', layer: 'layer1' });

    // Tenant has working hours configured
    mockFrom.mockReturnValue({
      upsert: mockUpsert,
      update: mockUpdate,
      select: jest.fn().mockReturnValue(
        makeSelectChain(
          {
            data: {
              id: 'tenant-1',
              working_hours: { monday: { start: '08:00', end: '17:00' } },
              slot_duration_mins: 60,
              tenant_timezone: 'America/Chicago',
            },
          },
          { data: null }
        )
      ),
    });

    await processCallAnalyzed(makeCall());

    // calculateAvailableSlots should have been called even for emergency urgency
    expect(mockCalculateAvailableSlots).toHaveBeenCalled();
  });

  // RED — Plan 02 will implement this behavior
  test('does NOT calculate suggested_slots when appointment exists', async () => {
    // Per D-05: gate on !appointmentExists only — if booked during call, skip slot calculation
    mockClassifyCall.mockResolvedValue({ urgency: 'routine', confidence: 'high', layer: 'layer1' });

    // Return an appointment for this call
    mockFrom.mockReturnValue({
      upsert: mockUpsert,
      update: mockUpdate,
      select: jest.fn().mockReturnValue(
        makeSelectChain({ data: { id: 'tenant-1' } }, { data: { id: 'appt-1' } })
      ),
    });

    await processCallAnalyzed(makeCall());

    // calculateAvailableSlots should NOT be called when appointment exists
    expect(mockCalculateAvailableSlots).not.toHaveBeenCalled();
  });
});

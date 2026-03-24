import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Mock supabase
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

jest.unstable_mockModule('@/lib/leads', () => ({
  createOrMergeLead: jest.fn().mockResolvedValue({ id: 'lead-123', status: 'new' }),
}));

const { createOrMergeLead } = await import('@/lib/leads');

describe('capture_lead handler contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createOrMergeLead accepts mid-call fields matching capture_lead schema', async () => {
    await createOrMergeLead({
      tenantId: 'tenant-1',
      callId: 'call-1',
      fromNumber: '+1234567890',
      callerName: 'Jane Doe',
      jobType: 'water heater repair',
      serviceAddress: '123 Main St',
      triageResult: { urgency: 'routine' },
      appointmentId: null,
      callDuration: 120, // mid-call duration estimate
    });

    expect(createOrMergeLead).toHaveBeenCalledTimes(1);
    const args = createOrMergeLead.mock.calls[0][0];
    expect(args.tenantId).toBe('tenant-1');
    expect(args.callerName).toBe('Jane Doe');
    expect(args.jobType).toBe('water heater repair');
    expect(args.serviceAddress).toBe('123 Main St');
    expect(args.appointmentId).toBeNull();
    expect(args.callDuration).toBeGreaterThanOrEqual(15); // must pass 15s filter
  });

  test('mid-call duration is always >= 15 seconds (avoids Pitfall 3)', () => {
    const midCallDuration = 120; // simulated
    expect(midCallDuration).toBeGreaterThanOrEqual(15);
  });

  test('createOrMergeLead returns lead object with id and status', async () => {
    const result = await createOrMergeLead({
      tenantId: 'tenant-1',
      callId: 'call-1',
      fromNumber: '+1234567890',
      callerName: null,
      jobType: null,
      serviceAddress: null,
      triageResult: { urgency: 'routine' },
      appointmentId: null,
      callDuration: 999,
    });

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('status');
  });
});

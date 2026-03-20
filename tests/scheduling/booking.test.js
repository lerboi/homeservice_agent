import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Mock the supabase module before importing the module under test
const mockRpc = jest.fn();
jest.mock('@/lib/supabase.js', () => ({
  supabase: {
    rpc: mockRpc,
  },
}));

const { atomicBookSlot } = await import('@/lib/scheduling/booking.js');

describe('atomicBookSlot', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  test('calls supabase.rpc with correct mapped parameters', async () => {
    mockRpc.mockResolvedValueOnce({ data: { success: true, appointment_id: 'appt-123' }, error: null });

    const startTime = new Date('2026-03-23T14:00:00.000Z');
    const endTime = new Date('2026-03-23T15:00:00.000Z');

    await atomicBookSlot({
      tenantId: 'tenant-uuid',
      callId: 'call-uuid',
      startTime,
      endTime,
      address: '123 Main St',
      callerName: 'John Doe',
      callerPhone: '+14055551234',
      urgency: 'routine',
      zoneId: 'zone-uuid',
    });

    expect(mockRpc).toHaveBeenCalledWith('book_appointment_atomic', {
      p_tenant_id: 'tenant-uuid',
      p_call_id: 'call-uuid',
      p_start_time: startTime.toISOString(),
      p_end_time: endTime.toISOString(),
      p_service_address: '123 Main St',
      p_caller_name: 'John Doe',
      p_caller_phone: '+14055551234',
      p_urgency: 'routine',
      p_zone_id: 'zone-uuid',
    });
  });

  test('returns data from successful RPC call', async () => {
    const successData = { success: true, appointment_id: 'appt-456' };
    mockRpc.mockResolvedValueOnce({ data: successData, error: null });

    const result = await atomicBookSlot({
      tenantId: 'tenant-uuid',
      callId: null,
      startTime: new Date('2026-03-23T14:00:00.000Z'),
      endTime: new Date('2026-03-23T15:00:00.000Z'),
      address: '456 Oak Ave',
      callerName: 'Jane Smith',
      callerPhone: '+14055559876',
      urgency: 'emergency',
      zoneId: null,
    });

    expect(result).toEqual(successData);
  });

  test('throws when supabase returns an error', async () => {
    const supabaseError = new Error('Connection failed');
    mockRpc.mockResolvedValueOnce({ data: null, error: supabaseError });

    await expect(
      atomicBookSlot({
        tenantId: 'tenant-uuid',
        callId: null,
        startTime: new Date('2026-03-23T14:00:00.000Z'),
        endTime: new Date('2026-03-23T15:00:00.000Z'),
        address: '789 Pine Rd',
        callerName: 'Bob Wilson',
        callerPhone: '+14055550000',
        urgency: 'routine',
        zoneId: null,
      })
    ).rejects.toThrow();
  });
});

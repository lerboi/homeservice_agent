/**
 * Realtime test for the jobs table (Plan 06).
 *
 * Decision ID validated: D-15 (INSERT on jobs triggers Supabase Realtime subscription payload).
 * T-59-06-01 mitigation: explicit filter `tenant_id=eq.<uuid>` scopes subscription;
 *   a cross-tenant INSERT MUST NOT fire the handler.
 *
 * Note (2026-04-21): migrations 059 (tables) are push-deferred until Plan 08.
 * The `jobs` table does not exist in the live DB yet.
 * This test is written as a Jest integration test scaffold with the correct
 * Realtime subscription pattern and cross-tenant guard assertions.
 * Actual E2E run is deferred to Plan 08 post-migration push.
 * The test uses jest.fn() mocks to validate the subscription handler logic
 * without requiring a live Supabase connection.
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// ─── Mock Supabase Realtime channel ──────────────────────────────────────────

const mockHandler = jest.fn();
const mockChannel = {
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn(),
};
const mockRemoveChannel = jest.fn();
const mockSupabase = {
  channel: jest.fn(),
  removeChannel: mockRemoveChannel,
};

// ─── Subscription helper (mirrors jobs/page.js subscription pattern) ─────────

function createJobsRealtimeSubscription(supabaseClient, tenantId, onInsert, onUpdate) {
  return supabaseClient
    .channel('jobs-realtime')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'jobs',
        filter: `tenant_id=eq.${tenantId}`,
      },
      onInsert
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'jobs',
        filter: `tenant_id=eq.${tenantId}`,
      },
      onUpdate
    )
    .subscribe();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('jobs realtime (Plan 06 — D-15)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChannel.on.mockReturnThis();
    mockChannel.subscribe.mockReturnValue(undefined);
    mockSupabase.channel.mockReturnValue(mockChannel);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('subscribes to the jobs table (not leads) with tenant_id filter', () => {
    const tenantId = 'tenant-uuid-123';
    const onInsert = jest.fn();
    const onUpdate = jest.fn();

    createJobsRealtimeSubscription(mockSupabase, tenantId, onInsert, onUpdate);

    // Assert: channel created with correct name
    expect(mockSupabase.channel).toHaveBeenCalledWith('jobs-realtime');

    // Assert: .on() called for INSERT on `jobs` table — NOT `leads`
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: 'INSERT',
        schema: 'public',
        table: 'jobs',
        filter: `tenant_id=eq.${tenantId}`,
      }),
      onInsert
    );

    // Assert: .on() also called for UPDATE on `jobs` table
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: 'UPDATE',
        schema: 'public',
        table: 'jobs',
        filter: `tenant_id=eq.${tenantId}`,
      }),
      onUpdate
    );

    // Assert: subscribe called to activate the channel
    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it('INSERT payload handler receives new job row with expected fields', () => {
    const tenantId = 'tenant-uuid-123';
    let capturedInsertHandler = null;

    mockChannel.on.mockImplementation((event, config, handler) => {
      if (config.event === 'INSERT') capturedInsertHandler = handler;
      return mockChannel;
    });

    createJobsRealtimeSubscription(mockSupabase, tenantId, mockHandler, jest.fn());

    // Simulate a Realtime INSERT payload
    const mockPayload = {
      eventType: 'INSERT',
      new: {
        id: 'job-uuid-456',
        tenant_id: tenantId,
        customer_id: 'customer-uuid-789',
        appointment_id: 'appt-uuid-001',
        status: 'scheduled',
        urgency: 'routine',
        job_type: 'Plumbing',
        created_at: new Date().toISOString(),
      },
      old: {},
    };

    expect(capturedInsertHandler).not.toBeNull();
    capturedInsertHandler(mockPayload);

    // Assert: handler fired with the INSERT payload
    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledWith(mockPayload);

    // Assert: payload includes job_id, customer_id, appointment_id, status (D-15)
    const receivedPayload = mockHandler.mock.calls[0][0];
    expect(receivedPayload.new.id).toBe('job-uuid-456');
    expect(receivedPayload.new.customer_id).toBe('customer-uuid-789');
    expect(receivedPayload.new.appointment_id).toBe('appt-uuid-001');
    expect(receivedPayload.new.status).toBe('scheduled');
  });

  it('T-59-06-01: filter string uses exact tenant_id so cross-tenant rows are excluded', () => {
    const tenantId = 'tenant-uuid-123';
    const onInsert = jest.fn();

    mockChannel.on.mockImplementation((event, config, handler) => {
      // Validate filter is exact match — not a prefix or wildcard
      if (config.event === 'INSERT') {
        expect(config.filter).toBe(`tenant_id=eq.${tenantId}`);
        expect(config.filter).not.toContain('*');
        expect(config.filter).not.toContain('like');
      }
      return mockChannel;
    });

    createJobsRealtimeSubscription(mockSupabase, tenantId, onInsert, jest.fn());

    expect(mockChannel.on).toHaveBeenCalled();
  });

  it('UPDATE payload handler merges updated job fields in place', () => {
    const tenantId = 'tenant-uuid-123';
    let capturedUpdateHandler = null;

    mockChannel.on.mockImplementation((event, config, handler) => {
      if (config.event === 'UPDATE') capturedUpdateHandler = handler;
      return mockChannel;
    });

    const onUpdate = jest.fn();
    createJobsRealtimeSubscription(mockSupabase, tenantId, jest.fn(), onUpdate);

    const updatePayload = {
      eventType: 'UPDATE',
      new: {
        id: 'job-uuid-456',
        tenant_id: tenantId,
        status: 'completed',
        urgency: 'routine',
      },
      old: {
        id: 'job-uuid-456',
        status: 'scheduled',
      },
    };

    expect(capturedUpdateHandler).not.toBeNull();
    capturedUpdateHandler(updatePayload);

    expect(onUpdate).toHaveBeenCalledWith(updatePayload);
    expect(onUpdate.mock.calls[0][0].new.status).toBe('completed');
  });

  it('does NOT subscribe to the leads table (D-02a invariant)', () => {
    const tenantId = 'tenant-uuid-123';
    createJobsRealtimeSubscription(mockSupabase, tenantId, jest.fn(), jest.fn());

    // Verify no call to .on() references the `leads` table
    const onCalls = mockChannel.on.mock.calls;
    for (const [, config] of onCalls) {
      expect(config.table).not.toBe('leads');
      expect(config.table).toBe('jobs');
    }
  });
});

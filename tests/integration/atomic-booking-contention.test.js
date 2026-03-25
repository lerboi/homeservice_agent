import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

// Skip entire suite when Supabase credentials are absent (D-05)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCredentials = SUPABASE_URL && SUPABASE_KEY;

const describeFn = hasCredentials ? describe : describe.skip;

describeFn('atomicBookSlot contention (real Supabase)', () => {
  let supabase;
  let testTenantId;
  const slotStart = '2099-01-01T10:00:00.000Z';
  const slotEnd   = '2099-01-01T11:00:00.000Z';

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Create a test tenant with a unique owner_id (required UNIQUE NOT NULL column)
    // Use a random UUID so concurrent test runs don't collide
    const { randomUUID } = await import('crypto');
    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert({
        business_name: `Contention Test ${Date.now()}`,
        owner_id: randomUUID(),
      })
      .select('id')
      .single();

    if (error) throw new Error(`Test tenant setup failed: ${error.message}`);
    testTenantId = tenant.id;
  });

  afterAll(async () => {
    if (!testTenantId || !supabase) return;
    // Clean up in dependency order (D-06)
    await supabase.from('appointments').delete().eq('tenant_id', testTenantId);
    await supabase.from('leads').delete().eq('tenant_id', testTenantId);
    await supabase.from('tenants').delete().eq('id', testTenantId);
  });

  test('exactly 1 of 20 concurrent bookings succeeds', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        supabase.rpc('book_appointment_atomic', {
          p_tenant_id:       testTenantId,
          p_call_id:         null,
          p_start_time:      slotStart,
          p_end_time:        slotEnd,
          p_service_address: '123 Contention Test St',
          p_caller_name:     `Caller ${i + 1}`,
          p_caller_phone:    `+1555000${String(i).padStart(4, '0')}`,
          p_urgency:         'routine',
          p_zone_id:         null,
        })
      )
    );

    // Count successes: { data: { success: true } }
    const successes = results.filter(r => r.data?.success === true);

    // Count contention losses:
    //   - Advisory lock rejection: { data: { success: false, reason: 'slot_taken' } }
    //   - UNIQUE constraint violation (if 2 slip past the advisory lock): { error: non-null }
    // Both are valid "slot taken" outcomes — the RPC has no EXCEPTION handler for UNIQUE violations
    const contentionLosses = results.filter(
      r => (r.data?.success === false) || (r.error != null)
    );

    expect(successes).toHaveLength(1);
    expect(contentionLosses).toHaveLength(19);

    // Verify exactly 1 appointment row in DB for this slot
    const { data: rows, error: queryError } = await supabase
      .from('appointments')
      .select('id')
      .eq('tenant_id', testTenantId)
      .eq('start_time', slotStart);

    expect(queryError).toBeNull();
    expect(rows).toHaveLength(1);
  }, 30000); // 30s timeout for real DB round-trips
});

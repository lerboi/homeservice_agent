/**
 * Realtime scaffold test for the jobs table (Plan 06).
 *
 * Decision ID validated: D-15 (INSERT on jobs triggers Supabase Realtime subscription payload).
 *
 * Test is skipped until Plan 06 enables REPLICA IDENTITY FULL + Realtime publication for jobs.
 * Flip it.skip → it when implementing.
 */
import { describe, it } from 'vitest';

describe('jobs realtime (Plan 06)', () => {
  it.skip('INSERT on jobs triggers subscription payload (D-15)', () => {
    // Assert: subscribing to jobs:tenant_id=eq.<id> and inserting a row delivers
    //   a Realtime payload with eventType='INSERT' and the new row's data
    // Assert: payload includes job_id, customer_id, appointment_id, status
    // Assert: D-15 — dashboard can subscribe to new job creation without polling
  });
});

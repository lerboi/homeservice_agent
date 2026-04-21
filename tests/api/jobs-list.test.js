/**
 * API scaffold tests for /api/jobs list endpoint (Plan 04).
 *
 * Decision ID validated: D-06 (jobs joined with customer + appointment).
 *
 * All tests are skipped until Plan 04 implements the route handler.
 * Flip it.skip → it when implementing each case.
 */
import { describe, it } from 'vitest';

describe('jobs API (Plan 04)', () => {
  it.skip('GET /api/jobs returns jobs joined with customer + appointment', () => {
    // Assert: each row has { id, customer: { id, phone, name }, appointment: { id, start_time }, status }
    // Assert: D-06 — jobs.appointment_id NOT NULL means all returned rows have appointment data
  });

  it.skip('filters by status', () => {
    // Assert: GET /api/jobs?status=booked returns only booked jobs
    // Assert: GET /api/jobs?status=completed returns only completed jobs
  });
});

/**
 * API scaffold tests for /api/inquiries endpoint (Plan 04).
 *
 * Decision ID validated: D-10 (auto-convert inquiry → job).
 *
 * All tests are skipped until Plan 04 implements the route handler.
 * Flip it.skip → it when implementing each case.
 */
import { describe, it } from 'vitest';

describe('inquiries API (Plan 04)', () => {
  it.skip('GET /api/inquiries returns open inquiries by default', () => {
    // Assert: returns inquiries (leads without appointment_id) with status=new/open
    // Assert: each row has { id, customer: { id, phone, name }, job_type, urgency, created_at }
  });

  it.skip('POST /api/inquiries/:id/convert creates job (D-10)', () => {
    // Assert: POST { appointment_id } converts inquiry to a job row
    // Assert: inquiry status updated to 'converted'
    // Assert: new job row linked to same customer_id as the inquiry
    // Assert: D-10 — conversion is atomic (no partial state on failure)
  });
});

/**
 * API scaffold tests for /api/customers (Plan 04).
 *
 * Decision IDs validated: D-05 (phone immutability), D-18 (update non-phone fields),
 * D-19 (merge/unmerge customers).
 *
 * All tests are skipped until Plan 04 implements the route handlers.
 * Flip it.skip → it when implementing each case.
 */
import { describe, it } from 'vitest';

describe('customers API (Plan 04)', () => {
  it.skip('GET /api/customers returns list', () => {
    // Assert: returns array of customer objects with id, phone, name, tenant_id
  });

  it.skip('PATCH /api/customers/:id updates non-phone fields (D-18)', () => {
    // Assert: caller_name, service_address, notes can be updated
    // Assert: updated_at timestamp advances
  });

  it.skip('PATCH rejects phone changes (D-05 immutable)', () => {
    // Assert: PATCH with { phone: '+19995551234' } returns 422
    // Assert: error body contains "phone_immutable" or equivalent
  });

  it.skip('POST /api/customers/:id/merge repoints children (D-19)', () => {
    // Assert: POST { target_id } merges source into target
    // Assert: jobs, inquiries, activity_log rows repointed
    // Assert: source customer soft-deleted
  });

  it.skip('POST /api/customers/:id/unmerge restores within 7 days (D-19)', () => {
    // Assert: POST { merge_event_id } within 7-day window reverts merge
    // Assert: source customer reactivated
    // Assert: child records restored to source
  });
});

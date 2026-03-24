/**
 * Test scaffold: escalation-contacts API
 * Phase 12 — Dashboard-configurable Triage and Call Escalation
 *
 * Full integration tests will be implemented in a subsequent plan.
 * This scaffold verifies the test runner can load the module and
 * documents expected behaviors for each endpoint.
 */

import { jest } from '@jest/globals';

// Mock supabase before importing the route
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockUpsert = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();
const mockMaybeSingle = jest.fn();
const mockSingle = jest.fn();

const mockFrom = jest.fn(() => ({
  select: mockSelect.mockReturnThis(),
  insert: mockInsert.mockReturnThis(),
  update: mockUpdate.mockReturnThis(),
  upsert: mockUpsert.mockReturnThis(),
  eq: mockEq.mockReturnThis(),
  order: mockOrder.mockReturnThis(),
  limit: mockLimit.mockReturnThis(),
  maybeSingle: mockMaybeSingle,
  single: mockSingle,
}));

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

jest.unstable_mockModule('@/lib/get-tenant-id', () => ({
  getTenantId: jest.fn().mockResolvedValue('tenant-123'),
}));

describe('escalation-contacts API', () => {
  describe('GET /api/escalation-contacts', () => {
    test.todo('GET returns contacts ordered by sort_order ascending');
    test.todo('GET returns 401 when not authenticated');
    test.todo('GET returns empty array when no active contacts');
  });

  describe('POST /api/escalation-contacts', () => {
    test.todo('POST creates contact with computed sort_order');
    test.todo('POST rejects when 5 active contacts exist');
    test.todo('POST validates name is required');
    test.todo('POST validates phone required for SMS notification_pref');
    test.todo('POST validates email required for email notification_pref');
    test.todo('POST validates at least one of phone or email required');
    test.todo('POST returns 201 with created contact');
  });

  describe('PUT /api/escalation-contacts', () => {
    test.todo('PUT updates contact fields including updated_at');
    test.todo('PUT validates name is required');
    test.todo('PUT returns 400 when id is missing');
  });

  describe('DELETE /api/escalation-contacts', () => {
    test.todo('DELETE soft-deletes contact by setting is_active false');
    test.todo('DELETE sets updated_at timestamp');
    test.todo('DELETE returns { deleted: true }');
  });

  describe('PATCH /api/escalation-contacts (reorder)', () => {
    test.todo('PATCH reorders contacts with tenant_id in each upsert row');
    test.todo('PATCH returns { ok: true } on success');
    test.todo('PATCH returns 400 when order is not an array');
  });
});

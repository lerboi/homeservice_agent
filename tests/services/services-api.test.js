/**
 * Test scaffold: services API extensions
 * Phase 12 — Dashboard-configurable Triage and Call Escalation
 *
 * Tests the extended services route: sort_order in GET, bulk tag PUT, PATCH reorder.
 * Full integration tests will be implemented in a subsequent plan.
 */

import { jest } from '@jest/globals';

// Mock supabase before importing the route
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockUpsert = jest.fn();
const mockEq = jest.fn();
const mockIn = jest.fn();
const mockOrder = jest.fn();
const mockSingle = jest.fn();

const mockFrom = jest.fn(() => ({
  select: mockSelect.mockReturnThis(),
  insert: mockInsert.mockReturnThis(),
  update: mockUpdate.mockReturnThis(),
  upsert: mockUpsert.mockReturnThis(),
  eq: mockEq.mockReturnThis(),
  in: mockIn.mockReturnThis(),
  order: mockOrder.mockReturnThis(),
  single: mockSingle,
}));

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

jest.unstable_mockModule('@/lib/get-tenant-id', () => ({
  getTenantId: jest.fn().mockResolvedValue('tenant-123'),
}));

describe('services API extensions', () => {
  describe('GET /api/services', () => {
    test.todo('GET returns services with sort_order field included');
    test.todo('GET orders by sort_order ascending, then created_at ascending');
    test.todo('GET returns 401 when not authenticated');
  });

  describe('PUT /api/services — bulk update', () => {
    test.todo('PUT bulk updates urgency_tag for multiple IDs using .in() filter');
    test.todo('PUT returns { updated: true, count: N } for bulk update');
    test.todo('PUT rejects invalid urgency_tag for bulk update');
    test.todo('PUT rejects empty ids array');
  });

  describe('PUT /api/services — single update', () => {
    test.todo('PUT single update still works with { id, urgency_tag }');
    test.todo('PUT returns updated service for single update');
  });

  describe('PATCH /api/services (reorder)', () => {
    test.todo('PATCH reorders services with tenant_id in each upsert row');
    test.todo('PATCH returns { ok: true } on success');
    test.todo('PATCH returns 400 when order is not an array');
  });
});

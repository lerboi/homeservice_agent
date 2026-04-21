/**
 * Tests for subscription enforcement gate.
 * Phase 25-01: ENFORCE-01, ENFORCE-02
 *
 * The enforcement gate checks subscription status and blocks calls for
 * cancelled/paused/incomplete tenants. Extracted into src/lib/subscription-gate.js
 * since the LiveKit agent runs as a separate Python service in a sibling repo
 * (C:/Users/leheh/.Projects/livekit-agent, deployed to Railway) and is not
 * directly testable here.
 *
 * Note: Architecture deviation from plan — the original target was
 * src/app/api/webhooks/retell/route.js, but that file was removed in the
 * Retell→LiveKit migration. The enforcement logic now lives in
 * src/lib/subscription-gate.js (queried by the sibling-repo LiveKit agent
 * on every inbound call).
 *
 * Test 1: Returns { blocked: true, reason: 'subscription_inactive' } when status is 'canceled'
 * Test 2: Returns { blocked: true, reason: 'subscription_inactive' } when status is 'paused'
 * Test 3: Returns { blocked: true, reason: 'subscription_inactive' } when status is 'incomplete'
 * Test 4: Returns { blocked: false } when status is 'active'
 * Test 5: Returns { blocked: false } when status is 'trialing'
 * Test 6: Returns { blocked: false } when status is 'past_due' (3-day grace per D-05)
 * Test 7: Returns { blocked: false } when no subscription row exists (trial not yet started)
 * Test 8: Does NOT include 'past_due' in blocked statuses
 * Test 9: blockedStatuses constant contains exactly 'canceled', 'paused', 'incomplete'
 * Test 10: Returns { blocked: false } when subscription query errors (fail open — per D-06 error resilience)
 */

import { jest } from '@jest/globals';

// ─── Module-level mock state ───────────────────────────────────────────────────

let mockSubscriptionData = null;
let mockSubscriptionError = null;

const mockSupabase = {
  from: jest.fn((table) => {
    if (table === 'subscriptions') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockSubscriptionData,
          error: mockSubscriptionError,
        }),
      };
    }
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
  }),
};

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

// ─── Import after mocking ───────────────────────────────────────────────────────

const { checkSubscriptionGate, BLOCKED_STATUSES } = await import('@/lib/subscription-gate.js');

// ─── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockSubscriptionData = null;
  mockSubscriptionError = null;
  jest.clearAllMocks();
  // Re-setup mock after clearAllMocks
  mockSupabase.from.mockImplementation((table) => {
    if (table === 'subscriptions') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockSubscriptionData,
          error: mockSubscriptionError,
        }),
      };
    }
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
  });
});

describe('checkSubscriptionGate', () => {
  it('Test 1: returns blocked=true when subscription status is canceled', async () => {
    mockSubscriptionData = { status: 'canceled' };
    const result = await checkSubscriptionGate(mockSupabase, 'tenant-1');
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('subscription_inactive');
  });

  it('Test 2: returns blocked=true when subscription status is paused', async () => {
    mockSubscriptionData = { status: 'paused' };
    const result = await checkSubscriptionGate(mockSupabase, 'tenant-1');
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('subscription_inactive');
  });

  it('Test 3: returns blocked=true when subscription status is incomplete', async () => {
    mockSubscriptionData = { status: 'incomplete' };
    const result = await checkSubscriptionGate(mockSupabase, 'tenant-1');
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('subscription_inactive');
  });

  it('Test 4: returns blocked=false when subscription status is active', async () => {
    mockSubscriptionData = { status: 'active' };
    const result = await checkSubscriptionGate(mockSupabase, 'tenant-1');
    expect(result.blocked).toBe(false);
  });

  it('Test 5: returns blocked=false when subscription status is trialing', async () => {
    mockSubscriptionData = { status: 'trialing' };
    const result = await checkSubscriptionGate(mockSupabase, 'tenant-1');
    expect(result.blocked).toBe(false);
  });

  it('Test 6: returns blocked=false when subscription status is past_due (3-day grace)', async () => {
    mockSubscriptionData = { status: 'past_due' };
    const result = await checkSubscriptionGate(mockSupabase, 'tenant-1');
    expect(result.blocked).toBe(false);
  });

  it('Test 7: returns blocked=false when no subscription row exists', async () => {
    mockSubscriptionData = null; // no subscription
    const result = await checkSubscriptionGate(mockSupabase, 'tenant-1');
    expect(result.blocked).toBe(false);
  });

  it('Test 8: past_due is NOT in the blocked statuses', () => {
    expect(BLOCKED_STATUSES).not.toContain('past_due');
  });

  it('Test 9: blockedStatuses contains exactly canceled, paused, incomplete', () => {
    expect(BLOCKED_STATUSES).toEqual(
      expect.arrayContaining(['canceled', 'paused', 'incomplete'])
    );
    expect(BLOCKED_STATUSES).toHaveLength(3);
  });

  it('Test 10: returns blocked=false when subscription query errors (fail open)', async () => {
    mockSubscriptionData = null;
    mockSubscriptionError = new Error('DB connection failed');
    const result = await checkSubscriptionGate(mockSupabase, 'tenant-1');
    expect(result.blocked).toBe(false);
  });
});

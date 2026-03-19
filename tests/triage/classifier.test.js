/**
 * Tests for the three-layer classifier orchestrator.
 * Covers: Layer 1 short-circuit, Layer 2 fallback, Layer 3 escalation/no-downgrade,
 * empty transcript guard, LLM parse error fallback.
 */

import { jest } from '@jest/globals';

// ─── Mock OpenAI ──────────────────────────────────────────────────────────────

const mockChatCompletionsCreate = jest.fn();

jest.unstable_mockModule('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockChatCompletionsCreate,
      },
    },
  })),
}));

// ─── Mock Supabase ────────────────────────────────────────────────────────────

// Mock supabase with chainable query builder that resolves on the final .eq() call.
// The services query chain is: .from('services').select(...).eq('tenant_id', ...).eq('is_active', true)
// We mock the entire chain by returning a fresh query builder per test.

let mockServicesResult = { data: [], error: null };

const createServicesQuery = () => {
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockImplementation(() => {
      // Return a new object that resolves as a promise on the second .eq() call
      return {
        eq: jest.fn().mockImplementation(() => Promise.resolve(mockServicesResult)),
      };
    }),
  };
  return query;
};

const mockSupabase = {
  from: jest.fn((table) => {
    if (table === 'services') return createServicesQuery();
    return {};
  }),
};

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

// ─── Import modules under test (after mocks) ─────────────────────────────────

let classifyCall;

beforeAll(async () => {
  const module = await import('@/lib/triage/classifier.js');
  classifyCall = module.classifyCall;
});

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no services found for tenant
  mockServicesResult = { data: [], error: null };
});

// ─── Layer 1 confident emergency — skip LLM ───────────────────────────────────

describe('classifyCall — Layer 1 confident emergency', () => {
  it('skips Layer 2 (LLM) and returns emergency when Layer 1 is confident', async () => {
    const result = await classifyCall({
      transcript: 'my basement is flooding right now',
      tenant_id: 'tenant-uuid',
      detected_service: null,
    });

    expect(result.urgency).toBe('emergency');
    expect(result.confidence).toBeDefined();
    expect(result.layer).toBe('layer1');
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled();
  });
});

// ─── Layer 1 confident routine — skip LLM ────────────────────────────────────

describe('classifyCall — Layer 1 confident routine', () => {
  it('skips Layer 2 (LLM) and returns routine when Layer 1 confident routine', async () => {
    const result = await classifyCall({
      transcript: 'I need a quote for next month',
      tenant_id: 'tenant-uuid',
      detected_service: null,
    });

    expect(result.urgency).toBe('routine');
    expect(result.layer).toBe('layer1');
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled();
  });
});

// ─── Layer 1 not confident — calls Layer 2 LLM ───────────────────────────────

describe('classifyCall — Layer 1 not confident, calls LLM', () => {
  it('calls LLM when Layer 1 is not confident', async () => {
    mockChatCompletionsCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              urgency: 'routine',
              confidence: 'medium',
              reason: 'dripping faucet is not urgent',
            }),
          },
        },
      ],
    });

    const result = await classifyCall({
      transcript: 'my faucet is dripping a little',
      tenant_id: 'tenant-uuid',
      detected_service: null,
    });

    expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1);
    expect(result.urgency).toBe('routine');
    expect(result.layer).toBe('layer2');
  });
});

// ─── Layer 3 escalation ───────────────────────────────────────────────────────

describe('classifyCall — Layer 3 escalates routine to emergency', () => {
  it('escalates to emergency when owner has emergency-tagged service matching transcript', async () => {
    mockChatCompletionsCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              urgency: 'routine',
              confidence: 'low',
              reason: 'ambiguous',
            }),
          },
        },
      ],
    });

    // Override services result for this test — emergency-tagged service
    mockServicesResult = {
      data: [{ name: 'Water Heater Repair', urgency_tag: 'emergency' }],
      error: null,
    };

    const result = await classifyCall({
      transcript: 'my water heater is broken',
      tenant_id: 'tenant-uuid',
      detected_service: 'Water Heater Repair',
    });

    expect(result.urgency).toBe('emergency');
    expect(result.layer).toBe('layer3');
  });
});

// ─── Layer 3 never downgrades emergency ───────────────────────────────────────

describe('classifyCall — Layer 3 never downgrades emergency', () => {
  it('keeps emergency even when owner services have only routine tags', async () => {
    // Layer 1 detects emergency — no LLM call
    // Layer 3 services: all routine
    mockServicesResult = {
      data: [{ name: 'Drain Cleaning', urgency_tag: 'routine' }],
      error: null,
    };

    const result = await classifyCall({
      transcript: 'pipe burst and water is everywhere emergency',
      tenant_id: 'tenant-uuid',
      detected_service: 'Drain Cleaning',
    });

    expect(result.urgency).toBe('emergency');
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled();
  });
});

// ─── Empty / short transcript ─────────────────────────────────────────────────

describe('classifyCall — empty/short transcript guard', () => {
  it('returns routine/low without calling LLM for empty transcript', async () => {
    const result = await classifyCall({
      transcript: '',
      tenant_id: 'tenant-uuid',
      detected_service: null,
    });

    expect(result.urgency).toBe('routine');
    expect(result.confidence).toBe('low');
    expect(result.layer).toBe('layer1');
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled();
  });

  it('returns routine/low without calling LLM for very short transcript', async () => {
    const result = await classifyCall({
      transcript: 'hi',
      tenant_id: 'tenant-uuid',
      detected_service: null,
    });

    expect(result.urgency).toBe('routine');
    expect(result.confidence).toBe('low');
    expect(result.layer).toBe('layer1');
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled();
  });
});

// ─── LLM parse error fallback ─────────────────────────────────────────────────

describe('classifyCall — LLM parse error fallback', () => {
  it('falls back to routine/low when LLM returns unparseable JSON', async () => {
    mockChatCompletionsCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: 'not valid json at all',
          },
        },
      ],
    });

    const result = await classifyCall({
      transcript: 'my faucet has been making a weird noise for a while',
      tenant_id: 'tenant-uuid',
      detected_service: null,
    });

    expect(result.urgency).toBe('routine');
    expect(result.confidence).toBe('low');
  });
});

/**
 * Tests for Layer 1 keyword/regex classifier.
 * Covers: emergency keywords, routine keywords, ambiguous transcripts, short/empty input.
 */

import { jest } from '@jest/globals';

let runKeywordClassifier;

beforeAll(async () => {
  const module = await import('@/lib/triage/layer1-keywords.js');
  runKeywordClassifier = module.runKeywordClassifier;
});

// ─── Emergency keywords ───────────────────────────────────────────────────────

describe('Layer 1 — emergency detection', () => {
  it('classifies "my basement is flooding" as emergency with high confidence', () => {
    const result = runKeywordClassifier('my basement is flooding');
    expect(result.result).toBe('emergency');
    expect(result.confident).toBe(true);
    expect(result.matched).toBeDefined();
  });

  it('classifies "gas smell in the kitchen" as emergency with high confidence', () => {
    const result = runKeywordClassifier('gas smell in the kitchen');
    expect(result.result).toBe('emergency');
    expect(result.confident).toBe(true);
  });

  it('classifies "pipe burst" as emergency with high confidence', () => {
    const result = runKeywordClassifier('pipe burst under the sink');
    expect(result.result).toBe('emergency');
    expect(result.confident).toBe(true);
  });

  it('classifies "carbon monoxide" as emergency with high confidence', () => {
    const result = runKeywordClassifier('I think there is carbon monoxide in my house');
    expect(result.result).toBe('emergency');
    expect(result.confident).toBe(true);
  });

  it('classifies "electrical fire" as emergency with high confidence', () => {
    const result = runKeywordClassifier('there are electrical sparks from the outlet');
    expect(result.result).toBe('emergency');
    expect(result.confident).toBe(true);
  });

  it('classifies "no heat" as emergency', () => {
    const result = runKeywordClassifier('we have no heat and it is freezing');
    expect(result.result).toBe('emergency');
    expect(result.confident).toBe(true);
  });
});

// ─── Routine keywords ─────────────────────────────────────────────────────────

describe('Layer 1 — routine detection', () => {
  it('classifies "I need a quote for next month" as routine with high confidence', () => {
    const result = runKeywordClassifier('I need a quote for next month');
    expect(result.result).toBe('routine');
    expect(result.confident).toBe(true);
  });

  it('classifies "not urgent, whenever you can" as routine with high confidence', () => {
    const result = runKeywordClassifier('not urgent, whenever you can');
    expect(result.result).toBe('routine');
    expect(result.confident).toBe(true);
  });
});

// ─── Ambiguous / no keyword match ─────────────────────────────────────────────

describe('Layer 1 — ambiguous transcripts', () => {
  it('returns confident:false for ambiguous transcript with no keyword match', () => {
    const result = runKeywordClassifier('my faucet is dripping a little');
    expect(result.confident).toBe(false);
    expect(result.result).toBe('routine');
  });

  it('returns confident:false for empty string', () => {
    const result = runKeywordClassifier('');
    expect(result.confident).toBe(false);
    expect(result.result).toBe('routine');
  });

  it('returns confident:false for short transcript (< 10 chars)', () => {
    const result = runKeywordClassifier('hi');
    expect(result.confident).toBe(false);
    expect(result.result).toBe('routine');
  });

  it('returns confident:false for null input', () => {
    const result = runKeywordClassifier(null);
    expect(result.confident).toBe(false);
    expect(result.result).toBe('routine');
  });
});

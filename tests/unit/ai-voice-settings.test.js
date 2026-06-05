/**
 * Unit tests for AI voice settings validation and API route structure.
 *
 * Tests the pure validation logic in src/lib/ai-voice-validation.js
 * and validates the route source structure via file inspection.
 *
 * Pattern follows Phase 37 precedent: pure JS validation extracted to
 * src/lib/ai-voice-validation.js for direct testability without Supabase deps.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { VALID_VOICES, isValidVoice } from '../../src/lib/ai-voice-validation.js';

// --- Pure validation logic tests ---

describe('VALID_VOICES', () => {
  // Test 1: All 10 OpenAI realtime voices are present (Phase 65 migration)
  it('contains all 10 curated OpenAI gpt-realtime voices', () => {
    expect(VALID_VOICES).toHaveLength(10);
    ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'].forEach(
      (v) => expect(VALID_VOICES).toContain(v),
    );
  });

  // Test 1b: The retired Gemini voices are no longer valid
  it('no longer contains the old Gemini voices', () => {
    ['Aoede', 'Erinome', 'Sulafat', 'Zephyr', 'Achird', 'Charon'].forEach(
      (v) => expect(VALID_VOICES).not.toContain(v),
    );
  });
});

describe('isValidVoice (allowlist validation)', () => {
  // Test 2: Valid voice name returns true
  it('returns true for a valid voice name (marin)', () => {
    expect(isValidVoice('marin')).toBe(true);
  });

  // Test 3: Invalid voice name returns false
  it('returns false for an invalid voice name (InvalidVoice)', () => {
    expect(isValidVoice('InvalidVoice')).toBe(false);
  });

  // Test 3b: A retired Gemini voice is now rejected
  it('returns false for a retired Gemini voice (Zephyr)', () => {
    expect(isValidVoice('Zephyr')).toBe(false);
  });

  // Test 4: All 10 valid voices pass (parameterized)
  const validVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
  it.each(validVoices)('returns true for valid voice: %s', (voice) => {
    expect(isValidVoice(voice)).toBe(true);
  });

  // Test 5: Uppercase voice name is rejected (case-sensitive)
  it('returns false for uppercase voice name (MARIN) — case-sensitive', () => {
    expect(isValidVoice('MARIN')).toBe(false);
  });

  // Additional: empty string, null-like inputs
  it('returns false for empty string', () => {
    expect(isValidVoice('')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isValidVoice(undefined)).toBe(false);
  });
});

// --- Route source structure validation ---

describe('PATCH /api/ai-voice-settings route structure', () => {
  let content;

  beforeAll(() => {
    const filePath = resolve('./src/app/api/ai-voice-settings/route.js');
    content = readFileSync(filePath, 'utf-8');
  });

  it('exports PATCH function', () => {
    expect(content).toContain('export async function PATCH');
  });

  it('imports getTenantId from get-tenant-id', () => {
    expect(content).toContain("import { getTenantId } from '@/lib/get-tenant-id'");
  });

  it('imports supabase from supabase lib', () => {
    expect(content).toContain("import { supabase } from '@/lib/supabase'");
  });

  it('uses getTenantId for auth check', () => {
    expect(content).toContain('getTenantId()');
    expect(content).toContain("error: 'Unauthorized'");
    expect(content).toContain('status: 401');
  });

  it('rejects invalid voice with 400', () => {
    expect(content).toContain("error: 'Invalid voice selection'");
    expect(content).toContain('status: 400');
  });

  it('updates tenants table with ai_voice', () => {
    expect(content).toContain("from('tenants')");
    expect(content).toContain('update({ ai_voice })');
  });

  it('returns ai_voice in successful response', () => {
    expect(content).toContain('return Response.json({ ai_voice })');
  });
});

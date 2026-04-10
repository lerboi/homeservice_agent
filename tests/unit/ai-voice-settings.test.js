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
  // Test 1: All 6 curated voices are present
  it('contains all 6 curated Gemini voices', () => {
    expect(VALID_VOICES).toHaveLength(6);
    expect(VALID_VOICES).toContain('Aoede');
    expect(VALID_VOICES).toContain('Erinome');
    expect(VALID_VOICES).toContain('Sulafat');
    expect(VALID_VOICES).toContain('Zephyr');
    expect(VALID_VOICES).toContain('Achird');
    expect(VALID_VOICES).toContain('Charon');
  });
});

describe('isValidVoice (allowlist validation)', () => {
  // Test 2: Valid voice name returns true
  it('returns true for a valid voice name (Aoede)', () => {
    expect(isValidVoice('Aoede')).toBe(true);
  });

  // Test 3: Invalid voice name returns false
  it('returns false for an invalid voice name (InvalidVoice)', () => {
    expect(isValidVoice('InvalidVoice')).toBe(false);
  });

  // Test 4: All 6 valid voices pass (parameterized)
  const validVoices = ['Aoede', 'Erinome', 'Sulafat', 'Zephyr', 'Achird', 'Charon'];
  it.each(validVoices)('returns true for valid voice: %s', (voice) => {
    expect(isValidVoice(voice)).toBe(true);
  });

  // Test 5: Lowercase voice name is rejected (case-sensitive)
  it('returns false for lowercase voice name (aoede) — case-sensitive', () => {
    expect(isValidVoice('aoede')).toBe(false);
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

/**
 * Unit tests for E.164 phone normalization helper.
 * D-05: Phone E.164 normalization for customer dedup.
 *
 * Sample set mirrors Python _normalize_phone behavior from livekit-agent.
 * Run: npx vitest run src/lib/phone/normalize.test.js
 */
import { describe, it, expect } from 'vitest';
import { normalizeE164, isValidE164, formatInternational } from './normalize.js';

describe('normalizeE164', () => {
  it('passes through an already-E.164 US number unchanged', () => {
    expect(normalizeE164('+15551234567')).toBe('+15551234567');
  });

  it('normalizes a US 10-digit number with countryHint US', () => {
    expect(normalizeE164('5551234567', 'US')).toBe('+15551234567');
  });

  it('normalizes a US 11-digit number with country code prefix', () => {
    expect(normalizeE164('15551234567', 'US')).toBe('+15551234567');
  });

  it('normalizes an SG 8-digit number with countryHint SG', () => {
    expect(normalizeE164('91234567', 'SG')).toBe('+6591234567');
  });

  it('passes through an already-E.164 SG number unchanged', () => {
    expect(normalizeE164('+6591234567')).toBe('+6591234567');
  });

  it('throws on empty string', () => {
    expect(() => normalizeE164('')).toThrow('phone_required');
  });

  it('throws on null', () => {
    expect(() => normalizeE164(null)).toThrow('phone_required');
  });

  it('throws on invalid input "abc"', () => {
    expect(() => normalizeE164('abc')).toThrow('phone_invalid');
  });
});

describe('isValidE164', () => {
  it('returns true for a valid E.164 number', () => {
    expect(isValidE164('+15551234567')).toBe(true);
  });

  it('returns false for a number without + prefix', () => {
    expect(isValidE164('5551234567')).toBe(false);
  });

  it('returns false for non-string', () => {
    expect(isValidE164(null)).toBe(false);
    expect(isValidE164(undefined)).toBe(false);
    expect(isValidE164(15551234567)).toBe(false);
  });

  it('returns false for + only', () => {
    expect(isValidE164('+')).toBe(false);
  });
});

describe('formatInternational', () => {
  it('formats a US E.164 number in international format', () => {
    expect(formatInternational('+15551234567')).toBe('+1 555 123 4567');
  });

  it('returns input unchanged for unrecognized format', () => {
    const result = formatInternational('not-a-number');
    expect(result).toBe('not-a-number');
  });
});

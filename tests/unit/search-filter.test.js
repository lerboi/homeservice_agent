/**
 * Unit tests for escapeOrTerm (src/lib/search-filter.js).
 *
 * escapeOrTerm sanitizes user search input before interpolation into PostgREST
 * .or()/.filter() value positions. It must strip the PostgREST-reserved
 * characters , ( ) and backslash (which let a value break out of its operator
 * slot) while leaving legitimate search characters intact.
 */

import { describe, it, expect } from '@jest/globals';
import { escapeOrTerm } from '../../src/lib/search-filter.js';

describe('escapeOrTerm', () => {
  it('replaces commas with spaces', () => {
    expect(escapeOrTerm('a,b')).toBe('a b');
    expect(escapeOrTerm('a,,b')).toBe('a  b');
  });

  it('replaces parentheses with spaces', () => {
    expect(escapeOrTerm('a(b)c')).toBe('a b c');
  });

  it('replaces backslashes with spaces', () => {
    expect(escapeOrTerm('a\\b')).toBe('a b');
  });

  it('neutralizes a PostgREST injection payload', () => {
    // An attempt to inject an extra OR clause: the comma + parens are the
    // breakout characters and must all be stripped.
    const out = escapeOrTerm('x,tenant_id.eq.(00000000-0000-0000-0000-000000000000)');
    expect(out).not.toContain(',');
    expect(out).not.toContain('(');
    expect(out).not.toContain(')');
  });

  it('preserves apostrophes (e.g. O\'Brien)', () => {
    expect(escapeOrTerm("O'Brien")).toBe("O'Brien");
  });

  it('preserves dots (e.g. emails)', () => {
    expect(escapeOrTerm('jane.doe@example.com')).toBe('jane.doe@example.com');
  });

  it('preserves digits (e.g. phone numbers)', () => {
    expect(escapeOrTerm('+1 415 555 0123')).toBe('+1 415 555 0123');
  });

  it('preserves PostgREST wildcards and underscores', () => {
    expect(escapeOrTerm('foo%_bar*')).toBe('foo%_bar*');
  });

  it('coerces null/undefined to an empty string', () => {
    expect(escapeOrTerm(null)).toBe('');
    expect(escapeOrTerm(undefined)).toBe('');
  });

  it('coerces non-strings to strings', () => {
    expect(escapeOrTerm(123)).toBe('123');
  });
});

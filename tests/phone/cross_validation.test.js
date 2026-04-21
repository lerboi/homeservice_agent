/**
 * Python parity cross-validation test.
 * D-05: Phone E.164 normalization for customer dedup.
 *
 * Asserts that normalizeE164(raw, countryHint) === expected for every row in
 * the fixture generated from Python _normalize_free_form output
 * (phonenumbers.parse + is_possible_number → E.164).
 *
 * All fixture numbers use synthetic/reserved ranges — no real caller PII.
 * (Threat model T-59-01-03: use synthetic numbers only.)
 *
 * Run: npx vitest run tests/phone/cross_validation.test.js
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { normalizeE164 } from '../../src/lib/phone/normalize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesPath = join(__dirname, 'fixtures', 'python_parity.json');
const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf-8'));

describe('normalizeE164 — Python parity (cross-validation)', () => {
  for (const { raw, countryHint, expected, note } of fixtures) {
    it(`${note}: normalizeE164("${raw}", ${JSON.stringify(countryHint)}) === "${expected}"`, () => {
      expect(normalizeE164(raw, countryHint)).toBe(expected);
    });
  }
});

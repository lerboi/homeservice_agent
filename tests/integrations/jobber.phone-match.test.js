/**
 * Contract tests for libphonenumber-js — the library we use to normalize
 * Jobber's free-form `Client.phones[].number` strings to E.164.
 */

import { parsePhoneNumberFromString } from 'libphonenumber-js';

describe('libphonenumber-js Jobber phone normalization', () => {
  it('P1: "(555) 123-4567" → +15551234567 with US default', () => {
    expect(parsePhoneNumberFromString('(555) 123-4567', 'US').format('E.164')).toBe('+15551234567');
  });

  it('P2: "555-1234" (7-digit local) is NOT valid — documented skip case', () => {
    const r = parsePhoneNumberFromString('555-1234', 'US');
    expect(r?.isValid() ?? false).toBe(false);
  });

  it('P3: "+1 555.123.4567" → +15551234567', () => {
    expect(parsePhoneNumberFromString('+1 555.123.4567', 'US').format('E.164')).toBe('+15551234567');
  });

  it('P4: "gibberish" returns undefined (filter before compare)', () => {
    expect(parsePhoneNumberFromString('gibberish', 'US')).toBeUndefined();
  });
});

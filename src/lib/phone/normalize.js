/**
 * E.164 phone number normalization for Voco.
 * D-05: Phone E.164 normalization for customer dedup.
 *
 * Wraps libphonenumber-js to produce output matching the Python agent's
 * _normalize_phone / _normalize_free_form behavior (phonenumbers library).
 *
 * Usage:
 *   import { normalizeE164, isValidE164, formatInternational } from '@/lib/phone/normalize.js';
 */
import { parsePhoneNumber, isPossiblePhoneNumber } from 'libphonenumber-js';

/**
 * Normalize any phone string to E.164 format.
 *
 * @param {string|null|undefined} raw - Raw phone number (E.164, 10-digit US, etc.)
 * @param {string|null} countryHint - ISO 3166-1 alpha-2 country code hint (e.g. 'US', 'SG')
 * @returns {string} E.164 formatted phone number (e.g. '+15551234567')
 * @throws {Error} 'phone_required' if raw is empty/null/undefined
 * @throws {Error} 'phone_invalid' if the number cannot be parsed or is invalid
 */
export function normalizeE164(raw, countryHint = null) {
  if (!raw) throw new Error('phone_required');
  let parsed;
  try {
    parsed = parsePhoneNumber(raw, countryHint ?? undefined);
  } catch {
    throw new Error('phone_invalid');
  }
  // Use isPossiblePhoneNumber to match Python phonenumbers.is_possible_number()
  // (Python's _normalize_free_form uses is_possible_number, not is_valid_number,
  // so 555-range US numbers that are syntactically possible are accepted)
  if (!parsed || !isPossiblePhoneNumber(raw, countryHint ?? undefined)) throw new Error('phone_invalid');
  return parsed.format('E.164');
}

/**
 * Check if a string is already a valid E.164 phone number.
 * Does NOT parse — only validates the format regex.
 *
 * @param {*} s - Value to check
 * @returns {boolean}
 */
export function isValidE164(s) {
  return typeof s === 'string' && /^\+[1-9]\d{6,14}$/.test(s);
}

/**
 * Format an E.164 number in international display format.
 *
 * @param {string} e164 - E.164 phone number
 * @returns {string} International format (e.g. '+1 555 123 4567') or original string if parse fails
 */
export function formatInternational(e164) {
  let parsed;
  try {
    parsed = parsePhoneNumber(e164);
  } catch {
    return e164;
  }
  return parsed ? parsed.formatInternational() : e164;
}

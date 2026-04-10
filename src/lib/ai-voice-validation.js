/**
 * AI Voice Validation
 * Pure validation logic for AI voice selection.
 * Extracted to a separate module for testability (no Supabase dependencies).
 */

export const VALID_VOICES = ['Aoede', 'Erinome', 'Sulafat', 'Zephyr', 'Achird', 'Charon'];

/**
 * Validates a voice name against the curated allowlist.
 * Case-sensitive — voice names must match exactly as listed in VALID_VOICES.
 *
 * @param {string} voice - The voice name to validate
 * @returns {boolean} true if the voice is valid, false otherwise
 */
export function isValidVoice(voice) {
  return VALID_VOICES.includes(voice);
}

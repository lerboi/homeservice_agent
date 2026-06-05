/**
 * AI Voice Validation
 * Pure validation logic for AI voice selection.
 * Extracted to a separate module for testability (no Supabase dependencies).
 */

// Phase 65: OpenAI gpt-realtime voice set (migrated from the 6 Gemini voices).
// Kept in sync with supabase/migrations/067_ai_voice_openai.sql CHECK and the
// agent repo VOICE_MAP (professional=marin, friendly=cedar, local_expert=alloy).
export const VALID_VOICES = [
  'alloy', 'ash', 'ballad', 'coral', 'echo',
  'sage', 'shimmer', 'verse', 'marin', 'cedar',
];

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

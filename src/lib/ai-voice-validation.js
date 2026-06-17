/**
 * AI Voice Validation
 * Pure validation logic for AI voice selection.
 * Extracted to a separate module for testability (no Supabase dependencies).
 */

// Phase 66 (cascade pipeline): ai_voice stores a stable voice LABEL, not a
// provider voice name. The agent repo's ELEVENLABS_VOICE_MAP resolves each
// label to an ElevenLabs voice_id, so swapping the actual voice is a one-line
// agent change and never needs a DB migration. Kept in sync with
// supabase/migrations/070_ai_voice_labels.sql CHECK and livekit-agent
// src/agent.py ELEVENLABS_VOICE_MAP. (The Phase 65 OpenAI names this replaced
// were silently ignored by the agent — selection was a no-op.)
export const VALID_VOICES = ['professional', 'friendly', 'local_expert'];

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

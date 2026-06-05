-- Migration 067: Migrate ai_voice from the Gemini voice set to OpenAI realtime voices
-- Phase 65: voice brain migrated Gemini 3.1 Flash Live -> OpenAI gpt-realtime-2.
--
-- 1. Drop the old CHECK from migration 044 (which allowed the 6 curated Gemini
--    voices: Aoede, Erinome, Sulafat, Zephyr, Achird, Charon). Migration 044
--    created it as an inline column constraint, which Postgres named
--    tenants_ai_voice_check.
-- 2. Clear every tenant's ai_voice to NULL (decision #2): the effective default
--    becomes the tone-based fallback, and the professional voice (marin) is the
--    standard. A NULL ai_voice -> tone fallback resolves correctly under BOTH
--    the old Gemini agent AND the new OpenAI agent, so this migration is
--    forward-only and safe even if the agent cutover is delayed (see
--    docs/OPENAI-REALTIME-2-MIGRATION.md §13 rollback).
-- 3. Add a new CHECK allowing NULL or the OpenAI gpt-realtime voice set.
--    Kept in sync with src/lib/ai-voice-validation.js VALID_VOICES and the
--    agent repo VOICE_MAP (professional=marin, friendly=cedar, local_expert=alloy).

ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_ai_voice_check;

UPDATE tenants SET ai_voice = NULL WHERE ai_voice IS NOT NULL;

ALTER TABLE tenants
  ADD CONSTRAINT tenants_ai_voice_check CHECK (
    ai_voice IS NULL OR ai_voice IN (
      'alloy', 'ash', 'ballad', 'coral', 'echo',
      'sage', 'shimmer', 'verse', 'marin', 'cedar'
    )
  );

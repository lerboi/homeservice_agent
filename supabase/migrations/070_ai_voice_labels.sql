-- ============================================================
-- 070_ai_voice_labels.sql
-- tenants.ai_voice: OpenAI voice names -> stable voice LABELS.
--
-- Phase 66 moved TTS from OpenAI gpt-realtime voices to ElevenLabs. The agent
-- (livekit-agent src/agent.py ELEVENLABS_VOICE_MAP) resolves tenants.ai_voice
-- as a stable LABEL — professional / friendly / local_expert — and silently
-- ignores anything else (falls back to the tone_preset voice). Migration 067's
-- CHECK still allowed only the 10 OpenAI names, so:
--   1. the dashboard voice picker wrote OpenAI names the agent ignores
--      (selection was a silent no-op for every tenant), and
--   2. the planned label-writing picker would violate the CHECK (500).
-- The agent code comments reference a "migration 068" that stores labels —
-- that migration was never written (068 is billing hardening). This is it.
--
-- Deploy order: run this BEFORE deploying the main-repo picker change
-- (src/lib/ai-voice-validation.js VALID_VOICES -> labels). The agent needs no
-- coordination: it already handles every possible stored value via fallback.
--
-- Idempotent: re-runnable (DROP IF EXISTS + guarded UPDATE).
-- ============================================================

BEGIN;

ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_ai_voice_check;

-- Clear stale OpenAI-era values (live DB: all NULL as of 2026-06-12, so this
-- is expected to be a no-op — kept for safety on any environment where a
-- tenant selected a voice before this migration ran).
UPDATE tenants
SET ai_voice = NULL
WHERE ai_voice IS NOT NULL
  AND ai_voice NOT IN ('professional', 'friendly', 'local_expert');

ALTER TABLE tenants
  ADD CONSTRAINT tenants_ai_voice_check CHECK (
    ai_voice IS NULL OR ai_voice IN ('professional', 'friendly', 'local_expert')
  );

COMMIT;

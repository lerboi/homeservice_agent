-- Migration 044: Add ai_voice column to tenants
-- Phase 44: AI Voice Selection
--
-- Additive-only. ai_voice TEXT nullable — NULL means use VOICE_MAP[tone_preset] fallback.
-- No backfill per D-17. Existing tenants keep NULL until they actively choose.
-- CHECK constraint enforces the 6 curated Gemini voice names (case-sensitive per Pitfall 3).

ALTER TABLE tenants
  ADD COLUMN ai_voice TEXT CHECK (
    ai_voice IS NULL OR ai_voice IN ('Aoede', 'Erinome', 'Sulafat', 'Zephyr', 'Achird', 'Charon')
  );

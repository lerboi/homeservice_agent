-- 018_intake_questions.sql
-- Phase 30: Add intake questions to services table for trade-specific AI questioning

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS intake_questions jsonb;

-- No default, no NOT NULL -- existing services get null (no questions asked)
-- Populated during onboarding from TRADE_TEMPLATES.intakeQuestions

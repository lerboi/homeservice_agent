-- ============================================================
-- 005_setup_checklist.sql
-- Phase 10: Dashboard Guided Setup and First-Run Experience
-- ============================================================

-- Add dismiss state column to tenants table.
-- Completion state is derived from existing columns at read time —
-- no separate checklist items table needed.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS setup_checklist_dismissed BOOLEAN DEFAULT FALSE;

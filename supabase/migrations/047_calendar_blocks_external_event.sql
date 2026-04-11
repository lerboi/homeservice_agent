-- Phase 42: Add external calendar event tracking to calendar_blocks
ALTER TABLE calendar_blocks ADD COLUMN IF NOT EXISTS external_event_id text;

-- Phase 42: Link multi-day time blocks together for bulk delete
ALTER TABLE calendar_blocks ADD COLUMN IF NOT EXISTS group_id uuid;
CREATE INDEX IF NOT EXISTS idx_calendar_blocks_group ON calendar_blocks (group_id) WHERE group_id IS NOT NULL;



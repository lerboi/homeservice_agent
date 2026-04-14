-- Phase 48: Per-item setup checklist override storage
-- Adds JSONB map for { [item_id]: { mark_done?: bool, dismissed?: bool } }
-- Follows existing notification_preferences JSONB pattern on tenants.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS checklist_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN tenants.checklist_overrides IS
  'Per-item overrides for setup checklist. Shape: { [item_id]: { mark_done?: boolean, dismissed?: boolean } }. Used by /api/setup-checklist PATCH. Validated against VALID_ITEM_IDS in application layer.';

-- No RLS policy change needed — existing "Owners manage own tenant" policy (migration 001) already covers UPDATE.

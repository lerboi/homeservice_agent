-- Migration: Retell → LiveKit/Gemini voice system
-- Changes call identifier from retell_call_id to call_id (generic)
-- Renames retell_phone_number to phone_number on tenants
-- Renames retell_metadata to call_metadata on calls
-- Preserves all existing data

-- 1. Rename retell_call_id to call_id (generic identifier)
-- Historical Retell call IDs remain. New LiveKit calls use room name.
ALTER TABLE calls RENAME COLUMN retell_call_id TO call_id;

-- 2. Drop the NOT NULL constraint on call_id
-- The UNIQUE constraint is preserved.
ALTER TABLE calls ALTER COLUMN call_id DROP NOT NULL;

-- 3. Rename retell_metadata to call_metadata (generic)
ALTER TABLE calls RENAME COLUMN retell_metadata TO call_metadata;

-- 4. Update indexes
DROP INDEX IF EXISTS idx_calls_retell_call_id;
CREATE INDEX IF NOT EXISTS idx_calls_call_id ON calls(call_id);

-- 5. Rename retell_phone_number to phone_number on tenants
-- This column already stores Twilio numbers for US/CA tenants.
ALTER TABLE tenants RENAME COLUMN retell_phone_number TO phone_number;

-- 6. Add call_provider column to distinguish historical vs new calls
ALTER TABLE calls ADD COLUMN IF NOT EXISTS call_provider text DEFAULT 'livekit'
  CHECK (call_provider IN ('retell', 'livekit'));

-- 7. Backfill: all existing calls are from Retell
UPDATE calls SET call_provider = 'retell' WHERE call_id IS NOT NULL AND call_provider = 'livekit';

-- 8. Add column for LiveKit egress ID (useful for debugging)
ALTER TABLE calls ADD COLUMN IF NOT EXISTS egress_id text;
